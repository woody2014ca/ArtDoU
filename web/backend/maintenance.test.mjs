import {test} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {maintenanceGuard} from './maintenance.js';
test('maintenance preserves reads and login but blocks business writes',async()=>{
  const app=express();app.use('/api',maintenanceGuard);let writes=0;
  app.get('/api/data',(_req,res)=>res.json({ok:true}));app.post('/api/auth/login',(_req,res)=>res.json({ok:true}));app.post('/api/media/refresh',(_req,res)=>res.json({ok:true}));
  app.post('/api/checkin/create',(_req,res)=>{writes++;res.json({ok:true});});
  app.patch('/api/data/Students/1',(_req,res)=>{writes++;res.json({ok:true});});
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});const base=`http://127.0.0.1:${server.address().port}`;
  try{process.env.ARTDOU_READ_ONLY='1';assert.equal((await fetch(base+'/api/data')).status,200);assert.equal((await fetch(base+'/api/auth/login',{method:'POST'})).status,200);assert.equal((await fetch(base+'/api/media/refresh',{method:'POST'})).status,200);
    assert.equal((await fetch(base+'/api/checkin/create',{method:'POST'})).status,503);assert.equal((await fetch(base+'/api/data/Students/1',{method:'PATCH'})).status,503);assert.equal(writes,0);
    delete process.env.ARTDOU_READ_ONLY;assert.equal((await fetch(base+'/api/checkin/create',{method:'POST'})).status,200);assert.equal(writes,1);
  }finally{delete process.env.ARTDOU_READ_ONLY;await new Promise(r=>server.close(r));}
});
