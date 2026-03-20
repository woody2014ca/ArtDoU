/**
 * 仅允许站内 path+search 回跳，防止开放重定向
 */
export function getSafeInternalRedirect(raw) {
  if (raw == null || typeof raw !== 'string') return null;
  let path = raw.trim();
  try {
    path = decodeURIComponent(path);
  } catch {
    return null;
  }
  if (!path.startsWith('/')) return null;
  if (path.startsWith('//')) return null;
  if (/[\s\r\n]/.test(path)) return null;
  if (path.includes('://')) return null;
  return path;
}
