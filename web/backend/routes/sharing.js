import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { ensureDb } from '../db.js';
import { createShare,loadShare,sharedImage,requireShareOwner } from '../sharing.js';
import { resolveImageBytes } from '../media.js';
const router=Router();
router.use((_req,res,next)=>{res.set('Cache-Control','private, no-store');res.set('Referrer-Policy','no-referrer');next();});
const error=(res,e)=>res.status(e.status||503).json({success:false,msg:e.status?e.message:'分享暂不可用'});
router.post('/',authMiddleware,async(req,res)=>{try{res.json({success:true,...await createShare(req,req.body?.studentId,req.body?.ttlSeconds,req.body?.urls)});}catch(e){error(res,e);}});
router.post('/revoke-student',authMiddleware,async(req,res)=>{
  try{const studentId=req.body?.studentId;requireShareOwner(req,studentId);if(typeof studentId!=='string'||!studentId)return res.status(400).json({success:false});
    const db=await ensureDb();const result=await db.collection('Share_links').updateMany({student_id:studentId,revoked:false},{$set:{revoked:true,revokedAt:new Date()}});res.json({success:true,revoked:result.modifiedCount});
  }catch(e){error(res,e);}
});
router.get('/:token',async(req,res)=>{
  try{const share=await loadShare(req.params.token);const works=[];
    for(let position=0;position<share.items.length;position++){
      try{const {item}=await sharedImage(share,position);works.push({_id:`shared-${position}`,date:item.date,brief:item.brief,work_imgs:[`/api/share/${encodeURIComponent(req.params.token)}/image/${position}`]});}
      catch(e){if(e.status!==404)throw e;}
    }
    res.json({success:true,name:share.displayName,expiresAt:share.expiresAt,data:works});
  }catch(e){error(res,e);}
});
router.get('/:token/image/:position',async(req,res)=>{
  try{const share=await loadShare(req.params.token);const {doc,item}=await sharedImage(share,Number(req.params.position));const image=await resolveImageBytes(doc,item.field,item.index);res.set('X-Content-Type-Options','nosniff');res.type(image.mime).send(image.bytes);}
  catch(e){error(res,e);}
});
export default router;
