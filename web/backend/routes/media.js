import { Router } from 'express';
import { verifyToken, verifyExpiredImageGrant, authMiddleware } from '../middleware/auth.js';
import { getDoc } from '../db.js';
import { rawImage, imageHash, resolveImageBytes, imageGrant } from '../media.js';
const router=Router();
router.post('/refresh',authMiddleware,async(req,res)=>{
  if(!['admin','parent'].includes(req.role)) return res.status(401).json({success:false});
  try {
    const grant=verifyExpiredImageGrant(String(req.body?.grant||''));
    if(!grant) return res.status(401).json({success:false});
    const doc=await getDoc('Attendance_logs',grant.recordId);
    if(!doc || (req.role==='parent' && String(doc.student_id)!==String(req.myStudentId))) return res.status(403).json({success:false});
    const value=rawImage(doc,grant.field,grant.index);
    if(typeof value!=='string'||imageHash(value)!==grant.sourceSha256) return res.status(409).json({success:false});
    res.set('Cache-Control','no-store');
    res.json({success:true,grant:imageGrant(doc,grant.field,grant.index)});
  }catch{res.status(503).json({success:false});}
});
router.get('/image',async(req,res)=>{
  try {
    const grant=verifyToken(String(req.query.grant||''));
    if(grant?.purpose!=='artdou-image') return res.status(401).json({success:false,msg:'图片链接已过期，请刷新页面'});
    const doc=await getDoc('Attendance_logs',grant.recordId);
    const raw=rawImage(doc,grant.field,grant.index);
    if(typeof raw!=='string' || imageHash(raw)!==grant.sourceSha256) return res.status(404).end();
    const {bytes,mime}=await resolveImageBytes(doc,grant.field,grant.index);
    res.set('Cache-Control','private, no-store');res.set('Referrer-Policy','no-referrer');res.set('X-Content-Type-Options','nosniff');
    res.type(mime).send(bytes);
  } catch {res.status(503).json({success:false,msg:'图片暂时无法加载，请稍后重试'});}
});
export default router;
