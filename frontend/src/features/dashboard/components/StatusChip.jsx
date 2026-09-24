// Coloured dot plus status text, used in the ticket list and nearby cards.
import { Box } from '@mui/material';
import { STATUS_DOT } from '../ticketModel';

// [CONCEPT: Component] A small presentational component: output depends only on its props.
// [CONCEPT: Props] `size` defaults to 'md'; 'sm' shrinks the dot and text. Unknown statuses fall back to the Open colour.
export default function StatusChip({ status, size = 'md' }) {
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.85, whiteSpace: 'nowrap', fontSize: size === 'sm' ? 12.5 : 13.5 }}>
      <Box component="span" sx={{ width: size === 'sm' ? 7 : 8, height: size === 'sm' ? 7 : 8, borderRadius: '50%', bgcolor: STATUS_DOT[status] ?? STATUS_DOT.Open, flex: 'none' }} />
      {status}
    </Box>
  );
}
