"""Request and response models for the open-job pool and assignment requests.

Used by `app.api.routes.assignment_requests`; the rules are in
`app.services.assignment_requests`.
"""

from datetime import datetime

from pydantic import Field

from app.schemas.common import ApiModel, ApiResponse
from app.schemas.incidents import IncidentSummary


class PoolFilters(ApiModel):
    """Optional narrowing of the open-job pool. The pool itself is always open,
    unassigned incidents."""

    category_id: int | None = None
    building_id: int | None = None


class PoolIncident(IncidentSummary):
    """An open, unassigned incident as an engineer sees it in the pool.
    `requested_by_me` is always false for an administrator."""

    requested_by_me: bool = False


class AssignmentRequestCreate(ApiModel):
    """An engineer asking for a job, with an optional note for the admin."""

    note: str | None = Field(default=None, max_length=500)


class AssignmentRequestOut(ApiResponse):
    """A pending request, with the names the admin console shows beside it."""

    id: int
    incident_id: int
    incident_title: str
    engineer_id: int
    engineer_name: str
    note: str | None = None
    created_at: datetime
