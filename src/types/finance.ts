// src/types/finance.ts

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'

export type VoucherType = 'receipt' | 'payment' | 'journal' | 'transfer'

export type FinancialAccountType = 'cash' | 'bank' | 'mobile_bank'

export type TransactionSourceType = 
  | 'fee_payment' 
  | 'inventory_purchase' 
  | 'inventory_sale'
  | 'salary_payment' 
  | 'manual_income' 
  | 'manual_expense' 
  | 'transfer'
  | 'voucher'

export type PaymentMode = 'cash' | 'bank' | 'mobile_banking'

export interface AccountHead {
  id: string
  name: string
  type: AccountType
  description?: string | null
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export interface FinancialAccount {
  id: string
  account_name: string
  account_number: string
  type: FinancialAccountType
  bank_name: string | null
  branch_name: string | null
  current_balance: number
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export interface Voucher {
  id: string
  voucher_no: string
  voucher_type: VoucherType
  voucher_date: string
  financial_account_id: string | null
  total_amount: number
  paid_to_received_from: string
  reference_no?: string | null
  narration?: string | null
  created_at?: string
  updated_at?: string
}

export interface JournalEntry {
  id: string
  voucher_id: string
  account_id: string
  debit: number | null
  credit: number | null
  description?: string | null
}

export interface FinanceTransaction {
  id: string
  type: 'income' | 'expense'
  amount: number
  account_id?: string | null
  head_id?: string | null
  date: string
  description: string
  payment_mode: PaymentMode
  reference?: string | null
  // ✅ Source Tracking Fields (added)
  source_type?: TransactionSourceType
  source_id?: string
  source_table?: string
  status?: 'pending' | 'completed' | 'cancelled'
  created_at?: string
  updated_at?: string
}

export interface IncomeHead {
  id: string
  name: string
  type: string
  description?: string | null
  created_at?: string
}

export interface ExpenseHead {
  id: string
  name: string
  type: string
  description?: string | null
  created_at?: string
}

// ============================
// NEW: Integration Types
// ============================

export interface IntegrationResult {
  success: boolean
  transaction_id?: string
  duplicate?: boolean
  error?: string
}

export interface ManualEntryPayload {
  head_id: string
  amount: number
  date: string
  description: string
  payment_mode: PaymentMode
  financial_account_id?: string
  reference?: string
  source_type?: TransactionSourceType
  source_id?: string
}

// ============================
// NEW: Transfer Types
// ============================

export interface TransferPayload {
  from_account_id: string
  to_account_id: string
  amount: number
  date: string
  description: string
  reference?: string
}

// ============================
// NEW: Report Types
// ============================

export interface CashbookEntry {
  date: string
  description: string
  voucher_no?: string
  debit: number
  credit: number
  balance: number
  account_id?: string
  source_type?: TransactionSourceType
  source_id?: string
}

export interface LedgerEntry {
  date: string
  description: string
  voucher_no?: string
  debit: number
  credit: number
  balance: number
  account_id: string
  account_name: string
  source_type?: TransactionSourceType
  source_id?: string
}

export interface TrialBalanceRow {
  account_id: string
  account_name: string
  account_type: AccountType
  debit: number
  credit: number
}

export interface IncomeStatementRow {
  head_id: string
  head_name: string
  amount: number
  type: 'income' | 'expense'
}

export interface BalanceSheetRow {
  account_id: string
  account_name: string
  account_type: AccountType
  amount: number
}

export interface SourceWiseReportRow {
  source_type: TransactionSourceType
  total_income: number
  total_expense: number
  net: number
  count: number
}

// ============================
// NEW: Statistics Types
// ============================

export interface FinanceStats {
  total_income: number
  total_expense: number
  net_profit: number
  cash_balance: number
  bank_balance: number
  total_transactions: number
  pending_transactions: number
}

// ============================
// NEW: Filter Types
// ============================

export interface TransactionFilter {
  start_date?: string
  end_date?: string
  type?: 'income' | 'expense' | 'all'
  head_id?: string
  payment_mode?: PaymentMode
  source_type?: TransactionSourceType
  source_id?: string
  search?: string
  page?: number
  limit?: number
}