import WorkImage from '../components/WorkImage';
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dataGet, checkinAmend, checkinVoid } from '../api';
import useCheckinSubmission from '../hooks/useCheckinSubmission';

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
  const [showVoid, setShowVoid] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const { logId } = useParams();
  const { role } = useAuth();
  const navigate = useNavigate();
  const isTeacher = role === 'admin' || role === 'teacher';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  /** 本条记录已扣课时，删除时需退回学员余课 */
  const [deductedLessons, setDeductedLessons] = useState(0);
  const [msg, setMsg] = useState('');
  const [loadError, setLoadError] = useState('');
  const [studentId, setStudentId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [count, setCount] = useState('1');
  const [brief, setBrief] = useState('');
  const [memo, setMemo] = useState('');
  const [workImages, setWorkImages] = useState([]);
  const submission = useCheckinSubmission(`amend:${logId}`);
  const [baseVersion, setBaseVersion] = useState(0);
  const voidSubmission = useCheckinSubmission(`void:${logId}`);

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
      if (log.voided) { setLoadError('该消课已撤销，原历史与作品继续保留，请在流水中查看。'); setLoading(false); return; }
      setBaseVersion(log._edit_version || 0);
      const cn = Number(log.change_num);
      if (Number.isNaN(cn) || cn >= 0) {
        setLoadError('该条不是上课消课记录，无法在此编辑');
        setLoading(false);
        return;
      }
      setStudentId(log.student_id || '');
      setStudentName(log.student_name || '学员');
      const abs = Math.abs(cn);
      setDeductedLessons(abs);
      setCount(String(abs));
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
      const recovered = await submission.recover();
      if (recovered) { submission.finish(); alert('上次修改已保存，本次未重复处理。'); navigate('/finance', { replace: true }); return; }
      const res = await checkinAmend(logId, {
        operationId: submission.remember(),
        baseVersion,
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
      submission.finish();
      navigate('/finance', { replace: true });
    } catch (err) {
      setMsg(err.message || '网络异常');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const reason = voidReason;
    if (!reason || !reason.trim()) return;
    setMsg(''); setDeleting(true);
    try {
      const recovered = await voidSubmission.recover();
      if (recovered) { voidSubmission.finish(); navigate('/finance', { replace: true }); return; }
      const result = await checkinVoid(logId, { operationId: voidSubmission.remember(), baseVersion, reason: reason.trim() });
      if (!result.success) { setMsg(result.msg || '撤销失败'); return; }
      voidSubmission.finish(); navigate('/finance', { replace: true });
    } catch (error) { setMsg(error.message || '暂时无法撤销，请使用原提交重试'); }
    finally { setDeleting(false); }
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
                  <WorkImage src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
            disabled={saving || deleting}
            style={{
              width: '100%',
              padding: 14,
              background: '#005387',
              color: '#fff',
              border: 0,
              borderRadius: 10,
              cursor: saving || deleting ? 'wait' : 'pointer',
              fontSize: 16,
            }}
          >
            {saving ? '保存中...' : '保存修改'}
          </button>
      </form>

      <button
        type="button"
        onClick={() => setShowVoid(true)}
        disabled={saving || deleting}
        style={{
          width: '100%',
          marginTop: 14,
          padding: 14,
          background: '#fff',
          color: '#c00',
          border: '1px solid #c00',
          borderRadius: 10,
          cursor: saving || deleting ? 'not-allowed' : 'pointer',
          fontSize: 16,
        }}
      >
        {deleting ? '处理中...' : '撤销消课（保留作品）'}
      </button>

      {showVoid && <section style={{marginTop:16,padding:16,border:'1px solid #c00',borderRadius:10}}>
        <p>确认撤销这条已保存的消课？课时将退回，原记录、作品和评语继续保留。</p>
        <label htmlFor="void-reason">撤销原因</label>
        <textarea id="void-reason" value={voidReason} onChange={e=>setVoidReason(e.target.value)} maxLength={1000} rows={3} style={{display:'block',width:'100%',boxSizing:'border-box',margin:'8px 0'}} />
        <button type="button" onClick={handleDelete} disabled={saving || deleting || !voidReason.trim()}>{deleting ? '处理中…' : '确认撤销并退回课时'}</button>
        <button type="button" onClick={()=>setShowVoid(false)} disabled={deleting} style={{marginLeft:12}}>取消</button>
      </section>}

      <p style={{ marginTop: 24 }}>
        <Link to="/finance">财务流水</Link>
        {' · '}
        <Link to="/">首页</Link>
      </p>
    </div>
  );
}


