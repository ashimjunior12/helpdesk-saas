import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware.js';
import { requireOrg } from '../../middleware/requireOrg.js';
import { getUnreadCount, list, readAll, readOne } from './notifications.controller.js';

const router = Router();

// Each user manages only their own notifications (scoped by req.user in the
// service); no role restriction.
router.use(requireAuth, requireOrg);

router.get('/', list);
router.get('/unread-count', getUnreadCount);
router.post('/read-all', readAll);
router.post('/:id/read', readOne);

export const notificationsRouter = router;
