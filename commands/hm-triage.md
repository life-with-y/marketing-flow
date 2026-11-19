---
description: (Chỉ owner) Đọc góp ý trong Sheet, gộp trùng, phân loại và tạo issue GitHub
---

Phân loại góp ý của người dùng thành issue trên `life-with-y/marketing-flow`. Lệnh dành cho owner. Mọi chữ hiển thị bằng tiếng Việt.

## Không bao giờ

- Chạy khi `gh auth status` lỗi. Dừng và nói: "Chạy `gh auth login` trước rồi gọi lại /hm-triage".
- Tạo issue trước khi owner trả lời "có" cho danh sách nhóm đã hiện.
- Đưa token, secrets hay cột nào ngoài danh sách bên dưới vào issue.

## Bước 1: Kiểm tra gh

Chạy `gh auth status`. Lỗi thì dừng như trên.

## Bước 2: Đọc góp ý

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/sheet-cli.mjs" --feedback
```

In JSON `{ "rows": [...], "error": ... }`. `error` khác null: in nguyên văn, dừng (thiếu `library.feedbackCsvUrl` thì bảo owner đặt trong `config.json`).

Các cột của dòng: `Dấu thời gian`, `Người góp`, `Khung`, `Bài`, `Bản`, `Mã tin`, `Nội dung bài`, `Góp ý`, và `Issue` (owner tự bảo trì). Dòng có `Issue` không rỗng là đã xử lý: bỏ qua. Dòng có `Góp ý` rỗng cũng bỏ qua. Không còn dòng nào thì nói "Không có góp ý mới" và dừng.

## Bước 3: Gộp và phân loại

1. Gộp các dòng nói cùng một việc (cùng lỗi, cùng đề nghị) thành một nhóm.
2. Mỗi nhóm một loại, kèm label:
   | Loại | Label |
   |---|---|
   | nội dung / persona | `noi-dung` |
   | chọn tin | `chon-tin` |
   | giao diện | `giao-dien` |
   | lỗi | `loi` |
3. Mỗi nhóm có tiêu đề ngắn (≤ 70 ký tự) và tóm tắt 1–3 câu.
4. Hiện bảng cho owner: tiêu đề, loại, số dòng. Hỏi "Tạo các issue này? (có/không)". Chỉ làm tiếp khi owner đồng ý rõ ràng; owner có thể bỏ, gộp hoặc đổi loại nhóm trước khi đồng ý.

## Bước 4: Tạo issue

1. `gh label list --repo life-with-y/marketing-flow --limit 100`. Với label còn thiếu trong 4 label trên, tạo riêng từng cái: `gh label create <tên> --repo life-with-y/marketing-flow`. Không đụng label đã có.
2. Mỗi nhóm một issue, body qua stdin (heredoc có nháy, tránh lỗi dấu nháy):
   ```
   gh issue create --repo life-with-y/marketing-flow --title '<tiêu đề>' --label '<label>' --body-file - <<'HM_EOF'
   <body>
   HM_EOF
   ```
   Tiêu đề không được chứa dấu nháy đơn `'` (đổi sang dấu khác) và body không được chứa dòng `HM_EOF`.
3. Body:
   - `## Tóm tắt` rồi phần tóm tắt.
   - `## Góp ý gốc` rồi mỗi dòng gốc một mục: thời điểm, người góp, khung, bài, bản, mã tin, góp ý; thêm `Nội dung bài` cắt còn 300 ký tự (thêm `…` nếu cắt). Chỉ các cột này, giữ nguyên như người góp viết.
4. Lấy số issue từ URL `gh` in ra. Một issue lỗi thì báo và làm tiếp các nhóm còn lại.

## Bước 5: Đánh dấu dòng trong Sheet

- Nếu phiên có công cụ Google Sheets (connector): ghi `Đã tạo issue #n` vào cột `Issue` của từng dòng nguồn. Chỉ ghi vào ô `Issue` của các dòng đó, không sửa gì khác.
- Không có: in bảng `Dấu thời gian → Đã tạo issue #n` để owner tự dán vào cột `Issue`.

Cuối cùng liệt kê link các issue đã tạo.
