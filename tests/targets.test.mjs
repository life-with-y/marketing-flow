import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { targetsForSlot } from '../scripts/lib/targets.mjs';
import { appendPrepared, lastPreparedMap } from '../scripts/lib/prepared.mjs';

const THU = new Date(2026, 10, 19, 11, 0); // Thursday, local
const ALL = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const grp = (o) => ({ id: 'cg-room', name: 'Cầu Giấy · phòng trọ', account: 'fb1', active: true, segment: 'room', days: ALL, slots: ['11:00', '17:30'], districts: ['Cầu Giấy'], language: 'vi', note: '', keywords: [], groups: [], ...o });
const cfg = (o = {}) => ({
  schedule: ['11:00', '17:30'],
  accounts: [
    { id: 'fb1', type: 'fb-personal', label: 'Cá nhân' },
    { id: 'pg', type: 'fb-page', label: 'Trang' },
    { id: 'th', type: 'threads', label: 'Threads' },
  ],
  clusters: [grp()],
  perSlot: {},
  variants: { default: 1 },
  contact: ['c1'],
  pageContact: ['p1'],
  ...o,
});
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'hm-'));

test('group with days mon,wed is skipped on Thursday', () => {
  assert.equal(targetsForSlot(cfg({ clusters: [grp({ days: ['mon', 'wed'] })] }), THU, '11:00').length, 0);
});

test('inactive group skipped', () => {
  assert.equal(targetsForSlot(cfg({ clusters: [grp({ active: false })] }), THU, '11:00').length, 0);
});

test('group with slots 17:30 skipped at 11:00', () => {
  assert.equal(targetsForSlot(cfg({ clusters: [grp({ slots: ['17:30'] })] }), THU, '11:00').length, 0);
});

test('group target shape', () => {
  const [t] = targetsForSlot(cfg(), THU, '11:00');
  assert.equal(t.id, 'group:cg-room');
  assert.equal(t.url, '');
  assert.equal(t.segment, 'room');
  assert.deepEqual(t.groups, []);
  assert.equal(t.kind, 'group');
  assert.equal(t.account, 'fb1');
  assert.equal(t.variants, 1);
  assert.deepEqual(t.contact, ['c1']);
});

test('perSlot threads -> 1 threads target', () => {
  const ts = targetsForSlot(cfg({ clusters: [], perSlot: { th: 1 } }), THU, '11:00');
  assert.equal(ts.length, 1);
  assert.equal(ts[0].kind, 'threads');
  assert.equal(ts[0].id, 'threads:th:0');
  assert.equal(ts[0].name, 'Threads');
  assert.equal(ts[0].url, '');
});

test('perSlot multiple, wall and page, with contact', () => {
  const ts = targetsForSlot(cfg({ clusters: [], perSlot: { fb1: 2, pg: 1 } }), THU, '11:00');
  assert.deepEqual(ts.map((t) => t.id), ['wall:fb1:0', 'wall:fb1:1', 'page:pg:0']);
  assert.deepEqual(ts[2].contact, ['p1']);
  assert.deepEqual(ts[0].contact, ['c1']);
});

test('variants per kind', () => {
  const ts = targetsForSlot(cfg({ perSlot: { pg: 1 }, variants: { default: 1, page: 3 } }), THU, '11:00');
  assert.equal(ts.find((t) => t.kind === 'page').variants, 3);
  assert.equal(ts.find((t) => t.kind === 'group').variants, 1);
});

test('onlyGroups accent-insensitive, excludes other targets', () => {
  const c = cfg({ perSlot: { th: 1 }, clusters: [grp(), grp({ id: 'dd-room', name: 'Đống Đa · phòng trọ' })] });
  const ts = targetsForSlot(c, THU, '11:00', ['cau giay']);
  assert.equal(ts.length, 1);
  assert.equal(ts[0].name, 'Cầu Giấy · phòng trọ');
  assert.equal(targetsForSlot(c, THU, '11:00', ['dong da'])[0].id, 'group:dd-room');
});

test('lastPreparedMap returns latest and handles missing file', () => {
  const d = tmp();
  assert.equal(lastPreparedMap(d).size, 0);
  appendPrepared(d, [{ slot: 's1', account: 'fb1', target: 'group:u', postCodes: ['T1', 'T2'], type: 'listing' }], new Date('2026-11-01T00:00:00Z'));
  appendPrepared(d, [{ slot: 's2', account: 'fb1', target: 'group:u', postCodes: ['T1'], type: 'listing' }], new Date('2026-11-05T00:00:00Z'));
  const m = lastPreparedMap(d);
  assert.equal(m.get('group:u|T1'), '2026-11-05T00:00:00.000Z');
  assert.equal(m.get('group:u|T2'), '2026-11-01T00:00:00.000Z');
  assert.equal(fs.readFileSync(path.join(d, 'prepared.jsonl'), 'utf8').trim().split('\n').length, 2);
});

test('hhmm null skips slot filter but keeps active + weekday', () => {
  const c = cfg({ clusters: [
    grp({ slots: ['17:30'], id: 'a' }),
    grp({ active: false, id: 'b' }),
    grp({ days: ['mon'], id: 'c' }),
  ] });
  assert.deepEqual(targetsForSlot(c, THU, null).map((t) => t.id), ['group:a']);
});

test('onlyGroups ignores days/slots', () => {
  const ts = targetsForSlot(cfg({ clusters: [grp({ days: ['mon'], slots: ['17:30'] })] }), THU, '11:00', ['cau giay']);
  assert.equal(ts.length, 1);
});

test('onlyGroups skips inactive match', () => {
  assert.equal(targetsForSlot(cfg({ clusters: [grp({ active: false })] }), THU, null, ['cau giay']).length, 0);
});

test('links, priceStyle theo kênh trên từng đích', () => {
  const c = cfg({ perSlot: { fb1: 1, pg: 1, th: 1 }, links: { page: true, wall: false, threads: true, group: true }, priceStyle: { page: 'masked', wall: 'masked', threads: 'full', group: 'masked' } });
  const by = Object.fromEntries(targetsForSlot(c, THU, '11:00').map((t) => [t.kind, t]));
  assert.deepEqual(Object.fromEntries(Object.entries(by).map(([k, t]) => [k, [t.links, t.priceStyle]])), {
    group: [true, 'masked'], wall: [false, 'masked'], page: [true, 'masked'], threads: [true, 'full'],
  });
});

test('thiếu links/priceStyle: tắt link, giá đầy đủ', () => {
  const ts = targetsForSlot(cfg({ perSlot: { fb1: 1, pg: 1, th: 1 } }), THU, '11:00');
  for (const t of ts) { assert.equal(t.links, false, t.id); assert.equal(t.priceStyle, 'full', t.id); }
  const g = targetsForSlot(cfg({ links: { group: 'yes' }, priceStyle: { group: 'weird' } }), THU, '11:00')[0];
  assert.equal(g.links, false);
  assert.equal(g.priceStyle, 'full');
});

test('cụm: chỉ nhóm đã vào đi theo đích, phân khúc kèm luật', () => {
  const c = cfg({ clusters: [grp({ segment: 'student', groups: [
    { name: 'A', url: 'https://fb/a', joined: true },
    { name: 'B', url: 'https://fb/b' },
  ] })] });
  const [t] = targetsForSlot(c, THU, '11:00');
  assert.deepEqual(t.groups, [{ name: 'A', url: 'https://fb/a' }]);
  assert.equal(t.segmentRule, 'Có phòng dưới 5 triệu');
});
