---
name: hm-config
description: Xem và chỉnh cấu hình HomeMatch marketing (nhóm đăng, lịch soạn bài, persona, kiểu bài) qua trang chủ HomeMatch mở bằng Lavish; tự đồng bộ lịch soạn bài với scheduled tasks. Dùng khi chạy /hm-config hoặc khi người dùng muốn đổi nhóm, giờ đăng, giọng văn, kiểu bài.
---

# Chỉnh cấu hình HomeMatch

Mọi chữ hiển thị cho người dùng bằng tiếng Việt. Mỗi lượt phản hồi chỉ một câu trả lời; không hỏi lại điều trang hoặc yêu cầu đã trả lời.

## Không bao giờ

- Đọc, in hay sửa `~/.homematch-marketing/secrets.json`. Người dùng muốn đổi token: bảo chạy `/hm-setup`.
- Chạy `lavish-axi share`.
- Chạy `lavish-axi` bằng `nohup` hoặc `&`: luôn chạy ở foreground.
- Sửa file nào khác ngoài ba file dưới đây.

File được sửa (trong `~/.homematch-marketing/`): `config.json`, `persona.md`, `content-types.md`.

CLI: `node "${CLAUDE_PLUGIN_ROOT}/scripts/config-cli.mjs" <init|backup|undo|changelog|render-board|today|validate>`.

## Bước 1: Dựng và mở trang

1. Nếu chưa có hồ sơ: chạy `init`.
2. Chạy `render-board`: dựng trang chủ `<outputDir>/index.html` (mặc định `~/HomeMatch-Posts/index.html`; cùng trang với bài đăng các khung, 4 tab Bài đăng · Kiểu bài · Hằng ngày · Hồ sơ). stdout là đường dẫn trang, gọi là `<file>`.
   Mở bằng Lavish thì trang ở chế độ "Đang sửa cùng Claude" (ô yêu cầu gửi thẳng cho bạn, có hoàn tác). Mở thẳng bằng trình duyệt thì trang "Chỉ xem": nút "Copy yêu cầu" copy `/hm-config <yêu cầu 1>; <yêu cầu 2>` để người dùng dán vào chat.
3. Mở: `npx -y lavish-axi <file>`.
4. Chờ phản hồi, ở foreground: `npx -y lavish-axi poll <file>`.
5. `lavish-axi` không chạy được: nói rõ một dòng, cho người dùng nhập yêu cầu bằng chat và làm đúng vòng bước 2 → 4 như dưới (không có trang).

## Bước 2: Nhận yêu cầu và sửa

Phản hồi từ `poll` (hoặc đối số của `/hm-config`, nhiều yêu cầu cách nhau bằng `; `) là yêu cầu của người dùng.

- Yêu cầu bắt đầu bằng `Kiểu <tên>:` (kể cả dạng `Kiểu <tên>: (bài <slot> số <n>, mã …) …` từ nút "Sửa kiểu bài này") hoặc `Thêm kiểu bài mới:` là sửa `content-types.md`: sửa đúng mục `## <tên>` (hoặc thêm mục mới cùng định dạng: Kênh, Số tin mỗi bài, Cách chọn tin, Cấu trúc, Ảnh, Ví dụ). Phần trong ngoặc chỉ cho biết bài nào người dùng đang nhìn; đọc `<outputDir>/<slot>/page-data.json` nếu cần xem nội dung bài đó.

- Nếu có câu "Hoàn tác lần sửa gần nhất": sang bước 5.
- Ngược lại, theo thứ tự:
  1. `config-cli backup`.
  2. Sửa file liên quan trong ba file được phép.
  3. Kiểm tra chặt:
     ```
     node "${CLAUDE_PLUGIN_ROOT}/scripts/config-cli.mjs" validate
     ```
     (`render-board` cũng hiện lỗi trong khung đỏ.)
  4. Lỗi: chạy `config-cli undo`, nói lỗi cho người dùng (vd `variants` chỉ nhận 1–3), config giữ nguyên như trước. Sang bước 4.

## Bước 3: Đồng bộ lịch (khi `schedule` đổi)

So `schedule` trong `config.json` với các scheduled task hiện có, bằng `mcp__scheduled-tasks__list_scheduled_tasks`. Mỗi giờ `HH:MM` một task:

- `taskId`: `hm-post-prep-HHMM` (vd `hm-post-prep-1730`)
- `cronExpression`: `MM HH * * *` (giờ máy)
- title: `HomeMatch soạn bài HH:MM`
- description: một dòng, vd `Soạn sẵn bài đăng HomeMatch cho khung HH:MM`
- prompt, tự đủ: `Dùng skill hm-post-prep của plugin homematch-marketing với --slot HH:MM. Đây là lượt chạy theo lịch: không hỏi người dùng; làm đúng theo skill.`

Việc cần làm:

- Task `hm-post-prep-*` có giờ không còn trong `schedule`: `delete_scheduled_task`.
- Giờ trong `schedule` chưa có task: `create_scheduled_task`.
- Giờ đã có task: để nguyên (task khác không phải `hm-post-prep-*` không đụng tới).

Sau khi đồng bộ, nói người dùng: lịch chỉ chạy khi app Claude đang mở; nếu app đóng lúc đến giờ, app chạy bù khi mở lại nhưng plugin tự bỏ qua nếu trễ quá 90 phút.

Lịch chạy dùng model mặc định của app Claude; muốn đổi model thì sửa trong cài đặt task ở mục Scheduled.

`schedule` không đổi thì bỏ qua bước này. Sau `undo` làm lại bước này (lịch có thể đổi ngược).

## Bước 4: Dựng lại trang và trả lời

1. `config-cli render-board`.
2. `config-cli changelog`: lấy các dòng thay đổi (hoặc "Chưa có lần sửa nào").
3. Trả lời một lần, tiếng Việt: các dòng changelog (hoặc lỗi nếu bị từ chối) và ghi chú lịch nếu có.
4. Có trang: `npx -y lavish-axi poll <file> --agent-reply "<changelog>"` để tiếp tục chờ. Người dùng kết thúc phiên (Send & End): dừng. Còn yêu cầu mới: quay lại bước 2.

## Bước 5: Hoàn tác

1. `config-cli undo` (in các dòng thay đổi; "Chưa có lần sửa nào" thì báo không có gì để hoàn tác).
2. Làm bước 3 (đồng bộ lịch) rồi bước 4.
