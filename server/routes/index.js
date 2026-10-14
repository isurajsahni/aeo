import { Router } from 'express';
import { isDBConnected } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import auditRoutes from './audit.routes.js';
import authRoutes from './auth.routes.js';
import projectRoutes from './project.routes.js';
import visibilityRoutes from './visibility.routes.js';

const router = Router();

router.get('/health', (_req, res) => {
  const db = isDBConnected();
  res.status(db ? 200 : 503).json({ status: db ? 'ok' : 'degraded', db: db ? 'up' : 'down', uptime: process.uptime() });
});

router.use('/auth', authRoutes);
router.use('/projects', requireAuth, projectRoutes);
router.use('/audits', requireAuth, auditRoutes);
router.use('/visibility', requireAuth, visibilityRoutes);

export default router;
