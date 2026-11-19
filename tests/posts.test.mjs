import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { toListings } from '../scripts/lib/listings.mjs';
import { validatePosts } from '../scripts/lib/posts.mjs';

const raw = JSON.parse(fs.readFileSync(new URL('./fixtures/api-response.json', import.meta.url), 'utf8'));
const listings = toListings(raw).map((l) => ({ ...l, eligible: l.images.length >= 3 }));
const L = (c) => listings.find((l) => l.code === c);
const imgs = (c, n) => L(c).images.slice(0, n).map((i) => i.url);

// Tin giả có nhiều ảnh để thử luật 5 ảnh / gom tin
const fake = (code, n, price = '2 triệu') => ({
  code, link: `https://homematch.vn/p/${code}`, district: 'X', eligible: true, imageCount: n,
  rooms: [{ room: '1', priceText: price, status: 'AVAILABLE', label: '' }],
  images: Array.from({ length: n }, (_, i) => ({ url: `https://cdn.test/${code}/${i}.jpg`, isCover: i === 0, order: i })),
});
const fi = (c, n) => fake(c, n).images.map((i) => i.url);

const input = {
  targets: [
    { id: 'group:1', kind: 'group', name: 'G1', variants: 1 },
    { id: 'group:2', kind: 'group', name: 'G2', variants: 2 },
    { id: 'threads:1', kind: 'threads', name: 'Th', variants: 1 },
    { id: 'wall:1', kind: 'wall', name: 'W', variants: 1 },
  ],
  listings: [...listings, fake('F1', 6), fake('F2', 4), ...'ABCDEFGHIJK'.split('').map((c) => fake('K' + c, 3))],
};
const l2 = L('T1302');
const goodText = `Phòng ${l2.rooms[0].priceText} ${l2.link}`;
const mk = (over = {}, vover = {}) => ({
  posts: [{
    targetId: 'group:1', type: 't', postCodes: ['T1302'],
    variants: [{ key: 'A', text: goodText, images: imgs('T1302', Math.min(5, L('T1302').imageCount)), ...vover }],
    ...over,
  }],
});
const msgs = (p) => validatePosts(p, input).errors;
const has = (p, re) => msgs(p).some((e) => re.test(e.message));

test('bài hợp lệ không lỗi', () => {
  assert.deepEqual(msgs(mk()), []);
});

test('cấu trúc sai -> lỗi postIndex -1', () => {
  assert.deepEqual(msgs(null).map((e) => e.postIndex), [-1]);
  assert.deepEqual(msgs({}).map((e) => e.postIndex), [-1]);
  assert.deepEqual(msgs({ posts: 'x' }).map((e) => e.postIndex), [-1]);
});

test('luật 1: targetId lạ, 2 bài cùng nhóm', () => {
  assert.ok(has(mk({ targetId: 'group:zz' }), /không có trong input/));
  const p = mk(); p.posts.push(structuredClone(p.posts[0]));
  const e = msgs(p);
  assert.equal(e.length, 1);
  assert.equal(e[0].postIndex, 1);
  assert.match(e[0].message, /tối đa 1 bài/);
  // đích không phải group được nhiều bài
  const q = mk({ targetId: 'wall:1' }); q.posts.push(structuredClone(q.posts[0]));
  assert.deepEqual(msgs(q), []);
});

test('luật 2: postCodes phải eligible', () => {
  assert.ok(has(mk({ postCodes: ['T1299'] }), /chưa đủ điều kiện/));
  assert.ok(has(mk({ postCodes: ['NOPE'] }), /không có trong input/));
});

test('luật 3: số bản và key', () => {
  assert.ok(has(mk({ targetId: 'group:2' }), /cần 2 bản/));
  assert.ok(has(mk({}, { key: 'B' }), /key "A"/));
});

test('luật 4: ảnh bài 1 tin', () => {
  assert.ok(has(mk({}, { images: imgs('T1302', 2) }), /ít nhất 3 ảnh/));
  assert.ok(has(mk({}, { images: ['https://x/y.jpg', ...imgs('T1302', 2)] }), /không thuộc tin nào/));
  const f = (n) => ({ posts: [{ targetId: 'wall:1', type: 't', postCodes: ['F1'], variants: [{ key: 'A', text: 'giá 2 triệu https://homematch.vn/p/F1', images: fi('F1', n) }] }] });
  assert.deepEqual(msgs(f(5)), []);
  assert.ok(has(f(4), /đúng 5 ảnh/));
  // biến thể B đổi thứ tự, không bắt buộc bìa đầu
  const r = f(5); r.posts[0].variants[0].images.reverse();
  assert.deepEqual(msgs(r), []);
});

test('luật 4: bài thương hiệu 3-5 ảnh của tin eligible', () => {
  const b = (images) => ({ posts: [{ targetId: 'wall:1', type: 'b', postCodes: [], variants: [{ key: 'A', text: 'xin chào', images }] }] });
  assert.deepEqual(msgs(b(fi('F1', 4))), []);
  assert.ok(has(b(fi('F1', 2)), /3–5 ảnh/));
  assert.ok(has(b([...fi('F1', 3), ...fi('F2', 3)]), /3–5 ảnh/));
  assert.ok(has(b([...imgs('T1299', 2), ...fi('F1', 1)]), /không thuộc tin đủ điều kiện/));
});

test('luật 4: bài gom tin', () => {
  const g = (codes, images) => ({ posts: [{ targetId: 'wall:1', type: 'g', postCodes: codes, variants: [{ key: 'A', text: 'giá 2 triệu https://homematch.vn/p/F1 https://homematch.vn/p/F2', images }] }] });
  assert.deepEqual(msgs(g(['F1', 'F2'], [fi('F1', 6)[0], fi('F2', 4)[0], fi('F1', 6)[1], fi('F1', 6)[2], fi('F2', 4)[1]])), []);
  assert.ok(has(g(['F1', 'F2'], [fi('F2', 4)[0], fi('F1', 6)[0], fi('F1', 6)[1]]), /phải là bìa/));
  assert.ok(has(g(['F1', 'F2'], [...fi('F1', 6), fi('F2', 4)[0]]), /tối đa 5 ảnh/));
  // > 5 tin
  const six = ['KA', 'KB', 'KC', 'KD', 'KE', 'KF'];
  const covers = six.map((c) => fi(c, 3)[0]);
  const gk = (codes, images) => ({ posts: [{ targetId: 'wall:1', type: 'g', postCodes: codes, variants: [{ key: 'A', text: codes.map((c) => `2 triệu https://homematch.vn/p/${c}`).join(' '), images }] }] });
  assert.deepEqual(msgs(gk(six, covers)), []);
  assert.ok(has(gk(six, [...covers, fi('KA', 3)[1]]), /đúng 6 ảnh/));
  assert.ok(has(gk(six, covers.slice(0, 5)), /đúng 6 ảnh/));
  const eleven = 'ABCDEFGHIJK'.split('').map((c) => 'K' + c);
  assert.ok(has(gk(eleven, eleven.map((c) => fi(c, 3)[0])), /vượt tối đa 10/));
  assert.deepEqual(msgs(gk(eleven.slice(0, 10), eleven.slice(0, 10).map((c) => fi(c, 3)[0]))), []);
});

test('luật 5: định dạng văn bản', () => {
  assert.ok(has(mk({}, { text: goodText + ' **đậm**' }), /\*\*/));
  assert.ok(has(mk({}, { text: goodText + ' __x__' }), /__/));
  assert.ok(has(mk({}, { text: '# Tiêu đề\n' + goodText }), /bắt đầu bằng "#"/));
  assert.ok(has(mk({}, { text: goodText + ' \u{1D5EF}' }), /toán học/));
  assert.deepEqual(msgs(mk({}, { text: 'dòng\n' + goodText + ' #hashtag' })), []);
});

test('luật 5: Threads <= 500 code point', () => {
  const t = (text) => mk({ targetId: 'threads:1' }, { text });
  const pad = (n) => goodText + ' ' + '😀'.repeat(n - [...goodText].length - 1);
  assert.equal([...pad(500)].length, 500);
  assert.deepEqual(msgs(t(pad(500))), []);
  assert.ok(has(t(pad(501)), /500/));
  // đích khác không giới hạn
  assert.deepEqual(msgs(mk({}, { text: pad(600) })), []);
});

test('luật 6: giá nguyên văn', () => {
  assert.ok(has(mk({}, { text: `Phòng 3tr5 ${l2.link}` }), /giá nào đúng nguyên văn/));
  assert.ok(has(mk({}, { text: `Phòng 13,5 triệu ${l2.link}` }), /giá nào đúng nguyên văn/));
  // một trong các phòng là đủ
  const second = l2.rooms.find((r) => r.priceText !== l2.rooms[0].priceText);
  if (second) assert.deepEqual(msgs(mk({}, { text: `${second.priceText} ${l2.link}` })), []);
  // bài thương hiệu bỏ qua
  const b = { posts: [{ targetId: 'wall:1', type: 'b', postCodes: [], variants: [{ key: 'A', text: 'không giá', images: fi('F1', 3) }] }] };
  assert.deepEqual(msgs(b), []);
});

test('luật 7: URL homematch.vn', () => {
  assert.ok(has(mk({}, { text: goodText + ' https://homematch.vn/p/T9999' }), /không khớp link/));
  assert.ok(has(mk({}, { text: goodText + ' https://app.homematch.vn/x' }), /không khớp link/));
  assert.deepEqual(msgs(mk({}, { text: goodText + '/ và https://example.com/x' })), []);
  assert.deepEqual(msgs(mk({}, { text: `${l2.rooms[0].priceText} ${l2.link}/.` })), []);
  // host giả không tính
  assert.deepEqual(msgs(mk({}, { text: goodText + ' https://nothomematch.vn/a' })), []);
  // bài thương hiệu bỏ qua luật link
  const b = { posts: [{ targetId: 'wall:1', type: 'b', postCodes: [], variants: [{ key: 'A', text: 'https://homematch.vn', images: fi('F1', 3) }] }] };
  assert.deepEqual(msgs(b), []);
});

test('gom mọi lỗi, không dừng ở lỗi đầu', () => {
  const e = msgs(mk({ targetId: 'zz' }, { key: 'B', text: '**x** 3tr5', images: imgs('T1302', 1) }));
  assert.ok(e.length >= 4);
});
