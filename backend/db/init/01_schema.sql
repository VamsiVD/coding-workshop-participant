-- ACME Facility Incident Management - schema
-- Runs once, automatically, on first start of an empty postgres volume.
-- Source of truth: backend/db/schema.dbml

BEGIN;

CREATE EXTENSION IF NOT EXISTS citext;   -- case-insensitive, unique email
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- ILIKE search indexes

-- ---------------------------------------------------------------------------
-- Enumerated types
-- ---------------------------------------------------------------------------

CREATE TYPE user_role AS ENUM ('employee', 'admin', 'engineer');

CREATE TYPE incident_status AS ENUM (
    'open', 'in_progress', 'blocked', 'resolved', 'closed'
);

CREATE TYPE incident_priority AS ENUM ('low', 'medium', 'high', 'critical');

CREATE TYPE category_type AS ENUM ('facility', 'technology');

CREATE TYPE escalation_state AS ENUM (
    'not_requested', 'requested', 'approved', 'rejected'
);

CREATE TYPE incident_event_type AS ENUM (
    'created', 'updated', 'assigned', 'status_changed', 'priority_changed',
    'escalation_requested', 'escalation_decided', 'note_added'
);

-- ---------------------------------------------------------------------------
-- Shared trigger: keep updated_at honest
-- ---------------------------------------------------------------------------

CREATE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------

CREATE TABLE users (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    -- citext makes the unique index case-insensitive, so Asha@acme.inc and
    -- asha@acme.inc cannot both exist.
    email         citext NOT NULL UNIQUE,
    password_hash varchar(255) NOT NULL,
    full_name     varchar(120) NOT NULL,
    role          user_role NOT NULL DEFAULT 'employee',
    is_active     boolean NOT NULL DEFAULT true,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),

    -- Self-registration is restricted to company addresses (README).
    CONSTRAINT users_email_domain CHECK (email ~ '^[^@[:space:]]+@acme\.inc$'),
    CONSTRAINT users_full_name_len CHECK (char_length(full_name) >= 1),
    -- A plaintext password must not be storable, even if the API is bypassed.
    CONSTRAINT users_password_hashed CHECK (password_hash ~ '^\$(2[aby]\$|argon2)')
);

CREATE INDEX users_role_idx ON users (role) WHERE is_active;

CREATE TRIGGER users_set_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------

CREATE TABLE categories (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    label         varchar(80) NOT NULL UNIQUE,
    category_type category_type NOT NULL,
    is_active     boolean NOT NULL DEFAULT true
);

-- ---------------------------------------------------------------------------
-- engineer_profiles
-- ---------------------------------------------------------------------------

CREATE TABLE engineer_profiles (
    user_id            bigint PRIMARY KEY
                       REFERENCES users (id) ON DELETE CASCADE,
    specialization_id  bigint REFERENCES categories (id) ON DELETE SET NULL,
    is_available       boolean NOT NULL DEFAULT true,
    max_active_tickets integer NOT NULL DEFAULT 5,
    phone              varchar(40),
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT engineer_profiles_capacity CHECK (max_active_tickets > 0)
);

CREATE INDEX engineer_profiles_specialization_idx
    ON engineer_profiles (specialization_id) WHERE is_available;

CREATE TRIGGER engineer_profiles_set_updated_at
    BEFORE UPDATE ON engineer_profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Facilities: building -> floor -> seat
-- ---------------------------------------------------------------------------

CREATE TABLE buildings (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name       varchar(120) NOT NULL UNIQUE,
    code       varchar(20) NOT NULL UNIQUE,
    address    varchar(255),
    is_active  boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE floors (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    building_id bigint NOT NULL REFERENCES buildings (id) ON DELETE RESTRICT,
    level       integer NOT NULL,
    label       varchar(60),
    created_at  timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT floors_unique_level UNIQUE (building_id, level),
    -- Lets incidents prove a floor really is in the named building.
    CONSTRAINT floors_id_building_key UNIQUE (id, building_id)
);

CREATE TABLE seats (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    floor_id   bigint NOT NULL REFERENCES floors (id) ON DELETE RESTRICT,
    code       varchar(40) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT seats_unique_code UNIQUE (floor_id, code),
    -- Lets incidents prove a seat really is on the named floor.
    CONSTRAINT seats_id_floor_key UNIQUE (id, floor_id)
);

-- ---------------------------------------------------------------------------
-- incidents
-- ---------------------------------------------------------------------------

CREATE TABLE incidents (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title       varchar(160) NOT NULL,
    description text NOT NULL,
    category_id bigint NOT NULL REFERENCES categories (id) ON DELETE RESTRICT,
    priority    incident_priority NOT NULL DEFAULT 'medium',
    status      incident_status NOT NULL DEFAULT 'open',

    building_id bigint NOT NULL REFERENCES buildings (id) ON DELETE RESTRICT,
    floor_id    bigint REFERENCES floors (id) ON DELETE RESTRICT,
    seat_id     bigint REFERENCES seats (id) ON DELETE RESTRICT,

    reporter_id bigint NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    -- Points at engineer_profiles, not users: only a user who has an engineer
    -- profile can hold a ticket, and the database enforces that.
    assignee_id bigint REFERENCES engineer_profiles (user_id) ON DELETE SET NULL,

    escalation_status escalation_state NOT NULL DEFAULT 'not_requested',
    -- Derived from escalation_status so the flag can never drift out of sync.
    is_escalated      boolean GENERATED ALWAYS AS
                      (escalation_status = 'approved') STORED,
    escalation_reason text,
    blocked_reason    text,
    duplicate_of_id   bigint REFERENCES incidents (id) ON DELETE SET NULL,

    created_at      timestamptz NOT NULL DEFAULT now(),
    assigned_at     timestamptz,
    acknowledged_at timestamptz,
    resolved_at     timestamptz,
    closed_at       timestamptz,
    updated_at      timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT incidents_title_len CHECK (char_length(title) BETWEEN 3 AND 160),
    CONSTRAINT incidents_description_len CHECK (char_length(description) BETWEEN 3 AND 5000),
    -- "Which incidents are blocked and why" needs the reason to exist.
    CONSTRAINT incidents_blocked_has_reason CHECK (
        status <> 'blocked' OR blocked_reason IS NOT NULL
    ),
    CONSTRAINT incidents_escalation_has_reason CHECK (
        escalation_status = 'not_requested' OR escalation_reason IS NOT NULL
    ),
    -- A seat cannot be given without the floor it sits on.
    CONSTRAINT incidents_seat_needs_floor CHECK (
        seat_id IS NULL OR floor_id IS NOT NULL
    ),
    CONSTRAINT incidents_not_own_duplicate CHECK (duplicate_of_id <> id)
);

-- Location integrity. DBML cannot express these: they stop an incident from
-- naming a floor that is in another building, or a seat on another floor.
ALTER TABLE incidents ADD CONSTRAINT incidents_floor_in_building
    FOREIGN KEY (floor_id, building_id) REFERENCES floors (id, building_id);
ALTER TABLE incidents ADD CONSTRAINT incidents_seat_on_floor
    FOREIGN KEY (seat_id, floor_id) REFERENCES seats (id, floor_id);

-- Indexes follow the dashboard and report queries, not every column.
CREATE INDEX incidents_status_idx ON incidents (status);
CREATE INDEX incidents_priority_idx ON incidents (priority);
CREATE INDEX incidents_category_idx ON incidents (category_id);
CREATE INDEX incidents_reporter_idx ON incidents (reporter_id);
CREATE INDEX incidents_assignee_status_idx ON incidents (assignee_id, status);
CREATE INDEX incidents_location_idx ON incidents (building_id, floor_id, seat_id);
CREATE INDEX incidents_created_at_idx ON incidents (created_at DESC);
-- Free-text search over title and description (README: search and filter).
CREATE INDEX incidents_title_trgm_idx ON incidents USING gin (title gin_trgm_ops);
CREATE INDEX incidents_description_trgm_idx ON incidents USING gin (description gin_trgm_ops);

CREATE TRIGGER incidents_set_updated_at
    BEFORE UPDATE ON incidents
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- incident_notes
-- ---------------------------------------------------------------------------

CREATE TABLE incident_notes (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    incident_id bigint NOT NULL REFERENCES incidents (id) ON DELETE CASCADE,
    author_id   bigint NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    body        text NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT incident_notes_body_len CHECK (char_length(body) BETWEEN 1 AND 5000)
);

CREATE INDEX incident_notes_incident_idx ON incident_notes (incident_id, created_at);

CREATE TRIGGER incident_notes_set_updated_at
    BEFORE UPDATE ON incident_notes
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- incident_events - append-only audit trail
-- ---------------------------------------------------------------------------

CREATE TABLE incident_events (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    incident_id bigint NOT NULL REFERENCES incidents (id) ON DELETE CASCADE,
    actor_id    bigint REFERENCES users (id) ON DELETE SET NULL,
    event_type  incident_event_type NOT NULL,
    from_value  varchar(80),
    to_value    varchar(80),
    reason      text,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX incident_events_incident_idx ON incident_events (incident_id, created_at);
CREATE INDEX incident_events_type_idx ON incident_events (event_type);

COMMIT;
