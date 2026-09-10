import { Router } from 'express';
import { validateBody } from '../../middleware/validate.js';
import { apiKeyAuth } from '../../middleware/apiKeyAuth.js';
import { publicApiLimiter } from '../../middleware/rateLimit.js';
import { createTicket, getTicketPublic, listTicketsPublic } from './public.controller.js';
import { publicTicketSchema } from './public.validation.js';

// Public, versioned API authenticated by an org API key (x-api-key header).
const router = Router();

router.use(publicApiLimiter, apiKeyAuth);

router.post('/tickets', validateBody(publicTicketSchema), createTicket);
router.get('/tickets', listTicketsPublic);
router.get('/tickets/:id', getTicketPublic);

export const publicApiRouter = router;
