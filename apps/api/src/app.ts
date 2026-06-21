import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

// Routes
import authRoutes from './routes/auth';
import superAdminRoutes from './routes/superAdmin';
import storeRoutes from './routes/stores';
import staffRoutes from './routes/staff';
import productRoutes from './routes/products';
import orderRoutes from './routes/orders';
import paymentRoutes from './routes/payments';
import customerRoutes from './routes/customers';
import inventoryRoutes from './routes/inventory';
import restaurantRoutes from './routes/restaurant';
import salonRoutes from './routes/salon';
import timeclockRoutes from './routes/timeclock';
import reportRoutes from './routes/reports';
import aiRoutes from './routes/ai';
import syncRoutes from './routes/sync';

const app = express();

// Security
app.use(helmet({ crossOriginEmbedderPolicy: false }));
app.use(cors({ origin: config.corsOrigin, credentials: true }));

// Rate limiting
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { success: false, message: 'Too many requests' } }));
app.use('/api', rateLimit({ windowMs: 60 * 1000, max: 500 }));

// Body parsing
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
if (config.nodeEnv !== 'test') app.use(morgan('dev'));

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' }));

// DB health check — shows exact error if DB is not reachable
app.get('/health/db', async (_req, res) => {
  try {
    const { prisma } = await import('./config/prisma');
    await prisma.$queryRaw`SELECT 1`;
    const adminCount = await prisma.superAdmin.count();
    res.json({ status: 'ok', dbConnected: true, superAdminExists: adminCount > 0 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ status: 'error', dbConnected: false, error: msg });
  }
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/restaurant', restaurantRoutes);
app.use('/api/salon', salonRoutes);
app.use('/api/timeclock', timeclockRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/sync', syncRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
