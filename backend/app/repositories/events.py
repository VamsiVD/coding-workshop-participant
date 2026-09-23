"""SQL for the incident audit trail.

Append-only: there is no update and no delete. Rows leave only when the
incident does, by cascade.
"""

from psycopg import Connection


def record(
    conn: Connection,
    *,
    incident_id: int,
    actor_id: int | None,
    event_type: str,
    from_value: str | None = None,
    to_value: str | None = None,
    reason: str | None = None,
) -> dict:
    """Write one event.

    Called inside the same transaction as the change it records, so an
    incident cannot move without its trail, and a failed move leaves no event
    behind.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO incident_events
                (incident_id, actor_id, event_type, from_value, to_value, reason)
            VALUES (%(incident_id)s, %(actor_id)s, %(event_type)s,
                    %(from_value)s, %(to_value)s, %(reason)s)
            RETURNING *
            """,
            {
                "incident_id": incident_id,
                "actor_id": actor_id,
                "event_type": event_type,
                "from_value": from_value,
                "to_value": to_value,
                "reason": reason,
            },
        )
        return cur.fetchone()


def timeline(conn: Connection, incident_id: int) -> list[dict]:
    """Every event for one incident, oldest first.

    Bounded by the (incident_id, created_at) index, so the cost follows this
    incident's history rather than the size of the table.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT e.id, e.incident_id, e.event_type, e.from_value, e.to_value,
                   e.reason, e.created_at,
                   u.id AS actor_id, u.full_name AS actor_name,
                   u.email AS actor_email, u.role AS actor_role
            FROM incident_events e
            LEFT JOIN users u ON u.id = e.actor_id
            WHERE e.incident_id = %(id)s
            ORDER BY e.created_at, e.id
            """,
            {"id": incident_id},
        )
        rows = []
        for row in cur.fetchall():
            row = dict(row)
            actor = None
            if row.get("actor_id") is not None:
                actor = {
                    "id": row["actor_id"],
                    "full_name": row["actor_name"],
                    "email": row["actor_email"],
                    "role": row["actor_role"],
                }
            for key in ("actor_id", "actor_name", "actor_email", "actor_role"):
                row.pop(key, None)
            row["actor"] = actor
            rows.append(row)
        return rows
