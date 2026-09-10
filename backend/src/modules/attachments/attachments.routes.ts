import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware.js';
import { requireOrg } from '../../middleware/requireOrg.js';
import { requireRole } from '../../middleware/requireRole.js';
import { uploadSingle } from '../../middleware/upload.js';
import { download, list, remove, upload } from './attachments.controller.js';

const router = Router({ mergeParams: true });

router.use(requireAuth, requireOrg);

router.get('/', list);
router.post('/', uploadSingle('file'), upload);
router.get('/:id/download', download);
router.delete('/:id', requireRole('ADMIN', 'MANAGER'), remove);

export const attachmentsRouter = router;
