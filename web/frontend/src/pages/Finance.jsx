import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';

import { isLessonCheckin as isCheckinLog, lessonMovementLabel } from '../utils/attendance';
import { useAuth } from '../context/AuthContext';
import { dataGet } from '../api';

export default function Finance() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const isAdmin = role === 'admin' || role === 'teacher';
  const goPaymentManage = () => navigate('/payment/manage');

  useEffect(() => {
    if (!isAdmin) return setLoading(false);
    Promise.all([
      dataGet('Attendance_logs', 'all', { lite: '1', limit: '500' }),
      dataGet('Payment_logs', 'all'),
    ]).then(([logRes, payRes]) => {
      if (!logRes.success || !Array.isArray(logRes.data) || !payRes.success || !Array.isArray(payRes.data)) throw new Error('无法读取财务记录');
      const data = logRes.data;
      data.sort((a, b) => new Date(b.createTime || b.date || 0) - new Date(a.createTime || a.date || 0));
      setLogs(data);
      const payments = (payRes.success && payRes.data) ? payRes.data : [];
      setPendingCount(payments.filter((p) => p.status === 'pending').length);
      setLoading(false);
    }).catch(() => {setLoadError('财务记录加载失败，请刷新重试；当前不能判断余课或待确认数量。');setLoading(false);});
  }, [role, isAdmin]);

  const now = new Date();
  const monthLogs = logs.filter((l) => {
    if (!isCheckinLog(l)) return false;
    const d = new Date(l.date || l.createTime);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  if (!isAdmin) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p>仅老师可查看财务。</p>
        <p><Link to="/">返回首页</Link></p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 20 }}>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <h1 style={{ margin: 0, color: '#005387', fontSize: 22 }}>财务与课消流水</h1>
        <p style={{ marginTop: 4, fontSize: 14, color: '#005387', letterSpacing: 1 }}>FINANCIAL RECORDS</p>
      </div>

      {pendingCount > 0 && (
        <div
          onClick={goPaymentManage}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') goPaymentManage(); }}
          style={{
            background: '#fff5e6',
            border: '1px solid #fa8c16',
            borderRadius: 12,
            padding: '14px 16px',
            marginBottom: 16,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ color: '#d46b08', fontWeight: 600, fontSize: 14 }}>💰 待确认缴费 {pendingCount} 条</span>
          <span style={{ color: '#005387', fontSize: 14 }}>去确认 →</span>
        </div>
      )}

      <div style={{ background: '#005387', color: '#fff', borderRadius: 12, padding: 20, marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: 16 }}>
        <Link
          to="/payment/manage"
          style={{ flex: 1, textAlign: 'center', color: 'inherit', textDecoration: 'none', cursor: 'pointer' }}
        >
          <div style={{ fontSize: 12, opacity: 0.9 }}>待确认缴费数</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{loading || loadError ? '—' : pendingCount}</div>
          <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>点击去确认 →</div>
        </Link>
        <div style={{ width: 2, height: 48, background: 'rgba(255,255,255,0.4)' }} />
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 12, opacity: 0.9 }}>本月消课记录数</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{loading || loadError ? '—' : monthLogs.length}</div>
        </div>
      </div>

      {loadError ? <p role="alert" style={{color:'#c00'}}>{loadError}</p> : loading ? (
        <p style={{ color: '#888' }}>加载中...</p>
      ) : (
        <>
          <div style={{ marginBottom: 12, fontSize: 14, color: '#666' }}>充值与消课流水明细</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {logs.length === 0 ? (
              <li style={{ padding: 24, textAlign: 'center', color: '#888' }}>暂无消课记录</li>
            ) : (
              logs.slice(0, 100).map((item) => (
                <li
                  key={item._id}
                  style={{
                    padding: '16px 0',
                    borderBottom: '1px solid #eee',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 12,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: '#999', marginBottom: 2 }}>学员:</div>
                    <div style={{ fontWeight: 600, fontSize: 16 }}>{item.student_name}</div>
                    <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>{item.date || (item.createTime && new Date(item.createTime).toISOString())}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ color: '#005387', fontWeight: 600, fontSize: 14 }}>
                      {lessonMovementLabel(item)}
                    </div>
                    <div style={{ fontSize: 12, color: '#999', marginTop: 4, maxHeight: 120, overflowY: 'auto', textAlign: 'left', lineHeight: 1.5 }}>{item.note || item.brief || item.teacher_notes || item.teacher_comment || '常规消课'}</div>
                    {item._id && (
                      <div style={{ marginTop: 8, fontSize: 12 }}>
                        {isCheckinLog(item) && (
                          <button type="button" onClick={() => navigate(`/checkin/edit/${item._id}`)} style={{ background: 'none', border: 0, color: '#005387', cursor: 'pointer', padding: 0, marginRight: 8 }}>编辑消课</button>
                        )}
                        {isCheckinLog(item) && <button type="button" onClick={() => navigate(`/checkin/edit/${item._id}`)} style={{ background: 'none', border: 0, color: '#999', cursor: 'pointer', padding: 0 }}>撤销消课</button>}
                        {item.voided && <span>历史与作品已保留 · {item.voidReason}</span>}
                      </div>
                    )}
                  </div>
                </li>
              ))
            )}
          </ul>
        </>
      )}

      <p style={{ marginTop: 24 }}><Link to="/">返回首页</Link></p>
    </div>
  );
}
