# CommitEase Business Rules v1.0

## Rule 1 — Multi-Tenant Isolation

Each masjid is an isolated tenant.

Requirements:

* Every business entity belongs to exactly one masjid
* Committee users only access their masjid
* Members only access their own data

---

## Rule 2 — Committee Authentication

Committee users login using:

* Masjid code
* Username
* Password

Constraints:

* Username unique within a masjid
* Same username allowed across different masjids

Example:
Masjid A → admin
Masjid B → admin
Allowed

---

## Rule 3 — Member Authentication

Digital members login using:

* Phone number
* OTP

Constraints:

* Only digital_enabled members may login
* Phone number must be unique within same masjid for digital members
* OTP valid for 5 minutes
* OTP max attempts: 3
* OTP resend rate-limited

Offline members:

* No login
* Managed only by committee

---

## Rule 4 — Member Contribution Policy

CommitEase V1 tracks only recurring monthly membership contributions.

Excluded from V1:

* Charity campaigns
* Udhiyah / Qurbani shares
* Building funds
* Event donations

These belong to future campaign modules.

---

## Rule 5 — Contribution Fee History

Monthly contribution fee is defined at masjid level.

Fee may change over time.

Fee changes must never retroactively alter old dues.

Fee history stored in contribution_fee_history.

Example:
2025-01-01 → ₹100
2026-07-01 → ₹200

Due calculations must use fee applicable for each month.

---

## Rule 6 — Join Month Charging Policy

UNRESOLVED (business clarification pending)

Possible policies:
A. Charge full month immediately
B. Start charging from next month

System must support either policy.

---

## Rule 7 — Due Calculation

Member due is calculated dynamically.

Formula:
Current Due =
Opening Due Balance

* Expected Contributions
  − Successful Payments

Expected contributions are calculated month-by-month using fee history.

---

## Rule 8 — Payment Allocation

Payments use FIFO allocation.

Algorithm:

1. Find oldest unpaid month
2. Allocate payment to oldest dues first
3. Continue until payment exhausted

Example:
Unpaid months:
Jan, Feb, Mar

Payment covers two months:
Jan → paid
Feb → paid
Mar → pending

---

## Rule 9 — Payment Types

Supported payment modes:

* CASH
* ONLINE

Cash:

* Recorded by committee editor

Online:

* Via payment gateway

---

## Rule 10 — Payment Finalization

Frontend success is NOT trusted.

Payment becomes successful only after:

* backend verification
  or
* gateway webhook confirmation

Only then:

* payment status = SUCCESS
* receipt generated
* allocations created

---

## Rule 11 — Financial Record Integrity

Payments must never be hard deleted.

Allowed corrections:

* reverse payment
* create replacement entry

Historical ledger must remain auditable.

---

## Rule 12 — Receipt Generation

Receipt generated only for successful payments.

Receipt format:
MASJIDCODE-YYYYMM-SEQUENCE

Example:
MZ001-202606-0007

Receipt sequence increments per masjid.

---

## Rule 13 — Audit Logging

Sensitive actions must be logged.

Examples:

* member created
* member edited
* payment recorded
* payment reversed

Audit log stores:

* actor
* action
* old value
* new value
* timestamp
