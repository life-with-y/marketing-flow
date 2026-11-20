import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { renderHome, writeHome, loadSlots } from '../scripts/lib/render-home.mjs';
import { modeView } from '../scripts/lib/home-mode.mjs';

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
  assert.equal((p.match(/<details class="sec ctype"/g) || []).length, 5);
  // kiểu có 2 ví dụ hiện cả 2
  assert.ok(p.includes('data-who="Ví dụ · Threads, khác khu, link tắt"') && p.includes('data-who="Ví dụ · tường cá nhân, cùng khu, link tắt"'));
  assert.equal((p.match(/<details class="sec ctype" open>/g) || []).length, 1);
  assert.match(p, /<details class="sec ctype" open>\s*<summary>Phòng nổi bật/);
  for (const s of ['Kênh', 'Số tin mỗi bài', 'Cách chọn tin', 'Cấu trúc', 'Ảnh', 'Ví dụ', 'Tường cá nhân · Page · Threads · Nhóm']) assert.ok(p.includes(s), s);
  assert.ok(p.includes('<ol>') && p.includes('<li>Lời mời nói chuyện.</li>'));
  assert.ok(p.includes('class="text"') && p.includes('🏡 Studio 25m² có bếp riêng'));
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
  // edit prompt is exactly the request text (no prefix), matching skills/hm-config
  assert.ok(html.includes('window.lavish?.queuePrompt?.(t, {'));
  assert.ok(!html.includes('Cập nhật config: '));
  // mode decided by the shared pure function, re-checked after load
  assert.ok(html.includes(`const modeView = ${modeView.toString()};`));
  assert.match(html, /setInterval\(/);
  assert.ok(html.includes('MODE === \'edit\''));
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

test('modeView: lavish present -> edit, else view', () => {
  assert.deepEqual(modeView(true), { mode: 'edit', badge: 'Đang sửa cùng Claude', send: 'Gửi cho Claude sửa', note: 'Claude sửa ngay, lưu bản cũ, rồi dựng lại trang.' });
  assert.deepEqual(modeView(false), { mode: 'view', badge: 'Chỉ xem', send: 'Copy yêu cầu', note: 'Dán vào chat Claude để sửa.' });
  assert.equal(modeView(undefined).mode, 'view');
});

test('broken post renders an error card, other posts still render', () => {
  const S = '2026-11-19_1100';
  const bad = [
    { ...post(S, 2, 'group:g1', ['x']), variants: [null] },
    { ...post(S, 3, 'group:g1', ['x']), variants: [] },
    null,
  ];
  const html = home({ slots: [slotData(S, { posts: [post(S, 1, 'group:g1', ['Bài tốt vẫn hiện']), ...bad] })] });
  assert.ok(html.includes('Bài tốt vẫn hiện'));
  assert.equal((html.match(/<article class="post"/g) || []).length, 1);
  assert.ok(html.includes('Không hiển thị được bài số 2') && html.includes('Không hiển thị được bài số 3'));
  assert.equal((html.match(/class="post-err"/g) || []).length, 3);
});

test('malformed slot files are skipped with a note; other slots intact', () => {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hm-home-'));
  const dir = path.join(homeDir, '.homematch-marketing');
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(homeDir, 'out');
  const write = (slot, text) => { fs.mkdirSync(path.join(out, slot), { recursive: true }); fs.writeFileSync(path.join(out, slot, 'page-data.json'), text); };
  const good = slotData('2026-11-20_1100', { outDir: path.join(out, '2026-11-20_1100'), posts: [post('2026-11-20_1100', 1, 'group:g1', ['Khung tốt'])] });
  write('2026-11-20_1100', JSON.stringify(good));
  write('2026-11-19_1100', JSON.stringify({ slot: '2026-11-19_1100', posts: null }));
  write('2026-11-18_1100', '{not json');
  write('2026-11-17_1100', 'null');
  write('2026-11-16_1100', JSON.stringify({ ...good, posts: [{ n: 1, variants: [null] }] }));
  const { slots, bad } = loadSlots(out);
  assert.deepEqual(slots.map((x) => x.slot), ['2026-11-20_1100', '2026-11-16_1100']);
  assert.deepEqual(bad, ['2026-11-19_1100', '2026-11-18_1100', '2026-11-17_1100']);
  const file = writeHome({ dir, cfg: cfg({ outputDir: out }), home: homeDir, now: THU });
  const html = fs.readFileSync(file, 'utf8');
  assert.ok(html.includes('Khung tốt'));
  for (const b of bad) assert.ok(html.includes(`Không đọc được khung ${b}`), b);
  assert.ok(html.includes('Không hiển thị được bài số 1'));
  assert.deepEqual([...html.matchAll(/<option value="([^"]+)"/g)].map((m) => m[1]), ['2026-11-20_1100', '2026-11-16_1100']);
  // only bad slots: still a page with the note
  const only = renderHome({ cfg: cfg(), outputDir: out, slots: [], badSlots: ['2026-11-19_1100'], today: THU });
  assert.ok(only.includes('Không đọc được khung 2026-11-19_1100') && only.includes('Chưa có bài nào'));
});

test('comment đầu tiên: hộp riêng dưới nội dung, nút Copy comment, ẩn khi bản không có comment', () => {
  const evil = 'Chi tiết <b>x</b> & "q": https://homematch.vn/p/T1';
  const p1 = post('2026-11-19_1100', 1, 'group:g1', ['một', 'hai']);
  p1.variants[1].comment = evil;
  const p2 = post('2026-11-19_1100', 2, 'group:g1', ['ba']);
  p2.variants[0].comment = 'Xem: https://homematch.vn/p/T2';
  const p3 = post('2026-11-19_1100', 3, 'threads:th:0', ['hi']);
  const html = home({ slots: [slotData('2026-11-19_1100', { posts: [p1, p2, p3] })] });
  const cards = html.split('<article class="post"').slice(1).map((c) => c.split('</article>')[0]);
  // bài 1: chỉ bản B có comment; nút có nhưng ẩn lúc đầu (bản A đang hiện)
  assert.equal((cards[0].match(/class="cmt"/g) || []).length, 1);
  assert.ok(cards[0].includes('Comment đầu tiên (ghim lại)'));
  assert.ok(cards[0].includes('data-raw="Chi tiết &lt;b&gt;x&lt;/b&gt; &amp; &quot;q&quot;: https://homematch.vn/p/T1"'));
  assert.ok(!cards[0].includes('<b>x</b>'));
  assert.match(cards[0], /<button type="button" class="btn" data-act="copy-comment" hidden>Copy comment<\/button>/);
  // bài 2: bản duy nhất có comment, nút hiện, đứng ngay sau Copy nội dung
  assert.match(cards[1], /data-act="copy-text">Copy nội dung<\/button>\s*<button type="button" class="btn" data-act="copy-comment">Copy comment<\/button>/);
  // bài 3: không có comment nào thì không có hộp, không có nút
  assert.ok(!cards[2].includes('class="cmt"') && !cards[2].includes('copy-comment'));
  // JS: copy đúng data-raw của bản đang hiện, đổi bản thì ẩn/hiện nút
  assert.ok(html.includes(`$('.cmt-t', active(post))`));
  assert.ok(html.includes('cc.hidden = !$(\'.cmt-t\', active(post))'));
});

test('Kiểu bài tab: mục "Hướng dẫn nền tảng" cuối tab, mỗi nền tảng 1 thẻ, markdown đơn giản đã escape', () => {
  const guides = [
    { kind: 'page', md: '# Page <b>x</b>\n\n## Link\n\n- Không <script>alert(1)</script> link\n- Ý & hai\n\nĐoạn "thường"\n' },
    { kind: 'threads', md: '## Emoji\n- 0–2 emoji\n' },
  ];
  const html = home({ platformGuides: guides });
  const p = html.slice(html.indexOf('id="p-types"'), html.indexOf('id="p-daily"'));
  const at = p.indexOf('<details class="sec platforms">');
  assert.ok(at > p.lastIndexOf('<details class="sec ctype"'), 'sau các kiểu bài');
  assert.match(p, /<summary>Hướng dẫn nền tảng/);
  assert.equal((p.match(/<section class="pguide"/g) || []).length, 2);
  assert.ok(p.includes('<h3>Page &lt;b&gt;x&lt;/b&gt;</h3>'));
  assert.ok(p.includes('<h4>Link</h4>'));
  assert.ok(p.includes('<ul><li>Không &lt;script&gt;alert(1)&lt;/script&gt; link</li><li>Ý &amp; hai</li></ul>'));
  assert.ok(p.includes('<p>Đoạn &quot;thường&quot;</p>'));
  assert.ok(!p.includes('<script>alert'));
  // không có tiêu đề # thì dùng tên kênh
  assert.ok(p.includes('<h3>Threads</h3>'));
  assert.ok(!home().includes('class="sec platforms"'), 'không có guide thì không có mục');
});

test('writeHome: 4 thẻ hướng dẫn từ plugin, file cá nhân ghi đè', () => {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hm-home-pg-'));
  const dir = path.join(homeDir, '.homematch-marketing');
  fs.mkdirSync(path.join(dir, 'platforms'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'platforms', 'threads.md'), '# Threads của tôi\n\n- riêng\n');
  const out = path.join(homeDir, 'out');
  const html = fs.readFileSync(writeHome({ dir, cfg: cfg({ outputDir: out }), home: homeDir, now: THU }), 'utf8');
  const p = html.slice(html.indexOf('id="p-types"'), html.indexOf('id="p-daily"'));
  assert.equal((p.match(/<section class="pguide"/g) || []).length, 4);
  for (const k of ['page', 'wall', 'group', 'threads']) assert.ok(p.includes(`data-kind="${k}"`), k);
  assert.ok(p.includes('<h3>Facebook Page</h3>') && p.includes('<h3>Threads của tôi</h3>'));
  assert.ok(p.includes('<h4>Mục tiêu</h4>'));
});

const PAGE_WARN = 'Page đang ẩn giá: khác với giá trị minh bạch của HomeMatch khi tư vấn — cân nhắc.';
const profileOf = (html) => html.slice(html.indexOf('id="p-profile"'), html.indexOf('</section>', html.indexOf('id="p-profile"')));

test('Hồ sơ: công tắc link và cách ghi giá theo kênh; cảnh báo khi Page che giá', () => {
  const off = profileOf(home());
  assert.ok(off.includes('Link homematch.vn</dt><dd>Page tắt · Tường tắt · Threads tắt · Nhóm tắt</dd>'), off);
  assert.ok(off.includes('Giá</dt><dd>Page đầy đủ · Tường đầy đủ · Threads đầy đủ · Nhóm đầy đủ</dd>'));
  assert.ok(!off.includes(PAGE_WARN));
  const on = profileOf(home({ cfg: cfg({ links: { page: true, wall: false, threads: true, group: false }, priceStyle: { page: 'masked', wall: 'masked' } }) }));
  assert.ok(on.includes('Page bật · Tường tắt · Threads bật · Nhóm tắt'));
  assert.ok(on.includes('Page ẩn giá (4xxx) · Tường ẩn giá (4xxx) · Threads đầy đủ · Nhóm đầy đủ'));
  assert.equal(on.split(PAGE_WARN).length - 1, 1);
});

test('khung có bài Page che giá: chú thích cuối khung một lần', () => {
  const mt = targets.map((t) => (t.kind === 'page' ? { ...t, priceStyle: 'masked' } : t));
  const s = '2026-11-19_1100';
  const posts = [post(s, 1, 'page:page:0', ['a']), post(s, 2, 'page:page:0', ['b']), post(s, 3, 'group:g1', ['c'])];
  const html = home({ slots: [slotData(s, { targets: mt, posts })] });
  const view = html.slice(html.indexOf('<section class="slotview"'), html.indexOf('</section>', html.indexOf('<section class="slotview"')));
  assert.equal(view.split(PAGE_WARN).length - 1, 1);
  const plain = home({ slots: [slotData(s, { posts })] });
  const pv = plain.slice(plain.indexOf('<section class="slotview"'), plain.indexOf('</section>', plain.indexOf('<section class="slotview"')));
  assert.ok(!pv.includes(PAGE_WARN));
  // chỉ đích Page che giá mới tính, nhóm che giá không cảnh báo
  const gm = targets.map((t) => (t.kind === 'group' ? { ...t, priceStyle: 'masked' } : t));
  const gh = home({ slots: [slotData(s, { targets: gm, posts: [post(s, 1, 'group:g1', ['c'])] })] });
  assert.ok(!gh.slice(gh.indexOf('<section class="slotview"')).split('id="p-profile"')[0].includes(PAGE_WARN));
});
