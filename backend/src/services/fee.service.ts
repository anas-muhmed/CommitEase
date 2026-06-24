import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';
import { logAudit } from './audit.service';

export async function setFee(
  planId: string,
  masjidId: string,
  actorId: string,
  input: { monthlyFee: number; effectiveFrom: string },
) {
  if (!Number.isFinite(input.monthlyFee) || input.monthlyFee <= 0) {
    throw new ApiError(400, 'monthlyFee must be a positive number.');
  }

  const effectiveFrom = new Date(input.effectiveFrom);
  if (isNaN(effectiveFrom.getTime())) {
    throw new ApiError(400, 'effectiveFrom must be a valid ISO date string (e.g. 2024-01-01).');
  }

  // Verify the plan belongs to this masjid before writing.
  const plan = await prisma.contributionPlan.findUnique({
    where: { id: planId },
    select: { masjidId: true },
  });
  if (!plan || plan.masjidId !== masjidId) throw new ApiError(404, 'Contribution plan not found.');

  const entry = await prisma.contributionFeeHistory.create({
    data: { contributionPlanId: planId, monthlyFee: input.monthlyFee, effectiveFrom },
    select: { id: true, contributionPlanId: true, monthlyFee: true, effectiveFrom: true, createdAt: true },
  });

  await logAudit({
    masjidId,
    actorId,
    action: 'FEE_SET',
    entityType: 'ContributionFeeHistory',
    entityId: entry.id,
    newValue: { planId, monthlyFee: String(input.monthlyFee), effectiveFrom: effectiveFrom.toISOString() },
  });

  return entry;
}

export async function getFeeHistory(planId: string, masjidId: string) {
  const plan = await prisma.contributionPlan.findUnique({
    where: { id: planId },
    select: { masjidId: true },
  });
  if (!plan || plan.masjidId !== masjidId) throw new ApiError(404, 'Contribution plan not found.');

  return prisma.contributionFeeHistory.findMany({
    where: { contributionPlanId: planId },
    select: { id: true, monthlyFee: true, effectiveFrom: true, createdAt: true },
    orderBy: { effectiveFrom: 'desc' },
  });
}
