import { apiClient } from './client';

export interface MemberSummary {
  id: string;
  memberCode: string;
  name: string;
  phone: string;
  address: string | null;
  contributionPlanId: string;
  contributionPlan: { id: string; name: string };
  contributionStartDate: string;
  openingDueBalance: string;
  active: boolean;
  createdAt: string;
}

export interface MemberListResponse {
  members: MemberSummary[];
  total: number;
  page: number;
  limit: number;
}

export interface LedgerRow {
  month: string;
  planName: string;
  monthlyDue: string;
  paid: string;
  outstanding: string;
}

export interface LedgerData {
  memberId: string;
  memberCode: string;
  name: string;
  openingDueBalance: string;
  rows: LedgerRow[];
  totalDue: string;
  totalPaid: string;
  totalOutstanding: string;
}

export interface PaymentRecord {
  id: string;
  amount: string;
  paymentMode: string;
  paymentStatus: string;
  paymentDate: string | null;
  note: string | null;
  createdAt: string;
  allocations: { contributionMonth: string; amountAllocated: string }[];
  receipt: { receiptNumber: string; generatedAt: string; voidedAt: string | null } | null;
  reversal: { reason: string; reversedAt: string; actor: { name: string } } | null;
}

export interface RecordPaymentInput {
  amount: number;
  paymentDate: string;
  note?: string;
}

export interface RecordPaymentResult {
  payment: PaymentRecord;
  receipt: { id: string; receiptNumber: string; generatedAt: string };
  unallocatedAmount: string;
}

export interface CreateMemberInput {
  name: string;
  phone: string;
  contributionStartDate: string;
  contributionPlanId?: string;
  memberCode?: string;
  address?: string;
  openingDueBalance?: number;
}

export async function listMembers(params: {
  page?: number;
  limit?: number;
  search?: string;
  active?: boolean;
}): Promise<MemberListResponse> {
  const { data } = await apiClient.get('/committee/members', { params });
  return data.data as MemberListResponse;
}

export async function getMember(memberId: string): Promise<MemberSummary> {
  const { data } = await apiClient.get(`/committee/members/${memberId}`);
  return data.data as MemberSummary;
}

export async function createMember(input: CreateMemberInput): Promise<MemberSummary> {
  const { data } = await apiClient.post('/committee/members', input);
  return data.data as MemberSummary;
}

export async function getLedger(memberId: string): Promise<LedgerData> {
  const { data } = await apiClient.get(`/committee/members/${memberId}/ledger`);
  return data.data as LedgerData;
}

export async function getPaymentHistory(memberId: string): Promise<PaymentRecord[]> {
  const { data } = await apiClient.get(`/committee/members/${memberId}/payments`);
  return data.data as PaymentRecord[];
}

export async function recordPayment(
  memberId: string,
  input: RecordPaymentInput,
): Promise<RecordPaymentResult> {
  const { data } = await apiClient.post(`/committee/members/${memberId}/payments`, input);
  return data.data as RecordPaymentResult;
}
