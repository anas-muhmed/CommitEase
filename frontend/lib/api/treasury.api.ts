import { apiClient } from './client';
import type { TreasurySnapshot } from './dashboard.api';

export type FundAccountType = 'CASH' | 'BANK' | 'UPI';
export type LedgerEntryType = 'INCOME' | 'EXPENSE' | 'REIMBURSEMENT' | 'RESERVE_IN' | 'RESERVE_OUT' | 'ADJUSTMENT' | 'TRANSFER' | 'REVERSAL';
export type LedgerDirection  = 'CREDIT' | 'DEBIT';

export interface FundAccount {
  id: string;
  name: string;
  type: FundAccountType;
  currentBalance: string;
  active: boolean;
  deleteEligible: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FundReserve {
  id: string;
  title: string;
  purpose: string | null;
  amount: string;
  active: boolean;
  restricted: boolean;
  approvalRequired: boolean;
  createdAt: string;
}

export interface TreasuryLedgerEntry {
  id: string;
  accountId: string;
  entryType: LedgerEntryType;
  direction: LedgerDirection;
  amount: string;
  note: string | null;
  referenceId: string | null;
  referenceType: string | null;
  createdAt: string;
  account: { name: string; type: string };
  createdBy: { name: string };
}

/* ─── Treasury snapshot ──────────────────────────────────────────────────── */

export async function getTreasury(): Promise<TreasurySnapshot> {
  const { data } = await apiClient.get('/committee/finance/treasury');
  return data.data as TreasurySnapshot;
}

/* ─── Fund Accounts ──────────────────────────────────────────────────────── */

export async function listAccounts(): Promise<FundAccount[]> {
  const { data } = await apiClient.get('/committee/finance/accounts');
  return data.data as FundAccount[];
}

export async function createAccount(body: {
  name: string;
  type: FundAccountType;
}): Promise<FundAccount> {
  const { data } = await apiClient.post('/committee/finance/accounts', body);
  return data.data as FundAccount;
}

export async function updateAccount(
  accountId: string,
  body: { name?: string; active?: boolean },
): Promise<FundAccount> {
  const { data } = await apiClient.patch(`/committee/finance/accounts/${accountId}`, body);
  return data.data as FundAccount;
}

export async function setOpeningBalance(
  accountId: string,
  amount: number,
  note?: string,
): Promise<FundAccount> {
  const { data } = await apiClient.post(
    `/committee/finance/accounts/${accountId}/opening-balance`,
    { amount, ...(note ? { note } : {}) },
  );
  return data.data as FundAccount;
}

export async function transferFunds(
  accountId: string,
  body: { toId: string; amount: number; note?: string },
): Promise<{ fromId: string; toId: string; amount: string }> {
  const { data } = await apiClient.post(
    `/committee/finance/accounts/${accountId}/transfer`,
    body,
  );
  return data.data as { fromId: string; toId: string; amount: string };
}

export async function deleteAccount(accountId: string): Promise<void> {
  await apiClient.delete(`/committee/finance/accounts/${accountId}`);
}

/* ─── Fund Reserves ──────────────────────────────────────────────────────── */

export async function listReserves(): Promise<FundReserve[]> {
  const { data } = await apiClient.get('/committee/finance/reserves');
  return data.data as FundReserve[];
}

export async function createReserve(body: {
  title: string;
  purpose?: string;
  amount: number;
  restricted?: boolean;
  approvalRequired?: boolean;
}): Promise<FundReserve> {
  const { data } = await apiClient.post('/committee/finance/reserves', body);
  return data.data as FundReserve;
}

export async function updateReserve(
  reserveId: string,
  body: {
    title?: string;
    purpose?: string;
    amount?: number;
    active?: boolean;
    restricted?: boolean;
    approvalRequired?: boolean;
  },
): Promise<FundReserve> {
  const { data } = await apiClient.patch(`/committee/finance/reserves/${reserveId}`, body);
  return data.data as FundReserve;
}

/* ─── Treasury Ledger ────────────────────────────────────────────────────── */

export async function getTreasuryLedger(options?: {
  accountId?: string;
  entryType?: LedgerEntryType;
}): Promise<TreasuryLedgerEntry[]> {
  const { data } = await apiClient.get('/committee/finance/ledger', { params: options });
  return data.data as TreasuryLedgerEntry[];
}

/* ─── Ledger Integrity ───────────────────────────────────────────────────── */

export interface AccountIntegrityCheck {
  accountId: string;
  name: string;
  currentBalance: string;
  ledgerBalance: string;
  drift: string;
  ok: boolean;
}

export interface IntegrityResult {
  ok: boolean;
  checkedAt: string;
  accounts: AccountIntegrityCheck[];
}

export async function verifyLedgerIntegrity(): Promise<IntegrityResult> {
  const { data } = await apiClient.get('/committee/finance/integrity');
  return data.data as IntegrityResult;
}
