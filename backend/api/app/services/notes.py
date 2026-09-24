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
    """Fetch the incident a note belongs to, if the caller may see it.

    Same rule and same 404-not-403 choice as `_load_visible` in the incident
    service: a caller with no access is not told the incident exists.
    """
    incident = incidents_repo.get_raw(conn, incident_id)
    if incident is None or not scoping.can_view_incident(user, incident):
        raise NotFoundError("Incident not found.")
    return incident


def list_notes(conn: Connection, incident_id: int, user: CurrentUser, params):
    """A page of an incident's notes, for anyone who can see the incident."""
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

    # The note and its timeline entry are written together, so the timeline
    # never shows a note that failed to save.
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

    # Visibility first, so a note on an incident the caller cannot see is a
    # 404, just as the incident itself would be.
    _visible_incident(conn, note["incident_id"], user)

    if user.role != UserRole.ADMIN and note["author"]["id"] != user.id:
        raise ForbiddenError("You can only edit your own notes.")

    # Unlike creation, an edit writes no timeline event; the change shows only
    # as the note's updated_at moving past created_at.

    return repo.update(conn, note_id, payload.body)


def delete_note(conn: Connection, note_id: int, user: CurrentUser) -> None:
    """Delete a note: its author or an administrator only.

    Raises NotFoundError (404) for a missing note or one on an incident the
    caller cannot see, and ForbiddenError (403) for someone else's note. The
    earlier `note_added` timeline event is left in place.
    """
    note = repo.get(conn, note_id)
    if note is None:
        raise NotFoundError("Note not found.")

    _visible_incident(conn, note["incident_id"], user)

    if user.role != UserRole.ADMIN and note["author"]["id"] != user.id:
        raise ForbiddenError("You can only delete your own notes.")

    repo.delete(conn, note_id)
