import { API_BASE } from './config.js';

async function request(path, options) {
  let res;
  try {
    res = await fetch(API_BASE + path, options);
  } catch {
    return { ok: false, code: 'NETWORK', message: 'Không kết nối được máy chủ. Vui lòng thử lại.' };
  }
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* thân không phải JSON */
  }
  if (body && body.error) {
    return { ok: false, code: body.error.code, message: body.error.message, status: res.status };
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

export function getExamples() {
  return request('/api/examples');
}
