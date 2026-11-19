import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { toListings } from '../scripts/lib/listings.mjs';
import { labelListings } from '../scripts/lib/diff.mjs';
import { saveSnapshot, latestSnapshot } from '../scripts/lib/snapshot.mjs';

const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/api-response.json', import.meta.url), 'utf8'));
const base = () => toListings(fixture);
const find = (ls, code) => ls.find((l) => l.code === code);
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'snap-'));

test('prev null -> all NEW', () => {
  const out = labelListings(null, base());
  for (const l of out) {
    assert.equal(l.label, 'NEW');
    for (const r of l.rooms) assert.equal(r.label, 'NEW');
  }
});

test('NEW: room absent from prev', () => {
  const prev = base().filter((l) => l.code !== 'T1288');
  const out = labelListings(prev, base());
  assert.equal(find(out, 'T1288').rooms[0].label, 'NEW');
  assert.equal(find(out, 'T1299').rooms[0].label, 'UNCHANGED');
});

test('PRICE_DOWN / PRICE_UP', () => {
  const prev = base();
  find(prev, 'T1288').rooms[0].price += 500000;
  find(prev, 'T1299').rooms[0].price -= 500000;
  const out = labelListings(prev, base());
  assert.equal(find(out, 'T1288').rooms[0].label, 'PRICE_DOWN');
  assert.equal(find(out, 'T1299').rooms[0].label, 'PRICE_UP');
  assert.equal(find(out, 'T1299').label, 'PRICE_UP');
});

test('NOW_AVAILABLE', () => {
  const prev = base();
  find(prev, 'T1288').rooms[0].status = 'COMING_SOON';
  const out = labelListings(prev, base());
  assert.equal(find(out, 'T1288').rooms[0].label, 'NOW_AVAILABLE');
});

test('UNCHANGED', () => {
  const out = labelListings(base(), base());
  for (const l of out) assert.equal(l.label, 'UNCHANGED');
});

test('listing label is strongest of rooms', () => {
  const prev = base();
  const t = find(prev, 'T1302');
  assert.ok(t.rooms.length >= 2);
  t.rooms = t.rooms.slice(0, 1);
  const out = labelListings(prev, base());
  const labels = find(out, 'T1302').rooms.map((r) => r.label);
  assert.deepEqual(labels.sort(), ['NEW', 'UNCHANGED']);
  assert.equal(find(out, 'T1302').label, 'NEW');
});

test('does not mutate inputs', () => {
  const prev = base(), curr = base();
  const snap = JSON.stringify(curr);
  labelListings(prev, curr);
  assert.equal(JSON.stringify(curr), snap);
  assert.equal(curr[0].label, undefined);
});

test('saveSnapshot keeps 30, deletes oldest; latestSnapshot before slot', () => {
  const dir = tmp();
  const pad = (n) => `2026-11-${String(n).padStart(2, '0')}_0900`;
  for (let i = 1; i <= 31; i++) saveSnapshot(dir, pad(i), [{ code: `X${i}`, rooms: [] }]);
  const files = fs.readdirSync(path.join(dir, 'snapshots'));
  assert.equal(files.length, 30);
  assert.ok(!files.includes(`${pad(1)}.json`));
  assert.ok(files.includes(`${pad(2)}.json`));
  assert.equal(latestSnapshot(dir, pad(20))[0].code, 'X19');
  assert.equal(latestSnapshot(dir, pad(2)), null);
  assert.equal(latestSnapshot(tmp(), pad(5)), null);
});

test('latestSnapshot bỏ file hỏng, lùi về bản cũ hơn; saveSnapshot ghi qua file tạm', () => {
  const dir = tmp();
  const s = (d) => `2026-11-${d}_0900`;
  saveSnapshot(dir, s('10'), [{ code: 'OLD', rooms: [] }]);
  saveSnapshot(dir, s('11'), [{ code: 'MID', rooms: [] }]);
  fs.writeFileSync(path.join(dir, 'snapshots', `${s('12')}.json`), '[{"code":"TRUNC');
  assert.equal(latestSnapshot(dir, s('13'))[0].code, 'MID');
  fs.writeFileSync(path.join(dir, 'snapshots', `${s('11')}.json`), '');
  assert.equal(latestSnapshot(dir, s('13'))[0].code, 'OLD');
  fs.writeFileSync(path.join(dir, 'snapshots', `${s('10')}.json`), '{not json');
  assert.equal(latestSnapshot(dir, s('13')), null);
  // không để lại file tạm
  saveSnapshot(dir, s('14'), [{ code: 'NEW', rooms: [] }]);
  assert.deepEqual(fs.readdirSync(path.join(dir, 'snapshots')).filter((f) => !f.endsWith('.json')), []);
  assert.equal(latestSnapshot(dir, s('15'))[0].code, 'NEW');
});

test('saveSnapshot dùng rename (file tạm rồi đổi tên)', () => {
  const dir = tmp();
  const orig = fs.renameSync;
  const calls = [];
  fs.renameSync = (a, b) => { calls.push([a, b]); return orig(a, b); };
  try { saveSnapshot(dir, '2026-11-20_0900', []); } finally { fs.renameSync = orig; }
  assert.equal(calls.length, 1);
  assert.equal(path.basename(calls[0][1]), '2026-11-20_0900.json');
  assert.notEqual(calls[0][0], calls[0][1]);
});
