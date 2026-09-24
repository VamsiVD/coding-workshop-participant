"""Incidents and their workflow transitions.

Each transition is its own endpoint rather than a general PATCH on `status`.
They have different permissions, different required fields and different audit
entries, so one endpoint would be a switch statement wearing a REST costume.

HTTP layer only: permissions and the workflow live in `app.services.incidents`.
An incident the caller may not see answers 404, not 403, so the API never
confirms that an id exists to someone without access to it.
"""

from typing import Annotated

from fastapi import APIRouter, Query, status

from app.core.deps import AdminUser, CurrentUserDep, DbConnection
from app.schemas.common import DeletedResponse, Page, as_page
from app.schemas.incidents import (
    EscalationDecision,
    EscalationRequest,
    IncidentAssign,
    IncidentCreate,
    IncidentDetail,
    IncidentFilters,
    IncidentPriorityChange,
    IncidentStatusChange,
    IncidentSummary,
    IncidentTimeline,
    IncidentUpdate,
    SimilarIncidentQuery,
)
from app.services import incidents as service

router = APIRouter(prefix="/incidents", tags=["incidents"])


@router.get("", response_model=Page[IncidentSummary])
def list_incidents(
    conn: DbConnection,
    user: CurrentUserDep,
    filters: Annotated[IncidentFilters, Query()],
):
    """Scoped by role: an employee sees their own reports, an engineer their
    assignments, an administrator everything. Filters narrow that set; they
    never widen it."""
    rows, total = service.list_incidents(conn, user, filters)
    return as_page(rows, total, filters)


@router.post("", response_model=IncidentDetail, status_code=status.HTTP_201_CREATED)
def create_incident(payload: IncidentCreate, conn: DbConnection, user: CurrentUserDep):
    """Report a new incident. Any signed-in user.

    The caller becomes the reporter. A new incident is always open, unassigned
    and at the default priority, whatever the request says. 400 if the
    category or location does not exist.
    """
    return service.create_incident(conn, user, payload)


# Declared before /{incident_id} so "similar" is not read as an id.
@router.get("/similar", response_model=list[IncidentSummary])
def similar_incidents(
    conn: DbConnection,
    _: CurrentUserDep,
    query: Annotated[SimilarIncidentQuery, Query()],
):
    """Open incidents already reported for the same place and kind, shown
    before a reporter submits so duplicates are less likely.

    Any signed-in user. At least one of building, floor or seat is required.
    """
    # Not role-scoped, unlike the list: the point is to show a reporter what
    # other people have already raised at the same place.
    return service.find_similar(conn, query)


@router.get("/{incident_id}", response_model=IncidentDetail)
def get_incident(incident_id: int, conn: DbConnection, user: CurrentUserDep):
    """One incident in full. 404 if it does not exist or the caller's role
    does not let them see it."""
    return service.get_incident(conn, incident_id, user)


@router.patch("/{incident_id}", response_model=IncidentDetail)
def update_incident(
    incident_id: int, payload: IncidentUpdate, conn: DbConnection, user: CurrentUserDep
):
    """The reporter may correct details while the incident is still open; an
    administrator at any time.

    Engineers may not edit; they add notes. 403 for anyone else, or for the
    reporter once work has started. A location change must send building_id,
    floor_id and seat_id together, or it is refused with 400.
    """
    return service.update_incident(conn, incident_id, user, payload)


@router.delete("/{incident_id}", response_model=DeletedResponse)
def delete_incident(incident_id: int, conn: DbConnection, user: AdminUser):
    """Permanently delete an incident with its notes and timeline.
    Administrators only."""
    service.delete_incident(conn, incident_id, user)
    return DeletedResponse(id=incident_id)


# ---------------------------------------------------------------------------
# Workflow transitions
# ---------------------------------------------------------------------------


@router.post("/{incident_id}/assign", response_model=IncidentDetail)
def assign_incident(
    incident_id: int, payload: IncidentAssign, conn: DbConnection, user: AdminUser
):
    """Assign or reassign the incident to an engineer. Administrators only.

    400 if the incident is closed or the engineer is missing or deactivated.
    An engineer over their ticket limit is still assigned; the limit is a
    guide, not a block.
    """
    return service.assign(conn, incident_id, user, payload)


@router.post("/{incident_id}/status", response_model=IncidentDetail)
def change_status(
    incident_id: int,
    payload: IncidentStatusChange,
    conn: DbConnection,
    user: CurrentUserDep,
):
    """Permitted moves come from the transition table; who may make them
    depends on the caller's role and their relationship to the incident.

    An administrator may make any permitted move. The assigned engineer may
    make any but closing. The reporter may close an open or resolved incident,
    or reopen a resolved one. Moving to `blocked` needs a `reason`; starting
    work needs an assignee. 400 for a move the workflow forbids, 403 for one
    the caller may not make.
    """
    return service.change_status(conn, incident_id, user, payload)


@router.post("/{incident_id}/priority", response_model=IncidentDetail)
def change_priority(
    incident_id: int,
    payload: IncidentPriorityChange,
    conn: DbConnection,
    user: AdminUser,
):
    """Set the priority. Administrators only; a reporter who thinks their
    incident is urgent requests an escalation instead. 400 if the priority is
    unchanged."""
    return service.change_priority(conn, incident_id, user, payload)


@router.post("/{incident_id}/escalation", response_model=IncidentDetail)
def request_escalation(
    incident_id: int,
    payload: EscalationRequest,
    conn: DbConnection,
    user: CurrentUserDep,
):
    """The reporter asks for escalation, giving a reason.

    The assigned engineer or an administrator may also ask. 400 if the
    incident is resolved or closed, or a request is already awaiting a
    decision.
    """
    return service.request_escalation(conn, incident_id, user, payload)


@router.post("/{incident_id}/escalation/decision", response_model=IncidentDetail)
def decide_escalation(
    incident_id: int,
    payload: EscalationDecision,
    conn: DbConnection,
    user: AdminUser,
):
    """Approve or reject a pending escalation. Administrators only.

    400 if no escalation is awaiting a decision. Approval does not change the
    priority by itself; that is a separate call.
    """
    return service.decide_escalation(conn, incident_id, user, payload)


@router.get("/{incident_id}/timeline", response_model=IncidentTimeline)
def incident_timeline(incident_id: int, conn: DbConnection, user: CurrentUserDep):
    """Every recorded change, oldest first.

    Visible to whoever can see the incident; 404 otherwise.
    """
    return {
        "incident_id": incident_id,
        "events": service.timeline(conn, incident_id, user),
    }
