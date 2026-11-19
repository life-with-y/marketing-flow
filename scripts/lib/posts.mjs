// Kiểm tra posts.json do Claude soạn bằng luật cứng (Task 7).
const KEYS = ['A', 'B', 'C'];
const MATH_ALNUM = /[\u{1D400}-\u{1D7FF}]/u;

const stripSlash = (s) => String(s).replace(/\/+$/, '');

function isHomematchHost(host) {
  const h = host.toLowerCase();
  return h === 'homematch.vn' || h.endsWith('.homematch.vn');
}

function findHomematchUrls(text) {
  const out = [];
  for (const m of text.matchAll(/https?:\/\/[^\s<>"'`]+/gi)) {
    const raw = m[0].replace(/[.,;:!?)\]}»”’]+$/u, '');
    let u;
    try { u = new URL(raw); } catch { continue; }
    if (isHomematchHost(u.hostname)) out.push(raw);
  }
  return out;
}

function priceAppears(text, priceText) {
  let from = 0;
  for (;;) {
    const i = text.indexOf(priceText, from);
    if (i < 0) return false;
    // tránh khớp nhầm đuôi của số lớn hơn (vd "13,5 triệu" chứa "3,5 triệu")
    if (i === 0 || !/[0-9,.]/.test(text[i - 1])) return true;
    from = i + 1;
  }
}

export function validatePosts(posts, input) {
  const errors = [];
  const err = (postIndex, message) => errors.push({ postIndex, message });

  if (!posts || typeof posts !== 'object' || !Array.isArray(posts.posts)) {
    err(-1, 'posts.json sai cấu trúc: cần một object có mảng "posts".');
    return { errors };
  }

  const targets = new Map((input.targets || []).map((t) => [t.id, t]));
  const listings = new Map((input.listings || []).map((l) => [l.code, l]));
  const groupSeen = new Set();

  posts.posts.forEach((post, pi) => {
    if (!post || typeof post !== 'object') {
      err(pi, `Bài ${pi + 1}: sai cấu trúc (không phải object).`);
      return;
    }
    const label = `Bài ${pi + 1}`;

    // 1. targetId
    const target = targets.get(post.targetId);
    if (!target) {
      err(pi, `${label}: đích "${post.targetId}" không có trong input.`);
    } else if (target.kind === 'group') {
      if (groupSeen.has(post.targetId)) {
        err(pi, `${label}: nhóm "${post.targetId}" đã có bài khác trong khung này (mỗi nhóm tối đa 1 bài).`);
      }
      groupSeen.add(post.targetId);
    }

    // 2. postCodes
    let codesOk = Array.isArray(post.postCodes);
    if (!codesOk) err(pi, `${label}: "postCodes" phải là mảng.`);
    const codes = codesOk ? post.postCodes : [];
    const used = [];
    for (const c of codes) {
      const l = listings.get(c);
      if (!l) { err(pi, `${label}: mã tin ${c} không có trong input.`); codesOk = false; }
      else if (!l.eligible) { err(pi, `${label}: tin ${c} chưa đủ điều kiện (không đủ ảnh).`); codesOk = false; }
      else used.push(l);
    }
    const isBrand = Array.isArray(post.postCodes) && codes.length === 0;
    const k = codes.length;

    // 3. variants
    if (!Array.isArray(post.variants)) {
      err(pi, `${label}: "variants" phải là mảng.`);
      return;
    }
    if (target && post.variants.length !== target.variants) {
      err(pi, `${label}: cần ${target.variants} bản nhưng có ${post.variants.length}.`);
    }

    post.variants.forEach((v, vi) => {
      const vl = `${label}, bản ${KEYS[vi] ?? vi + 1}`;
      if (!v || typeof v !== 'object') { err(pi, `${vl}: sai cấu trúc.`); return; }
      if (v.key !== KEYS[vi]) {
        err(pi, `${label}: bản thứ ${vi + 1} phải có key "${KEYS[vi] ?? '?'}" nhưng là "${v.key}".`);
      }
      const vk = `${label}, bản ${v.key ?? KEYS[vi] ?? vi + 1}`;

      // 5. văn bản
      const text = typeof v.text === 'string' ? v.text : null;
      if (text === null) {
        err(pi, `${vk}: thiếu văn bản "text".`);
      } else {
        if (text.includes('**')) err(pi, `${vk}: văn bản có "**" (chỉ dùng chữ thường).`);
        if (text.includes('__')) err(pi, `${vk}: văn bản có "__" (chỉ dùng chữ thường).`);
        if (/^\s*#/m.test(text)) err(pi, `${vk}: có dòng bắt đầu bằng "#".`);
        if (MATH_ALNUM.test(text)) err(pi, `${vk}: có ký tự chữ toán học Unicode (U+1D400–U+1D7FF).`);
        if (target && target.kind === 'threads') {
          const len = [...text].length;
          if (len > 500) err(pi, `${vk}: văn bản Threads dài ${len} ký tự, tối đa 500.`);
        }

        // 6. giá
        if (!isBrand && codesOk) {
          for (const l of used) {
            const ok = (l.rooms || []).some((r) => priceAppears(text, r.priceText));
            if (!ok) {
              err(pi, `${vk}: tin ${l.code} không có giá nào đúng nguyên văn trong bài (cần một trong: ${(l.rooms || []).map((r) => r.priceText).join('; ')}).`);
            }
          }
        }

        // 7. link
        if (!isBrand && codesOk) {
          const allowed = new Set(used.map((l) => stripSlash(l.link)));
          for (const u of findHomematchUrls(text)) {
            if (!allowed.has(stripSlash(u))) {
              err(pi, `${vk}: link ${u} không khớp link của tin nào trong bài.`);
            }
          }
        }
      }

      // 4. ảnh
      if (!Array.isArray(v.images) || v.images.some((x) => typeof x !== 'string')) {
        err(pi, `${vk}: "images" phải là mảng URL.`);
        return;
      }
      const imgs = v.images;
      if (new Set(imgs).size !== imgs.length) err(pi, `${vk}: có ảnh bị lặp.`);

      if (isBrand) {
        const pool = new Set((input.listings || []).filter((l) => l.eligible).flatMap((l) => (l.images || []).map((i) => i.url)));
        if (imgs.length < 3 || imgs.length > 5) err(pi, `${vk}: bài thương hiệu cần 3–5 ảnh, có ${imgs.length}.`);
        for (const u of imgs) if (!pool.has(u)) err(pi, `${vk}: ảnh ${u} không thuộc tin đủ điều kiện nào.`);
      } else if (codesOk && k > 0) {
        const pool = new Set(used.flatMap((l) => (l.images || []).map((i) => i.url)));
        for (const u of imgs) if (!pool.has(u)) err(pi, `${vk}: ảnh ${u} không thuộc tin nào trong bài.`);
        if (k === 1) {
          const l = used[0];
          const want = Math.min(5, l.imageCount ?? (l.images || []).length);
          if (imgs.length < 3) err(pi, `${vk}: bài 1 tin cần ít nhất 3 ảnh, có ${imgs.length}.`);
          if (imgs.length !== want) err(pi, `${vk}: bài 1 tin cần đúng ${want} ảnh, có ${imgs.length}.`);
        } else {
          if (k > 10) {
            err(pi, `${vk}: bài gom ${k} tin vượt tối đa 10 tin.`);
          } else {
            const maxTotal = k <= 5 ? 5 : k;
            if (imgs.length > maxTotal) err(pi, `${vk}: bài gom ${k} tin tối đa ${maxTotal} ảnh, có ${imgs.length}.`);
            if (k > 5 && imgs.length !== k) err(pi, `${vk}: bài gom ${k} tin (>5) cần đúng ${k} ảnh (1 bìa/tin), có ${imgs.length}.`);
            used.forEach((l, i) => {
              const cover = (l.images || [])[0]?.url;
              if (imgs[i] !== cover) err(pi, `${vk}: ảnh thứ ${i + 1} phải là bìa của tin ${l.code}.`);
            });
          }
        }
      }
    });
  });

  return { errors };
}
