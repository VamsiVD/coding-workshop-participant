"""SQL for buildings, floors and seats.

Reads and writes the building -> floor -> seat hierarchy that incidents are
located in. Called by the facilities service (routes -> services ->
repositories); every function returns plain dict rows.
"""

from psycopg import Connection

# Explicit column lists per table, reused by every SELECT and RETURNING below.
BUILDING = "id, name, code, address, is_active, created_at"
FLOOR = "id, building_id, level, label, created_at"
SEAT = "id, floor_id, code, kind, created_at"

# The columns a PATCH may touch, per table. Keys double as the only table
# names _update() will interpolate into SQL.
_ALLOWED_UPDATES = {
    "buildings": {"name", "code", "address", "is_active"},
    "floors": {"level", "label"},
    "seats": {"code", "kind"},
}


def _update(conn: Connection, table: str, columns: str, row_id: int, changes: dict):
    """Shared PATCH helper.

    The table and column names come from this module's allowlists, never from
    the request; values are always bound.
    """
    fields = {k: v for k, v in changes.items() if k in _ALLOWED_UPDATES[table]}
    # An empty PATCH is a plain read, so the caller always gets the current
    # row back (or None if the id does not exist).
    if not fields:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT {columns} FROM {table} WHERE id = %(id)s", {"id": row_id}
            )
            return cur.fetchone()

    assignments = ", ".join(f"{name} = %({name})s" for name in fields)
    with conn.cursor() as cur:
        cur.execute(
            f"UPDATE {table} SET {assignments} WHERE id = %(id)s RETURNING {columns}",
            {**fields, "id": row_id},
        )
        return cur.fetchone()


# ---------------------------------------------------------------------------
# Buildings
# ---------------------------------------------------------------------------


def list_buildings(conn: Connection, *, active_only: bool = True) -> list[dict]:
    """Buildings by name; inactive ones only when `active_only` is False."""
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT {BUILDING} FROM buildings
            WHERE (%(active_only)s::boolean IS FALSE OR is_active)
            ORDER BY name
            """,
            {"active_only": active_only},
        )
        return cur.fetchall()


def get_building(conn: Connection, building_id: int) -> dict | None:
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT {BUILDING} FROM buildings WHERE id = %(id)s", {"id": building_id}
        )
        return cur.fetchone()


def create_building(
    conn: Connection, *, name: str, code: str, address: str | None
) -> dict:
    with conn.cursor() as cur:
        cur.execute(
            f"""
            INSERT INTO buildings (name, code, address)
            VALUES (%(name)s, %(code)s, %(address)s)
            RETURNING {BUILDING}
            """,
            {"name": name, "code": code, "address": address},
        )
        return cur.fetchone()


def update_building(conn: Connection, building_id: int, changes: dict) -> dict | None:
    return _update(conn, "buildings", BUILDING, building_id, changes)


def delete_building(conn: Connection, building_id: int) -> bool:
    with conn.cursor() as cur:
        cur.execute("DELETE FROM buildings WHERE id = %(id)s", {"id": building_id})
        return cur.rowcount > 0


def building_usage(conn: Connection, building_id: int) -> dict:
    """Counts that decide whether a delete is allowed, checked before the
    foreign keys would refuse it, so the client gets a useful message."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT (SELECT count(*) FROM floors WHERE building_id = %(id)s) AS floors,
                   (SELECT count(*) FROM incidents WHERE building_id = %(id)s) AS incidents,
                   (SELECT count(*) FROM users WHERE building_id = %(id)s) AS users
            """,
            {"id": building_id},
        )
        return cur.fetchone()


# ---------------------------------------------------------------------------
# Floors
# ---------------------------------------------------------------------------


def list_floors(conn: Connection, building_id: int) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT {FLOOR} FROM floors WHERE building_id = %(id)s ORDER BY level",
            {"id": building_id},
        )
        return cur.fetchall()


def get_floor(conn: Connection, floor_id: int) -> dict | None:
    with conn.cursor() as cur:
        cur.execute(f"SELECT {FLOOR} FROM floors WHERE id = %(id)s", {"id": floor_id})
        return cur.fetchone()


def create_floor(
    conn: Connection, *, building_id: int, level: int, label: str | None
) -> dict:
    with conn.cursor() as cur:
        cur.execute(
            f"""
            INSERT INTO floors (building_id, level, label)
            VALUES (%(building_id)s, %(level)s, %(label)s)
            RETURNING {FLOOR}
            """,
            {"building_id": building_id, "level": level, "label": label},
        )
        return cur.fetchone()


def update_floor(conn: Connection, floor_id: int, changes: dict) -> dict | None:
    return _update(conn, "floors", FLOOR, floor_id, changes)


def delete_floor(conn: Connection, floor_id: int) -> bool:
    with conn.cursor() as cur:
        cur.execute("DELETE FROM floors WHERE id = %(id)s", {"id": floor_id})
        return cur.rowcount > 0


def floor_usage(conn: Connection, floor_id: int) -> dict:
    """Seats, incidents and users (their workplace) on this floor, checked
    before a delete as for buildings."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT (SELECT count(*) FROM seats WHERE floor_id = %(id)s) AS seats,
                   (SELECT count(*) FROM incidents WHERE floor_id = %(id)s) AS incidents,
                   (SELECT count(*) FROM users WHERE floor_id = %(id)s) AS users
            """,
            {"id": floor_id},
        )
        return cur.fetchone()


# ---------------------------------------------------------------------------
# Seats
# ---------------------------------------------------------------------------


def list_seats(conn: Connection, floor_id: int) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT {SEAT} FROM seats WHERE floor_id = %(id)s ORDER BY code",
            {"id": floor_id},
        )
        return cur.fetchall()


def get_seat(conn: Connection, seat_id: int) -> dict | None:
    with conn.cursor() as cur:
        cur.execute(f"SELECT {SEAT} FROM seats WHERE id = %(id)s", {"id": seat_id})
        return cur.fetchone()


def create_seat(conn: Connection, *, floor_id: int, code: str, kind: str = "desk") -> dict:
    with conn.cursor() as cur:
        cur.execute(
            f"""
            INSERT INTO seats (floor_id, code, kind)
            VALUES (%(floor_id)s, %(code)s, %(kind)s)
            RETURNING {SEAT}
            """,
            {"floor_id": floor_id, "code": code, "kind": kind},
        )
        return cur.fetchone()


def update_seat(conn: Connection, seat_id: int, changes: dict) -> dict | None:
    return _update(conn, "seats", SEAT, seat_id, changes)


def delete_seat(conn: Connection, seat_id: int) -> bool:
    with conn.cursor() as cur:
        cur.execute("DELETE FROM seats WHERE id = %(id)s", {"id": seat_id})
        return cur.rowcount > 0


def seat_usage(conn: Connection, seat_id: int) -> dict:
    """Incidents at this desk or room, and users whose desk it is, checked
    before a delete as for buildings.

    Returned as a dict (not an int) to match the other *_usage functions.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT (SELECT count(*) FROM incidents WHERE seat_id = %(id)s) AS incidents,
                   (SELECT count(*) FROM users WHERE seat_id = %(id)s) AS users
            """,
            {"id": seat_id},
        )
        return cur.fetchone()


# ---------------------------------------------------------------------------
# Nested tree
# ---------------------------------------------------------------------------


def tree(conn: Connection) -> list[dict]:
    """Whole hierarchy in one query, for the cascading pickers.

    Aggregating in the database avoids returning one row per seat and
    regrouping them in Python.

    Returns one row per active building: id, name, code and `floors`, a JSON
    list of {id, level, label, seats} ordered by level, where `seats` is a
    list of {id, code, kind}, desks before rooms, each ordered by code. The inner subquery builds each
    floor's seat list first, then the outer query nests floors under their
    building. Both joins are LEFT and the aggregates are filtered and
    coalesced, so an empty building or floor yields `[]` rather than a list
    holding one null entry.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT b.id, b.name, b.code,
                   coalesce(
                       jsonb_agg(
                           jsonb_build_object(
                               'id', f.id, 'level', f.level, 'label', f.label,
                               'seats', f.seats
                           ) ORDER BY f.level
                       ) FILTER (WHERE f.id IS NOT NULL),
                       '[]'::jsonb
                   ) AS floors
            FROM buildings b
            LEFT JOIN (
                SELECT fl.id, fl.building_id, fl.level, fl.label,
                       coalesce(
                           jsonb_agg(
                               jsonb_build_object('id', s.id, 'code', s.code, 'kind', s.kind)
                               ORDER BY s.kind, s.code
                           ) FILTER (WHERE s.id IS NOT NULL),
                           '[]'::jsonb
                       ) AS seats
                FROM floors fl
                LEFT JOIN seats s ON s.floor_id = fl.id
                GROUP BY fl.id, fl.building_id, fl.level, fl.label
            ) f ON f.building_id = b.id
            WHERE b.is_active
            GROUP BY b.id, b.name, b.code
            ORDER BY b.name
            """
        )
        return cur.fetchall()
