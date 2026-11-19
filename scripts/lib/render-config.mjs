// Dựng trang cấu hình tĩnh từ assets/config-board/template.html (Task 11).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { esc } from './render-posts.mjs';
import { targetsForSlot } from './targets.mjs';
import { validateConfig } from './config.mjs';

const TEMPLATE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'config-board', 'template.html');
const DOW = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DAY_LABEL = { mon: 'T2', tue: 'T3', wed: 'T4', thu: 'T5', fri: 'T6', sat: 'T7', sun: 'CN' };
const ALL_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const LANG = { vi: 'tiếng Việt', en: 'tiếng Anh' };
const TYPE_LABEL = { 'fb-personal': 'FB cá nhân', 'fb-page': 'FB Page', threads: 'Threads' };
const KIND_LABEL = { wall: 'Tường', page: 'Page', threads: 'Threads' };

const p2 = (n) => String(n).padStart(2, '0');
const arr = (v) => (Array.isArray(v) ? v : []);
const isHttp = (u) => /^https?:\/\//i.test(String(u ?? ''));
const hhmmOf = (d) => `${p2(d.getHours())}:${p2(d.getMinutes())}`;
const jsonForScript = (v) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const dash = (v) => (v == null || v === '' ? '<span class="mute">—</span>' : esc(v));

function daysText(d) {
  const a = arr(d);
  if (a.length === 7) return 'mọi ngày';
  return a.length ? ALL_DAYS.filter((x) => a.includes(x)).map((x) => DAY_LABEL[x]).join(', ') : '—';
}

function accLabel(cfg, id) {
  return arr(cfg.accounts).find((a) => a && a.id === id)?.label || id || '';
}

function parseSections(md) {
  const out = [];
  let cur = null;
  for (const line of String(md ?? '').split('\n')) {
    const m = /^##\s+(.*)$/.exec(line);
    if (m) { cur = { title: m[1].trim(), lines: [] }; out.push(cur); } else if (cur) cur.lines.push(line);
  }
  return out;
}
const bullets = (lines) => lines.map((l) => /^\s*[-*]\s+(.*)$/.exec(l)?.[1]).filter(Boolean);
const paras = (lines) => lines.join('\n').split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);

function personaHtml(persona) {
  if (persona == null) return '<p class="hint">Chưa có persona, chạy <code>config-cli init</code> hoặc /hm-setup.</p>';
  const secs = parseSections(persona);
  const find = (re) => secs.find((s) => re.test(s.title));
  const who = find(/tôi là ai/i), voice = find(/giọng/i), yes = find(/^nên$/i), no = find(/không nên/i);
  if (!who && !voice && !yes && !no) return `<blockquote style="white-space:pre-wrap">${esc(persona.trim())}</blockquote>`;
  const quote = [...(who ? paras(who.lines) : []), ...(voice ? paras(voice.lines) : [])];
  const li = (s) => bullets(s?.lines || []).map((b) => `<li>${esc(b)}</li>`).join('');
  return `${quote.map((q) => `<blockquote>${esc(q)}</blockquote>`).join('')}
        <div class="cols">
          <div><span class="sc" style="font-weight:600;font-size:14px">Nên</span><ul>${li(yes)}</ul></div>
          <div><span class="sc" style="font-weight:600;font-size:14px">Không nên</span><ul>${li(no)}</ul></div>
        </div>`;
}

function contentTypes(md) {
  return parseSections(md)
    .map((s) => {
      const title = s.title.replace(/^\d+\.\s*/, '');
      const field = (name) => new RegExp(`^\\s*-\\s+\\*\\*${name}\\*\\*:\\s*(.*)$`, 'i');
      const get = (name) => s.lines.map((l) => field(name).exec(l)?.[1]).find(Boolean) || '';
      return { title, channels: get('Kênh'), count: get('Số tin mỗi bài') };
    })
    .filter((t) => t.channels || t.count);
}

function contentTypesHtml(md) {
  if (md == null) return { n: 0, html: '<p class="hint">Chưa có kiểu bài, chạy <code>config-cli init</code> hoặc /hm-setup.</p>' };
  const cts = contentTypes(md);
  if (!cts.length) return { n: 0, html: `<blockquote style="white-space:pre-wrap">${esc(md.trim())}</blockquote>` };
  return {
    n: cts.length,
    html: cts.map((t) => `<div class="ct"><div class="ct-head"><b>${esc(t.title)}</b><span class="mute it" style="font-size:14px">${esc([t.count && `${t.count} tin`, t.channels].filter(Boolean).join(' · '))}</span></div></div>`).join('\n        '),
  };
}

function slotsHtml(cfg, today, errors) {
  const schedule = arr(cfg.schedule);
  let total = 0;
  const boxes = schedule.map((hhmm) => {
    let ts = [];
    try { ts = errors.length ? [] : targetsForSlot(cfg, today, hhmm); } catch { ts = []; }
    total += ts.length;
    const groups = ts.filter((t) => t.kind === 'group');
    const accs = [...new Set(groups.map((t) => accLabel(cfg, t.account)))];
    const rows = [];
    if (groups.length) rows.push(`<li><span>${groups.length} nhóm</span><span>${esc(accs.join(', '))}</span></li>`);
    const others = new Map();
    for (const t of ts.filter((x) => x.kind !== 'group')) {
      const k = `${KIND_LABEL[t.kind] || t.kind}${t.kind === 'wall' ? ' ' + t.name : t.kind === 'page' ? ' ' + t.name : ''}`;
      others.set(k, (others.get(k) || 0) + 1);
    }
    for (const [k, v] of others) rows.push(`<li><span>${esc(k)}</span><span>${v}</span></li>`);
    return `<div class="slot"><div class="slot-h"><b>${esc(hhmm)}</b><span class="mute it">${ts.length} bài</span></div><ul>${rows.join('') || '<li><span class="mute it">không có bài</span><span></span></li>'}</ul></div>`;
  });
  return { total, html: boxes.join('\n') || '<p class="hint">Chưa có giờ chạy.</p>' };
}

function groupsHtml(cfg, today) {
  const gs = arr(cfg.groups).filter((g) => g && typeof g === 'object');
  const dayKey = DAY_KEYS[today.getDay()];
  let off = 0, hidden = 0;
  const html = gs.map((g) => {
    const active = g.active !== false;
    if (!active) off++;
    const isToday = active && arr(g.days ?? ALL_DAYS).includes(dayKey);
    if (!isToday) hidden++;
    const slots = arr(g.slots ?? cfg.schedule);
    const lg = g.language && g.language !== 'vi' ? ` · ${g.language}` : '';
    const meta = `${esc(slots.join(' · '))} · ${esc(accLabel(cfg, g.account))}${esc(lg)} <span class="state${active ? ' on' : ''}">${active ? 'bật' : 'tạm ngừng'}</span>`;
    return `<details class="grp${active ? '' : ' off'}" data-today="${isToday ? 1 : 0}"><summary><span class="grp-name">${esc(g.name)}</span><span class="grp-meta">${meta}</span></summary>
<div class="grp-body"><dl class="kv"><dt>Quận</dt><dd>${arr(g.districts).length ? esc(arr(g.districts).join(', ')) : 'toàn Hà Nội'}</dd><dt>Ngày</dt><dd>${esc(daysText(g.days ?? ALL_DAYS))}</dd><dt>Ngôn ngữ</dt><dd>${esc(LANG[g.language ?? 'vi'] || g.language)}</dd><dt>Ghi chú</dt><dd>${dash(g.note)}</dd></dl></div></details>`;
  }).join('\n');
  return {
    html,
    counts: `${gs.length - off} bật · ${off} tạm ngừng`,
    more: hidden ? `… và ${hidden} nhóm khác` : '',
  };
}

function perSlotHtml(cfg) {
  const ps = cfg.perSlot && typeof cfg.perSlot === 'object' ? Object.entries(cfg.perSlot) : [];
  if (!ps.length) return '<p class="hint">Chưa đặt bài ngoài nhóm.</p>';
  return `<dl class="kv">${ps.map(([id, n]) => `<dt>${esc(accLabel(cfg, id))}</dt><dd>${esc(n)} · mỗi khung</dd>`).join('')}</dl>`;
}

function pendingHtml(pending) {
  const items = arr(pending);
  if (!items.length) return '';
  const text = (p) => (p && typeof p === 'object' ? Object.values(p).map((v) => String(v ?? '').trim()).filter(Boolean).join(' · ') : String(p ?? ''));
  return `    <details class="pend">
      <summary><b>${items.length} mục đang chờ quy định</b></summary>
      ${items.map((p) => `<p>${esc(text(p))}</p>`).join('')}
    </details>`;
}

function profileHtml(cfg, persona, contentTypesMd, tokenLabel) {
  const ct = contentTypesHtml(contentTypesMd);
  const accs = arr(cfg.accounts).filter(Boolean);
  const byType = (t) => accs.filter((a) => a.type === t).map((a) => esc(a.label || a.id)).join(' · ') || '<span class="mute">—</span>';
  const token = tokenLabel == null ? 'chưa cài' : `đã cài${tokenLabel ? ' · ' + esc(tokenLabel) : ''}`;
  const sched = arr(cfg.schedule).join(' · ');
  const mix = cfg.channelMix && typeof cfg.channelMix === 'object'
    ? Object.entries(cfg.channelMix).map(([k, v]) => `${esc(k)} ${esc(v?.listing)}/${esc(v?.brand)}`).join(' · ') : '';
  const contact = (v) => (arr(v).length ? arr(v).map((c, i) => `${i + 1}. ${esc(typeof c === 'string' ? c : JSON.stringify(c))}`).join(' · ') : '<span class="mute">—</span>');
  return `    <details class="sec" open>
      <summary>Persona <small>FB cá nhân, Threads, nhóm</small></summary>
      <div class="body">${personaHtml(persona)}
        <p class="hint">Page luôn dùng giọng thương hiệu HomeMatch.</p>
      </div>
    </details>

    <details class="sec">
      <summary>Kiểu bài <small>${ct.n} kiểu</small></summary>
      <div class="body">${ct.html}</div>
    </details>

    <details class="sec">
      <summary>Tài khoản &amp; liên hệ <small>${accs.length} tài khoản</small></summary>
      <div class="body"><dl class="kv">
        <dt>FB cá nhân</dt><dd>${byType('fb-personal')}</dd>
        <dt>FB Page</dt><dd>${byType('fb-page')}</dd>
        <dt>Threads</dt><dd>${byType('threads')}</dd>
        <dt>Liên hệ</dt><dd>${contact(cfg.contact)}</dd>
        <dt>Liên hệ Page</dt><dd>${contact(cfg.pageContact)}</dd>
      </dl></div>
    </details>

    <details class="sec">
      <summary>Lịch &amp; cài đặt <small>${esc(sched)}</small></summary>
      <div class="body"><dl class="kv">
        <dt>Giờ chạy</dt><dd>${esc(sched) || '—'} <span class="mute it">— bỏ lỡ thì bỏ qua</span></dd>
        <dt>Tỉ lệ</dt><dd>${mix || '<span class="mute">—</span>'}</dd>
        <dt>Model</dt><dd>${dash(cfg.model)}</dd>
        <dt>Thư mục lưu</dt><dd>${dash(cfg.outputDir)}</dd>
        <dt>Quét nhóm</dt><dd>${cfg.leadScan?.enabled ? 'bật' : 'tắt'}</dd>
        <dt>Token</dt><dd>${token} <span class="mute it">— đổi qua /hm-setup</span></dd>
      </dl></div>
    </details>`;
}

function whenOf(at) {
  const d = at instanceof Date ? at : new Date(at);
  return Number.isNaN(d.getTime()) ? '' : hhmmOf(d);
}

export function renderConfigBoard({ cfg, persona = null, contentTypes: ctMd = null, pending = [], today = new Date(), lastChange = null, tokenLabel = null, errors } = {}) {
  cfg = cfg && typeof cfg === 'object' ? cfg : {};
  const errs = errors ?? validateConfig(cfg);
  const slots = slotsHtml(cfg, today, errs);
  const groups = groupsHtml(cfg, today);
  const when = lastChange ? whenOf(lastChange.at) : '';
  const lastHtml = lastChange
    ? `  <details class="box">
    <summary>Lần sửa gần nhất${when ? ' · ' + esc(when) : ''}</summary>
    <ul class="log">${arr(lastChange.lines).map((l) => `<li>${esc(l)}</li>`).join('') || '<li class="mute">Không có thay đổi</li>'}</ul>
    <button type="button" class="btn ghost" onclick="undo()">Hoàn tác lần sửa này</button>
  </details>`
    : '  <div class="box"><h3>Lần sửa gần nhất</h3><p class="note" style="margin:0">Chưa có lần sửa nào</p></div>';
  const formUrl = cfg.feedback?.formUrl;
  const feedback = isHttp(formUrl)
    ? `<a class="btn ghost" style="display:block;text-align:center;text-decoration:none" href="${esc(formUrl)}" target="_blank" rel="noopener">Báo lỗi / góp ý plugin</a>`
    : '<button type="button" class="btn ghost" disabled>Báo lỗi / góp ý plugin</button>';
  const dateText = `${DOW[today.getDay()]} ${p2(today.getDate())}/${p2(today.getMonth() + 1)}/${today.getFullYear()}`;
  const errorsHtml = errs.length
    ? `  <div class="pend" style="border-color:#b3261e;color:#b3261e;margin:0 0 22px"><b>Cấu hình đang sai, sửa bằng ô bên phải:</b><ul>${errs.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>\n`
    : '';
  const values = {
    HEADER_META: esc(`${dateText}${when ? ' · sửa lần cuối ' + when : ''}`),
    ERRORS: errorsHtml,
    TODAY_COUNT: `${slots.total} bài`,
    SLOTS: slots.html,
    GROUP_COUNTS: esc(groups.counts),
    GROUPS: groups.html,
    MORE: esc(groups.more),
    PERSLOT: perSlotHtml(cfg),
    PENDING: pendingHtml(pending),
    PROFILE: profileHtml(cfg, persona, ctMd, tokenLabel),
    LAST_CHANGE: lastHtml,
    FEEDBACK: feedback,
    UNDO_LABEL_JSON: jsonForScript(when),
  };
  return fs.readFileSync(TEMPLATE, 'utf8').replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => (k in values ? values[k] : m));
}
