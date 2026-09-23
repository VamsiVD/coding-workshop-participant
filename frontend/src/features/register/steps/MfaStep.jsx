import { useState } from 'react';
import { Alert, Box, Button, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { QRCodeSVG } from 'qrcode.react';
import CodeInput from '../components/CodeInput';
import LabeledInput from '../components/LabeledInput';
import { crate, fonts } from '../../../theme/crateTheme';

const METHODS = [
  { value: 'app', label: 'Authenticator app', sub: 'Codes generated on your phone, works offline.', recommended: true },
  { value: 'sms', label: 'Text message', sub: 'Codes sent by SMS to your mobile.' },
];

const formatKey = (s = '') => s.replace(/(.{4})/g, '$1 ').trim();

export default function MfaStep({ method, onMethodChange, setup, phone, onPhoneChange, onSendSms, loading, onSubmit }) {
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);

  // Placeholder: two-factor is not enforced by the backend yet, so any code
  // (or none) is accepted.
  const submit = (e) => {
    e.preventDefault();
    onSubmit(code);
  };

  const copyKey = async () => {
    await navigator.clipboard?.writeText(setup.secret);
    setCopied(true);
  };

  return (
    <Stack component="form" noValidate spacing={2.5} onSubmit={submit}>
      <Alert severity="info">Preview: two-factor is not enforced yet. Any code continues to the next step.</Alert>
      <ToggleButtonGroup
        exclusive
        value={method}
        onChange={(_, v) => v && onMethodChange(v)}
        aria-label="Two-factor method"
        sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 1.25 }}
      >
        {METHODS.map((m) => (
          <ToggleButton key={m.value} value={m.value} sx={{ display: 'grid', justifyItems: 'start', textAlign: 'left', gap: 0.5, p: '12px 14px' }}>
            <Box sx={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', gap: 1, fontFamily: fonts.heading, fontWeight: 600, fontSize: 14, letterSpacing: '.1em', textTransform: 'uppercase' }}>
              {m.label}
              {m.recommended && (
                <Box component="span" sx={{ fontSize: 10.5, letterSpacing: '.14em', px: 0.75, py: 0.25, border: '1.5px solid currentColor' }}>Recommended</Box>
              )}
            </Box>
            <Box component="span" sx={{ fontFamily: fonts.body, fontSize: 12.5, lineHeight: 1.4 }}>{m.sub}</Box>
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      {method === 'app' && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'flex-start', border: `2px solid ${crate.ink}`, bgcolor: crate.field, p: 2.25 }}>
          <Box sx={{ p: 1, border: `2px solid ${crate.ink}`, bgcolor: crate.field, lineHeight: 0, flex: 'none' }}>
            {setup.otpauthUrl
              ? <QRCodeSVG value={setup.otpauthUrl} size={150} fgColor={crate.ink} bgColor={crate.field} title="Scan with your authenticator app" />
              : <Box sx={{ width: 150, height: 150, display: 'grid', placeItems: 'center', fontSize: 12 }}>Loading…</Box>}
          </Box>
          <Stack spacing={1.5} sx={{ flex: '1 1 220px', minWidth: 0 }}>
            <Box component="ol" sx={{ m: 0, pl: 2.5, fontSize: 13.5, lineHeight: 1.6 }}>
              <li>Open an authenticator app such as Microsoft or Google Authenticator.</li>
              <li>Scan the QR code.</li>
              <li>Enter the 6-digit code the app shows.</li>
            </Box>
            <Stack spacing={0.5}>
              <Typography variant="caption">Can’t scan? Enter this key:</Typography>
              <Box sx={{ display: 'flex', border: `1.5px dashed ${crate.ink}` }}>
                <Box sx={{ flex: 1, px: 1.25, py: 0.75, fontSize: 13.5, letterSpacing: '.12em' }}>{formatKey(setup.secret)}</Box>
                <Button size="small" onClick={copyKey} disabled={!setup.secret} sx={{ borderLeft: `1.5px dashed ${crate.ink}`, bgcolor: crate.paper, color: crate.ink, minHeight: 0 }}>
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </Box>
            </Stack>
          </Stack>
        </Box>
      )}

      {method === 'sms' && (
        <Stack direction="row" spacing={1.5} alignItems="flex-end" sx={{ maxWidth: 520 }}>
          <LabeledInput
            id="phone"
            type="tel"
            label="Mobile number"
            autoComplete="tel"
            placeholder="+1 512 555 0142"
            value={phone}
            onChange={(e) => onPhoneChange(e.target.value)}
            helperText={setup.smsSent ? 'Code sent. It may take a minute to arrive.' : 'We’ll text a code now and each time you sign in.'}
          />
          <Button variant="outlined" onClick={onSendSms} disabled={loading || !phone.trim()} sx={{ mb: 3.25, flex: 'none' }}>
            {setup.smsSent ? 'Resend' : 'Send code'}
          </Button>
        </Stack>
      )}

      <CodeInput id="mfaCode" label={method === 'app' ? 'Code from your app' : 'Code from the text message'} value={code} onChange={setCode} />

      <Box>
        <Button type="submit" variant="contained" disabled={loading}>{loading ? 'Verifying…' : 'Verify and enable'}</Button>
      </Box>
    </Stack>
  );
}
