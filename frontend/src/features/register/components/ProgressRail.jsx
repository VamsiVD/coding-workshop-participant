import { Box } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import { admin } from '../../../theme/adminTheme';

// Vertical step list for the dark brand panel.
export default function ProgressRail({ steps, activeStep }) {
  return (
    <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid' }}>
      {steps.map((s, i) => {
        const done = i < activeStep;
        const lit = done || i === activeStep;
        return (
          <Box component="li" key={s.label} aria-current={i === activeStep ? 'step' : undefined} sx={{ display: 'grid', gridTemplateColumns: '30px minmax(0,1fr)', gap: 1.75 }}>
            <Box sx={{ display: 'grid', justifyItems: 'center', gridTemplateRows: '30px 1fr' }}>
              <Box sx={{ width: 30, height: 30, borderRadius: '50%', border: `1px solid ${lit ? admin.redBright : 'rgba(255,250,240,.35)'}`, bgcolor: done ? admin.redBright : 'transparent', display: 'grid', placeItems: 'center', fontWeight: 600, fontSize: 14 }}>
                {done ? <CheckIcon sx={{ fontSize: 16 }} /> : i + 1}
              </Box>
              {i < steps.length - 1 && <Box sx={{ width: '1px', minHeight: 20, bgcolor: 'rgba(255,250,240,.2)' }} />}
            </Box>
            <Box sx={{ pt: 0.5, pb: 2.5, opacity: lit ? 1 : 0.6 }}>
              <Box sx={{ fontWeight: 500, fontSize: 14.5 }}>{s.label}</Box>
              <Box sx={{ fontSize: 12.5, mt: 0.25, color: admin.tanLight }}>{s.sub}</Box>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
