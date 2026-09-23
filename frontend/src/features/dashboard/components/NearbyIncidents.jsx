import { Box, Button, Typography } from '@mui/material';
import { admin } from '../../../theme/adminTheme';
import StatusChip from './StatusChip';

export default function NearbyIncidents({ items, locationLabel, onToggle }) {
  if (!items?.length) return null;
  return (
    <Box component="section" sx={{ border: `1px solid ${admin.line}`, borderRadius: '12px', p: '18px 20px', display: 'grid', gap: 1.5 }}>
      <Box sx={{ display: 'grid', gap: 0.25 }}>
        <Typography variant="h2">Around you</Typography>
        <Typography sx={{ fontSize: 13, color: admin.muted }}>Open issues on {locationLabel}. Already reported, so no need to raise them again.</Typography>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 1.5 }}>
        {items.map((n) => (
          <Box key={n.ref} sx={{ bgcolor: admin.surface, border: `1px solid ${admin.line}`, borderRadius: '10px', p: '12px 14px', display: 'grid', gap: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'center' }}>
              <Box component="span" sx={{ fontWeight: 600, fontSize: 14, color: admin.brown }}>{n.ref}</Box>
              <StatusChip status={n.status} size="sm" />
            </Box>
            <Box sx={{ fontSize: 14, lineHeight: 1.35 }}>{n.title}</Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, fontSize: 12.5, color: admin.muted }}>
              <span>{n.affectedCount ? `${n.affectedCount} ${n.affectedCount === 1 ? 'person' : 'people'} affected` : 'Reported by a colleague'}</span>
              <Button
                size="small"
                variant={n.affectsMe ? 'contained' : 'outlined'}
                color={n.affectsMe ? 'primary' : 'secondary'}
                aria-pressed={n.affectsMe}
                onClick={() => onToggle(n.ref, !n.affectsMe)}
                sx={{ whiteSpace: 'nowrap', flex: 'none' }}
              >
                {n.affectsMe ? 'Affects me' : 'Affects me too'}
              </Button>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
