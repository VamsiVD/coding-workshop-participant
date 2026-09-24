-- Bulk dummy data for development: enough volume to exercise pagination,
-- filters, search and the dashboards. Run on top of init/02_seed.sql.
--
--   docker compose exec -T postgres psql -U acme -d acme_incidents -q < backend/api/db/seed_dummy.sql
--
-- Running it twice adds another batch. To start clean:
--   docker compose down -v && docker compose up -d

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Same seed every run, so bug reports are reproducible.
SELECT setseed(0.42);

-- ---------------------------------------------------------------------------
-- More people: 18 employees, 4 engineers
-- ---------------------------------------------------------------------------

WITH names AS (
    SELECT * FROM (VALUES
        ('Ravi Menon'), ('Elena Duarte'), ('Kwame Boateng'), ('Sofia Lindqvist'),
        ('Hiroshi Kato'), ('Amara Diallo'), ('Ben Kowalski'), ('Nadia Haddad'),
        ('Oscar Reyes'), ('Yuki Nakamura'), ('Freya Olsen'), ('Ibrahim Sesay'),
        ('Clara Bianchi'), ('Dmitri Volkov'), ('Grace Mwangi'), ('Liam Doherty'),
        ('Zara Khan'), ('Pedro Alves')
    ) AS t(full_name)
)
INSERT INTO users (email, password_hash, full_name, role)
SELECT
    lower(split_part(full_name, ' ', 1)) || '.' ||
        lower(split_part(full_name, ' ', 2)) || '@acme.inc',
    crypt('Passw0rd!', gen_salt('bf', 8)),
    full_name,
    'employee'
FROM names;

INSERT INTO users (email, password_hash, full_name, role)
SELECT e.email, crypt('Passw0rd!', gen_salt('bf', 8)), e.full_name, 'engineer'
FROM (VALUES
    ('eng.plumb@acme.inc', 'Nina Petrova'),
    ('eng.net@acme.inc',   'Omar Farouk'),
    ('eng.clean@acme.inc', 'Rosa Delgado'),
    ('eng.av@acme.inc',    'Jonas Berg')
) AS e(email, full_name);

INSERT INTO engineer_profiles (user_id, specialization_id, is_available, max_active_tickets, phone)
SELECT u.id, c.id, e.is_available, e.capacity, e.phone
FROM (VALUES
    ('eng.plumb@acme.inc', 'Plumbing',        true,  6, '+1-555-0104'),
    ('eng.net@acme.inc',   'Wi-Fi',           true, 10, '+1-555-0105'),
    ('eng.clean@acme.inc', 'Cleaning',        true,  9, '+1-555-0106'),
    ('eng.av@acme.inc',    'Meeting Room AV', false, 4, '+1-555-0107')
) AS e(email, specialization, is_available, capacity, phone)
JOIN users u ON u.email = e.email
JOIN categories c ON c.label = e.specialization;

-- ---------------------------------------------------------------------------
-- Incident templates: realistic title/description per category
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE templates ON COMMIT DROP AS
SELECT c.id AS category_id, t.title, t.description
FROM (VALUES
    ('HVAC', 'Office far too warm', 'Temperature has been above 27C since Monday and the vents blow warm air.'),
    ('HVAC', 'Air conditioning unit dripping', 'Water is dripping from the ceiling unit onto the desk below.'),
    ('HVAC', 'No airflow from the vents', 'The vents in this area produce no airflow at all, at any fan setting.'),
    ('Lighting', 'Light panel completely dead', 'The panel overhead does not come on and the area is too dark to work in.'),
    ('Lighting', 'Motion sensor lights cut out', 'Lights switch off every few minutes even while people are seated here.'),
    ('Lighting', 'Emergency exit sign unlit', 'The illuminated exit sign near the stairwell is out.'),
    ('Plumbing', 'Toilet will not flush', 'One cubicle in the washroom does not flush and has been out all week.'),
    ('Plumbing', 'Blocked sink in the kitchen', 'Water drains very slowly and backs up when the tap runs.'),
    ('Plumbing', 'No hot water at the basin', 'Only cold water comes out of the hot tap in the washroom.'),
    ('Furniture', 'Desk height adjustment stuck', 'The sit-stand desk motor buzzes but the desk does not move.'),
    ('Furniture', 'Chair armrest snapped off', 'The left armrest has broken away from the frame and is unsafe.'),
    ('Furniture', 'Wobbly meeting table', 'The table rocks badly, one leg looks loose at the bracket.'),
    ('Cleaning', 'Bins not emptied for days', 'The bins in this area have not been emptied since the start of the week.'),
    ('Cleaning', 'Spill in the walkway', 'A drink has been spilled in the main walkway and is a slip hazard.'),
    ('Cleaning', 'Kitchen left in poor state', 'Sink is full and worktops have not been wiped down.'),
    ('Access Control', 'Badge reader rejects valid pass', 'My badge works on other doors but is rejected at this entrance.'),
    ('Access Control', 'Door fails to latch', 'The door does not close fully and the lock never engages.'),
    ('Wi-Fi', 'Cannot join the staff network', 'Authentication fails repeatedly on the staff SSID from this desk.'),
    ('Wi-Fi', 'Very slow wireless in this area', 'Throughput is under 2 Mbps here while the wired network is fine.'),
    ('Wi-Fi', 'Wireless drops during calls', 'Connection drops for around 30 seconds several times per meeting.'),
    ('Laptop', 'Laptop will not charge', 'The charger is seated correctly but the battery keeps discharging.'),
    ('Laptop', 'Docking station not detected', 'External monitors stay blank when the laptop is docked.'),
    ('Laptop', 'Keyboard keys unresponsive', 'Several keys need to be pressed hard before they register.'),
    ('Printer', 'Printer offline all morning', 'The shared printer shows offline on every machine in this area.'),
    ('Printer', 'Poor print quality', 'Every page comes out with vertical streaks across the text.'),
    ('Printer', 'Paper tray will not feed', 'The tray is loaded correctly but the printer reports it is empty.'),
    ('Meeting Room AV', 'No sound from the room speakers', 'Video plays but there is no audio through the room system.'),
    ('Meeting Room AV', 'Camera not detected in calls', 'The room camera does not appear as an option in the meeting client.'),
    ('Meeting Room AV', 'Screen share fails to start', 'Sharing from a laptop in this room times out every time.')
) AS t(category_label, title, description)
JOIN categories c ON c.label = t.category_label;

-- ---------------------------------------------------------------------------
-- 220 incidents spread over the last 120 days
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE new_incidents ON COMMIT DROP AS
WITH employees AS (
    SELECT id, row_number() OVER (ORDER BY id) - 1 AS rn, count(*) OVER () AS n
    FROM users WHERE role = 'employee'
),
engineers AS (
    SELECT ep.user_id AS id, row_number() OVER (ORDER BY ep.user_id) - 1 AS rn,
           count(*) OVER () AS n
    FROM engineer_profiles ep
),
raw AS (
    SELECT
        g,
        r.*,
        -- Weighted status: closed 32%, resolved 18%, open 22%, in_progress 18%, blocked 10%
        CASE
            WHEN r.r_status < 0.32 THEN 'closed'
            WHEN r.r_status < 0.50 THEN 'resolved'
            WHEN r.r_status < 0.72 THEN 'open'
            WHEN r.r_status < 0.90 THEN 'in_progress'
            ELSE 'blocked'
        END::incident_status AS status,
        CASE
            WHEN r.r_priority < 0.20 THEN 'low'
            WHEN r.r_priority < 0.60 THEN 'medium'
            WHEN r.r_priority < 0.88 THEN 'high'
            ELSE 'critical'
        END::incident_priority AS priority,
        CASE
            WHEN r.r_esc < 0.80 THEN 'not_requested'
            WHEN r.r_esc < 0.90 THEN 'requested'
            WHEN r.r_esc < 0.96 THEN 'approved'
            ELSE 'rejected'
        END::escalation_state AS escalation_status,
        now() - (r.r_age * 120 || ' days')::interval AS created_at
    FROM generate_series(1, 220) AS g
    -- Values are hashed from g rather than drawn with random(). An
    -- uncorrelated LATERAL is evaluated once and its result reused for every
    -- row, which collapses the whole batch into one bucket; hashing g forces a
    -- fresh value per row and keeps the data reproducible.
    CROSS JOIN LATERAL (
        SELECT
            (abs(hashtextextended(g::text,  1)) % 100000) / 100000.0 AS r_status,
            (abs(hashtextextended(g::text,  2)) % 100000) / 100000.0 AS r_priority,
            (abs(hashtextextended(g::text,  3)) % 100000) / 100000.0 AS r_esc,
            (abs(hashtextextended(g::text,  4)) % 100000) / 100000.0 AS r_age,
            (abs(hashtextextended(g::text,  5)) % 100000) / 100000.0 AS r_assign,
            (abs(hashtextextended(g::text,  6)) % 100000) / 100000.0 AS r_ack,
            (abs(hashtextextended(g::text,  7)) % 100000) / 100000.0 AS r_res,
            (abs(hashtextextended(g::text,  8)) % 100000) / 100000.0 AS r_close,
            (abs(hashtextextended(g::text,  9)) % 100000) / 100000.0 AS r_notes,
            (abs(hashtextextended(g::text, 10)) % 100000) / 100000.0 AS r_seat,
            (abs(hashtextextended(g::text, 11)) % 100000) / 100000.0 AS r_tpl,
            (abs(hashtextextended(g::text, 12)) % 100000) / 100000.0 AS r_rep,
            (abs(hashtextextended(g::text, 13)) % 100000) / 100000.0 AS r_eng
    ) AS r
),
placed AS (
    SELECT
        raw.*,
        loc.seat_id, loc.floor_id, loc.building_id,
        tpl.category_id, tpl.title, tpl.description,
        rep.id AS reporter_id,
        CASE WHEN raw.status = 'open' THEN NULL ELSE eng.id END AS assignee_id
    FROM raw
    -- Deriving floor and building from the chosen seat keeps the composite
    -- foreign keys satisfied by construction.
    CROSS JOIN LATERAL (
        SELECT s.id AS seat_id, s.floor_id, f.building_id
        FROM seats s
        JOIN floors f ON f.id = s.floor_id
        ORDER BY s.id
        OFFSET floor(raw.r_seat * (SELECT count(*) FROM seats))
        LIMIT 1
    ) AS loc
    CROSS JOIN LATERAL (
        SELECT * FROM templates
        ORDER BY category_id, title
        OFFSET floor(raw.r_tpl * (SELECT count(*) FROM templates))
        LIMIT 1
    ) AS tpl
    CROSS JOIN LATERAL (
        SELECT id FROM employees WHERE rn = floor(raw.r_rep * employees.n) LIMIT 1
    ) AS rep
    CROSS JOIN LATERAL (
        SELECT id FROM engineers WHERE rn = floor(raw.r_eng * engineers.n) LIMIT 1
    ) AS eng
),
timed AS (
    SELECT
        p.*,
        CASE WHEN p.assignee_id IS NULL THEN NULL
             ELSE p.created_at + (p.r_assign * 36 || ' hours')::interval
        END AS assigned_at
    FROM placed p
),
timed2 AS (
    SELECT
        t.*,
        CASE WHEN t.assigned_at IS NULL THEN NULL
             ELSE t.assigned_at + (t.r_ack * 12 || ' hours')::interval
        END AS acknowledged_at
    FROM timed t
),
timed3 AS (
    SELECT
        t.*,
        CASE WHEN t.status IN ('resolved', 'closed')
             THEN t.acknowledged_at + (t.r_res * 96 + 2 || ' hours')::interval
        END AS resolved_at
    FROM timed2 t
),
inserted AS (
INSERT INTO incidents (
    title, description, category_id, priority, status,
    building_id, floor_id, seat_id, reporter_id, assignee_id,
    escalation_status, escalation_reason, blocked_reason,
    created_at, assigned_at, acknowledged_at, resolved_at, closed_at
)
SELECT
    t.title,
    t.description,
    t.category_id,
    t.priority,
    t.status,
    t.building_id, t.floor_id, t.seat_id,
    t.reporter_id, t.assignee_id,
    t.escalation_status,
    CASE WHEN t.escalation_status <> 'not_requested' THEN
        (ARRAY[
            'Blocking a client meeting scheduled this week.',
            'Third time this has been reported for the same location.',
            'Health and safety concern raised by the floor warden.',
            'Whole team on this floor is affected.'
        ])[1 + floor(t.r_notes * 4)::int]
    END,
    CASE WHEN t.status = 'blocked' THEN
        (ARRAY[
            'Waiting on a replacement part from the vendor.',
            'Requires a contractor visit; earliest slot is next week.',
            'Blocked pending budget approval for the replacement.',
            'Access to the plant room is restricted until the weekend.'
        ])[1 + floor(t.r_close * 4)::int]
    END,
    t.created_at,
    t.assigned_at,
    t.acknowledged_at,
    t.resolved_at,
    CASE WHEN t.status = 'closed'
         THEN t.resolved_at + (t.r_close * 72 + 1 || ' hours')::interval
    END
FROM timed3 t
RETURNING id, reporter_id, assignee_id, status, escalation_status, blocked_reason,
          escalation_reason, created_at, assigned_at, acknowledged_at,
          resolved_at, closed_at
)
SELECT * FROM inserted;

-- ---------------------------------------------------------------------------
-- Notes on roughly two thirds of the assigned incidents
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE new_notes ON COMMIT DROP AS
WITH inserted AS (
INSERT INTO incident_notes (incident_id, author_id, body, created_at)
SELECT
    i.id,
    i.assignee_id,
    (ARRAY[
        'Logged and triaged. I will take a look this afternoon.',
        'Attended site and confirmed the fault. Parts ordered.',
        'Temporary workaround in place while we wait on the permanent fix.',
        'Could not reproduce on site - please let me know when it next happens.',
        'Fixed and tested. Let me know if it recurs.'
    ])[1 + floor(random() * 5)::int],
    i.assigned_at + interval '2 hours'
FROM new_incidents i
WHERE i.assignee_id IS NOT NULL AND random() < 0.66
RETURNING incident_id, author_id, created_at
)
SELECT * FROM inserted;

INSERT INTO incident_notes (incident_id, author_id, body, created_at)
SELECT
    n.incident_id,
    i.reporter_id,
    (ARRAY[
        'Thanks for the quick response.',
        'Still happening this morning, unfortunately.',
        'Confirmed working now - appreciate the help.',
        'Any update on this one?'
    ])[1 + floor(random() * 4)::int],
    n.created_at + interval '6 hours'
FROM new_notes n
JOIN new_incidents i ON i.id = n.incident_id
WHERE random() < 0.5;

-- ---------------------------------------------------------------------------
-- Audit trail for the generated incidents
-- ---------------------------------------------------------------------------

INSERT INTO incident_events (incident_id, actor_id, event_type, from_value, to_value, reason, created_at)
SELECT id, reporter_id, 'created', NULL, 'open', NULL, created_at FROM new_incidents;

INSERT INTO incident_events (incident_id, actor_id, event_type, from_value, to_value, reason, created_at)
SELECT i.id, (SELECT id FROM users WHERE email = 'admin@acme.inc'),
       'assigned', NULL, u.full_name, NULL, i.assigned_at
FROM new_incidents i
JOIN users u ON u.id = i.assignee_id
WHERE i.assigned_at IS NOT NULL;

INSERT INTO incident_events (incident_id, actor_id, event_type, from_value, to_value, reason, created_at)
SELECT id, assignee_id, 'status_changed', 'open', 'in_progress', 'Work started', acknowledged_at
FROM new_incidents WHERE acknowledged_at IS NOT NULL;

INSERT INTO incident_events (incident_id, actor_id, event_type, from_value, to_value, reason, created_at)
SELECT id, assignee_id, 'status_changed', 'in_progress', 'blocked', blocked_reason,
       acknowledged_at + interval '6 hours'
FROM new_incidents WHERE status = 'blocked';

INSERT INTO incident_events (incident_id, actor_id, event_type, from_value, to_value, reason, created_at)
SELECT id, assignee_id, 'status_changed', 'in_progress', 'resolved', 'Work completed', resolved_at
FROM new_incidents WHERE resolved_at IS NOT NULL;

INSERT INTO incident_events (incident_id, actor_id, event_type, from_value, to_value, reason, created_at)
SELECT id, reporter_id, 'status_changed', 'resolved', 'closed', 'Confirmed by reporter', closed_at
FROM new_incidents WHERE closed_at IS NOT NULL;

INSERT INTO incident_events (incident_id, actor_id, event_type, from_value, to_value, reason, created_at)
SELECT id, reporter_id, 'escalation_requested', 'not_requested', 'requested',
       escalation_reason, created_at + interval '2 hours'
FROM new_incidents WHERE escalation_status <> 'not_requested';

INSERT INTO incident_events (incident_id, actor_id, event_type, from_value, to_value, reason, created_at)
SELECT id, (SELECT id FROM users WHERE email = 'admin@acme.inc'),
       'escalation_decided', 'requested', escalation_status::text,
       NULL, created_at + interval '8 hours'
FROM new_incidents WHERE escalation_status IN ('approved', 'rejected');

INSERT INTO incident_events (incident_id, actor_id, event_type, from_value, to_value, reason, created_at)
SELECT n.incident_id, n.author_id, 'note_added', NULL, NULL, NULL, n.created_at
FROM incident_notes n
JOIN new_incidents i ON i.id = n.incident_id;

-- ---------------------------------------------------------------------------
-- A handful of closed-as-duplicate links, for the similar-incidents feature
-- ---------------------------------------------------------------------------

UPDATE incidents dup
SET duplicate_of_id = orig.id
FROM (
    SELECT DISTINCT ON (seat_id, category_id) id, seat_id, category_id
    FROM incidents
    WHERE status = 'closed'
    ORDER BY seat_id, category_id, created_at
) AS orig
WHERE dup.status = 'closed'
  AND dup.seat_id = orig.seat_id
  AND dup.category_id = orig.category_id
  AND dup.id <> orig.id
  AND dup.duplicate_of_id IS NULL;

COMMIT;

ANALYZE;
