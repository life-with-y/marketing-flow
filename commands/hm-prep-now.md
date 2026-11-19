---
description: Soạn bài HomeMatch ngay bây giờ (ngoài lịch), có thể chỉ cho một số nhóm
argument-hint: [chỉ nhóm …]
---

Soạn bài HomeMatch ngay bây giờ bằng skill `hm-post-prep`, làm đúng các bước của skill.

- Đây là lần chạy tay: **không** truyền `--slot`.
- Đối số: `$ARGUMENTS`
  - Rỗng: chạy `prepare` không có `--only`.
  - Có dạng "chỉ nhóm X, Y" (hoặc "chỉ nhóm X và Y"): bỏ chữ "chỉ nhóm", tách tên nhóm theo dấu phẩy hoặc chữ "và", truyền `--only "X,Y"`. Ví dụ `chỉ nhóm Cầu Giấy, Đống Đa` → `--only "Cầu Giấy,Đống Đa"`.
- Mọi thứ khác (mã thoát, xử lý lỗi, dòng báo cuối) theo skill `hm-post-prep`.
