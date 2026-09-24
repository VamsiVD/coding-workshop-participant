"""Lambda entry point for the ACME incident API.

The workshop Terraform deploys every `backend/<service>/function.py` as a Lambda
behind CloudFront, calling `function.handler`. HTTP requests arrive as Lambda
Function URL events and are served by the FastAPI app through Mangum.

A direct invocation with a `migrate` key instead applies the database schema,
since Aurora is reachable only from inside the VPC:

    aws lambda invoke --function-name <name> \
        --cli-binary-format raw-in-base64-out \
        --payload '{"migrate": true}' out.json

Add `"seed": true` to load `db/init/02_seed.sql`, and `"dummy": true` to also
load the bulk data in `db/seed_dummy.sql`.

TEMPORARY: `{"make_admin": "<email>"}` promotes that account to administrator
(see `make_admin.py` and `bin/make-admin.sh`).

Function URL events always carry `requestContext`, so a browser request can
never reach either path.
"""

from mangum import Mangum

from app.main import app
from make_admin import make_admin
from migrate import migrate

# The pool is opened lazily on first use, so the ASGI lifespan is not needed.
_asgi = Mangum(app, lifespan="off")


def handler(event, context):
    """Route a Lambda event to the schema migration or to the FastAPI app.

    Kept deliberately thin: everything request-shaped goes to Mangum, which
    translates the Function URL event into ASGI and the response back again.
    """
    # Only the presence of the key is checked, so {"migrate": false} still
    # migrates. That is harmless, because every step skips what already exists.
    if isinstance(event, dict) and "requestContext" not in event:
        if "migrate" in event:
            return migrate(seed=bool(event.get("seed")), dummy=bool(event.get("dummy")))
        # TEMPORARY: remove with make_admin.py.
        if "make_admin" in event:
            return make_admin(event["make_admin"])
    return _asgi(event, context)
