import { Box, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { crate, fonts } from '../../../../theme/crateTheme';
import { labelSx } from './FormSection';

export default function SegmentedChoice({ id, label, options, value, onChange }) {
  return (
    <Box sx={{ display: 'grid', gap: 0.625 }}>
      <Box component="span" id={`${id}-label`} sx={labelSx}>{label}</Box>
      <ToggleButtonGroup
        exclusive
        value={value}
        onChange={(_, v) => v && onChange(v)}
        aria-labelledby={`${id}-label`}
        sx={{ display: 'grid', gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))`, border: `2px solid ${crate.ink}`, bgcolor: crate.field }}
      >
        {options.map((o, i) => (
          <ToggleButton
            key={o}
            value={o}
            sx={{
              height: 38,
              border: 'none !important',
              borderLeft: i ? `2px solid ${crate.ink} !important` : 'none !important',
              fontFamily: fonts.body,
              fontSize: 13,
              bgcolor: 'transparent',
            }}
          >
            {o}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Box>
  );
}
