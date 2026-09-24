"""Open-job pool and engineers' assignment requests.

HTTP layer only: the rules live in `app.services.assignment_requests`. This
router is registered before the incidents router, so `/incidents/pool` is
matched before `/incidents/{incident_id}` could claim it.
"""

from typing import Annotated

from fastapi import APIRouter, Query, status

from app.core.deps import AdminUser, DbConnection, EngineerUser, StaffUser
from app.schemas.assignment_requests import (
    AssignmentRequestCreate,
    AssignmentRequestOut,
    PoolFilters,
    PoolIncident,
)
from app.services import assignment_requests as service

router = APIRouter(tags=["assignment requests"])


@router.get("/incidents/pool", response_model=list[PoolIncident])
def open_job_pool(
    conn: DbConnection, user: StaffUser, filters: Annotated[PoolFilters, Query()]
):
    """Open incidents nobody is assigned to, newest first (at most 200).

    Engineers and administrators only. For an engineer, `requested_by_me`
    marks the jobs they have already asked for.
    """
    return service.list_pool(conn, user, filters)


@router.post(
    "/incidents/{incident_id}/assignment-requests",
    response_model=AssignmentRequestOut,
    status_code=status.HTTP_201_CREATED,
)
def request_job(
    incident_id: int,
    payload: AssignmentRequestCreate,
    conn: DbConnection,
    user: EngineerUser,
):
    """Ask to be assigned this incident; an administrator confirms.

    Engineers only. Asking again replaces the note. 400 if the incident is
    already assigned or no longer open, 404 if it does not exist.
    """
    return service.request_job(conn, incident_id, user, payload)


@router.delete(
    "/incidents/{incident_id}/assignment-requests/me",
    status_code=status.HTTP_204_NO_CONTENT,
)
def withdraw_request(incident_id: int, conn: DbConnection, user: EngineerUser):
    """Withdraw your own request. Engineers only. 404 if you had none."""
    service.withdraw(conn, incident_id, user)


@router.get("/assignment-requests", response_model=list[AssignmentRequestOut])
def pending_requests(conn: DbConnection, _: AdminUser):
    """Every pending request, oldest first. Administrators only.

    Confirm one with `POST /incidents/{id}/assign`, which also clears the
    incident's other requests; turn one down with the DELETE below.
    """
    return service.list_pending(conn)


@router.delete(
    "/assignment-requests/{request_id}", status_code=status.HTTP_204_NO_CONTENT
)
def decline_request(request_id: int, conn: DbConnection, _: AdminUser):
    """Decline a request. Administrators only. 404 if it no longer exists."""
    service.decline(conn, request_id)
