import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runBuild } from '../scripts/build.mjs';
import { writeHome } from '../scripts/lib/render-home.mjs';
import { openFolder, notify } from '../scripts/lib/os.mjs';

let server, base;
before(async () => {
  server = http.createServer((req, res) => {
    if (req.url.startsWith('/ok')) { res.setHeader('content-type', 'image/jpeg'); res.end(Buffer.from('JPG' + req.url)); }
    else { res.statusCode = 404; res.end('no'); }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const SLOT = '2026-11-19_1100';
function mk({ badImages = false } = {}) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'hm-build-'));
  const dir = path.join(home, '.homematch-marketing');
  const runDir = path.join(dir, 'runs', SLOT);
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({
    apiBaseUrl: 'https://api.example.test',
    outputDir: path.join(home, 'out'),
    accounts: [{ id: 'fb1', type: 'fb-personal', label: 'FB Minh' }],
    groups: [{ name: 'Phòng trọ Cầu Giấy', url: 'https://fb/g1', account: 'fb1' }],
  }));
  fs.writeFileSync(path.join(dir, 'secrets.json'), JSON.stringify({ token: 'sekret-token' }));
  const img = (i) => ({ url: `${base}/${badImages && i > 0 ? 'bad' : 'ok'}/${i}`, isCover: i === 0 });
  const input = {
    slot: SLOT,
    targets: [{ id: 'group:https://fb/g1', kind: 'group', account: 'fb1', name: 'Phòng trọ Cầu Giấy', url: 'https://fb/g1', variants: 1, language: 'vi' }],
    listings: [{ code: 'T1', link: 'https://homematch.vn/t1', label: 'NEW', eligible: true, imageCount: 3, rooms: [{ room: '1', price: 3800000, priceText: '3,8 triệu' }], images: [0, 1, 2].map(img) }],
    library: { approved: [], trends: [], pending: ['Liên hệ nhóm chưa chốt'], errors: ['Trends: lỗi'] },
  };
  const posts = {
    slot: SLOT,
    posts: [{ targetId: input.targets[0].id, type: 'Phòng mới', postCodes: ['T1'], variants: [{ key: 'A', text: 'Cầu Giấy 3,8 triệu, nhắn mình.', comment: 'Chi tiết và ảnh: https://homematch.vn/t1', images: input.listings[0].images.map((i) => i.url) }] }],
    skipped: [],
  };
  fs.writeFileSync(path.join(runDir, 'input.json'), JSON.stringify(input));
  fs.writeFileSync(path.join(runDir, 'posts.json'), JSON.stringify(posts));
  return { home, dir, runDir, posts, input };
}

test('success: page-data.json + home index.html, no per-slot index, prepared lines, exit 0', async () => {
  const { home, dir } = mk();
  const r = await runBuild({ home, slot: SLOT, platform: 'test', now: new Date(2026, 10, 19, 11, 3) });
  assert.equal(r.exitCode, 0, r.report);
  const homePage = path.join(home, 'out', 'index.html');
  assert.equal(r.report, `Đã soạn 1 bài lúc 11:00: ${homePage}`);
  assert.equal(r.outDir, path.join(home, 'out', SLOT));
  assert.ok(!fs.existsSync(path.join(home, 'out', SLOT, 'index.html')));
  const data = JSON.parse(fs.readFileSync(path.join(home, 'out', SLOT, 'page-data.json'), 'utf8'));
  assert.equal(data.slot, SLOT);
  assert.equal(data.generatedAt, new Date(2026, 10, 19, 11, 3).toISOString());
  assert.equal(data.posts.length, 1);
  assert.deepEqual([data.posts[0].type, data.posts[0].label, data.posts[0].postCodes], ['Phòng mới', 'NEW', ['T1']]);
  assert.deepEqual(data.posts[0].variants[0].files, ['1.jpg', '2.jpg', '3.jpg']);
  assert.equal(data.posts[0].variants[0].comment, 'Chi tiết và ảnh: https://homematch.vn/t1');
  assert.deepEqual(data.targets.map((t) => t.id), ['group:https://fb/g1']);
  assert.deepEqual(data.accounts, [{ id: 'fb1', type: 'fb-personal', label: 'FB Minh' }]);
  assert.deepEqual([data.skipped, data.pending, data.notes], [[], ['Liên hệ nhóm chưa chốt'], ['Trends: lỗi']]);
  assert.ok(!JSON.stringify(data).includes('sekret-token'));
  const html = fs.readFileSync(homePage, 'utf8');
  assert.ok(html.includes('Cầu Giấy 3,8 triệu'));
  assert.ok(html.includes('Trends: lỗi'));
  assert.ok(html.includes('Liên hệ nhóm chưa chốt'));
  assert.ok(html.includes(`src="${SLOT}/01_phong-tro-cau-giay_T1/1.jpg"`));
  assert.ok(html.includes('Kiểu bài') && html.includes('Phòng nổi bật'));
  assert.ok(!html.includes('sekret-token'));
  const lines = fs.readFileSync(path.join(dir, 'prepared.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(lines.length, 1);
  assert.deepEqual([lines[0].slot, lines[0].account, lines[0].postCodes, lines[0].type], [SLOT, 'fb1', ['T1'], 'Phòng mới']);
  assert.ok(fs.existsSync(path.join(home, 'out', SLOT, '01_phong-tro-cau-giay_T1', '1.jpg')));
});

test('home lists earlier slots too, newest first', async () => {
  const { home, runDir, input, posts } = mk();
  assert.equal((await runBuild({ home, slot: SLOT, platform: 'test' })).exitCode, 0);
  const S2 = '2026-11-20_1014';
  const r2 = path.join(path.dirname(runDir), S2);
  fs.mkdirSync(r2, { recursive: true });
  fs.writeFileSync(path.join(r2, 'input.json'), JSON.stringify({ ...input, slot: S2 }));
  fs.writeFileSync(path.join(r2, 'posts.json'), JSON.stringify({ ...posts, slot: S2 }));
  assert.equal((await runBuild({ home, slot: S2, platform: 'test' })).exitCode, 0);
  const html = fs.readFileSync(path.join(home, 'out', 'index.html'), 'utf8');
  const opts = [...html.matchAll(/<option value="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(opts, [S2, SLOT]);
});

test('wrong price: exit 5, numbered errors, nothing written', async () => {
  const { home, dir, runDir, posts } = mk();
  posts.posts[0].variants[0].text = 'Cầu Giấy 3tr8';
  fs.writeFileSync(path.join(runDir, 'posts.json'), JSON.stringify(posts));
  const r = await runBuild({ home, slot: SLOT, platform: 'test' });
  assert.equal(r.exitCode, 5);
  assert.match(r.report, /^1\. /m);
  assert.ok(!fs.existsSync(path.join(home, 'out', SLOT, 'page-data.json')));
  assert.ok(!fs.existsSync(path.join(dir, 'prepared.jsonl')));
});

test('image failures: exit 6, needsReplacement listed, no index/prepared', async () => {
  const { home, dir } = mk({ badImages: true });
  const r = await runBuild({ home, slot: SLOT, platform: 'test' });
  assert.equal(r.exitCode, 6);
  assert.ok(r.report.includes('group:https://fb/g1'));
  assert.ok(!fs.existsSync(path.join(home, 'out', SLOT, 'page-data.json')));
  assert.ok(!fs.existsSync(path.join(dir, 'prepared.jsonl')));
});

test('bad slot and missing files exit 2', async () => {
  const { home } = mk();
  assert.equal((await runBuild({ home, slot: '../x', platform: 'test' })).exitCode, 2);
  assert.equal((await runBuild({ home, slot: '2026-01-01_0900', platform: 'test' })).exitCode, 2);
});

test('os helpers: no-op on test platform, args arrays on darwin/win32, never throw', () => {
  const calls = [];
  const spy = (cmd, args, opts) => { calls.push([cmd, args, opts]); return { on() {}, unref() {} }; };
  openFolder('/x y', 'test', spy); notify('t', 'b', 'linux', spy);
  assert.equal(calls.length, 0);
  openFolder('/x "y"', 'darwin', spy);
  assert.deepEqual(calls[0].slice(0, 2), ['open', ['/x "y"']]);
  notify('HomeMatch', 'Đã soạn 3 bài lúc 11:00', 'darwin', spy);
  assert.equal(calls[1][0], 'osascript');
  assert.ok(calls[1][1].includes('Đã soạn 3 bài lúc 11:00'));
  openFolder('C:\\o', 'win32', spy);
  assert.deepEqual(calls[2].slice(0, 2), ['explorer', ['C:\\o']]);
  notify('HomeMatch', 'b', 'win32', spy);
  assert.equal(calls[3][2].env.HM_BODY, 'b');
  assert.ok(calls.every((c) => c[2].windowsHide === true));
  const boom = () => { throw new Error('x'); };
  assert.doesNotThrow(() => { openFolder('/a', 'darwin', boom); notify('a', 'b', 'darwin', boom); });
});

test('rebuild lỗi (exit 6 / exit 5) xoá page-data.json cũ', async () => {
  const { home, runDir, input, posts } = mk();
  const page = path.join(home, 'out', SLOT, 'page-data.json');
  assert.equal((await runBuild({ home, slot: SLOT, platform: 'test' })).exitCode, 0);
  assert.ok(fs.existsSync(page));
  const bad = structuredClone(input);
  bad.listings[0].images = [0, 1, 2].map((i) => ({ url: `${base}/${i > 0 ? 'bad' : 'ok'}/${i}`, isCover: i === 0 }));
  fs.writeFileSync(path.join(runDir, 'input.json'), JSON.stringify(bad));
  const p6 = structuredClone(posts);
  p6.posts[0].variants[0].images = bad.listings[0].images.map((i) => i.url);
  fs.writeFileSync(path.join(runDir, 'posts.json'), JSON.stringify(p6));
  assert.equal((await runBuild({ home, slot: SLOT, platform: 'test' })).exitCode, 6);
  assert.ok(!fs.existsSync(page));

  fs.writeFileSync(path.join(runDir, 'input.json'), JSON.stringify(input));
  fs.writeFileSync(path.join(runDir, 'posts.json'), JSON.stringify(posts));
  assert.equal((await runBuild({ home, slot: SLOT, platform: 'test' })).exitCode, 0);
  const p5 = structuredClone(posts);
  p5.posts[0].variants[0].text = 'Cầu Giấy 3tr8';
  fs.writeFileSync(path.join(runDir, 'posts.json'), JSON.stringify(p5));
  assert.equal((await runBuild({ home, slot: SLOT, platform: 'test' })).exitCode, 5);
  assert.ok(!fs.existsSync(page));
});

test('home write failure: warning on stderr, prepared still written, exit 0', async () => {
  const { home, dir } = mk();
  fs.mkdirSync(path.join(home, 'out', 'index.html'), { recursive: true }); // index.html là thư mục -> ghi lỗi
  const warns = [];
  const r = await runBuild({ home, slot: SLOT, platform: 'test', warn: (m) => warns.push(m) });
  assert.equal(r.exitCode, 0, r.report);
  assert.equal(warns.length, 1);
  assert.match(warns[0], /^Cảnh báo: không dựng được trang chủ/);
  assert.ok(fs.existsSync(path.join(dir, 'prepared.jsonl')));
  assert.ok(fs.existsSync(path.join(home, 'out', SLOT, 'page-data.json')));
  assert.equal(r.report, `Đã soạn 1 bài lúc 11:00: ${path.join(home, 'out', SLOT)}`);
});

test('exit 5 / exit 6 after a good build regenerate home without the stale slot', async () => {
  const { home, runDir, input, posts } = mk();
  const page = path.join(home, 'out', 'index.html');
  assert.equal((await runBuild({ home, slot: SLOT, platform: 'test' })).exitCode, 0);
  assert.ok(fs.readFileSync(page, 'utf8').includes(`<option value="${SLOT}"`));
  const p5 = structuredClone(posts);
  p5.posts[0].variants[0].text = 'Cầu Giấy 3tr8';
  fs.writeFileSync(path.join(runDir, 'posts.json'), JSON.stringify(p5));
  assert.equal((await runBuild({ home, slot: SLOT, platform: 'test' })).exitCode, 5);
  assert.ok(!fs.readFileSync(page, 'utf8').includes(`value="${SLOT}"`));
  fs.writeFileSync(path.join(runDir, 'posts.json'), JSON.stringify(posts));
  assert.equal((await runBuild({ home, slot: SLOT, platform: 'test' })).exitCode, 0);
  const bad = structuredClone(input);
  bad.listings[0].images = [0, 1, 2].map((i) => ({ url: `${base}/${i > 0 ? 'bad' : 'ok'}/${i}`, isCover: i === 0 }));
  fs.writeFileSync(path.join(runDir, 'input.json'), JSON.stringify(bad));
  const p6 = structuredClone(posts);
  p6.posts[0].variants[0].images = bad.listings[0].images.map((i) => i.url);
  fs.writeFileSync(path.join(runDir, 'posts.json'), JSON.stringify(p6));
  assert.equal((await runBuild({ home, slot: SLOT, platform: 'test' })).exitCode, 6);
  assert.ok(!fs.readFileSync(page, 'utf8').includes(`value="${SLOT}"`));
});

test('prepared.jsonl is appended before the home page is written', async () => {
  const { home, dir } = mk();
  const order = [];
  const writeHomeImpl = (args) => { order.push(fs.existsSync(path.join(dir, 'prepared.jsonl'))); return writeHome(args); };
  const r = await runBuild({ home, slot: SLOT, platform: 'test', writeHomeImpl });
  assert.equal(r.exitCode, 0);
  assert.deepEqual(order, [true]);
  assert.ok(fs.existsSync(path.join(home, 'out', 'index.html')));
});
