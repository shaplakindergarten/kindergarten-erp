# Finance Module Audit Report
## Read-Only Audit: Data Not Appearing on Finance Dashboard & Reports

**Date:** 2026-08-23
**Auditor:** Kilo (Senior ERP Developer)
**Scope:** `src/app/finance/*`, `src/app/api/finance/*`, `src/lib/api/finance.ts`, `src/types/finance.ts`, and related database tables/schema in `supabase/migrations/complete_schema.sql`

---

## Executive Summary

| # | Category | Severity | Status |
|---|----------|----------|--------|
| 1 | Fee payment integration broken — FK constraint mismatch | CRITICAL | Confirmed |
| 2 | Vouchers and finance_transactions are disconnected (no cross-linking) | CRITICAL | Confirmed |
| 3 | No RLS on finance tables (security issue, not a data-availability blocker) | HIGH | Confirmed |
| 4 | Missing index on `finance_transactions.type` column | MEDIUM | Confirmed |
| 5 | No DB trigger on `fee_payments` to create `finance_transactions` | MEDIUM | Confirmed |
| 6 | Bulk inventory operations don't create `finance_transactions` entries | MEDIUM | Confirmed |
| 7 | Frontend pages bypass API routes (inconsistency) | MEDIUM | Confirmed |
| 8 | Date filter defaults may exclude data | LOW | Confirmed |
| 9 | Transactions page search/filter has client-side bugs | LOW | Confirmed |

**TL;DR:** The primary reason data doesn't appear is that **fee payments — the main source of income in a kindergarten ERP — never create `finance_transactions` entries** because the integration API route fails at voucher creation due to a foreign-key mismatch (`chart_of_accounts.id` vs `financial_accounts.id`). Additionally, **vouchers created manually are never linked to `finance_transactions`**, creating two parallel data silos.

---

## 1. Database Audit

### 1.1 Table Structures

| Table | Primary Key | Key Columns | Notes |
|-------|-------------|-------------|-------|
| `finance_transactions` | `id` (UUID, gen_random_uuid) | `type` ('income'/'expense'), `head_id`, `amount`, `date`, `source_type`, `source_id`, `account_id` | Only FK: `organization_id` → `organizations(id)` |
| `vouchers` | `id` (UUID, gen_random_uuid) | `voucher_no`, `voucher_type` ('receipt'/'payment'/'journal'/'transfer'), `voucher_date`, `financial_account_id`, `total_amount` | FK: `financial_account_id` → `financial_accounts(id)` |
| `financial_accounts` | `id` (UUID, gen_random_uuid) | `account_name`, `type` ('cash'/'bank'/'mobile_bank'), `current_balance`, `is_active` | No FK to `chart_of_accounts` |
| `journal_entries` | `id` (UUID, gen_random_uuid) | `voucher_id`, `account_id`, `debit`, `credit` | FKs: `account_id` → `chart_of_accounts(id)`, `voucher_id` → `vouchers(id)` ON DELETE CASCADE |
| `chart_of_accounts` | `id` (UUID, gen_random_uuid) | `code`, `name`, `account_type` ('asset'/'liability'/'equity'/'revenue'/'expense'), `is_active` | Unique constraint on `code` |
| `fee_payments` | `id` (UUID, gen_random_uuid) | `student_id`, `amount`, `payment_method`, `receipt_no`, `payment_date` | No FK to `finance_transactions` |
| `payment_allocations` | `id` (UUID, gen_random_uuid) | `payment_id`, `category_id`, `amount` | No direct link to finance tables |
| `income_heads` | `id` (UUID, uuid_generate_v4) | `name`, `type`, `code`, `is_active` | Referenced by `finance_transactions.head_id` (no FK constraint) |
| `expense_heads` | `id` (UUID, uuid_generate_v4) | `name`, `type`, `code`, `is_active` | Referenced by `finance_transactions.head_id` (no FK constraint) |

### 1.2 RLS (Row Level Security) Status

| Table | RLS Enabled? | Policies Found |
|-------|-------------|----------------|
| `finance_transactions` | **NO** | None |
| `vouchers` | **NO** | None |
| `financial_accounts` | **NO** | None |
| `journal_entries` | **NO** | None |
| `chart_of_accounts` | **NO** | None |
| `income_heads` | **NO** | None |
| `expense_heads` | **NO** | None |
| `fee_payments` | **NO** (despite policies) | `Enable insert for authenticated users` (INSERT), `Enable read for authenticated users` (SELECT) |
| `payment_allocations` | **YES** | `public_access` (USING true) |

**Source:** `supabase/migrations/complete_schema.sql:6346` — `ALTER TABLE "public"."payment_allocations" ENABLE ROW LEVEL SECURITY;`

> Only `payment_allocations` has explicit `ENABLE ROW LEVEL SECURITY`. No other finance table has this statement. In PostgreSQL, RLS policies are ignored if RLS is not enabled on the table. The `fee_payments` policies exist but are non-functional without RLS enabled.

### 1.3 Indexes on Finance Tables

| Index Name | Table | Columns | Exists? |
|-----------|-------|---------|---------|
| `idx_finance_transactions_date` | `finance_transactions` | `date` | Yes (line 5415) |
| `idx_finance_transactions_source` | `finance_transactions` | `source_type, source_id` | Yes (line 5423) |
| `idx_finance_transactions_fee_payment_unique` | `finance_transactions` | `source_type, source_id` (WHERE source_type='fee_payment') | Yes (line 5419) |
| **Index on `type` column** | `finance_transactions` | `type` | **NO — MISSING** |
| `idx_fee_payments_payment_date` | `fee_payments` | `payment_date` | Yes (line 5299) |
| `idx_fee_payments_student_id` | `fee_payments` | `student_id` | Yes (line 5311) |
| `idx_fee_payments_student_date` | `fee_payments` | `student_id, payment_date DESC` | Yes (line 5307) |
| `idx_payment_allocations_payment` | `payment_allocations` | `payment_id` | Yes (line 5439) |
| `idx_payment_allocations_category` | `payment_allocations` | `category_id` | Yes (line 5435) |

### 1.4 Triggers on Finance Tables

| Trigger Name | Table | Event | Function | Creates finance_transactions? |
|-------------|-------|-------|----------|------------------------------|
| `trigger_auto_create_salary_expense` | `salary_payments` | AFTER INSERT | `auto_create_salary_expense()` | YES — inserts into `finance_transactions` with `type='expense'`, `source_type='salary_payment'` |
| `trigger_due_changes_payments` | `fee_payments` | AFTER INSERT OR UPDATE | `notify_due_changes()` | NO — only sends `pg_notify('due_changes', ...)` |

**Key Finding:** There is **no database trigger** on `fee_payments` that automatically creates `finance_transactions` entries. The fee payment → finance integration is handled entirely in application code via the `/api/finance/integration` API route.

### 1.5 Foreign Key Constraints — Critical Mismatch

| FK Constraint | Source Table.Column | References Table.Column |
|---------------|-------------------|------------------------|
| `finance_transactions_organization_id_fkey` | `finance_transactions.organization_id` | `organizations(id)` |
| `vouchers_financial_account_id_fkey` | `vouchers.financial_account_id` | `financial_accounts(id)` |
| `fk_journal_entries_account` | `journal_entries.account_id` | `chart_of_accounts(id)` |
| `fk_journal_entries_voucher` | `journal_entries.voucher_id` | `vouchers(id)` ON DELETE CASCADE |

> **CRITICAL:** `vouchers.financial_account_id` references `financial_accounts(id)`, NOT `chart_of_accounts(id)`.
> `journal_entries.account_id` references `chart_of_accounts(id)`.
> `finance_transactions.account_id` and `finance_transactions.head_id` have **NO FK constraints** — any UUID can be inserted.

---

## 2. Backend API Audit

### 2.1 API Routes Inventory

| Route File | Methods | Uses Service Role Key? | Creates finance_transactions? | Creates vouchers? |
|-----------|---------|----------------------|------------------------------|-------------------|
| `src/app/api/finance/income/route.ts` | POST | Yes (supabaseAdmin) | Yes | No |
| `src/app/api/finance/expense/route.ts` | POST | Yes (supabaseAdmin) | Yes | No |
| `src/app/api/finance/transfer/route.ts` | POST | Yes (supabaseAdmin) | Yes (2 entries: income+expense) | No |
| `src/app/api/finance/statements/route.ts` | GET | Yes (supabaseAdmin) | Read-only | Read-only |
| `src/app/api/finance/integration/route.ts` | POST, GET | Yes (supabaseAdmin) | Yes (in catch block, may fail) | Yes |

### 2.2 CRITICAL: Integration Route FK Mismatch

**File:** `src/app/api/finance/integration/route.ts`

#### The Bug (lines 71-164 + 258-271):

The `getDefaultBankAccount()` function (line 71) queries `chart_of_accounts` and returns its `id`:

```typescript
// line 81-90: Returns chart_of_accounts.id
const { data: chartAccount } = await supabase
  .from('chart_of_accounts')
  .select('id, code, name')
  .eq('code', 'ASS-CASH')
  .eq('is_active', true)
  .maybeSingle()
```

This `chart_of_accounts.id` is then used as `financial_account_id` when creating a voucher (line 266):

```typescript
// line 258-271: Creates voucher
const { data: voucher, error: voucherError } = await supabase
  .from('vouchers')
  .insert({
    voucher_no: voucherNo,
    voucher_type: 'receipt',
    voucher_date: new Date().toISOString().split('T')[0],
    total_amount: amount,
    paid_to_received_from: `Fee Payment - ${studentId}`,
    financial_account_id: bankAccountId,  // ← chart_of_accounts.id, NOT financial_accounts.id
    narration: 'Fee payment received',
    reference_no: `FEES-${paymentId}`
  })
```

**The FK constraint** `vouchers_financial_account_id_fkey` (defined at `complete_schema.sql:6233-6234`) requires this value to exist in `financial_accounts(id)`. Since `chart_of_accounts.id` and `financial_accounts.id` are independently generated UUIDs, the INSERT fails with a foreign key violation.

#### Consequence (lines 273-351):

When the voucher insert fails, `voucherError` is thrown (line 274-275). The catch block (line 343-350) returns:

```typescript
return NextResponse.json({
  success: true,
  financeIntegrated: false,
  message: 'Finance integration failed, payment processed successfully'
})
```

The journal entries (lines 280-308) and `finance_transactions` insert (lines 311-334) are **never reached** because the voucher creation threw an exception that was caught by the outer try/catch block.

**Impact:** Every fee payment — the primary source of income in a kindergarten ERP — silently fails to create any finance data. The `fee_payments` table gets the record, but `vouchers`, `journal_entries`, and `finance_transactions` remain empty.

The same FK mismatch affects the salary payment integration path (line 401-404 in the same file).

### 2.3 Income/Expense API Routes Not Used by Frontend

**File:** `src/app/api/finance/income/route.ts` — exists but is **never called** from the frontend.

The frontend income page (`src/app/finance/income/page.tsx:117`) inserts directly via the Supabase client:

```typescript
// src/app/finance/income/page.tsx line 117
const { data: txData, error: txError } = await supabase
  .from('finance_transactions')
  .insert([{...}])
```

Instead of calling the `/api/finance/income` endpoint via:

```typescript
// This exists in src/lib/api/finance.ts but is NOT imported by the income page
const response = await fetch('/api/finance/income', { method: 'POST', ... })
```

The same issue applies to the expense page (`src/app/finance/expense/page.tsx:123`).

| Issue | Income Page | Expense Page |
|-------|-------------|-------------|
| Inserts via direct Supabase client | Yes (line 117) | Yes (line 123) |
| Calls API route | No | No |
| Creates voucher | No | No |
| Creates journal entry | No | No |
| Creates finance_transactions | Yes | Yes |
| Uses service role key | No (anon key) | No (anon key) |

---

## 3. Frontend Pages Audit

### 3.1 Dashboard (`src/app/finance/page.tsx`)

| Query Target | Table | Filters | Issue |
|-------------|-------|---------|-------|
| Income summary | `finance_transactions` | `type='income'`, date range (This Month default) | Date range may exclude data if not current month |
| Expense summary | `finance_transactions` | `type='expense'`, date range (This Month default) | Same date range issue |
| Account balances | `financial_accounts` | `is_active=true` | No date filter — OK |
| Recent Vouchers | `vouchers` | None (just ORDER BY voucher_date DESC, LIMIT 10) | **No date filter** — vouchers from any date show |

**Critical Disconnection:** The dashboard's summary cards query `finance_transactions`, but "Recent Vouchers" queries the `vouchers` table. These two tables are populated by different code paths:
- Manual Income/Expense pages → only populate `finance_transactions`
- New Voucher page → only populates `vouchers` and `journal_entries`
- Fee payment integration → **fails to populate either** (due to FK bug)

So if all financial activity comes from fee payments (which fail silently), ALL dashboard data is empty.

### 3.2 Transactions Page (`src/app/finance/transactions/page.tsx`)

```typescript
// line 64-69
const { data, error } = await supabase
  .from('vouchers')
  .select('*')
  .order('voucher_date', { ascending: false })
  .order('created_at', { ascending: false })
```

| Issue | Line | Description |
|-------|------|-------------|
| Data source mismatch | line 64 | Queries `vouchers` table, not `finance_transactions`. Manual income/expense entries (which only insert into `finance_transactions`) will NOT appear here. |
| Date range unused | line 42 | `dateRange` state is declared but never applied to any query. |
| Search filter overwrites state | lines 48-59 | The useEffect overwrites `vouchers` state with filtered results. Clearing the search does NOT restore full data — the component must be re-mounted or refreshed. |
| Client-side filtering only | lines 50-56 | Filtering happens on already-loaded data, not via Supabase query. If 1000 vouchers exist, all are loaded then filtered client-side. |

### 3.3 Reports Page (`src/app/finance/reports/page.tsx`)

| Report | Data Source | Issues |
|--------|------------|--------|
| Cashbook | `vouchers` (line 196) | Only shows voucher-type transactions. Manual `finance_transactions` entries won't appear. |
| General Ledger | `journal_entries` with nested joins (line 223) | Queries `journal_entries` with `chart_of_accounts` and `vouchers` joins. Filters via `vouchers.voucher_date`. Manual `finance_transactions` won't appear. |
| Trial Balance | `chart_of_accounts` + `journal_entries` (lines 240-281) | Correctly uses journal entries. Works if journal entries exist. |
| Income Statement | `finance_transactions` (line 287) | Works if `finance_transactions` has data. Fee payments would populate this IF the integration route didn't fail. |
| Balance Sheet | `chart_of_accounts` + `journal_entries` (lines 343-405) | Works if journal entries exist. |
| Source-wise | `finance_transactions` (line 410) | Works if `finance_transactions` has data. Groups by `source_type`. |

**Key Issue:** The Cashbook and Income Statement use **different data sources** (`vouchers` vs `finance_transactions`), creating inconsistent reporting.

### 3.4 New Voucher Page (`src/app/finance/transactions/new/page.tsx`)

```typescript
// line 126-137: Creates voucher
await supabase.from('vouchers').insert([{...}]).select().single()

// line 145-156: Creates journal entries
entries.map(entry => supabase.from('journal_entries').insert([{...}]))
```

| Issue | Line | Description |
|-------|------|-------------|
| No finance_transactions created | lines 126-156 | Vouchers page creates `vouchers` + `journal_entries` but NEVER creates `finance_transactions` entries. Dashboard summary cards won't include manually-created vouchers. |
| No financial_account balance update | — | The voucher creation does not update `financial_accounts.current_balance`. |

### 3.5 Income/Expense Pages

| Page | Data Source | Creates Voucher? | Updates Account Balance? |
|------|------------|------------------|--------------------------|
| Income (`src/app/finance/income/page.tsx`) | `finance_transactions` only (line 117) | No | Yes (line 137-143) |
| Expense (`src/app/finance/expense/page.tsx`) | `finance_transactions` only (line 123) | No | Yes (line 143-149) |
| Transfer (`src/app/finance/transfer/page.tsx`) | Calls `/api/finance/transfer` (line 142) which creates `finance_transactions` | No | Yes (API route updates both accounts) |

**Result:** Income/Expense pages populate `finance_transactions` but leave `vouchers` empty. Transfer populates `finance_transactions` but leaves `vouchers` empty. Only the "New Voucher" page populates `vouchers`.

---

## 4. Integrations Audit

### 4.1 Fee Payment → Finance (`src/app/api/receive-payment/route.ts` + `/src/app/api/finance/integration/route.ts`)

| Step | Location | Status |
|------|----------|--------|
| Fee payment recorded in `fee_payments` table | `receive-payment/route.ts:320-331` | ✅ Success |
| Finance integration API called | `receive-payment/route.ts:382-397` | ✅ Called |
| `getDefaultBankAccount()` returns `chart_of_accounts.id` | `integration/route.ts:81-91` | ⚠️ Returns chart account ID |
| Voucher insert with `financial_account_id` = chart_of_accounts.id | `integration/route.ts:258-271` | ❌ FK violation — `vouchers.financial_account_id` → `financial_accounts(id)` |
| Journal entries created | `integration/route.ts:280-308` | ❌ Never reached (voucher insert failed) |
| `finance_transactions` created | `integration/route.ts:312-334` | ❌ Never reached (voucher insert failed) |
| Catch block returns `financeIntegrated: false` | `integration/route.ts:343-350` | ⚠️ Silently fails, payment still succeeds |

**Conclusion:** The fee payment integration is **completely broken** due to the FK mismatch. No finance data is ever created from fee payments.

### 4.2 Inventory Purchase/Sale → Finance (`src/lib/api/inventory.ts`)

| Function | RPC/Method | Creates finance_transactions? | Notes |
|----------|-----------|------------------------------|-------|
| `recordPurchase` | Direct Supabase insert | Yes (line 183-195) | Single-item purchase only |
| `recordSale` | Direct Supabase insert | Yes (line 291-304) | Single-item sale only |
| `recordBulkPurchase` | RPC `create_inventory_purchase` | **No** | Calls RPC but doesn't create finance entry. Only updates `account_id` if existing entry found. |
| `recordBulkSale` | RPC `create_inventory_sale` | **No** | Calls RPC but doesn't create finance entry. Only updates `account_id` if existing entry found. |

**The RPC functions** (`create_inventory_purchase` at schema line 824, `create_inventory_sale` at schema line 976) do NOT insert into `finance_transactions`. They only handle inventory tables.

**Conclusion:** Single-item inventory operations create `finance_transactions` entries, but bulk operations do not.

### 4.3 Salary → Finance (Database Trigger)

| Component | Location | Status |
|-----------|----------|--------|
| `auto_create_salary_expense()` function | `complete_schema.sql:49-126` | ✅ Defined |
| `trigger_auto_create_salary_expense` trigger | `complete_schema.sql:5599` | ✅ Created |
| Uses `financial_accounts.id` for `account_id` | `complete_schema.sql:76-78` | ✅ Correct (queries `financial_accounts`, not `chart_of_accounts`) |
| Creates `finance_transactions` with `type='expense'` | `complete_schema.sql:90-114` | ✅ Yes |
| `finance_transactions.account_id` has FK constraint | — | No (no FK on `account_id` in `finance_transactions`) |

**Conclusion:** The salary integration **works correctly** — it creates `finance_transactions` entries with `type='expense'` and `source_type='salary_payment'`. However, it uses `financial_accounts` (not `chart_of_accounts` for the account), which is different from the fee payment integration path.

---

## 5. Data Consistency & Architecture Issues

### 5.1 Critical Data Flow Disconnect

```
┌─────────────────────┐    ┌──────────────────────┐    ┌──────────────────────┐
│  Manual Income Page │    │   New Voucher Page   │    │  Fee Payment Flow    │
│  (income/page.tsx)  │     │ (transactions/new)   │     │  (receive-payment →  │
├─────────────────────┤     ├──────────────────────┤     │   integration)       │
│ finance_transactions│     │ vouchers             │     ├──────────────────────┤
│ (type='income')     │     │ journal_entries      │     │ voucher      ← FAILS │
│                     │     │ (BOTH tables written)│     │ journal_entry ← SKIPPED│
│ NO voucher created  │     │ NO finance_tx created│     │ finance_tx    ← SKIPPED│
│ NO journal_entry    │     │                      │     │                          │
└─────────────────────┘     └──────────────────────┘     └──────────────────────┘

┌─────────────────────┐    ┌──────────────────────┐
│  Salary Trigger     │    │ Inventory Operations │
├─────────────────────┤    ├──────────────────────┤
│ finance_transactions│    │ recordPurchase/Sale  │
│ (type='expense')    │    │ → creates finance_tx │
│ via DB trigger      │    │                      │
│ ✅ Works            │    │ recordBulk*          │
│ ❌ No voucher       │    │ → NO finance_tx      │
│ ❌ No journal_entry │    │ ⚠️ Bulk missing data │
└─────────────────────┘    └──────────────────────┘
```

### 5.2 Dashboard vs. Transactions Page — Different Data Sources

| What the User Sees | Data Source | Query |
|-------------------|------------|-------|
| Dashboard summary cards | `finance_transactions` | `type='income'`, `type='expense'`, date range |
| Dashboard "Recent Vouchers" | `vouchers` | No filter, ORDER BY date DESC |
| Transactions page list | `vouchers` | No filter, ORDER BY date DESC |
| Income Statement report | `finance_transactions` | date range, filter type |
| Cashbook report | `vouchers` | date range |
| Source-wise report | `finance_transactions` | date range, group by source_type |
| Balance Sheet | `journal_entries` + `chart_of_accounts` | No date filter |
| Trial Balance | `journal_entries` + `chart_of_accounts` | No date filter |

**The dashboard income total and the Transactions page revenue total are calculated from completely different tables.** This means:
- Manual income entries (in `finance_transactions`) appear in dashboard summary but NOT in transactions list
- Voucher-based receipts (in `vouchers`) appear in transactions list but NOT in dashboard summary

---

## 6. SQL Queries Simulated (From Frontend Code)

### Query 1: Dashboard Income (dashboard, line 118-123)
```sql
SELECT amount, date FROM finance_transactions
WHERE type = 'income'
  AND date >= '2026-08-01'
  AND date <= '2026-08-23';
-- Result: Depends on whether finance_transactions has income entries in current month
-- If fee payments are the only income source → 0 rows (FK bug prevents creation)
```

### Query 2: Dashboard Expense (dashboard, line 124-129)
```sql
SELECT amount, date FROM finance_transactions
WHERE type = 'expense'
  AND date >= '2026-08-01'
  AND date <= '2026-08-23';
-- Result: Only manual expenses and salary-triggered entries
-- (Salary trigger works; manual expense page works; fee payment integration broken)
```

### Query 3: Recent Vouchers (dashboard, line 134-138)
```sql
SELECT id, voucher_no, voucher_type, voucher_date, total_amount, paid_to_received_from
FROM vouchers
ORDER BY voucher_date DESC
LIMIT 10;
-- Result: Only vouchers created via:
--   - New Voucher page (src/app/finance/transactions/new)
--   - Fee payment integration (BROKEN — voucher creation fails)
--   - Salary integration (does NOT create vouchers, only finance_transactions)
```

### Query 4: Transactions List (transactions page, line 64-69)
```sql
SELECT * FROM vouchers
ORDER BY voucher_date DESC, created_at DESC;
-- Result: Same as above — only vouchers from New Voucher page
```

### Query 5: Cashbook (reports page, line 195-201)
```sql
SELECT * FROM vouchers
WHERE voucher_date >= '2026-08-01'
  AND voucher_date <= '2026-08-31'
ORDER BY voucher_date DESC;
-- Result: Only vouchers from New Voucher page in current month
```

### Query 6: Income Statement (reports/income-statement, line 79-83)
```sql
SELECT * FROM finance_transactions
WHERE date >= '2026-08-01'
  AND date <= '2026-08-31';
-- Result: Only manual income/expense entries + salary-triggered entries
-- Fee payments are NOT here (integration broken)
```

### Query 7: Source-wise Report (reports/source-wise, line 113-117)
```sql
SELECT * FROM finance_transactions
WHERE date >= '2026-08-01'
  AND date <= '2026-08-31';
-- Result: Same as Query 6, grouped by source_type
-- source_type='fee_payment' will have 0 entries
```

### Query 8: General Ledger (reports page, line 223-233)
```sql
SELECT *,
  voucher:vouchers(voucher_no, voucher_date, paid_to_received_from),
  account:chart_of_accounts(code, name)
FROM journal_entries
WHERE vouchers.voucher_date >= '2026-08-01'
  AND vouchers.voucher_date <= '2026-08-31'
ORDER BY vouchers.voucher_date DESC;
-- Result: Only journal entries from:
--   - New Voucher page (manual voucher creation)
--   - Fee payment integration (BROKEN)
--   - Salary integration (does NOT create journal entries)
```

---

## 7. Summary of All Issues Found

### CRITICAL

#### Issue 1: Fee Payment Integration FK Mismatch
- **File:** `src/app/api/finance/integration/route.ts:71-164, 258-271`
- **Problem:** `getDefaultBankAccount()` returns `chart_of_accounts.id`, but `vouchers.financial_account_id` has a FK constraint to `financial_accounts(id)`. UUIDs are independently generated, so the INSERT always fails.
- **Effect:** Every fee payment silently fails to create vouchers, journal entries, and `finance_transactions`. Since fee payments are the primary income source, the dashboard shows zero income.
- **Root cause:** The code comment at line 70 says "Now returns chart_of_accounts ID, not financial_accounts ID" — this was an intentional change, but it broke the voucher FK constraint.

#### Issue 2: Vouchers and finance_transactions Not Linked
- **File:** `src/app/finance/transactions/new/page.tsx:126-158`
- **Problem:** Creating a new voucher only writes to `vouchers` and `journal_entries`. It does NOT create a `finance_transactions` entry.
- **Effect:** Data entered via the New Voucher page appears in the Transactions page and Cashbook, but NOT in the dashboard summary cards, Income Statement, or Source-wise report.

### HIGH

#### Issue 3: No RLS on Finance Tables
- **File:** `supabase/migrations/complete_schema.sql`
- **Problem:** Only `payment_allocations` has `ENABLE ROW LEVEL SECURITY` (line 6346). Finance tables (`finance_transactions`, `vouchers`, `financial_accounts`, etc.) have no RLS.
- **Effect:** All finance data is accessible with the anon key. This is a security issue but does NOT cause data to not appear.

### MEDIUM

#### Issue 4: Missing Index on `finance_transactions.type`
- **File:** `supabase/migrations/complete_schema.sql:5415-5423`
- **Problem:** Indexes exist on `date` and `source_type+source_id` but NOT on `type`.
- **Effect:** Dashboard, Income Statement, and Source-wise report queries that filter by `type='income'` or `type='expense'` require full table scans. Performance degradation on large datasets.

#### Issue 5: No DB Trigger on fee_payments for Finance Integration
- **File:** `supabase/migrations/complete_schema.sql:5615`
- **Problem:** The `fee_payments` table only has `notify_due_changes` trigger (sends pg_notify). No trigger creates `finance_transactions` entries.
- **Effect:** If the application-level integration fails (as it does currently), there is no database-level fallback.

#### Issue 6: Bulk Inventory Operations Skip Finance Integration
- **File:** `src/lib/api/inventory.ts:329-364, 381-416`
- **Problem:** `recordBulkPurchase` and `recordBulkSale` call RPC functions that don't create `finance_transactions` entries.
- **Effect:** Bulk inventory operations create no finance records.

#### Issue 7: Frontend Pages Bypass API Routes
- **Files:** `src/app/finance/income/page.tsx:117`, `src/app/finance/expense/page.tsx:123`
- **Problem:** These pages insert directly via the Supabase anon client instead of calling `/api/finance/income/route.ts` and `/api/finance/expense/route.ts`.
- **Effect:** Validation in API routes is bypassed; inconsistency in data creation paths.

### LOW

#### Issue 8: Dashboard Date Filter May Exclude Data
- **File:** `src/app/finance/page.tsx:204-228`
- **Problem:** Dashboard defaults to "This Month" date range. Data from other months is excluded from summary cards.
- **Effect:** If testing outside the current month, or if data was entered with past/future dates, summary cards appear empty.

#### Issue 9: Transactions Page Search/Filter Bugs
- **File:** `src/app/finance/transactions/page.tsx:42, 48-59`
- **Problem:** `dateRange` state is declared but never applied to Supabase queries. Search filter overwrites state without a restore mechanism.
- **Effect:** Search results can't be cleared without page refresh; date filtering is non-functional.

---

## 8. Recommendations

### Fix 1 (CRITICAL): Fix the FK mismatch in the integration route
**File:** `src/app/api/finance/integration/route.ts`

**Option A (Recommended):** Query `financial_accounts` instead of `chart_of_accounts` in `getDefaultBankAccount()`, since `vouchers.financial_account_id` references `financial_accounts`:
```typescript
// Replace getDefaultBankAccount to query financial_accounts
const { data: finAccount } = await supabase
  .from('financial_accounts')
  .select('id, account_name, type')
  .eq('is_active', true)
  .match(accountType ? { type: accountType } : { type: 'cash' })
  .limit(1)
  .maybeSingle()
```

**Option B:** Remove `financial_account_id` from the voucher insert (it's nullable — the column has no NOT NULL constraint).

**Option C:** Create corresponding `financial_accounts` entries for each `chart_of_accounts` asset account, and use the `financial_accounts.id` in voucher inserts.

### Fix 2 (CRITICAL): Link vouchers to finance_transactions
**File:** `src/app/finance/transactions/new/page.tsx`

After creating a voucher and journal entries, also create a `finance_transactions` entry:
```typescript
// Determine type from voucher_type
const txType = voucherType === 'receipt' ? 'income' : 
               voucherType === 'payment' ? 'expense' : null;
if (txType) {
  await supabase.from('finance_transactions').insert({
    type: txType,
    head_id: /* from journal entries */,
    account_id: formData.financialAccountId,
    amount: Math.max(totalDebit, totalCredit),
    date: voucherDate,
    description: narration || '',
    payment_mode: /* derive from account */,
    source_type: 'manual',
    source_id: voucherData.id,
  });
}
```

### Fix 3 (MEDIUM): Add index on `finance_transactions.type`
```sql
CREATE INDEX IF NOT EXISTS idx_finance_transactions_type 
ON finance_transactions(type, date);
```

### Fix 4 (MEDIUM): Add database trigger for fee_payments → finance_transactions
Create a trigger on `fee_payments` that creates `finance_transactions` entries, similar to the salary trigger pattern. This provides a database-level fallback even if the application integration fails.

### Fix 5 (MEDIUM): Create finance_transactions in bulk inventory operations
In `recordBulkPurchase` and `recordBulkSale`, after the RPC succeeds, insert into `finance_transactions` (similar to `recordPurchase`/`recordSale`).

### Fix 6 (LOW): Fix date range and search on transactions page
- Apply `dateRange` filter to the Supabase query
- Fix the search useEffect to properly restore full data when search is cleared

### Fix 7 (LOW): Use API routes from frontend income/expense pages
Import `createManualIncome` and `createManualExpense` from `@/lib/api/finance` instead of calling Supabase directly.

---

## 9. Files Examined

| File Path | Role | Lines Read |
|-----------|------|------------|
| `src/app/finance/page.tsx` | Dashboard page | Full (496 lines) |
| `src/app/finance/transactions/page.tsx` | Transactions list | Full (221 lines) |
| `src/app/finance/transactions/new/page.tsx` | New voucher form | Full (436 lines) |
| `src/app/finance/transactions/[id]/page.tsx` | Voucher detail | Full (356 lines) |
| `src/app/finance/income/page.tsx` | Manual income entry | Full (361 lines) |
| `src/app/finance/expense/page.tsx` | Manual expense entry | Full (366 lines) |
| `src/app/finance/transfer/page.tsx` | Transfer page | Full (447 lines) |
| `src/app/finance/accounts/page.tsx` | Chart of accounts | Full (411 lines) |
| `src/app/finance/reports/page.tsx` | Reports dashboard | Full (904 lines) |
| `src/app/finance/reports/income-statement/page.tsx` | Income statement report | Full (366 lines) |
| `src/app/finance/reports/balance-sheet/page.tsx` | Balance sheet report | Full (377 lines) |
| `src/app/finance/reports/source-wise/page.tsx` | Source-wise report | Full (349 lines) |
| `src/app/api/finance/income/route.ts` | Income API route | Full (108 lines) |
| `src/app/api/finance/expense/route.ts` | Expense API route | Full (116 lines) |
| `src/app/api/finance/transfer/route.ts` | Transfer API route | Full (177 lines) |
| `src/app/api/finance/statements/route.ts` | Statements API route | Full (223 lines) |
| `src/app/api/finance/integration/route.ts` | Finance integration API | Full (525 lines) |
| `src/app/api/receive-payment/route.ts` | Fee payment API | Full (434 lines) |
| `src/lib/api/finance.ts` | Finance API client | Full (181 lines) |
| `src/lib/api/inventory.ts` | Inventory API (finance integration) | Selected (lines 100-310, 329-416) |
| `src/lib/api/header.ts` | Header utilities | Full (192 lines) |
| `src/lib/supabase/client.ts` | Supabase client | Full (20 lines) |
| `src/lib/supabase/server.ts` | Supabase server client | Full (25 lines) |
| `src/types/finance.ts` | Finance type definitions | Full (226 lines) |
| `supabase/migrations/complete_schema.sql` | Database schema | Selected (lines 1-1685, 2546-2564, 3150-3210, 3504-3624, 3686-3810, 3966-3977, 4124-4136, 4582-4595, 5295-5423, 5427-5583, 5599-5620, 6228-6247, 6554-6560) |

---

## 10. Conclusion

The primary reason financial data does not appear on the Finance Dashboard and reports is a **foreign-key constraint mismatch in the fee payment integration route** (`src/app/api/finance/integration/route.ts:266`). The `getDefaultBankAccount()` function returns a `chart_of_accounts.id`, which is then inserted into `vouchers.financial_account_id` — a column that has a foreign key constraint referencing `financial_accounts(id)`. This causes every fee-payment voucher creation to fail silently, which in turn prevents the creation of journal entries and `finance_transactions` records.

Since fee payments represent the primary income source for a kindergarten ERP, and the integration fails on every invocation, the `finance_transactions` table remains empty or severely underpopulated, causing the dashboard summary cards, income statements, and source-wise reports to show zero values.

The secondary issue is a **fundamental data architecture disconnect**: the "New Voucher" page writes to `vouchers` and `journal_entries` but never to `finance_transactions`, while the manual income/expense pages write to `finance_transactions` but never to `vouchers`. The dashboard queries `finance_transactions` for summary data, while the transactions page and cashbook query `vouchers`. This means data is split across two tables with no synchronization between them.

**Immediate priority fixes:**
1. Fix the FK mismatch in `integration/route.ts` (CRITICAL)
2. Create `finance_transactions` entries when vouchers are created (CRITICAL)
