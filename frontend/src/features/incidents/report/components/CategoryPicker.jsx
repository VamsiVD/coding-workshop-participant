import { Box, FormHelperText, Stack } from '@mui/material';
import { crate, fonts } from '../../../../theme/crateTheme';
import { labelSx } from './FormSection';

// groups = [{ label, items: [{ id, label }] }]; value is a category id.
export default function CategoryPicker({ groups, value, onChange, error }) {
  return (
    <Stack spacing={1} role="radiogroup" aria-label="Category">
      <Box component="span" sx={labelSx}>Category</Box>
      {groups.map((g) => (
        <Box key={g.label} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '110px minmax(0,1fr)' }, gap: 1.25, alignItems: 'start' }}>
          <Box component="span" sx={{ fontSize: 12, pt: { sm: '7px' } }}>{g.label}</Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {g.items.map((c) => {
              const on = value === c.id;
              return (
                <Box
                  key={c.id}
                  component="button"
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => onChange(c.id)}
                  sx={{
                    height: 32,
                    px: 1.375,
                    border: `1.5px solid ${crate.ink}`,
                    bgcolor: on ? crate.ink : crate.field,
                    color: on ? crate.paper : crate.ink,
                    fontFamily: fonts.body,
                    fontSize: 13,
                    cursor: 'pointer',
                    '&:hover': { borderColor: crate.red },
                    '&:focus-visible': { outline: `2px solid ${crate.red}`, outlineOffset: 2 },
                  }}
                >
                  {c.label}
                </Box>
              );
            })}
          </Box>
        </Box>
      ))}
      {error && <FormHelperText error>{error}</FormHelperText>}
    </Stack>
  );
}
