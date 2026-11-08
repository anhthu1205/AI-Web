import { askQuestion, getExamples } from './api.js';
import { renderChart } from './chart.js';
import { renderTable } from './table.js';

const form = document.getElementById('ask');
const input = document.getElementById('question');
const submit = document.getElementById('submit');
const statusEl = document.getElementById('status');
const results = document.getElementById('results');
const counter = document.getElementById('counter');
const examplesEl = document.getElementById('examples');

const history = []; // tối đa 3 lượt gần nhất gửi kèm để hiểu câu hỏi nối tiếp

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function setStatus(kind, text) {
  statusEl.replaceChildren();
  if (!text) return;
  const cls = kind === 'loading' ? 'loading' : `banner ${kind}`;
  statusEl.appendChild(el('div', cls, text));
}

function buildCard(question, data) {
  const card = el('article', 'card');
  card.appendChild(el('h3', '', question));
  if (data.explanation) card.appendChild(el('p', 'explain', data.explanation));
  if (data.clarification) card.appendChild(el('div', 'banner info', data.clarification));
  if (data.sql) {
    const details = el('details');
    details.appendChild(el('summary', '', 'Xem câu SQL'));
    details.appendChild(el('pre', '', data.sql));
    card.appendChild(details);
    card.appendChild(renderTable(data.columns, data.rows));
    let meta = `${data.row_count} dòng · ${data.elapsed_ms} ms`;
    if (data.truncated) meta += ' · đã giới hạn số dòng hiển thị';
    card.appendChild(el('div', 'meta', meta));
  }
  if (data.chart) {
    const box = el('div', 'chartbox');
    const canvas = document.createElement('canvas');
    box.appendChild(canvas);
    card.appendChild(box);
    renderChart(canvas, data.chart);
  } else if (data.chart_requested && data.chart_message) {
    card.appendChild(el('div', 'banner info', data.chart_message));
  }
  return card;
}

async function ask(question) {
  submit.disabled = true;
  setStatus('loading', 'Đang phân tích câu hỏi và truy vấn dữ liệu...');
  const res = await askQuestion(question, history.slice(-3));
  submit.disabled = false;
  if (!res.ok) {
    setStatus(res.code === 'OUT_OF_SCOPE' ? 'info' : 'err', res.message);
    return;
  }
  setStatus('', '');
  results.prepend(buildCard(question, res.data));
  history.push({ question, sql: res.data.sql, clarification: res.data.clarification });
  if (history.length > 3) history.shift();
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const q = input.value.trim();
  if (!q || submit.disabled) return;
  input.value = '';
  counter.textContent = '0/300';
  ask(q);
});

input.addEventListener('input', () => {
  counter.textContent = `${input.value.length}/300`;
});

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    form.requestSubmit();
  }
});

getExamples().then((res) => {
  if (!res.ok) return;
  for (const text of res.data.examples) {
    const chip = el('button', 'chip', text);
    chip.type = 'button';
    chip.addEventListener('click', () => {
      input.value = text;
      counter.textContent = `${text.length}/300`;
      input.focus();
    });
    examplesEl.appendChild(chip);
  }
});
