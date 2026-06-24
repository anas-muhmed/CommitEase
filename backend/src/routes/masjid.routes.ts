import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import * as MasjidController from '../controllers/masjid.controller';

const router = Router();

// All routes in this file require SUPER_ADMIN authentication.
const superAdmin = [authenticate, authorize('SUPER_ADMIN')];

// ─── Signup request management ────────────────────────────────────────────────
// Registered before /:masjidId routes to prevent "signup-requests" matching as a masjidId param.

router.get('/signup-requests', ...superAdmin, MasjidController.listSignupRequests);
router.patch('/signup-requests/:requestId/approve', ...superAdmin, MasjidController.approveSignupRequest);
router.patch('/signup-requests/:requestId/reject', ...superAdmin, MasjidController.rejectSignupRequest);

// ─── Masjid CRUD ─────────────────────────────────────────────────────────────

router.post('/', ...superAdmin, MasjidController.createMasjid);
router.get('/', ...superAdmin, MasjidController.listMasjids);
router.get('/:masjidId', ...superAdmin, MasjidController.getMasjid);
router.patch('/:masjidId', ...superAdmin, MasjidController.updateMasjid);
router.patch('/:masjidId/approve', ...superAdmin, MasjidController.approveMasjid);
router.patch('/:masjidId/suspend', ...superAdmin, MasjidController.suspendMasjid);

// ─── Committee admin creation ─────────────────────────────────────────────────

router.post('/:masjidId/users', ...superAdmin, MasjidController.createCommitteeAdmin);

export default router;
