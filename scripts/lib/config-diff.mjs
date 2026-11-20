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
const SEG = { room: 'phòng trọ', student: 'sinh viên, giá rẻ', apartment: 'căn hộ mini' };
const seg = (v) => SEG[v ?? 'room'] || String(v);
const gkey = (g) => String(g?.url || g?.name || '').trim().replace(/\/+$/, '').toLowerCase();

function groupLines(nm, oldGroups, newGroups) {
  const out = [];
  const og = arr(oldGroups).filter((g) => g && typeof g === 'object');
  const ng = arr(newGroups).filter((g) => g && typeof g === 'object');
  const oldBy = new Map(og.map((g) => [gkey(g), g]));
  const newBy = new Map(ng.map((g) => [gkey(g), g]));
  for (const g of ng) {
    const o = oldBy.get(gkey(g));
    const gn = g.name || g.url;
    if (!o) out.push(`Cụm ${nm}: thêm nhóm ${gn}`);
    else if ((o.joined === true) !== (g.joined === true)) out.push(`Cụm ${nm}: ${g.joined === true ? 'đã vào' : 'chưa vào'} nhóm ${gn}`);
  }
  for (const g of og) if (!newBy.has(gkey(g))) out.push(`Cụm ${nm}: bỏ nhóm ${g.name || g.url}`);
  return out;
}

function clusterLines(oldCs, newCs) {
  const out = [];
  const oc = arr(oldCs).filter((c) => c && typeof c === 'object');
  const nc = arr(newCs).filter((c) => c && typeof c === 'object');
  const oldBy = new Map(oc.map((c) => [String(c.id), c]));
  const newBy = new Map(nc.map((c) => [String(c.id), c]));
  for (const c of nc) {
    const o = oldBy.get(String(c.id));
    const nm = c.name || c.id;
    if (!o) { out.push(`Cụm ${nm}: thêm mới`); continue; }
    if ((o.name ?? '') !== (c.name ?? '')) out.push(`Cụm ${text(o.name)}: đổi tên → ${text(c.name)}`);
    if ((o.active !== false) !== (c.active !== false)) out.push(`Cụm ${nm}: ${state(o.active)} → ${state(c.active)}`);
    if (!same(o.slots, c.slots)) out.push(`Cụm ${nm}: khung ${slotsText(o)} → ${slotsText(c)}`);
    if (days(o.days) !== days(c.days)) out.push(`Cụm ${nm}: ngày ${days(o.days)} → ${days(c.days)}`);
    if ((o.language ?? 'vi') !== (c.language ?? 'vi')) out.push(`Cụm ${nm}: ngôn ngữ ${lang(o.language)} → ${lang(c.language)}`);
    if (list(o.districts) !== list(c.districts)) out.push(`Cụm ${nm}: quận ${list(o.districts)} → ${list(c.districts)}`);
    if (seg(o.segment) !== seg(c.segment)) out.push(`Cụm ${nm}: phân khúc ${seg(o.segment)} → ${seg(c.segment)}`);
    if (list(o.keywords) !== list(c.keywords)) out.push(`Cụm ${nm}: từ khoá ${list(o.keywords)} → ${list(c.keywords)}`);
    if ((o.note ?? '') !== (c.note ?? '')) out.push(`Cụm ${nm}: ghi chú ${text(o.note)} → ${text(c.note)}`);
    if ((o.account ?? '') !== (c.account ?? '')) out.push(`Cụm ${nm}: tài khoản ${text(o.account)} → ${text(c.account)}`);
    out.push(...groupLines(nm, o.groups, c.groups));
  }
  for (const c of oc) if (!newBy.has(String(c.id))) out.push(`Cụm ${c.name || c.id}: bỏ`);
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
  out.push(...clusterLines(o.clusters, n.clusters));
  const label = (id) => arr(n.accounts).concat(arr(o.accounts)).find((a) => a && a.id === id)?.label || id;
  out.push(...mapLines('Số bài mỗi khung', o.perSlot, n.perSlot, label));
  out.push(...mapLines('Số bản', o.variants, n.variants));
  // Thiếu khoá = mặc định (tắt link, giá đầy đủ), để chỉ báo khi thật sự đổi.
  const both = (a, b, f) => {
    const ks = new Set([...Object.keys(a && typeof a === 'object' ? a : {}), ...Object.keys(b && typeof b === 'object' ? b : {})]);
    const m = (x) => Object.fromEntries([...ks].map((k) => [k, f(x?.[k])]));
    return [m(a), m(b)];
  };
  const kindName = (k) => ({ page: 'Page', wall: 'Tường', threads: 'Threads', group: 'Nhóm' }[k] ?? k);
  out.push(...mapLines('Link homematch.vn', ...both(o.links, n.links, (v) => (v === true ? 'bật' : 'tắt')), kindName));
  out.push(...mapLines('Giá', ...both(o.priceStyle, n.priceStyle, (v) => (v === 'masked' ? 'ẩn giá' : 'đầy đủ')), kindName));
  if (!same(o.contact, n.contact)) out.push(`Liên hệ: ${list(o.contact)} → ${list(n.contact)}`);
  if (!same(o.pageContact, n.pageContact)) out.push(`Liên hệ Page: ${list(o.pageContact)} → ${list(n.pageContact)}`);
  out.push(...accountLines(o.accounts, n.accounts));
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
