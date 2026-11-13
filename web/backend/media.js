import crypto from 'node:crypto';
import sharp from 'sharp';
import { signToken, verifyToken, verifyExpiredImageGrant } from './middleware/auth.js';

export const IMAGE_FIELDS = ['work_imgs','photo_url','work_img','work_photo'];
export const imageHash = value => crypto.createHash('sha256').update(value).digest('hex');
const enabled = () => process.env.IMAGE_STORAGE_MODE === 'dual';
let injectedStore = null;
let storePromise;
export function setMediaStoreForTest(store) {
  if (process.env.NODE_ENV !== 'test') throw new Error('Test adapter disabled');
  injectedStore = store;
}
export async function mediaStore() {
  if (injectedStore) return injectedStore;
  if (!enabled()) throw Object.assign(new Error('图片存储尚未启用'),{status:503});
  if (!storePromise) storePromise = import('./r2-store.js').then(m=>m.createR2Store()).catch(e=>{storePromise=null;throw e;});
  return storePromise;
}
export function rawImage(doc, field, index) {
  if (!IMAGE_FIELDS.includes(field) || !Number.isInteger(index) || index<0) return null;
  return Array.isArray(doc?.[field]) ? doc[field][index] : index===0 ? doc?.[field] : null;
}
export function imageGrant(doc,field,index) {
  const raw = rawImage(doc,field,index);
  if(typeof raw!=='string') throw new Error('Missing image');
  return signToken({purpose:'artdou-image',recordId:String(doc._id),field,index,sourceSha256:imageHash(raw)},'5m');
}
export function parseImageGrant(value, allowExpired = false) {
  try {
    const url = new URL(value,'https://invalid.local');
    if(!url.pathname.endsWith('/api/media/image')) return null;
    const grant=(allowExpired ? verifyExpiredImageGrant : verifyToken)(url.searchParams.get('grant')||'');
    return grant?.purpose==='artdou-image' ? grant : null;
  } catch {return null;}
}
export async function resolveImageBytes(doc, field, index) {
  const value=rawImage(doc,field,index);
  if(typeof value!=='string') throw Object.assign(new Error('图片不存在'),{status:404});
  const ref=doc._image_refs_v1?.[`${field}_${index}`];
  if(enabled() && ref?.verified && ref.sourceSha256===imageHash(value)) {
    try {
      const bytes=await (await mediaStore()).get(ref.key);
      if(bytes && imageHash(bytes)===ref.sha256) return {bytes,mime:ref.mime};
    } catch { /* Retained original remains the recovery path. */ }
  }
  return decodeImage(value);
}
export function decodeImage(value) {
  const match=/^data:image\/(jpeg|png|webp|gif);base64,([A-Za-z0-9+/]*={0,2})$/.exec(value);
  if(!match || !match[2] || match[2].length%4) throw Object.assign(new Error('不支持的图片格式'),{status:415});
  const bytes=Buffer.from(match[2],'base64');
  if(bytes.toString('base64')!==match[2]) throw Object.assign(new Error('图片编码无效'),{status:400});
  return {bytes,mime:`image/${match[1]}`};
}
// Call only after record-level authorization. Guest legacy sharing is deliberately not upgraded.
export function presentAttendance(doc,request) {
  const result={...doc}; delete result._image_refs_v1;
  if(!enabled() || !['admin','parent'].includes(request.role)) return result;
  if(request.role==='parent' && String(doc.student_id)!==String(request.myStudentId)) throw Object.assign(new Error('无权查看该学员作品'),{status:403});
  const base=process.env.MEDIA_API_BASE_URL;
  if(!base) throw Object.assign(new Error('图片访问地址未配置'),{status:503});
  const url=new URL(base);
  if(url.protocol!=='https:' && !(process.env.NODE_ENV==='test' && url.hostname==='127.0.0.1')) throw new Error('HTTPS media URL required');
  for(const field of IMAGE_FIELDS) {
    const values=Array.isArray(doc[field])?doc[field]:[doc[field]];
    const output=values.map((value,index)=>{
      if(typeof value!=='string' || !doc._image_refs_v1?.[`${field}_${index}`]?.verified) return value;
      return `${base.replace(/\/$/,'')}/api/media/image?grant=${encodeURIComponent(imageGrant(doc,field,index))}`;
    });
    if(doc[field]!==undefined) result[field]=Array.isArray(doc[field])?output:output[0];
  }
  return result;
}

// Upload and verify BEFORE performing any business writes. Existing originals are retained.
// Validation and signed-link normalization also remain active during R2 fallback.
export async function prepareAttendanceImages(payload,existing=null) {
  if(Object.keys(payload).some(k=>k.startsWith('_image_refs_v1'))) throw Object.assign(new Error('禁止提交内部图片引用'),{status:400});
  const result={...payload},refs={...(existing?._image_refs_v1||{})};
  const unique=new Map(); let total=0;
  for(const field of IMAGE_FIELDS) {
    if(!Object.hasOwn(payload,field)) continue;
    const isArray=Array.isArray(payload[field]);
    const values=isArray?payload[field]:[payload[field]];
    if(values.length>8) throw Object.assign(new Error('每次最多8张图片'),{status:413});
    const output=[];
    for(let index=0;index<values.length;index++) {
      let value=values[index]; const slot=`${field}_${index}`;
      delete refs[slot];
      if(value==='' || value===null) {output.push(value);continue;}
      const grant=parseImageGrant(value,true);
      if(grant) {
        if(!existing || grant.recordId!==String(existing._id)) throw Object.assign(new Error('图片不属于该记录'),{status:403});
        value=rawImage(existing,grant.field,grant.index);
        if(typeof value!=='string' || imageHash(value)!==grant.sourceSha256) throw Object.assign(new Error('图片已变化，请刷新'),{status:409});
      }
      const original=existing && rawImage(existing,field,index);
      if(value===original && existing._image_refs_v1?.[slot]?.sourceSha256===imageHash(value)) {
        refs[slot]=existing._image_refs_v1[slot]; output.push(value); continue;
      }
      const {bytes,mime}=decodeImage(value);
      if(bytes.length>5*1024*1024) throw Object.assign(new Error('单张图片不能超过5MB'),{status:413});
      const hash=imageHash(bytes);
      if(!unique.has(hash)) {
        total+=bytes.length;
        if(unique.size>=8 || total>12*1024*1024) throw Object.assign(new Error('图片总量超过限制'),{status:413});
        const image=sharp(bytes,{limitInputPixels:25000000});
        const metadata=await image.metadata();
        const expectedFormat={'image/jpeg':'jpeg','image/png':'png','image/webp':'webp','image/gif':'gif'}[mime];
        if(metadata.format!==expectedFormat) throw Object.assign(new Error('图片格式与声明不一致'),{status:415});
        await image.stats();
        unique.set(hash,{bytes,mime});
      }
      const extension={ 'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif' }[mime];
      if(enabled()) refs[slot]={key:`originals/sha256/${hash.slice(0,2)}/${hash}.${extension}`,sha256:hash,sourceSha256:imageHash(value),mime,bytes:bytes.length,verified:true,field,index,array:isArray,version:1};
      output.push(value);
    }
    for(const slot of Object.keys(refs)) if(slot.startsWith(field+'_') && Number(slot.slice(field.length+1))>=values.length) delete refs[slot];
    result[field]=isArray?output:output[0];
  }
  if(enabled() && unique.size) {
   const store=await mediaStore();
   for(const [hash,{bytes,mime}] of unique) {
    const ref=Object.values(refs).find(r=>r.sha256===hash);
    let remote=await store.get(ref.key);
    if(remote===null) {await store.put(ref.key,bytes,mime);remote=await store.get(ref.key);}
    if(!remote || imageHash(remote)!==hash) throw Object.assign(new Error('图片存储校验失败，请重试'),{status:503});
   }
  }
  result._image_refs_v1=refs;
  return result;
}
