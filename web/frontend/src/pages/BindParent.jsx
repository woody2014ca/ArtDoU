import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authBind } from '../api';
import { useAuth } from '../context/AuthContext';

export default function BindParent() {
  const [phone, setPhone] = useState('');
  const [msg, setMsg] = useState('');
  const navigate = useNavigate();
  const { refresh } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg('');
    const res = await authBind(phone.trim());
    if (res.success) {
      await refresh();
      navigate('/parent' + (res.myStudentId ? `?id=${res.myStudentId}` : ''), { replace: true });
    } else {
      setMsg(res.msg || '绑定失败');
    }
  };

  return (
    <div style={{ maxWidth: 360, margin: '60px auto', padding: 24, background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
      <h1 style={{ marginTop: 0, color: '#005387' }}>家长绑定</h1>
      <p style={{ color: '#666', fontSize: 14 }}>请输入与报名时一致的手机号（已缴费学员）</p>
      <form onSubmit={handleSubmit}>
        <input
          type="tel"
          placeholder="手机号"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          style={{ width: '100%', padding: 12, marginBottom: 16, border: '1px solid #ddd', borderRadius: 8 }}
        />
        <button type="submit" style={{ width: '100%', padding: 12, background: '#005387', color: '#fff', border: 0, borderRadius: 8, cursor: 'pointer' }}>
          绑定
        </button>
      </form>
      {msg && <p style={{ color: '#c00', fontSize: 14, marginTop: 12 }}>{msg}</p>}
      <p style={{ marginTop: 24, fontSize: 14 }}>
        <a href="/">返回首页</a>
      </p>
    </div>
  );
}
