"""Business rules for administrators changing people's accounts.

Service layer (routes -> services -> repositories). One call can rename an
account, change its role (employee, engineer, admin) and activate or
deactivate it. Promoting someone to engineer creates their engineer profile
in the same transaction; the rules below keep the system usable:

- nobody changes their own role or deactivates themselves (no self-lockout);
- at least one active administrator always remains;
- an engineer with active tickets keeps the role and stays active until the
  tickets are reassigned, as for deactivation on the engineers screen.

Demoting an engineer keeps their profile row, because incidents still point
at it; engineer lists only include accounts whose role is engineer.
"""

import logging

from psycopg import Connection

from app.core.db import transaction
from app.core.errors import ConflictError, ForbiddenError, NotFoundError, ValidationError
from app.repositories import categories as categories_repo
from app.repositories import engineers as engineers_repo
from app.repositories import users as repo
from app.schemas.auth import CurrentUser
from app.schemas.common import UserRole
from app.schemas.users import UserFilters, UserUpdate

logger = logging.getLogger(__name__)

# Defaults for a profile created by promotion, as for a new engineer account.
NEW_PROFILE = {"specialization_id": None, "phone": None, "max_active_tickets": 5, "is_available": True}


def list_users(conn: Connection, filters: UserFilters) -> list[dict]:
    return repo.list_for_admin(
        conn,
        q=filters.q,
        role=filters.role.value if filters.role else None,
        include_inactive=filters.include_inactive,
    )


def get_user(conn: Connection, user_id: int) -> dict:
    user = repo.get_by_id(conn, user_id)
    if user is None:
        raise NotFoundError("User not found.")
    return user


def update_user(conn: Connection, user_id: int, admin: CurrentUser, payload: UserUpdate) -> dict:
    """Apply an administrator's change to one account, atomically.

    Raises 404 for an unknown user or specialisation, 403 for changing your
    own role or deactivating yourself, 409 when the change would leave no
    active admin or strand an engineer's active tickets, and 400 for
    engineer settings on someone who is not (and is not becoming) an engineer.
    """
    # JSON mode turns the role enum into its plain value ("admin") for SQL.
    changes = payload.model_dump(exclude_unset=True, exclude={"engineer"}, mode="json")
    profile = payload.engineer.model_dump(exclude_unset=True) if payload.engineer else None
    if profile and profile.get("specialization_id") is not None:
        if categories_repo.get(conn, profile["specialization_id"]) is None:
            raise NotFoundError("That specialisation category does not exist.")

    with transaction(conn):
        user = repo.lock(conn, user_id)
        if user is None:
            raise NotFoundError("User not found.")
        current = UserRole(user["role"])
        new_role = UserRole(changes.get("role", current))
        deactivating = changes.get("is_active") is False and user["is_active"]
        role_changes = new_role != current

        if user_id == admin.id and (role_changes or deactivating):
            raise ForbiddenError("You can't change your own role or deactivate yourself.")

        # Keep at least one active administrator.
        if current == UserRole.ADMIN and user["is_active"] and (role_changes or deactivating):
            if repo.count_other_active_admins(conn, user_id) == 0:
                raise ConflictError("Keep at least one active admin: promote someone else first.")

        # An engineer's active tickets must be reassigned before they stop
        # being an engineer or are switched off.
        if current == UserRole.ENGINEER and (role_changes or deactivating):
            engineers_repo.lock(conn, user_id)
            active = engineers_repo.active_ticket_count(conn, user_id)
            if active:
                raise ConflictError(
                    f"{user['full_name']} still has {active} active ticket(s). "
                    "Reassign them first."
                )

        if profile is not None and new_role != UserRole.ENGINEER:
            raise ValidationError("Engineer settings apply only to engineers.")

        updated = repo.update_account(conn, user_id, changes)

        # Becoming an engineer: create the profile, or revive a kept one from
        # an earlier spell as engineer. Staying one: apply any profile changes.
        if new_role == UserRole.ENGINEER:
            if engineers_repo.lock(conn, user_id):
                if profile:
                    engineers_repo.update_profile(conn, user_id, profile)
            else:
                engineers_repo.create_profile(conn, user_id=user_id, **{**NEW_PROFILE, **(profile or {})})

    if role_changes:
        logger.info("role changed user=%s %s -> %s by %s", user_id, current.value, new_role.value, admin.id)
    return updated
