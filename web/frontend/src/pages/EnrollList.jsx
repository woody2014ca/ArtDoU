import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dataGet, dataDelete } from '../api';

export default function EnrollList() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const isAdmin = role === 'admin' || role === 'teacher';

  const fetchList = async () => {
    if (!isAdmin) return setLoading(false);
    setLoading(true);
    try {
      const res = await dataGet('Prospective_students', 'all');
      const data = (res.success && res.data) ? res.data : [];
      const pending = data.filter((i) => i.status === 'pending');
      pending.sort((a, b) => new Date(b.createTime || 0) - new Date(a.createTime || 0));
      setList(pending);
    } catch (e) {
      setMsg('加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, [role]);

  const handleDelete = (item) => {
    if (!window.confirm('确定要删除这条意向记录吗？')) return;
    if (!isAdmin) return;
    dataDelete('Prospective_students', item._id).then((res) => {
      if (res.success) {
        setList((prev) => prev.filter((i) => i._id !== item._id));
        setMsg('已删除');
        setTimeout(() => setMsg(''), 1500);
      } else {
        setMsg(res.msg || '删除失败');
      }
    });
  };

  if (!isAdmin) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p>仅老师可查看意向名单。</p>
        <p><Link to="/">返回首页</Link></p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 20 }}>
      <h1 style={{ color: '#005387', fontSize: 22, marginBottom: 24 }}>意向名单</h1>
      {msg && <p style={{ color: '#0a0', fontSize: 14, marginBottom: 12 }}>{msg}</p>}
      {loading ? (
        <p>加载中...</p>
      ) : list.length === 0 ? (
        <p style={{ color: '#666' }}>暂无待处理意向</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {list.map((item) => (
            <li key={item._id} style={{ background: '#fff', padding: 16, marginBottom: 10, borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <strong>{item.name}</strong>
                {item.phone && <span style={{ marginLeft: 8, color: '#666', fontSize: 14 }}>{item.phone}</span>}
                {item.level && <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{item.level}</div>}
                {item.note && <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{item.note}</div>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => navigate('/payment/manage?prospectiveId=' + item._id)} style={{ padding: '6px 12px', background: '#005387', color: '#fff', border: 0, borderRadius: 6, cursor: 'pointer', fontSize: 14 }}>缴费确认</button>
                <button type="button" onClick={() => handleDelete(item)} style={{ padding: '6px 12px', background: '#fff', color: '#c00', border: '1px solid #c00', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}>删除</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p style={{ marginTop: 24 }}><Link to="/">返回首页</Link> · <Link to="/enroll">意向登记</Link></p>
    </div>
  );
}
