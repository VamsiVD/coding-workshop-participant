"""SQL for categories."""

from psycopg import Connection

COLUMNS = "id, label, category_type, is_active"


def list_all(conn: Connection, *, active_only: bool = True) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT {COLUMNS} FROM categories
            WHERE (%(active_only)s::boolean IS FALSE OR is_active)
            ORDER BY category_type, label
            """,
            {"active_only": active_only},
        )
        return cur.fetchall()


def get(conn: Connection, category_id: int) -> dict | None:
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT {COLUMNS} FROM categories WHERE id = %(id)s", {"id": category_id}
        )
        return cur.fetchone()


def create(conn: Connection, *, label: str, category_type: str) -> dict:
    with conn.cursor() as cur:
        cur.execute(
            f"""
            INSERT INTO categories (label, category_type)
            VALUES (%(label)s, %(category_type)s)
            RETURNING {COLUMNS}
            """,
            {"label": label, "category_type": category_type},
        )
        return cur.fetchone()


def update(conn: Connection, category_id: int, changes: dict) -> dict | None:
    """Builds a SET clause from the fields actually supplied.

    Column names come from this module's own allowlist, never from the
    request, and every value is bound.
    """
    allowed = {"label", "category_type", "is_active"}
    fields = {k: v for k, v in changes.items() if k in allowed}
    if not fields:
        return get(conn, category_id)

    assignments = ", ".join(f"{name} = %({name})s" for name in fields)
    with conn.cursor() as cur:
        cur.execute(
            f"UPDATE categories SET {assignments} WHERE id = %(id)s RETURNING {COLUMNS}",
            {**fields, "id": category_id},
        )
        return cur.fetchone()


def incident_count(conn: Connection, category_id: int) -> int:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT count(*) AS n FROM incidents WHERE category_id = %(id)s",
            {"id": category_id},
        )
        return cur.fetchone()["n"]


def delete(conn: Connection, category_id: int) -> bool:
    with conn.cursor() as cur:
        cur.execute("DELETE FROM categories WHERE id = %(id)s", {"id": category_id})
        return cur.rowcount > 0
