// Add / edit dialog for a seat, which is either a desk (coded, upper case) or
// a room (named, case kept). Saving is delegated to the page.
import { useState } from 'react';
import { Box, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import DeskOutlinedIcon from '@mui/icons-material/DeskOutlined';
import MeetingRoomOutlinedIcon from '@mui/icons-material/MeetingRoomOutlined';
import { admin } from '../../../../theme/adminTheme';
import FacilityDialog from './FacilityDialog';
import useDraft from '../useDraft';
import { LIMITS, emptySeat, seatForm, seatPayload, validateSeat } from '../facilitiesModel';

// [CONCEPT: Props] `seat` null means "add" (starting as `kind`); `siblings` are the floor's seats, for the code check.
export default function SeatFormDialog({ open, seat: incoming, kind = 'desk', context, siblings, onClose, onSave }) {
  const [seat, setSeat] = useState(incoming);
  if (open && incoming !== seat) setSeat(incoming);
  const isNew = !seat;
  const { form, formError, saving, set, field, submit } = useDraft(open, incoming, incoming ? seatForm(incoming) : emptySeat(kind));
  const room = form.kind === 'room';

  const onSubmit = submit(
    (f) => validateSeat(f, siblings.filter((s) => s.id !== seat?.id)),
    (f) => onSave(seatPayload(f, seat)),
  );

  return (
    <FacilityDialog
      open={open}
      context={context}
      title={isNew ? `Add ${room ? 'room' : 'desk'}` : `Edit ${seat.code}`}
      submitLabel={isNew ? `Create ${room ? 'room' : 'desk'}` : 'Save changes'}
      saving={saving}
      formError={formError}
      onClose={onClose}
      onSubmit={onSubmit}
    >
      <Box sx={{ display: 'grid', gap: 0.75 }}>
        <Typography id="seat-kind-label" sx={{ fontSize: 13, color: admin.muted }}>Type</Typography>
        {/* [CONCEPT: MUI component] Exclusive toggle; clicking the selected one sends null, which is ignored. */}
        <ToggleButtonGroup
          exclusive
          fullWidth
          size="small"
          value={form.kind}
          onChange={(_, v) => v && set('kind', v)}
          aria-labelledby="seat-kind-label"
          sx={{ '& .MuiToggleButton-root': { textTransform: 'none', gap: 1, color: admin.ink }, '& .Mui-selected': { bgcolor: `${admin.red} !important`, color: '#fff !important' } }}
        >
          <ToggleButton value="desk"><DeskOutlinedIcon fontSize="small" />Desk</ToggleButton>
          <ToggleButton value="room"><MeetingRoomOutlinedIcon fontSize="small" />Room</ToggleButton>
        </ToggleButtonGroup>
      </Box>
      <TextField
        label={room ? 'Room name' : 'Desk code'}
        required
        autoFocus
        placeholder={room ? 'Condor' : 'HQ1-2F-A01'}
        {...field('code')}
        helperText={field('code').helperText ?? (room ? 'Shown exactly as typed.' : 'Saved in upper case. Unique on this floor.')}
        // Desks display in upper case as typed, matching what the server will store.
        slotProps={{ htmlInput: { maxLength: LIMITS.seatCode, style: { textTransform: room ? 'none' : 'uppercase' } } }}
      />
    </FacilityDialog>
  );
}
