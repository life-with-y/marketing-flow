const RANK = ['NEW', 'PRICE_DOWN', 'NOW_AVAILABLE', 'UNCHANGED', 'PRICE_UP'];

function roomLabel(prevRoom, room) {
  if (!prevRoom) return 'NEW';
  if (room.price < prevRoom.price) return 'PRICE_DOWN';
  if (room.status === 'AVAILABLE' && prevRoom.status !== 'AVAILABLE') return 'NOW_AVAILABLE';
  if (room.price > prevRoom.price) return 'PRICE_UP';
  return 'UNCHANGED';
}

export function labelListings(prev, curr) {
  const prevRooms = new Map();
  for (const l of prev || []) for (const r of l.rooms) prevRooms.set(`${l.code}\u0000${r.room}`, r);
  return curr.map((l) => {
    const rooms = l.rooms.map((r) => ({
      ...r,
      label: prev === null || prev === undefined ? 'UNCHANGED' : roomLabel(prevRooms.get(`${l.code}\u0000${r.room}`), r),
    }));
    const label = rooms.reduce((best, r) => (RANK.indexOf(r.label) < RANK.indexOf(best) ? r.label : best), 'PRICE_UP');
    return { ...l, rooms, label: rooms.length ? label : 'UNCHANGED' };
  });
}
