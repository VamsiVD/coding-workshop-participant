import { Box, Button, Typography } from '@mui/material';
import { admin } from '../../../theme/adminTheme';

export default function AttentionPanel({ tickets, onConfirm, onReopen, onReply, onDismiss }) {
  if (!tickets.length) return null;
  return (
    <Box component="section" aria-label="Needs your attention" sx={{ border: `1px solid ${admin.tanLight}`, borderRadius: '12px', overflow: 'hidden', bgcolor: admin.sand }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.25, alignItems: 'baseline', flexWrap: 'wrap', p: '14px 18px 6px' }}>
        <Typography variant="h2">Needs your attention</Typography>
        <Typography sx={{ fontSize: 13, color: admin.muted }}>{tickets.length === 1 ? '1 item' : `${tickets.length} items`}</Typography>
      </Box>
      {tickets.map((t) => {
        const resolved = t.status === 'Resolved';
        const last = t.notes?.[0];
        return (
          <Box key={t.ref} sx={{ display: 'flex', flexWrap: 'wrap', gap: '10px 16px', alignItems: 'center', justifyContent: 'space-between', p: '12px 18px', borderTop: '1px solid rgba(42,29,20,.12)' }}>
            <Box sx={{ flex: '1 1 320px', minWidth: 0, display: 'grid', gap: 0.4 }}>
              <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <Box component="span" sx={{ flex: 'none', fontWeight: 600, fontSize: 14, color: admin.brown }}>{t.ref}</Box>
                <Box component="span" sx={{ minWidth: 0, fontWeight: 500 }}>{t.title}</Box>
              </Box>
              <Box sx={{ fontSize: 13.5, lineHeight: 1.45, color: '#4a3b2c' }}>
                {resolved ? `${t.engineer} marked this resolved. Is it fixed?` : last ? `New note from ${last.author}: “${last.text}”` : 'New update on this ticket.'}
              </Box>
            </Box>
            <Box sx={{ flex: 'none', display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {resolved ? (
                <>
                  <Button variant="contained" onClick={() => onConfirm(t.ref)} sx={{ whiteSpace: 'nowrap' }}>Yes, fixed</Button>
                  <Button variant="outlined" color="secondary" onClick={() => onReopen(t.ref)} sx={{ bgcolor: admin.surface }}>Reopen</Button>
                </>
              ) : (
                <>
                  <Button variant="contained" onClick={() => onReply(t.ref)}>Reply</Button>
                  <Button variant="outlined" color="secondary" onClick={() => onDismiss(t.ref)} sx={{ bgcolor: admin.surface }}>Dismiss</Button>
                </>
              )}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
