"""Dashboard and report responses.

Each model answers one of the seven business questions in the root README. The
queries behind them are written and verified in `backend/db/smoke.sql`.
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
    """Optional date range accepted by every report. Omitted means all time."""

    date_from: datetime | None = None
    date_to: datetime | None = None


# ---------------------------------------------------------------------------
# Q1. What incidents are open, and what is their status?
# ---------------------------------------------------------------------------


class StatusCount(ApiResponse):
    status: IncidentStatus
    count: int


class PriorityCount(ApiResponse):
    priority: IncidentPriority
    count: int


class AssigneeCount(ApiResponse):
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
    by_status: list[StatusCount] = []
    by_priority: list[PriorityCount] = []
    by_assignee: list[AssigneeCount] = []


# ---------------------------------------------------------------------------
# Q2. Which buildings, floors and seats have recurring issues?
# ---------------------------------------------------------------------------


class HotspotRow(ApiResponse):
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
    median_hours_to_resolve: float | None = None
    sample_size: int = 0


class ResponseTimesByPriority(ApiResponse):
    priority: IncidentPriority
    times: ResponseTimes


class ResponseTimeReport(ApiResponse):
    overall: ResponseTimes
    by_priority: list[ResponseTimesByPriority] = []


# ---------------------------------------------------------------------------
# Q4. Which engineers are available, and how is work distributed?
# ---------------------------------------------------------------------------


class EngineerWorkloadRow(ApiResponse):
    user_id: int
    full_name: str
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
    rows: list[EngineerWorkloadRow]
    unassigned_count: int = 0


# ---------------------------------------------------------------------------
# Q5. What are the most common issue categories?
# ---------------------------------------------------------------------------


class CategoryCount(ApiResponse):
    category_id: int
    label: str
    category_type: CategoryType
    incident_count: int
    open_count: int


class CategoryReport(ApiResponse):
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
    reason: str | None = None
    assignee_name: str | None = None
    days_in_state: float
    created_at: datetime


class AttentionReport(ApiResponse):
    blocked: list[AttentionRow] = []
    escalated: list[AttentionRow] = []


# ---------------------------------------------------------------------------
# Q7. How well are reporters kept informed?
# ---------------------------------------------------------------------------


class StaleIncidentRow(ApiResponse):
    id: int
    title: str
    status: IncidentStatus
    assignee_name: str | None = None
    days_since_last_update: float
    has_notes: bool


class CommunicationReport(ApiResponse):
    avg_hours_to_first_note: float | None = None
    incidents_without_notes: int = 0
    stale_incidents: list[StaleIncidentRow] = []
    stale_after_days: int = 3
