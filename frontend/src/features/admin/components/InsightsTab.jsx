import { Box } from '@mui/material';
import { admin } from '../../../theme/adminTheme';
import { CAPACITY, STATUS_BAR, insights } from '../adminModel';
import Panel, { BarRow, Dot } from './Panel';

// Reports come back null until an incident has reached that stage.
const fmt = (v, unit) => (v == null ? '—' : `${v}${unit}`);
const versus = (v, target, targetLabel) => (v == null ? 'Nothing measured yet' : `Target ${targetLabel} · ${v <= target ? 'on track' : 'over target'}`);
const tone = (v, target) => (v == null ? admin.muted : v <= target ? admin.brown : admin.dangerFg);

export default function InsightsTab({ incidents, engineers, kpis }) {
  const { hotspots, repeatSeats, categories, byStatus, workload, updatedWithin24hPct } = insights(incidents, engineers);
  const k = kpis || {};
  const tiles = [
    { label: 'Time to acknowledge', value: fmt(k.ackMinutes, 'm'), note: versus(k.ackMinutes, k.ackTargetMinutes, `${k.ackTargetMinutes / 60}h`), color: tone(k.ackMinutes, k.ackTargetMinutes) },
    { label: 'Time to resolve', value: fmt(k.resolveDays, 'd'), note: versus(k.resolveDays, k.resolveTargetDays, `${k.resolveTargetDays}d`), color: tone(k.resolveDays, k.resolveTargetDays) },
    { label: 'Updated within 24h', value: fmt(updatedWithin24hPct, '%'), note: updatedWithin24hPct == null ? 'No open incidents' : 'Reporters kept informed', color: admin.muted },
    { label: 'Reopened', value: fmt(k.reopenedPct, '%'), note: k.reopenedPct == null ? 'Not tracked yet' : 'Fixes that didn’t hold', color: admin.muted },
  ];
  const top = (list) => (list[0] ? list[0][1] : 1);
  const empty = <Box sx={{ fontSize: 13, color: admin.muted }}>No incidents in this view.</Box>;

  return (
    <Box sx={{ display: 'grid', gap: 3 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', border: `1px solid ${admin.line}`, borderRadius: '12px', overflow: 'hidden' }}>
        {tiles.map((t) => (
          <Box key={t.label} sx={{ p: '18px 20px', display: 'grid', gap: 0.5, borderRight: `1px solid ${admin.line}`, mr: '-1px' }}>
            <Box sx={{ fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', color: admin.muted }}>{t.label}</Box>
            <Box sx={{ fontWeight: 600, fontSize: 36, lineHeight: 1.05 }}>{t.value}</Box>
            <Box sx={{ fontSize: 12.5, display: 'flex', gap: 0.75, alignItems: 'center', color: t.color }}><Dot color="currentColor" size={6} />{t.note}</Box>
          </Box>
        ))}
      </Box>

      <Panel title="Tickets by status">
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
