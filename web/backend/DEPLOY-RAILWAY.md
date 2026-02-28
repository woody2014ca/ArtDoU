# 后端部署到 Railway（最短清单）

下面这些步骤需要你在浏览器里自己完成（约 5 分钟）。代码已准备好，Railway 会自动识别并运行。

---

## 1. 注册并创建项目

- 打开 https://railway.app ，用 **GitHub** 登录。
- 点 **New Project** → **Deploy from GitHub repo**。
- 选择仓库 **woody2014ca/ArtDoU**（和前端同一个仓库）。

---

## 2. 不要设置 Root Directory（重要）

- 仓库**根目录**已放好 **Dockerfile**，Railway 会据此用 Docker 构建，避免 “Error creating build plan with Railpack”。
- 点进服务后，在 **Settings** 里确认 **Root Directory** 为**空**（不要填 `web/backend`）。根目录的 Dockerfile 会自动把 `web/backend` 拷进镜像并运行。
- 若之前部署失败过，保存后点 **Redeploy** 再试一次。

---

## 3. 添加环境变量

- 在同一服务的 **Variables** 里，点 **Add Variable** 或 **RAW Editor**。
- 至少添加（把示例值改成你自己的）：

| 变量名 | 值（示例） |
|--------|------------|
| MONGODB_URI | 你的 MongoDB 连接串（Atlas 免费可申请） |
| MONGODB_DB | artdou |
| ADMIN_PASSWORD | ArtDoU2026 |
| JWT_SECRET | 随便一串英文/数字，如 mySecret2026 |

没有 MongoDB？去 https://www.mongodb.com/cloud/atlas 注册，建一个免费集群，复制连接字符串填到 MONGODB_URI。

---

## 4. 生成公网地址

- 同一服务里，**Settings** → **Networking** → **Generate Domain**。
- 复制生成的地址（如 https://xxx.up.railway.app）。

---

## 5. 让前端连到这个地址

- 打开 https://vercel.com ，进入你的前端项目。
- **Settings** → **Environment Variables** → 添加：
  - Name：**VITE_API_URL**
  - Value：第 4 步复制的地址（如 https://xxx.up.railway.app）
- 保存后，**Deployments** → 对最新部署点 **Redeploy**。

---

做完以上 5 步，等 1～2 分钟再打开 www.kunlunfo.com 用密码 **ArtDoU2026** 登录即可。
