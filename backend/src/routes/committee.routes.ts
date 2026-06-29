import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/authenticate';
import { requireActiveMasjid } from '../middleware/requireActiveMasjid';
import { requirePasswordChange } from '../middleware/requirePasswordChange';
import * as MemberController from '../controllers/member.controller';
import * as PlanController from '../controllers/plan.controller';
import * as PaymentController from '../controllers/payment.controller';
import * as DashboardController from '../controllers/dashboard.controller';
import * as TreasuryController from '../controllers/treasury.controller';
import * as ExpenseController from '../controllers/expense.controller';
import * as PaymentFeedController from '../controllers/payment-feed.controller';
import * as SettingsController from '../controllers/settings.controller';
import * as ChelavController from '../controllers/chelav.controller';
import { requireCommitteeRole } from '../middleware/authorizeCommitteeRole';

const router = Router();
const committee = [authenticate, requireActiveMasjid, requirePasswordChange];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

// ─── Committee team (list of active users for this masjid) ───────────────────
router.get('/team', committee, MemberController.listTeam);

// ─── Global payment feed (across all members) ────────────────────────────────
router.get('/payments/kpi',  committee, PaymentFeedController.getPaymentKpi);
router.get('/payments',      committee, PaymentFeedController.getPaymentFeed);

// ─── Dashboard and reports ────────────────────────────────────────────────────
router.get('/dashboard', committee, DashboardController.getDashboard);
router.get('/reports/collection', committee, DashboardController.getCollectionReport);
router.get('/reports/overdue', committee, DashboardController.getOverdueReport);

// ─── Contribution plans (Member Types) ───────────────────────────────────────
router.get('/plans', committee, PlanController.listPlans);
router.post('/plans', committee, PlanController.createPlan);
router.get('/plans/:planId', committee, PlanController.getPlan);
router.patch('/plans/:planId', committee, PlanController.updatePlan);
router.post('/plans/:planId/fee', committee, PlanController.setFee);
router.get('/plans/:planId/fee/history', committee, PlanController.getFeeHistory);

// ─── Members ──────────────────────────────────────────────────────────────────
// Static routes MUST be registered before dynamic /members/:memberId.
router.post('/members/import', [...committee, upload.single('file')], MemberController.bulkImport);
router.get('/members/enriched', committee, MemberController.listEnriched);
router.get('/members', committee, MemberController.listMembers);
router.post('/members', committee, MemberController.createMember);
router.get('/members/:memberId', committee, MemberController.getMember);
router.patch('/members/:memberId', committee, MemberController.updateMember);
router.delete('/members/:memberId', committee, MemberController.deactivateMember);
router.post('/members/:memberId/reactivate', committee, requireCommitteeRole('TREASURER'), MemberController.reactivate);

// Plan switch — writes MemberPlanHistory; historical dues retain old plan rate.
router.patch('/members/:memberId/plan', committee, PlanController.switchMemberPlan);

// ─── Ledger and payments ──────────────────────────────────────────────────────
router.get('/members/:memberId/ledger', committee, MemberController.getLedger);
router.post('/members/:memberId/payments', committee, requireCommitteeRole('PAYMENT_OPERATOR'), MemberController.recordPayment);
router.get('/members/:memberId/payments', committee, MemberController.getPaymentHistory);

// Payment integrity — reversal and transfer require TREASURER role.
router.post('/members/:memberId/payments/:paymentId/reverse', committee, requireCommitteeRole('TREASURER'), PaymentController.reversePayment);
router.post('/members/:memberId/payments/:paymentId/transfer', committee, requireCommitteeRole('TREASURER'), PaymentController.transferPayment);

// ─── Treasury ─────────────────────────────────────────────────────────────────
router.get('/finance/treasury', committee, TreasuryController.getTreasury);

// Fund Accounts
router.get('/finance/accounts', committee, TreasuryController.listAccounts);
router.post('/finance/accounts', committee, requireCommitteeRole('TREASURER'), TreasuryController.createAccount);
router.get('/finance/accounts/:accountId', committee, TreasuryController.getAccount);
router.patch('/finance/accounts/:accountId', committee, requireCommitteeRole('TREASURER'), TreasuryController.updateAccount);
router.post('/finance/accounts/:accountId/opening-balance', committee, requireCommitteeRole('ADMIN'), TreasuryController.setOpeningBalance);
router.post('/finance/accounts/:accountId/transfer',        committee, requireCommitteeRole('TREASURER'), TreasuryController.transferFunds);
router.delete('/finance/accounts/:accountId',               committee, requireCommitteeRole('ADMIN'), TreasuryController.deleteAccount);

// Fund Reserves
router.get('/finance/reserves', committee, TreasuryController.listReserves);
router.post('/finance/reserves', committee, requireCommitteeRole('TREASURER'), TreasuryController.createReserve);
router.patch('/finance/reserves/:reserveId', committee, requireCommitteeRole('TREASURER'), TreasuryController.updateReserve);

// Treasury Ledger (immutable — read only)
router.get('/finance/ledger', committee, TreasuryController.getLedger);

// Ledger integrity — on-demand reconciliation check
router.get('/finance/integrity', committee, requireCommitteeRole('TREASURER'), TreasuryController.verifyIntegrity);

// Expenses
router.get('/finance/expenses',                    committee, ExpenseController.listExpenses);
router.post('/finance/expenses',                   committee, requireCommitteeRole('TREASURER'), ExpenseController.createExpense);
router.post('/finance/expenses/:expenseId/reimburse', committee, requireCommitteeRole('TREASURER'), ExpenseController.reimburseExpense);

// ─── Mosque settings ──────────────────────────────────────────────────────────
router.get('/settings',   committee, SettingsController.getSettings);
router.patch('/settings', committee, requireCommitteeRole('ADMIN'), SettingsController.updateSettings);

// ─── Chelav schedule ──────────────────────────────────────────────────────────
// Static routes registered before dynamic /:id param route.
router.get('/chelav/today',           committee, ChelavController.getToday);
router.get('/chelav/:year/:month',    committee, ChelavController.getMonth);
router.post('/chelav/swap',           committee, requireCommitteeRole('PAYMENT_OPERATOR'), ChelavController.swap);
router.post('/chelav/import',         committee, requireCommitteeRole('ADMIN'), ChelavController.importSchedule);
router.patch('/chelav/:id/status',    committee, requireCommitteeRole('PAYMENT_OPERATOR'), ChelavController.updateStatus);

export default router;
