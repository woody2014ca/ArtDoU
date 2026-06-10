/**
 * 将 artdou 库从 Railway MongoDB 迁到 Atlas。
 *
 * 用法（在 web/backend 目录）：
 *   方式 A — 直连两库（Railway Mongo 须 Online）：
 *     $env:SOURCE_MONGODB_URI="mongodb://..."
 *     $env:TARGET_MONGODB_URI="mongodb+srv://..."
 *     node scripts/migrate-to-atlas.mjs
 *
 *   方式 B — 经生产 API 导出（ArtDoU 须连 Railway Mongo）：
 *     $env:TARGET_MONGODB_URI="mongodb+srv://..."
 *     $env:API_BASE="https://artdou-production.up.railway.app/api"
 *     $env:ADMIN_PASSWORD="ArtDoU2026"
 *     node scripts/migrate-to-atlas.mjs --via-api
 *
 * 也可把变量写在 .env.migrate（勿提交 git）
 */
import 'dotenv/config';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { MongoClient, ObjectId } from 'mongodb';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrateEnv = resolve(__dirname, '../.env.migrate');
if (existsSync(migrateEnv)) {
  for (const line of readFileSync(migrateEnv, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

const DB = process.env.MONGODB_DB || 'artdou';
const COLLECTIONS = [
  'Students',
  'Attendance_logs',
  'Leave_requests',
  'Prospective_students',
  'Payment_logs',
  'Parent_bindings',
  'Teachers',
  'configs',
];

function toPlainDoc(doc) {
  const d = { ...doc };
  if (d._id != null) {
    const s = String(d._id);
    if (/^[a-f0-9]{24}$/i.test(s)) d._id = new ObjectId(s);
  }
  return d;
}

async function connectTarget() {
  const uri = process.env.TARGET_MONGODB_URI || process.env.ATLAS_MONGODB_URI;
  if (!uri) throw new Error('缺少 TARGET_MONGODB_URI（Atlas 连接串）');
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000,
    autoSelectFamily: false,
    family: 4,
    tlsAllowInvalidCertificates: true,
    tlsAllowInvalidHostnames: true,
  });
  await client.connect();
  return client;
}

async function importToAtlas(dataByCollection) {
  const client = await connectTarget();
  const db = client.db(DB);
  try {
    for (const name of COLLECTIONS) {
      const docs = dataByCollection[name] || [];
      if (!docs.length) {
        console.log(`  ${name}: 跳过（0 条）`);
        continue;
      }
      const col = db.collection(name);
      await col.deleteMany({});
      const batch = docs.map(toPlainDoc);
      await col.insertMany(batch, { ordered: false });
      console.log(`  ${name}: 已导入 ${batch.length} 条`);
    }
    const students = await db.collection('Students').countDocuments();
    console.log(`\n✅ Atlas 库 "${DB}" 现有 Students: ${students} 条`);
  } finally {
    await client.close();
  }
}

async function migrateDirect() {
  const sourceUri = process.env.SOURCE_MONGODB_URI || process.env.RAILWAY_MONGO_URL;
  if (!sourceUri) throw new Error('缺少 SOURCE_MONGODB_URI（Railway MONGO_URL）');

  console.log('直连模式：Railway Mongo → Atlas');
  const source = new MongoClient(sourceUri, {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000,
  });
  await source.connect();
  const sdb = source.db(DB);
  const data = {};
  try {
    for (const name of COLLECTIONS) {
      data[name] = await sdb.collection(name).find({}).toArray();
      console.log(`  读出 ${name}: ${data[name].length} 条`);
    }
  } finally {
    await source.close();
  }
  if (!(data.Students || []).length) {
    throw new Error('Railway 源库 Students 为 0，请确认 Railway MongoDB 已 Online 且库名正确');
  }
  console.log('\n写入 Atlas...');
  await importToAtlas(data);
}

async function migrateViaApi() {
  const base = (process.env.API_BASE || 'https://artdou-production.up.railway.app/api').replace(/\/$/, '');
  const password = process.env.ADMIN_PASSWORD || 'ArtDoU2026';

  console.log('API 模式：生产 API → Atlas');
  const loginRes = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  const login = await loginRes.json();
  if (!login.success || !login.token) throw new Error('老师登录失败，请确认 ArtDoU 已连 Railway Mongo');

  const headers = { Authorization: `Bearer ${login.token}` };
  const data = {};
  for (const name of COLLECTIONS) {
    const res = await fetch(`${base}/data/${name}/all`, { headers });
    const json = await res.json();
    data[name] = json.success && Array.isArray(json.data) ? json.data : [];
    console.log(`  API ${name}: ${data[name].length} 条`);
  }
  if (!(data.Students || []).length) {
    throw new Error('API 返回 Students 为 0。请先把 Railway ArtDoU 的 MONGODB_URI 改回 ${{MongoDB.MONGO_URL}} 并 Deploy');
  }
  console.log('\n写入 Atlas...');
  await importToAtlas(data);
}

const viaApi = process.argv.includes('--via-api');
try {
  if (viaApi) await migrateViaApi();
  else await migrateDirect();
} catch (e) {
  console.error('\n❌', e.message);
  process.exit(1);
}
