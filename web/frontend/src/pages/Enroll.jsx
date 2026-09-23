import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dataAdd, dataGet } from '../api';

const REAL_LEVELS = ['零基础', '涂鸦期 (3-5岁)', '造型期 (6-8岁)', '创意期 (9-12岁)', '专业备考'];

function buildEnrollShareUrl() {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  return `${window.location.origin}${base}/enroll?from=share`;
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {}
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(ta);
  return ok;
}

export default function Enroll() {
  const [searchParams] = useSearchParams();
  const referrerId = searchParams.get('referrer') || '';
  const fromShare = searchParams.get('from') === 'share';
  const { role } = useAuth();
  const navigate = useNavigate();
  const isAdmin = role === 'admin' || role === 'teacher';

  const [form, setForm] = useState({ name: '', phone: '', age: '', level: '', note: '', referrer: '' });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [shareHint, setShareHint] = useState('');

  React.useEffect(() => {
    if (referrerId) {
      dataGet('Students', referrerId).then((res) => {
        if (res.success && res.data && res.data.name) {
          setForm((f) => ({ ...f, referrer: res.data.name }));
        }
      }).catch(() => {});
    }
  }, [referrerId]);

  const handleChange = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleCopyShareLink = async () => {
    const url = buildEnrollShareUrl();
    const ok = await copyText(url);
    if (ok) {
      setShareHint('报名链接已复制，发给家长即可填写');
      setTimeout(() => setShareHint(''), 2500);
    } else {
      setShareHint(url);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      setMsg('姓名和手机号必填');
      return;
    }
    setMsg('');
    setLoading(true);
    try {
      const source = isAdmin
        ? '教师录入'
        : fromShare || referrerId
          ? '分享报名'
          : '自行报名';
      const res = await dataAdd('Prospective_students', {
        name: form.name,
        phone: form.phone,
        age: form.age,
        level: form.level,
        note: form.note,
        referrer: form.referrer || undefined,
        status: 'pending',
        source,
        referrer_id: referrerId || undefined,
      });
      if (res.success || res._id) {
        setMsg('已录入意向名单');
        setTimeout(() => navigate(isAdmin ? '/enroll/list' : '/', { replace: true }), 1500);
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
      <h1 style={{ color: '#005387', fontSize: 22, marginBottom: 16 }}>意向登记</h1>

      {isAdmin && (
        <div
          style={{
            background: '#e8f4fc',
            border: '1px solid #005387',
            borderRadius: 10,
            padding: 12,
            marginBottom: 20,
            fontSize: 14,
          }}
        >
          <div style={{ marginBottom: 8, color: '#333' }}>发给家长的报名链接（家长打开即可提交，无需登录）</div>
          <button
            type="button"
            onClick={handleCopyShareLink}
            style={{
              padding: '8px 14px',
              background: '#005387',
              color: '#fff',
              border: 0,
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            复制家长报名链接
          </button>
          {shareHint && (
            <p style={{ margin: '8px 0 0', fontSize: 13, color: '#005387', wordBreak: 'break-all' }}>{shareHint}</p>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 14 }}>推荐人（选填）</label>
          <p style={{ margin: '0 0 8px 0', fontSize: 12, color: '#c00' }}>填写推荐人，可享受首次课优惠价！</p>
          <input
            type="text"
            value={form.referrer}
            onChange={(e) => handleChange('referrer', e.target.value)}
            placeholder=""
            style={{ width: '100%', padding: 12, border: '1px solid #ddd', borderRadius: 8 }}
          />
        </div>
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
            placeholder=""
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
        {isAdmin && (
          <>
            <span style={{ margin: '0 8px' }}>·</span>
            <Link to="/enroll/list">意向名单</Link>
          </>
        )}
      </p>
    </div>
  );
}
