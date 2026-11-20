// Kiểm tra posts.json do Claude soạn bằng luật cứng (Task 7).
const KEYS = ['A', 'B', 'C'];
const MATH_ALNUM = /[\u{1D400}-\u{1D7FF}]/u;
const KEYCAP = /\u20E3/u;
// #tag đứng riêng (không dính sau chữ, số, "/", "&"), ngay sau # là chữ ("#2" không tính).
const HASHTAG_RE = /(?<![\p{L}\p{M}\p{N}_&\/])#\p{L}[\p{L}\p{M}\p{N}_]*/gu;

const stripSlash = (s) => String(s).replace(/\/+$/, '');

function isHomematchHost(host) {
  const h = host.toLowerCase();
  return h === 'homematch.vn' || h.endsWith('.homematch.vn');
}

function findHomematchUrls(text) {
  const out = [];
  const re = /(?<![\w.@-])(?:https?:\/\/)?(?:[a-z0-9-]+\.)*homematch\.vn(?:[\/?#][^\s<>"'`]*)?/gi;
  for (const m of text.matchAll(re)) {
    const raw = m[0].replace(/[.,;:!?)\]}»”’…]+$/u, '');
    let u;
    try { u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`); } catch { continue; }
    if (isHomematchHost(u.hostname)) out.push(raw);
  }
  return out;
}

const normUrl = (s) => stripSlash(/^https?:\/\//i.test(s) ? s : `https://${s}`);

// Đuôi đọc giá sau một giá ("3 triệu 5", "3 triệu rưỡi", "4 triệu tư"...): không phân biệt hoa thường, nguyên từ.
const SPOKEN = 'một|mốt|hai|ba|bốn|tư|năm|lăm|sáu|bảy|tám|chín|rưỡi|lẻ';
const TRAIL_RE = new RegExp(`^\\s*(?:[0-9]|[,.][0-9]|(?:${SPOKEN})(?![\\p{L}\\p{M}\\p{N}]))`, 'iu');
const hasTrail = (after) => TRAIL_RE.test(after);

// Mọi số kèm đơn vị tiền thuê; "tr" viết tắt cũng bắt (không bao giờ hợp lệ). Không quét "k", "đ".
const PRICE_TOKEN_RE = /(?<!\p{N})\d+(?:[.,]\d+)*\s*(?:triệu|tr(?![\p{L}\p{M}])|million(?:\s*vnd(?![\p{L}\p{N}]))?|vnd(?![\p{L}\p{N}]))/giu;
const CODE_RE = /\bT\d{3,}\b/g;
// Mức trần "dưới X triệu" / "tầm X triệu" (X dạng priceText: "5", "4,5"), không phân biệt hoa thường.
const CEIL_RE = /(?<![\p{L}\p{M}\p{N}])(dưới|tầm)\s+(\d+(?:,\d+)?)\s*triệu(?![\p{L}\p{M}])/giu;

// Giá phòng (đồng): ưu tiên room.price, không có thì đọc từ priceText "4,5 triệu".
function roomPrice(r) {
  if (Number.isFinite(r?.price)) return r.price;
  const m = /^(\d+(?:,\d+)?)\s*triệu$/u.exec(String(r?.priceText ?? '').normalize('NFC').trim());
  return m ? Math.round(Number(m[1].replace(',', '.')) * 1e6) : null;
}

// Các mức trần trong đoạn chữ: vị trí số, cụm nguyên văn, đúng hay sai.
// Giá đầy đủ: mọi phòng của mọi tin ≤ X. Kênh ẩn giá: mọi phòng < X (X không được là giá thật của phòng nào).
function findCeilings(text, used, masked) {
  const out = new Map();
  for (const m of text.matchAll(CEIL_RE)) {
    const x = Math.round(Number(m[2].replace(',', '.')) * 1e6);
    const ok = used.length > 0 && used.every((l) => (l.rooms || []).length > 0
      && l.rooms.every((r) => { const p = roomPrice(r); return p != null && (masked ? p < x : p <= x); }));
    out.set(m.index + m[0].search(/\d/), { phrase: m[0], ok, x: `${m[2]} triệu` });
  }
  return out;
}

// Giá che: phần triệu (làm tròn xuống) + "xxx", vd 4.400.000 → "4xxx".
const MASK_RE = /(?<![\p{L}\p{N}])(\d+)xxx(?![\p{L}\p{N}])/giu;
const maskedOf = (r) => { const p = roomPrice(r); return p == null ? null : `${Math.floor(p / 1e6)}xxx`; };
const hasMasked = (text, tok) => [...text.matchAll(MASK_RE)].some((m) => m[0].toLowerCase() === tok);

// Bỏ các mức trần khỏi đoạn chữ (để mức trần không thay cho giá thật của tin).
const stripCeilings = (text) => text.replace(CEIL_RE, (m) => ' '.repeat(m.length));

// Khớp nguyên văn, có chặn biên: trước không phải số/,/. ; sau không phải số, ,/. + số, hay đuôi đọc giá.
function appearsExact(text, needle) {
  let from = 0;
  for (;;) {
    const i = text.indexOf(needle, from);
    if (i < 0) return false;
    from = i + 1;
    if (i > 0 && /[0-9,.]/.test(text[i - 1])) continue;
    if (hasTrail(text.slice(i + needle.length))) continue;
    return true;
  }
}

function englishForms(price) {
  if (!Number.isFinite(price)) return [];
  const whole = Math.floor(price / 1e6);
  const frac = String(price % 1e6).padStart(6, '0').replace(/0+$/, '');
  return [`${whole}${frac ? '.' + frac : ''} million VND`, `${Number(price).toLocaleString('en-US')} VND`];
}

function priceForms(room, language) {
  const f = [room.priceText];
  if (language === 'en') f.push(...englishForms(room.price));
  return f.filter((x) => typeof x === 'string' && x).map((x) => x.normalize('NFC'));
}

const FACEBOOK_KINDS = new Set(['page', 'wall', 'group']);
const COMMENT_MAX = 300;

// Luật định dạng (5), giá ghi trong bài (6b), mã tin (6c), link (7) cho một đoạn chữ.
function checkContent(text, vk, { pi, err, isBrand, codesOk, used, codes, listings, postCodes, language, checkLinks, linksOn, masked }) {
  if (text.includes('**')) err(pi, `${vk}: văn bản có "**" (chỉ dùng chữ thường).`);
  if (text.includes('__')) err(pi, `${vk}: văn bản có "__" (chỉ dùng chữ thường).`);
  if (/^\s*#{1,6}\s/m.test(text)) err(pi, `${vk}: có dòng tiêu đề markdown bắt đầu bằng "#".`);
  if (MATH_ALNUM.test(text)) err(pi, `${vk}: có ký tự chữ toán học Unicode (U+1D400–U+1D7FF).`);
  if (KEYCAP.test(text)) err(pi, `${vk}: không dùng số dạng icon (0️⃣…9️⃣), viết chữ số thường.`);

  // 6b. mọi giá ghi trong bài phải là giá thật của tin trong bài (bài thương hiệu: không có giá)
  if (Array.isArray(postCodes)) {
    const allowed = new Set(used.flatMap((l) => (l.rooms || []).flatMap((r) => priceForms(r, language))));
    const ceilings = findCeilings(text, used, masked);
    for (const m of text.matchAll(PRICE_TOKEN_RE)) {
      const tok = m[0];
      const ce = ceilings.get(m.index);
      if (isBrand) err(pi, `${vk}: bài thương hiệu không được ghi giá thuê ("${tok}").`);
      else if (ce) {
        if (!ce.ok) err(pi, masked
          ? `${vk}: mức "${ce.phrase}" sai, kênh ẩn giá cần mức trần lớn hơn mọi giá phòng trong bài (không trùng giá thật).`
          : `${vk}: mức "${ce.phrase}" sai, có phòng trong bài giá cao hơn ${ce.x}.`);
        else if (hasTrail(text.slice(m.index + tok.length))) err(pi, `${vk}: giá "${tok}" bị nối thêm số hoặc chữ đọc giá phía sau.`);
      } else if (masked) err(pi, `${vk}: kênh này che giá (ghi dạng 4xxx), không ghi giá "${tok}".`);
      else if (!allowed.has(tok)) err(pi, `${vk}: giá "${tok}" không phải giá của tin nào trong bài.`);
      else if (hasTrail(text.slice(m.index + tok.length))) err(pi, `${vk}: giá "${tok}" bị nối thêm số hoặc chữ đọc giá phía sau.`);
    }
    // 6b'. giá che "4xxx": chỉ ở kênh che giá, và phải khớp một phòng của tin trong bài
    const maskedOk = new Set(used.flatMap((l) => (l.rooms || []).map(maskedOf)).filter(Boolean));
    for (const m of text.matchAll(MASK_RE)) {
      const tok = m[0];
      if (isBrand) err(pi, `${vk}: bài thương hiệu không được ghi giá thuê ("${tok}").`);
      else if (!masked) err(pi, `${vk}: kênh này ghi giá đầy đủ, không dùng dạng "${tok}".`);
      else if (!maskedOk.has(tok.toLowerCase())) err(pi, `${vk}: giá "${tok}" không khớp phòng nào trong bài.`);
    }
    // 6c. mọi mã tin trong bài phải nằm trong postCodes (bỏ qua token trùng số phòng của tin trong bài)
    const roomNames = new Set(codes.flatMap((c) => (listings.get(c)?.rooms || []).map((r) => String(r.room ?? '').toUpperCase())));
    for (const m of new Set(text.match(CODE_RE) || [])) {
      if (!codes.includes(m) && !roomNames.has(m.toUpperCase())) err(pi, `${vk}: mã tin ${m} không nằm trong postCodes của bài.`);
    }
  }

  // 7. công tắc link của kênh tắt: không link homematch nào, ở đâu cũng vậy
  if (!linksOn) {
    if (findHomematchUrls(text).length) err(pi, `${vk}: kênh này đang tắt link homematch.vn`);
    return;
  }
  // 7b. link homematch phải là link của tin trong bài
  if (checkLinks && !isBrand && codesOk) {
    const allowed = new Set(used.map((l) => normUrl(l.link)));
    for (const u of findHomematchUrls(text)) {
      if (!allowed.has(normUrl(u))) err(pi, `${vk}: link ${u} không khớp link của tin nào trong bài.`);
    }
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
        err(pi, `${label}: cụm "${post.targetId}" đã có bài khác trong khung này (mỗi cụm tối đa 1 bài).`);
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
      else if (target?.kind === 'group' && Array.isArray(target.listingCodes) && !target.listingCodes.includes(c)) {
        err(pi, `${label}: tin ${c} không thuộc cụm "${target.name}" (sai quận hoặc phân khúc).`); codesOk = false;
      } else used.push(l);
    }
    const isBrand = Array.isArray(post.postCodes) && codes.length === 0;
    // Kiểu "Gợi ý 4–5 phòng cùng phân khúc": ảnh chỉ là bìa từng tin.
    const isSegment = typeof post.type === 'string' && post.type.normalize('NFC').toLowerCase().includes('phân khúc');
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

      // 5–7. văn bản (thân bài) và comment đầu tiên dùng chung luật định dạng, giá, mã tin, link
      const fb = target && FACEBOOK_KINDS.has(target.kind);
      const linksOn = target?.links === true;
      const masked = target?.priceStyle === 'masked';
      const ctx = { pi, err, isBrand, codesOk, used, codes, listings, postCodes: post.postCodes, language: target?.language, linksOn, masked };
      const text = typeof v.text === 'string' ? v.text.normalize('NFC') : null;
      if (text === null) {
        err(pi, `${vk}: thiếu văn bản "text".`);
      } else {
        checkContent(text, vk, { ...ctx, checkLinks: !fb });
        if (linksOn && fb && findHomematchUrls(text).length) {
          err(pi, `${vk}: link tin để ở comment đầu tiên, không để trong thân bài.`);
        }
        if (target && target.kind === 'threads') {
          const len = [...text].length;
          if (len > 500) err(pi, `${vk}: văn bản Threads dài ${len} ký tự, tối đa 500.`);
          const tags = (text.match(HASHTAG_RE) || []).length;
          if (tags > 1) err(pi, `${vk}: Threads có ${tags} hashtag, tối đa 1 tag chủ đề.`);
        }

        // 6. giá: mỗi tin trong bài phải có một giá đúng nguyên văn (kênh che giá: dạng 4xxx) trong thân bài
        if (!isBrand && codesOk && masked) {
          for (const l of used) {
            const toks = [...new Set((l.rooms || []).map(maskedOf).filter(Boolean))];
            if (!toks.length) err(pi, `${vk}: tin ${l.code} không có giá để viết dạng ẩn.`);
            else if (!toks.some((t) => hasMasked(text, t))) {
              err(pi, `${vk}: tin ${l.code} không có giá dạng che nào trong bài (cần một trong: ${toks.join('; ')}).`);
            }
          }
        } else if (!isBrand && codesOk) {
          for (const l of used) {
            const bare = stripCeilings(text);
            const ok = (l.rooms || []).some((r) => priceForms(r, target?.language).some((f) => appearsExact(bare, f)));
            if (!ok) {
              err(pi, `${vk}: tin ${l.code} không có giá nào đúng nguyên văn trong bài (cần một trong: ${(l.rooms || []).map((r) => r.priceText).join('; ')}).`);
            }
          }
        }
      }

      // comment đầu tiên (tuỳ chọn): người dùng dán và ghim
      if (v.comment !== undefined && v.comment !== null) {
        if (typeof v.comment !== 'string') {
          err(pi, `${vk}: "comment" phải là chuỗi.`);
        } else {
          const comment = v.comment.normalize('NFC');
          const cl = `${vk} (comment)`;
          const len = [...comment].length;
          if (len > COMMENT_MAX) err(pi, `${cl}: comment dài ${len} ký tự, tối đa ${COMMENT_MAX}.`);
          checkContent(comment, cl, { ...ctx, checkLinks: true });
          if (linksOn && isBrand && findHomematchUrls(comment).length) {
            err(pi, `${cl}: bài thương hiệu, comment không để link homematch.`);
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
            else if (isSegment && imgs.length !== k) err(pi, `${vk}: bài phân khúc cần đúng ${k} ảnh bìa (1 ảnh/tin, theo thứ tự postCodes, không ảnh phụ), có ${imgs.length}.`);
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
