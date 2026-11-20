import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { slugify, postDirName, downloadPosts } from '../scripts/lib/download.mjs';

let server, base, hits;
before(async () => {
  hits = {};
  server = http.createServer((req, res) => {
    hits[req.url] = (hits[req.url] || 0) + 1;
    if (req.url.startsWith('/ok')) { res.setHeader('content-type', 'image/jpeg'); res.end(Buffer.from('JPG' + req.url)); }
    else if (req.url.startsWith('/jpgalias')) { res.setHeader('content-type', 'image/jpg'); res.end(Buffer.from('JPG' + req.url)); }
    else if (req.url.startsWith('/webp')) { res.setHeader('content-type', 'image/webp'); res.end(Buffer.from('WEBP' + req.url)); }
    else if (req.url.startsWith('/png')) { res.setHeader('content-type', 'image/png'); res.end(Buffer.from('PNG' + req.url)); }
    else if (req.url.startsWith('/ico')) { res.setHeader('content-type', 'image/vnd.microsoft.icon'); res.end('ico'); }
    else if (req.url.startsWith('/html')) { res.setHeader('content-type', 'text/html'); res.end('<html/>'); }
    else { res.statusCode = 404; res.end('no'); }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'dl-'));
const u = (p) => `${base}${p}`;
const targets = [{ id: 't1', kind: 'group', name: 'Phòng trọ Cầu Giấy' }, { id: 't2', kind: 'group', name: 'Phòng trọ Cầu Giấy' }, { id: 'b', kind: 'page', name: 'Fanpage' }];
const listing = (code, n) => ({ code, imageCount: n, images: Array.from({ length: n }, (_, i) => ({ url: u(`/ok/${code}/${i}`), isCover: i === 0 })) });

test('slugify', () => {
  assert.equal(slugify('Phòng trọ Cầu Giấy – Đống Đa'), 'phong-tro-cau-giay-dong-da');
  assert.equal(slugify('a'.repeat(60)).length, 40);
});

test('postDirName', () => {
  assert.equal(postDirName(1, targets[0], ['T1']), '01_phong-tro-cau-giay_T1');
  assert.equal(postDirName(2, targets[0], ['T1', 'T2']), '02_phong-tro-cau-giay_gom');
  assert.equal(postDirName(3, targets[2], []), '03_fanpage_brand');
});

test('two posts same target name get distinct dirs; failed image removed, renumbered; text written', async () => {
  const out = tmp();
  const input = { targets, listings: [listing('T1', 5), listing('T2', 5)] };
  const imgs1 = [0, 1, 2, 3, 4].map((i) => (i === 1 ? u('/missing') : u(`/ok/T1/${i}`)));
  const posts = [
    { targetId: 't1', type: 'single', postCodes: ['T1'], variants: [{ key: 'A', text: 'Xin chào ✓\n', images: imgs1 }] },
    { targetId: 't2', type: 'single', postCodes: ['T2'], variants: [{ key: 'A', text: 'x', images: [0, 1, 2].map((i) => u(`/ok/T2/${i}`)) }] },
  ];
  const r = await downloadPosts({ posts, input, outRoot: path.join(out, 'slot') });
  assert.equal(r.needsReplacement.length, 0);
  assert.deepEqual(r.posts.map((p) => path.basename(p.dir)), ['01_phong-tro-cau-giay_T1', '02_phong-tro-cau-giay_T2']);
  assert.deepEqual(r.posts[0].variants[0].files, ['1.jpg', '2.jpg', '3.jpg', '4.jpg']);
  assert.deepEqual(fs.readdirSync(r.posts[0].dir).sort(), ['1.jpg', '2.jpg', '3.jpg', '4.jpg', 'post.txt']);
  assert.equal(fs.readFileSync(path.join(r.posts[0].dir, 'post.txt'), 'utf8'), 'Xin chào ✓\n');
  assert.equal(fs.readFileSync(path.join(r.posts[0].dir, '2.jpg'), 'utf8'), 'JPG/ok/T1/2');
});

test('too few images -> needsReplacement and dir absent; html content-type dropped', async () => {
  const out = tmp();
  const input = { targets, listings: [listing('T1', 3)] };
  const posts = [{ targetId: 't1', type: 'single', postCodes: ['T1'], variants: [{ key: 'A', text: 't', images: [u('/ok/T1/0'), u('/missing'), u('/html/x')] }] }];
  const r = await downloadPosts({ posts, input, outRoot: path.join(out, 'slot') });
  assert.equal(r.posts.length, 0);
  assert.equal(r.needsReplacement.length, 1);
  assert.equal(r.needsReplacement[0].targetId, 't1');
  assert.match(r.needsReplacement[0].reason, /ảnh/);
  assert.equal(fs.existsSync(path.join(out, 'slot', '01_phong-tro-cau-giay_T1')), false);
});

test('two variants -> A/ and B/, B/1.jpg is images[0] of B; ext by content-type; url downloaded once', async () => {
  const out = tmp();
  hits = {};
  const input = { targets, listings: [listing('T1', 5)] };
  const A = [0, 1, 2].map((i) => u(`/ok/T1/${i}`));
  const B = [u('/png/b0'), u('/ok/T1/1'), u('/ok/T1/2')];
  const posts = [{ targetId: 't1', type: 'single', postCodes: ['T1'], variants: [{ key: 'A', text: 'a', images: A }, { key: 'B', text: 'b', comment: 'Chi tiết: https://homematch.vn/p/T1\n', images: B }] }];
  const r = await downloadPosts({ posts, input, outRoot: path.join(out, 'slot'), platform: 'linux' });
  const dir = r.posts[0].dir;
  assert.equal(fs.readFileSync(path.join(dir, 'A', '1.jpg'), 'utf8'), 'JPG/ok/T1/0');
  assert.equal(fs.readFileSync(path.join(dir, 'B', '1.png'), 'utf8'), 'PNG/png/b0');
  assert.equal(fs.readFileSync(path.join(dir, 'B', 'post.txt'), 'utf8'), 'b');
  assert.equal(hits['/ok/T1/1'], 1);
  assert.deepEqual(r.posts[0].variants.map((v) => v.key), ['A', 'B']);
  // comment đầu tiên: chỉ bản có comment mới có comment.txt, nguyên văn
  assert.equal(fs.readFileSync(path.join(dir, 'B', 'comment.txt'), 'utf8'), 'Chi tiết: https://homematch.vn/p/T1\n');
  assert.ok(!fs.existsSync(path.join(dir, 'A', 'comment.txt')));
  assert.deepEqual(r.posts[0].variants.map((v) => v.comment), [undefined, 'Chi tiết: https://homematch.vn/p/T1\n']);
  assert.ok(!('comment' in r.posts[0].variants[0]));
});

test('multi-listing post missing a cover -> replacement; brand <3 -> replacement', async () => {
  const out = tmp();
  const input = { targets, listings: [listing('T1', 4), listing('T2', 4)] };
  const posts = [
    { targetId: 't1', type: 'multi', postCodes: ['T1', 'T2'], variants: [{ key: 'A', text: 'm', images: [u('/ok/T1/0'), u('/missing/c2'), u('/ok/T2/1')] }] },
    { targetId: 'b', type: 'brand', postCodes: [], variants: [{ key: 'A', text: 'b', images: [u('/ok/x/0'), u('/ok/x/1')] }] },
    { targetId: 'b', type: 'brand', postCodes: [], variants: [{ key: 'A', text: 'b', images: [u('/ok/x/0'), u('/ok/x/1'), u('/ok/x/2')] }] },
  ];
  input.listings[1].images[0].url = u('/missing/c2');
  const r = await downloadPosts({ posts, input, outRoot: path.join(out, 'slot') });
  assert.equal(r.needsReplacement.length, 2);
  assert.equal(r.posts.length, 1);
  assert.equal(r.posts[0].n, 3);
  assert.match(path.basename(r.posts[0].dir), /^03_fanpage_brand$/);
});

test('timeout counts as failure', async () => {
  const out = tmp();
  const input = { targets, listings: [listing('T1', 3)] };
  const slow = (url, { signal }) => new Promise((_, rej) => signal.addEventListener('abort', () => rej(new Error('abort'))));
  const posts = [{ targetId: 't1', type: 'single', postCodes: ['T1'], variants: [{ key: 'A', text: 't', images: [u('/ok/a'), u('/ok/b'), u('/ok/c')] }] }];
  const r = await downloadPosts({ posts, input, outRoot: path.join(out, 's'), fetchImpl: slow, timeoutMs: 30 });
  assert.equal(r.needsReplacement.length, 1);
});

test('re-run cleans stale NN_ dirs, keeps other files', async () => {
  const out = path.join(tmp(), 'slot');
  const input = { targets, listings: [listing('T1', 3), listing('T2', 3)] };
  const mk = (code, ok = true) => ({ targetId: 't1', type: 'single', postCodes: [code], variants: [{ key: 'A', text: 't', images: [0, 1, 2].map((i) => u(ok ? `/ok/${code}/${i}` : `/missing/${i}`)) }] });
  await downloadPosts({ posts: [mk('T1'), mk('T2')], input, outRoot: out });
  fs.writeFileSync(path.join(out, 'index.html'), 'keep');
  const r = await downloadPosts({ posts: [mk('T1'), mk('T2', false)], input, outRoot: out });
  assert.equal(r.needsReplacement.length, 1);
  assert.deepEqual(fs.readdirSync(out).sort(), ['01_phong-tro-cau-giay_T1', 'index.html']);
});

test('unsafe code / variant key -> needsReplacement, nothing written outside', async () => {
  const out = path.join(tmp(), 'slot');
  const input = { targets, listings: [listing('T1', 3)] };
  const imgs = [0, 1, 2].map((i) => u(`/ok/T1/${i}`));
  const posts = [
    { targetId: 't1', type: 'single', postCodes: ['../x'], variants: [{ key: 'A', text: 't', images: imgs }] },
    { targetId: 't1', type: 'single', postCodes: ['T1'], variants: [{ key: 'A', text: 't', images: imgs }, { key: '../B', text: 't', images: imgs }] },
  ];
  const r = await downloadPosts({ posts, input, outRoot: out });
  assert.equal(r.needsReplacement.length, 2);
  assert.match(r.needsReplacement[0].reason, /không hợp lệ/);
  assert.equal(r.posts.length, 0);
  assert.deepEqual(fs.readdirSync(out), []);
});

test('non-whitelisted image type (ico) is a failed image', async () => {
  const out = path.join(tmp(), 'slot');
  const input = { targets, listings: [listing('T1', 3)] };
  const posts = [{ targetId: 't1', type: 'single', postCodes: ['T1'], variants: [{ key: 'A', text: 't', images: [u('/ok/a'), u('/ok/b'), u('/ico/c')] }] }];
  const r = await downloadPosts({ posts, input, outRoot: out });
  assert.equal(r.needsReplacement.length, 1);
});

test('content-type image/jpg -> .jpg', async () => {
  const out = tmp();
  const imgs = [0, 1, 2].map((i) => u(`/jpgalias/${i}`));
  const input = { targets, listings: [{ code: 'T1', imageCount: 3, images: imgs.map((url, i) => ({ url, isCover: i === 0 })) }] };
  const r = await downloadPosts({ posts: [{ targetId: 't1', type: 's', postCodes: ['T1'], variants: [{ key: 'A', text: 'x', images: imgs }] }], input, outRoot: path.join(out, 's') });
  assert.equal(r.needsReplacement.length, 0);
  assert.deepEqual(r.posts[0].variants[0].files, ['1.jpg', '2.jpg', '3.jpg']);
});

// F4: đổi webp/png sang jpg trên Mac bằng sips (runner được tiêm, không cần sips thật).
const webpPost = () => {
  const imgs = [u('/webp/0'), u('/png/1'), u('/ok/T1/2')];
  return {
    input: { targets, listings: [{ code: 'T1', imageCount: 3, images: imgs.map((url, i) => ({ url, isCover: i === 0 })) }] },
    posts: [{ targetId: 't1', type: 's', postCodes: ['T1'], variants: [{ key: 'A', text: 'x', images: imgs }] }],
  };
};

test('darwin + sips ok -> webp/png become N.jpg, original removed, jpg not converted', async () => {
  const out = tmp();
  const calls = [];
  const run = (cmd, args) => {
    calls.push([cmd, ...args]);
    fs.writeFileSync(args[args.length - 1], 'CONVERTED');
    return { status: 0 };
  };
  const { input, posts } = webpPost();
  const r = await downloadPosts({ posts, input, outRoot: path.join(out, 's'), platform: 'darwin', run });
  const dir = r.posts[0].dir;
  assert.deepEqual(r.posts[0].variants[0].files, ['1.jpg', '2.jpg', '3.jpg']);
  assert.deepEqual(fs.readdirSync(dir).sort(), ['1.jpg', '2.jpg', '3.jpg', 'post.txt']);
  assert.equal(fs.readFileSync(path.join(dir, '1.jpg'), 'utf8'), 'CONVERTED');
  assert.equal(fs.readFileSync(path.join(dir, '3.jpg'), 'utf8'), 'JPG/ok/T1/2');
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], ['sips', '-s', 'format', 'jpeg', path.join(dir, '1.webp'), '--out', path.join(dir, '1.jpg')]);
});

test('darwin + sips fails -> keep N.webp / N.png', async () => {
  const out = tmp();
  const run = () => ({ status: 1 });
  const { input, posts } = webpPost();
  const r = await downloadPosts({ posts, input, outRoot: path.join(out, 's'), platform: 'darwin', run });
  assert.deepEqual(r.posts[0].variants[0].files, ['1.webp', '2.png', '3.jpg']);
  assert.equal(fs.readFileSync(path.join(r.posts[0].dir, '1.webp'), 'utf8'), 'WEBP/webp/0');
});

test('darwin + runner throws -> keep original', async () => {
  const out = tmp();
  const run = () => { throw new Error('ENOENT'); };
  const { input, posts } = webpPost();
  const r = await downloadPosts({ posts, input, outRoot: path.join(out, 's'), platform: 'darwin', run });
  assert.deepEqual(r.posts[0].variants[0].files, ['1.webp', '2.png', '3.jpg']);
});

test('not darwin -> no conversion, runner never called', async () => {
  const out = tmp();
  let called = false;
  const run = () => { called = true; return { status: 0 }; };
  const { input, posts } = webpPost();
  const r = await downloadPosts({ posts, input, outRoot: path.join(out, 's'), platform: 'win32', run });
  assert.deepEqual(r.posts[0].variants[0].files, ['1.webp', '2.png', '3.jpg']);
  assert.equal(called, false);
});
