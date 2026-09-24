// Add / edit dialog for a building: name, short code, address and, when
// editing, whether it is active. Saving is delegated to the page.
import { useState } from 'react';
import { FormControlLabel, Switch, TextField } from '@mui/material';
import FacilityDialog from './FacilityDialog';
import useDraft from '../useDraft';
import { EMPTY_BUILDING, LIMITS, buildingForm, buildingPayload, validateBuilding } from '../facilitiesModel';

// [CONCEPT: Props] `building` null means "add"; a Building means "edit". `others` feeds the duplicate check.
export default function BuildingFormDialog({ open, building: incoming, others, onClose, onSave }) {
  // The building captured when the dialog opened, kept while it animates closed so the title does not flip.
  const [building, setBuilding] = useState(incoming);
  if (open && incoming !== building) setBuilding(incoming);
  const isNew = !building;
  const { form, formError, saving, set, field, submit } = useDraft(open, incoming, incoming ? buildingForm(incoming) : EMPTY_BUILDING);

  const onSubmit = submit(
    (f) => validateBuilding(f, others.filter((b) => b.id !== building?.id)),
    (f) => onSave(buildingPayload(f, building)),
  );

  return (
    <FacilityDialog
      open={open}
      title={isNew ? 'Add building' : `Edit ${building.name}`}
      submitLabel={isNew ? 'Create building' : 'Save changes'}
      saving={saving}
      formError={formError}
      onClose={onClose}
      onSubmit={onSubmit}
    >
      {/* [CONCEPT: Controlled input] Every value comes from the draft and every keystroke goes back through set(). */}
      <TextField label="Name" required autoFocus placeholder="Headquarters" {...field('name')} slotProps={{ htmlInput: { maxLength: LIMITS.buildingName } }} />
      <TextField
        label="Code"
        required
        placeholder="HQ1"
        {...field('code')}
        helperText={field('code').helperText ?? 'Short and unique; saved in upper case. Desk codes usually start with it.'}
        // Shown in upper case as typed, since that is how the server stores it.
        slotProps={{ htmlInput: { maxLength: LIMITS.buildingCode, style: { textTransform: 'uppercase' }, autoCapitalize: 'characters' } }}
      />
      <TextField label="Address" placeholder="Optional" multiline minRows={2} {...field('address')} slotProps={{ htmlInput: { maxLength: LIMITS.address } }} />
      {/* [CONCEPT: Conditional rendering] A new building always starts active; the switch only appears when editing. */}
      {!isNew && (
        <FormControlLabel
          control={<Switch checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} />}
          label={form.isActive ? 'Active: offered on the report form' : 'Inactive: hidden from the report form, history kept'}
        />
      )}
    </FacilityDialog>
  );
}
