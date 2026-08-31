# CommitEase

**Multi-tenant contribution and treasury platform for masjid committees, built around auditable financial workflows rather than spreadsheet-style CRUD.**

CommitEase digitizes member contributions, dues, receipts, committee operations and treasury activity while preserving the history behind every financial change.

## Why This Project Exists

Contribution collection is often managed through notebooks, spreadsheets and disconnected cash records. That works until fees change, members switch plans, payments need to be reversed, committee roles differ, or someone needs to explain exactly where the money went.

CommitEase treats those cases as domain rules, not edge cases.

## Engineering Highlights

- **Multi-tenant data model** with masjid-scoped members, users, payments, plans, treasury and audit data.
- **Historical due calculation** using contribution fee history and member plan history so later changes do not rewrite old dues.
- **Role-based committee operations** with separate `VIEWER`, `PAYMENT_OPERATOR`, `TREASURER` and `ADMIN` permissions.
- **Payment integrity workflows** for allocation, receipts, reversals and member-to-member payment transfers.
- **Immutable treasury ledger** recording account-level credits/debits while fund accounts maintain operational balances.
- **Treasury integrity endpoint** for on-demand reconciliation checks.
- **Expense + reimbursement workflows** supporting mosque-paid and personally-paid expenses.
- **Member financial summaries** used as a precomputed fast path for list/dashboard rendering.
- **Excel member import** and structured committee/member APIs.
- **OTP-backed member sessions**, JWT committee authentication and active-masjid enforcement.
- **Audit logging** with actor, entity, old value and new value snapshots.

## Architecture

```text
                    Next.js 16 / React 19
                           │
                           │ REST
                           ▼
                    Express 5 API
                           │
          ┌────────────────┼────────────────┐
          │                │                │
       Auth/RBAC       Domain services   Reporting
          │                │                │
          └────────────────┼────────────────┘
                           ▼
                    Prisma ORM
                           │
                           ▼
                     PostgreSQL

Core domains
├── Masjids / committee users
├── Members / contribution plans
├── Fee + member-plan history
├── Payments / allocations / receipts
├── Reversals / transfers / audit log
├── Fund accounts / reserves
├── Immutable treasury ledger
├── Expenses / reimbursements
└── Member financial summaries
```

## Important Domain Decisions

### Historical fees are append-only

A contribution-plan fee change creates a new history entry with an `effectiveFrom` date. Existing months keep the rate that applied at that time.

### Plan switches do not rewrite the past

`MemberPlanHistory` records when a member moved between contribution plans. Historical unpaid months therefore retain their original plan/rate instead of silently inheriting today's configuration.

### Reversal is a first-class financial event

Payments are not simply deleted when corrected. A dedicated reversal record preserves who reversed the payment, why, and when.

### Treasury history is immutable

Fund-account balance changes are accompanied by ledger entries. Transfers produce debit/credit history rather than destroying the previous state.

## API Surface

The backend is divided into clear route groups:

```text
/api/v1/auth       authentication
/api/v1/masjids    masjid/platform administration
/api/v1/public     public flows
/api/v1/committee  members, plans, payments, reports, treasury, expenses
/api/v1/member     member portal
/health            service health check
```

Committee operations currently include dashboards and reports, contribution plans and fee history, member management and import, dues/ledger views, payment recording/reversal/transfer, fund accounts, reserves, treasury integrity checks, expenses/reimbursements and committee settings.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS |
| Client state/data | TanStack Query, Zustand, Axios, React Hook Form, Zod |
| Backend | Node.js, Express 5, TypeScript |
| Database | PostgreSQL |
| ORM | Prisma |
| Authentication | JWT, bcrypt, cookies, OTP member flow |
| Import | ExcelJS + Multer |

## Repository Structure

```text
CommitEase/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   └── src/
│       ├── controllers/
│       ├── middleware/
│       ├── routes/
│       ├── services/
│       └── app.ts
├── frontend/
│   ├── app/
│   ├── components/
│   ├── lib/
│   └── middleware.ts
└── docs/
    ├── BUSINESS_RULES.md
    └── MVP_SPEC.md
```

## Local Development

### Backend

```bash
cd backend
npm install
cp .env.example .env
```

Configure PostgreSQL and the JWT secrets in `.env`, then run:

```bash
npx prisma migrate dev
npm run seed
npm run dev
```

The API defaults to `http://localhost:5000`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The Next.js app defaults to `http://localhost:3000`.

## Current Status

**Active development.** The repository contains the working backend domain model, REST routes, services and frontend application. The focus is currently on strengthening business-rule correctness, financial integrity and the overall product workflow.

## Design Principle

> Financial software should make historical truth harder to accidentally rewrite.

That principle drives the fee-history, plan-history, reversal, audit and treasury-ledger design across CommitEase.
