"""Issue categories."""

from pydantic import Field

from app.schemas.common import ApiModel, ApiResponse, CategoryType


class CategoryCreate(ApiModel):
    label: str = Field(min_length=1, max_length=80, examples=["HVAC"])
    category_type: CategoryType


class CategoryUpdate(ApiModel):
    label: str | None = Field(default=None, min_length=1, max_length=80)
    category_type: CategoryType | None = None
    # Categories are deactivated rather than deleted, because incidents
    # reference them and the foreign key is ON DELETE RESTRICT.
    is_active: bool | None = None


class CategoryOut(ApiResponse):
    id: int
    label: str
    category_type: CategoryType
    is_active: bool
