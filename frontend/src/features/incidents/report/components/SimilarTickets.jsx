import { Box, Link } from '@mui/material';
import { dashboardHref } from '../../../dashboard/ticketModel';
import { crate, fonts } from '../../../../theme/crateTheme';

const STATUS = {
  Open: [crate.field, crate.ink],
  'In Progress': [crate.ink, crate.paper],
  Blocked: [crate.red, crate.paper],
};

// `mine` = ids of the caller's own incidents. Employees can only open their
// own tickets, so only those get an "Add note" link.
export default function SimilarTickets({ tickets, mine }) {
  if (!tickets.length) return null;
  return (
    <Box sx={{ border: `1.5px dashed ${crate.ink}`, bgcolor: crate.field }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.25, flexWrap: 'wrap', px: 1.5, py: 1, borderBottom: `1.5px dashed ${crate.ink}`, fontSize: 12.5 }}>
        <b>{tickets.length === 1 ? '1 open ticket on this floor' : `${tickets.length} open tickets on this floor`}</b>
        <span>Same issue? It’s already reported, so there’s no need for a new ticket.</span>
      </Box>
      {tickets.map((t) => {
        const [bg, fg] = STATUS[t.status] ?? STATUS.Open;
        return (
          <Box key={t.ref} sx={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr) auto auto', gap: 1.5, alignItems: 'center', px: 1.5, py: 1, fontSize: 13.5, borderTop: '1px solid rgba(42,29,20,.12)' }}>
            <Box component="span" sx={{ fontFamily: fonts.heading, fontWeight: 600, fontSize: 12.5, letterSpacing: '.06em' }}>{t.ref}</Box>
            <Box component="span" sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</Box>
            <Box component="span" sx={{ fontFamily: fonts.heading, fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', px: 0.875, py: 0.25, border: `1.5px solid ${crate.ink}`, bgcolor: bg, color: fg }}>{t.status}</Box>
            {mine.has(t.id)
              ? <Link href={dashboardHref(t.ref)} sx={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>Add note</Link>
              : <Box component="span" sx={{ fontSize: 12, whiteSpace: 'nowrap', opacity: 0.75 }}>Colleague’s</Box>}
          </Box>
        );
      })}
    </Box>
  );
}
