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
  groups: [{ name: 'g', url: 'u', account: 'fb1', days: ['mon'] }],
  variants: { default: 1 },
});
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'hm-'));

test('valid config has no errors', () => assert.deepEqual(validateConfig(base()), []));

test('unknown group account', () => {
  const c = base();
  c.groups[0].account = 'fb9';
  assert.ok(validateConfig(c).some((e) => e.includes('groups[0].account')));
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
  c.groups[0].days = ['mon', 'xyz'];
  assert.ok(validateConfig(c).some((e) => e.includes('groups[0].days')));
});

test('loadConfig broken json', () => {
  const d = tmp();
  fs.writeFileSync(path.join(d, 'config.json'), '{oops');
  assert.throws(() => loadConfig(d), (e) => e instanceof ConfigError && e.message.startsWith('config.json không đọc được'));
});

test('loadConfig merges defaults', () => {
  const d = tmp();
  const { apiBaseUrl, accounts, groups } = base();
  fs.writeFileSync(path.join(d, 'config.json'), JSON.stringify({ apiBaseUrl, accounts, groups: [{ name: 'g', url: 'u', account: 'fb1' }] }));
  const c = loadConfig(d);
  assert.deepEqual(c.schedule, ['11:00', '17:30']);
  assert.equal(c.groups[0].language, 'vi');
  assert.equal(c.groups[0].active, true);
  assert.equal(c.groups[0].days.length, 7);
  assert.deepEqual(c.groups[0].districts, []);
  assert.equal(c.model, 'sonnet');
  assert.equal(c.outputDir, '~/HomeMatch-Posts');
  assert.deepEqual(c.variants, { default: 1 });
});

test('user values win over defaults', () => {
  const d = tmp();
  const b = base();
  fs.writeFileSync(path.join(d, 'config.json'), JSON.stringify({ ...b, schedule: ['09:00'], model: 'opus' }));
  const c = loadConfig(d);
  assert.deepEqual(c.schedule, ['09:00']);
  assert.equal(c.model, 'opus');
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
