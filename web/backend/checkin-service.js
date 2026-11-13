import { ObjectId } from 'mongodb';
import { ensureDb, runTransaction } from './db.js';
import { prepareAttendanceImages, imageHash } from './media.js';
const fail = (status,message) => Object.assign(new Error(message),{status});
function canonical(value) {
  if(Array.isArray(value)) return value.map(canonical);
  if(value && Object.getPrototypeOf(value)===Object.prototype) return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));
  return value;
}
const digest = value => imageHash(JSON.stringify(canonical(value)));
async function lookup(db,name,id,session) {
  const col=db.collection(name),options=session?{session}:{};
  if(typeof id==='string' && /^[a-f0-9]{24}$/i.test(id)) {const doc=await col.findOne({_id:new ObjectId(id)},options);if(doc)return doc;}
  return col.findOne({_id:id},options);
}
function operation(body) {
  if(!body || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(body.operationId||'')) throw fail(400,'缺少有效提交编号，请刷新页面后重试');
  return `checkin:${body.operationId}`;
}
function lessons(value) {if(!Number.isInteger(value)||value<1||value>99)throw fail(400,'消课节数须为1到99的整数');return value;}
function previousResult(previous,hash) {if(previous.requestHash!==hash)throw fail(409,'该提交编号已用于不同内容，请刷新后重新提交');return previous.result;}
let failureHook;
export function setCheckinFailureHookForTest(hook) {if(process.env.NODE_ENV!=='test')throw new Error('Test hook disabled');failureHook=hook;}
export async function saveCheckin(kind,recordId,body) {
  if(process.env.CHECKIN_ATOMIC_ENABLED!=='1') throw fail(503,'新版消课服务尚未启用');
  const operationId=operation(body),count=lessons(body.lessons);
  if(!['create','amend'].includes(kind))throw fail(400,'无效操作');
  const requestHash=digest({kind,recordId:recordId||null,body});
  const db=await ensureDb();
  const previous=await db.collection('Checkin_operations').findOne({_id:operationId});
  if(previous)return previousResult(previous,requestHash);
  let original=null;
  if(kind==='amend') {
    original=await lookup(db,'Attendance_logs',recordId);
    if(!original)throw fail(404,'记录不存在');
    if(original.voided)throw fail(409,'该消课已撤销，历史与作品继续保留');
    if(!(Number(original.change_num)<0))throw fail(400,'仅可修改消课记录');
    if(!Number.isInteger(body.baseVersion)||body.baseVersion<0||(original._edit_version||0)!==body.baseVersion)throw fail(409,'记录已更新，请刷新后重试');
  } else if(typeof body.student_id!=='string'||!body.student_id)throw fail(400,'缺少学员编号');
  const patch={};
  for(const key of ['brief','memo','teacher_notes']) {
    if(body[key]!==undefined) {if(typeof body[key]!=='string'||body[key].length>10000)throw fail(400,'备注格式或长度不正确');patch[key]=body[key];}
    else if(!original)patch[key]='';
  }
  for(const key of ['work_imgs','photo_url','work_img','work_photo'])if(Object.hasOwn(body,key))patch[key]=body[key];
  if(body.work_imgs!==undefined) {if(!Array.isArray(body.work_imgs))throw fail(400,'作品图片须为数组');patch.photo_url=body.work_imgs[0]||'';}
  // Decode and verify remote objects before entering a database transaction.
  const prepared=await prepareAttendanceImages(patch,original);
  const note=String(patch.brief??original?.brief??patch.teacher_notes??original?.teacher_notes??'').trim();
  const logId=kind==='create'?new ObjectId():original._id;
  return runTransaction(async(database,session)=>{
    const operations=database.collection('Checkin_operations');
    const done=await operations.findOne({_id:operationId},{session});if(done)return previousResult(done,requestHash);
    let studentId=body.student_id,current=null;
    if(original) {
      current=await lookup(database,'Attendance_logs',recordId,session);
      if(!current || digest(current)!==digest(original))throw fail(409,'记录已更新，请刷新后重试');
      studentId=current.student_id;
    }
    const student=await lookup(database,'Students',studentId,session);
    const delta=current?Math.abs(Number(current.change_num))-count:-count;
    if(!student && (!current||delta!==0))throw fail(409,'历史学员档案不存在，不能改动余课；历史记录仍保留');
    if(student && delta!==0) {
      const result=await database.collection('Students').updateOne({_id:student._id},{$inc:{left_classes:delta}},{session});
      if(result.matchedCount!==1)throw fail(409,'学员档案已变化');
    }
    if(current) {
      const updated=await database.collection('Attendance_logs').updateOne({_id:current._id},{$set:{...prepared,change_num:-count,note,updateTime:new Date(),_edit_version:body.baseVersion+1}},{session});
      if(updated.matchedCount!==1)throw fail(409,'记录已变化');
    } else {
      await database.collection('Attendance_logs').insertOne({_id:logId,...prepared,student_id:student._id.toString(),student_name:student.name||'',change_num:-count,note,date:new Date().toISOString(),createTime:new Date(),_edit_version:0},{session});
    }
    await failureHook?.();
    const result={success:true,_id:String(logId),version:current?body.baseVersion+1:0};
    await operations.insertOne({_id:operationId,requestHash,result,createTime:new Date()},{session});
    return result;
  });
}

export async function voidCheckin(recordId,body) {
  if(process.env.CHECKIN_ATOMIC_ENABLED!=='1')throw fail(503,'新版消课服务尚未启用');
  const operationId=operation(body),requestHash=digest({kind:'void',recordId,body});
  if(typeof body.reason!=='string'||!body.reason.trim()||body.reason.length>1000)throw fail(400,'请填写1至1000字的撤销原因');
  if(!Number.isInteger(body.baseVersion)||body.baseVersion<0)throw fail(400,'缺少记录版本，请刷新');
  return runTransaction(async(db,session)=>{
    const operations=db.collection('Checkin_operations');const done=await operations.findOne({_id:operationId},{session});
    if(done)return previousResult(done,requestHash);
    const log=await lookup(db,'Attendance_logs',recordId,session);
    if(!log)throw fail(404,'记录不存在');
    if(log.voided)return {success:true,_id:String(log._id),voided:true,alreadyVoided:true,version:log._edit_version||0};
    const refund=Math.abs(Number(log.change_num));
    if(!(Number(log.change_num)<0)||!Number.isInteger(refund)||refund>99)throw fail(409,'仅可撤销有效消课记录，其他流水须另行核对');
    if((log._edit_version||0)!==body.baseVersion)throw fail(409,'记录已更新，请刷新后重试');
    const student=await lookup(db,'Students',log.student_id,session);
    if(!student)throw fail(409,'历史学员档案不存在，请先核对归属；记录与作品保持不变');
    await db.collection('Students').updateOne({_id:student._id},{$inc:{left_classes:refund}},{session});
    const now=new Date();
    await db.collection('Attendance_logs').updateOne({_id:log._id},{$set:{voided:true,voidedAt:now,voidReason:body.reason.trim(),voidRefundLessons:refund,_edit_version:body.baseVersion+1,updateTime:now}},{session});
    await failureHook?.();
    const result={success:true,_id:String(log._id),voided:true,version:body.baseVersion+1};
    await operations.insertOne({_id:operationId,requestHash,result,createTime:now},{session});return result;
  });
}
