// Chế độ trang chủ theo việc có window.lavish hay không. Hàm tự đủ: mã nguồn được chèn nguyên vào trang.
export function modeView(hasLavish) {
  return hasLavish
    ? { mode: 'edit', badge: 'Đang sửa cùng Claude', send: 'Gửi cho Claude sửa', note: 'Claude sửa ngay, lưu bản cũ, rồi dựng lại trang.' }
    : { mode: 'view', badge: 'Chỉ xem', send: 'Copy yêu cầu', note: 'Dán vào chat Claude để sửa.' };
}
