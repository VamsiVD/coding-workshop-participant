-- Smoke test: the seven business questions from the README, run straight
-- against the seeded database. Each query is the shape the matching
-- /reports endpoint will serve.
--
--   docker compose exec -T postgres psql -U acme -d acme_incidents < backend/db/smoke.sql

\echo '== Q1. Open incidents and their status =='
SELECT status, count(*) AS incidents
FROM incidents
WHERE status <> 'closed'
GROUP BY status
ORDER BY status;

\echo ''
\echo '== Q2. Hotspots: locations with recurring issues =='
SELECT b.code AS building, f.label AS floor, s.code AS seat, count(*) AS incidents
FROM incidents i
JOIN buildings b ON b.id = i.building_id
LEFT JOIN floors f ON f.id = i.floor_id
LEFT JOIN seats s ON s.id = i.seat_id
GROUP BY b.code, f.label, s.code
HAVING count(*) > 1
ORDER BY incidents DESC, building;

\echo ''
\echo '== Q3. Response times: acknowledge, assign, resolve =='
SELECT
    round(avg(extract(epoch FROM acknowledged_at - created_at)) / 3600.0, 1) AS avg_hours_to_acknowledge,
    round(avg(extract(epoch FROM assigned_at     - created_at)) / 3600.0, 1) AS avg_hours_to_assign,
    round(avg(extract(epoch FROM resolved_at     - created_at)) / 3600.0, 1) AS avg_hours_to_resolve
FROM incidents;

\echo ''
\echo '== Q4. Engineer availability and workload =='
SELECT u.full_name AS engineer,
       c.label AS specialization,
       ep.is_available,
       ep.max_active_tickets,
       count(i.id) FILTER (WHERE i.status IN ('open', 'in_progress', 'blocked')) AS active_tickets
FROM engineer_profiles ep
JOIN users u ON u.id = ep.user_id
LEFT JOIN categories c ON c.id = ep.specialization_id
LEFT JOIN incidents i ON i.assignee_id = ep.user_id
GROUP BY u.full_name, c.label, ep.is_available, ep.max_active_tickets
ORDER BY active_tickets DESC, engineer;

\echo ''
\echo '== Q5. Most common categories =='
SELECT c.label AS category, c.category_type, count(*) AS incidents
FROM incidents i
JOIN categories c ON c.id = i.category_id
GROUP BY c.label, c.category_type
ORDER BY incidents DESC, category
LIMIT 10;

\echo ''
\echo '== Q6. Escalated or blocked, and why =='
SELECT i.id,
       i.title,
       i.status,
       i.escalation_status,
       coalesce(i.blocked_reason, i.escalation_reason) AS reason
FROM incidents i
WHERE i.status = 'blocked' OR i.escalation_status <> 'not_requested'
ORDER BY i.status, i.id;

\echo ''
\echo '== Q7a. Time to the first note after the incident was created =='
SELECT i.id,
       i.title,
       round(extract(epoch FROM min(n.created_at) - i.created_at) / 3600.0, 1) AS hours_to_first_note
FROM incidents i
LEFT JOIN incident_notes n ON n.incident_id = i.id
GROUP BY i.id, i.title, i.created_at
ORDER BY hours_to_first_note NULLS FIRST, i.id;

\echo ''
\echo '== Q7b. Open incidents with no update in the last 3 days =='
SELECT i.id, i.title, i.status,
       round(extract(epoch FROM now() - greatest(
           i.created_at,
           coalesce((SELECT max(created_at) FROM incident_events e WHERE e.incident_id = i.id), i.created_at)
       )) / 86400.0, 1) AS days_since_last_update
FROM incidents i
WHERE i.status NOT IN ('resolved', 'closed')
  AND greatest(
        i.created_at,
        coalesce((SELECT max(created_at) FROM incident_events e WHERE e.incident_id = i.id), i.created_at)
      ) < now() - interval '3 days'
ORDER BY days_since_last_update DESC;
