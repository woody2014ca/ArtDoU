import { ObjectId } from 'mongodb';
import { createHash } from 'node:crypto';
import { runTransaction, ensureDb } from './db.js';

function submissionKey(body) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(body?.operationId || '')) throw fail(400, '缺少有效提交编号');
  return `payment:${body.operationId.toLowerCase()}`;
}
function target(body, actor) {
  const prospective = body?.prospective_id;
  const sid = prospective || body?.student_id;
  if (typeof sid !== 'string' || !sid || sid.length > 200 || (prospective && body.student_id)) throw fail(400, '学员信息无效');
  if (actor.role !== 'admin' && !prospective && (actor.role !== 'parent' || String(actor.studentId) !== sid)) throw fail(403, '请先绑定对应学员');
  return { field: prospective ? 'prospective_id' : 'student_id', id: sid };
}
export async function recoverPaymentSubmission(body, actor) {
  const key = submissionKey(body), t = target(body, actor), db = await ensureDb();
  const doc = await db.collection('Payment_logs').findOne({ _id: key });
  if (!doc) return { success: true, completed: false };
  // A submission key alone never grants access to payment details.
  if (doc._submission_target !== `${t.field}:${t.id}`) throw fail(409, '提交编号与学员不匹配');
  const canRead = actor.role === 'admin' || (actor.role === 'parent' && t.field === 'student_id' && String(actor.studentId) === t.id);
  return { success: true, completed: true, _id: key, ...(canRead ? { summary: { amount_lessons: doc.amount_lessons, price: doc.price, proof_note: doc.proof_note || '', status: doc.status } } : {}) };
}
export async function submitPayment(body, actor) {
  const key = submissionKey(body), t = target(body, actor);
  const count = body.amount_lessons, price = body.price, note = body.proof_note || '';
  if (!Number.isInteger(count) || count < 1 || count > 9999 || typeof price !== 'number' || !Number.isFinite(price) || price < 0 || typeof note !== 'string' || note.length > 2000) throw fail(400, '课时、金额或说明格式不正确');
  const payload = { [t.field]: t.id, amount_lessons: count, price, proof_note: note };
  const hash = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  return runTransaction(async (db, session) => {
    const col = db.collection('Payment_logs'), existing = await col.findOne({ _id: key }, { session });
    if (existing) {
      if (existing._submission_hash !== hash) throw fail(409, '该提交编号已用于不同内容，请先恢复上次提交结果');
      return { success: true, _id: key, alreadySubmitted: true };
    }
    const record = await lookup(db, t.field === 'prospective_id' ? 'Prospective_students' : 'Students', t.id, session);
    if (!record || (t.field === 'prospective_id' && record.status !== 'pending')) throw fail(409, '学员记录不存在或意向已转正，请联系老师核对');
    const now = new Date();
    await col.insertOne({ _id: key, ...payload, student_name: record.name || '学员', status: 'pending', createTime: now, create_time: now.toISOString(), _submission_hash: hash, _submission_target: `${t.field}:${t.id}` }, { session });
    return { success: true, _id: key };
  });
}

const fail = (status, message) => Object.assign(new Error(message), { status });
async function lookup(db, name, id, session) {
  if (typeof id !== 'string' || !id || id.length > 200) throw fail(400, '记录编号无效');
  const col = db.collection(name);
  if (/^[a-f0-9]{24}$/i.test(id)) {
    const doc = await col.findOne({ _id: new ObjectId(id) }, { session });
    if (doc) return doc;
  }
  return col.findOne({ _id: id }, { session });
}
let failureHook;
export function setPaymentFailureHookForTest(hook) {
  if (process.env.NODE_ENV !== 'test') throw new Error('Test hook disabled');
  failureHook = hook;
}

// The payment document is the durable idempotency key. Its status and all
// balances/logs commit together; concurrent confirmations retry the snapshot.
export async function confirmPayment({ paymentId, prospectiveId } = {}) {
  return runTransaction(async (db, session) => {
    const pay = await lookup(db, 'Payment_logs', paymentId, session);
    if (!pay) throw fail(404, '缴费记录不存在');
    if (prospectiveId && String(pay.prospective_id || '') !== prospectiveId) throw fail(409, '缴费与意向记录不匹配');
    if (pay.status === 'confirmed') {
      if (!pay._confirmation_v1) throw fail(409, '该历史缴费已确认，请人工核对，系统不会再次加课');
      return { success: true, newStudentId: String(pay.student_id), alreadyConfirmed: true };
    }
    if (pay.status !== 'pending') throw fail(409, '仅可确认待入账缴费');
    const count = pay.amount_lessons;
    if (!Number.isInteger(count) || count < 1 || count > 9999 || typeof pay.price !== 'number' || !Number.isFinite(pay.price) || pay.price < 0) throw fail(400, '缴费金额或课时不正确，请先核对原始记录');
    const now = new Date();
    let student, pros;
    if (pay.prospective_id) {
      pros = await lookup(db, 'Prospective_students', String(pay.prospective_id), session);
      if (!pros || pros.status !== 'pending') throw fail(409, '意向记录不存在或已转正，请人工核对');
      student = { _id: new ObjectId(), name: pros.name || pay.student_name || '学员', age: pros.age, parent_phone: pros.phone, left_classes: count, enroll_date: now.toISOString(), remark: '缴费转正', parent_activated: true, createTime: now };
      await db.collection('Students').insertOne(student, { session });
      await db.collection('Prospective_students').updateOne({ _id: pros._id }, { $set: { status: 'converted', student_id: String(student._id), updateTime: now } }, { session });
    } else {
      student = await lookup(db, 'Students', String(pay.student_id || ''), session);
      if (!student) throw fail(409, '学员档案不存在，请先核对；缴费记录继续保留');
      if (typeof student.left_classes !== 'number' || !Number.isFinite(student.left_classes)) throw fail(409, '余课格式异常，请先核对');
      await db.collection('Students').updateOne({ _id: student._id }, { $inc: { left_classes: count }, $set: { parent_activated: true, updateTime: now } }, { session });
    }
    await db.collection('Attendance_logs').insertOne({ student_id: String(student._id), student_name: student.name || '', payment_id: String(pay._id), type: 'topup', change_num: count, lessons_deducted: -count, note: `续费核销：$${pay.price} / +${count}课时`, date: now.toISOString(), createTime: now }, { session });
    if (pros?.referrer_id) {
      const referrer = await lookup(db, 'Students', String(pros.referrer_id), session);
      if (referrer) {
        if (typeof referrer.left_classes !== 'number' || !Number.isFinite(referrer.left_classes)) throw fail(409, '介绍人余课格式异常，请先核对');
        await db.collection('Students').updateOne({ _id: referrer._id }, { $inc: { left_classes: 1 } }, { session });
        await db.collection('Attendance_logs').insertOne({ student_id: String(referrer._id), student_name: referrer.name || '', payment_id: String(pay._id), type: 'reward', change_num: 1, note: '分享有奖 +1 课时', date: now.toISOString(), createTime: now }, { session });
      }
    }
    await failureHook?.();
    await db.collection('Payment_logs').updateOne({ _id: pay._id }, { $set: { student_id: String(student._id), status: 'confirmed', confirm_time: now.toISOString(), _confirmation_v1: true, updateTime: now } }, { session });
    return { success: true, newStudentId: String(student._id) };
  });
}
