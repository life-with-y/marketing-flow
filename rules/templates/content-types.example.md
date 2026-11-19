# Kiểu bài

Mẫu chung. Muốn kiểu bài riêng thì tạo `~/.homematch-marketing/content-types.md` cùng định dạng; có file riêng thì plugin dùng file đó thay mẫu này.

Mỗi kiểu khai: tên, kênh dùng được, số tin mỗi bài, cách chọn tin, cấu trúc, 1 ví dụ. Kênh: `wall` (FB cá nhân), `page` (FB Page HomeMatch), `threads` (Threads cá nhân), `group` (nhóm FB). Số tin `0` nghĩa là bài thương hiệu (không gắn tin, ảnh lấy từ tin thật).

Ví dụ dưới đây dùng mã và giá giả. Khi soạn thật, mọi giá, trạng thái, mã T…, link lấy nguyên văn từ `input.json`.

---

## 1. Phòng mới / giảm giá

- **Kênh**: wall, page, threads, group
- **Số tin mỗi bài**: 1
- **Cách chọn tin**: tin đầu tiên theo thứ tự ưu tiên của đích (khớp leads > `NEW` > `PRICE_DOWN` > `NOW_AVAILABLE` > `UNCHANGED`, cùng mức thì tin lâu chưa soạn cho đích đó nhất). Ngày không có gì mới vẫn dùng tin `UNCHANGED`.
- **Cấu trúc**:
  1. Mở bài: điều mới (mới lên, vừa giảm giá, vừa trống) hoặc điểm đáng chú ý nhất của phòng
  2. Khu + địa chỉ
  3. Giá (đúng `priceText`) và trạng thái (đúng `statusText`)
  4. Dịch vụ, nội thất có trong dữ liệu, gạch đầu dòng `•`
  5. CTA theo liên hệ của đích, kèm mã tin
- **Ảnh**: 5 ảnh của tin, ảnh bìa trước (tin 3–4 ảnh thì dùng đủ số đó).
- **Ví dụ** (tường cá nhân, liên hệ Zalo):

```
Phòng vừa trống ở Cầu Giấy.

📍 ngõ 100 Trần Thái Tông, Cầu Giấy
💰 3,8 triệu/tháng
🗓 Còn trống

• Wifi, giữ xe
• Giường, tủ quần áo, điều hoà

Hợp với bạn muốn có sẵn giường tủ, vào ở luôn. Không hợp nếu bạn muốn phòng trống để tự sắm đồ.
Phòng còn thật, đã kiểm tra.

Nhắn Zalo 09xx xxx xxx, ghi mã T1302 để mình gửi thêm ảnh và hẹn xem phòng.
Xem ảnh và vị trí: <link của tin T1302>
```

---

## 2. Gom theo khu

- **Kênh**: wall, page, group
- **Số tin mỗi bài**: 3–5
- **Cách chọn tin**: các tin cùng quận (với nhóm có `districts`: trong các quận đó), tầm giá gần nhau, lấy theo thứ tự ưu tiên của đích. Dùng khi đích không còn tin `NEW` / `PRICE_DOWN` / `NOW_AVAILABLE` chưa soạn gần đây và có ít nhất 3 tin đủ điều kiện cùng quận; không đủ 3 tin thì dùng kiểu 1.
- **Cấu trúc**:
  1. Mở bài: khu và tầm giá chung
  2. Mỗi tin một khối ngắn: mã tin, địa chỉ ngắn, giá, trạng thái
  3. CTA chung, nhắc khách ghi mã tin muốn xem
- **Ảnh**: ảnh bìa từng tin theo đúng thứ tự tin trong bài, còn chỗ thì thêm ảnh của tin đứng đầu, tổng 5 ảnh.
- **Ví dụ** (nhóm Cầu Giấy, quy định nhóm chưa rõ nên không SĐT, không link):

```
3 phòng ở Cầu Giấy, giá và ngày trống từng phòng:

T1302 • ngõ 100 Trần Thái Tông • 3,8 triệu/tháng • Còn trống
T1417 • ngõ 68 Cầu Giấy • 3,5 triệu/tháng • Còn trống
T1520 • phố Dịch Vọng Hậu • 4,2 triệu/tháng • Sắp trống 01/12

Ai quan tâm phòng nào cứ nhắn tin hoặc comment mã (vd T1417), mình gửi ảnh và hẹn xem.
```

---

## 3. Thương hiệu "phòng thật, giá thật"

- **Kênh**: wall, page, threads
- **Số tin mỗi bài**: 0 (ảnh lấy từ 3–5 tin đủ điều kiện)
- **Cách chọn tin**: không gắn tin. Chọn 3–5 ảnh thật, đẹp, rõ phòng từ các tin đủ điều kiện, ưu tiên ảnh bìa của các tin khác nhau.
- **Cấu trúc**:
  1. Mở bài: một điều có thật về cách làm (phòng còn thật, giá đúng như đăng, ảnh chụp thật)
  2. 2–3 câu nói rõ người thuê được gì, không hứa quá
  3. CTA mềm theo liên hệ của đích
- **Ảnh**: 3–5 ảnh thật của tin đủ điều kiện.
- **Ví dụ** (Threads):

```
Đi xem phòng mà ảnh một đằng, phòng một nẻo thì mất cả buổi.

Phòng mình đăng đều đã kiểm tra là còn, giá ghi bao nhiêu thì xem đúng bấy nhiêu, ảnh là ảnh chụp phòng thật.

Đang tìm phòng ở Hà Nội thì nhắn mình khu và tầm giá, mình gửi phòng hợp.
```
