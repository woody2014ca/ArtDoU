import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dataGet } from '../api';

export default function ParentHome() {
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id') || '';
  const referrer = searchParams.get('referrer') || '';
  const fromShare = searchParams.get('from') === 'share';
  const toParent = searchParams.get('to') === 'parent';
  const navigate = useNavigate();
  const { role, myStudentId, loading } = useAuth();
  const [student, setStudent] = useState(null);
  const [works, setWorks] = useState([]);
  const [totalRewards, setTotalRewards] = useState(0);
  const [loadingData, setLoadingData] = useState(true);
  const [lightbox, setLightbox] = useState(null); // { urls: string[], index: number }

  const studentId = id || myStudentId;
  const isViewingSharedLink = !!(id && (referrer || fromShare));
  const isGuest = isViewingSharedLink && role !== 'parent' && myStudentId !== id;
  const isAdmin = role === 'admin' || role === 'teacher';

  useEffect(() => {
    if (!studentId) {
      setLoadingData(false);
      return;
    }
    (async () => {
      try {
        const [sRes, lRes] = await Promise.all([
          dataGet('Students', studentId),
          dataGet('Attendance_logs', 'all', { search_student_id: studentId }),
        ]);
        if (sRes.success && sRes.data) setStudent(sRes.data);
        if (lRes.success && Array.isArray(lRes.data)) {
          const logs = lRes.data;
          const withPhoto = logs.filter(
            (w) => w.type !== 'topup' && (w.photo_url || w.work_img || w.work_photo || (w.work_imgs && w.work_imgs.length) || w.note)
          );
          const rewards = logs.filter(
            (i) => i.student_id === studentId && (i.type === 'reward' || (i.change_num != null && i.change_num > 0))
          );
          setWorks(withPhoto);
          setTotalRewards(rewards.length);
        }
      } finally {
        setLoadingData(false);
      }
    })();
  }, [studentId]);

  if (loading || (role !== 'parent' && !id && !isViewingSharedLink)) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        {loading ? '加载中...' : '请先绑定家长或使用分享链接进入'}
      </div>
    );
  }

  if (!studentId) {
    return (
      <div style={{ maxWidth: 400, margin: '40px auto', padding: 24, textAlign: 'center' }}>
        <p>未识别到学员，请先<Link to="/bind">绑定手机号</Link>或通过老师分享的链接进入。</p>
        <p><Link to="/">返回首页</Link></p>
      </div>
    );
  }

  const name = (student && student.name) ? student.name : '学员';
  const left = (student && student.left_classes != null) ? student.left_classes : 0;
  const showRenewAlert = !isGuest && left <= 1;

  const getWorkCover = (w) => w.work_imgs?.[0] || w.work_img || w.work_photo || w.photo_url || '';
  const getWorkAllUrls = (w) => {
    if (w.work_imgs?.length) return w.work_imgs;
    const u = w.work_img || w.work_photo || w.photo_url;
    return u ? [u] : [];
  };

  const goToPoster = () => navigate(`/poster?id=${studentId}&name=${encodeURIComponent(name)}`);
  const goToEnroll = () => navigate(`/enroll?referrer=${referrer || studentId}&from=share`);
  const goToPayment = () => navigate(`/payment?studentId=${studentId}&studentName=${encodeURIComponent(name)}`);

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 16, paddingBottom: 40 }}>
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <span style={{ color: '#005387', fontSize: 28, fontWeight: 700, letterSpacing: 2 }}>ArtDoU</span>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>{name}</div>
        <div style={{ fontSize: 14, color: '#666' }}>小小艺术家 / The Little Artist</div>
        {!isGuest && (
          <div style={{ fontSize: 14, color: '#333', marginTop: 6 }}>
            剩余课时 / Lessons left: <strong>{left}</strong>
          </div>
        )}
      </div>

      {showRenewAlert && (
        <div
          role="button"
          onClick={goToPayment}
          style={{
            border: '2px solid #ff4d4f',
            borderRadius: 12,
            padding: 16,
            marginBottom: 20,
            background: '#fff5f5',
            cursor: 'pointer',
          }}
        >
          <div style={{ color: '#c00', fontWeight: 600, fontSize: 14 }}>余课不足，请及时续费 / Renewal</div>
          <div style={{ color: '#666', fontSize: 14, marginTop: 4 }}>
            当前仅剩 <span style={{ color: left === 0 ? '#c00' : '#f5222d', fontWeight: 700 }}>{left}</span> 节课
          </div>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          background: 'linear-gradient(135deg,#005387 0%,#0077b6 100%)',
          color: '#fff',
          borderRadius: 12,
          padding: 20,
          marginBottom: 20,
        }}
      >
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{works.length}</div>
          <div style={{ fontSize: 12, opacity: 0.95 }}>创作作品</div>
          <div style={{ fontSize: 11, opacity: 0.8 }}>WORKS</div>
        </div>
        <div style={{ width: 2, background: 'rgba(255,255,255,0.5)' }} />
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{totalRewards}</div>
          <div style={{ fontSize: 12, opacity: 0.95 }}>获得奖励</div>
          <div style={{ fontSize: 11, opacity: 0.8 }}>REWARDS</div>
        </div>
      </div>

      {isGuest && (
        <div style={{ marginBottom: 20 }}>
          {toParent ? (
            <>
              <div style={{ background: '#e6f4ff', border: '1px solid #005387', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#005387', marginBottom: 6 }}>家长您好</div>
                <div style={{ fontSize: 14, color: '#333' }}>这是您家孩子 <strong>{name}</strong> 的成长展厅。绑定手机号后可查看剩余课时、提交请假、分享有奖等。</div>
              </div>
              <button
                type="button"
                onClick={() => navigate('/bind')}
                style={{
                  width: '100%',
                  padding: 16,
                  background: 'linear-gradient(135deg,#005387,#0077b6)',
                  color: '#fff',
                  border: 0,
                  borderRadius: 12,
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: 'pointer',
                  marginBottom: 12,
                }}
              >
                绑定手机号，进入家长端
              </button>
              <details style={{ fontSize: 14, color: '#888' }}>
                <summary style={{ cursor: 'pointer' }}>我不是家长，我想报名</summary>
                <button type="button" onClick={goToEnroll} style={{ width: '100%', marginTop: 10, padding: 12, background: '#f5f5f5', color: '#333', border: 0, borderRadius: 10, cursor: 'pointer' }}>
                  🎁 我也要报名 (首次课优享价)
                </button>
              </details>
            </>
          ) : (
            <>
              <p style={{ fontSize: 14, color: '#666', marginBottom: 12 }}>您是孩子家长？绑定手机号后可查看课时、请假、分享有奖等。</p>
              <button type="button" onClick={() => navigate('/bind')} style={{ width: '100%', padding: 14, background: '#fff', color: '#005387', border: '2px solid #005387', borderRadius: 12, fontSize: 16, cursor: 'pointer', marginBottom: 10 }}>
                我是家长，去绑定
              </button>
              <button type="button" onClick={goToEnroll} style={{ width: '100%', padding: 16, background: 'linear-gradient(135deg,#005387,#0077b6)', color: '#fff', border: 0, borderRadius: 12, fontSize: 16, cursor: 'pointer' }}>
                🎁 我也要报名 (首次课优享价)
              </button>
            </>
          )}
        </div>
      )}

      {!isGuest && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          {role === 'parent' && (
            <button
              type="button"
              onClick={() => navigate(`/leave?id=${studentId}&name=${encodeURIComponent(name)}`)}
              style={{ flex: 1, minWidth: 80, padding: 14, background: '#fff', color: '#005387', border: '2px solid #005387', borderRadius: 10, cursor: 'pointer' }}
            >
              🗓 请假条
            </button>
          )}
          <button
            type="button"
            onClick={goToPoster}
            style={{ flex: 1, padding: 14, background: '#fff', color: '#005387', border: '2px solid #005387', borderRadius: 10, cursor: 'pointer' }}
          >
            📜 生成海报
          </button>
          <button
            type="button"
            onClick={() => {
              const basePath = import.meta.env.BASE_URL.replace(/\/$/, '') || '';
              if (role === 'parent') {
                // 分享有奖：朋友打开看到自动生成的海报 + 我也要报名
                const url = `${window.location.origin}${basePath}/poster/view?id=${studentId}&name=${encodeURIComponent(name)}&from=share`;
                navigator.clipboard.writeText(url).then(() => alert('分享链接已复制，朋友打开将看到海报与「我也要报名」'));
              } else {
                // 通知家长：家长打开看到绑定引导
                const url = `${window.location.origin}${basePath}/parent?id=${studentId}&referrer=${studentId}&from=share&to=parent`;
                navigator.clipboard.writeText(url).then(() => alert('分享链接已复制，可发给家长'));
              }
            }}
            style={{ flex: 1, padding: 14, background: '#fff', color: '#005387', border: '2px solid #005387', borderRadius: 10, cursor: 'pointer' }}
          >
            🎁 {role === 'parent' ? '分享有奖' : '通知家长'}
          </button>
        </div>
      )}

      <section style={{ marginTop: 24 }}>
        <div style={{ marginBottom: 12 }}>
          <span style={{ color: '#005387', fontSize: 18, fontWeight: 700 }}>ART GALLERY</span>
          <div style={{ fontSize: 14, color: '#333' }}>艺术成长展厅 · 点击图片可放大</div>
        </div>
        {loadingData ? (
          <p style={{ color: '#888' }}>加载中...</p>
        ) : works.length === 0 ? (
          <p style={{ color: '#888', fontSize: 14 }}>暂无作品展示，期待下一次创作</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {works.map((w) => {
              const cover = getWorkCover(w);
              const allUrls = getWorkAllUrls(w);
              const dateStr = w.date ? new Date(w.date).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
              const multi = allUrls.length || (cover ? 1 : 0);
              return (
                <div
                  key={w._id}
                  role="button"
                  tabIndex={0}
                  onClick={() => cover && setLightbox({ urls: allUrls, index: 0 })}
                  onKeyDown={(e) => { if (cover && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setLightbox({ urls: allUrls, index: 0 }); } }}
                  style={{
                    background: '#fff',
                    borderRadius: 10,
                    overflow: 'hidden',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                    cursor: cover ? 'pointer' : 'default',
                  }}
                >
                  {cover ? (
                    <img
                      src={cover}
                      alt=""
                      style={{ width: '100%', aspectRatio: '1', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{ width: '100%', aspectRatio: '1', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: 14 }}>
                      {w.note || '记录'}
                    </div>
                  )}
                  <div style={{ padding: 8, fontSize: 12, color: '#666' }}>
                    日期: {dateStr}
                    {multi > 1 && ` 共${multi}张`}
                  </div>
                </div>
              );
            })}
          </div>
      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.9)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            aria-label="关闭"
            onClick={() => setLightbox(null)}
            style={{ position: 'absolute', right: 16, top: 16, background: 'rgba(255,255,255,0.2)', color: '#fff', border: 0, borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 14 }}
          >
            关闭
          </button>
          <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: '100%', maxHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img
              src={lightbox.urls[lightbox.index]}
              alt=""
              style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain' }}
            />
          </div>
          {lightbox.urls.length > 1 && (
            <>
              <button
                type="button"
                aria-label="上一张"
                onClick={(e) => { e.stopPropagation(); setLightbox((l) => ({ ...l, index: (l.index - 1 + l.urls.length) % l.urls.length })); }}
                style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.2)', color: '#fff', border: 0, borderRadius: 8, padding: '12px 16px', cursor: 'pointer', fontSize: 18 }}
              >
                ‹
              </button>
              <button
                type="button"
                aria-label="下一张"
                onClick={(e) => { e.stopPropagation(); setLightbox((l) => ({ ...l, index: (l.index + 1) % l.urls.length })); }}
                style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.2)', color: '#fff', border: 0, borderRadius: 8, padding: '12px 16px', cursor: 'pointer', fontSize: 18 }}
              >
                ›
              </button>
              <span style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.9)', fontSize: 14 }}>
                {lightbox.index + 1} / {lightbox.urls.length}
              </span>
            </>
          )}
        </div>
      )}
        )}
      </section>

      <p style={{ marginTop: 24, fontSize: 14 }}>
        <Link to="/">返回首页</Link>
      </p>
    </div>
  );
}
