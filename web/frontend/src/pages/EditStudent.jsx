import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dataGet, dataUpdate, dataDelete } from '../api';

export default function EditStudent() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [leftClasses, setLeftClasses] = useState('');
  const [parentActivated, setParentActivated] = useState(false);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    dataGet('Students', id)
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) {
          const s = res.data;
          setName(s.name || '');
          setPhone(s.parent_phone || s.phone || '');
          setLeftClasses(s.left_classes != null ? String(s.left_classes) : '');
          setParentActivated(!!s.parent_activated);
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setMsg('请填写学员姓名');
      return;
    }
    const num = leftClasses === '' ? 0 : Number(leftClasses);
    if (isNaN(num)) {
      setMsg('剩余课时请填数字');
      return;
    }
    setMsg('');
    setSaving(true);
    try {
      const res = await dataUpdate('Students', id, {
        name: name.trim(),
        parent_phone: phone.trim(),
        left_classes: num,
        parent_activated: parentActivated,
      });
      if (res.success !== false) {
        setMsg('已保存');
        setTimeout(() => navigate('/', { replace: true }), 1000);
      } else {
        setMsg(res.msg || '保存失败');
      }
    } catch (err) {
      setMsg(err.message || '网络异常');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!window.confirm('确定要删除该学员吗？删除后无法恢复。')) return;
    setSaving(true);
    dataDelete('Students', id)
      .then((res) => {
        if (res.success !== false) {
          setMsg('已删除');
          setTimeout(() => navigate('/', { replace: true }), 800);
        } else {
          setMsg(res.msg || '删除失败');
          setSaving(false);
        }
      })
      .catch((err) => {
        setMsg(err.message || '网络异常');
        setSaving(false);
      });
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', padding: 20, textAlign: 'center', color: '#666' }}>
        加载中...
      </div>
    );
  }

  if (!id) {
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', padding: 20 }}>
        <p style={{ color: '#c00' }}>缺少学员 ID</p>
        <p><Link to="/">返回首页</Link></p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 20 }}>
      <h1 style={{ color: '#005387', fontSize: 22, marginBottom: 24 }}>编辑学员信息</h1>
      <form onSubmit={handleSave}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 14 }}>学员姓名 *</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="请输入姓名" style={{ width: '100%', padding: 12, border: '1px solid #ddd', borderRadius: 8 }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 14 }}>家长电话</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="请输入手机号" style={{ width: '100%', padding: 12, border: '1px solid #ddd', borderRadius: 8 }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
            <input type="checkbox" checked={parentActivated} onChange={(e) => setParentActivated(e.target.checked)} />
            开放家长绑定（该手机号可在首页「我是家长，绑定手机号」登录）
          </label>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 14 }}>剩余课时</label>
          <input type="number" value={leftClasses} onChange={(e) => setLeftClasses(e.target.value)} placeholder="0" style={{ width: '100%', padding: 12, border: '1px solid #ddd', borderRadius: 8 }} />
          <p style={{ fontSize: 12, color: '#888', marginTop: 4 }}>* 修改此处将直接更新课时数，请谨慎操作。</p>
        </div>
        {msg && <p style={{ color: msg === '已保存' || msg === '已删除' ? '#0a0' : '#c00', fontSize: 14, marginBottom: 12 }}>{msg}</p>}
        <button type="submit" disabled={saving} style={{ width: '100%', padding: 14, background: '#005387', color: '#fff', border: 0, borderRadius: 10, cursor: saving ? 'wait' : 'pointer', fontSize: 16 }}>
          {saving ? '保存中...' : '保存修改'}
        </button>
      </form>
      <button type="button" onClick={handleDelete} disabled={saving} style={{ width: '100%', padding: 12, marginTop: 12, background: '#fff', color: '#c00', border: '1px solid #c00', borderRadius: 10, cursor: saving ? 'wait' : 'pointer', fontSize: 14 }}>
        删除该学员
      </button>
      <p style={{ marginTop: 24 }}><Link to="/">返回首页</Link></p>
    </div>
  );
}
