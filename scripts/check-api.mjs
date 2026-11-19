// Gọi thử API + lưu token (Task 13). Token đọc từ stdin, không nhận qua tham số, không bao giờ in ra.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchListingsRaw, ApiError } from './lib/api.mjs';
import { toListings } from './lib/listings.mjs';
import { profileDir } from './lib/paths.mjs';
import { init } from './config-cli.mjs';

const MESSAGES = {
  auth: 'Token không hợp lệ, xin admin token mới',
  network: 'Không gọi được API HomeMatch, thử lại sau',
  schema: 'Dữ liệu API không đúng định dạng',
};

export async function checkApi({ baseUrl, token, fetchImpl = fetch }) {
  try {
    const raw = await fetchListingsRaw({ baseUrl, token, fetchImpl });
    return { ok: true, listingCount: toListings(raw).length };
  } catch (e) {
    if (e instanceof ApiError) return { ok: false, message: MESSAGES[e.kind] ?? MESSAGES.network };
    return { ok: false, message: MESSAGES.network };
  }
}

async function readStdin(stdin) {
  if (typeof stdin === 'string') return stdin;
  let s = '';
  for await (const chunk of stdin) s += chunk;
  return s;
}

function parseArgs(argv) {
  const o = { base: null, save: false, label: '' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--base') o.base = argv[++i];
    else if (argv[i] === '--save') o.save = true;
    else if (argv[i] === '--label') o.label = argv[++i] ?? '';
  }
  return o;
}

function saveProfile(dir, { token, label, base }) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = path.join(dir, 'secrets.json');
  fs.writeFileSync(file, JSON.stringify(label ? { token, label } : { token }), { mode: 0o600 });
  fs.chmodSync(file, 0o600);
  init(dir);
  const cfgFile = path.join(dir, 'config.json');
  const cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
  cfg.apiBaseUrl = base;
  fs.writeFileSync(cfgFile, JSON.stringify(cfg, null, 2) + '\n');
}

export async function main(argv, { stdin = process.stdin, home = os.homedir(), fetchImpl = fetch, out = (s) => console.log(s), err = (s) => console.error(s) } = {}) {
  const a = parseArgs(argv);
  if (!a.base) { err('Dùng: check-api.mjs --base <url> [--save --label <tên token>] (token đọc từ stdin)'); return 2; }
  const token = (await readStdin(stdin)).split(/\r?\n/)[0].trim();
  if (!token) { err('Không nhận được token từ stdin'); return 2; }
  const r = await checkApi({ baseUrl: a.base, token, fetchImpl });
  if (!r.ok) { out(r.message); return 2; }
  if (a.save) {
    try { saveProfile(profileDir(home), { token, label: a.label, base: a.base }); } catch { err('Không ghi được hồ sơ ~/.homematch-marketing'); return 2; }
  }
  out(`OK: ${r.listingCount} tin đang hiển thị`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
