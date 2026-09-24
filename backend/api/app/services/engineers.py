"""Engineer profile rules.

Sits between the engineer routes and the engineers, users and categories
repositories. Administrators manage engineers; an engineer may only change
their own availability.
"""

import logging

from psycopg import Connection

from app.core.db import transaction
from app.core.errors import ConflictError, ForbiddenError, NotFoundError
from app.core.security import hash_password
from app.repositories import categories as categories_repo
from app.repositories import engineers as repo
from app.repositories import users as users_repo
from app.schemas.auth import CurrentUser

logger = logging.getLogger(__name__)


def list_engineers(
    conn: Connection,
    *,
    available: bool | None = None,
    category_id: int | None = None,
    include_inactive: bool = False,
) -> list[dict]:
    """Engineers, optionally narrowed by availability and specialisation.
    Deactivated accounts are left out unless asked for."""
    return repo.list_all(
        conn,
        available=available,
        category_id=category_id,
        active_only=not include_inactive,
    )


def get_engineer(conn: Connection, user_id: int) -> dict:
    """Fetch one engineer by user id, or raise NotFoundError (404)."""
    engineer = repo.get(conn, user_id)
    if engineer is None:
        raise NotFoundError("Engineer not found.")
    return engineer


def create_engineer(conn: Connection, payload) -> dict:
    """Creates the user account and the profile together.

    Both happen in one explicit transaction, so a failure part-way cannot
    leave a user with the engineer role and no profile — which would make them
    un-assignable, since assignment points at the profile table.

    Raises ConflictError (409) for an email already in use and NotFoundError
    (404) for an unknown specialisation.
    """
    # Both checks run before the transaction opens, so a bad request is
    # refused without writing anything.
    if users_repo.exists_by_email(conn, payload.email):
        raise ConflictError("An account with this email address already exists.")

    if (
        payload.specialization_id is not None
        and categories_repo.get(conn, payload.specialization_id) is None
    ):
        raise NotFoundError("That specialisation category does not exist.")

    with transaction(conn):
        user = users_repo.create(
            conn,
            email=payload.email,
            password_hash=hash_password(payload.password),
            full_name=payload.full_name,
            role="engineer",
        )
        engineer = repo.create_profile(
            conn,
            user_id=user["id"],
            specialization_id=payload.specialization_id,
            phone=payload.phone,
            max_active_tickets=payload.max_active_tickets,
            is_available=payload.is_available,
        )
    logger.info("engineer created user_id=%s", user["id"])
    return engineer


def update_engineer(conn: Connection, user_id: int, payload) -> dict:
    """Administrator edit of an engineer's profile and display name.

    Raises NotFoundError (404) for an unknown engineer or specialisation.
    """
    get_engineer(conn, user_id)
    changes = payload.model_dump(exclude_unset=True)

    if (
        changes.get("specialization_id") is not None
        and categories_repo.get(conn, changes["specialization_id"]) is None
    ):
        raise NotFoundError("That specialisation category does not exist.")

    # full_name lives on the user row, not the profile. Both writes commit
    # together, so a failed profile update does not leave the new name behind.
    full_name = changes.pop("full_name", None)
    with transaction(conn):
        if full_name is not None:
            users_repo.update_name(conn, user_id, full_name)
        return repo.update_profile(conn, user_id, changes)


def set_own_availability(
    conn: Connection, user: CurrentUser, is_available: bool
) -> dict:
    """An engineer marks themselves available or not.

    Scoped to the caller's own profile: the path carries no id, so one
    engineer cannot change another's availability.
    """
    # The route already requires the engineer role; this catches an engineer
    # account that somehow has no profile row, which there is nothing to update.
    if repo.get(conn, user.id) is None:
        raise ForbiddenError("You do not have an engineer profile.")
    return repo.update_profile(conn, user.id, {"is_available": is_available})


def deactivate_engineer(conn: Connection, user_id: int) -> dict:
    """Engineers are deactivated, not deleted: incidents reference them.

    Open assignments are reported so an administrator knows what needs
    reassigning.
    """
    get_engineer(conn, user_id)
    with transaction(conn):
        # The profile lock makes a concurrent assignment wait (assign takes the
        # same lock), so the count below cannot go stale before the update.
        repo.lock(conn, user_id)
        # Refused (409) rather than silently orphaning tickets: open,
        # in-progress and blocked work must be reassigned first.
        active = repo.active_ticket_count(conn, user_id)
        if active:
            raise ConflictError(
                f"This engineer still has {active} active ticket(s). "
                "Reassign them first."
            )
        # Deactivation is on the user row, so it also stops the engineer
        # signing in; the profile row is kept for history.
        users_repo.set_active(conn, user_id, False)
    return get_engineer(conn, user_id)


def workload(conn: Connection) -> list[dict]:
    """Every engineer with their current ticket counts by status.

    No route calls this at present; the workload report reads the same
    repository function through `app.services.reports.engineer_workload`.
    """
    return repo.workload(conn)
