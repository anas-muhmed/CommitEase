import { useQuery } from '@tanstack/react-query';
import { getDashboard, getOverdueReport } from '@/lib/api/dashboard.api';

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
