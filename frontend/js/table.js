const nf = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });

export function formatValue(value, type) {
  if (value === null || value === undefined) return '—';
  if (type === 'number' && typeof value === 'number') return nf.format(value);
  if (type === 'boolean') return value ? 'Có' : 'Không';
  return String(value);
}

// Dựng bảng bằng textContent để dữ liệu không bao giờ được hiểu là HTML.
export function renderTable(columns, rows) {
  const wrap = document.createElement('div');
  wrap.className = 'tablewrap';
  const table = document.createElement('table');
  const head = table.createTHead().insertRow();
  for (const col of columns) {
    const th = document.createElement('th');
    th.textContent = col.name;
    if (col.type === 'number') th.className = 'num';
    head.appendChild(th);
  }
  const body = table.createTBody();
  for (const row of rows) {
    const tr = body.insertRow();
    row.forEach((value, i) => {
      const td = tr.insertCell();
      td.textContent = formatValue(value, columns[i].type);
      if (columns[i].type === 'number') td.className = 'num';
    });
  }
  wrap.appendChild(table);
  return wrap;
}
