import { Alert, Box, Button, Paper, Typography } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import { admin } from '../../../../theme/adminTheme';
import { dashboardHref } from '../../../dashboard/ticketModel';

export default function SubmittedCard({ ticket, location, onReportAnother }) {
  const escalated = ticket.escalated === true;
  return (
    <Paper elevation={0} role="status" sx={{ maxWidth: 640, border: `1px solid ${admin.line}`, borderRadius: '16px', bgcolor: admin.surface, p: '28px 28px 24px', display: 'grid', gap: 2.25 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: admin.sand, color: admin.red, display: 'grid', placeItems: 'center' }}><CheckIcon /></Box>
        <div>
          <Typography sx={{ fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase', color: admin.brown }}>Submitted</Typography>
          <Typography variant="h2" sx={{ fontSize: 26 }}>Ticket {ticket.ref}</Typography>
        </div>
      </Box>
      <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0,1fr))' }, gap: 1.75, fontSize: 14, borderTop: `1px solid ${admin.line}`, borderBottom: `1px solid ${admin.line}`, py: 1.75 }}>
        {[['Status', ticket.status], ['Location', location], ['Priority', escalated ? `${ticket.priority} · escalation requested` : ticket.priority]].map(([k, v]) => (
          <div key={k}>
            <Box component="dt" sx={{ fontSize: 12, color: admin.muted }}>{k}</Box>
            <Box component="dd" sx={{ m: 0 }}>{v}</Box>
          </div>
        ))}
      </Box>
      {ticket.escalated === null && (
        <Alert severity="error" sx={{ borderRadius: '10px' }}>The ticket was created, but the escalation request failed. Request it again from the ticket.</Alert>
      )}
      <Typography sx={{ fontSize: 14, lineHeight: 1.55, color: '#4a3b2c' }}>
        {escalated
          ? 'Your escalation request is with a facility admin for review.'
          : 'A facility admin will assign an engineer. Follow progress and add notes from your dashboard.'}
      </Typography>
      <Box sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap' }}>
        <Button variant="contained" href={dashboardHref(ticket.ref)}>Track this ticket</Button>
        <Button variant="outlined" color="secondary" onClick={onReportAnother} sx={{ bgcolor: admin.bg }}>Report another</Button>
      </Box>
    </Paper>
  );
}
