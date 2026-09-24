"""SQL for engineers' requests to be assigned an incident.

Data-access layer (routes -> services -> repositories): the rules about who
may ask, and when, live in `app.services.assignment_requests`. A row exists
only while the request is pending; see `db/init/03_assignment_requests.sql`.
"""

from psycopg import Connection

# The request with the names the admin console shows beside it.
_SELECT = """
    SELECT r.id, r.incident_id, r.engineer_id, r.note, r.created_at,
           u.full_name AS engineer_name,
           i.title AS incident_title
    FROM incident_assignment_requests r
    JOIN users u ON u.id = r.engineer_id
    JOIN incidents i ON i.id = r.incident_id
"""


def get(conn: Connection, request_id: int) -> dict | None:
    return conn.execute(f"{_SELECT} WHERE r.id = %(id)s", {"id": request_id}).fetchone()


def upsert(
    conn: Connection, *, incident_id: int, engineer_id: int, note: str | None
) -> dict:
    """Create the request, or replace the note if this engineer already asked.

    Asking twice is not an error: the engineer may simply want to change what
    they told the administrator.
    """
    row = conn.execute(
        """
        INSERT INTO incident_assignment_requests (incident_id, engineer_id, note)
        VALUES (%(incident_id)s, %(engineer_id)s, %(note)s)
        ON CONFLICT (incident_id, engineer_id) DO UPDATE SET note = EXCLUDED.note
        RETURNING id
        """,
        {"incident_id": incident_id, "engineer_id": engineer_id, "note": note},
    ).fetchone()
    return get(conn, row["id"])


def delete_own(conn: Connection, *, incident_id: int, engineer_id: int) -> bool:
    """Withdraw this engineer's request. False if there was none."""
    cur = conn.execute(
        """
        DELETE FROM incident_assignment_requests
        WHERE incident_id = %(incident_id)s AND engineer_id = %(engineer_id)s
        """,
        {"incident_id": incident_id, "engineer_id": engineer_id},
    )
    return cur.rowcount > 0


def delete(conn: Connection, request_id: int) -> bool:
    """Remove one request by id (an administrator declining it)."""
    cur = conn.execute(
        "DELETE FROM incident_assignment_requests WHERE id = %(id)s", {"id": request_id}
    )
    return cur.rowcount > 0


def delete_for_incident(conn: Connection, incident_id: int) -> None:
    """Clear every request on an incident once it has been assigned."""
    conn.execute(
        "DELETE FROM incident_assignment_requests WHERE incident_id = %(id)s",
        {"id": incident_id},
    )


def incident_ids_requested_by(conn: Connection, engineer_id: int) -> set[int]:
    """Incidents this engineer has a pending request on, to flag them in the pool."""
    rows = conn.execute(
        """
        SELECT incident_id FROM incident_assignment_requests
        WHERE engineer_id = %(engineer_id)s
        """,
        {"engineer_id": engineer_id},
    ).fetchall()
    return {row["incident_id"] for row in rows}


def list_pending(conn: Connection) -> list[dict]:
    """Every pending request, oldest first, for the admin console."""
    return conn.execute(f"{_SELECT} ORDER BY r.created_at, r.id").fetchall()
