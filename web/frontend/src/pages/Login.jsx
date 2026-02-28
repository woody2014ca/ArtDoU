import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authLogin } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { refresh } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg('');
    setLoading(true);
    try {
      const res = await authLogin(password);
      if (res.success) {
        await refresh();
        navigate('/', { replace: true });
      } else {
        setMsg(res.msg || '登录失败');
      }
    } catch (err) {
      setMsg('网络错误，请检查后端是否已启动或 API 地址');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 360, margin: '60px auto', padding: 24, background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
      <h1 style={{ marginTop: 0, color: '#005387' }}>ArtDoU 管理端</h1>
      <p style={{ color: '#666', fontSize: 14 }}>老师/管理员登录</p>
      <form onSubmit={handleSubmit}>
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="请输入密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', padding: '12px 44px 12px 12px', border: '1px solid #ddd', borderRadius: 8 }}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            title={showPassword ? '隐藏密码' : '显示密码'}
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, fontSize: 18, lineHeight: 1 }}
            aria-label={showPassword ? '隐藏密码' : '显示密码'}
          >
            {showPassword ? '🙈' : '👁'}
          </button>
        </div>
        <button type="submit" disabled={loading} style={{ width: '100%', padding: 12, background: '#005387', color: '#fff', border: 0, borderRadius: 8, cursor: loading ? 'wait' : 'pointer' }}>
          {loading ? '登录中...' : '登录'}
        </button>
      </form>
      {msg && <p style={{ color: '#c00', fontSize: 14, marginTop: 12 }}>{msg}</p>}
      <p style={{ marginTop: 24, fontSize: 14 }}>
        <a href="/">返回首页</a> · <a href="/bind">家长绑定手机号</a>
      </p>
    </div>
  );
}
