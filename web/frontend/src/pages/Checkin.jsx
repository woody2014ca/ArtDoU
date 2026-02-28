import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dataGet, dataAdd, dataIncrement } from '../api';

function makePosterNote(text) {
  const s = String(text || '').trim();
  if (!s) return '';
  const first = s.split(/[\n。！？!?\r]/).filter(Boolean)[0] || s;
  return first.length > 24 ? first.slice(0, 24) + '...' : first;
}

export default function Checkin() {
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id') || '';
  const nameFromQuery = searchParams.get('name') || '';
  const { role } = useAuth();
  const navigate = useNavigate();
  const isRealStudent = id && !id.startsWith('demo');
  const [name, setName] = useState(nameFromQuery || '学员');
  const [count, setCount] = useState('1');
  const [remark, setRemark] = useState('');
  const [brief, setBrief] = useState('');
  const [memo, setMemo] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (isRealStudent && id && !nameFromQuery) {
      dataGet('Students', id).then((res) => {
        if (res.success && res.data && res.data.name) setName(res.data.name);
      });
    }
  }, [id, isRealStudent, nameFromQuery]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!count || Number(count) < 1) { setMsg('请输入消课数量'); return; }
    setMsg('');
    if (!isRealStudent) { setMsg('请从学员名录进入'); return; }
    if (role !== 'admin' && role !== 'teacher') { setMsg('仅老师可操作'); return; }
    setLoading(true);
    try {
      const num = Number(count);
      const addRes = await dataAdd('Attendance_logs', {
        student_id: id, student_name: name, change_num: -num,
        teacher_notes: remark || '', brief: brief || '', memo: memo || '',
        note: makePosterNote(brief || remark || ''), date: new Date().toISOString(),
      });
      if (!addRes.success) { setMsg(addRes.msg || addRes.error || '写入记录失败'); setLoading(false); return; }
      const incRes = await dataIncrement('Students', id, -num);
      if (!incRes.success) { setMsg(incRes.msg || '扣减课时失败'); setLoading(false); return; }
      navigate('/parent?id=' + id, { replace: true });
    } catch (err) { setMsg(err.message || '网络异常'); } finally { setLoading(false); }
  };

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 20 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, color: '#005387', fontSize: 22 }}>{name}</h1>
        <p style={{ margin: '4px 0', color: '#666', fontSize: 14 }}>{isRealStudent ? 'CLASS CHECK-IN' : 'ASSET VERIFICATION'}</p>
      </div>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 14 }}>{isRealStudent ? '消课课时' : '核销数量'}</label>
          <input type="number" min="1" value={count} onChange={(e) => setCount(e.target.value)} style={{ width: '100%', padding: 12, border: '1px solid #ddd', borderRadius: 8 }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 14 }}>{isRealStudent ? '课堂简评' : '备注'}</label>
          <textarea value={isRealStudent ? brief : remark} onChange={(e) => (isRealStudent ? setBrief(e.target.value) : setRemark(e.target.value))} placeholder={isRealStudent ? '课堂简评（用于海报）' : '请输入'} maxLength={isRealStudent ? 80 : undefined} rows={3} style={{ width: '100%', padding: 12, border: '1px solid #ddd', borderRadius: 8 }} />
        </div>
        {isRealStudent && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 14 }}>教师备忘</label>
            <textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="仅内部" maxLength={800} rows={4} style={{ width: '100%', padding: 12, border: '1px solid #ddd', borderRadius: 8 }} />
            <div style={{ fontSize: 12, color: '#888' }}>{memo.length} / 800</div>
          </div>
        )}
        {msg && <p style={{ color: '#c00', fontSize: 14, marginBottom: 12 }}>{msg}</p>}
        <button type="submit" disabled={loading} style={{ width: '100%', padding: 14, background: '#005387', color: '#fff', border: 0, borderRadius: 10, cursor: loading ? 'wait' : 'pointer', fontSize: 16 }}>{loading ? '提交中...' : isRealStudent ? '确认消课' : '确认核销'}</button>
      </form>
      <p style={{ marginTop: 24 }}><a href="/">返回首页</a></p>
    </div>
  );
}
