import { Router } from 'express';
import { validateBody } from '../../middleware/validate.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { requireOrg } from '../../middleware/requireOrg.js';
import { requireRole } from '../../middleware/requireRole.js';
import { create, getOne, list, update } from './users.controller.js';
import { createUserSchema, updateUserSchema } from './users.validation.js';

const router = Router();

router.use(requireAuth, requireOrg);

router.get('/', list);
router.get('/:id', getOne);
router.post('/', requireRole('ADMIN'), validateBody(createUserSchema), create);
router.patch('/:id', requireRole('ADMIN'), validateBody(updateUserSchema), update);

export const usersRouter = router;
