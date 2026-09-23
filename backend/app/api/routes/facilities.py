"""Buildings, floors and seats.

Reads are open to any signed-in user, because everyone needs the pickers when
reporting an incident. Writes are administrator-only.
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


@router.get("/facilities/tree", response_model=FacilityTree)
def facility_tree(conn: DbConnection, _: CurrentUserDep) -> FacilityTree:
    """Buildings, floors and seats in one call, for cascading dropdowns."""
    return service.tree(conn)


# ---------------------------------------------------------------------------
# Buildings
# ---------------------------------------------------------------------------


@router.get("/buildings", response_model=list[BuildingOut])
def list_buildings(
    conn: DbConnection, _: CurrentUserDep, include_inactive: bool = False
):
    return service.list_buildings(conn, include_inactive)


@router.post(
    "/buildings", response_model=BuildingOut, status_code=status.HTTP_201_CREATED
)
def create_building(payload: BuildingCreate, conn: DbConnection, _: AdminUser):
    return service.create_building(conn, payload)


@router.get("/buildings/{building_id}", response_model=BuildingOut)
def get_building(building_id: int, conn: DbConnection, _: CurrentUserDep):
    return service.get_building(conn, building_id)


@router.patch("/buildings/{building_id}", response_model=BuildingOut)
def update_building(
    building_id: int, payload: BuildingUpdate, conn: DbConnection, _: AdminUser
):
    return service.update_building(conn, building_id, payload)


@router.delete("/buildings/{building_id}", response_model=DeletedResponse)
def delete_building(building_id: int, conn: DbConnection, _: AdminUser):
    service.delete_building(conn, building_id)
    return DeletedResponse(id=building_id)


# ---------------------------------------------------------------------------
# Floors
# ---------------------------------------------------------------------------


@router.get("/buildings/{building_id}/floors", response_model=list[FloorOut])
def list_floors(building_id: int, conn: DbConnection, _: CurrentUserDep):
    return service.list_floors(conn, building_id)


@router.post(
    "/buildings/{building_id}/floors",
    response_model=FloorOut,
    status_code=status.HTTP_201_CREATED,
)
def create_floor(
    building_id: int, payload: FloorCreate, conn: DbConnection, _: AdminUser
):
    return service.create_floor(conn, building_id, payload)


@router.get("/floors/{floor_id}", response_model=FloorOut)
def get_floor(floor_id: int, conn: DbConnection, _: CurrentUserDep):
    return service.get_floor(conn, floor_id)


@router.patch("/floors/{floor_id}", response_model=FloorOut)
def update_floor(floor_id: int, payload: FloorUpdate, conn: DbConnection, _: AdminUser):
    return service.update_floor(conn, floor_id, payload)


@router.delete("/floors/{floor_id}", response_model=DeletedResponse)
def delete_floor(floor_id: int, conn: DbConnection, _: AdminUser):
    service.delete_floor(conn, floor_id)
    return DeletedResponse(id=floor_id)


# ---------------------------------------------------------------------------
# Seats
# ---------------------------------------------------------------------------


@router.get("/floors/{floor_id}/seats", response_model=list[SeatOut])
def list_seats(floor_id: int, conn: DbConnection, _: CurrentUserDep):
    return service.list_seats(conn, floor_id)


@router.post(
    "/floors/{floor_id}/seats",
    response_model=SeatOut,
    status_code=status.HTTP_201_CREATED,
)
def create_seat(floor_id: int, payload: SeatCreate, conn: DbConnection, _: AdminUser):
    return service.create_seat(conn, floor_id, payload)


@router.patch("/seats/{seat_id}", response_model=SeatOut)
def update_seat(seat_id: int, payload: SeatUpdate, conn: DbConnection, _: AdminUser):
    return service.update_seat(conn, seat_id, payload)


@router.delete("/seats/{seat_id}", response_model=DeletedResponse)
def delete_seat(seat_id: int, conn: DbConnection, _: AdminUser):
    service.delete_seat(conn, seat_id)
    return DeletedResponse(id=seat_id)
