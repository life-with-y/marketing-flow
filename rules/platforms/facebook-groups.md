# Nhóm Facebook (cụm nhóm)

Áp dụng cho đích `kind: group`: một **cụm nhóm** (khu vực × phân khúc). Người dùng đăng bài trên trang cá nhân (chế độ chuyên nghiệp) rồi chia sẻ vào các nhóm của cụm; nhóm thật do người dùng tự tìm và tham gia. Luật cứng (`hard-rules.md`) đứng trên file này.

## Mục tiêu

- Bài được admin các nhóm duyệt và không bị gỡ; người trong nhóm hỏi lại qua inbox hoặc comment mã tin.
- Một văn bản đi vào nhiều nhóm: viết cho người đọc chung của cụm (đúng khu, đúng phân khúc), không gọi tên một nhóm cụ thể.

## Link

- Mặc định an toàn: không link ở đâu cả.
- Chỉ có link khi **cả** công tắc `target.links` bật (config `links.group`) **và** quy định nhóm (`target.note`) cho phép; khi đó link để ở comment đầu tiên, không trong thân bài.

## Giá

- Theo `target.priceStyle` (config `priceStyle.group`): `full` ghi `priceText`; `masked` ghi `4xxx/tháng` và mời inbox để có giá chính xác.

## Số điện thoại

- Mặc định an toàn: không số điện thoại, không số Zalo.
- Chỉ ghi khi `target.note` cho phép; khi đó ghi một lần, chữ số thường.
- Không bao giờ dùng số dạng icon, tách chữ số hay ký tự lạ để lách luật nhóm.

## Emoji

- Theo persona, tối đa vài emoji làm dấu mốc (📍, 💰). Không trang trí.

## Hashtag/tag

- Chỉ dùng hashtag khi nhóm yêu cầu (vd hashtag khu bắt buộc trong `target.note`).

## Câu mở đầu

- Có tiền tố bắt buộc của nhóm (`target.note`, vd `[Cho thuê]`) thì đặt đúng ở đầu bài.
- Dòng đầu nói khu + giá.

## Độ dài & định dạng

- Ngắn, gạch đầu dòng `•`. Mỗi khung một văn bản mới cho cụm (mở bài, thứ tự ý khác bài trước), cùng dữ kiện.

## Lời mời (CTA)

- Mặc định: "nhắn tin cho mình" hoặc "comment mã T…" (mã tin trong bài).

## Tránh

- Lách luật nhóm bằng số dạng icon hay viết tách chữ.
- Lặp lại nguyên văn bài cũ của cụm.
- Câu mồi tương tác ("comment 'có'…", "share để…"), giật tít, VIẾT HOA, "!!!".
