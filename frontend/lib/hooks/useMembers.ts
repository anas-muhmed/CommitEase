import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listMembers,
  getMember,
  createMember,
  getLedger,
  getPaymentHistory,
  recordPayment,
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
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      void qc.invalidateQueries({ queryKey: ['reports'] });
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
