// Xuất CSV: BOM cho Excel, \r\n, bao nháy kép khi cần, chống CSV injection cho ô chuỗi.

function cell(value, type) {
  if (value === null || value === undefined) return '';
  let text;
  if (typeof value === 'number') text = String(value); // số xuất thô
  else if (typeof value === 'boolean') text = value ? 'true' : 'false';
  else text = String(value);
  if (type === 'string' && typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function headerCell(name) {
  let text = String(name);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildCsv(columns, rows) {
  const lines = [columns.map((c) => headerCell(c.name)).join(',')];
  for (const row of rows) lines.push(row.map((v, i) => cell(v, columns[i].type)).join(','));
  return `﻿${lines.join('\r\n')}\r\n`;
}

export function csvFileName(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  const stamp = `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}`;
  return `ket-qua-${stamp}.csv`;
}

export function downloadCsv(columns, rows) {
  const blob = new Blob([buildCsv(columns, rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = csvFileName();
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
