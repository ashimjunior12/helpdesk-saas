import { Router } from 'express';
import { validateBody } from '../../middleware/validate.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { requireOrg } from '../../middleware/requireOrg.js';
import { requireRole } from '../../middleware/requireRole.js';
import { create, getOne, list, remove, update } from './customers.controller.js';
import { createCustomerSchema, updateCustomerSchema } from './customers.validation.js';

const router = Router();

router.use(requireAuth, requireOrg);

// Read and search: any role. Create/update: any role. Delete: ADMIN or MANAGER.
router.get('/', list);
router.get('/:id', getOne);
router.post('/', validateBody(createCustomerSchema), create);
router.patch('/:id', validateBody(updateCustomerSchema), update);
router.delete('/:id', requireRole('ADMIN', 'MANAGER'), remove);

export const customersRouter = router;
