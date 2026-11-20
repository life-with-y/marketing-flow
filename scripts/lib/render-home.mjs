// Trang chủ <outputDir>/index.html: 4 tab Bài đăng · Kiểu bài · Hằng ngày · Hồ sơ, cột phải "Muốn đổi gì?".
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { esc, slotSection, slotLabel } from './render-posts.mjs';
import { boardParts } from './render-config.mjs';
import { parseContentTypes } from './content-types.mjs';
import { modeView } from './home-mode.mjs';
import { readText, lastChange as readLastChange, tokenLabel as readTokenLabel } from './profile.mjs';
import { expandHome } from './paths.mjs';
import { platformGuidePaths } from './platforms.mjs';

const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TEMPLATE = path.join(PLUGIN_ROOT, 'assets', 'home', 'template.html');
export const MAX_SLOTS = 14;
const SLOT_RE = /^\d{4}-\d{2}-\d{2}_\d{4}$/;
const CHANNEL = { wall: 'Tường cá nhân', page: 'Page', threads: 'Threads', group: 'Nhóm' };
const ADD_TYPE = 'Thêm kiểu bài mới: tên …, kênh …, số tin …, cấu trúc …';

const arr = (v) => (Array.isArray(v) ? v : []);
const dash = (v) => (v == null || v === '' ? '<span class="mute">—</span>' : esc(v));

// Dữ liệu khung dùng được: object có mảng posts. Bài hỏng trong mảng vẫn giữ, thẻ bài tự báo lỗi.
function usableSlot(data) {
  return data && typeof data === 'object' && !Array.isArray(data) && Array.isArray(data.posts);
}

// Đọc <outputDir>/<slot>/page-data.json, mới nhất trước, tối đa 14 khung.
// File hỏng hoặc sai cấu trúc vào `bad` (trang ghi "Không đọc được khung …"); thư mục chưa có file thì bỏ qua.
export function loadSlots(outputDir, limit = MAX_SLOTS) {
  let names = [];
  try { names = fs.readdirSync(outputDir, { withFileTypes: true }).filter((e) => e.isDirectory() && SLOT_RE.test(e.name)).map((e) => e.name); } catch { return { slots: [], bad: [] }; }
  names.sort().reverse();
  const slots = [], bad = [];
  for (const name of names) {
    if (slots.length + bad.length >= limit) break;
    let text;
    try { text = fs.readFileSync(path.join(outputDir, name, 'page-data.json'), 'utf8'); } catch { continue; }
    let data;
    try { data = JSON.parse(text); } catch { data = null; }
    if (usableSlot(data)) slots.push({ ...data, slot: name }); else bad.push(name);
  }
  return { slots, bad };
}

function postsPanel(slots, badSlots, outputDir, feedback) {
  const bad = arr(badSlots).map(String);
  const sections = [];
  for (const s of arr(slots).filter((x) => x && SLOT_RE.test(String(x.slot)))
    .sort((a, b) => (a.slot < b.slot ? 1 : a.slot > b.slot ? -1 : 0))) {
    if (sections.length >= MAX_SLOTS) break;
    if (!usableSlot(s)) { bad.push(s.slot); continue; }
    try {
      sections.push({ slot: s.slot, n: s.posts.length, html: slotSection(s, { outputDir, feedback, hidden: sections.length > 0 }) });
    } catch { bad.push(s.slot); }
  }
  const notes = [...new Set(bad)].sort().reverse().map((b) => `<p class="hint bad-slot">Không đọc được khung ${esc(b)}</p>`).join('\n');
  if (!sections.length) return { n: 0, html: `<p class="hint">Chưa có bài nào. Bài sẽ hiện ở đây sau khung soạn đầu tiên.</p>${notes}` };
  const list = sections;
  const opts = list.map((s, i) => `<option value="${esc(s.slot)}"${i === 0 ? ' selected' : ''}>${esc(slotLabel(s.slot))}</option>`).join('');
  const bar = `<div class="slotbar">
    <button type="button" class="slotnav" id="slot-older" aria-label="Khung trước">‹</button>
    <select id="slot-sel" aria-label="Chọn khung giờ">${opts}</select>
    <button type="button" class="slotnav" id="slot-newer" aria-label="Khung sau">›</button>
  </div>`;
  return { n: list[0].n, html: `${bar}\n${notes}\n${list.map((x) => x.html).join('\n')}` };
}

function typesPanel(md) {
  const add = `<button type="button" class="btn ghost inline" data-seed="${esc(ADD_TYPE)}">+ Thêm kiểu bài</button>`;
  if (md == null) return { n: 0, html: `<p class="hint">Chưa có kiểu bài, chạy <code>config-cli init</code> hoặc /hm-setup.</p>${add}` };
  const types = parseContentTypes(md);
  if (!types.length) return { n: 0, html: `<blockquote style="white-space:pre-wrap">${esc(md.trim())}</blockquote>${add}` };
  const cards = types.map((t, i) => {
    const channels = t.channels.map((c) => CHANNEL[c] || c).join(' · ');
    const structure = t.structure.length ? `<ol>${t.structure.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>` : '<span class="mute">—</span>';
    const exs = arr(t.examples).length ? t.examples : (t.example ? [{ note: t.exampleNote, text: t.example }] : []);
    const example = exs.filter((x) => x.text).map((x) => `<div class="text" data-who="${esc(x.note ? `Ví dụ · ${x.note}` : 'Ví dụ')}">${esc(x.text)}</div>`).join('\n')
      || '<span class="mute">—</span>';
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

// Markdown đơn giản -> HTML: chỉ "# ", "## ", "- " và đoạn thường; mọi chữ đều escape.
function guideBody(md) {
  const out = [];
  let list = [];
  const flush = () => { if (list.length) out.push(`<ul>${list.join('')}</ul>`); list = []; };
  for (const raw of String(md).split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('- ')) { list.push(`<li>${esc(line.slice(2).trim())}</li>`); continue; }
    flush();
    if (!line) continue;
    if (line.startsWith('## ')) out.push(`<h4>${esc(line.slice(3).trim())}</h4>`);
    else if (line.startsWith('# ')) out.push(`<h3>${esc(line.slice(2).trim())}</h3>`);
    else out.push(`<p>${esc(line)}</p>`);
  }
  flush();
  return out.join('');
}

function guidesSection(guides) {
  const list = arr(guides).filter((g) => g && typeof g.md === 'string' && g.md.trim());
  if (!list.length) return '';
  const cards = list.map((g) => {
    const head = /^\s*# /.test(g.md) ? '' : `<h3>${esc(CHANNEL[g.kind] || g.kind)}</h3>`;
    return `<section class="pguide" data-kind="${esc(g.kind)}">${head}${guideBody(g.md)}</section>`;
  });
  return `\n    <details class="sec platforms">
      <summary>Hướng dẫn nền tảng <small>${list.length} nền tảng</small></summary>
      <div class="body">
        ${cards.join('\n        ')}
      </div>
    </details>`;
}

export function renderHome({
  cfg = {}, errors, persona = null, contentTypes = null, pending = [], pendingError = null,
  today = new Date(), lastChange = null, tokenLabel = null, outputDir, slots = [], badSlots = [], platformGuides = [],
} = {}) {
  const c = cfg && typeof cfg === 'object' ? cfg : {};
  const board = boardParts({ cfg: c, persona, pending, pendingError, today, lastChange, tokenLabel, errors });
  const posts = postsPanel(slots, badSlots, outputDir, c.feedback || {});
  const types = typesPanel(contentTypes);
  const values = {
    ...board,
    POSTS_COUNT: `${posts.n} bài`,
    POSTS_PANEL: posts.html,
    TYPES_COUNT: `${types.n} kiểu`,
    TYPES_PANEL: types.html + guidesSection(platformGuides),
    MODE_FN: `const modeView = ${modeView.toString()};`,
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
  const { slots, bad } = loadSlots(outputDir);
  const html = renderHome({
    cfg, errors, persona: readText(path.join(dir, 'persona.md')), contentTypes, pending, pendingError,
    today: now, lastChange: readLastChange(dir, now), tokenLabel: readTokenLabel(dir), outputDir, slots, badSlots: bad,
    platformGuides: Object.entries(platformGuidePaths(dir, root)).map(([kind, p]) => ({ kind, md: readText(p) })),
  });
  fs.mkdirSync(outputDir, { recursive: true });
  const file = path.join(outputDir, 'index.html');
  fs.writeFileSync(file, html, 'utf8');
  return file;
}
