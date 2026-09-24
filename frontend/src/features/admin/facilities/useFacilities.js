// Data hook for the facilities page: loads buildings up front, and a
// building's floors or a floor's seats the first time they are opened. Every
// create / edit / delete keeps those caches and their counts in step with the
// server, so the page never has to refetch after a change.
import { useCallback, useEffect, useRef, useState } from 'react';
import { facilitiesApi } from '../../../services/facilitiesApi';

// [CONCEPT: Pure helper function] Replace one item by id; `undefined` counts on the server copy keep the old value.
const replace = (list, next) => list.map((x) => (x.id === next.id
  ? Object.fromEntries(Object.entries({ ...x, ...next }).map(([k, v]) => [k, v === undefined ? x[k] : v]))
  : x));
const bump = (n, by) => (n == null ? n : n + by);

// [CONCEPT: Custom hook] The page gets data plus actions; it never calls facilitiesApi itself.
export default function useFacilities() {
  // null until the first load; then Building[].
  const [buildings, setBuildings] = useState(null);
  const [loadError, setLoadError] = useState('');
  // Caches keyed by parent id: { [buildingId]: Floor[] } and { [floorId]: Seat[] }.
  // A missing key means "not loaded yet"; errors are kept per key so one bad load does not blank the page.
  const [floors, setFloors] = useState({});
  const [seats, setSeats] = useState({});
  const [errors, setErrors] = useState({});
  // [CONCEPT: useRef] Which loads are in flight, so a quick double selection does not fetch twice.
  const inFlight = useRef(new Set());

  const reload = useCallback(async () => {
    setLoadError('');
    try {
      setBuildings(await facilitiesApi.listBuildings());
    } catch (e) {
      setLoadError(e.message);
    }
  }, []);

  // [CONCEPT: useEffect] Fetch once on mount. reload is stable, so this does not re-run.
  useEffect(() => { reload(); }, [reload]);

  // Loads a child list into its cache unless it is already there (or `force`).
  const load = useCallback(async (key, fetcher, setter, cache, force) => {
    if ((!force && cache !== undefined) || inFlight.current.has(key)) return;
    inFlight.current.add(key);
    setErrors((e) => ({ ...e, [key]: undefined }));
    try {
      const list = await fetcher();
      setter((c) => ({ ...c, [key.split(':')[1]]: list }));
    } catch (e) {
      setErrors((errs) => ({ ...errs, [key]: e.message }));
    }
    inFlight.current.delete(key);
  }, []);

  // [CONCEPT: Async data fetching] Floors and seats arrive on demand, when the page selects a parent.
  const loadFloors = useCallback((buildingId, force) => load(`b:${buildingId}`, () => facilitiesApi.listFloors(buildingId), setFloors, floors[buildingId], force), [load, floors]);
  const loadSeats = useCallback((floorId, force) => load(`f:${floorId}`, () => facilitiesApi.listSeats(floorId), setSeats, seats[floorId], force), [load, seats]);

  // ---- Buildings ---------------------------------------------------------

  const createBuilding = useCallback(async (form) => {
    const created = await facilitiesApi.createBuilding(form);
    // [CONCEPT: Immutable update] New arrays every time, so React sees the change.
    setBuildings((list) => [...list, created].sort((a, b) => a.name.localeCompare(b.name)));
    setFloors((c) => ({ ...c, [created.id]: [] }));
    return created;
  }, []);

  const updateBuilding = useCallback(async (id, changes) => {
    const saved = await facilitiesApi.updateBuilding(id, changes);
    setBuildings((list) => replace(list, saved).sort((a, b) => a.name.localeCompare(b.name)));
    return saved;
  }, []);

  // Rejects (409) while the building has floors or incidents; the dialog shows that message.
  const deleteBuilding = useCallback(async (id) => {
    await facilitiesApi.deleteBuilding(id);
    setBuildings((list) => list.filter((b) => b.id !== id));
  }, []);

  // ---- Floors ------------------------------------------------------------

  const byLevel = (a, b) => a.level - b.level;

  const createFloor = useCallback(async (buildingId, form) => {
    const created = await facilitiesApi.createFloor(buildingId, form);
    setFloors((c) => ({ ...c, [buildingId]: [...(c[buildingId] ?? []), created].sort(byLevel) }));
    setSeats((c) => ({ ...c, [created.id]: [] }));
    setBuildings((list) => list.map((b) => (b.id === buildingId ? { ...b, floorCount: bump(b.floorCount, 1) } : b)));
    return created;
  }, []);

  const updateFloor = useCallback(async (floor, changes) => {
    const saved = await facilitiesApi.updateFloor(floor.id, changes);
    setFloors((c) => ({ ...c, [floor.buildingId]: replace(c[floor.buildingId] ?? [], saved).sort(byLevel) }));
    return saved;
  }, []);

  const deleteFloor = useCallback(async (floor) => {
    await facilitiesApi.deleteFloor(floor.id);
    setFloors((c) => ({ ...c, [floor.buildingId]: (c[floor.buildingId] ?? []).filter((f) => f.id !== floor.id) }));
    setBuildings((list) => list.map((b) => (b.id === floor.buildingId ? { ...b, floorCount: bump(b.floorCount, -1) } : b)));
  }, []);

  // ---- Seats -------------------------------------------------------------

  // Keeps a floor's desk and room counts right after a seat is added, removed or changes kind.
  const recount = useCallback((floorId, list) => {
    const deskCount = list.filter((s) => s.kind !== 'room').length;
    setFloors((c) => Object.fromEntries(Object.entries(c).map(([bid, fl]) => [bid, fl.map((f) => (f.id === floorId ? { ...f, deskCount, roomCount: list.length - deskCount } : f))])));
  }, []);

  // Newest seat cache, read after an await, so the list and its counts are
  // computed once, outside any state updater.
  const seatsRef = useRef(seats);
  seatsRef.current = seats;
  const writeSeats = useCallback((floorId, change) => {
    const list = change(seatsRef.current[floorId] ?? []).sort((a, b) => a.code.localeCompare(b.code));
    seatsRef.current = { ...seatsRef.current, [floorId]: list };
    setSeats((c) => ({ ...c, [floorId]: list }));
    recount(floorId, list);
  }, [recount]);

  const createSeat = useCallback(async (floorId, form) => {
    const created = await facilitiesApi.createSeat(floorId, form);
    writeSeats(floorId, (list) => [...list, created]);
    return created;
  }, [writeSeats]);

  const updateSeat = useCallback(async (seat, changes) => {
    const saved = await facilitiesApi.updateSeat(seat.id, changes);
    writeSeats(seat.floorId, (list) => replace(list, saved));
    return saved;
  }, [writeSeats]);

  // Rejects (409) while incidents name the seat.
  const deleteSeat = useCallback(async (seat) => {
    await facilitiesApi.deleteSeat(seat.id);
    writeSeats(seat.floorId, (list) => list.filter((s) => s.id !== seat.id));
  }, [writeSeats]);

  return {
    buildings, floors, seats, errors, loadError, reload, loadFloors, loadSeats,
    createBuilding, updateBuilding, deleteBuilding,
    createFloor, updateFloor, deleteFloor,
    createSeat, updateSeat, deleteSeat,
  };
}
