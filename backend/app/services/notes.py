"""Note rules.

Who may read and write a note follows from who may see the incident, so the
visibility check is shared with the incident service rather than repeated.
"""

import logging

from psycopg import Connection

from app.core.db import transaction
from app.core.errors import ForbiddenError, NotFoundError, ValidationError
from app.repositories import events as events_repo
from app.repositories import incidents as incidents_repo
from app.repositories import notes as repo
from app.schemas.auth import CurrentUser
from app.schemas.common import IncidentStatus, UserRole
from app.services import scoping

logger = logging.getLogger(__name__)


def _visible_incident(conn: Connection, incident_id: int, user: CurrentUser) -> dict:
    incident = incidents_repo.get_raw(conn, incident_id)
    if incident is None or not scoping.can_view_incident(user, incident):
        raise NotFoundError("Incident not found.")
    return incident


def list_notes(conn: Connection, incident_id: int, user: CurrentUser, params):
    _visible_incident(conn, incident_id, user)
    return repo.list_for_incident(
        conn,
        incident_id,
        limit=params.limit,
        offset=params.offset,
        order=params.order,
    )


def create_note(conn: Connection, incident_id: int, user: CurrentUser, payload) -> dict:
    """Anyone who can see the incident can add a note.

    A closed incident takes no further notes: reopening it is the way to
    continue the conversation, and that leaves a record.
    """
    incident = _visible_incident(conn, incident_id, user)
    if incident["status"] == IncidentStatus.CLOSED:
        raise ValidationError(
            "This incident is closed. Reopen it if there is more to discuss."
        )

    with transaction(conn):
        note = repo.create(
            conn, incident_id=incident_id, author_id=user.id, body=payload.body
        )
        events_repo.record(
            conn,
            incident_id=incident_id,
            actor_id=user.id,
            event_type="note_added",
        )
    return note


def update_note(conn: Connection, note_id: int, user: CurrentUser, payload) -> dict:
    """Only the author edits a note, or an administrator.

    Other people's words are not editable, which is what makes the
    conversation trustworthy.
    """
    note = repo.get(conn, note_id)
    if note is None:
        raise NotFoundError("Note not found.")

    _visible_incident(conn, note["incident_id"], user)

    if user.role != UserRole.ADMIN and note["author"]["id"] != user.id:
        raise ForbiddenError("You can only edit your own notes.")

    return repo.update(conn, note_id, payload.body)


def delete_note(conn: Connection, note_id: int, user: CurrentUser) -> None:
    note = repo.get(conn, note_id)
    if note is None:
        raise NotFoundError("Note not found.")

    _visible_incident(conn, note["incident_id"], user)

    if user.role != UserRole.ADMIN and note["author"]["id"] != user.id:
        raise ForbiddenError("You can only delete your own notes.")

    repo.delete(conn, note_id)
