"""SQL for incidents, their timeline and their audit events.

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

    if filters.get("q"):
        # Served by the GIN trigram indexes on title and description.
        conditions.append("(i.title ILIKE %(q)s OR i.description ILIKE %(q)s)")
        params["q"] = f"%{filters['q']}%"

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    return where, params


def _order_by(sort: str) -> str:
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
    """One page of incidents plus the total matching count."""
    where, params = _build_filters(
        filters, scope_clause=scope_clause, scope_params=scope_params
    )

    with conn.cursor() as cur:
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

    The timestamps are set with coalesce so the first time a stage is reached
    is the one recorded: an incident that goes in_progress, blocked, then
    in_progress again keeps its original acknowledged_at.
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
