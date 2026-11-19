// Quyền cho scheduled task (Task 13). Mặc định chỉ in rule (dry run); --apply gộp vào ~/.claude/settings.json.
// TODO: cú pháp rule và cách khớp tiền tố được xác nhận trong Task 0 spike.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expandHome } from './lib/paths.mjs';

const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROFILE = '~/.homematch-marketing';

class Refuse extends Error {}

function outputRule(outputDir, home) {
  if (typeof outputDir !== 'string' || !outputDir.trim()) throw new Refuse('Thiếu thư mục đầu ra (--output-dir)');
  const abs = path.resolve(expandHome(outputDir.trim(), home));
  const h = path.resolve(home);
  const claude = path.join(h, '.claude');
  const inside = (p, dir) => p === dir || p.startsWith(dir + path.sep);
  if (abs === path.parse(abs).root) throw new Refuse('Thư mục đầu ra không được là thư mục gốc');
  if (abs === h) throw new Refuse('Thư mục đầu ra không được là thư mục home');
  if (inside(h, abs)) throw new Refuse('Thư mục đầu ra không được là thư mục cha của home');
  if (inside(abs, claude)) throw new Refuse('Thư mục đầu ra không được nằm trong ~/.claude');
  const shown = inside(abs, h) ? `~/${path.relative(h, abs).split(path.sep).join('/')}` : abs;
  return `Write(${shown}/**)`;
}

export function buildRules({ outputDir, home = os.homedir(), pluginRoot = PLUGIN_ROOT }) {
  const root = pluginRoot.split(path.sep).join('/');
  return {
    allow: [
      ...['prepare', 'build', 'config-cli'].map((n) => `Bash(node ${root}/scripts/${n}.mjs:*)`),
      `Read(${PROFILE}/**)`, `Write(${PROFILE}/**)`, `Edit(${PROFILE}/**)`,
      outputRule(outputDir, home),
    ],
    deny: [`Read(${PROFILE}/secrets.json)`],
  };
}

function writeAtomic(file, data) {
  const tmp = `${file}.${process.pid}.tmp`;
  try { fs.writeFileSync(tmp, data); fs.renameSync(tmp, file); } catch (e) { fs.rmSync(tmp, { force: true }); throw e; }
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

export function apply(rules, settingsPath, now = new Date()) {
  let settings = { permissions: { allow: [] } };
  const existed = fs.existsSync(settingsPath);
  if (existed) {
    try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')); } catch { throw new Refuse('settings.json sai định dạng JSON, không ghi gì'); }
    const p = isObj(settings) ? settings.permissions : undefined;
    const bad = !isObj(settings) || (p !== undefined && (!isObj(p) || (p.allow !== undefined && !Array.isArray(p.allow)) || (p.deny !== undefined && !Array.isArray(p.deny))));
    if (bad) throw new Refuse('settings.json có permissions/allow/deny sai kiểu, không ghi gì');
  }
  settings.permissions ??= {};
  const p = settings.permissions;
  p.allow ??= [];
  const addedAllow = rules.allow.filter((r) => !p.allow.includes(r));
  const addedDeny = rules.deny.filter((r) => !(p.deny ?? []).includes(r));
  if (!addedAllow.length && !addedDeny.length) return { added: 0, backup: null };
  p.allow.push(...addedAllow);
  if (addedDeny.length) { p.deny ??= []; p.deny.push(...addedDeny); }
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  let backup = null;
  if (existed) {
    const stamp = now.toISOString().replace(/[:.]/g, '-');
    backup = `${settingsPath}.bak-hm-${stamp}`;
    for (let i = 1; fs.existsSync(backup); i++) backup = `${settingsPath}.bak-hm-${stamp}-${i}`;
    fs.copyFileSync(settingsPath, backup, fs.constants.COPYFILE_EXCL);
  }
  writeAtomic(settingsPath, JSON.stringify(settings, null, 2) + '\n');
  return { added: addedAllow.length + addedDeny.length, backup };
}

export async function main(argv, { home = os.homedir(), settingsPath = path.join(home, '.claude', 'settings.json'), pluginRoot = PLUGIN_ROOT, now = new Date(), out = (s) => console.log(s), err = (s) => console.error(s) } = {}) {
  const i = argv.indexOf('--output-dir');
  try {
    const rules = buildRules({ outputDir: i >= 0 ? argv[i + 1] : undefined, home, pluginRoot });
    if (!argv.includes('--apply')) { out(JSON.stringify(rules, null, 2)); return 0; }
    const r = apply(rules, settingsPath, now);
    out(r.added ? `Đã thêm ${r.added} rule vào ${settingsPath}${r.backup ? `; bản sao lưu: ${r.backup}` : ''}` : 'Các rule đã có sẵn, không đổi gì');
    return 0;
  } catch (e) {
    if (e instanceof Refuse) { err(e.message); return 2; }
    err(`Không ghi được settings.json: ${e.code ?? e.message}`);
    return 3;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
