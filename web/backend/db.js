import { MongoClient, ObjectId } from 'mongodb';

let client = null;
let db = null;
let connecting = null;

export function toId(id) {
  if (!id) return id;
  try {
    if (typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id)) return new ObjectId(id);
  } catch (e) {}
  return id;
}

function buildClientOptions(isAtlas) {
  const opts = {
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    autoSelectFamily: false,
    family: 4,
    maxPoolSize: 10,
  };
  if (isAtlas) {
    opts.tlsAllowInvalidCertificates = true;
    opts.tlsAllowInvalidHostnames = true;
  }
  return opts;
}

export async function connect() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URL || 'mongodb://localhost:27017';
  const dbName = process.env.MONGODB_DB || 'artdou';
  if (db) return db;

  const isAtlas = /mongodb\.net|mongodb\+srv/.test(uri);
  // Atlas 走驱动原生 mongodb+srv，避免 resolve-mongodb-srv 在 Railway 上握手失败
  const opts = buildClientOptions(isAtlas);
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const c = new MongoClient(uri, opts);
      await c.connect();
      await c.db(dbName).admin().ping();
      client = c;
      db = client.db(dbName);
      console.log(`MongoDB connected (attempt ${attempt})`);
      return db;
    } catch (e) {
      lastErr = e;
      console.error(`MongoDB connect attempt ${attempt} failed:`, e.message);
      try {
        await client?.close();
      } catch (_) {}
      client = null;
      db = null;
      if (attempt < 3) await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  throw lastErr;
}

/** 获取库连接；断线时自动重连 */
export async function ensureDb() {
  if (db) {
    try {
      await db.admin().ping();
      return db;
    } catch (e) {
      console.error('MongoDB ping failed, reconnecting:', e.message);
      try {
        await client?.close();
      } catch (_) {}
      client = null;
      db = null;
    }
  }
  if (!connecting) {
    connecting = connect().finally(() => {
      connecting = null;
    });
  }
  return connecting;
}

export function getDb() {
  return db;
}

/** 兼容微信云开发用法：列表查询；projection 可排除大字段（如消课作品图） */
export async function find(collectionName, filter = {}, limit = 100, projection = null) {
  const database = await ensureDb();
  const col = database.collection(collectionName);
  let cursor = col.find(filter);
  if (projection) cursor = cursor.project(projection);
  const list = await cursor.limit(limit).toArray();
  return list.map((doc) => {
    const d = { ...doc };
    if (d._id && d._id instanceof ObjectId) d._id = d._id.toString();
    return d;
  });
}

/** 兼容：单条查询 by _id */
export async function getDoc(collectionName, id) {
  if (id === undefined || id === null || id === '') return null;
  const database = await ensureDb();
  const col = database.collection(collectionName);
  const oid = toId(id);
  const doc = await col.findOne({ _id: oid });
  if (!doc) return null;
  const d = { ...doc };
  if (d._id && d._id instanceof ObjectId) d._id = d._id.toString();
  return d;
}

/** 新增，返回 _id 字符串 */
export async function add(collectionName, data) {
  const database = await ensureDb();
  const col = database.collection(collectionName);
  const doc = { ...data, createTime: new Date() };
  const res = await col.insertOne(doc);
  return res.insertedId ? res.insertedId.toString() : null;
}

/** 更新 */
export async function update(collectionName, id, data) {
  const database = await ensureDb();
  const col = database.collection(collectionName);
  const oid = toId(id);
  await col.updateOne({ _id: oid }, { $set: { ...data, updateTime: new Date() } });
}

/** 删除 */
export async function remove(collectionName, id) {
  const database = await ensureDb();
  const col = database.collection(collectionName);
  const oid = toId(id);
  await col.deleteOne({ _id: oid });
}

/** 课时增减 */
export async function incrementLeftClasses(collectionName, id, value) {
  const database = await ensureDb();
  const col = database.collection(collectionName);
  const oid = toId(id);
  await col.updateOne({ _id: oid }, { $inc: { left_classes: value } });
}
