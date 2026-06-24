import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/authenticate';
import { requireActiveMasjid } from '../middleware/requireActiveMasjid';
import { requirePasswordChange } from '../middleware/requirePasswordChange';
import * as MemberController from '../controllers/member.controller';

const router = Router();
const committee = [authenticate, requireActiveMasjid, requirePasswordChange];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

// ─── Members ──────────────────────────────────────────────────────────────────
// Static /members/import MUST be registered before dynamic /members/:memberId.
router.post('/members/import', [...committee, upload.single('file')], MemberController.bulkImport);
router.get('/members', committee, MemberController.listMembers);
router.post('/members', committee, MemberController.createMember);
router.get('/members/:memberId', committee, MemberController.getMember);
router.patch('/members/:memberId', committee, MemberController.updateMember);
router.delete('/members/:memberId', committee, MemberController.deactivateMember);

// ─── Contribution fees ────────────────────────────────────────────────────────
router.get('/fee/history', committee, MemberController.getFeeHistory);
router.post('/fee', committee, MemberController.setFee);

export default router;
