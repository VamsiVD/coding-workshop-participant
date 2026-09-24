// Add / edit dialog for a floor: its level (unique within the building) and
// an optional label. Saving is delegated to the page.
import { useState } from 'react';
import { Box, TextField } from '@mui/material';
import { admin } from '../../../../theme/adminTheme';
import FacilityDialog from './FacilityDialog';
import useDraft from '../useDraft';
import { LIMITS, emptyFloor, floorForm, floorName, floorPayload, levelTag, validateFloor } from '../facilitiesModel';

// [CONCEPT: Props] `floor` null means "add" to `building`; `siblings` are the building's floors, for the level check.
export default function FloorFormDialog({ open, floor: incoming, building, siblings, onClose, onSave }) {
  const [floor, setFloor] = useState(incoming);
  if (open && incoming !== floor) setFloor(incoming);
  const isNew = !floor;
  const { form, formError, saving, field, submit } = useDraft(open, incoming, incoming ? floorForm(incoming) : emptyFloor(siblings));

  const onSubmit = submit(
    (f) => validateFloor(f, siblings.filter((x) => x.id !== floor?.id)),
    (f) => onSave(floorPayload(f, floor)),
  );

  // [CONCEPT: Derived state] The preview tag follows the level as it is typed; nothing is stored for it.
  const level = Number(form.level);
  const preview = form.level.trim() !== '' && Number.isInteger(level) ? levelTag(level) : '?';

  return (
    <FacilityDialog
      open={open}
      context={building ? `${building.name} · ${building.code}` : ''}
      title={isNew ? 'Add floor' : `Edit ${floorName(floor)}`}
      submitLabel={isNew ? 'Create floor' : 'Save changes'}
      saving={saving}
      formError={formError}
      onClose={onClose}
      onSubmit={onSubmit}
    >
      <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 2, alignItems: 'start' }}>
        <TextField
          label="Level"
          required
          autoFocus
          type="number"
          {...field('level')}
          helperText={field('level').helperText ?? '0 is the ground floor; negative numbers are basements.'}
          slotProps={{ htmlInput: { min: LIMITS.levelMin, max: LIMITS.levelMax, step: 1, inputMode: 'numeric' } }}
        />
        {/* [CONCEPT: Accessibility] The tag repeats the level visually; screen readers already have the field. */}
        <Box aria-hidden sx={{ mt: 0.5, width: 44, height: 32, borderRadius: '8px', display: 'grid', placeItems: 'center', bgcolor: admin.sand, color: admin.brown, fontWeight: 600, fontSize: 14 }}>
          {preview}
        </Box>
      </Box>
      <TextField label="Label" placeholder="Optional, e.g. Ground Floor" {...field('label')} slotProps={{ htmlInput: { maxLength: LIMITS.floorLabel } }} />
    </FacilityDialog>
  );
}
