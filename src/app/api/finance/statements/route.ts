// src/app/api/finance/statements/route.ts
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseSecretKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabaseAdmin = createClient(supabaseUrl!, supabaseSecretKey!, {
  auth: { autoRefreshToken: false, persistSession: false }
})

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!type) {
      return NextResponse.json(
        { success: false, error: 'Missing report type' },
        { status: 400 }
      )
    }

    if (type === 'income-statement') {
      return await getIncomeStatement(startDate, endDate)
    } else if (type === 'balance-sheet') {
      return await getBalanceSheet()
    } else if (type === 'source-wise') {
      return await getSourceWise(startDate, endDate)
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid report type' },
        { status: 400 }
      )
    }
  } catch (error: any) {
    console.error('Statement API error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

async function getIncomeStatement(startDate: string | null, endDate: string | null) {
  let query = supabaseAdmin.from('finance_transactions').select('*')
  
  if (startDate) {
    query = query.gte('date', startDate)
  }
  if (endDate) {
    query = query.lte('date', endDate)
  }

  const { data, error } = await query

  if (error) throw error

  const income = data?.filter(t => t.type === 'income') || []
  const expenses = data?.filter(t => t.type === 'expense') || []

  // Group by head
  const incomeMap: Record<string, { head_name: string; total: number; count: number }> = {}
  for (const t of income) {
    const key = t.head_id || 'unknown'
    if (!incomeMap[key]) {
      incomeMap[key] = { head_name: t.description || 'Other Income', total: 0, count: 0 }
    }
    incomeMap[key].total += Number(t.amount)
    incomeMap[key].count += 1
  }

  const expenseMap: Record<string, { head_name: string; total: number; count: number }> = {}
  for (const t of expenses) {
    const key = t.head_id || 'unknown'
    if (!expenseMap[key]) {
      expenseMap[key] = { head_name: t.description || 'Other Expense', total: 0, count: 0 }
    }
    expenseMap[key].total += Number(t.amount)
    expenseMap[key].count += 1
  }

  return NextResponse.json({
    success: true,
    data: {
      income: Object.values(incomeMap),
      expense: Object.values(expenseMap),
      totalIncome: income.reduce((sum, t) => sum + Number(t.amount), 0),
      totalExpense: expenses.reduce((sum, t) => sum + Number(t.amount), 0),
      netProfit: income.reduce((sum, t) => sum + Number(t.amount), 0) - expenses.reduce((sum, t) => sum + Number(t.amount), 0)
    }
  })
}

async function getBalanceSheet() {
  // Get all accounts
  const { data: accountsData, error: accountsError } = await supabaseAdmin
    .from('chart_of_accounts')
    .select('*')
    .eq('is_active', true)

  if (accountsError) throw accountsError

  // Get journal entries
  const { data: entriesData, error: entriesError } = await supabaseAdmin
    .from('journal_entries')
    .select('account_id, debit, credit')

  if (entriesError) throw entriesError

  // Calculate balances
  const accountBalances: Record<string, { debit: number; credit: number }> = {}
  
  ;(accountsData || []).forEach((account: any) => {
    accountBalances[account.id] = { debit: 0, credit: 0 }
  })

  ;(entriesData || []).forEach((entry: any) => {
    if (accountBalances[entry.account_id]) {
      accountBalances[entry.account_id].debit += Number(entry.debit || 0)
      accountBalances[entry.account_id].credit += Number(entry.credit || 0)
    }
  })

  // Group by account type
  const assets: any[] = []
  const liabilities: any[] = []
  const equity: any[] = []

  ;(accountsData || []).forEach((account: any) => {
    const balance = accountBalances[account.id] || { debit: 0, credit: 0 }
    const balanceAmount = balance.debit - balance.credit

    const item = {
      code: account.code,
      name: account.name,
      balance: Math.abs(balanceAmount),
      type: balanceAmount > 0 ? 'debit' : 'credit'
    }

    if (account.account_type === 'asset') {
      assets.push(item)
    } else if (account.account_type === 'liability') {
      liabilities.push(item)
    } else if (account.account_type === 'equity') {
      equity.push(item)
    }
  })

  return NextResponse.json({
    success: true,
    data: {
      assets,
      liabilities,
      equity,
      totalAssets: assets.reduce((sum, a) => sum + a.balance, 0),
      totalLiabilities: liabilities.reduce((sum, a) => sum + a.balance, 0),
      totalEquity: equity.reduce((sum, a) => sum + a.balance, 0)
    }
  })
}

async function getSourceWise(startDate: string | null, endDate: string | null) {
  let query = supabaseAdmin.from('finance_transactions').select('*')
  
  if (startDate) {
    query = query.gte('date', startDate)
  }
  if (endDate) {
    query = query.lte('date', endDate)
  }

  const { data, error } = await query

  if (error) throw error

  // Group by source_type
  const sourceMap: Record<string, { income: number; expense: number; count: number }> = {}

  ;(data || []).forEach((t: any) => {
    const source = t.source_type || 'manual'
    if (!sourceMap[source]) {
      sourceMap[source] = { income: 0, expense: 0, count: 0 }
    }
    sourceMap[source].count += 1
    if (t.type === 'income') {
      sourceMap[source].income += Number(t.amount)
    } else {
      sourceMap[source].expense += Number(t.amount)
    }
  })

  const sourceLabels: Record<string, string> = {
    'fee_payment': 'Student Fees',
    'inventory_purchase': 'Inventory Purchase',
    'inventory_sale': 'Inventory Sale',
    'salary_payment': 'Staff Salary',
    'manual_income': 'Manual Income',
    'manual_expense': 'Manual Expense',
    'manual': 'Manual Entry'
  }

  const formattedData = Object.entries(sourceMap).map(([source, data]) => ({
    source: sourceLabels[source] || source,
    source_type: source,
    income: data.income,
    expense: data.expense,
    net: data.income - data.expense,
    count: data.count
  }))

  return NextResponse.json({
    success: true,
    data: formattedData,
    summary: {
      totalIncome: formattedData.reduce((sum, d) => sum + d.income, 0),
      totalExpense: formattedData.reduce((sum, d) => sum + d.expense, 0),
      netProfit: formattedData.reduce((sum, d) => sum + d.income, 0) - formattedData.reduce((sum, d) => sum + d.expense, 0)
    }
  })
}