import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { dataGet } from '../api';

export default function PosterView() {
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id') || '';
  const name = decodeURIComponent(searchParams.get('name') || '学员');
  const keysParam = searchParams.get('keys') || '';
  const navigate = useNavigate();
  const [works, setWorks] = useState([]);
  const [loading, setLoading] = useState(true);

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
  works.forEach((work) => {
    getUrls(work).forEach((url, j) => {
      flatCandidates.push({ work, url, key: `${work._id}-${j}` });
    });
  });

  const keyList = keysParam.split(',').map((k) => k.trim()).filter(Boolean);
  const selectedItems = keyList
    .map((k) => flatCandidates.find((c) => c.key === k))
    .filter(Boolean);

  if (!id) {
    return (
      <div style={{ maxWidth: 480, margin: '40px auto', padding: 24 }}>
        <p>链接无效</p>
        <button type="button" onClick={() => navigate('/')}>返回首页</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 16 }}>
      <h1 style={{ color: '#005387', fontSize: 22, marginBottom: 8, textAlign: 'center' }}>艺术成长报告</h1>
      <p style={{ fontSize: 14, color: '#666', marginBottom: 20, textAlign: 'center' }}>ART GROWTH REPORT</p>

      {loading ? (
        <p style={{ textAlign: 'center', color: '#888' }}>加载中...</p>
      ) : selectedItems.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#888' }}>海报内容加载失败或已失效</p>
      ) : (
        <>
          <div style={{ background: '#fff', padding: 24, borderRadius: 12, border: '1px solid #eee', marginBottom: 20 }}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: '#005387', letterSpacing: 2 }}>ArtDoU</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>艺术成长报告 / ART GROWTH REPORT</div>
              <div style={{ fontSize: 20, fontWeight: 700, marginTop: 8, textDecoration: 'underline' }}>{name}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: selectedItems.length <= 2 ? 'repeat(2, 1fr)' : 'repeat(2, 1fr)', gap: 12 }}>
              {selectedItems.map((item) => (
                <div key={item.key} style={{ textAlign: 'center' }}>
                  <img src={item.url} alt="" style={{ width: '100%', borderRadius: 8, display: 'block' }} />
                  <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>
                    {item.work?.date ? new Date(item.work.date).toLocaleDateString('zh-CN') : ''}
                    {item.work?.note && ` · ${item.work.note}`}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              type="button"
              onClick={() => navigate(`/enroll?referrer=${id}&from=share`)}
              style={{ padding: 14, background: '#005387', color: '#fff', border: 0, borderRadius: 10, cursor: 'pointer', fontSize: 16 }}
            >
              🎁 我也要报名
            </button>
            <button type="button" onClick={() => navigate('/')} style={{ padding: 12, background: '#f0f0f0', border: 0, borderRadius: 10, cursor: 'pointer' }}>
              返回首页
            </button>
          </div>
        </>
      )}
    </div>
  );
}
