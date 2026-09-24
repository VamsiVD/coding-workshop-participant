// Basic text field for the auth forms: label above, MUI OutlinedInput, and a
// helper/error line below. Reused by PasswordInput, CodeInput and the login form.
import { Box, FormControl, FormHelperText, FormLabel, OutlinedInput } from '@mui/material';
import { admin } from '../../../theme/adminTheme';

// [CONCEPT: Props] Named props are used here; `...inputProps` gathers everything
// else (value, onChange, type, autoComplete...) and forwards it to OutlinedInput.
// `sx` styles the outer FormControl, `inputSx` the input itself.
export default function LabeledInput({ id, label, optional = false, helperText, error, sx, inputSx, ...inputProps }) {
  // `error` may be a message (shown instead of helperText) or just true/false to
  // colour the field red without text.
  const message = typeof error === 'string' ? error : helperText;
  return (
    <FormControl fullWidth error={Boolean(error)} sx={sx}>
      <FormLabel htmlFor={id} sx={{ mb: 0.75, fontSize: 13, color: admin.muted, '&.Mui-focused': { color: admin.muted } }}>
        {label}
        {optional && <Box component="span" sx={{ ml: 0.5, color: admin.faint }}>(optional)</Box>}
      </FormLabel>
      {/* [CONCEPT: Accessibility] htmlFor/id link the label to the input, and aria-describedby makes screen readers read the helper or error text. */}
      <OutlinedInput id={id} aria-describedby={message ? `${id}-helper` : undefined} sx={{ bgcolor: admin.bg, ...inputSx }} {...inputProps} />
      {message && <FormHelperText id={`${id}-helper`} sx={{ mx: 0, fontSize: 13 }}>{message}</FormHelperText>}
    </FormControl>
  );
}
