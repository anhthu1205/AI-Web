// Thẻ kết quả: tóm tắt, 3 tab (Biểu đồ / Bảng / SQL), hành động Sao chép SQL / Tải CSV.
import { el, icon } from './dom.js';
import { formatDuration } from './format.js';
import { renderTable } from './table.js';
import { renderChart, describeChart, highestCaption, chartHeight } from './chart.js';
import { downloadCsv } from './csv.js';

const KEYWORDS = new Set(
  ('SELECT FROM WHERE GROUP BY ORDER LIMIT OFFSET AS COUNT SUM AVG MIN MAX DESC ASC AND OR NOT IN IS NULL LIKE ILIKE BETWEEN CASE WHEN THEN ELSE END HAVING DISTINCT JOIN LEFT RIGHT INNER OUTER ON UNION WITH OVER PARTITION CAST ROUND COALESCE NULLIF FILTER INTERVAL EXTRACT DATE_TRUNC TO_CHAR TRUE FALSE').split(' '),
);

// Tô từ khóa SQL bằng createElement + textContent.
export function highlightSql(sql) {
  const frag = document.createDocumentFragment();
  let buffer = '';
  const flush = () => {
    if (buffer) frag.appendChild(document.createTextNode(buffer));
    buffer = '';
  };
  for (const part of sql.split(/('(?:[^']|'')*'|[A-Za-z_][A-Za-z_0-9]*)/g)) {
    if (!part) continue;
    if (KEYWORDS.has(part.toUpperCase())) {
      flush();
      frag.appendChild(el('span', { class: 'kw', text: part }));
    } else {
      buffer += part;
    }
  }
  flush();
  return frag;
}

async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* thử cách dự phòng */
  }
  const area = el('textarea', { 'aria-hidden': 'true', tabindex: '-1', readonly: true });
  area.value = text;
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}

let uid = 0;

function sqlPanel(sql, truncated, shown) {
  const note = truncated
    ? `Chỉ cho phép câu lệnh SELECT trên bảng sales_clean. Hệ thống tự giới hạn số dòng (đang hiển thị ${shown} dòng đầu).`
    : 'Chỉ cho phép câu lệnh SELECT trên bảng sales_clean. Hệ thống tự giới hạn số dòng.';
  return el(
    'div',
    { class: 'sqlbox' },
    el('pre', { tabindex: 0, 'aria-label': 'Câu lệnh SQL' }, el('code', {}, highlightSql(sql))),
    el('p', { class: 'note', text: note }),
  );
}

// ctx.onShowSql không cần: tab SQL nằm trong cùng thẻ.
export function buildResult(data) {
  const id = ++uid;
  const charts = [];
  let destroyed = false;
  const hasChart = Boolean(data.chart);
  const empty = data.row_count === 0 || data.rows.length === 0;

  const meta = [`${data.row_count} dòng`, formatDuration(data.elapsed_ms)].join(' · ');
  const head = el('div', { class: 'card-head' });
  if (data.explanation) head.appendChild(el('p', { class: 'explain', text: data.explanation }));
  head.appendChild(el('p', { class: 'card-meta', text: meta }));

  const card = el('section', { class: 'card', 'aria-label': 'Kết quả', 'data-kind': empty ? 'empty' : 'result', tabindex: -1 }, head);
  if (data.truncated) {
    card.appendChild(el('p', { class: 'card-note', text: `Chỉ hiển thị ${data.rows.length} dòng đầu.` }));
  }
  if (data.chart_requested && !data.chart && data.chart_message) {
    card.appendChild(el('p', { class: 'card-note', 'data-kind': 'chart-message', text: data.chart_message }));
  }

  const actions = el('div', { class: 'actions' });
  const status = el('span', { class: 'action-status', role: 'status', 'aria-live': 'polite' });
  let flashTimer = null;
  const flash = (text) => {
    status.textContent = text;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => { status.textContent = ''; }, 2000);
  };

  if (data.sql) {
    actions.appendChild(
      el('button', {
        type: 'button',
        class: 'btn-action',
        'data-action': 'copy-sql',
        onclick: async () => flash((await copyText(data.sql)) ? 'Đã sao chép' : 'Không sao chép được'),
      }, icon('copy', 16), 'Sao chép SQL'),
    );
  }
  if (!empty) {
    actions.appendChild(
      el('button', { type: 'button', class: 'btn-action', 'data-action': 'csv', onclick: () => downloadCsv(data.columns, data.rows) }, icon('download', 16), 'Tải CSV'),
    );
    if (data.truncated) actions.appendChild(el('span', { class: 'action-status', text: `CSV gồm ${data.rows.length} dòng đầu` }));
  }
  actions.appendChild(status);

  let mount = () => {};

  if (empty) {
    // Không có dòng nào: thẻ trạng thái trung tính, SQL mở bằng nút.
    const sqlWrap = el('div', { class: 'panel', hidden: true, id: `sqlp-${id}` }, data.sql ? sqlPanel(data.sql, false, 0) : null);
    const toggle = el('button', {
      type: 'button',
      class: 'link-btn',
      'aria-expanded': 'false',
      'aria-controls': `sqlp-${id}`,
      text: 'Xem câu SQL đã chạy',
      onclick: () => {
        const open = sqlWrap.hidden;
        sqlWrap.hidden = !open;
        toggle.setAttribute('aria-expanded', String(open));
      },
    });
    const body = el(
      'div',
      { class: 'panel empty-body', 'data-kind': 'empty-body' },
      el(
        'div',
        { class: 'state-head tone-neutral' },
        el('span', { class: 'state-icon', 'aria-hidden': 'true' }, icon('search', 18, 2.2)),
        el('h2', { text: 'Không có dòng nào phù hợp' }),
      ),
      el('p', { class: 'state-hint', text: 'Truy vấn chạy thành công nhưng không tìm thấy dữ liệu khớp điều kiện. Thử nới điều kiện hoặc đổi khoảng thời gian.' }),
      data.sql ? toggle : null,
    );
    card.append(body, sqlWrap, actions);
    return { node: card, mount, destroy: () => {} };
  }

  // Các tab
  const tabs = [];
  if (hasChart) tabs.push({ key: 'chart', label: 'Biểu đồ' });
  tabs.push({ key: 'table', label: 'Bảng' });
  if (data.sql) tabs.push({ key: 'sql', label: 'SQL' });

  const tablist = el('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Cách xem kết quả' });
  const panels = {};
  const tabEls = {};

  if (hasChart) {
    const spec = data.chart;
    const caption = highestCaption(spec);
    const box = el('div', { class: 'chartbox' });
    const canvas = el('canvas', { role: 'img', 'aria-label': describeChart(spec) });
    box.appendChild(canvas);
    box.style.height = `${chartHeight(spec, window.innerWidth <= 560)}px`;
    panels.chart = el(
      'div',
      { class: 'panel', 'data-panel': 'chart' },
      el('div', { class: 'panel-chart-head' }, el('h2', { text: spec.title }), caption ? el('span', { class: 'chart-caption', text: caption }) : null),
      box,
    );
    panels.chart._draw = () => {
      if (charts.length || destroyed) return;
      const draw = () => {
        if (destroyed || charts.length) return;
        charts.push(renderChart(canvas, spec));
      };
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw, draw);
      else draw();
    };
  }
  panels.table = el('div', { 'data-panel': 'table' }, renderTable(data.columns, data.rows));
  if (data.sql) panels.sql = el('div', { class: 'panel', 'data-panel': 'sql' }, sqlPanel(data.sql, data.truncated, data.rows.length));

  const select = (key, focus) => {
    for (const t of tabs) {
      const on = t.key === key;
      tabEls[t.key].setAttribute('aria-selected', String(on));
      tabEls[t.key].tabIndex = on ? 0 : -1;
      panels[t.key].hidden = !on;
    }
    if (key === 'chart') {
      if (panels.chart._draw) panels.chart._draw();
      if (charts[0]) charts[0].resize();
    }
    if (focus) tabEls[key].focus();
  };

  tabs.forEach((t, i) => {
    const tab = el('button', { type: 'button', class: 'tab', role: 'tab', id: `tab-${id}-${t.key}`, 'aria-controls': `panel-${id}-${t.key}`, 'aria-selected': 'false', tabindex: -1, text: t.label, onclick: () => select(t.key, false) });
    tab.addEventListener('keydown', (e) => {
      let next = null;
      if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
      else if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = tabs.length - 1;
      if (next === null) return;
      e.preventDefault();
      select(tabs[next].key, true);
    });
    tabEls[t.key] = tab;
    tablist.appendChild(tab);
    const panel = panels[t.key];
    panel.setAttribute('role', 'tabpanel');
    panel.id = `panel-${id}-${t.key}`;
    panel.setAttribute('aria-labelledby', tab.id);
    panel.hidden = true;
    if (t.key !== 'table') panel.tabIndex = 0;
  });

  card.append(tablist, ...tabs.map((t) => panels[t.key]), actions);
  mount = () => select(tabs[0].key, false);
  return {
    node: card,
    mount,
    destroy() {
      destroyed = true;
      clearTimeout(flashTimer);
      for (const c of charts.splice(0)) c.destroy();
    },
  };
}
