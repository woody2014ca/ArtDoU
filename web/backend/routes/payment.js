import { Router } from 'express';
import { getDb, find } from '../db.js';
import { confirmPayment, submitPayment, recoverPaymentSubmission } from '../payment-service.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);
for (const [path, handler] of [['/submit', submitPayment], ['/submission/recover', recoverPaymentSubmission]]) {
  router.post(path, async (req, res) => {
    try { res.set('Cache-Control', 'no-store'); return res.json(await handler(req.body, { role: req.role, studentId: req.myStudentId })); }
    catch (e) { return res.status(e.status || 503).json({ success: false, msg: e.status ? e.message : '暂时无法确认提交结果，请重试同一笔提交' }); }
  });
}

const noDb = (res) => res.json({ success: false, msg: '未配置数据库，缴费功能暂不可用' });

/** POST /api/payment/find-student — 缴费前查学员/意向 */
router.post('/find-student', async (req, res) => {
  try {
    if (!getDb()) return noDb(res);
    const phoneRaw = String(req.body?.phone || '').trim();
    const studentNameRaw = String(req.body?.studentName || '').trim();
    if (!phoneRaw) return res.json({ success: false, msg: '请输入家长手机号' });
    const phoneNorm = phoneRaw.replace(/\D/g, '');
    if (phoneNorm.length < 8) return res.json({ success: false, msg: '手机号格式有误' });

    const prospectives = await find('Prospective_students', { status: 'pending' }, 200);
    const listP = prospectives.filter((p) => String(p.phone || '').replace(/\D/g, '') === phoneNorm);
    if (studentNameRaw) {
      const nameNorm = studentNameRaw.replace(/\s/g, '');
      const matchP = listP.find((p) => (String(p.name || '').replace(/\s/g, '') === nameNorm || (p.name || '').includes(studentNameRaw)));
      if (matchP) return res.json({ success: true, isProspective: true, prospectiveId: matchP._id, studentName: matchP.name || studentNameRaw });
    }
    if (listP.length === 1) return res.json({ success: true, isProspective: true, prospectiveId: listP[0]._id, studentName: listP[0].name || '学员' });
    if (listP.length > 1) return res.json({ success: false, msg: '该手机号对应多名意向学员，请同时输入学员姓名' });

    const allStudents = await find('Students', {}, 200);
    const list = allStudents.filter((s) => String(s.parent_phone || '').replace(/\D/g, '') === phoneNorm);
    if (studentNameRaw) {
      const nameNorm = studentNameRaw.replace(/\s/g, '');
      const matched = list.find((s) => (String(s.name || '').replace(/\s/g, '') === nameNorm || (s.name || '').includes(studentNameRaw)));
      if (matched) return res.json({ success: true, studentId: matched._id, studentName: matched.name || studentNameRaw });
      return res.json({ success: false, msg: '未找到该学员，请核对姓名与手机号或联系老师' });
    }
    if (list.length === 0) return res.json({ success: false, msg: '未找到该手机号对应的学员或意向，请联系老师' });
    if (list.length > 1) return res.json({ success: false, msg: '该手机号对应多名学员，请同时输入学员姓名' });
    return res.json({ success: true, studentId: list[0]._id, studentName: list[0].name || '学员' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/** Confirm regular or prospective payments atomically; admin only. */
router.post('/confirm', async (req, res) => {
  if (req.role !== 'admin') return res.status(403).json({ success: false, msg: 'Permission Denied' });
  try { return res.json(await confirmPayment(req.body)); }
  catch (e) { return res.status(e.status || 503).json({ success: false, msg: e.status ? e.message : '暂时无法确认入账结果，请使用同一缴费记录重试' }); }
});
export default router;
