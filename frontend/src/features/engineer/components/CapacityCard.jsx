// Capacity meter and availability switch at the top of the engineer workbench.
// One segment per ticket the engineer may hold; the switch sets whether admins
// should give them new jobs.
import { Box, FormControlLabel, Switch } from '@mui/material';
import { admin } from '../../../theme/adminTheme';

// [CONCEPT: Props] `capacity` is the engineer's ticket limit from their profile.
export default function CapacityCard({ active, capacity, available, onToggle }) {
  // Turns red one ticket before the limit, as a warning.
  const full = active >= capacity - 1;
  return (
    <Box sx={{ border: `1px solid ${admin.line}`, borderRadius: '12px', bgcolor: admin.surface, p: '12px 16px', display: 'grid', gap: 1, minWidth: 240 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
        <Box component="span" sx={{ color: admin.muted }}>Capacity</Box>
        <Box component="span" sx={{ fontWeight: 500 }}>{active} of {capacity} in use</Box>
      </Box>
      <Box role="meter" aria-valuemin={0} aria-valuemax={capacity} aria-valuenow={active} aria-label="Capacity" sx={{ display: 'grid', gridTemplateColumns: `repeat(${capacity}, 1fr)`, gap: '3px' }}>
        {Array.from({ length: capacity }, (_, k) => (
          <Box key={k} sx={{ height: 6, borderRadius: 3, bgcolor: k < active ? (full ? admin.red : admin.brown) : admin.track }} />
        ))}
      </Box>
      <FormControlLabel
        sx={{ m: 0, gap: 1, whiteSpace: 'nowrap' }}
        // [CONCEPT: Controlled input] The switch shows `available`; flipping it asks the parent to change it.
        control={<Switch size="small" checked={available} onChange={(e) => onToggle(e.target.checked)} sx={{ '& .Mui-checked': { color: `${admin.red} !important` }, '& .Mui-checked + .MuiSwitch-track': { bgcolor: `${admin.red} !important` } }} />}
        label={<Box component="span" sx={{ fontSize: 12.5, color: admin.muted }}>{available ? 'Available for new jobs' : 'Not taking new jobs'}</Box>}
      />
    </Box>
  );
}
