import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import * as ExpenseApi from '@/lib/api/expense.api';
import type { ExpenseStatus, ExpenseCategory } from '@/lib/api/expense.api';

export interface TeamMember { id: string; name: string; committeeRole: string; }

export function useTeam() {
  return useQuery({
    queryKey: ['team'],
    queryFn:  async () => {
      const { data } = await apiClient.get('/committee/team');
      return data.data as TeamMember[];
    },
  });
}

export function useExpenses(params?: { status?: ExpenseStatus; category?: ExpenseCategory }) {
  return useQuery({
    queryKey: ['expenses', params],
    queryFn:  () => ExpenseApi.listExpenses(params),
  });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ExpenseApi.createExpense,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['expenses'] });
      void qc.invalidateQueries({ queryKey: ['treasury'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useReimburseExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ expenseId, body }: { expenseId: string; body: { fundAccountId: string; note?: string } }) =>
      ExpenseApi.reimburseExpense(expenseId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['expenses'] });
      void qc.invalidateQueries({ queryKey: ['treasury'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
