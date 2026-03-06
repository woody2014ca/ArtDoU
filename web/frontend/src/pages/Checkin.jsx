import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dataGet, dataAdd, dataIncrement } from '../api';

function makePosterNote(text) {
  return String(text || '').trim();
}

/** 单张超过此大小则自动缩小并压成 JPEG，避免 request entity too large */
const MAX_FILE_BYTES = 1 * 1024 * 1024; // 1MB 以上即压缩
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
      if (w > MAX_SIDE_PX || h > MAX_SIDE_PX) {
        if (w >= h) {
          h = Math.round((h * MAX_SIDE_PX) / w);
          w = MAX_SIDE_PX;
        } else {
          w = Math.round((w * MAX_SIDE_PX) / h);
          h = MAX_SIDE_PX;
        }
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

export default function Checkin() {
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id') || '';
  const nameFromQuery = searchParams.get('name') || '';
  const { role } = useAuth();
  const navigate = useNavigate();
  const isRealStudent = id && !id.startsWith('demo');
  const [name, setName] = useState(nameFromQuery || '学员');
  const [count, setCount] = useState('1');
  const [remark, setRemark] = useState('');
  const [brief, setBrief] = useState('');
  const [memo, setMemo] = useState('');
  const [workImages, setWorkImages] = useState([]); // array of data URLs
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (isRealStudent && id && !nameFromQuery) {
      dataGet('Students', id).then((res) => {
        if (res.success && res.data && res.data.name) setName(res.data.name);
      });
    }
  }, [id, isRealStudent, nameFromQuery]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!count || Number(count) < 1) { setMsg('请输入消课数量'); return; }
    setMsg('');
    if (!isRealStudent) { setMsg('请从学员名录进入'); return; }
    if (role !== 'admin' && role !== 'teacher') { setMsg('仅老师可操作'); return; }
    setLoading(true);
    try {
      const num = Number(count);
      const payload = {
        student_id: id, student_name: name, change_num: -num,
        teacher_notes: remark || '', brief: brief || '', memo: memo || '',
        note: makePosterNote(brief || remark || ''), date: new Date().toISOString(),
      };
      if (workImages.length > 0) {
        payload.work_imgs = workImages;
        payload.photo_url = workImages[0];
      }
      const addRes = await dataAdd('Attendance_logs', payload);
      if (!addRes.success) { setMsg(addRes.msg || addRes.error || '写入记录失败'); setLoading(false); return; }
      const incRes = await dataIncrement('Students', id, -num);
      if (!incRes.success) { setMsg(incRes.msg || '扣减课时失败'); setLoading(false); return; }
      navigate('/parent?id=' + id, { replace: true });
    } catch (err) { setMsg(err.message || '网络异常'); } finally { setLoading(false); }
  };

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 20 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, color: '#005387', fontSize: 22 }}>{name}</h1>
        <p style={{ margin: '4px 0', color: '#666', fontSize: 14 }}>{isRealStudent ? 'CLASS CHECK-IN' : 'ASSET VERIFICATION'}</p>
      </div>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 14 }}>{isRealStudent ? '消课课时' : '核销数量'}</label>
          <input type="number" min="1" value={count} onChange={(e) => setCount(e.target.value)} style={{ width: '100%', padding: 12, border: '1px solid #ddd', borderRadius: 8 }} />
        </div>
        {isRealStudent && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 14 }}>作品记录 / Artwork（可多张）</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-start' }}>
              {workImages.map((url, idx) => (
                <div key={idx} style={{ position: 'relative', width: 80, height: 80, borderRadius: 8, overflow: 'hidden', border: '1px solid #eee' }}>
                  <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  <button type="button" onClick={() => setWorkImages((prev) => prev.filter((_, i) => i !== idx))} style={{ position: 'absolute', right: 4, top: 4, width: 22, height: 22, padding: 0, borderRadius: '50%', border: 0, background: 'rgba(0,0,0,0.6)', color: '#fff', cursor: 'pointer', fontSize: 14, lineHeight: 1 }} aria-label="删除">×</button>
                </div>
              ))}
              <label style={{ width: 80, height: 80, border: '2px dashed #ddd', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa', flexShrink: 0 }}>
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
                      .catch(() => setMsg('图片处理失败，请换一张或缩小后重试'));
                    e.target.value = '';
                  }}
                />
                <span style={{ color: '#999', fontSize: 24 }}>+</span>
              </label>
            </div>
            {workImages.length > 0 && <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>已选 {workImages.length} 张</div>}
          </div>
        )}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 14 }}>{isRealStudent ? '课堂简评' : '备注'}</label>
          <textarea value={isRealStudent ? brief : remark} onChange={(e) => (isRealStudent ? setBrief(e.target.value) : setRemark(e.target.value))} placeholder={isRealStudent ? '课堂简评（用于海报）' : '请输入'} rows={3} style={{ width: '100%', padding: 12, border: '1px solid #ddd', borderRadius: 8 }} />
        </div>
        {isRealStudent && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 14 }}>教师备忘</label>
            <textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="仅内部" rows={4} style={{ width: '100%', padding: 12, border: '1px solid #ddd', borderRadius: 8 }} />
          </div>
        )}
        {msg && <p style={{ color: '#c00', fontSize: 14, marginBottom: 12 }}>{msg}</p>}
        <button type="submit" disabled={loading} style={{ width: '100%', padding: 14, background: '#005387', color: '#fff', border: 0, borderRadius: 10, cursor: loading ? 'wait' : 'pointer', fontSize: 16 }}>{loading ? '提交中...' : isRealStudent ? '确认消课' : '确认核销'}</button>
      </form>
      <p style={{ marginTop: 24 }}><Link to="/">返回首页</Link></p>
    </div>
  );
}
