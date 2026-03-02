import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connect } from './db.js';
import authRoutes from './routes/auth.js';
import dataRoutes from './routes/data.js';
import paymentRoutes from './routes/payment.js';
import posterRoutes from './routes/poster.js';

console.log('[ArtDoU] process starting, PORT from env:', process.env.PORT);

// 防止未处理的 Promise rejection 导致进程退出（避免 502）
process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection:', reason);
});

const app = express();
// Railway 注入 PORT=8080；无 fallback 到 3001，仅 fallback 到 8080，且必须 0.0.0.0
const PORT = Number(process.env.PORT) || 8080;
if (!process.env.PORT) {
  console.warn('⚠️ PORT not in env, using 8080');
}
console.log('[ArtDoU] will listen on 0.0.0.0:' + PORT);

app.use(cors({ origin: true, credentials: true }));
// 消课会提交作品图 base64，提高限制避免 413 或返回非 JSON
app.use(express.json({ limit: '10mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/poster', posterRoutes);

app.get('/health', (_, res) => res.status(200).json({ status: 'ok', ok: true }));

// 未匹配路由一律返回 JSON，避免任何 HTML 导致前端解析报错
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Not Found' });
});

// 全局错误处理，确保异常时也返回 JSON（含 body 过大 413）
app.use((err, _req, res, _next) => {
  console.error('[ArtDoU] route error:', err);
  const status = err.status ?? err.statusCode ?? 500;
  res.status(status).json({ success: false, error: err.message || 'Server Error' });
});

// 不配 MONGODB_URI 时完全不连数据库，只支持老师密码登录，无 502、无 Atlas
function start() {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ API listening on ${PORT}`);
    if (process.env.MONGODB_URI || process.env.MONGO_URL) {
      connect()
        .then(() => console.log('MongoDB connected'))
        .catch((e) => console.error('MongoDB connect failed:', e.message));
    } else {
      console.log('No MONGODB_URI/MONGO_URL: teacher login only, no database.');
    }
  });
}

start();
