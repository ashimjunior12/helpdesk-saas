import { Router } from 'express';
import { validateBody } from '../../middleware/validate.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { requireOrg } from '../../middleware/requireOrg.js';
import { requireRole } from '../../middleware/requireRole.js';
import { create, list, remove } from './messages.controller.js';
import { createMessageSchema } from './messages.validation.js';

// mergeParams gives access to :ticketId from the parent mount path.
const router = Router({ mergeParams: true });

router.use(requireAuth, requireOrg);

router.get('/', list);
router.post('/', validateBody(createMessageSchema), create);
router.delete('/:id', requireRole('ADMIN', 'MANAGER'), remove);

export const messagesRouter = router;
