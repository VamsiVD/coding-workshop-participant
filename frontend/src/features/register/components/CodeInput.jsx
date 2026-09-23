import LabeledInput from './LabeledInput';
import { onlyDigits } from '../validation';

export default function CodeInput({ id, label, value, onChange, helperText, error, autoFocus }) {
  return (
    <LabeledInput
      id={id}
      label={label}
      value={value}
      autoFocus={autoFocus}
      error={error}
      helperText={helperText}
      placeholder="••••••"
      onChange={(e) => onChange(onlyDigits(e.target.value))}
      inputProps={{ inputMode: 'numeric', autoComplete: 'one-time-code', maxLength: 6 }}
      sx={{ maxWidth: 420 }}
      inputSx={{
        '& input': { height: 34, textAlign: 'center', fontSize: 28, fontWeight: 700, letterSpacing: '.5em', pl: '.5em' },
      }}
    />
  );
}
