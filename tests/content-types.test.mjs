import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseContentTypes } from '../scripts/lib/content-types.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXAMPLE = fs.readFileSync(path.join(ROOT, 'rules', 'templates', 'content-types.example.md'), 'utf8');

test('parses the example template into 3 types with all fields', () => {
  const ts = parseContentTypes(EXAMPLE);
  assert.equal(ts.length, 3);
  const [a, b, c] = ts;
  assert.equal(a.name, 'Phòng mới / giảm giá');
  assert.deepEqual(a.channels, ['wall', 'page', 'threads', 'group']);
  assert.equal(a.listings, '1');
  assert.match(a.howToPick, /^tin đầu tiên theo thứ tự ưu tiên/);
  assert.equal(a.structure.length, 5);
  assert.match(a.structure[0], /^Mở bài: điều mới/);
  assert.match(a.structure[4], /^CTA theo liên hệ/);
  assert.match(a.images, /^5 ảnh của tin/);
  assert.equal(a.exampleNote, 'tường cá nhân, liên hệ Zalo');
  assert.ok(a.example.startsWith('Phòng vừa trống ở Cầu Giấy.\n\n📍'));
  assert.ok(a.example.endsWith('<link của tin T1302>'));
  assert.ok(!a.example.includes('```'));
  assert.equal(b.name, 'Gom theo khu');
  assert.equal(b.listings, '3–5');
  assert.equal(b.structure.length, 3);
  assert.equal(c.name, 'Thương hiệu "phòng thật, giá thật"');
  assert.deepEqual(c.channels, ['wall', 'page', 'threads']);
  assert.match(c.listings, /^0/);
  assert.equal(c.exampleNote, 'Threads');
});

test('tolerates missing fields and odd input', () => {
  assert.deepEqual(parseContentTypes(null), []);
  assert.deepEqual(parseContentTypes('just text, no sections'), []);
  const [t] = parseContentTypes('## Chỉ tên\n\n- **Kênh**: page\n');
  assert.deepEqual(t, { name: 'Chỉ tên', channels: ['page'], listings: '', howToPick: '', structure: [], images: '', example: '', exampleNote: '' });
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
