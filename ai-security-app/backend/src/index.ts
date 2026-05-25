// src/index.ts
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db';
import { verifyMailer } from './config/mailer';
import { apiLimiter } from './middleware/rateLimit.middleware';
import { notFound, errorHandler } from './middleware/error.middleware';
import { defaultCorsOptions } from './middleware/cors.middleware';

// ─── Routes ───────────────────────────────────────────────────────────────────
import authRoutes      from './routes/auth.routes';
import dashboardRoutes from './routes/dashboard.routes';
import apikeyRoutes    from './routes/apikey.routes';
import scanRoutes      from './routes/scan.routes';
import sessionRoutes   from './routes/session.routes';
import billingRoutes   from './routes/billing.routes';
import aiRoutes        from './routes/ai.routes';
import test            from './middleware/test';


const app  = express();
const PORT = process.env.PORT || 5000;

// ─── Global Middleware ────────────────────────────────────────────────────────
// defaultCorsOptions = strict (FRONTEND_URL only).
// /api/ai/* overrides this with extensionCors inside its own router.
app.use(cors(defaultCorsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/api', apiLimiter);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status:      'ok',
    environment: process.env.NODE_ENV || 'development',
    timestamp:   new Date().toISOString(),
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
// app.use('/', test)
//app.use('/api/ai/chat', test) // Mount the test router to handle /api/ai/chat and /api/scan-results for testing purposes
app.use('/api/auth',      authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/apikeys',   apikeyRoutes);
app.use('/api/scans',     scanRoutes);
app.use('/api/sessions',  sessionRoutes);
app.use('/api/billing',   billingRoutes);
app.use('/api/ai',        aiRoutes);     // extensionCors + protectAny applied inside

// ─── Error Handlers ───────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

const publicUrl = process.env.APP_URL || `http://localhost:${PORT}`;
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

// ─── Boot ─────────────────────────────────────────────────────────────────────
const start = async () => {
  await connectDB();
  await verifyMailer();
  app.listen(PORT, () => {
    console.log(`\n🚀  Server running on ${publicUrl}`);
    console.log(`📡  Environment : ${process.env.NODE_ENV || 'development'}`);
    console.log(`🌐  Frontend URL: ${frontendUrl}\n`);
  });
};

start();
