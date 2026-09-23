import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dataAdd, paymentConfirm } from '../api';
import { useGuestRedirectToBind } from '../hooks/useGuestRedirectToBind';

export default function Payment() {
  const [searchParams] = useSearchParams();
  const studentId = searchParams.get('studentId') || '';
  const prospectiveId = searchParams.get('prospectiveId') || '';
  const studentName = searchParams.get('studentName') || '学员';
  const navigate = useNavigate();
  const { role } = useAuth();
  const isAdmin = role === 'admin' || role === 'teacher';
  const [lessons, setLessons] = useState('');
  const [price, setPrice] = useState('');
  const [proofNote, setProofNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const hasTarget = !!studentId || !!prospectiveId;
  const guestGate = useGuestRedirectToBind(!!studentId && !prospectiveId);
  const displayName = decodeURIComponent(studentName);
  /** 老师给意向学员入账：提交后直接转正 */
  const teacherConvert = isAdmin && !!prospectiveId;

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
        student_name: displayName,
        amount_lessons: parseInt(lessons, 10),
        price: parseFloat(price),
        status: 'pending',
        create_time: new Date().toISOString(),
        proof_note: proofNote || undefined,
      };
      if (prospectiveId) payload.prospective_id = prospectiveId;
      else payload.student_id = studentId;
      const res = await dataAdd('Payment_logs', payload);
      if (!(res.success || res._id)) {
        setMsg(res.msg || '提交失败');
        return;
      }
      const paymentId = res._id;
      if (teacherConvert && paymentId) {
        const conf = await paymentConfirm(paymentId, prospectiveId);
        if (conf.success) {
          setMsg('已转正并入账');
          setTimeout(() => navigate('/enroll/list', { replace: true }), 1500);
        } else {
          setMsg(conf.msg || '缴费已记录，但转正失败，请到「待确认缴费」手动确认');
        }
        return;
      }
      if (isAdmin && studentId && paymentId) {
        setMsg('缴费已记录，请到「待确认缴费」完成入账');
        setTimeout(() => navigate('/payment/manage', { replace: true }), 1500);
        return;
      }
      setMsg('提交成功，老师核销后将增加课时');
      setTimeout(() => navigate('/'), 2000);
    } catch (err) {
      setMsg(err.message || '网络异常');
    } finally {
      setLoading(false);
    }
  };

  if (guestGate.block && guestGate.reason === 'loading') {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>加载中...</div>
    );
  }
  if (guestGate.block && guestGate.reason === 'redirect') {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#666' }}>正在跳转至绑定页...</div>
    );
  }

  if (!hasTarget) {
    return (
      <div style={{ maxWidth: 400, margin: '40px auto', padding: 24, textAlign: 'center' }}>
        <p>请先通过<Link to="/pay/find">意向学员缴费</Link>查找学员后再提交缴费凭证。</p>
        <p style={{ marginTop: 16 }}><Link to="/">返回首页</Link></p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 440, margin: '40px auto', padding: 24 }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0, color: '#005387', fontSize: 22 }}>
          {teacherConvert ? '意向学员入账转正' : '提交缴费凭证'}
        </h1>
        <p style={{ marginTop: 4, fontSize: 14, color: '#666' }}>
          {teacherConvert ? '填写课时与金额后，将转为正式学员' : 'PAYMENT PROOF'}
        </p>
      </div>

      <div style={{ background: '#f8fafc', borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>学员 / Student</div>
        <div style={{ fontSize: 18, fontWeight: 600 }}>{displayName}</div>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 14, color: '#333' }}>购买课时 / Lessons *</label>
          <input
            type="number"
            min={1}
            value={lessons}
            onChange={(e) => setLessons(e.target.value)}
            placeholder="请输入课时数"
            style={{ width: '100%', padding: 14, border: '1px solid #ddd', borderRadius: 10, fontSize: 16, boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 14, color: '#333' }}>缴费金额（美元 $）/ Amount (USD) *</label>
          <input
            type="number"
            step="0.01"
            min={0}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="请输入美元金额"
            style={{ width: '100%', padding: 14, border: '1px solid #ddd', borderRadius: 10, fontSize: 16, boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 14, color: '#333' }}>缴费凭证说明（选填）</label>
          <textarea
            value={proofNote}
            onChange={(e) => setProofNote(e.target.value)}
            placeholder="可填写转账流水号或凭证摘要，截图可单独发给老师"
            rows={3}
            style={{ width: '100%', padding: 12, border: '1px solid #ddd', borderRadius: 10, fontSize: 14, boxSizing: 'border-box' }}
          />
        </div>

        {msg && (
          <p style={{ color: msg.includes('成功') || msg.startsWith('已') ? '#0a0' : '#c00', fontSize: 14, marginBottom: 12 }}>
            {msg}
          </p>
        )}
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
          {loading ? '处理中...' : teacherConvert ? '确认入账并转正' : '提交凭证'}
        </button>
      </form>

      <p style={{ marginTop: 24, textAlign: 'center', fontSize: 14 }}>
        <Link to="/" style={{ color: '#666' }}>返回首页</Link>
        <span style={{ margin: '0 8px' }}>·</span>
        {teacherConvert ? (
          <Link to="/enroll/list" style={{ color: '#666' }}>意向名单</Link>
        ) : (
          <Link to="/pay/find" style={{ color: '#666' }}>重新查找学员</Link>
        )}
      </p>
    </div>
  );
}
