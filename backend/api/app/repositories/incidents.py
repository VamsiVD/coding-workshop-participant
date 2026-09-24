"""SQL for incidents: search, detail, create and the per-field updates.

The timeline and audit events live in `events.py`, and the incidents service
(routes -> services -> repositories) writes both inside one transaction.

Filters are composed as a list of bound conditions rather than by building
strings, so a caller cannot inject SQL through a query parameter. Sort is
restricted to an allowlist for the same reason: a column name cannot be bound
as a parameter, so it must never come from the request unchecked.
"""

from typing import Any

from psycopg import Connection

# Fields a client may sort by. Anything else is rejected before it reaches SQL.
SORT_COLUMNS = {
    "created_at": "i.created_at",
    "updated_at": "i.updated_at",
    "priority": "i.priority",
    "status": "i.status",
}

# The list-view row, shared by search() and find_similar(). Floor, seat and
# assignee are optional on an incident, hence their LEFT joins; the note count
# is a correlated subquery so it does not multiply rows the way a join would.
_SUMMARY_SELECT = """
    SELECT i.id, i.title, i.status, i.priority, i.escalation_status, i.is_escalated,
           i.created_at, i.updated_at,
           i.reporter_id, i.assignee_id, i.escalation_reason, i.blocked_reason,
           c.id AS category_id, c.label AS category_label,
           c.category_type AS category_type,
           b.name AS building_name,
           f.label AS floor_label,
           s.code AS seat_code,
           reporter.full_name AS reporter_name,
           assignee.full_name AS assignee_name,
           (SELECT count(*) FROM incident_notes n WHERE n.incident_id = i.id)
               AS note_count
    FROM incidents i
    JOIN categories c ON c.id = i.category_id
    JOIN buildings b ON b.id = i.building_id
    LEFT JOIN floors f ON f.id = i.floor_id
    LEFT JOIN seats s ON s.id = i.seat_id
    JOIN users reporter ON reporter.id = i.reporter_id
    LEFT JOIN users assignee ON assignee.id = i.assignee_id
"""


def _shape_summary(row: dict) -> dict:
    """Fold the flat category columns into a nested `category` object."""
    row = dict(row)
    row["category"] = {
        "id": row.pop("category_id"),
        "label": row.pop("category_label"),
        "category_type": row.pop("category_type"),
    }
    return row


def _build_filters(
    filters: dict, *, scope_clause: str | None, scope_params: dict
) -> tuple[str, dict[str, Any]]:
    """Turn the filter object into a WHERE clause and its parameters.

    `scope_clause` is the role restriction decided by the service layer. It is
    applied as an AND alongside the caller's filters, so a filter can narrow
    the visible set but never widen it.
    """
    conditions: list[str] = []
    params: dict[str, Any] = {}

    if scope_clause:
        conditions.append(scope_clause)
        params.update(scope_params)

    # Filter key -> fixed SQL fragment. Only the value is taken from the
    # request, and it is bound under the same name as the key.
    simple = {
        "status": "i.status = %(status)s",
        "priority": "i.priority = %(priority)s",
        "category_id": "i.category_id = %(category_id)s",
        "building_id": "i.building_id = %(building_id)s",
        "floor_id": "i.floor_id = %(floor_id)s",
        "seat_id": "i.seat_id = %(seat_id)s",
        "assignee_id": "i.assignee_id = %(assignee_id)s",
        "reporter_id": "i.reporter_id = %(reporter_id)s",
        "created_from": "i.created_at >= %(created_from)s",
        "created_to": "i.created_at <= %(created_to)s",
    }
    for key, clause in simple.items():
        value = filters.get(key)
        if value is not None:
            conditions.append(clause)
            params[key] = value

    if filters.get("escalated") is not None:
        conditions.append("i.is_escalated = %(escalated)s")
        params["escalated"] = filters["escalated"]

    # Not a query-string filter: set only by the service for the engineers'
    # open-job pool.
    if filters.get("unassigned"):
        conditions.append("i.assignee_id IS NULL")

    if filters.get("q"):
        # Served by the GIN trigram indexes on title and description.
        conditions.append("(i.title ILIKE %(q)s OR i.description ILIKE %(q)s)")
        # The wildcards are added to the bound value, not to the SQL text.
        params["q"] = f"%{filters['q']}%"

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    return where, params


def _order_by(sort: str) -> str:
    """ORDER BY clause for a sort key such as "priority" or "-created_at".

    A leading "-" means descending. An unknown key falls back to created_at
    rather than raising, and only SORT_COLUMNS values reach the SQL.
    """
    descending = sort.startswith("-")
    column = SORT_COLUMNS.get(sort.lstrip("-"), "i.created_at")
    # Tie-break on id so paging is stable when timestamps collide.
    return f"ORDER BY {column} {'DESC' if descending else 'ASC'}, i.id DESC"


def search(
    conn: Connection,
    filters: dict,
    *,
    scope_clause: str | None,
    scope_params: dict,
    limit: int,
    offset: int,
    sort: str = "-created_at",
) -> tuple[list[dict], int]:
    """One page of incidents plus the total matching count.

    Rows have the _SUMMARY_SELECT shape with a nested `category`. The same
    WHERE clause and parameters drive both statements, so the total always
    describes the set being paged through.
    """
    where, params = _build_filters(
        filters, scope_clause=scope_clause, scope_params=scope_params
    )

    with conn.cursor() as cur:
        # The count needs no joins: every filter is on incidents' own columns.
        cur.execute(f"SELECT count(*) AS n FROM incidents i {where}", params)
        total = cur.fetchone()["n"]

        cur.execute(
            f"""
            {_SUMMARY_SELECT}
            {where}
            {_order_by(sort)}
            LIMIT %(limit)s OFFSET %(offset)s
            """,
            {**params, "limit": limit, "offset": offset},
        )
        rows = [_shape_summary(row) for row in cur.fetchall()]

    return rows, total


def get_detail(conn: Connection, incident_id: int) -> dict | None:
    """Every incident column plus the labels, location names and people
    behind its foreign keys, flat, for the detail view. The service layer
    shapes it; notes and events are fetched separately."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT i.*,
                   c.label AS category_label, c.category_type,
                   b.name AS building_name, b.code AS building_code,
                   f.label AS floor_label, f.level AS floor_level,
                   s.code AS seat_code,
                   reporter.full_name AS reporter_name,
                   reporter.email AS reporter_email,
                   reporter.role AS reporter_role,
                   assignee.full_name AS assignee_name,
                   assignee.email AS assignee_email,
                   assignee.role AS assignee_role
            FROM incidents i
            JOIN categories c ON c.id = i.category_id
            JOIN buildings b ON b.id = i.building_id
            LEFT JOIN floors f ON f.id = i.floor_id
            LEFT JOIN seats s ON s.id = i.seat_id
            JOIN users reporter ON reporter.id = i.reporter_id
            LEFT JOIN users assignee ON assignee.id = i.assignee_id
            WHERE i.id = %(id)s
            """,
            {"id": incident_id},
        )
        return cur.fetchone()


def get_raw(conn: Connection, incident_id: int) -> dict | None:
    """The incident row alone, for permission and transition checks."""
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM incidents WHERE id = %(id)s", {"id": incident_id})
        return cur.fetchone()


def create(
    conn: Connection,
    *,
    title: str,
    description: str,
    category_id: int,
    building_id: int,
    floor_id: int | None,
    seat_id: int | None,
    reporter_id: int,
) -> dict:
    """Insert a new incident and return the raw row.

    Status, priority and escalation take their column defaults (open,
    medium, not_requested). The composite foreign keys in the schema reject
    a floor outside the building or a seat on another floor.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO incidents
                (title, description, category_id, building_id, floor_id,
                 seat_id, reporter_id)
            VALUES (%(title)s, %(description)s, %(category_id)s, %(building_id)s,
                    %(floor_id)s, %(seat_id)s, %(reporter_id)s)
            RETURNING *
            """,
            {
                "title": title,
                "description": description,
                "category_id": category_id,
                "building_id": building_id,
                "floor_id": floor_id,
                "seat_id": seat_id,
                "reporter_id": reporter_id,
            },
        )
        return cur.fetchone()


def update_fields(conn: Connection, incident_id: int, changes: dict) -> dict | None:
    """PATCH on the descriptive fields. Status, priority, assignment and
    escalation each have their own function, because each also writes an
    audit event and may set a timestamp."""
    allowed = {
        "title",
        "description",
        "category_id",
        "building_id",
        "floor_id",
        "seat_id",
    }
    fields = {k: v for k, v in changes.items() if k in allowed}
    if not fields:
        return get_raw(conn, incident_id)

    # Column names come from `allowed` above, never from the request; each
    # value is bound under its column's name.
    assignments = ", ".join(f"{name} = %({name})s" for name in fields)
    with conn.cursor() as cur:
        cur.execute(
            f"UPDATE incidents SET {assignments} WHERE id = %(id)s RETURNING *",
            {**fields, "id": incident_id},
        )
        return cur.fetchone()


def set_status(
    conn: Connection,
    incident_id: int,
    *,
    status: str,
    blocked_reason: str | None,
) -> dict:
    """Move the incident and stamp the matching timestamp in one statement.

    acknowledged_at is set with coalesce so the first time work starts is the
    one recorded: an incident that goes in_progress, blocked, then
    in_progress again keeps its original acknowledged_at.

    resolved_at and closed_at behave differently: each is stamped afresh on
    entering its state, and resolved_at is cleared if the incident is
    reopened, so they always describe the latest resolution. blocked_reason
    is kept only while the incident is blocked. The status is cast to the
    enum so the CASE comparisons are typed; whether the transition is legal
    is the service layer's decision.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE incidents
            SET status = %(status)s::incident_status,
                blocked_reason = CASE
                    WHEN %(status)s::incident_status = 'blocked' THEN %(blocked_reason)s
                    ELSE NULL
                END,
                acknowledged_at = CASE
                    WHEN %(status)s::incident_status = 'in_progress'
                    THEN coalesce(acknowledged_at, now())
                    ELSE acknowledged_at
                END,
                resolved_at = CASE
                    WHEN %(status)s::incident_status = 'resolved' THEN now()
                    WHEN %(status)s::incident_status IN ('open', 'in_progress', 'blocked') THEN NULL
                    ELSE resolved_at
                END,
                closed_at = CASE
                    WHEN %(status)s::incident_status = 'closed' THEN now()
                    ELSE NULL
                END
            WHERE id = %(id)s
            RETURNING *
            """,
            {"id": incident_id, "status": status, "blocked_reason": blocked_reason},
        )
        return cur.fetchone()


def set_priority(conn: Connection, incident_id: int, priority: str) -> dict:
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE incidents SET priority = %(priority)s::incident_priority WHERE id = %(id)s RETURNING *",
            {"id": incident_id, "priority": priority},
        )
        return cur.fetchone()


def set_assignee(conn: Connection, incident_id: int, engineer_id: int | None) -> dict:
    """Assign or, with None, unassign the incident.

    assigned_at keeps the first assignment time across reassignments, so
    "time to assign" in the reports is not reset by a handover. Unassigning
    clears it. The foreign key to engineer_profiles rejects a non-engineer.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE incidents
            SET assignee_id = %(engineer_id)s,
                assigned_at = CASE
                    WHEN %(engineer_id)s::bigint IS NULL THEN NULL
                    ELSE coalesce(assigned_at, now())
                END
            WHERE id = %(id)s
            RETURNING *
            """,
            {"id": incident_id, "engineer_id": engineer_id},
        )
        return cur.fetchone()


def set_escalation(
    conn: Connection, incident_id: int, *, state: str, reason: str | None
) -> dict:
    """Set the escalation state, keeping the existing reason if none is given.

    That lets an approve or reject decision leave the requester's reason in
    place. `is_escalated` is a generated column and follows automatically.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE incidents
            SET escalation_status = %(state)s::escalation_state,
                escalation_reason = coalesce(%(reason)s::text, escalation_reason)
            WHERE id = %(id)s
            RETURNING *
            """,
            {"id": incident_id, "state": state, "reason": reason},
        )
        return cur.fetchone()


def mark_duplicate(conn: Connection, incident_id: int, original_id: int) -> dict:
    """Point the incident at the one it duplicates. A CHECK constraint
    stops an incident from being marked a duplicate of itself."""
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE incidents SET duplicate_of_id = %(original)s
            WHERE id = %(id)s RETURNING *
            """,
            {"id": incident_id, "original": original_id},
        )
        return cur.fetchone()


def delete(conn: Connection, incident_id: int) -> bool:
    """Remove the incident; its notes and events go with it by cascade."""
    with conn.cursor() as cur:
        cur.execute("DELETE FROM incidents WHERE id = %(id)s", {"id": incident_id})
        return cur.rowcount > 0


def find_similar(
    conn: Connection,
    *,
    seat_id: int | None,
    floor_id: int | None,
    building_id: int | None,
    category_id: int | None,
    limit: int,
) -> list[dict]:
    """Open incidents already reported for the same place and kind.

    Shown to a reporter before they submit, so a duplicate is less likely to
    be raised in the first place.

    Each location and category argument is optional: a NULL makes its
    condition true, so the same fixed SQL serves any combination. Newest
    first, at most `limit` rows, in the same shape as search().
    """
    with conn.cursor() as cur:
        cur.execute(
            f"""
            {_SUMMARY_SELECT}
            WHERE i.status NOT IN ('resolved', 'closed')
              AND (%(seat_id)s::bigint IS NULL OR i.seat_id = %(seat_id)s::bigint)
              AND (%(floor_id)s::bigint IS NULL OR i.floor_id = %(floor_id)s::bigint)
              AND (%(building_id)s::bigint IS NULL OR i.building_id = %(building_id)s::bigint)
              AND (%(category_id)s::bigint IS NULL OR i.category_id = %(category_id)s::bigint)
            ORDER BY i.created_at DESC
            LIMIT %(limit)s
            """,
            {
                "seat_id": seat_id,
                "floor_id": floor_id,
                "building_id": building_id,
                "category_id": category_id,
                "limit": limit,
            },
        )
        return [_shape_summary(row) for row in cur.fetchall()]


def lock(conn: Connection, incident_id: int) -> dict | None:
    """Read the incident's row and lock it until the transaction ends.

    Must run inside `transaction(conn)`. Anything else that locks the same row
    (assigning, changing status, requesting the job) waits, so a check made on
    the locked row still holds when the write that depends on it commits.
    """
    return conn.execute(
        "SELECT * FROM incidents WHERE id = %(id)s FOR UPDATE", {"id": incident_id}
    ).fetchone()
