import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { dataAdd } from '../api';

export default function Payment() {
  const [searchParams] = useSearchParams();
  const studentId = searchParams.get('studentId') || '';
  const prospectiveId = searchParams.get('prospectiveId') || '';
  const studentName = searchParams.get('studentName') || '学员';
  const navigate = useNavigate();
  const [lessons, setLessons] = useState('');
  const [price, setPrice] = useState('');
  const [proofNote, setProofNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const hasTarget = !!studentId || !!prospectiveId;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!lessons || !price) {
      setMsg('请填写课时和金额');
      return;
    }
    if (!hasTarget) {
      setMsg('缺少学员信息，请从「意向学员缴费」查找学员后再提交');
      return;
    }
    setMsg('');
    setLoading(true);
    try {
      const payload = {
        student_name: decodeURIComponent(studentName),
        amount_lessons: parseInt(lessons, 10),
        price: parseFloat(price),
        status: 'pending',
        create_time: new Date().toISOString(),
        proof_note: proofNote || undefined,
      };
      if (prospectiveId) payload.prospective_id = prospectiveId;
      else payload.student_id = studentId;
      const res = await dataAdd('Payment_logs', payload);
      if (res.success || res._id) {
        setMsg('提交成功，老师核销后将增加课时');
        setTimeout(() => navigate('/'), 2000);
      } else {
        setMsg(res.msg || '提交失败');
      }
    } catch (err) {
      setMsg(err.message || '网络异常');
    } finally {
      setLoading(false);
    }
  };

  if (!hasTarget) {
    return (
      <div style={{ maxWidth: 400, margin: '40px auto', padding: 24, textAlign: 'center' }}>
        <p>请先通过<a href="/pay/find">意向学员缴费</a>查找学员后再提交缴费凭证。</p>
        <p><a href="/">返回首页</a></p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 20 }}>
      <h1 style={{ color: '#005387', fontSize: 22, marginBottom: 8 }}>缴费凭证</h1>
      <p style={{ color: '#666', fontSize: 14, marginBottom: 24 }}>学员：{decodeURIComponent(studentName)}</p>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 14 }}>购买课时 *</label>
          <input type="number" min="1" value={lessons} onChange={(e) => setLessons(e.target.value)} placeholder="如 10" style={{ width: '100%', padding: 12, border: '1px solid #ddd', borderRadius: 8 }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 14 }}>金额（元）*</label>
          <input type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="如 1200" style={{ width: '100%', padding: 12, border: '1px solid #ddd', borderRadius: 8 }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 14 }}>凭证说明（选填）</label>
          <textarea value={proofNote} onChange={(e) => setProofNote(e.target.value)} placeholder="可填写转账流水号或凭证摘要，图片可稍后由老师补传" rows={2} style={{ width: '100%', padding: 12, border: '1px solid #ddd', borderRadius: 8 }} />
        </div>
        {msg && <p style={{ color: msg.startsWith('提交成功') ? '#0a0' : '#c00', fontSize: 14, marginBottom: 12 }}>{msg}</p>}
        <button type="submit" disabled={loading} style={{ width: '100%', padding: 14, background: '#005387', color: '#fff', border: 0, borderRadius: 10, cursor: loading ? 'wait' : 'pointer', fontSize: 16 }}>{loading ? '提交中...' : '提交'}</button>
      </form>
      <p style={{ marginTop: 24 }}><a href="/">返回首页</a> · <a href="/pay/find">重新查找学员</a></p>
    </div>
  );
}
