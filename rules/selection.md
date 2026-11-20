# Chọn tin

## Điều kiện tin

- Tin đủ điều kiện khi có ít nhất 3 ảnh `IMAGE` (`eligible: true` trong `input.json`). Tin không đủ điều kiện không bao giờ vào bài.
- Tin từ route mới (`source: "marketing"`) có thêm tiêu đề, loại phòng, diện tích, phí, cọc, khảo sát toà, mốc gần đó. Tin từ route cũ (`source` thiếu) không có các trường này, nên nội dung không nhắc tới.

## Đích của khung giờ

- Nhóm có `active: true`, có hôm nay trong `days` và có khung này trong `slots`; mỗi nhóm **tối đa 1 bài** mỗi khung.
- Các kênh trong `perSlot` (tường cá nhân, Page, Threads).
- Script đã lọc sẵn: danh sách đích là `input.targets`.

## Ưu tiên

1. Khớp nhu cầu được hỏi nhiều (nếu có leads).
2. `NEW`
3. `PRICE_DOWN`
4. `NOW_AVAILABLE`
5. `UNCHANGED` (`PRICE_UP` xếp cùng mức `UNCHANGED`)

Trong cùng mức thì ưu tiên tin chưa được soạn cho đích đó lâu nhất (xoay vòng mềm, không chặn tin nào).

**Ngày không có gì mới**: vẫn soạn đủ số bài bằng tin `UNCHANGED`, xoay vòng như trên.

## Ghép nhóm theo quận

- Nhóm có `districts` chỉ nhận tin thuộc các quận đó.
- Nhóm không khai `districts` là nhóm toàn Hà Nội.
- Một tin có thể vào nhiều nhóm trong cùng khung, mỗi nhóm một phiên bản nội dung riêng (mở bài, thứ tự ý, CTA), dữ kiện giữ nguyên.

## Ảnh

- **Bài 1 tin**: mục tiêu 5 ảnh, ảnh bìa trước. Tin có 3–4 ảnh thì dùng đủ số đó.
- **Bài nhiều tin**: mục tiêu tổng 5 ảnh. Lấy ảnh bìa từng tin trước, còn chỗ thì thêm ảnh của tin đứng đầu. Bài hơn 5 tin thì mỗi tin 1 ảnh bìa, tối đa 10 ảnh.
- **Bài phân khúc** (kiểu "Gợi ý 4–5 phòng cùng phân khúc"): đúng 1 ảnh bìa mỗi tin, theo thứ tự đánh số (`postCodes`), không ảnh phụ.
- **Bài thương hiệu** cũng phải có ảnh, lấy từ tin thật trong snapshot (3–5 ảnh của tin đủ điều kiện).
- Ảnh tải lỗi thì bỏ ảnh. Tin còn dưới 3 ảnh (bài 1 tin) hoặc tin mất ảnh bìa (bài nhiều tin) thì thay tin một lần, vẫn thiếu thì bỏ bài.

## Phân khúc

- Kiểu "Gợi ý 4–5 phòng cùng phân khúc": 4–5 tin cùng `unitTypeText`, cùng khoảng giá (dưới 4 · 4 đến dưới 5 · 5 đến 6,5 · trên 6,5 triệu, theo giá phòng). Xen kẽ cùng khu (1–2 quận liền nhau) và khác khu (mỗi tin một quận) theo tài khoản. Không đủ 4 tin thì gom theo khu.

## Phiên bản

Mỗi bài có số bản theo `variants` (mặc định 1, tối đa 3). Các bản khác nhau ở nội dung (mở bài, thứ tự ý, CTA) và thứ tự ảnh; dữ kiện, tin và bộ ảnh nguồn giữ nguyên.
