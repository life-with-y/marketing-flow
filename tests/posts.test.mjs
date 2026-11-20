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
  listings: [...listings, fake('F1', 6), fake('F2', 4), { ...fake('T2142', 5), rooms: [{ room: 'T101', priceText: '2 triệu', status: 'AVAILABLE', label: '' }] }, ...'ABCDEFGHIJK'.split('').map((c) => fake('K' + c, 3))],
};
const l2 = L('T1302');
const goodText = `Phòng ${l2.rooms[0].priceText}`;
// Threads được để link trong thân bài
const th = (text) => mk({ targetId: 'threads:1' }, { text });
const thGood = `${goodText} ${l2.link}`;
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
  const f = (n) => ({ posts: [{ targetId: 'wall:1', type: 't', postCodes: ['F1'], variants: [{ key: 'A', text: 'giá 2 triệu', images: fi('F1', n) }] }] });
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
  const g = (codes, images) => ({ posts: [{ targetId: 'wall:1', type: 'g', postCodes: codes, variants: [{ key: 'A', text: 'giá 2 triệu', images }] }] });
  assert.deepEqual(msgs(g(['F1', 'F2'], [fi('F1', 6)[0], fi('F2', 4)[0], fi('F1', 6)[1], fi('F1', 6)[2], fi('F2', 4)[1]])), []);
  assert.ok(has(g(['F1', 'F2'], [fi('F2', 4)[0], fi('F1', 6)[0], fi('F1', 6)[1]]), /phải là bìa/));
  assert.ok(has(g(['F1', 'F2'], [...fi('F1', 6), fi('F2', 4)[0]]), /tối đa 5 ảnh/));
  // > 5 tin
  const six = ['KA', 'KB', 'KC', 'KD', 'KE', 'KF'];
  const covers = six.map((c) => fi(c, 3)[0]);
  const gk = (codes, images) => ({ posts: [{ targetId: 'wall:1', type: 'g', postCodes: codes, variants: [{ key: 'A', text: codes.map(() => '2 triệu').join(', '), images }] }] });
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
  assert.ok(has(mk({}, { text: '# Tiêu đề\n' + goodText }), /tiêu đề markdown/));
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
  assert.ok(has(mk({}, { text: 'Phòng 3tr5' }), /giá nào đúng nguyên văn/));
  assert.ok(has(mk({}, { text: 'Phòng 13,5 triệu' }), /giá nào đúng nguyên văn/));
  // một trong các phòng là đủ (listing 2 phòng dựng tay)
  const two = { ...fake('TW', 3), rooms: [
    { room: '1', price: 3000000, priceText: '3 triệu', status: 'AVAILABLE', label: '' },
    { room: '2', price: 4500000, priceText: '4,5 triệu', status: 'AVAILABLE', label: '' }] };
  const inp2 = { ...input, listings: [...input.listings, two] };
  const pt = (text, tid = 'wall:1') => ({ posts: [{ targetId: tid, type: 't', postCodes: ['TW'], variants: [{ key: 'A', text, images: fi('TW', 3) }] }] });
  const m2 = (p, i = inp2) => validatePosts(p, i).errors;
  assert.deepEqual(m2(pt('phòng 4,5 triệu')), []);
  assert.deepEqual(m2(pt('phòng 3 triệu/tháng')), []);
  assert.deepEqual(m2(pt('phòng 3 triệu.')), []);
  assert.ok(m2(pt('Giá 3 triệu 5')).length > 0);
  assert.ok(m2(pt('Giá 3 triệu rưỡi')).length > 0);
  assert.ok(m2(pt('Giá 3 triệu,5')).length > 0);
  assert.ok(m2(pt('Giá 3 triệu.5')).length > 0);
  // bài thương hiệu bỏ qua
  const b = { posts: [{ targetId: 'wall:1', type: 'b', postCodes: [], variants: [{ key: 'A', text: 'không giá', images: fi('F1', 3) }] }] };
  assert.deepEqual(msgs(b), []);
});

test('luật 7: URL homematch.vn (Threads, link trong thân bài)', () => {
  assert.deepEqual(msgs(th(thGood)), []);
  assert.ok(has(th(thGood + ' https://homematch.vn/p/T9999'), /không khớp link/));
  assert.ok(has(th(thGood + ' https://app.homematch.vn/x'), /không khớp link/));
  assert.deepEqual(msgs(th(thGood + '/ và https://example.com/x')), []);
  assert.deepEqual(msgs(th(`${l2.rooms[0].priceText} ${l2.link}/.`)), []);
  // host giả không tính
  assert.deepEqual(msgs(th(thGood + ' https://nothomematch.vn/a')), []);
  // bài thương hiệu trên Threads bỏ qua luật link
  const b = { posts: [{ targetId: 'threads:1', type: 'b', postCodes: [], variants: [{ key: 'A', text: 'https://homematch.vn', images: fi('F1', 3) }] }] };
  assert.deepEqual(msgs(b), []);
});

test('gom mọi lỗi, không dừng ở lỗi đầu', () => {
  const e = msgs(mk({ targetId: 'zz' }, { key: 'B', text: '**x** 3tr5', images: imgs('T1302', 1) }));
  assert.ok(e.length >= 4);
});

test('R12: tiếng Anh nhận dạng giá từ room.price', () => {
  const mkRoom = (price, priceText) => ({ ...fake('EN', 3), rooms: [{ room: '1', price, priceText, status: 'AVAILABLE', label: '' }] });
  const run = (lang, text, price = 3500000, pText = '3,5 triệu') => {
    const inp = { targets: [{ id: 'wall:1', kind: 'wall', name: 'W', variants: 1, ...(lang ? { language: lang } : {}) }], listings: [mkRoom(price, pText)] };
    const p = { posts: [{ targetId: 'wall:1', type: 't', postCodes: ['EN'], variants: [{ key: 'A', text, images: fi('EN', 3) }] }] };
    return validatePosts(p, inp).errors;
  };
  assert.deepEqual(run('en', 'Room 3.5 million VND'), []);
  assert.deepEqual(run('en', 'Room 3,500,000 VND'), []);
  assert.deepEqual(run('en', 'Room 3,5 triệu'), []);
  assert.deepEqual(run('en', 'Room 4 million VND', 4000000, '4 triệu'), []);
  assert.deepEqual(run('en', 'Room 3.555 million VND', 3555000, '3,555 triệu'), []);
  assert.ok(run('en', 'Room 3.6 million VND').length > 0);
  assert.ok(run('en', 'Room 13.5 million VND').length > 0);
  assert.ok(run('en', 'Room 3.5 million VND 2').length > 0);
  assert.ok(run('vi', 'Room 3.5 million VND').length > 0);
  assert.ok(run(undefined, 'Room 3.5 million VND').length > 0);
});

test('R13: link không scheme', () => {
  assert.ok(has(th(thGood + ' homematch.vn/p/F9'), /không khớp link/));
  assert.ok(has(th(thGood + ' www.homematch.vn/p/F9…'), /không khớp link/));
  assert.deepEqual(msgs(th(`${l2.rooms[0].priceText} homematch.vn/p/T1302…`)), []);
  assert.deepEqual(msgs(th(thGood + ' nothomematch.vn/a, mail a@homematch.vn')), []);
});

test('R13: # chỉ là tiêu đề markdown', () => {
  assert.deepEqual(msgs(mk({}, { text: goodText + '\n#phongtro #hanoi' })), []);
  assert.ok(has(mk({}, { text: '## Tiêu đề\n' + goodText }), /tiêu đề markdown/));
  assert.ok(has(mk({}, { text: '# Tiêu đề\n' + goodText }), /tiêu đề markdown/));
});

test('R24: giá sai, mã sai, đuôi đọc giá đều bị chặn', () => {
  const four = { ...fake('TF', 3, '4 triệu'), code: 'TF' };
  const inp = { ...input, listings: [...input.listings, four] };
  const run = (text, codes = ['TF'], tid = 'wall:1') => validatePosts({ posts: [{ targetId: tid, type: 't', postCodes: codes,
    variants: [{ key: 'A', text, images: codes.length ? fi('TF', 3) : fi('F1', 3) }] }] }, inp).errors;
  // giá thật vẫn qua
  assert.deepEqual(run(`phòng 4 triệu`), []);
  assert.deepEqual(run(`phòng 4 triệu, điện 4k/số, nước 100k`), []);
  // giá sai đứng cạnh giá thật hoặc thay giá thật
  assert.ok(run(`phòng 101 giá 3,5 triệu, phòng 102 giá 3,8 triệu`).length > 0);
  assert.ok(run(`phòng 101 giá 4 triệu, phòng 102 giá 3,8 triệu`).some((e) => /3,8 triệu/.test(e.message)));
  // "tr" không bao giờ hợp lệ
  assert.ok(run(`phòng 4 triệu (3,5tr)`).some((e) => /3,5tr/.test(e.message)));
  assert.ok(run(`phòng 4 triệu, 4tr`).length > 0);
  assert.ok(run(`phòng 4 triệu, giá3,5 triệu`).length > 0);
  // đuôi đọc giá, không phân biệt hoa thường
  assert.ok(run(`phòng 4 triệu Rưỡi`).length > 0);
  assert.ok(run(`phòng 4 triệu RƯỠI`).length > 0);
  for (const w of ['một', 'mốt', 'hai', 'ba', 'bốn', 'tư', 'năm', 'lăm', 'sáu', 'bảy', 'tám', 'chín', 'lẻ', 'Tư', 'NĂM']) {
    assert.ok(run(`phòng 4 triệu ${w}`).length > 0, w);
  }
  assert.deepEqual(run(`phòng 4 triệu bao gồm phí`), []);
  // NFD vẫn được chuẩn hoá trước khi so
  assert.deepEqual(run(`phòng ${'4 triệu'.normalize('NFD')}`), []);
  assert.ok(run(`phòng 4 triệu ${'rưỡi'.normalize('NFD')}`).length > 0);
  // mã tin lạ
  assert.ok(has(mk({}, { text: `${goodText} Comment mã T1320` }), /T1320/));
  assert.deepEqual(msgs(mk({}, { text: `${goodText} Comment mã T1302` })), []);
  // bài thương hiệu không được có giá thuê hay mã tin
  assert.ok(run('Phòng đẹp chỉ 3,5 triệu', []).length > 0);
  assert.ok(run('Xem mã T1302 nhé', []).length > 0);
  assert.deepEqual(run('Điện 4k/số, Homematch tìm phòng miễn phí', []), []);
});

test('R24: tiếng Anh chỉ nhận dạng chuẩn', () => {
  const en = { ...fake('EN2', 3, '3,5 triệu'), rooms: [{ room: '1', price: 3500000, priceText: '3,5 triệu', status: 'AVAILABLE', label: '' }] };
  const inp = { targets: [{ id: 'wall:1', kind: 'wall', name: 'W', variants: 1, language: 'en' }], listings: [en] };
  const run = (text) => validatePosts({ posts: [{ targetId: 'wall:1', type: 't', postCodes: ['EN2'],
    variants: [{ key: 'A', text, images: fi('EN2', 3) }] }] }, inp).errors;
  assert.deepEqual(run('Room 3.5 million VND, also 3,500,000 VND'), []);
  assert.ok(run('Room 3.5 million VND, other 3.8 million VND').length > 0);
  assert.ok(run('Room 3.5 million VND, other 4,000,000 VND').length > 0);
});

test('mã tin: token T… trùng số phòng của tin trong bài thì bỏ qua', () => {
  const base = 'Mã T2142, 2 triệu';
  const p = (text) => ({ posts: [{ targetId: 'group:1', type: 't', postCodes: ['T2142'], variants: [{ key: 'A', text, images: fi('T2142', 5) }] }] });
  assert.deepEqual(msgs(p(`${base} phòng T101`)), []);
  assert.deepEqual(msgs(p(`${base} phòng t101`)), []);
  assert.ok(has(p(`${base} phòng T999`), /mã tin T999 không nằm trong postCodes/));
});

test('link Facebook: thân bài page/wall/group không có link, link ở comment', () => {
  const inp = { ...input, targets: [...input.targets, { id: 'page:1', kind: 'page', name: 'P', variants: 1 }] };
  const run = (tid, v) => validatePosts(mk({ targetId: tid }, v), inp).errors;
  const body = /link tin để ở comment đầu tiên, không để trong thân bài/;
  for (const tid of ['wall:1', 'page:1', 'group:1']) {
    assert.ok(run(tid, { text: thGood }).some((e) => body.test(e.message)), tid);
    assert.ok(run(tid, { text: `${goodText} homematch.vn/p/T1302` }).some((e) => body.test(e.message)), tid);
    assert.deepEqual(run(tid, { comment: `Chi tiết và ảnh: ${l2.link}` }), [], tid);
  }
  assert.ok(run('wall:1', { text: thGood }).some((e) => /^Bài 1, bản A: link tin để ở comment/.test(e.message)));
  // Threads: link trong thân vẫn được
  assert.deepEqual(msgs(th(thGood)), []);
  // bài thương hiệu cũng không để link trong thân bài Facebook
  const b = { posts: [{ targetId: 'wall:1', type: 'b', postCodes: [], variants: [{ key: 'A', text: 'ghé homematch.vn', images: fi('F1', 3) }] }] };
  assert.ok(has(b, body));
});

test('comment: link, mã tin, định dạng, giá, độ dài', () => {
  const c = (comment, over = {}) => mk(over, { comment });
  assert.deepEqual(msgs(c(`Chi tiết và ảnh: ${l2.link}`)), []);
  assert.deepEqual(msgs(c(`T1302 · ${l2.rooms[0].priceText}: homematch.vn/p/T1302`)), []);
  // link sai
  assert.ok(has(c('Chi tiết: https://homematch.vn/p/T9999'), /comment.*không khớp link/));
  assert.ok(has(c('Chi tiết: app.homematch.vn/x'), /không khớp link/));
  // mã tin lạ
  assert.ok(has(c(`Mã T1320 ${l2.link}`), /comment.*mã tin T1320/));
  // định dạng
  assert.ok(has(c(`**Chi tiết** ${l2.link}`), /comment.*\*\*/));
  assert.ok(has(c(`__x__ ${l2.link}`), /__/));
  assert.ok(has(c(`# Xem\n${l2.link}`), /tiêu đề markdown/));
  assert.ok(has(c(`\u{1D5EF} ${l2.link}`), /toán học/));
  // giá: có thì phải đúng
  assert.ok(has(c(`Giá 9 triệu ${l2.link}`), /comment.*giá "9 triệu"/));
  assert.ok(has(c(`Giá 3tr ${l2.link}`), /giá "3tr"/));
  // độ dài
  const long = `${l2.link} ` + 'a'.repeat(300);
  assert.ok(has(c(long), /comment dài \d+ ký tự, tối đa 300/));
  assert.deepEqual(msgs(c('😀'.repeat(300))), []);
  assert.ok(has(c('😀'.repeat(301)), /tối đa 300/));
  // sai kiểu
  assert.ok(has(c(42), /"comment" phải là chuỗi/));
  assert.deepEqual(msgs(c(null)), []);
});

test('comment bài thương hiệu: không link homematch, không mã tin', () => {
  const b = (comment) => ({ posts: [{ targetId: 'wall:1', type: 'b', postCodes: [], variants: [{ key: 'A', text: 'xin chào', comment, images: fi('F1', 3) }] }] });
  assert.deepEqual(msgs(b('Inbox Page để được tư vấn')), []);
  assert.ok(has(b('Xem thêm homematch.vn'), /bài thương hiệu.*comment.*link/));
  assert.ok(has(b('Xem mã T1302'), /comment.*T1302/));
});

test('số dạng icon (keycap U+20E3) bị chặn ở text và comment, mọi kênh', () => {
  const icon = '0️⃣8️⃣';
  assert.ok(has(mk({}, { text: `${goodText} Zalo ${icon}` }), /Bài 1, bản A: không dùng số dạng icon/));
  assert.ok(has(mk({}, { text: `${goodText} 1⃣` }), /không dùng số dạng icon/));
  assert.ok(has(th(`${thGood} #️⃣`), /không dùng số dạng icon/));
  assert.ok(has(mk({ targetId: 'wall:1' }, { comment: `Zalo ${icon}` }), /\(comment\): không dùng số dạng icon/));
  assert.ok(!has(mk({}, { text: `${goodText} Zalo 0838 600 055` }), /số dạng icon/));
});

test('Threads: tối đa một #tag; Facebook không giới hạn ở validator', () => {
  assert.deepEqual(msgs(th(`${thGood} #phongtro`)), []);
  assert.ok(has(th(`${thGood} #phongtro #caugiay`), /Threads có 2 hashtag, tối đa 1/));
  assert.ok(has(th(`#phòngtrọ ${thGood} #hanoi`), /tối đa 1/));
  // # dính sau chữ/số không tính là tag
  assert.deepEqual(msgs(th(`${thGood} #phongtro C# a#b`)), []);
  assert.ok(!has(mk(), /hashtag/));
  assert.ok(!has(mk({}, { text: `${goodText} #a #b #c` }), /hashtag/));
});

test('Threads: "#2", "#1" không phải hashtag (sau # phải là chữ)', () => {
  assert.deepEqual(msgs(th(`${thGood} #phongtro phòng #2 và #1`)), []);
  assert.ok(has(th(`${thGood} #phongtro #a1`), /tối đa 1/));
});
