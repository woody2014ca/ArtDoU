import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { dataGet } from '../api';

export default function PosterView() {
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id') || '';
  const name = decodeURIComponent(searchParams.get('name') || '学员');
  const keysParam = searchParams.get('keys') || '';
  const navigate = useNavigate();
  const [works, setWorks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState('');

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
    }).catch(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const basePath = import.meta.env.BASE_URL.replace(/\/$/, '') || '';
    const signUpUrl = `${window.location.origin}${basePath}/enroll?referrer=${id}&from=share`;
    QRCode.toDataURL(signUpUrl, { width: 200, margin: 1 }).then(setQrDataUrl).catch(() => {});
  }, [id]);

  const getUrls = (w) => {
    if (w.work_imgs?.length) return w.work_imgs;
    const u = w.work_img || w.work_photo || w.photo_url;
    return u ? [u] : [];
  };

  const flatCandidates = [];
  works.forEach((work) => {
    getUrls(work).forEach((url, j) => {
      flatCandidates.push({ work, url, key: `${work._id}-${j}` });
    });
  });

  const keyList = keysParam.split(',').map((k) => k.trim()).filter(Boolean);
  // 陌生人打开分享链接：最多 3 张图竖向排；带 keys 时按选定展示
  const posterMaxImages = keyList.length > 0 ? 9 : 3;
  const selectedItems =
    keyList.length > 0
      ? keyList.map((k) => flatCandidates.find((c) => c.key === k)).filter(Boolean)
      : flatCandidates.slice(0, posterMaxImages);

  if (!id) {
    return (
      <div style={{ maxWidth: 480, margin: '40px auto', padding: 24 }}>
        <p>链接无效</p>
        <button type="button" onClick={() => navigate('/')}>返回首页</button>
      </div>
    );
  }

  const isPosterStyle = keyList.length === 0;
  return (
    <div style={{ maxWidth: 420, margin: '0 auto', padding: 16 }}>
      {loading ? (
        <p style={{ textAlign: 'center', color: '#888' }}>加载中...</p>
      ) : (
        <>
          <div style={{ background: '#fff', padding: isPosterStyle ? 20 : 24, borderRadius: 12, border: '1px solid #eee', marginBottom: 20, boxShadow: isPosterStyle ? '0 2px 12px rgba(0,0,0,0.08)' : 'none' }}>
            <div style={{ textAlign: 'center', marginBottom: isPosterStyle ? 12 : 16 }}>
              <div style={{ fontSize: 12, color: '#005387', letterSpacing: 2 }}>ArtDoU</div>
              <div style={{ fontSize: isPosterStyle ? 14 : 18, fontWeight: 700, marginTop: 4, color: '#333' }}>{isPosterStyle ? '邀请你看' : '艺术成长报告 / ART GROWTH REPORT'}</div>
              <div style={{ fontSize: 20, fontWeight: 700, marginTop: 6, textDecoration: 'underline' }}>{name}</div>
            </div>
            {selectedItems.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: isPosterStyle ? '1fr' : 'repeat(2, 1fr)', gap: isPosterStyle ? 12 : 12 }}>
                {selectedItems.map((item) => (
                  <div key={item.key} style={{ textAlign: 'center' }}>
                    <img src={item.url} alt="" style={{ width: '100%', borderRadius: 8, display: 'block' }} />
                    {!isPosterStyle && (
                      <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>
                        {item.work?.date ? new Date(item.work.date).toLocaleDateString('zh-CN') : ''}
                        {item.work?.note && ` · ${item.work.note}`}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ textAlign: 'center', color: '#888', padding: 24 }}>暂无作品，期待下一次创作</p>
            )}
            {!isPosterStyle && (
              <div style={{ borderTop: '1px solid #eee', marginTop: 20, paddingTop: 20, textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#005387', marginBottom: 8 }}>🎁 我也要报名</div>
                <div style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>扫码进入报名页</div>
                {qrDataUrl && (
                  <img src={qrDataUrl} alt="报名" style={{ display: 'block', margin: '0 auto', width: 140, height: 140 }} />
                )}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              type="button"
              onClick={() => navigate(`/enroll?referrer=${id}&from=share`)}
              style={{ padding: 14, background: '#005387', color: '#fff', border: 0, borderRadius: 10, cursor: 'pointer', fontSize: 16 }}
            >
              🎁 我也要报名
            </button>
            {!isPosterStyle && (
              <button type="button" onClick={() => navigate('/')} style={{ padding: 12, background: '#f0f0f0', border: 0, borderRadius: 10, cursor: 'pointer' }}>
                返回首页
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
