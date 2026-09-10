import { Router } from 'express';
import { validateBody } from '../../middleware/validate.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { requireOrg } from '../../middleware/requireOrg.js';
import { requireRole } from '../../middleware/requireRole.js';
import { create, getOne, list, remove, update } from './automation.controller.js';
import { createRuleSchema, updateRuleSchema } from './automation.validation.js';

const router = Router();

router.use(requireAuth, requireOrg);

// Read: any role. Manage: ADMIN.
router.get('/', list);
router.get('/:id', getOne);
router.post('/', requireRole('ADMIN'), validateBody(createRuleSchema), create);
router.patch('/:id', requireRole('ADMIN'), validateBody(updateRuleSchema), update);
router.delete('/:id', requireRole('ADMIN'), remove);

export const automationRouter = router;
