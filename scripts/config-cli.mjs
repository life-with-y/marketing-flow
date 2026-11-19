// CLI cấu hình: init | backup | undo | changelog | render-board | today (Task 11).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { profileDir } from './lib/paths.mjs';
import { loadConfig, validateConfig, ConfigError } from './lib/config.mjs';
import { targetsForSlot } from './lib/targets.mjs';
import { diffProfile } from './lib/config-diff.mjs';
import { renderConfigBoard } from './lib/render-config.mjs';
import { fetchSheet } from './lib/sheet.mjs';

const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILES = ['config.json', 'persona.md', 'content-types.md'];
const SKELETON = { apiBaseUrl: '', accounts: [], groups: [] };
const NO_HISTORY = 'Chưa có lần sửa nào';

const readText = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return null; } };
const readJsonSafe = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const stamp = (d) => d.toISOString().replace(/:/g, '-');
const unstamp = (name) => {
  const d = new Date(name.replace(/^(\d{4}-\d{2}-\d{2}T\d{2})-(\d{2})-(\d{2})/, '$1:$2:$3'));
  return Number.isNaN(d.getTime()) ? null : d;
};

function profile(dir) {
  return { cfg: readJsonSafe(path.join(dir, 'config.json')) ?? {}, persona: readText(path.join(dir, 'persona.md')), contentTypes: readText(path.join(dir, 'content-types.md')) };
}

function newestHistory(dir) {
  const h = path.join(dir, 'history');
  let names = [];
  try { names = fs.readdirSync(h, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name); } catch { /* none */ }
  names.sort();
  const name = names[names.length - 1];
  return name ? { name, dir: path.join(h, name) } : null;
}

function profileOf(snapDir) {
  return profile(snapDir);
}

// Cấu hình hiện tại trộn mặc định như loadConfig; sai thì vẫn trả về bản thô kèm lỗi.
function readForBoard(dir, root) {
  try {
    return { cfg: loadConfig(dir, { root }), errors: [] };
  } catch (e) {
    if (!(e instanceof ConfigError)) throw e;
    const raw = readJsonSafe(path.join(dir, 'config.json'));
    const def = readJsonSafe(path.join(root, 'rules', 'templates', 'config.default.json')) ?? {};
    const cfg = { ...def, ...(raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) };
    const errors = raw == null ? [e.message] : validateConfig(cfg);
    return { cfg, errors: errors.length ? errors : [e.message] };
  }
}

function tokenLabel(dir) {
  const s = readJsonSafe(path.join(dir, 'secrets.json'));
  if (!s || typeof s.token !== 'string' || !s.token) return null;
  return typeof s.label === 'string' ? s.label : '';
}

export function init(dir, root = PLUGIN_ROOT) {
  fs.mkdirSync(dir, { recursive: true });
  const made = [];
  const cfgFile = path.join(dir, 'config.json');
  if (!fs.existsSync(cfgFile)) { fs.writeFileSync(cfgFile, JSON.stringify(SKELETON, null, 2) + '\n'); made.push('config.json'); }
  for (const [name, tpl] of [['persona.md', 'persona.example.md'], ['content-types.md', 'content-types.example.md']]) {
    const f = path.join(dir, name);
    if (!fs.existsSync(f)) { fs.copyFileSync(path.join(root, 'rules', 'templates', tpl), f); made.push(name); }
  }
  return made;
}

export function backup(dir, now = new Date()) {
  const base = path.join(dir, 'history');
  let target = path.join(base, stamp(now));
  for (let i = 1; fs.existsSync(target); i++) target = path.join(base, `${stamp(now)}-${i}`);
  fs.mkdirSync(target, { recursive: true });
  const copied = [];
  for (const f of FILES) {
    const src = path.join(dir, f);
    if (fs.existsSync(src)) { fs.copyFileSync(src, path.join(target, f)); copied.push(f); }
  }
  fs.writeFileSync(path.join(target, 'manifest.json'), JSON.stringify({ files: copied }));
  return { dir: target, files: copied };
}

export function changelog(dir) {
  const snap = newestHistory(dir);
  if (!snap) return null;
  return diffProfile(profileOf(snap.dir), profile(dir));
}

export function undo(dir) {
  const snap = newestHistory(dir);
  if (!snap) return null;
  const before = profile(dir);
  const manifest = readJsonSafe(path.join(snap.dir, 'manifest.json'));
  for (const f of FILES) {
    const src = path.join(snap.dir, f);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(dir, f));
    else if (Array.isArray(manifest?.files)) fs.rmSync(path.join(dir, f), { force: true });
  }
  const lines = diffProfile(before, profile(dir));
  fs.rmSync(snap.dir, { recursive: true, force: true });
  return lines;
}

export async function renderBoard(dir, { now = new Date(), root = PLUGIN_ROOT, fetchImpl = fetch } = {}) {
  const { cfg, errors } = readForBoard(dir, root);
  const snap = newestHistory(dir);
  const lastChange = snap
    ? { at: unstamp(snap.name) ?? now, lines: diffProfile(profileOf(snap.dir), profile(dir)) }
    : null;
  const sheet = await fetchSheet(cfg.library?.pendingCsvUrl, fetchImpl);
  const html = renderConfigBoard({
    cfg, persona: readText(path.join(dir, 'persona.md')), contentTypes: readText(path.join(dir, 'content-types.md')),
    pending: sheet.rows, pendingError: sheet.error, hasPendingUrl: !!cfg.library?.pendingCsvUrl, today: now, lastChange, tokenLabel: tokenLabel(dir), errors,
  });
  const out = path.join(dir, 'board', 'index.html');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
  return out;
}

export function today(dir, { now = new Date(), root = PLUGIN_ROOT } = {}) {
  const cfg = loadConfig(dir, { root });
  const p2 = (n) => String(n).padStart(2, '0');
  return {
    date: `${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())}`,
    slots: cfg.schedule.map((hhmm) => ({
      hhmm,
      targets: targetsForSlot(cfg, now, hhmm).map((t) => ({ id: t.id, kind: t.kind, name: t.name })),
    })),
  };
}

export async function main(argv, { dir = profileDir(), now = new Date(), root = PLUGIN_ROOT, out = (s) => console.log(s), fetchImpl = fetch } = {}) {
  const cmd = argv[0];
  try {
    if (cmd === 'init') {
      const made = init(dir, root);
      out(made.length ? `Đã tạo: ${made.join(', ')}` : 'Hồ sơ đã có, không ghi đè');
    } else if (cmd === 'backup') {
      const b = backup(dir, now);
      out(`Đã sao lưu ${b.files.length} file vào ${b.dir}`);
    } else if (cmd === 'undo') {
      const lines = undo(dir);
      if (lines == null) { out(NO_HISTORY); return 1; }
      out('Đã hoàn tác.');
      lines.forEach((l) => out(l));
    } else if (cmd === 'changelog') {
      const lines = changelog(dir);
      if (lines == null) out(NO_HISTORY);
      else if (!lines.length) out('Không có thay đổi');
      else lines.forEach((l) => out(l));
    } else if (cmd === 'render-board') {
      out(await renderBoard(dir, { now, root, fetchImpl }));
    } else if (cmd === 'today') {
      out(JSON.stringify(today(dir, { now, root }), null, 2));
    } else {
      out('Dùng: config-cli.mjs init | backup | undo | changelog | render-board | today');
      return 1;
    }
    return 0;
  } catch (e) {
    out(`Lỗi: ${e.message}`);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
