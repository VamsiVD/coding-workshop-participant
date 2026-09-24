// Admin facilities page (/admin/facilities): the facility admin manages
// buildings, their floors and the desks and rooms on each floor. A
// master-detail layout on desktop, a drill-down on phones. Data and server
// calls live in useFacilities.
import { useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Snackbar, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useMediaQuery } from 'react-responsive';
import { admin } from '../../../theme/adminTheme';
import useFacilities from './useFacilities';
import { floorName, plural } from './facilitiesModel';
import BuildingsPanel from './components/BuildingsPanel';
import FloorsPanel from './components/FloorsPanel';
import SeatsPanel from './components/SeatsPanel';
import BuildingFormDialog from './components/BuildingFormDialog';
import FloorFormDialog from './components/FloorFormDialog';
import SeatFormDialog from './components/SeatFormDialog';
import DeleteDialog from './components/DeleteDialog';

// [CONCEPT: Component] Page shell: header, the three columns and the dialogs.
export default function AdminFacilitiesPage() {
  const fx = useFacilities();
  const { buildings, loadError, reload, loadFloors, loadSeats } = fx;
  // Selection drives both the desktop highlight and the phone drill-down.
  const [buildingId, setBuildingId] = useState(null);
  const [floorId, setFloorId] = useState(null);
  // Form dialogs: null (closed), 'new', or the record being edited. Seats also carry the kind to start with.
  const [buildingDialog, setBuildingDialog] = useState(null);
  const [floorDialog, setFloorDialog] = useState(null);
  const [seatDialog, setSeatDialog] = useState(null);
  // Delete confirmation: null or { name, what, warning?, alternative?, run }.
  const [deleting, setDeleting] = useState(null);
  // One toast at a time: { severity, text }.
  const [toast, setToast] = useState(null);
  // Below md only one column shows, so a selection should also bring the next column into view.
  const narrow = useMediaQuery({ maxWidth: 899 });

  // [CONCEPT: useEffect] Load a building's floors, and a floor's seats, the first time each is opened.
  useEffect(() => { if (buildingId != null) loadFloors(buildingId); }, [buildingId, loadFloors]);
  useEffect(() => { if (floorId != null) loadSeats(floorId); }, [floorId, loadSeats]);

  // [CONCEPT: Loading and error state] Spinner until the first load; a retry button if it failed.
  if (!buildings) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '60vh', px: 2 }}>
        {loadError
          ? <Alert severity="error" action={<Button color="inherit" size="small" onClick={reload}>Retry</Button>}>{loadError}</Alert>
          : <CircularProgress color="secondary" />}
      </Box>
    );
  }

  // [CONCEPT: Derived state] The selected records are looked up from the ids on each render, so edits show at once.
  const building = buildings.find((b) => b.id === buildingId) ?? null;
  const floors = building ? fx.floors[building.id] : undefined;
  const floor = floors?.find((f) => f.id === floorId) ?? null;
  const seats = floor ? fx.seats[floor.id] : undefined;
  const view = floor ? 'seats' : building ? 'floors' : 'buildings';
  const activeCount = buildings.filter((b) => b.isActive).length;
  const floorTotal = buildings.reduce((n, b) => n + (b.floorCount ?? 0), 0);

  const say = (text, severity = 'success') => setToast({ severity, text });
  const top = () => { if (narrow) window.scrollTo({ top: 0 }); };

  const selectBuilding = (b) => { setBuildingId(b.id); setFloorId(null); top(); };
  const selectFloor = (f) => { setFloorId(f.id); top(); };

  // ---- Saves: the dialogs await these; a rejection (with field errors) keeps them open.

  const saveBuilding = async (payload) => {
    if (buildingDialog === 'new') {
      const created = await fx.createBuilding(payload);
      say(`${created.name} added`);
      setBuildingId(created.id);
      setFloorId(null);
    } else if (Object.keys(payload).length) {
      const saved = await fx.updateBuilding(buildingDialog.id, payload);
      say(`${saved.name} updated`);
    }
    setBuildingDialog(null);
  };

  const saveFloor = async (payload) => {
    if (floorDialog === 'new') {
      const created = await fx.createFloor(building.id, payload);
      say(`${floorName(created)} added to ${building.name}`);
    } else if (Object.keys(payload).length) {
      const saved = await fx.updateFloor(floorDialog, payload);
      say(`${floorName(saved)} updated`);
    }
    setFloorDialog(null);
  };

  const saveSeat = async (payload) => {
    if (!seatDialog.seat) {
      const created = await fx.createSeat(floor.id, payload);
      say(`${created.kind === 'room' ? 'Room' : 'Desk'} ${created.code} added`);
    } else if (Object.keys(payload).length) {
      const saved = await fx.updateSeat(seatDialog.seat, payload);
      say(`${saved.code} updated`);
    }
    setSeatDialog(null);
  };

  // [CONCEPT: Event handling] Deactivating is reversible, so it happens at once with a toast rather than a confirmation.
  const setActive = async (b, isActive) => {
    try {
      await fx.updateBuilding(b.id, { isActive });
      say(isActive ? `${b.name} is active again` : `${b.name} deactivated: hidden from the report form, history kept`);
    } catch (e) {
      say(e.message, 'error');
    }
  };

  // ---- Deletes: each builds the confirmation's text and the call to make.

  const askDeleteBuilding = (b) => setDeleting({
    name: b.name,
    what: 'building',
    warning: b.floorCount ? `It still has ${plural(b.floorCount, 'floor')}. Delete them first, or deactivate the building instead.` : '',
    // The server suggests deactivating instead, so the dialog offers it directly.
    alternative: b.isActive ? { label: 'Deactivate instead', run: async () => { await fx.updateBuilding(b.id, { isActive: false }); setDeleting(null); say(`${b.name} deactivated`); } } : null,
    run: async () => {
      await fx.deleteBuilding(b.id);
      if (b.id === buildingId) { setBuildingId(null); setFloorId(null); }
      setDeleting(null);
      say(`${b.name} deleted`);
    },
  });

  const askDeleteFloor = (f) => {
    const n = (f.deskCount ?? 0) + (f.roomCount ?? 0);
    setDeleting({
      name: `${floorName(f)} (${building.code})`,
      what: 'floor',
      warning: n ? `It still has ${plural(n, 'desk or room', 'desks and rooms')}. Delete them first.` : '',
      run: async () => {
        await fx.deleteFloor(f);
        if (f.id === floorId) setFloorId(null);
        setDeleting(null);
        say(`${floorName(f)} deleted`);
      },
    });
  };

  const askDeleteSeat = (s) => setDeleting({
    name: s.code,
    what: s.kind === 'room' ? 'room' : 'desk',
    run: async () => {
      await fx.deleteSeat(s);
      setDeleting(null);
      say(`${s.code} deleted`);
    },
  });

  return (
    <Box component="main" sx={{ maxWidth: 1280, mx: 'auto', px: { xs: 2, sm: 3.5 }, pt: 4, pb: 8, display: 'grid', gap: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase', color: admin.brown, mb: 0.5 }}>Operations</Typography>
          <Typography variant="h1">Facilities</Typography>
          <Typography sx={{ mt: 0.5, fontSize: 14, color: admin.muted }}>
            {plural(activeCount, 'active building')} · {buildings.length - activeCount} inactive · {plural(floorTotal, 'floor')}
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setBuildingDialog('new')}>Add building</Button>
      </Box>

      {/* [CONCEPT: Responsive design] Three columns from md up; below that one column, chosen by `view`. */}
      <Box sx={{ display: 'grid', gap: 2, alignItems: 'start', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) minmax(0, 0.9fr) minmax(0, 1.1fr)' } }}>
        <BuildingsPanel
          buildings={buildings}
          selectedId={buildingId}
          show={view === 'buildings'}
          onSelect={selectBuilding}
          onAdd={() => setBuildingDialog('new')}
          onEdit={setBuildingDialog}
          onToggleActive={(b) => setActive(b, !b.isActive)}
          onDelete={askDeleteBuilding}
        />
        <FloorsPanel
          building={building}
          floors={floors}
          error={building ? fx.errors[`b:${building.id}`] : ''}
          selectedId={floorId}
          show={view === 'floors'}
          onBack={() => { setBuildingId(null); setFloorId(null); }}
          onRetry={() => loadFloors(building.id, true)}
          onSelect={selectFloor}
          onAdd={() => setFloorDialog('new')}
          onEdit={setFloorDialog}
          onDelete={askDeleteFloor}
        />
        <SeatsPanel
          building={building}
          floor={floor}
          seats={seats}
          error={floor ? fx.errors[`f:${floor.id}`] : ''}
          show={view === 'seats'}
          onBack={() => setFloorId(null)}
          onRetry={() => loadSeats(floor.id, true)}
          onAdd={(kind) => setSeatDialog({ seat: null, kind })}
          onEdit={(s) => setSeatDialog({ seat: s, kind: s.kind })}
          onDelete={askDeleteSeat}
        />
      </Box>

      {/* [CONCEPT: Lifting state up] The dialogs hold only drafts; what is open, and saving, live here. */}
      <BuildingFormDialog
        open={buildingDialog !== null}
        building={buildingDialog === 'new' ? null : buildingDialog}
        others={buildings}
        onClose={() => setBuildingDialog(null)}
        onSave={saveBuilding}
      />
      <FloorFormDialog
        open={floorDialog !== null}
        floor={floorDialog === 'new' ? null : floorDialog}
        building={building}
        siblings={floors ?? []}
        onClose={() => setFloorDialog(null)}
        onSave={saveFloor}
      />
      <SeatFormDialog
        open={seatDialog !== null}
        seat={seatDialog?.seat ?? null}
        kind={seatDialog?.kind}
        context={building && floor ? `${building.code} · ${floorName(floor)}` : ''}
        siblings={seats ?? []}
        onClose={() => setSeatDialog(null)}
        onSave={saveSeat}
      />
      <DeleteDialog target={deleting} onClose={() => setDeleting(null)} onConfirm={() => deleting.run()} />

      <Snackbar open={!!toast} autoHideDuration={4500} onClose={() => setToast(null)}>
        {/* Snackbar needs a single element child; a fallback keeps it valid while the toast closes. */}
        {toast ? <Alert severity={toast.severity} onClose={() => setToast(null)}>{toast.text}</Alert> : <span />}
      </Snackbar>
    </Box>
  );
}
