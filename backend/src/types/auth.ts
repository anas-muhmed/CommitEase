import type { UserRole } from '@prisma/client';

export type AuthenticatedUser = {
  id: string;
  masjidId: string | null;
  role: UserRole;
};

export type AuthenticatedMember = {
  id: string;
  masjidId: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      member?: AuthenticatedMember;
    }
  }
}
