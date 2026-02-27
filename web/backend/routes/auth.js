import { Router } from 'express';
import { getDb, find, getDoc, add, update } from '../db.js';
import { signToken, authMiddleware } from '../middleware/auth.js';

const router = Router();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';

/** GET /api/auth/init — 同小程序 init：返回当前身份，可选带 token */
router.get('/init', authMiddleware, async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.json({ success: false, msg: 'Database not connected' });
    let isAuditModeFromDB = true;
    try {
      const config = await getDoc('configs', 'system_config');
      if (config && config.isAuditMode === false) isAuditModeFromDB = false;
    } catch (e) {}
    res.json({
      success: true,
      role: req.role,
      myStudentId: req.myStudentId,
      isAuditOpen: isAuditModeFromDB,
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/** POST /api/auth/login — 管理员登录（密码与 ADMIN_PASSWORD 一致即签发 admin token） */
router.post('/login', async (req, res) => {
  const { password } = req.body || {};
  if (password === ADMIN_PASSWORD) {
    const token = signToken({ role: 'admin' });
    return res.json({ success: true, role: 'admin', token });
  }
  res.status(401).json({ success: false, msg: '密码错误' });
});

/** POST /api/auth/bind — 家长绑定：手机号匹配已缴费学员后签发 parent token */
router.post('/bind', async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(500).json({ success: false, msg: 'Database not connected' });
    const phoneRaw = String(req.body?.phone || '').trim();
    if (!phoneRaw) return res.json({ success: false, msg: '请输入手机号' });
    const phoneNorm = phoneRaw.replace(/\D/g, '');
    if (phoneNorm.length < 8) return res.json({ success: false, msg: '手机号格式有误' });

    const students = await find('Students', { parent_activated: true }, 100);
    const found = students.find((s) => String(s.parent_phone || '').replace(/\D/g, '') === phoneNorm);
    if (!found) return res.json({ success: false, msg: '未找到已缴费的家长，请核对手机号或联系老师' });

    const studentId = found._id;
    // Web 无 openid，可选：在 Parent_bindings 里记一条 web 绑定（用 parent_phone + student_id）
    const existing = await find('Parent_bindings', { student_id: studentId }, 20);
    const samePhone = existing.find((b) => String(b.parent_phone || '').replace(/\D/g, '') === phoneNorm);
    const payload = { student_id: studentId, parent_phone: phoneRaw, updateTime: new Date() };
    if (samePhone) {
      await update('Parent_bindings', samePhone._id, payload);
    } else {
      await add('Parent_bindings', { ...payload, createTime: new Date() });
    }

    const token = signToken({ role: 'parent', myStudentId: studentId });
    return res.json({ success: true, role: 'parent', myStudentId: studentId, token });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
