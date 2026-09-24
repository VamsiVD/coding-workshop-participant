"""Buildings, floors and seats.

Reads are open to any signed-in user, because everyone needs the pickers when
reporting an incident. Writes are administrator-only.

HTTP layer only: the rules, including when a delete is refused, live in
`app.services.facilities`.
"""

from fastapi import APIRouter, status

from app.core.deps import AdminUser, CurrentUserDep, DbConnection
from app.schemas.common import DeletedResponse
from app.schemas.facilities import (
    BuildingCreate,
    BuildingOut,
    BuildingUpdate,
    FacilityTree,
    FloorCreate,
    FloorOut,
    FloorUpdate,
    SeatCreate,
    SeatOut,
    SeatUpdate,
)
from app.services import facilities as service

router = APIRouter(tags=["facilities"])


# ---------------------------------------------------------------------------
# Tree
# ---------------------------------------------------------------------------


@router.get("/facilities/locations", response_model=FacilityTree)
def public_locations(conn: DbConnection) -> FacilityTree:
    """The same tree as `/facilities/tree`, without signing in.

    Public, because the registration form asks new employees where they work
    before they have an account. It carries only active buildings and the
    names of their floors, desks and rooms.
    """
    return service.tree(conn)


@router.get("/facilities/tree", response_model=FacilityTree)
def facility_tree(conn: DbConnection, _: CurrentUserDep) -> FacilityTree:
    """Buildings, floors and seats in one call, for cascading dropdowns.

    Any signed-in user. Only active buildings are included.
    """
    return service.tree(conn)


# ---------------------------------------------------------------------------
# Buildings
# ---------------------------------------------------------------------------


@router.get("/buildings", response_model=list[BuildingOut])
def list_buildings(
    conn: DbConnection, _: CurrentUserDep, include_inactive: bool = False
):
    """Any signed-in user. Deactivated buildings are hidden unless
    `include_inactive=true`."""
    return service.list_buildings(conn, include_inactive)


@router.post(
    "/buildings", response_model=BuildingOut, status_code=status.HTTP_201_CREATED
)
def create_building(payload: BuildingCreate, conn: DbConnection, _: AdminUser):
    """Administrators only. 409 if the name or code is already in use."""
    return service.create_building(conn, payload)


@router.get("/buildings/{building_id}", response_model=BuildingOut)
def get_building(building_id: int, conn: DbConnection, _: CurrentUserDep):
    return service.get_building(conn, building_id)


@router.patch("/buildings/{building_id}", response_model=BuildingOut)
def update_building(
    building_id: int, payload: BuildingUpdate, conn: DbConnection, _: AdminUser
):
    """Administrators only. Only the fields sent are changed; setting
    `is_active` to false retires a building that still has history."""
    return service.update_building(conn, building_id, payload)


@router.delete("/buildings/{building_id}", response_model=DeletedResponse)
def delete_building(building_id: int, conn: DbConnection, _: AdminUser):
    """Administrators only. 409 while the building has floors or incidents;
    deactivate it instead."""
    service.delete_building(conn, building_id)
    return DeletedResponse(id=building_id)


# ---------------------------------------------------------------------------
# Floors
# ---------------------------------------------------------------------------


@router.get("/buildings/{building_id}/floors", response_model=list[FloorOut])
def list_floors(building_id: int, conn: DbConnection, _: CurrentUserDep):
    """Any signed-in user. 404 if the building does not exist."""
    return service.list_floors(conn, building_id)


@router.post(
    "/buildings/{building_id}/floors",
    response_model=FloorOut,
    status_code=status.HTTP_201_CREATED,
)
def create_floor(
    building_id: int, payload: FloorCreate, conn: DbConnection, _: AdminUser
):
    """Administrators only. 404 if the building does not exist, 409 if it
    already has a floor at that level."""
    return service.create_floor(conn, building_id, payload)


@router.get("/floors/{floor_id}", response_model=FloorOut)
def get_floor(floor_id: int, conn: DbConnection, _: CurrentUserDep):
    return service.get_floor(conn, floor_id)


@router.patch("/floors/{floor_id}", response_model=FloorOut)
def update_floor(floor_id: int, payload: FloorUpdate, conn: DbConnection, _: AdminUser):
    return service.update_floor(conn, floor_id, payload)


@router.delete("/floors/{floor_id}", response_model=DeletedResponse)
def delete_floor(floor_id: int, conn: DbConnection, _: AdminUser):
    """Administrators only. 409 while the floor has seats or incidents."""
    service.delete_floor(conn, floor_id)
    return DeletedResponse(id=floor_id)


# ---------------------------------------------------------------------------
# Seats
# ---------------------------------------------------------------------------


@router.get("/floors/{floor_id}/seats", response_model=list[SeatOut])
def list_seats(floor_id: int, conn: DbConnection, _: CurrentUserDep):
    """Any signed-in user. 404 if the floor does not exist."""
    return service.list_seats(conn, floor_id)


@router.post(
    "/floors/{floor_id}/seats",
    response_model=SeatOut,
    status_code=status.HTTP_201_CREATED,
)
def create_seat(floor_id: int, payload: SeatCreate, conn: DbConnection, _: AdminUser):
    """Administrators only. 404 if the floor does not exist, 409 if the code
    is already used on that floor."""
    return service.create_seat(conn, floor_id, payload)


@router.patch("/seats/{seat_id}", response_model=SeatOut)
def update_seat(seat_id: int, payload: SeatUpdate, conn: DbConnection, _: AdminUser):
    return service.update_seat(conn, seat_id, payload)


@router.delete("/seats/{seat_id}", response_model=DeletedResponse)
def delete_seat(seat_id: int, conn: DbConnection, _: AdminUser):
    """Administrators only. 409 while any incident was reported at the seat."""
    service.delete_seat(conn, seat_id)
    return DeletedResponse(id=seat_id)
