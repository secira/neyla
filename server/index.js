import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.js';
import workspaceRoutes from './routes/workspaces.js';
import projectRoutes from './routes/projects.js';
import paymentRoutes from './routes/payments.js';
import sandboxRoutes from './routes/sandbox.js';
import deploymentRoutes from './routes/deployments.js';
import adminRoutes from './routes/admin.js';
import { runMigrations } from './migrations/run.js';
import { migrateStoredCredentials } from './lib/credentialVault.js';

const app = express();
const PORT = process.env.AUTH_SERVER_PORT || 3001;

app.use(
  cors({
    origin: process.env.APP_URL || 'http://localhost:5000',
    credentials: true,
  }),
);

app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());

app.use('/auth', authRoutes);
app.use('/workspaces', workspaceRoutes);
app.use('/projects', projectRoutes);
app.use('/payments', paymentRoutes);
app.use('/sandbox', sandboxRoutes);
app.use('/deployments', deploymentRoutes);
app.use('/admin', adminRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

runMigrations()
  .then(() => migrateStoredCredentials())
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Auth server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('[migrations] Fatal error, server not starting:', err.message);
    process.exit(1);
  });
