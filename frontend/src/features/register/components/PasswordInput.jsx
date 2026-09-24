// Password field used by registration and login.
import { useState } from 'react';
import { Button, InputAdornment } from '@mui/material';
import LabeledInput from './LabeledInput';

// Password field with a Show/Hide text button inside the input.
// [CONCEPT: Component composition] Wraps LabeledInput and passes every prop
// through, only overriding `type` and adding the button.
export default function PasswordInput(props) {
  // [CONCEPT: useState] UI-only state: whether the password is visible. The
  // value itself is still owned by the parent.
  const [show, setShow] = useState(false);
  return (
    <LabeledInput
      {...props}
      type={show ? 'text' : 'password'}
      // Forwarded to OutlinedInput via LabeledInput's ...inputProps.
      endAdornment={
        <InputAdornment position="end">
          {/* [CONCEPT: Event handling] The updater form (v) => !v toggles from the latest value; aria-label names the action for screen readers. */}
          <Button size="small" color="secondary" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'} sx={{ minWidth: 0, px: 1.25 }}>
            {show ? 'Hide' : 'Show'}
          </Button>
        </InputAdornment>
      }
    />
  );
}
