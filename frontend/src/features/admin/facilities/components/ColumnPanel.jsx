// Building blocks for the facilities page's three columns: the column frame
// (ColumnPanel), one selectable row with an actions menu (FacilityRow), and
// the centred messages used for loading, empty and error states (PanelNote).
import { useState } from 'react';
import { Alert, Box, Button, ButtonBase, CircularProgress, IconButton, ListItemIcon, Menu, MenuItem, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { admin } from '../../../../theme/adminTheme';

// [CONCEPT: Component composition] The page fills the header slots (`action`, `toolbar`) and the body (`children`).
// `show` decides visibility on phones only; from md up all three columns are always on screen.
export default function ColumnPanel({ label, kicker, title, subtitle, onBack, backLabel, action, toolbar, show, children }) {
  return (
    <Box
      component="section"
      aria-label={label}
      sx={{
        // [CONCEPT: Responsive design] Phones see one level at a time (a drill-down); desktops see all three side by side.
        display: { xs: show ? 'block' : 'none', md: 'block' },
        minWidth: 0,
        alignSelf: 'start',
        border: `1px solid ${admin.line}`,
        borderRadius: '12px',
        overflow: 'hidden',
        bgcolor: admin.surface,
      }}
    >
      <Box sx={{ p: '12px 12px 12px 16px', borderBottom: `1px solid ${admin.line}`, display: 'flex', alignItems: 'center', gap: 1 }}>
        {onBack && (
          <IconButton size="small" aria-label={backLabel} onClick={onBack} sx={{ display: { md: 'none' }, ml: -0.75 }}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: admin.brown }}>{kicker}</Typography>
          <Typography variant="h2" noWrap title={typeof title === 'string' ? title : undefined}>{title}</Typography>
          {subtitle && <Typography noWrap sx={{ fontSize: 12.5, color: admin.muted }}>{subtitle}</Typography>}
        </Box>
        {action}
      </Box>
      {toolbar && <Box sx={{ p: '10px 12px', borderBottom: `1px solid ${admin.line}`, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>{toolbar}</Box>}
      {children}
    </Box>
  );
}

// Spinner, error with retry, or a plain message, centred in a column body.
export function PanelNote({ loading, error, onRetry, children }) {
  if (loading) return <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}><CircularProgress size={28} color="secondary" /></Box>;
  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error" action={onRetry && <Button color="inherit" size="small" onClick={onRetry}>Retry</Button>}>{error}</Alert>
      </Box>
    );
  }
  return <Box sx={{ py: 5, px: 2, textAlign: 'center', fontSize: 14, color: admin.muted, display: 'grid', gap: 1.5, justifyItems: 'center' }}>{children}</Box>;
}

// Overflow menu for a row. `actions` is [{ label, icon, onClick, danger? }].
function RowMenu({ name, actions }) {
  const [anchor, setAnchor] = useState(null);
  return (
    <>
      <IconButton size="small" aria-label={`Actions for ${name}`} aria-haspopup="menu" onClick={(e) => setAnchor(e.currentTarget)}>
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
        {actions.map((a) => (
          <MenuItem key={a.label} onClick={() => { setAnchor(null); a.onClick(); }} sx={{ fontSize: 14, color: a.danger ? admin.dangerFg : admin.ink }}>
            <ListItemIcon sx={{ color: 'inherit' }}>{a.icon}</ListItemIcon>
            {a.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

// One row: a clickable main area (selects, or edits for seats) and a sibling actions menu,
// kept outside the ButtonBase because a button may not contain another button.
export function FacilityRow({ name, lead, primary, secondary, meta, selected, muted, onClick, actions }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        borderBottom: `1px solid ${admin.line}`,
        '&:last-of-type': { borderBottom: 0 },
        bgcolor: selected ? admin.sand : 'transparent',
        // A red bar marks the selected row without shifting the content.
        boxShadow: selected ? `inset 3px 0 0 ${admin.red}` : 'none',
      }}
    >
      <ButtonBase
        onClick={onClick}
        aria-current={selected ? 'true' : undefined}
        sx={{
          flex: 1,
          minWidth: 0,
          display: 'grid',
          gridTemplateColumns: 'auto minmax(0, 1fr) auto',
          alignItems: 'center',
          justifyContent: 'stretch',
          alignContent: 'start',
          gap: 1.5,
          p: '10px 4px 10px 16px',
          textAlign: 'left',
          opacity: muted ? 0.6 : 1,
          '&:hover': { bgcolor: selected ? admin.sand : admin.bg },
          '&.Mui-focusVisible': { outline: `2px solid ${admin.brown}`, outlineOffset: -2 },
        }}
      >
        {lead}
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ fontWeight: 500, fontSize: 14.5, display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>{primary}</Box>
          {secondary && <Box sx={{ fontSize: 12.5, color: admin.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{secondary}</Box>}
        </Box>
        {meta ?? <span />}
      </ButtonBase>
      <Box sx={{ pr: 1, flex: 'none' }}><RowMenu name={name} actions={actions} /></Box>
    </Box>
  );
}

// Square badge at the start of a row: an icon or a short tag such as a floor level.
export function Lead({ children, tone = 'sand' }) {
  const tones = { sand: [admin.sand, admin.brown], red: [admin.dangerBg, admin.dangerFg], grey: [admin.track, admin.faint] };
  const [bg, fg] = tones[tone];
  return <Box sx={{ width: 34, height: 34, borderRadius: '8px', display: 'grid', placeItems: 'center', bgcolor: bg, color: fg, fontWeight: 600, fontSize: 13, flex: 'none' }}>{children}</Box>;
}
