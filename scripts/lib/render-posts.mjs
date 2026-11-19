// Dựng trang bài đăng tĩnh index.html từ assets/posts-page/template.html (Task 9).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TEMPLATE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'posts-page', 'template.html');
const LABELS = { NEW: 'Mới', PRICE_DOWN: 'Giảm giá', NOW_AVAILABLE: 'Vừa trống' };
const OPEN_TEXT = { group: 'Mở nhóm ↗', page: 'Mở Page ↗', threads: 'Mở Threads ↗' };
const KIND_TEXT = { group: 'nhóm', page: 'trang', threads: '' };
const DAYS = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const FEEDBACK_TEXT_MAX = 1500;

export const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const p2 = (n) => String(n).padStart(2, '0');
const isHttp = (u) => /^https?:\/\//i.test(String(u ?? ''));

function relUrl(fromDir, file) {
  return path.relative(fromDir, file).split(path.sep).map(encodeURIComponent).join('/');
}

function feedbackUrl(feedback, vals) {
  const url = feedback?.formUrl;
  if (!isHttp(url)) return '';
  const parts = [];
  for (const [field, entry] of Object.entries(feedback.fields || {})) {
    if (!entry || vals[field] == null) continue;
    parts.push(`${encodeURIComponent(entry)}=${encodeURIComponent(vals[field])}`);
  }
  parts.push('usp=pp_url');
  return url + (url.includes('?') ? '&' : '?') + parts.join('&');
}

function slotParts(slot) {
  const m = /^(\d{4})-(\d{2})-(\d{2})_(\d{2})(\d{2})$/.exec(slot || '');
  if (!m) return { hhmm: String(slot ?? ''), date: '', dow: '' };
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return { hhmm: `${m[4]}:${m[5]}`, date: `${m[3]}/${m[2]}`, dow: DAYS[d.getDay()] };
}

function pendingText(p) {
  if (p && typeof p === 'object') return Object.values(p).map((v) => String(v ?? '').trim()).filter(Boolean).join(' · ');
  return String(p ?? '');
}

function renderVariant(post, v, i, ctx) {
  const { slot, outDir, feedback, who, target, person } = ctx;
  const codes = post.postCodes || [];
  const files = v.files.map((f) => ({ name: f, src: relUrl(outDir, path.join(v.dir, f)) }));
  const fb = feedbackUrl(feedback, {
    person: person ?? who,
    slot,
    post: post.n,
    variant: v.key,
    codes: codes.join(','),
    text: [...String(v.text ?? '')].slice(0, FEEDBACK_TEXT_MAX).join(''),
  });
  const photos = files.map((f, k) => (
    `<button type="button" class="ph${k === 0 ? ' cover' : ''}" data-src="${esc(f.src)}" data-name="${esc(f.name)}"><img src="${esc(f.src)}" alt="" loading="lazy"></button>`
  )).join('');
  const note = `${files.length} ảnh · ${codes.length ? esc(codes.join(', ')) : 'thương hiệu'}`;
  return `<div class="post-b vbody" data-key="${esc(v.key)}" data-kind="${esc(target?.kind ?? '')}" data-path="${esc(v.dir)}" data-feedback="${esc(fb)}"${i ? ' hidden' : ''}>
      <div class="text" data-who="${esc(who)}" data-raw="${esc(v.text)}">${esc(v.text)}</div>
      <div class="photos">${photos}<div class="ph-note">${note}</div></div>
    </div>`;
}

function renderPost(post, ctx) {
  const { targets, accounts, outDir, feedback, person, slot } = ctx;
  const target = targets.get(post.targetId);
  const acc = accounts.get(target?.account);
  const accLabel = acc?.label ?? target?.account ?? '';
  const author = acc?.type === 'fb-page' ? 'HomeMatch' : (acc?.label ?? person ?? '');
  const who = target?.kind === 'group' ? `${author} · nhóm ${target.name}` : author;
  const kind = target?.kind;
  const tags = [];
  if (LABELS[post.label]) tags.push(`<span class="tag inv">${esc(LABELS[post.label])}</span>`);
  if (post.type) tags.push(`<span class="tag">${esc(post.type)}</span>`);
  const multi = post.variants.length > 1;
  const first = post.variants[0];
  const link = isHttp(target?.url) ? `<a class="open" href="${esc(target.url)}" target="_blank" rel="noopener noreferrer">${esc(OPEN_TEXT[kind] ?? 'Mở ↗')}</a>` : '';
  const anyFeedback = isHttp(feedback?.formUrl);
  const sub = [accLabel && `đăng bằng ${accLabel}`, KIND_TEXT[kind]].filter(Boolean).join(' · ');
  const vctx = { slot, outDir, feedback, who, target, person: author };
  return `
  <article class="post" data-n="${post.n}" data-acc="${esc(target?.account ?? '')}">
    <div class="post-h">
      <span class="num">${p2(post.n)}</span>
      <span class="target"><b>${esc(target?.name ?? post.targetId)}</b><span class="acc">${esc(sub)}</span></span>
      <span class="tags">${tags.join('')}</span>
    </div>
    ${multi ? `<div class="vtabs">${post.variants.map((v, i) => `<button type="button" data-key="${esc(v.key)}" aria-selected="${i === 0}">Bản ${esc(v.key)}</button>`).join('')}</div>` : ''}
    ${post.variants.map((v, i) => renderVariant(post, v, i, vctx)).join('\n    ')}
    <div class="actions">
      <button type="button" class="btn" data-act="copy-text">Copy nội dung</button>
      <button type="button" class="btn ghost" data-act="copy-path">Copy thư mục ảnh</button>
      ${link}
      ${anyFeedback ? '<button type="button" class="btn ghost" data-act="feedback">Góp ý</button>' : ''}
      <label class="posted"><input type="checkbox"> Đã đăng</label>
      <span class="path">${esc(first.dir)}</span>
    </div>
  </article>`;
}

function foot(summary, items) {
  return `
  <details class="foot">
    <summary>${esc(summary)}</summary>
    <ul>${items.join('')}</ul>
  </details>`;
}

export function renderPostsPage({
  slot, generatedAt, posts, targets, accounts, skipped = [], pending = [], notes = [],
  feedback = {}, person = '', outDir,
}) {
  const tmap = new Map((targets || []).map((t) => [t.id, t]));
  const amap = new Map((accounts || []).map((a) => [a.id, a]));
  const base = outDir ?? (posts[0] ? path.dirname(posts[0].dir) : '');
  const ctx = { targets: tmap, accounts: amap, outDir: base, feedback, person, slot };
  const { hhmm, date, dow } = slotParts(slot);
  const gen = new Date(generatedAt);
  const done = Number.isNaN(gen.getTime()) ? '' : ` · soạn xong ${p2(gen.getHours())}:${p2(gen.getMinutes())}`;

  const accIds = [...new Set(posts.map((p) => tmap.get(p.targetId)?.account).filter(Boolean))];
  const filters = [`<button type="button" aria-pressed="true" data-acc="">Tất cả</button>`]
    .concat(accIds.map((id) => `<button type="button" aria-pressed="false" data-acc="${esc(id)}">${esc(amap.get(id)?.label ?? id)}</button>`))
    .join('');

  const footer = [];
  if (skipped.length) {
    footer.push(foot(`${skipped.length} bài bị bỏ`, skipped.map((s) => {
      const t = tmap.get(s.targetId);
      return `<li><i>${esc(t?.name ?? s.targetId)}</i>: ${esc(s.reason)}</li>`;
    })));
  }
  if (pending.length) footer.push(foot('Đang chờ quy định', pending.map((p) => `<li>${esc(pendingText(p))}</li>`)));
  if (notes.length) footer.push(foot('Ghi chú', notes.map((n) => `<li>${esc(n)}</li>`)));

  const values = {
    PAGE_TITLE: esc(`Bài đăng ${hhmm}${date ? ' - ' + date : ''}`),
    HEADER_TITLE: `Bài đăng <b>${esc(hhmm)}</b> <span class="mute it" style="font-size:15px">${esc([dow && date ? ` · ${dow} ${date}` : '', done].join('').replace(/^ · /, '· '))}</span>`,
    TOTAL: String(posts.length),
    FOLDER_NOTE: `Thư mục ảnh của khung này đã mở trong Finder: ${esc(base)} · mỗi bài là thư mục cùng số (01_, 02_ …)`,
    FILTERS: filters,
    POSTS: posts.map((p) => renderPost(p, ctx)).join('\n'),
    FOOTER: footer.join(''),
    SLOT_JSON: JSON.stringify(String(slot ?? '')).replace(/</g, '\\u003c'),
  };
  return fs.readFileSync(TEMPLATE, 'utf8').replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => (k in values ? values[k] : m));
}
