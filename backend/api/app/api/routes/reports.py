"""Dashboards and reports.

Each endpoint answers one of the seven business questions in the root README.
Results are scoped by role, so the same URL gives an employee their own
figures and an administrator the whole organisation's.

HTTP layer only: the scoping and shaping live in `app.services.reports`.
"""

from fastapi import APIRouter, Query

from app.core.deps import AdminUser, CurrentUserDep, DbConnection
from app.schemas.reports import (
    AttentionReport,
    CategoryReport,
    CommunicationReport,
    DashboardSummary,
    HotspotReport,
    ResponseTimeReport,
    WorkloadReport,
)
from app.services import reports as service

router = APIRouter(tags=["reports"])


@router.get("/dashboard/summary", response_model=DashboardSummary)
def dashboard_summary(conn: DbConnection, user: CurrentUserDep):
    """Q1. Counts by status, priority and assignee, scoped to the caller."""
    return service.dashboard(conn, user)


@router.get("/reports/hotspots", response_model=HotspotReport)
def hotspots(
    conn: DbConnection,
    user: CurrentUserDep,
    group_by: str = Query(default="seat", pattern="^(building|floor|seat)$"),
    min_count: int = Query(default=2, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
):
    """Q2. Locations with recurring issues.

    `group_by` picks the level (building, floor or seat); only places with at
    least `min_count` incidents are listed.
    """
    return service.hotspots(
        conn, user, group_by=group_by, min_count=min_count, limit=limit
    )


@router.get("/reports/response-times", response_model=ResponseTimeReport)
def response_times(conn: DbConnection, user: CurrentUserDep):
    """Q3. Time to acknowledge, assign and resolve, overall and by priority."""
    return service.response_times(conn, user)


@router.get("/reports/engineer-workload", response_model=WorkloadReport)
def engineer_workload(conn: DbConnection, _: AdminUser):
    """Q4. Availability and load per engineer. Administrators only, since the
    point of it is comparing people."""
    return service.engineer_workload(conn)


@router.get("/reports/categories", response_model=CategoryReport)
def category_report(conn: DbConnection, user: CurrentUserDep):
    """Q5. Most common issue categories."""
    return service.categories(conn, user)


@router.get("/reports/escalated-blocked", response_model=AttentionReport)
def attention_report(conn: DbConnection, user: CurrentUserDep):
    """Q6. What is escalated or blocked, and the stated reason."""
    return service.attention(conn, user)


@router.get("/reports/communication", response_model=CommunicationReport)
def communication_report(
    conn: DbConnection,
    user: CurrentUserDep,
    stale_after_days: int = Query(default=3, ge=1, le=90),
):
    """Q7. Time to first response, and open incidents that have gone quiet.

    An unresolved incident counts as quiet once the incident record itself has
    not been updated for `stale_after_days` days.
    """
    return service.communication(conn, user, stale_after_days=stale_after_days)
