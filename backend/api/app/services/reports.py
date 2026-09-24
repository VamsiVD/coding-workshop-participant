"""Report rules.

Every report is scoped by role through the same function the incident list
uses, so a dashboard cannot show an employee figures drawn from incidents they
are not allowed to see.

Sits between the report routes and the reports repository: each function
resolves the caller's scope and passes it to the SQL, adding only light
shaping of the rows.
"""

from datetime import datetime

from psycopg import Connection

from app.repositories import engineers as engineers_repo
from app.repositories import reports as repo
from app.schemas.auth import CurrentUser
from app.services import scoping


def dashboard(conn: Connection, user: CurrentUser) -> dict:
    """Q1. Status, priority and assignee counts for the caller's incidents."""
    scope_clause, scope_params = scoping.incident_scope(user)
    return repo.dashboard_summary(
        conn, scope_clause=scope_clause, scope_params=scope_params
    )


def hotspots(
    conn: Connection,
    user: CurrentUser,
    *,
    group_by: str = "seat",
    min_count: int = 2,
    limit: int = 50,
) -> dict:
    """Q2. Locations with at least `min_count` incidents, grouped by building,
    floor or seat. The route validates `group_by` before it gets here."""
    scope_clause, scope_params = scoping.incident_scope(user)
    rows = repo.hotspots(
        conn,
        group_by=group_by,
        min_count=min_count,
        limit=limit,
        scope_clause=scope_clause,
        scope_params=scope_params,
    )
    return {"group_by": group_by, "rows": rows}


def response_times(
    conn: Connection,
    user: CurrentUser,
    *,
    created_from: datetime | None = None,
    created_to: datetime | None = None,
) -> dict:
    """Q3. Hours to acknowledge, assign and resolve, overall and by priority,
    optionally for incidents reported within a date range."""
    scope_clause, scope_params = scoping.incident_scope(user)
    return repo.response_times(
        conn,
        scope_clause=scope_clause,
        scope_params=scope_params,
        created_from=created_from,
        created_to=created_to,
    )


def engineer_workload(conn: Connection) -> dict:
    """Not scoped: only administrators reach this endpoint, and the point of
    it is comparing engineers against one another."""
    rows = engineers_repo.workload(conn)
    # The repository returns per-status counts; the total is summed here from
    # the same three statuses `active_ticket_count` treats as active, so the
    # report and the deactivation check agree.
    shaped = [
        {
            **row,
            "active_tickets": row["open_tickets"]
            + row["in_progress_tickets"]
            + row["blocked_tickets"],
        }
        for row in rows
    ]
    return {"rows": shaped, "unassigned_count": repo.unassigned_count(conn)}


def categories(conn: Connection, user: CurrentUser) -> dict:
    """Q5. Incident counts per category, most common first."""
    scope_clause, scope_params = scoping.incident_scope(user)
    return {
        "rows": repo.category_counts(
            conn, scope_clause=scope_clause, scope_params=scope_params
        )
    }


def attention(conn: Connection, user: CurrentUser) -> dict:
    """Q6. Blocked and escalated incidents, each with its stated reason."""
    scope_clause, scope_params = scoping.incident_scope(user)
    return repo.attention_required(
        conn, scope_clause=scope_clause, scope_params=scope_params
    )


def communication(
    conn: Connection, user: CurrentUser, *, stale_after_days: int = 3
) -> dict:
    """Q7. Time to the first note, incidents with no notes, and unresolved
    incidents untouched for more than `stale_after_days`."""
    scope_clause, scope_params = scoping.incident_scope(user)
    return repo.communication(
        conn,
        stale_after_days=stale_after_days,
        scope_clause=scope_clause,
        scope_params=scope_params,
    )
