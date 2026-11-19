import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runBuild } from '../scripts/build.mjs';
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
    library: { approved: [], trends: [], pending: [], errors: ['Trends: lỗi'] },
  };
  const posts = {
    slot: SLOT,
    posts: [{ targetId: input.targets[0].id, type: 'Phòng mới', postCodes: ['T1'], variants: [{ key: 'A', text: 'Cầu Giấy 3,8 triệu, nhắn mình.', images: input.listings[0].images.map((i) => i.url) }] }],
    skipped: [],
  };
  fs.writeFileSync(path.join(runDir, 'input.json'), JSON.stringify(input));
  fs.writeFileSync(path.join(runDir, 'posts.json'), JSON.stringify(posts));
  return { home, dir, runDir, posts, input };
}

test('success: index.html, prepared lines, exit 0', async () => {
  const { home, dir } = mk();
  const r = await runBuild({ home, slot: SLOT, platform: 'test' });
  assert.equal(r.exitCode, 0, r.report);
  const html = fs.readFileSync(path.join(home, 'out', SLOT, 'index.html'), 'utf8');
  assert.ok(html.includes('Cầu Giấy 3,8 triệu'));
  assert.ok(html.includes('Trends: lỗi'));
  assert.ok(!html.includes('sekret-token'));
  const lines = fs.readFileSync(path.join(dir, 'prepared.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(lines.length, 1);
  assert.deepEqual([lines[0].slot, lines[0].account, lines[0].postCodes, lines[0].type], [SLOT, 'fb1', ['T1'], 'Phòng mới']);
  assert.ok(fs.existsSync(path.join(home, 'out', SLOT, '01_phong-tro-cau-giay_T1', '1.jpg')));
});

test('wrong price: exit 5, numbered errors, nothing written', async () => {
  const { home, dir, runDir, posts } = mk();
  posts.posts[0].variants[0].text = 'Cầu Giấy 3tr8';
  fs.writeFileSync(path.join(runDir, 'posts.json'), JSON.stringify(posts));
  const r = await runBuild({ home, slot: SLOT, platform: 'test' });
  assert.equal(r.exitCode, 5);
  assert.match(r.report, /^1\. /m);
  assert.ok(!fs.existsSync(path.join(home, 'out', SLOT, 'index.html')));
  assert.ok(!fs.existsSync(path.join(dir, 'prepared.jsonl')));
});

test('image failures: exit 6, needsReplacement listed, no index/prepared', async () => {
  const { home, dir } = mk({ badImages: true });
  const r = await runBuild({ home, slot: SLOT, platform: 'test' });
  assert.equal(r.exitCode, 6);
  assert.ok(r.report.includes('group:https://fb/g1'));
  assert.ok(!fs.existsSync(path.join(home, 'out', SLOT, 'index.html')));
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
  const boom = () => { throw new Error('x'); };
  assert.doesNotThrow(() => { openFolder('/a', 'darwin', boom); notify('a', 'b', 'darwin', boom); });
});
