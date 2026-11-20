import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderHome } from '../scripts/lib/render-home.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXAMPLE = fs.readFileSync(path.join(ROOT, 'rules', 'templates', 'content-types.example.md'), 'utf8');
const OUTPUT = path.join('/tmp', 'HomeMatch Posts');
const THU = new Date(2026, 10, 19, 9, 12);
const ALL = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const targets = [
  { id: 'group:g1', kind: 'group', account: 'fb1', name: 'Phòng trọ Cầu Giấy', url: 'https://facebook.com/groups/g1' },
  { id: 'page:page:0', kind: 'page', account: 'page', name: 'HomeMatch Page', url: '' },
  { id: 'threads:th:0', kind: 'threads', account: 'th', name: 'Threads Minh', url: 'javascript:alert(1)' },
];
const accounts = [
  { id: 'fb1', type: 'fb-personal', label: 'FB Minh' },
  { id: 'page', type: 'fb-page', label: 'HomeMatch Page' },
  { id: 'th', type: 'threads', label: 'Threads Minh' },
];
const grp = (o) => ({ name: 'Nhà trọ Hoàng Mai', url: 'https://fb/hm', account: 'fb1', active: true, days: ALL, districts: ['Hoàng Mai'], language: 'vi', note: '', ...o });
const cfg = (o = {}) => ({
  apiBaseUrl: 'https://api.example',
  outputDir: OUTPUT,
  schedule: ['17:00'],
  accounts: [{ id: 'fb1', type: 'fb-personal', label: 'FB Minh' }],
  groups: [grp()],
  perSlot: {},
  variants: { default: 1 },
  contact: [],
  pageContact: [],
  feedback: { formUrl: '', fields: {} },
  ...o,
});

function post(slot, n, targetId, texts, extra = {}) {
  const outDir = path.join(OUTPUT, slot);
  const pdir = path.join(outDir, `0${n}_cầu giấy_T1`);
  return {
    n, dir: pdir, targetId, postCodes: ['T1', 'T2'], type: 'Phòng mới', label: 'NEW',
    variants: texts.map((text, i) => {
      const key = 'ABC'[i];
      return { key, dir: texts.length > 1 ? path.join(pdir, key) : pdir, text, files: ['1.jpg', '2.png', '3.jpg'] };
    }),
    ...extra,
  };
}
function slotData(slot, over = {}) {
  return {
    slot,
    generatedAt: new Date(2026, 10, 19, 11, 3).toISOString(),
    outDir: path.join(OUTPUT, slot),
    posts: [post(slot, 1, 'group:g1', ['Cầu Giấy, 3,8 triệu\n\nNhắn mình.'])],
    targets, accounts, skipped: [], pending: [], notes: [],
    ...over,
  };
}
const home = (over = {}) => renderHome({
  cfg: cfg(), errors: [], persona: null, contentTypes: EXAMPLE, pending: [], today: THU,
  lastChange: null, tokenLabel: null, outputDir: OUTPUT,
  slots: [slotData('2026-11-19_1100')],
  ...over,
});

test('four tabs in order, side column shared, no leftover placeholders', () => {
  const html = home();
  const tabs = [...html.matchAll(/<button role="tab"[^>]*data-tab="(\w+)"[^>]*>([^<]+)/g)].map((m) => m[2].trim());
  assert.deepEqual(tabs, ['Bài đăng', 'Kiểu bài', 'Hằng ngày', 'Hồ sơ']);
  for (const id of ['p-posts', 'p-types', 'p-daily', 'p-profile']) assert.ok(html.includes(`id="${id}"`), id);
  assert.equal((html.match(/Muốn đổi gì\?/g) || []).length, 1);
  assert.ok(html.includes('Lần sửa gần nhất') && html.includes('Báo lỗi / góp ý plugin'));
  assert.ok(!/\{\{[A-Z_]+\}\}/.test(html));
  assert.ok(!/<script[^>]*\ssrc=/i.test(html));
  // Kiểu bài moved out of Hồ sơ
  const profile = html.slice(html.indexOf('id="p-profile"'), html.indexOf('</section>', html.indexOf('id="p-profile"')));
  assert.ok(profile.includes('Persona') && profile.includes('Tài khoản &amp; liên hệ') && profile.includes('Lịch &amp; cài đặt'));
  assert.ok(!profile.includes('Kiểu bài'));
});

test('slot selector lists slots newest first, newest shown, rest hidden', () => {
  const html = home({ slots: [slotData('2026-11-19_1100'), slotData('2026-11-20_1014'), slotData('2026-11-18_1730')] });
  const opts = [...html.matchAll(/<option value="([^"]+)"[^>]*>([^<]+)<\/option>/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(opts, [['2026-11-20_1014', '20/11 10:14'], ['2026-11-19_1100', '19/11 11:00'], ['2026-11-18_1730', '18/11 17:30']]);
  const sections = [...html.matchAll(/<section class="slotview" data-slot="([^"]+)"[^>]*?( hidden)?>/g)].map((m) => [m[1], !!m[2]]);
  assert.deepEqual(sections, [['2026-11-20_1014', false], ['2026-11-19_1100', true], ['2026-11-18_1730', true]]);
});

test('keeps only 14 newest slots; empty state without slots', () => {
  const many = Array.from({ length: 16 }, (_, i) => slotData(`2026-11-${String(i + 1).padStart(2, '0')}_1100`));
  const html = home({ slots: many });
  assert.equal((html.match(/<option value=/g) || []).length, 14);
  assert.ok(html.includes('value="2026-11-16_1100"') && !html.includes('value="2026-11-02_1100"'));
  const empty = home({ slots: [] });
  assert.ok(empty.includes('Chưa có bài nào'));
  assert.ok(!empty.includes('<select'));
});

test('image src relative to outputDir/index.html and URL-encoded; copy path absolute', () => {
  const html = home();
  assert.ok(html.includes('src="2026-11-19_1100/01_c%E1%BA%A7u%20gi%E1%BA%A5y_T1/1.jpg"'), html.match(/src="[^"]*"/)?.[0]);
  assert.ok(!html.includes('src="/'));
  assert.ok(html.includes(`data-path="${path.join(OUTPUT, '2026-11-19_1100', '01_cầu giấy_T1')}"`));
});

test('post card features: variants, Copy buttons, http-only links, Threads, footer', () => {
  const html = home({
    slots: [slotData('2026-11-19_1100', {
      posts: [post('2026-11-19_1100', 1, 'group:g1', ['một', 'hai']), post('2026-11-19_1100', 2, 'threads:th:0', ['hi'])],
      skipped: [{ targetId: 'group:g1', reason: 'thiếu ảnh' }],
      pending: ['Cách ghi liên hệ chưa chốt'],
      notes: ['Không đọc được Trends'],
    })],
  });
  assert.equal((html.match(/<article class="post"/g) || []).length, 2);
  assert.ok(html.includes('Bản A') && html.includes('Bản B') && !html.includes('Bản C'));
  assert.ok(html.includes('Copy nội dung') && html.includes('Copy thư mục ảnh') && html.includes('Đã đăng'));
  assert.ok(html.includes('href="https://facebook.com/groups/g1"') && html.includes('Mở nhóm ↗'));
  assert.ok(!html.includes('javascript:alert'));
  assert.ok(html.includes('data-kind="threads"'));
  assert.ok(html.includes('1 bài bị bỏ') && html.includes('thiếu ảnh'));
  assert.ok(html.includes('Đang chờ quy định') && html.includes('Cách ghi liên hệ chưa chốt'));
  assert.ok(html.includes('Không đọc được Trends'));
  assert.ok(html.includes("'hm-posted-' +"));
});

test('"Sửa kiểu bài này" prefill carries type, slot, number and codes', () => {
  const html = home();
  assert.ok(html.includes('Sửa kiểu bài này'));
  assert.ok(html.includes('data-seed="Kiểu Phòng mới: (bài 2026-11-19_1100 số 1, mã T1, T2) "'));
});

test('Góp ý only with formUrl; params encoded, text cut at 1500', () => {
  assert.ok(!home().includes('>Góp ý<'));
  const fb = { formUrl: 'https://docs.google.com/forms/d/e/X/viewform', fields: { slot: 'entry.1', codes: 'entry.4', text: 'entry.5' } };
  const html = home({
    cfg: cfg({ feedback: fb }),
    slots: [slotData('2026-11-19_1100', { posts: [post('2026-11-19_1100', 1, 'group:g1', ['x'.repeat(3000)])] })],
  });
  assert.ok(html.includes('>Góp ý<'));
  assert.ok(html.includes('entry.1=2026-11-19_1100') && html.includes('entry.4=T1%2CT2') && html.includes('usp=pp_url'));
  assert.equal(/entry\.5=(x+)/.exec(html)[1].length, 1500);
});

test('Kiểu bài tab: one card per type, first open, fields, FB-style example, buttons', () => {
  const html = home();
  const p = html.slice(html.indexOf('id="p-types"'), html.indexOf('id="p-daily"'));
  assert.equal((p.match(/<details class="sec ctype"/g) || []).length, 3);
  assert.equal((p.match(/<details class="sec ctype" open>/g) || []).length, 1);
  assert.match(p, /<details class="sec ctype" open>\s*<summary>Phòng mới \/ giảm giá/);
  for (const s of ['Kênh', 'Số tin mỗi bài', 'Cách chọn tin', 'Cấu trúc', 'Ảnh', 'Ví dụ', 'Tường cá nhân · Page · Threads · Nhóm']) assert.ok(p.includes(s), s);
  assert.ok(p.includes('<ol>') && p.includes('<li>Khu + địa chỉ</li>'));
  assert.ok(p.includes('class="text"') && p.includes('Phòng vừa trống ở Cầu Giấy.\n\n📍'));
  assert.ok(p.includes('data-seed="Kiểu Gom theo khu: "') && p.includes('Sửa kiểu này'));
  assert.ok(p.includes('+ Thêm kiểu bài') && p.includes('Thêm kiểu bài mới: tên …, kênh …, số tin …, cấu trúc …'));
  const missing = home({ contentTypes: '## Trống\n\n- **Kênh**: page\n' });
  const q = missing.slice(missing.indexOf('id="p-types"'), missing.indexOf('id="p-daily"'));
  assert.ok((q.match(/—/g) || []).length >= 4);
});

test('modes: lavish -> edit, else view with Copy yêu cầu; edit-only controls marked', () => {
  const html = home({ lastChange: { at: new Date(2026, 10, 19, 9, 12), lines: ['Giờ chạy: 17:00 → 17:30'] } });
  assert.ok(html.includes('window.lavish'));
  assert.ok(html.includes('Đang sửa cùng Claude') && html.includes('Chỉ xem'));
  assert.ok(html.includes('Copy yêu cầu'));
  assert.ok(html.includes("'/hm-config ' + items.join('; ')"));
  assert.ok(html.includes('Đã copy — dán vào chat Claude'));
  assert.match(html, /class="btn ghost edit-only"[^>]*onclick="undo\(\)"/);
  assert.ok(html.includes('body[data-mode="view"] .edit-only'));
  assert.ok(html.includes('Giờ chạy: 17:00 → 17:30') && html.includes('Hoàn tác'));
});

test('escaping: <script> in post text, content-type example, groups, persona; token absent', () => {
  const evil = '<script>alert(1)</script> & "q"';
  const html = home({
    cfg: cfg({ groups: [grp({ active: false }), grp({ name: '<img onerror=1>', url: 'https://fb/2' })] }),
    persona: '# Persona\n\n## Tôi là ai\n\nFounder <b>x</b>.\n\n## NÊN\n\n- Nói rõ\n',
    contentTypes: '## <i>T</i>\n\n- **Kênh**: page\n- **Ví dụ**:\n\n```\n<script>alert(2)</script>\n```\n',
    slots: [slotData('2026-11-19_1100', {
      posts: [post('2026-11-19_1100', 1, 'group:g1', [evil])],
      skipped: [{ targetId: 'group:g1', reason: '<img src=x onerror=1>' }],
      notes: ['<b>note</b>'],
    })],
    tokenLabel: 'mkt-minh',
  });
  assert.ok(!html.includes('<script>alert('));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;') && html.includes('&lt;script&gt;alert(2)&lt;/script&gt;'));
  assert.ok(html.includes('data-raw="&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;q&quot;"'));
  assert.ok(!html.includes('<img src=x') && !html.includes('<img onerror=1>') && !html.includes('<b>note</b>') && !html.includes('<b>x</b>') && !html.includes('<i>T</i>'));
  assert.match(html, /class="grp off"/);
  assert.ok(html.includes('đã cài · mkt-minh'));
  assert.ok(!html.includes('SECRET-TOKEN'));
});

test('daily tab content and invalid config banner', () => {
  const html = home({ pending: ['Cách ghi liên hệ'] });
  assert.ok(html.includes('Hôm nay sẽ soạn') && html.includes('Số bài mỗi khung') && html.includes('1 mục đang chờ quy định'));
  const bad = home({ cfg: { groups: 'x' }, errors: undefined });
  assert.ok(bad.includes('Cấu hình đang sai') && bad.includes('apiBaseUrl'));
  assert.ok(home({ tokenLabel: null }).includes('chưa cài'));
});
