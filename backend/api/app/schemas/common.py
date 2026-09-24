"""Enumerations and shared response shapes.

The enum members mirror the PostgreSQL enum types in
`backend/api/db/init/01_schema.sql` exactly. If one changes, both change.

Everything else here is used across the other schema modules: the request and
response base classes, the pagination envelope, the error shape and the small
nested summaries.
"""

from datetime import datetime
from enum import StrEnum
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field

# Item type of a `Page`, so `Page[IncidentSummary]` documents its items.
T = TypeVar("T")


# ---------------------------------------------------------------------------
# Enumerations - mirror the database enum types
# ---------------------------------------------------------------------------


class UserRole(StrEnum):
    """The three personas. Self-registration always yields `employee`."""

    EMPLOYEE = "employee"
    ADMIN = "admin"
    ENGINEER = "engineer"


class IncidentStatus(StrEnum):
    """Workflow states. Which moves between them are allowed is set by
    `ALLOWED_TRANSITIONS` in `app.schemas.incidents`."""

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
    """Escalation lifecycle: the reporter requests, an administrator decides.
    Only `approved` makes the incident's generated `is_escalated` true."""

    NOT_REQUESTED = "not_requested"
    REQUESTED = "requested"
    APPROVED = "approved"
    REJECTED = "rejected"


class CategoryType(StrEnum):
    FACILITY = "facility"
    TECHNOLOGY = "technology"


class IncidentEventType(StrEnum):
    """Kinds of entry in an incident's audit timeline."""

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
    """Base for every request schema in the API (bodies and query models).

    `extra="forbid"` on request bodies means an unexpected field is a 400
    rather than something silently dropped, which catches client typos such as
    `titel` instead of `title` at the edge.

    `str_strip_whitespace` trims every string before the length checks run, so
    a title of three spaces fails `min_length` instead of being stored blank.
    Responses use `ApiResponse` instead.
    """

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class ApiResponse(BaseModel):
    """Base for responses. Extra fields are tolerated on the way out, because
    repository queries may select more columns than a given view needs.

    `from_attributes` lets a model be built from an object as well as a dict;
    the repositories return dict rows, so most construction goes through
    FastAPI's `response_model` validation."""

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
        """Rows to skip for the SQL OFFSET; pages are numbered from 1."""
        return (self.page - 1) * self.limit


class Page(ApiResponse, Generic[T]):
    """Envelope for every list response, so the client pages them all alike."""

    items: list[T]
    page: int
    limit: int
    total: int

    @property
    def pages(self) -> int:
        """Page count, at least 1 so an empty result still reads "page 1 of 1".

        A plain property, so it is not part of the serialised response; a
        client derives it from `total` and `limit`.
        """
        return max(1, -(-self.total // self.limit))  # ceiling division


# ---------------------------------------------------------------------------
# Errors - documents the shape the error handlers produce
# ---------------------------------------------------------------------------


class ErrorDetail(BaseModel):
    """The body of an error: a stable machine-readable `code` for the client
    to branch on, and a `message` fit to show the user."""

    code: str = Field(examples=["VALIDATION_ERROR"])
    message: str = Field(examples=["The request data is invalid."])
    # Field name to message, for forms to highlight the offending input.
    fields: dict[str, str] | None = None


class ErrorResponse(BaseModel):
    """Envelope of every error response.

    The handlers in `app.core.errors` build this shape as a plain dict; the
    model states it in one typed place for anyone reading or extending them.
    """

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
    """A category as it appears nested inside an incident or engineer."""

    id: int
    label: str
    category_type: CategoryType


class LocationSummary(ApiResponse):
    """Where an incident is, flattened for display."""

    building_id: int
    building_name: str
    building_code: str
    # Floor and seat are optional on an incident, so a building-wide report
    # leaves them null.
    floor_id: int | None = None
    floor_label: str | None = None
    floor_level: int | None = None
    seat_id: int | None = None
    seat_code: str | None = None


class Timestamped(ApiResponse):
    """Mixin for responses that carry both audit timestamps."""

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
