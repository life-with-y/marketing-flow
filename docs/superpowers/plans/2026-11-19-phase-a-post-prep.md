# Phần A — Soạn bài theo lịch: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Claude Code plugin `homematch-marketing`: mỗi khung giờ lấy tin từ API HomeMatch, Claude soạn bài theo persona, script tải ảnh và dựng trang copy; kèm `/hm-setup`, `/hm-config`, `/hm-prep-now`, `/hm-triage`.

**Architecture:** Mỗi lần chạy có 2 nửa do script làm, kẹp giữa là phần Claude:
1. `prepare` (script): fetch → snapshot → so sánh → tính đích → ghi `input.json`.
2. Claude (skill): đọc `input.json` + rules + persona, ghi `posts.json`.
3. `build` (script): kiểm tra `posts.json` bằng luật cứng → tải ảnh → dựng `index.html` → ghi nhật ký → mở Finder → thông báo.

Mọi luật cố định nằm trong code (`validatePosts`), không chỉ nằm trong prompt.

**Tech Stack:** Node ≥ 20 (ESM, `fetch` sẵn có, `node:test`), **không có dependency npm**. HTML tĩnh dựng từ template. `lavish-axi` qua `npx`. Scheduled tasks của app Claude desktop. `gh` (chỉ máy owner, cho `/hm-triage`).

**Spec:** `docs/spec.md` (Phần A, mục 1–3 và A1–A10). Mockup: `docs/mockups/posts.html`, `docs/mockups/hm-config.html`.

## Global Constraints

- Node `>=20`; không thêm dependency vào `package.json`.
- Thư mục hồ sơ: `~/.homematch-marketing/`; `secrets.json` quyền `600`; token không bao giờ xuất hiện trong log, snapshot, `input.json`, `posts.json`, HTML hay stdout.
- API: `GET {apiBaseUrl}/public/building-listing-posts-unit`, header `x-public-api-token`.
- Mã `slot` dạng `YYYY-MM-DD_HHMM`, giờ địa phương.
- Snapshot giữ 30 bản gần nhất.
- Tin đủ điều kiện: ≥ 3 ảnh `IMAGE`. Bài 1 tin: mục tiêu 5 ảnh. Bài nhiều tin: bìa từng tin trước, tổng mục tiêu 5; hơn 5 tin thì mỗi tin 1 bìa, tối đa 10.
- Ảnh đặt tên theo thứ tự đăng `1.<ext>`, `2.<ext>`…; `1` là bìa. Bài 1 bản: ảnh nằm thẳng trong thư mục bài; nhiều bản: `A/`, `B/`, `C/`.
- Thư mục bài: `<outputDir>/<slot>/<NN>_<slug đích>_<post_code|gom|brand>/`, `NN` 2 chữ số theo thứ tự đăng.
- Ưu tiên tin: khớp leads > `NEW` > `PRICE_DOWN` > `NOW_AVAILABLE` > `UNCHANGED` (`PRICE_UP` xếp cùng `UNCHANGED`); trong cùng mức, tin lâu chưa soạn cho đích đó nhất đứng trước.
- Mỗi nhóm tối đa 1 bài mỗi khung. `variants` mặc định 1, tối đa 3.
- Giá viết `3,5 triệu` (dấu phẩy thập phân, bỏ `,0`: `4 triệu`).
- Nội dung chỉ văn bản thường: không `**`, `__`, dòng bắt đầu bằng `#`, không ký tự chữ toán học Unicode (U+1D400–U+1D7FF); Threads ≤ 500 ký tự.
- Không dùng `lavish-axi share`. Mọi chữ hiển thị cho người dùng bằng tiếng Việt.
- Khung bị lỡ (chạy muộn hơn giờ khung > 90 phút, vd app mở lại sau khi đóng) thì bỏ qua.

## Review Focus

1. **App đóng lúc 11:00, mở lại 15:00** → scheduler chạy bù; người dùng mong không có bài 11:00 lỗi thời. Test: `prepare` trả mã thoát `3` và không ghi gì khi trễ > 90 phút (Task 6).
2. **Claude viết sai giá hoặc làm tròn** ("3tr5", "3,6 triệu" cho 3.550.000) → không được lọt ra trang copy. Test: `validatePosts` báo lỗi khi `priceText` của tin không xuất hiện trong nội dung (Task 7).
3. **URL ảnh hết hạn / 404 / trả HTML** → bài vẫn đúng quy tắc ảnh hoặc bị bỏ có lý do. Test: ảnh 404 bị bỏ, tin còn 2 ảnh → bài vào `needsReplacement` (Task 8).
4. **Tên nhóm tiếng Việt có dấu, hai nhóm trùng tên** → thư mục không đè nhau. Test: `slugify("Phòng trọ Cầu Giấy")` → `phong-tro-cau-giay`, hai bài cùng slug vẫn khác thư mục nhờ `NN` (Task 8).
5. **Người dùng sửa tay `config.json` sai** (JSON hỏng, nhóm trỏ tới tài khoản không có, `variants: 5`) → lỗi tiếng Việt chỉ đúng trường, không chạy nửa chừng. Test: `validateConfig` (Task 1).

---

## File Structure

```
.claude-plugin/plugin.json          tên plugin, version
.claude-plugin/marketplace.json     cho `/plugin marketplace add life-with-y/marketing-flow`
package.json                        "type":"module", "test":"node --test tests/"
scripts/
  prepare.mjs                       CLI nửa đầu
  build.mjs                         CLI nửa sau
  check-api.mjs                     CLI gọi thử API (dùng ở /hm-setup)
  config-cli.mjs                    CLI: init | backup | undo | changelog | render-board | today
  lib/paths.mjs                     đường dẫn hồ sơ, expand ~
  lib/config.mjs                    load/validate config + secrets
  lib/api.mjs                       fetchListingsRaw + kiểm tra schema
  lib/listings.mjs                  gom phòng → tin, priceText
  lib/snapshot.mjs                  lưu/đọc snapshot, giữ 30
  lib/diff.mjs                      nhãn phòng/tin
  lib/targets.mjs                   đích của một khung
  lib/prepared.mjs                  nhật ký prepared.jsonl
  lib/sheet.mjs                     đọc CSV Sheet (thư viện, pending, góp ý)
  lib/posts.mjs                     validatePosts
  lib/download.mjs                  tải ảnh, đặt tên, thư mục
  lib/render-posts.mjs              index.html
  lib/render-config.mjs             trang /hm-config
  lib/config-diff.mjs               changelog giữa 2 config
  lib/os.mjs                        mở Finder/Explorer, thông báo hệ thống
assets/posts-page/template.html     từ docs/mockups/posts.html
assets/config-board/template.html   từ docs/mockups/hm-config.html
rules/hard-rules.md  rules/selection.md  rules/channel-format.md
rules/templates/config.default.json
rules/templates/persona.example.md  rules/templates/content-types.example.md
rules/templates/presets/founder-thang-than.md  rules/templates/presets/tre-nang-dong.md
skills/hm-post-prep/SKILL.md        luồng một lần chạy
skills/hm-config/SKILL.md           vòng lavish sửa config
commands/hm-setup.md  commands/hm-config.md  commands/hm-prep-now.md  commands/hm-triage.md
tests/fixtures/api-response.json    ≥ 2 quận, 1 tin nhiều phòng, 1 tin 2 ảnh, 1 tin COMING_SOON
tests/*.test.mjs
README.md                           cài đặt cho teammate (tiếng Việt)
```

Mọi module `lib/` nhận phụ thuộc (fetch, clock, fs root) qua tham số để test không chạm mạng hay `~` thật.

---

### Task 0: Spike — kiểm tra 4 rủi ro trước khi viết code

**Mục tiêu:** trả lời 4 câu hỏi; kết quả ghi vào `docs/spike-notes.md`. Câu nào trả lời "không" thì dừng, báo owner, sửa spec trước Task 1. Code spike là đồ bỏ, không commit ngoài `spike-notes.md`.

- [ ] **Step 1: Plugin cài được từ repo public.** Tạo tạm `.claude-plugin/plugin.json` (`{"name":"homematch-marketing","version":"0.0.1"}`), `.claude-plugin/marketplace.json` (`{"name":"marketing-flow","owner":{"name":"LYFE"},"plugins":[{"name":"homematch-marketing","source":"./"}]}`), `commands/hm-ping.md` (in ra "pong" và giá trị đường dẫn gốc plugin). Push lên nhánh `spike/plugin`, chạy trong Claude Code: `/plugin marketplace add life-with-y/marketing-flow@spike/plugin` → `/plugin install homematch-marketing` → `/hm-ping`. Ghi: lệnh cài chính xác, và **biến/cách để một command/skill tìm được thư mục `scripts/`** (`${CLAUDE_PLUGIN_ROOT}` hay cách khác).
- [ ] **Step 2: Scheduled task chạy được skill plugin khi vắng người.** Dùng `create_scheduled_task` với `fireAt` = 3 phút sau, prompt "Chạy /hm-ping và ghi kết quả vào ~/hm-spike.txt bằng node". Ghi: có chạy không, có bị hỏi quyền không (Bash `node …`, ghi file ngoài thư mục làm việc), chế độ quyền mà task được lưu, cwd của run.
- [ ] **Step 3: Quyền cần thiết.** Nếu Step 2 bị hỏi quyền, thử thêm vào `~/.claude/settings.json` các rule `permissions.allow` hẹp nhất (vd `Bash(node <plugin-root>/scripts/:*)`, `Write(~/.homematch-marketing/**)`, `Write(~/HomeMatch-Posts/**)`) rồi chạy lại. Ghi đúng các rule đã chạy được.
- [ ] **Step 4: `lavish-axi` trên máy sạch.** Trên máy (hoặc user macOS) chưa cài gì ngoài Node: `npx -y lavish-axi docs/mockups/hm-config.html`, gửi một prompt từ trang, `npx -y lavish-axi poll …` nhận được. Ghi thời gian lần đầu và mọi lỗi.
- [ ] **Step 5: Commit ghi chú**

```bash
git add docs/spike-notes.md && git commit -m "docs: spike notes for plugin install, scheduler, permissions, lavish"
```

---

### Task 1: Khung plugin, đường dẫn, config

**Files:**
- Create: `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` (theo Task 0), `package.json`, `scripts/lib/paths.mjs`, `scripts/lib/config.mjs`, `rules/templates/config.default.json`
- Test: `tests/config.test.mjs`

**Interfaces:**
- Produces:
  - `profileDir(home = os.homedir()): string` → `<home>/.homematch-marketing`
  - `expandHome(p: string, home?): string`
  - `loadConfig(dir: string): Config` — đọc `config.json`, trộn với `config.default.json` (giá trị người dùng thắng), gọi `validateConfig`, ném `ConfigError` (message tiếng Việt, có `field`) nếu sai
  - `validateConfig(cfg): string[]` — danh sách lỗi
  - `loadToken(dir): string` — đọc `secrets.json`; ném `ConfigError('Chưa cài token, chạy /hm-setup')` nếu thiếu
  - Kiểu `Config` đúng như spec A5.2 (`apiBaseUrl, outputDir, schedule[], model, contact[], pageContact[], library{approvedCsvUrl,trendsCsvUrl,pendingCsvUrl,feedbackCsvUrl}, feedback{formUrl, fields{person,slot,post,variant,codes,text}}, leadScan, accounts[], groups[], perSlot{}, variants{default,…}, channelMix`)
  - Mặc định nhóm: `active:true, language:"vi", days: tất cả 7 ngày, districts: []` (rỗng = toàn Hà Nội), `note:""`

- [ ] **Step 1: Viết test thất bại** `tests/config.test.mjs`:
  - `validateConfig` với nhóm `account:"fb9"` không có trong `accounts` → lỗi chứa `groups[0].account`
  - `variants: {default: 5}` → lỗi chứa `variants.default` (cho phép 1–3)
  - `schedule: ["25:00"]` → lỗi chứa `schedule[0]`
  - `days: ["mon","xyz"]` → lỗi chứa `groups[0].days`
  - `loadConfig` trên thư mục tạm có `config.json` hỏng → ném `ConfigError` với message bắt đầu `config.json không đọc được`
  - `loadConfig` với config chỉ có `apiBaseUrl`, `accounts`, `groups` → kết quả có `schedule` từ default và nhóm có `language === "vi"`
  - `loadToken` khi không có `secrets.json` → ném, message chứa `/hm-setup`
- [ ] **Step 2: Chạy** `npm test` → FAIL (module chưa có)
- [ ] **Step 3: Viết** `paths.mjs`, `config.mjs`, `config.default.json` (`schedule ["11:00","17:30"]`, `model "sonnet"`, `perSlot {}`, `variants {"default":1}`, `channelMix` mặc định Page 50/50 và cá nhân 70/30 tin phòng/thương hiệu, `outputDir "~/HomeMatch-Posts"`, `feedback.formUrl ""`)
- [ ] **Step 4: Chạy** `npm test` → PASS
- [ ] **Step 5: Commit** `feat: plugin skeleton and config loading`

---

### Task 2: Gọi API và chuẩn hoá tin

**Files:**
- Create: `scripts/lib/api.mjs`, `scripts/lib/listings.mjs`, `tests/fixtures/api-response.json`
- Test: `tests/listings.test.mjs`

**Interfaces:**
- Produces:
  - `fetchListingsRaw({ baseUrl, token, fetchImpl = fetch, timeoutMs = 30000 }): Promise<object>` — ném `ApiError{kind:'auth'|'network'|'schema'}`; `401/403` → `auth`; timeout/5xx → `network`; JSON thiếu `data[].areas[].buildings[].rooms[]` → `schema`. Không ghi token vào message.
  - `toListings(raw): Listing[]`
    ```
    Listing = { code: "T1302", link, district, buildingName, address,
                rooms: [{ room, price, priceText, status: "AVAILABLE"|"COMING_SOON", statusText, services[], furniture[] }],
                images: [{ url, isCover, order }],   // chỉ IMAGE, hợp nhất từ các phòng, bỏ trùng url, bìa đầu, rồi theo sort_order
                imageCount }
    ```
  - `formatPrice(vnd: number): string` → `3500000 → "3,5 triệu"`, `4000000 → "4 triệu"`, `3550000 → "3,55 triệu"`

- [ ] **Step 1: Viết test thất bại:**
  - `formatPrice` với 3 giá trị trên
  - `toListings(fixture)`: tin nhiều phòng gom thành 1 `Listing` có đủ `rooms`; ảnh bìa ở `images[0]`; video bị loại; url trùng giữa các phòng chỉ còn 1
  - `fetchListingsRaw` với `fetchImpl` trả 401 → `ApiError` `kind:'auth'`, và `String(err)` không chứa token giả `"tok_secret_123"`
  - `fetchImpl` trả `{data:[{}]}` → `kind:'schema'`
- [ ] **Step 2: Chạy** `node --test tests/listings.test.mjs` → FAIL
- [ ] **Step 3: Viết** `api.mjs`, `listings.mjs`
- [ ] **Step 4: Chạy** → PASS
- [ ] **Step 5: Commit** `feat: API client and listing normalization`

---

### Task 3: Snapshot và nhãn thay đổi

**Files:**
- Create: `scripts/lib/snapshot.mjs`, `scripts/lib/diff.mjs`
- Test: `tests/diff.test.mjs`

**Interfaces:**
- Consumes: `Listing` (Task 2)
- Produces:
  - `saveSnapshot(dir, slot, listings, keep = 30): void` — ghi `snapshots/<slot>.json`, xoá bản cũ nhất khi vượt `keep`
  - `latestSnapshot(dir, beforeSlot): Listing[] | null` — bản mới nhất có slot `<` `beforeSlot`
  - `labelListings(prev: Listing[]|null, curr: Listing[]): Listing[]` — thêm `room.label` và `listing.label`
  - Nhãn: `NEW | PRICE_DOWN | PRICE_UP | NOW_AVAILABLE | UNCHANGED`; khoá phòng `code + room`; `listing.label` = nhãn mạnh nhất theo thứ tự `NEW > PRICE_DOWN > NOW_AVAILABLE > UNCHANGED > PRICE_UP`; `prev === null` → mọi phòng `NEW`

- [ ] **Step 1: Viết test thất bại:** 5 nhãn mỗi loại 1 case; tin có 1 phòng `NEW` + 1 phòng `UNCHANGED` → `listing.label === 'NEW'`; `prev=null` → tất cả `NEW`; `saveSnapshot` lần thứ 31 → còn 30 file và file cũ nhất bị xoá
- [ ] **Step 2: Chạy** → FAIL
- [ ] **Step 3: Viết** `snapshot.mjs`, `diff.mjs`
- [ ] **Step 4: Chạy** → PASS
- [ ] **Step 5: Commit** `feat: snapshots and change labels`

---

### Task 4: Đích của khung giờ và nhật ký xoay vòng

**Files:**
- Create: `scripts/lib/targets.mjs`, `scripts/lib/prepared.mjs`
- Test: `tests/targets.test.mjs`

**Interfaces:**
- Consumes: `Config` (Task 1)
- Produces:
  - `targetsForSlot(cfg, date: Date, hhmm: "11:00", onlyGroups?: string[]): Target[]`
    ```
    Target = { id, kind: "group"|"wall"|"page"|"threads", account, name, url,
               districts: string[], language, note, variants: 1|2|3, contact: Contact[] }
    ```
    - nhóm: `active` và hôm nay ∈ `days` và `hhmm` ∈ `slots`; `id = "group:" + url`; mỗi nhóm đúng 1 `Target`
    - `perSlot[accountId] = n` → `n` đích `wall`/`page`/`threads` theo `type` của tài khoản, `id = "<kind>:<accountId>:<i>"`
    - `variants`: `cfg.variants[kind === "group" ? "groups" : kind]` ?? `cfg.variants.default`
    - `contact`: `page` → `cfg.pageContact`; còn lại `cfg.contact`
    - `onlyGroups` (từ `/hm-prep-now chỉ nhóm …`): chỉ trả nhóm có tên chứa một trong các chuỗi (so không dấu, không phân biệt hoa thường), không trả đích khác
  - `appendPrepared(dir, entries: {slot, account, target, postCodes, type}[]): void`
  - `lastPreparedMap(dir): Map<"<targetId>|<code>", isoString>`

- [ ] **Step 1: Viết test thất bại:** nhóm `days:["mon","wed"]` vào thứ Năm → không có; nhóm `active:false` → không có; nhóm có `slots:["17:30"]` ở khung `11:00` → không có; `perSlot {th:1}` → 1 đích `threads`; `variants {default:1, page:3}` → đích page có `variants:3`; `onlyGroups:["cau giay"]` khớp nhóm "Phòng trọ Cầu Giấy"; `lastPreparedMap` trả thời điểm mới nhất khi 1 cặp xuất hiện 2 lần
- [ ] **Step 2: Chạy** → FAIL
- [ ] **Step 3: Viết** `targets.mjs`, `prepared.mjs`
- [ ] **Step 4: Chạy** → PASS
- [ ] **Step 5: Commit** `feat: slot targets and prepared log`

---

### Task 5: Đọc Sheet (CSV) và leads

**Files:**
- Create: `scripts/lib/sheet.mjs`
- Test: `tests/sheet.test.mjs`

**Interfaces:**
- Produces:
  - `parseCsv(text): Record<string,string>[]` — dòng đầu là header; hỗ trợ ô có dấu phẩy, xuống dòng, `""` trong ngoặc kép
  - `fetchSheet(url, fetchImpl = fetch): Promise<{rows, error: string|null}>` — không ném; lỗi mạng hoặc HTTP ≠ 200 → `rows: [], error: "<lý do>"`
  - `loadLeads(dir, dateStr): object|null` — đọc `leads/<YYYY-MM-DD>.json` nếu có

- [ ] **Step 1: Viết test thất bại:** CSV có ô `"Có, nhưng ""ít"""` và ô nhiều dòng; `fetchSheet` với fetch trả 404 → `error` khác `null`, `rows` rỗng; `loadLeads` không có file → `null`
- [ ] **Step 2: Chạy** → FAIL
- [ ] **Step 3: Viết** `sheet.mjs`
- [ ] **Step 4: Chạy** → PASS
- [ ] **Step 5: Commit** `feat: sheet CSV and leads loading`

---

### Task 6: CLI `prepare` → `input.json`

**Files:**
- Create: `scripts/prepare.mjs`
- Test: `tests/prepare.test.mjs`

**Interfaces:**
- Consumes: Task 1–5
- Produces:
  - `runPrepare({ home, now: Date, slot?: "HH:MM", onlyGroups?, fetchImpl }): Promise<{ exitCode, inputPath? , message }>`; CLI: `node scripts/prepare.mjs [--slot 11:00] [--only "Cầu Giấy,Đống Đa"]`
  - Mã thoát: `0` ok; `2` lỗi config/token/API (in message tiếng Việt); `3` khung bị lỡ (trễ > 90 phút so với `--slot`); `4` không có đích nào hôm nay
  - Không có `--slot` (chạy tay): slot = giờ hiện tại làm tròn xuống phút, không kiểm tra trễ
  - Ghi `<home>/.homematch-marketing/runs/<slot>/input.json`:
    ```
    { slot, generatedAt,
      targets: Target[],
      listings: (Listing & { eligible: boolean, lastPrepared: {[targetId]: iso} })[],  // sắp theo thứ tự ưu tiên chung
      leads: object|null,
      library: { approved: rows, trends: rows, pending: rows, errors: string[] },
      paths: { hardRules, selection, channelFormat, persona, contentTypes, channelMix },  // tuyệt đối; persona/contentTypes ưu tiên file cá nhân, không có thì mẫu chung
      contact, pageContact }
    ```
  - Thứ tự ưu tiên trong `listings`: tin khớp leads (nếu có `leads.demands[]` với `district` và `maxPrice`) > nhãn theo Global Constraints. Xoay vòng theo đích do Claude áp dụng từ `lastPrepared`.

- [ ] **Step 1: Viết test thất bại** (home tạm, fetch giả trả fixture):
  - chạy lần đầu → mã `0`, `input.json` tồn tại, mọi tin `label: "NEW"`, tin 2 ảnh có `eligible: false`, file không chứa chuỗi token
  - `slot: "11:00"`, `now` = 12:31 cùng ngày → mã `3`, không có file snapshot mới
  - fetch giả 401 → mã `2`, message chứa `Token không hợp lệ, xin admin token mới`
  - API lỗi lần 1, ok lần 2 → mã `0` (thử lại 1 lần; test truyền `retryDelayMs: 0`)
  - không nhóm nào hợp lệ và `perSlot` rỗng → mã `4`
- [ ] **Step 2: Chạy** → FAIL
- [ ] **Step 3: Viết** `prepare.mjs` (thử lại API 1 lần sau 30 giây; snapshot chỉ ghi khi API ok)
- [ ] **Step 4: Chạy** → PASS
- [ ] **Step 5: Commit** `feat: prepare CLI writes run input`

---

### Task 7: Kiểm tra `posts.json` bằng luật cứng

**Files:**
- Create: `scripts/lib/posts.mjs`
- Test: `tests/posts.test.mjs`

**Interfaces:**
- Consumes: `input.json` (Task 6)
- Produces:
  - Định dạng `posts.json` (Claude ghi, cùng thư mục với `input.json`):
    ```
    { slot,
      posts: [{ targetId, type: "<tên kiểu bài>", postCodes: ["T1302"],
                variants: [{ key: "A", text: "…", images: ["<url>", …] }] }],   // images theo thứ tự đăng, [0] là bìa
      skipped: [{ targetId, reason }] }
    ```
  - `validatePosts(posts, input): { errors: {postIndex, message}[] }` — mỗi lỗi tiếng Việt, kiểm tra:
    1. `targetId` có trong `input.targets`; mỗi đích `group` tối đa 1 bài
    2. `postCodes` ⊆ tin `eligible` trong input
    3. số `variants` = `target.variants`; `key` là `A`,`B`,`C` theo thứ tự
    4. ảnh ⊆ ảnh của các tin trong `postCodes` (bài thương hiệu `postCodes` rỗng: ảnh ⊆ ảnh của tin `eligible` bất kỳ, 3–5 ảnh); bài 1 tin: `min(5, imageCount)` ảnh và ≥ 3; bài nhiều tin: ảnh `[0..k-1]` là bìa của từng tin, tổng ≤ 5 nếu ≤ 5 tin, đúng 1 bìa/tin và ≤ 10 nếu > 5 tin
    5. văn bản: không `**`, `__`, dòng bắt đầu `#`, ký tự U+1D400–U+1D7FF; đích `threads` ≤ 500 ký tự
    6. giá: với mỗi tin trong `postCodes`, ít nhất một `priceText` của phòng xuất hiện nguyên văn trong `text` (bài thương hiệu `postCodes` rỗng thì bỏ qua)
    7. mọi URL `homematch.vn` trong `text` phải bằng `link` của một tin trong `postCodes`

- [ ] **Step 1: Viết test thất bại**, mỗi luật 1 case đúng và 1 case sai, cùng 2 case Review Focus: text "3tr5" cho tin `priceText "3,5 triệu"` → lỗi; 2 bài cùng `group:` → lỗi ở bài thứ 2
- [ ] **Step 2: Chạy** → FAIL
- [ ] **Step 3: Viết** `posts.mjs`
- [ ] **Step 4: Chạy** → PASS
- [ ] **Step 5: Commit** `feat: hard-rule validation for drafted posts`

---

### Task 8: Tải ảnh vào thư mục bài

**Files:**
- Create: `scripts/lib/download.mjs`
- Test: `tests/download.test.mjs` (server `node:http` cục bộ phục vụ ảnh giả, 1 đường dẫn trả 404, 1 trả `text/html`)

**Interfaces:**
- Consumes: `posts.json`, `input.json`
- Produces:
  - `slugify(s): string` — bỏ dấu tiếng Việt (gồm `đ→d`), chữ thường, ký tự khác `[a-z0-9]` → `-`, gộp `-`, tối đa 40 ký tự
  - `postDirName(n, target, postCodes): string` → `NN_<slug(target.name)>_<code | "gom" | "brand">`
  - `downloadPosts({ posts, input, outRoot, fetchImpl }): Promise<{ posts: DownloadedPost[], needsReplacement: {targetId, reason}[] }>`
    ```
    DownloadedPost = { n, dir, targetId, variants: [{ key, dir, text, files: ["1.jpg", …] }] }
    ```
    - 1 bản → `dir/1.jpg…` + `dir/post.txt`; nhiều bản → `dir/A/…`
    - phần mở rộng lấy theo `Content-Type` (`image/jpeg→jpg`, `png`, `webp`); không phải `image/*` → coi là lỗi
    - ảnh lỗi bị bỏ, đánh số lại liên tục; sau đó bài 1 tin < 3 ảnh hoặc bài nhiều tin mất bìa một tin → bài vào `needsReplacement`, thư mục bài bị xoá
    - Tải song song tối đa 6 ảnh

- [ ] **Step 1: Viết test thất bại:** `slugify("Phòng trọ Cầu Giấy – Đống Đa")` = `"phong-tro-cau-giay-dong-da"`; 2 bài trùng tên nhóm → 2 thư mục khác nhau (`01_…`, `02_…`); 5 ảnh với ảnh thứ 2 lỗi 404 → file `1..4`, không có lỗ; 3 ảnh, 2 lỗi → `needsReplacement` và thư mục không tồn tại; ảnh trả `text/html` → bị bỏ; 2 bản → có `A/1.jpg` và `B/1.jpg`, `B/1.jpg` là ảnh `[0]` của bản B
- [ ] **Step 2: Chạy** → FAIL
- [ ] **Step 3: Viết** `download.mjs`
- [ ] **Step 4: Chạy** → PASS
- [ ] **Step 5: Commit** `feat: download post photos in posting order`

---

### Task 9: Trang bài đăng, kết thúc lượt chạy, CLI `build`

**Files:**
- Create: `assets/posts-page/template.html`, `scripts/lib/render-posts.mjs`, `scripts/lib/os.mjs`, `scripts/build.mjs`
- Test: `tests/render-posts.test.mjs`, `tests/build.test.mjs`

**Interfaces:**
- Consumes: Task 4 (`appendPrepared`), 7, 8
- Produces:
  - `renderPostsPage({ slot, generatedAt, posts: DownloadedPost[], targets, accounts, skipped, pending, notes: string[], feedback, person }): string` — `notes` gồm `input.library.errors` (vd "Không đọc được Trends, đã soạn không dùng Trends") và hiện ở cuối trang cùng mục bài bị bỏ — template lấy từ `docs/mockups/posts.html`, dữ liệu thật thay dữ liệu mẫu; ảnh dùng đường dẫn tương đối tới file đã tải; nút Góp ý mở `feedback.formUrl` kèm tham số `fields` đã encode (không có `formUrl` thì ẩn nút); mọi chuỗi người dùng đều được escape HTML
  - `openFolder(path, platform = process.platform)` → `open` / `explorer`; `notify(title, body, platform)` → `osascript -e 'display notification …'` trên `darwin`, PowerShell balloon trên `win32`, bỏ qua nơi khác; cả hai không ném
  - `runBuild({ home, slot, fetchImpl, platform }): Promise<{ exitCode, report }>`; CLI `node scripts/build.mjs --slot 2026-11-19_1100`
    - mã `5` + in lỗi `validatePosts` dạng danh sách khi có lỗi (skill sẽ sửa rồi chạy lại)
    - mã `6` + in `needsReplacement` khi có bài cần thay tin (skill thay một lần rồi chạy lại; lần 2 còn thiếu thì đưa vào `skipped`)
    - mã `0`: đã ghi `<outputDir>/<slot>/index.html`, gọi `appendPrepared`, `openFolder(<outputDir>/<slot>)`, `notify("HomeMatch", "Đã soạn N bài lúc HH:MM")`

- [ ] **Step 1: Viết test thất bại:**
  - render: chứa đúng N thẻ; nội dung có `<script>` bị escape; bài 2 bản có tab `Bản A`, `Bản B`; không có `formUrl` → không có nút Góp ý; HTML không chứa token giả
  - build (home tạm, input + posts mẫu, server ảnh cục bộ, `platform: "test"`): mã `0` → `index.html` tồn tại, `prepared.jsonl` thêm đúng số dòng; posts sai giá → mã `5`, không có `index.html`
- [ ] **Step 2: Chạy** → FAIL
- [ ] **Step 3: Viết** template + `render-posts.mjs`, `os.mjs`, `build.mjs`
- [ ] **Step 4: Chạy** `npm test` → PASS; mở `index.html` sinh từ test trong trình duyệt, kiểm tra copy, carousel, tick Đã đăng
- [ ] **Step 5: Commit** `feat: posts page and build CLI`

---

### Task 10: Rules, mẫu và skill soạn bài

**Files:**
- Create: `rules/hard-rules.md`, `rules/selection.md`, `rules/channel-format.md`, `rules/templates/persona.example.md`, `rules/templates/content-types.example.md`, `rules/templates/presets/founder-thang-than.md`, `rules/templates/presets/tre-nang-dong.md`, `skills/hm-post-prep/SKILL.md`, `commands/hm-prep-now.md`

**Interfaces:**
- Consumes: CLI `prepare` (Task 6), `build` (Task 9), định dạng `posts.json` (Task 7)

- [ ] **Step 1: Viết rules** — nội dung lấy nguyên từ spec: `hard-rules.md` (A5.1, 4 điều + văn bản thường), `selection.md` (A4.3), `channel-format.md` (Threads ≤ 500, giá `3,5 triệu`, `•` cho gạch đầu dòng), `content-types.example.md` (3 kiểu, mỗi kiểu đủ: tên, kênh, số tin, cách chọn tin, cấu trúc, 1 ví dụ), persona mẫu và 2 preset (founder: "nói thật, ngắn, có số; không siêu phẩm / giá sốc / nhanh tay kẻo lỡ").
- [ ] **Step 2: Viết `skills/hm-post-prep/SKILL.md`** — thứ tự cố định:
  1. Chạy `prepare` (truyền `--slot` khi được gọi từ lịch, `--only` khi có). Mã `3`/`4`: dừng im lặng, kết thúc. Mã `2`: báo lỗi nguyên văn, dừng.
  2. Đọc `input.json` và các file trong `paths`.
  3. Với mỗi đích: chọn kiểu bài hợp kênh theo `channelMix`, chọn tin theo thứ tự ưu tiên và `lastPrepared`, viết `variants` theo persona (Page: skill `homematch-context`), đúng `language`, CTA theo `contact` và mặc định an toàn khi quy định nhóm còn pending; ghi `posts.json`.
  4. Chạy `build`. Mã `5`: sửa đúng các lỗi được liệt kê, chạy lại, tối đa 2 lần; còn lỗi thì chuyển bài đó vào `skipped` với lý do. Mã `6`: thay tin cho bài trong danh sách một lần, lần 2 vẫn thiếu thì `skipped`.
  5. Kết thúc bằng một dòng: số bài, đường dẫn `index.html`.
  - Không bao giờ in nội dung `secrets.json`.
- [ ] **Step 3: Viết `commands/hm-prep-now.md`** — gọi skill `hm-post-prep`, không `--slot`, chuyển `chỉ nhóm …` thành `--only`.
- [ ] **Step 4: Kiểm tra thật** trên máy owner (cần token và config tay tạm thời): `/hm-prep-now` → `index.html` mở được, mọi giá/mã/link khớp API (so 3 bài ngẫu nhiên với homematch.vn), ảnh đúng quy tắc, nội dung dán vào ô soạn bài Facebook giữ đúng xuống dòng; chạy lần 2 → tin khác ở cùng nhóm (xoay vòng); `/hm-prep-now chỉ nhóm Cầu Giấy` → chỉ nhóm đó.
- [ ] **Step 5: Commit** `feat: post-prep skill, rules and templates`

---

### Task 11: Trang cấu hình — dựng trang, changelog, sao lưu

**Files:**
- Create: `assets/config-board/template.html`, `scripts/lib/render-config.mjs`, `scripts/lib/config-diff.mjs`, `scripts/config-cli.mjs`
- Test: `tests/config-board.test.mjs`

**Interfaces:**
- Consumes: Task 1, Task 4 (`targetsForSlot` cho "Hôm nay sẽ soạn")
- Produces:
  - `renderConfigBoard({ cfg, persona, contentTypes, pending, today: Date, lastChange: {at, lines}|null, tokenLabel: string|null }): string` — 2 tab đúng spec A6 và mockup; token chỉ hiện `đã cài` + `tokenLabel` (tên token người dùng nhập ở `/hm-setup`, không phải token)
  - `diffConfig(oldCfg, newCfg): string[]` — dòng tiếng Việt, vd `Nhóm Nhà trọ Hoàng Mai: bật → tạm ngừng`, `Giờ chạy: 17:00 → 17:30`, `Nhóm Hanoi Expats Housing: thêm mới`
  - CLI `config-cli.mjs`:
    - `init` — tạo hồ sơ từ mẫu nếu chưa có, không ghi đè
    - `backup` — chép `config.json`, `persona.md`, `content-types.md` vào `history/<ISO>/`
    - `undo` — khôi phục bản `history` mới nhất, in changelog
    - `changelog` — in `diffConfig(history mới nhất, hiện tại)`
    - `render-board` — ghi `~/.homematch-marketing/board/index.html`, in đường dẫn
    - `today` — in JSON các đích của từng khung hôm nay

- [ ] **Step 1: Viết test thất bại:** `diffConfig` cho 3 thay đổi trên ra đúng 3 dòng; `renderConfigBoard` không chứa token giả, nhóm tạm ngừng có class `off`, tab Hồ sơ có Persona mở sẵn; `backup` rồi sửa rồi `undo` → file trở lại như cũ
- [ ] **Step 2: Chạy** → FAIL
- [ ] **Step 3: Viết** template + 3 module + CLI
- [ ] **Step 4: Chạy** → PASS
- [ ] **Step 5: Commit** `feat: config board rendering, changelog and history`

---

### Task 12: Skill `/hm-config` và đồng bộ lịch

**Files:**
- Create: `skills/hm-config/SKILL.md`, `commands/hm-config.md`

**Interfaces:**
- Consumes: `config-cli.mjs` (Task 11), `validateConfig` (Task 1), tool `create/update/delete/list_scheduled_tasks`

- [ ] **Step 1: Viết `SKILL.md`** — vòng cố định:
  1. `config-cli render-board` → `npx -y lavish-axi <file>` → `lavish-axi poll <file>` (nền, có theo dõi).
  2. Nhận yêu cầu: `config-cli backup` → sửa `config.json` / `persona.md` / `content-types.md` → `validateConfig`; lỗi thì `undo` và trả lời lỗi.
  3. Nếu `schedule` đổi: đồng bộ scheduled task — mỗi giờ một task id `hm-post-prep-HHMM`, cron `MM HH * * *`, prompt tự đủ: "Dùng skill hm-post-prep với --slot HH:MM"; xoá task của giờ không còn.
  4. Dựng lại trang, `lavish-axi poll --agent-reply "<changelog>"`.
  5. "Hoàn tác" → `config-cli undo` rồi bước 3–4.
  - Không bao giờ dùng `lavish-axi share`; không đọc hay sửa `secrets.json` (đổi token → bảo chạy `/hm-setup`); `lavish-axi` lỗi → cho sửa bằng chat.
- [ ] **Step 2: Kiểm tra thật:** tạm ngừng 1 nhóm, thêm 1 nhóm, đổi 17:30 → 18:00 (kiểm tra `list_scheduled_tasks` có `hm-post-prep-1800`, không còn `-1730`), hoàn tác, yêu cầu sai (`variants 5`) bị từ chối và config không đổi.
- [ ] **Step 3: Commit** `feat: /hm-config skill with schedule sync`

---

### Task 13: `/hm-setup`

**Files:**
- Create: `commands/hm-setup.md`, `scripts/check-api.mjs`
- Test: `tests/check-api.test.mjs`

**Interfaces:**
- Consumes: Task 1, 2, 11, 12; kết quả quyền từ Task 0

- [ ] **Step 1: Viết test thất bại** cho `checkApi({ baseUrl, token, fetchImpl })` → `{ ok: true, listingCount }` hoặc `{ ok: false, message }` (401 → `Token không hợp lệ, xin admin token mới`)
- [ ] **Step 2: Chạy** → FAIL; **Step 3: Viết** `check-api.mjs` (CLI đọc token từ stdin, không nhận token qua tham số dòng lệnh); **Step 4: Chạy** → PASS
- [ ] **Step 5: Viết `commands/hm-setup.md`** theo spec A6:
  1. hỏi `apiBaseUrl`, token và tên token; `check-api`; ghi `secrets.json` với quyền `600` (`{ token, label }`)
  2. `config-cli init`; hỏi giờ chạy (hiện mặc định)
  3. thêm đúng các rule quyền đã xác định ở Task 0 vào `~/.claude/settings.json`, hiện cho người dùng trước khi ghi
  4. tạo scheduled task như Task 12 bước 3
  5. hỏi có phụ trách Page không (mặc định Không), liên hệ, persona (preset hoặc vài câu phỏng vấn)
  6. mở `/hm-config`
  - Chạy lại: chỉ hỏi phần người dùng muốn đổi, không ghi đè file cá nhân khi chưa hỏi
- [ ] **Step 6: Kiểm tra thật** trên một user macOS sạch: cài plugin → `/hm-setup` → đợi đến giờ chạy kế tiếp, lịch tự chạy không hỏi quyền, Finder mở, có thông báo.
- [ ] **Step 7: Commit** `feat: /hm-setup`

---

### Task 14: `/hm-triage` và README

**Files:**
- Create: `commands/hm-triage.md`, `README.md`

- [ ] **Step 1: Viết `commands/hm-triage.md`** (chỉ owner): đọc `library.feedbackCsvUrl` qua `sheet.mjs`, lấy dòng chưa có cột `Issue`; gộp trùng; phân loại `nội dung/persona | chọn tin | giao diện | lỗi`; với mỗi nhóm: `gh issue create --repo life-with-y/marketing-flow --title … --body …` (body: tóm tắt, các dòng gốc kèm thời điểm, khung, số bài, mã tin; label theo loại); sau đó đánh dấu `Đã tạo issue #n` vào dòng Sheet qua kết nối Google Sheets của owner (không có kết nối thì in danh sách để owner tự đánh dấu). Không chạy nếu `gh auth status` lỗi.
- [ ] **Step 2: Viết `README.md`** (tiếng Việt): yêu cầu (Claude Code trả phí, app desktop, Node ≥ 20), lệnh cài plugin chính xác từ Task 0, xin token từ admin, `/hm-setup`, `/hm-config`, `/hm-prep-now`, máy phải bật lúc đến giờ, cách góp ý.
- [ ] **Step 3: Kiểm tra thật:** 2 góp ý giả trùng nhau trong Sheet → `/hm-triage` tạo 1 issue có cả 2 dòng gốc.
- [ ] **Step 4: Commit** `feat: /hm-triage and README`

---

## Thứ tự và phụ thuộc

```
0 ─┬─ 1 ─┬─ 2 ─ 3 ─┐
   │     ├─ 4 ─────┼─ 6 ─ 7 ─ 8 ─ 9 ─ 10
   │     └─ 5 ─────┘                   │
   │                       11 ─ 12 ─ 13 ─ 14
```
Task 2/4/5 độc lập với nhau sau Task 1. Task 11 cần 1 và 4. Task 13 cần 0, 10, 12.
