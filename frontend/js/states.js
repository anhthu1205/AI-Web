// Thẻ trạng thái: từ chối, hỏi lại, hết lượt, lỗi hệ thống. Nội dung động chỉ qua textContent.
import { el, icon } from './dom.js';
import { truncateText } from './format.js';

function stateCard({ tone, iconName, title, role, danger, kind, children }) {
  return el(
    'section',
    { class: `state tone-${tone}${danger ? ' state-danger' : ''}`, role, 'data-kind': kind, 'aria-label': title },
    el('div', { class: 'state-head' }, el('span', { class: 'state-icon', 'aria-hidden': 'true' }, icon(iconName, 18, 2.2)), el('h2', { text: title })),
    ...children,
  );
}

export function scopeCard(message, suggestion, onAsk) {
  const children = [el('p', { text: message })];
  if (suggestion) {
    children.push(el('div', { class: 'state-actions' }, el('button', { type: 'button', class: 'chip', text: `Hỏi: ${suggestion}`, onclick: () => onAsk(suggestion) })));
  }
  return stateCard({ tone: 'warn', iconName: 'block', title: 'Không thể thực hiện yêu cầu này', kind: 'out-of-scope', children });
}

export function clarifyCard(text) {
  return stateCard({
    tone: 'info',
    iconName: 'help',
    title: 'Cần làm rõ thêm',
    kind: 'clarification',
    children: [el('p', { text }), el('p', { class: 'state-hint', text: 'Gõ câu trả lời ở ô bên dưới.' })],
  });
}

// Thẻ hết lượt: đếm lùi ƯỚC LƯỢNG (server không trả thời gian chính xác).
export function rateCard() {
  const status = el('p', { class: 'state-hint' });
  const bar = el('div', { class: 'countdown-bar' });
  const node = stateCard({
    tone: 'warn',
    iconName: 'clock',
    title: 'Bạn hỏi hơi nhanh',
    kind: 'rate-limited',
    children: [
      el('p', { text: 'Bạn hỏi hơi nhanh. Vui lòng chờ khoảng một phút rồi hỏi tiếp.' }),
      status,
      el('div', { class: 'countdown', 'aria-hidden': 'true' }, bar),
    ],
  });
  let timer = null;
  return {
    node,
    start(seconds) {
      const total = seconds;
      let left = seconds;
      const paint = () => {
        status.textContent = `Có thể hỏi tiếp sau khoảng ${left} giây.`;
        bar.style.width = `${Math.max(0, (left / total) * 100)}%`;
      };
      paint();
      timer = setInterval(() => {
        left -= 1;
        if (left <= 0) {
          clearInterval(timer);
          status.textContent = 'Bạn có thể hỏi tiếp.';
          bar.style.width = '0%';
          return;
        }
        paint();
      }, 1000);
    },
    stop() {
      if (timer) clearInterval(timer);
    },
  };
}

const RETRYABLE = new Set(['NETWORK', 'LLM_UNAVAILABLE', 'DB_UNAVAILABLE', 'HTTP']);

export function errorCard(error, { onRetry, onEdit }) {
  const code = error.code;
  let title = 'Hệ thống tạm thời không phản hồi';
  let hint = null;
  let message = error.message || 'Có lỗi xảy ra. Vui lòng thử lại.';
  if (code === 'DB_TIMEOUT') {
    title = 'Không lấy được dữ liệu';
    hint = 'Hãy thu hẹp câu hỏi, ví dụ thêm khoảng thời gian hoặc một tỉnh cụ thể.';
  } else if (code === 'SQL_REJECTED') {
    title = 'Chưa tạo được truy vấn phù hợp';
    message = truncateText(message, 200);
    hint = 'Hãy thử diễn đạt lại câu hỏi cụ thể hơn.';
  } else if (code === 'INVALID_INPUT') {
    title = 'Câu hỏi chưa hợp lệ';
  }
  const retry = RETRYABLE.has(code);
  const children = [el('p', { text: message })];
  if (hint) children.push(el('p', { class: 'state-hint', text: hint }));
  children.push(
    el('div', { class: 'state-actions' }, el('button', { type: 'button', class: 'btn-danger', text: retry ? 'Thử lại' : 'Sửa câu hỏi', onclick: retry ? onRetry : onEdit })),
  );
  return stateCard({ tone: 'danger', iconName: 'alert', title, role: 'alert', danger: true, kind: 'error', children });
}

export function plainCard(title, text) {
  return stateCard({ tone: 'neutral', iconName: 'search', title, kind: 'info', children: [el('p', { text })] });
}
