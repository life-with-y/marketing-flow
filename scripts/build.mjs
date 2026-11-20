import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { profileDir } from './lib/paths.mjs';
import { loadConfig, ConfigError } from './lib/config.mjs';
import { validatePosts } from './lib/posts.mjs';
import { downloadPosts } from './lib/download.mjs';
import { writeHome, homeOutputDir } from './lib/render-home.mjs';
import { appendPrepared } from './lib/prepared.mjs';
import { openFolder, notify } from './lib/os.mjs';

const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SLOT_RE = /^\d{4}-\d{2}-\d{2}_\d{4}$/;
const RANK = ['NEW', 'PRICE_DOWN', 'NOW_AVAILABLE', 'UNCHANGED', 'PRICE_UP'];

function readJson(file, what) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { return { error: `Không thấy ${what}: ${file}` }; }
  try { return { value: JSON.parse(text) }; } catch { return { error: `${what} không phải JSON hợp lệ: ${file}` }; }
}

function strongestLabel(codes, listings) {
  let best = null;
  for (const c of codes) {
    const l = listings.get(c)?.label;
    if (l && (best === null || RANK.indexOf(l) < RANK.indexOf(best))) best = l;
  }
  return best;
}

export async function runBuild({
  home = os.homedir(),
  slot,
  fetchImpl = fetch,
  platform = process.platform,
  now = new Date(),
  root = PLUGIN_ROOT,
  spawnImpl,
  warn = (m) => console.error(m),
  writeHomeImpl = writeHome,
} = {}) {
  if (!SLOT_RE.test(String(slot ?? ''))) {
    return { exitCode: 2, report: `Mã khung "${slot}" không hợp lệ, dùng dạng 2026-11-19_1100` };
  }
  const dir = profileDir(home);
  let cfg;
  try {
    cfg = loadConfig(dir, { root });
  } catch (e) {
    if (e instanceof ConfigError) return { exitCode: 2, report: e.message };
    throw e;
  }
  const runDir = path.join(dir, 'runs', slot);
  const inp = readJson(path.join(runDir, 'input.json'), 'input.json');
  if (inp.error) return { exitCode: 2, report: inp.error };
  const pj = readJson(path.join(runDir, 'posts.json'), 'posts.json');
  if (pj.error) return { exitCode: 2, report: pj.error };
  const input = inp.value;
  const postsDoc = pj.value;

  // Xoá dữ liệu trang cũ trước: lần chạy lỗi (exit 5/6) không để lại bài của lần trước trên trang chủ.
  // index.html riêng của khung (bản cũ) cũng bỏ: trang chủ <outputDir>/index.html thay thế.
  const outputDir = homeOutputDir(cfg, home);
  const outDir = path.join(outputDir, slot);
  fs.rmSync(path.join(outDir, 'page-data.json'), { force: true });
  fs.rmSync(path.join(outDir, 'index.html'), { force: true });

  // Trang chủ không được liệt kê khung vừa bị xoá dữ liệu; lỗi dựng trang không che lỗi chính.
  const refreshHome = () => { try { writeHomeImpl({ dir, cfg, home, now, root, pending: input.library?.pending ?? [] }); } catch { /* bỏ qua */ } };

  const { errors } = validatePosts(postsDoc, input);
  if (errors.length) {
    refreshHome();
    const lines = errors.map((e, i) => `${i + 1}. ${e.message}`);
    return { exitCode: 5, report: `posts.json có ${errors.length} lỗi, sửa rồi chạy lại:\n${lines.join('\n')}` };
  }

  const dl = await downloadPosts({ posts: postsDoc, input, outRoot: outDir, fetchImpl });
  if (dl.needsReplacement.length) {
    refreshHome();
    const lines = dl.needsReplacement.map((n, i) => `${i + 1}. ${n.targetId}: ${n.reason}`);
    return {
      exitCode: 6,
      needsReplacement: dl.needsReplacement,
      report: `${dl.needsReplacement.length} bài cần thay tin (thiếu ảnh), thay một lần rồi chạy lại:\n${lines.join('\n')}`,
    };
  }

  const listings = new Map((input.listings || []).map((l) => [l.code, l]));
  const source = postsDoc.posts;
  const posts = dl.posts.map((p) => {
    const src = source[p.n - 1];
    return { ...p, postCodes: src.postCodes, type: src.type, label: strongestLabel(src.postCodes, listings) };
  });

  const lib = input.library || {};
  const usedTargets = new Set([...posts.map((p) => p.targetId), ...(Array.isArray(postsDoc.skipped) ? postsDoc.skipped.map((x) => x?.targetId) : [])]);
  const targetList = (input.targets || []).filter((t) => usedTargets.has(t.id));
  const usedAccounts = new Set(targetList.map((t) => t.account));
  const pageData = {
    slot,
    generatedAt: now.toISOString(),
    outDir,
    posts,
    targets: targetList,
    accounts: (cfg.accounts || []).filter((a) => usedAccounts.has(a.id)).map(({ id, type, label }) => ({ id, type, label })),
    skipped: Array.isArray(postsDoc.skipped) ? postsDoc.skipped : [],
    pending: Array.isArray(lib.pending) ? lib.pending : [],
    notes: Array.isArray(lib.errors) ? lib.errors : [],
  };
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'page-data.json'), JSON.stringify(pageData, null, 2), 'utf8');

  const targets = new Map((input.targets || []).map((t) => [t.id, t]));
  appendPrepared(dir, posts.map((p) => ({
    slot,
    account: targets.get(p.targetId)?.account,
    target: p.targetId,
    postCodes: p.postCodes,
    type: p.type,
  })), now);

  let homePage = null;
  try {
    homePage = writeHomeImpl({ dir, cfg, home, now, root, pending: pageData.pending });
  } catch (e) {
    warn(`Cảnh báo: không dựng được trang chủ ${path.join(outputDir, 'index.html')} (${e.message}). Bài vẫn ở ${outDir}`);
  }
  const shown = homePage ?? outDir;

  const extra = spawnImpl ? [spawnImpl] : [];
  openFolder(outDir, platform, ...extra);
  const hhmm = `${slot.slice(11, 13)}:${slot.slice(13, 15)}`;
  notify('HomeMatch', `Đã soạn ${posts.length} bài lúc ${hhmm}: ${shown}`, platform, ...extra);
  return { exitCode: 0, outDir, homePage, report: `Đã soạn ${posts.length} bài lúc ${hhmm}: ${shown}` };
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) if (argv[i] === '--slot') out.slot = argv[++i];
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const res = await runBuild(parseArgs(process.argv.slice(2)));
  (res.exitCode === 0 ? console.log : console.error)(res.report);
  process.exit(res.exitCode);
}
