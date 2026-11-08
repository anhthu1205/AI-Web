import { API_BASE } from './config.js';

const TIMEOUT_MS = 45000;

async function request(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(API_BASE + path, { ...options, signal: controller.signal });
  } catch (err) {
    clearTimeout(timer);
    const timedOut = err && err.name === 'AbortError';
    return {
      ok: false,
      code: 'NETWORK',
      message: timedOut ? 'Yêu cầu quá lâu. Vui lòng thử lại.' : 'Không kết nối được máy chủ. Vui lòng thử lại.',
    };
  }
  clearTimeout(timer);
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* thân không phải JSON */
  }
  if (body && body.error) {
    const retry = Number(res.headers.get('Retry-After'));
    return {
      ok: false,
      code: body.error.code,
      message: body.error.message,
      status: res.status,
      retryAfter: Number.isFinite(retry) && retry > 0 ? retry : null,
    };
  }
  if (!res.ok || !body) {
    return { ok: false, code: 'HTTP', message: `Lỗi máy chủ (${res.status}).`, status: res.status };
  }
  return { ok: true, data: body };
}

export function askQuestion(question, history) {
  return request('/api/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, history }),
  });
}

export const getExamples = () => request('/api/examples');
export const getSchema = () => request('/api/schema');
export const getHealth = () => request('/health');
