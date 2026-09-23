import { Box, ButtonBase, Link, OutlinedInput, Paper, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { crate, fonts } from '../../../theme/crateTheme';
import { flowBars, timeAgo } from '../ticketModel';
import StatusChip from './StatusChip';

const FILTERS = [['active', 'Active'], ['resolved', 'Resolved'], ['all', 'All']];

function updatedLabel(t) {
  if (t.status === 'Closed') return `Closed ${timeAgo(t.updatedAt)}`;
  if (t.status === 'Resolved') return `Resolved ${timeAgo(t.updatedAt)}`;
  if (t.updatedAt === t.createdAt) return `Reported ${timeAgo(t.createdAt)}`;
  return `Updated ${timeAgo(t.updatedAt)}`;
}

export default function TicketList({ tickets, filter, onFilterChange, query, onQueryChange, onOpen }) {
  return (
    <Paper component="section" elevation={0} sx={{ border: `2px solid ${crate.ink}`, boxShadow: `6px 6px 0 ${crate.ink}` }}>
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap', px: 2, py: 1.5, borderBottom: `2px solid ${crate.ink}` }}>
        <Box component="h2" sx={{ m: 0, fontFamily: fonts.heading, fontWeight: 600, fontSize: 15, letterSpacing: '.12em', textTransform: 'uppercase' }}>My tickets</Box>
        <ToggleButtonGroup exclusive value={filter} onChange={(_, v) => v && onFilterChange(v)} aria-label="Filter tickets" sx={{ border: `2px solid ${crate.ink}`, bgcolor: crate.field }}>
          {FILTERS.map(([value, label], i) => (
            <ToggleButton
              key={value}
              value={value}
              sx={{ height: 32, px: 1.5, border: 'none !important', borderLeft: i ? `2px solid ${crate.ink} !important` : 'none !important', fontFamily: fonts.heading, fontWeight: 500, fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase', bgcolor: 'transparent' }}
            >
              {label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <OutlinedInput
          placeholder="Search my tickets"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          inputProps={{ 'aria-label': 'Search my tickets' }}
          sx={{ ml: 'auto', flex: '0 1 240px', minWidth: 0, '& input': { py: '7px', px: '10px', fontSize: 13.5 } }}
        />
      </Box>

      {tickets.map((t) => (
        <ButtonBase
          key={t.ref}
          onClick={() => onOpen(t.ref)}
          sx={{ width: '100%', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: '8px 18px', alignItems: 'center', textAlign: 'left', px: 2, py: 1.5, borderBottom: '1px solid rgba(42,29,20,.15)', fontFamily: fonts.body, '&:hover': { bgcolor: crate.tint }, '&:focus-visible': { outline: `2px solid ${crate.red}`, outlineOffset: -2 } }}
        >
          <Box sx={{ minWidth: 0, display: 'grid', gap: 0.75 }}>
            <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <Box component="span" sx={{ flex: 'none', whiteSpace: 'nowrap', fontFamily: fonts.heading, fontWeight: 600, fontSize: 12.5, letterSpacing: '.06em' }}>{t.ref}</Box>
              <Box component="span" sx={{ minWidth: 0, fontSize: 14.5, fontWeight: 700, lineHeight: 1.3 }}>{t.title}</Box>
            </Box>
            <Box role="img" aria-label={`Status: ${t.status}`} sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 52px))', gap: '3px' }}>
              {flowBars(t.status).map((b) => <Box key={b.name} component="span" sx={{ height: 5, bgcolor: b.color }} />)}
            </Box>
            <Box sx={{ fontSize: 12.5 }}>{[t.category, t.engineer ?? 'Unassigned', updatedLabel(t)].join(' · ')}</Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {t.unreadCount > 0 && (
              <Box component="span" sx={{ fontSize: 12, fontWeight: 700, color: crate.redDeep, whiteSpace: 'nowrap' }}>{t.unreadCount} new {t.unreadCount === 1 ? 'note' : 'notes'}</Box>
            )}
            <StatusChip status={t.status} size="sm" />
          </Box>
        </ButtonBase>
      ))}

      {tickets.length === 0 && (
        <Box sx={{ py: 4, px: 2, textAlign: 'center', fontSize: 14 }}>
          No tickets here. <Link href="/incidents/new">Report an incident</Link>
        </Box>
      )}
    </Paper>
  );
}
