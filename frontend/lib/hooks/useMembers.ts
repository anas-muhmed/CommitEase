import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listMembers,
  listMembersEnriched,
  getMember,
  createMember,
  getLedger,
  getPaymentHistory,
  recordPayment,
  reactivateMember,
  type RecordPaymentInput,
  type CreateMemberInput,
} from '@/lib/api/members.api';

export function useMemberList(params: {
  page?: number;
  limit?: number;
  search?: string;
  active?: boolean;
}) {
  return useQuery({
    queryKey: ['members', params],
    queryFn: () => listMembers(params),
  });
}

export function useEnrichedMembers() {
  return useQuery({
    queryKey: ['members', 'enriched'],
    queryFn: listMembersEnriched,
    staleTime: 30_000,
  });
}

export function useMember(memberId: string) {
  return useQuery({
    queryKey: ['members', memberId],
    queryFn: () => getMember(memberId),
    enabled: !!memberId,
  });
}

export function useLedger(memberId: string) {
  return useQuery({
    queryKey: ['ledger', memberId],
    queryFn: () => getLedger(memberId),
    enabled: !!memberId,
  });
}

export function usePaymentHistory(memberId: string) {
  return useQuery({
    queryKey: ['payments', memberId],
    queryFn: () => getPaymentHistory(memberId),
    enabled: !!memberId,
  });
}

export function useRecordPayment(memberId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RecordPaymentInput) => recordPayment(memberId, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ledger', memberId] });
      void qc.invalidateQueries({ queryKey: ['payments', memberId] });
      void qc.invalidateQueries({ queryKey: ['members', 'enriched'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      void qc.invalidateQueries({ queryKey: ['reports'] });
      void qc.invalidateQueries({ queryKey: ['treasury'] });
    },
  });
}

export function useCreateMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMemberInput) => createMember(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['members'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useReactivateMember(memberId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => reactivateMember(memberId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['members'] });
      void qc.invalidateQueries({ queryKey: ['members', memberId] });
    },
  });
}

export function useUpdateMember(memberId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<{ name: string; phone: string; address: string; contributionStartDate: string; openingDueBalance: number }>) => {
      const { data } = await (await import('@/lib/api/client')).apiClient.patch(`/committee/members/${memberId}`, input);
      return data.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['members'] });
      void qc.invalidateQueries({ queryKey: ['members', memberId] });
    },
  });
}

export function useDeactivateMember(memberId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await (await import('@/lib/api/client')).apiClient.delete(`/committee/members/${memberId}`);
      return data.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['members'] });
    },
  });
}

export function useSwitchPlan(memberId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { planId: string; effectiveFrom: string }) => {
      const { data } = await (await import('@/lib/api/client')).apiClient.patch(`/committee/members/${memberId}/plan`, body);
      return data.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['members'] });
      void qc.invalidateQueries({ queryKey: ['ledger', memberId] });
    },
  });
}
