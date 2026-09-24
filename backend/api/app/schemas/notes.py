"""Notes on an incident: the conversation between reporter, engineer and
administrator.

Request and response models for the note routes; who may add, edit or delete
a note is decided in `app.services.notes`.
"""

from datetime import datetime

from pydantic import Field

from app.schemas.common import ApiModel, ApiResponse, PageParams, UserSummary


class NoteCreate(ApiModel):
    """A new note. The incident comes from the URL path and the author from
    the token, so neither can be forged in the body."""

    body: str = Field(min_length=1, max_length=5000)


class NoteUpdate(ApiModel):
    """Editing is limited to the author, and to administrators. That check
    belongs to the service layer, which knows who is asking."""

    body: str = Field(min_length=1, max_length=5000)


class NoteOut(ApiResponse):
    """A note as the API returns it, with its author nested."""

    id: int
    incident_id: int
    author: UserSummary
    body: str
    created_at: datetime
    updated_at: datetime

    @property
    def was_edited(self) -> bool:
        """True once the note has been changed. A database trigger bumps
        `updated_at` on every update, so it moves past `created_at` only after
        an edit. A plain property, so it is not serialised in responses."""
        return self.updated_at > self.created_at


class NoteFilters(PageParams):
    """Notes are ordered oldest first by default, because they read as a
    conversation rather than as a feed."""

    order: str = Field(default="asc", pattern=r"^(asc|desc)$")
