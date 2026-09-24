// Small presentational building blocks for the admin console: a titled card
// (Panel), a labelled horizontal bar (BarRow) and a coloured dot (Dot).
import { Box, Typography } from '@mui/material';
import { admin } from '../../../theme/adminTheme';

// [CONCEPT: Children prop] Panel draws the frame; callers put any content between <Panel> tags and it arrives as `children`.
export default function Panel({ title, children, sx }) {
  return (
    // [CONCEPT: sx prop] The caller's `sx` is spread last, so it can override the default card styles.
    <Box component="section" sx={{ border: `1px solid ${admin.line}`, borderRadius: '12px', p: '18px 20px', display: 'grid', gap: 1.5, alignContent: 'start', ...sx }}>
      {/* [CONCEPT: Conditional rendering] The heading is optional; `title &&` renders nothing when it is missing. */}
      {title && <Typography variant="h2">{title}</Typography>}
      {children}
    </Box>
  );
}

// [CONCEPT: Props] Default values in the destructuring (color = admin.brown) apply when the caller omits the prop.
// `label` may be any node, not just text; `pct` is capped at 100 so an over-capacity bar does not overflow.
export function BarRow({ label, value, pct, color = admin.brown }) {
  return (
    <Box sx={{ display: 'grid', gap: 0.6 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, fontSize: 13.5 }}>
        <span>{label}</span><Box component="span" sx={{ fontWeight: 500 }}>{value}</Box>
      </Box>
      <Box sx={{ height: 6, bgcolor: admin.track, borderRadius: 3, overflow: 'hidden' }}>
        <Box sx={{ height: '100%', width: `${Math.min(100, pct)}%`, bgcolor: color, borderRadius: 3 }} />
      </Box>
    </Box>
  );
}

// Round by default; pass a smaller radius for a square legend swatch.
export function Dot({ color, size = 8, radius = '50%' }) {
  return <Box component="span" sx={{ width: size, height: size, borderRadius: radius, bgcolor: color, flex: 'none' }} />;
}
