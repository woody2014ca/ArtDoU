import { MongoClient, ObjectId } from 'mongodb';

let client = null;
let db = null;

export function toId(id) {
  if (!id) return id;
  try {
    if (typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id)) return new ObjectId(id);
  } catch (e) {}
  return id;
}

export async function connect() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const dbName = process.env.MONGODB_DB || 'artdou';
  if (db) return db;
  const isAtlas = /mongodb\.net|mongodb\+srv/.test(uri);
  const opts = {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    autoSelectFamily: false,
    family: 4,
  };
  if (isAtlas) {
    opts.tlsAllowInvalidCertificates = true;
    opts.tlsAllowInvalidHostnames = true;
  }
  client = new MongoClient(uri, opts);
  await client.connect();
  db = client.db(dbName);
  return db;
}

export function getDb() {
  return db;
}

/** 兼容微信云开发用法：列表查询 */
export async function find(collectionName, filter = {}, limit = 100) {
  const col = db.collection(collectionName);
  const list = await col.find(filter).limit(limit).toArray();
  return list.map((doc) => {
    const d = { ...doc };
    if (d._id && d._id instanceof ObjectId) d._id = d._id.toString();
    return d;
  });
}

/** 兼容：单条查询 by _id */
export async function getDoc(collectionName, id) {
  if (id === undefined || id === null || id === '') return null;
  const col = db.collection(collectionName);
  const oid = toId(id);
  const doc = await col.findOne({ _id: oid });
  if (!doc) return null;
  const d = { ...doc };
  if (d._id && d._id instanceof ObjectId) d._id = d._id.toString();
  return d;
}

/** 新增，返回 _id 字符串 */
export async function add(collectionName, data) {
  const col = db.collection(collectionName);
  const doc = { ...data, createTime: new Date() };
  const res = await col.insertOne(doc);
  return res.insertedId ? res.insertedId.toString() : null;
}

/** 更新 */
export async function update(collectionName, id, data) {
  const col = db.collection(collectionName);
  const oid = toId(id);
  await col.updateOne({ _id: oid }, { $set: { ...data, updateTime: new Date() } });
}

/** 删除 */
export async function remove(collectionName, id) {
  const col = db.collection(collectionName);
  const oid = toId(id);
  await col.deleteOne({ _id: oid });
}

/** 课时增减 */
export async function incrementLeftClasses(collectionName, id, value) {
  const col = db.collection(collectionName);
  const oid = toId(id);
  await col.updateOne({ _id: oid }, { $inc: { left_classes: value } });
}
