# ArtDoU 老师/家长管理端

## 本地运行

```bash
npm run dev
```

启动前端开发服务器，浏览器打开 http://localhost:5173/

## 一键部署

```bash
npm run deploy
```

会自动：暂存 `web/` 与部署相关改动 → 提交 → 推送到 `origin main`，触发 Railway（后端）与 Vercel（前端）自动部署。

## 构建

```bash
npm run build
```

产出在 `web/frontend/dist`，供 Vercel 或静态托管使用。
