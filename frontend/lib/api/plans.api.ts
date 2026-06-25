import { apiClient } from './client';

export interface Plan {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  createdAt: string;
  _count: { members: number };
  feeHistory: { monthlyFee: string; effectiveFrom: string }[];
}

export async function listPlans(): Promise<Plan[]> {
  const { data } = await apiClient.get('/committee/plans');
  return data.data as Plan[];
}

export async function createPlan(input: { name: string; description?: string }): Promise<Plan> {
  const { data } = await apiClient.post('/committee/plans', input);
  return data.data as Plan;
}

export async function setFee(
  planId: string,
  input: { monthlyFee: number; effectiveFrom: string },
): Promise<void> {
  await apiClient.post(`/committee/plans/${planId}/fee`, input);
}
