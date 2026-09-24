"""People: administrators list accounts and change their name, role and
active status (including promoting an employee to engineer).

HTTP layer only: the rules live in `app.services.users`.
"""

from typing import Annotated

from fastapi import APIRouter, Query

from app.core.deps import AdminUser, DbConnection
from app.schemas.users import UserAdminOut, UserFilters, UserUpdate
from app.services import users as service

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserAdminOut])
def list_users(conn: DbConnection, _: AdminUser, filters: Annotated[UserFilters, Query()]):
    """Every account, by name; filter by role, search name or email.
    Administrators only."""
    return service.list_users(conn, filters)


@router.get("/{user_id}", response_model=UserAdminOut)
def get_user(user_id: int, conn: DbConnection, _: AdminUser):
    """One account. Administrators only. 404 if it does not exist."""
    return service.get_user(conn, user_id)


@router.patch("/{user_id}", response_model=UserAdminOut)
def update_user(user_id: int, payload: UserUpdate, conn: DbConnection, admin: AdminUser):
    """Rename, change role or (de)activate an account. Administrators only.

    Setting role `engineer` promotes the person: their engineer profile is
    created (or revived) with the optional `engineer` settings. 403 for your
    own role or deactivating yourself; 409 if no active admin would remain or
    an engineer still has active tickets.
    """
    return service.update_user(conn, user_id, admin, payload)
