// Account list for the "All people" tab: one row per person with a role chip,
// status and rename / change role / (de)activate actions. The signed-in
// admin's own row keeps rename only, as the server refuses the rest (403).
// Presentational apart from the role menu's anchor; actions go back up.
import { useState } from 'react';
import { Box, Chip, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip } from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import PersonOffOutlinedIcon from '@mui/icons-material/PersonOffOutlined';
import HowToRegOutlinedIcon from '@mui/icons-material/HowToRegOutlined';
import CheckIcon from '@mui/icons-material/Check';
import { admin } from '../../../../theme/adminTheme';
import { Dot } from '../../components/Panel';
import { ROLES, ROLE_LABEL, roleStyle } from '../peopleModel';

const SELF_ROLE = 'You can’t change your own role';
const SELF_STATUS = 'You can’t deactivate yourself';

// Role chip, shared by the Role column and the phone layout under the name.
function RoleChip({ role }) {
  return <Chip label={ROLE_LABEL[role]} size="small" sx={{ ...roleStyle(role), fontWeight: 500 }} />;
}

// [CONCEPT: Props] `meId` marks the signed-in admin's row; the on* callbacks open the page's dialogs.
export default function PeopleTable({ people, meId, onRename, onChangeRole, onToggleActive }) {
  // [CONCEPT: useState] The open role menu: { anchor, person } or null.
  const [menu, setMenu] = useState(null);

  const pick = (role) => {
    const { person } = menu;
    setMenu(null);
    if (role !== person.role) onChangeRole(person, role);
  };

  return (
    <TableContainer>
      <Table size="small" sx={{ '& td': { py: 1.25 } }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ pl: 2 }}>Person</TableCell>
            {/* [CONCEPT: Responsive design] Role and status fold under the name on phones. */}
            <TableCell sx={{ width: 120, display: { xs: 'none', sm: 'table-cell' } }}>Role</TableCell>
            <TableCell sx={{ width: 110, display: { xs: 'none', sm: 'table-cell' } }}>Status</TableCell>
            <TableCell sx={{ width: 120, display: { xs: 'none', md: 'table-cell' } }}>Joined</TableCell>
            {/* position: relative keeps the screen-reader-only label inside the cell (no overflow on phones). */}
            <TableCell sx={{ width: 120, pr: 2, position: 'relative' }} align="right"><Box component="span" sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>Actions</Box></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {/* [CONCEPT: List rendering and keys] User ids are stable across edits. */}
          {people.map((p) => {
            const self = p.id === meId;
            return (
              <TableRow key={p.id} sx={{ opacity: p.isActive ? 1 : 0.6, bgcolor: p.isActive ? 'transparent' : admin.track }}>
                <TableCell sx={{ pl: 2 }}>
                  <Box sx={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    {p.name}
                    {self && <Chip label="You" size="small" variant="outlined" sx={{ borderColor: admin.line, color: admin.muted }} />}
                  </Box>
                  <Box sx={{ fontSize: 12.5, color: admin.muted, wordBreak: 'break-all' }}>{p.email}</Box>
                  <Box sx={{ display: { xs: 'flex', sm: 'none' }, gap: 1, alignItems: 'center', mt: 0.5, fontSize: 12.5, color: admin.muted }}>
                    <RoleChip role={p.role} />{p.isActive ? 'Active' : 'Inactive'}
                  </Box>
                </TableCell>
                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}><RoleChip role={p.role} /></TableCell>
                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, fontSize: 13.5 }}>
                    <Dot color={p.isActive ? admin.brown : admin.faint} />{p.isActive ? 'Active' : 'Inactive'}
                  </Box>
                </TableCell>
                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' }, fontSize: 13.5, color: admin.muted }}>
                  {new Date(p.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                </TableCell>
                <TableCell align="right" sx={{ pr: 2, whiteSpace: 'nowrap' }}>
                  <Tooltip title="Rename"><IconButton size="small" aria-label={`Rename ${p.name}`} onClick={() => onRename(p)}><EditOutlinedIcon fontSize="small" /></IconButton></Tooltip>
                  {/* [CONCEPT: Role-based rendering] Your own row keeps the buttons but disables them, with the reason.
                      A disabled button fires no events, so the Tooltip wraps a span that still can. */}
                  <Tooltip title={self ? SELF_ROLE : 'Change role'}>
                    <span>
                      <IconButton
                        size="small"
                        disabled={self}
                        aria-label={`Change role of ${p.name}`}
                        aria-haspopup="menu"
                        onClick={(ev) => setMenu({ anchor: ev.currentTarget, person: p })}
                      >
                        <ManageAccountsOutlinedIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title={self && p.isActive ? SELF_STATUS : p.isActive ? 'Deactivate' : 'Reactivate'}>
                    <span>
                      <IconButton
                        size="small"
                        disabled={self && p.isActive}
                        aria-label={`${p.isActive ? 'Deactivate' : 'Reactivate'} ${p.name}`}
                        onClick={() => onToggleActive(p)}
                        sx={{ color: p.isActive ? admin.dangerFg : admin.brown }}
                      >
                        {p.isActive ? <PersonOffOutlinedIcon fontSize="small" /> : <HowToRegOutlinedIcon fontSize="small" />}
                      </IconButton>
                    </span>
                  </Tooltip>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* [CONCEPT: MUI component] One menu for the whole table, anchored to the clicked button. */}
      <Menu anchorEl={menu?.anchor} open={!!menu} onClose={() => setMenu(null)}>
        {ROLES.map((r) => {
          const current = menu?.person.role === r;
          return (
            <MenuItem key={r} selected={current} onClick={() => pick(r)}>
              <ListItemIcon>{current && <CheckIcon fontSize="small" />}</ListItemIcon>
              <ListItemText>{ROLE_LABEL[r]}</ListItemText>
            </MenuItem>
          );
        })}
      </Menu>
    </TableContainer>
  );
}
