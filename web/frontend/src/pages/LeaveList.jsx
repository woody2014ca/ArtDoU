import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dataGet, dataUpdate } from '../api';

export default function LeaveList() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const isAdmin = role === 'admin' || role === 'teacher';

  const getStatusText = (status) => {
    const s = Number(status);
    if (s === 1) return '已通过';
    if (s === 2) return '已驳回';
    return '待处理';
  };

  const getStatusStyle = (status) => {
    const s = Number(status);
    if (s === 1) return { color: '#0a8f3c', background: '#e8f8ee', border: '1px solid #b7ebc6' };
    if (s === 2) return { color: '#c00', background: '#fff1f0', border: '1px solid #ffccc7' };
    return { color: '#ad6800', background: '#fff7e6', border: '1px solid #ffe58f' };
  };

  const fetchList = async () => {
    if (!isAdmin) return setLoading(false);
    setLoading(true);
    try {
      const res = await dataGet('Leave_requests', 'all');
      const data = (res.success && res.data) ? res.data : [];
      data.sort((a, b) => new Date(b.create_time || b.createTime || b.date || 0) - new Date(a.create_time || a.createTime || a.date || 0));
      setList(data);
    } catch (e) {
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, [role]);

  const handleApprove = async (item) => {
    setProcessing(item._id);
    try {
      await dataUpdate('Leave_requests', item._id, { status: 1 });
      await fetchList();
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (item) => {
    setProcessing(item._id);
    try {
      await dataUpdate('Leave_requests', item._id, { status: 2 });
      await fetchList();
    } finally {
      setProcessing(null);
    }
  };

  if (!isAdmin) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p>仅老师可查看请假申请。</p>
        <p><Link to="/">返回首页</Link></p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: 20 }}>
      <h1 style={{ color: '#005387', fontSize: 22, marginBottom: 20 }}>请假记录</h1>
      <p style={{ marginBottom: 16 }}><Link to="/">← 返回首页</Link></p>
      {loading ? (
        <p style={{ color: '#888' }}>加载中...</p>
      ) : list.length === 0 ? (
        <p style={{ color: '#666' }}>暂无请假记录</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {list.map((item) => (
            <li
              key={item._id}
              style={{
                background: '#fff',
                borderRadius: 12,
                padding: 16,
                marginBottom: 12,
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                border: '1px solid #eee',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ fontWeight: 600, fontSize: 16 }}>{item.student_name || '学员'}</div>
                <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 999, ...getStatusStyle(item.status) }}>
                  {getStatusText(item.status)}
                </span>
              </div>
              <div style={{ fontSize: 14, color: '#666', marginBottom: 4 }}>
                请假日期：{item.date || (item.create_time && new Date(item.create_time).toLocaleDateString('zh-CN'))}
              </div>
              <div style={{ fontSize: 13, color: '#999', marginBottom: 4 }}>
                提交时间：{item.create_time ? new Date(item.create_time).toLocaleString('zh-CN') : (item.createTime ? new Date(item.createTime).toLocaleString('zh-CN') : '—')}
              </div>
              {item.reason && <div style={{ fontSize: 14, color: '#333', marginBottom: 12 }}>原因：{item.reason}</div>}
              {Number(item.status) === 0 && (
                <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                  <button
                    type="button"
                    disabled={!!processing}
                    onClick={() => handleApprove(item)}
                    style={{ padding: '8px 16px', background: '#005387', color: '#fff', border: 0, borderRadius: 8, cursor: processing ? 'wait' : 'pointer', fontSize: 14 }}
                  >
                    {processing === item._id ? '处理中...' : '通过'}
                  </button>
                  <button
                    type="button"
                    disabled={!!processing}
                    onClick={() => handleReject(item)}
                    style={{ padding: '8px 16px', background: '#fff', color: '#666', border: '1px solid #ddd', borderRadius: 8, cursor: processing ? 'wait' : 'pointer', fontSize: 14 }}
                  >
                    驳回
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
