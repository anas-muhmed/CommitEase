'use client';

import { create } from 'zustand';

export interface MemberUser {
  id: string;
  name: string;
  memberCode: string;
  masjidId: string;
  masjidName: string;
  phone: string;
  planName: string;
  chelavExempt: boolean;
}

interface MemberAuthState {
  accessToken: string | null;
  member: MemberUser | null;
  isLoading: boolean;
  setAuth: (token: string, member: MemberUser) => void;
  updateToken: (token: string) => void;
  setLoading: (v: boolean) => void;
  clear: () => void;
}

export const useMemberAuthStore = create<MemberAuthState>()((set) => ({
  accessToken: null,
  member: null,
  isLoading: true,
  setAuth: (accessToken, member) => set({ accessToken, member, isLoading: false }),
  updateToken: (accessToken) => set({ accessToken }),
  setLoading: (isLoading) => set({ isLoading }),
  clear: () => set({ accessToken: null, member: null, isLoading: false }),
}));
