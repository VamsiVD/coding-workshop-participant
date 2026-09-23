# Postman

Two collections and one environment.

| File | Purpose |
| --- | --- |
| `ACME-Incident-API.postman_collection.json` | Every endpoint, for exploring by hand. 53 requests. |
| `ACME-Incident-API.regression.postman_collection.json` | An ordered run with assertions. 74 requests, 163 assertions. |
| `Local.postman_environment.json` | `baseUrl` and the seed account addresses. |

## Setup

Start the API first:

```bash
docker compose up -d
curl localhost:8000/health
```

In Postman: **Import**, select all three files, then pick **ACME Incident API -
Local** from the environment dropdown at the top right.

## Exploring by hand

Use `ACME-Incident-API.postman_collection.json`.

1. Open **Auth / login** and send it. A test script captures the token into the
   collection variable `token`, and every other request picks it up through the
   collection's bearer auth. There is nothing to copy.
2. Change the email in the login body and send it again to switch persona.

Seed accounts, all with the password `Passw0rd!`:

| Email | Role |
| --- | --- |
| `admin@acme.inc` | admin |
| `eng.hvac@acme.inc` | engineer |
| `asha@acme.inc` | employee |

Worth doing once: send `GET /api/incidents` as each of the three. The same URL
returns every incident to an administrator, only their own reports to an
employee, and only their assignments to an engineer. Scope is decided on the
server, in one place, so no client can widen it.

Path ids such as `incidentId` and `buildingId` are collection variables, set
once under the collection's **Variables** tab rather than edited per request.
Optional query parameters are present but disabled, so filters are toggled
rather than typed.

## Running the regression collection

Use `ACME-Incident-API.regression.postman_collection.json`. **Run it, do not
click through it** — the requests depend on each other, capturing ids and
tokens as they go.

In Postman: open the collection, **Run**, keep the default order, **Run ACME
Incident API - Regression Tests**.

With Newman:

```bash
npx newman run backend/postman/ACME-Incident-API.regression.postman_collection.json \
  -e backend/postman/Local.postman_environment.json
```

Or through Docker, with no Node installed:

```bash
docker run --rm --network host \
  -v "$PWD/backend/postman:/etc/newman" \
  postman/newman:alpine \
  run ACME-Incident-API.regression.postman_collection.json \
  -e Local.postman_environment.json
```

Expect **74 requests, 163 assertions, 0 failures**.

It is safe to run repeatedly. Every record it creates carries a run id taken
from the clock, and the last folder deletes them, so the database is left as it
was found.

### What it covers

| Folder | Checks |
| --- | --- |
| 1. Authentication | Sign-in for all three personas, company-domain rule, duplicate registration, and that a failed sign-in never reveals whether an account exists |
| 2. Facilities | The nested tree, the administrator-only writes, and the refusal to delete a building that still has floors |
| 3. Categories and engineers | Enum validation, refusal to delete a category in use, creating an engineer account and profile together |
| 4. Incident lifecycle | The full workflow: report, assign, start, block, unblock, escalate, decide, resolve, close, and that closed is terminal |
| 5. Notes | Authorship rules, and that a closed incident takes no further notes |
| 6. Role scoping | That each persona sees a different result set, and that a filter cannot widen it |
| 7. Reports | All seven business questions, including that the status counts add up to the total |
| 8. Cleanup | Removes everything the run created |

The assertions check behaviour rather than status codes alone. A few worth
knowing about:

- **A record you may not see returns 404, not 403.** A 403 would confirm the id
  exists. The lifecycle folder asserts this.
- **`is_escalated` follows `escalation_status`.** It is a generated column, so
  the run asserts it stays false on a request and turns true only on approval.
- **The engineer resolves but cannot close.** The reporter closes, since only
  they know whether the fix worked.
- **Blocked incidents always state a reason.** The report folder asserts no row
  has a null reason, which a database CHECK constraint guarantees.
- **The timeline is ordered and complete.** It asserts at least ten events and
  that timestamps ascend.

## The equivalent shell suite

`../tests/api_test.sh` runs 97 similar checks with curl, for a terminal or CI
without Node. The Postman collection is the one to use in a demonstration: the
runner shows each assertion by name.
