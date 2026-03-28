import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.js';
import workspaceRoutes from './routes/workspaces.js';
import paymentRoutes from './routes/payments.js';

const app = express();
const PORT = process.env.AUTH_SERVER_PORT || 3001;

app.use(
  cors({
    origin: process.env.APP_URL || 'http://localhost:5000',
    credentials: true,
  }),
);

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

app.use('/auth', authRoutes);
app.use('/workspaces', workspaceRoutes);
app.use('/payments', paymentRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Auth server running on port ${PORT}`);
});
