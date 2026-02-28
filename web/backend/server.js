import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connect } from './db.js';
import authRoutes from './routes/auth.js';
import dataRoutes from './routes/data.js';
import paymentRoutes from './routes/payment.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/payment', paymentRoutes);

app.get('/health', (req, res) => res.json({ ok: true }));

async function start() {
  try {
    await connect();
    console.log('MongoDB connected');
  } catch (e) {
    console.error('MongoDB connect failed:', e.message);
  }
  app.listen(PORT, '0.0.0.0', () => console.log('API listening on', PORT));
}

start();
