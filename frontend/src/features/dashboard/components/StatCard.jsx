// Summary tile on the employee dashboard: a label, a big number and a hint.
// Some tiles double as filter buttons for the ticket list.
import { Box, ButtonBase } from '@mui/material';
import { admin } from '../../../theme/adminTheme';

// Clickable when onClick is set; `active` highlights the current filter.
// [CONCEPT: Props] Destructured with defaults (dot, active) for props a caller may leave out.
export default function StatCard({ label, value, hint, dot = admin.brown, active = false, onClick }) {
  return (
    // [CONCEPT: Accessibility] A real <button> (with aria-pressed) only when clickable; otherwise a plain, disabled <div>
    // so screen readers do not announce a button that does nothing.
    <ButtonBase
      component={onClick ? 'button' : 'div'}
      disabled={!onClick}
      onClick={onClick}
      aria-pressed={onClick ? active : undefined}
      // [CONCEPT: sx prop] Styles depend on props; '&.Mui-disabled' keeps non-clickable tiles from looking greyed out.
      sx={{
        display: 'grid', gap: 0.75, textAlign: 'left', justifyItems: 'stretch', p: '16px 18px',
        // ButtonBase centres its content (justify-content: center); stretch keeps the grid full width and left-aligned.
        justifyContent: 'stretch', alignContent: 'start',
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
