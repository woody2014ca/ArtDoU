import { storageConfig } from './storage-config.js';
// Activation only selects configuration; this adapter never creates buckets.
export async function createR2Store() {
  const {account,accessKeyId,secretAccessKey,bucket}=storageConfig();
  const {S3Client,GetObjectCommand,PutObjectCommand}=await import('@aws-sdk/client-s3');
  const client=new S3Client({region:'auto',endpoint:`https://${account}.r2.cloudflarestorage.com`,credentials:{accessKeyId,secretAccessKey},maxAttempts:3,requestChecksumCalculation:'WHEN_REQUIRED',responseChecksumValidation:'WHEN_REQUIRED'});
  const check=key=>{if(!/^originals\/sha256\/[a-f0-9]{2}\/[a-f0-9]{64}\.(jpg|png|webp|gif)$/.test(key))throw new Error('Invalid object key');};
  return {
    async get(key){check(key);try{const result=await client.send(new GetObjectCommand({Bucket:bucket,Key:key}),{abortSignal:AbortSignal.timeout(30000)});if(result.ContentLength>25*1024*1024){result.Body?.destroy?.();throw new Error('Image too large');}return Buffer.from(await result.Body.transformToByteArray());}catch(e){if(e.name==='NoSuchKey')return null;throw e;}},
    async put(key,bytes,mime){check(key);try{await client.send(new PutObjectCommand({Bucket:bucket,Key:key,Body:bytes,ContentType:mime,IfNoneMatch:'*',CacheControl:'private, no-store'}),{abortSignal:AbortSignal.timeout(30000)});}catch(e){if(e.$metadata?.httpStatusCode!==412)throw e;}},
    close(){client.destroy();}
  };
}
