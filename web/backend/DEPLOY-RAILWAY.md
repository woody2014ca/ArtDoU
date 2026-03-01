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

以后如果需要学员名单、考勤、家长绑定等，再在 Railway 的 Variables 里加上 **MONGODB_URI**（Atlas 连接串）和 **MONGODB_DB=artdou** 即可。

---

## 若连 Atlas 报 SSL alert 80

- 在 Atlas 控制台：你的集群 → **Connect** → **Drivers**，复制 **「Standard connection string」**（不是 mongodb+srv 那条，是带具体主机和 27017 的那条），贴到 Railway 的 **MONGODB_URI**，保存后重新部署。
