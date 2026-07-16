import { apiClient } from './client';

export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REVERSED';
export type PaymentMode   = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'ONLINE';

export interface PaymentFeedItem {
  id:            string;
  amount:        string;
  paymentMode:   PaymentMode;
  paymentStatus: PaymentStatus;
  paymentDate:   string | null;
  note:          string | null;
  createdAt:     string;
  member:        { id: string; name: string; memberCode: string; phone: string };
  fundAccount:   { id: string; name: string; type: string } | null;
  receipt:       { receiptNumber: string; voidedAt: string | null } | null;
  reversal:      { reason: string; reversedAt: string } | null;
  recordedByUser: { name: string } | null;
  allocations:   { contributionMonth: string; amountAllocated: string }[];
}

export interface PaymentFeedResponse {
  payments: PaymentFeedItem[];
  total:    number;
  page:     number;
  limit:    number;
}

export interface PaymentKpi {
  todayCollected:     string;
  todayCount:         number;
  pendingCount:       number;
  reversedTodayCount: number;
}

export async function getPaymentFeed(opts?: {
  status?:   string;
  mode?:     string;
  dateFrom?: string;
  dateTo?:   string;
  page?:     number;
  limit?:    number;
}): Promise<PaymentFeedResponse> {
  const { data } = await apiClient.get('/committee/payments', { params: opts });
  return data.data as PaymentFeedResponse;
}

export async function getPaymentKpi(): Promise<PaymentKpi> {
  const { data } = await apiClient.get('/committee/payments/kpi');
  return data.data as PaymentKpi;
}

export async function reversePayment(
  memberId: string,
  paymentId: string,
  reason: string,
): Promise<{ reversalId: string; paymentId: string; reason: string; reversedAt: string }> {
  const { data } = await apiClient.post(
    `/committee/members/${memberId}/payments/${paymentId}/reverse`,
    { reason },
  );
  return data.data;
}

export async function transferPayment(
  memberId: string,
  paymentId: string,
  toMemberId: string,
  reason: string,
): Promise<{ newReceipt: { receiptNumber: string }; newPaymentId: string }> {
  const { data } = await apiClient.post(
    `/committee/members/${memberId}/payments/${paymentId}/transfer`,
    { toMemberId, reason },
  );
  return data.data;
}
