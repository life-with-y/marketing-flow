# Nhóm Facebook

Áp dụng cho đích `kind: group`. Luật cứng (`hard-rules.md`) đứng trên file này.

## Mục tiêu

- Bài được admin duyệt và không bị gỡ; người trong nhóm hỏi lại qua inbox hoặc comment mã tin.

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

- Ngắn, gạch đầu dòng `•`. Mỗi nhóm một văn bản riêng (mở bài, thứ tự ý), cùng dữ kiện.

## Lời mời (CTA)

- Mặc định: "nhắn tin cho mình" hoặc "comment mã T…" (mã tin trong bài).

## Tránh

- Lách luật nhóm bằng số dạng icon hay viết tách chữ.
- Đăng cùng một văn bản vào nhiều nhóm.
- Câu mồi tương tác ("comment 'có'…", "share để…"), giật tít, VIẾT HOA, "!!!".
