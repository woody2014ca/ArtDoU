import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dataGet } from '../api';

export default function Index() {
  const { role, myStudentId, loading, refresh } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState({
    isLoading: true,
    itemList: [],
    stats: { monthLogs: 0, totalAssets: 0, pendingCount: 0, pendingEnroll: 0 },
  });

  useEffect(() => {
    if (role === 'parent' && myStudentId) {
      navigate(`/parent?id=${myStudentId}`, { replace: true });
      return;
    }
    if (role === 'parent') {
      navigate('/parent', { replace: true });
      return;
    }
    if (role === 'admin' || role === 'teacher') {
      fetchCloudData();
      return;
    }
    setState((s) => ({ ...s, isLoading: false }));
  }, [role, myStudentId]);

  async function fetchCloudData() {
    try {
      const [sRes, lRes, aRes, pRes] = await Promise.all([
        dataGet('Students', 'all'),
        dataGet('Leave_requests', 'all'),
        dataGet('Attendance_logs', 'all'),
        dataGet('Prospective_students', 'all'),
      ]);
      const students = (sRes.success && sRes.data) ? sRes.data : [];
      const logs = (aRes.success && aRes.data) ? aRes.data : [];
      const requests = (lRes.success && lRes.data) ? lRes.data : [];
      const enrolls = (pRes.success && pRes.data) ? pRes.data : [];
      const now = new Date();
      const monthLogs = logs.filter((log) => {
        const d = new Date(log.date || log.createTime);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }).length;
      const totalAssets = students.reduce((acc, cur) => acc + (Number(cur.left_classes) || 0), 0);
      const pendingLeave = requests.filter((i) => i.status === 0).length;
      const pendingEnroll = enrolls.filter((i) => i.status === 'pending').length;
      setState((s) => ({
        ...s,
        isLoading: false,
        itemList: students,
        stats: { monthLogs, totalAssets, pendingCount: pendingLeave, pendingEnroll },
      }));
    } catch (e) {
      setState((s) => ({ ...s, isLoading: false }));
    }
  }

  if (loading || state.isLoading) {
    return (
      <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#999' }}>
        加载中...
      </div>
    );
  }

  const isAdmin = role === 'admin' || role === 'teacher';

  if (!isAdmin) {
    return (
      <div style={{ maxWidth: 400, margin: '40px auto', padding: 24, textAlign: 'center' }}>
        <h2 style={{ color: '#005387' }}>ArtDoU</h2>
        <p style={{ color: '#666', marginBottom: 24 }}>家长入口 / Parent Entry</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button onClick={() => navigate('/pay/find')} style={{ padding: 16, background: '#005387', color: '#fff', border: 0, borderRadius: 8, cursor: 'pointer', fontSize: 16 }}>
            意向学员缴费
          </button>
          <button onClick={() => navigate('/bind')} style={{ padding: 16, background: '#fff', color: '#005387', border: '2px solid #005387', borderRadius: 8, cursor: 'pointer', fontSize: 16 }}>
            我是家长，绑定手机号
          </button>
        </div>
        <p style={{ marginTop: 24, fontSize: 14, color: '#888' }}>请点击上方按钮完成缴费或绑定</p>
        <p style={{ marginTop: 16 }}>
          <button onClick={() => navigate('/login')} style={{ padding: '8px 16px', background: '#f0f0f0', border: 0, borderRadius: 8, cursor: 'pointer' }}>老师登录</button>
        </p>
      </div>
    );
  }

  const goToLogin = () => navigate('/login');
  const goAdd = () => navigate('/student/add');
  const goEnroll = () => navigate('/enroll');
  const goEnrollList = () => navigate('/enroll/list');
  const goFinance = () => navigate('/finance');
  const handleCheckin = (id, name) => navigate(`/checkin?id=${id}&name=${encodeURIComponent(name || '')}`);

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 16, paddingBottom: 40 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0, color: '#005387', fontSize: 22 }}>ArtDoU</h1>
        <button onClick={goToLogin} style={{ padding: '8px 16px', background: '#f0f0f0', border: 0, borderRadius: 8, cursor: 'pointer' }}>
          老师登录
        </button>
      </div>

      <section onClick={goFinance} style={{ background: 'linear-gradient(135deg,#005387 0%,#0077b6 100%)', color: '#fff', borderRadius: 12, padding: 20, marginBottom: 20, cursor: 'pointer' }}>
        <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.9 }}>本月消课</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{state.stats.monthLogs}</div>
          </div>
          <div style={{ width: 1, background: 'rgba(255,255,255,0.3)' }} />
          <div>
            <div style={{ fontSize: 12, opacity: 0.9 }}>余课总计</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{state.stats.totalAssets}</div>
          </div>
        </div>
        <div style={{ marginTop: 12, fontSize: 14, opacity: 0.9 }}>财务 / FINANCE →</div>
      </section>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <button onClick={goAdd} style={{ flex: 1, padding: 16, background: '#005387', color: '#fff', border: 0, borderRadius: 10, cursor: 'pointer' }}>
          + 新学员
        </button>
        <button onClick={goEnroll} style={{ flex: 1, padding: 16, background: '#fff', color: '#005387', border: '2px solid #005387', borderRadius: 10, cursor: 'pointer', position: 'relative' }}>
          + 意向登记
          {state.stats.pendingEnroll > 0 && (
            <span style={{ position: 'absolute', right: 12, top: 12, width: 10, height: 10, background: '#ff4d4f', borderRadius: '50%' }} />
          )}
        </button>
      </div>

      <p onClick={goEnrollList} style={{ fontSize: 14, color: '#005387', marginBottom: 16, cursor: 'pointer' }}>
        管理意向名单 / PROSPECTIVE LIST →
      </p>

      <h3 style={{ fontSize: 16, marginBottom: 12 }}>学员名录 / Directory</h3>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {(state.itemList || []).map((item) => (
          <li key={item._id} style={{ background: '#fff', borderRadius: 10, padding: 16, marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#005387', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                {(item.name || '?')[0]}
              </div>
              <div>
                <div style={{ fontWeight: 600 }}>{item.name}</div>
                <div style={{ fontSize: 14, color: '#666' }}>
                  余课 / Lessons: <span style={{ color: Number(item.left_classes) === 0 ? '#c00' : '' }}>{item.left_classes}</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => handleCheckin(item._id, item.name)}
              style={{ padding: '8px 16px', background: '#005387', color: '#fff', border: 0, borderRadius: 8, cursor: 'pointer' }}
            >
              消课
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
