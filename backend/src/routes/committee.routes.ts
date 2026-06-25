import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/authenticate';
import { requireActiveMasjid } from '../middleware/requireActiveMasjid';
import { requirePasswordChange } from '../middleware/requirePasswordChange';
import * as MemberController from '../controllers/member.controller';
import * as PlanController from '../controllers/plan.controller';
import * as PaymentController from '../controllers/payment.controller';

const router = Router();
const committee = [authenticate, requireActiveMasjid, requirePasswordChange];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

// ─── Contribution plans (Member Types) ───────────────────────────────────────
router.get('/plans', committee, PlanController.listPlans);
router.post('/plans', committee, PlanController.createPlan);
router.get('/plans/:planId', committee, PlanController.getPlan);
router.patch('/plans/:planId', committee, PlanController.updatePlan);
router.post('/plans/:planId/fee', committee, PlanController.setFee);
router.get('/plans/:planId/fee/history', committee, PlanController.getFeeHistory);

// ─── Members ──────────────────────────────────────────────────────────────────
// Static /members/import MUST be registered before dynamic /members/:memberId.
router.post('/members/import', [...committee, upload.single('file')], MemberController.bulkImport);
router.get('/members', committee, MemberController.listMembers);
router.post('/members', committee, MemberController.createMember);
router.get('/members/:memberId', committee, MemberController.getMember);
router.patch('/members/:memberId', committee, MemberController.updateMember);
router.delete('/members/:memberId', committee, MemberController.deactivateMember);

// Plan switch — writes MemberPlanHistory; historical dues retain old plan rate.
router.patch('/members/:memberId/plan', committee, PlanController.switchMemberPlan);

// ─── Ledger and payments ──────────────────────────────────────────────────────
router.get('/members/:memberId/ledger', committee, MemberController.getLedger);
router.post('/members/:memberId/payments', committee, MemberController.recordPayment);
router.get('/members/:memberId/payments', committee, MemberController.getPaymentHistory);

// Payment integrity — reversal and transfer (both require reason; transfer validates same-masjid).
router.post('/members/:memberId/payments/:paymentId/reverse', committee, PaymentController.reversePayment);
router.post('/members/:memberId/payments/:paymentId/transfer', committee, PaymentController.transferPayment);

export default router;
