import { Router } from 'express';
import { getHealth } from './health.controller.js';

const router = Router();

// GET /api/health - public readiness probe (checks dependencies).
router.get('/', getHealth);

// GET /api/health/live - liveness: the process is up (no dependency checks).
router.get('/live', (_req, res) => {
  res.status(200).json({ success: true, data: { status: 'alive' } });
});

export const healthRouter = router;
