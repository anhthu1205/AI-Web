// Vẽ biểu đồ bằng Chart.js (đã vendor), màu lấy từ biến CSS (tokens.css); hằng dự phòng chỉ dùng khi không đọc được.
import { nf, shortNumber } from './format.js';
import { prefersReducedMotion } from './dom.js';

const FALLBACK = {
  '--primary': '#0E5A4B',
  '--accent': '#B45309',
  '--text': '#17231F',
  '--muted': '#5B6862',
  '--line-soft': '#EFEBE2',
  '--surface': '#FFFFFF',
  '--series-1': '#0E5A4B',
  '--series-2': '#B45309',
  '--series-3': '#2F7D9A',
  '--series-4': '#7A5C9E',
  '--series-5': '#6B7A1E',
  '--series-6': '#B0405A',
  '--series-7': '#5B6862',
  '--series-8': '#3B6EA5',
  '--font-sans': "'Be Vietnam Pro', system-ui, sans-serif",
};

function token(name) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || FALLBACK[name];
}

const TYPE_NAME = {
  bar: 'cột',
  hbar: 'thanh ngang',
  line: 'đường',
  pie: 'tròn',
  doughnut: 'vành khuyên',
  scatter: 'phân tán',
  grouped_bar: 'cột nhóm',
};

export function palette() {
  return [1, 2, 3, 4, 5, 6, 7, 8].map((i) => token(`--series-${i}`));
}

// Chỉ số của giá trị lớn nhất (đầu tiên nếu đồng hạng); -1 nếu không có số.
export function maxIndex(values) {
  let best = -1;
  values.forEach((v, i) => {
    if (typeof v === 'number' && Number.isFinite(v) && (best < 0 || v > values[best])) best = i;
  });
  return best;
}

// Dòng chú thích "Cao nhất: X (v)" (null nếu không áp dụng, ví dụ biểu đồ phân tán).
export function highestCaption(spec) {
  if (!spec.datasets.length || !spec.labels.length) return null;
  const data = spec.datasets[0].data;
  const i = maxIndex(data);
  if (i < 0 || spec.labels[i] === undefined) return null;
  return `Cao nhất: ${spec.labels[i]} (${nf.format(data[i])})`;
}

export function describeChart(spec) {
  const kind = TYPE_NAME[spec.type] || spec.type;
  const groups = spec.labels.length ? `, ${spec.labels.length} nhóm` : '';
  const top = highestCaption(spec);
  return `Biểu đồ ${kind}: ${spec.title}${groups}${top ? `, ${top.charAt(0).toLowerCase()}${top.slice(1)}` : ''}`;
}

export function chartHeight(spec, narrow) {
  if (spec.type === 'hbar') return Math.max(240, spec.labels.length * 36 + 56);
  return narrow ? 280 : 340;
}

// Nhãn giá trị ở cuối thanh (plugin nhỏ, không thêm thư viện).
const valueLabels = {
  id: 'valueLabels',
  afterDatasetsDraw(chart, _args, opts) {
    if (!opts || !opts.enabled) return;
    const { ctx } = chart;
    const meta = chart.getDatasetMeta(0);
    const data = chart.data.datasets[0].data;
    ctx.save();
    ctx.font = `600 12px ${opts.font}`;
    ctx.fillStyle = opts.color;
    ctx.textBaseline = 'middle';
    meta.data.forEach((bar, i) => {
      const v = data[i];
      if (typeof v !== 'number') return;
      const text = shortNumber(v);
      if (opts.horizontal) {
        ctx.textAlign = 'left';
        ctx.fillText(text, bar.x + 6, bar.y);
      } else {
        ctx.textAlign = 'center';
        ctx.fillText(text, bar.x, bar.y - 10);
      }
    });
    ctx.restore();
  },
};

export function renderChart(canvas, spec) {
  const narrow = window.innerWidth <= 480;
  const colors = palette();
  const primary = token('--primary');
  const accent = token('--accent');
  const text = token('--text');
  const grid = token('--line-soft');
  const font = token('--font-sans');
  const pie = spec.type === 'pie' || spec.type === 'doughnut';
  const horizontal = spec.type === 'hbar';
  const barLike = spec.type === 'bar' || horizontal;
  const multi = spec.datasets.length > 1;
  const type = { hbar: 'bar', grouped_bar: 'bar' }[spec.type] || spec.type;

  const datasets = spec.datasets.map((d, i) => {
    const base = { label: d.label, data: d.data };
    if (pie) {
      return { ...base, backgroundColor: spec.labels.map((_, j) => colors[j % colors.length]), borderColor: token('--surface'), borderWidth: 2 };
    }
    if (spec.type === 'line') {
      const c = multi ? colors[i % colors.length] : primary;
      return { ...base, borderColor: c, backgroundColor: c, borderWidth: 2.5, pointRadius: 3, tension: 0.25, fill: false };
    }
    if (spec.type === 'scatter') {
      return { ...base, backgroundColor: `${primary}B3`, borderColor: primary, pointRadius: 4 };
    }
    if (barLike && !multi) {
      const top = maxIndex(d.data);
      return { ...base, backgroundColor: d.data.map((_, j) => (j === top ? accent : primary)), borderRadius: 6, borderSkipped: false, maxBarThickness: horizontal ? (narrow ? 18 : 28) : 56 };
    }
    return { ...base, backgroundColor: colors[i % colors.length], borderRadius: 6, borderSkipped: false };
  });

  const labelTick = {
    color: text,
    callback(value) {
      const label = this.getLabelForValue ? this.getLabelForValue(value) : value;
      return narrow && typeof label === 'string' && label.length > 16 ? `${label.slice(0, 16)}…` : label;
    },
  };
  const valueTick = { color: token('--muted'), callback: (v) => shortNumber(Number(v)) };
  const axisTitle = (t) => ({ display: Boolean(t), text: t, color: token('--muted') });
  const withTitle = spec.type === 'line' || spec.type === 'grouped_bar'; // đơn vị trục giá trị; thanh đơn đã có tiêu đề thẻ
  const labelAxis = { grid: { display: false }, border: { display: false }, ticks: labelTick, title: axisTitle('') };
  const valueAxis = { grid: { color: grid }, border: { display: false }, ticks: valueTick, title: axisTitle(withTitle ? spec.y_label : '') };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: prefersReducedMotion() ? false : undefined,
    indexAxis: horizontal ? 'y' : 'x',
    layout: { padding: { top: barLike && !horizontal ? 22 : 4, right: horizontal ? 56 : 8 } },
    plugins: {
      title: { display: false },
      legend: {
        display: pie || multi,
        position: pie ? (narrow || window.innerWidth < 640 ? 'bottom' : 'right') : 'top',
        labels: { color: text, usePointStyle: true, boxWidth: 8, font: { family: font } },
      },
      valueLabels: { enabled: barLike && !multi, horizontal, color: text, font },
      tooltip: {
        callbacks: {
          title: (items) => (items.length && items[0].label !== undefined ? String(items[0].label) : ''),
          label(c) {
            const raw = c.parsed.y ?? c.parsed.x ?? c.parsed;
            if (pie) {
              const sum = c.dataset.data.reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
              const pct = sum > 0 ? ` (${nf.format((c.parsed / sum) * 100)}%)` : '';
              return `${c.label}: ${nf.format(c.parsed)}${pct}`;
            }
            if (spec.type === 'scatter') return `${spec.x_label || 'x'}: ${nf.format(c.parsed.x)}, ${spec.y_label || 'y'}: ${nf.format(c.parsed.y)}`;
            return `${c.dataset.label || ''}: ${nf.format(raw)}`;
          },
        },
      },
    },
  };
  if (pie) {
    if (spec.type === 'doughnut') options.cutout = '60%';
  } else if (spec.type === 'scatter') {
    options.scales = {
      x: { grid: { color: grid }, border: { display: false }, ticks: valueTick, title: axisTitle(spec.x_label) },
      y: { grid: { color: grid }, border: { display: false }, ticks: valueTick, title: axisTitle(spec.y_label) },
    };
  } else {
    options.scales = horizontal ? { x: valueAxis, y: labelAxis } : { x: labelAxis, y: valueAxis };
  }

  Chart.defaults.font.family = font;
  Chart.defaults.color = text;
  return new Chart(canvas, { type, data: { labels: spec.labels, datasets }, options, plugins: [valueLabels] });
}

