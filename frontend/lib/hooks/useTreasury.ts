import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as TreasuryApi from '@/lib/api/treasury.api';
import type { LedgerEntryType } from '@/lib/api/treasury.api';

export function useTreasury() {
  return useQuery({
    queryKey: ['treasury'],
    queryFn: TreasuryApi.getTreasury,
  });
}

export function useAccounts() {
  return useQuery({
    queryKey: ['treasury', 'accounts'],
    queryFn: TreasuryApi.listAccounts,
  });
}

export function useReserves() {
  return useQuery({
    queryKey: ['treasury', 'reserves'],
    queryFn: TreasuryApi.listReserves,
  });
}

export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: TreasuryApi.createAccount,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['treasury'] });
    },
  });
}

export function useUpdateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: { name?: string; active?: boolean } }) =>
      TreasuryApi.updateAccount(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['treasury'] });
    },
  });
}

export function useSetOpeningBalance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, amount, note }: { id: string; amount: number; note?: string }) =>
      TreasuryApi.setOpeningBalance(id, amount, note),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['treasury'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useTransferFunds() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ fromId, toId, amount, note }: { fromId: string; toId: string; amount: number; note?: string }) =>
      TreasuryApi.transferFunds(fromId, { toId, amount, ...(note ? { note } : {}) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['treasury'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => TreasuryApi.deleteAccount(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['treasury'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useCreateReserve() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: TreasuryApi.createReserve,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['treasury'] });
    },
  });
}

export function useUpdateReserve() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: {
        title?: string;
        purpose?: string;
        amount?: number;
        active?: boolean;
        restricted?: boolean;
        approvalRequired?: boolean;
      };
    }) => TreasuryApi.updateReserve(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['treasury'] });
    },
  });
}

export function useTreasuryLedger(options?: { entryType?: LedgerEntryType }) {
  return useQuery({
    queryKey: ['treasury', 'ledger', options],
    queryFn: () => TreasuryApi.getTreasuryLedger(options),
  });
}

export function useVerifyIntegrity() {
  return useMutation({ mutationFn: TreasuryApi.verifyLedgerIntegrity });
}
