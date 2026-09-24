"""SQL for the dashboards and reports.

Each function answers one of the seven business questions in the root README.
The queries began as `backend/api/db/smoke.sql` and are the reason several of the
indexes on `incidents` exist.

`scope_clause` is the role restriction the service layer decides. It is
injected as a bound-parameter condition, never as user input.
"""

from datetime import datetime
from typing import Any

from psycopg import Connection


def _where(scope_clause: str | None, extra: list[str] | None = None) -> str:
    """Join the role scope and any fixed extra conditions into one WHERE.

    `extra` holds literal SQL written in this module, never request data;
    values reach it only as bound parameters.
    Returns an empty string when there is nothing to filter on.
    """
    conditions = [
        c for c in ([scope_clause] if scope_clause else []) + (extra or []) if c
    ]
    return f"WHERE {' AND '.join(conditions)}" if conditions else ""


# ---------------------------------------------------------------------------
# Q1. What incidents are open, and what is their status?
# ---------------------------------------------------------------------------


def dashboard_summary(
    conn: Connection, *, scope_clause: str | None, scope_params: dict
) -> dict:
    """Counts by status, priority and assignee in a single pass.

    FILTER aggregates avoid running one query per status, which would be eight
    round trips for one dashboard.

    Returns the headline counts plus `by_status`, `by_priority` and
    `by_assignee` lists. The assignee breakdown covers unresolved work only
    and has one row with a null assignee for the unassigned pile, which is
    why users is LEFT joined.
    """
    where = _where(scope_clause)
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT count(*) AS total,
                   count(*) FILTER (WHERE status = 'open') AS open_count,
                   count(*) FILTER (WHERE status = 'in_progress') AS in_progress_count,
                   count(*) FILTER (WHERE status = 'blocked') AS blocked_count,
                   count(*) FILTER (WHERE status = 'resolved') AS resolved_count,
                   count(*) FILTER (WHERE status = 'closed') AS closed_count,
                   count(*) FILTER (WHERE is_escalated) AS escalated_count,
                   count(*) FILTER (
                       WHERE assignee_id IS NULL
                         AND status NOT IN ('resolved', 'closed')
                   ) AS unassigned_count
            FROM incidents i
            {where}
            """,
            scope_params,
        )
        summary = dict(cur.fetchone())

        cur.execute(
            f"SELECT status, count(*) AS count FROM incidents i {where} GROUP BY status",
            scope_params,
        )
        summary["by_status"] = cur.fetchall()

        cur.execute(
            f"SELECT priority, count(*) AS count FROM incidents i {where} GROUP BY priority",
            scope_params,
        )
        summary["by_priority"] = cur.fetchall()

        cur.execute(
            f"""
            SELECT i.assignee_id, u.full_name AS assignee_name, count(*) AS count
            FROM incidents i
            LEFT JOIN users u ON u.id = i.assignee_id
            {_where(scope_clause, ["i.status NOT IN ('resolved', 'closed')"])}
            GROUP BY i.assignee_id, u.full_name
            ORDER BY count DESC
            """,
            scope_params,
        )
        summary["by_assignee"] = cur.fetchall()

    return summary


# ---------------------------------------------------------------------------
# Q2. Which buildings, floors and seats have recurring issues?
# ---------------------------------------------------------------------------

# GROUP BY column lists for each hotspot level. Each level includes the
# levels above it, so a floor is reported with its building.
_HOTSPOT_GROUPS = {
    "building": "b.id, b.code, b.name",
    "floor": "b.id, b.code, b.name, f.id, f.label",
    "seat": "b.id, b.code, b.name, f.id, f.label, s.id, s.code",
}


def hotspots(
    conn: Connection,
    *,
    group_by: str,
    min_count: int,
    limit: int,
    scope_clause: str | None,
    scope_params: dict,
) -> list[dict]:
    """Locations with at least `min_count` incidents, busiest first.

    `group_by` is "building", "floor" or "seat". Every row has the same
    columns whatever the level: those below the chosen level come back as
    typed NULLs, so the response schema does not change shape. Incidents
    with no floor or seat still count, grouped under a null floor or seat.
    """
    # group_by is looked up in a fixed map, so an arbitrary string cannot
    # reach the GROUP BY clause.
    grouping = _HOTSPOT_GROUPS.get(group_by, _HOTSPOT_GROUPS["seat"])
    select_floor = (
        "f.id AS floor_id, f.label AS floor_label"
        if group_by != "building"
        else "NULL::bigint AS floor_id, NULL::varchar AS floor_label"
    )
    select_seat = (
        "s.id AS seat_id, s.code AS seat_code"
        if group_by == "seat"
        else "NULL::bigint AS seat_id, NULL::varchar AS seat_code"
    )

    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT b.id AS building_id, b.code AS building_code, b.name AS building_name,
                   {select_floor},
                   {select_seat},
                   count(*) AS incident_count,
                   count(*) FILTER (
                       WHERE i.status NOT IN ('resolved', 'closed')
                   ) AS open_count,
                   max(i.created_at) AS last_reported_at
            FROM incidents i
            JOIN buildings b ON b.id = i.building_id
            LEFT JOIN floors f ON f.id = i.floor_id
            LEFT JOIN seats s ON s.id = i.seat_id
            {_where(scope_clause)}
            GROUP BY {grouping}
            HAVING count(*) >= %(min_count)s
            ORDER BY incident_count DESC, building_code
            LIMIT %(limit)s
            """,
            {**scope_params, "min_count": min_count, "limit": limit},
        )
        return cur.fetchall()


# ---------------------------------------------------------------------------
# Q3. How quickly are incidents acknowledged, assigned and resolved?
# ---------------------------------------------------------------------------

# Aggregate columns shared by the overall and per-priority queries, in hours
# to one decimal place. avg() and percentile_cont() skip NULLs, so each
# figure covers only incidents that have reached that stage, while
# sample_size counts every incident in the group.
_TIMES = """
    round(avg(extract(epoch FROM acknowledged_at - created_at)) / 3600.0, 1)
        AS avg_hours_to_acknowledge,
    round(avg(extract(epoch FROM assigned_at - created_at)) / 3600.0, 1)
        AS avg_hours_to_assign,
    round(avg(extract(epoch FROM resolved_at - created_at)) / 3600.0, 1)
        AS avg_hours_to_resolve,
    round(
        (percentile_cont(0.5) WITHIN GROUP (
            ORDER BY extract(epoch FROM resolved_at - created_at)
        ) / 3600.0)::numeric, 1
    ) AS median_hours_to_resolve,
    count(*) AS sample_size
"""


def response_times(
    conn: Connection,
    *,
    scope_clause: str | None,
    scope_params: dict,
    created_from: datetime | None = None,
    created_to: datetime | None = None,
) -> dict:
    """Averages overall and per priority.

    The median is reported alongside the mean because a handful of incidents
    left open for weeks drags an average far from what people experience.

    `created_from` / `created_to` limit the figures to incidents reported in
    that window; the BRIN index on created_at serves the range.
    """
    extra, params = [], dict(scope_params)
    if created_from is not None:
        extra.append("i.created_at >= %(created_from)s")
        params["created_from"] = created_from
    if created_to is not None:
        extra.append("i.created_at <= %(created_to)s")
        params["created_to"] = created_to
    where = _where(scope_clause, extra)
    with conn.cursor() as cur:
        cur.execute(f"SELECT {_TIMES} FROM incidents i {where}", params)
        overall = dict(cur.fetchone())

        cur.execute(
            f"SELECT priority, {_TIMES} FROM incidents i {where} GROUP BY priority",
            params,
        )
        # Nest the timing columns under `times`, leaving priority as the key.
        by_priority = [
            {"priority": row.pop("priority"), "times": row} for row in cur.fetchall()
        ]

    return {"overall": overall, "by_priority": by_priority}


# ---------------------------------------------------------------------------
# Q4. Which engineers are available, and how is work distributed?
# ---------------------------------------------------------------------------


def unassigned_count(conn: Connection) -> int:
    """Unresolved incidents with nobody assigned, across all incidents.

    Not role-scoped: it sits beside the engineer workload table, whose rows
    come from `engineers.workload()` in the engineers repository.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT count(*) AS n FROM incidents
            WHERE assignee_id IS NULL AND status NOT IN ('resolved', 'closed')
            """
        )
        return cur.fetchone()["n"]


# ---------------------------------------------------------------------------
# Q5. What are the most common categories?
# ---------------------------------------------------------------------------


def category_counts(
    conn: Connection, *, scope_clause: str | None, scope_params: dict
) -> list[dict]:
    """Incident totals and unresolved counts per category, most used first.

    Categories with no incidents are left out, since the join is INNER.
    """
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT c.id AS category_id, c.label, c.category_type,
                   count(*) AS incident_count,
                   count(*) FILTER (
                       WHERE i.status NOT IN ('resolved', 'closed')
                   ) AS open_count
            FROM incidents i
            JOIN categories c ON c.id = i.category_id
            {_where(scope_clause)}
            GROUP BY c.id, c.label, c.category_type
            ORDER BY incident_count DESC, c.label
            """,
            scope_params,
        )
        return cur.fetchall()


# ---------------------------------------------------------------------------
# Q6. Which incidents are escalated or blocked, and why?
# ---------------------------------------------------------------------------


def attention_required(
    conn: Connection, *, scope_clause: str | None, scope_params: dict
) -> dict[str, list[dict]]:
    """Blocked and escalated incidents, each with the stated reason.

    The reason is guaranteed to exist by the CHECK constraints on the table,
    so this report cannot have a blank "why" column.

    Both lists are ordered by `days_in_state`, which is time since the last
    update of any kind, so it approximates rather than measures how long the
    incident has been blocked or escalated.
    """
    # `%(reason_column)s` is not a bound parameter: str.replace() swaps it
    # for one of two fixed column names below before the query runs, so the
    # same SELECT serves both lists.
    base = """
        SELECT i.id, i.title, i.status, i.priority, i.escalation_status,
               %(reason_column)s AS reason,
               u.full_name AS assignee_name,
               round(extract(epoch FROM now() - i.updated_at) / 86400.0, 1)
                   AS days_in_state,
               i.created_at
        FROM incidents i
        LEFT JOIN users u ON u.id = i.assignee_id
    """
    with conn.cursor() as cur:
        cur.execute(
            f"""
            {base.replace("%(reason_column)s", "i.blocked_reason")}
            {_where(scope_clause, ["i.status = 'blocked'"])}
            ORDER BY days_in_state DESC
            """,
            scope_params,
        )
        blocked = cur.fetchall()

        cur.execute(
            f"""
            {base.replace("%(reason_column)s", "i.escalation_reason")}
            {_where(scope_clause, ["i.escalation_status <> 'not_requested'"])}
            ORDER BY days_in_state DESC
            """,
            scope_params,
        )
        escalated = cur.fetchall()

    return {"blocked": blocked, "escalated": escalated}


# ---------------------------------------------------------------------------
# Q7. How well are reporters kept informed?
# ---------------------------------------------------------------------------


def communication(
    conn: Connection,
    *,
    stale_after_days: int,
    scope_clause: str | None,
    scope_params: dict,
) -> dict[str, Any]:
    """Time to the first note, and open incidents that have gone quiet.

    Staleness is measured against `incidents.updated_at`, which a trigger
    maintains, rather than by aggregating the audit trail. That keeps the
    query off a table that grows with every change.
    """
    where = _where(scope_clause)
    with conn.cursor() as cur:
        # The inner query finds each visible incident's first note time;
        # incidents without notes have a NULL there, which avg() ignores and
        # the FILTER count picks up.
        cur.execute(
            f"""
            SELECT round(avg(extract(epoch FROM first_note - created_at)) / 3600.0, 1)
                       AS avg_hours_to_first_note,
                   count(*) FILTER (WHERE first_note IS NULL) AS incidents_without_notes
            FROM (
                SELECT i.created_at,
                       (SELECT min(n.created_at) FROM incident_notes n
                        WHERE n.incident_id = i.id) AS first_note
                FROM incidents i
                {where}
            ) AS t
            """,
            scope_params,
        )
        summary = dict(cur.fetchone())

        # Unresolved incidents untouched for `stale_after_days`, oldest update
        # first and capped at 100. The day count is a bound parameter.
        cur.execute(
            f"""
            SELECT i.id, i.title, i.status,
                   u.full_name AS assignee_name,
                   round(extract(epoch FROM now() - i.updated_at) / 86400.0, 1)
                       AS days_since_last_update,
                   EXISTS (
                       SELECT 1 FROM incident_notes n WHERE n.incident_id = i.id
                   ) AS has_notes
            FROM incidents i
            LEFT JOIN users u ON u.id = i.assignee_id
            {
                _where(
                    scope_clause,
                    [
                        "i.status NOT IN ('resolved', 'closed')",
                        "i.updated_at < now() - make_interval(days => %(stale_days)s)",
                    ],
                )
            }
            ORDER BY days_since_last_update DESC
            LIMIT 100
            """,
            {**scope_params, "stale_days": stale_after_days},
        )
        summary["stale_incidents"] = cur.fetchall()

    summary["stale_after_days"] = stale_after_days
    return summary
