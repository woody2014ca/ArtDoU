# 后端部署到 Railway（极简）

**只做 3 件事**，老师就能用密码登录 www.kunlunfo.com。

---

## 1. 创建项目并部署

- 打开 https://railway.app ，用 **GitHub** 登录。
- **New Project** → **Deploy from GitHub repo** → 选 **woody2014ca/ArtDoU**。
- 等它自动构建、部署（根目录有 Dockerfile，不用改）。

---

## 2. 只配 2 个变量

- 点进该服务 → **Variables**。
- 添加：

| 变量名 | 值 |
|--------|-----|
| ADMIN_PASSWORD | ArtDoU2026 |
| JWT_SECRET | mySecret2026 |

**不要**填 MONGODB_URI、MONGODB_DB。不填数据库也能用：老师密码登录正常，/health 正常；家长绑定、学员数据等会提示「暂未开放」或「未配置数据库」。

---

## 3. 生成域名并让前端连上

- 同一服务 **Settings** → **Networking** → **Generate Domain**，复制地址（如 https://xxx.up.railway.app）。
- 到 **Vercel** 你的前端项目 → **Settings** → **Environment Variables** → 添加：
  - **VITE_API_URL** = 上一步的地址
- **Deployments** → 最新部署点 **Redeploy**。

---

完成。等 1～2 分钟访问 www.kunlunfo.com，用密码 **ArtDoU2026** 登录即可。

**若 /health 仍 502**：到该服务 **Settings** → **Networking**（或 **Deploy** 相关），确认 **Port** / 内部端口为 **8080**（与代码监听一致）；Dockerfile 已 EXPOSE 8080。

以后如果需要学员名单、考勤、家长绑定等，再在 Railway 的 Variables 里加上 **MONGODB_URI**（Atlas 连接串）和 **MONGODB_DB=artdou** 即可。

---

## 若连 Atlas 一直报 SSL alert 80（推荐：改用 Railway 自带 MongoDB）

Railway 的 Node 环境和 Atlas 的 TLS 存在兼容问题，多次尝试仍可能报错。**最稳的做法**是改用 Railway 自带的 MongoDB，走内网、无 TLS：

1. 在 **同一 Railway 项目** 里，点 **+ New**（或 `Ctrl+K`）→ 选 **Database** 或从模板选 **MongoDB**，部署一个 MongoDB 服务（名字如 `Mongo`）。
2. 部署好后，点进 **ArtDoU** 服务 → **Variables** → **Add Variable** 或 **RAW Editor**：
   - **MONGODB_URI**：点「引用其他服务变量」，选刚建的 Mongo 服务的 **MONGO_URL**（或手动填 `${{Mongo.MONGO_URL}}`，其中 `Mongo` 换成你起的服务名）。
   - **MONGODB_DB**：`artdou`（保持不变）。
3. 保存后 **Deploy** ArtDoU。  
代码已支持用 **MONGO_URL**（Railway MongoDB 提供的变量名）当连接串，不填 MONGODB_URI 只填 MONGO_URL 也可。

这样数据库和 API 在同一项目内网互通，不再连 Atlas，SSL 80 问题自然消失。若 Atlas 里已有数据，可用 `mongodump`/`mongorestore` 或 Atlas 导出后导入到 Railway 的 MongoDB。

---

若坚持用 Atlas：检查 **Network Access** 是否包含 **0.0.0.0/0**；界面只给 `mongodb+srv://...`，用该串即可。
