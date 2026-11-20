# Luật cứng

Áp dụng cho mọi bài, mọi kênh, mọi persona. Không ai ghi đè: không persona, không kiểu bài, không Trends, không ghi chú nhóm.

Thứ tự ưu tiên khi các nguồn mâu thuẫn: luật cứng > hồ sơ cá nhân > mặc định chung > Trends (Trends chỉ ảnh hưởng cấu trúc).

## 4 điều

1. Chỉ dùng dữ kiện có trong API (trong `input.json`).
2. Không bịa dữ kiện. Diện tích, loại phòng, số phòng còn trống, phí, cọc, thang máy, thú cưng, xe điện, đường vào, mốc gần đó chỉ được ghi khi có trong tin (`title`, `rooms[]`, `details`, `availableUnitsCount`); trường `null`/rỗng hay tin từ route cũ thì không nhắc. Không bao giờ bịa lượt xem, "hot", "chốt nhanh", "phòng cuối" (khi `availableUnitsCount` là 1 thì được viết "tin này còn 1 phòng trống").
3. Không đổi giá, trạng thái, mã T…, link.
4. Không nói hay ám chỉ tin được ưu tiên hiển thị vì chủ nhà trả tiền.

## Chỉ văn bản thường

Nội dung phải dán được nguyên lên Facebook/Threads:

- Được dùng: chữ thường, xuống dòng, emoji, gạch đầu dòng bằng ký tự `•`.
- Không dùng markdown: `**…**`, `__…__`, `_…_`, dòng tiêu đề bắt đầu bằng `#`.
- Không dùng chữ "đậm/nghiêng" giả bằng ký tự Unicode (khối U+1D400–U+1D7FF, vd 𝗽𝗵𝗼̀𝗻𝗴, 𝘱𝘩𝘰̀𝘯𝘨).

## Giá và mã tin (build.mjs kiểm tra)

- Giá chép đúng `priceText` (vd `3,5 triệu`); bài tiếng Anh được dùng thêm `3.5 million VND` hoặc `3,500,000 VND`. Không viết `tr`, không viết giá nào khác.
- Ngay sau giá không đặt số hay chữ đọc giá (`5`, `rưỡi`, `một`, `tư`, `lẻ`…). Viết `3 triệu/tháng`, không viết `3 triệu một tháng`.
- Chỉ ghi mã T… của tin có trong bài. Bài thương hiệu không ghi giá thuê, không ghi mã tin.
- Phí và cọc lấy từ `details.fees` / `details.deposit`, giữ đúng số tiền và đơn vị (viết bằng `đ`, vd `3.990đ/số`, `Cọc 1 tháng`); được bỏ dấu ":" giữa tên phí và số. Không đổi sang `triệu`/`k`, không cộng gộp, không tính tổng chi phí.

## Link tin (build.mjs kiểm tra)

- Facebook (`page`, `wall`, `group`): thân bài không có link `homematch.vn` (kể cả không có `https://`). Link tin để trong comment đầu tiên (`comment`), người đăng ghim lại. Lý do: Facebook giảm tiếp cận bài có link ngoài trong thân bài, Meta đang thử giới hạn 2 bài có link/tháng cho Page và trang cá nhân chuyên nghiệp chưa xác minh (link trong comment không bị tính).
- Threads: được để link trong thân bài.
- Link ở đâu cũng phải đúng `link` của tin trong bài. Comment ngắn (≤ 300 ký tự), cùng luật chữ thường, giá, mã tin như thân bài. Bài thương hiệu: comment không có link homematch, không có mã tin.
