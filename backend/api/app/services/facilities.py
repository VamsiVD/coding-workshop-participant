"""Facility rules.

Deletion is refused while a record is still referenced, with a message that
says what is using it. The foreign keys would refuse it anyway; catching it
here turns a constraint error into an explanation.

Sits between the facility routes and the facilities repository. Each child
operation first loads its parent, so an unknown building or floor id is a
clear 404 rather than a foreign-key error.
"""

import logging

from psycopg import Connection

from app.core.errors import ConflictError, NotFoundError
from app.repositories import facilities as repo

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Buildings
# ---------------------------------------------------------------------------


def list_buildings(conn: Connection, include_inactive: bool = False) -> list[dict]:
    """Active buildings by default; inactive ones only when asked for."""
    return repo.list_buildings(conn, active_only=not include_inactive)


def get_building(conn: Connection, building_id: int) -> dict:
    """Fetch one building, or raise NotFoundError (404)."""
    building = repo.get_building(conn, building_id)
    if building is None:
        raise NotFoundError("Building not found.")
    return building


def create_building(conn: Connection, payload) -> dict:
    return repo.create_building(
        conn, name=payload.name, code=payload.code, address=payload.address
    )


def update_building(conn: Connection, building_id: int, payload) -> dict:
    """Partial update; only the fields the client sent are changed.
    Deactivation is done here, via `is_active`."""
    get_building(conn, building_id)
    return repo.update_building(
        conn, building_id, payload.model_dump(exclude_unset=True)
    )


def delete_building(conn: Connection, building_id: int) -> None:
    """Delete an unused building. Raises ConflictError (409) while it still
    has floors or incidents, pointing the caller at deactivation instead."""
    get_building(conn, building_id)
    usage = repo.building_usage(conn, building_id)
    if usage["floors"] or usage["incidents"] or usage["users"]:
        raise ConflictError(
            f"This building has {usage['floors']} floor(s), "
            f"{usage['incidents']} incident(s) and {usage['users']} person(s) "
            "working in it. Deactivate it instead of deleting it, so the history "
            "is kept."
        )
    repo.delete_building(conn, building_id)


# ---------------------------------------------------------------------------
# Floors
# ---------------------------------------------------------------------------


def list_floors(conn: Connection, building_id: int) -> list[dict]:
    get_building(conn, building_id)
    return repo.list_floors(conn, building_id)


def get_floor(conn: Connection, floor_id: int) -> dict:
    """Fetch one floor, or raise NotFoundError (404)."""
    floor = repo.get_floor(conn, floor_id)
    if floor is None:
        raise NotFoundError("Floor not found.")
    return floor


def create_floor(conn: Connection, building_id: int, payload) -> dict:
    get_building(conn, building_id)
    return repo.create_floor(
        conn, building_id=building_id, level=payload.level, label=payload.label
    )


def update_floor(conn: Connection, floor_id: int, payload) -> dict:
    get_floor(conn, floor_id)
    return repo.update_floor(conn, floor_id, payload.model_dump(exclude_unset=True))


def delete_floor(conn: Connection, floor_id: int) -> None:
    """Delete an unused floor. Raises ConflictError (409) while it still has
    seats or incidents; floors have no active flag, so the data stays."""
    get_floor(conn, floor_id)
    usage = repo.floor_usage(conn, floor_id)
    if usage["seats"] or usage["incidents"] or usage["users"]:
        raise ConflictError(
            f"This floor has {usage['seats']} desk(s) or room(s), "
            f"{usage['incidents']} incident(s) and {usage['users']} person(s) "
            "working on it, so it cannot be deleted."
        )
    repo.delete_floor(conn, floor_id)


# ---------------------------------------------------------------------------
# Seats
# ---------------------------------------------------------------------------


def list_seats(conn: Connection, floor_id: int) -> list[dict]:
    get_floor(conn, floor_id)
    return repo.list_seats(conn, floor_id)


def get_seat(conn: Connection, seat_id: int) -> dict:
    """Fetch one seat, or raise NotFoundError (404)."""
    seat = repo.get_seat(conn, seat_id)
    if seat is None:
        raise NotFoundError("Seat not found.")
    return seat


def _normalise_code(code: str, kind: str) -> str:
    """Desk codes are upper-cased, like building codes, so the unique
    constraint means what it says. Room names keep the case they were given."""
    return code.upper() if kind == "desk" else code


def create_seat(conn: Connection, floor_id: int, payload) -> dict:
    """Create a desk or room on a floor. 404 for an unknown floor; a duplicate
    code on the same floor is a 409 from the unique constraint."""
    get_floor(conn, floor_id)
    return repo.create_seat(
        conn,
        floor_id=floor_id,
        code=_normalise_code(payload.code, payload.kind),
        kind=payload.kind,
    )


def update_seat(conn: Connection, seat_id: int, payload) -> dict:
    """Rename a desk or room, or change its kind. 404 if it does not exist."""
    seat = get_seat(conn, seat_id)
    changes = payload.model_dump(exclude_unset=True)
    if changes.get("code"):
        # The kind being set wins over the current one when both apply.
        changes["code"] = _normalise_code(changes["code"], changes.get("kind") or seat["kind"])
    elif changes.get("kind") == "desk" and seat["kind"] != "desk":
        # A room turned into a desk takes the desk spelling of its code.
        changes["code"] = _normalise_code(seat["code"], "desk")
    return repo.update_seat(conn, seat_id, changes)


def delete_seat(conn: Connection, seat_id: int) -> None:
    """Delete a seat. Raises ConflictError (409) while incidents name it."""
    get_seat(conn, seat_id)
    usage = repo.seat_usage(conn, seat_id)
    if usage["incidents"] or usage["users"]:
        raise ConflictError(
            f"This desk or room has {usage['incidents']} incident(s) against it "
            f"and is the desk of {usage['users']} person(s), so it cannot be deleted."
        )
    repo.delete_seat(conn, seat_id)


# ---------------------------------------------------------------------------
# Tree
# ---------------------------------------------------------------------------


def tree(conn: Connection) -> dict:
    """Active buildings with their floors and seats nested, in the shape of
    `FacilityTree`, for the cascading pickers on the report form."""
    return {"buildings": repo.tree(conn)}
