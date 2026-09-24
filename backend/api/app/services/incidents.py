"""Incident workflow and permissions.

This module owns the rules that the database cannot express: who may do what,
and which status changes the workflow permits. Every transition writes its
audit event in the same transaction as the change.

Sits between the incident routes and the incidents, events and engineers
repositories. Some routes are already limited to administrators; the checks
here cover what depends on the caller's relationship to the incident.
"""

import logging

from psycopg import Connection

from app.core.db import transaction
from app.core.errors import ForbiddenError, NotFoundError, ValidationError
from app.repositories import assignment_requests as requests_repo
from app.repositories import engineers as engineers_repo
from app.repositories import events as events_repo
from app.repositories import incidents as incidents_repo
from app.repositories import notes as notes_repo
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
    """One page of incidents the caller may see, and the total across pages.

    The role scope is ANDed with the client's filters, so a filter such as
    `reporter_id` can narrow an employee's view but never reach past it.
    """
    scope_clause, scope_params = scoping.incident_scope(user)
    rows, total = incidents_repo.search(
        conn,
        # Paging and sort travel as separate arguments; the rest are filters.
        filters.model_dump(exclude={"page", "limit", "sort"}),
        scope_clause=scope_clause,
        scope_params=scope_params,
        limit=filters.limit,
        offset=filters.offset,
        sort=filters.sort,
    )
    return rows, total


def get_incident(conn: Connection, incident_id: int, user: CurrentUser) -> dict:
    """The full detail view, after the visibility check. Every write below
    ends by calling this, so it returns the same shape as a plain read."""
    _load_visible(conn, incident_id, user)
    detail = incidents_repo.get_detail(conn, incident_id)
    return _shape_detail(detail)


def _shape_detail(row: dict) -> dict:
    """Fold the joined columns into the nested shape the schema expects."""
    # Copy first so the caller's row is not mutated. Joined display columns
    # are popped; the *_id columns are read with [] or get() and left in place,
    # where IncidentDetail simply ignores them.
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
        # Unassigned: the LEFT JOIN produced nulls, so drop them for tidiness.
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
    # Re-read after the commit to return the full joined detail view, which
    # the insert alone does not produce.
    return get_incident(conn, incident["id"], user)


def update_incident(
    conn: Connection, incident_id: int, user: CurrentUser, payload: IncidentUpdate
) -> dict:
    """The reporter may correct details while the incident is still open. An
    administrator may edit at any time. An engineer may not: they communicate
    through notes instead of rewriting somebody's report."""
    incident = _load_visible(conn, incident_id, user)

    # Engineers go through the reporter rule too, so an engineer cannot edit a
    # ticket they are working on for somebody else.
    if user.role != UserRole.ADMIN:
        if incident["reporter_id"] != user.id:
            raise ForbiddenError("Only the reporter may edit this incident.")
        if incident["status"] != IncidentStatus.OPEN:
            raise ForbiddenError(
                "This incident can no longer be edited because work has started. "
                "Add a note instead."
            )

    changes = payload.model_dump(exclude_unset=True)
    # An empty PATCH is not an error, but it is not worth a timeline entry.
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
            # The timeline records which fields changed, not their values.
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

    The route restricts this to administrators, so there is no role check
    here. Any status except closed may be (re)assigned. Raises ValidationError
    (400) for a closed incident or an unknown or deactivated engineer.
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

    # Assignment, its audit event, clearing requests and (optionally) starting
    # work all commit together. The event records the previous assignee by id
    # but the new one by name.
    with transaction(conn):
        # Lock the incident (a job request or status change waits) and the
        # engineer's profile (a deactivation waits), then re-check both.
        incident = incidents_repo.lock(conn, incident_id)
        if incident["status"] == IncidentStatus.CLOSED:
            raise ValidationError("A closed incident cannot be reassigned.")
        engineers_repo.lock(conn, payload.engineer_id)
        engineer = engineers_repo.get(conn, payload.engineer_id)
        if not engineer["is_active"]:
            raise ValidationError("That engineer's account is deactivated.")
        previous = incident["assignee_id"]
        incidents_repo.set_assignee(conn, incident_id, payload.engineer_id)
        # Assigning answers every pending request for this job, whether or not
        # it went to the engineer who asked.
        requests_repo.delete_for_incident(conn, incident_id)
        events_repo.record(
            conn,
            incident_id=incident_id,
            actor_id=user.id,
            event_type="assigned",
            from_value=str(previous) if previous else None,
            to_value=engineer["full_name"],
        )
        # "Assign and start": only an open incident moves; any other status is
        # left as it is rather than refused.
        if payload.start_work and incident["status"] == IncidentStatus.OPEN:
            incidents_repo.set_status(
                conn, incident_id, status=IncidentStatus.IN_PROGRESS.value, blocked_reason=None
            )
            events_repo.record(
                conn,
                incident_id=incident_id,
                actor_id=user.id,
                event_type="status_changed",
                from_value=IncidentStatus.OPEN.value,
                to_value=IncidentStatus.IN_PROGRESS.value,
            )
    return get_incident(conn, incident_id, user)


def change_status(
    conn: Connection, incident_id: int, user: CurrentUser, payload: IncidentStatusChange
) -> dict:
    """Move an incident through the workflow.

    Two rules apply: the transition must be one the workflow allows, and the
    caller must be entitled to make it.

    The workflow check runs before the permission check, so an impossible move
    is reported as such (400) whoever asks; a possible move the caller may not
    make is a 403.
    """
    _load_visible(conn, incident_id, user)
    target = payload.status

    with transaction(conn):
        # Re-read under a row lock: the status the checks below rely on
        # cannot change until this transaction commits.
        incident = incidents_repo.lock(conn, incident_id)
        current = IncidentStatus(incident["status"])
        steps = _status_path(current, target)

        # Every step must be one this caller may make, and work cannot start
        # with nobody assigned to do it.
        at = current
        for step in steps:
            _check_status_permission(user, incident, at, step)
            if step == IncidentStatus.IN_PROGRESS and incident["assignee_id"] is None:
                raise ValidationError("Assign an engineer before starting work.")
            at = step

        if payload.note and target == IncidentStatus.CLOSED:
            raise ValidationError("Add the note before closing: a closed incident takes no notes.")

        # One audit event per step, so the timeline shows the intermediate
        # in_progress too. The reason belongs to the final step only; the
        # repository keeps it as blocked_reason only when that is blocked.
        at = current
        for step in steps:
            reason = payload.reason if step == target else None
            incidents_repo.set_status(
                conn, incident_id, status=step.value, blocked_reason=reason
            )
            events_repo.record(
                conn,
                incident_id=incident_id,
                actor_id=user.id,
                event_type="status_changed",
                from_value=at.value,
                to_value=step.value,
                reason=reason,
            )
            at = step

        if payload.note:
            notes_repo.create(
                conn, incident_id=incident_id, author_id=user.id, body=payload.note
            )
            events_repo.record(
                conn, incident_id=incident_id, actor_id=user.id, event_type="note_added"
            )
    logger.info(
        "incident %s %s -> %s by %s",
        incident_id,
        current.value,
        " -> ".join(s.value for s in steps),
        user.id,
    )
    return get_incident(conn, incident_id, user)


# Moves a caller may ask for in one call; the server passes through in_progress.
_VIA_IN_PROGRESS = {
    (IncidentStatus.OPEN, IncidentStatus.BLOCKED),
    (IncidentStatus.OPEN, IncidentStatus.RESOLVED),
    (IncidentStatus.BLOCKED, IncidentStatus.RESOLVED),
}


def _status_path(
    current: IncidentStatus, target: IncidentStatus
) -> list[IncidentStatus]:
    """The workflow steps from `current` to `target`.

    A direct move when the workflow allows one. Otherwise one of the forward
    moves in `_VIA_IN_PROGRESS` (open -> blocked, open -> resolved,
    blocked -> resolved) goes through in_progress first, so a caller can ask
    for the outcome and the server performs both steps atomically. Anything
    else is a ValidationError (400).
    """
    # Not in the transition table either, but worth a clearer message.
    if target == current:
        raise ValidationError(f"This incident is already {current.value}.")
    allowed = ALLOWED_TRANSITIONS[current]
    if target in allowed:
        return [target]
    # Only forward moves are shortened. Anything leaving resolved (a reopen)
    # must be asked for explicitly, never implied by a later step.
    if (current, target) in _VIA_IN_PROGRESS:
        return [IncidentStatus.IN_PROGRESS, target]
    permitted = ", ".join(sorted(s.value for s in allowed)) or "nothing"
    raise ValidationError(
        f"An incident that is {current.value} cannot move to {target.value}. "
        f"Allowed from here: {permitted}."
    )


def _check_status_permission(
    user: CurrentUser,
    incident: dict,
    current: IncidentStatus,
    target: IncidentStatus,
) -> None:
    """Raise ForbiddenError (403) unless this caller may make this move.

    Administrators may make any move the workflow allows. Engineers may move
    only incidents assigned to them, and never to closed. Reporters may only
    close or reopen their own incident, as below.
    """
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
    # Closing an incident that is still open withdraws the report before
    # anyone has worked on it.
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
    # The route is already admin-only; this repeats the rule where it is
    # stated, so the service is safe to call from elsewhere.
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
    """The reporter asks for the incident to be escalated.

    An employee must be the reporter. An engineer or administrator who can
    see the incident may also request one. A new request is allowed after an
    earlier one was approved or rejected, but not while one is pending.
    """
    incident = _load_visible(conn, incident_id, user)

    # _load_visible already limits an employee to their own reports; this
    # states the rule explicitly and gives a clearer message.
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
    """An administrator approves or rejects a pending escalation.

    Admin-only by the route. Raises ValidationError (400) if nothing is
    pending, so a decision cannot be made twice.
    """
    incident = _load_visible(conn, incident_id, user)
    if incident["escalation_status"] != "requested":
        raise ValidationError("There is no escalation awaiting a decision.")

    state = "approved" if payload.approve else "rejected"
    with transaction(conn):
        # reason=None keeps the reporter's original reason on the incident
        # (the repository coalesces); the decision note goes on the event.
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
    # The admin restriction is enforced by the route, not repeated here. No
    # scoping check is needed either, since administrators see everything.
    if incidents_repo.get_raw(conn, incident_id) is None:
        raise NotFoundError("Incident not found.")
    incidents_repo.delete(conn, incident_id)
    logger.info("incident deleted id=%s by %s", incident_id, user.id)


def timeline(conn: Connection, incident_id: int, user: CurrentUser) -> list[dict]:
    """The incident's audit events, oldest first, if the caller may see it."""
    _load_visible(conn, incident_id, user)
    return events_repo.timeline(conn, incident_id)


def find_similar(conn: Connection, query) -> list[dict]:
    """Unfinished incidents at the same location (and category, if given).

    Not role-scoped: any signed-in caller sees matching incidents from every
    reporter, which is what lets a reporter spot someone else's report of the
    same problem before duplicating it.
    """
    return incidents_repo.find_similar(
        conn,
        seat_id=query.seat_id,
        floor_id=query.floor_id,
        building_id=query.building_id,
        category_id=query.category_id,
        limit=query.limit,
    )
