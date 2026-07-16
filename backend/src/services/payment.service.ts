import { Prisma, PaymentStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';
import { logAudit } from './audit.service';
import { getLedger, upsertMemberSummary } from './member.service';

// Helper used by both reversal and transfer to write the net-zero REVERSAL ledger entries.
async function writeFundReversalLedger(
  tx: Prisma.TransactionClient,
  masjidId: string,
  accountId: string,
  amount: Prisma.Decimal,
  direction: 'CREDIT' | 'DEBIT',
  note: string,
  referenceId: string,
  actorId: string,
) {
  await tx.treasuryLedger.create({
    data: {
      masjidId,
      accountId,
      entryType: 'REVERSAL',
      direction,
      amount,
      note,
      referenceId,
      referenceType: 'PAYMENT',
      createdByUserId: actorId,
    },
  });
}

// ─── Reversal ─────────────────────────────────────────────────────────────────

export async function reversePayment(
  masjidId: string,
  memberId: string,
  paymentId: string,
  actorId: string,
  reason: string,
) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      masjidId: true,
      memberId: true,
      amount: true,
      paymentStatus: true,
      fundAccountId: true,
      receipt: { select: { id: true } },
    },
  });

  // Treat wrong masjid or wrong member as 404 to avoid leaking IDs.
  if (!payment || payment.masjidId !== masjidId || payment.memberId !== memberId) {
    throw new ApiError(404, 'Payment not found.');
  }

  // Rule 1: already reversed → 409, never reversible again.
  if (payment.paymentStatus === PaymentStatus.REVERSED) {
    throw new ApiError(409, 'This payment has already been reversed.');
  }

  if (payment.paymentStatus !== PaymentStatus.SUCCESS) {
    throw new ApiError(
      400,
      `Only successful payments can be reversed. Current status: ${payment.paymentStatus}.`,
    );
  }

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.payment.update({
      where: { id: paymentId },
      data: { paymentStatus: PaymentStatus.REVERSED },
    });

    const reversal = await tx.paymentReversal.create({
      data: { paymentId, masjidId, reversedBy: actorId, reason },
      select: { id: true, reason: true, reversedAt: true },
    });

    // Void the receipt — row is preserved for audit, voidedAt marks it inactive.
    if (payment.receipt) {
      await tx.receipt.update({
        where: { id: payment.receipt.id },
        data: { voidedAt: new Date() },
      });
    }

    // Treasury reversal: undo the original CREDIT that was applied when the payment succeeded.
    if (payment.fundAccountId) {
      await tx.fundAccount.update({
        where: { id: payment.fundAccountId },
        data: { currentBalance: { decrement: payment.amount } },
      });
      await writeFundReversalLedger(
        tx, masjidId, payment.fundAccountId, payment.amount,
        'DEBIT', `Payment reversed — ${reason}`, paymentId, actorId,
      );
    }

    await logAudit(
      {
        masjidId,
        actorId,
        action: 'PAYMENT_REVERSED',
        entityType: 'Payment',
        entityId: paymentId,
        oldValue: { status: 'SUCCESS', amount: payment.amount.toFixed(2), fundAccountId: payment.fundAccountId ?? null },
        newValue: { status: 'REVERSED', reason, reversedAt: reversal.reversedAt.toISOString() },
      },
      tx,
    );

    return { reversalId: reversal.id, paymentId, reason, reversedAt: reversal.reversedAt };
  }).then(result => {
    void upsertMemberSummary(masjidId, memberId);
    return result;
  });
}

// ─── Transfer ─────────────────────────────────────────────────────────────────

export async function transferPayment(
  masjidId: string,
  fromMemberId: string,
  paymentId: string,
  toMemberId: string,
  actorId: string,
  reason: string,
) {
  if (fromMemberId === toMemberId) {
    throw new ApiError(400, 'Cannot transfer a payment to the same member.');
  }

  // Rule 2: validate BOTH members belong to this masjid explicitly.
  const [fromMember, toMember] = await Promise.all([
    prisma.member.findUnique({
      where: { id: fromMemberId, masjidId },
      select: { id: true, memberCode: true, name: true },
    }),
    prisma.member.findUnique({
      where: { id: toMemberId, masjidId },
      select: { id: true, memberCode: true, name: true },
    }),
  ]);

  if (!fromMember) throw new ApiError(404, 'Source member not found in this masjid.');
  if (!toMember) throw new ApiError(404, 'Destination member not found in this masjid.');

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      masjidId: true,
      memberId: true,
      amount: true,
      paymentMode: true,
      paymentStatus: true,
      paymentDate: true,
      fundAccountId: true,
      receipt: { select: { id: true } },
    },
  });

  if (!payment || payment.masjidId !== masjidId || payment.memberId !== fromMemberId) {
    throw new ApiError(404, 'Payment not found.');
  }

  // Rule 1: already reversed → 409.
  if (payment.paymentStatus === PaymentStatus.REVERSED) {
    throw new ApiError(409, 'This payment has already been reversed and cannot be transferred.');
  }

  if (payment.paymentStatus !== PaymentStatus.SUCCESS) {
    throw new ApiError(
      400,
      `Only successful payments can be transferred. Current status: ${payment.paymentStatus}.`,
    );
  }

  // FIFO allocation for the destination member — computed outside the transaction.
  const destLedger = await getLedger(masjidId, toMemberId);

  let remaining = payment.amount;
  const allocations: Array<{ contributionMonth: Date | null; amountAllocated: Prisma.Decimal }> = [];

  // Priority 1: clear old due for destination member.
  const effectiveOldDue = new Prisma.Decimal(destLedger.effectiveOpeningDue);
  if (effectiveOldDue.greaterThan(0)) {
    const toOld = remaining.lessThanOrEqualTo(effectiveOldDue) ? remaining : effectiveOldDue;
    allocations.push({ contributionMonth: null, amountAllocated: toOld });
    remaining = remaining.sub(toOld);
  }

  // Priority 2: oldest monthly dues.
  for (const row of destLedger.rows) {
    if (remaining.lessThanOrEqualTo(0)) break;
    const outstanding = new Prisma.Decimal(row.outstanding);
    if (outstanding.lessThanOrEqualTo(0)) continue;
    const allocated = remaining.lessThanOrEqualTo(outstanding) ? remaining : outstanding;
    allocations.push({
      contributionMonth: new Date(`${row.month}-01T00:00:00.000Z`),
      amountAllocated: allocated,
    });
    remaining = remaining.sub(allocated);
  }

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // 1. Mark original payment REVERSED (MVP: REVERSED covers both reversal and transfer-origin).
    await tx.payment.update({
      where: { id: paymentId },
      data: { paymentStatus: PaymentStatus.REVERSED },
    });

    // 2. Immutable reversal record linking the original payment to this reason.
    await tx.paymentReversal.create({
      data: { paymentId, masjidId, reversedBy: actorId, reason },
    });

    // 3. Void original receipt — row stays, voidedAt marks it inactive.
    if (payment.receipt) {
      await tx.receipt.update({
        where: { id: payment.receipt.id },
        data: { voidedAt: new Date() },
      });
    }

    // 4. Atomic receipt number for the destination payment.
    await tx.$executeRaw`
      INSERT INTO "ReceiptSequence" ("masjidId", "lastNumber")
      VALUES (${masjidId}, 1)
      ON CONFLICT ("masjidId") DO UPDATE
      SET "lastNumber" = "ReceiptSequence"."lastNumber" + 1
    `;
    const seq = await tx.receiptSequence.findUniqueOrThrow({
      where: { masjidId },
      select: { lastNumber: true },
    });
    const receiptNumber = `RCP-${String(seq.lastNumber).padStart(5, '0')}`;

    // 5. Fresh payment row for the destination member (Rule 4), inheriting fundAccountId.
    const newPayment = await tx.payment.create({
      data: {
        masjidId,
        memberId: toMemberId,
        amount: payment.amount,
        paymentMode: payment.paymentMode,
        paymentStatus: PaymentStatus.SUCCESS,
        paymentDate: payment.paymentDate,
        recordedByUserId: actorId,
        ...(payment.fundAccountId !== null && payment.fundAccountId !== undefined && { fundAccountId: payment.fundAccountId }),
        note: `Transferred from ${fromMember.name} (${fromMember.memberCode}): ${reason}`,
        allocations: {
          create: allocations.map((a) => ({
            contributionMonth: a.contributionMonth,
            amountAllocated: a.amountAllocated,
          })),
        },
      },
      select: {
        id: true,
        amount: true,
        paymentMode: true,
        paymentStatus: true,
        paymentDate: true,
        note: true,
        createdAt: true,
        allocations: { select: { contributionMonth: true, amountAllocated: true } },
      },
    });

    const newReceipt = await tx.receipt.create({
      data: { masjidId, paymentId: newPayment.id, receiptNumber },
      select: { id: true, receiptNumber: true, generatedAt: true },
    });

    // Net-zero ledger: DEBIT the old payment attribution, CREDIT the new one (same account).
    if (payment.fundAccountId) {
      await writeFundReversalLedger(
        tx, masjidId, payment.fundAccountId, payment.amount,
        'DEBIT', `Transfer out — from ${fromMember.name} to ${toMember.name}: ${reason}`, paymentId, actorId,
      );
      await writeFundReversalLedger(
        tx, masjidId, payment.fundAccountId, payment.amount,
        'CREDIT', `Transfer in — from ${fromMember.name} to ${toMember.name}: ${reason}`, newPayment.id, actorId,
      );
    }

    await logAudit(
      {
        masjidId,
        actorId,
        action: 'PAYMENT_TRANSFERRED',
        entityType: 'Payment',
        entityId: paymentId,
        oldValue: { memberId: fromMemberId, memberCode: fromMember.memberCode },
        newValue: {
          toMemberId,
          toMemberCode: toMember.memberCode,
          newPaymentId: newPayment.id,
          receiptNumber,
          reason,
          allocatedMonths: allocations.length,
          unallocated: remaining.toFixed(2),
        },
      },
      tx,
    );

    return {
      reversedPaymentId: paymentId,
      newPayment,
      newReceipt,
      unallocatedAmount: remaining.toFixed(2),
    };
  }).then(result => {
    void upsertMemberSummary(masjidId, fromMemberId);
    void upsertMemberSummary(masjidId, toMemberId);
    return result;
  });
}
