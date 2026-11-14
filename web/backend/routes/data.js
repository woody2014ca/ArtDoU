import { Router } from 'express';
import { getDb, find, getDoc, add, update, remove, incrementLeftClasses, toId } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { presentAttendance, IMAGE_FIELDS } from '../media.js';
import {galleryProjection,presentGallery} from '../gallery.js';

const router = Router();

/** 列表页不需要作品大图，排除后可从百 MB 降到 KB */
const ATTENDANCE_LITE_PROJECTION = {
  _image_refs_v1: 0,
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
// Internal transaction journals and share tokens are never generic CRUD data.
const publicCollections = new Set(['Students', 'Attendance_logs', 'Payment_logs', 'Leave_requests', 'Prospective_students']);
router.use('/:collection', (req, res, next) => {
  if (!publicCollections.has(req.params.collection)) return res.status(403).json({success:false,msg:'该数据不能通过通用接口访问'});
  if (!['admin','parent','guest'].includes(req.role)) return res.status(403).json({success:false,msg:'身份无效'});
  if (req.role === 'parent' && !['Students','Attendance_logs','Payment_logs','Leave_requests'].includes(req.params.collection) && req.method === 'GET') return res.status(403).json({success:false,msg:'无权查看该资料'});
  return next();
});

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
    if (userRole === 'parent' && (!myStudentId || (searchStudentId && String(searchStudentId) !== String(myStudentId)))) {
      return res.status(403).json({ success: false, msg: '无权查看该学员资料' });
    }

    const docId = (id === 'all' || !id) ? null : id;
    const isShareView = collection === 'Attendance_logs' && searchStudentId && (docId === 'all' || !docId);
    if (userRole === 'guest') {
      return res.status(401).json({ success: false, msg: '请登录，或使用新版作品分享链接' });
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
      const gallery = collection === 'Attendance_logs' && req.query.view === 'gallery';
      const projection = gallery ? galleryProjection : wantLite ? ATTENDANCE_LITE_PROJECTION : null;
      const limitRaw = Number(req.query.limit);
      const defaultLimit = collection === 'Attendance_logs' ? 500 : 100;
      const limit = Math.min(Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : defaultLimit, 1000);
      // 消课记录含大图，库内 sort 易超内存；取回后在应用层按时间倒序
      const list = await find(collection, filter, limit, projection);
      if (collection === 'Attendance_logs') {
        list.sort((a, b) => {
          const ta = new Date(a.createTime || a.date || 0).getTime();
          const tb = new Date(b.createTime || b.date || 0).getTime();
          return tb - ta;
        });
      }
      res.set('Cache-Control', 'private, no-store');
      return res.json({ success: true, data: gallery ? list.map(doc=>presentGallery(doc,req)) : collection === 'Attendance_logs' ? list.map(doc => presentAttendance(doc, req)) : list });
    }

    const one = await getDoc(collection, docId);
    if (userRole === 'parent' && one && String(collection === 'Students' ? one._id : one.student_id) !== String(myStudentId)) {
      return res.status(403).json({ success: false, msg: '无权查看该学员资料' });
    }
    res.set('Cache-Control', 'private, no-store');
    return res.json({ success: true, data: collection === 'Attendance_logs' && one ? presentAttendance(one, req) : one });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/** POST /api/data/:collection — 新增 */
router.post('/:collection', async (req, res) => {
  if (req.params.collection === 'Payment_logs') return res.status(409).json({success:false,msg:'请使用新版缴费提交入口'});
  try {
    if (process.env.CHECKIN_ATOMIC_ENABLED === '1' && req.params.collection === 'Attendance_logs' && (Number(req.body?.change_num) < 0 || IMAGE_FIELDS.some(field => Object.hasOwn(req.body || {}, field)))) return res.status(409).json({success:false,msg:'请使用新版消课入口'});
    if (!getDb()) return res.json({ success: false, msg: '未配置数据库，仅支持老师登录' });
    const { collection } = req.params;
    const data = req.body || {};
    if (collection === 'Payment_logs' && (data.status !== 'pending' || Object.keys(data).some(k => k.startsWith('_') || ['confirm_time', 'updateTime'].includes(k)))) return res.status(400).json({success:false,msg:'缴费凭证只能以待确认状态提交'});
    const userRole = req.role;
    const isParentRequesting = userRole === 'parent' && collection === 'Leave_requests';
    const isPaymentLogByGuest = collection === 'Payment_logs';
    const isProspectiveByShare = collection === 'Prospective_students' && (userRole === 'guest' || userRole === 'parent');
    if (userRole !== 'admin' && !isParentRequesting && !isPaymentLogByGuest && !isProspectiveByShare) {
      return res.json({ success: false, msg: 'Permission Denied' });
    }
    const payload = { ...data, createTime: new Date() };
    if (isParentRequesting) {
      if (!req.myStudentId || String(data.student_id) !== String(req.myStudentId)) return res.status(403).json({success:false,msg:'只能为已绑定学员请假'});
      const student = await getDoc('Students', req.myStudentId);
      if (!student) return res.status(409).json({success:false,msg:'学员档案不存在，请联系老师'});
      if (typeof data.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.date) || typeof data.reason !== 'string' || data.reason.length > 2000) return res.status(400).json({success:false,msg:'请假日期或说明格式不正确'});
      Object.keys(payload).forEach(k => delete payload[k]);
      Object.assign(payload,{student_id:String(student._id),student_name:student.name || '学员',date:data.date,reason:data.reason,status:0,createTime:new Date()});
    }
    if (isProspectiveByShare) {
      if (data.status !== 'pending' || typeof data.name !== 'string' || !data.name.trim() || data.name.length > 100 || typeof data.phone !== 'string' || data.phone.length > 50) return res.status(400).json({success:false,msg:'报名信息格式不正确'});
      Object.keys(payload).forEach(k => delete payload[k]);
      for (const key of ['name','phone','age','level','note','referrer','source','referrer_id']) {
        if (data[key] !== undefined) {
          if (typeof data[key] !== 'string' || data[key].length > 2000) return res.status(400).json({success:false,msg:'报名信息格式不正确'});
          payload[key] = data[key];
        }
      }
      payload.status='pending';payload.createTime=new Date();
    }
    const newId = await add(collection, payload);
    return res.json({ success: true, _id: newId });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/** PATCH /api/data/:collection/:id — 更新 */
router.patch('/:collection/:id', async (req, res) => {
  if (req.role !== 'admin') return res.json({ success: false, msg: 'Permission Denied' });
  if (req.params.collection === 'Payment_logs') return res.status(409).json({success:false,msg:'缴费入账请使用确认入口，原始凭证继续保留'});
  try {
    if (process.env.CHECKIN_ATOMIC_ENABLED === '1' && req.params.collection === 'Attendance_logs') return res.status(409).json({success:false,msg:'请使用新版消课编辑入口'});
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
  if (req.params.collection === 'Attendance_logs') return res.status(409).json({success:false,msg:'历史流水不支持直接删除；消课请使用撤销并保留作品'});
  if (req.params.collection === 'Payment_logs') return res.status(409).json({success:false,msg:'缴费凭证不支持直接删除'});
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
