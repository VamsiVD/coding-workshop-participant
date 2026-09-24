// Large, centred input for a 6-digit one-time code (used by VerifyEmailStep).
// A thin wrapper that configures LabeledInput rather than a new input.
import LabeledInput from './LabeledInput';
import { onlyDigits } from '../validation';

// [CONCEPT: Component composition] Builds on LabeledInput, only adding code-specific
// props. Note onChange here receives the cleaned string, not the event.
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
      // [CONCEPT: Controlled input] Non-digits are removed before the value reaches
      // state, so letters never appear in the box, even when pasted.
      onChange={(e) => onChange(onlyDigits(e.target.value))}
      // numeric keypad on phones; "one-time-code" lets the OS offer a code from SMS/email.
      inputProps={{ inputMode: 'numeric', autoComplete: 'one-time-code', maxLength: 6 }}
      sx={{ maxWidth: 420 }}
      inputSx={{ '& input': { height: 38, textAlign: 'center', fontSize: 28, fontWeight: 600, letterSpacing: '.5em', pl: '.5em' } }}
    />
  );
}
