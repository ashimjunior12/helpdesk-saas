import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware.js';
import { requireOrg } from '../../middleware/requireOrg.js';
import { searchAll } from './search.controller.js';

const router = Router();

router.use(requireAuth, requireOrg);
router.get('/', searchAll);

export const searchRouter = router;
