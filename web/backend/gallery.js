import {signToken} from './middleware/auth.js';
import {IMAGE_FIELDS} from './media.js';

// MongoDB sends only image-presence flags, never historical Base64 originals.
export const galleryProjection={_id:1,student_id:1,date:1,createTime:1,type:1,change_num:1,voided:1,brief:1,note:1,teacher_notes:1,memo:1};
for(const field of IMAGE_FIELDS){
 const valid=value=>({$and:[{$eq:[{$type:value},'string']},{$ne:[value,'']}]});
 galleryProjection[field]={$cond:[{$isArray:`$${field}`},{$map:{input:`$${field}`,as:'image',in:valid('$$image')}},valid(`$${field}`)]};
}

export function galleryImageUrl(recordId,field,index,base){
 const grant=signToken({purpose:'artdou-gallery-image',recordId:String(recordId),field,index},'5m');
 return `${base.replace(/\/$/,'')}/api/media/image?grant=${encodeURIComponent(grant)}`;
}

export function presentGallery(doc,request){
 if(!['admin','parent'].includes(request.role)||(request.role==='parent'&&String(doc.student_id)!==String(request.myStudentId)))throw Object.assign(new Error('无权查看学员作品'),{status:403});
 const base=process.env.MEDIA_API_BASE_URL||(process.env.NODE_ENV==='test'?'http://127.0.0.1:5174':'');
 const url=new URL(base);if(url.protocol!=='https:'&&!(process.env.NODE_ENV==='test'&&url.hostname==='127.0.0.1'))throw Error('HTTPS media URL required');
 const output={...doc,_id:String(doc._id)};
 for(const field of IMAGE_FIELDS){
  const values=Array.isArray(doc[field])?doc[field]:[doc[field]];
  const links=values.map((present,index)=>present===true?galleryImageUrl(doc._id,field,index,base):'');
  output[field]=Array.isArray(doc[field])?links:links[0];
 }
 return output;
}
