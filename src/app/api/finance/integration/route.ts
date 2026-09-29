// src/app/api/finance/integration/route.ts
// Finance ERP Integration: Fees & Salary to Double-Entry System

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseSecretKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseSecretKey) {
  console.error('ERROR: Missing Supabase environment variables')
}

const supabaseAdmin = createClient(supabaseUrl!, supabaseSecretKey!, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// ✅ DEBUG: লগ দেখার জন্য
console.log('🔧 Finance Integration API loaded at:', new Date().toISOString())

// ============================================
// Get default account for Student Fees (Revenue)
// ============================================
async function getFeeIncomeAccount(supabase: any): Promise<string | null> {
  const { data: account } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', 'REV-FEE')
    .eq('is_active', true)
    .single()

  if (account) return account.id

  // Fallback: find any revenue account
  const { data: revAccount } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('account_type', 'revenue')
    .eq('is_active', true)
    .single()
  return revAccount?.id || null
}

// ============================================
// Get default account for Staff Salaries (Expense)
// ============================================
async function getSalaryExpenseAccount(supabase: any): Promise<string | null> {
  const { data: account } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', 'EXP-SAL')
    .eq('is_active', true)
    .single()

  if (account) return account.id

  // Fallback: find any expense account
  const { data: expAccount } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('account_type', 'expense')
    .eq('is_active', true)
    .single()
  return expAccount?.id || null
}

// ============================================
// Get default financial_accounts ID (for vouchers)
// Maps payment method to financial_accounts.type
// ============================================
async function getDefaultFinancialAccount(supabase: any, paymentMethod: string = 'cash'): Promise<string | null> {
  let accountType = 'cash'
  if (paymentMethod === 'bank') accountType = 'bank'
  if (paymentMethod === 'mobile' || paymentMethod === 'mobile_banking') accountType = 'mobile_bank'

  console.log('🔍 Looking for financial_account with type:', accountType)

  // Try to find existing financial_accounts entry
  const { data: finAccount } = await supabase
    .from('financial_accounts')
    .select('id, account_name, type')
    .eq('type', accountType)
    .eq('is_active', true)
    .maybeSingle()

  if (finAccount) {
    console.log('✅ Found financial account:', finAccount.id, finAccount.account_name)
    return finAccount.id
  }

  // Create a default financial_accounts entry
  console.log('⚠️ No financial account found, creating default...', accountType)
  const { data: newAccount, error: createError } = await supabase
    .from('financial_accounts')
    .insert({
      account_name: accountType === 'cash' ? 'Cash' : accountType === 'bank' ? 'Bank' : 'Mobile Banking',
      account_number: '',
      type: accountType,
      bank_name: null,
      branch_name: null,
      current_balance: 0,
      is_active: true
    })
    .select('id, account_name, type')
    .maybeSingle()

  if (newAccount) {
    console.log('✅ Created new financial account:', newAccount.id, newAccount.account_name)
    return newAccount.id
  }

  if (createError) {
    console.error('❌ Failed to create financial account:', createError)
  }

  // Final fallback: any financial_accounts entry
  const { data: anyAccount } = await supabase
    .from('financial_accounts')
    .select('id')
    .eq('is_active', true)
    .maybeSingle()

  return anyAccount?.id || null
}

// ============================================
// ✅ UPDATED: Get default cash/bank account
// Now returns chart_of_accounts ID (for journal_entries)
// ============================================
async function getDefaultBankAccount(supabase: any, paymentMethod: string = 'cash'): Promise<string | null> {
  // Map payment method to account type
  let accountType = 'cash'
  if (paymentMethod === 'bank') accountType = 'bank'
  if (paymentMethod === 'mobile' || paymentMethod === 'mobile_banking') accountType = 'mobile_bank'

  console.log('🔍 Looking for account with type:', accountType)

  // ✅ Try 1: Check chart_of_accounts directly (MOST RELIABLE)
  // This is the correct approach - journal_entries.account_id references chart_of_accounts.id
  const { data: chartAccount } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('code', 'ASS-CASH')
    .eq('is_active', true)
    .maybeSingle()

  if (chartAccount) {
    console.log('✅ Found chart account (ASS-CASH):', chartAccount.id, chartAccount.name)
    return chartAccount.id
  }

  // ✅ Try 2: Check if ASS-BANK exists (for bank payments)
  if (accountType === 'bank') {
    const { data: bankAccount } = await supabase
      .from('chart_of_accounts')
      .select('id, code, name')
      .eq('code', 'ASS-BANK')
      .eq('is_active', true)
      .maybeSingle()

    if (bankAccount) {
      console.log('✅ Found chart account (ASS-BANK):', bankAccount.id, bankAccount.name)
      return bankAccount.id
    }
  }

  // ✅ Try 3: Check if ASS-MOB exists (for mobile payments)
  if (accountType === 'mobile_bank') {
    const { data: mobileAccount } = await supabase
      .from('chart_of_accounts')
      .select('id, code, name')
      .eq('code', 'ASS-MOB')
      .eq('is_active', true)
      .maybeSingle()

    if (mobileAccount) {
      console.log('✅ Found chart account (ASS-MOB):', mobileAccount.id, mobileAccount.name)
      return mobileAccount.id
    }
  }

  // ✅ Try 4: Create ASS-CASH if missing
  console.log('⚠️ No chart account found, creating ASS-CASH...')
  
  const { data: newAccount, error: createError } = await supabase
    .from('chart_of_accounts')
    .insert({
      code: 'ASS-CASH',
      name: 'Cash',
      account_type: 'asset',
      is_active: true
    })
    .select('id, code, name')
    .maybeSingle()

  if (newAccount) {
    console.log('✅ Created new chart account (ASS-CASH):', newAccount.id)
    return newAccount.id
  }

  if (createError) {
    console.error('❌ Failed to create chart account:', createError)
  }

  // ✅ Try 5: Any asset account (final fallback)
  console.log('⚠️ Looking for any asset account...')
  
  const { data: anyAccount } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('account_type', 'asset')
    .eq('is_active', true)
    .maybeSingle()

  if (anyAccount) {
    console.log('✅ Found fallback asset account:', anyAccount.id, anyAccount.code)
    return anyAccount.id
  }

  // ❌ No account found
  console.error('❌ No financial account found in chart_of_accounts!')
  console.error('Please create ASS-CASH in chart_of_accounts table.')
  return null
}

// ============================================
// Generate voucher number
// ============================================
function generateVoucherNumber(type: string): string {
  const prefix = type === 'receipt' ? 'RC' : type === 'payment' ? 'PY' : 'JN'
  const date = new Date().toISOString().slice(2, 10).replace(/-/g, '')
  const random = Math.floor(Math.random() * 10000)
  return `${prefix}-${date}-${random}`
}

// ============================================
// POST: Handle Integration Requests
// ============================================
export async function POST(request: Request) {
  console.log('📩 Finance Integration API called at:', new Date().toISOString())
  
  try {
    const body = await request.json()
    console.log('📦 Request body:', JSON.stringify(body, null, 2))
    
    const { type, amount, paymentMethod, paymentId, referenceId, studentId, staffId } = body

    // Determine the integration type
    if (type === 'fee_payment') {
      console.log('🏷️ Processing FEE PAYMENT integration')
      return await createFeePaymentVoucher(
        supabaseAdmin,
        amount,
        paymentMethod,
        paymentId,
        studentId
      )
    } else if (type === 'salary_payment') {
      console.log('🏷️ Processing SALARY PAYMENT integration')
      return await createSalaryPaymentVoucher(
        supabaseAdmin,
        amount,
        paymentMethod,
        paymentId,
        staffId
      )
    } else {
      console.warn('⚠️ Invalid integration type:', type)
      return NextResponse.json({ success: false, error: 'Invalid integration type' }, { status: 400 })
    }
  } catch (error: any) {
    console.error('❌ Integration error:', error)
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 })
  }
}

// ============================================
// FEES TO FINANCE: Receipt Voucher Creation
// ============================================
async function createFeePaymentVoucher(
  supabase: any,
  amount: number,
  paymentMethod: string,
  paymentId: string,
  studentId: string
): Promise<Response> {
  console.log('💰 createFeePaymentVoucher called:', { amount, paymentMethod, paymentId, studentId })
  
  try {
    // Get accounts
    const feeAccountId = await getFeeIncomeAccount(supabase)
    const chartAccountId = await getDefaultBankAccount(supabase, paymentMethod)
    const financialAccountId = await getDefaultFinancialAccount(supabase, paymentMethod)

    console.log('📊 Accounts found:', { feeAccountId, chartAccountId, financialAccountId })

    if (!feeAccountId || !chartAccountId) {
      console.warn('⚠️ Account configuration missing, skipping finance integration for fee payment')
      return NextResponse.json({ success: true, financeIntegrated: false, message: 'Accounts not configured' })
    }

    // Check if voucher already exists for this payment
    const { data: existingVoucher } = await supabase
      .from('vouchers')
      .select('id')
      .eq('reference_no', `FEES-${paymentId}`)
      .maybeSingle()

    if (existingVoucher) {
      console.log('✅ Voucher already exists:', existingVoucher.id)
      return NextResponse.json({ success: true, financeIntegrated: true, voucherId: existingVoucher.id })
    }

    // Create voucher (using financial_accounts.id for financial_account_id)
    const voucherNo = generateVoucherNumber('receipt')
    console.log('📝 Creating voucher:', voucherNo)
    
    const { data: voucher, error: voucherError } = await supabase
      .from('vouchers')
      .insert({
        voucher_no: voucherNo,
        voucher_type: 'receipt',
        voucher_date: new Date().toISOString().split('T')[0],
        total_amount: amount,
        paid_to_received_from: `Fee Payment - ${studentId}`,
        financial_account_id: financialAccountId || null,
        narration: 'Fee payment received',
        reference_no: `FEES-${paymentId}`
      })
      .select('id')
      .single()

    if (voucherError) {
      console.error('❌ Voucher creation error:', voucherError)
      throw voucherError
    }

    console.log('✅ Voucher created:', voucher.id)

    // Create Journal Entries (using chart_of_accounts.id for account_id)
    // Entry 1: Debit Cash/Bank (using chart_of_accounts ID)
    const { error: debitError } = await supabase.from('journal_entries').insert({
      voucher_id: voucher.id,
      account_id: chartAccountId,
      debit: amount,
      credit: 0,
      description: 'Cash/Bank received from fee payment'
    })

    if (debitError) {
      console.error('❌ Debit entry error:', debitError)
      throw debitError
    }

    // Entry 2: Credit Fees Income (Revenue)
    const { error: creditError } = await supabase.from('journal_entries').insert({
      voucher_id: voucher.id,
      account_id: feeAccountId,
      debit: 0,
      credit: amount,
      description: 'Student fees income'
    })

    if (creditError) {
      console.error('❌ Credit entry error:', creditError)
      throw creditError
    }

    console.log('✅ Journal entries created for voucher:', voucher.id)

    // ✅ Also create finance_transaction for dashboard (using financial_accounts.id)
    try {
      const { error: financeError } = await supabase.from('finance_transactions').insert({
        type: 'income',
        head_id: feeAccountId,
        account_id: financialAccountId || chartAccountId,
        amount: amount,
        date: new Date().toISOString().split('T')[0],
        description: `Fee payment from student ${studentId}`,
        payment_mode: paymentMethod,
        reference: `fee_payment_${paymentId}`,
        source_type: 'fee_payment',
        source_id: paymentId
      })

      if (financeError) {
        console.error('⚠️ Finance transaction creation error:', financeError)
        // Don't fail the whole operation
      } else {
        console.log('✅ Finance transaction created for dashboard')
      }
    } catch (financeError) {
      console.error('⚠️ Finance transaction error:', financeError)
    }

    return NextResponse.json({
      success: true,
      financeIntegrated: true,
      voucherId: voucher.id,
      voucherNumber: voucherNo
    })

  } catch (error) {
    console.error('❌ Fee payment finance integration error:', error)
    return NextResponse.json({
      success: true,
      financeIntegrated: false,
      message: 'Finance integration failed, payment processed successfully'
    })
  }
}

// ============================================
// SALARY TO FINANCE: Payment Voucher Creation
// ============================================
async function createSalaryPaymentVoucher(
  supabase: any,
  amount: number,
  paymentMethod: string,
  paymentId: string,
  staffId: string
): Promise<Response> {
  console.log('💰 createSalaryPaymentVoucher called:', { amount, paymentMethod, paymentId, staffId })
  
  try {
    // Get accounts
    const salaryAccountId = await getSalaryExpenseAccount(supabase)
    const chartAccountId = await getDefaultBankAccount(supabase, paymentMethod)
    const financialAccountId = await getDefaultFinancialAccount(supabase, paymentMethod)

    console.log('📊 Accounts found:', { salaryAccountId, chartAccountId, financialAccountId })

    if (!salaryAccountId || !chartAccountId) {
      console.warn('⚠️ Account configuration missing, skipping finance integration for salary payment')
      return NextResponse.json({ success: true, financeIntegrated: false, message: 'Accounts not configured' })
    }

    // Check if voucher already exists for this payment
    const { data: existingVoucher } = await supabase
      .from('vouchers')
      .select('id')
      .eq('reference_no', `SAL-${paymentId}`)
      .maybeSingle()

    if (existingVoucher) {
      console.log('✅ Voucher already exists:', existingVoucher.id)
      return NextResponse.json({ success: true, financeIntegrated: true, voucherId: existingVoucher.id })
    }

    // Create voucher (using financial_accounts.id for financial_account_id)
    const voucherNo = generateVoucherNumber('payment')
    console.log('📝 Creating voucher:', voucherNo)
    
    const { data: voucher, error: voucherError } = await supabase
      .from('vouchers')
      .insert({
        voucher_no: voucherNo,
        voucher_type: 'payment',
        voucher_date: new Date().toISOString().split('T')[0],
        total_amount: amount,
        paid_to_received_from: 'Staff Salary Payment',
        financial_account_id: financialAccountId || null,
        narration: 'Salary payment to staff',
        reference_no: `SAL-${paymentId}`
      })
      .select('id')
      .single()

    if (voucherError) {
      console.error('❌ Voucher creation error:', voucherError)
      throw voucherError
    }

    console.log('✅ Voucher created:', voucher.id)

    // Create Journal Entries (using chart_of_accounts.id for account_id)
    // Entry 1: Credit Staff Salaries Expense
    const { error: creditError } = await supabase.from('journal_entries').insert({
      voucher_id: voucher.id,
      account_id: salaryAccountId,
      debit: 0,
      credit: amount,
      description: 'Staff salary expense'
    })

    if (creditError) {
      console.error('❌ Credit entry error:', creditError)
      throw creditError
    }

    // Entry 2: Debit Cash/Bank (money going out)
    const { error: debitError } = await supabase.from('journal_entries').insert({
      voucher_id: voucher.id,
      account_id: chartAccountId,
      debit: amount,
      credit: 0,
      description: 'Cash/Bank paid for salary'
    })

    if (debitError) {
      console.error('❌ Debit entry error:', debitError)
      throw debitError
    }

    console.log('✅ Journal entries created for voucher:', voucher.id)

    // ✅ Also create finance_transaction for dashboard (using financial_accounts.id)
    try {
      const { error: financeError } = await supabase.from('finance_transactions').insert({
        type: 'expense',
        head_id: salaryAccountId,
        account_id: financialAccountId || chartAccountId,
        amount: amount,
        date: new Date().toISOString().split('T')[0],
        description: `Salary payment to staff ${staffId}`,
        payment_mode: paymentMethod,
        reference: `salary_payment_${paymentId}`,
        source_type: 'salary_payment',
        source_id: paymentId
      })

      if (financeError) {
        console.error('⚠️ Finance transaction creation error:', financeError)
      } else {
        console.log('✅ Finance transaction created for dashboard')
      }
    } catch (financeError) {
      console.error('⚠️ Finance transaction error:', financeError)
    }

    return NextResponse.json({
      success: true,
      financeIntegrated: true,
      voucherId: voucher.id,
      voucherNumber: voucherNo
    })

  } catch (error) {
    console.error('❌ Salary payment finance integration error:', error)
    return NextResponse.json({
      success: true,
      financeIntegrated: false,
      message: 'Finance integration failed, payment processed successfully'
    })
  }
}

// ============================================
// UTILITY: Initialize Default Accounts
// ============================================
export async function GET() {
  console.log('🔧 GET: Initializing default accounts...')
  
  const defaultChartAccounts = [
    { code: 'ASS-CASH', name: 'Cash', account_type: 'asset' },
    { code: 'ASS-BANK', name: 'Bank', account_type: 'asset' },
    { code: 'ASS-MOB', name: 'Mobile Banking', account_type: 'asset' },
    { code: 'REV-FEE', name: 'Student Fees', account_type: 'revenue' },
    { code: 'EXP-SAL', name: 'Staff Salaries', account_type: 'expense' },
    { code: 'EXP-UTIL', name: 'Utilities', account_type: 'expense' },
    { code: 'EXP-STORE', name: 'Store Expenses', account_type: 'expense' },
    { code: 'LIAB-PAY', name: 'Payables', account_type: 'liability' },
    { code: 'EQU-CAP', name: 'Capital', account_type: 'equity' },
  ]

  const defaultFinancialAccounts = [
    { account_name: 'Cash', account_number: 'CASH-001', type: 'cash' },
    { account_name: 'Bank', account_number: 'BANK-001', type: 'bank' },
    { account_name: 'Mobile Banking', account_number: 'MOB-001', type: 'mobile_bank' },
  ]

  const created = []
  for (const acc of defaultChartAccounts) {
    const { data, error } = await supabaseAdmin
      .from('chart_of_accounts')
      .upsert(acc, { onConflict: 'code' })
      .select('id, code')
      .single()

    if (!error && data) {
      created.push({ code: data.code, id: data.id })
    }
  }

  const createdFinancial = []
  for (const acc of defaultFinancialAccounts) {
    const { data, error } = await supabaseAdmin
      .from('financial_accounts')
      .upsert(acc, { onConflict: 'account_number' })
      .select('id, account_name, type')
      .single()

    if (!error && data) {
      createdFinancial.push({ name: data.account_name, type: data.type, id: data.id })
    }
  }

  console.log('✅ Default chart accounts initialized:', created.length)
  console.log('✅ Default financial accounts initialized:', createdFinancial.length)

  return NextResponse.json({
    success: true,
    message: 'Default accounts initialized',
    accounts: created,
    financialAccounts: createdFinancial
  })
}