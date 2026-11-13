export function maintenanceGuard(req,res,next) {
  if(process.env.ARTDOU_READ_ONLY!=='1'||['GET','HEAD','OPTIONS'].includes(req.method))return next();
  const allowed=req.method==='POST' && ['/auth/login','/media/refresh'].includes(req.path);
  if(allowed)return next();
  res.set('Retry-After','60');res.set('Cache-Control','no-store');
  return res.status(503).json({success:false,msg:'系统维护中，暂时不能保存，请稍后使用原提交重试'});
}
