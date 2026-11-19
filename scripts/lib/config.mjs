import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
  if (!Array.isArray(cfg.groups)) {
    errors.push('groups: phải là danh sách');
  } else {
    cfg.groups.forEach((g, i) => {
      if (!isObj(g)) {
        errors.push(`groups[${i}]: phải là object`);
        return;
      }
      if (!ids.has(g.account)) {
        errors.push(`groups[${i}].account: "${g.account}" không có trong accounts`);
      }
      if (!Array.isArray(g.days) || g.days.some((d) => !DAYS.includes(d))) {
        errors.push(`groups[${i}].days: chỉ nhận ${DAYS.join(', ')}`);
      }
      if (g.slots !== undefined) {
        if (!Array.isArray(g.slots) || g.slots.some((t) => typeof t !== 'string' || !TIME_RE.test(t))) {
          errors.push(`groups[${i}].slots: giờ phải dạng "HH:MM" 24 giờ`);
        }
      }
    });
  }
  return errors;
}

const GROUP_DEFAULTS = {
  active: true,
  language: 'vi',
  days: DAYS,
  districts: [],
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
  for (const k of ['variants', 'perSlot']) {
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
  if (Array.isArray(cfg.groups)) {
    cfg.groups = cfg.groups.map((g) => (isObj(g) ? { ...GROUP_DEFAULTS, ...g } : g));
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
