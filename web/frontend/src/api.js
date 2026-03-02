// 本地开发走 Vite 代理 /api；Vercel 部署时设置 VITE_API_URL 为后端地址（可带或不带 /api，这里会统一成带 /api）
const rawBase = import.meta.env.VITE_API_URL || '/api';
const API_BASE =
  rawBase.startsWith('http') && !rawBase.replace(/\/$/, '').endsWith('/api')
    ? rawBase.replace(/\/$/, '') + '/api'
    : rawBase;

function getToken() {
  return localStorage.getItem('artdou_token') || '';
}

function setToken(token) {
  if (token) localStorage.setItem('artdou_token', token);
  else localStorage.removeItem('artdou_token');
}

function headers(extra = {}) {
  const t = getToken();
  return { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}), ...extra };
}

/** 请求并解析 JSON；若返回 HTML（如 404/未配置后端）则抛明确错误，避免 "Unexpected token '<'" */
async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const text = await res.text();
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    try {
      return text ? JSON.parse(text) : {};
    } catch (e) {
      throw new Error('接口返回数据异常，请稍后重试');
    }
  }
  if (text.trim().startsWith('<')) {
    const host = (() => { try { return new URL(url).origin; } catch { return url.slice(0, 50); } })();
    throw new Error(`接口返回了网页而非数据。当前请求地址: ${host} —— 若为 kunlunfo.com 请在该站点对应的 Vercel 项目中配置 VITE_API_URL 并重新部署；若为 Railway 域名请检查后端是否正常。`);
  }
  throw new Error(res.status ? `请求失败 ${res.status}` : '网络异常');
}

export async function authInit() {
  return fetchJson(`${API_BASE}/auth/init`, { headers: headers() });
}

export async function authLogin(password) {
  const data = await fetchJson(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ password }),
  });
  if (data.success && data.token) setToken(data.token);
  return data;
}

export async function authBind(phone) {
  const data = await fetchJson(`${API_BASE}/auth/bind`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ phone }),
  });
  if (data.success && data.token) setToken(data.token);
  return data;
}

export function logout() {
  setToken('');
}

export async function dataGet(collection, id = 'all', query = {}) {
  const q = new URLSearchParams(query).toString();
  const path = id ? `${API_BASE}/data/${collection}/${id}` : `${API_BASE}/data/${collection}`;
  const url = q ? `${path}?${q}` : path;
  return fetchJson(url, { headers: headers() });
}

export async function dataAdd(collection, data) {
  return fetchJson(`${API_BASE}/data/${collection}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(data),
  });
}

export async function dataUpdate(collection, id, data) {
  return fetchJson(`${API_BASE}/data/${collection}/${id}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(data),
  });
}

export async function dataDelete(collection, id) {
  return fetchJson(`${API_BASE}/data/${collection}/${id}`, { method: 'DELETE', headers: headers() });
}

export async function dataIncrement(collection, id, value) {
  return fetchJson(`${API_BASE}/data/${collection}/${id}/increment`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ value }),
  });
}

export async function paymentFindStudent(phone, studentName) {
  return fetchJson(`${API_BASE}/payment/find-student`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ phone, studentName: studentName || '' }),
  });
}

export async function paymentConfirm(paymentId, prospectiveId) {
  return fetchJson(`${API_BASE}/payment/confirm`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ paymentId, prospectiveId }),
  });
}

/** 后端生成海报 PNG。优先返回 posterUrl（微信内长按保存更稳），否则返回 blob 转 dataURL */
export async function posterRender(id, name, imageUrls) {
  const res = await fetch(`${API_BASE}/poster/render`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ id, name, imageUrls }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.msg || `请求失败 ${res.status}`);
  }
  const path = res.headers.get('X-Poster-Url');
  const origin = API_BASE.replace(/\/api\/?$/, '');
  const posterUrl = path ? `${origin}${path.startsWith('/') ? path : '/' + path}` : null;
  const blob = await res.blob();
  return { blob, posterUrl };
}

export { getToken, setToken };
