// Thẻ "Đang xử lý". API chỉ trả MỘT lần nên các bước dưới đây là MÔ PHỎNG THEO THỜI GIAN,
// không phản ánh tiến trình thật. Bước cuối không bao giờ được đánh dấu hoàn tất trước khi có phản hồi.
import { el, icon } from './dom.js';

const STEPS = [
  { label: 'Hiểu câu hỏi', doneAfter: 1200 },
  { label: 'Viết câu truy vấn SQL', doneAfter: 3000 },
  { label: 'Lấy dữ liệu từ cơ sở dữ liệu', doneAfter: null },
  { label: 'Dựng bảng và biểu đồ', doneAfter: null },
];

function setState(item, state) {
  item.dataset.state = state;
  const mark = item.querySelector('.step-mark');
  const sr = item.querySelector('.sr-only');
  mark.replaceChildren();
  if (state === 'done') mark.appendChild(icon('check', 12, 3));
  sr.textContent = state === 'done' ? ' (đã xong)' : state === 'active' ? ' (đang làm)' : ' (chưa bắt đầu)';
}

export function createLoading() {
  const items = STEPS.map((s) =>
    el('li', { class: 'step', 'data-state': 'pending' }, el('span', { class: 'step-mark', 'aria-hidden': 'true' }), s.label, el('span', { class: 'sr-only' })),
  );
  const node = el(
    'section',
    { class: 'state', 'aria-label': 'Đang xử lý', 'data-kind': 'loading' },
    el('h2', { text: 'Đang xử lý câu hỏi…' }),
    el('ol', { class: 'steps' }, ...items),
  );
  items.forEach((it, i) => setState(it, i === 0 ? 'active' : 'pending'));

  const timers = [];
  timers.push(setTimeout(() => { setState(items[0], 'done'); setState(items[1], 'active'); }, STEPS[0].doneAfter));
  timers.push(setTimeout(() => { setState(items[1], 'done'); setState(items[2], 'active'); }, STEPS[1].doneAfter));

  return { node, stop: () => timers.forEach(clearTimeout) };
}
