import { apiClient } from './client';

export type ExpenseType     = 'MOSQUE_PAID' | 'PERSONAL_PAID';
export type ExpenseStatus   = 'SETTLED' | 'PENDING_REIMB' | 'REIMBURSED';
export type ExpenseCategory = 'UTILITIES' | 'MAINTENANCE' | 'SUPPLIES' | 'SALARIES' | 'EVENTS' | 'DONATIONS' | 'OTHER';

export interface Expense {
  id: string;
  expenseType: ExpenseType;
  status: ExpenseStatus;
  category: ExpenseCategory;
  amount: string;
  description: string | null;
  createdAt: string;
  reimbursedAt: string | null;
  fundAccount:    { id: string; name: string; type: string } | null;
  reimbursedFrom: { id: string; name: string } | null;
  paidBy:         { id: string; name: string } | null;
  recordedBy:     { name: string };
}

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  UTILITIES:   'Utilities',
  MAINTENANCE: 'Maintenance',
  SUPPLIES:    'Supplies',
  SALARIES:    'Salaries',
  EVENTS:      'Events',
  DONATIONS:   'Donations',
  OTHER:       'Other',
};

export async function listExpenses(params?: { status?: ExpenseStatus; category?: ExpenseCategory }): Promise<Expense[]> {
  const { data } = await apiClient.get('/committee/finance/expenses', { params });
  return data.data as Expense[];
}

export async function createExpense(body: {
  expenseType: ExpenseType;
  category: ExpenseCategory;
  amount: number;
  description?: string;
  fundAccountId?: string;
  paidByUserId?: string;
}): Promise<Expense> {
  const { data } = await apiClient.post('/committee/finance/expenses', body);
  return data.data as Expense;
}

export async function reimburseExpense(expenseId: string, body: { fundAccountId: string; note?: string }): Promise<Expense> {
  const { data } = await apiClient.post(`/committee/finance/expenses/${expenseId}/reimburse`, body);
  return data.data as Expense;
}
