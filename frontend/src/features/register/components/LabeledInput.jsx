import { Box, FormControl, FormHelperText, FormLabel, OutlinedInput } from '@mui/material';
import { admin } from '../../../theme/adminTheme';

export default function LabeledInput({ id, label, optional = false, helperText, error, sx, inputSx, ...inputProps }) {
  const message = typeof error === 'string' ? error : helperText;
  return (
    <FormControl fullWidth error={Boolean(error)} sx={sx}>
      <FormLabel htmlFor={id} sx={{ mb: 0.75, fontSize: 13, color: admin.muted, '&.Mui-focused': { color: admin.muted } }}>
        {label}
        {optional && <Box component="span" sx={{ ml: 0.5, color: admin.faint }}>(optional)</Box>}
      </FormLabel>
      <OutlinedInput id={id} aria-describedby={message ? `${id}-helper` : undefined} sx={{ bgcolor: admin.bg, ...inputSx }} {...inputProps} />
      {message && <FormHelperText id={`${id}-helper`} sx={{ mx: 0, fontSize: 13 }}>{message}</FormHelperText>}
    </FormControl>
  );
}
