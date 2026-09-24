-- BRIN index on incidents.created_at, for the date-range filter on the admin
-- Insights tab (GET /incidents and GET /reports/response-times with
-- created_from / created_to).
--
-- Incidents are only ever inserted with created_at = now(), so the table's
-- physical order follows created_at closely. A BRIN index stores just the
-- min/max timestamp per block range, which makes it a few pages in size
-- however large the table grows, and lets a range scan skip every block
-- outside the window. The B-tree `incidents_created_at_idx` stays: it serves
-- ORDER BY created_at DESC with LIMIT, which BRIN cannot.
--
-- pages_per_range 32 (default 128) trades a slightly larger index for tighter
-- ranges, since a month of incidents fills few pages.
--
-- Idempotent; migrate.py runs this file on every invocation
-- (see 03_assignment_requests.sql).

CREATE INDEX IF NOT EXISTS incidents_created_at_brin_idx
    ON incidents USING brin (created_at) WITH (pages_per_range = 32);
