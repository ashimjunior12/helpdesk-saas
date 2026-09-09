import { Router } from 'express';
import { validateBody } from '../../middleware/validate.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { requireOrg } from '../../middleware/requireOrg.js';
import { requireRole } from '../../middleware/requireRole.js';
import {
  addTeamMember,
  create,
  getOne,
  list,
  remove,
  removeTeamMember,
  update,
} from './teams.controller.js';
import { addMemberSchema, createTeamSchema, updateTeamSchema } from './teams.validation.js';

const router = Router();

router.use(requireAuth, requireOrg);

const canManage = requireRole('ADMIN', 'MANAGER');

router.get('/', list);
router.get('/:id', getOne);
router.post('/', canManage, validateBody(createTeamSchema), create);
router.patch('/:id', canManage, validateBody(updateTeamSchema), update);
router.delete('/:id', canManage, remove);
router.post('/:id/members', canManage, validateBody(addMemberSchema), addTeamMember);
router.delete('/:id/members/:userId', canManage, removeTeamMember);

export const teamsRouter = router;
