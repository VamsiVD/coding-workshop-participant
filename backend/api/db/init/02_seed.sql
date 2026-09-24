-- Development seed data. Local testing only - never load this into production.
-- Every seeded account uses the password: Passw0rd!
-- pgcrypto generates real bcrypt hashes here, so passlib/bcrypt in the API can
-- verify them. The extension is created by this dev-only script, not by the
-- schema, so production does not carry it.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------

INSERT INTO users (email, password_hash, full_name, role) VALUES
    ('admin@acme.inc',      crypt('Passw0rd!', gen_salt('bf', 12)), 'Dana Okafor',   'admin'),
    ('facilities@acme.inc', crypt('Passw0rd!', gen_salt('bf', 12)), 'Priya Raman',   'admin'),
    ('eng.hvac@acme.inc',   crypt('Passw0rd!', gen_salt('bf', 12)), 'Marco Silva',   'engineer'),
    ('eng.it@acme.inc',     crypt('Passw0rd!', gen_salt('bf', 12)), 'Lena Fischer',  'engineer'),
    ('eng.elec@acme.inc',   crypt('Passw0rd!', gen_salt('bf', 12)), 'Sam Whitfield', 'engineer'),
    ('asha@acme.inc',       crypt('Passw0rd!', gen_salt('bf', 12)), 'Asha Nair',     'employee'),
    ('tom@acme.inc',        crypt('Passw0rd!', gen_salt('bf', 12)), 'Tom Becker',    'employee'),
    ('mei@acme.inc',        crypt('Passw0rd!', gen_salt('bf', 12)), 'Mei Tanaka',    'employee');

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------

INSERT INTO categories (label, category_type) VALUES
    ('HVAC',            'facility'),
    ('Lighting',        'facility'),
    ('Plumbing',        'facility'),
    ('Furniture',       'facility'),
    ('Cleaning',        'facility'),
    ('Access Control',  'facility'),
    ('Wi-Fi',           'technology'),
    ('Laptop',          'technology'),
    ('Printer',         'technology'),
    ('Meeting Room AV', 'technology');

-- ---------------------------------------------------------------------------
-- engineer_profiles
-- ---------------------------------------------------------------------------

INSERT INTO engineer_profiles (user_id, specialization_id, is_available, max_active_tickets, phone)
SELECT u.id, c.id, e.is_available, e.capacity, e.phone
FROM (VALUES
    ('eng.hvac@acme.inc', 'HVAC',     true,  5, '+1-555-0101'),
    ('eng.it@acme.inc',   'Wi-Fi',    true,  8, '+1-555-0102'),
    ('eng.elec@acme.inc', 'Lighting', false, 4, '+1-555-0103')
) AS e(email, specialization, is_available, capacity, phone)
JOIN users u ON u.email = e.email
JOIN categories c ON c.label = e.specialization;

-- ---------------------------------------------------------------------------
-- Facilities
-- ---------------------------------------------------------------------------

INSERT INTO buildings (name, code, address) VALUES
    ('HQ North',        'HQ1', '100 King St W'),
    ('Riverside Annex', 'RA1', '55 Riverside Dr');

INSERT INTO floors (building_id, level, label)
SELECT b.id, f.level, f.label
FROM buildings b
CROSS JOIN (VALUES (0, 'Ground Floor'), (1, 'Level 1'), (2, 'Level 2')) AS f(level, label)
WHERE b.code = 'HQ1';

INSERT INTO floors (building_id, level, label)
SELECT b.id, f.level, f.label
FROM buildings b
CROSS JOIN (VALUES (0, 'Ground Floor'), (1, 'Level 1')) AS f(level, label)
WHERE b.code = 'RA1';

-- 12 seats per floor, coded <building>-<level>F-<row><nn>, e.g. HQ1-2F-A01.
INSERT INTO seats (floor_id, code)
SELECT fl.id,
       b.code || '-' || fl.level || 'F-' || r.row || lpad(n::text, 2, '0')
FROM floors fl
JOIN buildings b ON b.id = fl.building_id
CROSS JOIN (VALUES ('A'), ('B')) AS r(row)
CROSS JOIN generate_series(1, 6) AS n;

-- ---------------------------------------------------------------------------
-- incidents - one per workflow status, plus a repeat offender seat
-- ---------------------------------------------------------------------------

INSERT INTO incidents (
    title, description, category_id, priority, status,
    building_id, floor_id, seat_id, reporter_id, assignee_id,
    escalation_status, escalation_reason, blocked_reason,
    created_at, assigned_at, acknowledged_at, resolved_at, closed_at
)
SELECT
    d.title, d.description,
    (SELECT id FROM categories WHERE label = d.category),
    d.priority, d.status,
    b.id, fl.id, s.id,
    (SELECT id FROM users WHERE email = d.reporter),
    (SELECT id FROM users WHERE email = d.engineer),
    d.escalation_status, d.escalation_reason, d.blocked_reason,
    d.created_at, d.assigned_at, d.acknowledged_at, d.resolved_at, d.closed_at
FROM (VALUES
    ('Meeting room too cold',
     'Room 2.3 has been at 16C all week. Unusable for client calls.',
     'HVAC', 'high'::incident_priority, 'in_progress'::incident_status,
     'HQ1', 2, 'HQ1-2F-A01', 'asha@acme.inc', 'eng.hvac@acme.inc',
     'not_requested'::escalation_state, NULL, NULL,
     now() - interval '4 days', now() - interval '3 days', now() - interval '3 days', NULL, NULL),

    ('Wi-Fi drops every 10 minutes',
     'Signal drops on the north side of Level 1 on both the guest and staff SSIDs.',
     'Wi-Fi', 'critical'::incident_priority, 'blocked'::incident_status,
     'HQ1', 1, 'HQ1-1F-B04', 'tom@acme.inc', 'eng.it@acme.inc',
     'approved'::escalation_state, 'Blocking three client demos this week.',
     'Waiting on a replacement access point from the vendor.',
     now() - interval '7 days', now() - interval '6 days', now() - interval '6 days', NULL, NULL),

    ('Ceiling light flickering',
     'Two panels above the seat flicker continuously through the day.',
     'Lighting', 'medium'::incident_priority, 'resolved'::incident_status,
     'HQ1', 1, 'HQ1-1F-A03', 'mei@acme.inc', 'eng.elec@acme.inc',
     'not_requested'::escalation_state, NULL, NULL,
     now() - interval '10 days', now() - interval '9 days', now() - interval '9 days',
     now() - interval '2 days', NULL),

    ('Broken chair hydraulics',
     'Chair sinks to the lowest position and will not hold height.',
     'Furniture', 'low'::incident_priority, 'closed'::incident_status,
     'RA1', 0, 'RA1-0F-B02', 'asha@acme.inc', 'eng.elec@acme.inc',
     'not_requested'::escalation_state, NULL, NULL,
     now() - interval '21 days', now() - interval '20 days', now() - interval '20 days',
     now() - interval '15 days', now() - interval '14 days'),

    ('Projector will not connect over HDMI',
     'Meeting room AV fails to detect any laptop over HDMI or USB-C.',
     'Meeting Room AV', 'medium'::incident_priority, 'open'::incident_status,
     'RA1', 1, 'RA1-1F-A05', 'tom@acme.inc', NULL,
     'requested'::escalation_state, 'Board review scheduled in this room on Monday.', NULL,
     now() - interval '2 days', NULL, NULL, NULL, NULL),

    ('Leaking tap in the kitchen',
     'Constant drip from the cold tap, puddling on the floor by the sink.',
     'Plumbing', 'high'::incident_priority, 'open'::incident_status,
     'HQ1', 0, 'HQ1-0F-A02', 'mei@acme.inc', NULL,
     'not_requested'::escalation_state, NULL, NULL,
     now() - interval '1 day', NULL, NULL, NULL, NULL),

    -- Same seat as the first incident: gives the hotspot report something to find.
    ('Air conditioning rattling',
     'Loud rattle from the AC unit above the seat whenever the system starts.',
     'HVAC', 'low'::incident_priority, 'open'::incident_status,
     'HQ1', 2, 'HQ1-2F-A01', 'asha@acme.inc', 'eng.hvac@acme.inc',
     'not_requested'::escalation_state, NULL, NULL,
     now() - interval '1 day', now() - interval '1 day', NULL, NULL, NULL),

    ('Printer jams on every duplex job',
     'The Level 1 printer jams whenever double-sided printing is selected.',
     'Printer', 'medium'::incident_priority, 'open'::incident_status,
     'HQ1', 1, 'HQ1-1F-B04', 'tom@acme.inc', NULL,
     'rejected'::escalation_state, 'Requested urgent handling; single shared printer.', NULL,
     now() - interval '5 days', NULL, NULL, NULL, NULL)
) AS d(
    title, description, category, priority, status,
    building_code, floor_level, seat_code, reporter, engineer,
    escalation_status, escalation_reason, blocked_reason,
    created_at, assigned_at, acknowledged_at, resolved_at, closed_at
)
JOIN buildings b ON b.code = d.building_code
JOIN floors fl ON fl.building_id = b.id AND fl.level = d.floor_level
JOIN seats s ON s.floor_id = fl.id AND s.code = d.seat_code;

-- ---------------------------------------------------------------------------
-- incident_notes
-- ---------------------------------------------------------------------------

INSERT INTO incident_notes (incident_id, author_id, body, created_at)
SELECT i.id, u.id, n.body, i.created_at + n.offset_after
FROM (VALUES
    ('Meeting room too cold', 'eng.hvac@acme.inc',
     'Checked the thermostat - the valve actuator is stuck. Replacement ordered.',
     interval '1 day'),
    ('Meeting room too cold', 'asha@acme.inc',
     'Thanks. We moved the standup to room 2.4 in the meantime.',
     interval '1 day 2 hours'),
    ('Wi-Fi drops every 10 minutes', 'eng.it@acme.inc',
     'Access point AP-N-14 is failing. Vendor RMA raised, ETA Thursday.',
     interval '1 day'),
    ('Wi-Fi drops every 10 minutes', 'admin@acme.inc',
     'Escalation approved. Chasing the vendor account manager daily.',
     interval '2 days'),
    ('Ceiling light flickering', 'eng.elec@acme.inc',
     'Both panels replaced and tested. Marking resolved pending confirmation.',
     interval '8 days'),
    ('Broken chair hydraulics', 'asha@acme.inc',
     'Replacement chair arrived and works. Happy to close this.',
     interval '6 days')
) AS n(incident_title, author, body, offset_after)
JOIN incidents i ON i.title = n.incident_title
JOIN users u ON u.email = n.author;

-- ---------------------------------------------------------------------------
-- incident_events - audit trail matching the timestamps above
-- ---------------------------------------------------------------------------

INSERT INTO incident_events (incident_id, actor_id, event_type, from_value, to_value, reason, created_at)
SELECT i.id, i.reporter_id, 'created', NULL, 'open', NULL, i.created_at
FROM incidents i;

INSERT INTO incident_events (incident_id, actor_id, event_type, from_value, to_value, reason, created_at)
SELECT i.id, (SELECT id FROM users WHERE email = 'admin@acme.inc'),
       'assigned', NULL, u.full_name, NULL, i.assigned_at
FROM incidents i
JOIN users u ON u.id = i.assignee_id
WHERE i.assigned_at IS NOT NULL;

INSERT INTO incident_events (incident_id, actor_id, event_type, from_value, to_value, reason, created_at)
SELECT i.id, i.assignee_id, 'status_changed', 'open', 'in_progress',
       'Work started', i.acknowledged_at
FROM incidents i
WHERE i.acknowledged_at IS NOT NULL;

INSERT INTO incident_events (incident_id, actor_id, event_type, from_value, to_value, reason, created_at)
SELECT i.id, i.assignee_id, 'status_changed', 'in_progress', 'blocked',
       i.blocked_reason, i.acknowledged_at + interval '4 hours'
FROM incidents i
WHERE i.status = 'blocked';

INSERT INTO incident_events (incident_id, actor_id, event_type, from_value, to_value, reason, created_at)
SELECT i.id, i.assignee_id, 'status_changed', 'in_progress', 'resolved',
       'Work completed', i.resolved_at
FROM incidents i
WHERE i.resolved_at IS NOT NULL;

INSERT INTO incident_events (incident_id, actor_id, event_type, from_value, to_value, reason, created_at)
SELECT i.id, i.reporter_id, 'status_changed', 'resolved', 'closed',
       'Confirmed by reporter', i.closed_at
FROM incidents i
WHERE i.closed_at IS NOT NULL;

INSERT INTO incident_events (incident_id, actor_id, event_type, from_value, to_value, reason, created_at)
SELECT i.id, i.reporter_id, 'escalation_requested', 'not_requested', 'requested',
       i.escalation_reason, i.created_at + interval '1 hour'
FROM incidents i
WHERE i.escalation_status <> 'not_requested';

INSERT INTO incident_events (incident_id, actor_id, event_type, from_value, to_value, reason, created_at)
SELECT i.id, (SELECT id FROM users WHERE email = 'admin@acme.inc'),
       'escalation_decided', 'requested', i.escalation_status::text,
       NULL, i.created_at + interval '5 hours'
FROM incidents i
WHERE i.escalation_status IN ('approved', 'rejected');

INSERT INTO incident_events (incident_id, actor_id, event_type, from_value, to_value, reason, created_at)
SELECT n.incident_id, n.author_id, 'note_added', NULL, NULL, NULL, n.created_at
FROM incident_notes n;

COMMIT;
