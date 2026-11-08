const PALETTE = ['#2a6fdb', '#e8833a', '#2fa37a', '#c5476b', '#8a63d2', '#d4a72c', '#3aa6c4', '#7a8794'];
const nf = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });

// Rút gọn số tiền lớn: 1,5 tỷ / 250 triệu.
export function shortNumber(v) {
  const a = Math.abs(v);
  if (a >= 1e9) return `${nf.format(v / 1e9)} tỷ`;
  if (a >= 1e6) return `${nf.format(v / 1e6)} triệu`;
  return nf.format(v);
}

function color(i) {
  return PALETTE[i % PALETTE.length];
}

export function renderChart(canvas, spec) {
  const pie = spec.type === 'pie' || spec.type === 'doughnut';
  const horizontal = spec.type === 'hbar';
  const type = { hbar: 'bar', grouped_bar: 'bar' }[spec.type] || spec.type;
  const datasets = spec.datasets.map((d, i) => ({
    label: d.label,
    data: d.data,
    backgroundColor: pie ? spec.labels.map((_, j) => color(j)) : color(i),
    borderColor: spec.type === 'line' || spec.type === 'scatter' ? color(i) : undefined,
    tension: 0.25,
  }));
  const valueAxis = { ticks: { callback: (v) => shortNumber(Number(v)) }, title: { display: true, text: spec.y_label } };
  const labelAxis = { title: { display: true, text: spec.x_label } };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: horizontal ? 'y' : 'x',
    plugins: {
      title: { display: true, text: spec.title },
      legend: { display: pie || spec.datasets.length > 1 },
      tooltip: { callbacks: { label: (c) => `${c.dataset.label || c.label}: ${nf.format(c.parsed.y ?? c.parsed.x ?? c.parsed)}` } },
    },
  };
  if (!pie) {
    options.scales = horizontal ? { x: valueAxis, y: labelAxis } : { x: labelAxis, y: valueAxis };
  }
  return new Chart(canvas, { type, data: { labels: spec.labels, datasets }, options });
}
