'use client';

import { create } from 'zustand';

export interface AuthUser {
  id: string;
  name: string;
  role: 'SUPER_ADMIN' | 'COMMITTEE_ADMIN';
  masjidId: string | null;
  mustChangePassword: boolean;
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
