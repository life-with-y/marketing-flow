# HomeMatch Marketing — Spec

Ngày: 2026-11-19 · Trạng thái: đã grill phần A (Q1–Q36), chờ duyệt bản viết

Spec này gồm tổng quan cả hệ thống và chi tiết **Phần A: Soạn bài theo lịch**. Phần B và C chỉ có khung; mỗi phần sẽ được grill, có spec → plan riêng trước khi làm.

## 1. Tổng quan

### 1.1 Các phần

| Phần | Việc | Ai / khi nào | Bắt buộc |
|---|---|---|---|
| **A. Soạn bài theo lịch** | Lấy phòng trống từ API, soạn bài theo giọng từng người, tải ảnh, dựng trang copy | Claude, mỗi khung giờ của từng người | Có |
| **B. Bài mẫu + trends** | Thu bài hay trong ngành (research + team góp), owner duyệt, tổng hợp xu hướng | Owner, hằng tuần | Không, A chạy được khi chưa có |
| **C. Quét bài tìm phòng** | Đọc nhóm FB bằng tài khoản đã đăng nhập, tìm người cần phòng, gợi ý phòng trong kho | Claude, việc đầu tiên mỗi ngày | Không, bật/tắt theo từng người |
| **D. Người làm** | Comment trả lời khách, đăng bài đã soạn | Người dùng, tay | — |

### 1.2 Lịch

```
Hằng tuần (owner):   B  duyệt góp ý → /hm-research → /hm-trends → tab Trends

Hằng ngày (mỗi người, giờ theo config cá nhân):
  [tuỳ chọn] C quét nhóm (vd 10:00) → leads/<ngày>.json + leads.html
             A soạn bài (vd 11:00)    → đọc Trends + nhu cầu từ C (nếu có) → index.html
             A soạn bài (vd 17:30)    → như trên
             D người làm              → trả lời khách (leads.html), đăng bài (index.html)
```

### 1.3 Thứ tự xây

A → C → B. A dựng phần móng mà C và B dùng lại (API, config, persona, trang HTML). Trong lúc chưa xây B, owner làm việc hằng tuần bằng tay.

### 1.4 Giao tiếp giữa các phần

- **B → A**: A đọc tab *Trends* và các bài *Đã duyệt* trong Google Sheet nếu config có link. Không có thì bỏ qua.
- **C → A**: C ghi `~/.homematch-marketing/leads/<YYYY-MM-DD>.json`, gồm nhu cầu đã chuẩn hoá (quận, khoảng giá, số người, ngày vào ở) và số lượt mỗi nhu cầu. A đọc file của hôm nay nếu có, rồi ưu tiên tin khớp nhu cầu nhiều người hỏi. A không bao giờ chờ C.

## 2. Nơi lưu

| Ở đâu | Chứa gì | Ai sửa |
|---|---|---|
| GitHub repo **public** `life-with-y/marketing-flow` | code, skill, lệnh, template trang cấu hình, `hard-rules`, mặc định chung, mẫu persona/kiểu bài trung tính | owner |
| Google Sheet "Bài mẫu" (giới hạn theo link) | bài mẫu góp qua Form, bài mẫu đã duyệt, tab *Trends*, tab *Cần tìm hiểu*, tab *Góp ý* (góp ý về plugin) | team góp qua Form; owner duyệt, ghi Trends và mục pending, chuyển góp ý thành issue |
| Máy từng người `~/.homematch-marketing/` | token, config, persona, kiểu bài riêng, snapshot, nhật ký, leads, lịch sử config | người đó (qua `/hm-config`) |

- Repo không chứa bí mật hay kiến thức nghề. Repo public nên teammate cài plugin không cần tài khoản GitHub, và plugin tự cập nhật.
- Plugin đọc Sheet qua link CSV "Publish to web" (tab Đã duyệt, Trends, Cần tìm hiểu), nên không ai cần kết nối Google. Sheet chỉ chứa nội dung công khai và ghi chú nghiên cứu.
- Duyệt: cột Trạng thái (Chờ duyệt / Đã duyệt / Từ chối) được khoá, chỉ owner sửa.

## 3. Bảo mật API

- Mỗi người một token, ADMIN tạo ở Admin › Cài đặt › Quản lý token, đặt tên theo người.
- Token chỉ đọc được `GET /public/building-listing-posts-unit`.
- Người nghỉ thì xoá token, có hiệu lực ngay.
- `/hm-setup` lưu token vào `~/.homematch-marketing/secrets.json` (quyền `600`), tách khỏi `config.json`.
- Script tự đọc token và gắn header `x-public-api-token`. Token không xuất hiện trong log, snapshot, trang HTML hay output của Claude. Trang cấu hình chỉ hiện "Token: đã cài".
- Không dùng tài khoản Admin/Partner, vì như vậy phải lưu mật khẩu và quyền quá rộng.

---

# Phần A: Soạn bài theo lịch

## A1. Mục tiêu

Đến giờ chạy, mở `index.html` là có đủ bài cho khung giờ đó: đăng tài khoản nào, vào nhóm nào, nội dung để copy, thư mục ảnh để chọn khi upload. Người dùng **tự đăng tay** từ máy tính.

Thành công khi:
- Mọi dữ kiện trong bài (giá, trạng thái, mã T…, link) khớp với API tại thời điểm chạy.
- Mọi bài đều có ảnh.
- Teammate cài plugin, chạy `/hm-setup` rồi chỉnh trên `/hm-config` là dùng được, với persona và nhóm của riêng họ.

Ngoài phạm vi: tự động đăng lên bất kỳ kênh nào (kể cả Page Graph API, Threads API); thay đổi backend HomeMatch; ghi nhận bài đã đăng; đo hiệu quả bài; gắn mã giới thiệu vào link; video; tự dọn thư mục cũ; gợi ý nhịp đăng; nhật ký chung giữa các teammate; góp ý trên trang bài đăng.

Kênh: FB cá nhân (có thể nhiều tài khoản), FB Page HomeMatch, Threads cá nhân, nhóm FB. Nội dung trộn tin phòng và thương hiệu.

## A2. Kiến trúc

Claude Code plugin.
- **Script (Node, chạy được Mac và Windows)**: các bước cố định (fetch, so sánh, tải ảnh, dựng HTML, ghi nhật ký).
- **Claude (skill)**: chọn tin cho từng kênh/nhóm, soạn nội dung, sửa config theo góp ý.
- **Lịch**: scheduled task của app Claude desktop trên máy từng người, dùng model mặc định của app Claude (scheduled task không đặt được model trong config; muốn đổi thì sửa trong cài đặt task ở mục Scheduled). Máy phải bật và app phải mở lúc đến giờ. **Bỏ lỡ thì bỏ qua**, không chạy bù.
- **Trang cấu hình**: `lavish-axi` (chạy qua `npx`), chỉ trên máy.

```
marketing-flow/
├─ .claude-plugin/plugin.json
├─ skills/
│   ├─ hm-post-prep/SKILL.md        luồng một lần chạy
│   └─ hm-config/SKILL.md           dựng trang cấu hình, áp góp ý
├─ commands/
│   ├─ hm-setup.md
│   ├─ hm-config.md
│   ├─ hm-prep-now.md
│   └─ hm-triage.md                 owner: góp ý → issue
├─ scripts/
│   ├─ fetch.mjs
│   ├─ diff.mjs
│   ├─ download.mjs
│   ├─ build.mjs                    page-data.json + trang chủ
│   ├─ config-cli.mjs               hồ sơ, history, render-board
│   └─ lib/render-home.mjs          trang chủ index.html (dùng render-posts, render-config, content-types)
├─ assets/home/                     template + css trang chủ (cố định)
├─ rules/
│   ├─ hard-rules.md
│   ├─ selection.md
│   ├─ channel-format.md
│   └─ templates/
│       ├─ config.default.json
│       ├─ persona.example.md
│       ├─ content-types.example.md
│       └─ presets/
│           ├─ founder-thang-than.md
│           └─ tre-nang-dong.md
└─ docs/spec.md
```

## A3. Nguồn dữ liệu

`GET {apiBaseUrl}/public/building-listing-posts-unit`, header `x-public-api-token`.

- API trả mọi phòng `AVAILABLE` / `COMING_SOON` của tin đang hiển thị, nhóm theo quận → toà → phòng.
- Trường plugin dùng:
  - quận: `district`, `district_link`
  - toà: `building_name`, `address_text`
  - phòng: `post_code`, `share_link`, `room_number`, `rent_price`, `availability_status`, `availability_text`, `services`, `furniture`, `media[]` (url, media_type, is_cover, sort_order)
- **Tin** là tập phòng cùng `post_code` (cùng `share_link`). Plugin gom phòng thành tin ngay sau fetch.
- API quyết định trường nào được lộ ra. Plugin không lọc lại; muốn che thêm thì sửa API.
- API không có diện tích, loại phòng, tiêu đề tin, nên nội dung không nhắc tới các thông tin này.
- Link dùng nguyên `share_link`, không gắn mã giới thiệu.

## A4. Luồng một lần chạy

Kích hoạt: lịch, hoặc `/hm-prep-now` (có thể chỉ định nhóm, vd `/hm-prep-now chỉ nhóm Cầu Giấy, Đống Đa`, khi đó chỉ soạn cho các nhóm đó). Mã `slot` dạng `YYYY-MM-DD_HHMM`.

1. **Fetch (script)**: gọi API, lưu `snapshots/<slot>.json`, giữ 30 bản gần nhất.
2. **So sánh (script)**:
   - Khoá phòng là `post_code + room_number`. So với snapshot liền trước, gắn nhãn phòng: `NEW`, `PRICE_DOWN` / `PRICE_UP`, `NOW_AVAILABLE` (`COMING_SOON` → `AVAILABLE`), `UNCHANGED`. Lần đầu chạy thì mọi phòng là `UNCHANGED` (chưa có bản trước nên không biết gì là mới).
   - Nhãn tin là nhãn mạnh nhất trong các phòng của nó, theo thứ tự ưu tiên ở bước 3.
   - Đọc `prepared.jsonl` để biết lần gần nhất mỗi tin được soạn cho mỗi đích.
3. **Chọn và soạn (Claude)**:
   - Đọc: `hard-rules`, mặc định chung, hồ sơ cá nhân, Trends và bài Đã duyệt (nếu có), tab Cần tìm hiểu (nếu có), `leads/<hôm nay>.json` (nếu có).
   - **Đích của khung giờ**:
     - nhóm có `active: true`, có hôm nay trong `days` và có khung này trong `slots`; mỗi nhóm **tối đa 1 bài** mỗi khung
     - các kênh trong `perSlot` (tường cá nhân, Page, Threads)
   - **Kiểu bài**: mỗi đích nhận một kiểu bài dùng được cho kênh đó, theo tỉ lệ `channel-mix`. Kiểu bài quyết định số tin trong bài (1 hoặc nhiều) và cách chọn tin.
   - **Điều kiện tin**: có ít nhất 3 ảnh `IMAGE`.
   - **Ưu tiên**: khớp nhu cầu được hỏi nhiều (nếu có leads) > `NEW` > `PRICE_DOWN` > `NOW_AVAILABLE` > `UNCHANGED`. Trong cùng mức thì ưu tiên tin chưa được soạn cho đích đó lâu nhất (xoay vòng mềm, không chặn tin nào).
   - **Ngày không có gì mới**: vẫn soạn đủ số bài bằng tin `UNCHANGED`, xoay vòng như trên.
   - **Ghép nhóm theo quận**: nhóm có `districts` chỉ nhận tin thuộc các quận đó. Nhóm không khai `districts` là nhóm toàn Hà Nội.
   - Một tin có thể vào nhiều nhóm trong cùng khung, mỗi nhóm một phiên bản nội dung riêng (mở bài, thứ tự ý, CTA), dữ kiện giữ nguyên.
   - **Ngôn ngữ** theo `language` của nhóm (mặc định `vi`). Các kênh không phải nhóm dùng `vi`.
   - **CTA** chọn theo thứ tự ưu tiên trong `contact`, lùi xuống kênh mà nhóm cho phép. Page dùng `pageContact`.
   - **Quy định nhóm đang pending** (cách ghi liên hệ, link, tiền tố…): dùng mặc định an toàn: không SĐT, không link, CTA "nhắn tin / comment mã T…". `note` của nhóm luôn được tuân theo.
   - Bài thương hiệu cũng phải có ảnh, lấy từ tin thật trong snapshot.
   - Trends chỉ gợi ý cấu trúc (mở bài, định dạng, độ dài), không ghi đè persona.
   - **Phiên bản**: mỗi bài có số bản theo `variants` (mặc định 1, tối đa 3, đặt được theo kênh). Các bản khác nhau ở nội dung (mở bài, thứ tự ý, CTA) và thứ tự ảnh; dữ kiện, tin và bộ ảnh nguồn giữ nguyên. Không ghi nhận người dùng chọn bản nào.
   - Giá ghi dạng `3,5 triệu`.
   - **Chỉ văn bản thường** dán được nguyên lên Facebook/Threads: chữ thường, xuống dòng, emoji, gạch đầu dòng bằng ký tự `•`. Không dùng markdown (`**…**`, `#`, `_…_`) và không dùng chữ "đậm/nghiêng" giả bằng ký tự Unicode.
4. **Tải ảnh (script)**:
   - Mỗi bài một thư mục `<outputDir>/<slot>/<NN>_<đích>_<post_code|brand>/`, chứa `post.txt` và ảnh đặt tên theo **thứ tự đăng**: `1.jpg`, `2.jpg`, `3.jpg`…; `1.jpg` luôn là ảnh đầu tiên (ảnh bìa). Người dùng chọn ảnh theo đúng thứ tự tên khi upload.
   - Bài 1 bản: ảnh và `post.txt` nằm thẳng trong thư mục bài. Bài nhiều bản: mỗi bản một thư mục con `A/`, `B/`, `C/`, mỗi thư mục có `post.txt` và ảnh đánh số lại theo thứ tự của bản đó (`1.jpg` là ảnh bìa của bản ấy).
   - **Bài 1 tin**: mục tiêu 5 ảnh, ảnh bìa trước. Tin có 3–4 ảnh thì dùng đủ số đó.
   - **Bài nhiều tin**: mục tiêu tổng 5 ảnh. Lấy ảnh bìa từng tin trước, còn chỗ thì thêm ảnh của tin đứng đầu. Bài hơn 5 tin thì mỗi tin 1 ảnh bìa, tối đa 10 ảnh.
   - Ảnh được đổi sang jpg trên Mac khi có thể (ảnh webp/png đổi bằng `sips`, giữ số thứ tự). Đổi lỗi hoặc không phải Mac thì giữ file gốc (`1.webp`, `2.png`…).
   - Ảnh tải lỗi thì bỏ ảnh. Tin còn dưới 3 ảnh (bài 1 tin) hoặc tin mất ảnh bìa (bài nhiều tin) thì Claude thay tin một lần, vẫn thiếu thì bỏ bài.
5. **Trang chủ (script)**: build ghi `<outputDir>/<slot>/page-data.json` (bài kèm file ảnh, đích và tài khoản liên quan, bài bị bỏ, pending, ghi chú, giờ soạn xong) rồi dựng lại **một trang chủ** `<outputDir>/index.html` từ hồ sơ và mọi `page-data.json`. Không còn `index.html` riêng trong thư mục khung. File tĩnh, mở không cần server, không cần mạng (pending lấy từ dữ liệu đã có). Kiểu chữ: serif, mực đen trên giấy trắng. Chi tiết trang ở A6 `/hm-config`; tab **Bài đăng** gồm:
   - **Chọn khung**: `‹ dd/mm HH:MM ▾ ›` trên 14 khung gần nhất có trong `outputDir`, mặc định khung mới nhất.
   - **Thanh trên của khung luôn hiện**: giờ khung, ngày, giờ soạn xong, tiến độ "đã đăng x / N" kèm thanh mảnh, bộ lọc theo tài khoản, dòng ghi thư mục ảnh của khung.
   - **Mỗi bài một thẻ**, theo thứ tự đăng:
     - số thứ tự (trùng tiền tố thư mục `NN_`), đích, tài khoản đăng
     - nhãn thay đổi (Mới / Giảm giá / Vừa trống) và kiểu bài
     - **khung xem trước nội dung giống bài trên Facebook/Threads**: font hệ thống (`-apple-system, system-ui, "Segoe UI", Helvetica, Arial`), 15px, nền trắng viền xám, dòng tên người đăng ở đầu khung; dòng tên không nằm trong phần được copy
     - ảnh thu nhỏ theo thứ tự đăng (ảnh `1.jpg` = bìa, hiện to), không đè chữ hay số lên ảnh; dưới ảnh ghi số ảnh và mã tin. Đường dẫn ảnh tương đối từ `<outputDir>/index.html` (vd `2026-11-20_1014/01_x/1.jpg`)
     - **bấm vào ảnh bất kỳ mở carousel** để xem lại trước khi đăng: ảnh lớn, số "n / tổng" và tên file, nút ← → và phím mũi tên, dải ảnh nhỏ để nhảy ảnh, Esc hoặc bấm nền để đóng
     - bài Threads có bộ đếm "n / 500 ký tự"
   - Bài nhiều bản có tab **Bản A · B · C** trong thẻ; đổi tab thì đổi nội dung, thứ tự ảnh và thư mục ảnh.
   - Nút **Copy nội dung**, **Copy thư mục ảnh** (của bản đang mở; dùng với ⌘⇧G trên Mac, dán vào ô đường dẫn trên Windows), link **Mở nhóm / Page / Threads ↗** (chỉ http/https), nút **Góp ý** (xem A8), nút **Sửa kiểu bài này** (điền sẵn vào ô yêu cầu `Kiểu <kiểu>: (bài <slot> số <n>, mã <mã>) `, không đổi tab).
   - Ô **Đã đăng** chỉ lưu bằng localStorage, riêng từng khung; tick thì thẻ thu gọn và tiến độ tăng. Không ảnh hưởng việc chọn tin.
   - Cuối khung, thu gọn được: các bài bị bỏ và lý do; các mục pending đang ảnh hưởng tới bài; ghi chú.
6. **Ghi nhật ký và báo**:
   - Thêm vào `prepared.jsonl` một dòng mỗi bài (`slot`, `account`, `target`, `post_codes`, `type`). Nhật ký chỉ dùng để xoay vòng; không ghi nhận bài đã đăng hay chưa.
   - Mở thư mục `<outputDir>/<slot>/` trong Finder (Mac) hoặc Explorer (Windows). Trang không có nút mở thư mục từng bài, vì trình duyệt không cho trang tĩnh mở Finder.
   - Báo và gửi thông báo hệ thống: "Đã soạn N bài lúc HH:MM: `<outputDir>/index.html`".
   - Không tự xoá thư mục cũ; người dùng tự xoá.

## A5. Cấu hình

Thứ tự ưu tiên: `hard-rules` > hồ sơ cá nhân > mặc định chung > Trends (Trends chỉ ảnh hưởng cấu trúc).

### A5.1 Chung (repo, owner sửa)

- `hard-rules.md` (không ai ghi đè):
  - Chỉ dùng dữ kiện có trong API.
  - Không bịa dữ kiện (diện tích, số phòng còn lại, lượt xem, "phòng cuối"…).
  - Không đổi giá, trạng thái, mã T…, link.
  - Không nói hay ám chỉ tin được ưu tiên hiển thị vì chủ nhà trả tiền.
- `selection.md`: ≥3 ảnh mỗi tin, mục tiêu 5 ảnh mỗi bài, thứ tự ưu tiên và xoay vòng ở A4.3, mỗi nhóm tối đa 1 bài mỗi khung.
- `channel-format.md`: giới hạn từng kênh (vd Threads ≤ 500 ký tự), định dạng giá. Claude đề xuất, owner duyệt.
- `templates/config.default.json`: mặc định do owner đặt (giờ chạy, `perSlot`, CTA mẫu, `channel-mix`). `/hm-setup` hiện các mặc định này để người dùng sửa. Cập nhật mặc định không đổi config đã thiết lập.
- `templates/content-types.example.md`: 3 kiểu bài khởi đầu:
  1. **Phòng mới / giảm giá**: 1 tin, ảnh, giá, khu, link
  2. **Gom theo khu**: nhiều tin cùng khu/tầm giá, ảnh bìa mỗi tin
  3. **Thương hiệu "phòng thật, giá thật"**: ảnh phòng thật

  Mỗi kiểu khai: tên, kênh dùng được, số tin mỗi bài (vd `1` hoặc `3–5`), cách chọn tin, cấu trúc, 1 ví dụ.
- `templates/persona.example.md`, `templates/presets/`: persona mẫu.

### A5.2 Hồ sơ cá nhân (`~/.homematch-marketing/`, không commit)

- `secrets.json`: `{ "token": "…" }`, quyền `600`.
- `config.json`:
  ```jsonc
  {
    "apiBaseUrl": "https://…",
    "outputDir": "~/HomeMatch-Posts",
    "schedule": ["11:00", "17:30"],
    "contact": [                                  // thứ tự ưu tiên
      { "type": "zalo", "value": "…" },
      { "type": "inbox" },
      { "type": "comment-code" }
    ],
    "pageContact": [ { "type": "zalo", "value": "…" } ],  // chỉ khi phụ trách Page
    "library": {                                  // tuỳ chọn, Phần B
      "approvedCsvUrl": "…", "trendsCsvUrl": "…", "pendingCsvUrl": "…"
    },
    "leadScan": { "enabled": false, "time": "10:00", "account": "fb2" },  // Phần C
    "accounts": [
      { "id": "fb1",  "type": "fb-personal", "label": "…" },
      { "id": "page", "type": "fb-page",     "label": "HomeMatch Page" },
      { "id": "th",   "type": "threads",     "label": "…" }
    ],
    "groups": [
      { "name": "…", "url": "https://facebook.com/groups/…", "account": "fb1",
        "active": true, "districts": ["Cầu Giấy"], "language": "vi",
        "days": ["mon","tue","wed","thu","fri","sat","sun"], "slots": ["11:00"],
        "note": "" }
    ],
    "perSlot": { "fb1": 1, "page": 1, "th": 1 },
    "variants": { "default": 1 },                // vd { "default": 1, "page": 3, "groups": 2 }; tối đa 3
    "channelMix": null                            // null = dùng mặc định chung
  }
  ```
- `persona.md`: người này là ai, giọng gì, NÊN / KHÔNG NÊN.
- `content-types.md`: kiểu bài riêng. Không có file thì dùng mẫu chung.
- `history/`: bản sao config trước mỗi lần sửa qua `/hm-config`.

Giọng theo kênh:
- FB cá nhân, Threads, nhóm: persona của người đó.
- FB Page: luôn dùng giọng thương hiệu HomeMatch (skill `homematch-context`).

Chỉ người được chỉ định mới có kênh Page; giai đoạn đầu chỉ owner. Trùng bài giữa các teammate ở cùng nhóm được chấp nhận; owner phân nhóm.

## A6. Thiết lập, cấu hình và chia sẻ

### `/hm-setup` (một lần, phần nhạy cảm)

1. Hỏi `apiBaseUrl` và token, gọi thử API một lần, ghi `secrets.json`.
2. Hỏi giờ chạy (hiện mặc định owner), tạo scheduled task cho từng giờ.
3. Thêm vào settings của người dùng đúng các quyền mà lịch cần: chạy các script của plugin, ghi vào `~/.homematch-marketing/` và `outputDir`. Không rộng hơn.
4. Tạo hồ sơ cá nhân từ `config.default.json` và mẫu persona/kiểu bài.
5. Mở `/hm-config` để điền và chỉnh phần còn lại.

Chạy lại `/hm-setup` để đổi token hoặc dựng lại lịch và quyền.

### `/hm-config` (mọi thay đổi sau đó)

- **Một trang chủ** `<outputDir>/index.html` cho cả bài đăng và cấu hình, dựng từ template cố định `assets/home/template.html` (`config-cli render-board` và `build.mjs` cùng dựng trang này). Theo house style của board `/vision` (serif, mực đen trên giấy trắng). 4 tab theo thứ tự, cột phải dùng chung:
  - **Tab Bài đăng** (mặc định): bài của các khung, xem A4 bước 5.
  - **Tab Kiểu bài**: thư viện đọc từ `content-types.md` của hồ sơ (chưa có thì dùng mẫu). Mỗi kiểu một thẻ thu gọn được (thẻ đầu mở sẵn): tên, Kênh, Số tin mỗi bài, Cách chọn tin, Cấu trúc (danh sách đánh số), Ảnh, Ví dụ hiện trong khung giống bài Facebook (chữ thường, giữ xuống dòng). Thiếu trường thì hiện "—". Nút **Sửa kiểu này** (điền `Kiểu <tên>: `) và **+ Thêm kiểu bài** (điền `Thêm kiểu bài mới: tên …, kênh …, số tin …, cấu trúc …`).
  - **Tab Hằng ngày**, những thứ hay sửa:
    - **Hôm nay sẽ soạn**: mỗi khung giờ một ô, số bài và kênh
    - **Nhóm**: mỗi nhóm một dòng gọn (tên · khung · tài khoản · bật/tạm ngừng), bấm mở thêm quận, ngày, ngôn ngữ, ghi chú; lọc "Hôm nay" (mặc định) / "Tất cả"
    - **Số bài mỗi khung** cho tường cá nhân, Page, Threads
    - **Mục đang chờ quy định**, thu gọn một dòng
  - **Tab Hồ sơ** (ít sửa), mỗi mục thu gọn được, chỉ Persona mở sẵn:
    - Persona
    - Tài khoản & liên hệ
    - Lịch & cài đặt (giờ chạy, tỉ lệ, thư mục, quét nhóm, token chỉ hiện "đã cài")
  - **Cột phải** (mọi tab): ô "Muốn đổi gì?" (nút gợi ý nhanh: tạm ngừng / bật lại nhóm, thêm nhóm, bỏ một nhóm hôm nay; ô gõ lời thường; danh sách chờ gửi) và "Lần sửa gần nhất" thu gọn; dưới cùng là nút **Báo lỗi / góp ý plugin** (xem A8).
- **Hai chế độ**, trang tự nhận biết khi mở:
  - Mở bằng `lavish-axi` (có `window.lavish`): **Đang sửa cùng Claude**. Nút "Gửi cho Claude sửa" gửi danh sách yêu cầu; "Lần sửa gần nhất" có nút hoàn tác.
  - Mở thẳng file (sau khi build hoặc từ Finder): **Chỉ xem**. Ô yêu cầu vẫn dùng được; nút thành **Copy yêu cầu**, copy `/hm-config <các yêu cầu nối bằng "; ">` để dán vào chat Claude. Ẩn nút hoàn tác; nút Báo lỗi (Form) vẫn còn.
- Người dùng chú thích lên mục hoặc gõ yêu cầu (vd "tạm ngừng nhóm Cầu Giấy", "đổi 17:30 thành 18:00", "thêm nhóm: <tên> <link>").
- Claude **sửa ngay**: lưu bản sao vào `history/`, ghi file, dựng lại trang, hiện changelog (vd "Nhóm Cầu Giấy: active true → false"). Có lệnh "hoàn tác lần sửa trước".
- Đổi giờ chạy thì Claude tạo, xoá hoặc dời scheduled task tương ứng.
- Đổi token phải qua `/hm-setup`.
- Không bao giờ dùng `lavish-axi share`; trang chỉ chạy trên máy.
- Mọi giao tiếp bằng tiếng Việt.

### Chia sẻ

- Cài plugin: `/plugin marketplace add life-with-y/marketing-flow` → `/plugin install homematch-marketing`. Không cần tài khoản GitHub.
- Mỗi người dùng gói Claude Code trả phí của mình; chi phí chạy tính vào tài khoản của họ.
- Owner vận hành:
  - người mới: tạo token, gửi riêng, gửi link Form, phân nhóm
  - người nghỉ: xoá token

## A7. Lỗi

| Tình huống | Xử lý |
|---|---|
| Token sai hoặc bị thu hồi (401/403) | Dừng, báo "Token không hợp lệ, xin admin token mới" |
| API lỗi hoặc timeout | Thử lại 1 lần sau 30 giây, vẫn lỗi thì dừng và báo |
| Response sai schema | Dừng, báo, giữ nguyên snapshot cũ |
| Link CSV Sheet lỗi | Bỏ qua Trends, bài mẫu và pending; ghi chú trong `index.html`; vẫn soạn bài, với quy định nhóm theo mặc định an toàn |
| Không đủ tin đạt điều kiện | Soạn ít bài hơn, ghi lý do trong `index.html` |
| Ảnh tải lỗi | Như A4.4 |
| Máy tắt hoặc app đóng lúc đến giờ | Bỏ qua |
| `lavish-axi` không chạy được | `/hm-config` báo lỗi và cho sửa config bằng chat |

## A8. Góp ý và cải tiến

Một đường duy nhất cho mọi người, không cần tài khoản GitHub:

1. Nút **Góp ý** trên mỗi thẻ bài, và nút **Báo lỗi / góp ý plugin** trên trang cấu hình, mở **Google Form điền sẵn**: người góp, khung giờ, số bài, bản, mã tin, nội dung bài (với góp ý từ thẻ bài). Người góp gõ thêm "sai gì / muốn gì", có thể đính ảnh chụp màn hình.
2. Form đổ vào tab **Góp ý** của Sheet.
3. Owner chạy **`/hm-triage`** khi cần:
   - Claude đọc các góp ý chưa xử lý, gộp góp ý trùng, phân loại (nội dung/persona, chọn tin, giao diện, lỗi).
   - Claude tạo issue trên `life-with-y/marketing-flow` bằng `gh` đã đăng nhập của owner. Mỗi issue có link về các dòng góp ý gốc.
   - Dòng trong Sheet được đánh dấu "Đã tạo issue #n".

Plugin không chứa token GitHub. Không có đường tạo issue thẳng cho teammate. Link Form (kèm các tham số điền sẵn) nằm trong `config.default.json`.

## A9. Kiểm thử

- Unit test, với fixture JSON theo schema API:
  - `diff.mjs`: nhãn phòng, nhãn tin, lần đầu chạy, khoá phòng
  - `download.mjs`: tên thư mục, thứ tự ảnh, quy tắc 5 ảnh cho bài 1 tin và nhiều tin, bỏ bài thiếu ảnh
  - phần chọn đích của khung giờ: `active`, `days`, `slots`, 1 bài mỗi nhóm
- Test `render-home.mjs` (4 tab, chọn khung, 2 chế độ, escape, đường dẫn ảnh) và `parseContentTypes`, đảm bảo token không xuất hiện.
- End-to-end trên máy owner với token thật:
  - `/hm-setup` → `/hm-config` (sửa vài mục, hoàn tác, đổi giờ và kiểm tra scheduled task)
  - `/hm-prep-now`: dữ kiện mỗi bài khớp API, ảnh đúng quy tắc, copy được nội dung
  - chạy lần 2 để kiểm tra xoay vòng
  - `/hm-prep-now chỉ nhóm …`

## A10. Còn mở

- Kiểu bài và tỉ lệ trộn: owner quy định sau; bản đầu dùng 3 kiểu mẫu.
- Quy định đăng theo nhóm (liên hệ, link, tiền tố): pending, ghi ở tab Cần tìm hiểu.
- Danh sách nhóm: owner nhập qua `/hm-config`.
- `apiBaseUrl` production: điền khi có.

---

# Phần B: Bài mẫu + trends (khung, grill và spec riêng sau)

- Google Form góp bài (link bài, nội dung, số like/bình luận, vì sao hay) → Sheet, trạng thái *Chờ duyệt*.
- `/hm-research` (owner): Claude tìm bài và xu hướng trên web và Threads công khai, cộng với link owner đưa, ghi vào Sheet với trạng thái *Chờ duyệt*. Không dùng thẳng.
- Owner duyệt bằng cột Trạng thái.
- `/hm-trends` (owner, hằng tuần): tổng hợp chỉ từ dòng *Đã duyệt*, ghi tab *Trends*: kiểu mở bài, định dạng, độ dài, CTA, giờ đăng, kiểu nhiều bình luận, điều nên tránh.
- Tab *Cần tìm hiểu*: các mục owner đang nghiên cứu, gồm quy định đăng theo nhóm.
- Owner ghi vào Sheet qua kết nối Google Sheets của owner; teammate chỉ đọc qua CSV.

# Phần C: Quét bài tìm phòng (khung, grill và spec riêng sau)

- Tuỳ chọn theo từng người (`leadScan.enabled`), mặc định tắt; chạy đầu tiên trong ngày (`leadScan.time`), là scheduled task riêng.
- Dùng một tài khoản FB đã đăng nhập sẵn trong một Chrome profile (Claude in Chrome), nên dùng tài khoản phụ. Chỉ đọc, không đăng, không comment, không nhập mật khẩu. Gặp checkpoint/CAPTCHA thì dừng và báo.
- Tần suất thấp: chỉ các nhóm trong config, giới hạn số bài đọc mỗi lần.
- Với mỗi bài tìm phòng:
  - rút ra tiêu chí: quận, giá, số người, ngày vào ở
  - ghép 1–3 tin từ snapshot API mới nhất
  - nháp comment hoặc tin nhắn theo persona
- Đầu ra:
  - `leads.html` (link bài gốc, tóm tắt nhu cầu, tin gợi ý, nháp để copy)
  - `leads/<ngày>.json` gồm nhu cầu tổng hợp cho Phần A
- Không lưu tên, SĐT, ảnh của người đăng; chỉ lưu link bài và tóm tắt nhu cầu.
- Rủi ro đã chấp nhận: đọc tự động có thể bị FB checkpoint tài khoản dùng để quét.

## Mockup

- `docs/mockups/home.html`: trang chủ (bài đăng + cấu hình), dựng từ dữ liệu mẫu bằng chính `renderHome`

Dữ liệu trong mockup là dữ liệu mẫu.
