import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as PaymentsApi from '@/lib/api/payments.api';

export function usePaymentFeed(opts?: Parameters<typeof PaymentsApi.getPaymentFeed>[0]) {
  return useQuery({
    queryKey: ['payment-feed', opts],
    queryFn:  () => PaymentsApi.getPaymentFeed(opts),
    staleTime: 15_000,
  });
}

export function usePaymentKpi() {
  return useQuery({
    queryKey:       ['payment-kpi'],
    queryFn:        PaymentsApi.getPaymentKpi,
    staleTime:      30_000,
    refetchInterval: 60_000,
  });
}

export function useReversePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      memberId, paymentId, reason,
    }: { memberId: string; paymentId: string; reason: string }) =>
      PaymentsApi.reversePayment(memberId, paymentId, reason),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['payment-feed'] });
      void qc.invalidateQueries({ queryKey: ['payment-kpi'] });
      void qc.invalidateQueries({ queryKey: ['payments'] });
      void qc.invalidateQueries({ queryKey: ['ledger'] });
      void qc.invalidateQueries({ queryKey: ['members', 'enriched'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useTransferPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      memberId, paymentId, toMemberId, reason,
    }: { memberId: string; paymentId: string; toMemberId: string; reason: string }) =>
      PaymentsApi.transferPayment(memberId, paymentId, toMemberId, reason),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['payment-feed'] });
      void qc.invalidateQueries({ queryKey: ['payment-kpi'] });
      void qc.invalidateQueries({ queryKey: ['payments'] });
      void qc.invalidateQueries({ queryKey: ['ledger'] });
      void qc.invalidateQueries({ queryKey: ['members', 'enriched'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
