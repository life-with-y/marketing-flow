# Kiểu bài

Mẫu chung. Muốn kiểu bài riêng thì tạo `~/.homematch-marketing/content-types.md` cùng định dạng; có file riêng thì plugin dùng file đó thay mẫu này.

Mỗi kiểu khai: tên, kênh dùng được, số tin mỗi bài, cách chọn tin, cấu trúc, 1 ví dụ. Kênh: `wall` (FB cá nhân), `page` (FB Page HomeMatch), `threads` (Threads cá nhân), `group` (nhóm FB). Số tin `0` nghĩa là bài hỏi nhu cầu (không gắn tin, ảnh lấy từ tin thật).

Ví dụ dưới đây có thể lấy từ tin cũ, giá và mã không còn đúng. Khi soạn thật, mọi giá, trạng thái, mã T…, link, phí lấy nguyên văn từ `input.json`.

## Mục tiêu chung

Bài không chỉ quảng cáo 1 phòng mà để mở cuộc nói chuyện với người đang cần thuê. Mỗi bài có một lời mời trả lời dễ (comment khu + tầm tiền, comment mã, nhắn "xem"), để từ đó gửi thêm phòng khác trong kho.

Người đọc lướt trên điện thoại: dòng đầu phải đủ để quyết định có đọc tiếp không, khối thông tin đọc lướt được trong 3 giây, mỗi dòng một ý, có icon.

## Hiểu người đọc (chỉ để chọn góc viết, không ghi ngưỡng giá vào bài)

- Giá dưới 5 triệu: thường là sinh viên, người mới đi làm. Đánh vào: giá, chi phí hằng tháng rõ ràng (điện, nước, dịch vụ), đủ đồ cơ bản, vào ở luôn, để được xe điện. Câu ngắn, gần gũi.
- Giá từ 5 triệu: thường là người đi làm. Đánh vào: loại phòng (1 ngủ 1 khách, studio rộng), diện tích, máy giặt riêng, bếp từ, sofa, thang máy, ngõ ô tô, an ninh (camera, vân tay cửa chính), không gian riêng. Câu gọn, chỉn chu.
- Không viết "dưới 5 triệu", "tầm 4–5 triệu" hay giá nào khác ngoài `priceText` của phòng trong bài.

## Dùng dữ liệu tin thế nào

- Dòng tiêu đề: dựa vào `title` của tin và `rooms[].unitTypeText`, thêm diện tích `areaSqm` nếu có. Được viết hoa cả dòng cho nổi (vd "STUDIO 25M² CÓ BẾP RIÊNG – MIÊU NHA"); không dùng chữ đậm giả bằng Unicode.
- Loại phòng: `unitTypeText` (Studio, 1 ngủ 1 khách, Căn hộ gác lửng…). Không có thì lấy từ `title`.
- Nội thất: tách 1–2 món "đắt" ra dòng ✅ (Máy giặt riêng, Bếp từ, Sofa, TV, Bàn ăn), phần còn lại gom gọn ở dòng 🛋. Ghi "Đủ đồ" chỉ khi có đủ Giường, Tủ quần áo, Điều hoà, Nóng lạnh, Tủ lạnh. Không viết "full đồ".
- Tiện ích toà (`details.amenities`) và dữ kiện (`details.facts`): chọn 2–4 cái đắt nhất theo người đọc cho dòng ✅: Thang máy, Để được xe điện, Lối vào: ngõ ô tô, Khép kín, Ban công, Cửa sổ thoáng, Camera, Vân tay cửa chính, Máy giặt riêng. Không đưa điều bất lợi lên dòng ✅; "Không nuôi thú cưng", "Không nhận xe điện", "Chung chủ", "Hợp đồng tối thiểu 12 tháng" chỉ ghi ở dòng 📌 cuối khối để khách tự lọc.
- Phí (`details.fees`): một dòng 🧾, giữ đúng số tiền và đơn vị, bỏ dấu ":" và nối bằng "•", vd "🧾 Điện 4.000đ/số • Nước 35.000đ/khối • Dịch vụ 150.000đ/người/tháng". Cọc (`details.deposit`) đặt ngay sau giá: "💰 3,9 triệu/tháng • Cọc 1 tháng".
- Còn ít phòng: khi `availableUnitsCount` là 1, mở bài được dùng "Chỉ còn 1 phòng" để tạo tò mò. Không viết "hot", "chốt nhanh", "các phòng khác đã kín".
- Không dùng: `details.ward` (phường đang sai ở nhiều tin), `details.availabilityVerified` / `priceVerified` khi ngày đã cũ hơn 7 ngày so với khung soạn, `details.landmarks` khi rỗng. Không có trong dữ liệu thì không viết (diện tích, tầng, số người, gần trường, tòa mới).

## Liên hệ và lời mời

- Liên hệ một lần, không lặp số. Kèm mã tin, rồi link tin ở dòng cuối.
- Lời mời nói chuyện là một câu hỏi dễ trả lời, đổi cách hỏi giữa các bài: "Bạn đang làm/học ở khu nào?", "Comment khu + tầm tiền, mình gửi thêm vài phòng", "Cần thêm phòng có máy giặt riêng thì comment 'máy giặt'", "Nhắn mình ngày bạn muốn chuyển vào".

---

## 1. Phòng nổi bật

- **Kênh**: wall, page, threads, group
- **Số tin mỗi bài**: 1
- **Cách chọn tin**: tin đầu tiên theo thứ tự ưu tiên của đích (khớp leads > `NEW` > `PRICE_DOWN` > `NOW_AVAILABLE` > `UNCHANGED`, cùng mức thì tin lâu chưa soạn cho đích đó nhất). Ngày không có gì mới vẫn dùng tin `UNCHANGED`.
- **Cấu trúc**:
  1. Dòng tiêu đề: icon 🔥 hoặc 🏡, loại phòng + diện tích + 1–2 điểm đắt nhất + khu. Tin `NEW` / `PRICE_DOWN` / `NOW_AVAILABLE` nói điều mới trước ("VỪA GIẢM GIÁ", "VỪA TRỐNG"). Tin còn 1 phòng có thể mở bằng "Chỉ còn 1 phòng". Mỗi bài một câu mở khác nhau.
  2. Khối thông tin, mỗi dòng một ý: 🏠 địa chỉ, quận • 💰 giá/tháng (+ cọc) • ⏰ trạng thái • ✅ 2–4 điểm nổi bật • 🛋 nội thất gom gọn • 🧾 phí • 📌 lưu ý (nếu có). Threads: bỏ 🛋 và 📌, tối đa 6 dòng thông tin.
  3. Một câu "hợp với ai" theo nhóm người đọc, viết riêng cho phòng.
  4. Lời mời nói chuyện.
  5. Liên hệ + mã tin, link.
- **Ảnh**: 5 ảnh của tin, ảnh bìa trước (tin 3–4 ảnh thì dùng đủ số đó).
- **Ví dụ** (tường cá nhân, phòng giá thấp, liên hệ Zalo):

```
🔥 STUDIO 25M² CÓ BẾP RIÊNG – MIÊU NHA, NAM TỪ LIÊM

🏠 6/59 Miêu Nha, Nam Từ Liêm
💰 3,9 triệu/tháng • Cọc 1 tháng
⏰ Còn trống, vào ở luôn
✅ Thang máy • Để được xe điện • Vân tay cửa chính
🛋 Đủ đồ: giường, tủ quần áo, điều hoà, nóng lạnh, tủ lạnh, kệ bếp
🧾 Điện 4.000đ/số • Nước 35.000đ/khối • Dịch vụ 150.000đ/người/tháng
📌 Hợp đồng tối thiểu 6 tháng

Hợp bạn sinh viên hoặc mới đi làm, đi xe điện, muốn tự nấu cho tiết kiệm.

Bạn học hay làm ở khu nào? Comment cho mình, mình gửi thêm vài phòng gần đó.

Zalo 09xx xxx xxx, nhắn mã T1302 để xem thêm ảnh và hẹn lịch.
<link của tin T1302>
```

---

## 2. Gom theo khu

- **Kênh**: wall, page, group
- **Số tin mỗi bài**: 3–5
- **Cách chọn tin**: các tin cùng quận (với nhóm có `districts`: trong các quận đó), cùng nhóm người đọc (cùng phía ngưỡng 5 triệu), lấy theo thứ tự ưu tiên của đích. Dùng khi đích không còn tin `NEW` / `PRICE_DOWN` / `NOW_AVAILABLE` chưa soạn gần đây và có ít nhất 3 tin đủ điều kiện; không đủ 3 tin thì dùng kiểu 1.
- **Cấu trúc**:
  1. Mở bài: khu + nhóm người đọc + điểm chung của các phòng (vd "đều có thang máy"), không ghi khoảng giá.
  2. Mỗi tin một khối 2 dòng: dòng 1 "🔹 mã – loại phòng, diện tích, 1 điểm đắt"; dòng 2 địa chỉ ngắn • giá/tháng • trạng thái.
  3. Lời mời: comment mã muốn xem; chưa có phòng ưng thì comment khu + tầm tiền.
- **Ảnh**: ảnh bìa từng tin theo đúng thứ tự tin trong bài, còn chỗ thì thêm ảnh của tin đứng đầu, tổng 5 ảnh.
- **Ví dụ** (tường cá nhân, phòng cho người đi làm):

```
🏡 CẦU GIẤY: 3 CĂN 1 NGỦ 1 KHÁCH CHO NGƯỜI ĐI LÀM, ĐỀU CÓ THANG MÁY

🔹 T2125 – 1 ngủ 1 khách, sofa, máy giặt riêng
Ngõ 89 Phạm Văn Đồng • 6,35 triệu/tháng • Còn trống

🔹 T2111 – 1 ngủ 1 khách, có bàn ăn, ngõ ô tô
Ngõ 329 Cầu Giấy • 5,9 triệu/tháng • Còn trống

🔹 T2211 – 1 ngủ 1 khách 35m², máy giặt riêng, để được xe điện
ngõ 7 Nguyễn Khả Trạc • 5,8 triệu/tháng • Còn trống

Ưng căn nào cứ comment mã (vd T2111), mình gửi thêm ảnh, bảng phí và hẹn xem. Chưa thấy căn hợp thì comment khu + tầm tiền.

Zalo 09xx xxx xxx.
```

---

## 3. Gom theo nhu cầu

- **Kênh**: wall, page, threads, group
- **Số tin mỗi bài**: 2–4
- **Cách chọn tin**: các tin cùng có một điểm người thuê hay hỏi, lấy từ `facts` / `amenities` / nội thất / loại phòng: "Để được xe điện", "Máy giặt riêng", "Ban công", "Bếp từ", "1 ngủ 1 khách", "Lối vào: ngõ ô tô". Có thể khác quận. Cùng nhóm người đọc. Nhóm có `districts` thì chỉ lấy tin trong các quận đó. Dùng xen với kiểu 2 khi có ít nhất 2 tin cùng điểm; không đủ thì dùng kiểu 1.
- **Cấu trúc**:
  1. Mở bài bằng nhu cầu, dạng câu hỏi hoặc lời than quen thuộc (vd "Đi xe điện mà tìm phòng cho sạc khó thế?").
  2. Mỗi tin một dòng: "🔹 mã – loại phòng – khu • giá/tháng".
  3. Lời mời gắn với nhu cầu: "Comment 'xe điện' + khu bạn cần, mình lọc thêm".
- **Ảnh**: như kiểu 2.
- **Ví dụ** (Threads):

```
Đi xe điện mà tìm phòng cho để xe khó thế 😅

Mấy phòng đang trống, đều để được xe điện, có thang máy:
🔹 T2213 – Studio 25m² – Miêu Nha • 3,9 triệu/tháng
🔹 T2140 – Studio ban công 20m² – Văn Tiến Dũng • 4,4 triệu/tháng
🔹 T2223 – Studio 28m² bếp từ – Cổ Nhuế • 5 triệu/tháng

Comment "xe điện" + khu bạn cần, mình lọc thêm. Zalo 09xx xxx xxx.
```

---

## 4. Hỏi nhu cầu

- **Kênh**: wall, page, threads
- **Số tin mỗi bài**: 0 (ảnh lấy từ 3–5 tin đủ điều kiện)
- **Cách chọn tin**: không gắn tin. Chọn 3–5 ảnh thật, đẹp, rõ phòng từ các tin đủ điều kiện, ưu tiên ảnh bìa của các tin khác nhau.
- **Cấu trúc**:
  1. Mở bài bằng một câu hỏi hoặc một nỗi khổ thật khi tìm phòng (ảnh không giống thật, đi xem cả buổi, phí phát sinh không báo trước, tin đăng mà phòng đã hết). Mỗi lần một góc khác nhau.
  2. 1–2 câu nói cách làm: phòng đang trống thật, ảnh chụp phòng thật, giá và bảng phí điện nước gửi rõ trước khi đi xem. Không hứa quá. Không ghi giá thuê, không ghi mã tin, không ghi số tiền phí.
  3. Lời mời trả lời cụ thể: comment hoặc nhắn 3 thứ (khu, tầm tiền, ngày muốn vào ở), mình gửi phòng hợp.
- **Ảnh**: 3–5 ảnh thật của tin đủ điều kiện.
- **Ví dụ** (Threads):

```
Thuê phòng xong mới biết nước tính theo người, dịch vụ thêm vài trăm, bạn gặp chưa?

Phòng mình gửi đều ghi rõ điện, nước, dịch vụ ngay từ đầu, ảnh chụp chính phòng đó, đang trống thật.

Comment khu + tầm tiền + ngày muốn vào ở, mình gửi luôn vài phòng kèm bảng phí để bạn so.
```
