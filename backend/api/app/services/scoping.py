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
    """Return a WHERE fragment and its bound parameters for this caller.

    The fragment assumes the incidents table is aliased `i`. The user id is
    passed as a bound parameter, never formatted into the SQL.
    """
    # None means no restriction; the repositories add no clause at all.
    if user.role == UserRole.ADMIN:
        return None, {}
    if user.role == UserRole.ENGINEER:
        return "i.assignee_id = %(scope_user_id)s", {"scope_user_id": user.id}
    # Anyone else is treated as an employee, so an unexpected role gets the
    # narrowest view rather than a wider one.
    return "i.reporter_id = %(scope_user_id)s", {"scope_user_id": user.id}


def can_view_incident(user: CurrentUser, incident: dict) -> bool:
    """Whether this caller may see one specific incident.

    The single-record twin of `incident_scope`; the two must state the same
    rule, or a list would show incidents that then 404 when opened.
    """
    if user.role == UserRole.ADMIN:
        return True
    if user.role == UserRole.ENGINEER:
        return incident["assignee_id"] == user.id
    return incident["reporter_id"] == user.id
