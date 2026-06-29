import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ChelavApi from '@/lib/api/chelav.api';
import type { ChelavStatus, ImportRow } from '@/lib/api/chelav.api';

const KEYS = {
  today:  ['chelav', 'today'] as const,
  month:  (y: number, m: number) => ['chelav', 'month', y, m] as const,
};

export function useTodayChelav() {
  return useQuery({
    queryKey: KEYS.today,
    queryFn:  ChelavApi.getTodayChelav,
    staleTime: 30_000,  // re-fetch every 30s so status changes propagate
  });
}

export function useMonthSchedule(year: number, month: number) {
  return useQuery({
    queryKey: KEYS.month(year, month),
    queryFn:  () => ChelavApi.getMonthSchedule(year, month),
    staleTime: 60_000,
  });
}

export function useUpdateChelavStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: ChelavStatus; notes?: string }) =>
      ChelavApi.updateChelavStatus(id, status, notes),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['chelav'] });
    },
  });
}

export function useSwapChelav() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id1, id2 }: { id1: string; id2: string }) =>
      ChelavApi.swapChelavEntries(id1, id2),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['chelav'] });
    },
  });
}

export function useImportChelav() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entries: ImportRow[]) => ChelavApi.importChelavSchedule(entries),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['chelav'] });
    },
  });
}
