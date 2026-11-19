import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { renderPostsPage } from '../scripts/lib/render-posts.mjs';

const OUT = path.join('/tmp', 'out', '2026-11-19_1100');
const targets = [
  { id: 'group:g1', kind: 'group', account: 'fb1', name: 'Phòng trọ Cầu Giấy', url: 'https://facebook.com/groups/g1' },
  { id: 'page:page:0', kind: 'page', account: 'page', name: 'HomeMatch Page', url: '' },
  { id: 'threads:th:0', kind: 'threads', account: 'th', name: 'Threads Minh', url: '' },
];
const accounts = [
  { id: 'fb1', type: 'fb-personal', label: 'FB Minh' },
  { id: 'page', type: 'fb-page', label: 'HomeMatch Page' },
  { id: 'th', type: 'threads', label: 'Threads Minh' },
];
const post = (n, targetId, texts, extra = {}) => ({
  n,
  dir: path.join(OUT, `0${n}_x_T1`),
  targetId,
  postCodes: ['T1'],
  type: 'Phòng mới',
  label: 'NEW',
  variants: texts.map((text, i) => {
    const key = 'ABC'[i];
    const dir = texts.length > 1 ? path.join(OUT, `0${n}_x_T1`, key) : path.join(OUT, `0${n}_x_T1`);
    return { key, dir, text, files: ['1.jpg', '2.png', '3.jpg'] };
  }),
  ...extra,
});
const base = (over = {}) => ({
  slot: '2026-11-19_1100',
  generatedAt: new Date(2026, 10, 19, 11, 3).toISOString(),
  outDir: OUT,
  posts: [post(1, 'group:g1', ['Cầu Giấy, 3,8 triệu\n\nNhắn mình.'])],
  targets, accounts, skipped: [], pending: [], notes: [],
  feedback: { formUrl: '', fields: {} },
  person: 'Minh',
  ...over,
});

test('one card per post, relative image paths', () => {
  const html = renderPostsPage(base({ posts: [post(1, 'group:g1', ['a 3,8 triệu']), post(2, 'threads:th:0', ['b'])] }));
  assert.equal((html.match(/<article class="post"/g) || []).length, 2);
  assert.ok(html.includes('src="01_x_T1/1.jpg"'));
  assert.ok(!html.includes('src="/'));
});

test('user strings are HTML-escaped; raw text kept in data attribute', () => {
  const evil = '<script>alert(1)</script> & "q"';
  const html = renderPostsPage(base({
    posts: [post(1, 'group:g1', [evil])],
    skipped: [{ targetId: 'group:g1', reason: '<img src=x onerror=1>' }],
    notes: ['<b>note</b>'],
    pending: ['<i>p</i>'],
  }));
  assert.ok(!html.includes('<script>alert(1)'));
  assert.ok(!html.includes('<img src=x'));
  assert.ok(!html.includes('<b>note</b>'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('data-raw="&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;q&quot;"'));
});

test('two variants give Bản A and Bản B tabs; single variant none', () => {
  const two = renderPostsPage(base({ posts: [post(1, 'group:g1', ['một', 'hai'])] }));
  assert.ok(two.includes('Bản A') && two.includes('Bản B') && !two.includes('Bản C'));
  const one = renderPostsPage(base());
  assert.ok(!one.includes('Bản A'));
});

test('no formUrl hides Góp ý; formUrl adds encoded params', () => {
  assert.ok(!renderPostsPage(base()).includes('Góp ý'));
  const html = renderPostsPage(base({
    feedback: { formUrl: 'https://docs.google.com/forms/d/e/X/viewform', fields: { slot: 'entry.1', post: 'entry.2', variant: 'entry.3', codes: 'entry.4', text: 'entry.5', person: 'entry.6' } },
  }));
  assert.ok(html.includes('Góp ý'));
  assert.ok(html.includes('https://docs.google.com/forms/d/e/X/viewform?'));
  assert.ok(html.includes('entry.1=2026-11-19_1100'));
  assert.ok(html.includes('entry.4=T1'));
  assert.ok(html.includes('usp=pp_url'));
  assert.ok(html.includes('entry.5=C%E1%BA%A7u'));
});

test('feedback text truncated to 1500 chars', () => {
  const html = renderPostsPage(base({
    posts: [post(1, 'group:g1', ['x'.repeat(3000)])],
    feedback: { formUrl: 'https://f.test/v', fields: { text: 'entry.5' } },
  }));
  const m = /entry\.5=(x+)/.exec(html);
  assert.equal(m[1].length, 1500);
});

test('Threads counter hook, account filters, footer sections', () => {
  const html = renderPostsPage(base({
    posts: [post(1, 'threads:th:0', ['hi'])],
    skipped: [{ targetId: 'group:g1', reason: 'thiếu ảnh' }],
    pending: ['Cách ghi liên hệ chưa chốt'],
    notes: ['Không đọc được Trends'],
  }));
  assert.ok(html.includes('data-kind="threads"'));
  assert.ok(html.includes('1 bài bị bỏ'));
  assert.ok(html.includes('Phòng trọ Cầu Giấy') && html.includes('thiếu ảnh'));
  assert.ok(html.includes('Đang chờ quy định') && html.includes('Cách ghi liên hệ chưa chốt'));
  assert.ok(html.includes('Không đọc được Trends'));
  assert.ok(html.includes('data-acc="th"'));
});

test('no fake token or leftover placeholders', () => {
  const html = renderPostsPage(base());
  assert.ok(!html.includes('sekret-token'));
  assert.ok(!/\{\{[A-Z_]+\}\}/.test(html));
  assert.ok(html.includes('Bài đăng'));
});
