"""Incidents and their workflow transitions.

Each transition is its own endpoint rather than a general PATCH on `status`.
They have different permissions, different required fields and different audit
entries, so one endpoint would be a switch statement wearing a REST costume.
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
    return service.create_incident(conn, user, payload)


# Declared before /{incident_id} so "similar" is not read as an id.
@router.get("/similar", response_model=list[IncidentSummary])
def similar_incidents(
    conn: DbConnection,
    _: CurrentUserDep,
    query: Annotated[SimilarIncidentQuery, Query()],
):
    """Open incidents already reported for the same place and kind, shown
    before a reporter submits so duplicates are less likely."""
    return service.find_similar(conn, query)


@router.get("/{incident_id}", response_model=IncidentDetail)
def get_incident(incident_id: int, conn: DbConnection, user: CurrentUserDep):
    return service.get_incident(conn, incident_id, user)


@router.patch("/{incident_id}", response_model=IncidentDetail)
def update_incident(
    incident_id: int, payload: IncidentUpdate, conn: DbConnection, user: CurrentUserDep
):
    """The reporter may correct details while the incident is still open; an
    administrator at any time."""
    return service.update_incident(conn, incident_id, user, payload)


@router.delete("/{incident_id}", response_model=DeletedResponse)
def delete_incident(incident_id: int, conn: DbConnection, user: AdminUser):
    service.delete_incident(conn, incident_id, user)
    return DeletedResponse(id=incident_id)


# ---------------------------------------------------------------------------
# Workflow transitions
# ---------------------------------------------------------------------------


@router.post("/{incident_id}/assign", response_model=IncidentDetail)
def assign_incident(
    incident_id: int, payload: IncidentAssign, conn: DbConnection, user: AdminUser
):
    return service.assign(conn, incident_id, user, payload)


@router.post("/{incident_id}/status", response_model=IncidentDetail)
def change_status(
    incident_id: int,
    payload: IncidentStatusChange,
    conn: DbConnection,
    user: CurrentUserDep,
):
    """Permitted moves come from the transition table; who may make them
    depends on the caller's role and their relationship to the incident."""
    return service.change_status(conn, incident_id, user, payload)


@router.post("/{incident_id}/priority", response_model=IncidentDetail)
def change_priority(
    incident_id: int,
    payload: IncidentPriorityChange,
    conn: DbConnection,
    user: AdminUser,
):
    return service.change_priority(conn, incident_id, user, payload)


@router.post("/{incident_id}/escalation", response_model=IncidentDetail)
def request_escalation(
    incident_id: int,
    payload: EscalationRequest,
    conn: DbConnection,
    user: CurrentUserDep,
):
    """The reporter asks for escalation, giving a reason."""
    return service.request_escalation(conn, incident_id, user, payload)


@router.post("/{incident_id}/escalation/decision", response_model=IncidentDetail)
def decide_escalation(
    incident_id: int,
    payload: EscalationDecision,
    conn: DbConnection,
    user: AdminUser,
):
    return service.decide_escalation(conn, incident_id, user, payload)


@router.get("/{incident_id}/timeline", response_model=IncidentTimeline)
def incident_timeline(incident_id: int, conn: DbConnection, user: CurrentUserDep):
    """Every recorded change, oldest first."""
    return {
        "incident_id": incident_id,
        "events": service.timeline(conn, incident_id, user),
    }
