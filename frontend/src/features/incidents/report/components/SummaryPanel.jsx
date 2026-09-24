// Side panel next to the incident form: a live read-only summary of what the
// user has entered, plus the "What happens next" ticket workflow.
import { Box, Paper, Typography } from '@mui/material';
import { admin } from '../../../../theme/adminTheme';
import { WORKFLOW } from '../incidentModel';

export default function SummaryPanel({ location, category, title, priority, showWorkflow = true }) {
  // Empty values show an em dash so the rows keep their shape before input.
  const rows = [['Location', location], ['Category', category || '—'], ['Title', title || '—'], ['Priority', priority]];
  return (
    // [CONCEPT: Responsive design] From the md breakpoint up the panel is sticky
    // and scrolls on its own; on small screens it is a normal block.
    <Box component="aside" sx={{ display: 'grid', gap: 2, position: { md: 'sticky' }, top: 16, minWidth: 0, maxHeight: { md: 'calc(100vh - 32px)' }, overflowY: { md: 'auto' } }}>
      <Paper elevation={0} sx={{ border: `1px solid ${admin.line}`, borderRadius: '12px', bgcolor: admin.surface, overflow: 'hidden' }}>
        <Box sx={{ p: '12px 18px', borderBottom: `1px solid ${admin.line}` }}><Typography variant="h4">Summary</Typography></Box>
        <Box component="dl" sx={{ m: 0, p: '14px 18px', display: 'grid', gap: 1.5, fontSize: 14, lineHeight: 1.4 }}>
          {/* [CONCEPT: List rendering and keys] Each row's label is unique, so it serves as the key. */}
          {rows.map(([k, v]) => (
            <div key={k}>
              <Box component="dt" sx={{ fontSize: 12, color: admin.muted }}>{k}</Box>
              <Box component="dd" sx={{ m: '2px 0 0', overflowWrap: 'anywhere' }}>{v}</Box>
            </div>
          ))}
        </Box>
      </Paper>
      {/* [CONCEPT: Conditional rendering] The parent hides the workflow on mobile (or when the prop is false). */}
      {showWorkflow && (
        <Box sx={{ border: `1px solid ${admin.line}`, borderRadius: '12px', p: '14px 18px', display: 'grid', gap: 1.5 }}>
          <Typography variant="h4">What happens next</Typography>
          <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1.25 }}>
            {WORKFLOW.map(([name, desc], i) => (
              <Box component="li" key={name} sx={{ display: 'grid', gridTemplateColumns: '10px minmax(0,1fr)', gap: 1.25, fontSize: 13, lineHeight: 1.4 }}>
                {/* First step (Open) is highlighted: that is where a new ticket starts. */}
                <Box component="span" sx={{ width: 8, height: 8, mt: '5px', borderRadius: '50%', bgcolor: i === 0 ? admin.red : admin.tanLight }} />
                <span><Box component="span" sx={{ fontWeight: 500 }}>{name}</Box> <Box component="span" sx={{ color: admin.muted }}>· {desc}</Box></span>
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}
