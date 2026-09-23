import { Alert, Box, Button, Link, Paper, Stack } from '@mui/material';
import { dashboardHref } from '../../../dashboard/ticketModel';
import { crate, fonts } from '../../../../theme/crateTheme';

const dt = { fontFamily: fonts.heading, fontWeight: 500, fontSize: 12, letterSpacing: '.12em', textTransform: 'uppercase', pt: '2px' };

export default function SubmittedCard({ ticket, location, onReportAnother }) {
  const escalated = ticket.escalated === true;
  return (
    <Paper elevation={0} sx={{ maxWidth: 680, border: `2px solid ${crate.ink}`, boxShadow: `6px 6px 0 ${crate.ink}`, p: { xs: 2.5, sm: '28px 32px' } }}>
      <Stack spacing={2.25}>
        <Box sx={{ alignSelf: 'flex-start', border: `3px double ${crate.red}`, color: crate.red, px: 1.75, py: 0.625, fontFamily: fonts.stencil, fontWeight: 900, fontSize: 22, letterSpacing: '.16em' }}>SUBMITTED</Box>
        <Box sx={{ fontFamily: fonts.heading, fontWeight: 600, fontSize: 26, letterSpacing: '.04em' }}>Ticket {ticket.ref}</Box>
        <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: 'max-content minmax(0,1fr)', gap: '8px 24px', borderTop: `2px solid ${crate.ink}`, borderBottom: `2px solid ${crate.ink}`, py: 1.5, fontSize: 14 }}>
          <Box component="dt" sx={dt}>Status</Box><Box component="dd" sx={{ m: 0 }}>{ticket.status}</Box>
          <Box component="dt" sx={dt}>Location</Box><Box component="dd" sx={{ m: 0 }}>{location}</Box>
          <Box component="dt" sx={dt}>Priority</Box><Box component="dd" sx={{ m: 0 }}>{ticket.priority}{escalated ? ' · escalation requested' : ''}</Box>
        </Box>
        {ticket.escalated === null && (
          <Alert severity="error">The ticket was created, but the escalation request failed. Request it again from the ticket.</Alert>
        )}
        <Box sx={{ fontSize: 14, lineHeight: 1.55 }}>
          {escalated
            ? 'Your escalation request is with a facility admin for review.'
            : 'A facility admin will assign an engineer. Follow progress and add notes from your dashboard.'}
        </Box>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
          <Button variant="contained" href={dashboardHref(ticket.ref)}>Track this ticket</Button>
          <Link component="button" type="button" onClick={onReportAnother} sx={{ fontSize: 13 }}>Report another incident</Link>
        </Stack>
      </Stack>
    </Paper>
  );
}
