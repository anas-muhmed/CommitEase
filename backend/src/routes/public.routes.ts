import { Router } from 'express';
import { signupRateLimiter } from '../middleware/rateLimiter';
import * as MasjidController from '../controllers/masjid.controller';

const router = Router();

// Unauthenticated — rate-limited (5 requests per IP per hour).
router.post('/masjid-signup', signupRateLimiter, MasjidController.publicSignup);

export default router;
