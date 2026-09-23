"""Enumerations and shared response shapes.

The enum members mirror the PostgreSQL enum types in
`backend/db/init/01_schema.sql` exactly. If one changes, both change.
"""

from datetime import datetime
from enum import StrEnum
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


# ---------------------------------------------------------------------------
# Enumerations - mirror the database enum types
# ---------------------------------------------------------------------------


class UserRole(StrEnum):
    EMPLOYEE = "employee"
    ADMIN = "admin"
    ENGINEER = "engineer"


class IncidentStatus(StrEnum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    BLOCKED = "blocked"
    RESOLVED = "resolved"
    CLOSED = "closed"


class IncidentPriority(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class EscalationState(StrEnum):
    NOT_REQUESTED = "not_requested"
    REQUESTED = "requested"
    APPROVED = "approved"
    REJECTED = "rejected"


class CategoryType(StrEnum):
    FACILITY = "facility"
    TECHNOLOGY = "technology"


class IncidentEventType(StrEnum):
    CREATED = "created"
    UPDATED = "updated"
    ASSIGNED = "assigned"
    STATUS_CHANGED = "status_changed"
    PRIORITY_CHANGED = "priority_changed"
    ESCALATION_REQUESTED = "escalation_requested"
    ESCALATION_DECIDED = "escalation_decided"
    NOTE_ADDED = "note_added"


# ---------------------------------------------------------------------------
# Base model
# ---------------------------------------------------------------------------


class ApiModel(BaseModel):
    """Base for every schema in the API.

    `extra="forbid"` on request bodies means an unexpected field is a 400
    rather than something silently dropped, which catches client typos such as
    `titel` instead of `title` at the edge.
    """

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class ApiResponse(BaseModel):
    """Base for responses. Extra fields are tolerated on the way out, because
    repository queries may select more columns than a given view needs."""

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Pagination
# ---------------------------------------------------------------------------


class PageParams(ApiModel):
    """Query parameters every list endpoint accepts.

    `limit` is capped so a client cannot ask for the whole table in one call.
    """

    page: int = Field(default=1, ge=1)
    limit: int = Field(default=20, ge=1, le=100)

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.limit


class Page(ApiResponse, Generic[T]):
    """Envelope for every list response, so the client pages them all alike."""

    items: list[T]
    page: int
    limit: int
    total: int

    @property
    def pages(self) -> int:
        return max(1, -(-self.total // self.limit))  # ceiling division


# ---------------------------------------------------------------------------
# Errors - documents the shape the error handlers produce
# ---------------------------------------------------------------------------


class ErrorDetail(BaseModel):
    code: str = Field(examples=["VALIDATION_ERROR"])
    message: str = Field(examples=["The request data is invalid."])
    # Field name to message, for forms to highlight the offending input.
    fields: dict[str, str] | None = None


class ErrorResponse(BaseModel):
    success: bool = False
    error: ErrorDetail


# ---------------------------------------------------------------------------
# Small shared pieces
# ---------------------------------------------------------------------------


class UserSummary(ApiResponse):
    """A person as they appear nested inside another resource."""

    id: int
    full_name: str
    email: str
    role: UserRole


class CategorySummary(ApiResponse):
    id: int
    label: str
    category_type: CategoryType


class LocationSummary(ApiResponse):
    """Where an incident is, flattened for display."""

    building_id: int
    building_name: str
    building_code: str
    floor_id: int | None = None
    floor_label: str | None = None
    floor_level: int | None = None
    seat_id: int | None = None
    seat_code: str | None = None


class Timestamped(ApiResponse):
    created_at: datetime
    updated_at: datetime


class DeletedResponse(BaseModel):
    """Returned where a 204 would leave the client with nothing to confirm."""

    success: bool = True
    id: int


def as_page(items: list[Any], total: int, params: PageParams) -> dict:
    """Assemble the pagination envelope from a result set and its parameters."""
    return {
        "items": items,
        "page": params.page,
        "limit": params.limit,
        "total": total,
    }
