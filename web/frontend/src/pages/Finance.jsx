import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dataGet } from '../api';

export default function Finance() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const isAdmin = role === 'admin' || role === 'teacher';

  useEffect(() => {
    if (!isAdmin) return setLoading(false);
    dataGet('Attendance_logs', 'all').then((res) => {
      const data = (res.success && res.data) ? res.data : [];
      data.sort((a, b) => new Date(b.createTime || b.date || 0) - new Date(a.createTime || a.date || 0));
      setLogs(data.slice(0, 100));
      setLoading(false);
    });
  }, [role, isAdmin]);

  if (!isAdmin) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p>仅老师可查看财务。</p>
        <p><a href="/">返回首页</a></p>
      </div>
    );
  }

  const totalDeducted = logs.reduce((acc, i) => acc + (Number(i.lessons_deducted) || 0), 0);

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 20 }}>
      <h1 style={{ color: '#005387', fontSize: 22, marginBottom: 8 }}>财务</h1>
      <p style={{ marginBottom: 24 }}>
        <button type="button" onClick={() => navigate('/payment/manage')} style={{ padding: '10px 16px', background: '#005387', color: '#fff', border: 0, borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>待确认缴费</button>
      </p>
      {loading ? (
        <p>加载中...</p>
      ) : (
        <>
          <div style={{ background: '#f0f9ff', padding: 16, borderRadius: 10, marginBottom: 20 }}>
            <div style={{ fontSize: 14, color: '#666' }}>流水合计（课时变化）</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#005387' }}>{totalDeducted}</div>
          </div>
          <h3 style={{ fontSize: 16, marginBottom: 12 }}>近期流水</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {logs.slice(0, 50).map((item) => (
              <li key={item._id} style={{ padding: '12px 0', borderBottom: '1px solid #eee', fontSize: 14 }}>
                <span style={{ color: '#666' }}>{item.date || (item.createTime && new Date(item.createTime).toLocaleDateString())}</span>
                <span style={{ marginLeft: 8 }}>{item.student_name}</span>
                <span style={{ marginLeft: 8, color: item.type === 'topup' ? '#0a0' : '#333' }}>{item.note || item.type || ''}</span>
                <span style={{ marginLeft: 8, color: '#666' }}>{item.lessons_deducted != null ? (Number(item.lessons_deducted) > 0 ? '+' : '') + item.lessons_deducted : ''}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p style={{ marginTop: 24 }}><a href="/">返回首页</a></p>
    </div>
  );
}
