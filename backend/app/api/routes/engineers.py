"""Engineer profiles.

Administrators manage engineers. An engineer may change their own
availability, through a path that carries no id so it cannot name anyone else.
"""

from fastapi import APIRouter, status

from app.core.deps import AdminUser, CurrentUserDep, DbConnection, EngineerUser
from app.schemas.engineers import (
    EngineerAvailabilityUpdate,
    EngineerCreate,
    EngineerOut,
    EngineerUpdate,
)
from app.services import engineers as service

router = APIRouter(prefix="/engineers", tags=["engineers"])


@router.get("", response_model=list[EngineerOut])
def list_engineers(
    conn: DbConnection,
    _: CurrentUserDep,
    available: bool | None = None,
    category_id: int | None = None,
    include_inactive: bool = False,
):
    """Filterable by availability and specialisation, which is how the
    assignment picker narrows the list."""
    return service.list_engineers(
        conn,
        available=available,
        category_id=category_id,
        include_inactive=include_inactive,
    )


@router.post("", response_model=EngineerOut, status_code=status.HTTP_201_CREATED)
def create_engineer(payload: EngineerCreate, conn: DbConnection, _: AdminUser):
    """Creates the user account and the engineer profile together."""
    return service.create_engineer(conn, payload)


# Declared before /{user_id} so "me" is not read as an id.
@router.patch("/me/availability", response_model=EngineerOut)
def set_own_availability(
    payload: EngineerAvailabilityUpdate, conn: DbConnection, user: EngineerUser
):
    return service.set_own_availability(conn, user, payload.is_available)


@router.get("/{user_id}", response_model=EngineerOut)
def get_engineer(user_id: int, conn: DbConnection, _: CurrentUserDep):
    return service.get_engineer(conn, user_id)


@router.patch("/{user_id}", response_model=EngineerOut)
def update_engineer(
    user_id: int, payload: EngineerUpdate, conn: DbConnection, _: AdminUser
):
    return service.update_engineer(conn, user_id, payload)


@router.delete("/{user_id}", response_model=EngineerOut)
def deactivate_engineer(user_id: int, conn: DbConnection, _: AdminUser):
    """Deactivates rather than deletes, because incidents reference the
    engineer. Refused while they still hold active tickets."""
    return service.deactivate_engineer(conn, user_id)
