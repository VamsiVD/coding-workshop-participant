import { Box, Stack } from '@mui/material';
import { crate, fonts } from '../../../../theme/crateTheme';
import { WORKFLOW } from '../incidentModel';

const dt = { fontFamily: fonts.heading, fontWeight: 500, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', opacity: 0.75 };

export default function SummaryPanel({ location, category, title, priority, showWorkflow = true }) {
  const rows = [['Location', location], ['Category', category || '—'], ['Title', title || '—'], ['Priority', priority]];
  return (
    <Stack spacing={2} component="aside" sx={{ position: { md: 'sticky' }, top: 16 }}>
      <Box sx={{ bgcolor: crate.field, border: `2px solid ${crate.ink}` }}>
        <Box sx={{ px: 1.75, py: 1, bgcolor: crate.ink, color: crate.paper, fontFamily: fonts.heading, fontWeight: 500, fontSize: 12, letterSpacing: '.16em', textTransform: 'uppercase' }}>Summary</Box>
        <Box component="dl" sx={{ m: 0, px: 1.75, py: 1.5, display: 'grid', gap: 1.25, fontSize: 13, lineHeight: 1.4 }}>
          {rows.map(([k, v]) => (
            <div key={k}>
              <Box component="dt" sx={dt}>{k}</Box>
              <Box component="dd" sx={{ m: 0, mt: 0.25, overflowWrap: 'anywhere' }}>{v}</Box>
            </div>
          ))}
        </Box>
      </Box>

      {showWorkflow && (
        <Box sx={{ bgcolor: crate.paper, border: `2px solid ${crate.ink}`, px: 1.75, py: 1.5 }}>
          <Box sx={{ fontFamily: fonts.heading, fontWeight: 500, fontSize: 12, letterSpacing: '.16em', textTransform: 'uppercase', mb: 1.25 }}>What happens next</Box>
          <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1 }}>
            {WORKFLOW.map(([name, desc], i) => (
              <Box component="li" key={name} sx={{ display: 'grid', gridTemplateColumns: '12px minmax(0,1fr)', gap: 1.25, fontSize: 12.5, lineHeight: 1.4 }}>
                <Box component="span" sx={{ width: 10, height: 10, mt: '4px', border: `1.5px solid ${crate.ink}`, bgcolor: i === 0 ? crate.red : crate.field }} />
                <span>
                  <Box component="b" sx={{ fontFamily: fonts.heading, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', fontSize: 12 }}>{name}</Box> · {desc}
                </span>
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Stack>
  );
}
