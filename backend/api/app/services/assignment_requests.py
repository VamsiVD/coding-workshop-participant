"""Business rules for the open-job pool and engineers' assignment requests.

Service layer (routes -> services -> repositories). Engineers browse open,
unassigned incidents and ask for one; an administrator confirms by assigning
the incident (which clears its requests, see `services.incidents.assign`) or
declines the request.
"""

from psycopg import Connection

from app.core.errors import ForbiddenError, NotFoundError, ValidationError
from app.repositories import assignment_requests as repo
from app.repositories import engineers as engineers_repo
from app.repositories import incidents as incidents_repo
from app.schemas.assignment_requests import AssignmentRequestCreate, PoolFilters
from app.schemas.auth import CurrentUser
from app.schemas.common import IncidentStatus, UserRole

# The pool is a working list, not a search; this bounds one response.
POOL_LIMIT = 200


def list_pool(conn: Connection, user: CurrentUser, filters: PoolFilters) -> list[dict]:
    """Open, unassigned incidents, newest first, for engineers and admins.

    This deliberately looks past the usual role scope (an engineer normally
    sees only their own assignments), but only at incidents nobody holds yet:
    the status and unassigned conditions are fixed here, not taken from the
    request.
    """
    rows, _ = incidents_repo.search(
        conn,
        {
            "status": IncidentStatus.OPEN,
            "unassigned": True,
            "category_id": filters.category_id,
            "building_id": filters.building_id,
        },
        scope_clause=None,
        scope_params={},
        limit=POOL_LIMIT,
        offset=0,
    )
    requested = (
        repo.incident_ids_requested_by(conn, user.id)
        if user.role == UserRole.ENGINEER
        else set()
    )
    return [{**row, "requested_by_me": row["id"] in requested} for row in rows]


def request_job(
    conn: Connection, incident_id: int, user: CurrentUser, payload: AssignmentRequestCreate
) -> dict:
    """The calling engineer asks to be assigned this incident.

    Only open, unassigned incidents can be requested. Asking again replaces
    the note. Raises NotFoundError (404) for an unknown incident,
    ValidationError (400) once it is assigned or no longer open, and
    ForbiddenError (403) for a deactivated or profile-less engineer.
    """
    engineer = engineers_repo.get(conn, user.id)
    if engineer is None or not engineer["is_active"]:
        raise ForbiddenError("Only an active engineer can request a job.")

    incident = incidents_repo.get_raw(conn, incident_id)
    if incident is None:
        raise NotFoundError("Incident not found.")
    if incident["assignee_id"] is not None:
        raise ValidationError("This incident has already been assigned.")
    if incident["status"] != IncidentStatus.OPEN:
        raise ValidationError("Only open incidents can be requested.")

    note = (payload.note or "").strip() or None
    return repo.upsert(conn, incident_id=incident_id, engineer_id=user.id, note=note)


def withdraw(conn: Connection, incident_id: int, user: CurrentUser) -> None:
    """The calling engineer withdraws their request. 404 if they had none."""
    if not repo.delete_own(conn, incident_id=incident_id, engineer_id=user.id):
        raise NotFoundError("You have no request on this incident.")


def list_pending(conn: Connection) -> list[dict]:
    """Every pending request, for the admin console."""
    return repo.list_pending(conn)


def decline(conn: Connection, request_id: int) -> None:
    """An administrator turns a request down. 404 if it no longer exists."""
    if not repo.delete(conn, request_id):
        raise NotFoundError("Request not found.")
