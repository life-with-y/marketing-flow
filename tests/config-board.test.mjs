import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { diffConfig, diffProfile } from '../scripts/lib/config-diff.mjs';
import { renderHome } from '../scripts/lib/render-home.mjs';
import { main } from '../scripts/config-cli.mjs';

const ALL = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const THU = new Date(2026, 10, 19, 9, 12);
const grp = (o) => ({ id: 'hm-room', name: 'Nhà trọ Hoàng Mai', account: 'fb1', active: true, segment: 'room', days: ALL, districts: ['Hoàng Mai'], language: 'vi', note: '', keywords: [], groups: [], ...o });
const cfg = (o = {}) => ({
  apiBaseUrl: 'https://api.example',
  schedule: ['17:00'],
  accounts: [{ id: 'fb1', type: 'fb-personal', label: 'FB Minh' }],
  clusters: [grp()],
  perSlot: {},
  variants: { default: 1 },
  contact: [],
  pageContact: [],
  ...o,
});
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'hm-cfg-'));
// home cũng là thư mục tạm: outputDir mặc định "~/HomeMatch-Posts" không bao giờ trỏ vào máy thật.
const run = async (args, dir, now = THU, fetchImpl) => { const o = []; const code = await main(args, { dir, home: dir, now, out: (s) => o.push(s), fetchImpl }); return { code, o }; };

test('diffConfig: toggle, schedule, added cluster -> exactly 3 lines', () => {
  const a = cfg();
  const b = cfg({
    schedule: ['17:30'],
    clusters: [grp({ active: false }), grp({ id: 'ex', name: 'Hanoi Expats Housing' })],
  });
  assert.deepEqual(diffConfig(a, b), [
    'Giờ chạy: 17:00 → 17:30',
    'Cụm Nhà trọ Hoàng Mai: bật → tạm ngừng',
    'Cụm Hanoi Expats Housing: thêm mới',
  ]);
});

test('diffConfig: nhóm trong cụm thêm, đã vào, bỏ; phân khúc', () => {
  const a = cfg({ clusters: [grp({ groups: [{ name: 'A', url: 'https://fb/a' }, { name: 'B', url: 'https://fb/b' }] })] });
  const b = cfg({ clusters: [grp({ segment: 'student', groups: [{ name: 'A', url: 'https://fb/a', joined: true }, { name: 'C', url: 'https://fb/c' }] })] });
  assert.deepEqual(diffConfig(a, b), [
    'Cụm Nhà trọ Hoàng Mai: phân khúc phòng trọ → sinh viên, giá rẻ',
    'Cụm Nhà trọ Hoàng Mai: đã vào nhóm A',
    'Cụm Nhà trọ Hoàng Mai: thêm nhóm C',
    'Cụm Nhà trọ Hoàng Mai: bỏ nhóm B',
  ]);
});

test('diffConfig: other fields and identical', () => {
  assert.deepEqual(diffConfig(cfg(), cfg()), []);
  const lines = diffConfig(cfg(), cfg({
    clusters: [grp({ districts: ['Cầu Giấy'], days: ['mon'], language: 'en', note: 'x', slots: ['17:00'] })],
    perSlot: { fb1: 2 }, variants: { default: 2 }, contact: ['Zalo'], pageContact: ['P'],
    accounts: [{ id: 'fb1', type: 'fb-personal', label: 'FB Minh' }, { id: 'th', type: 'threads', label: 'Threads' }],
  }));
  const joined = lines.join('\n');
  for (const s of ['quận Hoàng Mai → Cầu Giấy', 'ngày mọi ngày → T2', 'ngôn ngữ tiếng Việt → tiếng Anh', 'ghi chú — → x', 'khung theo giờ chạy → 17:00', 'FB Minh: — → 2', 'Số bản default: 1 → 2', 'Liên hệ: — → Zalo', 'Liên hệ Page: — → P', 'Tài khoản Threads: thêm mới']) {
    assert.ok(joined.includes(s), s + '\n' + joined);
  }
  assert.ok(diffConfig(cfg(), cfg({ clusters: [] })).includes('Cụm Nhà trọ Hoàng Mai: bỏ'));
  assert.ok(diffConfig(cfg(), cfg({ accounts: [] })).includes('Tài khoản FB Minh: bỏ'));
});

test('diffProfile: persona / content types text', () => {
  const l = diffProfile({ cfg: cfg(), persona: 'a', contentTypes: 'x' }, { cfg: cfg(), persona: 'b', contentTypes: 'y' });
  assert.deepEqual(l, ['Persona: đã sửa', 'Kiểu bài: đã sửa']);
  assert.deepEqual(diffProfile({ cfg: cfg(), persona: 'a' }, { cfg: cfg(), persona: 'a' }), []);
});

test('init creates skeleton + templates, never overwrites', async () => {
  const dir = path.join(tmp(), 'p');
  const r = await run(['init'], dir);
  assert.equal(r.code, 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8')), { apiBaseUrl: '', accounts: [], clusters: [] });
  assert.ok(fs.existsSync(path.join(dir, 'persona.md')) && fs.existsSync(path.join(dir, 'content-types.md')));
  fs.writeFileSync(path.join(dir, 'persona.md'), 'mine');
  await run(['init'], dir);
  assert.equal(fs.readFileSync(path.join(dir, 'persona.md'), 'utf8'), 'mine');
});

test('backup, edit, changelog, undo restores files', async () => {
  const dir = tmp();
  const orig = JSON.stringify(cfg());
  fs.writeFileSync(path.join(dir, 'config.json'), orig);
  fs.writeFileSync(path.join(dir, 'persona.md'), 'p1');
  assert.deepEqual((await run(['changelog'], dir)).o, ['Chưa có lần sửa nào']);
  assert.equal((await run(['backup'], dir, new Date(Date.UTC(2026, 10, 19, 2, 12, 0)))).code, 0);
  assert.ok(fs.existsSync(path.join(dir, 'history', '2026-11-19T02-12-00.000Z', 'persona.md')));
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(cfg({ schedule: ['17:30'] })));
  fs.writeFileSync(path.join(dir, 'persona.md'), 'p2');
  assert.deepEqual((await run(['changelog'], dir)).o, ['Giờ chạy: 17:00 → 17:30', 'Persona: đã sửa']);
  const u = await run(['undo'], dir);
  assert.ok(u.o.includes('Giờ chạy: 17:30 → 17:00') && u.o.includes('Persona: đã sửa'));
  assert.equal(fs.readFileSync(path.join(dir, 'config.json'), 'utf8'), orig);
  assert.equal(fs.readFileSync(path.join(dir, 'persona.md'), 'utf8'), 'p1');
  assert.ok(!fs.existsSync(path.join(dir, 'history', '2026-11-19T02-12-00.000Z')));
  assert.equal((await run(['undo'], dir)).code, 1);
});

test('render-board writes the home page at outputDir/index.html with slots, token never present', async () => {
  const dir = tmp();
  const out = path.join(dir, 'posts');
  const slotDir = path.join(out, '2026-11-19_1100');
  fs.mkdirSync(slotDir, { recursive: true });
  fs.writeFileSync(path.join(slotDir, 'page-data.json'), JSON.stringify({
    slot: '2026-11-19_1100', generatedAt: THU.toISOString(), outDir: slotDir,
    posts: [{ n: 1, dir: path.join(slotDir, '01_x_T1'), targetId: 'group:hm-room', postCodes: ['T1'], type: 'Phòng mới', label: 'NEW', variants: [{ key: 'A', dir: path.join(slotDir, '01_x_T1'), text: 'Nội dung bài <b>', files: ['1.jpg'] }] }],
    targets: [{ id: 'group:hm-room', kind: 'group', account: 'fb1', name: 'Nhà trọ Hoàng Mai', url: 'https://fb/hm' }],
    accounts: [{ id: 'fb1', type: 'fb-personal', label: 'FB Minh' }], skipped: [], pending: [], notes: [],
  }));
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(cfg({ outputDir: out })));
  fs.writeFileSync(path.join(dir, 'secrets.json'), JSON.stringify({ token: 'SECRET-TOKEN-123', label: 'mkt-minh' }));
  await run(['backup'], dir);
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(cfg({ outputDir: out, schedule: ['17:30'] })));
  const r = await run(['render-board'], dir);
  const file = path.join(out, 'index.html');
  assert.deepEqual(r.o, [file]);
  assert.ok(!fs.existsSync(path.join(dir, 'board')));
  const html = fs.readFileSync(file, 'utf8');
  assert.ok(!html.includes('SECRET-TOKEN-123'));
  assert.ok(html.includes('đã cài · mkt-minh') && html.includes('Giờ chạy: 17:00 → 17:30'));
  assert.ok(html.includes('Nội dung bài &lt;b&gt;') && html.includes('src="2026-11-19_1100/01_x_T1/1.jpg"'));
  // no content-types.md in profile -> template library
  assert.ok(html.includes('Phòng nổi bật'));
  // invalid config still renders; default outputDir resolves under home (temp)
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ apiBaseUrl: '', accounts: [], clusters: [] }));
  const r2 = await run(['render-board'], dir);
  const file2 = path.join(dir, 'HomeMatch-Posts', 'index.html');
  assert.deepEqual(r2.o, [file2]);
  assert.ok(fs.readFileSync(file2, 'utf8').includes('Cấu hình đang sai'));
});

test('today prints JSON targets per slot', async () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(cfg({ perSlot: { fb1: 1 } })));
  const j = JSON.parse((await run(['today'], dir)).o[0]);
  assert.equal(j.date, '2026-11-19');
  assert.equal(j.slots.length, 1);
  assert.equal(j.slots[0].hhmm, '17:00');
  assert.deepEqual(j.slots[0].targets.map((t) => t.id), ['group:hm-room', 'wall:fb1:0']);
  assert.deepEqual(Object.keys(j.slots[0].targets[0]).sort(), ['id', 'kind', 'name']);
});

test('undo deletes files created after backup (manifest)', async () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(cfg()));
  await run(['backup'], dir);
  fs.writeFileSync(path.join(dir, 'persona.md'), 'new');
  await run(['undo'], dir);
  assert.ok(!fs.existsSync(path.join(dir, 'persona.md')));
  assert.ok(fs.existsSync(path.join(dir, 'config.json')));
  const empty = tmp();
  await run(['backup'], empty);
  fs.writeFileSync(path.join(empty, 'config.json'), '{}');
  await run(['undo'], empty);
  assert.ok(!fs.existsSync(path.join(empty, 'config.json')));
});

const withPending = (url) => { const dir = tmp(); fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(cfg({ library: url ? { pendingCsvUrl: url } : {} }))); return dir; };
const board = (dir) => fs.readFileSync(path.join(dir, 'HomeMatch-Posts', 'index.html'), 'utf8');

test('render-board: pending rows from sheet, escaped', async () => {
  const dir = withPending('https://docs.google.com/x.csv');
  const csv = 'Mục,Trạng thái,Mặc định tạm\n<script>alert(1)</script>,chờ,không link\nLiên hệ nhóm,chờ,\n';
  await run(['render-board'], dir, THU, async () => ({ ok: true, status: 200, text: async () => csv }));
  const html = board(dir);
  assert.ok(html.includes('2 mục đang chờ quy định'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt; · chờ · không link'));
  assert.ok(!html.includes('<script>alert(1)'));
});

test('render-board: sheet error line; no url -> no block', async () => {
  const dir = withPending('https://docs.google.com/x.csv');
  await run(['render-board'], dir, THU, async () => ({ ok: false, status: 500, text: async () => '' }));
  assert.ok(board(dir).includes('Không đọc được tab Cần tìm hiểu: Không đọc được Sheet (HTTP 500)'));
  const d2 = withPending('');
  await run(['render-board'], d2, THU, async () => { throw new Error('should not fetch'); });
  assert.ok(!board(d2).includes('class="pend"'));
});

test('validate: OK exit 0, sai thì LỖI exit 1', async () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(cfg()));
  let r = await run(['validate'], dir);
  assert.equal(r.code, 0);
  assert.deepEqual(r.o, ['OK']);
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(cfg({ variants: { default: 9 } })));
  r = await run(['validate'], dir);
  assert.equal(r.code, 1);
  assert.equal(r.o.length, 1);
  assert.match(r.o[0], /^LỖI: .*variants\.default/);
  fs.rmSync(path.join(dir, 'config.json'));
  r = await run(['validate'], dir);
  assert.equal(r.code, 1);
  assert.match(r.o[0], /^LỖI: Chưa có config.json/);
});

test('model không còn trong bảng cấu hình và diff (lịch dùng model mặc định của app)', () => {
  const html = renderHome({ cfg: cfg({ model: 'opus' }), today: THU, tokenLabel: null, outputDir: '/tmp/x' });
  assert.ok(!html.includes('<dt>Model</dt>'));
  assert.deepEqual(diffConfig(cfg({ model: 'sonnet' }), cfg({ model: 'opus' })), []);
});

test('diffConfig: công tắc link, cách ghi giá', () => {
  const lines = diffConfig(cfg({ links: { page: false } }), cfg({ links: { page: true }, priceStyle: { wall: 'masked' } }));
  assert.ok(lines.includes('Link homematch.vn Page: tắt → bật'), lines.join('\n'));
  assert.ok(lines.includes('Giá Tường: đầy đủ → ẩn giá'), lines.join('\n'));
  const g = diffConfig(cfg(), cfg({ links: { threads: true, group: true } }));
  assert.ok(g.includes('Link homematch.vn Threads: tắt → bật') && g.includes('Link homematch.vn Nhóm: tắt → bật'), g.join('\n'));
});
