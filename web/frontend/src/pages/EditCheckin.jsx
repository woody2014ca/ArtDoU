import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dataGet, checkinAmend } from '../api';

const MAX_FILE_BYTES = 1 * 1024 * 1024;
const MAX_SIDE_PX = 1600;
const JPEG_QUALITY = 0.8;

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (file.size <= MAX_FILE_BYTES) {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
      return;
    }
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (w >= h) {
        if (w > MAX_SIDE_PX) {
          h = Math.round((h * MAX_SIDE_PX) / w);
          w = MAX_SIDE_PX;
        }
      } else if (h > MAX_SIDE_PX) {
        w = Math.round((w * MAX_SIDE_PX) / h);
        h = MAX_SIDE_PX;
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(objectUrl);
      try {
        resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('图片加载失败'));
    };
    img.src = objectUrl;
  });
}

export default function EditCheckin() {
  const { logId } = useParams();
  const { role } = useAuth();
  const navigate = useNavigate();
  const isTeacher = role === 'admin' || role === 'teacher';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [loadError, setLoadError] = useState('');
  const [studentId, setStudentId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [count, setCount] = useState('1');
  const [brief, setBrief] = useState('');
  const [memo, setMemo] = useState('');
  const [workImages, setWorkImages] = useState([]);

  useEffect(() => {
    if (!logId || !isTeacher) {
      setLoading(false);
      return;
    }
    dataGet('Attendance_logs', logId).then((res) => {
      if (!res.success || !res.data) {
        setLoadError('记录不存在或无权查看');
        setLoading(false);
        return;
      }
      const log = res.data;
      const cn = Number(log.change_num);
      if (Number.isNaN(cn) || cn >= 0) {
        setLoadError('该条不是上课消课记录，无法在此编辑');
        setLoading(false);
        return;
      }
      setStudentId(log.student_id || '');
      setStudentName(log.student_name || '学员');
      setCount(String(Math.abs(cn)));
      setBrief(log.brief ?? '');
      setMemo(log.memo ?? '');
      let imgs = [];
      if (Array.isArray(log.work_imgs) && log.work_imgs.length) imgs = [...log.work_imgs];
      else if (log.photo_url) imgs = [log.photo_url];
      else if (log.work_img) imgs = [log.work_img];
      setWorkImages(imgs);
      setLoading(false);
    });
  }, [logId, isTeacher]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const num = Number(count);
    if (!num || num < 1) {
      setMsg('请输入有效消课节数');
      return;
    }
    setMsg('');
    setSaving(true);
    try {
      const res = await checkinAmend(logId, {
        lessons: num,
        work_imgs: workImages,
        brief,
        memo,
      });
      if (!res.success) {
        setMsg(res.msg || res.error || '保存失败');
        setSaving(false);
        return;
      }
      navigate('/finance', { replace: true });
    } catch (err) {
      setMsg(err.message || '网络异常');
    } finally {
      setSaving(false);
    }
  };

  if (!isTeacher) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p>仅教师可编辑消课记录</p>
        <Link to="/">返回</Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>加载中...</div>
    );
  }

  if (loadError) {
    return (
      <div style={{ maxWidth: 480, margin: '40px auto', padding: 20, textAlign: 'center' }}>
        <p style={{ color: '#c00' }}>{loadError}</p>
        <p><Link to="/finance">返回财务</Link> · <Link to="/">首页</Link></p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 20 }}>
      <h1 style={{ margin: '0 0 8px', color: '#005387', fontSize: 22 }}>编辑消课</h1>
      <p style={{ color: '#666', fontSize: 15, marginBottom: 20 }}>{studentName}</p>
      <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 14 }}>消课课时（修改后会同步调整学员余课）</label>
            <input
              type="number"
              min={1}
              max={99}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              style={{ width: '100%', padding: 12, border: '1px solid #ddd', borderRadius: 8 }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 14 }}>作品照片（可删可增）</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {workImages.map((url, idx) => (
                <div key={idx} style={{ position: 'relative', width: 80, height: 80, borderRadius: 8, overflow: 'hidden', border: '1px solid #eee' }}>
                  <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button
                    type="button"
                    onClick={() => setWorkImages((prev) => prev.filter((_, i) => i !== idx))}
                    style={{
                      position: 'absolute',
                      right: 4,
                      top: 4,
                      width: 22,
                      height: 22,
                      padding: 0,
                      borderRadius: '50%',
                      border: 0,
                      background: 'rgba(0,0,0,0.6)',
                      color: '#fff',
                      cursor: 'pointer',
                    }}
                    aria-label="删除"
                  >
                    ×
                  </button>
                </div>
              ))}
              <label
                style={{
                  width: 80,
                  height: 80,
                  border: '2px dashed #ddd',
                  borderRadius: 8,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#fafafa',
                }}
              >
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
                  onChange={(e) => {
                    const files = e.target.files;
                    if (!files?.length) return;
                    Promise.all(Array.from(files).map((f) => fileToDataUrl(f)))
                      .then((urls) => setWorkImages((prev) => [...prev, ...urls]))
                      .catch(() => setMsg('图片处理失败'));
                    e.target.value = '';
                  }}
                />
                <span style={{ color: '#999', fontSize: 24 }}>+</span>
              </label>
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 14 }}>课堂简评（海报展示）</label>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="可清空"
              rows={3}
              style={{ width: '100%', padding: 12, border: '1px solid #ddd', borderRadius: 8 }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 14 }}>教师备忘</label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="可清空"
              rows={3}
              style={{ width: '100%', padding: 12, border: '1px solid #ddd', borderRadius: 8 }}
            />
          </div>
          {msg && <p style={{ color: '#c00', fontSize: 14 }}>{msg}</p>}
          <button
            type="submit"
            disabled={saving}
            style={{
              width: '100%',
              padding: 14,
              background: '#005387',
              color: '#fff',
              border: 0,
              borderRadius: 10,
              cursor: saving ? 'wait' : 'pointer',
              fontSize: 16,
            }}
          >
            {saving ? '保存中...' : '保存修改'}
          </button>
      </form>

      <p style={{ marginTop: 24 }}>
        <Link to="/finance">财务流水</Link>
        {' · '}
        <Link to="/">首页</Link>
      </p>
    </div>
  );
}
