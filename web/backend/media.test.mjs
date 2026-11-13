import { test } from 'node:test';
import assert from 'node:assert/strict';
process.env.NODE_ENV='test';process.env.IMAGE_STORAGE_MODE='dual';process.env.MEDIA_API_BASE_URL='http://127.0.0.1:27942';
process.env.JWT_SECRET='local-test-secret-with-at-least-32-characters';
const {prepareAttendanceImages,setMediaStoreForTest,presentAttendance,resolveImageBytes,parseImageGrant}=await import('./media.js');
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
test('dual-write preparation preserves originals, deduplicates and supports signed edit/fallback',async()=>{
  const objects=new Map();let puts=0;
  setMediaStoreForTest({get:async k=>objects.get(k)||null,put:async(k,b)=>{objects.set(k,b);puts++;}});
  const payload={student_id:'departed',work_imgs:[image],photo_url:image};
  const prepared=await prepareAttendanceImages(payload);
  assert.equal(puts,1);assert.equal(prepared.work_imgs[0],image);assert.equal(prepared.photo_url,image);assert.equal(payload._image_refs_v1,undefined);
  const doc={...prepared,_id:'record-one'};
  const presented=presentAttendance(doc,{role:'parent',myStudentId:'departed'});
  assert.equal(presented._image_refs_v1,undefined);assert.ok(presented.work_imgs[0].startsWith('http://127.0.0.1'));
  assert.equal(parseImageGrant(presented.work_imgs[0]).recordId,'record-one');
  const edited=await prepareAttendanceImages({work_imgs:presented.work_imgs,photo_url:presented.photo_url},doc);
  assert.equal(edited.work_imgs[0],image);assert.equal(puts,1);
  await assert.rejects(prepareAttendanceImages({work_imgs:presented.work_imgs},{...doc,_id:'other'}),e=>e.status===403);
  assert.throws(()=>presentAttendance(doc,{role:'parent',myStudentId:'other'}),e=>e.status===403);
  setMediaStoreForTest({get:async()=>{throw new Error('offline');}});
  assert.equal((await resolveImageBytes(doc,'work_imgs',0)).bytes.toString('base64'),image.split(',')[1]);
  setMediaStoreForTest({get:async()=>Buffer.from('corrupt')});
  assert.equal((await resolveImageBytes(doc,'work_imgs',0)).bytes.toString('base64'),image.split(',')[1]);
  await assert.rejects(prepareAttendanceImages({work_imgs:['https://example.invalid/image']}),e=>e.status===415);
  await assert.rejects(prepareAttendanceImages({_image_refs_v1:{}}),e=>e.status===400);
  await assert.rejects(prepareAttendanceImages({work_imgs:Array(9).fill(image)}),e=>e.status===413);
  const empty=await prepareAttendanceImages({work_imgs:[]},doc);assert.equal(empty._image_refs_v1.work_imgs_0,undefined);
});

test('R2 off normalizes existing signed edits, validates new images and never contacts storage',async()=>{
 process.env.IMAGE_STORAGE_MODE='dual';
 const objects=new Map();setMediaStoreForTest({get:async key=>objects.get(key)||null,put:async(key,bytes)=>objects.set(key,bytes)});
 const existing={...await prepareAttendanceImages({work_imgs:[image]}),_id:'fallback-record',student_id:'fallback-student'};
 const signed=presentAttendance(existing,{role:'admin'}).work_imgs;
 process.env.IMAGE_STORAGE_MODE='off';let calls=0;
 setMediaStoreForTest({get:async()=>{calls++;throw Error('Storage must not be called');},put:async()=>{calls++;throw Error('Storage must not be called');}});
 try{
  const normalized=await prepareAttendanceImages({work_imgs:signed},existing);assert.equal(normalized.work_imgs[0],image);
  const fresh=await prepareAttendanceImages({work_imgs:[image]});assert.equal(fresh.work_imgs[0],image);assert.equal(Object.keys(fresh._image_refs_v1).length,0);
  assert.equal((await resolveImageBytes(existing,'work_imgs',0)).bytes.toString('base64'),image.split(',')[1]);
  await assert.rejects(prepareAttendanceImages({work_imgs:['https://example.invalid/image']}),e=>e.status===415);
  await assert.rejects(prepareAttendanceImages({work_imgs:signed},{...existing,_id:'other'}),e=>e.status===403);
  const cleared=await prepareAttendanceImages({work_imgs:[]},existing);assert.equal(Object.keys(cleared._image_refs_v1).length,0);assert.equal(calls,0);
 }finally{process.env.IMAGE_STORAGE_MODE='dual';}
});
