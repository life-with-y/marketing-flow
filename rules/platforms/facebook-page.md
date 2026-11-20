# Facebook Page

Áp dụng cho đích `kind: page`. Luật cứng (`hard-rules.md`) đứng trên file này.

## Mục tiêu

- Người lướt dừng lại vì thấy đúng khu, đúng tầm giá, rồi nhắn Page hoặc mở link ở comment.
- Giữ uy tín thương hiệu: phòng thật, giá thật, giọng HomeMatch.

## Link

- Theo công tắc `target.links` (config `links.page`, mặc định tắt). Tắt: không link `homematch.vn` ở đâu cả, CTA trỏ Zalo / inbox Page / comment mã; `comment` bỏ hoặc chỉ ghi mã tin.
- Bật: thân bài không có link. Link tin để ở comment đầu tiên (`comment`), người đăng ghim lại; thân bài nói "link chi tiết ở comment".
- Lý do: Meta đang thử giới hạn 2 bài có link/tháng cho Page chưa xác minh; link trong comment không bị tính.

## Giá

- Nên ghi giá đầy đủ (`priceText`): Page là giọng thương hiệu "phòng thật, giá thật".
- Config `priceStyle.page` = `masked` vẫn được (ghi `4xxx/tháng`, mời nhắn Page để có giá chính xác), nhưng khác với giá trị minh bạch của HomeMatch khi tư vấn; trang chủ và trang bài đăng sẽ cảnh báo.

## Số điện thoại

- Ghi đúng một lần, chữ số thường, chia nhóm dễ đọc: `0838 600 055`.
- Không ghi số dạng icon, không chèn dấu chấm hay khoảng trắng lạ giữa từng chữ số.

## Emoji

- Không dùng emoji (giọng thương hiệu HomeMatch).

## Hashtag/tag

- 0–2 hashtag, liên quan trực tiếp (khu, loại phòng). Viết liền, không dấu: `#phongtrocaugiay`.
- Không tag người hay Page khác.

## Câu mở đầu

- 1–2 dòng đầu (phần hiện trước "Xem thêm") phải nói đủ: khu + giá + hợp với ai.
- Hợp với ai chỉ suy ra từ dữ liệu trong `input.json`.

## Độ dài & định dạng

- Ảnh đi trước, chữ đỡ cho ảnh; ưu tiên ngắn, đọc tốt trên điện thoại.
- Gạch đầu dòng `•`, mỗi ý một dòng. Xưng "bạn" với người đọc.

## Lời mời (CTA)

- Một lời mời rõ: nhắn Page hoặc Zalo theo `contact`; công tắc link bật thì kèm "link chi tiết ở comment".

## Tránh

- Câu mồi tương tác: "comment 'có' để nhận…", "share để…", "tag bạn bè…".
- Giật tít, VIẾT HOA CẢ CÂU, "!!!".
- Emoji, chữ đậm giả, link trong thân bài.
