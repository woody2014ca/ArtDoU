# 前端 www.kunlunfo.com 报「网络错误」— 必查项

## 原因

前端请求后端时用的是 **VITE_API_URL**。  
若 Vercel 部署时**没设**或**设错**，会请求到错误地址（例如 `/api` 即同域名），后端在 Railway，请求不到就会报「网络错误」或 502。

## 必做两步

### 1. 先确认后端是否正常

在浏览器**直接**打开（不要从登录页跳转）：

**https://artdou-production.up.railway.app/health**

- 若显示 `{"ok":true}` → 后端正常，问题在前端 API 地址。
- 若 502 / 打不开 → 先到 Railway 看 ArtDoU 服务是否 Online、Deploy Logs 有无报错，必要时 Redeploy。

### 2. 在 Vercel 配好并重新部署前端

1. 打开 **https://vercel.com**，登录后进入**部署 www.kunlunfo.com 的那个项目**（和 ArtDoU 前端对应的项目）。
2. 点 **Settings** → **Environment Variables**。
3. 新增或修改：
   - **Name**：`VITE_API_URL`（必须一模一样，Vite 只认这个名）
   - **Value**：`https://artdou-production.up.railway.app`（或带 `/api` 也可，前端会自动补全为 `/api` 路径）  
     - 不要末尾斜杠（若只填域名）  
     - 必须是 **https**
   - Environment 勾选 **Production**（若也部署 Preview 可一并勾选）。
4. 保存后，到 **Deployments**，对**最新一次部署**点 **⋯** → **Redeploy**（或触发一次新部署）。  
   **重要**：改环境变量后必须重新部署，否则线上用的还是旧构建，不会带上新 API 地址。

## 自检

- 部署完成后，打开 www.kunlunfo.com，按 F12 打开开发者工具 → **Network**，再点登录。
- 看请求的 URL：应是 `https://artdou-production.up.railway.app/api/auth/login`，而不是 `https://www.kunlunfo.com/api/...`。若仍是 kunlunfo.com 的 `/api`，说明 VITE_API_URL 未生效，需确认变量名和 Redeploy。
