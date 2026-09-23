"""Notes on an incident: the conversation between reporter, engineer and
administrator."""

from datetime import datetime

from pydantic import Field

from app.schemas.common import ApiModel, ApiResponse, PageParams, UserSummary


class NoteCreate(ApiModel):
    body: str = Field(min_length=1, max_length=5000)


class NoteUpdate(ApiModel):
    """Editing is limited to the author, and to administrators. That check
    belongs to the service layer, which knows who is asking."""

    body: str = Field(min_length=1, max_length=5000)


class NoteOut(ApiResponse):
    id: int
    incident_id: int
    author: UserSummary
    body: str
    created_at: datetime
    updated_at: datetime

    @property
    def was_edited(self) -> bool:
        return self.updated_at > self.created_at


class NoteFilters(PageParams):
    """Notes are ordered oldest first by default, because they read as a
    conversation rather than as a feed."""

    order: str = Field(default="asc", pattern=r"^(asc|desc)$")
