// Tải ảnh bài đăng vào thư mục theo thứ tự đăng (Task 8).
import fs from 'node:fs';
import path from 'node:path';

const CONCURRENCY = 6;

export function slugify(s) {
  return String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
}

export function postDirName(n, target, postCodes) {
  const tail = postCodes.length === 1 ? postCodes[0] : postCodes.length >= 2 ? 'gom' : 'brand';
  return `${String(n).padStart(2, '0')}_${slugify(target?.name ?? '')}_${tail}`;
}

function extFor(contentType) {
  const m = /^image\/([a-z0-9.+-]+)/i.exec(contentType || '');
  if (!m) return null;
  return { jpeg: 'jpg', jpg: 'jpg', png: 'png', webp: 'webp', gif: 'gif' }[m[1].toLowerCase()] ?? null;
}

async function fetchOne(url, fetchImpl, timeoutMs) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { signal: ctl.signal });
    if (res.status !== 200) return null;
    const ext = extFor(res.headers.get('content-type'));
    if (!ext) return null;
    return { ext, bytes: Buffer.from(await res.arrayBuffer()) };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function pool(items, limit, fn) {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) await fn(items[i++]);
  });
  await Promise.all(workers);
}

export async function downloadPosts({ posts, input, outRoot, fetchImpl = fetch, timeoutMs = 20000 }) {
  const targets = new Map((input.targets ?? []).map((t) => [t.id, t]));
  const listings = new Map((input.listings ?? []).map((l) => [l.code, l]));

  const list = Array.isArray(posts) ? posts : posts.posts;
  const urls = [...new Set(list.flatMap((p) => p.variants.flatMap((v) => v.images)))];
  const cache = new Map();
  await pool(urls, CONCURRENCY, async (url) => { cache.set(url, await fetchOne(url, fetchImpl, timeoutMs)); });

  fs.mkdirSync(outRoot, { recursive: true });
  for (const name of fs.readdirSync(outRoot)) {
    if (/^\d{2}_/.test(name)) fs.rmSync(path.join(outRoot, name), { recursive: true, force: true });
  }
  const done = [];
  const needsReplacement = [];

  list.forEach((post, idx) => {
    const n = idx + 1;
    const target = targets.get(post.targetId);
    const kept = post.variants.map((v) => ({ v, ok: v.images.filter((u) => cache.get(u)) }));
    let reason = null;
    const SAFE = /^[A-Za-z0-9_-]+$/;
    if (post.postCodes.length === 1 && !SAFE.test(String(post.postCodes[0]))) {
      reason = `Mã tin "${post.postCodes[0]}" có ký tự không hợp lệ cho tên thư mục.`;
    } else if (post.variants.some((v) => !SAFE.test(String(v.key)))) {
      reason = 'Khóa bản có ký tự không hợp lệ cho tên thư mục.';
    }
    if (!reason)
    for (const { v, ok } of kept) {
      const label = post.variants.length > 1 ? ` (bản ${v.key})` : '';
      if (post.postCodes.length === 1 || post.postCodes.length === 0) {
        if (ok.length < 3) { reason = `Bài${label} chỉ còn ${ok.length} ảnh tải được, cần ít nhất 3 ảnh.`; break; }
      } else {
        const missing = post.postCodes.find((c) => {
          const cover = listings.get(c)?.images?.[0]?.url;
          return !cover || !ok.includes(cover);
        });
        if (missing) { reason = `Bài gom${label} thiếu ảnh bìa của tin ${missing} (không tải được).`; break; }
      }
    }
    if (reason) { needsReplacement.push({ targetId: post.targetId, reason }); return; }

    const dir = path.join(outRoot, postDirName(n, target, post.postCodes));
    fs.rmSync(dir, { recursive: true, force: true });
    const multi = post.variants.length > 1;
    const variants = kept.map(({ v, ok }) => {
      const vdir = multi ? path.join(dir, v.key) : dir;
      fs.mkdirSync(vdir, { recursive: true });
      const files = ok.map((u, i) => {
        const { ext, bytes } = cache.get(u);
        const name = `${i + 1}.${ext}`;
        fs.writeFileSync(path.join(vdir, name), bytes);
        return name;
      });
      fs.writeFileSync(path.join(vdir, 'post.txt'), v.text, 'utf8');
      return { key: v.key, dir: vdir, text: v.text, files };
    });
    done.push({ n, dir, targetId: post.targetId, variants });
  });

  return { posts: done, needsReplacement };
}
