import { apiClient } from './client';

export interface DashboardData {
  members: { active: number; inactive: number };
  collection: {
    thisMonth: { totalAmount: string; paymentCount: number };
    thisYear: { totalAmount: string; paymentCount: number };
  };
  totalOutstandingAllMembers: string;
  recentPayments: {
    id: string;
    amount: string;
    paymentDate: string | null;
    createdAt: string;
    member: { name: string; memberCode: string };
    receipt: { receiptNumber: string } | null;
  }[];
  recentReversals: {
    id: string;
    reason: string;
    reversedAt: string;
    payment: { amount: string; member: { name: string; memberCode: string } };
    actor: { name: string };
  }[];
}

export interface OverdueMember {
  memberId: string;
  memberCode: string;
  name: string;
  phone: string;
  totalOutstanding: string;
  overdueMonths: number;
  severity: 'mild' | 'serious' | 'critical';
}

export interface OverdueReport {
  members: OverdueMember[];
  summary: {
    total: number;
    mild: number;
    serious: number;
    critical: number;
    totalOutstanding: string;
  };
}

export interface CollectionMonth {
  month: string;
  totalCollected: string;
  paymentCount: number;
  reversedAmount: string;
  reversalCount: number;
}

export async function getDashboard(): Promise<DashboardData> {
  const { data } = await apiClient.get('/committee/dashboard');
  return data.data as DashboardData;
}

export async function getOverdueReport(): Promise<OverdueReport> {
  const { data } = await apiClient.get('/committee/reports/overdue');
  return data.data as OverdueReport;
}

export async function getCollectionReport(year: number): Promise<CollectionMonth[]> {
  const { data } = await apiClient.get('/committee/reports/collection', { params: { year } });
  return data.data as CollectionMonth[];
}
