// So sánh hai bản cấu hình, trả các dòng changelog tiếng Việt (Task 11).
const DAY_LABEL = { mon: 'T2', tue: 'T3', wed: 'T4', thu: 'T5', fri: 'T6', sat: 'T7', sun: 'CN' };
const ALL_DAYS = Object.keys(DAY_LABEL);
const LANG_LABEL = { vi: 'tiếng Việt', en: 'tiếng Anh' };

const arr = (v) => (Array.isArray(v) ? v : []);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const list = (v) => (arr(v).length ? arr(v).join(', ') : '—');
const days = (v) => {
  const d = v === undefined ? ALL_DAYS : arr(v);
  return d.length === 7 ? 'mọi ngày' : d.length ? ALL_DAYS.filter((x) => d.includes(x)).map((x) => DAY_LABEL[x]).join(', ') : '—';
};
const lang = (v) => LANG_LABEL[v ?? 'vi'] || String(v);
const text = (v) => (v == null || v === '' ? '—' : String(v));
const state = (v) => (v === false ? 'tạm ngừng' : 'bật');
const slotsText = (g) => (g.slots === undefined ? 'theo giờ chạy' : list(g.slots));
const keyOf = (g) => String(g.url || g.name || '');

function groupLines(oldGroups, newGroups) {
  const out = [];
  const og = arr(oldGroups).filter((g) => g && typeof g === 'object');
  const ng = arr(newGroups).filter((g) => g && typeof g === 'object');
  const oldBy = new Map(og.map((g) => [keyOf(g), g]));
  const newBy = new Map(ng.map((g) => [keyOf(g), g]));
  for (const g of ng) {
    const o = oldBy.get(keyOf(g));
    const nm = g.name || g.url;
    if (!o) { out.push(`Nhóm ${nm}: thêm mới`); continue; }
    if ((o.name ?? '') !== (g.name ?? '')) out.push(`Nhóm ${text(o.name)}: đổi tên → ${text(g.name)}`);
    if ((o.active !== false) !== (g.active !== false)) out.push(`Nhóm ${nm}: ${state(o.active)} → ${state(g.active)}`);
    if (!same(o.slots, g.slots)) out.push(`Nhóm ${nm}: khung ${slotsText(o)} → ${slotsText(g)}`);
    if (days(o.days) !== days(g.days)) out.push(`Nhóm ${nm}: ngày ${days(o.days)} → ${days(g.days)}`);
    if ((o.language ?? 'vi') !== (g.language ?? 'vi')) out.push(`Nhóm ${nm}: ngôn ngữ ${lang(o.language)} → ${lang(g.language)}`);
    if (list(o.districts) !== list(g.districts)) out.push(`Nhóm ${nm}: quận ${list(o.districts)} → ${list(g.districts)}`);
    if ((o.note ?? '') !== (g.note ?? '')) out.push(`Nhóm ${nm}: ghi chú ${text(o.note)} → ${text(g.note)}`);
    if ((o.account ?? '') !== (g.account ?? '')) out.push(`Nhóm ${nm}: tài khoản ${text(o.account)} → ${text(g.account)}`);
  }
  for (const g of og) {
    if (!newBy.has(keyOf(g))) out.push(`Nhóm ${g.name || g.url}: bỏ`);
  }
  return out;
}

function accountLines(oldAcc, newAcc) {
  const out = [];
  const oa = arr(oldAcc).filter(Boolean);
  const na = arr(newAcc).filter(Boolean);
  const oldBy = new Map(oa.map((a) => [a.id, a]));
  const newBy = new Map(na.map((a) => [a.id, a]));
  for (const a of na) {
    const o = oldBy.get(a.id);
    if (!o) out.push(`Tài khoản ${a.label || a.id}: thêm mới`);
    else if ((o.label ?? '') !== (a.label ?? '')) out.push(`Tài khoản ${text(o.label || o.id)}: đổi tên → ${text(a.label || a.id)}`);
  }
  for (const a of oa) if (!newBy.has(a.id)) out.push(`Tài khoản ${a.label || a.id}: bỏ`);
  return out;
}

function mapLines(label, oldM, newM, nameOf = (k) => k) {
  const out = [];
  const o = oldM && typeof oldM === 'object' ? oldM : {};
  const n = newM && typeof newM === 'object' ? newM : {};
  for (const k of new Set([...Object.keys(o), ...Object.keys(n)])) {
    if (!same(o[k], n[k])) out.push(`${label} ${nameOf(k)}: ${text(o[k])} → ${text(n[k])}`);
  }
  return out;
}

export function diffConfig(oldCfg, newCfg) {
  const o = oldCfg || {};
  const n = newCfg || {};
  const out = [];
  if (!same(o.schedule, n.schedule)) out.push(`Giờ chạy: ${list(o.schedule)} → ${list(n.schedule)}`);
  out.push(...groupLines(o.groups, n.groups));
  const label = (id) => arr(n.accounts).concat(arr(o.accounts)).find((a) => a && a.id === id)?.label || id;
  out.push(...mapLines('Số bài mỗi khung', o.perSlot, n.perSlot, label));
  out.push(...mapLines('Số bản', o.variants, n.variants));
  if (!same(o.contact, n.contact)) out.push(`Liên hệ: ${list(o.contact)} → ${list(n.contact)}`);
  if (!same(o.pageContact, n.pageContact)) out.push(`Liên hệ Page: ${list(o.pageContact)} → ${list(n.pageContact)}`);
  out.push(...accountLines(o.accounts, n.accounts));
  if ((o.model ?? '') !== (n.model ?? '')) out.push(`Model: ${text(o.model)} → ${text(n.model)}`);
  if ((o.outputDir ?? '') !== (n.outputDir ?? '')) out.push(`Thư mục lưu: ${text(o.outputDir)} → ${text(n.outputDir)}`);
  return out;
}

// Gồm cả persona.md / content-types.md (so văn bản; null = không có file).
export function diffProfile(oldP, newP) {
  const out = diffConfig(oldP?.cfg, newP?.cfg);
  if ((oldP?.persona ?? null) !== (newP?.persona ?? null)) out.push('Persona: đã sửa');
  if ((oldP?.contentTypes ?? null) !== (newP?.contentTypes ?? null)) out.push('Kiểu bài: đã sửa');
  return out;
}
