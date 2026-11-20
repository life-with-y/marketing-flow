# HomeMatch Marketing (marketing-flow)

Plugin Claude Code soạn sẵn bài đăng cho cụm nhóm Facebook (đăng trang cá nhân rồi chia sẻ vào nhóm), Page và Threads cho HomeMatch từ tin phòng mới nhất. Bạn vẫn tự đăng; plugin chuẩn bị nội dung và ảnh.

## Yêu cầu

- Gói Claude Code trả phí của chính bạn (chi phí tính vào tài khoản của bạn)
- App Claude desktop
- Node từ phiên bản 20 trở lên

## Cài đặt

1. Trong Claude Code:
   ```
   /plugin marketplace add life-with-y/marketing-flow
   /plugin install homematch-marketing
   ```
   (Lệnh cài sẽ được xác nhận sau bước thử nghiệm Task 0.)
2. Xin admin cấp token (chỉ đọc, của riêng bạn).
3. Chạy `/hm-setup`, trả lời các câu hỏi (token, giờ chạy, quyền, persona).

Không cần tài khoản GitHub.

## Dùng hằng ngày

- Đến giờ đã hẹn, plugin tự soạn bài. Mở `index.html` trong thư mục kết quả (mặc định `~/HomeMatch-Posts/index.html`): tab **Bài đăng** có bài của khung mới nhất (chọn được 14 khung gần nhất) để copy nội dung và đường dẫn thư mục ảnh; các tab **Kiểu bài**, **Hằng ngày**, **Hồ sơ** cho xem cấu hình.
- Mỗi bài có một thư mục ảnh riêng, ảnh đặt tên theo thứ tự đăng (`1` là ảnh bìa).
- `/hm-config`: mở cùng trang đó cùng Claude để đổi cụm nhóm, lịch, persona, kiểu bài. Mở trang thẳng từ thư mục thì là chế độ chỉ xem: gõ yêu cầu, bấm **Copy yêu cầu** rồi dán vào chat Claude.
- `/hm-prep-now`: soạn ngay, không chờ đến giờ.

## Lưu ý

Máy phải bật và app Claude đang mở lúc đến giờ. Nếu trễ quá 90 phút thì khung đó bị bỏ qua.

Lịch chạy dùng model mặc định của app Claude; muốn đổi model thì sửa trong cài đặt task ở mục Scheduled.

## Góp ý

Bấm nút **Góp ý** trên bài hoặc **Báo lỗi / góp ý plugin** ở cột phải trang chủ, điền Form. Owner sẽ xử lý.

## Giấy phép

MIT
