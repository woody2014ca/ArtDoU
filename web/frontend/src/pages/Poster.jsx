import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dataGet, posterRender } from '../api';
import html2canvas from 'html2canvas';
import QRCode from 'qrcode';

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });

const MAX_SELECT = 4;

export default function Poster() {
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id') || '';
  const name = decodeURIComponent(searchParams.get('name') || '学员');
  const navigate = useNavigate();
  const { role } = useAuth();
  const isParent = role === 'parent';
  const [works, setWorks] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [posterDone, setPosterDone] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  /** 点击保存/朋友圈后，在页面内展示的图片（长按保存），不弹窗。{ dataUrl, hint } */
  const [inlineSaveImage, setInlineSaveImage] = useState(null);
  const [saving, setSaving] = useState(false);
  const posterRef = useRef(null);

  useEffect(() => {
    if (!posterDone || !id) return;
    const basePath = import.meta.env.BASE_URL.replace(/\/$/, '') || '';
    const signUpUrl = `${window.location.origin}${basePath}/poster/view?id=${id}&referrer=${id}&from=share`;
    QRCode.toDataURL(signUpUrl, { width: 160, margin: 1 }).then(setQrDataUrl).catch(() => {});
  }, [posterDone, id]);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    dataGet('Attendance_logs', 'all', { search_student_id: id }).then((res) => {
      if (res.success && Array.isArray(res.data)) {
        const withImg = res.data.filter(
          (w) => w.work_imgs?.length || w.work_img || w.work_photo || w.photo_url
        );
        setWorks(withImg.slice(0, 18));
      }
      setLoading(false);
    });
  }, [id]);

  const getUrls = (w) => {
    if (w.work_imgs?.length) return w.work_imgs;
    const u = w.work_img || w.work_photo || w.photo_url;
    return u ? [u] : [];
  };

  const flatCandidates = [];
  works.forEach((work, i) => {
    getUrls(work).forEach((url, j) => {
      flatCandidates.push({ work, url, key: `${work._id}-${j}` });
    });
  });

  const toggle = (key) => {
    const idx = selected.indexOf(key);
    if (idx >= 0) {
      setSelected(selected.filter((k) => k !== key));
    } else if (selected.length < MAX_SELECT) {
      setSelected([...selected, key]);
    }
  };

  const generatePoster = () => {
    if (selected.length === 0) return;
    setPosterDone(true);
  };

  const selectedItems = selected
    .map((k) => flatCandidates.find((c) => c.key === k))
    .filter(Boolean);

  /** 等待海报内所有 img 加载/解码完成，避免未加载就截图导致空白（审计要点 B1） */
  const waitForImages = (root, timeoutMs = 8000) => {
    const imgs = Array.from(root.querySelectorAll('img'));
    const loadTasks = imgs.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise((resolve, reject) => {
        const cleanup = (cb) => {
          img.removeEventListener('load', onLoad);
          img.removeEventListener('error', onErr);
          cb();
        };
        const onLoad = () => cleanup(resolve);
        const onErr = () => cleanup(() => reject(new Error('img-load-fail')));
        img.addEventListener('load', onLoad, { once: true });
        img.addEventListener('error', onErr, { once: true });
      });
    });
    const decodeTasks = imgs
      .filter((img) => typeof img.decode === 'function')
      .map((img) => img.decode().catch(() => {}));
    const all = Promise.allSettled([...loadTasks, ...decodeTasks]);
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('img-timeout')), timeoutMs));
    return Promise.race([all, timeout]);
  };

  const capturePosterAsImage = async () => {
    if (!posterRef.current) return null;
    await waitForImages(posterRef.current, 8000);
    const canvas = await html2canvas(posterRef.current, {
      useCORS: true,
      allowTaint: false,
      scale: 1,
      backgroundColor: '#ffffff',
    });
    return canvas;
  };

  /** 优先后端生成 PNG（微信内最稳），失败再 fallback 前端 html2canvas */
  const runSaveFlow = (hint) => {
    setSaving(true);
    const imageUrls = selectedItems.map((i) => i.url);
    posterRender(id, name, imageUrls)
      .then((blob) => blobToDataUrl(blob))
      .then((dataUrl) => setInlineSaveImage({ dataUrl, hint }))
      .catch((err) => {
        const msg = err?.message || '生成失败';
        if (msg.includes('请先登录')) {
          alert('请先登录后再保存');
          return;
        }
        alert(msg);
      })
      .finally(() => setSaving(false));
  };

  const saveToAlbum = () => {
    runSaveFlow('长按图片保存到相册。若长按无反应，请截屏保存。');
  };

  const shareToMoments = () => {
    runSaveFlow('长按图片保存后，打开微信 → 发现 → 朋友圈 → 从相册选择该图片发布。若长按无反应可截屏。');
  };

  if (!id) {
    return (
      <div style={{ maxWidth: 480, margin: '40px auto', padding: 24 }}>
        <p>缺少学员参数</p>
        <button type="button" onClick={() => navigate(-1)}>返回</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 16 }}>
      <h1 style={{ color: '#005387', fontSize: 22, marginBottom: 8 }}>艺术成长报告</h1>
      <p style={{ fontSize: 14, color: '#666', marginBottom: 20 }}>ART GROWTH REPORT</p>

      {!posterDone ? (
        <>
          <p style={{ fontSize: 14, color: '#333', marginBottom: 8 }}>
            选择要出现在海报上的作品（每张图一格，建议最多 4 张）。已选 {selected.length} / {MAX_SELECT}
          </p>
          {loading ? (
            <p>加载中...</p>
          ) : flatCandidates.length === 0 ? (
            <p style={{ color: '#888' }}>该学员暂无带图作品</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
              {flatCandidates.map((item) => {
                const isSel = selected.includes(item.key);
                return (
                  <button
                    type="button"
                    key={item.key}
                    onClick={() => toggle(item.key)}
                    style={{
                      padding: 0,
                      border: isSel ? '3px solid #005387' : '2px solid #eee',
                      borderRadius: 8,
                      overflow: 'hidden',
                      background: '#fff',
                      cursor: 'pointer',
                      position: 'relative',
                    }}
                  >
                    <img crossOrigin="anonymous" src={item.url} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                    {isSel && (
                      <span style={{ position: 'absolute', right: 6, top: 6, background: '#005387', color: '#fff', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>✓</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              onClick={generatePoster}
              disabled={selected.length === 0}
              style={{
                padding: '12px 24px',
                background: selected.length === 0 ? '#ccc' : '#005387',
                color: '#fff',
                border: 0,
                borderRadius: 10,
                cursor: selected.length === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              生成海报
            </button>
            <button type="button" onClick={() => navigate(-1)} style={{ padding: '12px 24px', background: '#f0f0f0', border: 0, borderRadius: 10, cursor: 'pointer' }}>
              返回
            </button>
          </div>
        </>
      ) : (
        <>
          <div style={{ marginBottom: 20, maxWidth: 400, marginLeft: 'auto', marginRight: 'auto' }}>
            {/* 有保存图时只显示这一张图（可长按保存），原海报移出视口但保留供再次生成用 */}
            {inlineSaveImage ? (
              <div style={{ textAlign: 'center' }}>
                <img
                  src={inlineSaveImage.dataUrl}
                  alt="海报"
                  style={{
                    width: '100%',
                    display: 'block',
                    borderRadius: 12,
                    border: '1px solid #eee',
                    marginBottom: 12,
                    WebkitTouchCallout: 'default',
                    userSelect: 'auto',
                    pointerEvents: 'auto',
                  }}
                />
                <p style={{ fontSize: 14, color: '#333', lineHeight: 1.6 }}>{inlineSaveImage.hint}</p>
              </div>
            ) : null}
            <div
              ref={posterRef}
              className="poster-print-area"
              style={{
                background: '#fff',
                padding: 24,
                borderRadius: 12,
                border: '1px solid #eee',
                ...(inlineSaveImage ? { position: 'absolute', left: '-9999px', top: 0, width: 400 } : {}),
              }}
              aria-hidden={!!inlineSaveImage}
            >
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: '#005387', letterSpacing: 2 }}>ArtDoU</div>
                <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>艺术成长报告 / ART GROWTH REPORT</div>
                <div style={{ fontSize: 20, fontWeight: 700, marginTop: 8, textDecoration: 'underline' }}>{name}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: selectedItems.length <= 2 ? 'repeat(2, 1fr)' : 'repeat(2, 1fr)', gap: 12, maxWidth: 320 }}>
                  {selectedItems.map((item) => (
                    <div key={item.key} style={{ textAlign: 'center' }}>
                      <img crossOrigin="anonymous" src={item.url} alt="" style={{ width: '100%', borderRadius: 8, display: 'block' }} />
                      <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>
                        {item.work?.date ? new Date(item.work.date).toLocaleDateString('zh-CN') : ''}
                        {item.work?.note && ` · ${item.work.note}`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #eee', textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#005387' }}>🎁 我也要报名</div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 8 }}>扫码进入报名页</div>
                {qrDataUrl && (
                  <div style={{ marginTop: 10, display: 'flex', justifyContent: 'center' }}>
                    <img src={qrDataUrl} alt="报名入口" style={{ width: 120, height: 120, display: 'block' }} />
                  </div>
                )}
                <div style={{ fontSize: 11, color: '#999', marginTop: 8 }}>长按保存图片 · 发朋友圈或发给朋友</div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button type="button" onClick={saveToAlbum} disabled={saving} style={{ padding: 14, background: saving ? '#7a9fb5' : '#005387', color: '#fff', border: 0, borderRadius: 10, cursor: saving ? 'wait' : 'pointer', fontSize: 16 }}>
              {saving ? '生成中...' : '保存到相册'}
            </button>
            <button type="button" onClick={shareToMoments} disabled={saving} style={{ padding: 14, background: saving ? '#7a9fb5' : '#005387', color: '#fff', border: 0, borderRadius: 10, cursor: saving ? 'wait' : 'pointer', fontSize: 16 }}>
              {saving ? '生成中...' : '分享到朋友圈'}
            </button>
            {!isParent && (
              <button
                type="button"
                onClick={() => navigate(`/enroll?referrer=${id}&from=share`)}
                style={{ padding: 14, background: '#005387', color: '#fff', border: 0, borderRadius: 10, cursor: 'pointer' }}
              >
                🎁 我也要报名
              </button>
            )}
            <button type="button" onClick={() => navigate(-1)} style={{ padding: 12, background: '#f0f0f0', border: 0, borderRadius: 10, cursor: 'pointer' }}>
              返回
            </button>
          </div>
        </>
      )}

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .poster-print-area, .poster-print-area * { visibility: visible; }
          .poster-print-area { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
}
