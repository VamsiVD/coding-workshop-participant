"""Incidents: creation, edits, workflow transitions and query filters.

Rules that the database enforces with CHECK constraints are restated here so a
client gets a readable message instead of a constraint name. The database
remains the authority; these are for usability, not for safety.
"""

from datetime import datetime

from pydantic import Field, model_validator

from app.schemas.common import (
    ApiModel,
    ApiResponse,
    CategorySummary,
    EscalationState,
    IncidentEventType,
    IncidentPriority,
    IncidentStatus,
    LocationSummary,
    PageParams,
    UserSummary,
)

# Transitions the workflow permits. Anything absent is rejected before it
# reaches the database.
ALLOWED_TRANSITIONS: dict[IncidentStatus, set[IncidentStatus]] = {
    IncidentStatus.OPEN: {IncidentStatus.IN_PROGRESS, IncidentStatus.CLOSED},
    IncidentStatus.IN_PROGRESS: {
        IncidentStatus.BLOCKED,
        IncidentStatus.RESOLVED,
        IncidentStatus.OPEN,
    },
    IncidentStatus.BLOCKED: {IncidentStatus.IN_PROGRESS, IncidentStatus.CLOSED},
    IncidentStatus.RESOLVED: {IncidentStatus.CLOSED, IncidentStatus.IN_PROGRESS},
    # Closed is terminal.
    IncidentStatus.CLOSED: set(),
}


# ---------------------------------------------------------------------------
# Write models
# ---------------------------------------------------------------------------


class IncidentCreate(ApiModel):
    """Reported by an employee.

    Status, priority and assignee are absent on purpose. A new incident is
    always `open`, unassigned, at the default priority; letting a reporter set
    those would put the workflow in the client's hands.
    """

    title: str = Field(min_length=3, max_length=160)
    description: str = Field(min_length=3, max_length=5000)
    category_id: int
    building_id: int
    floor_id: int | None = None
    seat_id: int | None = None

    @model_validator(mode="after")
    def seat_requires_floor(self) -> "IncidentCreate":
        # Mirrors the incidents_seat_needs_floor constraint.
        if self.seat_id is not None and self.floor_id is None:
            raise ValueError("Select the floor the seat is on.")
        return self


class IncidentUpdate(ApiModel):
    """Correcting the details of an incident.

    The reporter may edit only while the incident is still open; an
    administrator may edit at any point. That rule belongs to the service
    layer, since it depends on who is asking.
    """

    title: str | None = Field(default=None, min_length=3, max_length=160)
    description: str | None = Field(default=None, min_length=3, max_length=5000)
    category_id: int | None = None
    building_id: int | None = None
    floor_id: int | None = None
    seat_id: int | None = None


class IncidentAssign(ApiModel):
    engineer_id: int = Field(description="The engineer's user id.")


class IncidentStatusChange(ApiModel):
    status: IncidentStatus
    reason: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def blocked_needs_reason(self) -> "IncidentStatusChange":
        # Mirrors incidents_blocked_has_reason, and answers the business
        # question "which incidents are blocked and why".
        if self.status == IncidentStatus.BLOCKED and not self.reason:
            raise ValueError("Say why the incident is blocked.")
        return self


class IncidentPriorityChange(ApiModel):
    priority: IncidentPriority
    reason: str | None = Field(default=None, max_length=2000)


class EscalationRequest(ApiModel):
    """Raised by the reporter. The reason is required, because an escalation
    with no stated cause cannot be triaged."""

    reason: str = Field(min_length=3, max_length=2000)


class EscalationDecision(ApiModel):
    """An administrator approves or rejects a pending escalation."""

    approve: bool
    note: str | None = Field(default=None, max_length=2000)


# ---------------------------------------------------------------------------
# Query filters
# ---------------------------------------------------------------------------


class IncidentFilters(PageParams):
    """Query string for the incident list.

    What a caller may see is scoped by role in the service layer: an employee
    sees their own reports, an engineer sees their assignments, an
    administrator sees everything. These filters narrow that set; they never
    widen it.
    """

    status: IncidentStatus | None = None
    priority: IncidentPriority | None = None
    category_id: int | None = None
    building_id: int | None = None
    floor_id: int | None = None
    seat_id: int | None = None
    assignee_id: int | None = None
    reporter_id: int | None = None
    escalated: bool | None = Field(
        default=None, description="True returns approved escalations only."
    )
    q: str | None = Field(
        default=None,
        min_length=2,
        max_length=160,
        description="Free-text search over title and description.",
    )
    created_from: datetime | None = None
    created_to: datetime | None = None
    sort: str = Field(
        default="-created_at",
        pattern=r"^-?(created_at|updated_at|priority|status)$",
        description="Prefix with - for descending.",
    )

    @model_validator(mode="after")
    def date_range_ordered(self) -> "IncidentFilters":
        if (
            self.created_from is not None
            and self.created_to is not None
            and self.created_from > self.created_to
        ):
            raise ValueError("created_from must be on or before created_to.")
        return self


class SimilarIncidentQuery(ApiModel):
    """Looks for open incidents already reported for the same place and kind,
    so a reporter sees them before adding a duplicate."""

    seat_id: int | None = None
    floor_id: int | None = None
    building_id: int | None = None
    category_id: int | None = None
    limit: int = Field(default=5, ge=1, le=20)

    @model_validator(mode="after")
    def needs_one_location(self) -> "SimilarIncidentQuery":
        if self.seat_id is None and self.floor_id is None and self.building_id is None:
            raise ValueError("Give at least a building, floor or seat.")
        return self


# ---------------------------------------------------------------------------
# Read models
# ---------------------------------------------------------------------------


class IncidentSummary(ApiResponse):
    """A row in the incident list. Deliberately narrower than the detail view:
    a list of fifty should not carry fifty descriptions."""

    id: int
    title: str
    status: IncidentStatus
    priority: IncidentPriority
    escalation_status: EscalationState
    is_escalated: bool
    category: CategorySummary
    building_name: str
    floor_label: str | None = None
    seat_code: str | None = None
    reporter_name: str
    assignee_name: str | None = None
    reporter_id: int
    assignee_id: int | None = None
    # Carried on the list row so the admin queue can show why a ticket needs
    # attention without opening each one.
    escalation_reason: str | None = None
    blocked_reason: str | None = None
    note_count: int = 0
    created_at: datetime
    updated_at: datetime


class IncidentDetail(ApiResponse):
    """A single incident, with the related records the detail page needs."""

    id: int
    title: str
    description: str
    status: IncidentStatus
    priority: IncidentPriority
    category: CategorySummary
    location: LocationSummary
    reporter: UserSummary
    assignee: UserSummary | None = None

    escalation_status: EscalationState
    # Generated by the database from escalation_status; read-only here.
    is_escalated: bool
    escalation_reason: str | None = None
    blocked_reason: str | None = None
    duplicate_of_id: int | None = None

    created_at: datetime
    assigned_at: datetime | None = None
    acknowledged_at: datetime | None = None
    resolved_at: datetime | None = None
    closed_at: datetime | None = None
    updated_at: datetime

    @property
    def is_open(self) -> bool:
        return self.status not in (IncidentStatus.RESOLVED, IncidentStatus.CLOSED)

    @property
    def next_statuses(self) -> list[IncidentStatus]:
        """Drives the workflow diagram and the status dropdown, so the client
        never offers a transition the server would refuse."""
        return sorted(ALLOWED_TRANSITIONS[self.status])


class IncidentEventOut(ApiResponse):
    """One entry in the timeline."""

    id: int
    incident_id: int
    event_type: IncidentEventType
    actor: UserSummary | None = None
    from_value: str | None = None
    to_value: str | None = None
    reason: str | None = None
    created_at: datetime


class IncidentTimeline(ApiResponse):
    incident_id: int
    events: list[IncidentEventOut]
