import {test} from 'node:test';
import assert from 'node:assert/strict';
import {storageConfig,validateReleaseConfig} from './storage-config.js';
const base={R2_ACCOUNT_ID:'0'.repeat(32),R2_ACCESS_KEY_ID:'synthetic',R2_SECRET_ACCESS_KEY:'synthetic',R2_BUCKET:'artdou-images-test'};
test('storage scopes fail closed and do not expose secrets in errors',()=>{
 assert.equal(storageConfig(base).scope,'test');
 assert.throws(()=>storageConfig({...base,NODE_ENV:'production'}),/cannot use test/);
 assert.throws(()=>storageConfig({...base,R2_STORAGE_SCOPE:'production',R2_BUCKET:'artdou-images'}),/explicit activation/);
 assert.throws(()=>storageConfig({...base,R2_STORAGE_SCOPE:'production',R2_PRODUCTION_ENABLED:'1'}),/separate bucket/);
 assert.equal(storageConfig({...base,R2_STORAGE_SCOPE:'production',R2_PRODUCTION_ENABLED:'1',R2_BUCKET:'artdou-images',NODE_ENV:'production'}).scope,'production');
 assert.throws(()=>storageConfig({...base,R2_BUCKET:'unrelated-bucket'}),/test bucket/);
});
test('release configuration rejects incomplete combinations before startup',()=>{
 const ready={...base,IMAGE_STORAGE_MODE:'dual',JWT_SECRET:'s'.repeat(48),CHECKIN_ATOMIC_ENABLED:'1',MEDIA_API_BASE_URL:'https://api.example.invalid',FRONTEND_URL:'https://www.example.invalid/artdou'};
 assert.doesNotThrow(()=>validateReleaseConfig(ready));
 assert.throws(()=>validateReleaseConfig({...ready,JWT_SECRET:'short'}),/strong/);
 assert.throws(()=>validateReleaseConfig({...ready,CHECKIN_ATOMIC_ENABLED:'0'}),/Atomic/);
 assert.throws(()=>validateReleaseConfig({...ready,FRONTEND_URL:'http://example.invalid'}),/HTTPS/);
 assert.throws(()=>validateReleaseConfig({...ready,MEDIA_API_BASE_URL:'https://user:secret@example.invalid'}),/HTTPS/);
});
