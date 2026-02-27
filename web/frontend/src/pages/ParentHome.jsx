import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dataGet } from '../api';

export default function ParentHome() {
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id') || '';
  const { role, myStudentId, loading } = useAuth();
  const [student, setStudent] = useState(null);
  const [works, setWorks] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  const studentId = id || myStudentId;

  useEffect(() => {
    if (!studentId) {
      setLoadingData(false);
      return;
    }
    (async () => {
      try {
        const [sRes, lRes] = await Promise.all([
          dataGet('Students', studentId),
          dataGet('Attendance_logs', 'all', { search_student_id: studentId }),
        ]);
        if (sRes.success && sRes.data) setStudent(sRes.data);
        if (lRes.success && Array.isArray(lRes.data)) setWorks(lRes.data.filter((w) => w.type !== 'topup' && (w.photo_url || w.note)));
      } finally {
        setLoadingData(false);
      }
    })();
  }, [studentId]);

  if (loading || (role !== 'parent' && !id)) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        {loading ? '加载中...' : '请先绑定家长或使用分享链接进入'}
      </div>
    );
  }

  if (!studentId) {
    return (
      <div style={{ maxWidth: 400, margin: '40px auto', padding: 24, textAlign: 'center' }}>
        <p>未识别到学员，请先<a href="/bind">绑定手机号</a>或通过老师分享的链接进入。</p>
        <p><a href="/">返回首页</a></p>
      </div>
    );
  }

  const name = (student && student.name) ? student.name : '学员';
  const left = (student && student.left_classes != null) ? student.left_classes : '-';

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 16, paddingBottom: 40 }}>
      <h1 style={{ color: '#005387', fontSize: 22 }}>家长端 · {name}</h1>
      {loadingData ? (
        <p>加载中...</p>
      ) : (
        <>
          <div style={{ background: '#f0f9ff', borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 14, color: '#666' }}>剩余课时</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#005387' }}>{left}</div>
          </div>
          <section>
            <h3 style={{ fontSize: 16 }}>上课记录 / 作品</h3>
            {works.length === 0 ? (
              <p style={{ color: '#888', fontSize: 14 }}>暂无记录</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {works.slice(0, 20).map((w) => (
                  <li key={w._id} style={{ padding: '12px 0', borderBottom: '1px solid #eee', fontSize: 14 }}>
                    <span style={{ color: '#666' }}>{w.date}</span>
                    {w.note && <span style={{ marginLeft: 8 }}>{w.note}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <p style={{ marginTop: 24, fontSize: 14 }}>
            <a href="/">返回首页</a>
          </p>
        </>
      )}
    </div>
  );
}
