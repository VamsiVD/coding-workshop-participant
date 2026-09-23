import { Box, Button, Paper } from '@mui/material';
import { crate, fonts } from '../../../theme/crateTheme';
import StatusChip from './StatusChip';

export default function NearbyIncidents({ items, locationLabel, onToggle }) {
  if (!items.length) return null;
  return (
    <Paper component="section" elevation={0} sx={{ border: `2px solid ${crate.ink}`, px: 2, py: 1.75, display: 'grid', gap: 1.25 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.25, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <Box component="h2" sx={{ m: 0, fontFamily: fonts.heading, fontWeight: 600, fontSize: 15, letterSpacing: '.12em', textTransform: 'uppercase' }}>Around you</Box>
        <Box component="span" sx={{ fontSize: 12.5 }}>Open issues on {locationLabel}. Already reported, so no need to raise them again.</Box>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 1.25 }}>
        {items.map((n) => (
          <Box key={n.ref} sx={{ bgcolor: crate.field, border: `1.5px solid ${crate.ink}`, px: 1.5, py: 1.25, display: 'grid', gap: 0.75 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'baseline' }}>
              <Box component="span" sx={{ fontFamily: fonts.heading, fontWeight: 600, fontSize: 12.5, letterSpacing: '.06em' }}>{n.ref}</Box>
              <StatusChip status={n.status} size="sm" />
            </Box>
            <Box sx={{ fontSize: 13.5, lineHeight: 1.35 }}>{n.title}</Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, fontSize: 12 }}>
              <span>{n.affectedCount ? `${n.affectedCount} ${n.affectedCount === 1 ? 'person' : 'people'} affected` : 'Reported by a colleague'}</span>
              <Button
                size="small"
                variant={n.affectsMe ? 'contained' : 'outlined'}
                color={n.affectsMe ? 'secondary' : 'inherit'}
                aria-pressed={n.affectsMe}
                onClick={() => onToggle(n.ref, !n.affectsMe)}
                sx={{ minHeight: 28, px: 1.25, fontSize: 11, border: `1.5px solid ${crate.ink} !important`, boxShadow: 'none !important' }}
              >
                {n.affectsMe ? '✓ Affects me' : 'Affects me too'}
              </Button>
            </Box>
          </Box>
        ))}
      </Box>
    </Paper>
  );
}
