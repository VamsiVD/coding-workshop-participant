"""Incident workflow and permissions.

This module owns the rules that the database cannot express: who may do what,
and which status changes the workflow permits. Every transition writes its
audit event in the same transaction as the change.
"""

import logging

from psycopg import Connection

from app.core.db import transaction
from app.core.errors import ForbiddenError, NotFoundError, ValidationError
from app.repositories import engineers as engineers_repo
from app.repositories import events as events_repo
from app.repositories import incidents as incidents_repo
from app.schemas.auth import CurrentUser
from app.schemas.common import IncidentStatus, UserRole
from app.schemas.incidents import (
    ALLOWED_TRANSITIONS,
    EscalationDecision,
    EscalationRequest,
    IncidentAssign,
    IncidentCreate,
    IncidentFilters,
    IncidentPriorityChange,
    IncidentStatusChange,
    IncidentUpdate,
)
from app.services import scoping

logger = logging.getLogger(__name__)


def _load_visible(conn: Connection, incident_id: int, user: CurrentUser) -> dict:
    """Fetch an incident the caller is allowed to see.

    A record the caller may not see returns 404 rather than 403, so the API
    does not confirm that an id exists to someone with no access to it.
    """
    incident = incidents_repo.get_raw(conn, incident_id)
    if incident is None or not scoping.can_view_incident(user, incident):
        raise NotFoundError("Incident not found.")
    return incident


def list_incidents(conn: Connection, user: CurrentUser, filters: IncidentFilters):
    scope_clause, scope_params = scoping.incident_scope(user)
    rows, total = incidents_repo.search(
        conn,
        filters.model_dump(exclude={"page", "limit", "sort"}),
        scope_clause=scope_clause,
        scope_params=scope_params,
        limit=filters.limit,
        offset=filters.offset,
        sort=filters.sort,
    )
    return rows, total


def get_incident(conn: Connection, incident_id: int, user: CurrentUser) -> dict:
    _load_visible(conn, incident_id, user)
    detail = incidents_repo.get_detail(conn, incident_id)
    return _shape_detail(detail)


def _shape_detail(row: dict) -> dict:
    """Fold the joined columns into the nested shape the schema expects."""
    row = dict(row)
    row["category"] = {
        "id": row["category_id"],
        "label": row.pop("category_label"),
        "category_type": row.pop("category_type"),
    }
    row["location"] = {
        "building_id": row["building_id"],
        "building_name": row.pop("building_name"),
        "building_code": row.pop("building_code"),
        "floor_id": row.get("floor_id"),
        "floor_label": row.pop("floor_label", None),
        "floor_level": row.pop("floor_level", None),
        "seat_id": row.get("seat_id"),
        "seat_code": row.pop("seat_code", None),
    }
    row["reporter"] = {
        "id": row["reporter_id"],
        "full_name": row.pop("reporter_name"),
        "email": row.pop("reporter_email"),
        "role": row.pop("reporter_role"),
    }
    if row.get("assignee_id") is not None:
        row["assignee"] = {
            "id": row["assignee_id"],
            "full_name": row.pop("assignee_name"),
            "email": row.pop("assignee_email"),
            "role": row.pop("assignee_role"),
        }
    else:
        row["assignee"] = None
        for key in ("assignee_name", "assignee_email", "assignee_role"):
            row.pop(key, None)
    return row


def create_incident(
    conn: Connection, user: CurrentUser, payload: IncidentCreate
) -> dict:
    """Anyone signed in may report an incident.

    Status, priority and assignee are not taken from the request: a new
    incident is always open, unassigned and at the default priority.
    """
    # The incident and its first audit event are written together, so neither
    # can exist without the other.
    with transaction(conn):
        incident = incidents_repo.create(
            conn,
            title=payload.title,
            description=payload.description,
            category_id=payload.category_id,
            building_id=payload.building_id,
            floor_id=payload.floor_id,
            seat_id=payload.seat_id,
            reporter_id=user.id,
        )
        events_repo.record(
            conn,
            incident_id=incident["id"],
            actor_id=user.id,
            event_type="created",
            to_value="open",
        )
    logger.info("incident created id=%s reporter=%s", incident["id"], user.id)
    return get_incident(conn, incident["id"], user)


def update_incident(
    conn: Connection, incident_id: int, user: CurrentUser, payload: IncidentUpdate
) -> dict:
    """The reporter may correct details while the incident is still open. An
    administrator may edit at any time. An engineer may not: they communicate
    through notes instead of rewriting somebody's report."""
    incident = _load_visible(conn, incident_id, user)

    if user.role != UserRole.ADMIN:
        if incident["reporter_id"] != user.id:
            raise ForbiddenError("Only the reporter may edit this incident.")
        if incident["status"] != IncidentStatus.OPEN:
            raise ForbiddenError(
                "This incident can no longer be edited because work has started. "
                "Add a note instead."
            )

    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        return get_incident(conn, incident_id, user)

    # Changing the location partially would leave a floor from the old
    # building beside a building from the new one, which the composite foreign
    # keys would reject with an unhelpful message. Require the whole location.
    location_keys = {"building_id", "floor_id", "seat_id"}
    if location_keys & changes.keys() and not location_keys <= changes.keys():
        raise ValidationError(
            "When changing the location, send building_id, floor_id and seat_id "
            "together.",
            {"building_id": "Send the whole location, not part of it."},
        )

    with transaction(conn):
        incidents_repo.update_fields(conn, incident_id, changes)
        events_repo.record(
            conn,
            incident_id=incident_id,
            actor_id=user.id,
            event_type="updated",
            reason=", ".join(sorted(changes.keys())),
        )
    return get_incident(conn, incident_id, user)


def assign(
    conn: Connection, incident_id: int, user: CurrentUser, payload: IncidentAssign
) -> dict:
    """Administrators assign work.

    The engineer must exist and be active; the database additionally refuses
    any assignee without an engineer profile, so an employee cannot be given a
    ticket even if this check were removed.
    """
    incident = _load_visible(conn, incident_id, user)
    if incident["status"] == IncidentStatus.CLOSED:
        raise ValidationError("A closed incident cannot be reassigned.")

    engineer = engineers_repo.get(conn, payload.engineer_id)
    if engineer is None:
        raise ValidationError("That engineer does not exist.")
    if not engineer["is_active"]:
        raise ValidationError("That engineer's account is deactivated.")

    # Capacity is advisory, not a hard limit: an urgent incident should still
    # be assignable. It is logged so the workload report explains itself.
    active = engineers_repo.active_ticket_count(conn, payload.engineer_id)
    if active >= engineer["max_active_tickets"]:
        logger.info(
            "assigning over capacity engineer=%s active=%s max=%s",
            payload.engineer_id,
            active,
            engineer["max_active_tickets"],
        )

    previous = incident["assignee_id"]
    with transaction(conn):
        incidents_repo.set_assignee(conn, incident_id, payload.engineer_id)
        events_repo.record(
            conn,
            incident_id=incident_id,
            actor_id=user.id,
            event_type="assigned",
            from_value=str(previous) if previous else None,
            to_value=engineer["full_name"],
        )
    return get_incident(conn, incident_id, user)


def change_status(
    conn: Connection, incident_id: int, user: CurrentUser, payload: IncidentStatusChange
) -> dict:
    """Move an incident through the workflow.

    Two rules apply: the transition must be one the workflow allows, and the
    caller must be entitled to make it.
    """
    incident = _load_visible(conn, incident_id, user)
    current = IncidentStatus(incident["status"])
    target = payload.status

    if target == current:
        raise ValidationError(f"This incident is already {current.value}.")

    allowed = ALLOWED_TRANSITIONS[current]
    if target not in allowed:
        permitted = ", ".join(sorted(s.value for s in allowed)) or "nothing"
        raise ValidationError(
            f"An incident that is {current.value} cannot move to {target.value}. "
            f"Allowed from here: {permitted}."
        )

    _check_status_permission(user, incident, current, target)

    if target == IncidentStatus.IN_PROGRESS and incident["assignee_id"] is None:
        raise ValidationError("Assign an engineer before starting work.")

    with transaction(conn):
        incidents_repo.set_status(
            conn, incident_id, status=target.value, blocked_reason=payload.reason
        )
        events_repo.record(
            conn,
            incident_id=incident_id,
            actor_id=user.id,
            event_type="status_changed",
            from_value=current.value,
            to_value=target.value,
            reason=payload.reason,
        )
    logger.info(
        "incident %s %s -> %s by %s", incident_id, current.value, target.value, user.id
    )
    return get_incident(conn, incident_id, user)


def _check_status_permission(
    user: CurrentUser,
    incident: dict,
    current: IncidentStatus,
    target: IncidentStatus,
) -> None:
    if user.role == UserRole.ADMIN:
        return

    if user.role == UserRole.ENGINEER:
        if incident["assignee_id"] != user.id:
            raise ForbiddenError("This incident is not assigned to you.")
        # An engineer works the ticket but does not close it. Closing is the
        # reporter's confirmation that the fix actually worked.
        if target == IncidentStatus.CLOSED:
            raise ForbiddenError("Mark the incident resolved. The reporter closes it.")
        return

    # Employee: may close their own resolved incident, and may reopen one they
    # do not consider fixed.
    if incident["reporter_id"] != user.id:
        raise ForbiddenError("You did not report this incident.")
    if current == IncidentStatus.RESOLVED and target in (
        IncidentStatus.CLOSED,
        IncidentStatus.IN_PROGRESS,
    ):
        return
    if current == IncidentStatus.OPEN and target == IncidentStatus.CLOSED:
        return
    raise ForbiddenError(
        "You can close your incident once it is resolved, or reopen it if the "
        "problem persists."
    )


def change_priority(
    conn: Connection,
    incident_id: int,
    user: CurrentUser,
    payload: IncidentPriorityChange,
) -> dict:
    """Administrators set priority.

    An employee who believes their incident is urgent requests an escalation
    instead, which leaves a record of the request and the decision.
    """
    incident = _load_visible(conn, incident_id, user)
    if user.role != UserRole.ADMIN:
        raise ForbiddenError(
            "Only an administrator can change priority. Request an escalation instead."
        )

    previous = incident["priority"]
    if previous == payload.priority:
        raise ValidationError(f"Priority is already {payload.priority.value}.")

    with transaction(conn):
        incidents_repo.set_priority(conn, incident_id, payload.priority.value)
        events_repo.record(
            conn,
            incident_id=incident_id,
            actor_id=user.id,
            event_type="priority_changed",
            from_value=previous,
            to_value=payload.priority.value,
            reason=payload.reason,
        )
    return get_incident(conn, incident_id, user)


def request_escalation(
    conn: Connection, incident_id: int, user: CurrentUser, payload: EscalationRequest
) -> dict:
    """The reporter asks for the incident to be escalated."""
    incident = _load_visible(conn, incident_id, user)

    if user.role == UserRole.EMPLOYEE and incident["reporter_id"] != user.id:
        raise ForbiddenError("You did not report this incident.")
    if incident["status"] in (IncidentStatus.RESOLVED, IncidentStatus.CLOSED):
        raise ValidationError("This incident is already finished.")
    if incident["escalation_status"] == "requested":
        raise ValidationError("An escalation is already awaiting a decision.")

    with transaction(conn):
        incidents_repo.set_escalation(
            conn, incident_id, state="requested", reason=payload.reason
        )
        events_repo.record(
            conn,
            incident_id=incident_id,
            actor_id=user.id,
            event_type="escalation_requested",
            from_value=incident["escalation_status"],
            to_value="requested",
            reason=payload.reason,
        )
    return get_incident(conn, incident_id, user)


def decide_escalation(
    conn: Connection, incident_id: int, user: CurrentUser, payload: EscalationDecision
) -> dict:
    """An administrator approves or rejects a pending escalation."""
    incident = _load_visible(conn, incident_id, user)
    if incident["escalation_status"] != "requested":
        raise ValidationError("There is no escalation awaiting a decision.")

    state = "approved" if payload.approve else "rejected"
    with transaction(conn):
        incidents_repo.set_escalation(conn, incident_id, state=state, reason=None)
        events_repo.record(
            conn,
            incident_id=incident_id,
            actor_id=user.id,
            event_type="escalation_decided",
            from_value="requested",
            to_value=state,
            reason=payload.note,
        )
    logger.info("escalation %s on incident %s by %s", state, incident_id, user.id)
    return get_incident(conn, incident_id, user)


def delete_incident(conn: Connection, incident_id: int, user: CurrentUser) -> None:
    """Administrators only. Removes the notes and audit trail by cascade,
    which is why nothing else may do it."""
    if incidents_repo.get_raw(conn, incident_id) is None:
        raise NotFoundError("Incident not found.")
    incidents_repo.delete(conn, incident_id)
    logger.info("incident deleted id=%s by %s", incident_id, user.id)


def timeline(conn: Connection, incident_id: int, user: CurrentUser) -> list[dict]:
    _load_visible(conn, incident_id, user)
    return events_repo.timeline(conn, incident_id)


def find_similar(conn: Connection, query) -> list[dict]:
    return incidents_repo.find_similar(
        conn,
        seat_id=query.seat_id,
        floor_id=query.floor_id,
        building_id=query.building_id,
        category_id=query.category_id,
        limit=query.limit,
    )
