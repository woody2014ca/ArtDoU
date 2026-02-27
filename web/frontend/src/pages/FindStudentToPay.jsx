import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { paymentFindStudent } from '../api';

export default function FindStudentToPay() {
  const [phone, setPhone] = useState('');
  const [studentName, setStudentName] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg('');
    setLoading(true);
    const res = await paymentFindStudent(phone.trim(), studentName.trim());
    setLoading(false);
    if (res.success) {
      if (res.isProspective) {
        navigate(`/payment?prospectiveId=${res.prospectiveId}&studentName=${encodeURIComponent(res.studentName || '')}`);
      } else {
        navigate(`/payment?studentId=${res.studentId}&studentName=${encodeURIComponent(res.studentName || '')}`);
      }
    } else {
      setMsg(res.msg || '未找到学员');
    }
  };

  return (
    <div style={{ maxWidth: 360, margin: '60px auto', padding: 24, background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
      <h1 style={{ marginTop: 0, color: '#005387' }}>意向学员缴费</h1>
      <p style={{ color: '#666', fontSize: 14 }}>请输入家长手机号，若对应多名学员请同时输入学员姓名</p>
      <form onSubmit={handleSubmit}>
        <input
          type="tel"
          placeholder="家长手机号"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          style={{ width: '100%', padding: 12, marginBottom: 12, border: '1px solid #ddd', borderRadius: 8 }}
        />
        <input
          type="text"
          placeholder="学员姓名（选填）"
          value={studentName}
          onChange={(e) => setStudentName(e.target.value)}
          style={{ width: '100%', padding: 12, marginBottom: 16, border: '1px solid #ddd', borderRadius: 8 }}
        />
        <button type="submit" disabled={loading} style={{ width: '100%', padding: 12, background: '#005387', color: '#fff', border: 0, borderRadius: 8, cursor: loading ? 'wait' : 'pointer' }}>
          {loading ? '查询中...' : '查找学员'}
        </button>
      </form>
      {msg && <p style={{ color: '#c00', fontSize: 14, marginTop: 12 }}>{msg}</p>}
      <p style={{ marginTop: 24, fontSize: 14 }}>
        <a href="/">返回首页</a> · <a href="/bind">家长绑定</a>
      </p>
    </div>
  );
}
