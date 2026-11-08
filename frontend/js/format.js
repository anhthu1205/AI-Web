export const nf = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });
const seconds = new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// Rút gọn số tiền lớn: 1,5 tỷ / 250 triệu.
export function shortNumber(v) {
  const a = Math.abs(v);
  if (a >= 1e9) return `${nf.format(v / 1e9)} tỷ`;
  if (a >= 1e6) return `${nf.format(v / 1e6)} triệu`;
  return nf.format(v);
}

// 812 ms -> "0,8 giây"; dưới 100 ms -> "dưới 0,1 giây".
export function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 100) return 'dưới 0,1 giây';
  return `${seconds.format(ms / 1000)} giây`;
}

// Bỏ dấu + chữ thường để so sánh câu hỏi.
export function normalize(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function truncateText(text, max) {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
