// Cụm nhóm: một khu vực × một phân khúc. Mỗi khung soạn một bài cho cụm (đăng trên trang cá nhân rồi
// chia sẻ vào các nhóm của cụm); nhóm thật do người dùng tự tìm và tham gia.
import { fold } from './targets.mjs';

const STUDENT_MAX = 5_000_000;
const APARTMENT_MIN = 5_000_000;
const APARTMENT_TYPES = new Set(['STUDIO', 'ONE_BEDROOM', 'TWO_BEDROOM', 'LOFT_APARTMENT', 'APARTMENT']);

const rooms = (l) => (Array.isArray(l?.rooms) ? l.rooms : []);

export const SEGMENTS = {
  room: {
    label: 'phòng trọ',
    rule: 'Mọi tin',
    test: () => true,
  },
  student: {
    label: 'sinh viên, giá rẻ',
    rule: 'Có phòng dưới 5 triệu',
    test: (l) => rooms(l).some((r) => Number(r.price) < STUDENT_MAX),
  },
  apartment: {
    label: 'căn hộ mini',
    rule: 'Studio, 1 ngủ 1 khách, gác lửng từ 5 triệu',
    test: (l) => rooms(l).some((r) => APARTMENT_TYPES.has(r.unitType) && Number(r.price) >= APARTMENT_MIN),
  },
};
export const SEGMENT_KEYS = Object.keys(SEGMENTS);

export function segmentRule(segment) {
  return SEGMENTS[segment]?.rule ?? '';
}

// Tin thuộc cụm: đúng quận (cụm không khai quận = toàn Hà Nội) và đúng phân khúc.
export function inCluster(listing, cluster) {
  const ds = Array.isArray(cluster?.districts) ? cluster.districts : [];
  if (ds.length && !ds.some((d) => fold(d) === fold(listing?.district))) return false;
  const seg = SEGMENTS[cluster?.segment ?? 'room'];
  return seg ? seg.test(listing) : false;
}

export const joinedGroups = (cluster) => (Array.isArray(cluster?.groups) ? cluster.groups : [])
  .filter((g) => g && g.joined === true && typeof g.url === 'string')
  .map((g) => ({ name: g.name ?? g.url, url: g.url }));
