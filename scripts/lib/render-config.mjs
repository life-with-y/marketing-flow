// Các phần cấu hình của trang chủ: tab Hằng ngày, tab Hồ sơ và cột phải (Lần sửa gần nhất, Báo lỗi).
import { esc, PAGE_MASKED_WARNING } from './render-posts.mjs';
import { targetsForSlot } from './targets.mjs';
import { validateConfig } from './config.mjs';
import { inCluster, segmentRule } from './clusters.mjs';

const DOW = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DAY_LABEL = { mon: 'T2', tue: 'T3', wed: 'T4', thu: 'T5', fri: 'T6', sat: 'T7', sun: 'CN' };
const ALL_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const KIND_LABEL = { wall: 'Tường', page: 'Page', threads: 'Threads' };
const SWITCH_KINDS = [['page', 'Page'], ['wall', 'Tường'], ['threads', 'Threads'], ['group', 'Nhóm']];

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
    if (groups.length) rows.push(`<li><span>${groups.length} cụm nhóm</span><span>${esc(accs.join(', '))}</span></li>`);
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

const fmtK = (n) => (Number.isInteger(n) ? (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n)) : '');
const SHOW_GROUPS = 5;

function groupRow(c, g) {
  const ok = isHttp(g.url);
  const name = esc(g.name || g.url);
  return `<li class="jg"><label><input type="checkbox" data-cluster="${esc(c.name)}" data-name="${esc(g.name || g.url)}"${g.joined === true ? ' checked' : ''}> <span class="jg-n">${name}</span></label><span class="jg-m">${esc(fmtK(g.members))}</span><span class="jg-m">${esc(g.interactions ?? '')}</span>${ok ? `<a href="${esc(g.url)}" target="_blank" rel="noopener noreferrer" aria-label="Mở nhóm">↗</a>` : '<span></span>'}</li>`;
}

// Tab Cụm nhóm: mỗi cụm một thẻ (quận × phân khúc), số tin đang khớp, nhóm nên vào xếp theo tương tác.
function clustersHtml(cfg, listings) {
  const cs = arr(cfg.clusters).filter((c) => c && typeof c === 'object');
  const ls = Array.isArray(listings) ? listings.filter((l) => arr(l?.images).length >= 3) : null;
  const cards = [...cs.filter((c) => c.active !== false), ...cs.filter((c) => c.active === false)].map((c) => {
    const active = c.active !== false;
    const n = ls ? ls.filter((l) => inCluster(l, c)).length : null;
    const groups = arr(c.groups).filter((g) => g && typeof g === 'object');
    const joined = groups.filter((g) => g.joined === true).length;
    const count = n == null ? '' : `<span class="cnt${n ? '' : ' zero'}">${n} tin khớp</span>`;
    const meta = `${esc(arr(c.slots ?? cfg.schedule).join(' · '))} · ${esc(accLabel(cfg, c.account))} · ${joined}/${groups.length} nhóm đã vào <span class="state${active ? ' on' : ''}">${active ? 'bật' : 'tạm ngừng'}</span>`;
    const head = `<li class="jg jg-h"><span>Nhóm</span><span class="jg-m">Thành viên</span><span class="jg-m">Tương tác</span><span></span></li>`;
    const top = groups.slice(0, SHOW_GROUPS).map((g) => groupRow(c, g)).join('');
    const rest = groups.slice(SHOW_GROUPS);
    const more = rest.length ? `<details class="more-g"><summary>+ ${rest.length} nhóm khác</summary><ul class="jgl">${rest.map((g) => groupRow(c, g)).join('')}</ul></details>` : '';
    const kw = arr(c.keywords).length ? arr(c.keywords).map((k) => `“${esc(k)}”`).join(', ') : '<span class="mute">—</span>';
    return `<details class="grp clu${active ? '' : ' off'}"${active ? ' open' : ''}><summary><span class="grp-name">${esc(c.name)} ${count}</span><span class="grp-meta">${meta}</span></summary>
<div class="grp-body"><dl class="kv"><dt>Quận</dt><dd>${arr(c.districts).length ? esc(arr(c.districts).join(', ')) : 'toàn Hà Nội'}</dd><dt>Tin</dt><dd>${esc(segmentRule(c.segment ?? 'room'))}</dd><dt>Ngày</dt><dd>${esc(daysText(c.days ?? ALL_DAYS))}</dd><dt>Tìm thêm</dt><dd>${kw}</dd><dt>Ghi chú</dt><dd>${dash(c.note)}</dd></dl>
${groups.length ? `<ul class="jgl">${head}${top}</ul>${more}` : '<p class="hint">Chưa có nhóm.</p>'}</div></details>`;
  });
  const on = cs.filter((c) => c.active !== false).length;
  return {
    html: cards.join('\n') || '<p class="hint">Chưa có cụm nhóm.</p>',
    counts: `${on} bật · ${cs.length - on} tạm ngừng`,
  };
}

function perSlotHtml(cfg) {
  const ps = cfg.perSlot && typeof cfg.perSlot === 'object' ? Object.entries(cfg.perSlot) : [];
  if (!ps.length) return '<p class="hint">Chưa đặt bài ngoài nhóm.</p>';
  return `<dl class="kv">${ps.map(([id, n]) => `<dt>${esc(accLabel(cfg, id))}</dt><dd>${esc(n)} · mỗi khung</dd>`).join('')}</dl>`;
}

const PENDING_COLS = ['Mục', 'Trạng thái', 'Mặc định tạm'];
function pendingText(p) {
  if (p && typeof p === 'object') {
    const pick = PENDING_COLS.map((c) => String(p[c] ?? '').trim()).filter(Boolean);
    if (pick.length) return pick.join(' · ');
    return Object.values(p).map((v) => String(v ?? '').trim()).filter(Boolean).join(' · ');
  }
  return String(p ?? '');
}

function pendingHtml(pending, error) {
  const items = arr(pending).filter((p) => pendingText(p));
  if (!items.length && !error) return '';
  const head = items.length ? `<b>${items.length} mục đang chờ quy định</b>` : '<b>Mục đang chờ quy định</b>';
  return `    <details class="pend">
      <summary>${head}</summary>
      ${error ? `<p class="mute it">Không đọc được tab Cần tìm hiểu: ${esc(error)}</p>` : ''}${items.map((p) => `<p>${esc(pendingText(p))}</p>`).join('')}
    </details>`;
}

function profileHtml(cfg, persona, tokenLabel) {
  const accs = arr(cfg.accounts).filter(Boolean);
  const byType = (t) => accs.filter((a) => a.type === t).map((a) => esc(a.label || a.id)).join(' · ') || '<span class="mute">—</span>';
  const token = tokenLabel == null ? 'chưa cài' : `đã cài${tokenLabel ? ' · ' + esc(tokenLabel) : ''}`;
  const sched = arr(cfg.schedule).join(' · ');
  const mix = cfg.channelMix && typeof cfg.channelMix === 'object'
    ? Object.entries(cfg.channelMix).map(([k, v]) => `${esc(k)} ${esc(v?.listing)}/${esc(v?.brand)}`).join(' · ') : '';
  const links = SWITCH_KINDS.map(([k, l]) => `${l} ${cfg.links?.[k] === true ? 'bật' : 'tắt'}`).join(' · ');
  const prices = SWITCH_KINDS.map(([k, l]) => `${l} ${cfg.priceStyle?.[k] === 'masked' ? 'ẩn giá (4xxx)' : 'đầy đủ'}`).join(' · ');
  const pageWarn = cfg.priceStyle?.page === 'masked' ? ` <span class="warn">${esc(PAGE_MASKED_WARNING)}</span>` : '';
  const contact = (v) => (arr(v).length ? arr(v).map((c, i) => `${i + 1}. ${esc(typeof c === 'string' ? c : JSON.stringify(c))}`).join(' · ') : '<span class="mute">—</span>');
  return `    <details class="sec" open>
      <summary>Persona <small>FB cá nhân, Threads, nhóm</small></summary>
      <div class="body">${personaHtml(persona)}
        <p class="hint">Page luôn dùng giọng thương hiệu HomeMatch.</p>
      </div>
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
        <dt>Thư mục lưu</dt><dd>${dash(cfg.outputDir)}</dd>
        <dt>Link homematch.vn</dt><dd>${esc(links)}</dd>
        <dt>Giá</dt><dd>${esc(prices)}${pageWarn}</dd>
        <dt>Quét nhóm</dt><dd>${cfg.leadScan?.enabled ? 'bật' : 'tắt'}</dd>
        <dt>Token</dt><dd>${token} <span class="mute it">— đổi qua /hm-setup</span></dd>
      </dl></div>
    </details>`;
}

function whenOf(at) {
  const d = at instanceof Date ? at : new Date(at);
  return Number.isNaN(d.getTime()) ? '' : hhmmOf(d);
}

// Giá trị cho các chỗ {{…}} phần cấu hình trong assets/home/template.html.
export function boardParts({ cfg, listings = null, persona = null, pending = [], pendingError = null, today = new Date(), lastChange = null, tokenLabel = null, errors } = {}) {
  cfg = cfg && typeof cfg === 'object' ? cfg : {};
  const errs = errors ?? validateConfig(cfg);
  const slots = slotsHtml(cfg, today, errs);
  const clusters = clustersHtml(cfg, listings);
  const when = lastChange ? whenOf(lastChange.at) : '';
  const lastHtml = lastChange
    ? `  <details class="box">
    <summary>Lần sửa gần nhất${when ? ' · ' + esc(when) : ''}</summary>
    <ul class="log">${arr(lastChange.lines).map((l) => `<li>${esc(l)}</li>`).join('') || '<li class="mute">Không có thay đổi</li>'}</ul>
    <button type="button" class="btn ghost edit-only" onclick="undo()">Hoàn tác lần sửa này</button>
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
  return {
    HEADER_META: esc(`${dateText}${when ? ' · sửa lần cuối ' + when : ''}`),
    ERRORS: errorsHtml,
    TODAY_COUNT: `${slots.total} bài`,
    SLOTS: slots.html,
    CLUSTER_COUNTS: esc(clusters.counts),
    CLUSTERS: clusters.html,
    PERSLOT: perSlotHtml(cfg),
    PENDING: pendingHtml(pending, pendingError),
    PROFILE: profileHtml(cfg, persona, tokenLabel),
    LAST_CHANGE: lastHtml,
    FEEDBACK: feedback,
    UNDO_LABEL_JSON: jsonForScript(when),
  };
}
