import { Box, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { admin } from '../../../../theme/adminTheme';
import { labelSx } from './FormSection';

// Rounded segmented control; selected segment is ACME red.
export default function SegmentedChoice({ id, label, options, value, onChange }) {
  return (
    <Box sx={{ display: 'grid', gap: 0.75 }}>
      <Box component="span" id={`${id}-label`} sx={labelSx}>{label}</Box>
      <ToggleButtonGroup
        exclusive
        fullWidth
        value={value}
        onChange={(_, v) => v && onChange(v)}
        aria-labelledby={`${id}-label`}
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
