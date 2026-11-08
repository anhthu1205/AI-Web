// Lịch sử câu hỏi trong localStorage: chỉ lưu CÂU HỎI (không lưu kết quả/SQL), tối đa 20 mục.

const KEY = 't2s.history.v1';
const MAX = 20;
const MAX_LEN = 300;

function read() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data
      .filter((x) => x && typeof x.q === 'string' && x.q.trim())
      .map((x) => ({ q: x.q.slice(0, MAX_LEN), t: Number.isFinite(x.t) ? x.t : 0 }))
      .slice(0, MAX);
  } catch {
    return [];
  }
}

function write(items) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* bị chặn hoặc đầy: bỏ qua, ứng dụng vẫn chạy */
  }
}

// Nghi là thông tin cá nhân: >= 9 chữ số liên tiếp (SĐT/CMND) hoặc có '@' (email).
export function looksPersonal(text) {
  return /\d{9,}/.test(text) || text.includes('@');
}

let items = read();

export const list = () => items.slice();

export function add(question) {
  const q = question.trim();
  if (!q || q.length > MAX_LEN || looksPersonal(q)) return false;
  items = [{ q, t: Date.now() }, ...items.filter((x) => x.q !== q)].slice(0, MAX);
  write(items);
  return true;
}

export function clear() {
  items = [];
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* bỏ qua */
  }
}
