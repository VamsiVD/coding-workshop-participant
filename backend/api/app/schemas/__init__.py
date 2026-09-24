"""Pydantic models for the API boundary.

Layout:

- `common`    enumerations mirroring the database types, pagination, errors
- `auth`      registration, sign-in, the authenticated caller
- `facilities` buildings, floors, seats, and the nested picker tree
- `categories` issue categories
- `engineers` engineer profiles and workload
- `incidents` incidents, workflow transitions, filters, timeline
- `notes`     conversation on an incident
- `reports`   dashboards and the seven business-question reports

Two conventions hold throughout:

- Request models reject unknown fields, so a client typo is a 400 rather than
  something quietly ignored.
- Response models list their fields explicitly. `password_hash` cannot reach a
  client unless someone adds it to a response model by name.
"""
