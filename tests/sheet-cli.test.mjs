import test from 'node:test';
import assert from 'node:assert/strict';
import { main } from '../scripts/sheet-cli.mjs';

const run = async (argv, fetchImpl) => {
  let out = '';
  const code = await main(argv, { fetchImpl, out: (s) => { out += s; } });
  return { code, json: JSON.parse(out) };
};

test('prints rows as JSON', async () => {
  const fetchImpl = async () => ({ ok: true, status: 200, text: async () => 'Góp ý,Issue\nSai giá,\nĐẹp,Đã tạo issue #1\n' });
  const { code, json } = await run(['https://example.com/x.csv'], fetchImpl);
  assert.equal(code, 0);
  assert.deepEqual(json, { rows: [{ rowNumber: 2, 'Góp ý': 'Sai giá', Issue: '' }, { rowNumber: 3, 'Góp ý': 'Đẹp', Issue: 'Đã tạo issue #1' }], error: null });
});

test('HTTP error gives error and exit 2', async () => {
  const { code, json } = await run(['https://example.com/x.csv'], async () => ({ ok: false, status: 404 }));
  assert.equal(code, 2);
  assert.deepEqual(json.rows, []);
  assert.match(json.error, /404/);
});

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const csv = async () => ({ ok: true, status: 200, text: async () => 'Góp ý,Issue\nA,\nB,\n' });
const homeWith = (cfg) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'hm-'));
  fs.mkdirSync(path.join(home, '.homematch-marketing'));
  if (cfg !== undefined) fs.writeFileSync(path.join(home, '.homematch-marketing', 'config.json'), cfg);
  return home;
};
const runFb = async (home, fetchImpl = csv) => {
  let out = '';
  const code = await main(['--feedback'], { fetchImpl, home, out: (s) => { out += s; } });
  return { code, json: JSON.parse(out) };
};

test('rowNumber: header is row 1, first data row is 2', async () => {
  const { json } = await run(['https://example.com/x.csv'], csv);
  assert.deepEqual(json.rows.map((r) => r.rowNumber), [2, 3]);
});

test('--feedback uses library.feedbackCsvUrl', async () => {
  const home = homeWith(JSON.stringify({ apiBaseUrl: 'https://a.example', accounts: [], clusters: [], library: { feedbackCsvUrl: 'https://example.com/fb.csv' } }));
  let asked;
  const { code, json } = await runFb(home, async (u) => { asked = u; return csv(); });
  assert.equal(code, 0);
  assert.equal(asked, 'https://example.com/fb.csv');
  assert.equal(json.rows.length, 2);
});

test('--feedback without url exits 2', async () => {
  const home = homeWith(JSON.stringify({ apiBaseUrl: 'https://a.example', accounts: [], clusters: [] }));
  const { code, json } = await runFb(home);
  assert.equal(code, 2);
  assert.match(json.error, /feedbackCsvUrl/);
});

test('--feedback with missing config (ConfigError) exits 2', async () => {
  const { code, json } = await runFb(homeWith(undefined));
  assert.equal(code, 2);
  assert.deepEqual(json.rows, []);
  assert.ok(json.error);
});
