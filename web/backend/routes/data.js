import { Router } from 'express';
import { getDb, find, getDoc, add, update, remove, incrementLeftClasses, toId } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

/** GET /api/data/:collection/:id? — 教师/家长需登录；分享链接（仅查 Attendance_logs+search_student_id）允许未登录 */
router.get('/:collection/:id?', async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.json({ success: false, msg: '未配置数据库，仅支持老师登录' });
    const { collection, id } = req.params;
    const searchStudentId = req.query.search_student_id || req.body?.search_student_id;
    const data = { search_student_id: searchStudentId };
    const userRole = req.role;
    const myStudentId = req.myStudentId;

    const docId = (id === 'all' || !id) ? null : id;
    const isShareView = collection === 'Attendance_logs' && searchStudentId && (docId === 'all' || !docId);
    if (userRole === 'guest' && !isShareView) {
      return res.json({ success: false, msg: '请先登录' });
    }

    if (docId === 'all' || !docId) {
      let filter = {};
      if (collection === 'Attendance_logs' && data.search_student_id) {
        filter = { student_id: data.search_student_id };
      } else if (userRole === 'admin') {
        filter = {};
      } else {
        if (collection === 'Attendance_logs' && data.search_student_id) {
          filter = { student_id: data.search_student_id };
        } else {
          filter = collection === 'Students' ? { _id: toId(myStudentId) || myStudentId } : { student_id: myStudentId };
        }
      }
      const list = await find(collection, filter, 100);
      return res.json({ success: true, data: list });
    }

    const one = await getDoc(collection, docId);
    return res.json({ success: true, data: one });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/** POST /api/data/:collection — 新增 */
router.post('/:collection', async (req, res) => {
  try {
    if (!getDb()) return res.json({ success: false, msg: '未配置数据库，仅支持老师登录' });
    const { collection } = req.params;
    const data = req.body || {};
    const userRole = req.role;
    const isParentRequesting = userRole === 'parent' && collection === 'Leave_requests';
    const isPaymentLogByGuest = collection === 'Payment_logs';
    const isProspectiveByShare = collection === 'Prospective_students' && (userRole === 'guest' || userRole === 'parent');
    if (userRole !== 'admin' && !isParentRequesting && !isPaymentLogByGuest && !isProspectiveByShare) {
      return res.json({ success: false, msg: 'Permission Denied' });
    }
    const payload = { ...data, createTime: new Date() };
    const newId = await add(collection, payload);
    return res.json({ success: true, _id: newId });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/** PATCH /api/data/:collection/:id — 更新 */
router.patch('/:collection/:id', async (req, res) => {
  if (req.role !== 'admin') return res.json({ success: false, msg: 'Permission Denied' });
  try {
    if (!getDb()) return res.json({ success: false, msg: '未配置数据库，仅支持老师登录' });
    const { collection, id } = req.params;
    await update(collection, id, req.body || {});
    return res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/** DELETE /api/data/:collection/:id */
router.delete('/:collection/:id', async (req, res) => {
  if (req.role !== 'admin') return res.json({ success: false, msg: 'Permission Denied' });
  try {
    if (!getDb()) return res.json({ success: false, msg: '未配置数据库，仅支持老师登录' });
    const { collection, id } = req.params;
    await remove(collection, id);
    return res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/** POST /api/data/:collection/:id/increment — 课时增减 */
router.post('/:collection/:id/increment', async (req, res) => {
  if (req.role !== 'admin') return res.json({ success: false, msg: 'Permission Denied' });
  try {
    if (!getDb()) return res.json({ success: false, msg: '未配置数据库，仅支持老师登录' });
    const { collection, id } = req.params;
    const value = Number(req.body?.value) || 0;
    await incrementLeftClasses(collection, id, value);
    return res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
