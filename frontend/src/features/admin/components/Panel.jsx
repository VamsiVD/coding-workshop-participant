import { Box, Typography } from '@mui/material';
import { admin } from '../../../theme/adminTheme';

export default function Panel({ title, children, sx }) {
  return (
    <Box component="section" sx={{ border: `1px solid ${admin.line}`, borderRadius: '12px', p: '18px 20px', display: 'grid', gap: 1.5, alignContent: 'start', ...sx }}>
      {title && <Typography variant="h2">{title}</Typography>}
      {children}
    </Box>
  );
}

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

export function Dot({ color, size = 8, radius = '50%' }) {
  return <Box component="span" sx={{ width: size, height: size, borderRadius: radius, bgcolor: color, flex: 'none' }} />;
}
