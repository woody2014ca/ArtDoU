import crypto from 'node:crypto';
import { ensureDb, toId } from './db.js';
import { rawImage, imageHash, IMAGE_FIELDS, parseImageGrant } from './media.js';
const fail=(status,message)=>Object.assign(new Error(message),{status});
export function requireShareOwner(req,studentId) {
  if(req.role!=='admin' && !(req.role==='parent' && req.myStudentId && String(req.myStudentId)===String(studentId))) throw fail(403,'无权管理该学员分享');
}
function studentFilter(id) {return /^[a-f0-9]{24}$/i.test(id)?{$or:[{student_id:id},{student_id:toId(id)}]}:{student_id:id};}
export async function createShare(req,studentId,ttlSeconds=604800,requestedUrls=null) {
  if(process.env.SECURE_SHARING_ENABLED!=='1')throw fail(503,'安全分享尚未启用');
  if(typeof studentId!=='string'||!studentId)throw fail(400,'缺少学员编号');
  requireShareOwner(req,studentId);
  let requestedHashes=null;
  if(requestedUrls!==null && requestedUrls!==undefined) {
    if(!Array.isArray(requestedUrls)||requestedUrls.length<1||requestedUrls.length>4)throw fail(400,'请选择1至4张作品');
    requestedHashes=requestedUrls.map(value=>{
      if(typeof value!=='string')throw fail(400,'无效作品');
      const grant=parseImageGrant(value);
      if(grant)return grant.sourceSha256;
      if(value.startsWith('data:image/'))return imageHash(value);
      throw fail(400,'作品链接已过期或无效，请刷新后重试');
    });
  }
  if(!Number.isInteger(ttlSeconds)||ttlSeconds<60||ttlSeconds>604800)throw fail(400,'分享有效期须为1分钟至7天');
  const db=await ensureDb();
  const candidates=await db.collection('Attendance_logs').find(studentFilter(studentId),{projection:{_id:1,createTime:1,date:1}}).limit(1000).toArray();
  candidates.sort((a,b)=>new Date(b.createTime||b.date||0)-new Date(a.createTime||a.date||0));
  const items=[];let displayName='学员';
  for(const candidate of candidates) {
    const doc=await db.collection('Attendance_logs').findOne({_id:candidate._id});
    if(!doc)continue;
    if(doc.student_name)displayName=String(doc.student_name).slice(0,80);
    const field=Array.isArray(doc.work_imgs)&&doc.work_imgs.length?'work_imgs':IMAGE_FIELDS.find(f=>typeof doc[f]==='string'&&doc[f]);
    if(!field)continue;
    const values=Array.isArray(doc[field])?doc[field]:[doc[field]];
    for(let index=0;index<values.length && items.length<(requestedHashes?requestedHashes.length:3);index++) {
      if(typeof values[index]!=='string'||!values[index])continue;
      if(requestedHashes && (!requestedHashes.includes(imageHash(values[index])) || items.some(item=>item.sourceSha256===imageHash(values[index]))))continue;
      items.push({recordId:doc._id,field,index,sourceSha256:imageHash(values[index]),date:doc.date||'',brief:String(doc.brief||'').slice(0,2000)});
    }
    if(items.length===(requestedHashes?new Set(requestedHashes).size:3))break;
  }
  if(requestedHashes) {
    if(new Set(requestedHashes).size!==items.length)throw fail(403,'选择的作品不属于该学员或已更新');
    items.sort((a,b)=>requestedHashes.indexOf(a.sourceSha256)-requestedHashes.indexOf(b.sourceSha256));
  }
  if(!items.length)throw fail(400,'暂无可分享作品');
  const token=crypto.randomBytes(32).toString('base64url');
  const expiresAt=new Date(Date.now()+ttlSeconds*1000);
  const result=await db.collection('Share_links').insertOne({tokenHash:imageHash(token),student_id:studentId,items,displayName,expiresAt,revoked:false,createTime:new Date()});
  return {id:String(result.insertedId),token,expiresAt};
}
export async function loadShare(token) {
  if(process.env.SECURE_SHARING_ENABLED!=='1'||typeof token!=='string'||!/^[\w-]{43}$/.test(token))throw fail(404,'分享不存在或已失效');
  const db=await ensureDb();
  const share=await db.collection('Share_links').findOne({tokenHash:imageHash(token),revoked:false,expiresAt:{$gt:new Date()}});
  if(!share)throw fail(404,'分享不存在或已失效');
  return share;
}
export async function sharedImage(share,position) {
  if(!Number.isInteger(position)||position<0||position>=share.items.length)throw fail(404,'图片不存在');
  const item=share.items[position];const db=await ensureDb();
  const doc=await db.collection('Attendance_logs').findOne({_id:item.recordId});
  const raw=rawImage(doc,item.field,item.index);
  if(!doc||String(doc.student_id)!==String(share.student_id)||typeof raw!=='string'||imageHash(raw)!==item.sourceSha256)throw fail(404,'图片已更新，请重新分享');
  return {doc,item};
}
