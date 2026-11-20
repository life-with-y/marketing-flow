---
description: Xem và chỉnh cấu hình HomeMatch (nhóm, lịch, persona, kiểu bài) bằng trang tương tác
argument-hint: [yêu cầu chỉnh sửa]
---

Chỉnh cấu hình HomeMatch bằng skill `hm-config`, làm đúng các bước của skill.

- Đối số: `$ARGUMENTS`
  - Rỗng: dựng trang cấu hình, mở và chờ phản hồi.
  - Có nội dung: coi đó là yêu cầu chỉnh đầu tiên (sao lưu, sửa, kiểm tra như skill), rồi vẫn mở trang. Nhiều yêu cầu cách nhau bằng `; ` (nút "Copy yêu cầu" của trang chủ ở chế độ Chỉ xem tạo ra dạng này): làm lần lượt từng yêu cầu.
