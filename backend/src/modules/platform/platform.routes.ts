import { Router } from 'express';
import { validateBody } from '../../middleware/validate.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { requireSuperAdmin } from '../../middleware/requireSuperAdmin.js';
import {
  createOrg,
  createOrgUser,
  deleteOrgUser,
  listOrgUsers,
  listOrgs,
} from './platform.controller.js';
import { createOrganizationSchema } from './platform.validation.js';
import { createUserSchema } from '../users/users.validation.js';

// Platform administration, restricted to the SUPER_ADMIN.
const router = Router();

router.use(requireAuth, requireSuperAdmin);

router.get('/organizations', listOrgs);
router.post('/organizations', validateBody(createOrganizationSchema), createOrg);
router.get('/organizations/:orgId/users', listOrgUsers);
router.post('/organizations/:orgId/users', validateBody(createUserSchema), createOrgUser);
router.delete('/organizations/:orgId/users/:userId', deleteOrgUser);

export const platformRouter = router;
