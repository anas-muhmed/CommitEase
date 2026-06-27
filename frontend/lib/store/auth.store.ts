'use client';

import { create } from 'zustand';

export type CommitteeRole = 'VIEWER' | 'PAYMENT_OPERATOR' | 'TREASURER' | 'ADMIN';

export interface AuthUser {
  id: string;
  name: string;
  role: 'SUPER_ADMIN' | 'COMMITTEE_ADMIN';
  masjidId: string | null;
  mustChangePassword: boolean;
  committeeRole?: CommitteeRole;
}

export function hasMinRole(userRole: CommitteeRole | undefined, minimum: CommitteeRole): boolean {
  const rank: Record<CommitteeRole, number> = { VIEWER: 0, PAYMENT_OPERATOR: 1, TREASURER: 2, ADMIN: 3 };
  return rank[userRole ?? 'VIEWER'] >= rank[minimum];
}

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  isLoading: boolean;
  setAuth: (token: string, user: AuthUser) => void;
  setLoading: (loading: boolean) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  accessToken: null,
  user: null,
  isLoading: true,
  setAuth: (accessToken, user) => set({ accessToken, user, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
  clear: () => set({ accessToken: null, user: null, isLoading: false }),
}));
