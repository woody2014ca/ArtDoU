import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authLogin } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const navigate = useNavigate();
  const { refresh } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg('');
    const res = await authLogin(password);
    if (res.success) {
      await refresh();
      navigate('/', { replace: true });
    } else {
      setMsg(res.msg || '登录失败');
    }
  };

  return (
    <div style={{ maxWidth: 360, margin: '60px auto', padding: 24, background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
      <h1 style={{ marginTop: 0, color: '#005387' }}>ArtDoU 管理端</h1>
      <p style={{ color: '#666', fontSize: 14 }}>老师/管理员登录</p>
      <form onSubmit={handleSubmit}>
        <input
          type="password"
          placeholder="请输入密码"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: '100%', padding: 12, marginBottom: 16, border: '1px solid #ddd', borderRadius: 8 }}
        />
        <button type="submit" style={{ width: '100%', padding: 12, background: '#005387', color: '#fff', border: 0, borderRadius: 8, cursor: 'pointer' }}>
          登录
        </button>
      </form>
      {msg && <p style={{ color: '#c00', fontSize: 14, marginTop: 12 }}>{msg}</p>}
      <p style={{ marginTop: 24, fontSize: 14 }}>
        <a href="/">返回首页</a> · <a href="/bind">家长绑定手机号</a>
      </p>
    </div>
  );
}
