"""Role scoping for incident queries.

One place decides what each persona may see. Every list and report passes its
result to the repository, so a new report cannot accidentally show an employee
somebody else's incidents.

The rule:

- employee  their own reports
- engineer  incidents assigned to them
- admin     everything
"""

from app.schemas.auth import CurrentUser
from app.schemas.common import UserRole


def incident_scope(user: CurrentUser) -> tuple[str | None, dict]:
    """Return a WHERE fragment and its bound parameters for this caller."""
    if user.role == UserRole.ADMIN:
        return None, {}
    if user.role == UserRole.ENGINEER:
        return "i.assignee_id = %(scope_user_id)s", {"scope_user_id": user.id}
    return "i.reporter_id = %(scope_user_id)s", {"scope_user_id": user.id}


def can_view_incident(user: CurrentUser, incident: dict) -> bool:
    """Whether this caller may see one specific incident."""
    if user.role == UserRole.ADMIN:
        return True
    if user.role == UserRole.ENGINEER:
        return incident["assignee_id"] == user.id
    return incident["reporter_id"] == user.id
