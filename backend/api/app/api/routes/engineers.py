"""Engineer profiles.

Administrators manage engineers. An engineer may change their own
availability, through a path that carries no id so it cannot name anyone else.

HTTP layer only: the rules live in `app.services.engineers`.
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
    # Any signed-in user may list engineers; only the write routes are gated.
    return service.list_engineers(
        conn,
        available=available,
        category_id=category_id,
        include_inactive=include_inactive,
    )


@router.post("", response_model=EngineerOut, status_code=status.HTTP_201_CREATED)
def create_engineer(payload: EngineerCreate, conn: DbConnection, _: AdminUser):
    """Creates the user account and the engineer profile together.

    Administrators only. 409 if the email address is already registered, 404
    if `specialization_id` names no category.
    """
    return service.create_engineer(conn, payload)


# Declared before /{user_id} so "me" is not read as an id.
@router.patch("/me/availability", response_model=EngineerOut)
def set_own_availability(
    payload: EngineerAvailabilityUpdate, conn: DbConnection, user: EngineerUser
):
    """The calling engineer marks themselves available or unavailable.

    Engineers only; administrators change anyone's availability through
    `PATCH /engineers/{user_id}`. 403 if the caller has no engineer profile.
    """
    return service.set_own_availability(conn, user, payload.is_available)


@router.get("/me", response_model=EngineerOut)
def get_own_profile(conn: DbConnection, user: EngineerUser):
    """The calling engineer's own profile, for the engineer workbench.

    Engineers only. Declared before `/{user_id}` so "me" is not read as an id.
    404 if the caller has no engineer profile.
    """
    return service.get_engineer(conn, user.id)


@router.get("/{user_id}", response_model=EngineerOut)
def get_engineer(user_id: int, conn: DbConnection, _: CurrentUserDep):
    return service.get_engineer(conn, user_id)


@router.patch("/{user_id}", response_model=EngineerOut)
def update_engineer(
    user_id: int, payload: EngineerUpdate, conn: DbConnection, _: AdminUser
):
    """Edit an engineer's name or profile. Administrators only.

    Only the fields sent are changed. 404 if the engineer or the
    specialisation category does not exist.
    """
    return service.update_engineer(conn, user_id, payload)


@router.delete("/{user_id}", response_model=EngineerOut)
def deactivate_engineer(user_id: int, conn: DbConnection, _: AdminUser):
    """Deactivates rather than deletes, because incidents reference the
    engineer. Refused while they still hold active tickets.

    Administrators only. 409 while tickets remain assigned; reassign them
    first. Returns the profile, now inactive.
    """
    return service.deactivate_engineer(conn, user_id)
