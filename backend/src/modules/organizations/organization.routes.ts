import { Router } from 'express';
import { validateBody } from '../../middleware/validate.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { requireOrg } from '../../middleware/requireOrg.js';
import { create, getById, getMine, update } from './organization.controller.js';
import { createOrganizationSchema, updateOrganizationSchema } from './organization.validation.js';

const router = Router();

router.use(requireAuth);

router.post('/', validateBody(createOrganizationSchema), create);
router.get('/me', requireOrg, getMine);
router.patch('/me', requireOrg, validateBody(updateOrganizationSchema), update);
router.get('/:id', requireOrg, getById);

export const organizationRouter = router;
