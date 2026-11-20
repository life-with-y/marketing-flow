// Trang chủ <outputDir>/index.html: 4 tab Bài đăng · Kiểu bài · Hằng ngày · Hồ sơ, cột phải "Muốn đổi gì?".
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { esc, slotSection, slotLabel } from './render-posts.mjs';
import { boardParts } from './render-config.mjs';
import { parseContentTypes } from './content-types.mjs';
import { readText, lastChange as readLastChange, tokenLabel as readTokenLabel } from './profile.mjs';
import { expandHome } from './paths.mjs';

const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TEMPLATE = path.join(PLUGIN_ROOT, 'assets', 'home', 'template.html');
export const MAX_SLOTS = 14;
const SLOT_RE = /^\d{4}-\d{2}-\d{2}_\d{4}$/;
const CHANNEL = { wall: 'Tường cá nhân', page: 'Page', threads: 'Threads', group: 'Nhóm' };
const ADD_TYPE = 'Thêm kiểu bài mới: tên …, kênh …, số tin …, cấu trúc …';

const arr = (v) => (Array.isArray(v) ? v : []);
const dash = (v) => (v == null || v === '' ? '<span class="mute">—</span>' : esc(v));

// Đọc <outputDir>/<slot>/page-data.json, mới nhất trước, tối đa 14 khung. Bỏ qua file hỏng.
export function loadSlots(outputDir, limit = MAX_SLOTS) {
  let names = [];
  try { names = fs.readdirSync(outputDir, { withFileTypes: true }).filter((e) => e.isDirectory() && SLOT_RE.test(e.name)).map((e) => e.name); } catch { return []; }
  names.sort().reverse();
  const out = [];
  for (const name of names) {
    if (out.length >= limit) break;
    try {
      const data = JSON.parse(fs.readFileSync(path.join(outputDir, name, 'page-data.json'), 'utf8'));
      if (data && typeof data === 'object' && Array.isArray(data.posts)) out.push({ ...data, slot: name });
    } catch { /* chưa có hoặc hỏng */ }
  }
  return out;
}

function postsPanel(slots, outputDir, feedback) {
  const list = arr(slots).filter((s) => s && SLOT_RE.test(String(s.slot)))
    .sort((a, b) => (a.slot < b.slot ? 1 : a.slot > b.slot ? -1 : 0))
    .slice(0, MAX_SLOTS);
  if (!list.length) return { n: 0, html: '<p class="hint">Chưa có bài nào. Bài sẽ hiện ở đây sau khung soạn đầu tiên.</p>' };
  const opts = list.map((s, i) => `<option value="${esc(s.slot)}"${i === 0 ? ' selected' : ''}>${esc(slotLabel(s.slot))}</option>`).join('');
  const bar = `<div class="slotbar">
    <button type="button" class="slotnav" id="slot-older" aria-label="Khung trước">‹</button>
    <select id="slot-sel" aria-label="Chọn khung giờ">${opts}</select>
    <button type="button" class="slotnav" id="slot-newer" aria-label="Khung sau">›</button>
  </div>`;
  const sections = list.map((s, i) => slotSection(s, { outputDir, feedback, hidden: i > 0 })).join('\n');
  return { n: arr(list[0].posts).length, html: `${bar}\n${sections}` };
}

function typesPanel(md) {
  const add = `<button type="button" class="btn ghost inline" data-seed="${esc(ADD_TYPE)}">+ Thêm kiểu bài</button>`;
  if (md == null) return { n: 0, html: `<p class="hint">Chưa có kiểu bài, chạy <code>config-cli init</code> hoặc /hm-setup.</p>${add}` };
  const types = parseContentTypes(md);
  if (!types.length) return { n: 0, html: `<blockquote style="white-space:pre-wrap">${esc(md.trim())}</blockquote>${add}` };
  const cards = types.map((t, i) => {
    const channels = t.channels.map((c) => CHANNEL[c] || c).join(' · ');
    const structure = t.structure.length ? `<ol>${t.structure.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>` : '<span class="mute">—</span>';
    const example = t.example
      ? `<div class="text" data-who="${esc(t.exampleNote ? `Ví dụ · ${t.exampleNote}` : 'Ví dụ')}">${esc(t.example)}</div>`
      : '<span class="mute">—</span>';
    return `<details class="sec ctype"${i === 0 ? ' open' : ''}>
      <summary>${esc(t.name)} <small>${esc([t.listings && `${t.listings} tin`, channels].filter(Boolean).join(' · '))}</small></summary>
      <div class="body">
        <dl class="kv">
          <dt>Kênh</dt><dd>${dash(channels)}</dd>
          <dt>Số tin mỗi bài</dt><dd>${dash(t.listings)}</dd>
          <dt>Cách chọn tin</dt><dd>${dash(t.howToPick)}</dd>
          <dt>Cấu trúc</dt><dd>${structure}</dd>
          <dt>Ảnh</dt><dd>${dash(t.images)}</dd>
        </dl>
        <h4>Ví dụ</h4>
        ${example}
        <button type="button" class="btn ghost inline" data-seed="${esc(`Kiểu ${t.name}: `)}">Sửa kiểu này</button>
      </div>
    </details>`;
  });
  return { n: types.length, html: `${cards.join('\n    ')}\n    <p>${add}</p>` };
}

export function renderHome({
  cfg = {}, errors, persona = null, contentTypes = null, pending = [], pendingError = null,
  today = new Date(), lastChange = null, tokenLabel = null, outputDir, slots = [],
} = {}) {
  const c = cfg && typeof cfg === 'object' ? cfg : {};
  const board = boardParts({ cfg: c, persona, pending, pendingError, today, lastChange, tokenLabel, errors });
  const posts = postsPanel(slots, outputDir, c.feedback || {});
  const types = typesPanel(contentTypes);
  const values = {
    ...board,
    POSTS_COUNT: `${posts.n} bài`,
    POSTS_PANEL: posts.html,
    TYPES_COUNT: `${types.n} kiểu`,
    TYPES_PANEL: types.html,
  };
  return fs.readFileSync(TEMPLATE, 'utf8').replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => (k in values ? values[k] : m));
}

export function homeOutputDir(cfg, home) {
  const raw = typeof cfg?.outputDir === 'string' && cfg.outputDir.trim() ? cfg.outputDir.trim() : '~/HomeMatch-Posts';
  return path.resolve(expandHome(raw, home));
}

// Dựng lại <outputDir>/index.html từ hồ sơ + mọi <slot>/page-data.json. Không gọi mạng: pending do người gọi đưa vào.
export function writeHome({ dir, cfg, errors = [], home, now = new Date(), root = PLUGIN_ROOT, pending = [], pendingError = null } = {}) {
  const outputDir = homeOutputDir(cfg, home);
  const contentTypes = readText(path.join(dir, 'content-types.md')) ?? readText(path.join(root, 'rules', 'templates', 'content-types.example.md'));
  const html = renderHome({
    cfg, errors, persona: readText(path.join(dir, 'persona.md')), contentTypes, pending, pendingError,
    today: now, lastChange: readLastChange(dir, now), tokenLabel: readTokenLabel(dir), outputDir, slots: loadSlots(outputDir),
  });
  fs.mkdirSync(outputDir, { recursive: true });
  const file = path.join(outputDir, 'index.html');
  fs.writeFileSync(file, html, 'utf8');
  return file;
}
