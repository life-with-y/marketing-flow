import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEGMENT_KEYS } from './clusters.mjs';

export class ConfigError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'ConfigError';
    this.field = field;
  }
}

export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
export const LINK_KINDS = ['page', 'wall', 'threads', 'group'];
export const PRICE_STYLE_KINDS = ['page', 'wall', 'threads', 'group'];
export const PRICE_STYLES = ['full', 'masked'];

export function validateConfig(cfg) {
  const errors = [];
  if (!isObj(cfg)) return ['config phải là một object'];
  if (typeof cfg.apiBaseUrl !== 'string' || !cfg.apiBaseUrl) {
    errors.push('apiBaseUrl: bắt buộc, phải là chuỗi');
  }
  if (!Array.isArray(cfg.schedule)) {
    errors.push('schedule: phải là danh sách giờ "HH:MM"');
  } else {
    cfg.schedule.forEach((t, i) => {
      if (typeof t !== 'string' || !TIME_RE.test(t)) {
        errors.push(`schedule[${i}]: giờ "${t}" không hợp lệ, dùng "HH:MM" 24 giờ`);
      }
    });
  }
  const accounts = Array.isArray(cfg.accounts) ? cfg.accounts : [];
  if (!Array.isArray(cfg.accounts)) errors.push('accounts: phải là danh sách');
  const ids = new Set(accounts.map((a) => a && a.id));
  if (cfg.variants !== undefined) {
    if (!isObj(cfg.variants)) {
      errors.push('variants: phải là object');
    } else {
      for (const [k, v] of Object.entries(cfg.variants)) {
        if (!Number.isInteger(v) || v < 1 || v > 3) {
          errors.push(`variants.${k}: phải là số nguyên từ 1 đến 3`);
        }
      }
    }
  }
  if (cfg.links !== undefined) {
    if (!isObj(cfg.links)) {
      errors.push(`links: phải là object { ${LINK_KINDS.join(', ')} } với giá trị true/false`);
    } else {
      for (const [k, v] of Object.entries(cfg.links)) {
        if (!LINK_KINDS.includes(k)) errors.push(`links.${k}: chỉ nhận ${LINK_KINDS.join(', ')}`);
        else if (typeof v !== 'boolean') errors.push(`links.${k}: phải là true hoặc false`);
      }
    }
  }
  if (cfg.priceStyle !== undefined) {
    if (!isObj(cfg.priceStyle)) {
      errors.push(`priceStyle: phải là object { ${PRICE_STYLE_KINDS.join(', ')} } với giá trị "full" hoặc "masked"`);
    } else {
      for (const [k, v] of Object.entries(cfg.priceStyle)) {
        if (!PRICE_STYLE_KINDS.includes(k)) errors.push(`priceStyle.${k}: chỉ nhận ${PRICE_STYLE_KINDS.join(', ')}`);
        else if (!PRICE_STYLES.includes(v)) errors.push(`priceStyle.${k}: phải là "full" hoặc "masked"`);
      }
    }
  }
  if (cfg.perSlot !== undefined) {
    if (!isObj(cfg.perSlot)) {
      errors.push('perSlot: phải là object');
    } else {
      for (const [k, v] of Object.entries(cfg.perSlot)) {
        if (!ids.has(k)) errors.push(`perSlot.${k}: "${k}" không có trong accounts`);
        else if (!Number.isInteger(v) || v < 0 || v > 5) errors.push(`perSlot.${k}: phải là số nguyên từ 0 đến 5`);
      }
    }
  }
  if (Array.isArray(cfg.groups) && cfg.groups.length) {
    errors.push('groups: đã thay bằng clusters (cụm nhóm); chuyển nhóm sang clusters[].groups');
  }
  if (cfg.clusters !== undefined && !Array.isArray(cfg.clusters)) {
    errors.push('clusters: phải là danh sách');
  } else {
    const seen = new Map();
    (cfg.clusters || []).forEach((c, i) => {
      const at = `clusters[${i}]`;
      if (!isObj(c)) { errors.push(`${at}: phải là object`); return; }
      if (typeof c.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(c.id)) {
        errors.push(`${at}.id: bắt buộc, chỉ chữ thường, số và "-"`);
      } else if (seen.has(c.id)) {
        errors.push(`${at}.id: trùng với clusters[${seen.get(c.id)}]`);
      } else seen.set(c.id, i);
      if (typeof c.name !== 'string' || !c.name.trim()) errors.push(`${at}.name: bắt buộc`);
      if (!ids.has(c.account)) errors.push(`${at}.account: "${c.account}" không có trong accounts`);
      if (c.segment !== undefined && !SEGMENT_KEYS.includes(c.segment)) errors.push(`${at}.segment: chỉ nhận ${SEGMENT_KEYS.join(', ')}`);
      if (c.districts !== undefined && (!Array.isArray(c.districts) || c.districts.some((d) => typeof d !== 'string'))) {
        errors.push(`${at}.districts: phải là danh sách tên quận`);
      }
      if (!Array.isArray(c.days) || c.days.some((d) => !DAYS.includes(d))) {
        errors.push(`${at}.days: chỉ nhận ${DAYS.join(', ')}`);
      }
      if (c.slots !== undefined && !Array.isArray(c.slots)) {
        errors.push(`${at}.slots: phải là danh sách giờ "HH:MM"`);
      } else if (c.slots !== undefined) {
        c.slots.forEach((t, j) => {
          if (typeof t !== 'string' || !TIME_RE.test(t)) {
            errors.push(`${at}.slots[${j}]: giờ "${t}" không hợp lệ, dùng "HH:MM" 24 giờ`);
          } else if (Array.isArray(cfg.schedule) && !cfg.schedule.includes(t)) {
            errors.push(`${at}.slots[${j}]: giờ "${t}" không nằm trong schedule`);
          }
        });
      }
      if (c.keywords !== undefined && (!Array.isArray(c.keywords) || c.keywords.some((k) => typeof k !== 'string'))) {
        errors.push(`${at}.keywords: phải là danh sách chuỗi`);
      }
      if (c.groups !== undefined && !Array.isArray(c.groups)) {
        errors.push(`${at}.groups: phải là danh sách`);
      } else if (c.groups !== undefined) {
        const urls = new Map();
        c.groups.forEach((g, j) => {
          const gat = `${at}.groups[${j}]`;
          if (!isObj(g)) { errors.push(`${gat}: phải là object`); return; }
          if (typeof g.url !== 'string' || !/^https?:\/\/\S+$/i.test(g.url.trim())) {
            errors.push(`${gat}.url: bắt buộc, phải là link http(s)`);
          } else {
            const key = g.url.trim().replace(/\/+$/, '').toLowerCase();
            if (urls.has(key)) errors.push(`${gat}.url: trùng link với ${at}.groups[${urls.get(key)}]`);
            else urls.set(key, j);
          }
          if (g.joined !== undefined && typeof g.joined !== 'boolean') errors.push(`${gat}.joined: phải là true hoặc false`);
          for (const k of ['members', 'interactions']) {
            if (g[k] !== undefined && !(Number.isInteger(g[k]) && g[k] >= 0)) errors.push(`${gat}.${k}: phải là số nguyên ≥ 0`);
          }
        });
      }
    });
  }
  return errors;
}

const CLUSTER_DEFAULTS = {
  active: true,
  language: 'vi',
  segment: 'room',
  days: DAYS,
  districts: [],
  keywords: [],
  groups: [],
  note: '',
};

function readJson(file, label, missingMsg) {
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT' && missingMsg) throw new ConfigError(missingMsg, label);
    throw new ConfigError(`${label} không đọc được: ${e.message}`, label);
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new ConfigError(`${label} không đọc được: ${e.message}`, label);
  }
}

function merge(def, user) {
  const out = { ...def, ...user };
  for (const k of ['variants', 'perSlot', 'links', 'priceStyle']) {
    if (isObj(def[k]) && isObj(user[k])) out[k] = { ...def[k], ...user[k] };
  }
  if (isObj(def.feedback) && isObj(user.feedback)) {
    out.feedback = {
      ...def.feedback,
      ...user.feedback,
      fields: { ...def.feedback.fields, ...(user.feedback.fields || {}) },
    };
  }
  if (user.channelMix == null) out.channelMix = def.channelMix ?? null;
  return out;
}

export function loadConfig(dir, { root = PLUGIN_ROOT } = {}) {
  const def = readJson(path.join(root, 'rules', 'templates', 'config.default.json'), 'config.default.json');
  const user = readJson(path.join(dir, 'config.json'), 'config.json', 'Chưa có config.json, chạy /hm-setup');
  if (!isObj(user)) throw new ConfigError('config.json không đọc được: phải là object', 'config.json');
  const cfg = merge(def, user);
  if (Array.isArray(cfg.clusters)) {
    cfg.clusters = cfg.clusters.map((c) => (isObj(c) ? { ...CLUSTER_DEFAULTS, slots: [...(cfg.schedule || [])], ...c } : c));
  }
  const errors = validateConfig(cfg);
  if (errors.length) {
    const field = errors[0].split(':')[0];
    throw new ConfigError(`config.json sai: ${errors.join('; ')}`, field);
  }
  return cfg;
}

export function loadToken(dir) {
  const msg = 'Chưa cài token, chạy /hm-setup';
  let data;
  try {
    data = JSON.parse(fs.readFileSync(path.join(dir, 'secrets.json'), 'utf8'));
  } catch {
    throw new ConfigError(msg, 'token');
  }
  if (!isObj(data) || typeof data.token !== 'string' || !data.token) {
    throw new ConfigError(msg, 'token');
  }
  return data.token;
}
