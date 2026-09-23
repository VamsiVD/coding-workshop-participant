"""SQL for incident notes."""

from psycopg import Connection

_SELECT = """
    SELECT n.id, n.incident_id, n.body, n.created_at, n.updated_at,
           u.id AS author_id, u.full_name AS author_name,
           u.email AS author_email, u.role AS author_role
    FROM incident_notes n
    JOIN users u ON u.id = n.author_id
"""


def _shape(row: dict | None) -> dict | None:
    if row is None:
        return None
    row = dict(row)
    row["author"] = {
        "id": row.pop("author_id"),
        "full_name": row.pop("author_name"),
        "email": row.pop("author_email"),
        "role": row.pop("author_role"),
    }
    return row


def list_for_incident(
    conn: Connection, incident_id: int, *, limit: int, offset: int, order: str = "asc"
) -> tuple[list[dict], int]:
    # Direction comes from a validated pattern, never from raw input.
    direction = "DESC" if order == "desc" else "ASC"
    with conn.cursor() as cur:
        cur.execute(
            "SELECT count(*) AS n FROM incident_notes WHERE incident_id = %(id)s",
            {"id": incident_id},
        )
        total = cur.fetchone()["n"]

        cur.execute(
            f"""
            {_SELECT}
            WHERE n.incident_id = %(id)s
            ORDER BY n.created_at {direction}, n.id {direction}
            LIMIT %(limit)s OFFSET %(offset)s
            """,
            {"id": incident_id, "limit": limit, "offset": offset},
        )
        return [_shape(row) for row in cur.fetchall()], total


def get(conn: Connection, note_id: int) -> dict | None:
    with conn.cursor() as cur:
        cur.execute(f"{_SELECT} WHERE n.id = %(id)s", {"id": note_id})
        return _shape(cur.fetchone())


def create(conn: Connection, *, incident_id: int, author_id: int, body: str) -> dict:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO incident_notes (incident_id, author_id, body)
            VALUES (%(incident_id)s, %(author_id)s, %(body)s)
            RETURNING id
            """,
            {"incident_id": incident_id, "author_id": author_id, "body": body},
        )
        note_id = cur.fetchone()["id"]
    return get(conn, note_id)


def update(conn: Connection, note_id: int, body: str) -> dict | None:
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE incident_notes SET body = %(body)s WHERE id = %(id)s",
            {"id": note_id, "body": body},
        )
        if cur.rowcount == 0:
            return None
    return get(conn, note_id)


def delete(conn: Connection, note_id: int) -> bool:
    with conn.cursor() as cur:
        cur.execute("DELETE FROM incident_notes WHERE id = %(id)s", {"id": note_id})
        return cur.rowcount > 0
