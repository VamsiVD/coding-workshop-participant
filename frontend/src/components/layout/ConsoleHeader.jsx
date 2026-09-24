// Header bar for every signed-in screen (dashboard, report form, admin console).
// App.jsx builds the nav links and user details and passes them in as props.
import { Box, Button } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { admin } from '../../theme/adminTheme';

// Top bar shared by the Dashboard, Report and admin screens. links = [{ label, href, active? }]
// [CONCEPT: Component] A presentational component: no state, it only renders the props it gets.
export default function ConsoleHeader({ name, role, initials, links, onSignOut }) {
  return (
    // [CONCEPT: MUI component] Box with component="header" renders a semantic <header> tag while taking sx styles.
    <Box component="header" sx={{ bgcolor: admin.ink, color: admin.surface, display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap', px: 3.5, minHeight: 56 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.25 }}>
        <Box component="span" sx={{ fontWeight: 600, fontSize: 20, letterSpacing: '.04em', color: admin.redBright }}>ACME</Box>
        <Box component="span" sx={{ fontSize: 13, color: admin.tanLight }}>Coyote Dispatch</Box>
      </Box>
      <Box component="nav" sx={{ display: 'flex', alignSelf: 'stretch', flexWrap: 'wrap', fontSize: 14 }}>
        {/* [CONCEPT: List rendering and keys] Each link's href is unique, so it is used as the React key. */}
        {links.map((l) => (
          // [CONCEPT: Accessibility] aria-current="page" marks the active link for screen readers, not just visually.
          // [CONCEPT: sx prop] Style values can depend on props: the active link gets a red underline via an inset shadow.
          <Box
            key={l.href}
            component="a"
            href={l.href}
            aria-current={l.active ? 'page' : undefined}
            sx={{ display: 'flex', alignItems: 'center', px: 1.75, textDecoration: 'none', color: l.active ? admin.surface : admin.tanLight, boxShadow: l.active ? `inset 0 -2px 0 ${admin.redBright}` : 'none', '&:hover': { color: admin.surface } }}
          >
            {l.label}
          </Box>
        ))}
      </Box>
      <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', py: 1 }}>
        {/* Button with href renders as a link, so this is a full page navigation to the report form. */}
        <Button href="/incidents/new" variant="contained" startIcon={<AddIcon />}>Report incident</Button>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, fontSize: 13 }}>
          <Box sx={{ width: 30, height: 30, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: admin.red, fontWeight: 600 }}>{initials}</Box>
          <Box sx={{ lineHeight: 1.25 }}><div>{name}</div><Box sx={{ color: admin.tanLight, fontSize: 12 }}>{role}</Box></Box>
        </Box>
        {/* [CONCEPT: Conditional rendering] The Sign out button only appears when the parent passes a handler. */}
        {/* [CONCEPT: Event handling] onClick calls the parent's onSignOut (App's signOut clears the session). */}
        {onSignOut && (
          <Button size="small" onClick={onSignOut} sx={{ color: admin.surface, border: `1px solid ${admin.tanLight}`, '&:hover': { bgcolor: 'rgba(255,250,240,.1)' } }}>
            Sign out
          </Button>
        )}
      </Box>
    </Box>
  );
}
