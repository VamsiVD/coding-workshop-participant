// "My tickets" list on the employee dashboard: filter toggles, a search box
// and one clickable row per ticket. Filter and search state live in the page;
// this component just displays them and reports changes.
import { Box, Chip, InputAdornment, Link, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { admin } from '../../../theme/adminTheme';
import { flowBars, timeAgo } from '../ticketModel';
import StatusChip from './StatusChip';

// [value, label] pairs; the values match the FILTERS keys in DashboardPage.
const FILTERS = [['active', 'Active'], ['resolved', 'Resolved'], ['all', 'All']];

// Closed/resolved tickets read better dated by when that happened, not by
// when they were last touched before that.
function updatedLabel(t) {
  if (t.status === 'Closed') return `Closed ${timeAgo(t.updatedAt)}`;
  if (t.status === 'Resolved') return `Resolved ${timeAgo(t.updatedAt)}`;
  if (t.updatedAt === t.createdAt) return `Reported ${timeAgo(t.createdAt)}`;
  return `Updated ${timeAgo(t.updatedAt)}`;
}

// [CONCEPT: Lifting state up] No state of its own: filter/query arrive as props and changes go back via onFilterChange/onQueryChange.
export default function TicketList({ tickets, filter, onFilterChange, query, onQueryChange, onOpen }) {
  return (
    <Box component="section" id="tickets" sx={{ border: `1px solid ${admin.line}`, borderRadius: '12px', overflow: 'hidden', bgcolor: admin.surface }}>
      <Box sx={{ p: '12px 16px', borderBottom: `1px solid ${admin.line}`, display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography variant="h2" sx={{ mr: 1 }}>My tickets</Typography>
        {/* [CONCEPT: MUI component] Exclusive ToggleButtonGroup; `v &&` ignores the null sent when the selected button is clicked again. */}
        <ToggleButtonGroup
          exclusive
          size="small"
          value={filter}
          onChange={(_, v) => v && onFilterChange(v)}
          aria-label="Filter tickets"
          sx={{ '& .MuiToggleButton-root': { textTransform: 'none', px: 1.75, color: admin.ink }, '& .Mui-selected': { bgcolor: `${admin.red} !important`, color: '#fff !important' } }}
        >
          {FILTERS.map(([v, l]) => <ToggleButton key={v} value={v}>{l}</ToggleButton>)}
        </ToggleButtonGroup>
        {/* [CONCEPT: Controlled input] Controlled by the parent: value is `query`, and typing calls onQueryChange. */}
        <TextField slotProps={{ htmlInput: { 'aria-label': 'Search my tickets' }, input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
          size="small"
          placeholder="Search my tickets"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
         
          sx={{ ml: 'auto', flex: '0 1 260px', minWidth: 0, '& .MuiOutlinedInput-root': { bgcolor: admin.bg } }}
         
        />
      </Box>

      {/* [CONCEPT: List rendering and keys] One row per ticket, keyed by its unique ref. */}
      {tickets.map((t) => (
        // [CONCEPT: Accessibility] A div acting as a button: role, tabIndex and an Enter/Space key handler make it
        // keyboard-usable (preventDefault stops Space from scrolling the page).
        <Box
          key={t.ref}
          role="button"
          tabIndex={0}
          onClick={() => onOpen(t.ref)}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen(t.ref))}
          sx={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: '8px 18px', alignItems: 'center', p: '14px 16px', borderBottom: `1px solid ${admin.line}`, cursor: 'pointer', '&:hover, &:focus-visible': { bgcolor: admin.sand, outline: 'none' } }}
        >
          <Box sx={{ minWidth: 0, display: 'grid', gap: 0.9 }}>
            <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <Box component="span" sx={{ flex: 'none', fontWeight: 600, fontSize: 14, color: admin.brown }}>{t.ref}</Box>
              <Box component="span" sx={{ minWidth: 0, fontWeight: 500 }}>{t.title}</Box>
            </Box>
            <Box role="img" aria-label={`Status: ${t.status}`} sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 52px))', gap: '3px' }}>
              {flowBars(t.status).map((b) => <Box key={b.name} component="span" sx={{ height: 4, borderRadius: 2, bgcolor: b.color }} />)}
            </Box>
            <Box sx={{ fontSize: 12.5, color: admin.muted }}>{[t.category, t.engineer ?? 'Unassigned', updatedLabel(t)].join(' · ')}</Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {/* [CONCEPT: Conditional rendering] The unread badge appears only when there is something new. */}
            {t.unreadCount > 0 && <Chip label={`${t.unreadCount} new`} sx={{ bgcolor: admin.red, color: '#fff' }} />}
            <Box sx={{ minWidth: 96 }}><StatusChip status={t.status} /></Box>
          </Box>
        </Box>
      ))}

      {tickets.length === 0 && (
        <Box sx={{ py: 5, px: 2, textAlign: 'center', fontSize: 14, color: admin.muted }}>
          {/* [CONCEPT: Client-side routing] A plain href: App.jsx picks the page from window.location, so this does a full page load. */}
          No tickets here. <Link href="/incidents/new">Report an incident</Link>
        </Box>
      )}
    </Box>
  );
}
