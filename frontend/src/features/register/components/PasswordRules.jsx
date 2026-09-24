// Live password checklist under the password field on the registration form.
// Each rule ticks itself as the user types; nothing here blocks submitting
// (validateDetails does that, using the same rules).
import { Box } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import { admin } from '../../../theme/adminTheme';
import { passwordRules } from '../validation';

// [CONCEPT: Derived state] Whether each rule is met is recomputed from the
// `password` prop on every render, so there is no extra state to keep in sync.
export default function PasswordRules({ password }) {
  return (
    <Box component="ul" aria-label="Password requirements" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '6px 16px' }}>
      {/* [CONCEPT: List rendering and keys] One <li> per rule, keyed by the rule's stable id. */}
      {passwordRules.map((rule) => {
        const met = rule.test(password);
        return (
          <Box component="li" key={rule.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 13, color: met ? admin.ink : admin.muted }}>
            <Box component="span" aria-hidden sx={{ width: 14, height: 14, borderRadius: '50%', flex: 'none', bgcolor: met ? admin.red : admin.track, color: '#fff', display: 'grid', placeItems: 'center' }}>
              {met && <CheckIcon sx={{ fontSize: 10 }} />}
            </Box>
            <span>{rule.label}</span>
            {/* [CONCEPT: Accessibility] Visually hidden text: the tick icon is aria-hidden, so screen readers hear "met" / "not met" instead. */}
            <Box component="span" sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{met ? 'met' : 'not met'}</Box>
          </Box>
        );
      })}
    </Box>
  );
}
