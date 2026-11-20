import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseContentTypes } from '../scripts/lib/content-types.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXAMPLE = fs.readFileSync(path.join(ROOT, 'rules', 'templates', 'content-types.example.md'), 'utf8');

test('parses the example template into 5 types with all fields', () => {
  const ts = parseContentTypes(EXAMPLE);
  assert.equal(ts.length, 5);
  const [a, b, c, d, e] = ts;
  assert.equal(a.name, 'Phòng nổi bật');
  assert.deepEqual(a.channels, ['wall', 'page', 'threads', 'group']);
  assert.equal(a.listings, '1');
  assert.match(a.howToPick, /^tin đầu tiên theo thứ tự ưu tiên/);
  assert.equal(a.structure.length, 5);
  assert.match(a.structure[0], /^Dòng tiêu đề:/);
  assert.match(a.structure[4], /^Liên hệ \+ mã tin/);
  assert.match(a.images, /^5 ảnh của tin/);
  assert.equal(a.exampleNote, 'tường cá nhân, phòng giá thấp, liên hệ Zalo, link Tường bật');
  assert.ok(a.example.startsWith('🏡 Studio 25m² có bếp riêng'));
  assert.ok(a.example.endsWith('<link của tin T1302>'));
  assert.ok(!a.example.includes('```'));
  assert.equal(b.name, 'Gom theo khu');
  assert.equal(b.listings, '3–5');
  assert.equal(b.structure.length, 3);
  assert.equal(c.name, 'Gom theo nhu cầu');
  assert.equal(c.listings, '2–4');
  assert.equal(d.name, 'Hỏi nhu cầu');
  assert.deepEqual(d.channels, ['wall', 'page', 'threads']);
  assert.match(d.listings, /^0/);
  assert.equal(d.exampleNote, 'Threads');
  assert.equal(e.name, 'Gợi ý 4–5 phòng cùng phân khúc');
  assert.deepEqual(e.channels, ['wall', 'page', 'threads', 'group']);
  assert.equal(e.listings, '4–5');
  assert.equal(e.structure.length, 4);
  assert.deepEqual(e.examples.map((x) => x.note), ['Threads, khác khu, link tắt', 'tường cá nhân, cùng khu, link tắt']);
  assert.equal(e.example, e.examples[0].text);
  assert.equal(e.exampleNote, e.examples[0].note);
  assert.deepEqual(a.examples, [{ note: a.exampleNote, text: a.example }]);
});

test('tolerates missing fields and odd input', () => {
  assert.deepEqual(parseContentTypes(null), []);
  assert.deepEqual(parseContentTypes('just text, no sections'), []);
  const [t] = parseContentTypes('## Chỉ tên\n\n- **Kênh**: page\n');
  assert.deepEqual(t, { name: 'Chỉ tên', channels: ['page'], listings: '', howToPick: '', structure: [], images: '', example: '', exampleNote: '', examples: [] });
  // section without any known field is not a type
  assert.deepEqual(parseContentTypes('## Ghi chú\n\nchữ thường\n'), []);
  // inline example, no fence; unterminated fence keeps the rest
  const [u] = parseContentTypes('## X\n\n- **Ví dụ**: một dòng\n');
  assert.equal(u.example, 'một dòng');
  const [v] = parseContentTypes('## Y\n\n- **Ví dụ**:\n\n```\nA\n\nB\n');
  assert.equal(v.example, 'A\n\nB');
  // CRLF and "*" bullets
  const [w] = parseContentTypes('## 4. Z\r\n\r\n* **Số tin mỗi bài**: 2\r\n* **Cấu trúc**:\r\n  1. Một\r\n  2. Hai\r\n');
  assert.equal(w.name, 'Z');
  assert.equal(w.listings, '2');
  assert.deepEqual(w.structure, ['Một', 'Hai']);
});

test('field lines inside a fenced example are not fields', () => {
  const md = '## K\n\n- **Ảnh**: 5 ảnh\n- **Ví dụ**:\n\n```\n- **Ảnh**: x\n- **Kênh**: group\n```\n- **Kênh**: page\n';
  const [t] = parseContentTypes(md);
  assert.equal(t.images, '5 ảnh');
  assert.deepEqual(t.channels, ['page']);
  assert.equal(t.example, '- **Ảnh**: x\n- **Kênh**: group');
  // a section whose only "fields" sit inside a fence is not a type
  assert.deepEqual(parseContentTypes('## N\n\n```\n- **Kênh**: page\n```\n'), []);
});

test('ví dụ kiểu "phân khúc" qua validator với link tắt, giá đầy đủ', async () => {
  const { validatePosts } = await import('../scripts/lib/posts.mjs');
  const seg = parseContentTypes(EXAMPLE).find((t) => t.name.includes('phân khúc'));
  assert.equal(seg.examples.length, 2);
  for (const [ex, kind] of [[seg.examples[0], 'threads'], [seg.examples[1], 'wall']]) {
    const [text, comment] = ex.text.split('\n\nComment đầu tiên:\n');
    const lines = text.split('\n').filter((l) => /^\d\. /.test(l));
    assert.ok(lines.length >= 4 && lines.length <= 5, ex.note);
    const codes = comment ? [...comment.matchAll(/T\d{4}/g)].map((m) => m[0]) : lines.map((_, i) => `T900${i}`);
    assert.equal(codes.length, lines.length, ex.note);
    const listings = lines.map((l, i) => {
      const priceText = /• (\d+(?:,\d+)?) triệu\/tháng/.exec(l)[1] + ' triệu';
      return { code: codes[i], link: `https://homematch.vn/p/${codes[i]}`, eligible: true, imageCount: 3,
        rooms: [{ room: '1', price: Math.round(Number(priceText.split(' ')[0].replace(',', '.')) * 1e6), priceText }],
        images: [0, 1, 2].map((n) => ({ url: `https://cdn.test/${codes[i]}/${n}.jpg` })) };
    });
    const input = { targets: [{ id: 't', kind, variants: 1, links: false, priceStyle: 'full' }], listings };
    const posts = { posts: [{ targetId: 't', type: seg.name, postCodes: codes,
      variants: [{ key: 'A', text, ...(comment ? { comment } : {}), images: listings.map((l) => l.images[0].url) }] }] };
    assert.deepEqual(validatePosts(posts, input).errors, [], ex.note);
  }
});
