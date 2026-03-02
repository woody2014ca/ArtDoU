import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dataGet, dataDelete } from '../api';

export default function Finance() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const isAdmin = role === 'admin' || role === 'teacher';

  useEffect(() => {
    if (!isAdmin) return setLoading(false);
    Promise.all([
      dataGet('Attendance_logs', 'all'),
      dataGet('Payment_logs', 'all'),
    ]).then(([logRes, payRes]) => {
      const data = (logRes.success && logRes.data) ? logRes.data : [];
      data.sort((a, b) => new Date(b.createTime || b.date || 0) - new Date(a.createTime || a.date || 0));
      setLogs(data.slice(0, 100));
      const payments = (payRes.success && payRes.data) ? payRes.data : [];
      setPendingCount(payments.filter((p) => p.status === 'pending').length);
      setLoading(false);
    });
  }, [role, isAdmin]);

  const handleDelete = async (id) => {
    if (!window.confirm('确定删除这条消课记录？')) return;
    const res = await dataDelete('Attendance_logs', id);
    if (res.success !== false) {
      setLogs((prev) => prev.filter((i) => i._id !== id));
    } else {
      alert(res.msg || '删除失败');
    }
  };

  const now = new Date();
  const monthLogs = logs.filter((l) => {
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

      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <button
          type="button"
          onClick={() => navigate('/payment/manage')}
          style={{ padding: '12px 24px', background: '#e8f4fc', color: '#005387', border: '1px solid #005387', borderRadius: 10, cursor: 'pointer', fontSize: 15 }}
        >
          待确认缴费 →
        </button>
      </div>

      <div style={{ background: '#005387', color: '#fff', borderRadius: 12, padding: 20, marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: 16 }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 12, opacity: 0.9 }}>待确认缴费数</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{pendingCount}</div>
        </div>
        <div style={{ width: 2, height: 48, background: 'rgba(255,255,255,0.4)' }} />
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 12, opacity: 0.9 }}>本月总消课流水记录数</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{monthLogs.length}</div>
        </div>
      </div>

      {loading ? (
        <p style={{ color: '#888' }}>加载中...</p>
      ) : (
        <>
          <div style={{ marginBottom: 12, fontSize: 14, color: '#666' }}>消课流水明细</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {logs.length === 0 ? (
              <li style={{ padding: 24, textAlign: 'center', color: '#888' }}>暂无消课记录</li>
            ) : (
              logs.map((item) => (
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
                      消耗 {Math.abs(Number(item.change_num) || 0)} 课时
                    </div>
                    <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>{item.note || item.teacher_comment || '常规消课'}</div>
                    {item._id && (
                      <div style={{ marginTop: 8, fontSize: 12 }}>
                        <button type="button" onClick={() => window.confirm('编辑消课记录功能开发中，敬请期待')} style={{ background: 'none', border: 0, color: '#005387', cursor: 'pointer', padding: 0, marginRight: 8 }}>编辑</button>
                        <button type="button" onClick={() => handleDelete(item._id)} style={{ background: 'none', border: 0, color: '#999', cursor: 'pointer', padding: 0 }}>删除</button>
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
