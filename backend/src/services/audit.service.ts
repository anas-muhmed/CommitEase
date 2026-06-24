import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';

interface AuditParams {
  masjidId: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
}

export async function logAudit(
  params: AuditParams,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const client = tx ?? prisma;
  await client.auditLog.create({
    data: {
      masjidId: params.masjidId,
      actorId: params.actorId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      ...(params.oldValue !== undefined && { oldValue: params.oldValue as Prisma.InputJsonValue }),
      ...(params.newValue !== undefined && { newValue: params.newValue as Prisma.InputJsonValue }),
    },
  });
}
