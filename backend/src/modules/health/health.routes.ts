import { Router } from 'express';
import { getHealth } from './health.controller.js';

const router = Router();

// GET /api/health - public, unauthenticated probe.
router.get('/', getHealth);

export const healthRouter = router;
