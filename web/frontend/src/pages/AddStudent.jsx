import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dataAdd } from '../api';

export default function AddStudent() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [count, setCount] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const isAdmin = role === 'admin' || role === 'teacher';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !count.trim()) {
      setMsg('请填写完整信息');
      return;
    }
    const num = Number(count);
    if (isNaN(num) || num < 0) {
      setMsg('请输入有效课时数');
      return;
    }
    setMsg('');
    if (!isAdmin) {
      setMsg('仅老师可录入学员');
      return;
    }
    setLoading(true);
    try {
      const res = await dataAdd('Students', {
        name: name.trim(),
        parent_phone: phone.trim(),
        left_classes: num,
      });
      if (res.success || res._id) {
        setMsg('录入成功');
        setTimeout(() => navigate('/', { replace: true }), 1200);
      } else {
        setMsg(res.msg || '录入失败');
      }
    } catch (err) {
      setMsg(err.message || '网络异常');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 20 }}>
      <h1 style={{ color: '#005387', fontSize: 22, marginBottom: 24 }}>新学员</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 14 }}>学员姓名 *</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="请输入姓名" style={{ width: '100%', padding: 12, border: '1px solid #ddd', borderRadius: 8 }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 14 }}>家长手机号 *</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="请输入手机号" style={{ width: '100%', padding: 12, border: '1px solid #ddd', borderRadius: 8 }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 14 }}>剩余课时 *</label>
          <input type="number" min="0" value={count} onChange={(e) => setCount(e.target.value)} placeholder="0" style={{ width: '100%', padding: 12, border: '1px solid #ddd', borderRadius: 8 }} />
        </div>
        {msg && <p style={{ color: msg === '录入成功' ? '#0a0' : '#c00', fontSize: 14, marginBottom: 12 }}>{msg}</p>}
        <button type="submit" disabled={loading} style={{ width: '100%', padding: 14, background: '#005387', color: '#fff', border: 0, borderRadius: 10, cursor: loading ? 'wait' : 'pointer', fontSize: 16 }}>
          {loading ? '录入中...' : '确认录入'}
        </button>
      </form>
      <p style={{ marginTop: 24 }}><a href="/">返回首页</a></p>
    </div>
  );
}
