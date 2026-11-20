const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const KIND_BY_TYPE = { 'fb-personal': 'wall', 'fb-page': 'page', threads: 'threads' };

export function fold(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase();
}

function variantsFor(cfg, kind) {
  const v = cfg.variants || {};
  return v[kind === 'group' ? 'groups' : kind] ?? v.default ?? 1;
}

// Công tắc link homematch.vn theo kênh: chỉ đúng true mới bật (thiếu/sai = tắt).
const linksFor = (cfg, kind) => cfg.links?.[kind] === true;
// Cách ghi giá: Page luôn đầy đủ; kênh khác "masked" khi config ghi đúng như vậy.
const priceStyleFor = (cfg, kind) => (kind !== 'page' && cfg.priceStyle?.[kind] === 'masked' ? 'masked' : 'full');

export function targetsForSlot(cfg, date, hhmm, onlyGroups) {
  const day = DAY_KEYS[date.getDay()];
  const out = [];
  const needles = onlyGroups?.map(fold);
  for (const g of cfg.groups || []) {
    if (!g.active) continue;
    if (needles) {
      if (!needles.some((n) => fold(g.name).includes(n))) continue;
    } else {
      if (!(g.days || []).includes(day)) continue;
      if (hhmm != null && !(g.slots || cfg.schedule || []).includes(hhmm)) continue;
    }
    out.push({
      id: 'group:' + g.url,
      kind: 'group',
      account: g.account,
      name: g.name,
      url: g.url,
      districts: g.districts || [],
      language: g.language,
      note: g.note,
      variants: variantsFor(cfg, 'group'),
      links: linksFor(cfg, 'group'),
      priceStyle: priceStyleFor(cfg, 'group'),
      contact: cfg.contact || [],
    });
  }
  if (needles) return out;
  for (const [accountId, n] of Object.entries(cfg.perSlot || {})) {
    const acc = (cfg.accounts || []).find((a) => a.id === accountId);
    const kind = acc && KIND_BY_TYPE[acc.type];
    if (!kind) continue;
    for (let i = 0; i < n; i++) {
      out.push({
        id: `${kind}:${accountId}:${i}`,
        kind,
        account: accountId,
        name: acc.label,
        url: '',
        districts: [],
        language: 'vi',
        note: '',
        variants: variantsFor(cfg, kind),
        links: linksFor(cfg, kind),
        priceStyle: priceStyleFor(cfg, kind),
        contact: kind === 'page' ? cfg.pageContact || [] : cfg.contact || [],
      });
    }
  }
  return out;
}
