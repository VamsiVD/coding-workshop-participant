// Engineer list for the engineers page: one row per profile with load, an
// availability switch and edit / deactivate buttons. Inactive accounts are
// muted and read-only. Purely presentational; actions go back to the page.
import { Box, Chip, IconButton, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip } from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import PersonOffOutlinedIcon from '@mui/icons-material/PersonOffOutlined';
import { admin } from '../../../../theme/adminTheme';
import { Dot } from '../../components/Panel';
import { availabilityOf, isFull } from '../engineersModel';

// "3 / 6" with a small bar; unknown load shows a dash.
function Load({ e }) {
  if (e.activeTickets == null) return <Box sx={{ color: admin.faint }}>— / {e.capacity}</Box>;
  const pct = Math.min(100, (e.activeTickets / e.capacity) * 100);
  return (
    <Box sx={{ display: 'grid', gap: 0.5, minWidth: 72 }}>
      <Box sx={{ fontSize: 13.5 }}><b style={{ fontWeight: 600 }}>{e.activeTickets}</b> / {e.capacity}</Box>
      <Box sx={{ height: 4, bgcolor: admin.track, borderRadius: 2, overflow: 'hidden' }}>
        <Box sx={{ height: '100%', width: `${pct}%`, bgcolor: isFull(e) ? admin.danger : admin.brown }} />
      </Box>
    </Box>
  );
}

// [CONCEPT: Props] `pending` is the id whose availability is being saved, so only that switch is disabled.
export default function EngineerTable({ engineers, pending, onEdit, onToggle, onDeactivate }) {
  return (
    <TableContainer>
      <Table size="small" sx={{ '& td': { py: 1.25 } }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ pl: 2 }}>Engineer</TableCell>
            {/* [CONCEPT: Responsive design] Less important columns drop out on narrow screens; the name cell repeats the key facts. */}
            <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Specialisation</TableCell>
            <TableCell sx={{ width: 110, display: { xs: 'none', sm: 'table-cell' } }}>Tickets</TableCell>
            <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}>Phone</TableCell>
            <TableCell sx={{ width: 170 }}>Availability</TableCell>
            {/* position: relative anchors the screen-reader-only label inside this cell; without it the label escapes and widens the page on phones. */}
            <TableCell sx={{ width: 96, pr: 2, position: 'relative' }} align="right"><Box component="span" sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>Actions</Box></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {/* [CONCEPT: List rendering and keys] user ids are stable across edits, unlike list positions. */}
          {engineers.map((e) => {
            const av = availabilityOf(e);
            return (
              <TableRow key={e.id} sx={{ opacity: e.isActive ? 1 : 0.55, bgcolor: e.isActive ? 'transparent' : admin.track }}>
                <TableCell sx={{ pl: 2 }}>
                  <Box sx={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    {e.name}
                    {!e.isActive && <Chip label="Inactive" size="small" sx={{ bgcolor: admin.surface, color: admin.muted, border: `1px solid ${admin.line}` }} />}
                  </Box>
                  <Box sx={{ fontSize: 12.5, color: admin.muted, wordBreak: 'break-all' }}>{e.email}</Box>
                  {/* Shown only where the Specialisation / Tickets columns are hidden. */}
                  <Box sx={{ display: { xs: 'block', md: 'none' }, fontSize: 12.5, color: admin.muted }}>
                    {e.specialization ?? 'General facilities'}
                    <Box component="span" sx={{ display: { sm: 'none' } }}>{e.activeTickets != null ? ` · ${e.activeTickets}/${e.capacity} tickets` : ''}</Box>
                  </Box>
                </TableCell>
                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' }, fontSize: 13.5, color: e.specialization ? admin.ink : admin.faint }}>
                  {e.specialization ?? 'General facilities'}
                </TableCell>
                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}><Load e={e} /></TableCell>
                <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' }, fontSize: 13.5, color: e.phone ? admin.ink : admin.faint }}>{e.phone ?? '—'}</TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {/* [CONCEPT: Accessibility] The switch gets a spoken name, since its visible label is the status, not the action. */}
                    {e.isActive && (
                      <Switch
                        size="small"
                        checked={e.isAvailable}
                        disabled={pending === e.id}
                        onChange={(ev) => onToggle(e, ev.target.checked)}
                        slotProps={{ input: { 'aria-label': `${e.name} available for new work` } }}
                      />
                    )}
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, fontSize: 13.5 }}><Dot color={av.color} />{av.label}</Box>
                  </Box>
                </TableCell>
                <TableCell align="right" sx={{ pr: 2, whiteSpace: 'nowrap' }}>
                  {e.isActive && (
                    <>
                      <Tooltip title="Edit profile"><IconButton size="small" aria-label={`Edit ${e.name}`} onClick={() => onEdit(e)}><EditOutlinedIcon fontSize="small" /></IconButton></Tooltip>
                      <Tooltip title="Deactivate"><IconButton size="small" aria-label={`Deactivate ${e.name}`} onClick={() => onDeactivate(e)} sx={{ color: admin.dangerFg }}><PersonOffOutlinedIcon fontSize="small" /></IconButton></Tooltip>
                    </>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
