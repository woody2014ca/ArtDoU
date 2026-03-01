# ArtDoU 后端 Railway 部署 — 现象与分析（供外部审计）

## 一、当前现象

1. **服务状态**
   - 后端部署在 Railway，域名：`https://artdou-production.up.railway.app`
   - 前端在 Vercel，域名：`www.kunlunfo.com`
   - 访问 `/health` 有时可返回 `{"ok":true}`（HTTP 已监听）；老师密码登录在「不依赖数据库」时可工作。

2. **数据库连接报错（核心问题）**
   - Deploy Logs 中反复出现：
     ```
     MongoDB connect failed: ... error:0A000438:SSL routines:ssl3_read_bytes:tlsv1 alert internal error:... SSL alert number 80
     ```
   - 出现顺序一般为：`Starting Container` → `API listening on 8080` → `MongoDB connect failed`（SSL 错误）。
   - 即：**进程能启动、HTTP 能监听，但连 MongoDB 时在 TLS 握手阶段失败（SSL alert 80）。**

3. **当前配置意图**
   - 已按文档在 ArtDoU 的 Variables 中将 `MONGODB_URI` 设为对 Railway 自带 MongoDB 的引用：`${{Mongo.MONGO_URL}}`（或 `${{MongoDB.MONGO_URL}}`），以避开 Atlas。
   - 若该引用未生效（见下文），实际运行时仍可能使用**旧有的 Atlas 连接串**，从而继续出现上述 SSL 80 错误。

---

## 二、原因分析

### 2.1 为何会报 SSL alert 80？

- **SSL alert number 80** 表示 TLS 握手过程中对方（或本地）报「internal error」，常见于：
  - 客户端与服务器在 **TLS 版本 /  cipher suite / 证书校验** 等环节不兼容；
  - 或运行环境（此处为 **Railway 的 Node 容器**）使用的 **OpenSSL 与 MongoDB Atlas 服务端 TLS 实现** 存在兼容性问题。
- 项目在 **连接 Atlas**（`mongodb+srv://...@xxx.mongodb.net/...`）时稳定复现该错误；**连接同一 Railway 项目内的 MongoDB（内网 `mongodb://...`）时理论上不经过公网 TLS**，故不应出现同类 SSL 80。

结论：**当前错误与「Railway 上的 Node 进程 ↔ Atlas 之间的 TLS 握手」强相关；与业务逻辑、应用层代码无直接关系。**

### 2.2 为何改为 Railway MongoDB 后仍可能看到 SSL 80？

若已把 `MONGODB_URI` 改为 `${{Mongo.MONGO_URL}}` 或 `${{MongoDB.MONGO_URL}}` 却仍报同样错误，可推断：

- **实际生效的 MONGODB_URI 仍是 Atlas 连接串**，即引用未生效，例如：
  - 服务名与 Railway 中 MongoDB 服务名不一致（如写的是 `Mongo` 但服务名为 `MongoDB`），导致 `${{...}}` 解析为空或未替换；
  - 未点击 **Apply / Deploy**，部署仍在使用旧变量；
  - 或存在多处/历史配置，实际取到的仍是 Atlas 的 `mongodb+srv://...`。

此时需在部署环境中**确认最终注入的 MONGODB_URI 值**（或通过「改为直接粘贴 Railway MongoDB 的 MONGO_URL」做对比验证）。

---

## 三、已做过的尝试（时间顺序概览）

| 序号 | 措施 | 结果 |
|------|------|------|
| 1 | 先启动 HTTP 再后台连接 MongoDB，避免连接挂起导致 502 | HTTP 可监听，/health 可用；DB 仍报错 |
| 2 | 使用 `node:20-slim` / `node:18-slim` 替换 Alpine | 仍 SSL 80 |
| 3 | MongoClient 增加 `autoSelectFamily: false`、`family: 4`（强制 IPv4） | 仍 SSL 80 |
| 4 | 增加 `tlsAllowInvalidCertificates`、`tlsAllowInvalidHostnames` | 仍 SSL 80 |
| 5 | 升级 MongoDB Node 驱动至 6.21 | 仍 SSL 80 |
| 6 | 使用 `resolve-mongodb-srv` 将 SRV 解析为标准 URI 再连接 | 仍 SSL 80 |
| 7 | 文档建议改用 Railway 自带 MongoDB，并支持 `MONGO_URL` | 若引用正确，应不再经 Atlas，无 TLS 问题 |

结论：**在「Railway 容器 ↔ Atlas」这条链路上，已尝试的驱动/Node 版本/TLS 选项/SRV 解析均未消除 SSL 80；问题判定为环境与 Atlas 的 TLS 兼容性，而非单一代码缺陷。**

---

## 四、推荐方案与待验证项

### 4.1 推荐方案

- **使用 Railway 项目内的 MongoDB 服务**（通过 + New → Database/MongoDB 创建），不再连接 Atlas。
- 在 ArtDoU 服务中：
  - **MONGODB_URI**：仅设为对上述 MongoDB 的引用，如 `${{Mongo.MONGO_URL}}` 或 `${{MongoDB.MONGO_URL}}`（与 Railway 中服务名一致）；
  - **MONGODB_DB**：`artdou`。
- 代码已支持 `process.env.MONGO_URL` 作为连接串来源，与 Railway 提供的变量名一致。

预期：连接走 Railway 内网，不经过 Atlas，**不应再出现 SSL alert 80**。

### 4.2 审计/自检时可验证的点

1. **变量引用是否生效**
   - Railway 中 ArtDoU 服务 Variables 里，`MONGODB_URI` 是否**仅**为 `${{Mongo.MONGO_URL}}` 或 `${{MongoDB.MONGO_URL}}`（与真实服务名一致）。
   - 是否已**移除**任何 Atlas 的 `mongodb+srv://...` 配置。

2. **是否已应用并重新部署**
   - 修改 Variables 后是否执行 **Apply** 及 **Deploy**；当前查看的 Deploy Logs 是否对应**本次修改后**的部署。

3. **若仍报 SSL 80**
   - 可临时将 `MONGODB_URI` 改为**直接粘贴** Railway MongoDB 服务中 Variables 的 **MONGO_URL** 明文值，再 Deploy；若此时出现 `MongoDB connected`，则说明引用语法/服务名有误，需修正 `${{...}}` 或服务名。

4. **数据迁移**
   - 若原使用 Atlas 且存在数据，需通过 mongodump/mongorestore 或 Atlas 导出后导入至 Railway MongoDB；与 SSL 80 问题无关，属数据迁移步骤。

---

## 五、简要结论

- **现象**：Railway 上 Node 进程连 MongoDB Atlas 时稳定出现 TLS 握手错误（SSL alert 80）；连 Railway 内网 MongoDB 时设计上不经过该路径。
- **分析**：问题出在 Railway 运行环境与 Atlas 的 TLS 兼容性；已做的应用层与驱动侧调整无法消除该错误。
- **方案**：改用 Railway 自带 MongoDB，并确保 `MONGODB_URI` 正确引用其 `MONGO_URL` 且已应用并部署；若引用未生效，会继续使用旧 Atlas 串并继续报 SSL 80，需按 4.2 逐项核对。

---

*文档生成日期：2026-03-01，供外部审计与排障参考。*
