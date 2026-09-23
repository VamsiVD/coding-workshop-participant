# Backend

REST API for the ACME facility incident management platform. Python, FastAPI
and PostgreSQL, deployed to AWS Lambda.

Data access is psycopg3 with parameterised SQL behind a repository layer rather
than an ORM. The reasoning is recorded in
[ADR 001](../docs/adr/001-data-access.md).

## Layout

```
app/
  main.py          application, CORS, request logging, /health
  core/            configuration, connection pool, security, errors, dependencies
  schemas/         Pydantic models for the API boundary
  repositories/    all SQL, one module per resource
  services/        workflow rules, permissions, role scoping
  api/routes/      HTTP handlers
tests/
  api_test.sh      end-to-end check of every endpoint
```

Requests flow **routes → services → repositories → database**. No SQL appears
in a route, and no HTTP object reaches a repository. Swapping the data-access
layer would touch nothing above it.

## Running it

The database must be running either way:

```bash
docker compose up -d postgres
```

### With Docker (nothing to install)

```bash
docker compose up -d --build api
```

The container runs uvicorn with `--reload`, and `app/` is mounted, so edits
take effect without a rebuild.

### With uvicorn locally

Requires Python 3.13. On Windows, install it from
[python.org](https://www.python.org/downloads/) — the `python` that ships with
Windows is a Microsoft Store stub, not an interpreter. Tick **Add python.exe to
PATH** during installation.

```bash
cd backend
python -m venv .venv
source .venv/Scripts/activate      # Git Bash on Windows
# .venv\Scripts\activate           # PowerShell
# source .venv/bin/activate        # macOS and Linux

pip install -r requirements.txt

cp .env.sample .env                # then fill in POSTGRES_PASS and JWT_SECRET

uvicorn app.main:app --reload --port 8000
```

`POSTGRES_PASS` is the `POSTGRES_PASSWORD` from the repository root `.env`.
Generate `JWT_SECRET` with `openssl rand -base64 48`; the application refuses
to start without one at least 32 characters long, rather than falling back to a
default that anyone could forge tokens against.

Stop the Docker API first if you use the local one, or change the port — both
listen on 8000.

```bash
docker compose stop api
```

### Check it is up

```bash
curl localhost:8000/health
# {"status":"ok","database":"ok"}
```

Interactive documentation is at <http://localhost:8000/docs>, and the OpenAPI
document at <http://localhost:8000/openapi.json>.

## Postman

Two collections and an environment live in [`postman/`](./postman/), with
their own [README](./postman/README.md):

| File | Purpose |
| --- | --- |
| `ACME-Incident-API.postman_collection.json` | Every endpoint, for exploring by hand. 53 requests. |
| `ACME-Incident-API.regression.postman_collection.json` | An ordered run with assertions. 74 requests, 163 assertions. |
| `Local.postman_environment.json` | `baseUrl` and the seed accounts. |

Import all three, then select the environment.

1. **Import** in Postman, choose the file.
2. Open **Auth / login** and send it. A test script captures the token into the
   collection variable `token`; every other request inherits it through the
   collection's bearer auth, so there is nothing to paste.
3. To switch persona, change the email in the login body and send it again.

Seed accounts, all with the password `Passw0rd!`:

| Email | Role |
| --- | --- |
| `admin@acme.inc` | admin |
| `eng.hvac@acme.inc` | engineer |
| `asha@acme.inc` | employee |

Worth trying: send `GET /api/incidents` as each of the three. The same URL
returns every incident to an administrator, only their own reports to an
employee, and only their assignments to an engineer. Scope is decided on the
server, in one place.

Path ids such as `incidentId` and `buildingId` are collection variables, set
once under the collection's **Variables** tab rather than edited per request.

Postman can also import <http://localhost:8000/openapi.json> directly, but that
gives you bare requests with no auth wiring or example bodies.

## Tests

```bash
bash tests/api_test.sh
```

97 checks against a running API and a real database: every endpoint, the role
matrix for all three personas, the workflow transition rules, and the rejection
cases. It is idempotent — each run creates uniquely named records and cleans up
the incidents it made.

It tests over HTTP rather than through mocks, so it exercises the constraints
in the database as well as the code above them.

The Postman regression collection covers the same ground with assertions on
response bodies. Both run in CI on every push; see [continuous integration and
deployment](../docs/ci-cd.md).

## Environment variables

| Variable | Purpose | Local default |
| --- | --- | --- |
| `POSTGRES_HOST` | Database host | `localhost` |
| `POSTGRES_PORT` | Database port | `5432` |
| `POSTGRES_NAME` | Database name | `acme_incidents` |
| `POSTGRES_USER` | Database user | `acme` |
| `POSTGRES_PASS` | Database password | *(required)* |
| `JWT_SECRET` | Token signing key, 32 characters or more | *(required)* |
| `ACCESS_TOKEN_TTL_MINUTES` | Token lifetime | `60` |
| `CORS_ORIGINS` | Origins allowed to call the API | localhost 3000 and 5173 |
| `IS_LOCAL` | `false` adds `sslmode=require` to the connection | `true` |
| `LOG_LEVEL` | Logging level | `INFO` |

The names match what `infra/locals.tf` injects into the Lambda environment, so
the deployed service reads the same configuration without a translation layer.

## Endpoints

| Group | Endpoints |
| --- | --- |
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| Facilities | CRUD for `/buildings`, `/floors`, `/seats`, plus `GET /facilities/tree` |
| Categories | CRUD for `/categories` |
| Engineers | CRUD for `/engineers`, `PATCH /engineers/me/availability` |
| Incidents | CRUD for `/incidents`, plus `/similar` and `/{id}/timeline` |
| Workflow | `/{id}/assign`, `/{id}/status`, `/{id}/priority`, `/{id}/escalation`, `/{id}/escalation/decision` |
| Notes | `/incidents/{id}/notes`, `PATCH` and `DELETE` on `/notes/{id}` |
| Reports | `/dashboard/summary` and six reports under `/reports` |

Each workflow transition is its own endpoint rather than a `PATCH` on `status`.
They carry different permissions, different required fields and different audit
entries, so one endpoint would be a switch statement behind a REST facade.

Every report under `/reports` answers one of the seven business questions in
the root README.

Full reference, conventions and the reasoning behind them:
[docs/api-design.md](../docs/api-design.md).
