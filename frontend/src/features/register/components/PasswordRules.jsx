import { Box } from '@mui/material';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import { passwordRules } from '../validation';

export default function PasswordRules({ password }) {
  return (
    <Box
      component="ul"
      aria-label="Password requirements"
      sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '4px 16px' }}
    >
      {passwordRules.map((rule) => {
        const met = rule.test(password);
        const Icon = met ? CheckBoxIcon : CheckBoxOutlineBlankIcon;
        return (
          <Box
            component="li"
            key={rule.id}
            sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 12.5, color: met ? 'text.primary' : 'text.secondary' }}
          >
            <Icon sx={{ fontSize: 16 }} aria-hidden />
            <span>{rule.label}</span>
            <Box component="span" sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
              {met ? 'met' : 'not met'}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
