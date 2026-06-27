import { useQuery } from '@tanstack/react-query';
import { getDashboard, getOverdueReport, getCollectionReport } from '@/lib/api/dashboard.api';

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
  });
}

export function useOverdueReport() {
  return useQuery({
    queryKey: ['reports', 'overdue'],
    queryFn: getOverdueReport,
  });
}

export function useCollectionReport(year: number) {
  return useQuery({
    queryKey: ['reports', 'collection', year],
    queryFn: () => getCollectionReport(year),
  });
}
