const RANK = ['NEW', 'PRICE_DOWN', 'NOW_AVAILABLE', 'UNCHANGED', 'PRICE_UP'];

// Route cũ chỉ trả phòng rẻ nhất + đắt nhất của tin. Lần đầu đổi sang route mới, phòng chưa từng thấy
// của một tin đã có không phải phòng mới lên.
function roomLabel(prevRoom, room, prevListing, listing) {
  if (!prevRoom) return prevListing && (prevListing.source ?? 'legacy') !== (listing.source ?? 'legacy') ? 'UNCHANGED' : 'NEW';
  if (room.price < prevRoom.price) return 'PRICE_DOWN';
  if (room.status === 'AVAILABLE' && prevRoom.status !== 'AVAILABLE') return 'NOW_AVAILABLE';
  if (room.price > prevRoom.price) return 'PRICE_UP';
  return 'UNCHANGED';
}

export function labelListings(prev, curr) {
  const prevRooms = new Map();
  const prevListings = new Map();
  for (const l of prev || []) {
    prevListings.set(l.code, l);
    for (const r of l.rooms) prevRooms.set(`${l.code}\u0000${r.room}`, r);
  }
  return curr.map((l) => {
    const rooms = l.rooms.map((r) => ({
      ...r,
      label: prev === null || prev === undefined ? 'UNCHANGED' : roomLabel(prevRooms.get(`${l.code}\u0000${r.room}`), r, prevListings.get(l.code), l),
    }));
    const label = rooms.reduce((best, r) => (RANK.indexOf(r.label) < RANK.indexOf(best) ? r.label : best), 'PRICE_UP');
    return { ...l, rooms, label: rooms.length ? label : 'UNCHANGED' };
  });
}
