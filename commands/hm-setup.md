---
description: Thiết lập HomeMatch marketing lần đầu (token API, lịch soạn bài, quyền, persona, Page); chạy lại để đổi phần nào đó
---

<!-- TODO: các rule quyền ở bước 3 sẽ được xác nhận lại trong Task 0 spike (đúng cú pháp, scheduled task chạy không hỏi quyền). -->

Thiết lập HomeMatch marketing. Mọi chữ hiển thị cho người dùng bằng tiếng Việt, mỗi lượt một câu hỏi ngắn.

## Không bao giờ

- Lặp lại token trong bất kỳ câu trả lời nào, kể cả khi xác nhận. Lưu xong chỉ nói `Đã lưu token <tên token>`.
- Đọc hay in `~/.homematch-marketing/secrets.json`.
- Ghi đè `config.json`, `persona.md`, `content-types.md` đã có mà chưa hỏi.

## Chạy lại

Nếu `~/.homematch-marketing/config.json` đã có: hỏi "Bạn muốn đổi phần nào?" (token / giờ chạy / quyền / Page và liên hệ / persona / lịch) và chỉ làm các bước tương ứng bên dưới. Không hỏi lại phần không đổi.

## Bước 1: API và token

1. Hỏi `apiBaseUrl` (địa chỉ API HomeMatch).
2. Bảo người dùng dán token vào chat, và hỏi một tên gọi cho token (vd `Token của Lan`). Token chỉ đọc, của chính người dùng.
3. Chạy, thay `<token>` bằng token vừa nhận (token qua stdin, không đưa vào tham số dòng lệnh):
   ```
   printf '%s' '<token>' | node "${CLAUDE_PLUGIN_ROOT}/scripts/check-api.mjs" --base <apiBaseUrl> --save --label "<tên token>"
   ```
4. Mã `0` (in `OK: <n> tin đang hiển thị`): nói `Đã lưu token <tên token>` và số tin. Mã `2`: in nguyên văn dòng thông báo của script, cho người dùng thử lại (không lưu gì).

`--save` đã ghi `secrets.json` (quyền `600`) và `apiBaseUrl` vào `config.json`.

## Bước 2: Hồ sơ và giờ chạy

1. `node "${CLAUDE_PLUGIN_ROOT}/scripts/config-cli.mjs" init` (chỉ tạo file còn thiếu, không ghi đè).
2. Đọc `schedule` hiện có trong `config.json` (mặc định của owner), hỏi "Giờ chạy soạn bài: <schedule>. Giữ hay đổi?". Đổi thì sửa `schedule` (dạng `HH:MM`, 24 giờ) bằng cách chạy `config-cli backup` rồi sửa `config.json`.
3. Hỏi `outputDir` (hiện mặc định `~/HomeMatch-Posts`), giữ hay đổi.

## Bước 3: Quyền

Đọc `outputDir` trong `config.json`, mở rộng `~` thành đường dẫn tuyệt đối. `<root>` là đường dẫn tuyệt đối của `${CLAUDE_PLUGIN_ROOT}`. Hiện cho người dùng đúng các rule sau, hỏi "Thêm các quyền này vào ~/.claude/settings.json? (có/không)":

```
Bash(node <root>/scripts/prepare.mjs:*)
Bash(node <root>/scripts/build.mjs:*)
Bash(node <root>/scripts/config-cli.mjs:*)
Read(~/.homematch-marketing/**)
Write(~/.homematch-marketing/**)
Edit(~/.homematch-marketing/**)
Write(<outputDir>/**)
```

Chỉ khi người dùng đồng ý rõ ràng:

1. Sao lưu: `cp ~/.claude/settings.json ~/.claude/settings.json.bak-hm` (chưa có file thì tạo `{}` và bỏ qua sao lưu).
2. Gộp vào `permissions.allow`: giữ nguyên mọi mục sẵn có, chỉ thêm rule còn thiếu, không trùng lặp, không xoá hay đổi gì khác trong file.
3. Báo đã thêm bao nhiêu rule và đường dẫn bản sao lưu.

Không đồng ý: bỏ qua, nói lịch có thể hỏi quyền mỗi lần chạy.

## Bước 4: Lịch soạn bài

Làm đúng phần "Bước 3: Đồng bộ lịch" của skill `hm-config` (task `hm-post-prep-HHMM` cho từng giờ trong `schedule`, cùng prompt, cùng ghi chú app phải mở). Không tự đặt quy ước khác.

## Bước 5: Page, liên hệ, persona

1. Hỏi "Bạn có phụ trách Page không?" (mặc định **Không**). Có: thêm vào `accounts` của `config.json` một mục `{ "id": "page", "type": "fb-page", "label": "HomeMatch Page" }` và hỏi liên hệ riêng cho Page, lưu vào `pageContact`.
2. Hỏi danh sách liên hệ theo thứ tự ưu tiên, các loại: `zalo` (kèm số/link), `phone` (kèm số), `inbox`, `comment-code`. Lưu vào `contact`, dạng `{ "type": "zalo", "value": "…" }` (`inbox` và `comment-code` không có `value`).
3. Persona: hỏi chọn một trong hai:
   - Preset: `${CLAUDE_PLUGIN_ROOT}/rules/templates/presets/founder-thang-than.md` (Founder, thẳng thắn) hoặc `tre-nang-dong.md` (Trẻ, năng động).
   - Hoặc phỏng vấn 3–5 câu ngắn (bạn là ai, giọng nói, điều NÊN, điều KHÔNG NÊN, xưng hô), rồi viết persona theo dạng của các preset.
   Ghi kết quả vào `~/.homematch-marketing/persona.md`. Nếu `persona.md` đã được người dùng sửa (khác bản mẫu), hỏi trước khi ghi đè.
4. Trước khi sửa `config.json` chạy `config-cli backup`; sau khi sửa kiểm tra chặt như bước 2 của skill `hm-config`.

## Bước 6: Mở cấu hình

Nói một dòng đã xong, rồi mở `/hm-config` bằng skill `hm-config` để điền nhóm đăng và chỉnh phần còn lại.
