import { segmentRule, joinedGroups } from './clusters.mjs';

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
// Cách ghi giá: "masked" khi config ghi đúng như vậy, còn lại đầy đủ.
const priceStyleFor = (cfg, kind) => (cfg.priceStyle?.[kind] === 'masked' ? 'masked' : 'full');

export function targetsForSlot(cfg, date, hhmm, onlyGroups) {
  const day = DAY_KEYS[date.getDay()];
  const out = [];
  const needles = onlyGroups?.map(fold);
  for (const c of cfg.clusters || []) {
    if (!c || !c.active) continue;
    if (needles) {
      if (!needles.some((n) => fold(c.name).includes(n) || fold(c.id).includes(n))) continue;
    } else {
      if (!(c.days || []).includes(day)) continue;
      if (hhmm != null && !(c.slots || cfg.schedule || []).includes(hhmm)) continue;
    }
    out.push({
      id: 'group:' + c.id,
      kind: 'group',
      account: c.account,
      name: c.name,
      url: '',
      districts: c.districts || [],
      segment: c.segment || 'room',
      segmentRule: segmentRule(c.segment || 'room'),
      language: c.language,
      note: c.note,
      variants: variantsFor(cfg, 'group'),
      links: linksFor(cfg, 'group'),
      priceStyle: priceStyleFor(cfg, 'group'),
      contact: cfg.contact || [],
      groups: joinedGroups(c),
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
