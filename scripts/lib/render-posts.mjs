// Phần "Bài đăng" của trang chủ: mỗi khung giờ một section, mỗi bài một thẻ (dữ liệu từ <slot>/page-data.json).
import path from 'node:path';

const LABELS = { NEW: 'Mới', PRICE_DOWN: 'Giảm giá', NOW_AVAILABLE: 'Vừa trống' };
const OPEN_TEXT = { group: 'Mở nhóm ↗', page: 'Mở Page ↗', threads: 'Mở Threads ↗' };
const KIND_TEXT = { group: 'nhóm', page: 'trang', threads: '' };
const DAYS = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const FEEDBACK_TEXT_MAX = 1500;

export const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const p2 = (n) => String(n).padStart(2, '0');
const arr = (v) => (Array.isArray(v) ? v : []);
export const isHttp = (u) => /^https?:\/\//i.test(String(u ?? ''));
const urlPath = (rel) => rel.split(path.sep).map(encodeURIComponent).join('/');

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

export function slotParts(slot) {
  const m = /^(\d{4})-(\d{2})-(\d{2})_(\d{2})(\d{2})$/.exec(slot || '');
  if (!m) return { hhmm: String(slot ?? ''), date: '', dow: '' };
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return { hhmm: `${m[4]}:${m[5]}`, date: `${m[3]}/${m[2]}`, dow: DAYS[d.getDay()] };
}

export function slotLabel(slot) {
  const { hhmm, date } = slotParts(slot);
  return date ? `${date} ${hhmm}` : hhmm;
}

function pendingText(p) {
  if (p && typeof p === 'object') return Object.values(p).map((v) => String(v ?? '').trim()).filter(Boolean).join(' · ');
  return String(p ?? '');
}

// Đường dẫn tương đối từ <outputDir>/index.html và đường dẫn thật trên máy, theo tên thư mục khung.
function locate(ctx, dir) {
  const d = String(dir ?? '');
  const rel = path.relative(ctx.slotDir, d);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return { abs: d, rel: path.relative(ctx.outputDir, d) };
  return { abs: path.join(ctx.outputDir, ctx.slot, rel), rel: path.join(ctx.slot, rel) };
}

function renderVariant(post, v, i, ctx) {
  const { slot, feedback, who, target, person } = ctx;
  const codes = arr(post.postCodes);
  const where = locate(ctx, v.dir);
  const files = arr(v.files).map((f) => ({ name: f, src: urlPath(path.join(where.rel, String(f))) }));
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
  return `<div class="post-b vbody" data-key="${esc(v.key)}" data-kind="${esc(target?.kind ?? '')}" data-path="${esc(where.abs)}" data-feedback="${esc(fb)}"${i ? ' hidden' : ''}>
      <div class="text" data-who="${esc(who)}" data-raw="${esc(v.text)}">${esc(v.text)}</div>
      <div class="photos">${photos}<div class="ph-note">${note}</div></div>
    </div>`;
}

function renderPost(post, ctx) {
  const { targets, accounts, feedback, person, slot } = ctx;
  const target = targets.get(post.targetId);
  const acc = accounts.get(target?.account);
  const accLabel = acc?.label ?? target?.account ?? '';
  const author = acc?.type === 'fb-page' ? 'HomeMatch' : (acc?.label ?? person ?? '');
  const who = target?.kind === 'group' ? `${author} · nhóm ${target.name}` : author;
  const kind = target?.kind;
  const codes = arr(post.postCodes);
  const variants = arr(post.variants);
  const tags = [];
  if (LABELS[post.label]) tags.push(`<span class="tag inv">${esc(LABELS[post.label])}</span>`);
  if (post.type) tags.push(`<span class="tag">${esc(post.type)}</span>`);
  const multi = variants.length > 1;
  const link = isHttp(target?.url) ? `<a class="open" href="${esc(target.url)}" target="_blank" rel="noopener noreferrer">${esc(OPEN_TEXT[kind] ?? 'Mở ↗')}</a>` : '';
  const anyFeedback = isHttp(feedback?.formUrl);
  const sub = [accLabel && `đăng bằng ${accLabel}`, KIND_TEXT[kind]].filter(Boolean).join(' · ');
  const vctx = { ...ctx, who, target, person: author };
  const seed = `Kiểu ${post.type}: (bài ${slot} số ${post.n}, mã ${codes.length ? codes.join(', ') : '—'}) `;
  const first = variants[0] ? locate(ctx, variants[0].dir).abs : '';
  return `
  <article class="post" data-n="${esc(post.n)}" data-acc="${esc(target?.account ?? '')}">
    <div class="post-h">
      <span class="num">${esc(p2(post.n))}</span>
      <span class="target"><b>${esc(target?.name ?? post.targetId)}</b><span class="acc">${esc(sub)}</span></span>
      <span class="tags">${tags.join('')}</span>
    </div>
    ${multi ? `<div class="vtabs">${variants.map((v, i) => `<button type="button" data-key="${esc(v.key)}" aria-selected="${i === 0}">Bản ${esc(v.key)}</button>`).join('')}</div>` : ''}
    ${variants.map((v, i) => renderVariant(post, v, i, vctx)).join('\n    ')}
    <div class="actions">
      <button type="button" class="btn" data-act="copy-text">Copy nội dung</button>
      <button type="button" class="btn ghost" data-act="copy-path">Copy thư mục ảnh</button>
      ${link}
      ${anyFeedback ? '<button type="button" class="btn ghost" data-act="feedback">Góp ý</button>' : ''}
      ${post.type ? `<button type="button" class="btn ghost" data-act="seed" data-seed="${esc(seed)}">Sửa kiểu bài này</button>` : ''}
      <label class="posted"><input type="checkbox"> Đã đăng</label>
      <span class="path">${esc(first)}</span>
    </div>
  </article>`;
}

// Bài hỏng (null, thiếu bản…) thành một thẻ báo lỗi; các bài khác vẫn hiện.
function safePost(post, i, ctx) {
  const n = post && typeof post === 'object' && post.n != null ? post.n : i + 1;
  try {
    if (!post || typeof post !== 'object') throw new Error('bad post');
    const variants = arr(post.variants);
    if (!variants.length || variants.some((v) => !v || typeof v !== 'object')) throw new Error('bad variants');
    return renderPost(post, ctx);
  } catch {
    return `
  <div class="post-err">Không hiển thị được bài số ${esc(n)} (dữ liệu khung bị hỏng).</div>`;
  }
}

function foot(summary, items) {
  return `
  <details class="foot">
    <summary>${esc(summary)}</summary>
    <ul>${items.join('')}</ul>
  </details>`;
}

// data = nội dung page-data.json của một khung; outputDir = thư mục chứa index.html chung.
export function slotSection(data, { outputDir, feedback = {}, person = '', hidden = false }) {
  const slot = String(data.slot ?? '');
  const posts = arr(data.posts);
  const tmap = new Map(arr(data.targets).map((t) => [t?.id, t]));
  const amap = new Map(arr(data.accounts).map((a) => [a?.id, a]));
  const slotDir = typeof data.outDir === 'string' && data.outDir ? data.outDir : path.join(outputDir, slot);
  const ctx = { targets: tmap, accounts: amap, feedback, person, slot, slotDir, outputDir };
  const { hhmm, date, dow } = slotParts(slot);
  const gen = new Date(data.generatedAt);
  const done = Number.isNaN(gen.getTime()) ? '' : ` · soạn xong ${p2(gen.getHours())}:${p2(gen.getMinutes())}`;
  const meta = [dow && date ? ` · ${dow} ${date}` : '', done].join('').replace(/^ · /, '· ');

  const accIds = [...new Set(posts.map((p) => tmap.get(p?.targetId)?.account).filter(Boolean))];
  const filters = [`<button type="button" aria-pressed="true" data-acc="">Tất cả</button>`]
    .concat(accIds.map((id) => `<button type="button" aria-pressed="false" data-acc="${esc(id)}">${esc(amap.get(id)?.label ?? id)}</button>`))
    .join('');

  const footer = [];
  const skipped = arr(data.skipped);
  if (skipped.length) {
    footer.push(foot(`${skipped.length} bài bị bỏ`, skipped.map((s) => {
      const t = tmap.get(s?.targetId);
      return `<li><i>${esc(t?.name ?? s?.targetId)}</i>: ${esc(s?.reason)}</li>`;
    })));
  }
  const pending = arr(data.pending).filter((p) => pendingText(p));
  if (pending.length) footer.push(foot('Đang chờ quy định', pending.map((p) => `<li>${esc(pendingText(p))}</li>`)));
  const notes = arr(data.notes);
  if (notes.length) footer.push(foot('Ghi chú', notes.map((n) => `<li>${esc(n)}</li>`)));

  return `<section class="slotview" data-slot="${esc(slot)}" data-total="${posts.length}"${hidden ? ' hidden' : ''}>
  <div class="sh">
    <div class="sh-row">
      <div class="sh-title">Bài đăng <b>${esc(hhmm)}</b> <span class="mute it">${esc(meta)}</span></div>
      <div class="progress">đã đăng <b class="posted-n">0</b> / <b>${posts.length}</b></div>
    </div>
    <div class="bar"><i></i></div>
    <div class="folder">Thư mục ảnh của khung này: ${esc(path.join(outputDir, slot))} · mỗi bài là thư mục cùng số (01_, 02_ …)</div>
    <div class="filters">${filters}</div>
  </div>
  ${posts.map((p, i) => safePost(p, i, ctx)).join('\n') || '<p class="hint">Khung này không có bài.</p>'}
  ${footer.join('')}
</section>`;
}
