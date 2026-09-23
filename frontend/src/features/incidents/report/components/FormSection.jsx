import { Box, Paper, Typography } from '@mui/material';
import { admin } from '../../../../theme/adminTheme';

export const labelSx = { fontSize: 13, color: admin.muted };

// Numbered, rounded card for one step of the form.
export default function FormSection({ number, title, children }) {
  return (
    <Paper component="section" elevation={0} sx={{ border: `1px solid ${admin.line}`, borderRadius: '12px', bgcolor: admin.surface, p: '18px 20px', display: 'grid', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.25 }}>
        <Box component="span" sx={{ fontWeight: 600, fontSize: 14, color: admin.red }}>{number}</Box>
        <Typography variant="h2">{title}</Typography>
      </Box>
      {children}
    </Paper>
  );
}
