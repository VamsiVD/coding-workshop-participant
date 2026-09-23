import { Box, Button, Paper, Stack } from '@mui/material';
import { crate, fonts } from '../../../theme/crateTheme';

const smallBtn = { minHeight: 36, px: 1.75, fontSize: 12, letterSpacing: '.12em', boxShadow: `2px 2px 0 ${crate.ink}` };

export default function AttentionPanel({ tickets, onConfirm, onReopen, onReply, onDismiss }) {
  if (!tickets.length) return null;
  return (
    <Paper component="section" elevation={0} sx={{ bgcolor: crate.field, border: `2px solid ${crate.red}`, boxShadow: `4px 4px 0 ${crate.ink}` }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.25, alignItems: 'baseline', flexWrap: 'wrap', px: 2, py: 1.25, bgcolor: crate.red, color: crate.paper }}>
        <Box component="h2" sx={{ m: 0, fontFamily: fonts.heading, fontWeight: 600, fontSize: 14, letterSpacing: '.14em', textTransform: 'uppercase' }}>Needs your attention</Box>
        <Box component="span" sx={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>{tickets.length === 1 ? '1 item' : `${tickets.length} items`}</Box>
      </Box>
      {tickets.map((t) => {
        const resolved = t.status === 'Resolved';
        const latest = t.notes?.[0];
        return (
          <Box key={t.ref} sx={{ display: 'flex', flexWrap: 'wrap', gap: '10px 16px', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5, borderTop: '1px solid rgba(42,29,20,.15)' }}>
            <Box sx={{ flex: '1 1 320px', minWidth: 0, display: 'grid', gap: 0.5 }}>
              <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <Box component="span" sx={{ flex: 'none', whiteSpace: 'nowrap', fontFamily: fonts.heading, fontWeight: 600, fontSize: 12.5, letterSpacing: '.06em' }}>{t.ref}</Box>
                <Box component="span" sx={{ minWidth: 0, fontSize: 14.5, fontWeight: 700, lineHeight: 1.3 }}>{t.title}</Box>
              </Box>
              <Box sx={{ fontSize: 13, lineHeight: 1.45 }}>
                {resolved ? `${t.engineer} marked this resolved. Is it fixed?` : latest && `New note from ${latest.author}: “${latest.text}”`}
              </Box>
            </Box>
            <Stack direction="row" spacing={1} sx={{ flex: 'none' }}>
              {resolved ? (
                <>
                  <Button variant="contained" onClick={() => onConfirm(t.ref)} sx={smallBtn}>Yes, fixed</Button>
                  <Button variant="outlined" onClick={() => onReopen(t.ref)} sx={{ ...smallBtn, boxShadow: 'none' }}>Reopen</Button>
                </>
              ) : (
                <>
                  <Button variant="contained" onClick={() => onReply(t.ref)} sx={smallBtn}>Reply</Button>
                  <Button variant="outlined" onClick={() => onDismiss(t.ref)} sx={{ ...smallBtn, boxShadow: 'none' }}>Dismiss</Button>
                </>
              )}
            </Stack>
          </Box>
        );
      })}
    </Paper>
  );
}
