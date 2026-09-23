import { Box, ButtonBase } from '@mui/material';
import { admin } from '../../../theme/adminTheme';

// Clickable when onClick is set; `active` highlights the current filter.
export default function StatCard({ label, value, hint, dot = admin.brown, active = false, onClick }) {
  return (
    <ButtonBase
      component={onClick ? 'button' : 'div'}
      disabled={!onClick}
      onClick={onClick}
      aria-pressed={onClick ? active : undefined}
      sx={{
        display: 'grid', gap: 0.75, textAlign: 'left', justifyItems: 'stretch', p: '16px 18px',
        borderRadius: '12px', border: `1px solid ${active ? admin.red : admin.line}`, bgcolor: active ? admin.sand : 'transparent',
        color: admin.ink, '&.Mui-disabled': { color: admin.ink }, '&:hover': onClick ? { borderColor: admin.red } : undefined,
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', color: admin.muted }}>
        {label}<Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: dot }} />
      </Box>
      <Box sx={{ fontWeight: 600, fontSize: 40, lineHeight: 1 }}>{value}</Box>
      <Box sx={{ fontSize: 13, color: admin.muted }}>{hint}</Box>
    </ButtonBase>
  );
}
