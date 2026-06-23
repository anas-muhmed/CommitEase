import { Router } from 'express';
import { otpRateLimiter } from '../middleware/rateLimiter';
import * as AuthController from '../controllers/auth.controller';

const router = Router();

// Committee
router.post('/committee/login', AuthController.committeeLogin);
router.post('/committee/refresh', AuthController.committeeRefresh);
router.post('/committee/logout', AuthController.committeeLogout);

// Member — OTP request is rate-limited (5 requests per 10 min per IP in Phase 3)
router.post('/member/request-otp', otpRateLimiter, AuthController.requestOtp);
router.post('/member/verify-otp', AuthController.verifyOtp);
router.post('/member/refresh', AuthController.memberRefresh);
router.post('/member/logout', AuthController.memberLogout);

export default router;
