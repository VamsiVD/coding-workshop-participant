import { useState } from 'react';
import { Button, InputAdornment } from '@mui/material';
import LabeledInput from './LabeledInput';

// Password field with a Show/Hide text button inside the input.
export default function PasswordInput(props) {
  const [show, setShow] = useState(false);
  return (
    <LabeledInput
      {...props}
      type={show ? 'text' : 'password'}
      endAdornment={
        <InputAdornment position="end">
          <Button size="small" color="secondary" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'} sx={{ minWidth: 0, px: 1.25 }}>
            {show ? 'Hide' : 'Show'}
          </Button>
        </InputAdornment>
      }
    />
  );
}
