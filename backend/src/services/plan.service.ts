import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';
import { logAudit } from './audit.service';
import { upsertMemberSummary } from './member.service';

// ─── Plan CRUD ────────────────────────────────────────────────────────────────

export async function createPlan(
  masjidId: string,
  actorId: string,
  input: { name: string; description?: string; chelavExempt?: boolean },
) {
  const plan = await prisma.contributionPlan.create({
    data: {
      masjidId,
      name: input.name,
      ...(input.description !== undefined && { description: input.description }),
      ...(input.chelavExempt !== undefined && { chelavExempt: input.chelavExempt }),
    },
    select: { id: true, masjidId: true, name: true, description: true, chelavExempt: true, active: true, createdAt: true },
  });

  await logAudit({
    masjidId, actorId, action: 'PLAN_CREATED', entityType: 'ContributionPlan', entityId: plan.id,
    newValue: { name: plan.name },
  });

  return plan;
}

export async function listPlans(masjidId: string) {
  return prisma.contributionPlan.findMany({
    where: { masjidId },
    select: {
      id: true, name: true, description: true, chelavExempt: true, active: true, createdAt: true,
      _count: { select: { members: true } },
      feeHistory: {
        orderBy: { effectiveFrom: 'desc' },
        take: 1,
        select: { monthlyFee: true, effectiveFrom: true },
      },
    },
    orderBy: { name: 'asc' },
  });
}

export async function getPlanById(masjidId: string, planId: string) {
  const plan = await prisma.contributionPlan.findUnique({
    where: { id: planId, masjidId },
    select: {
      id: true, name: true, description: true, chelavExempt: true, active: true, createdAt: true, updatedAt: true,
      _count: { select: { members: true } },
      feeHistory: {
        orderBy: { effectiveFrom: 'desc' },
        select: { id: true, monthlyFee: true, effectiveFrom: true, createdAt: true },
      },
    },
  });
  if (!plan) throw new ApiError(404, 'Contribution plan not found.');
  return plan;
}

export async function updatePlan(
  masjidId: string,
  planId: string,
  actorId: string,
  input: { name?: string; description?: string; chelavExempt?: boolean; active?: boolean },
) {
  const existing = await prisma.contributionPlan.findUnique({
    where: { id: planId, masjidId },
    select: { id: true, name: true, description: true, chelavExempt: true, active: true },
  });
  if (!existing) throw new ApiError(404, 'Contribution plan not found.');

  const updated = await prisma.contributionPlan.update({
    where: { id: planId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.chelavExempt !== undefined && { chelavExempt: input.chelavExempt }),
      ...(input.active !== undefined && { active: input.active }),
    },
    select: { id: true, name: true, description: true, chelavExempt: true, active: true, updatedAt: true },
  });

  await logAudit({
    masjidId, actorId, action: 'PLAN_UPDATED', entityType: 'ContributionPlan', entityId: planId,
    oldValue: { name: existing.name, description: existing.description ?? null, active: existing.active },
    newValue: { name: updated.name, description: updated.description ?? null, active: updated.active },
  });

  return updated;
}

// ─── Member plan switch ───────────────────────────────────────────────────────

export async function switchMemberPlan(
  masjidId: string,
  memberId: string,
  newPlanId: string,
  effectiveFrom: Date,
  actorId: string,
) {
  // Validate both member and new plan belong to this masjid.
  const [member, newPlan] = await prisma.$transaction([
    prisma.member.findUnique({
      where: { id: memberId, masjidId },
      select: { id: true, contributionPlanId: true, contributionPlan: { select: { name: true } } },
    }),
    prisma.contributionPlan.findUnique({
      where: { id: newPlanId, masjidId },
      select: { id: true, name: true, active: true },
    }),
  ]);

  if (!member) throw new ApiError(404, 'Member not found.');
  if (!newPlan) throw new ApiError(404, 'Contribution plan not found.');
  if (!newPlan.active) throw new ApiError(400, 'Cannot switch to an inactive plan.');
  if (member.contributionPlanId === newPlanId) {
    throw new ApiError(409, 'Member is already on this plan.');
  }

  const oldPlanName = member.contributionPlan.name;

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Write immutable history record — this is what the due engine reads.
    const history = await tx.memberPlanHistory.create({
      data: { memberId, contributionPlanId: newPlanId, effectiveFrom },
      select: { id: true, contributionPlanId: true, effectiveFrom: true },
    });

    await tx.member.update({
      where: { id: memberId },
      data: { contributionPlanId: newPlanId },
    });

    await logAudit({
      masjidId, actorId, action: 'MEMBER_PLAN_SWITCHED', entityType: 'Member', entityId: memberId,
      oldValue: { planId: member.contributionPlanId, planName: oldPlanName },
      newValue: { planId: newPlanId, planName: newPlan.name, effectiveFrom: effectiveFrom.toISOString() },
    }, tx);

    return { historyId: history.id, newPlanId, newPlanName: newPlan.name, effectiveFrom };
  }).then(result => {
    void upsertMemberSummary(masjidId, memberId);
    return result;
  });
}
