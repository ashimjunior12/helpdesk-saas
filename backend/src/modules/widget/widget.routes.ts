import { Router } from 'express';
import cors from 'cors';
import { validateBody } from '../../middleware/validate.js';
import { widgetLimiter } from '../../middleware/rateLimit.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { requireOrg } from '../../middleware/requireOrg.js';
import { requireRole } from '../../middleware/requireRole.js';
import { getConfig, postRotate, publicConfig, publicSubmit, putConfig } from './widget.controller.js';
import { updateWidgetSchema, widgetTicketSchema } from './widget.validation.js';

// Admin configuration of the widget (JWT + ADMIN).
const configRouter = Router();
configRouter.use(requireAuth, requireOrg, requireRole('ADMIN'));
configRouter.get('/', getConfig);
configRouter.put('/', validateBody(updateWidgetSchema), putConfig);
configRouter.post('/rotate-key', postRotate);

// Public widget API embedded on arbitrary sites: its own permissive CORS (so
// preflight from any origin succeeds) and no auth beyond the public key.
const publicRouter = Router();
publicRouter.use(cors({ origin: true }), widgetLimiter);
publicRouter.get('/:publicKey/config', publicConfig);
publicRouter.post('/:publicKey/tickets', validateBody(widgetTicketSchema), publicSubmit);

export const widgetConfigRouter = configRouter;
export const publicWidgetRouter = publicRouter;
