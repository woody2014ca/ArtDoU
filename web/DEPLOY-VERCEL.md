# 用 Vercel 部署前端（www.kunlunfo.com）

## 一、把代码推到 GitHub

1. 在 [github.com](https://github.com) 登录，新建一个仓库（例如 `artdou-web`），不要勾选「Initialize with README」。
2. 在本机项目目录打开终端，执行（把 `你的用户名` 换成你的 GitHub 用户名）：

```bash
cd c:\Users\Administrator\Desktop\ArtProject
git init
git add .
git commit -m "ArtDoU web"
git branch -M main
git remote add origin https://github.com/你的用户名/artdou-web.git
git push -u origin main
```

如果项目里已有 `.git`，只需 `git add .`、`git commit`、`git push` 即可。

---

## 二、在 Vercel 部署前端

1. 打开 [vercel.com](https://vercel.com)，用 GitHub 登录。
2. 点击 **Add New… → Project**，从列表里选择刚推送的仓库（如 `artdou-web`）。
3. **重要**：在配置里把 **Root Directory** 设为 **`web/frontend`**（只部署前端目录）。
4. **Build and Output** 保持默认即可：
   - Framework Preset: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. 先不要填环境变量，直接点 **Deploy**。等部署完成会得到一个地址，例如 `artdou-web-xxx.vercel.app`，能打开页面（此时点登录/接口会失败，因为后端还没接上，属正常）。

---

## 三、在 Vercel 绑定域名

1. 在 Vercel 里打开刚部署的项目，进入 **Settings → Domains**。
2. 在输入框填：**www.kunlunfo.com**，点 Add。
3. Vercel 会提示「未生效」并给出解析要求，例如：
   - 类型 **CNAME**
   - 主机记录 **www**
   - 记录值 **cname.vercel-dns.com**（以 Vercel 页面上显示的为准）

---

## 四、在阿里云添加解析

1. 登录 [阿里云](https://www.aliyun.com) → **控制台** → **域名** → 找到 **kunlunfo.com** → **解析**。
2. 点击 **添加记录**，按 Vercel 的提示填：
   - **记录类型**：CNAME  
   - **主机记录**：www  
   - **记录值**：`cname.vercel-dns.com`（与 Vercel 显示一致）  
   - **TTL**：10 分钟  
3. 保存。等待几分钟后访问 **https://www.kunlunfo.com**，应能打开你的前端页面。

（可选）若希望 **kunlunfo.com**（不带 www）也能访问：在 Vercel 的 Domains 里再添加 `kunlunfo.com`，按提示在阿里云为「主机记录 @」添加 A 记录，记录值一般为 `76.76.21.21`。

---

## 五、后端与数据库（接口能用起来）

前端部署好后，登录、数据等需要**后端 API** 和 **MongoDB**。可以：

- **MongoDB**：在 [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) 注册，建一个免费集群，拿到连接字符串（如 `MONGODB_URI`）。
- **后端**：把 `web/backend` 部署到 [Railway](https://railway.app) 或 [Render](https://render.com)（都有免费档），在那边配置环境变量：`MONGODB_URI`、`JWT_SECRET`、`ADMIN_PASSWORD` 等。部署完成后会得到一个地址，例如 `https://artdou-api.railway.app`。
- **接回前端**：在 Vercel 项目 **Settings → Environment Variables** 里添加：
  - **Name**：`VITE_API_URL`  
  - **Value**：你的后端地址，如 `https://artdou-api.railway.app`  
  保存后重新 **Redeploy** 一次项目，前端的请求就会发到后端，登录和数据就通了。

---

## 六、小结

| 步骤 | 说明 |
|------|------|
| 1 | 代码推送到 GitHub |
| 2 | Vercel 导入仓库，Root 设为 `web/frontend`，部署 |
| 3 | Vercel 里添加域名 www.kunlunfo.com |
| 4 | 阿里云为 www 添加 CNAME 到 cname.vercel-dns.com |
| 5 | （可选）后端 + MongoDB 部署好后，在 Vercel 设置 VITE_API_URL 并重新部署 |

按顺序做完 1～4，**www.kunlunfo.com** 就能打开页面；做完 5 后，登录和数据功能即可正常使用。
