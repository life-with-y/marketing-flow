---
name: hm-post-prep
description: Soạn sẵn bài đăng HomeMatch cho một khung giờ (chọn tin, viết nội dung theo persona và kênh, tải ảnh, dựng trang index.html). Dùng khi lịch gọi khung giờ soạn bài hoặc khi chạy /hm-prep-now.
---

# Soạn bài HomeMatch cho một khung giờ

Lần chạy theo lịch **không có người để hỏi**. Không hỏi lại, không chờ xác nhận: làm đúng các bước dưới đây, gặp tình huống không có trong file này thì chọn cách an toàn nhất (bỏ bài đó vào `skipped` với lý do) và đi tiếp.

Làm đúng thứ tự 1 → 5. Mọi chữ hiển thị cho người dùng bằng tiếng Việt.

## Không bao giờ

- Đọc, in hay nhắc nội dung `~/.homematch-marketing/secrets.json`. Script tự đọc token; bạn không cần nó.
- Sửa `input.json`, snapshot, `prepared.jsonl`, hay file trong plugin.
- Đăng bài lên bất kỳ kênh nào. Người dùng tự đăng tay.

## Bước 1: Chuẩn bị (script)

Chạy:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/prepare.mjs" [--slot HH:MM] [--only "Tên nhóm 1,Tên nhóm 2"]
```

- `--slot HH:MM`: chỉ khi được gọi từ lịch (lời gọi có giờ khung, vd "khung 11:00" → `--slot 11:00`). Chạy tay (`/hm-prep-now`) thì không truyền.
- `--only "…"`: chỉ khi lời gọi giới hạn nhóm (vd "chỉ nhóm Cầu Giấy, Đống Đa" → `--only "Cầu Giấy,Đống Đa"`). Tên cách nhau bằng dấu phẩy, trong một cặp ngoặc kép.

Xử lý theo mã thoát:

| Mã | Nghĩa | Làm gì |
|---|---|---|
| `0` | OK | stdout có dạng `Đã chuẩn bị khung <slotId>: <đường dẫn input.json>`. Ghi nhớ `slotId` (dạng `2026-11-19_1100`) và đường dẫn, sang bước 2. |
| `3` | Khung đã lỡ | Chạy theo lịch (có `--slot`): dừng im lặng, không viết gì thêm. Chạy tay (không `--slot`): in nguyên văn dòng thông báo của script (stderr), rồi dừng. |
| `4` | Hôm nay không có đích nào, hoặc giờ khung không còn trong `schedule` | Chạy theo lịch (có `--slot`): dừng im lặng, không viết gì thêm. Chạy tay (không `--slot`): in nguyên văn dòng thông báo của script (stderr) (vd `Không có đích nào cần đăng hôm nay`), rồi dừng. |
| `2` | Lỗi config / token / API | Báo nguyên văn thông báo lỗi của script (stderr), một dòng. Dừng. |
| khác | Script hỏng | Báo nguyên văn stderr. Dừng. |

## Bước 2: Đọc

1. `input.json` (đường dẫn ở bước 1, nằm trong `~/.homematch-marketing/runs/<slotId>/`).
2. Mọi file trong `input.paths` (đường dẫn tuyệt đối):
   - `hardRules` (`hard-rules.md`): luật không ai ghi đè.
   - `selection` (`selection.md`): chọn tin, ảnh, phiên bản.
   - `channelFormat` (`channel-format.md`): giới hạn kênh, định dạng giá, ngôn ngữ.
   - `persona`: giọng của người đăng (FB cá nhân, Threads, nhóm).
   - `contentTypes`: các kiểu bài, mỗi kiểu có kênh, số tin, cách chọn tin, cấu trúc, ví dụ.
   - `channelMix`: nếu khác `null` thì đọc (tỉ lệ kiểu bài riêng của người dùng).
3. Tỉ lệ trộn kiểu bài khi `paths.channelMix` là `null`: lấy `channelMix` trong `~/.homematch-marketing/config.json`; nếu thiếu hoặc `null` thì lấy `channelMix` trong `${CLAUDE_PLUGIN_ROOT}/rules/templates/config.default.json`. Dạng: `{ "page": { "listing": 50, "brand": 50 }, "personal": { "listing": 70, "brand": 30 } }` (phần trăm).
4. `~/.homematch-marketing/prepared.jsonl` nếu có (mỗi dòng: `slot, account, target, postCodes, type, at`), chỉ để tính tỉ lệ kiểu bài ở bước 3.1.

Thứ tự ưu tiên khi mâu thuẫn: luật cứng > hồ sơ cá nhân (persona, kiểu bài, config) > mặc định chung > Trends.

### Cấu trúc `input.json`

- `slot`: `slotId`.
- `targets[]`: các đích của khung, mỗi đích một bài (hoặc bỏ vào `skipped`):
  - `id` (vd `group:https://facebook.com/groups/…`, `wall:fb1:0`, `page:page:0`, `threads:th:0`), `kind` (`group` | `wall` | `page` | `threads`), `account`, `name`, `url`
  - `districts[]` (rỗng = toàn Hà Nội), `language` (`vi` | `en`; thiếu = `vi`), `note` (ghi chú nhóm, luôn tuân theo)
  - `variants` (số bản 1–3), `contact[]` (thứ tự ưu tiên liên hệ; Page đã là `pageContact`)
- `listings[]`: **đã sắp theo thứ tự ưu tiên chung** (khớp leads > `NEW` > `PRICE_DOWN` > `NOW_AVAILABLE` > `UNCHANGED`/`PRICE_UP`). Mỗi tin:
  - `code` (mã T…), `link`, `district`, `buildingName`, `address`, `label`, `eligible`, `imageCount`
  - `rooms[]`: `room`, `price` (số đồng), `priceText` (vd `3,5 triệu`), `status`, `statusText`, `services[]`, `furniture[]`
  - `images[]`: `url`, `isCover`, `order`; **đã sắp, `images[0]` là ảnh bìa**
  - `lastPrepared`: `{ <targetId>: <ISO lần soạn gần nhất> }`; thiếu khoá = chưa từng soạn cho đích đó
- `leads`: nhu cầu hôm nay (`demands[]` với `district`, `maxPrice`…) hoặc `null`.
- `library`: `approved[]` (bài mẫu đã duyệt), `trends[]`, `pending[]` (tab Cần tìm hiểu: quy định nhóm chưa rõ), `errors[]` (link Sheet lỗi; script đã ghi chú vào trang, bạn chỉ cần bỏ qua phần đó).

## Bước 3: Chọn và soạn, ghi `posts.json`

Làm cho từng đích theo thứ tự trong `input.targets`. Thứ tự bài trong `posts.json` là thứ tự đăng; giữ theo thứ tự đích.

### 3.1 Chọn kiểu bài

1. Chỉ xét các kiểu trong `contentTypes` có `kind` của đích trong danh sách **Kênh**.
2. Tin phòng hay thương hiệu (kiểu có số tin `0` là thương hiệu):
   - `group`: luôn là tin phòng.
   - `page` dùng tỉ lệ `page`; `wall` và `threads` dùng tỉ lệ `personal`.
   - Tính theo **tài khoản** (`target.account`), không theo từng đích. `n` = số dòng, `b` = số dòng có `postCodes` rỗng, cộng từ hai nguồn:
     - tối đa 10 dòng gần nhất trong `prepared.jsonl` có `account` = `target.account` (không có file hoặc không có dòng nào thì 0);
     - các bài đã soạn **trước đó trong lượt này** cho cùng tài khoản (bài thương hiệu tính vào `b`).
   - Soạn bài thương hiệu khi `(b + 1) / (n + 1) ≤ brand / 100`; không thì tin phòng.
   - Ví dụ: Page có 5 đích trong khung, chưa có lịch sử, `brand` = 50. Bài 1: n=0, b=0, (0+1)/(0+1)=1 > 0,5 → tin phòng. Bài 2: n=1, b=0, 1/2=0,5 ≤ 0,5 → thương hiệu. Bài 3: n=2, b=1, 2/3 > 0,5 → tin phòng. Bài 4: n=3, b=1, 2/4 ≤ 0,5 → thương hiệu. Bài 5: n=4, b=2, 3/5 > 0,5 → tin phòng. Kết quả: tin phòng, thương hiệu, tin phòng, thương hiệu, tin phòng.
3. Trong nhóm kiểu đã chọn (tin phòng hoặc thương hiệu), dùng kiểu theo mục **Cách chọn tin** của từng kiểu. Kiểu không đủ tin theo điều kiện của nó thì lùi về kiểu 1 tin. Không có kiểu thương hiệu nào dùng được cho kênh thì soạn tin phòng.
4. `type` trong `posts.json` = tên kiểu, đúng như tiêu đề trong file kiểu bài (vd `Phòng mới / giảm giá`).

### 3.2 Chọn tin

- Chỉ tin `eligible: true`.
- Đích `group` có `districts`: chỉ tin có `district` thuộc danh sách (so không dấu, không phân biệt hoa thường). `districts` rỗng: mọi quận.
- Mức ưu tiên của tin: (1) khớp leads: có một `leads.demands[]` cùng `district` (so không dấu) và giá phòng thấp nhất của tin ≤ `maxPrice` (không có `maxPrice` thì chỉ cần cùng quận); (2) `label` theo `NEW` > `PRICE_DOWN` > `NOW_AVAILABLE` > `UNCHANGED` = `PRICE_UP`.
- **Xoay vòng**: trong cùng mức, xếp tin chưa có `lastPrepared[<id đích>]` trước, rồi tới tin có thời điểm cũ nhất. Lấy tin đầu danh sách (bài nhiều tin: lấy đủ số tin theo kiểu, theo thứ tự đó, thoả điều kiện của kiểu).
- **Trải tin trong lượt** (áp sau mức ưu tiên và xoay vòng, chỉ đổi thứ tự giữa các tin còn lại):
  - Cùng tài khoản (`target.account`): không dùng lại tin đã chọn cho tài khoản đó trong lượt này khi còn tin đủ điều kiện khác cho đích. Hết tin mới dùng lại.
  - Khác tài khoản: ưu tiên tin chưa dùng ở bất kỳ đích nào trong lượt này, trước tin đã dùng cho tài khoản khác.
  - Cụ thể: lọc tin dùng được cho đích, bỏ tin đã dùng cho cùng tài khoản (nếu bỏ hết thì giữ lại cả); trong phần còn lại xếp theo (1) chưa dùng trong lượt trước đã dùng, (2) mức ưu tiên, (3) xoay vòng; lấy từ đầu.
  - Hoà nhau hoàn toàn (cùng mức, cùng thời điểm `lastPrepared` hoặc cùng chưa có): giữ thứ tự trong `input.listings`.
- Ngày không có gì mới vẫn soạn đủ bài bằng tin `UNCHANGED`.
- Một tin có thể vào nhiều đích trong cùng khung (khi không còn tin khác theo luật trải tin ở trên); mỗi đích một nội dung riêng (mở bài, thứ tự ý, CTA), dữ kiện giữ nguyên.
- Không đủ tin cho đích (vd nhóm có `districts` mà không còn tin đủ điều kiện): không soạn bài cho đích đó, thêm vào `skipped` với lý do (vd `Không có tin đủ điều kiện ở Cầu Giấy`).

### 3.3 Chọn ảnh (`images`: URL lấy nguyên từ `listing.images[].url`, theo thứ tự đăng)

- **Bài 1 tin**: đúng `min(5, imageCount)` ảnh của chính tin đó, không lặp. Bản A lấy `images[0..4]` theo thứ tự, **bắt đầu bằng ảnh bìa** (`images[0]`). Bản B, C dùng **đúng bộ ảnh đó**, chỉ đổi thứ tự (có thể mở bằng ảnh khác).
- **Bài nhiều tin, ≤ 5 tin**: ảnh thứ 1…k là ảnh bìa (`images[0]`) của từng tin, **đúng thứ tự trong `postCodes`**; còn chỗ thì thêm ảnh tiếp theo của tin đứng đầu cho đủ tổng 5. Các bản giữ nguyên k ảnh bìa đầu, chỉ đổi thứ tự phần thêm.
- **Bài nhiều tin, 6–10 tin**: đúng k ảnh, mỗi tin 1 ảnh bìa, theo thứ tự `postCodes`. Không quá 10 tin.
- **Bài thương hiệu** (`postCodes: []`): 3–5 ảnh của các tin đủ điều kiện, không lặp, ưu tiên ảnh bìa của các tin khác nhau. Các bản dùng cùng bộ ảnh, đổi thứ tự.

### 3.4 Giọng và ngôn ngữ

- `page`: luôn giọng thương hiệu HomeMatch. Dùng skill `homematch-context` nếu có. Không có thì viết giọng thương hiệu trung tính "phòng thật, giá thật", không dùng persona cá nhân.
- `wall`, `threads`, `group`: giọng trong file `persona`.
- Ngôn ngữ theo `target.language` (thiếu = `vi`). Đích `en` viết tiếng Anh; tên quận, địa chỉ giữ nguyên.
- `library.trends`: chỉ gợi ý cấu trúc (mở bài, định dạng, độ dài). Không ghi đè persona, không ghi đè luật cứng.
- `library.approved`: tham khảo cách viết. Không chép, không lấy dữ kiện từ đó.

### 3.5 Liên hệ và CTA

`target.contact` là danh sách theo thứ tự ưu tiên, mỗi mục `{ type, value? }`:

| `type` | Viết trong bài |
|---|---|
| `zalo` | "Nhắn Zalo `<value>`" |
| `phone` | "Gọi `<value>`" |
| `inbox` | "Nhắn tin cho mình" (Page: "nhắn tin cho Page") |
| `comment-code` | "Comment mã T…" (mã tin trong bài) |

- `wall`, `threads`, `page`: dùng mục đầu tiên của `contact` (có thể thêm mục thứ hai làm phương án phụ). `contact` rỗng thì CTA "nhắn tin / comment mã T…". Được đặt link tin.
- `group`: quy định đăng của nhóm (cách ghi liên hệ, link, tiền tố) đang **pending** cho tới khi có quy định rõ (xem `library.pending`). Khi chưa có quy định cho nhóm, dùng **mặc định an toàn**: không SĐT (kể cả số Zalo), không link, CTA "nhắn tin / comment mã T…". Chỉ dùng loại liên hệ khác khi `target.note` ghi rõ nhóm cho phép; khi đó chọn theo thứ tự trong `contact`, lùi xuống loại nhóm cho phép.
- `target.note` luôn được tuân theo (vd tiền tố bắt buộc, cấm link), trừ khi nó trái luật cứng.

### 3.6 Viết nội dung (`text`)

Mỗi đích có đúng `target.variants` bản, khoá `A`, `B`, `C` theo thứ tự. Các bản khác nhau ở mở bài, thứ tự ý, CTA và thứ tự ảnh; cùng tin, cùng dữ kiện, cùng bộ ảnh.

Luật cứng (bài vi phạm sẽ bị script trả về ở bước 4):

1. Chỉ dữ kiện có trong `input.json`: quận, toà, địa chỉ, phòng, giá, trạng thái, dịch vụ, nội thất, mã tin, link. Không bịa diện tích, loại phòng, tiêu đề, số phòng còn lại, lượt xem, "phòng cuối"… Không nói hay ám chỉ tin được ưu tiên vì chủ nhà trả tiền.
2. **Giá**: mỗi tin trong bài phải có ít nhất một `priceText` của phòng xuất hiện **nguyên văn** (vd `3,5 triệu`; không `3tr5`, `3.5tr`, `3 triệu rưỡi`). Ngay trước giá không đặt chữ số, `,` hay `.`; ngay sau giá không đặt chữ số, `rưỡi`, hay `,5` (viết `3,5 triệu/tháng`). Không viết khoảng giá kiểu `3,5 đến 4,2 triệu` (số đầu không phải `priceText`); ghi giá từng phòng. Mọi giá khác nhắc tới cũng phải đúng `priceText` của phòng. Đích `en`: được ghi `3.5 million VND` hoặc `3,500,000 VND` (đúng số `price`), hoặc `priceText`.
3. **Hợp với ai / không hợp với ai** chỉ được suy ra từ dữ liệu API trong `input.json` (giá, nội thất, dịch vụ, quận, trạng thái / ngày trống). Không bao giờ nói số người ở, diện tích, tầng, hay bất cứ điều gì không có trong input (vd không viết "hợp 1 người", "phòng rộng", "tầng cao").
4. **Trạng thái** dùng đúng `statusText`. **Mã tin** dùng đúng `code`. Không ghi số phòng nếu không cần (mã tin là đủ).
5. **Link**: mọi chuỗi chứa `homematch.vn` (kể cả không có `https://`) phải bằng đúng `link` của một tin trong bài. Không viết tên miền `homematch.vn` trần, không link quận, không rút gọn. Bài thương hiệu không đặt link tin. Nhóm theo mặc định an toàn: không link.
6. **Chỉ văn bản thường**: không `**`, không `__`, không `_…_`, không dòng bắt đầu bằng `#` kèm khoảng trắng (tiêu đề markdown), không chữ đậm/nghiêng giả bằng ký tự Unicode (U+1D400–U+1D7FF). Được dùng xuống dòng, emoji, gạch đầu dòng `•`. Hashtag viết liền (`#phongtrohanoi`) thì được.
7. **Threads** ≤ 500 ký tự (đếm cả emoji và xuống dòng). Viết ngắn ngay từ đầu, đừng để sát giới hạn.
8. Tuân theo `channel-format.md` và cấu trúc của kiểu bài.

### 3.7 Ghi `posts.json`

Ghi vào `~/.homematch-marketing/runs/<slotId>/posts.json` (cùng thư mục với `input.json`), JSON hợp lệ:

```json
{
  "slot": "2026-11-19_1100",
  "posts": [
    {
      "targetId": "group:https://facebook.com/groups/…",
      "type": "Phòng mới / giảm giá",
      "postCodes": ["T1302"],
      "variants": [
        { "key": "A", "text": "…", "images": ["<url ảnh bìa>", "<url>", "<url>", "<url>", "<url>"] }
      ]
    }
  ],
  "skipped": [
    { "targetId": "wall:fb1:0", "reason": "…" }
  ]
}
```

- `targetId` = `id` của đích. Mỗi đích `group` tối đa 1 bài; mỗi đích khác cũng 1 bài.
- `postCodes`: mã các tin trong bài, theo thứ tự xuất hiện; `[]` cho bài thương hiệu. Không lặp mã.
- `variants.length` = `target.variants`; `key` lần lượt `A`, `B`, `C`.
- `text` xuống dòng bằng `\n` thật trong chuỗi JSON.
- `reason` trong `skipped` viết tiếng Việt, ngắn, người dùng đọc được.

Trước khi ghi, tự soát từng bản theo luật 1–7 ở 3.6 và quy tắc ảnh ở 3.3.

## Bước 4: Dựng trang (script)

Chạy:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/build.mjs" --slot <slotId>
```

| Mã | Nghĩa | Làm gì |
|---|---|---|
| `0` | OK | stdout có dạng `Đã soạn N bài lúc HH:MM: <đường dẫn index.html>`. Sang bước 5. |
| `5` | `posts.json` sai luật | stderr liệt kê lỗi, mỗi lỗi ghi "Bài n" (n là thứ tự bài trong `posts`, đếm từ 1). Sửa **đúng các lỗi đó** trong `posts.json` (không đổi bài khác), chạy lại build. Tối đa **2 lần sửa**. Sau lần sửa thứ 2 vẫn còn lỗi thì chuyển các bài còn lỗi từ `posts` sang `skipped` (`reason`: lỗi tóm tắt, vd `Không viết được giá đúng định dạng sau 2 lần sửa`), rồi chạy build lại. |
| `5` (lỗi cấu trúc) | stderr có `posts.json sai cấu trúc` (không có "Bài n") | Viết lại **toàn bộ** `posts.json` đúng cấu trúc ở 3.7 (giữ nguyên tin, ảnh, nội dung đã chọn), chạy lại build. Tính vào giới hạn 2 lần sửa; lần 2 vẫn sai cấu trúc thì ghi `posts.json` với `posts: []` và mọi đích vào `skipped` (`reason`: `Không ghi được posts.json đúng cấu trúc`), chạy build lại. |
| `6` | Thiếu ảnh khi tải | stderr liệt kê `<targetId>: <lý do>`. Với mỗi đích đó: **thay tin một lần** bằng tin kế tiếp theo thứ tự ở 3.2 (chưa dùng cho đích đó trong lần chạy này), chọn lại ảnh, viết lại nội dung, rồi chạy build lại. Đích đã thay một lần mà vẫn bị báo thì chuyển bài sang `skipped` (`reason`: lý do script báo), chạy build lại. Không còn tin để thay thì `skipped` ngay. |
| `2` | Lỗi config hoặc thiếu file | Báo nguyên văn stderr, một dòng. Dừng. |
| khác | Script hỏng | Báo nguyên văn stderr. Dừng. |

Mỗi lần chuyển bài sang `skipped`, thứ tự "Bài n" của các bài sau đổi theo; đọc lại lỗi mới từ lần build kế tiếp, không dùng số cũ.

Tất cả bài đều bị bỏ thì vẫn chạy build với `posts: []` để trang ghi lý do bỏ.

## Bước 5: Báo

Kết thúc bằng đúng một dòng tiếng Việt: số bài đã soạn và đường dẫn `index.html`, vd:

```
Đã soạn 4 bài: /Users/…/HomeMatch-Posts/2026-11-19_1100/index.html
```

Có bài bị bỏ thì thêm vào cùng dòng, vd `(bỏ 1 bài, xem cuối trang)`. Không in nội dung bài, không in dữ liệu `input.json`.
