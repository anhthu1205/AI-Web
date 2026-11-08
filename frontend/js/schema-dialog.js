// Hộp thoại "Xem cấu trúc dữ liệu": tải /api/schema lần đầu rồi dùng lại.
import { el } from './dom.js';
import { getSchema } from './api.js';

export function setupSchemaDialog({ dialog, body, closeButton }) {
  let loaded = false;
  let opener = null;

  function render(schema) {
    body.replaceChildren(
      el('p', { class: 'intro', text: `Bảng ${schema.table}: ${schema.columns.length} cột. Hệ thống chỉ đọc từ bảng này.` }),
      el('div', {}, el('h3', { text: 'Các cột' }), el('ul', { class: 'schema-list' }, ...schema.columns.map((c) => el('li', {}, el('code', { text: c.name }), el('span', { class: 'col-type', text: c.type }), el('p', { text: c.description }))))),
      el('div', {}, el('h3', { text: 'Giá trị thường gặp' }), el('dl', { class: 'cat-list' }, ...Object.entries(schema.categories).flatMap(([k, v]) => [el('dt', { text: k }), el('dd', { text: v.join(', ') })]))),
    );
  }

  async function open(trigger) {
    opener = trigger || document.activeElement;
    if (!dialog.open) dialog.showModal();
    if (loaded) return;
    body.replaceChildren(el('p', { class: 'intro', text: 'Đang tải…' }));
    const res = await getSchema();
    if (!res.ok) {
      body.replaceChildren(el('p', { class: 'intro', text: 'Không tải được cấu trúc dữ liệu. Vui lòng thử lại.' }));
      return;
    }
    loaded = true;
    render(res.data);
  }

  function close() {
    if (dialog.open) dialog.close();
  }

  closeButton.addEventListener('click', close);
  dialog.addEventListener('click', (e) => { if (e.target === dialog) close(); });
  dialog.addEventListener('close', () => {
    if (opener && opener.isConnected) opener.focus();
    opener = null;
  });
  return { open, close };
}
