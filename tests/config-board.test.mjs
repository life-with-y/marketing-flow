import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { diffConfig, diffProfile } from '../scripts/lib/config-diff.mjs';
import { renderConfigBoard } from '../scripts/lib/render-config.mjs';
import { main } from '../scripts/config-cli.mjs';

const ALL = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const THU = new Date(2026, 10, 19, 9, 12);
const grp = (o) => ({ name: 'Nhà trọ Hoàng Mai', url: 'https://fb/hm', account: 'fb1', active: true, days: ALL, districts: ['Hoàng Mai'], language: 'vi', note: '', ...o });
const cfg = (o = {}) => ({
  apiBaseUrl: 'https://api.example',
  schedule: ['17:00'],
  accounts: [{ id: 'fb1', type: 'fb-personal', label: 'FB Minh' }],
  groups: [grp()],
  perSlot: {},
  variants: { default: 1 },
  contact: [],
  pageContact: [],
  ...o,
});
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'hm-cfg-'));
const run = async (args, dir, now = THU, fetchImpl) => { const o = []; const code = await main(args, { dir, now, out: (s) => o.push(s), fetchImpl }); return { code, o }; };

test('diffConfig: toggle, schedule, added group -> exactly 3 lines', () => {
  const a = cfg();
  const b = cfg({
    schedule: ['17:30'],
    groups: [grp({ active: false }), grp({ name: 'Hanoi Expats Housing', url: 'https://fb/ex' })],
  });
  assert.deepEqual(diffConfig(a, b), [
    'Giờ chạy: 17:00 → 17:30',
    'Nhóm Nhà trọ Hoàng Mai: bật → tạm ngừng',
    'Nhóm Hanoi Expats Housing: thêm mới',
  ]);
});

test('diffConfig: other fields and identical', () => {
  assert.deepEqual(diffConfig(cfg(), cfg()), []);
  const lines = diffConfig(cfg(), cfg({
    groups: [grp({ districts: ['Cầu Giấy'], days: ['mon'], language: 'en', note: 'x', slots: ['17:00'] })],
    perSlot: { fb1: 2 }, variants: { default: 2 }, contact: ['Zalo'], pageContact: ['P'],
    accounts: [{ id: 'fb1', type: 'fb-personal', label: 'FB Minh' }, { id: 'th', type: 'threads', label: 'Threads' }],
  }));
  const joined = lines.join('\n');
  for (const s of ['quận Hoàng Mai → Cầu Giấy', 'ngày mọi ngày → T2', 'ngôn ngữ tiếng Việt → tiếng Anh', 'ghi chú — → x', 'khung theo giờ chạy → 17:00', 'FB Minh: — → 2', 'Số bản default: 1 → 2', 'Liên hệ: — → Zalo', 'Liên hệ Page: — → P', 'Tài khoản Threads: thêm mới']) {
    assert.ok(joined.includes(s), s + '\n' + joined);
  }
  assert.ok(diffConfig(cfg(), cfg({ groups: [] })).includes('Nhóm Nhà trọ Hoàng Mai: bỏ'));
  assert.ok(diffConfig(cfg(), cfg({ accounts: [] })).includes('Tài khoản FB Minh: bỏ'));
});

test('diffProfile: persona / content types text', () => {
  const l = diffProfile({ cfg: cfg(), persona: 'a', contentTypes: 'x' }, { cfg: cfg(), persona: 'b', contentTypes: 'y' });
  assert.deepEqual(l, ['Persona: đã sửa', 'Kiểu bài: đã sửa']);
  assert.deepEqual(diffProfile({ cfg: cfg(), persona: 'a' }, { cfg: cfg(), persona: 'a' }), []);
});

const PERSONA = '# Persona\n\n## Tôi là ai\n\nFounder <b>x</b>.\n\n## NÊN\n\n- Nói rõ\n\n## KHÔNG NÊN\n\n- Siêu phẩm\n';
test('renderConfigBoard: no token, off class, persona open, escaping', () => {
  const html = renderConfigBoard({
    cfg: cfg({ groups: [grp({ active: false }), grp({ name: '<img onerror=1>', url: 'u2' })] }),
    persona: PERSONA, contentTypes: '## 1. Phòng mới\n\n- **Kênh**: wall\n- **Số tin mỗi bài**: 1\n',
    pending: ['Cách ghi liên hệ'], today: THU, tokenLabel: 'mkt-minh',
    lastChange: { at: new Date(2026, 10, 19, 9, 12), lines: ['Giờ chạy: 17:00 → 17:30'] },
  });
  assert.ok(!html.includes('SECRET-TOKEN-123'));
  assert.match(html, /class="grp off"/);
  assert.match(html, /<details class="sec" open>\s*<summary>Persona/);
  assert.equal((html.match(/<details class="sec" open>/g) || []).length, 1);
  assert.ok(!html.includes('<img onerror=1>') && html.includes('&lt;img onerror=1&gt;'));
  assert.ok(!html.includes('<b>x</b>'));
  assert.ok(html.includes('đã cài · mkt-minh'));
  assert.ok(html.includes('Giờ chạy: 17:00 → 17:30') && html.includes('Hoàn tác'));
  assert.ok(html.includes('1 mục đang chờ quy định'));
  assert.ok(html.includes('Hôm nay sẽ soạn') && html.includes('window.lavish?.queuePrompt'));
  assert.ok(!/<script[^>]*\ssrc=/i.test(html));
  assert.ok(!/\{\{[A-Z_]+\}\}/.test(html));
});

test('renderConfigBoard: token not set, today filter flags, invalid cfg shows errors', () => {
  const html = renderConfigBoard({ cfg: cfg({ groups: [grp({ days: ['mon'] })] }), today: THU, tokenLabel: null });
  assert.ok(html.includes('chưa cài'));
  assert.match(html, /data-today="0"/);
  const bad = renderConfigBoard({ cfg: { groups: 'x' }, today: THU });
  assert.ok(bad.includes('Cấu hình đang sai') && bad.includes('apiBaseUrl'));
});

test('init creates skeleton + templates, never overwrites', async () => {
  const dir = path.join(tmp(), 'p');
  const r = await run(['init'], dir);
  assert.equal(r.code, 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8')), { apiBaseUrl: '', accounts: [], groups: [] });
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

test('render-board writes board/index.html, token never present, lastChange from history', async () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(cfg()));
  fs.writeFileSync(path.join(dir, 'secrets.json'), JSON.stringify({ token: 'SECRET-TOKEN-123', label: 'mkt-minh' }));
  await run(['backup'], dir);
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(cfg({ schedule: ['17:30'] })));
  const r = await run(['render-board'], dir);
  const file = path.join(dir, 'board', 'index.html');
  assert.deepEqual(r.o, [file]);
  const html = fs.readFileSync(file, 'utf8');
  assert.ok(!html.includes('SECRET-TOKEN-123'));
  assert.ok(html.includes('đã cài · mkt-minh') && html.includes('Giờ chạy: 17:00 → 17:30'));
  // invalid config still renders
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ apiBaseUrl: '', accounts: [], groups: [] }));
  await run(['render-board'], dir);
  assert.ok(fs.readFileSync(file, 'utf8').includes('Cấu hình đang sai'));
});

test('today prints JSON targets per slot', async () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(cfg({ perSlot: { fb1: 1 } })));
  const j = JSON.parse((await run(['today'], dir)).o[0]);
  assert.equal(j.date, '2026-11-19');
  assert.equal(j.slots.length, 1);
  assert.equal(j.slots[0].hhmm, '17:00');
  assert.deepEqual(j.slots[0].targets.map((t) => t.id), ['group:https://fb/hm', 'wall:fb1:0']);
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
const board = (dir) => fs.readFileSync(path.join(dir, 'board', 'index.html'), 'utf8');

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
