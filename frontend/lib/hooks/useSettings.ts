import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as SettingsApi from '@/lib/api/settings.api';

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn:  SettingsApi.getSettings,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: SettingsApi.updateSettings,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}
