# CommitEase — Master MVP Engineering Specification (v1.0)

## Project Overview

CommitEase is a multi-tenant SaaS web application that digitizes contribution collection and tracking for masjids (mosques).

The system allows:

* Masjid committees to manage members and payments
* Members to view dues and pay online
* Platform admins to manage multiple masjids
* Automatic due calculation and financial reporting

This is a production-grade financial workflow application. Accuracy, auditability, and security are critical.

---

# 1. Core Product Constraints

These are non-negotiable engineering rules.

## Rule 1 — Multi-Tenant Isolation

Each masjid is an isolated tenant.

A user from one masjid must NEVER access another masjid’s data.

Every major business table must include:

* masjid_id

All queries involving business data must scope by masjid_id.

---

## Rule 2 — Financial Records Are Immutable

Payments must never be hard deleted.

Incorrect payment records should be corrected by:

* reversal entries
  OR
* correction entries

Do NOT edit historical financial records silently.

---

## Rule 3 — Audit Logging

Every sensitive action must be logged.

Examples:

* member created
* member edited
* cash payment recorded
* payment reversed
* committee account modified

Audit logs must store:

* actor_id
* action
* entity_type
* entity_id
* old_value (JSON optional)
* new_value (JSON optional)
* timestamp

---

## Rule 4 — Dues Are Computed Automatically

Committee does NOT manually update dues every month.

Dues are derived from:

* opening due balance
* monthly contribution amount
* join date
* payment ledger

Formula:

Current Due =
opening_due_balance

* expected_contributions_since_launch

- total_payments

Expected Contributions =
months_elapsed × monthly_fee

---

# 2. Tech Stack

Frontend:

* Next.js
* TypeScript
* Tailwind CSS

Backend:

* Node.js
* Express
* TypeScript

Database:

* PostgreSQL

ORM:

* Prisma

Authentication:

* JWT access tokens
* Refresh tokens via cookies

Payments:

* Razorpay (later phase)

Deployment:

* Docker
* VPS (DigitalOcean/AWS)

---

# 3. Monorepo Structure

Repository root:

commitease/
frontend/
backend/
docs/

Backend structure:

backend/src/
config/
controllers/
routes/
services/
middleware/
utils/
prisma/
types/

Frontend structure:

frontend/src/
app/
components/
lib/
hooks/
services/
types/

---

# 4. User Roles

## Super Admin

Platform owner.

Permissions:

* create masjid
* deactivate masjid
* create committee accounts
* manage platform

---

## Committee Viewer

Read-only committee member.

Can:

* view members
* view reports
* view payments

Cannot modify.

---

## Committee Editor

Trusted committee member.

Can:

* add/edit members
* record cash payment
* modify non-financial member details

All edits logged.

---

## Member

Regular member/contributor.

Can:

* login
* view dues
* view payment history
* pay online
* download receipts

Can only access own records.

---

# 5. Member Types

## Digital Member

Has phone/device.

Can use member portal.

Fields:

* phone required
* digital_enabled = true

---

## Offline Member

No phone/device.

Managed only by committee.

Fields:

* phone optional
* digital_enabled = false

---

# 6. Database Schema

## Table: masjids

Fields:

* id (uuid)
* code (unique)
* name
* address
* active
* created_at
* updated_at

Example:
code = MZ001

---

## Table: users

Committee + super admin accounts.

Fields:

* id
* masjid_id nullable
* name
* username unique
* password_hash
* role
* active
* created_at

Role enum:

* SUPER_ADMIN
* COMMITTEE_VIEWER
* COMMITTEE_EDITOR

---

## Table: members

Fields:

* id
* masjid_id
* member_code unique within masjid
* name
* phone nullable
* address nullable
* join_date
* monthly_fee
* opening_due_balance
* digital_enabled
* active
* created_at
* updated_at

---

## Table: payments

Fields:

* id
* masjid_id
* member_id
* amount
* payment_mode
* payment_status
* payment_date
* recorded_by_user_id nullable
* gateway_order_id nullable
* gateway_payment_id nullable
* note nullable
* created_at

payment_mode enum:

* CASH
* ONLINE

payment_status enum:

* SUCCESS
* PENDING
* FAILED
* REVERSED

---

## Table: receipts

Fields:

* id
* masjid_id
* payment_id
* receipt_number unique
* generated_at

Receipt format:
MZ001-YYYYMM-XXXX

---

## Table: audit_logs

Fields:

* id
* masjid_id
* actor_id
* action
* entity_type
* entity_id
* old_value json nullable
* new_value json nullable
* created_at

---

# 7. Authentication Flow

## Committee Login

Input:

* masjid code
* username
* password

Returns:

* access token
* refresh token

---

## Member Login

Phase 1:
Phone + OTP (mock OTP acceptable initially)

Session persists 30–60 days.

No repeated login on same device.

---

# 8. Masjid Onboarding

When onboarding a masjid:

Collect:

* masjid info
* committee accounts
* member list

Member list import:

* Excel upload (later)
  OR
* manual entry (initial MVP)

Required member fields:

* name
* monthly_fee
* join_date
* opening_due_balance

Optional:

* phone
* address

---

# 9. Member Portal

Features:

## Dashboard

Display:

* member info
* total due
* total paid
* pending months

---

## Contribution Table

Monthly rows:

Columns:

* month
* status
* amount
* payment mode
* receipt

Status:

* PAID
* PENDING
* FUTURE

---

## Payment

Button:
Pay Due Amount

MVP:
Full due payment only

Partial payment optional later.

---

# 10. Payment Processing

Payment flow:

1. Member initiates payment
2. Backend creates payment order
3. Gateway payment occurs
4. Webhook verifies payment
5. Payment saved
6. Receipt generated
7. Due recalculated

Important:
Never trust frontend payment success.

Only backend verification finalizes payment.

---

# 11. Cash Payment Flow

Committee editor records:

* member
* amount
* payment date
* note

After save:
payment ledger updates automatically

---

# 12. Committee Portal

Two sections.

## View Panel

Accessible to:

* viewer
* editor

Contains:

* member list
* reports
* dashboards

Read only.

---

## Action Panel

Accessible only to:

* committee editor

Actions:

* add member
* edit member
* record cash payment

---

# 13. Reports

MVP reports:

## Payment Report

Filters:

* date range
* payment mode

---

## Long Due Report

Filters:

* 3 months
* 6 months
* 12 months

Show:

* member
* due amount
* pending months

---

## Summary Report

Display:

* expected amount
* collected amount
* outstanding amount

---

# 14. Security Requirements

Mandatory:

* bcrypt password hashing
* JWT validation middleware
* role authorization middleware
* input validation
* SQL injection prevention
* secure cookies
* HTTPS in production

---

# 15. Development Order (STRICT)

Build in this exact order.

Phase 0:
Project setup

Phase 1:
Prisma schema + PostgreSQL migrations

Phase 2:
Express server architecture

Phase 3:
Authentication system

Phase 4:
Masjid CRUD

Phase 5:
Member CRUD

Phase 6:
Due calculation service

Phase 7:
Payment ledger

Phase 8:
Committee dashboard APIs

Phase 9:
Frontend integration

Phase 10:
Payment gateway integration

Do NOT jump ahead.

Each phase must compile and be testable before moving on.

---

# AI Coding Constraints

When generating code:

* never invent fields outside this spec
* never change schema without explicit approval
* prefer clean modular code
* write production-style TypeScript
* avoid unnecessary abstractions
* explain major design decisions

If uncertain:
ASK before implementing
Do not hallucinate architecture.
