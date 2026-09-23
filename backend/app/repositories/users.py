"""SQL for users.

Every query binds its parameters; none is built by concatenation.
`password_hash` is selected by exactly one function, used only at sign-in.
"""

from psycopg import Connection

# Selected explicitly rather than with *, so a column added to the table later
# cannot appear in a response by accident.
PUBLIC = "id, email, full_name, role, is_active, created_at, updated_at"


def get_by_id(conn: Connection, user_id: int) -> dict | None:
    with conn.cursor() as cur:
        cur.execute(f"SELECT {PUBLIC} FROM users WHERE id = %(id)s", {"id": user_id})
        return cur.fetchone()


def get_by_email(conn: Connection, email: str) -> dict | None:
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT {PUBLIC} FROM users WHERE email = %(email)s", {"email": email}
        )
        return cur.fetchone()


def get_by_email_with_hash(conn: Connection, email: str) -> dict | None:
    """Sign-in only. The hash never leaves the service layer."""
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT {PUBLIC}, password_hash FROM users WHERE email = %(email)s",
            {"email": email},
        )
        return cur.fetchone()


def create(
    conn: Connection,
    *,
    email: str,
    password_hash: str,
    full_name: str,
    role: str = "employee",
) -> dict:
    with conn.cursor() as cur:
        cur.execute(
            f"""
            INSERT INTO users (email, password_hash, full_name, role)
            VALUES (%(email)s, %(password_hash)s, %(full_name)s, %(role)s)
            RETURNING {PUBLIC}
            """,
            {
                "email": email,
                "password_hash": password_hash,
                "full_name": full_name,
                "role": role,
            },
        )
        return cur.fetchone()


def exists_by_email(conn: Connection, email: str) -> bool:
    with conn.cursor() as cur:
        cur.execute("SELECT 1 FROM users WHERE email = %(email)s", {"email": email})
        return cur.fetchone() is not None


def update_name(conn: Connection, user_id: int, full_name: str) -> dict | None:
    with conn.cursor() as cur:
        cur.execute(
            f"UPDATE users SET full_name = %(name)s WHERE id = %(id)s RETURNING {PUBLIC}",
            {"id": user_id, "name": full_name},
        )
        return cur.fetchone()


def set_active(conn: Connection, user_id: int, is_active: bool) -> dict | None:
    """Users are deactivated, never deleted: incidents reference them."""
    with conn.cursor() as cur:
        cur.execute(
            f"""
            UPDATE users SET is_active = %(active)s
            WHERE id = %(id)s RETURNING {PUBLIC}
            """,
            {"id": user_id, "active": is_active},
        )
        return cur.fetchone()
