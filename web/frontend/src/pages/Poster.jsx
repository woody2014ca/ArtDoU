import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dataGet } from '../api';

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

  const handleSave = () => {
    window.print();
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
                    <img src={item.url} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
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
          <div className="poster-print-area" style={{ background: '#fff', padding: 24, borderRadius: 12, border: '1px solid #eee', marginBottom: 20 }}>
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
              onClick={handleSave}
              style={{ padding: 14, background: '#005387', color: '#fff', border: 0, borderRadius: 10, cursor: 'pointer' }}
            >
              保存到相册 / Save（打印或另存为 PDF）
            </button>
            <button
              type="button"
              onClick={() => {
                const keys = selectedItems.map((i) => i.key).join(',');
                const url = `${window.location.origin}/poster/view?id=${id}&name=${encodeURIComponent(name)}&keys=${encodeURIComponent(keys)}`;
                navigator.clipboard.writeText(url).then(() => alert('分享链接已复制，可粘贴到朋友圈或发给朋友'));
              }}
              style={{ padding: 14, background: '#005387', color: '#fff', border: 0, borderRadius: 10, cursor: 'pointer' }}
            >
              分享到朋友圈（朋友）
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
