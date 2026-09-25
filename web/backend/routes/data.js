import { Router } from 'express';
import { getDb, find, getDoc, add, update, remove, incrementLeftClasses, toId } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

/** 列表页不需要作品大图，排除后可从百 MB 降到 KB */
const ATTENDANCE_LITE_PROJECTION = {
  work_imgs: 0,
  work_img: 0,
  work_photo: 0,
  photo_url: 0,
};

function isHexObjectIdString(id) {
  return typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id);
}

/** student_id 可能是 string 或 ObjectId，查询时兼容两者 */
function studentIdFilter(sid) {
  if (!sid) return {};
  if (isHexObjectIdString(sid)) {
    return { $or: [{ student_id: sid }, { student_id: toId(sid) }] };
  }
  return { student_id: sid };
}

router.use(authMiddleware);

/** GET /api/data/:collection/:id? — 教师/家长需登录；分享链接（仅查 Attendance_logs+search_student_id）允许未登录 */
router.get('/:collection/:id?', async (req, res) => {
  try {
    if (!process.env.MONGODB_URI && !process.env.MONGO_URL) {
      return res.json({ success: false, msg: '未配置数据库，仅支持老师登录' });
    }
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
        filter = studentIdFilter(data.search_student_id);
      } else if (userRole === 'admin') {
        filter = {};
      } else {
        if (collection === 'Attendance_logs' && data.search_student_id) {
          filter = studentIdFilter(data.search_student_id);
        } else {
          filter = collection === 'Students' ? { _id: toId(myStudentId) || myStudentId } : studentIdFilter(myStudentId);
        }
      }
      const wantLite =
        collection === 'Attendance_logs' &&
        (req.query.lite === '1' || req.query.lite === 'true' || (!data.search_student_id && req.query.full !== '1' && req.query.full !== 'true'));
      const projection = wantLite ? ATTENDANCE_LITE_PROJECTION : null;
      const limitRaw = Number(req.query.limit);
      const defaultLimit = collection === 'Attendance_logs' ? 500 : 100;
      const limit = Math.min(Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : defaultLimit, 1000);
      const sort =
        collection === 'Attendance_logs'
          ? { createTime: -1, date: -1 }
          : null;
      const list = await find(collection, filter, limit, projection, sort);
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
