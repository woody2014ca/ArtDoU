import { Router } from 'express';
import { getDb, getDoc, update, incrementLeftClasses } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

function makePosterNote(text) {
  return String(text || '').trim();
}

const router = Router();
router.use(authMiddleware);

/** POST /api/checkin/amend/:id — 修改消课：课时数、作品图、简评与备忘（同步学员余课） */
router.post('/amend/:id', async (req, res) => {
  if (req.role !== 'admin') {
    return res.json({ success: false, msg: '仅教师可修改' });
  }
  try {
    if (!getDb()) return res.json({ success: false, msg: '未配置数据库' });
    const { id } = req.params;
    const log = await getDoc('Attendance_logs', id);
    if (!log) return res.json({ success: false, msg: '记录不存在' });
    const cn = Number(log.change_num);
    if (Number.isNaN(cn) || cn >= 0) {
      return res.json({ success: false, msg: '仅可修改上课消课记录' });
    }
    const oldLessons = Math.abs(cn);
    const newLessons = Number(req.body?.lessons);
    if (!Number.isFinite(newLessons) || newLessons < 1 || newLessons > 99) {
      return res.json({ success: false, msg: '消课节数须在 1～99' });
    }
    const sid = log.student_id;
    if (!sid) return res.json({ success: false, msg: '缺少学员信息' });

    const deltaStudent = oldLessons - newLessons;
    if (deltaStudent !== 0) {
      await incrementLeftClasses('Students', sid, deltaStudent);
    }

    let work_imgs;
    if (Array.isArray(req.body.work_imgs)) {
      work_imgs = req.body.work_imgs.filter((u) => typeof u === 'string' && u.length > 0);
    } else {
      work_imgs = Array.isArray(log.work_imgs) ? [...log.work_imgs] : [];
      if (!work_imgs.length && (log.photo_url || log.work_img)) {
        work_imgs = [log.photo_url || log.work_img].filter(Boolean);
      }
    }

    const brief = req.body.brief !== undefined ? String(req.body.brief) : (log.brief ?? '');
    const memo = req.body.memo !== undefined ? String(req.body.memo) : (log.memo ?? '');
    const teacher_notes =
      req.body.teacher_notes !== undefined ? String(req.body.teacher_notes) : (log.teacher_notes ?? '');

    await update('Attendance_logs', id, {
      change_num: -newLessons,
      work_imgs,
      brief,
      memo,
      teacher_notes,
      note: makePosterNote(brief || teacher_notes),
      photo_url: work_imgs.length ? work_imgs[0] : '',
    });
    return res.json({ success: true });
  } catch (e) {
    console.error('[checkin amend]', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
