"""Dashboard and report responses.

Each model answers one of the seven business questions in the root README. The
queries behind them are written and verified in `backend/api/db/smoke.sql`.

Response models only; the role scoping lives in `app.services.reports` and the
SQL in `app.repositories.reports`.
"""

from datetime import datetime

from pydantic import Field

from app.schemas.common import (
    ApiModel,
    ApiResponse,
    CategoryType,
    EscalationState,
    IncidentPriority,
    IncidentStatus,
)


class ReportWindow(ApiModel):
    """Optional date range for a report. Omitted means all time.

    Not yet accepted by any report endpoint: no route declares it, so every
    report currently covers all time.
    """

    date_from: datetime | None = None
    date_to: datetime | None = None


# ---------------------------------------------------------------------------
# Q1. What incidents are open, and what is their status?
# ---------------------------------------------------------------------------


class StatusCount(ApiResponse):
    """Incidents in one status, within the caller's scope."""

    status: IncidentStatus
    count: int


class PriorityCount(ApiResponse):
    """Incidents at one priority, within the caller's scope."""

    priority: IncidentPriority
    count: int


class AssigneeCount(ApiResponse):
    """Unfinished (not resolved or closed) incidents held by one engineer.
    The unassigned bucket has both id and name null."""

    assignee_id: int | None = None
    assignee_name: str | None = Field(
        default=None, description="None means unassigned."
    )
    count: int


class DashboardSummary(ApiResponse):
    """The per-persona dashboard. Scoped by role in the service layer: an
    employee sees their own reports, an engineer their assignments, an
    administrator everything."""

    total: int
    open_count: int
    in_progress_count: int
    blocked_count: int
    resolved_count: int
    closed_count: int
    escalated_count: int
    unassigned_count: int
    # `escalated_count` counts approved escalations only, matching the
    # generated is_escalated column; pending requests are not included.
    by_status: list[StatusCount] = []
    by_priority: list[PriorityCount] = []
    by_assignee: list[AssigneeCount] = []


# ---------------------------------------------------------------------------
# Q2. Which buildings, floors and seats have recurring issues?
# ---------------------------------------------------------------------------


class HotspotRow(ApiResponse):
    """One location with its incident counts. Which of floor and seat are
    filled depends on the report's `group_by`: grouping by building leaves
    both null."""

    building_id: int
    building_code: str
    building_name: str
    floor_id: int | None = None
    floor_label: str | None = None
    seat_id: int | None = None
    seat_code: str | None = None
    incident_count: int
    open_count: int
    last_reported_at: datetime | None = None


class HotspotReport(ApiResponse):
    """Locations with at least `min_count` incidents, busiest first."""

    group_by: str = Field(default="seat", description="One of building, floor or seat.")
    rows: list[HotspotRow]


# ---------------------------------------------------------------------------
# Q3. How quickly are incidents acknowledged, assigned and resolved?
# ---------------------------------------------------------------------------


class ResponseTimes(ApiResponse):
    """Hours, averaged. Null where no incident has reached that stage yet."""

    avg_hours_to_acknowledge: float | None = None
    avg_hours_to_assign: float | None = None
    avg_hours_to_resolve: float | None = None
    # The median sits beside the mean because a few very slow incidents can
    # drag the average far from the typical case.
    median_hours_to_resolve: float | None = None
    sample_size: int = 0


class ResponseTimesByPriority(ApiResponse):
    """The same measures for incidents at one priority."""

    priority: IncidentPriority
    times: ResponseTimes


class ResponseTimeReport(ApiResponse):
    """Response times across the caller's scope, overall and per priority."""

    overall: ResponseTimes
    by_priority: list[ResponseTimesByPriority] = []


# ---------------------------------------------------------------------------
# Q4. Which engineers are available, and how is work distributed?
# ---------------------------------------------------------------------------


class EngineerWorkloadRow(ApiResponse):
    """One engineer's current load. `active_tickets` is summed by the service
    from the open, in-progress and blocked counts.

    `at_capacity` and `spare_capacity` are plain properties, so they are not
    serialised; the response carries the inputs and the client compares them.
    """

    user_id: int
    full_name: str
    # The category label, flattened; unlike EngineerOut this is not nested.
    specialization: str | None = None
    is_available: bool
    max_active_tickets: int
    active_tickets: int
    resolved_last_30_days: int = 0

    @property
    def at_capacity(self) -> bool:
        return self.active_tickets >= self.max_active_tickets

    @property
    def spare_capacity(self) -> int:
        return max(0, self.max_active_tickets - self.active_tickets)


class WorkloadReport(ApiResponse):
    """Every engineer's load, plus the incidents nobody holds yet. Not
    role-scoped: administrators only."""

    rows: list[EngineerWorkloadRow]
    unassigned_count: int = 0


# ---------------------------------------------------------------------------
# Q5. What are the most common issue categories?
# ---------------------------------------------------------------------------


class CategoryCount(ApiResponse):
    """Incident totals for one category, within the caller's scope."""

    category_id: int
    label: str
    category_type: CategoryType
    incident_count: int
    open_count: int


class CategoryReport(ApiResponse):
    """Categories by incident count."""

    rows: list[CategoryCount]


# ---------------------------------------------------------------------------
# Q6. Which incidents are escalated or blocked, and why?
# ---------------------------------------------------------------------------


class AttentionRow(ApiResponse):
    """An incident needing a decision, with the stated reason."""

    id: int
    title: str
    status: IncidentStatus
    priority: IncidentPriority
    escalation_status: EscalationState
    # The blocked reason in the blocked list, the escalation reason in the
    # escalated list.
    reason: str | None = None
    assignee_name: str | None = None
    # Days since the incident was last updated in any way, so an
    # approximation of time in the current state rather than a measure of it.
    days_in_state: float
    created_at: datetime


class AttentionReport(ApiResponse):
    """Blocked incidents and escalated ones, longest waiting first.

    `escalated` holds every incident with an escalation at any stage
    (requested, approved or rejected), not only those awaiting a decision.
    """

    blocked: list[AttentionRow] = []
    escalated: list[AttentionRow] = []


# ---------------------------------------------------------------------------
# Q7. How well are reporters kept informed?
# ---------------------------------------------------------------------------


class StaleIncidentRow(ApiResponse):
    """An unresolved incident nobody has touched for `stale_after_days`."""

    id: int
    title: str
    status: IncidentStatus
    assignee_name: str | None = None
    days_since_last_update: float
    has_notes: bool


class CommunicationReport(ApiResponse):
    """How quickly reporters hear back, and which incidents have gone quiet.
    `stale_after_days` echoes the threshold the request used."""

    avg_hours_to_first_note: float | None = None
    incidents_without_notes: int = 0
    stale_incidents: list[StaleIncidentRow] = []
    stale_after_days: int = 3
