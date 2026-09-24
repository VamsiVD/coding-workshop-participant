-- Rooms, and where each user works.
--
-- A room is modelled as a kind of seat: it sits on a floor, has a name in
-- `code` ("Condor"), and incidents already point at seats, so an incident in
-- a meeting room needs nothing new. `kind` tells desks and rooms apart.
--
-- Users gain an optional workplace (building, floor, desk or room), captured at
-- registration. The same composite keys as incidents keep it consistent: the
-- floor must be in the building and the seat on the floor.
--
-- Every statement is idempotent; migrate.py runs this file on every invocation
-- (see 03_assignment_requests.sql).

ALTER TABLE seats ADD COLUMN IF NOT EXISTS kind varchar(10) NOT NULL DEFAULT 'desk';

-- Constraints have no IF NOT EXISTS, so each is added only when missing.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'seats_kind_valid') THEN
        ALTER TABLE seats ADD CONSTRAINT seats_kind_valid CHECK (kind IN ('desk', 'room'));
    END IF;
END $$;

ALTER TABLE users ADD COLUMN IF NOT EXISTS building_id bigint REFERENCES buildings (id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS floor_id bigint;
ALTER TABLE users ADD COLUMN IF NOT EXISTS seat_id bigint;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_floor_in_building') THEN
        ALTER TABLE users ADD CONSTRAINT users_floor_in_building
            FOREIGN KEY (floor_id, building_id) REFERENCES floors (id, building_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_seat_on_floor') THEN
        ALTER TABLE users ADD CONSTRAINT users_seat_on_floor
            FOREIGN KEY (seat_id, floor_id) REFERENCES seats (id, floor_id);
    END IF;
    -- A composite key is not checked while any of its columns is NULL, so
    -- these make the hierarchy explicit: no floor without a building, no
    -- seat without a floor.
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_floor_needs_building') THEN
        ALTER TABLE users ADD CONSTRAINT users_floor_needs_building
            CHECK (floor_id IS NULL OR building_id IS NOT NULL);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_seat_needs_floor') THEN
        ALTER TABLE users ADD CONSTRAINT users_seat_needs_floor
            CHECK (seat_id IS NULL OR floor_id IS NOT NULL);
    END IF;
END $$;
