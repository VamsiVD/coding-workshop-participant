// Pick-one control used for the two impact questions on the incident form.
import { Box, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { admin } from '../../../../theme/adminTheme';
import { labelSx } from './FormSection';

// Rounded segmented control; selected segment is ACME red.
export default function SegmentedChoice({ id, label, options, value, onChange }) {
  return (
    <Box sx={{ display: 'grid', gap: 0.75 }}>
      {/* [CONCEPT: Accessibility] The label gets an id so the group can point at it with aria-labelledby. */}
      <Box component="span" id={`${id}-label`} sx={labelSx}>{label}</Box>
      {/* [CONCEPT: MUI component] `exclusive` makes ToggleButtonGroup single-select, like radio buttons. */}
      <ToggleButtonGroup
        exclusive
        fullWidth
        value={value}
        // [CONCEPT: Event handling] MUI passes (event, newValue); newValue is null
        // when the selected button is clicked again, so ignore that to keep one
        // option always selected.
        onChange={(_, v) => v && onChange(v)}
        aria-labelledby={`${id}-label`}
        // [CONCEPT: sx prop] Nested selectors style the MUI child buttons and their
        // selected/hover states from the parent.
        sx={{
          bgcolor: admin.bg, borderRadius: '8px',
          '& .MuiToggleButton-root': {
            textTransform: 'none', fontSize: 13, py: 1, whiteSpace: 'nowrap', color: admin.ink, borderColor: admin.line,
            '&.Mui-selected, &.Mui-selected:hover': { bgcolor: admin.red, color: '#fff' },
            '&:hover': { bgcolor: admin.sand },
          },
        }}
      >
        {options.map((o) => <ToggleButton key={o} value={o}>{o}</ToggleButton>)}
      </ToggleButtonGroup>
    </Box>
  );
}
