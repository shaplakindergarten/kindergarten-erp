// src/app/finance/reports/page.tsx
"use client"

import { Suspense, useState, useEffect, useMemo, useCallback } from "react"
import Link from "next/link"
import { 
   ArrowLeft,
   Download,
   Loader2,
   Calendar,
   BarChart3,
   FileBarChart,
   Printer,
   TrendingUp,
   PieChart,
   DollarSign,
   Wallet
 } from "lucide-react"
 import { Button } from "@/components/ui/button"
 import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
 import { Badge } from "@/components/ui/badge"
 import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
 import { formatCurrency, cn } from "@/lib/utils"
 import { createClient } from "@/lib/supabase/client"
 import { format } from "date-fns"
 import { ResponsiveLayout } from "@/components/layout/responsive-layout"
 import { useSearchParams } from "next/navigation"
 import { toast } from "sonner"

const supabase = createClient()

interface SchoolSettings {
  school_name: string | null
  school_address: string | null
  school_phone: string | null
  school_logo: string | null
}

type ReportType = 'cashbook' | 'general-ledger' | 'trial-balance' | 'income-statement' | 'balance-sheet' | 'source-wise'

type ReportConfig = {
  title: string
  icon: React.ElementType
  description: string
  color: string
  path: string
}

const reportConfig: Record<ReportType, ReportConfig> = {
  'cashbook': {
    title: 'Cashbook',
    icon: Wallet,
    description: 'Cash and bank transactions',
    color: 'text-emerald-500',
    path: '/finance/reports/cashbook'
  },
  'general-ledger': {
    title: 'General Ledger',
    icon: BarChart3,
    description: 'Detailed account transactions',
    color: 'text-blue-500',
    path: '/finance/reports/general-ledger'
  },
  'trial-balance': {
    title: 'Trial Balance',
    icon: FileBarChart,
    description: 'Account balances summary',
    color: 'text-purple-500',
    path: '/finance/reports/trial-balance'
  },
  'income-statement': {
    title: 'Income Statement',
    icon: TrendingUp,
    description: 'Revenue and expense summary (P&L)',
    color: 'text-emerald-500',
    path: '/finance/reports/income-statement'
  },
  'balance-sheet': {
    title: 'Balance Sheet',
    icon: DollarSign,
    description: 'Assets, liabilities, and equity',
    color: 'text-indigo-500',
    path: '/finance/reports/balance-sheet'
  },
  'source-wise': {
    title: 'Source-wise Report',
    icon: PieChart,
    description: 'Income by source',
    color: 'text-amber-500',
    path: '/finance/reports/source-wise'
  }
}

const periodOptions = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'year', label: 'This Year' },
  { value: 'custom', label: 'Custom Range' },
]

function ReportsContent() {
  const searchParams = useSearchParams()
  const initialTypeParam = searchParams.get('type')
  const initialType = (initialTypeParam && initialTypeParam in reportConfig) ? (initialTypeParam as ReportType) : 'cashbook'
  
  const [schoolInfo, setSchoolInfo] = useState<SchoolSettings | null>(null)
  const [activeReport, setActiveReport] = useState<ReportType>(initialType)
  const [selectedPeriod, setSelectedPeriod] = useState('month')
  const [customDate, setCustomDate] = useState<{ start: string; end: string } | null>(null)
  const [reportData, setReportData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [summary, setSummary] = useState<any>({})
  const [periodLabel, setPeriodLabel] = useState('')

  useEffect(() => {
    loadSchoolInfo()
  }, [])

  useEffect(() => {
    const dates = getPeriodDates()
    setPeriodLabel(`${format(dates.start, 'PP')} - ${format(dates.end, 'PP')}`)
    loadReport()
  }, [activeReport, selectedPeriod, customDate])

  const loadSchoolInfo = async () => {
    try {
      const { data } = await supabase.from('school_settings').select('school_name, school_address, school_phone, school_logo').limit(1).maybeSingle()
      if (data) setSchoolInfo(data)
    } catch (error) {
      console.error('Error loading school info:', error)
    }
  }

  useEffect(() => {
    loadReport()
  }, [activeReport, selectedPeriod])

  const getPeriodDates = () => {
    const today = new Date()
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    const startOfYear = new Date(today.getFullYear(), 0, 1)
    const startOfQuarter = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1)
    
    if (customDate) {
      return { start: new Date(customDate.start), end: new Date(customDate.end) }
    }

    switch (selectedPeriod) {
      case 'today':
        return { start: today, end: today }
      case 'week':
        const startOfWeek = new Date(today)
        startOfWeek.setDate(today.getDate() - 7)
        return { start: startOfWeek, end: today }
      case 'month':
        return { start: startOfMonth, end: today }
      case 'quarter':
        return { start: startOfQuarter, end: today }
      case 'year':
        return { start: startOfYear, end: today }
      default:
        return { start: startOfMonth, end: today }
    }
  }

  // ✅ Export to CSV
  const handleExport = async () => {
    setExporting(true)
    try {
      const dates = getPeriodDates()
      
      const { data, error } = await supabase
        .from('finance_transactions')
        .select('*')
        .gte('date', format(dates.start, 'yyyy-MM-dd'))
        .lte('date', format(dates.end, 'yyyy-MM-dd'))

      if (error) throw error

      if (!data || data.length === 0) {
        toast.error('No data to export')
        return
      }

      const headers = ['Date', 'Type', 'Amount', 'Description', 'Payment Mode', 'Reference', 'Source']
      const rows = data.map(t => [
        t.date,
        t.type,
        t.amount,
        t.description || '',
        t.payment_mode || '',
        t.reference || '',
        t.source_type || ''
      ])

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `finance_report_${format(new Date(), 'yyyy-MM-dd')}.csv`
      a.click()
      window.URL.revokeObjectURL(url)

      toast.success('Export successful')
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Failed to export data')
    } finally {
      setExporting(false)
    }
  }

  const loadReport = async () => {
    setLoading(true)
    try {
      const dates = getPeriodDates()
      
      if (activeReport === 'cashbook') {
        await loadCashbook(dates)
      } else if (activeReport === 'general-ledger') {
        await loadGeneralLedger(dates)
      } else if (activeReport === 'trial-balance') {
        await loadTrialBalance()
      } else if (activeReport === 'income-statement') {
        await loadIncomeStatement(dates)
      } else if (activeReport === 'balance-sheet') {
        await loadBalanceSheet()
      } else if (activeReport === 'source-wise') {
        await loadSourceWise(dates)
      }
    } catch (error) {
      console.error('Error loading report:', error)
    } finally {
      setLoading(false)
    }
  }

  // Existing load functions (cashbook, general-ledger, trial-balance)
  const loadCashbook = async (dates: { start: Date; end: Date }) => {
    const { data, error } = await supabase
      .from('vouchers')
      .select('*')
      .gte('voucher_date', format(dates.start, 'yyyy-MM-dd'))
      .lte('voucher_date', format(dates.end, 'yyyy-MM-dd'))
      .order('voucher_date', { ascending: false })

    if (error) throw error
    
    const cashbookEntries = (data || []).map(v => ({
      date: v.voucher_date,
      voucher_no: v.voucher_no,
      type: v.voucher_type,
      narration: v.paid_to_received_from,
      debit: v.voucher_type === 'receipt' ? v.total_amount : 0,
      credit: v.voucher_type === 'payment' ? v.total_amount : 0,
      balance: 0,
    }))

    let runningBalance = 0
    cashbookEntries.forEach(e => {
      runningBalance += Number(e.debit) - Number(e.credit)
      e.balance = runningBalance
    })

    setReportData(cashbookEntries)
  }

  const loadGeneralLedger = async (dates: { start: Date; end: Date }) => {
    const { data: entriesData, error: entriesError } = await supabase
      .from('journal_entries')
      .select('*')
      .order('created_at', { ascending: false })

    if (entriesError) throw entriesError

    const voucherIds = [...new Set((entriesData || []).map(e => e.voucher_id).filter(Boolean))]
    const accountIds = [...new Set((entriesData || []).map(e => e.account_id).filter(Boolean))]

    const { data: vouchersData } = await supabase
      .from('vouchers')
      .select('id, voucher_no, voucher_date, paid_to_received_from')
      .in('id', voucherIds)

    const { data: chartData } = await supabase
      .from('chart_of_accounts')
      .select('id, code, name, account_type')
      .in('id', accountIds)

    const voucherMap = new Map((vouchersData || []).map(v => [v.id, v]))
    const accountMap = new Map((chartData || []).map(a => [a.id, a]))

    const transformedData = (entriesData || []).map(entry => ({
      ...entry,
      voucher: voucherMap.get(entry.voucher_id || '') || null,
      account: accountMap.get(entry.account_id || '') || null
    }))

    setReportData(transformedData)
  }

  const loadTrialBalance = async () => {
    const { data: accountsData, error: accountsError } = await supabase
      .from('chart_of_accounts')
      .select('*')
      .eq('is_active', true)

    const { data: entriesData, error: entriesError } = await supabase
      .from('journal_entries')
      .select('account_id, debit, credit')

    if (accountsError || entriesError) throw accountsError || entriesError

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

    const trialBalance = (accountsData || []).map((account: any) => {
      const balance = accountBalances[account.id] || { debit: 0, credit: 0 }
      const balanceAmount = balance.debit - balance.credit
      const balanceType = Math.abs(balanceAmount) >= 0.01 
        ? (balanceAmount > 0 ? 'debit' : 'credit')
        : 'zero'

      return {
        code: account.code,
        name: account.name,
        debit: balance.debit,
        credit: balance.credit,
        balance: Math.abs(balanceAmount),
        balance_type: balanceType,
      }
    })

    setReportData(trialBalance)
  }

  // ✅ NEW: Income Statement (P&L)
  const loadIncomeStatement = async (dates: { start: Date; end: Date }) => {
    const { data, error } = await supabase
      .from('finance_transactions')
      .select('*')
      .gte('date', format(dates.start, 'yyyy-MM-dd'))
      .lte('date', format(dates.end, 'yyyy-MM-dd'))

    if (error) throw error

    const income = data?.filter(t => t.type === 'income') || []
    const expenses = data?.filter(t => t.type === 'expense') || []

    const totalIncome = income.reduce((sum, t) => sum + Number(t.amount), 0)
    const totalExpense = expenses.reduce((sum, t) => sum + Number(t.amount), 0)
    const netProfit = totalIncome - totalExpense

    // Group by head
    const incomeByHead: Record<string, { head_name: string; total: number; count: number }> = {}
    for (const t of income) {
      const key = t.head_id || 'unknown'
      if (!incomeByHead[key]) {
        incomeByHead[key] = { head_name: t.description || 'Other Income', total: 0, count: 0 }
      }
      incomeByHead[key].total += Number(t.amount)
      incomeByHead[key].count += 1
    }

    const expenseByHead: Record<string, { head_name: string; total: number; count: number }> = {}
    for (const t of expenses) {
      const key = t.head_id || 'unknown'
      if (!expenseByHead[key]) {
        expenseByHead[key] = { head_name: t.description || 'Other Expense', total: 0, count: 0 }
      }
      expenseByHead[key].total += Number(t.amount)
      expenseByHead[key].count += 1
    }

    setSummary({
      totalIncome,
      totalExpense,
      netProfit,
      incomeCount: income.length,
      expenseCount: expenses.length
    })

    setReportData([
      ...Object.values(incomeByHead).map(item => ({
        ...item,
        type: 'income'
      })),
      ...Object.values(expenseByHead).map(item => ({
        ...item,
        type: 'expense'
      }))
    ])
  }

  // ✅ NEW: Balance Sheet
  const loadBalanceSheet = async () => {
    const { data: accountsData, error: accountsError } = await supabase
      .from('chart_of_accounts')
      .select('*')
      .eq('is_active', true)

    const { data: entriesData, error: entriesError } = await supabase
      .from('journal_entries')
      .select('account_id, debit, credit')

    if (accountsError || entriesError) throw accountsError || entriesError

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
        type: balanceAmount > 0 ? 'debit' : 'credit',
        account_type: account.account_type
      }

      if (account.account_type === 'asset') {
        assets.push(item)
      } else if (account.account_type === 'liability') {
        liabilities.push(item)
      } else if (account.account_type === 'equity') {
        equity.push(item)
      }
    })

    const totalAssets = assets.reduce((sum, a) => sum + a.balance, 0)
    const totalLiabilities = liabilities.reduce((sum, a) => sum + a.balance, 0)
    const totalEquity = equity.reduce((sum, a) => sum + a.balance, 0)

    setSummary({
      totalAssets,
      totalLiabilities,
      totalEquity,
      difference: totalAssets - (totalLiabilities + totalEquity)
    })

    setReportData([...assets, ...liabilities, ...equity])
  }

  // ✅ NEW: Source-wise Report
  const loadSourceWise = async (dates: { start: Date; end: Date }) => {
    const { data, error } = await supabase
      .from('finance_transactions')
      .select('*')
      .gte('date', format(dates.start, 'yyyy-MM-dd'))
      .lte('date', format(dates.end, 'yyyy-MM-dd'))

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

    const totalIncome = formattedData.reduce((sum, d) => sum + d.income, 0)
    const totalExpense = formattedData.reduce((sum, d) => sum + d.expense, 0)

    setSummary({
      totalIncome,
      totalExpense,
      netProfit: totalIncome - totalExpense,
      totalSources: formattedData.length
    })

    setReportData(formattedData)
  }

  const currentReport = reportConfig[activeReport] || reportConfig['cashbook']
  const CurrentIcon = currentReport.icon

  return (
    <ResponsiveLayout>
      <div className="space-y-6 p-4 md:p-6">
        <style jsx global>{`
          @media print {
            .print-header { display: block !important; }
            .no-print { display: none !important; }
            .print-section { 
              position: absolute; top: 0; left: 0; width: 100%; 
              background: white; color: black; font-family: Arial, sans-serif;
            }
          }
        `}</style>
        <div className="print-header hidden print:block">
          <div className="flex items-center justify-between border-b pb-4 mb-4">
            <div className="flex items-center gap-4">
              {schoolInfo?.school_logo && (
                <img src={schoolInfo.school_logo} alt="School Logo" className="h-20 w-20 object-contain" />
              )}
              <div className="text-center flex-1">
                <h2 className="text-lg font-bold">{schoolInfo?.school_name || 'Shapla Kindergarten & Pre-cadet'}</h2>
                <p className="text-sm text-gray-600">{schoolInfo?.school_address || 'Nowtala, Madhaiya Bazar, Chandina, Cumilla'}</p>
                <p className="text-sm text-gray-600">Phone: {schoolInfo?.school_phone || '01923253454'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/finance">
              <Button variant="ghost" size="sm" className="no-print">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold font-heading">Financial Reports</h1>
              <p className="text-muted-foreground">Comprehensive financial analysis</p>
            </div>
          </div>
          <div className="flex gap-2 no-print">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
              <Download className="h-4 w-4 mr-2" />
              {exporting ? 'Exporting...' : 'Export CSV'}
            </Button>
          </div>
        </div>

        {/* Report Type Selector - clickable cards linking to dedicated pages */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 no-print">
          {Object.entries(reportConfig).map(([type, config]) => {
            const Icon = config.icon
            return (
              <Link key={type} href={config.path} className="block">
                <button
                  type="button"
                  className={cn(
                    "w-full p-4 rounded-xl border text-center transition-all hover:scale-105",
                    activeReport === type 
                      ? "border-primary bg-primary/5 dark:bg-primary/10 shadow-md" 
                      : "border-border hover:border-primary/50 hover:bg-muted/30"
                  )}
                >
                  <Icon className={cn("h-6 w-6 mx-auto mb-2", config.color)} />
                  <div className="text-sm font-medium">{config.title}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">{config.description}</div>
                </button>
              </Link>
            )
          })}
        </div>

        {/* Period Selector */}
        <div className="flex flex-wrap gap-4 items-center no-print">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-full sm:w-44">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Select Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">This Quarter</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>

          {selectedPeriod === 'custom' && (
            <div className="flex gap-2 items-center">
              <input
                type="date"
                value={customDate?.start || ''}
                onChange={e => setCustomDate({ start: e.target.value, end: customDate?.end || '' })}
                className="px-3 py-2 border rounded-md bg-background text-sm"
              />
              <span className="text-muted-foreground">to</span>
              <input
                type="date"
                value={customDate?.end || ''}
                onChange={e => setCustomDate({ start: customDate?.start || '', end: e.target.value })}
                className="px-3 py-2 border rounded-md bg-background text-sm"
              />
            </div>
          )}
        </div>

        {/* Report Content */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CurrentIcon className={cn("h-5 w-5", currentReport.color)} />
              {currentReport.title}
            </CardTitle>
            <CardDescription>
              Period: {periodOptions.find(p => p.value === selectedPeriod)?.label || 'Month'} (<span suppressHydrationWarning>{periodLabel}</span>)
              {summary.totalIncome !== undefined && (
                <span className="ml-4">
                  Total Income: <span className="text-emerald-500 font-medium">{formatCurrency(summary.totalIncome)}</span>
                  {' | '}
                  Total Expense: <span className="text-rose-500 font-medium">{formatCurrency(summary.totalExpense)}</span>
                  {' | '}
                  Net: <span className={summary.netProfit >= 0 ? "text-emerald-500" : "text-rose-500"}>
                    {formatCurrency(summary.netProfit || 0)}
                  </span>
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                {activeReport === 'income-statement' && (
                  <div className="space-y-6">
                    {/* Income Section */}
                    <div>
                      <h3 className="font-semibold text-emerald-500 mb-2">📈 Income</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Head</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead className="text-right">Transactions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reportData.filter(d => d.type === 'income').map((row, i) => (
                            <TableRow key={i}>
                              <TableCell>{row.head_name}</TableCell>
                              <TableCell className="text-right text-emerald-500">{formatCurrency(row.total)}</TableCell>
                              <TableCell className="text-right">{row.count}</TableCell>
                            </TableRow>
                          ))}
                          {reportData.filter(d => d.type === 'income').length === 0 && (
                            <TableRow>
                              <TableCell colSpan={3} className="text-center text-muted-foreground">No income records</TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                      {summary.totalIncome !== undefined && (
                        <div className="text-right mt-2 font-medium">
                          Total Income: <span className="text-emerald-500">{formatCurrency(summary.totalIncome)}</span>
                        </div>
                      )}
                    </div>

                    {/* Expense Section */}
                    <div>
                      <h3 className="font-semibold text-rose-500 mb-2">📉 Expense</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Head</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead className="text-right">Transactions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reportData.filter(d => d.type === 'expense').map((row, i) => (
                            <TableRow key={i}>
                              <TableCell>{row.head_name}</TableCell>
                              <TableCell className="text-right text-rose-500">{formatCurrency(row.total)}</TableCell>
                              <TableCell className="text-right">{row.count}</TableCell>
                            </TableRow>
                          ))}
                          {reportData.filter(d => d.type === 'expense').length === 0 && (
                            <TableRow>
                              <TableCell colSpan={3} className="text-center text-muted-foreground">No expense records</TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                      {summary.totalExpense !== undefined && (
                        <div className="text-right mt-2 font-medium">
                          Total Expense: <span className="text-rose-500">{formatCurrency(summary.totalExpense)}</span>
                        </div>
                      )}
                    </div>

                    {/* Net Profit */}
                    {summary.netProfit !== undefined && (
                      <div className="border-t pt-4">
                        <div className="flex justify-between text-lg font-bold">
                          <span>Net Profit / Loss</span>
                          <span className={summary.netProfit >= 0 ? "text-emerald-500" : "text-rose-500"}>
                            {formatCurrency(summary.netProfit)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeReport === 'balance-sheet' && (
                  <div className="space-y-6">
                    {/* Assets */}
                    <div>
                      <h3 className="font-semibold text-blue-500 mb-2">🏦 Assets</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Code</TableHead>
                            <TableHead>Account</TableHead>
                            <TableHead className="text-right">Balance</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reportData.filter(d => d.type === 'debit').map((row, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-mono">{row.code}</TableCell>
                              <TableCell>{row.name}</TableCell>
                              <TableCell className="text-right font-medium">{formatCurrency(row.balance)}</TableCell>
                            </TableRow>
                          ))}
                          {reportData.filter(d => d.type === 'debit').length === 0 && (
                            <TableRow>
                              <TableCell colSpan={3} className="text-center text-muted-foreground">No assets found</TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                      {summary.totalAssets !== undefined && (
                        <div className="text-right mt-2 font-bold">
                          Total Assets: <span className="text-blue-500">{formatCurrency(summary.totalAssets)}</span>
                        </div>
                      )}
                    </div>

                    {/* Liabilities & Equity */}
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <h3 className="font-semibold text-amber-500 mb-2">📋 Liabilities</h3>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Account</TableHead>
                              <TableHead className="text-right">Balance</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {reportData.filter(d => d.type === 'credit').map((row, i) => (
                              <TableRow key={i}>
                                <TableCell>{row.name}</TableCell>
                                <TableCell className="text-right font-medium">{formatCurrency(row.balance)}</TableCell>
                              </TableRow>
                            ))}
                            {reportData.filter(d => d.type === 'credit').length === 0 && (
                              <TableRow>
                                <TableCell colSpan={2} className="text-center text-muted-foreground">No liabilities</TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                        {summary.totalLiabilities !== undefined && (
                          <div className="text-right mt-2 font-medium">
                            Total: {formatCurrency(summary.totalLiabilities)}
                          </div>
                        )}
                      </div>

                      <div>
                        <h3 className="font-semibold text-purple-500 mb-2">💎 Equity</h3>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Account</TableHead>
                              <TableHead className="text-right">Balance</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {reportData.filter(d => d.account_type === 'equity').map((row, i) => (
                              <TableRow key={i}>
                                <TableCell>{row.name}</TableCell>
                                <TableCell className="text-right font-medium">{formatCurrency(row.balance)}</TableCell>
                              </TableRow>
                            ))}
                            {reportData.filter(d => d.account_type === 'equity').length === 0 && (
                              <TableRow>
                                <TableCell colSpan={2} className="text-center text-muted-foreground">No equity</TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                        {summary.totalEquity !== undefined && (
                          <div className="text-right mt-2 font-medium">
                            Total: {formatCurrency(summary.totalEquity)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Balance Check */}
                    {summary.difference !== undefined && (
                      <div className="border-t pt-4">
                        <div className="flex justify-between text-sm">
                          <span>Assets - (Liabilities + Equity)</span>
                          <span className={Math.abs(summary.difference) < 0.01 ? "text-emerald-500 font-bold" : "text-rose-500 font-bold"}>
                            {formatCurrency(summary.difference)}
                            {Math.abs(summary.difference) < 0.01 ? " ✅ Balanced" : " ⚠️ Not Balanced"}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeReport === 'source-wise' && (
                  <div className="space-y-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Source</TableHead>
                          <TableHead className="text-right">Income</TableHead>
                          <TableHead className="text-right">Expense</TableHead>
                          <TableHead className="text-right">Net</TableHead>
                          <TableHead className="text-right">Transactions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reportData.map((row, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{row.source}</TableCell>
                            <TableCell className="text-right text-emerald-500">{formatCurrency(row.income)}</TableCell>
                            <TableCell className="text-right text-rose-500">{formatCurrency(row.expense)}</TableCell>
                            <TableCell className={cn("text-right font-bold", row.net >= 0 ? "text-emerald-500" : "text-rose-500")}>
                              {formatCurrency(row.net)}
                            </TableCell>
                            <TableCell className="text-right">{row.count}</TableCell>
                          </TableRow>
                        ))}
                        {reportData.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground">No data found</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                    {summary.totalSources !== undefined && (
                      <div className="border-t pt-4 flex justify-between text-sm">
                        <span>Total Sources: {summary.totalSources}</span>
                        <span>Net Profit: <span className={summary.netProfit >= 0 ? "text-emerald-500" : "text-rose-500"}>{formatCurrency(summary.netProfit)}</span></span>
                      </div>
                    )}
                  </div>
                )}

                {/* Existing Reports (cashbook, general-ledger, trial-balance) */}
                {activeReport === 'cashbook' && (
                  <div className="space-y-2 overflow-x-auto">
                    <div className="grid grid-cols-6 gap-4 text-sm font-medium text-muted-foreground border-b pb-2 min-w-[600px]">
                      <div>Date</div>
                      <div>Voucher</div>
                      <div>Type</div>
                      <div>Narration</div>
                      <div className="text-right">Debit</div>
                      <div className="text-right">Credit</div>
                    </div>
                    {reportData.length > 0 ? (
                      reportData.map((row: any, i: number) => (
                        <div key={i} className="grid grid-cols-6 gap-4 items-center py-2 border-b border-border/50 min-w-[600px]">
                          <div>{row.date}</div>
                          <div className="font-mono text-sm">{row.voucher_no}</div>
                          <div>
                            <Badge variant="outline" className="text-xs">{row.type}</Badge>
                          </div>
                          <div className="text-sm truncate">{row.narration}</div>
                          <div className="text-right font-mono text-emerald-500">{formatCurrency(row.debit)}</div>
                          <div className="text-right font-mono text-rose-500">{formatCurrency(row.credit)}</div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">No transactions for this period</div>
                    )}
                  </div>
                )}

                {activeReport === 'general-ledger' && (
                  <div className="space-y-2 overflow-x-auto">
                    <div className="grid grid-cols-6 gap-4 text-sm font-medium text-muted-foreground border-b pb-2 min-w-[700px]">
                      <div>Account</div>
                      <div>Voucher</div>
                      <div>Date</div>
                      <div>Description</div>
                      <div className="text-right">Debit</div>
                      <div className="text-right">Credit</div>
                    </div>
                    {reportData.length > 0 ? (
                      reportData.map((row: any, i: number) => (
                        <div key={i} className="grid grid-cols-6 gap-4 items-center py-2 border-b border-border/50 min-w-[700px]">
                          <div className="font-mono text-sm">{row.account?.code}</div>
                          <div className="font-mono text-sm">{row.voucher?.voucher_no}</div>
                          <div>{format(new Date(row.voucher?.voucher_date), 'dd MMM yyyy')}</div>
                          <div className="text-sm truncate">{row.description || row.voucher?.paid_to_received_from}</div>
                          <div className="text-right font-mono text-emerald-500">{formatCurrency(Number(row.debit || 0))}</div>
                          <div className="text-right font-mono text-rose-500">{formatCurrency(Number(row.credit || 0))}</div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">No journal entries for this period</div>
                    )}
                  </div>
                )}

                {activeReport === 'trial-balance' && (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Code</TableHead>
                          <TableHead>Account Name</TableHead>
                          <TableHead className="text-right">Debit</TableHead>
                          <TableHead className="text-right">Credit</TableHead>
                          <TableHead className="text-right">Balance</TableHead>
                          <TableHead>Balance Type</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reportData.length > 0 ? (
                          reportData.map((row: any, i: number) => (
                            <TableRow key={i}>
                              <TableCell className="font-mono">{row.code}</TableCell>
                              <TableCell>{row.name}</TableCell>
                              <TableCell className="text-right font-mono">{formatCurrency(row.debit)}</TableCell>
                              <TableCell className="text-right font-mono">{formatCurrency(row.credit)}</TableCell>
                              <TableCell className="text-right font-mono font-bold">{formatCurrency(row.balance)}</TableCell>
                              <TableCell>
                                <Badge variant={
                                  row.balance_type === 'debit' ? 'default' :
                                  row.balance_type === 'credit' ? 'error' : 'secondary'
                                }>
                                  {row.balance_type}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No accounts found</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ResponsiveLayout>
  )
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ReportsContent />
    </Suspense>
  )
}
