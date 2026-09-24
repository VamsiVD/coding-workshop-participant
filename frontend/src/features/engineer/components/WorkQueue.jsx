// The engineer's work list: tickets assigned to them, or the pool of open,
// unassigned jobs they can request. Clicking a row opens it in the drawer.
import { Box, Button, InputAdornment, MenuItem, Paper, Select, TextField, ToggleButton, ToggleButtonGroup } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { admin } from '../../../theme/adminTheme';
import { PRIORITY_TAG, STATUS_DOT, locationLine, rowAction, timeAgo } from '../engineerModel';

const segSx = {
  '& .MuiToggleButton-root': {
    textTransform: 'none', fontSize: 13, py: 0.75, px: 1.75, whiteSpace: 'nowrap', color: admin.ink, borderColor: admin.line,
    '&.Mui-selected, &.Mui-selected:hover': { bgcolor: admin.red, color: '#fff' },
  },
};

// Tabbed list: "Assigned to me" and "Open jobs", with search and pool filters.
// [CONCEPT: Lifting state up] The tab, query and filters live in the page; this component only shows them and reports changes.
export default function WorkQueue({
  tab, onTab, tabs, rows, myId, skills, query, onQuery,
  matchOnly, onMatchOnly, building, buildings, onBuilding, onOpen, emptyText,
}) {
  return (
    <Paper component="section" elevation={0} sx={{ border: `1px solid ${admin.line}`, borderRadius: '12px', overflow: 'hidden', bgcolor: admin.surface }}>
      <Box sx={{ p: '12px 16px', borderBottom: `1px solid ${admin.line}`, display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
        <ToggleButtonGroup exclusive size="small" value={tab} onChange={(_, v) => v && onTab(v)} aria-label="Queue" sx={segSx}>
          {tabs.map((t) => <ToggleButton key={t.value} value={t.value}>{t.label}</ToggleButton>)}
        </ToggleButtonGroup>
        {/* [CONCEPT: Conditional rendering] Pool filters appear only on the Open jobs tab. */}
        {tab === 'pool' && (
          <>
            <Button size="small" variant={matchOnly ? 'contained' : 'outlined'} color={matchOnly ? 'primary' : 'secondary'} aria-pressed={matchOnly} onClick={() => onMatchOnly(!matchOnly)} sx={{ whiteSpace: 'nowrap' }}>
              Matches my skills
            </Button>
            <Select size="small" value={building} onChange={(e) => onBuilding(e.target.value)} inputProps={{ 'aria-label': 'Building' }} sx={{ fontSize: 13, bgcolor: admin.bg }}>
              {buildings.map((b) => <MenuItem key={b} value={b}>{b}</MenuItem>)}
            </Select>
          </>
        )}
        <TextField slotProps={{ htmlInput: { 'aria-label': 'Search tickets' }, input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" sx={{ color: admin.faint }} /></InputAdornment> } }}
          size="small"
          placeholder="Search tickets"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
         
         
          sx={{ ml: 'auto', flex: '0 1 240px', minWidth: 0, '& .MuiOutlinedInput-root': { bgcolor: admin.bg } }}
        />
      </Box>

      {/* [CONCEPT: List rendering and keys] Each row is keyed by its incident ref. */}
      {rows.map((i) => {
        const mine = i.assigneeId === myId;
        const action = rowAction(i, myId);
        const primary = action === 'Start' || action === 'Request';
        const flag = mine
          ? (i.status === 'Blocked' ? `Blocked: ${i.blockedReason}` : i.status === 'Open' ? 'New for you. Not started yet.' : '')
          : (skills.includes(i.category) ? 'Matches your skills' : '');
        const [pBg, pFg] = PRIORITY_TAG[i.priority];
        return (
          <Box
            key={i.ref}
            onClick={() => onOpen(i.ref)}
            sx={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: '8px 18px', alignItems: 'center', p: '14px 16px', borderBottom: `1px solid ${admin.line}`, cursor: 'pointer', '&:hover': { bgcolor: admin.sand } }}
          >
            <Box sx={{ minWidth: 0, display: 'grid', gap: 0.75 }}>
              <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <Box component="span" sx={{ fontWeight: 600, fontSize: 14, color: admin.brown }}>{i.ref}</Box>
                <Box component="span" sx={{ fontWeight: 500, minWidth: 0 }}>{i.title}</Box>
              </Box>
              <Box sx={{ fontSize: 12.5, color: admin.muted }}>{[locationLine(i), i.category, i.reporter, timeAgo(i.createdAt)].join(' · ')}</Box>
              {flag && <Box sx={{ fontSize: 13, color: mine && i.status === 'Blocked' ? admin.dangerFg : admin.brown }}>{flag}</Box>}
            </Box>
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <Box component="span" sx={{ px: 1.25, py: 0.25, borderRadius: 999, fontSize: 12, fontWeight: 500, bgcolor: pBg, color: pFg }}>{i.priority}</Box>
              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.875, fontSize: 13.5, minWidth: 96 }}>
                <Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: STATUS_DOT[i.status] }} />{i.status}
              </Box>
              <Button
                size="small"
                variant={primary ? 'contained' : 'outlined'}
                color={primary ? 'primary' : 'secondary'}
                onClick={(e) => { e.stopPropagation(); onOpen(i.ref); }} // stopPropagation: the row's own click would open it twice
                sx={{ minWidth: 92, whiteSpace: 'nowrap' }}
              >
                {action}
              </Button>
            </Box>
          </Box>
        );
      })}
      {rows.length === 0 && <Box sx={{ p: '40px 16px', textAlign: 'center', fontSize: 14, color: admin.muted }}>{emptyText}</Box>}
    </Paper>
  );
}
