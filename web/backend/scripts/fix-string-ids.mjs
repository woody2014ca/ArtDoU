/**
 * 将 MongoDB 中误存为 string 的 _id 转为 ObjectId（迁移 API 导入时常见）
 * 用法：在 web/backend 目录，已配置 .env 或 MONGODB_URI 时
 *   node scripts/fix-string-ids.mjs
 */
import 'dotenv/config';
import { MongoClient, ObjectId } from 'mongodb';

const uri = process.env.MONGODB_URI || process.env.TARGET_MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'artdou';
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

const client = new MongoClient(uri, {
  serverSelectionTimeoutMS: 20000,
  tlsAllowInvalidCertificates: true,
  tlsAllowInvalidHostnames: true,
});

function isHexId(s) {
  return typeof s === 'string' && /^[a-f0-9]{24}$/i.test(s);
}

await client.connect();
const db = client.db(dbName);

for (const name of COLLECTIONS) {
  const col = db.collection(name);
  const cursor = col.find({ _id: { $type: 'string' } });
  let fixed = 0;
  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    const sid = doc._id;
    if (!isHexId(sid)) continue;
    const oid = new ObjectId(sid);
    if (await col.findOne({ _id: oid })) {
      console.log(`  ${name}: skip duplicate ${sid}`);
      continue;
    }
    const { _id, ...rest } = doc;
    await col.insertOne({ _id: oid, ...rest });
    await col.deleteOne({ _id: sid });
    fixed++;
  }
  console.log(`${name}: fixed ${fixed} string _id(s)`);
}

console.log('Done.');
await client.close();
