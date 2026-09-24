"""SQL for engineer profiles.

An engineer is a user plus a profile row. Reads join the two; the service
layer creates both inside one transaction. This module sits below the
engineers and incidents services (routes -> services -> repositories).
"""

from psycopg import Connection

# Shared by get() and list_all(). The category join is LEFT because a
# specialisation is optional (and is nulled if its category is deleted).
_SELECT = """
    SELECT ep.user_id, u.email, u.full_name, u.is_active,
           ep.is_available, ep.max_active_tickets, ep.phone,
           ep.created_at, ep.updated_at,
           c.id AS specialization_id, c.label AS specialization_label,
           c.category_type AS specialization_type
    FROM engineer_profiles ep
    -- A profile outlives a demotion (incidents still point at it), so the
    -- role decides who counts as an engineer now.
    JOIN users u ON u.id = ep.user_id AND u.role = 'engineer'
    LEFT JOIN categories c ON c.id = ep.specialization_id
"""


def _shape(row: dict | None) -> dict | None:
    """Fold the flat specialisation columns into a nested object."""
    if row is None:
        return None
    specialization = None
    if row.get("specialization_id") is not None:
        specialization = {
            "id": row["specialization_id"],
            "label": row["specialization_label"],
            "category_type": row["specialization_type"],
        }
    shaped = {
        k: v
        for k, v in row.items()
        if k not in ("specialization_id", "specialization_label", "specialization_type")
    }
    shaped["specialization"] = specialization
    return shaped


def get(conn: Connection, user_id: int) -> dict | None:
    with conn.cursor() as cur:
        cur.execute(f"{_SELECT} WHERE ep.user_id = %(id)s", {"id": user_id})
        return _shape(cur.fetchone())


def list_all(
    conn: Connection,
    *,
    available: bool | None = None,
    category_id: int | None = None,
    active_only: bool = True,
) -> list[dict]:
    """Engineer profiles ordered by name, each shaped like get().

    Every filter is optional: a NULL parameter makes its condition true, so
    the SQL text is fixed and only the bound values change. The casts tell
    Postgres the type of a parameter that may arrive as NULL.
    """
    with conn.cursor() as cur:
        cur.execute(
            f"""
            {_SELECT}
            WHERE (%(available)s::boolean IS NULL OR ep.is_available = %(available)s::boolean)
              AND (%(category_id)s::bigint IS NULL OR ep.specialization_id = %(category_id)s::bigint)
              AND (%(active_only)s::boolean IS FALSE OR u.is_active)
            ORDER BY u.full_name
            """,
            {
                "available": available,
                "category_id": category_id,
                "active_only": active_only,
            },
        )
        return [_shape(row) for row in cur.fetchall()]


def create_profile(
    conn: Connection,
    *,
    user_id: int,
    specialization_id: int | None,
    phone: str | None,
    max_active_tickets: int,
    is_available: bool,
) -> dict:
    """Add the profile row for an existing user and return the joined view.

    The user row must already exist in the same transaction; the profile's
    primary key is that user's id.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO engineer_profiles
                (user_id, specialization_id, phone, max_active_tickets, is_available)
            VALUES (%(user_id)s, %(specialization_id)s, %(phone)s,
                    %(max_active_tickets)s, %(is_available)s)
            """,
            {
                "user_id": user_id,
                "specialization_id": specialization_id,
                "phone": phone,
                "max_active_tickets": max_active_tickets,
                "is_available": is_available,
            },
        )
    # Re-read through the join rather than RETURNING, so the result carries
    # the user's name and email and the nested specialisation.
    return get(conn, user_id)


def update_profile(conn: Connection, user_id: int, changes: dict) -> dict | None:
    """PATCH on the profile columns only; name and email live on `users`.

    Column names come from the allowlist below, never from the request, and
    every value is bound. Returns the joined view, or None if no profile.
    """
    allowed = {"specialization_id", "phone", "max_active_tickets", "is_available"}
    fields = {k: v for k, v in changes.items() if k in allowed}
    if not fields:
        return get(conn, user_id)

    assignments = ", ".join(f"{name} = %({name})s" for name in fields)
    with conn.cursor() as cur:
        cur.execute(
            f"UPDATE engineer_profiles SET {assignments} WHERE user_id = %(user_id)s",
            {**fields, "user_id": user_id},
        )
    return get(conn, user_id)


def active_ticket_count(conn: Connection, user_id: int) -> int:
    """Tickets the engineer still holds: open, in progress or blocked.

    Used to log an assignment over `max_active_tickets` and to
    refuse deactivating an engineer who still has work. Served by the
    (assignee_id, status) index.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT count(*) AS n FROM incidents
            WHERE assignee_id = %(id)s
              AND status IN ('open', 'in_progress', 'blocked')
            """,
            {"id": user_id},
        )
        return cur.fetchone()["n"]


def workload(conn: Connection) -> list[dict]:
    """Every engineer with their current load, for the assignment picker.

    Counted with FILTER in one pass rather than one query per status.
    The incidents join is LEFT and counts `i.id` rather than `*`, so an
    engineer with no tickets still appears, with zeros.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT ep.user_id, u.full_name, ep.is_available, ep.max_active_tickets,
                   c.label AS specialization,
                   count(i.id) FILTER (WHERE i.status = 'open') AS open_tickets,
                   count(i.id) FILTER (WHERE i.status = 'in_progress') AS in_progress_tickets,
                   count(i.id) FILTER (WHERE i.status = 'blocked') AS blocked_tickets,
                   count(i.id) FILTER (
                       WHERE i.status IN ('resolved', 'closed')
                         AND i.resolved_at > now() - interval '30 days'
                   ) AS resolved_last_30_days
            FROM engineer_profiles ep
            JOIN users u ON u.id = ep.user_id
            LEFT JOIN categories c ON c.id = ep.specialization_id
            LEFT JOIN incidents i ON i.assignee_id = ep.user_id
            WHERE u.is_active AND u.role = 'engineer'
            GROUP BY ep.user_id, u.full_name, ep.is_available,
                     ep.max_active_tickets, c.label
            ORDER BY u.full_name
            """
        )
        return cur.fetchall()


def lock(conn: Connection, user_id: int) -> bool:
    """Lock the engineer's profile row until the transaction ends.

    Assigning and deactivating both take this lock, so an engineer cannot be
    deactivated while a ticket is being assigned to them. False if there is
    no profile.
    """
    row = conn.execute(
        "SELECT user_id FROM engineer_profiles WHERE user_id = %(id)s FOR UPDATE",
        {"id": user_id},
    ).fetchone()
    return row is not None
