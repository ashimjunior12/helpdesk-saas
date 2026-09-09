import { Router } from 'express';
import { validateBody } from '../../middleware/validate.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { requireOrg } from '../../middleware/requireOrg.js';
import { requireRole } from '../../middleware/requireRole.js';
import {
  assign,
  changeTicketStatus,
  create,
  getOne,
  list,
  remove,
  update,
} from './tickets.controller.js';
import {
  assignTicketSchema,
  changeStatusSchema,
  createTicketSchema,
  updateTicketSchema,
} from './tickets.validation.js';

const router = Router();

router.use(requireAuth, requireOrg);

// Read/list: any role. Create/update/status/assign: any role. Delete: ADMIN or MANAGER.
router.get('/', list);
router.get('/:id', getOne);
router.post('/', validateBody(createTicketSchema), create);
router.patch('/:id', validateBody(updateTicketSchema), update);
router.post('/:id/status', validateBody(changeStatusSchema), changeTicketStatus);
router.post('/:id/assign', validateBody(assignTicketSchema), assign);
router.delete('/:id', requireRole('ADMIN', 'MANAGER'), remove);

export const ticketsRouter = router;
