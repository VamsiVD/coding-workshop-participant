// Duplicate check shown under the Location section of the incident form.
import { Box, Link } from '@mui/material';
import { admin } from '../../../../theme/adminTheme';
import { STATUS_DOT, dashboardHref } from '../../../dashboard/ticketModel';

// Open tickets on the chosen floor, to cut duplicates. `mine` = ids of the
// caller's own incidents: employees can only open their own tickets, so only
// those get an "Add note" link.
// tickets = [{ ref, id, title, status }] from incidentApi.listOpenOnFloor;
// mine is a Set, so `mine.has(id)` is a quick lookup.
export default function SimilarTickets({ tickets, mine }) {
  // [CONCEPT: Conditional rendering] Returning null renders nothing at all.
  if (!tickets.length) return null;
  return (
    <Box sx={{ border: `1px solid ${admin.tanLight}`, borderRadius: '10px', bgcolor: admin.sand, overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.25, flexWrap: 'wrap', p: '10px 14px', fontSize: 13 }}>
        <Box component="span" sx={{ fontWeight: 500 }}>{tickets.length === 1 ? '1 open ticket on this floor' : `${tickets.length} open tickets on this floor`}</Box>
        <Box component="span" sx={{ color: admin.muted }}>Same issue? It’s already reported, so there’s no need for a new ticket.</Box>
      </Box>
      {/* [CONCEPT: List rendering and keys] The ticket ref (e.g. INC-0412) is unique, so it is a stable key. */}
      {tickets.map((t) => (
        <Box key={t.ref} sx={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr) auto auto', gap: 1.5, alignItems: 'center', p: '10px 14px', fontSize: 13.5, borderTop: '1px solid rgba(42,29,20,.12)' }}>
          <Box component="span" sx={{ fontWeight: 600, fontSize: 14, color: admin.brown }}>{t.ref}</Box>
          <Box component="span" sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</Box>
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, fontSize: 12.5, whiteSpace: 'nowrap' }}>
            {/* Coloured status dot; unknown statuses fall back to the Open colour. */}
            <Box component="span" sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: STATUS_DOT[t.status] ?? STATUS_DOT.Open }} />{t.status}
          </Box>
          {/* Own ticket: link to it on the dashboard to add a note; someone else's: plain label, since employees can't open it. */}
          {mine.has(t.id)
            ? <Link href={dashboardHref(t.ref)} sx={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>Add note</Link>
            : <Box component="span" sx={{ fontSize: 12, whiteSpace: 'nowrap', color: admin.muted }}>Colleague’s</Box>}
        </Box>
      ))}
    </Box>
  );
}
