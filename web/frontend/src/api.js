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

export async function authInit() {
  const res = await fetch(`${API_BASE}/auth/init`, { headers: headers() });
  const data = await res.json();
  return data;
}

export async function authLogin(password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ password }),
  });
  const data = await res.json();
  if (data.success && data.token) setToken(data.token);
  return data;
}

export async function authBind(phone) {
  const res = await fetch(`${API_BASE}/auth/bind`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ phone }),
  });
  const data = await res.json();
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
  const res = await fetch(url, { headers: headers() });
  return res.json();
}

export async function dataAdd(collection, data) {
  const res = await fetch(`${API_BASE}/data/${collection}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function dataUpdate(collection, id, data) {
  const res = await fetch(`${API_BASE}/data/${collection}/${id}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function dataDelete(collection, id) {
  const res = await fetch(`${API_BASE}/data/${collection}/${id}`, { method: 'DELETE', headers: headers() });
  return res.json();
}

export async function dataIncrement(collection, id, value) {
  const res = await fetch(`${API_BASE}/data/${collection}/${id}/increment`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ value }),
  });
  return res.json();
}

export async function paymentFindStudent(phone, studentName) {
  const res = await fetch(`${API_BASE}/payment/find-student`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ phone, studentName: studentName || '' }),
  });
  return res.json();
}

export async function paymentConfirm(paymentId, prospectiveId) {
  const res = await fetch(`${API_BASE}/payment/confirm`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ paymentId, prospectiveId }),
  });
  return res.json();
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
