import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { saveCheckin, voidCheckin } from '../checkin-service.js';
import { ensureDb } from '../db.js';
const router=Router();router.use(authMiddleware);
const handler=kind=>async(req,res)=>{
  if(req.role!=='admin')return res.status(403).json({success:false,msg:'仅教师可操作'});
  try {res.set('Cache-Control','no-store');res.json(await saveCheckin(kind,req.params.id,req.body));}
  catch(error){const status=error.status||503;res.status(status).json({success:false,msg:error.status?error.message:'保存暂未完成，请使用原提交重试，切勿重复扣课'});}
};
router.post('/create',handler('create'));router.post('/amend/:id',handler('amend'));
router.post('/void/:id',async(req,res)=>{
  if(req.role!=='admin')return res.status(403).json({success:false,msg:'仅教师可撤销'});
  try{res.set('Cache-Control','no-store');res.json(await voidCheckin(req.params.id,req.body));}
  catch(e){res.status(e.status||503).json({success:false,msg:e.status?e.message:'撤销暂未完成，请使用原提交重试'});}
});
router.get('/operation/:operationId',async(req,res)=>{
  if(req.role!=='admin')return res.status(403).json({success:false});
  if(!/^[a-f0-9-]{36}$/i.test(req.params.operationId))return res.status(400).json({success:false});
  try{const db=await ensureDb();const operation=await db.collection('Checkin_operations').findOne({_id:`checkin:${req.params.operationId}`});res.set('Cache-Control','no-store');res.json({success:true,completed:!!operation,result:operation?.result||null});}
  catch{res.status(503).json({success:false,msg:'暂时无法确认提交结果，请稍后重试'});}
});
export default router;
