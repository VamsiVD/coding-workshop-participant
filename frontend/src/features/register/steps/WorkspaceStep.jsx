// Step 2 of the registration wizard: where the new employee works. Building and
// floor are required; they then pick a desk, a room, or no fixed spot. Submitting
// this step creates the account.
import { Alert, Box, Button, FormControl, FormHelperText, FormLabel, MenuItem, Select } from '@mui/material';
import SegmentedChoice from '../../incidents/report/components/SegmentedChoice';
import { admin } from '../../../theme/adminTheme';

// Segmented-choice label -> the seat kind it filters on ('none' = no fixed spot).
const SPOT = { Desk: 'desk', Room: 'room', 'No fixed spot': 'none' };
const SPOT_LABEL = Object.fromEntries(Object.entries(SPOT).map(([label, kind]) => [kind, label]));

const floorLabel = (f) => f.label ?? `Level ${f.level}`;

// A labelled dropdown styled like LabeledInput, with its error underneath.
// [CONCEPT: Children prop] The Select is passed in as children, so one wrapper serves all three pickers.
function Field({ id, label, error, children }) {
  return (
    <FormControl fullWidth error={Boolean(error)}>
      <FormLabel htmlFor={id} sx={{ mb: 0.75, fontSize: 13, color: admin.muted, '&.Mui-focused': { color: admin.muted } }}>{label}</FormLabel>
      {children}
      {error && <FormHelperText id={`${id}-helper`} sx={{ mx: 0, fontSize: 13 }}>{error}</FormHelperText>}
    </FormControl>
  );
}

// [CONCEPT: Props] The wizard owns the form; this step shows it and reports each change up.
export default function WorkspaceStep({ form, onChange, errors, loading, onSubmit, onBack, locations, locationsError, onRetry }) {
  // [CONCEPT: Derived state] The floors and spots on offer follow from what is already chosen.
  const building = locations?.find((b) => b.id === form.buildingId);
  const floor = building?.floors.find((f) => f.id === form.floorId);
  const spots = (floor?.seats ?? []).filter((s) => s.kind === form.spotKind);
  const noun = form.spotKind === 'room' ? 'room' : 'desk';

  // Changing a level clears everything below it, so a stale floor or desk
  // from another building can never be submitted.
  const pickBuilding = (id) => { onChange('buildingId', id); onChange('floorId', ''); onChange('seatId', ''); };
  const pickFloor = (id) => { onChange('floorId', id); onChange('seatId', ''); };
  const pickKind = (label) => { onChange('spotKind', SPOT[label]); onChange('seatId', ''); };

  const selectSx = { bgcolor: admin.bg };

  if (locationsError) {
    return (
      <Alert severity="error" action={<Button color="inherit" size="small" onClick={onRetry}>Retry</Button>}>
        {locationsError}
      </Alert>
    );
  }

  return (
    // [CONCEPT: Form submission] preventDefault keeps the page from reloading; the wizard validates and submits.
    <Box component="form" noValidate onSubmit={(e) => { e.preventDefault(); onSubmit(); }} sx={{ display: 'grid', gap: 2.25 }}>
      <Field id="building" label="Building" error={errors.buildingId}>
        {/* [CONCEPT: Controlled input] The value comes from the wizard's state; the empty option shows until one is chosen. */}
        <Select id="building" value={form.buildingId} onChange={(e) => pickBuilding(e.target.value)} displayEmpty disabled={!locations} sx={selectSx}>
          <MenuItem value="" disabled>{locations ? 'Select your building' : 'Loading buildings…'}</MenuItem>
          {/* [CONCEPT: List rendering and keys] One option per building, keyed by its id. */}
          {(locations ?? []).map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
        </Select>
      </Field>

      <Field id="floor" label="Floor" error={errors.floorId}>
        <Select id="floor" value={form.floorId} onChange={(e) => pickFloor(e.target.value)} displayEmpty disabled={!building} sx={selectSx}>
          <MenuItem value="" disabled>{building ? 'Select your floor' : 'Choose a building first'}</MenuItem>
          {(building?.floors ?? []).map((f) => <MenuItem key={f.id} value={f.id}>{floorLabel(f)}</MenuItem>)}
        </Select>
      </Field>

      <SegmentedChoice id="spot-kind" label="Where do you sit?" options={Object.keys(SPOT)} value={SPOT_LABEL[form.spotKind]} onChange={pickKind} />

      {/* [CONCEPT: Conditional rendering] The desk or room picker only appears when one of those is chosen. */}
      {form.spotKind !== 'none' && (
        <Field id="seat" label={form.spotKind === 'room' ? 'Room' : 'Desk'} error={errors.seatId}>
          <Select id="seat" value={form.seatId} onChange={(e) => onChange('seatId', e.target.value)} displayEmpty disabled={!spots.length} sx={selectSx}>
            <MenuItem value="" disabled>
              {!floor ? 'Choose a floor first' : spots.length ? `Select your ${noun}` : `No ${noun}s listed on this floor`}
            </MenuItem>
            {spots.map((s) => <MenuItem key={s.id} value={s.id}>{s.code}</MenuItem>)}
          </Select>
        </Field>
      )}

      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap', pt: 0.5 }}>
        <Button type="submit" variant="contained" size="large" disabled={loading || !locations} sx={{ px: 3.5, whiteSpace: 'nowrap' }}>{loading ? 'Creating…' : 'Create account'}</Button>
        <Button variant="text" color="secondary" onClick={onBack} disabled={loading}>Back</Button>
      </Box>
    </Box>
  );
}
