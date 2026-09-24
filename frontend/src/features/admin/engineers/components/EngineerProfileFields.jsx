// The engineer settings asked for when someone becomes an engineer
// (specialisation, phone, ticket cap, availability). Shared by the role-change
// and "Promote existing user" dialogs, which own the draft and its errors.
import { Box, FormControlLabel, MenuItem, Switch, TextField } from '@mui/material';
import { CAPACITY_MAX, CAPACITY_MIN } from '../engineersModel';

// [CONCEPT: Props] `form` and `errors` come from the parent; onChange(key) returns the handler for one input.
export default function EngineerProfileFields({ form, errors, categories, onChange, disabled }) {
  // Shared props for the text inputs, as in EngineerFormDialog.
  const field = (key) => ({ value: form[key], onChange: onChange(key), error: !!errors[key], helperText: errors[key], fullWidth: true, size: 'small', disabled });

  return (
    <>
      {/* [CONCEPT: Controlled input] Every value comes from the parent's draft; every change goes back through onChange. */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
        <TextField select label="Specialisation" {...field('specializationId')}>
          <MenuItem value="">None (general facilities)</MenuItem>
          {/* [CONCEPT: List rendering and keys] Category ids are unique. */}
          {categories.map((c) => <MenuItem key={c.id} value={c.id}>{c.label}</MenuItem>)}
        </TextField>
        <TextField label="Phone" type="tel" placeholder="Optional" {...field('phone')} />
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, alignItems: 'start' }}>
        <TextField slotProps={{ htmlInput: { min: CAPACITY_MIN, max: CAPACITY_MAX, step: 1 } }}
          label="Max active tickets"
          type="number"
          {...field('capacity')}
          helperText={errors.capacity ?? 'Open, in-progress and blocked tickets they can hold.'}
        />
        <FormControlLabel
          sx={{ mt: 0.5 }}
          control={<Switch checked={form.isAvailable} onChange={onChange('isAvailable')} color="primary" disabled={disabled} />}
          label="Available for new work"
        />
      </Box>
    </>
  );
}
