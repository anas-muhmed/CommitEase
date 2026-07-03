import { memberApiClient } from './member-client';

// ─── Home ─────────────────────────────────────────────────────────────────────

export interface ActivityEntry {
  id: string;
  type: 'PAYMENT' | 'REVERSED';
  amount: string;
  paymentMode: string;
  date: string;
  description: string;
  receiptNumber: string | null;
}

export interface ChelavPreview {
  today: { displayLabel: string; status: string; isMe: boolean } | null;
  nextTurn: { date: string; displayLabel: string } | null;
}

export interface MemberHomeData {
  member: {
    name: string;
    memberCode: string;
    phone: string;
    masjidName: string;
    planName: string;
    chelavExempt: boolean;
  };
  financial: {
    totalOutstanding: string;
    overdueMonths: number;
    lastPaymentAt: string | null;
    isAllClear: boolean;
  };
  recentActivity: ActivityEntry[];
  chelav: ChelavPreview | null;
}

export async function getMemberHome(): Promise<MemberHomeData> {
  const { data } = await memberApiClient.get('/member/home');
  return data.data as MemberHomeData;
}

// ─── History ──────────────────────────────────────────────────────────────────

export interface MonthRecord {
  month: string;
  planName: string;
  monthlyDue: string;
  paid: string;
  outstanding: string;
  status: 'Paid' | 'Partial' | 'Pending' | 'Overdue';
}

export interface ReceiptRecord {
  id: string;
  amount: string;
  paymentMode: string;
  paymentStatus: string;
  date: string;
  note: string | null;
  receiptNumber: string | null;
  generatedAt: string | null;
  isReversed: boolean;
  reversalReason: string | null;
  clearedMonths: string[];
}

export interface MemberHistoryData {
  summary: {
    totalOutstanding: string;
    totalPaid: string;
    overdueMonths: number;
    healthGrade: string;
  };
  monthlyRecord: MonthRecord[];
  receipts: ReceiptRecord[];
}

export async function getMemberHistory(): Promise<MemberHistoryData> {
  const { data } = await memberApiClient.get('/member/history');
  return data.data as MemberHistoryData;
}

// ─── Chelav ───────────────────────────────────────────────────────────────────

export interface ChelavEntry {
  id: string;
  date: string;
  displayLabel: string;
  status: string;
  isMe: boolean;
  notes: string | null;
}

export interface MemberChelavData {
  year: number;
  month: number;
  entries: ChelavEntry[];
}

// ─── Receipt Detail ───────────────────────────────────────────────────────────

export interface ReceiptDetailData {
  id: string;
  receiptNumber: string | null;
  amount: string;
  paymentMode: string;
  date: string;
  status: string;
  note: string | null;
  isReversed: boolean;
  reversalReason: string | null;
  allocations: Array<{ month: string; amount: string }>;
}

export async function getReceiptDetail(receiptId: string): Promise<ReceiptDetailData> {
  const { data } = await memberApiClient.get(`/member/receipts/${receiptId}`);
  return data.data as ReceiptDetailData;
}

// ─── Chelav ───────────────────────────────────────────────────────────────────

export async function getMemberChelav(year?: number, month?: number): Promise<MemberChelavData> {
  const params = year && month ? `?year=${year}&month=${month}` : '';
  const { data } = await memberApiClient.get(`/member/chelav${params}`);
  return data.data as MemberChelavData;
}
