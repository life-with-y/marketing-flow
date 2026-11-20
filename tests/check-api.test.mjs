import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkApi, main } from '../scripts/check-api.mjs';

const FIX = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'api-response.json'), 'utf8');
const TOKEN = 'sekret-token-xyz';
const BASE = 'https://api.example.test';
const okFetch = async (u) => (String(u).includes('/marketing-listings')
  ? { ok: false, status: 404, json: async () => ({}) }
  : { ok: true, status: 200, json: async () => JSON.parse(FIX) });
const status = (s) => async () => ({ ok: false, status: s, json: async () => ({}) });

function run(argv, { stdin = TOKEN + '\n', fetchImpl = okFetch, home } = {}) {
  home ??= fs.mkdtempSync(path.join(os.tmpdir(), 'hm-chk-'));
  const lines = [];
  const push = (s) => lines.push(String(s));
  return main(argv, { stdin, home, fetchImpl, out: push, err: push }).then((code) => ({ code, text: lines.join('\n'), home }));
}

test('checkApi 401 -> auth message', async () => {
  const r = await checkApi({ baseUrl: BASE, token: TOKEN, fetchImpl: status(401) });
  assert.deepEqual(r, { ok: false, message: 'Token không hợp lệ, xin admin token mới' });
});

test('checkApi network and schema messages', async () => {
  const boom = async () => { throw new Error('down'); };
  assert.equal((await checkApi({ baseUrl: BASE, token: TOKEN, fetchImpl: boom })).message, 'Không gọi được API HomeMatch, thử lại sau');
  assert.equal((await checkApi({ baseUrl: BASE, token: TOKEN, fetchImpl: status(500) })).message, 'Không gọi được API HomeMatch, thử lại sau');
  const bad = async () => ({ ok: true, status: 200, json: async () => ({ nope: 1 }) });
  assert.equal((await checkApi({ baseUrl: BASE, token: TOKEN, fetchImpl: bad })).message, 'Dữ liệu API không đúng định dạng');
});

test('checkApi ok returns listing count', async () => {
  const r = await checkApi({ baseUrl: BASE, token: TOKEN, fetchImpl: okFetch });
  assert.equal(r.ok, true);
  assert.ok(Number.isInteger(r.listingCount) && r.listingCount > 0);
});

test('cli ok without --save prints count, writes no file', async () => {
  const r = await run(['--base', BASE]);
  assert.equal(r.code, 0);
  assert.match(r.text, /^OK: \d+ tin đang hiển thị$/);
  assert.equal(fs.existsSync(path.join(r.home, '.homematch-marketing')), false);
  assert.ok(!r.text.includes(TOKEN));
});

test('cli 401 exits 2, prints message, no token, no file', async () => {
  const r = await run(['--base', BASE, '--save', '--label', 'x'], { fetchImpl: status(401) });
  assert.equal(r.code, 2);
  assert.equal(r.text, 'Token không hợp lệ, xin admin token mới');
  assert.ok(!r.text.includes(TOKEN));
  assert.equal(fs.existsSync(path.join(r.home, '.homematch-marketing', 'secrets.json')), false);
});

test('cli --save writes secrets mode 600 and apiBaseUrl', async () => {
  const r = await run(['--base', BASE, '--save', '--label', 'Token của Lan']);
  assert.equal(r.code, 0);
  assert.ok(!r.text.includes(TOKEN));
  const dir = path.join(r.home, '.homematch-marketing');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'secrets.json'), 'utf8')), { token: TOKEN, label: 'Token của Lan' });
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8')).apiBaseUrl, BASE);
  if (process.platform !== 'win32') {
    assert.equal(fs.statSync(path.join(dir, 'secrets.json')).mode & 0o777, 0o600);
    assert.equal(fs.statSync(dir).mode & 0o777, 0o700);
  }
});

test('cli --save overwrites loose-permission file and keeps config fields', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'hm-chk-'));
  const dir = path.join(home, '.homematch-marketing');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'secrets.json'), '{"token":"old"}', { mode: 0o644 });
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ apiBaseUrl: 'old', accounts: [{ id: 'a' }], clusters: [] }));
  const r = await run(['--base', BASE, '--save'], { home });
  assert.equal(r.code, 0);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'secrets.json'), 'utf8')).token, TOKEN);
  const cfg = JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8'));
  assert.equal(cfg.apiBaseUrl, BASE);
  assert.equal(cfg.accounts.length, 1);
  if (process.platform !== 'win32') assert.equal(fs.statSync(path.join(dir, 'secrets.json')).mode & 0o777, 0o600);
});

test('cli errors: missing --base, empty stdin', async () => {
  assert.equal((await run([])).code, 2);
  const r = await run(['--base', BASE], { stdin: '\n' });
  assert.equal(r.code, 2);
});

test('cli --save: malformed config.json -> exit 3, old secrets.json byte-identical', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'hm-chk-'));
  const dir = path.join(home, '.homematch-marketing');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'secrets.json'), '{"token":"old"}');
  fs.writeFileSync(path.join(dir, 'config.json'), '{not json');
  const r = await run(['--base', BASE, '--save'], { home });
  assert.equal(r.code, 3);
  assert.match(r.text, /^Không lưu được: /);
  assert.ok(!r.text.includes(TOKEN));
  assert.equal(fs.readFileSync(path.join(dir, 'secrets.json'), 'utf8'), '{"token":"old"}');
  assert.equal(fs.readFileSync(path.join(dir, 'config.json'), 'utf8'), '{not json');
  assert.deepEqual(fs.readdirSync(dir).sort(), ['config.json', 'secrets.json']);
});

test('cli --save: existing 0755 dir becomes 0700', { skip: process.platform === 'win32' }, async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'hm-chk-'));
  const dir = path.join(home, '.homematch-marketing');
  fs.mkdirSync(dir, { recursive: true });
  fs.chmodSync(dir, 0o755);
  const r = await run(['--base', BASE, '--save'], { home });
  assert.equal(r.code, 0);
  assert.equal(fs.statSync(dir).mode & 0o777, 0o700);
  assert.equal(fs.readdirSync(dir).some((f) => f.includes('.tmp')), false);
});
