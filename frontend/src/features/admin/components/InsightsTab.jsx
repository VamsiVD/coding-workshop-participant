// Insights tab of the admin console: a date-range filter, KPI tiles, a status
// breakdown bar, and panels for hotspots, top categories and engineer workload.
// Read-only; all numbers come from the building- and date-filtered incidents
// plus the server KPIs for the same dates.
import { Alert, Box, CircularProgress, MenuItem, TextField } from '@mui/material';
import { admin } from '../../../theme/adminTheme';
import { CAPACITY, RANGES, STATUS_BAR, insights } from '../adminModel';
import Panel, { BarRow, Dot } from './Panel';

// Preset picker, plus From/To dates when "Custom range" is chosen.
// [CONCEPT: Controlled input] Every field reads from `range` and reports changes up through onChange.
function RangeFilter({ range, onChange, invalid, loading }) {
  const set = (patch) => onChange({ ...range, ...patch });
  const dateProps = { size: 'small', type: 'date', slotProps: { inputLabel: { shrink: true } }, sx: { width: 170 } };
  return (
    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
      <TextField select size="small" label="Reported" value={range.key} onChange={(e) => set({ key: e.target.value })} sx={{ minWidth: 180 }}>
        {RANGES.map((r) => <MenuItem key={r.key} value={r.key}>{r.label}</MenuItem>)}
      </TextField>
      {range.key === 'custom' && (
        <>
          <TextField {...dateProps} label="From" value={range.from} onChange={(e) => set({ from: e.target.value })} error={invalid} />
          <TextField {...dateProps} label="To" value={range.to} onChange={(e) => set({ to: e.target.value })} error={invalid} helperText={invalid ? 'Ends before it starts' : undefined} />
        </>
      )}
      {loading && <CircularProgress size={18} color="secondary" />}
    </Box>
  );
}

// Reports come back null until an incident has reached that stage.
const fmt = (v, unit) => (v == null ? '—' : `${v}${unit}`);
const versus = (v, target, targetLabel) => (v == null ? 'Nothing measured yet' : `Target ${targetLabel} · ${v <= target ? 'on track' : 'over target'}`);
const tone = (v, target) => (v == null ? admin.muted : v <= target ? admin.brown : admin.dangerFg);

// `incidents` is null while the first answer for a date range loads. `current`
// is the building-filtered list regardless of dates, for the workload panel.
export default function InsightsTab({ incidents, current, engineers, kpis, range, onRangeChange, rangeInvalid, loading, error }) {
  const filter = <RangeFilter range={range} onChange={onRangeChange} invalid={rangeInvalid} loading={loading} />;
  // [CONCEPT: Early return] Nothing to chart yet: show just the filter and why.
  if (rangeInvalid || !incidents) {
    return (
      <Box sx={{ display: 'grid', gap: 3 }}>
        {filter}
        {error ? <Alert severity="error">{error}</Alert> : !rangeInvalid && <Box sx={{ fontSize: 13, color: admin.muted }}>Loading insights…</Box>}
      </Box>
    );
  }

  // [CONCEPT: Derived state] All chart data is recomputed from props on each render by a pure helper; nothing is stored.
  const { hotspots, repeatSeats, categories, byStatus, workload, updatedWithin24hPct } = insights(incidents, engineers, current);
  // Time KPIs come from the server for the chosen dates across all buildings, so they do not follow the building filter.
  const k = kpis || {};
  // Tile config as data, rendered by one map below. The targets are minutes and days; the ack target is shown in hours.
  const tiles = [
    { label: 'Time to acknowledge', value: fmt(k.ackMinutes, 'm'), note: versus(k.ackMinutes, k.ackTargetMinutes, `${k.ackTargetMinutes / 60}h`), color: tone(k.ackMinutes, k.ackTargetMinutes) },
    { label: 'Time to resolve', value: fmt(k.resolveDays, 'd'), note: versus(k.resolveDays, k.resolveTargetDays, `${k.resolveTargetDays}d`), color: tone(k.resolveDays, k.resolveTargetDays) },
    { label: 'Updated within 24h', value: fmt(updatedWithin24hPct, '%'), note: updatedWithin24hPct == null ? 'No open incidents' : 'Reporters kept informed', color: admin.muted },
    { label: 'Reopened', value: fmt(k.reopenedPct, '%'), note: k.reopenedPct == null ? 'Not tracked yet' : 'Fixes that didn’t hold', color: admin.muted },
  ];
  // Largest count in a sorted tally, so bars scale relative to the top entry (1 avoids dividing by zero).
  const top = (list) => (list[0] ? list[0][1] : 1);
  // [CONCEPT: JSX expression] JSX is just a value: this element is stored once and reused in several panels.
  const empty = <Box sx={{ fontSize: 13, color: admin.muted }}>No incidents in this view.</Box>;

  return (
    <Box sx={{ display: 'grid', gap: 3 }}>
      {filter}
      {error && <Alert severity="error">{error}</Alert>}
      {/* [CONCEPT: Responsive design] auto-fit + minmax lets the tiles wrap into fewer columns on narrow screens, with no breakpoints. */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', border: `1px solid ${admin.line}`, borderRadius: '12px', overflow: 'hidden' }}>
        {/* [CONCEPT: List rendering and keys] Labels are unique, so they key the tiles. */}
        {tiles.map((t) => (
          <Box key={t.label} sx={{ p: '18px 20px', display: 'grid', gap: 0.5, borderRight: `1px solid ${admin.line}`, mr: '-1px' }}>
            <Box sx={{ fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', color: admin.muted }}>{t.label}</Box>
            <Box sx={{ fontWeight: 600, fontSize: 36, lineHeight: 1.05 }}>{t.value}</Box>
            <Box sx={{ fontSize: 12.5, display: 'flex', gap: 0.75, alignItems: 'center', color: t.color }}><Dot color="currentColor" size={6} />{t.note}</Box>
          </Box>
        ))}
      </Box>

      {/* [CONCEPT: Component composition] Panel supplies the frame and title; whatever is nested inside becomes its children. */}
      <Panel title="Tickets by status">
        {/* Stacked bar: each status gets flex-grow equal to its count, and empty statuses are skipped. */}
        <Box sx={{ display: 'flex', height: 28, gap: '2px', borderRadius: '8px', overflow: 'hidden' }}>
          {byStatus.filter((s) => s.count).map((s) => (
            <Box key={s.status} title={s.status} sx={{ flex: `${s.count} 0 0`, bgcolor: STATUS_BAR[s.status][0], color: STATUS_BAR[s.status][1], display: 'grid', placeItems: 'center', fontSize: 12.5, fontWeight: 500 }}>{s.count}</Box>
          ))}
        </Box>
        <Box sx={{ display: 'flex', gap: 2.25, flexWrap: 'wrap', fontSize: 13, color: '#4a3b2c' }}>
          {byStatus.map((s) => (
            <Box key={s.status} component="span" sx={{ display: 'flex', gap: 0.9, alignItems: 'center' }}><Dot color={STATUS_BAR[s.status][0]} size={10} radius={3} />{s.status} · {s.count}</Box>
          ))}
        </Box>
      </Panel>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 3, alignItems: 'start' }}>
        <Panel title="Where problems repeat">
          {/* [CONCEPT: Conditional rendering] Ternary between the bar list and the shared empty message. */}
          {hotspots.length ? hotspots.map(([label, n]) => <BarRow key={label} label={label} value={n} pct={(n / top(hotspots)) * 100} />) : empty}
          <Box sx={{ fontSize: 13, lineHeight: 1.5, color: '#4a3b2c', borderTop: `1px solid ${admin.line}`, pt: 1.25 }}>
            {repeatSeats.length
              ? `Repeat seat: ${repeatSeats.map(([s, n]) => `${s} (${n} tickets)`).join(', ')}. Consider replacing the equipment.`
              : 'No seat has more than one ticket.'}
          </Box>
        </Panel>

        <Panel title="What breaks most">
          {categories.length ? categories.map(([label, n]) => <BarRow key={label} label={label} value={n} pct={(n / top(categories)) * 100} color={admin.ink} />) : empty}
        </Panel>

        <Panel title="Team workload">
          {workload.map((e) => {
            const cap = e.capacity ?? CAPACITY;
            return (
              // [CONCEPT: Fragment] The label prop is a <>...</> fragment: two spans passed as one value without an extra wrapper element.
              // The bar turns red when an engineer is within one ticket of capacity.
              <BarRow
                key={e.id}
                label={<><Box component="span" sx={{ fontWeight: 500 }}>{e.name}</Box> <Box component="span" sx={{ color: admin.muted }}>· {e.availability}</Box></>}
                value={e.availability === 'On leave' ? '—' : `${e.load} / ${cap}`}
                pct={(e.load / cap) * 100}
                color={e.load >= cap - 1 ? admin.danger : admin.brown}
              />
            );
          })}
          {workload.length === 0 && <Box sx={{ fontSize: 13, color: admin.muted }}>No engineers on record.</Box>}
          <Box sx={{ fontSize: 12.5, color: admin.muted, borderTop: `1px solid ${admin.line}`, pt: 1.25 }}>Tickets in progress or blocked, against each engineer’s capacity.</Box>
        </Panel>
      </Box>
    </Box>
  );
}
