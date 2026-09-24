// Card wrapper used for each numbered section (01 Location, 02 Issue, 03 Impact)
// of the incident report form. Also exports the shared small-label style.
import { Box, Paper, Typography } from '@mui/material';
import { admin } from '../../../../theme/adminTheme';

// Reused by CategoryPicker and SegmentedChoice so their labels match Field's.
export const labelSx = { fontSize: 13, color: admin.muted };

// Numbered, rounded card for one step of the form.
// [CONCEPT: Children prop] The section's fields are whatever JSX the parent
// nests inside <FormSection>; this component only draws the frame and heading.
export default function FormSection({ number, title, children }) {
  return (
    // [CONCEPT: MUI component] Paper rendered as a <section> element via `component`.
    <Paper component="section" elevation={0} sx={{ border: `1px solid ${admin.line}`, borderRadius: '12px', bgcolor: admin.surface, p: '18px 20px', display: 'grid', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.25 }}>
        <Box component="span" sx={{ fontWeight: 600, fontSize: 14, color: admin.red }}>{number}</Box>
        <Typography variant="h2">{title}</Typography>
      </Box>
      {children}
    </Paper>
  );
}
