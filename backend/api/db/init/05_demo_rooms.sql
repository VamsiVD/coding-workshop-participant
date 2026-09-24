-- Demo meeting rooms for the two seed buildings (HQ1, RA1), so the room
-- option has something to show. Development data, like 02_seed.sql.
--
-- Runs only while no room exists at all: once any room has been created, by
-- this file or an administrator, it does nothing, so a deleted demo room is
-- not recreated. On a database without the seed buildings it inserts nothing.

INSERT INTO seats (floor_id, code, kind)
SELECT fl.id, r.name, 'room'
FROM floors fl
JOIN buildings b ON b.id = fl.building_id
JOIN (VALUES
    ('HQ1', 0, 'Reception Lounge'),
    ('HQ1', 1, 'Condor'),
    ('HQ1', 1, 'Heron'),
    ('HQ1', 2, 'Kestrel'),
    ('HQ1', 2, 'Osprey'),
    ('RA1', 0, 'Wren'),
    ('RA1', 1, 'Finch')
) AS r(building_code, level, name)
    ON r.building_code = b.code AND r.level = fl.level
WHERE NOT EXISTS (SELECT 1 FROM seats WHERE kind = 'room')
ON CONFLICT (floor_id, code) DO NOTHING;
