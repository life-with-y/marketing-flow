export function formatPrice(vnd) {
  const whole = Math.floor(vnd / 1e6);
  const frac = String(vnd % 1e6).padStart(6, '0').replace(/0+$/, '');
  return `${whole}${frac ? ',' + frac : ''} triệu`;
}

export function toListings(raw) {
  const byCode = new Map();
  for (const cust of raw.data || []) {
    for (const area of cust.areas || []) {
      for (const b of area.buildings || []) {
        for (const r of b.rooms || []) {
          let l = byCode.get(r.post_code);
          if (!l) {
            l = {
              code: r.post_code,
              link: r.share_link,
              district: area.district,
              buildingName: b.building_name,
              address: b.address_text,
              rooms: [],
              images: [],
              imageCount: 0,
              _seen: new Set(),
            };
            byCode.set(r.post_code, l);
          }
          l.rooms.push({
            room: r.room_number,
            price: r.rent_price,
            priceText: formatPrice(r.rent_price),
            status: r.availability_status,
            statusText: r.availability_text,
            services: r.services || [],
            furniture: r.furniture || [],
          });
          for (const m of r.media || []) {
            if (m.media_type !== 'IMAGE' || l._seen.has(m.url)) continue;
            l._seen.add(m.url);
            l.images.push({ url: m.url, isCover: !!m.is_cover, order: m.sort_order ?? 0 });
          }
        }
      }
    }
  }
  return [...byCode.values()].map((l) => {
    const { _seen, ...rest } = l;
    rest.images.sort((a, b) => (b.isCover - a.isCover) || (a.order - b.order));
    rest.imageCount = rest.images.length;
    return rest;
  });
}
