// "Gợi ý tiếp": quy tắc phía client + danh sách /api/examples. Không gọi LLM, không gọi mạng.
import { normalize } from './format.js';

const MAX_Q = 300;
const MAX_CHIPS = 3;

const CHART_WORDS = /(?:vẽ\s+|ve\s+)?(?:biểu\s*đồ|bieu\s*do)(?:\s+(?:cột|cot|đường|duong|tròn|tron|ngang|phân tán|phan tan))?/gi;

// Bỏ cụm "vẽ biểu đồ ..." khỏi câu hỏi gốc để ghép loại biểu đồ khác.
export function stripChartWords(question) {
  const text = question
    .replace(CHART_WORDS, ' ')
    .replace(/\s+,/g, ',')
    .replace(/[\s,;.]+$/g, '')
    .replace(/^[\s,;.]+/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return text || question.trim();
}

function withChart(question, suffix) {
  const tail = `, ${suffix}`;
  let base = stripChartWords(question);
  if (base.length + tail.length > MAX_Q) base = base.slice(base.length - (MAX_Q - tail.length));
  return `${base}${tail}`;
}

const TIME_NAME = /(^|_)(thang|ngay|nam|quy|tuan)($|_)/;

export function suggest({ question, data, examples, asked }) {
  const out = [];
  const cols = data.columns || [];
  const rows = data.rows || [];
  const nums = cols.map((c, i) => (c.type === 'number' ? i : -1)).filter((i) => i >= 0);
  const cats = cols.map((c, i) => (c.type !== 'number' ? i : -1)).filter((i) => i >= 0);
  const chartType = data.chart ? data.chart.type : null;
  const hasTime = cats.some((i) => cols[i].type === 'date' || TIME_NAME.test(normalize(cols[i].name)));
  const oneByOne = cats.length === 1 && nums.length === 1 && rows.length > 0;

  if (oneByOne && !hasTime && rows.length <= 8 && chartType !== 'pie' && chartType !== 'doughnut') {
    const nonNegative = rows.every((r) => typeof r[nums[0]] === 'number' && r[nums[0]] >= 0);
    if (nonNegative) out.push({ label: 'Vẽ biểu đồ tròn', question: withChart(question, 'vẽ biểu đồ tròn') });
  }
  if (hasTime && chartType !== 'line' && cats.length >= 1 && nums.length >= 1) {
    out.push({ label: 'Vẽ biểu đồ đường', question: withChart(question, 'vẽ biểu đồ đường') });
  } else if (oneByOne && !data.chart && !hasTime) {
    out.push({ label: 'Vẽ biểu đồ cột', question: withChart(question, 'vẽ biểu đồ cột') });
  }

  const seen = new Set([...asked].map(normalize));
  for (const ex of examples) {
    if (out.length >= MAX_CHIPS) break;
    if (seen.has(normalize(ex)) || out.some((o) => normalize(o.question) === normalize(ex))) continue;
    out.push({ label: ex, question: ex });
  }
  return out.slice(0, MAX_CHIPS);
}
