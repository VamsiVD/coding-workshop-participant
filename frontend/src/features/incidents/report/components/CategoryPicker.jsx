import { Box, ButtonBase, FormHelperText } from '@mui/material';
import { admin } from '../../../../theme/adminTheme';
import { labelSx } from './FormSection';

// groups = [{ label, items: [{ id, label }] }]; value is a category id.
export default function CategoryPicker({ groups, value, onChange, error }) {
  return (
    <Box role="radiogroup" aria-label="Category" sx={{ display: 'grid', gap: 1.25 }}>
      <Box component="span" sx={labelSx}>Category</Box>
      {groups.map((g) => (
        <Box key={g.label} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '110px minmax(0,1fr)' }, gap: 1.25, alignItems: 'start' }}>
          <Box component="span" sx={{ fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', color: admin.muted, pt: { sm: 1 } }}>{g.label}</Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {g.items.map((c) => {
              const on = value === c.id;
              return (
                <ButtonBase
                  key={c.id}
                  role="radio"
                  aria-checked={on}
                  onClick={() => onChange(c.id)}
                  sx={{
                    px: 1.625, py: 0.75, borderRadius: 999, fontSize: 13, whiteSpace: 'nowrap',
                    border: `1px solid ${on ? admin.red : error ? admin.danger : admin.line}`,
                    bgcolor: on ? admin.red : admin.bg, color: on ? '#fff' : admin.ink,
                    '&:hover': { borderColor: admin.red },
                    '&.Mui-focusVisible': { outline: `2px solid ${admin.red}`, outlineOffset: 2 },
                  }}
                >
                  {c.label}
                </ButtonBase>
              );
            })}
          </Box>
        </Box>
      ))}
      {error && <FormHelperText error sx={{ m: 0 }}>{error}</FormHelperText>}
    </Box>
  );
}
