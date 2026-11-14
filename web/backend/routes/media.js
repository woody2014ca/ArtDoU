import { Router } from 'express';
import { verifyToken, verifyExpiredImageGrant, authMiddleware } from '../middleware/auth.js';
import { getDoc } from '../db.js';
import { rawImage, imageHash, resolveImageBytes, imageGrant } from '../media.js';
import {galleryImageUrl} from '../gallery.js';
import {IMAGE_FIELDS} from '../media.js';
import sharp from 'sharp';
const router=Router();
router.post('/refresh',authMiddleware,async(req,res)=>{
  if(!['admin','parent'].includes(req.role)) return res.status(401).json({success:false});
  try {
    const grant=verifyExpiredImageGrant(String(req.body?.grant||''));
    if(!grant) return res.status(401).json({success:false});
    const doc=await getDoc('Attendance_logs',grant.recordId);
    if(!doc || (req.role==='parent' && String(doc.student_id)!==String(req.myStudentId))) return res.status(403).json({success:false});
    const value=rawImage(doc,grant.field,grant.index);
    if(typeof value!=='string'||(grant.purpose!=='artdou-gallery-image'&&imageHash(value)!==grant.sourceSha256)) return res.status(409).json({success:false});
    res.set('Cache-Control','no-store');
    const replacement=grant.purpose==='artdou-gallery-image'?new URL(galleryImageUrl(doc._id,grant.field,grant.index,process.env.MEDIA_API_BASE_URL||'http://127.0.0.1:5174')).searchParams.get('grant'):imageGrant(doc,grant.field,grant.index);
    res.json({success:true,grant:replacement});
  }catch{res.status(503).json({success:false});}
});
router.get('/image',async(req,res)=>{
  try {
    const grant=verifyToken(String(req.query.grant||''));
    if(!['artdou-image','artdou-gallery-image'].includes(grant?.purpose)||!IMAGE_FIELDS.includes(grant.field)||!Number.isInteger(grant.index)||grant.index<0||grant.index>100) return res.status(401).json({success:false,msg:'图片链接已过期，请刷新页面'});
    const doc=await getDoc('Attendance_logs',grant.recordId,{student_id:1,_image_refs_v1:1,[grant.field]:{$slice:grant.index+1}});
    const raw=rawImage(doc,grant.field,grant.index);
    if(typeof raw!=='string' || (grant.purpose!=='artdou-gallery-image'&&imageHash(raw)!==grant.sourceSha256)) return res.status(404).end();
    const {bytes,mime}=await resolveImageBytes(doc,grant.field,grant.index);
    res.set('Cache-Control','private, no-store');res.set('Referrer-Policy','no-referrer');res.set('X-Content-Type-Options','nosniff');
    if(req.query.size==='thumb'){
      const thumb=await sharp(bytes,{limitInputPixels:25000000}).rotate().resize({width:640,height:640,fit:'inside',withoutEnlargement:true}).webp({quality:72}).toBuffer();
      res.set('Cache-Control','private, max-age=120');
      return res.type('image/webp').send(thumb);
    }
    res.type(mime).send(bytes);
  } catch {res.status(503).json({success:false,msg:'图片暂时无法加载，请稍后重试'});}
});
export default router;
