"""Notes on an incident.

Listed and created under the incident they belong to; edited and deleted by
their own id, because that is what the client holds once a note is on screen.
"""

from typing import Annotated

from fastapi import APIRouter, Query, status

from app.core.deps import CurrentUserDep, DbConnection
from app.schemas.common import DeletedResponse, Page, as_page
from app.schemas.notes import NoteCreate, NoteFilters, NoteOut, NoteUpdate
from app.services import notes as service

router = APIRouter(tags=["notes"])


@router.get("/incidents/{incident_id}/notes", response_model=Page[NoteOut])
def list_notes(
    incident_id: int,
    conn: DbConnection,
    user: CurrentUserDep,
    params: Annotated[NoteFilters, Query()],
):
    rows, total = service.list_notes(conn, incident_id, user, params)
    return as_page(rows, total, params)


@router.post(
    "/incidents/{incident_id}/notes",
    response_model=NoteOut,
    status_code=status.HTTP_201_CREATED,
)
def create_note(
    incident_id: int, payload: NoteCreate, conn: DbConnection, user: CurrentUserDep
):
    """Anyone who can see the incident can add a note."""
    return service.create_note(conn, incident_id, user, payload)


@router.patch("/notes/{note_id}", response_model=NoteOut)
def update_note(
    note_id: int, payload: NoteUpdate, conn: DbConnection, user: CurrentUserDep
):
    """The author, or an administrator."""
    return service.update_note(conn, note_id, user, payload)


@router.delete("/notes/{note_id}", response_model=DeletedResponse)
def delete_note(note_id: int, conn: DbConnection, user: CurrentUserDep):
    service.delete_note(conn, note_id, user)
    return DeletedResponse(id=note_id)
