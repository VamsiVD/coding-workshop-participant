"""SQL for categories.

Reads and writes the `categories` table that classifies every incident as a
facility or technology problem. Called only by the categories service
(routes -> services -> repositories); rows come back as dicts.
"""

from psycopg import Connection

COLUMNS = "id, label, category_type, is_active"


def list_all(conn: Connection, *, active_only: bool = True) -> list[dict]:
    """Categories grouped by type, then alphabetical by label.

    `active_only` is bound and tested inside the SQL, so one statement serves
    both the report form (active only) and the admin screen (everything).
    """
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
    # Nothing to change: return the current row so the caller still gets a
    # result, rather than issuing an UPDATE with an empty SET clause.
    if not fields:
        return get(conn, category_id)

    # Each placeholder is named after its column, so the values dict can be
    # passed straight through as the bound parameters.
    assignments = ", ".join(f"{name} = %({name})s" for name in fields)
    with conn.cursor() as cur:
        cur.execute(
            f"UPDATE categories SET {assignments} WHERE id = %(id)s RETURNING {COLUMNS}",
            {**fields, "id": category_id},
        )
        return cur.fetchone()


def incident_count(conn: Connection, category_id: int) -> int:
    """How many incidents use this category, open or closed.

    Checked before a delete so the client gets a clear conflict message
    instead of the foreign key's ON DELETE RESTRICT error.
    """
    with conn.cursor() as cur:
        cur.execute(
            "SELECT count(*) AS n FROM incidents WHERE category_id = %(id)s",
            {"id": category_id},
        )
        return cur.fetchone()["n"]


def delete(conn: Connection, category_id: int) -> bool:
    """True if a row was removed, False if the id did not exist."""
    with conn.cursor() as cur:
        cur.execute("DELETE FROM categories WHERE id = %(id)s", {"id": category_id})
        return cur.rowcount > 0
