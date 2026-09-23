import { useMemo, useState } from 'react';
import { Box, Button, ButtonBase, Chip, InputAdornment, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { admin } from '../../../theme/adminTheme';
import { FILTERS, PRIORITY_STYLE, STATUS_DOT, age, isBlocked, isEscalation, isUnassigned, placeLine, rowAction, rowFlag } from '../adminModel';
import { Dot } from './Panel';

const CARDS = [
  { key: 'unassigned', label: 'Unassigned', hint: 'Open tickets with no engineer', dot: admin.tan, test: isUnassigned },
  { key: 'escalation', label: 'Escalation requests', hint: 'Reporters asking for higher priority', dot: admin.brown, test: isEscalation },
  { key: 'blocked', label: 'Blocked', hint: 'Waiting on parts, access or vendors', dot: admin.danger, test: isBlocked },
];
const SCOPES = [['action', 'Needs action'], ['active', 'All open'], ['all', 'Everything']];

export default function QueueTab({ incidents, engineerName, onOpen }) {
  const [filter, setFilter] = useState('action');
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return incidents
      .filter(FILTERS[filter])
      .filter((i) => !q || [i.ref, i.title, i.building, i.category, engineerName(i) || ''].join(' ').toLowerCase().includes(q));
  }, [incidents, filter, query, engineerName]);

  return (
    <Box sx={{ display: 'grid', gap: 3 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 2 }}>
        {CARDS.map((c) => {
          const on = filter === c.key;
          return (
            <ButtonBase
              key={c.key}
              aria-pressed={on}
              onClick={() => setFilter(on ? 'action' : c.key)}
              sx={{ display: 'grid', gap: 0.75, textAlign: 'left', justifyItems: 'stretch', p: '16px 18px', borderRadius: '12px', border: `1px solid ${on ? admin.red : admin.line}`, bgcolor: on ? admin.sand : 'transparent', '&:hover': { borderColor: admin.red } }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', color: admin.muted }}>
                {c.label}<Dot color={c.dot} />
              </Box>
              <Box sx={{ fontWeight: 600, fontSize: 40, lineHeight: 1 }}>{incidents.filter(c.test).length}</Box>
              <Box sx={{ fontSize: 13, color: admin.muted }}>{c.hint}</Box>
            </ButtonBase>
          );
        })}
      </Box>

      <Box component="section" sx={{ border: `1px solid ${admin.line}`, borderRadius: '12px', overflow: 'hidden', bgcolor: admin.surface }}>
        <Box sx={{ p: '12px 16px', borderBottom: `1px solid ${admin.line}`, display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={SCOPES.some((s) => s[0] === filter) ? filter : null}
            onChange={(_, v) => v && setFilter(v)}
            sx={{ '& .MuiToggleButton-root': { textTransform: 'none', px: 1.75, color: admin.ink }, '& .Mui-selected': { bgcolor: `${admin.red} !important`, color: '#fff !important' } }}
          >
            {SCOPES.map(([v, l]) => <ToggleButton key={v} value={v}>{l}</ToggleButton>)}
          </ToggleButtonGroup>
          <Typography sx={{ fontSize: 13, color: admin.muted }}>{rows.length} {rows.length === 1 ? 'incident' : 'incidents'}</Typography>
          <TextField
            size="small"
            placeholder="Search by ref, title, engineer"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            sx={{ ml: 'auto', flex: '0 1 300px', minWidth: 0, '& .MuiOutlinedInput-root': { bgcolor: admin.bg } }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
          />
        </Box>

        <TableContainer>
          <Table size="small" sx={{ '& td': { verticalAlign: 'top', py: 1.5 } }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 92, pl: 2 }}>Ref</TableCell>
                <TableCell>Incident</TableCell>
                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Assignee</TableCell>
                <TableCell sx={{ width: 96 }}>Priority</TableCell>
                <TableCell sx={{ width: 118, display: { xs: 'none', sm: 'table-cell' } }}>Status</TableCell>
                <TableCell sx={{ width: 60, display: { xs: 'none', md: 'table-cell' } }}>Age</TableCell>
                <TableCell sx={{ width: 110, pr: 2 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((i) => {
                const act = rowAction(i);
                const flag = rowFlag(i);
                const [pBg, pFg] = PRIORITY_STYLE[i.priority];
                const who = engineerName(i);
                return (
                  <TableRow key={i.ref} hover onClick={() => onOpen(i.ref)} sx={{ cursor: 'pointer' }}>
                    <TableCell sx={{ pl: 2, fontWeight: 600, fontSize: 14, color: admin.brown }}>{i.ref}</TableCell>
                    <TableCell>
                      <Box sx={{ fontWeight: 500 }}>{i.title}</Box>
                      <Box sx={{ fontSize: 12.5, color: admin.muted }}>{placeLine(i)} · {i.category}</Box>
                      {flag && <Box sx={{ fontSize: 12.5, mt: 0.4, color: flag.color }}>{flag.text}</Box>}
                    </TableCell>
                    <TableCell sx={{ display: { xs: 'none', md: 'table-cell' }, fontSize: 13.5, color: who ? admin.ink : admin.faint }}>{who || 'Unassigned'}</TableCell>
                    <TableCell><Chip label={i.priority} sx={{ bgcolor: pBg, color: pFg }} /></TableCell>
                    <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.9, fontSize: 13.5 }}><Dot color={STATUS_DOT[i.status]} />{i.status}</Box>
                    </TableCell>
                    <TableCell sx={{ display: { xs: 'none', md: 'table-cell' }, fontSize: 13.5, color: admin.muted }}>{age(i.createdAt)}</TableCell>
                    <TableCell align="right" sx={{ pr: 2 }}>
                      <Button size="small" variant={act.variant} color={act.variant === 'text' ? 'secondary' : 'primary'} sx={{ minWidth: 84 }}>{act.label}</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {rows.length === 0 && <Box sx={{ py: 6, textAlign: 'center', fontSize: 14, color: admin.muted }}>No incidents match this view.</Box>}
        </TableContainer>
      </Box>
    </Box>
  );
}
