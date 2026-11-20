// Đọc hồ sơ ~/.homematch-marketing (config, persona, kiểu bài, history, nhãn token) cho trang chủ và config-cli.
import fs from 'node:fs';
import path from 'node:path';
import { diffProfile } from './config-diff.mjs';

export const readText = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return null; } };
export const readJsonSafe = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };

export function unstamp(name) {
  const d = new Date(name.replace(/^(\d{4}-\d{2}-\d{2}T\d{2})-(\d{2})-(\d{2})/, '$1:$2:$3'));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function readProfile(dir) {
  return { cfg: readJsonSafe(path.join(dir, 'config.json')) ?? {}, persona: readText(path.join(dir, 'persona.md')), contentTypes: readText(path.join(dir, 'content-types.md')) };
}

export function newestHistory(dir) {
  const h = path.join(dir, 'history');
  let names = [];
  try { names = fs.readdirSync(h, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name); } catch { /* none */ }
  names.sort();
  const name = names[names.length - 1];
  return name ? { name, dir: path.join(h, name) } : null;
}

export function lastChange(dir, now = new Date()) {
  const snap = newestHistory(dir);
  return snap ? { at: unstamp(snap.name) ?? now, lines: diffProfile(readProfile(snap.dir), readProfile(dir)) } : null;
}

// Chỉ trả nhãn (hoặc '' / null); không bao giờ trả token.
export function tokenLabel(dir) {
  const s = readJsonSafe(path.join(dir, 'secrets.json'));
  if (!s || typeof s.token !== 'string' || !s.token) return null;
  return typeof s.label === 'string' ? s.label : '';
}
