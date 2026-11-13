import WorkImage from '../components/WorkImage';
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { readWorkShare } from '../api';
import { useGuestRedirectToBind } from '../hooks/useGuestRedirectToBind';
import { isGalleryArtwork } from '../utils/attendance';

export default function PosterView() {
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id') || '';
  const shareToken = searchParams.get('share') || '';
  const referralId = searchParams.get('referrer') || id;
  const [name, setName] = useState('学员');
  const [shareError, setShareError] = useState('');
  const keysParam = searchParams.get('keys') || '';
  const toParent = searchParams.get('to') === 'parent';
  const navigate = useNavigate();
  const [works, setWorks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const guestGate = useGuestRedirectToBind(!!id && toParent);

  useEffect(() => {
    if (!shareToken) {
      setShareError('分享链接已更新，请联系老师或家长重新分享。');
      setLoading(false);
      return;
    }
    readWorkShare(shareToken).then((res) => {
      if (res.success && Array.isArray(res.data)) {
        const withImg = res.data.filter(isGalleryArtwork);
        setWorks(withImg.slice(0, 18));
        setName(res.name || '学员');
      } else {
        setShareError(res.msg || '分享不存在、已过期或已被撤销');
      }
      setLoading(false);
    }).catch(() => { setShareError('暂时无法加载分享，请稍后重试'); setLoading(false); });
  }, [shareToken]);

  useEffect(() => {
    if (!referralId) return;
    const basePath = import.meta.env.BASE_URL.replace(/\/$/, '') || '';
    const signUpUrl = `${window.location.origin}${basePath}/enroll?referrer=${encodeURIComponent(referralId)}&from=share`;
    QRCode.toDataURL(signUpUrl, { width: 200, margin: 1 }).then(setQrDataUrl).catch(() => {});
  }, [referralId]);

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
  const posterMaxImages = 4;
  const selectedItems =
    keyList.length > 0
      ? keyList.map((k) => flatCandidates.find((c) => c.key === k)).filter(Boolean)
      : flatCandidates.slice(0, posterMaxImages);

  if (!shareToken || shareError) {
    return (
      <div style={{ maxWidth: 480, margin: '40px auto', padding: 24 }}>
        <p>{shareError || '分享链接无效，请联系老师或家长重新分享。'}</p>
        <button type="button" onClick={() => navigate('/')}>返回首页</button>
      </div>
    );
  }

  if (guestGate.block && guestGate.reason === 'loading') {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>加载中...</div>
    );
  }
  if (guestGate.block && guestGate.reason === 'redirect') {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#666' }}>正在跳转至绑定页...</div>
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
                    <WorkImage src={item.url} alt="" style={{ width: '100%', borderRadius: 8, display: 'block' }} />
                    {!isPosterStyle && (
                      <>
                        <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>
                          {item.work?.date ? new Date(item.work.date).toLocaleDateString('zh-CN') : ''}
                        </div>
                        {(item.work?.brief || item.work?.note || item.work?.teacher_notes) && (
                          <div style={{ fontSize: 12, color: '#333', marginTop: 4, textAlign: 'left', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{item.work.brief || item.work.note || item.work.teacher_notes}</div>
                        )}
                      </>
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
                  <WorkImage src={qrDataUrl} alt="报名" style={{ display: 'block', margin: '0 auto', width: 140, height: 140 }} />
                )}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              type="button"
              onClick={() => navigate(`/enroll?referrer=${encodeURIComponent(referralId)}&from=share`)}
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

