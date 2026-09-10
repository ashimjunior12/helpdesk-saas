import { Router } from 'express';
import { validateBody } from '../../middleware/validate.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { requireOrg } from '../../middleware/requireOrg.js';
import { requireRole } from '../../middleware/requireRole.js';
import { get, update } from './sla.controller.js';
import { updateSlaPolicySchema } from './sla.validation.js';

const router = Router();

router.use(requireAuth, requireOrg);

router.get('/', get);
router.put('/', requireRole('ADMIN'), validateBody(updateSlaPolicySchema), update);

export const slaRouter = router;
