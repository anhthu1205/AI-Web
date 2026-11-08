// Điều phối giao diện: máy trạng thái home <-> thread, gửi câu hỏi, lịch sử, ngăn kéo, huy hiệu chế độ.
import { askQuestion, getExamples, getHealth } from './api.js';
import { el, icon, prefersReducedMotion } from './dom.js';
import { createLoading } from './loading.js';
import { buildResult } from './results.js';
import { scopeCard, clarifyCard, rateCard, errorCard, plainCard } from './states.js';
import { suggest } from './followups.js';
import { setupSchemaDialog } from './schema-dialog.js';
import * as store from './history.js';

const $ = (id) => document.getElementById(id);
const MAX_Q = 300;
const MAX_CACHE = 20;

const ui = {
  form: $('ask'), input: $('question'), submit: $('submit'), label: $('question-label'),
  composerWrap: $('composer-wrap'), hint: $('composer-hint'), counter: $('counter'), formMsg: $('form-msg'),
  home: $('home'), thread: $('thread'), dock: $('dock'), homeSlot: $('home-composer-slot'),
  pagehead: $('pagehead'), title: $('thread-title'), badge: $('mode-badge'), badgeText: $('mode-badge-text'),
  sidebar: $('sidebar'), sidebarBody: $('sidebar-body'), drawer: $('drawer'),
  newChat: $('new-chat'), historyNav: $('history-nav'), historyList: $('history-list'), historyEmpty: $('history-empty'),
  clearHistory: $('clear-history'), sideNote: $('side-note'), homeNoteMode: $('home-note-mode'),
  examplesBlock: $('examples-block'), examples: $('examples'), live: $('live'),
};

const desktop = window.matchMedia('(min-width: 900px)');

const state = {
  mode: 'home',
  demo: false,
  gen: 0,
  busy: false,
  locked: false,
  awaiting: false,
  turns: [],
  backend: [], // tối đa 3 lượt gần nhất gửi kèm để hiểu câu hỏi nối tiếp
  asked: new Set(),
  cache: new Map(), // kết quả đã xem trong phiên (chỉ ở bộ nhớ, không lưu localStorage)
  examples: [],
  sendTimes: [],
  active: null,
  confirmClear: null,
};

const announce = (text) => { ui.live.textContent = text; };
const smooth = () => (prefersReducedMotion() ? 'auto' : 'smooth');

// ---------- Icon tĩnh ----------
for (const n of document.querySelectorAll('[data-icon]')) {
  n.replaceWith(icon(n.dataset.icon, Number(n.dataset.size) || 16, Number(n.dataset.stroke) || 2));
}
for (const id of ['brand-mark', 'brand-mark-2']) $(id).appendChild(icon('home', id === 'brand-mark' ? 20 : 18));

// ---------- Ô nhập ----------
function autoGrow() {
  ui.input.style.height = 'auto';
  ui.input.style.height = `${Math.min(ui.input.scrollHeight, 140)}px`;
}

function setInput(text) {
  ui.input.value = text;
  updateCounter();
  autoGrow();
}

function updateCounter() {
  const n = ui.input.value.length;
  ui.counter.hidden = n < 240;
  ui.counter.textContent = `${n}/${MAX_Q}`;
}

function updatePlaceholder() {
  let text;
  if (state.awaiting) text = 'Trả lời câu hỏi trên…';
  else if (!desktop.matches) text = 'Hỏi về dữ liệu bất động sản…';
  else if (state.mode === 'home') text = 'Ví dụ: Tổng giá trị hợp đồng đã ký theo từng tỉnh, vẽ biểu đồ cột';
  else text = 'Ví dụ: Top 5 nhân viên có doanh thu cao nhất, vẽ biểu đồ cột';
  ui.input.placeholder = text;
}

function showFormMsg(text) {
  ui.formMsg.textContent = text;
}

function syncSubmit() {
  ui.submit.disabled = state.busy || state.locked;
  ui.submit.setAttribute('aria-busy', String(state.busy));
}

function placeComposer() {
  const inHome = state.mode === 'home' && desktop.matches;
  const target = inHome ? ui.homeSlot : ui.dock;
  if (ui.composerWrap.parentElement !== target) {
    const hadFocus = document.activeElement === ui.input;
    target.appendChild(ui.composerWrap);
    if (hadFocus) ui.input.focus();
  }
  ui.dock.hidden = inHome;
  ui.hint.hidden = inHome || !desktop.matches;
  ui.input.rows = inHome ? 2 : 1;
  ui.label.textContent = inHome ? 'Câu hỏi của bạn' : 'Câu hỏi của bạn (tiếng Việt)';
  updatePlaceholder();
  autoGrow();
}

ui.input.addEventListener('input', () => {
  updateCounter();
  autoGrow();
  if (ui.formMsg.textContent) showFormMsg('');
});

ui.input.addEventListener('keydown', (e) => {
  // Bỏ qua khi đang gõ tiếng Việt bằng bộ gõ (IME): Enter dùng để chốt chữ, không phải gửi.
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) {
    e.preventDefault();
    ui.form.requestSubmit();
  }
});

ui.form.addEventListener('submit', (e) => {
  e.preventDefault();
  submitQuestion(ui.input.value, true);
});

// ---------- Chế độ home / thread ----------
function updatePagehead() {
  ui.title.hidden = state.mode === 'home';
  ui.pagehead.hidden = !(state.mode === 'thread' || state.demo);
}

function setMode(mode) {
  state.mode = mode;
  ui.home.hidden = mode !== 'home';
  ui.thread.hidden = mode === 'home';
  ui.newChat.hidden = mode === 'home';
  updatePagehead();
  placeComposer();
}

desktop.addEventListener('change', () => {
  if (desktop.matches && ui.drawer.open) ui.drawer.close();
  placeComposer();
});

// ---------- Ngăn kéo (mobile) ----------
function openDrawer() {
  ui.drawer.appendChild(ui.sidebarBody);
  ui.drawer.showModal();
}
function closeDrawer() {
  if (ui.drawer.open) ui.drawer.close();
}
ui.drawer.addEventListener('close', () => {
  ui.sidebar.appendChild(ui.sidebarBody);
  $('open-drawer').focus({ preventScroll: true });
});
$('open-drawer').addEventListener('click', openDrawer);
$('close-drawer').addEventListener('click', closeDrawer);
ui.drawer.addEventListener('click', (e) => { if (e.target === ui.drawer) closeDrawer(); });

// ---------- Lịch sử ----------
function renderHistory() {
  const items = store.list();
  ui.historyList.replaceChildren(
    ...items.map((item) => {
      const btn = el('button', { type: 'button', class: 'hist-item', text: item.q, onclick: () => openHistory(item.q) });
      if (item.q === state.active) btn.setAttribute('aria-current', 'true');
      return el('li', {}, btn);
    }),
  );
  ui.historyNav.hidden = items.length === 0;
  ui.historyEmpty.hidden = items.length > 0;
}

ui.clearHistory.addEventListener('click', () => {
  if (state.confirmClear) {
    clearTimeout(state.confirmClear);
    state.confirmClear = null;
    ui.clearHistory.textContent = 'Xóa lịch sử';
    store.clear();
    renderHistory();
    announce('Đã xóa lịch sử câu hỏi');
    return;
  }
  ui.clearHistory.textContent = 'Bấm lần nữa để xóa';
  state.confirmClear = setTimeout(() => {
    state.confirmClear = null;
    ui.clearHistory.textContent = 'Xóa lịch sử';
  }, 3000);
});

// ---------- Hội thoại ----------
function addTurn(question) {
  const slot = el('div', { class: 'slot' });
  const node = el('div', { class: 'turn' }, el('div', { class: 'bubble', text: question }), slot);
  ui.thread.appendChild(node);
  const turn = { q: question, node, slot, loading: null, result: null, rate: null };
  state.turns.push(turn);
  return turn;
}

function clearSlot(turn) {
  if (turn.loading) turn.loading.stop();
  if (turn.result) turn.result.destroy();
  if (turn.rate) turn.rate.stop();
  turn.loading = turn.result = turn.rate = null;
  turn.slot.replaceChildren();
}

function removeFollowups() {
  for (const n of ui.thread.querySelectorAll('.followups')) n.remove();
}

function resetConversation() {
  state.gen += 1;
  for (const t of state.turns) clearSlot(t);
  state.turns = [];
  ui.thread.replaceChildren();
  state.backend = [];
  state.awaiting = false;
  state.active = null;
  state.busy = false;
  syncSubmit();
}

function newConversation() {
  closeDrawer();
  resetConversation();
  setMode('home');
  setInput('');
  showFormMsg('');
  renderHistory();
  window.scrollTo(0, 0);
  if (desktop.matches) ui.input.focus();
}

$('new-chat').addEventListener('click', newConversation);

function payloadHistory() {
  return state.backend.slice(-3).map((h) => ({
    question: h.question.slice(0, MAX_Q),
    sql: h.sql && h.sql.length <= 2000 ? h.sql : null,
    clarification: h.clarification ? h.clarification.slice(0, 500) : null,
  }));
}

function pushBackend(entry) {
  state.backend.push(entry);
  if (state.backend.length > 3) state.backend.shift();
}

// Ước lượng thời gian chờ khi bị 429 (server không trả số giây chính xác).
function estimateWait(res) {
  if (res.retryAfter) return Math.min(120, Math.max(1, Math.round(res.retryAfter)));
  if (state.sendTimes.length >= 10) {
    const oldest = state.sendTimes[state.sendTimes.length - 10];
    return Math.max(5, Math.ceil(60 - (Date.now() - oldest) / 1000));
  }
  return 60;
}

function lock(seconds) {
  state.locked = true;
  syncSubmit();
  setTimeout(() => {
    state.locked = false;
    syncSubmit();
    announce('Bạn có thể hỏi tiếp');
  }, seconds * 1000);
}

function pickSuggestion() {
  const fresh = state.examples.find((x) => !state.asked.has(x));
  return fresh || state.examples[0] || null;
}

function showSuccess(turn, data) {
  const result = buildResult(data);
  turn.result = result;
  turn.slot.appendChild(result.node);
  result.mount();
  state.asked.add(turn.q);
  store.add(turn.q);
  state.cache.delete(turn.q);
  state.cache.set(turn.q, data);
  if (state.cache.size > MAX_CACHE) state.cache.delete(state.cache.keys().next().value);
  pushBackend({ question: turn.q, sql: data.sql, clarification: data.clarification });
  state.active = turn.q;
  renderHistory();
  announce(`Đã có kết quả: ${data.row_count} dòng`);

  removeFollowups();
  const chips = suggest({ question: turn.q, data, examples: state.examples, asked: state.asked });
  if (chips.length) {
    turn.node.appendChild(
      el('div', { class: 'followups', 'data-kind': 'followups' }, el('span', { class: 'followups-label', text: 'Gợi ý tiếp:' }), ...chips.map((c) => el('button', { type: 'button', class: 'chip followup', text: c.label, onclick: () => submitQuestion(c.question, false) }))),
    );
  }
}

function render(turn, res) {
  if (!res.ok) {
    if (res.code === 'OUT_OF_SCOPE') {
      turn.slot.appendChild(scopeCard(res.message, pickSuggestion(), (q) => submitQuestion(q, false)));
      announce('Không thể thực hiện yêu cầu này');
    } else if (res.code === 'RATE_LIMITED') {
      const seconds = estimateWait(res);
      turn.rate = rateCard();
      turn.slot.appendChild(turn.rate.node);
      turn.rate.start(seconds);
      lock(seconds);
      setInput(turn.q);
      announce('Bạn hỏi hơi nhanh, vui lòng chờ');
    } else {
      turn.slot.appendChild(errorCard(res, { onRetry: () => runTurn(turn), onEdit: () => { setInput(turn.q); ui.input.focus(); } }));
    }
    return;
  }
  const data = res.data;
  if (data.clarification && !data.sql) {
    turn.slot.appendChild(clarifyCard(data.clarification));
    pushBackend({ question: turn.q, sql: null, clarification: data.clarification });
    state.awaiting = true;
    updatePlaceholder();
    announce('Cần làm rõ thêm');
    ui.input.focus();
    return;
  }
  if (!data.sql) {
    turn.slot.appendChild(plainCard('Chưa có câu trả lời', data.explanation || 'Hệ thống chưa trả lời được câu hỏi này.'));
    return;
  }
  showSuccess(turn, data);
}

async function runTurn(turn) {
  const gen = state.gen;
  clearSlot(turn);
  const loading = createLoading();
  turn.loading = loading;
  turn.slot.appendChild(loading.node);
  state.busy = true;
  syncSubmit();
  announce('Đang xử lý câu hỏi');
  state.sendTimes.push(Date.now());
  if (state.sendTimes.length > 10) state.sendTimes.shift();
  const res = await askQuestion(turn.q, payloadHistory());
  if (gen !== state.gen) return; // đã bấm "Câu hỏi mới" trong lúc chờ
  loading.stop();
  turn.loading = null;
  turn.slot.replaceChildren();
  state.busy = false;
  syncSubmit();
  render(turn, res);
}

function submitQuestion(raw, fromInput) {
  if (state.busy || state.locked) return;
  const q = raw.trim();
  if (!q) {
    showFormMsg('Hãy nhập câu hỏi trước khi gửi.');
    ui.input.focus();
    return;
  }
  if (q.length > MAX_Q) {
    showFormMsg(`Câu hỏi tối đa ${MAX_Q} ký tự.`);
    return;
  }
  showFormMsg('');
  if (state.mode === 'home') setMode('thread');
  if (state.awaiting) {
    state.awaiting = false;
    updatePlaceholder();
  }
  if (fromInput) setInput('');
  closeDrawer();
  removeFollowups();
  const turn = addTurn(q);
  state.asked.add(q);
  turn.node.scrollIntoView({ block: 'start', behavior: smooth() });
  runTurn(turn);
}

function openHistory(q) {
  closeDrawer();
  if (state.busy) return;
  resetConversation();
  setMode('thread');
  const turn = addTurn(q);
  const cached = state.cache.get(q);
  window.scrollTo(0, 0);
  if (cached) {
    showSuccess(turn, cached);
  } else if (!state.locked) {
    runTurn(turn);
  } else {
    turn.slot.appendChild(plainCard('Hãy chờ một chút', 'Hệ thống đang giới hạn số câu hỏi. Vui lòng chờ rồi bấm lại.'));
  }
}

// ---------- Ví dụ ở trang chủ ----------
function exampleTag(text) {
  return /biểu đồ/i.test(text) ? 'Có biểu đồ' : 'Bảng kết quả';
}

getExamples().then((res) => {
  if (!res.ok || !Array.isArray(res.data.examples)) return;
  state.examples = res.data.examples.filter((x) => typeof x === 'string');
  if (!state.examples.length) return;
  ui.examples.replaceChildren(
    ...state.examples.slice(0, 6).map((text) =>
      el('button', { type: 'button', class: 'chip example-card', onclick: () => submitQuestion(text, false) }, el('span', { class: 'ex-title', text }), el('span', { class: 'ex-tag', text: exampleTag(text) })),
    ),
  );
  ui.examplesBlock.hidden = false;
});

// ---------- Huy hiệu chế độ (đọc /health) ----------
function applyMode(demo) {
  state.demo = demo;
  document.body.classList.toggle('is-demo', demo);
  ui.badge.classList.toggle('demo', demo);
  ui.badgeText.textContent = demo ? 'Chế độ demo · dữ liệu giả lập' : 'Chỉ đọc · Không thể sửa dữ liệu';
  ui.badge.hidden = false;
  ui.sideNote.textContent = demo ? 'Dữ liệu giả lập (chế độ demo)' : 'Kết nối chỉ đọc';
  ui.sideNote.hidden = false;
  ui.homeNoteMode.textContent = demo ? ' Đang ở chế độ demo: dữ liệu và AI là giả lập.' : ' Hệ thống chỉ đọc, không thể sửa hay xóa dữ liệu.';
  updatePagehead();
}

getHealth().then((res) => applyMode(res.ok && res.data.demo === true));

// ---------- Hộp thoại cấu trúc dữ liệu ----------
const schema = setupSchemaDialog({ dialog: $('schema-dialog'), body: $('schema-body'), closeButton: $('close-schema') });
$('open-schema').addEventListener('click', (e) => {
  const fromDrawer = ui.drawer.open;
  const trigger = fromDrawer ? $('open-drawer') : e.currentTarget;
  closeDrawer();
  schema.open(trigger);
});

// ---------- Khởi động ----------
renderHistory();
setMode('home');
