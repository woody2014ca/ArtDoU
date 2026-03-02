#!/usr/bin/env node
/**
 * 一键部署：暂存 web 与部署相关改动 → 提交 → 推送到 origin
 * 触发 Railway（后端）、Vercel（前端）自动部署。
 * 使用：npm run deploy 或 node scripts/deploy.js
 */
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const allPaths = [
  'package.json',
  'README-ArtDoU.md',
  'scripts/deploy.js',
  'web/frontend/src',
  'web/frontend/public',
  'web/frontend/index.html',
  'web/frontend/package.json',
  'web/frontend/package-lock.json',
  'web/frontend/vite.config.js',
  'web/frontend/vercel.json',
  'web/frontend/VERCEL-API-配置.md',
  'web/backend/server.js',
  'web/backend/db.js',
  'web/backend/routes',
  'web/backend/middleware',
  'web/backend/问题总结-供外部审计.md',
  'web/backend/DEPLOY-RAILWAY.md',
  'web/backend/RAILWAY-MONGODB-审计说明.md',
  'Dockerfile',
  'railway.json',
];
const addPaths = allPaths.filter((p) => existsSync(join(root, p)));
const msg = `deploy: ${new Date().toISOString().slice(0, 10)} 前端/后端更新`;

function run(cmd, opts = {}) {
  return execSync(cmd, { cwd: root, stdio: 'inherit', shell: true, ...opts });
}

try {
  addPaths.forEach((p) => run(`git add "${p}"`));
  run('git status --short');
  run(`git commit -m "${msg}"`);
  run('git push origin main');
  console.log('\n已推送，Railway / Vercel 会自动部署。');
} catch (e) {
  const code = e.status ?? e.exitCode ?? 1;
  if (code === 1) {
    console.log('\n无变更可提交或推送失败（例如无远程、需先 pull）。');
  }
  process.exit(code);
}
