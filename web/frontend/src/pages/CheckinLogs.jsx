import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dataGet } from '../api';

function formatTime(log) {
  const raw = log.date || log.createTime;
  if (!raw) return '—';
  try {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return String(raw);
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(raw);
  }
}

/** 仅统计老师「消课」提交的记录：扣课时为负数 */
function isLessonCheckin(log) {
  const n = Number(log.change_num);
  return !Number.isNaN(n) && n < 0;
}

export default function CheckinLogs() {
  const [searchParams] = useSearchParams();
  const studentId = (searchParams.get('id') || '').trim();
  const { role } = useAuth();
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [studentName, setStudentName] = useState('');
  const [loading, setLoading] = useState(true);
  const isTeacher = role === 'admin' || role === 'teacher';

  useEffect(() => {
    if (!isTeacher) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const [logRes, stuRes] = await Promise.all([
          dataGet('Attendance_logs', 'all'),
          studentId ? dataGet('Students', studentId) : Promise.resolve({ success: false }),
        ]);
        const all = (logRes.success && logRes.data) ? logRes.data : [];
        let list = all.filter(isLessonCheckin);
        if (studentId) {
          list = list.filter((l) => String(l.student_id) === studentId);
        }
        list.sort((a, b) => {
          const ta = new Date(a.date || a.createTime || 0).getTime();
          const tb = new Date(b.date || b.createTime || 0).getTime();
          return tb - ta;
        });
        setLogs(list);
        if (stuRes.success && stuRes.data?.name) setStudentName(stuRes.data.name);
        else if (studentId && list[0]?.student_name) setStudentName(list[0].student_name);
      } catch {
        setLogs([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [isTeacher, studentId]);

  const title = useMemo(() => {
    if (studentId && studentName) return `${studentName} · 消课记录`;
    if (studentId) return '学员消课记录';
    return '消课记录';
  }, [studentId, studentName]);

  if (!isTeacher) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p>仅老师可查看消课记录。</p>
        <p><Link to="/">返回首页</Link></p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: 20, paddingBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, color: '#005387', fontSize: 20 }}>{title}</h1>
        <button
          type="button"
          onClick={() => navigate(studentId ? `/checkin?id=${encodeURIComponent(studentId)}&name=${encodeURIComponent(studentName || '')}` : '/')}
          style={{ padding: '8px 14px', background: '#f0f0f0', border: 0, borderRadius: 8, cursor: 'pointer', fontSize: 14 }}
        >
          {studentId ? '去消课' : '返回'}
        </button>
      </div>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: '#888' }}>
        以下为历次消课时间与节数（按时间倒序）
      </p>

      {loading ? (
        <p style={{ color: '#888' }}>加载中...</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {logs.length === 0 ? (
            <li style={{ padding: 32, textAlign: 'center', color: '#888', background: '#fafafa', borderRadius: 12 }}>
              暂无消课记录
            </li>
          ) : (
            logs.map((item) => (
              <li
                key={item._id || `${item.student_id}-${item.date}-${item.change_num}`}
                style={{
                  padding: '14px 16px',
                  marginBottom: 10,
                  background: '#fff',
                  borderRadius: 10,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  {!studentId && (
                    <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4, color: '#333' }}>
                      {item.student_name || '学员'}
                    </div>
                  )}
                  <div style={{ fontSize: 14, color: '#666' }}>{formatTime(item)}</div>
                </div>
                <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                  <div
                    style={{
                      padding: '8px 14px',
                      background: '#e8f4fc',
                      color: '#005387',
                      borderRadius: 8,
                      fontWeight: 700,
                      fontSize: 16,
                    }}
                  >
                    {Math.abs(Number(item.change_num) || 0)} 节
                  </div>
                  {item._id && (
                    <button
                      type="button"
                      onClick={() => navigate(`/checkin/edit/${item._id}`)}
                      style={{ padding: '4px 10px', fontSize: 13, background: '#fff', color: '#005387', border: '1px solid #005387', borderRadius: 6, cursor: 'pointer' }}
                    >
                      编辑
                    </button>
                  )}
                </div>
              </li>
            ))
          )}
        </ul>
      )}

      <p style={{ marginTop: 28, fontSize: 14 }}>
        <Link to="/" style={{ color: '#005387' }}>← 返回教室首页</Link>
        {studentId && (
          <>
            {' · '}
            <Link to="/checkin-logs" style={{ color: '#005387' }}>查看全部学员消课</Link>
          </>
        )}
      </p>
    </div>
  );
}
