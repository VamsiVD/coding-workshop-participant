// Third column of the facilities page: the selected floor's desks and rooms,
// grouped by kind, with search and a kind filter. Clicking a seat edits it.
import { Fragment, useMemo, useState } from 'react';
import { Box, Button, InputAdornment, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import DeskOutlinedIcon from '@mui/icons-material/DeskOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import MeetingRoomOutlinedIcon from '@mui/icons-material/MeetingRoomOutlined';
import SearchIcon from '@mui/icons-material/Search';
import { admin } from '../../../../theme/adminTheme';
import ColumnPanel, { FacilityRow, Lead, PanelNote } from './ColumnPanel';
import { searchSx, toggleSx } from './BuildingsPanel';
import { SEAT_FILTERS, floorName, matches, plural } from '../facilitiesModel';

// Group order and headings: rooms first, since there are few of them.
const GROUPS = [['room', 'Rooms'], ['desk', 'Desks']];

// [CONCEPT: Props] `seats` undefined means "still loading"; `floor` null means no floor is selected yet.
export default function SeatsPanel({ building, floor, seats, error, show, onBack, onRetry, onAdd, onEdit, onDelete }) {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');

  const rows = useMemo(
    () => (seats ?? []).filter(SEAT_FILTERS[filter][1]).filter((s) => matches(query, s.code)),
    [seats, filter, query],
  );

  if (!floor) {
    return (
      <ColumnPanel label="Desks and rooms" kicker="Choose a floor" title="Desks and rooms" show={show}>
        <PanelNote>{building ? 'Select a floor to see its desks and rooms.' : 'Select a building, then a floor.'}</PanelNote>
      </ColumnPanel>
    );
  }

  // The Add button offers what the filter shows: rooms when looking at rooms, otherwise desks.
  const addKind = filter === 'room' ? 'room' : 'desk';

  return (
    <ColumnPanel
      label={`Desks and rooms on ${floorName(floor)}`}
      kicker={`${building?.code ?? ''} · ${floorName(floor)}`}
      title="Desks and rooms"
      subtitle={seats ? `${plural(seats.filter((s) => s.kind !== 'room').length, 'desk')} · ${plural(seats.filter((s) => s.kind === 'room').length, 'room')}` : 'Loading…'}
      show={show}
      onBack={onBack}
      backLabel="Back to floors"
      action={<Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => onAdd(addKind)} disabled={!seats}>Add</Button>}
      toolbar={seats && seats.length > 0 && (
        <>
          <ToggleButtonGroup exclusive size="small" value={filter} onChange={(_, v) => v && setFilter(v)} sx={toggleSx}>
            {Object.entries(SEAT_FILTERS).map(([k, [label]]) => <ToggleButton key={k} value={k}>{label}</ToggleButton>)}
          </ToggleButtonGroup>
          <TextField
            size="small"
            placeholder="Search code or name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            sx={searchSx}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }, htmlInput: { 'aria-label': 'Search desks and rooms' } }}
          />
        </>
      )}
    >
      {!seats || seats.length === 0 ? (
        <PanelNote loading={!seats && !error} error={error} onRetry={onRetry}>
          No desks or rooms on this floor yet.
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Button variant="outlined" startIcon={<DeskOutlinedIcon />} onClick={() => onAdd('desk')}>Add a desk</Button>
            <Button variant="outlined" startIcon={<MeetingRoomOutlinedIcon />} onClick={() => onAdd('room')}>Add a room</Button>
          </Box>
        </PanelNote>
      ) : rows.length === 0 ? (
        <PanelNote>Nothing on this floor matches this view.</PanelNote>
      ) : (
        <Box>
          {GROUPS.map(([kind, heading]) => {
            const group = rows.filter((s) => (kind === 'room' ? s.kind === 'room' : s.kind !== 'room'));
            if (group.length === 0) return null;
            return (
              // [CONCEPT: Fragment] A heading plus its rows, with no wrapper element, so row borders stay continuous.
              <Fragment key={kind}>
                <Typography component="h3" sx={{ px: 2, py: 0.75, fontSize: 11.5, letterSpacing: '.08em', textTransform: 'uppercase', color: admin.muted, bgcolor: admin.bg, borderBottom: `1px solid ${admin.line}` }}>
                  {heading} · {group.length}
                </Typography>
                {group.map((s) => (
                  <FacilityRow
                    key={s.id}
                    name={s.code}
                    onClick={() => onEdit(s)}
                    lead={<Lead tone={s.kind === 'room' ? 'red' : 'sand'}>{s.kind === 'room' ? <MeetingRoomOutlinedIcon fontSize="small" /> : <DeskOutlinedIcon fontSize="small" />}</Lead>}
                    primary={<Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.code}</Box>}
                    secondary={s.kind === 'room' ? 'Room' : 'Desk'}
                    actions={[
                      { label: 'Edit', icon: <EditOutlinedIcon fontSize="small" />, onClick: () => onEdit(s) },
                      { label: 'Delete', icon: <DeleteOutlinedIcon fontSize="small" />, onClick: () => onDelete(s), danger: true },
                    ]}
                  />
                ))}
              </Fragment>
            );
          })}
        </Box>
      )}
    </ColumnPanel>
  );
}
