import { Box } from '@mui/material';
import { crate, fonts } from '../../../theme/crateTheme';
import { STATUS_STYLE } from '../ticketModel';

export default function StatusChip({ status, size = 'md' }) {
  const [bg, fg] = STATUS_STYLE[status] ?? STATUS_STYLE.Open;
  return (
    <Box
      component="span"
      sx={{
        fontFamily: fonts.heading,
        fontSize: size === 'sm' ? 10.5 : 11,
        letterSpacing: '.12em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        px: 1,
        py: 0.375,
        border: `1.5px solid ${crate.ink}`,
        bgcolor: bg,
        color: fg,
      }}
    >
      {status}
    </Box>
  );
}
