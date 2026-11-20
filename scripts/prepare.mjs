import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { profileDir } from './lib/paths.mjs';
import { loadConfig, loadToken, ConfigError } from './lib/config.mjs';
import { fetchListings, ApiError } from './lib/api.mjs';
import { normalizeListings } from './lib/listings.mjs';
import { saveSnapshot, latestSnapshot } from './lib/snapshot.mjs';
import { labelListings } from './lib/diff.mjs';
import { targetsForSlot, fold } from './lib/targets.mjs';
import { lastPreparedMap } from './lib/prepared.mjs';
import { fetchSheet, loadLeads } from './lib/sheet.mjs';
import { platformGuidePaths } from './lib/platforms.mjs';

const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RANK = ['NEW', 'PRICE_DOWN', 'NOW_AVAILABLE', 'UNCHANGED'];
const rankOf = (label) => RANK.indexOf(label === 'PRICE_UP' ? 'UNCHANGED' : label);
const LATE_MS = 90 * 60 * 1000;
const EARLY_MS = 10 * 60 * 1000;
const p2 = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

const API_MSG = {
  auth: 'Token không hợp lệ, xin admin token mới',
  network: 'Không gọi được API HomeMatch, thử lại sau',
  schema: 'Dữ liệu API không đúng định dạng',
};

function leadMatches(listing, leads) {
  const demands = leads && Array.isArray(leads.demands) ? leads.demands : [];
  const minPrice = Math.min(...listing.rooms.map((r) => r.price));
  return demands.some((d) => {
    if (!d || fold(d.district) !== fold(listing.district)) return false;
    return d.maxPrice == null || minPrice <= d.maxPrice;
  });
}

function pickPath(dir, root, personal, template) {
  const own = path.join(dir, personal);
  return fs.existsSync(own) ? own : path.join(root, 'rules', 'templates', template);
}

export async function runPrepare({
  home = os.homedir(),
  now = new Date(),
  slot,
  onlyGroups,
  fetchImpl = fetch,
  retryDelayMs = 30000,
  root = PLUGIN_ROOT,
} = {}) {
  const dir = profileDir(home);
  let cfg;
  let token;
  try {
    cfg = loadConfig(dir, { root });
    token = loadToken(dir);
  } catch (e) {
    if (e instanceof ConfigError) return { exitCode: 2, message: e.message };
    throw e;
  }

  let hhmm = null;
  let slotTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes());
  if (slot) {
    const m = /^(\d{2}):(\d{2})$/.exec(slot);
    if (!m) return { exitCode: 2, message: `Giờ khung "${slot}" không hợp lệ, dùng "HH:MM"` };
    if (!(cfg.schedule || []).includes(slot)) return { exitCode: 4, message: `Khung ${slot} không còn trong lịch` };
    hhmm = slot;
    slotTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), Number(m[1]), Number(m[2]));
    // Khung còn xa hơn 10 phút ở tương lai: đây là khung của hôm qua (chạy qua nửa đêm).
    if (slotTime - now > EARLY_MS) {
      slotTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, Number(m[1]), Number(m[2]));
    }
    if (now - slotTime > LATE_MS) {
      return { exitCode: 3, message: `Khung ${slot} đã lỡ (trễ quá 90 phút), bỏ qua` };
    }
  }
  const slotId = `${ymd(slotTime)}_${p2(slotTime.getHours())}${p2(slotTime.getMinutes())}`;

  const targets = targetsForSlot(cfg, slotTime, hhmm, onlyGroups);
  if (!targets.length) return { exitCode: 4, message: 'Không có đích nào cần đăng hôm nay' };

  const call = () => fetchListings({ baseUrl: cfg.apiBaseUrl, token, fetchImpl });
  let fetched;
  try {
    try {
      fetched = await call();
    } catch (e) {
      if (!(e instanceof ApiError) || e.kind !== 'network') throw e;
      await new Promise((r) => setTimeout(r, retryDelayMs));
      fetched = await call();
    }
  } catch (e) {
    if (e instanceof ApiError) return { exitCode: 2, message: API_MSG[e.kind] || e.message };
    throw e;
  }

  const current = normalizeListings(fetched);
  const labeled = labelListings(latestSnapshot(dir, slotId), current);
  saveSnapshot(dir, slotId, current);

  const prepared = lastPreparedMap(dir);
  const leads = loadLeads(dir, ymd(now));
  const listings = labeled
    .map((l) => {
      const lastPrepared = {};
      for (const t of targets) {
        const iso = prepared.get(`${t.id}|${l.code}`);
        if (iso) lastPrepared[t.id] = iso;
      }
      return { ...l, eligible: l.images.length >= 3, lastPrepared, _lead: leadMatches(l, leads) };
    })
    .sort((a, b) => (b._lead - a._lead) || (rankOf(a.label) - rankOf(b.label)))
    .map(({ _lead, ...l }) => l);

  const lib = cfg.library || {};
  const [approved, trends, pending] = await Promise.all(
    [lib.approvedCsvUrl, lib.trendsCsvUrl, lib.pendingCsvUrl].map((u) => fetchSheet(u, fetchImpl)),
  );
  const errors = [['Trends', trends], ['Bài mẫu', approved], ['Cần tìm hiểu', pending]]
    .filter(([, r]) => r.error)
    .map(([n, r]) => `${n}: ${r.error}`);

  const input = {
    slot: slotId,
    generatedAt: now.toISOString(),
    targets,
    listings,
    leads,
    library: { approved: approved.rows, trends: trends.rows, pending: pending.rows, errors },
    paths: {
      hardRules: path.join(root, 'rules', 'hard-rules.md'),
      selection: path.join(root, 'rules', 'selection.md'),
      channelFormat: path.join(root, 'rules', 'channel-format.md'),
      persona: pickPath(dir, root, 'persona.md', 'persona.example.md'),
      contentTypes: pickPath(dir, root, 'content-types.md', 'content-types.example.md'),
      channelMix: fs.existsSync(path.join(dir, 'channel-mix.md')) ? path.join(dir, 'channel-mix.md') : null,
      platforms: platformGuidePaths(dir, root),
    },
    contact: cfg.contact || [],
    pageContact: cfg.pageContact || [],
  };
  const runDir = path.join(dir, 'runs', slotId);
  fs.mkdirSync(runDir, { recursive: true });
  const inputPath = path.join(runDir, 'input.json');
  fs.writeFileSync(inputPath, JSON.stringify(input, null, 2));
  return { exitCode: 0, inputPath, slot: slotId, message: `Đã chuẩn bị khung ${slotId}: ${inputPath}` };
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--slot') out.slot = argv[++i];
    else if (argv[i] === '--only') out.onlyGroups = String(argv[++i] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const res = await runPrepare(parseArgs(process.argv.slice(2)));
  (res.exitCode === 0 ? console.log : console.error)(res.message);
  process.exit(res.exitCode);
}
