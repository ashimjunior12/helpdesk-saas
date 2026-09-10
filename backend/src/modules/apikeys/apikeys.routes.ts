import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware.js';
import { requireOrg } from '../../middleware/requireOrg.js';
import { requireRole } from '../../middleware/requireRole.js';
import { create, list, revoke } from './apikeys.controller.js';

const router = Router();

// API keys are managed by ADMINs through the normal authenticated API.
router.use(requireAuth, requireOrg, requireRole('ADMIN'));

router.get('/', list);
router.post('/', create);
router.delete('/:id', revoke);

export const apiKeysRouter = router;
