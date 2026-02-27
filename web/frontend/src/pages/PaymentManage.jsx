import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dataGet, dataUpdate, dataIncrement, dataAdd, paymentConfirm } from '../api';

export default function PaymentManage() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [confirming, setConfirming] = useState(null);
  const isAdmin = role === 'admin' || role === 'teacher';

  const fetchPayments = async () => {
    if (!isAdmin) return setLoading(false);
    setLoading(true);
    try {
      const res = await dataGet('Payment_logs', 'all');
      const data = (res.success && res.data) ? res.data : [];
      const pending = data.filter((i) => i.status === 'pending');
      pending.sort((a, b) => new Date(b.create_time || 0) - new Date(a.create_time || 0));
      setList(pending);
    } catch (e) {
      setMsg('加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [role]);

  const confirmProspective = async (item) => {
    if (!item.prospective_id) return;
    if (!window.confirm(`确认为意向学员「${item.student_name}」入账 ￥${item.price}，增加 ${item.amount_lessons} 课时，并转为正式学员吗？`)) return;
    setConfirming(item._id);
    try {
      const res = await paymentConfirm(item._id, item.prospective_id);
      if (res.success) {
        setMsg('已转正并入账');
        fetchPayments();
      } else setMsg(res.msg || '操作失败');
    } catch (e) {
      setMsg('操作失败');
    } finally {
      setConfirming(null);
    }
  };

  const confirmRegular = async (item) => {
    if (item.prospective_id) return confirmProspective(item);
    if (!window.confirm(`确认收到 ${item.student_name} 的缴费 ￥${item.price} 并增加 ${item.amount_lessons} 课时吗？`)) return;
    setConfirming(item._id);
    try {
      await dataIncrement('Students', item.student_id, Number(item.amount_lessons));
      await dataUpdate('Payment_logs', item._id, { status: 'confirmed', confirm_time: new Date().toLocaleString() });
      await dataAdd('Attendance_logs', {
        student_id: item.student_id,
        student_name: item.student_name,
        date: new Date().toLocaleDateString(),
        type: 'topup',
        note: `续费核销：￥${item.price} / +${item.amount_lessons}课时`,
        lessons_deducted: -Number(item.amount_lessons),
      });
      await dataUpdate('Students', item.student_id, { parent_activated: true });
      setMsg('核销成功');
      fetchPayments();
    } catch (e) {
      setMsg('操作失败');
    } finally {
      setConfirming(null);
    }
  };

  if (!isAdmin) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p>仅老师可管理缴费。</p>
        <p><a href="/">返回首页</a></p>
      </div>
    );
  }

  const formatTime = (item) => {
    const t = item.create_time || item.createTime;
    if (!t) return '近期提交';
    const d = new Date(t);
    return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 20 }}>
      <h1 style={{ color: '#005387', fontSize: 22, marginBottom: 24 }}>待确认缴费</h1>
      {msg && <p style={{ color: '#0a0', fontSize: 14, marginBottom: 12 }}>{msg}</p>}
      {loading ? (
        <p>加载中...</p>
      ) : list.length === 0 ? (
        <p style={{ color: '#666' }}>暂无待确认缴费</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {list.map((item) => (
            <li key={item._id} style={{ background: '#fff', padding: 16, marginBottom: 10, borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ marginBottom: 8 }}>
                <strong>{item.student_name}</strong>
                <span style={{ marginLeft: 8, color: '#666', fontSize: 14 }}>￥{item.price} / +{item.amount_lessons} 课时</span>
              </div>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>{formatTime(item)} {item.prospective_id ? '（意向转正）' : ''}</div>
              <button type="button" disabled={!!confirming} onClick={() => confirmRegular(item)} style={{ padding: '8px 16px', background: '#005387', color: '#fff', border: 0, borderRadius: 6, cursor: confirming ? 'wait' : 'pointer', fontSize: 14 }}>
                {confirming === item._id ? '处理中...' : item.prospective_id ? '确认转正并入账' : '确认入账'}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p style={{ marginTop: 24 }}><a href="/">返回首页</a> · <a href="/finance">财务</a></p>
    </div>
  );
}
