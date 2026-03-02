import { Router } from 'express';
import sharp from 'sharp';
import QRCode from 'qrcode';
import { authMiddleware } from '../middleware/auth.js';
import crypto from 'crypto';

const router = Router();
router.use(authMiddleware);

/** 内存缓存：key -> { buffer, createdAt }，供前端用 URL 长按保存（微信内 data URL 常无法保存） */
const posterCache = new Map();
const CACHE_MAX = 20;
const CACHE_TTL_MS = 10 * 60 * 1000;

function pruneCache() {
  const now = Date.now();
  for (const [k, v] of posterCache.entries()) {
    if (now - v.createdAt > CACHE_TTL_MS) posterCache.delete(k);
  }
  while (posterCache.size > CACHE_MAX) {
    const first = posterCache.keys().next().value;
    if (first) posterCache.delete(first);
  }
}

/** GET /api/poster/image/:key — 返回缓存的 PNG，用于 <img src=url> 长按保存 */
router.get('/image/:key', (req, res) => {
  const entry = posterCache.get(req.params.key);
  if (!entry) return res.status(404).send('Not Found');
  res.set('Cache-Control', 'public, max-age=300');
  res.type('image/png').send(entry.buffer);
});

/** 将图片 URL 转为 buffer（服务端请求无 CORS） */
async function fetchImageBuffer(url, timeoutMs = 8000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: c.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  } finally {
    clearTimeout(t);
  }
}

/** 用 sharp 将图片缩放到 cell×cell、覆盖裁剪，高质量重采样，避免 SVG 内嵌原图时渲染模糊 */
async function resizeToCell(buffer, cell) {
  return sharp(buffer)
    .resize(cell, cell, {
      fit: 'contain', // 保留完整画面，宽图/高图都不裁切
      position: 'center',
      background: { r: 255, g: 255, b: 255, alpha: 1 }, // 多余区域用白色填充
    })
    .png({ compressionLevel: 6 })
    .toBuffer();
}

/** data URL 或 http(s) URL 转为 buffer；data URL 直接解码 */
function urlToBuffer(url) {
  if (url.startsWith('data:')) {
    const base64 = url.replace(/^data:image\/\w+;base64,/, '');
    return Buffer.from(base64, 'base64');
  }
  return null;
}

/** POST /api/poster/render — 后端生成海报 PNG，避免前端 canvas 跨域/卡死 */
router.post('/render', async (req, res) => {
  if (req.role === 'guest') {
    return res.status(401).json({ success: false, msg: '请先登录' });
  }
  try {
    const { id, name, imageUrls } = req.body || {};
    const safeName = (name && String(name).slice(0, 20)) || '学员';
    const urls = Array.isArray(imageUrls) ? imageUrls.slice(0, 4) : [];
    if (urls.length === 0) {
      return res.status(400).json({ success: false, msg: '请至少选择一张作品' });
    }

    const origin = req.get('origin') || req.get('referrer')?.replace(/\/[^/]*$/, '') || process.env.FRONTEND_URL || '';
    const basePath = '/artdou';
    const signUpUrl = `${origin}${basePath}/poster/view?id=${id || ''}&referrer=${id || ''}&from=share`;
    let qrDataUrl = '';
    try {
      qrDataUrl = await QRCode.toDataURL(signUpUrl, { width: 400, margin: 1 });
    } catch (e) {
      console.warn('[poster] QRCode error:', e.message);
    }

    // 先定分辨率：3 倍基准，作品格约 528px，整图约 1200px 宽，长按保存更清晰
    const scale = 3;
    const w = Math.round(400 * scale);
    const cell = Math.round(176 * scale);

    // 取图：支持 data URL（直接解码）或 HTTP URL（服务端 fetch）
    const rawBuffers = await Promise.all(
      urls.map(async (u) => {
        const dataBuf = urlToBuffer(u);
        if (dataBuf) return dataBuf;
        return fetchImageBuffer(u).catch(() => null);
      })
    );
    const validBuffers = rawBuffers.filter(Boolean);
    if (validBuffers.length === 0) {
      return res.status(400).json({ success: false, msg: '图片加载失败，请重试' });
    }

    // 用 sharp 高质量缩放到 cell×cell 再嵌 SVG，避免 SVG 渲染时缩放导致模糊
    const resizedBuffers = await Promise.all(
      validBuffers.map((buf) => resizeToCell(buf, cell))
    );
    const validImages = resizedBuffers.map(
      (buf) => `data:image/png;base64,${buf.toString('base64')}`
    );
    const gap = Math.round(16 * scale);
    const pad = Math.round(24 * scale);
    const topH = Math.round(96 * scale);
    const rows = validImages.length;
    const gridStartX = (w - cell) / 2;
    const gridH = rows * cell + (rows - 1) * gap;
    const qrSize = Math.round(120 * scale);
    const totalH = topH + gridH + Math.round(80 * scale) + qrSize + Math.round(60 * scale);

    const escapeXml = (s) =>
      String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    const escapeAttr = (s) => String(s).replace(/"/g, '&quot;');

    const imagesSvg = validImages
      .map((dataUrl, i) => {
        const row = i;
        const x = gridStartX;
        const y = topH + row * (cell + gap);
        // preserveAspectRatio 用 meet，配合预先 contain 缩放，保证整张作品完整可见
        return `<image href="${escapeAttr(dataUrl)}" x="${x}" y="${y}" width="${cell}" height="${cell}" preserveAspectRatio="xMidYMid meet"/>`;
      })
      .join('');

    const qrX = (w - qrSize) / 2;
    const sepY = topH + gridH + Math.round(20 * scale);
    const qrY = topH + gridH + Math.round(80 * scale);
    const qrImg = qrDataUrl ? `<image href="${escapeAttr(qrDataUrl)}" x="${qrX}" y="${qrY}" width="${qrSize}" height="${qrSize}"/>` : '';

    const fs = (n) => Math.round(n * scale);
    const fontFamily = 'Noto Sans CJK SC, Noto Sans SC, sans-serif';
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${totalH}" viewBox="0 0 ${w} ${totalH}">
  <rect width="${w}" height="${totalH}" fill="#ffffff"/>
  <text x="${w / 2}" y="${fs(28)}" text-anchor="middle" font-size="${fs(12)}" fill="#005387" letter-spacing="${fs(2)}" font-family="${fontFamily}">ArtDoU</text>
  <text x="${w / 2}" y="${fs(52)}" text-anchor="middle" font-size="${fs(18)}" font-weight="700" fill="#333" font-family="${fontFamily}">艺术成长报告 / ART GROWTH REPORT</text>
  <text x="${w / 2}" y="${fs(82)}" text-anchor="middle" font-size="${fs(20)}" font-weight="700" fill="#333" text-decoration="underline" font-family="${fontFamily}">${escapeXml(safeName)}</text>
  ${imagesSvg}
  <line x1="${pad}" y1="${sepY}" x2="${w - pad}" y2="${sepY}" stroke="#eee" stroke-width="${Math.max(1, Math.round(scale))}"/>
  <text x="${w / 2}" y="${sepY + fs(32)}" text-anchor="middle" font-size="${fs(16)}" font-weight="700" fill="#005387" font-family="${fontFamily}">🎁 我也要报名</text>
  <text x="${w / 2}" y="${sepY + fs(52)}" text-anchor="middle" font-size="${fs(12)}" fill="#666" font-family="${fontFamily}">扫码进入报名页</text>
  ${qrImg}
  <text x="${w / 2}" y="${totalH - fs(24)}" text-anchor="middle" font-size="${fs(11)}" fill="#999" font-family="${fontFamily}">长按保存图片 · 发朋友圈或发给朋友</text>
</svg>`;

    const png = await sharp(Buffer.from(svg))
      .png()
      .toBuffer();

    const key = crypto.randomBytes(8).toString('hex');
    pruneCache();
    posterCache.set(key, { buffer: png, createdAt: Date.now() });

    res.set('Cache-Control', 'no-store');
    res.set('Access-Control-Expose-Headers', 'X-Poster-Url');
    res.set('X-Poster-Url', `/api/poster/image/${key}`);
    res.type('image/png').send(png);
  } catch (e) {
    console.error('[poster] render error:', e);
    res.status(500).json({ success: false, msg: e.message || '生成失败' });
  }
});

export default router;
