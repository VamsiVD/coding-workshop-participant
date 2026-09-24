// Earlier "crate" style header (stencil logo, wood-crate colours from crateTheme).
// Not currently imported: the signed-in screens use ConsoleHeader instead.
import { Box, Button, Stack } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { crate, fonts } from '../../theme/crateTheme';

// Top bar from the earlier crate design; App.jsx now uses ConsoleHeader instead. `links` = [{ label, href, count?, active? }]
// [CONCEPT: Props] Destructured in the signature; showReportButton has a default value when the parent leaves it out.
export default function AppHeader({ userLabel, links, showReportButton = false, onSignOut }) {
  return (
    // [CONCEPT: sx prop] Inline, theme-aware styles; numeric spacing like px: 3 means 3 x 8px from the theme.
    <Box component="header" sx={{ bgcolor: crate.ink, color: crate.paper, borderTop: `4px solid ${crate.red}`, display: 'flex', alignItems: 'center', gap: 2.5, flexWrap: 'wrap', px: 3, py: 1 }}>
      <Stack direction="row" spacing={1.25} alignItems="baseline">
        <Box component="span" sx={{ fontFamily: fonts.stencil, fontWeight: 900, fontSize: 28, letterSpacing: '.08em', color: crate.redBright }}>ACME</Box>
        <Box component="span" sx={{ fontFamily: fonts.heading, fontWeight: 500, fontSize: 12, letterSpacing: '.24em', textTransform: 'uppercase' }}>Coyote Dispatch</Box>
      </Stack>
      <Box component="nav" sx={{ display: 'flex', gap: 0.25, ml: 'auto', alignItems: 'center' }}>
        {/* [CONCEPT: List rendering and keys] One link per entry; href is unique, so it serves as the key. */}
        {links.map((l) => (
          // [CONCEPT: Accessibility] aria-current tells screen readers which link is the current page.
          <Box
            key={l.href}
            component="a"
            href={l.href}
            aria-current={l.active ? 'page' : undefined}
            sx={{ color: crate.paper, textDecoration: 'none', px: 1.5, py: 1, fontFamily: fonts.heading, fontWeight: 500, fontSize: 13, letterSpacing: '.12em', textTransform: 'uppercase', opacity: l.active ? 1 : 0.75, borderBottom: `2px solid ${l.active ? crate.redBright : 'transparent'}`, '&:hover': { opacity: 1 } }}
          >
            {l.label}
            {/* [CONCEPT: Conditional rendering] `!= null` hides the badge when count is missing but still shows a count of 0. */}
            {l.count != null && <Box component="span" sx={{ fontFamily: fonts.body, letterSpacing: 0, ml: 0.5 }}>({l.count})</Box>}
          </Box>
        ))}
        {showReportButton && (
          <Button href="/incidents/new" size="small" startIcon={<AddIcon />} sx={{ ml: 1, bgcolor: crate.red, color: crate.paper, border: `2px solid ${crate.paper}`, '&:hover': { bgcolor: crate.redDark } }}>
            Report incident
          </Button>
        )}
      </Box>
      <Box component="span" sx={{ fontSize: 12.5, opacity: 0.8, whiteSpace: 'nowrap' }}>{userLabel}</Box>
      {onSignOut && (
        <Button size="small" onClick={onSignOut} sx={{ color: crate.paper, border: `1.5px solid ${crate.paper}`, minHeight: 30, '&:hover': { bgcolor: 'rgba(243,230,200,.12)' } }}>
          Sign out
        </Button>
      )}
    </Box>
  );
}
