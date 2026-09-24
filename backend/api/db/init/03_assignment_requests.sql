-- Engineers asking to be given an open, unassigned incident ("Request this
-- job" on the engineer workbench). An administrator confirms by assigning the
-- incident, or declines the request.
--
-- A request is pending for as long as its row exists: withdrawing, declining
-- or assigning the incident deletes it, so there is no status column.
--
-- Every statement is idempotent. On a fresh local database Docker runs this
-- after 01 and 02; migrate.py also runs it on every invocation, which is how
-- databases created before this file existed (Aurora) receive the table.

CREATE TABLE IF NOT EXISTS incident_assignment_requests (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    incident_id bigint NOT NULL REFERENCES incidents (id) ON DELETE CASCADE,
    -- Referencing the profile, not users, means only an engineer can ask.
    engineer_id bigint NOT NULL
                REFERENCES engineer_profiles (user_id) ON DELETE CASCADE,
    note        text CHECK (note IS NULL OR length(note) <= 500),
    created_at  timestamptz NOT NULL DEFAULT now(),
    -- One pending request per engineer per incident; asking again updates it.
    UNIQUE (incident_id, engineer_id)
);

-- "Which jobs have I asked for?", read on every load of the workbench.
CREATE INDEX IF NOT EXISTS incident_assignment_requests_engineer_idx
    ON incident_assignment_requests (engineer_id);
