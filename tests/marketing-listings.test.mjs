import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fetchListings, fetchMarketingRaw, ApiError } from '../scripts/lib/api.mjs';
import { marketingToListings, normalizeListings, surveyFacts } from '../scripts/lib/listings.mjs';
import { labelListings } from '../scripts/lib/diff.mjs';
import { validatePosts } from '../scripts/lib/posts.mjs';

const read = (f) => JSON.parse(fs.readFileSync(new URL(`./fixtures/${f}`, import.meta.url), 'utf8'));
const mkt = read('marketing-response.json');
const legacy = read('api-response.json');
const resp = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

test('fetchListings dùng route mới khi có', async () => {
  const seen = [];
  const r = await fetchListings({ baseUrl: 'https://x.test/', token: 'tk', fetchImpl: async (u, o) => { seen.push(u); assert.equal(o.headers['x-public-api-token'], 'tk'); return resp(200, mkt); } });
  assert.equal(r.source, 'marketing');
  assert.deepEqual(seen, ['https://x.test/public/marketing-listings']);
});

test('fetchListings: route mới 404 thì lùi về route cũ', async () => {
  const seen = [];
  const r = await fetchListings({ baseUrl: 'https://x.test', token: 't', fetchImpl: async (u) => { seen.push(u); return u.includes('marketing') ? resp(404, {}) : resp(200, legacy); } });
  assert.equal(r.source, 'legacy');
  assert.equal(seen[1], 'https://x.test/public/building-listing-posts-unit');
});

test('fetchListings: 401 / 5xx ở route mới không lùi', async () => {
  await assert.rejects(fetchListings({ baseUrl: 'https://x.test', token: 't', fetchImpl: async () => resp(401, {}) }), (e) => e.kind === 'auth');
  await assert.rejects(fetchListings({ baseUrl: 'https://x.test', token: 't', fetchImpl: async () => resp(502, {}) }), (e) => e.kind === 'network');
});

test('fetchMarketingRaw schema sai -> schema', async () => {
  for (const body of [{}, { listings: [{}] }, { listings: [{ ...mkt.listings[0], rooms: [{ rent_vnd: 0 }] }] }]) {
    await assert.rejects(fetchMarketingRaw({ baseUrl: 'https://x.test', token: 't', fetchImpl: async () => resp(200, body) }), (e) => e instanceof ApiError && e.kind === 'schema');
  }
});

test('chuẩn hoá tin route mới', () => {
  const [l, l2] = marketingToListings(mkt, '2026-11-20');
  assert.equal(l.source, 'marketing');
  assert.equal(l.code, 'T1302');
  assert.equal(l.address, 'ngõ 100 Trần Thái Tông');
  assert.equal(l.title, 'Studio ban công thoáng, đủ đồ');
  assert.equal(l.availableUnitsCount, 2);
  assert.deepEqual(l.images.map((i) => i.url), ['https://cdn.example.test/img/2.jpg', 'https://cdn.example.test/img/1.jpg', 'https://cdn.example.test/img/3.jpg']);
  assert.equal(l.imageCount, 3);
  const [r1, r2] = l.rooms;
  assert.equal(r1.priceText, '3,5 triệu');
  assert.equal(r1.statusText, 'Còn trống');
  assert.equal(r1.unitTypeText, 'Studio');
  assert.equal(r1.areaSqm, 25);
  assert.deepEqual(r1.amenities, ['Ban công']);
  assert.equal(r2.statusText, 'Trống từ 01/12');
  assert.equal(r2.unitTypeText, '1 ngủ 1 khách');
  assert.equal(l2.rooms[0].statusText, 'Sắp trống');
  assert.equal(l2.rooms[0].unitTypeText, 'NEW_TYPE');
  const d = l.details;
  assert.equal(d.ward, 'Dịch Vọng Hậu');
  assert.equal(d.deposit, 'Cọc 1 tháng');
  assert.deepEqual(d.fees, ['Điện: 3.990đ/số', 'Nước: 35.000đ/khối', 'Dịch vụ: 150.000đ/người/tháng', 'Internet: miễn phí']);
  assert.deepEqual(d.amenities, ['Thang máy', 'WASHING_MACHINE_SHARED']);
  assert.deepEqual(d.landmarks, ['ĐH Quốc gia Hà Nội: 1,2 km, khoảng 5 phút xe máy', 'ĐH Sư phạm Hà Nội: 800 m, khoảng 10 phút đi bộ', 'Công viên Cầu Giấy: 2,5 km']);
  assert.equal(d.availabilityVerified, 'Đã kiểm tra còn phòng ngày 19/11');
  assert.equal(d.priceVerified, 'Đã kiểm tra giá ngày 18/11');
  assert.equal(l2.details.deposit, null);
  assert.deepEqual(l2.details.facts, []);
});

test('ngày trống đã qua -> Sắp trống', () => {
  const [l] = marketingToListings(mkt, '2026-12-02');
  assert.equal(l.rooms[1].statusText, 'Sắp trống');
});

test('surveyFacts: chỉ ghi khi biết', () => {
  assert.deepEqual(surveyFacts(mkt.listings[0].building.survey), [
    'Lối vào: ngõ ô tô', 'Đường vào rộng 3,5 m', 'Ô tô đỗ tận cửa', 'Có thang máy', 'Không nhận xe điện',
    'Nuôi được mèo', 'Không chung chủ', 'Hợp đồng tối thiểu 6 tháng', 'Đóng tiền 1 tháng/lần', 'Tối đa 2 người/phòng',
  ]);
  assert.deepEqual(surveyFacts({ car_stop_distance_m: 50, has_car_parking_lot: true, car_parking_lot_distance_m: 1500, deposit: 1 }), ['Ô tô đỗ cách 50 m', 'Có bãi đỗ ô tô cách 1,5 km']);
});

test('normalizeListings chọn theo nguồn', () => {
  assert.equal(normalizeListings({ source: 'legacy', raw: legacy }).length, 4);
  assert.equal(normalizeListings({ source: 'marketing', raw: mkt }).length, 2);
});

test('đổi từ route cũ sang mới: phòng chưa thấy của tin cũ không phải NEW', () => {
  const prev = [{ code: 'T1302', rooms: [{ room: '301', price: 3500000, status: 'AVAILABLE' }] }];
  const [l] = labelListings(prev, marketingToListings(mkt).slice(0, 1));
  assert.deepEqual(l.rooms.map((r) => r.label), ['UNCHANGED', 'UNCHANGED']);
  const [again] = labelListings(marketingToListings(mkt).slice(0, 1).map((x) => ({ ...x, rooms: x.rooms.slice(0, 1) })), marketingToListings(mkt).slice(0, 1));
  assert.deepEqual(again.rooms.map((r) => r.label), ['UNCHANGED', 'NEW']);
});

test('phí, cọc viết bằng đ không bị bộ kiểm tra coi là giá thuê', () => {
  const l = { ...marketingToListings(mkt)[0], eligible: true };
  const text = `Studio – Cầu Giấy\n💰 3,5 triệu/tháng\n⚡ ${l.details.fees.join(' • ')}\n${l.details.deposit}\n${l.link}`;
  const input = { targets: [{ id: 'wall:fb1:0', kind: 'wall', variants: 1 }], listings: [l] };
  const posts = { posts: [{ targetId: 'wall:fb1:0', type: 'x', postCodes: ['T1302'], variants: [{ key: 'A', text, images: l.images.map((i) => i.url) }] }] };
  assert.deepEqual(validatePosts(posts, input).errors, []);
});
