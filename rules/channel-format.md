# Định dạng theo kênh

## Mọi kênh

- Chỉ văn bản thường (xem `hard-rules.md`). Gạch đầu dòng bằng ký tự `•`.
- Giá ghi dạng `3,5 triệu`: dấu phẩy thập phân, bỏ `,0` (`4 triệu`, không `4,0 triệu`). Dùng đúng `priceText` của phòng, không viết `3tr5`, `3.5tr`, `3 triệu rưỡi`.
- Ngay sau giá không đặt chữ số (viết `3,5 triệu/tháng`, không `3,5 triệu 2 phòng`).
- Link tin dùng nguyên `link` (`share_link`), không rút gọn, không gắn mã giới thiệu.

## Theo kênh

Link, số điện thoại, emoji, hashtag, câu mở đầu, độ dài, CTA của từng kênh nằm trong `rules/platforms/` (`input.paths.platforms`): `facebook-page.md`, `facebook-profile.md`, `facebook-groups.md`, `threads.md`. Khi mâu thuẫn, hướng dẫn nền tảng đứng trên file này.

## Ngôn ngữ

- Theo `language` của đích (mặc định `vi`). Các kênh không phải nhóm dùng `vi`.
- Đích `en` (nhóm người nước ngoài): viết tiếng Anh; giá ghi `3.5 million VND` hoặc `3,500,000 VND` (đúng số tiền của phòng). Tên quận, địa chỉ giữ nguyên tiếng Việt.
