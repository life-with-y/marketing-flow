import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fetchListingsRaw, ApiError } from '../scripts/lib/api.mjs';
import { toListings, formatPrice } from '../scripts/lib/listings.mjs';

const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/api-response.json', import.meta.url), 'utf8'));
const resp = (status, body) => async () => ({
  ok: status >= 200 && status < 300, status, json: async () => body,
});

test('formatPrice', () => {
  assert.equal(formatPrice(3500000), '3,5 triệu');
  assert.equal(formatPrice(4000000), '4 triệu');
  assert.equal(formatPrice(3550000), '3,55 triệu');
  assert.equal(formatPrice(3555000), '3,555 triệu');
  assert.equal(formatPrice(3505000), '3,505 triệu');
  assert.equal(formatPrice(12000000), '12 triệu');
});

test('toListings gom phòng cùng post_code', () => {
  const ls = toListings(fixture);
  assert.deepEqual(ls.map((l) => l.code).sort(), ['T1275', 'T1288', 'T1299', 'T1302']);
  const l = ls.find((x) => x.code === 'T1302');
  assert.equal(l.district, 'Cầu Giấy');
  assert.equal(l.buildingName, 'Tòa Dịch Vọng');
  assert.equal(l.link, 'https://homematch.vn/p/T1302');
  assert.equal(l.rooms.length, 2);
  assert.deepEqual(l.rooms[0], {
    room: '301', price: 3500000, priceText: '3,5 triệu', status: 'AVAILABLE',
    statusText: 'Còn trống', services: ['Wifi', 'Giữ xe'], furniture: ['Giường', 'Tủ quần áo'],
  });
});

test('ảnh: bìa đầu, bỏ video, bỏ trùng url', () => {
  const l = toListings(fixture).find((x) => x.code === 'T1302');
  assert.equal(l.images[0].isCover, true);
  assert.equal(l.images[0].url, 'https://cdn.example.test/img/2.jpg');
  assert.ok(l.images.every((i) => !i.url.includes('/vid/')));
  const urls = l.images.map((i) => i.url);
  assert.equal(new Set(urls).size, urls.length);
  assert.equal(l.imageCount, 6);
  assert.deepEqual(urls.slice(1, 3), ['https://cdn.example.test/img/1.jpg', 'https://cdn.example.test/img/3.jpg']);
});

test('tin 2 ảnh và COMING_SOON', () => {
  const ls = toListings(fixture);
  assert.equal(ls.find((x) => x.code === 'T1299').imageCount, 2);
  assert.equal(ls.find((x) => x.code === 'T1275').rooms[0].status, 'COMING_SOON');
});

test('fetchListingsRaw 401 -> auth, không lộ token', async () => {
  await assert.rejects(
    fetchListingsRaw({ baseUrl: 'https://x.test', token: 'tok_secret_123', fetchImpl: resp(401, {}) }),
    (e) => e instanceof ApiError && e.kind === 'auth' && !String(e).includes('tok_secret_123') && !e.message.includes('tok_secret_123'),
  );
});

test('fetchListingsRaw 5xx và lỗi mạng -> network', async () => {
  await assert.rejects(fetchListingsRaw({ baseUrl: 'https://x.test', token: 't', fetchImpl: resp(502, {}) }), (e) => e.kind === 'network');
  await assert.rejects(fetchListingsRaw({ baseUrl: 'https://x.test', token: 't', fetchImpl: async () => { throw new Error('boom'); } }), (e) => e.kind === 'network');
});

test('fetchListingsRaw schema sai -> schema', async () => {
  await assert.rejects(fetchListingsRaw({ baseUrl: 'https://x.test', token: 't', fetchImpl: resp(200, { data: [{}] }) }), (e) => e.kind === 'schema');
});

test('fetchListingsRaw ok gửi đúng url + header', async () => {
  let seen;
  const raw = await fetchListingsRaw({ baseUrl: 'https://x.test/', token: 'tk', fetchImpl: async (u, o) => { seen = [u, o]; return { ok: true, status: 200, json: async () => fixture }; } });
  assert.equal(seen[0], 'https://x.test/public/building-listing-posts-unit');
  assert.equal(seen[1].headers['x-public-api-token'], 'tk');
  assert.equal(raw.count, 5);
});

test('fetchListingsRaw rent_price sai -> schema', async () => {
  for (const bad of [null, undefined, 0, -5, '3500000', NaN, 3500000.5]) {
    const body = structuredClone(fixture);
    body.data[0].areas[0].buildings[0].rooms[0].rent_price = bad;
    await assert.rejects(fetchListingsRaw({ baseUrl: 'https://x.test', token: 't', fetchImpl: resp(200, body) }), (e) => e.kind === 'schema', String(bad));
  }
});
