import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authBind } from '../api';
import { useAuth } from '../context/AuthContext';

export default function BindParent() {
  const [phone, setPhone] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { refresh } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg('');
    const p = phone.trim();
    if (!p) {
      setMsg('请输入手机号');
      return;
    }
    setLoading(true);
    try {
      const res = await authBind(p);
      if (res.success) {
        await refresh();
        navigate('/parent' + (res.myStudentId ? `?id=${res.myStudentId}` : ''), { replace: true });
      } else {
        setMsg(res.msg || '绑定失败');
      }
    } catch (err) {
      setMsg(err.message || '网络异常');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: '40px auto', padding: 24 }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 14, color: '#005387', marginBottom: 4 }}>家长入口</div>
        <h1 style={{ margin: 0, color: '#005387', fontSize: 24 }}>绑定手机号</h1>
        <p style={{ marginTop: 8, fontSize: 14, color: '#666' }}>请使用在机构登记的家长手机号</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 14, color: '#333' }}>家长手机号</label>
          <input
            type="tel"
            maxLength={11}
            placeholder="请输入手机号"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={{ width: '100%', padding: 14, border: '1px solid #ddd', borderRadius: 10, fontSize: 16, boxSizing: 'border-box' }}
          />
        </div>
        <p style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>仅已完成缴费的学员家长可绑定，如有疑问请联系老师。</p>

        {msg && <p style={{ color: '#c00', fontSize: 14, marginBottom: 12 }}>{msg}</p>}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: 14,
            background: '#005387',
            color: '#fff',
            border: 0,
            borderRadius: 10,
            cursor: loading ? 'wait' : 'pointer',
            fontSize: 16,
          }}
        >
          {loading ? '验证中...' : '确认绑定'}
        </button>
      </form>

      <p style={{ marginTop: 24, textAlign: 'center' }}>
        <button type="button" onClick={() => navigate(-1)} style={{ background: 'none', border: 0, color: '#005387', cursor: 'pointer', fontSize: 14 }}>
          返回上一页
        </button>
      </p>
      <p style={{ marginTop: 16, textAlign: 'center', fontSize: 14 }}>
        <Link to="/" style={{ color: '#666' }}>返回首页</Link>
      </p>
    </div>
  );
}
