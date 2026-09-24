// Second column of the facilities page: the selected building's floors, by
// level, with desk and room counts. Selecting one opens its seats.
import { Box, Button } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { admin } from '../../../../theme/adminTheme';
import ColumnPanel, { FacilityRow, Lead, PanelNote } from './ColumnPanel';
import { floorName, levelTag, plural } from '../facilitiesModel';

// [CONCEPT: Props] `floors` undefined means "still loading"; `building` null means nothing is selected yet.
export default function FloorsPanel({ building, floors, error, selectedId, show, onBack, onRetry, onSelect, onAdd, onEdit, onDelete }) {
  // Placeholder column on desktop until a building is picked.
  if (!building) {
    return (
      <ColumnPanel label="Floors" kicker="Choose a building" title="Floors" show={show}>
        <PanelNote>Select a building to see its floors.</PanelNote>
      </ColumnPanel>
    );
  }

  const counts = (f) => (f.deskCount == null ? '' : `${plural(f.deskCount, 'desk')} · ${plural(f.roomCount, 'room')}`);

  return (
    <ColumnPanel
      label={`Floors of ${building.name}`}
      kicker={`${building.code}${building.isActive ? '' : ' · inactive'}`}
      title={building.name}
      subtitle={floors ? plural(floors.length, 'floor') : 'Loading floors…'}
      show={show}
      onBack={onBack}
      backLabel="Back to buildings"
      action={<Button size="small" variant="contained" startIcon={<AddIcon />} onClick={onAdd} disabled={!floors}>Add</Button>}
    >
      {/* [CONCEPT: Loading and error state] Each column loads on its own, so it shows its own spinner or retry. */}
      {!floors || floors.length === 0 ? (
        <PanelNote loading={!floors && !error} error={error} onRetry={onRetry}>
          No floors in this building yet.
          <Button variant="outlined" startIcon={<AddIcon />} onClick={onAdd}>Add the first floor</Button>
        </PanelNote>
      ) : (
        <Box>
          {floors.map((f) => (
            <FacilityRow
              key={f.id}
              name={floorName(f)}
              selected={f.id === selectedId}
              onClick={() => onSelect(f)}
              lead={<Lead>{levelTag(f.level)}</Lead>}
              primary={<Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{floorName(f)}</Box>}
              secondary={[f.label ? `Level ${f.level}` : '', counts(f)].filter(Boolean).join(' · ')}
              meta={<ChevronRightIcon fontSize="small" sx={{ color: admin.faint }} />}
              actions={[
                { label: 'Edit', icon: <EditOutlinedIcon fontSize="small" />, onClick: () => onEdit(f) },
                { label: 'Delete', icon: <DeleteOutlinedIcon fontSize="small" />, onClick: () => onDelete(f), danger: true },
              ]}
            />
          ))}
        </Box>
      )}
    </ColumnPanel>
  );
}
