import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dataAdd, dataGet } from '../api';

const REAL_LEVELS = ['零基础', '涂鸦期 (3-5岁)', '造型期 (6-8岁)', '创意期 (9-12岁)', '专业备考'];

export default function Enroll() {
  const [searchParams] = useSearchParams();
  const referrerId = searchParams.get('referrer') || '';
  const fromShare = searchParams.get('from') === 'share';
  const { role } = useAuth();
  const navigate = useNavigate();
  const isAdmin = role === 'admin' || role === 'teacher';
  const canSubmit = isAdmin || fromShare || !!referrerId;

  const [form, setForm] = useState({ name: '', phone: '', age: '', level: '', note: '' });
  const [referrerDisplay, setReferrerDisplay] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  React.useEffect(() => {
    if (referrerId) {
      dataGet('Students', referrerId).then((res) => {
        if (res.success && res.data && res.data.name) setReferrerDisplay(res.data.name);
      });
    }
  }, [referrerId]);

  const handleChange = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      setMsg('姓名和手机号必填');
      return;
    }
    setMsg('');
    if (!canSubmit) {
      setMsg('请从分享链接进入或使用老师账号登录后录入');
      return;
    }
    setLoading(true);
    try {
      const res = await dataAdd('Prospective_students', {
        ...form,
        status: 'pending',
        source: fromShare || referrerId ? '分享报名' : '教师录入',
        referrer_id: referrerId || undefined,
      });
      if (res.success || res._id) {
        setMsg('已录入意向名单');
        setTimeout(() => navigate('/', { replace: true }), 1500);
      } else {
        setMsg(res.msg || '提交失败');
      }
    } catch (err) {
      setMsg(err.message || '网络异常');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 20 }}>
      <h1 style={{ color: '#005387', fontSize: 22, marginBottom: 24 }}>意向登记</h1>

      {referrerId && (
        <p style={{ marginBottom: 16, fontSize: 14, color: '#666' }}>
          推荐人：{referrerDisplay || '已填写（来自分享）'}
        </p>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 14 }}>姓名 *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="学员姓名"
            style={{ width: '100%', padding: 12, border: '1px solid #ddd', borderRadius: 8 }}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 14 }}>手机号 *</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
            placeholder="家长手机号"
            style={{ width: '100%', padding: 12, border: '1px solid #ddd', borderRadius: 8 }}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 14 }}>年龄</label>
          <input
            type="text"
            value={form.age}
            onChange={(e) => handleChange('age', e.target.value)}
            placeholder="如 5"
            style={{ width: '100%', padding: 12, border: '1px solid #ddd', borderRadius: 8 }}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 14 }}>阶段</label>
          <select
            value={form.level}
            onChange={(e) => handleChange('level', e.target.value)}
            style={{ width: '100%', padding: 12, border: '1px solid #ddd', borderRadius: 8 }}
          >
            <option value="">请选择</option>
            {REAL_LEVELS.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 14 }}>备注（选填）</label>
          <textarea
            value={form.note}
            onChange={(e) => handleChange('note', e.target.value)}
            placeholder="其他说明"
            rows={2}
            style={{ width: '100%', padding: 12, border: '1px solid #ddd', borderRadius: 8 }}
          />
        </div>
        {msg && <p style={{ color: msg.startsWith('已录入') ? '#0a0' : '#c00', fontSize: 14, marginBottom: 12 }}>{msg}</p>}
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
          {loading ? '提交中...' : '提交'}
        </button>
      </form>

      <p style={{ marginTop: 24 }}>
        <Link to="/">返回首页</Link>
      </p>
    </div>
  );
}
