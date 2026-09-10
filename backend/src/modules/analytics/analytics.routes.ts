import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware.js';
import { requireOrg } from '../../middleware/requireOrg.js';
import { overview } from './analytics.controller.js';

const router = Router();

router.use(requireAuth, requireOrg);
router.get('/overview', overview);

export const analyticsRouter = router;
