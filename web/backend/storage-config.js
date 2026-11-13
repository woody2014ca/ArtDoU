// Pure validation: never contacts Cloudflare or creates a bucket.
export function storageConfig(env = process.env) {
  const scope = env.R2_STORAGE_SCOPE || 'test';
  const bucket = env.R2_BUCKET;
  if (!['test', 'production'].includes(scope)) throw new Error('R2_STORAGE_SCOPE must be test or production');
  if (scope === 'test' && bucket !== 'artdou-images-test') throw new Error('Test scope requires the test bucket');
  if (scope === 'production' && (bucket !== 'artdou-images' || env.R2_PRODUCTION_ENABLED !== '1')) throw new Error('Production storage requires its separate bucket and explicit activation');
  if (env.NODE_ENV === 'production' && scope !== 'production') throw new Error('Production cannot use test storage');
  if (!/^[a-f0-9]{32}$/.test(env.R2_ACCOUNT_ID || '') || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) throw new Error('R2 credentials are missing or invalid');
  return { scope, bucket, account: env.R2_ACCOUNT_ID, accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY };
}

export function validateReleaseConfig(env = process.env) {
  if (env.IMAGE_STORAGE_MODE !== 'dual' && env.SECURE_SHARING_ENABLED !== '1') return;
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) throw new Error('A strong JWT_SECRET is required');
  if (env.CHECKIN_ATOMIC_ENABLED !== '1') throw new Error('Atomic checkin must be enabled with new media or sharing');
  for (const key of ['MEDIA_API_BASE_URL', 'FRONTEND_URL']) {
    let url;
    try { url = new URL(env[key]); } catch { throw new Error(`${key} must be configured`); }
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error(`${key} must be a clean HTTPS URL`);
  }
  if (env.IMAGE_STORAGE_MODE === 'dual') storageConfig(env);
}
