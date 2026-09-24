# Local database

PostgreSQL 17 in Docker, seeded with development data for the ACME facility
incident management application.

Diagram source: [`schema.dbml`](./schema.dbml) (paste into
[dbdiagram.io](https://dbdiagram.io)).
Executable schema: [`init/01_schema.sql`](./init/01_schema.sql).

## Prerequisites

- Docker Desktop running.
- A `.env` file in the repository root. Copy `.env.sample` and set
  `POSTGRES_PASSWORD`. `.env` is git-ignored and must never be committed.

## Run

```bash
docker compose up -d                      # database only
docker compose --profile tools up -d      # database + Adminer on :8080
docker compose ps                         # check health
docker compose logs -f postgres           # follow startup logs
```

Connect with psql inside the container:

```bash
docker compose exec postgres psql -U acme -d acme_incidents
```

Connection string for the API (`backend/.env`):

```
DATABASE_URL=postgresql+psycopg://acme:<password>@localhost:5432/acme_incidents
```

## Reset

The scripts in `init/` run **only** when the data volume is empty. After editing
them, recreate the volume:

```bash
docker compose down -v && docker compose up -d
```

## Schema

| Table | Purpose |
| --- | --- |
| `users` | Accounts for all three personas. Email must end in `@acme.inc`. |
| `engineer_profiles` | One row per engineer: specialization, availability, capacity. |
| `buildings`, `floors`, `seats` | Facility hierarchy. Floors unique per building by level; seats unique per floor by code. |
| `categories` | Issue categories, typed `facility` or `technology`. |
| `incidents` | Tickets: status, priority, escalation, location, duplicate link. |
| `incident_notes` | Conversation on a ticket. |
| `incident_events` | Append-only audit trail; feeds the timeline and response-time reports. |

### What the SQL adds beyond the DBML

DBML cannot express these, so they live only in `init/01_schema.sql`:

- **Composite foreign keys** `incidents_floor_in_building` and
  `incidents_seat_on_floor` make it impossible to file an incident against a
  floor in a different building, or a seat on a different floor.
- **`is_escalated` is a generated column** (`escalation_status = 'approved'`),
  so the flag and the state cannot drift apart.
- **`assignee_id` references `engineer_profiles(user_id)`**, not `users(id)`.
  Only a user who has an engineer profile can hold a ticket, and the database
  enforces it rather than the API. This is the one deliberate deviation from the
  DBML.
- **CHECK constraints**: company email domain, bcrypt/argon2-only password
  column, `blocked_reason` required when status is `blocked`,
  `escalation_reason` required when an escalation exists, a seat cannot be given
  without its floor, and an incident cannot be its own duplicate.
- **Trigram indexes** on `title` and `description` for the search requirement.
- **`updated_at`** maintained by trigger, not by application code.

## Seed accounts

All seeded accounts use the password `Passw0rd!` (development only).

| Email | Role | Notes |
| --- | --- | --- |
| `admin@acme.inc` | admin | Dana Okafor |
| `facilities@acme.inc` | admin | Priya Raman |
| `eng.hvac@acme.inc` | engineer | HVAC, available, capacity 5 |
| `eng.it@acme.inc` | engineer | Wi-Fi, available, capacity 8 |
| `eng.elec@acme.inc` | engineer | Lighting, **unavailable**, capacity 4 |
| `asha@acme.inc` | employee | |
| `tom@acme.inc` | employee | |
| `mei@acme.inc` | employee | |

Seed data covers every workflow status, all four escalation states, one
unavailable engineer, and two seats with repeat incidents so the hotspot report
has something to find.

## Bulk dummy data

`init/02_seed.sql` gives 8 hand-written incidents. For enough volume to exercise
pagination, filters, search and the dashboards, load `seed_dummy.sql` on top:

```bash
docker compose exec -T postgres psql -U acme -d acme_incidents -q < backend/api/db/seed_dummy.sql
```

It adds 18 employees, 4 engineers and 220 incidents spread over the last 120
days, with notes, a full audit trail and a few closed-as-duplicate links.
Totals afterwards: 30 users, 7 engineers, 228 incidents, ~180 notes, ~1000
events.

Two things worth knowing about how it generates data:

- **Values are hashed from the row number, not drawn with `random()`.** An
  uncorrelated `LATERAL` is evaluated once and its result reused for every row,
  which silently collapses the whole batch into a single status bucket. Hashing
  `g` forces a fresh value per row and keeps runs reproducible.
- **Floor and building are derived from the chosen seat**, so the composite
  foreign keys are satisfied by construction rather than by luck.

Assignment deliberately ignores `max_active_tickets`, so several engineers sit
over capacity. That is what the workload dashboard needs to surface.

Running the script again adds another batch. To start clean:
`docker compose down -v && docker compose up -d`.

## Verify

`smoke.sql` answers the seven README business questions against the seeded data:

```bash
docker compose exec -T postgres psql -U acme -d acme_incidents -q < backend/api/db/smoke.sql
```
