import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadConfig, validateConfig, loadToken, ConfigError } from '../scripts/lib/config.mjs';
import { profileDir, expandHome } from '../scripts/lib/paths.mjs';

const base = () => ({
  apiBaseUrl: 'https://x',
  schedule: ['11:00'],
  accounts: [{ id: 'fb1', type: 'fb-personal', label: 'a' }],
  clusters: [{ id: 'g', name: 'g', account: 'fb1', days: ['mon'] }],
  variants: { default: 1 },
});
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'hm-'));

test('valid config has no errors', () => assert.deepEqual(validateConfig(base()), []));

test('unknown cluster account', () => {
  const c = base();
  c.clusters[0].account = 'fb9';
  assert.ok(validateConfig(c).some((e) => e.includes('clusters[0].account')));
});

test('variants out of range', () => {
  const c = base();
  c.variants = { default: 5 };
  assert.ok(validateConfig(c).some((e) => e.includes('variants.default')));
});

test('bad schedule time', () => {
  const c = base();
  c.schedule = ['25:00'];
  assert.ok(validateConfig(c).some((e) => e.includes('schedule[0]')));
});

test('bad days', () => {
  const c = base();
  c.clusters[0].days = ['mon', 'xyz'];
  assert.ok(validateConfig(c).some((e) => e.includes('clusters[0].days')));
});

test('loadConfig broken json', () => {
  const d = tmp();
  fs.writeFileSync(path.join(d, 'config.json'), '{oops');
  assert.throws(() => loadConfig(d), (e) => e instanceof ConfigError && e.message.startsWith('config.json không đọc được'));
});

test('loadConfig merges defaults', () => {
  const d = tmp();
  const { apiBaseUrl, accounts, clusters } = base();
  fs.writeFileSync(path.join(d, 'config.json'), JSON.stringify({ apiBaseUrl, accounts, clusters: [{ id: 'g', name: 'g', account: 'fb1' }] }));
  const c = loadConfig(d);
  assert.deepEqual(c.schedule, ['11:00', '17:30']);
  assert.equal(c.clusters[0].language, 'vi');
  assert.equal(c.clusters[0].active, true);
  assert.equal(c.clusters[0].days.length, 7);
  assert.deepEqual(c.clusters[0].districts, []);
  assert.equal('model' in c, false);
  assert.equal(c.outputDir, '~/HomeMatch-Posts');
  assert.deepEqual(c.variants, { default: 1 });
});

test('user values win over defaults', () => {
  const d = tmp();
  const b = base();
  fs.writeFileSync(path.join(d, 'config.json'), JSON.stringify({ ...b, schedule: ['09:00'], outputDir: '~/Khac' }));
  const c = loadConfig(d);
  assert.deepEqual(c.schedule, ['09:00']);
  assert.equal(c.outputDir, '~/Khac');
});

test('loadToken missing / present', () => {
  const d = tmp();
  assert.throws(() => loadToken(d), (e) => e instanceof ConfigError && e.message.includes('/hm-setup'));
  fs.writeFileSync(path.join(d, 'secrets.json'), JSON.stringify({ token: 'abc', label: 'L' }));
  assert.equal(loadToken(d), 'abc');
});

test('paths', () => {
  assert.equal(profileDir('/h'), '/h/.homematch-marketing');
  assert.equal(expandHome('~/x', '/h'), '/h/x');
  assert.equal(expandHome('/abs', '/h'), '/abs');
});

test('cluster without slots gets schedule slots', () => {
  const d = tmp();
  const b = base();
  fs.writeFileSync(path.join(d, 'config.json'), JSON.stringify({ ...b, clusters: [{ id: 'g', name: 'g', account: 'fb1' }] }));
  const c = loadConfig(d);
  assert.deepEqual(c.clusters[0].slots, c.schedule);
  assert.notEqual(c.clusters[0].slots, c.schedule);
});

test('cluster slot not in schedule is an error', () => {
  const c = base();
  c.clusters[0].slots = ['12:00'];
  assert.ok(validateConfig(c).some((e) => e.includes('clusters[0].slots[0]')));
});

test('top-level optional sections get defaults', () => {
  const d = tmp();
  const { apiBaseUrl, accounts, clusters } = base();
  fs.writeFileSync(path.join(d, 'config.json'), JSON.stringify({ apiBaseUrl, accounts, clusters }));
  const c = loadConfig(d);
  assert.deepEqual(c.contact, []);
  assert.deepEqual(c.pageContact, []);
  assert.deepEqual(c.library, {});
  assert.deepEqual(c.leadScan, { enabled: false });
});

test('clusters[i].groups[j].url: bắt buộc http(s), không trùng trong cụm; id cụm không trùng', () => {
  const at = (urls) => { const c = base(); c.clusters[0].groups = urls.map((url) => ({ name: 'n', url })); return validateConfig(c); };
  assert.deepEqual(at(['https://fb/a', 'http://fb/b']), []);
  for (const bad of [undefined, '', 'u', 'ftp://fb/a', 'facebook.com/groups/x', 3]) {
    assert.ok(at([bad]).some((e) => e.startsWith('clusters[0].groups[0].url')), String(bad));
  }
  const dup = at(['https://fb/a', 'https://FB/a/']);
  assert.ok(dup.some((e) => e.startsWith('clusters[0].groups[1].url')));
  const c = base(); c.clusters.push({ ...c.clusters[0] });
  assert.ok(validateConfig(c).some((e) => e.startsWith('clusters[1].id')));
  const s = base(); s.clusters[0].segment = 'vip';
  assert.ok(validateConfig(s).some((e) => e.startsWith('clusters[0].segment')));
  const old = base(); old.groups = [{ name: 'g', url: 'https://fb/g' }];
  assert.ok(validateConfig(old).some((e) => e.startsWith('groups:')));
});

test('perSlot.<key>: account có thật, số nguyên 0–5', () => {
  const at = (perSlot) => validateConfig({ ...base(), perSlot });
  assert.deepEqual(at({}), []);
  assert.deepEqual(at({ fb1: 0 }), []);
  assert.deepEqual(at({ fb1: 5 }), []);
  assert.ok(at({ fb9: 1 }).some((e) => e.startsWith('perSlot.fb9')));
  for (const v of [-1, 6, 1.5, '2', null]) assert.ok(at({ fb1: v }).some((e) => e.startsWith('perSlot.fb1')), String(v));
  assert.ok(at([1]).some((e) => e.startsWith('perSlot')));
});

test('links, priceStyle: mặc định tắt link, giá đầy đủ; trộn từng khoá', () => {
  const d = tmp();
  const { apiBaseUrl, accounts, clusters } = base();
  fs.writeFileSync(path.join(d, 'config.json'), JSON.stringify({ apiBaseUrl, accounts, clusters }));
  const c = loadConfig(d);
  assert.deepEqual(c.links, { page: false, wall: false, threads: false, group: false });
  assert.deepEqual(c.priceStyle, { page: 'full', wall: 'full', threads: 'full', group: 'full' });
  fs.writeFileSync(path.join(d, 'config.json'), JSON.stringify({ apiBaseUrl, accounts, clusters, links: { threads: true }, priceStyle: { wall: 'masked' } }));
  const c2 = loadConfig(d);
  assert.deepEqual(c2.links, { page: false, wall: false, threads: true, group: false });
  assert.deepEqual(c2.priceStyle, { page: 'full', wall: 'masked', threads: 'full', group: 'full' });
});

test('links: object, khoá page/wall/threads/group, giá trị boolean', () => {
  const v = (links) => validateConfig({ ...base(), links });
  assert.deepEqual(v({ page: true, wall: false, threads: true, group: false }), []);
  assert.ok(v('x').some((e) => e.startsWith('links:')));
  assert.ok(v([]).some((e) => e.startsWith('links:')));
  assert.ok(v({ wall: 'true' }).some((e) => e.startsWith('links.wall:')));
  assert.ok(v({ zalo: true }).some((e) => e.startsWith('links.zalo:')));
});

test('priceStyle: page/wall/threads/group nhận full | masked (Page được che, chỉ cảnh báo)', () => {
  const v = (priceStyle) => validateConfig({ ...base(), priceStyle });
  assert.deepEqual(v({ wall: 'masked', threads: 'full', group: 'masked' }), []);
  assert.ok(v('masked').some((e) => e.startsWith('priceStyle:')));
  assert.ok(v({ wall: 'hidden' }).some((e) => e.startsWith('priceStyle.wall:')));
  assert.deepEqual(v({ page: 'masked' }), []);
  assert.deepEqual(v({ page: 'full' }), []);
  assert.ok(v({ page: 'x' }).some((e) => e.startsWith('priceStyle.page:')));
  assert.ok(v({ zalo: 'full' }).some((e) => e.startsWith('priceStyle.zalo:')));
});
