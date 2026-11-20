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

// ---- Route mới /public/marketing-listings ----
// Chuẩn hoá về cùng dạng tin như route cũ, thêm `details` và trường phòng mới.
// Mọi chữ tiền phụ (phí, cọc) viết bằng "đ", không dùng "triệu", để bộ kiểm tra giá không nhầm với giá thuê.

const UNIT_TYPE = {
  STUDIO: 'Studio', STUDIO_LOFT: 'Studio gác lửng', BOARDING_ROOM: 'Phòng trọ', PRIVATE_ROOM: 'Phòng riêng',
  MINI_APARTMENT: 'Chung cư mini', SHARED: 'Ở ghép', DORM: 'Ở ghép (giường tầng)', DUPLEX: 'Duplex',
  DUPLEX_TWO_BEDROOM: 'Duplex 2 ngủ', ONE_BEDROOM: '1 ngủ 1 khách', ONE_BEDROOM_LOFT: '1 ngủ gác lửng',
  TWO_BEDROOM: '2 ngủ', TWO_BEDROOM_TWO_BATH: '2 ngủ 2 vệ sinh',
};
const FEE = { ELECTRICITY: 'Điện', WATER: 'Nước', SERVICE: 'Dịch vụ', INTERNET: 'Internet', PARKING: 'Gửi xe', SECURITY: 'An ninh' };
const BILL = { PER_KWH: '/số', PER_M3: '/khối', PER_PERSON_MONTH: '/người/tháng', PER_ROOM_MONTH: '/phòng/tháng', PER_VEHICLE_MONTH: '/xe/tháng' };
const PET = { NOT_ALLOWED: 'Không nuôi thú cưng', ALLOWED: 'Nuôi được thú cưng', DOG: 'Nuôi được chó', CAT: 'Nuôi được mèo', DOG_AND_CAT: 'Nuôi được chó, mèo' };
const MODE = { WALK: 'đi bộ', WALKING: 'đi bộ', TWO_WHEELER: 'xe máy', MOTORBIKE: 'xe máy', MOTORCYCLE: 'xe máy', BICYCLE: 'xe đạp', BICYCLING: 'xe đạp', DRIVE: 'ô tô', DRIVING: 'ô tô', CAR: 'ô tô' };

export const dong = (n) => `${Math.round(n).toLocaleString('de-DE')}đ`;
const viNum = (n) => String(n).replace('.', ',');
const ddmm = (iso) => { const [, m, d] = String(iso).slice(0, 10).split('-'); return `${d}/${m}`; };
const km = (m) => (m < 1000 ? `${m} m` : `${viNum(Math.round(m / 100) / 10)} km`);

export function statusTextOf(status, availableFrom) {
  if (status === 'AVAILABLE') return 'Còn trống';
  return availableFrom ? `Trống từ ${ddmm(availableFrom)}` : 'Sắp trống';
}

function feeText(f) {
  const name = FEE[f.fee_key] ?? f.fee_key;
  if (f.amount_vnd === 0) return `${name}: miễn phí`;
  return `${name}: ${dong(f.amount_vnd)}${BILL[f.billing_unit_key] ?? ''}`;
}

function depositText(d) {
  if (!d) return null;
  if (d.rent_multiplier) return `Cọc ${viNum(d.rent_multiplier)} tháng`;
  if (d.amount_vnd) return `Cọc ${dong(d.amount_vnd)}`;
  return null;
}

// Câu dữ kiện tiếng Việt từ khảo sát toà; chỉ ghi khi có giá trị (null = không biết, bỏ).
export function surveyFacts(s) {
  if (!s) return [];
  const out = [];
  const yn = (v, yes, no) => { if (v === true) out.push(yes); else if (v === false && no) out.push(no); };
  if (s.access_type) out.push(`Lối vào: ${s.access_type.toLowerCase()}`);
  if (s.road_width_m) out.push(`Đường vào rộng ${viNum(s.road_width_m)} m`);
  if (s.car_stop_distance_m === 0) out.push('Ô tô đỗ tận cửa');
  else if (s.car_stop_distance_m) out.push(`Ô tô đỗ cách ${km(s.car_stop_distance_m)}`);
  if (s.has_car_parking_lot === true) out.push(s.car_parking_lot_distance_m ? `Có bãi đỗ ô tô cách ${km(s.car_parking_lot_distance_m)}` : 'Có bãi đỗ ô tô');
  yn(s.has_elevator, 'Có thang máy', 'Không có thang máy');
  yn(s.allows_ebike_parking, 'Để được xe điện', 'Không nhận xe điện');
  if (s.pet_policy && PET[s.pet_policy]) out.push(PET[s.pet_policy]);
  yn(s.allows_foreigners, 'Nhận khách nước ngoài', null);
  yn(s.has_security, 'Có bảo vệ / an ninh', null);
  yn(s.lives_with_owner, 'Chung chủ', 'Không chung chủ');
  yn(s.allows_short_stay, 'Nhận thuê ngắn hạn', null);
  if (s.min_contract_months) out.push(`Hợp đồng tối thiểu ${s.min_contract_months} tháng`);
  if (s.payment_cycle_months) out.push(`Đóng tiền ${s.payment_cycle_months} tháng/lần`);
  if (s.max_occupants) out.push(`Tối đa ${s.max_occupants} người/phòng`);
  return out;
}

function landmarkText(l) {
  const mode = MODE[String(l.travel_mode).toUpperCase()];
  const min = Math.max(1, Math.round(l.duration_seconds / 60));
  return `${l.name}: ${km(l.distance_m)}${mode ? `, khoảng ${min} phút ${mode}` : ''}`;
}

export function marketingToListings(raw) {
  return (raw.listings || []).map((l) => {
    const b = l.building || {};
    const images = (l.media || [])
      .filter((m) => m.media_type === 'IMAGE')
      .filter((m, i, a) => a.findIndex((x) => x.url === m.url) === i)
      .map((m, i) => ({ url: m.url, isCover: !!m.is_cover, order: i }))
      .sort((x, y) => (y.isCover - x.isCover) || (x.order - y.order));
    return {
      source: 'marketing',
      code: l.code,
      link: l.share_link,
      district: b.district,
      buildingName: b.display_address,
      address: b.display_address,
      title: l.title,
      titleEn: l.title_en ?? null,
      availableUnitsCount: l.available_units_count,
      rooms: (l.rooms || []).map((r) => ({
        room: r.room_number,
        price: r.rent_vnd,
        priceText: formatPrice(r.rent_vnd),
        status: r.availability_status,
        statusText: statusTextOf(r.availability_status, r.available_from),
        services: [],
        furniture: r.furniture || [],
        unitType: r.unit_type_key,
        unitTypeText: UNIT_TYPE[r.unit_type_key] ?? r.unit_type_key,
        roomType: r.room_type ?? null,
        areaSqm: r.area_sqm ?? null,
        capacity: r.capacity ?? null,
        floor: r.floor ?? null,
        availableFrom: r.available_from ?? null,
        amenities: (r.amenities || []).map((a) => a.label ?? a.key),
      })),
      details: {
        ward: b.ward ?? null,
        deposit: depositText(b.deposit),
        fees: (b.fees || []).map(feeText),
        amenities: (b.amenities || []).map((a) => a.label ?? a.key),
        facts: surveyFacts(b.survey),
        landmarks: (b.landmarks || []).slice(0, 3).map(landmarkText),
        availabilityVerified: l.availability_verified_at ? `Đã kiểm tra còn phòng ngày ${ddmm(l.availability_verified_at)}` : null,
        priceVerified: l.price_verified_at ? `Đã kiểm tra giá ngày ${ddmm(l.price_verified_at)}` : null,
      },
      images,
      imageCount: images.length,
    };
  });
}

// Một chỗ cho cả hai route.
export function normalizeListings({ source, raw }) {
  return source === 'marketing' ? marketingToListings(raw) : toListings(raw);
}
