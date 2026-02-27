import { Router } from 'express';
import { find, getDoc, add, update } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

/** POST /api/payment/find-student — 缴费前查学员/意向 */
router.post('/find-student', async (req, res) => {
  try {
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

/** POST /api/payment/confirm — 意向缴费确认转正（仅 admin） */
router.post('/confirm', async (req, res) => {
  if (req.role !== 'admin') return res.json({ success: false, msg: 'Permission Denied' });
  try {
    const { paymentId, prospectiveId } = req.body || {};
    if (!paymentId || !prospectiveId) return res.json({ success: false, msg: '参数缺失' });

    const pay = await getDoc('Payment_logs', paymentId);
    if (!pay) return res.json({ success: false, msg: '缴费记录不存在' });
    const pros = await getDoc('Prospective_students', prospectiveId);
    if (!pros) return res.json({ success: false, msg: '意向记录不存在' });

    const initialLessons = Number(pay.amount_lessons) || 0;
    const studentName = pay.student_name || pros.name || '学员';

    const newStudent = await add('Students', {
      name: pros.name,
      age: pros.age,
      parent_phone: pros.phone,
      left_classes: initialLessons,
      enroll_date: new Date().toLocaleDateString(),
      remark: '缴费转正',
      parent_activated: true,
      createTime: new Date(),
    });
    const newStudentId = typeof newStudent === 'string' ? newStudent : newStudent?._id;

    await update('Payment_logs', paymentId, { student_id: newStudentId, status: 'confirmed', confirm_time: new Date().toLocaleString() });
    await update('Prospective_students', prospectiveId, { status: 'converted' });
    await add('Attendance_logs', {
      student_id: newStudentId,
      student_name: studentName,
      date: new Date().toLocaleDateString(),
      type: 'topup',
      note: `续费核销（意向转正）：￥${pay.price || 0} / +${initialLessons}课时`,
      lessons_deducted: -initialLessons,
      createTime: new Date(),
    });

    return res.json({ success: true, newStudentId });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
