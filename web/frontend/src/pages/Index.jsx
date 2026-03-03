import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dataGet } from '../api';

export default function Index() {
  const { role, myStudentId, loading, refresh, logout } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState({
    isLoading: true,
    itemList: [],
    allItems: [],
    stats: { monthLogs: 0, totalAssets: 0, pendingCount: 0, pendingEnroll: 0 },
  });
  const [sortBy, setSortBy] = useState('name'); // 'name' | 'left'

  // 家长与教室首页分离：家长登录后直接进入家长首页，老师进入下方教室工作台
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
      const sorted = [...students].sort((a, b) =>
          (a.name || '').localeCompare(b.name || '', 'zh-CN')
        );
        setState((s) => ({ ...s, isLoading: false, itemList: sorted, allItems: students, stats: { monthLogs, totalAssets, pendingCount: pendingLeave, pendingEnroll } }));
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
    const isParent = role === 'parent';
    return (
      <div style={{ maxWidth: 420, margin: '40px auto', padding: 28, textAlign: 'center' }}>
        <div style={{ fontSize: 28, fontWeight: 700, color: '#005387', letterSpacing: 2, marginBottom: 8 }}>ArtDoU</div>
        <p style={{ color: '#666', fontSize: 15, marginBottom: 12 }}>家长入口 / Parent Entry</p>
        <div style={{ marginBottom: 20, padding: '10px 14px', background: '#f5f5f5', borderRadius: 10, fontSize: 14, color: '#333', textAlign: 'left' }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>本机当前身份</div>
          {isParent ? (
            <div>家长（学员 ID: {String(myStudentId || '').slice(-6)}）</div>
          ) : (
            <div>未登录</div>
          )}
          <button type="button" onClick={() => { logout(); window.location.reload(); }} style={{ marginTop: 8, padding: '6px 12px', fontSize: 13, background: '#fff', border: '1px solid #ccc', borderRadius: 6, cursor: 'pointer' }}>
            {isParent ? '退出登录（清除本机家长身份）' : '清除本机身份'}
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <button
            type="button"
            onClick={() => navigate('/pay/find')}
            style={{ padding: 18, background: '#005387', color: '#fff', border: 0, borderRadius: 12, cursor: 'pointer', fontSize: 16, fontWeight: 500 }}
          >
            意向学员缴费
          </button>
          <button
            type="button"
            onClick={() => navigate('/bind')}
            style={{ padding: 18, background: '#fff', color: '#005387', border: '2px solid #005387', borderRadius: 12, cursor: 'pointer', fontSize: 16, fontWeight: 500 }}
          >
            我是家长，绑定手机号
          </button>
        </div>
        <p style={{ marginTop: 28, fontSize: 14, color: '#888', lineHeight: 1.5 }}>请点击上方按钮完成缴费或绑定，绑定后再打开即为家长端。</p>
        <p style={{ marginTop: 24, fontSize: 14 }}>
          <button type="button" onClick={() => navigate('/login')} style={{ padding: '10px 20px', background: '#f0f0f0', border: 0, borderRadius: 10, cursor: 'pointer', color: '#333' }}>
            老师登录
          </button>
        </p>
      </div>
    );
  }

  const goToLogin = () => navigate('/login');
  const handleLogout = () => { logout(); navigate('/', { replace: true }); };
  const goAdd = () => navigate('/student/add');
  const goEnroll = () => navigate('/enroll');
  const goEnrollList = () => navigate('/enroll/list');
  const goFinance = () => navigate('/finance');
  const goLeaveList = () => navigate('/leave/list');
  const handleCheckin = (id, name) => navigate(`/checkin?id=${id}&name=${encodeURIComponent(name || '')}`);
  const goToGallery = (id) => navigate(`/parent?id=${id}`);
  const goToEdit = (id) => navigate(`/student/edit/${id}`);

  const handleSort = (by) => {
    setSortBy(by);
    setState((s) => {
      const list = (s.allItems && s.allItems.length) ? s.allItems : s.itemList;
      const sorted = [...list].sort((a, b) =>
        by === 'name' ? (a.name || '').localeCompare(b.name || '', 'zh-CN') : (Number(b.left_classes) || 0) - (Number(a.left_classes) || 0)
      );
      return { ...s, itemList: sorted };
    });
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 16, paddingBottom: 40 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ margin: 0, color: '#005387', fontSize: 22 }}>ArtDoU</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" onClick={() => navigate('/parent')} style={{ padding: '8px 14px', background: 'transparent', color: '#005387', border: '1px solid #005387', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>
            家长入口
          </button>
          <button type="button" onClick={handleLogout} style={{ padding: '8px 16px', background: '#f0f0f0', border: 0, borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>
            退出
          </button>
        </div>
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

      {state.stats.pendingCount > 0 && (
        <div
          onClick={goLeaveList}
          role="button"
          style={{
            background: '#fff5f5',
            border: '1px solid #ff4d4f',
            borderRadius: 12,
            padding: '14px 16px',
            marginBottom: 16,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ color: '#c00', fontWeight: 600, fontSize: 14 }}>📋 待处理请假 {state.stats.pendingCount} 条</span>
          <span style={{ color: '#005387', fontSize: 14 }}>去处理 →</span>
        </div>
      )}
      <p onClick={goEnrollList} style={{ fontSize: 14, color: '#005387', marginBottom: 16, cursor: 'pointer', textAlign: 'center' }}>
        管理意向名单 / PROSPECTIVE LIST →
      </p>

      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <h3 style={{ fontSize: 16, margin: 0 }}>学员名录 / Directory</h3>
        <button type="button" onClick={() => handleSort('name')} style={{ padding: '4px 10px', fontSize: 12, background: sortBy === 'name' ? '#005387' : '#f0f0f0', color: sortBy === 'name' ? '#fff' : '#333', border: 0, borderRadius: 6, cursor: 'pointer' }}>姓名序</button>
        <button type="button" onClick={() => handleSort('left')} style={{ padding: '4px 10px', fontSize: 12, background: sortBy === 'left' ? '#005387' : '#e8e8e8', color: sortBy === 'left' ? '#fff' : '#666', border: 0, borderRadius: 6, cursor: 'pointer' }}>余课序</button>
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {(state.itemList || []).map((item) => (
          <li key={item._id} style={{ background: '#fff', borderRadius: 10, padding: 16, marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#005387', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>
                {(item.name || '?')[0]}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span>{item.name}</span>
                  <button type="button" onClick={() => goToGallery(item._id)} style={{ padding: 0, border: 0, background: 'none', color: '#005387', cursor: 'pointer', fontSize: 14, textDecoration: 'underline' }}>展厅</button>
                  <button type="button" onClick={() => goToEdit(item._id)} style={{ padding: 0, border: 0, background: 'none', color: '#666', cursor: 'pointer', fontSize: 14 }}>管理 / Edit</button>
                </div>
                <div style={{ fontSize: 14, color: '#666' }}>
                  余课 / Lessons: <span style={{ color: Number(item.left_classes) === 0 ? '#c00' : '' }}>{item.left_classes}</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => handleCheckin(item._id, item.name)}
              style={{ padding: '8px 16px', background: '#005387', color: '#fff', border: 0, borderRadius: 8, cursor: 'pointer', flexShrink: 0 }}
            >
              消课
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
