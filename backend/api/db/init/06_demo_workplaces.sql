-- Demo workplaces: give each seed account (02_seed.sql and seed_dummy.sql) a
-- building, floor and desk, as if they had chosen one at registration.
-- Development data, like the seeds themselves.
--
-- Only the listed demo accounts are touched, and only while they have no
-- workplace, so real registrations and later changes are never overwritten.
-- Desks come from the seed buildings (HQ1, RA1) in a fixed order, every
-- second desk so people spread across floors. Positions are taken from the
-- whole list, not just the accounts updated now, so running this again after
-- seed_dummy.sql adds its people keeps everyone's desk stable.
--
-- Idempotent; migrate.py runs it on every invocation. Locally, run it again
-- after loading seed_dummy.sql by hand (see db/README.md).

WITH demo_users AS (
    SELECT u.id, u.building_id,
           row_number() OVER (ORDER BY u.id) - 1 AS rn
    FROM users u
    WHERE u.email IN (
        -- 02_seed.sql
        'admin@acme.inc', 'facilities@acme.inc',
        'eng.hvac@acme.inc', 'eng.it@acme.inc', 'eng.elec@acme.inc',
        'asha@acme.inc', 'tom@acme.inc', 'mei@acme.inc',
        -- seed_dummy.sql
        'eng.plumb@acme.inc', 'eng.net@acme.inc', 'eng.clean@acme.inc', 'eng.av@acme.inc',
        'ravi.menon@acme.inc', 'elena.duarte@acme.inc', 'kwame.boateng@acme.inc',
        'sofia.lindqvist@acme.inc', 'hiroshi.kato@acme.inc', 'amara.diallo@acme.inc',
        'ben.kowalski@acme.inc', 'nadia.haddad@acme.inc', 'oscar.reyes@acme.inc',
        'yuki.nakamura@acme.inc', 'freya.olsen@acme.inc', 'ibrahim.sesay@acme.inc',
        'clara.bianchi@acme.inc', 'dmitri.volkov@acme.inc', 'grace.mwangi@acme.inc',
        'liam.doherty@acme.inc', 'zara.khan@acme.inc', 'pedro.alves@acme.inc'
    )
),
desks AS (
    SELECT s.id AS seat_id, s.floor_id, f.building_id,
           row_number() OVER (ORDER BY b.code, f.level, s.code) - 1 AS rn,
           count(*) OVER () AS n
    FROM seats s
    JOIN floors f ON f.id = s.floor_id
    JOIN buildings b ON b.id = f.building_id
    WHERE s.kind = 'desk' AND b.code IN ('HQ1', 'RA1')
)
UPDATE users u
SET building_id = d.building_id,
    floor_id = d.floor_id,
    seat_id = d.seat_id
FROM demo_users du
JOIN desks d ON d.rn = (du.rn * 2) % d.n
WHERE u.id = du.id
  AND du.building_id IS NULL;
