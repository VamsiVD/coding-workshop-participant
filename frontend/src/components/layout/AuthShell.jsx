import { useMediaQuery } from 'react-responsive';
import { Box, Link, Paper, Typography } from '@mui/material';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import { admin } from '../../theme/adminTheme';

// Split card for Sign In and Register: dark brand panel on the left, form on the right.
// `rail` replaces the default blurb area in the brand panel (e.g. the register stepper).
export default function AuthShell({ maxWidth = 880, kicker, title, blurb, rail, mobileRail, shieldText, footerText, children }) {
  const isMobile = useMediaQuery({ maxWidth: 767 });
  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', px: 2.5, py: isMobile ? 3 : 6, bgcolor: admin.bg }}>
      <Box sx={{ width: '100%', maxWidth, display: 'grid', gap: 2 }}>
        <Paper
          elevation={0}
          sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', border: `1px solid ${admin.line}`, borderRadius: '16px', overflow: 'hidden', bgcolor: admin.surface, boxShadow: '0 8px 24px rgba(42,29,20,.08)' }}
        >
          <Box component="aside" sx={{ flex: isMobile ? 'none' : '0 0 320px', bgcolor: admin.ink, color: admin.surface, p: isMobile ? '20px' : '32px 28px', display: 'flex', flexDirection: 'column', gap: isMobile ? 1.5 : 4 }}>
            <div>
              <Typography component="div" sx={{ fontWeight: 600, fontSize: isMobile ? 30 : 40, lineHeight: 1, letterSpacing: '.04em', color: admin.redBright }}>ACME</Typography>
              <Typography component="div" sx={{ fontSize: 14, color: admin.tanLight }}>Coyote Dispatch</Typography>
            </div>
            {isMobile ? mobileRail : (
              <>
                <Typography sx={{ fontSize: 14, lineHeight: 1.6, maxWidth: '30ch', color: '#f3e6c8' }}>
                  Report and track facility and workplace technology issues across every ACME building.
                </Typography>
                {rail}
                <Box sx={{ mt: 'auto', pt: 2, borderTop: '1px solid rgba(255,250,240,.15)', display: 'flex', gap: 1.25, fontSize: 12.5, lineHeight: 1.5, color: admin.tanLight }}>
                  <ShieldOutlinedIcon sx={{ fontSize: 18, flex: 'none' }} />
                  <span>{shieldText}</span>
                </Box>
              </>
            )}
          </Box>

          <Box component="main" sx={{ flex: 1, minWidth: 0, p: isMobile ? '24px 20px' : '40px 40px 36px', display: 'grid', alignContent: 'start', gap: 3 }}>
            <div>
              <Typography sx={{ fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase', color: admin.brown, mb: 0.5 }}>{kicker}</Typography>
              <Typography variant="h1" sx={{ fontSize: isMobile ? 26 : 32 }}>{title}</Typography>
              {blurb && <Typography sx={{ mt: 0.5, fontSize: 14, lineHeight: 1.55, color: admin.muted, maxWidth: '52ch' }}>{blurb}</Typography>}
            </div>
            {children}
          </Box>
        </Paper>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px 20px', fontSize: 12.5, color: admin.muted }}>
          <span>{footerText}</span>
          <Box sx={{ display: 'flex', gap: 2.25 }}>
            <Link href="/privacy" color="secondary">Privacy</Link>
            <Link href="/acceptable-use" color="secondary">Acceptable use</Link>
            <Link href="/help" color="secondary">Service desk</Link>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export const authErrorSx = { borderRadius: '10px', border: '1px solid oklch(0.8 0.08 25)', bgcolor: 'oklch(0.96 0.02 25)', color: admin.dangerFg };
export const checkSx = { color: 'rgba(42,29,20,.35)', '&.Mui-checked': { color: admin.red }, p: 0, mr: 1.25 };
