import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPrepare } from '../scripts/prepare.mjs';

const FIX = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'api-response.json'), 'utf8');
const TOKEN = 'sekret-token-xyz';
const NOW = new Date(2026, 10, 19, 11, 5);

function mkHome(cfgOver = {}) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'hm-prep-'));
  const dir = path.join(home, '.homematch-marketing');
  fs.mkdirSync(dir, { recursive: true });
  const cfg = {
    apiBaseUrl: 'https://api.example.test',
    accounts: [{ id: 'fb1', type: 'fb-personal', label: 'Cá nhân' }],
    groups: [{ name: 'Phòng trọ Cầu Giấy', url: 'https://fb/g1', account: 'fb1', districts: ['Cầu Giấy'] }],
    ...cfgOver,
  };
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(cfg));
  fs.writeFileSync(path.join(dir, 'secrets.json'), JSON.stringify({ token: TOKEN }));
  return { home, dir };
}
const ok = async () => ({ ok: true, status: 200, json: async () => JSON.parse(FIX), text: async () => '' });
const status = (s) => async () => ({ ok: false, status: s, json: async () => ({}) });

test('first run writes input.json with UNCHANGED labels, eligibility, no token', async () => {
  const { home, dir } = mkHome();
  const r = await runPrepare({ home, now: NOW, fetchImpl: ok });
  assert.equal(r.exitCode, 0);
  assert.ok(fs.existsSync(r.inputPath));
  const text = fs.readFileSync(r.inputPath, 'utf8');
  assert.ok(!text.includes(TOKEN));
  const input = JSON.parse(text);
  assert.equal(input.slot, '2026-11-19_1105');
  assert.ok(input.listings.length > 0);
  assert.ok(input.listings.every((l) => l.label === 'UNCHANGED'));
  assert.equal(input.listings.find((l) => l.code === 'T1299').eligible, false);
  assert.ok(fs.existsSync(path.join(dir, 'snapshots', '2026-11-19_1105.json')));
});

test('late slot exits 3 with no snapshot', async () => {
  const { home, dir } = mkHome();
  const r = await runPrepare({ home, slot: '11:00', now: new Date(2026, 10, 19, 12, 31), fetchImpl: ok });
  assert.equal(r.exitCode, 3);
  assert.ok(!fs.existsSync(path.join(dir, 'snapshots')));
});

test('401 exits 2 with token message and no retry', async () => {
  const { home } = mkHome();
  let n = 0;
  const r = await runPrepare({ home, now: NOW, retryDelayMs: 0, fetchImpl: async () => { n++; return status(401)(); } });
  assert.equal(r.exitCode, 2);
  assert.ok(r.message.includes('Token không hợp lệ, xin admin token mới'));
  assert.equal(n, 1);
});

test('network error once then ok exits 0', async () => {
  const { home } = mkHome();
  let n = 0;
  const r = await runPrepare({ home, now: NOW, retryDelayMs: 0, fetchImpl: async () => { if (n++ === 0) throw new Error('boom'); return ok(); } });
  assert.equal(r.exitCode, 0);
  assert.equal(n, 2);
});

test('network error twice exits 2 and writes no snapshot', async () => {
  const { home, dir } = mkHome();
  const r = await runPrepare({ home, now: NOW, retryDelayMs: 0, fetchImpl: async () => { throw new Error('boom'); } });
  assert.equal(r.exitCode, 2);
  assert.ok(r.message.includes('Không gọi được API HomeMatch, thử lại sau'));
  assert.ok(!fs.existsSync(path.join(dir, 'snapshots')));
});

test('no targets exits 4', async () => {
  const { home } = mkHome({ groups: [] });
  const r = await runPrepare({ home, now: NOW, fetchImpl: ok });
  assert.equal(r.exitCode, 4);
});

test('leads matching listings sort first', async () => {
  const { home, dir } = mkHome();
  fs.mkdirSync(path.join(dir, 'leads'));
  const raw = JSON.parse(FIX);
  const districts = raw.data.flatMap((c) => c.areas.map((a) => a.district));
  const target = districts[districts.length - 1];
  fs.writeFileSync(path.join(dir, 'leads', '2026-11-19.json'), JSON.stringify({ demands: [{ district: target.toUpperCase(), maxPrice: 100000000 }] }));
  const r = await runPrepare({ home, now: NOW, fetchImpl: ok });
  const input = JSON.parse(fs.readFileSync(r.inputPath, 'utf8'));
  assert.equal(input.listings[0].district, target);
});

async function orderWithPrev(mutate) {
  const { home, dir } = mkHome();
  const { toListings } = await import('../scripts/lib/listings.mjs');
  const prev = mutate(toListings(JSON.parse(FIX)));
  fs.mkdirSync(path.join(dir, 'snapshots'));
  fs.writeFileSync(path.join(dir, 'snapshots', '2026-11-18_1100.json'), JSON.stringify(prev));
  const r = await runPrepare({ home, now: NOW, fetchImpl: ok });
  const input = JSON.parse(fs.readFileSync(r.inputPath, 'utf8'));
  return input.listings.map((l) => `${l.code}:${l.label}`);
}

test('priority order NEW < PRICE_DOWN < NOW_AVAILABLE < PRICE_UP', async () => {
  const got = await orderWithPrev((prev) => prev
    .filter((l) => l.code !== 'T1288') // NEW
    .map((l) => {
      const rooms = l.rooms.map((r) => ({ ...r }));
      if (l.code === 'T1302') rooms.forEach((r) => { r.price -= 100000; }); // PRICE_UP
      if (l.code === 'T1299') rooms[0].status = 'COMING_SOON'; // NOW_AVAILABLE
      if (l.code === 'T1275') rooms[0].price += 100000; // PRICE_DOWN
      return { ...l, rooms };
    }));
  assert.deepEqual(got, ['T1288:NEW', 'T1275:PRICE_DOWN', 'T1299:NOW_AVAILABLE', 'T1302:PRICE_UP']);
});

test('PRICE_UP ranks equal to UNCHANGED (stable input order)', async () => {
  const got = await orderWithPrev((prev) => prev.map((l) => {
    const rooms = l.rooms.map((r) => ({ ...r }));
    if (l.code === 'T1302') rooms.forEach((r) => { r.price -= 100000; });
    return { ...l, rooms };
  }));
  assert.deepEqual(got.slice(0, 2), ['T1302:PRICE_UP', 'T1299:UNCHANGED']);
});

test('--slot qua nửa đêm: dùng ngày hôm qua cho mã khung, thứ, độ trễ', async () => {
  const { home, dir } = mkHome({ schedule: ['11:00', '23:30'], groups: [{ name: 'Phòng trọ Cầu Giấy', url: 'https://fb/g1', account: 'fb1', days: ['thu'] }] });
  const r = await runPrepare({ home, slot: '23:30', now: new Date(2026, 10, 20, 0, 30), fetchImpl: ok });
  assert.equal(r.exitCode, 0, r.message);
  assert.equal(r.slot, '2026-11-19_2330');
  assert.equal(JSON.parse(fs.readFileSync(r.inputPath, 'utf8')).targets.length, 1);
  assert.ok(fs.existsSync(path.join(dir, 'snapshots', '2026-11-19_2330.json')));
  const late = await runPrepare({ home, slot: '23:30', now: new Date(2026, 10, 20, 1, 10), fetchImpl: ok });
  assert.equal(late.exitCode, 3);
  // chạy sớm trong 10 phút vẫn là hôm nay
  const early = await runPrepare({ home, slot: '11:00', now: new Date(2026, 10, 19, 10, 52), fetchImpl: ok });
  assert.equal(early.exitCode, 0, early.message);
  assert.equal(early.slot, '2026-11-19_1100');
});

test('--slot không còn trong schedule -> exit 4', async () => {
  const { home, dir } = mkHome({ schedule: ['11:00'] });
  const r = await runPrepare({ home, slot: '17:30', now: new Date(2026, 10, 19, 17, 31), fetchImpl: ok });
  assert.equal(r.exitCode, 4);
  assert.equal(r.message, 'Khung 17:30 không còn trong lịch');
  assert.ok(!fs.existsSync(path.join(dir, 'snapshots')));
});
