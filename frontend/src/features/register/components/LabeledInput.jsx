import { Box, FormControl, FormHelperText, FormLabel, OutlinedInput } from '@mui/material';

export default function LabeledInput({ id, label, optional = false, helperText, error, sx, inputSx, ...inputProps }) {
  const message = typeof error === 'string' ? error : helperText;
  return (
    <FormControl fullWidth error={Boolean(error)} sx={sx}>
      <FormLabel htmlFor={id} sx={{ mb: 0.75 }}>
        {label}
        {optional && (
          <Box component="span" sx={{ ml: 0.75, textTransform: 'none', letterSpacing: 0, fontFamily: (t) => t.typography.fontFamily, opacity: 0.7 }}>
            (optional)
          </Box>
        )}
      </FormLabel>
      <OutlinedInput id={id} aria-describedby={message ? `${id}-helper` : undefined} sx={inputSx} {...inputProps} />
      {message && <FormHelperText id={`${id}-helper`}>{message}</FormHelperText>}
    </FormControl>
  );
}
