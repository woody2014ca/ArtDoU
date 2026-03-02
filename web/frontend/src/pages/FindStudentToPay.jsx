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
    const p = phone.trim();
    if (!p) {
      setMsg('请输入家长手机号');
      return;
    }
    if (p.replace(/\D/g, '').length < 8) {
      setMsg('手机号格式有误');
      return;
    }
    setLoading(true);
    try {
      const res = await paymentFindStudent(p, studentName.trim());
      if (res.success) {
        if (res.isProspective) {
          navigate(`/payment?prospectiveId=${res.prospectiveId}&studentName=${encodeURIComponent(res.studentName || '')}`);
        } else {
          navigate(`/payment?studentId=${res.studentId}&studentName=${encodeURIComponent(res.studentName || '')}`);
        }
      } else {
        setMsg(res.msg || '未找到学员');
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
        <div style={{ fontSize: 14, color: '#005387', marginBottom: 4 }}>意向学员缴费</div>
        <h1 style={{ margin: 0, color: '#005387', fontSize: 24 }}>查找学员并缴费</h1>
        <p style={{ marginTop: 8, fontSize: 14, color: '#666' }}>意向登记或已录入的学员姓名 + 家长手机号</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 14, color: '#333' }}>学员姓名</label>
          <input
            type="text"
            placeholder="选填，若该手机号只对应一名学员可不填"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            style={{ width: '100%', padding: 14, border: '1px solid #ddd', borderRadius: 10, fontSize: 16, boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 14, color: '#333' }}>家长手机号</label>
          <input
            type="tel"
            maxLength={11}
            placeholder="必填，老师登记的手机号"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={{ width: '100%', padding: 14, border: '1px solid #ddd', borderRadius: 10, fontSize: 16, boxSizing: 'border-box' }}
          />
        </div>
        <p style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>
          意向登记后或老师已录入学员后，在此填写即可提交缴费凭证。老师确认入账后，可用同一手机号在首页「我是家长，绑定手机号」登录。
        </p>

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
          {loading ? '查找中...' : '查找并去缴费'}
        </button>
      </form>

      <p style={{ marginTop: 24, textAlign: 'center' }}>
        <button type="button" onClick={() => navigate(-1)} style={{ background: 'none', border: 0, color: '#005387', cursor: 'pointer', fontSize: 14 }}>
          返回
        </button>
      </p>
      <p style={{ marginTop: 16, textAlign: 'center', fontSize: 14 }}>
        <a href="/" style={{ color: '#666' }}>返回首页</a>
        <span style={{ margin: '0 8px' }}>·</span>
        <a href="/bind" style={{ color: '#666' }}>家长绑定</a>
      </p>
    </div>
  );
}
