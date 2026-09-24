"""SQL for users.

Every query binds its parameters; none is built by concatenation.
`password_hash` is selected by exactly one function, used only at sign-in.
Called by the auth and engineers services (routes -> services ->
repositories).
"""

from psycopg import Connection

# Selected explicitly rather than with *, so a column added to the table later
# cannot appear in a response by accident.
PUBLIC = (
    "id, email, full_name, role, is_active, building_id, floor_id, seat_id, "
    "created_at, updated_at"
)


def get_by_id(conn: Connection, user_id: int) -> dict | None:
    with conn.cursor() as cur:
        cur.execute(f"SELECT {PUBLIC} FROM users WHERE id = %(id)s", {"id": user_id})
        return cur.fetchone()


def get_by_email(conn: Connection, email: str) -> dict | None:
    """Public columns for the user with this email, matched case-insensitively
    because the column is citext."""
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
    building_id: int | None = None,
    floor_id: int | None = None,
    seat_id: int | None = None,
) -> dict:
    """Insert a user and return the public columns, never the hash.

    The table's CHECK constraints are a second line of defence behind the
    service: they refuse a non-@acme.inc email and a password_hash that is
    not a bcrypt or argon2 hash.
    """
    with conn.cursor() as cur:
        cur.execute(
            f"""
            INSERT INTO users (email, password_hash, full_name, role,
                               building_id, floor_id, seat_id)
            VALUES (%(email)s, %(password_hash)s, %(full_name)s, %(role)s,
                    %(building_id)s, %(floor_id)s, %(seat_id)s)
            RETURNING {PUBLIC}
            """,
            {
                "email": email,
                "password_hash": password_hash,
                "full_name": full_name,
                "role": role,
                "building_id": building_id,
                "floor_id": floor_id,
                "seat_id": seat_id,
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


def list_for_admin(
    conn: Connection, *, q: str | None, role: str | None, include_inactive: bool
) -> list[dict]:
    """Everyone, for the admin's people list, ordered by name.

    Optional filters use the NULL-disables-the-condition pattern, so the SQL
    text is fixed. `q` matches name or email; its wildcards are added to the
    bound value, not the SQL.
    """
    return conn.execute(
        f"""
        SELECT {PUBLIC} FROM users
        WHERE (%(q)s::text IS NULL OR full_name ILIKE %(q)s OR email ILIKE %(q)s)
          AND (%(role)s::text IS NULL OR role = %(role)s::user_role)
          AND (%(include_inactive)s OR is_active)
        ORDER BY full_name, id
        """,
        {"q": f"%{q}%" if q else None, "role": role, "include_inactive": include_inactive},
    ).fetchall()


def lock(conn: Connection, user_id: int) -> dict | None:
    """Read and lock the user's row until the transaction ends."""
    return conn.execute(
        f"SELECT {PUBLIC} FROM users WHERE id = %(id)s FOR UPDATE", {"id": user_id}
    ).fetchone()


def update_account(conn: Connection, user_id: int, changes: dict) -> dict | None:
    """Change name, role or active flag. Column names come from the allowlist
    below, never from the request; values are always bound."""
    allowed = {"full_name", "role", "is_active"}
    fields = {k: v for k, v in changes.items() if k in allowed}
    if not fields:
        return get_by_id(conn, user_id)
    assignments = ", ".join(
        f"{name} = %({name})s::user_role" if name == "role" else f"{name} = %({name})s"
        for name in fields
    )
    return conn.execute(
        f"UPDATE users SET {assignments} WHERE id = %(id)s RETURNING {PUBLIC}",
        {**fields, "id": user_id},
    ).fetchone()


def count_other_active_admins(conn: Connection, user_id: int) -> int:
    """Active administrators other than this user. Locks them, so two admins
    cannot demote each other at the same moment and leave none."""
    rows = conn.execute(
        """
        SELECT id FROM users
        WHERE role = 'admin' AND is_active AND id <> %(id)s
        FOR UPDATE
        """,
        {"id": user_id},
    ).fetchall()
    return len(rows)
