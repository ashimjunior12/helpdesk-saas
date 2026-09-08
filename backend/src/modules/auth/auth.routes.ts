import { Router } from 'express';
import { validateBody } from '../../middleware/validate.js';
import { requireAuth } from './auth.middleware.js';
import { login, logout, me, refresh, register } from './auth.controller.js';
import { loginSchema, refreshSchema, registerSchema } from './auth.validation.js';

const router = Router();

router.post('/register', validateBody(registerSchema), register);
router.post('/login', validateBody(loginSchema), login);
router.post('/refresh', validateBody(refreshSchema), refresh);
router.post('/logout', logout);
router.get('/me', requireAuth, me);

export const authRouter = router;
