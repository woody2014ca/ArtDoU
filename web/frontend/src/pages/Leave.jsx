import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { dataAdd } from '../api';

export default function Leave() {
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id') || '';
  const name = decodeURIComponent(searchParams.get('name') || '');
  const navigate = useNavigate();
  const [leaveDate, setLeaveDate] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg('');
    if (!leaveDate) {
      setMsg('请选择请假日期');
      return;
    }
    if (!id) {
      setMsg('缺少学员信息，请从展厅进入');
      return;
    }
    setLoading(true);
    try {
      const res = await dataAdd('Leave_requests', {
        student_id: id,
        student_name: name || '学员',
        date: leaveDate,
        reason: reason.trim() || '请假',
        status: 0,
        create_time: new Date().toISOString(),
      });
      if (res.success || res._id) {
        setMsg('申请已提交，请等待老师确认');
        setTimeout(() => navigate(-1), 1500);
      } else {
        setMsg(res.msg || '提交失败');
      }
    } catch (err) {
      setMsg(err.message || '网络异常');
    } finally {
      setLoading(false);
    }
  };

  if (!id) {
    return (
      <div style={{ maxWidth: 400, margin: '40px auto', padding: 24, textAlign: 'center' }}>
        <p>请从学员展厅点击「请假条」进入。</p>
        <p style={{ marginTop: 16 }}><Link to="/">返回首页</Link></p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 440, margin: '40px auto', padding: 24 }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#005387', marginBottom: 4 }}>ArtDoU</div>
        <h1 style={{ margin: 0, color: '#005387', fontSize: 22 }}>请假条</h1>
        <p style={{ marginTop: 4, fontSize: 14, color: '#666' }}>LEAVE REQUEST</p>
      </div>

      <div style={{ background: '#f8fafc', borderRadius: 12, padding: 12, marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: '#666' }}>学员</div>
        <div style={{ fontSize: 16, fontWeight: 600 }}>{name || '学员'}</div>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 8, fontSize: 14, color: '#333', textAlign: 'center' }}>请假日期 / Leave Date</label>
          <input
            type="date"
            value={leaveDate}
            onChange={(e) => setLeaveDate(e.target.value)}
            style={{ width: '100%', padding: 14, border: '1px solid #ddd', borderRadius: 10, fontSize: 16, boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', marginBottom: 8, fontSize: 14, color: '#333', textAlign: 'center' }}>请假说明 / Reason</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="请输入请假原因（选填）..."
            rows={3}
            style={{ width: '100%', padding: 12, border: '1px solid #ddd', borderRadius: 10, fontSize: 14, boxSizing: 'border-box' }}
          />
        </div>

        {msg && <p style={{ color: msg.startsWith('申请已提交') ? '#0a0' : '#c00', fontSize: 14, marginBottom: 12 }}>{msg}</p>}
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
          {loading ? '提交中...' : '提交请假条'}
        </button>
      </form>

      <p style={{ marginTop: 24, textAlign: 'center' }}>
        <button type="button" onClick={() => navigate(-1)} style={{ background: 'none', border: 0, color: '#005387', cursor: 'pointer', fontSize: 14 }}>
          返回
        </button>
      </p>
    </div>
  );
}
