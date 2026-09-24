// First column of the facilities page: every building, active or retired,
// with search and an active / inactive filter. Selecting one opens its floors.
import { useMemo, useState } from 'react';
import { Box, Button, Chip, InputAdornment, TextField, ToggleButton, ToggleButtonGroup } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import RestoreIcon from '@mui/icons-material/Restore';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { admin } from '../../../../theme/adminTheme';
import ColumnPanel, { FacilityRow, Lead, PanelNote } from './ColumnPanel';
import { matches, plural } from '../facilitiesModel';

// Filter key -> [label, predicate], in toggle order.
const FILTERS = {
  all: ['All', () => true],
  active: ['Active', (b) => b.isActive],
  inactive: ['Inactive', (b) => !b.isActive],
};

export const toggleSx = { '& .MuiToggleButton-root': { textTransform: 'none', px: 1.25, py: 0.4, color: admin.ink }, '& .Mui-selected': { bgcolor: `${admin.red} !important`, color: '#fff !important' } };
export const searchSx = { flex: '1 1 160px', minWidth: 0, '& .MuiOutlinedInput-root': { bgcolor: admin.bg } };

// [CONCEPT: Props] Data and callbacks come from the page; search and filter are local, since nothing else needs them.
export default function BuildingsPanel({ buildings, selectedId, show, onSelect, onAdd, onEdit, onToggleActive, onDelete }) {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');

  // [CONCEPT: useMemo] Filter and search, re-run only when an input changes. The server already sorts by name.
  const rows = useMemo(
    () => buildings.filter(FILTERS[filter][1]).filter((b) => matches(query, b.name, b.code, b.address)),
    [buildings, filter, query],
  );

  return (
    <ColumnPanel
      label="Buildings"
      kicker="All buildings"
      title="Buildings"
      subtitle={`${plural(buildings.length, 'building')} · ${buildings.filter((b) => !b.isActive).length} inactive`}
      show={show}
      action={<Button size="small" variant="contained" startIcon={<AddIcon />} onClick={onAdd}>Add</Button>}
      toolbar={(
        <>
          <ToggleButtonGroup exclusive size="small" value={filter} onChange={(_, v) => v && setFilter(v)} sx={toggleSx}>
            {Object.entries(FILTERS).map(([k, [label]]) => <ToggleButton key={k} value={k}>{label}</ToggleButton>)}
          </ToggleButtonGroup>
          {/* [CONCEPT: Controlled input] Search text lives in state and re-filters the list as you type. */}
          <TextField
            size="small"
            placeholder="Search name, code, address"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            sx={searchSx}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }, htmlInput: { 'aria-label': 'Search buildings' } }}
          />
        </>
      )}
    >
      {/* [CONCEPT: Conditional rendering] No buildings at all is a call to action; no matches is just a note. */}
      {rows.length === 0 ? (
        <PanelNote>
          {buildings.length === 0 ? (
            <>
              No buildings yet.
              <Button variant="outlined" startIcon={<AddIcon />} onClick={onAdd}>Add the first building</Button>
            </>
          ) : 'No buildings match this view.'}
        </PanelNote>
      ) : (
        <Box>
          {/* [CONCEPT: List rendering and keys] Building ids are stable across edits and re-sorts. */}
          {rows.map((b) => (
            <FacilityRow
              key={b.id}
              name={b.name}
              selected={b.id === selectedId}
              muted={!b.isActive}
              onClick={() => onSelect(b)}
              lead={<Lead tone={b.isActive ? 'sand' : 'grey'}><ApartmentOutlinedIcon fontSize="small" /></Lead>}
              primary={(
                <>
                  <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</Box>
                  {!b.isActive && <Chip label="Inactive" size="small" sx={{ bgcolor: admin.track, color: admin.muted, flex: 'none' }} />}
                </>
              )}
              secondary={[b.code, b.address].filter(Boolean).join(' · ')}
              meta={(
                <Box sx={{ display: 'flex', alignItems: 'center', fontSize: 12.5, color: admin.muted, whiteSpace: 'nowrap' }}>
                  {b.floorCount != null && plural(b.floorCount, 'floor')}
                  <ChevronRightIcon fontSize="small" sx={{ color: admin.faint }} />
                </Box>
              )}
              actions={[
                { label: 'Edit', icon: <EditOutlinedIcon fontSize="small" />, onClick: () => onEdit(b) },
                b.isActive
                  ? { label: 'Deactivate', icon: <VisibilityOffIcon fontSize="small" />, onClick: () => onToggleActive(b) }
                  : { label: 'Reactivate', icon: <RestoreIcon fontSize="small" />, onClick: () => onToggleActive(b) },
                { label: 'Delete', icon: <DeleteOutlinedIcon fontSize="small" />, onClick: () => onDelete(b), danger: true },
              ]}
            />
          ))}
        </Box>
      )}
    </ColumnPanel>
  );
}
