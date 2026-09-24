// "All people" tab of the engineers page: every account with search and role
// filters, and the rename, change-role and (de)activate dialogs. Data comes
// from usePeople; after each change the page is told, so the Engineers tab
// reloads too and both lists agree.
import { useState } from 'react';
import { Alert, Box, Button, CircularProgress, FormControlLabel, InputAdornment, LinearProgress, Switch, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { admin } from '../../../../theme/adminTheme';
import usePeople from '../usePeople';
import { ROLE_FILTERS, withArticle } from '../peopleModel';
import PeopleTable from './PeopleTable';
import RenameDialog from './RenameDialog';
import RoleChangeDialog from './RoleChangeDialog';
import AccountStatusDialog from './AccountStatusDialog';

// [CONCEPT: Props] `engineers` (from the page) supplies active ticket counts for early warnings;
// onChanged lets the page refresh its engineer list; onToast shows the page's Snackbar.
export default function PeopleTab({ meId, categories, engineers, onChanged, onToast }) {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [includeInactive, setIncludeInactive] = useState(true);
  const { people, loading, loadError, reload, update } = usePeople({ q: query, role: ROLE_FILTERS[filter][1], includeInactive });
  // Open dialogs: the person being renamed / (de)activated, and { person, role } for a role change.
  const [renaming, setRenaming] = useState(null);
  const [roleChange, setRoleChange] = useState(null);
  const [statusOf, setStatusOf] = useState(null);

  // [CONCEPT: Derived state] Active ticket count for an engineer, if the workload report knows it.
  const heldBy = (person) => engineers.find((e) => e.id === person?.id)?.activeTickets ?? null;

  // Each action awaits the server; a rejection keeps its dialog open with the message.
  const rename = async (person, name) => {
    const saved = await update(person.id, { name });
    setRenaming(null);
    onChanged();
    onToast({ severity: 'success', text: `Renamed to ${saved.name}` });
  };

  const changeRole = async (person, changes) => {
    const saved = await update(person.id, changes);
    setRoleChange(null);
    onChanged();
    onToast({ severity: 'success', text: `${saved.name} is now ${withArticle(saved.role)}` });
  };

  const setActive = async (person, isActive) => {
    const saved = await update(person.id, { isActive });
    setStatusOf(null);
    onChanged();
    onToast({ severity: 'success', text: `${saved.name} ${isActive ? 'reactivated' : 'deactivated'}` });
  };

  const searching = query.trim().length >= 2;

  return (
    <Box component="section" sx={{ border: `1px solid ${admin.line}`, borderRadius: '12px', overflow: 'hidden', bgcolor: admin.surface }}>
      <Box sx={{ p: '12px 16px', borderBottom: `1px solid ${admin.line}`, display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* [CONCEPT: MUI component] Same exclusive toggle group as the Engineers tab; null (re-click) is ignored. */}
        <ToggleButtonGroup
          exclusive
          size="small"
          value={filter}
          onChange={(_, v) => v && setFilter(v)}
          aria-label="Filter by role"
          sx={{ flexWrap: 'wrap', '& .MuiToggleButton-root': { textTransform: 'none', px: 1.5, color: admin.ink }, '& .Mui-selected': { bgcolor: `${admin.red} !important`, color: '#fff !important' } }}
        >
          {Object.entries(ROLE_FILTERS).map(([k, [label]]) => <ToggleButton key={k} value={k}>{label}</ToggleButton>)}
        </ToggleButtonGroup>
        <FormControlLabel
          control={<Switch size="small" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />}
          label="Include inactive"
          sx={{ mr: 0, '& .MuiFormControlLabel-label': { fontSize: 13.5 } }}
        />
        {people && <Typography sx={{ fontSize: 13, color: admin.muted }}>{people.length} {people.length === 1 ? 'person' : 'people'}</Typography>}
        {/* [CONCEPT: Controlled input] The search text lives in state; usePeople sends it to the server after a pause. */}
        <TextField slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }, htmlInput: { 'aria-label': 'Search people' } }}
          size="small"
          placeholder="Search name or email"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          helperText={query.trim().length === 1 ? 'Type at least 2 characters' : undefined}
          sx={{ ml: { sm: 'auto' }, flex: { xs: '1 1 100%', sm: '0 1 300px' }, minWidth: 0, '& .MuiOutlinedInput-root': { bgcolor: admin.bg } }}
        />
      </Box>

      {/* A thin bar while a refresh runs over rows already on screen. */}
      {loading && people && <LinearProgress color="secondary" sx={{ height: 2 }} />}

      {/* [CONCEPT: Loading and error state] Spinner for the first load, a retry on failure, then the table or an empty state. */}
      {loadError ? (
        <Box sx={{ p: 2 }}>
          <Alert severity="error" action={<Button color="inherit" size="small" onClick={reload}>Retry</Button>}>{loadError}</Alert>
        </Box>
      ) : !people ? (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}><CircularProgress color="secondary" /></Box>
      ) : people.length > 0 ? (
        <PeopleTable
          people={people}
          meId={meId}
          onRename={setRenaming}
          onChangeRole={(person, role) => setRoleChange({ person, role })}
          onToggleActive={setStatusOf}
        />
      ) : (
        <Box sx={{ py: 6, px: 2, textAlign: 'center', fontSize: 14, color: admin.muted }}>
          {searching ? `Nobody matches “${query.trim()}” in this view.` : 'Nobody in this view.'}
        </Box>
      )}

      {/* [CONCEPT: Lifting state up] The dialogs hold drafts; which person is open, and saving, live here. */}
      <RenameDialog person={renaming} onClose={() => setRenaming(null)} onSave={rename} />
      <RoleChangeDialog
        change={roleChange}
        categories={categories}
        heldTickets={heldBy(roleChange?.person)}
        onClose={() => setRoleChange(null)}
        onConfirm={changeRole}
      />
      <AccountStatusDialog person={statusOf} heldTickets={heldBy(statusOf)} onClose={() => setStatusOf(null)} onConfirm={setActive} />
    </Box>
  );
}
