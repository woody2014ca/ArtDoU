import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dataGet, paymentConfirm } from '../api';

export default function PaymentManage() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prospectiveIdHint = searchParams.get('prospectiveId') || '';
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [confirming, setConfirming] = useState(null);
  const [confirmItem, setConfirmItem] = useState(null);
  const [loadError, setLoadError] = useState('');
  const isAdmin = role === 'admin' || role === 'teacher';

  const fetchPayments = async () => {
    if (!isAdmin) return setLoading(false);
    setLoading(true); setLoadError('');
    try {
      const res = await dataGet('Payment_logs', 'all');
      if (!res.success || !Array.isArray(res.data)) throw new Error(res.msg || '无法读取缴费记录');
      const data = res.data;
      const pending = data.filter((i) => i.status === 'pending');
      pending.sort((a, b) => new Date(b.create_time || 0) - new Date(a.create_time || 0));
      setList(pending);

      // 从意向名单误跳到本页：若该意向尚无待确认缴费，引导去入账转正页
      if (prospectiveIdHint) {
        const matched = pending.filter((p) => String(p.prospective_id) === String(prospectiveIdHint));
        if (matched.length === 0) {
          const pros = await dataGet('Prospective_students', prospectiveIdHint);
          const name = (pros.success && pros.data && pros.data.name) || '学员';
          navigate(
            `/payment?prospectiveId=${encodeURIComponent(prospectiveIdHint)}&studentName=${encodeURIComponent(name)}`,
            { replace: true }
          );
        }
      }
    } catch (e) {
      setLoadError('缴费记录加载失败，请刷新重试；请勿据此判断没有待确认缴费。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [role, prospectiveIdHint]);

  const confirmProspective = async (item) => {
    if (!item.prospective_id) return;
    setConfirming(item._id);
    try {
      const res = await paymentConfirm(item._id, item.prospective_id);
      if (res.success) {
        setConfirmItem(null);
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
    setConfirming(item._id);
    try {
      const result = await paymentConfirm(item._id);
      if (!result.success) { setMsg(result.msg || '确认失败，请重试同一缴费记录'); return; }
      setConfirmItem(null);
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
        <p><Link to="/">返回首页</Link></p>
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
      {confirmItem && <section style={{padding:16,border:'1px solid #005387',borderRadius:10,marginBottom:16}}>
        <p>请核实已收到 {confirmItem.student_name} 的缴费：$ {confirmItem.price}，增加 {confirmItem.amount_lessons} 课时{confirmItem.prospective_id ? '，并转为正式学员' : ''}。</p>
        <button type="button" disabled={Boolean(confirming)} onClick={()=>confirmRegular(confirmItem)}>确认已收款并入账</button>
        <button type="button" disabled={Boolean(confirming)} onClick={()=>setConfirmItem(null)} style={{marginLeft:12}}>取消</button>
      </section>}
      {loadError ? <p role="alert" style={{color:'#c00'}}>{loadError}</p> : loading ? (
        <p>加载中...</p>
      ) : list.length === 0 ? (
        <p style={{ color: '#666' }}>暂无待确认缴费</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {list.map((item) => (
            <li key={item._id} style={{ background: '#fff', padding: 16, marginBottom: 10, borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ marginBottom: 8 }}>
                <strong>{item.student_name}</strong>
                <span style={{ marginLeft: 8, color: '#666', fontSize: 14 }}>${item.price} / +{item.amount_lessons} 课时</span>
              </div>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>{formatTime(item)} {item.prospective_id ? '（意向转正）' : ''}</div>
              <button type="button" disabled={!!confirming} onClick={() => setConfirmItem(item)} style={{ padding: '8px 16px', background: '#005387', color: '#fff', border: 0, borderRadius: 6, cursor: confirming ? 'wait' : 'pointer', fontSize: 14 }}>
                {confirming === item._id ? '处理中...' : item.prospective_id ? '确认转正并入账' : '确认入账'}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p style={{ marginTop: 24 }}><Link to="/">返回首页</Link> · <Link to="/finance">财务</Link></p>
    </div>
  );
}
