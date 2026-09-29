// src/app/finance/reports/income-statement/page.tsx
"use client"

import React, { useState, useEffect, useRef, forwardRef } from "react"
import Link from "next/link"
import { 
  ArrowLeft,
  Download,
  Loader2,
  Printer,
  TrendingUp,
  TrendingDown,
  Calendar,
  FileText,
  ChevronLeft,
  ChevronRight
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatCurrency, cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { format } from "date-fns"
import { ResponsiveLayout } from "@/components/layout/responsive-layout"
import { toast } from "sonner"

const supabase = createClient()

interface SchoolSettings {
  school_name: string | null
  school_address: string | null
  school_phone: string | null
  school_logo: string | null
}

interface IncomeItem {
  head_name: string
  total: number
  count: number
}

interface ExpenseItem {
  head_name: string
  total: number
  count: number
}

interface PeriodComparison {
  income: number
  expense: number
  net: number
}

const periodOptions = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'year', label: 'This Year' },
  { value: 'custom', label: 'Custom Range' },
]

// Print Component - As per Hard Memory Template
const PrintComponent = forwardRef<HTMLDivElement, {
  schoolInfo: SchoolSettings | null,
  incomeData: IncomeItem[],
  expenseData: ExpenseItem[],
  totalIncome: number,
  totalExpense: number,
  netProfit: number,
  periodLabel: string,
  todayLabel: string
}>(({ schoolInfo, incomeData, expenseData, totalIncome, totalExpense, netProfit, periodLabel, todayLabel }, ref) => {
  const schoolName = schoolInfo?.school_name || 'মাদ্রাসাতুল সুনাহ আল মাদানী'
  const schoolAddress = schoolInfo?.school_address || 'Nowtala, Madhaiya Bazar, Chandina, Cumilla'
  const schoolPhone = schoolInfo?.school_phone || '01923253454'
  
  return (
    <div ref={ref} className="print-content" style={{
      padding: '30px 40px',
      fontFamily: 'Arial, sans-serif',
      backgroundColor: 'white',
      color: '#1a1a1a',
      width: '210mm',
      minHeight: '297mm'
    }}>
      {/* HEADER: Logo Left | School Info Right */}
      <div style={{ 
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
        borderBottom: '3px double #1a1a1a',
        paddingBottom: '15px',
        marginBottom: '20px'
      }}>
        {schoolInfo?.school_logo && (
          <img 
            src={schoolInfo.school_logo} 
            alt="School Logo" 
            style={{ height: '70px', width: '70px', objectFit: 'contain', flexShrink: 0 }} 
          />
        )}
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '22px', fontWeight: 'bold', margin: 0, letterSpacing: '1px' }}>
            {schoolName}
          </h1>
          <p style={{ fontSize: '13px', color: '#4a4a4a', margin: '3px 0 0 0' }}>{schoolAddress}</p>
          <p style={{ fontSize: '13px', color: '#4a4a4a', margin: '2px 0 0 0' }}>Phone: {schoolPhone}</p>
        </div>
      </div>

      {/* REPORT TITLE */}
      <div style={{ textAlign: 'center', marginBottom: '15px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '2px', margin: 0 }}>
          Income Statement (Profit & Loss)
        </h2>
      </div>

      {/* PERIOD & GENERATED */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        fontSize: '13px',
        color: '#4a4a4a',
        borderBottom: '1px solid #e0e0e0',
        paddingBottom: '8px'
      }}>
        <span><strong>Period:</strong> {periodLabel}</span>
        <span><strong>Generated:</strong> {todayLabel}</span>
      </div>

      {/* INCOME TABLE */}
      <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#10b981' }}>Income</h3>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        marginBottom: '20px',
        fontSize: '10px'
      }}>
        <thead>
          <tr style={{ backgroundColor: '#1a1a1a', color: 'white' }}>
            <th style={{ padding: '4px 8px', textAlign: 'left', border: '1px solid #333' }}>Head</th>
            <th style={{ padding: '4px 8px', textAlign: 'right', border: '1px solid #333' }}>Amount</th>
            <th style={{ padding: '4px 8px', textAlign: 'right', border: '1px solid #333' }}>Transactions</th>
            <th style={{ padding: '4px 8px', textAlign: 'right', border: '1px solid #333' }}>% of Total</th>
          </tr>
        </thead>
        <tbody>
          {incomeData.map((row, i) => (
            <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#f8fafc' : 'white' }}>
              <td style={{ padding: '3px 8px', border: '1px solid #e0e0e0' }}>{row.head_name}</td>
              <td style={{ padding: '3px 8px', textAlign: 'right', border: '1px solid #e0e0e0', color: '#10b981' }}>
                {formatCurrency(row.total)}
              </td>
              <td style={{ padding: '3px 8px', textAlign: 'right', border: '1px solid #e0e0e0' }}>{row.count}</td>
              <td style={{ padding: '3px 8px', textAlign: 'right', border: '1px solid #e0e0e0' }}>
                {totalIncome > 0 ? ((row.total / totalIncome) * 100).toFixed(1) : 0}%
              </td>
            </tr>
          ))}
          {incomeData.length === 0 && (
            <tr>
              <td colSpan={4} style={{ padding: '3px 8px', textAlign: 'center', border: '1px solid #e0e0e0', color: '#666' }}>
                No income records found
              </td>
            </tr>
          )}
          <tr style={{ backgroundColor: '#1a1a1a', color: 'white', fontWeight: 'bold' }}>
            <td style={{ padding: '4px 8px', border: '1px solid #333' }}>Total Income</td>
            <td style={{ padding: '4px 8px', textAlign: 'right', border: '1px solid #333', color: '#34d399' }}>
              {formatCurrency(totalIncome)}
            </td>
            <td style={{ padding: '4px 8px', textAlign: 'right', border: '1px solid #333' }}>
              {incomeData.reduce((sum, i) => sum + i.count, 0)}
            </td>
            <td style={{ padding: '4px 8px', textAlign: 'right', border: '1px solid #333' }}>100%</td>
          </tr>
        </tbody>
      </table>

      {/* EXPENSE TABLE */}
      <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#ef4444' }}>Expense</h3>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        marginBottom: '20px',
        fontSize: '10px'
      }}>
        <thead>
          <tr style={{ backgroundColor: '#1a1a1a', color: 'white' }}>
            <th style={{ padding: '4px 8px', textAlign: 'left', border: '1px solid #333' }}>Head</th>
            <th style={{ padding: '4px 8px', textAlign: 'right', border: '1px solid #333' }}>Amount</th>
            <th style={{ padding: '4px 8px', textAlign: 'right', border: '1px solid #333' }}>Transactions</th>
            <th style={{ padding: '4px 8px', textAlign: 'right', border: '1px solid #333' }}>% of Total</th>
          </tr>
        </thead>
        <tbody>
          {expenseData.map((row, i) => (
            <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#f8fafc' : 'white' }}>
              <td style={{ padding: '3px 8px', border: '1px solid #e0e0e0' }}>{row.head_name}</td>
              <td style={{ padding: '3px 8px', textAlign: 'right', border: '1px solid #e0e0e0', color: '#ef4444' }}>
                {formatCurrency(row.total)}
              </td>
              <td style={{ padding: '3px 8px', textAlign: 'right', border: '1px solid #e0e0e0' }}>{row.count}</td>
              <td style={{ padding: '3px 8px', textAlign: 'right', border: '1px solid #e0e0e0' }}>
                {totalExpense > 0 ? ((row.total / totalExpense) * 100).toFixed(1) : 0}%
              </td>
            </tr>
          ))}
          {expenseData.length === 0 && (
            <tr>
              <td colSpan={4} style={{ padding: '3px 8px', textAlign: 'center', border: '1px solid #e0e0e0', color: '#666' }}>
                No expense records found
              </td>
            </tr>
          )}
          <tr style={{ backgroundColor: '#1a1a1a', color: 'white', fontWeight: 'bold' }}>
            <td style={{ padding: '4px 8px', border: '1px solid #333' }}>Total Expense</td>
            <td style={{ padding: '4px 8px', textAlign: 'right', border: '1px solid #333', color: '#f87171' }}>
              {formatCurrency(totalExpense)}
            </td>
            <td style={{ padding: '4px 8px', textAlign: 'right', border: '1px solid #333' }}>
              {expenseData.reduce((sum, i) => sum + i.count, 0)}
            </td>
            <td style={{ padding: '4px 8px', textAlign: 'right', border: '1px solid #333' }}>100%</td>
          </tr>
        </tbody>
      </table>

      {/* NET PROFIT SUMMARY */}
      <div style={{
        marginTop: '20px',
        padding: '15px 20px',
        border: '2px solid',
        borderColor: netProfit >= 0 ? '#10b981' : '#ef4444',
        borderRadius: '8px',
        backgroundColor: netProfit >= 0 ? '#f0fdf4' : '#fef2f2',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <p style={{ fontSize: '14px', fontWeight: 'bold', margin: 0 }}>
            Net {netProfit >= 0 ? 'Profit' : 'Loss'}
          </p>
          <p style={{ fontSize: '12px', color: '#666', margin: '2px 0 0 0' }}>
            Total Revenue: {formatCurrency(totalIncome)} | Total Expense: {formatCurrency(totalExpense)}
          </p>
        </div>
        <p style={{ 
          fontSize: '20px', 
          fontWeight: 'bold', 
          margin: 0,
          color: netProfit >= 0 ? '#10b981' : '#ef4444'
        }}>
          {formatCurrency(netProfit)}
        </p>
      </div>

      {/* SIGNATURES */}
      <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '2px solid #e0e0e0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', textAlign: 'center' }}>
          {['Prepared By', 'Verified By', 'Authorized By'].map(label => (
            <div key={label}>
              <div style={{ borderBottom: '1px solid #1a1a1a', paddingBottom: '2px', marginBottom: '5px', minHeight: '30px' }}></div>
              <span style={{ fontSize: '12px', color: '#4a4a4a' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* FOOTER */}
      <div style={{ textAlign: 'center', marginTop: '20px', paddingTop: '10px', borderTop: '1px solid #e0e0e0', fontSize: '11px', color: '#999' }}>
        <span>Powered by {schoolName} | Page 1 of 1</span>
      </div>
    </div>
  )
})

PrintComponent.displayName = 'PrintComponent'

export default function IncomeStatementPage() {
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [schoolInfo, setSchoolInfo] = useState<SchoolSettings | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState('month')
  const [customDate, setCustomDate] = useState<{ start: string; end: string } | null>(null)
  const [incomeData, setIncomeData] = useState<IncomeItem[]>([])
  const [expenseData, setExpenseData] = useState<ExpenseItem[]>([])
  const [summary, setSummary] = useState({
    totalIncome: 0,
    totalExpense: 0,
    netProfit: 0,
    incomeCount: 0,
    expenseCount: 0
  })
  const [previousSummary, setPreviousSummary] = useState<PeriodComparison>({
    income: 0,
    expense: 0,
    net: 0
  })
  const [periodLabel, setPeriodLabel] = useState('')
  const [todayLabel, setTodayLabel] = useState('')
  
  // Pagination states
  const [incomePage, setIncomePage] = useState(1)
  const [expensePage, setExpensePage] = useState(1)
  const [itemsPerPage] = useState(8)
  
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadSchoolInfo()
    const dates = getPeriodDates()
    setPeriodLabel(`${format(dates.start, 'MMM d, yyyy')} - ${format(dates.end, 'MMM d, yyyy')}`)
    setTodayLabel(format(new Date(), 'MMM d, yyyy, h:mm:ss a'))
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeriod, customDate])

  const loadSchoolInfo = async () => {
    try {
      const { data } = await supabase.from('school_settings').select('school_name, school_address, school_phone, school_logo').limit(1).maybeSingle()
      if (data) setSchoolInfo(data)
    } catch (error) {
      console.error('Error loading school info:', error)
    }
  }

  const getPeriodDates = () => {
    const today = new Date()
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    const startOfYear = new Date(today.getFullYear(), 0, 1)
    const startOfQuarter = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1)

    if (customDate?.start && customDate?.end) {
      const start = new Date(customDate.start)
      const end = new Date(customDate.end)
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        return { start, end }
      }
    }

    switch (selectedPeriod) {
      case 'today': return { start: today, end: today }
      case 'week':
        const startOfWeek = new Date(today)
        startOfWeek.setDate(today.getDate() - 7)
        return { start: startOfWeek, end: today }
      case 'month': return { start: startOfMonth, end: today }
      case 'quarter': return { start: startOfQuarter, end: today }
      case 'year': return { start: startOfYear, end: today }
      default: return { start: startOfMonth, end: today }
    }
  }

  const getPreviousPeriodDates = () => {
    const current = getPeriodDates()
    const periodLength = current.end.getTime() - current.start.getTime()
    return {
      start: new Date(current.start.getTime() - periodLength),
      end: new Date(current.start.getTime() - 1)
    }
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const dates = getPeriodDates()
      const startDate = format(dates.start, 'yyyy-MM-dd')
      const endDate = format(dates.end, 'yyyy-MM-dd')

      // 1. Load vouchers in date range
      const { data: voucherRows, error: vErr } = await supabase
        .from('vouchers')
        .select('id')
        .gte('voucher_date', startDate)
        .lte('voucher_date', endDate)

      if (vErr) throw vErr

      const voucherIds = (voucherRows || []).map((v: any) => v.id)

      console.log('📊 Vouchers:', voucherIds.length)

      // 2. Load journal_entries (flat query — no nested join)
      let jeData: any[] = []
      if (voucherIds.length > 0) {
        const { data: jeRows, error: jeErr } = await supabase
          .from('journal_entries')
          .select('debit, credit, account_id, voucher_id')
          .in('voucher_id', voucherIds)

        if (jeErr) throw jeErr
        jeData = jeRows || []
      }

      console.log('📊 Journal entries:', jeData.length)

      // 3. Load financial_accounts metadata (two-step)
      const accountIds = Array.from(
        new Set(jeData.map((je: any) => je.account_id).filter(Boolean))
      )

      const accountMap: Record<string, { account_name: string; account_category: string }> = {}
      if (accountIds.length > 0) {
        const { data: accts, error: acctErr } = await supabase
          .from('financial_accounts')
          .select('id, account_name, account_category')
          .in('id', accountIds)

        if (acctErr) throw acctErr

        for (const a of (accts || [])) {
          accountMap[a.id] = {
            account_name: a.account_name,
            account_category: (a.account_category || '').toLowerCase(),
          }
        }
      }

      console.log('📊 Accounts loaded:', Object.keys(accountMap).length)

      // 4. Merge account metadata into journal rows
      const jeWithAccounts = jeData.map((je: any) => {
        const acct = accountMap[je.account_id]
        return {
          ...je,
          account_name: acct ? acct.account_name : '',
          account_category: acct ? acct.account_category : '',
        }
      })

      // 5. Filter: only revenue + expense accounts
      const revenueRows = jeWithAccounts.filter((je: any) => je.account_category === 'revenue')
      const expenseRows = jeWithAccounts.filter((je: any) => je.account_category === 'expense')

      console.log('📊 Revenue rows:', revenueRows.length)
      console.log('📊 Expense rows:', expenseRows.length)

      // 6. Aggregate income by account (revenue accounts get credit)
      const incomeMap: Record<string, { head_name: string; total: number; count: number }> = {}
      for (const je of revenueRows) {
        const key = je.account_id
        if (!incomeMap[key]) {
          incomeMap[key] = { head_name: je.account_name, total: 0, count: 0 }
        }
        incomeMap[key].total += Number(je.credit) - Number(je.debit)
        incomeMap[key].count += 1
      }

      // 7. Aggregate expense by account (expense accounts get debit)
      const expenseMap: Record<string, { head_name: string; total: number; count: number }> = {}
      for (const je of expenseRows) {
        const key = je.account_id
        if (!expenseMap[key]) {
          expenseMap[key] = { head_name: je.account_name, total: 0, count: 0 }
        }
        expenseMap[key].total += Number(je.debit) - Number(je.credit)
        expenseMap[key].count += 1
      }

      const incomeItems = Object.values(incomeMap).filter(i => i.total > 0)
      const expenseItems = Object.values(expenseMap).filter(e => e.total > 0)

      setIncomeData(incomeItems)
      setExpenseData(expenseItems)
      setIncomePage(1)
      setExpensePage(1)

      const totalIncome = incomeItems.reduce((sum, i) => sum + i.total, 0)
      const totalExpense = expenseItems.reduce((sum, e) => sum + e.total, 0)

      setSummary({
        totalIncome,
        totalExpense,
        netProfit: totalIncome - totalExpense,
        incomeCount: incomeItems.reduce((s, i) => s + i.count, 0),
        expenseCount: expenseItems.reduce((s, e) => s + e.count, 0),
      })

      // 8. Previous period for comparison (two-step pattern)
      const prevDates = getPreviousPeriodDates()
      const prevStartDate = format(prevDates.start, 'yyyy-MM-dd')
      const prevEndDate = format(prevDates.end, 'yyyy-MM-dd')

      const { data: prevVouchers, error: pvErr } = await supabase
        .from('vouchers')
        .select('id')
        .gte('voucher_date', prevStartDate)
        .lte('voucher_date', prevEndDate)

      if (pvErr) throw pvErr

      let prevIncome = 0
      let prevExpense = 0
      if (prevVouchers && prevVouchers.length > 0) {
        const prevVoucherIds = prevVouchers.map((v: any) => v.id)
        const { data: prevJE, error: prevJeErr } = await supabase
          .from('journal_entries')
          .select('debit, credit, account_id')
          .in('voucher_id', prevVoucherIds)

        if (prevJeErr) throw prevJeErr

        const prevJournal = prevJE || []
        const prevAccountIds = Array.from(
          new Set(prevJournal.map((je: any) => je.account_id).filter(Boolean))
        )

        const prevAccountMap: Record<string, string> = {}
        if (prevAccountIds.length > 0) {
          const { data: prevAccts, error: prevAcctErr } = await supabase
            .from('financial_accounts')
            .select('id, account_category')
            .in('id', prevAccountIds)

          if (prevAcctErr) throw prevAcctErr

          for (const a of (prevAccts || [])) {
            prevAccountMap[a.id] = (a.account_category || '').toLowerCase()
          }
        }

        for (const je of prevJournal) {
          const cat = prevAccountMap[je.account_id]
          if (cat === 'revenue') {
            prevIncome += Number(je.credit) - Number(je.debit)
          } else if (cat === 'expense') {
            prevExpense += Number(je.debit) - Number(je.credit)
          }
        }
      }

      setPreviousSummary({
        income: prevIncome,
        expense: prevExpense,
        net: prevIncome - prevExpense,
      })

    } catch (error) {
      console.error('Error loading income statement:', error)
      toast.error('Failed to load income statement')
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => {
    if (!printRef.current) {
      toast.error('Print content not ready')
      return
    }

    const printContent = printRef.current
    const printWindow = window.open('', '_blank', 'width=800,height=600')
    
    if (!printWindow) {
      toast.error('Please allow popups for printing')
      return
    }

    const styles = `
      <style>
        @page { size: A4; margin: 0; }
        body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
        .print-content { width: 210mm; min-height: 297mm; padding: 30px 40px !important; background: white !important; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 3px 8px; border: 1px solid #e0e0e0; text-align: left; }
        th { background-color: #1a1a1a; color: white; }
        tr:nth-child(even) { background-color: #f8fafc; }
      </style>
    `

    const content = `
      <!DOCTYPE html>
      <html>
        <head><title>Income Statement</title>${styles}</head>
        <body>
          ${printContent.outerHTML}
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }
          <\/script>
        </body>
      </html>
    `

    printWindow.document.write(content)
    printWindow.document.close()
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const headers = ['Category', 'Head', 'Amount', 'Transactions']
      const rows: (string | number)[][] = []
      
      incomeData.forEach(i => rows.push(['Income', i.head_name, i.total, i.count]))
      rows.push(['Total Income', '', summary.totalIncome, summary.incomeCount])
      
      expenseData.forEach(e => rows.push(['Expense', e.head_name, e.total, e.count]))
      rows.push(['Total Expense', '', summary.totalExpense, summary.expenseCount])
      
      rows.push(['Net Profit/Loss', '', summary.netProfit, 0])

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(v => `"${v}"`).join(','))
      ].join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `income_statement_${format(new Date(), 'yyyy-MM-dd')}.csv`
      a.click()
      window.URL.revokeObjectURL(url)

      toast.success('Export successful')
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Failed to export')
    } finally {
      setExporting(false)
    }
  }

  const totalIncome = incomeData.reduce((sum, i) => sum + i.total, 0)
  const totalExpense = expenseData.reduce((sum, i) => sum + i.total, 0)
  const netProfit = totalIncome - totalExpense

  // Income Pagination
  const incomeTotalPages = Math.ceil(incomeData.length / itemsPerPage)
  const paginatedIncome = incomeData.slice((incomePage - 1) * itemsPerPage, incomePage * itemsPerPage)
  const goToIncomePage = (page: number) => {
    if (page >= 1 && page <= incomeTotalPages) setIncomePage(page)
  }

  // Expense Pagination
  const expenseTotalPages = Math.ceil(expenseData.length / itemsPerPage)
  const paginatedExpense = expenseData.slice((expensePage - 1) * itemsPerPage, expensePage * itemsPerPage)
  const goToExpensePage = (page: number) => {
    if (page >= 1 && page <= expenseTotalPages) setExpensePage(page)
  }

  const getChangeColor = (current: number, previous: number) => {
    if (previous === 0) return 'text-muted-foreground'
    const change = ((current - previous) / previous) * 100
    return change >= 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'
  }

  return (
    <ResponsiveLayout>
      <div className="space-y-4 p-4 md:p-6">
        {/* Hidden Print Component */}
        <div style={{ display: 'none' }}>
          <PrintComponent
            ref={printRef}
            schoolInfo={schoolInfo}
            incomeData={incomeData}
            expenseData={expenseData}
            totalIncome={totalIncome}
            totalExpense={totalExpense}
            netProfit={netProfit}
            periodLabel={periodLabel}
            todayLabel={todayLabel}
          />
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/finance/reports">
              <Button variant="ghost" size="sm" className="print:hidden">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-xl md:text-2xl font-bold font-heading flex items-center gap-2">
                <TrendingUp className="h-5 w-5 md:h-6 md:w-6 text-emerald-500" />
                Income Statement
              </h1>
              <p className="text-xs md:text-sm text-muted-foreground">Revenue and expense summary (Profit & Loss)</p>
            </div>
          </div>
          <div className="flex gap-2 print:hidden flex-wrap">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-1" />
              Print
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
              <Download className="h-4 w-4 mr-1" />
              {exporting ? 'Exporting...' : 'Export'}
            </Button>
          </div>
        </div>

        {/* Period Selector - Horizontal */}
        <div className="flex items-center gap-2 print:hidden overflow-x-auto pb-1 scrollbar-hide flex-nowrap">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[120px] h-8 shrink-0 text-xs">
              <Calendar className="h-3 w-3 mr-1" />
              <SelectValue placeholder="Select Period" />
            </SelectTrigger>
            <SelectContent>
              {periodOptions.map(p => (
                <SelectItem key={p.value} value={p.value} className="text-xs">{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedPeriod === 'custom' && (
            <div className="flex items-center gap-1 shrink-0">
              <input
                type="date"
                value={customDate?.start || ''}
                onChange={e => setCustomDate({ start: e.target.value, end: customDate?.end || '' })}
                className="px-2 py-1 border rounded-md bg-background text-xs w-[110px] dark:bg-gray-800 dark:border-gray-700 dark:text-white"
              />
              <span className="text-muted-foreground text-xs">to</span>
              <input
                type="date"
                value={customDate?.end || ''}
                onChange={e => setCustomDate({ start: customDate?.start || '', end: e.target.value })}
                className="px-2 py-1 border rounded-md bg-background text-xs w-[110px] dark:bg-gray-800 dark:border-gray-700 dark:text-white"
              />
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid gap-3 grid-cols-2 md:grid-cols-3 print:hidden">
              <Card className="dark:bg-gray-900 dark:border-gray-800">
                <CardContent className="p-3 md:p-4">
                  <p className="text-xs md:text-sm text-muted-foreground dark:text-gray-400">Total Revenue</p>
                  <p className="text-lg md:text-2xl font-bold text-emerald-500 dark:text-emerald-400">
                    {formatCurrency(summary.totalIncome)}
                  </p>
                  {previousSummary.income > 0 && (
                    <p className={`text-[10px] md:text-xs ${getChangeColor(summary.totalIncome, previousSummary.income)}`}>
                      vs prev: {formatCurrency(previousSummary.income)}
                    </p>
                  )}
                  <p className="text-[10px] md:text-xs text-muted-foreground dark:text-gray-400">
                    {summary.incomeCount} transactions
                  </p>
                </CardContent>
              </Card>
              <Card className="dark:bg-gray-900 dark:border-gray-800">
                <CardContent className="p-3 md:p-4">
                  <p className="text-xs md:text-sm text-muted-foreground dark:text-gray-400">Total Expense</p>
                  <p className="text-lg md:text-2xl font-bold text-rose-500 dark:text-rose-400">
                    {formatCurrency(summary.totalExpense)}
                  </p>
                  {previousSummary.expense > 0 && (
                    <p className={`text-[10px] md:text-xs ${getChangeColor(summary.totalExpense, previousSummary.expense)}`}>
                      vs prev: {formatCurrency(previousSummary.expense)}
                    </p>
                  )}
                  <p className="text-[10px] md:text-xs text-muted-foreground dark:text-gray-400">
                    {summary.expenseCount} transactions
                  </p>
                </CardContent>
              </Card>
              <Card className={cn(
                "border-2 dark:bg-gray-900",
                summary.netProfit >= 0 
                  ? "border-emerald-500/50 dark:border-emerald-400/50" 
                  : "border-rose-500/50 dark:border-rose-400/50"
              )}>
                <CardContent className="p-3 md:p-4">
                  <p className="text-xs md:text-sm text-muted-foreground dark:text-gray-400">Net Profit / Loss</p>
                  <p className={cn(
                    "text-lg md:text-2xl font-bold",
                    summary.netProfit >= 0 ? "text-emerald-500 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"
                  )}>
                    {formatCurrency(summary.netProfit)}
                  </p>
                  {previousSummary.net !== 0 && (
                    <p className={`text-[10px] md:text-xs ${getChangeColor(summary.netProfit, previousSummary.net)}`}>
                      vs prev: {formatCurrency(previousSummary.net)}
                    </p>
                  )}
                  <p className="text-[10px] md:text-xs text-muted-foreground dark:text-gray-400">
                    {summary.netProfit >= 0 ? "✅ Profit" : "❌ Loss"}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Income Table */}
            <Card className="dark:bg-gray-900 dark:border-gray-800">
              <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm md:text-base flex items-center gap-2 text-emerald-500 dark:text-emerald-400">
                    <TrendingUp className="h-4 w-4 md:h-5 md:w-5" />
                    Income
                  </CardTitle>
                  <CardDescription className="text-xs dark:text-gray-400">Revenue breakdown by head</CardDescription>
                </div>
                <div className="text-xs text-muted-foreground dark:text-gray-400">
                  {incomeData.length} entries                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="dark:border-gray-800">
                        <TableHead className="min-w-[140px] text-xs dark:text-gray-300">Head</TableHead>
                        <TableHead className="text-right min-w-[80px] text-xs dark:text-gray-300">Amount</TableHead>
                        <TableHead className="text-right min-w-[80px] text-xs dark:text-gray-300">Transactions</TableHead>
                        <TableHead className="text-right min-w-[70px] text-xs dark:text-gray-300">% of Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedIncome.length > 0 ? (
                        paginatedIncome.map((row, i) => (
                          <TableRow 
                            key={i} 
                            className={cn(
                              i % 2 === 0 ? "bg-muted/20 dark:bg-gray-800/30" : "",
                              "dark:border-gray-800"
                            )}
                          >
                            <TableCell className="text-xs md:text-sm dark:text-gray-300">{row.head_name}</TableCell>
                            <TableCell className="text-right text-emerald-500 dark:text-emerald-400 font-medium text-xs md:text-sm">
                              {formatCurrency(row.total)}
                            </TableCell>
                            <TableCell className="text-right text-xs md:text-sm dark:text-gray-300">{row.count}</TableCell>
                            <TableCell className="text-right text-xs md:text-sm dark:text-gray-300">
                              {totalIncome > 0 ? ((row.total / totalIncome) * 100).toFixed(1) : 0}%
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-6 text-muted-foreground dark:text-gray-400 text-sm">
                            No income records found
                          </TableCell>
                        </TableRow>
                      )}
                      {incomeData.length > 0 && (
                        <TableRow className="font-bold border-t-2 dark:border-gray-700 bg-muted/50 dark:bg-gray-800/50">
                          <TableCell className="text-xs md:text-sm dark:text-white">Total Income</TableCell>
                          <TableCell className="text-right text-emerald-500 dark:text-emerald-400 text-xs md:text-sm">
                            {formatCurrency(totalIncome)}
                          </TableCell>
                          <TableCell className="text-right text-xs md:text-sm dark:text-white">
                            {incomeData.reduce((sum, i) => sum + i.count, 0)}
                          </TableCell>
                          <TableCell className="text-right text-xs md:text-sm dark:text-white">100%</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Income Pagination */}
                {incomeTotalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-2 border-t dark:border-gray-800">
                    <div className="text-xs text-muted-foreground dark:text-gray-400">
                      {incomeData.length} entries
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => goToIncomePage(incomePage - 1)}
                        disabled={incomePage === 1}
                        className="h-7 px-2 text-xs dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                      >
                        <ChevronLeft className="h-3 w-3" />
                      </Button>
                      <span className="text-xs text-muted-foreground dark:text-gray-400 px-2">
                        {incomePage} / {incomeTotalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => goToIncomePage(incomePage + 1)}
                        disabled={incomePage === incomeTotalPages}
                        className="h-7 px-2 text-xs dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                      >
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Expense Table */}
            <Card className="dark:bg-gray-900 dark:border-gray-800">
              <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm md:text-base flex items-center gap-2 text-rose-500 dark:text-rose-400">
                    <TrendingDown className="h-4 w-4 md:h-5 md:w-5" />
                    Expense
                  </CardTitle>
                  <CardDescription className="text-xs dark:text-gray-400">Expense breakdown by head</CardDescription>
                </div>
                <div className="text-xs text-muted-foreground dark:text-gray-400">
                  {expenseData.length} entries
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="dark:border-gray-800">
                        <TableHead className="min-w-[140px] text-xs dark:text-gray-300">Head</TableHead>
                        <TableHead className="text-right min-w-[80px] text-xs dark:text-gray-300">Amount</TableHead>
                        <TableHead className="text-right min-w-[80px] text-xs dark:text-gray-300">Transactions</TableHead>
                        <TableHead className="text-right min-w-[70px] text-xs dark:text-gray-300">% of Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedExpense.length > 0 ? (
                        paginatedExpense.map((row, i) => (
                          <TableRow 
                            key={i} 
                            className={cn(
                              i % 2 === 0 ? "bg-muted/20 dark:bg-gray-800/30" : "",
                              "dark:border-gray-800"
                            )}
                          >
                            <TableCell className="text-xs md:text-sm dark:text-gray-300">{row.head_name}</TableCell>
                            <TableCell className="text-right text-rose-500 dark:text-rose-400 font-medium text-xs md:text-sm">
                              {formatCurrency(row.total)}
                            </TableCell>
                            <TableCell className="text-right text-xs md:text-sm dark:text-gray-300">{row.count}</TableCell>
                            <TableCell className="text-right text-xs md:text-sm dark:text-gray-300">
                              {totalExpense > 0 ? ((row.total / totalExpense) * 100).toFixed(1) : 0}%
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-6 text-muted-foreground dark:text-gray-400 text-sm">
                            No expense records found
                          </TableCell>
                        </TableRow>
                      )}
                      {expenseData.length > 0 && (
                        <TableRow className="font-bold border-t-2 dark:border-gray-700 bg-muted/50 dark:bg-gray-800/50">
                          <TableCell className="text-xs md:text-sm dark:text-white">Total Expense</TableCell>
                          <TableCell className="text-right text-rose-500 dark:text-rose-400 text-xs md:text-sm">
                            {formatCurrency(totalExpense)}
                          </TableCell>
                          <TableCell className="text-right text-xs md:text-sm dark:text-white">
                            {expenseData.reduce((sum, i) => sum + i.count, 0)}
                          </TableCell>
                          <TableCell className="text-right text-xs md:text-sm dark:text-white">100%</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Expense Pagination */}
                {expenseTotalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-2 border-t dark:border-gray-800">
                    <div className="text-xs text-muted-foreground dark:text-gray-400">
                      {expenseData.length} entries
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => goToExpensePage(expensePage - 1)}
                        disabled={expensePage === 1}
                        className="h-7 px-2 text-xs dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                      >
                        <ChevronLeft className="h-3 w-3" />
                      </Button>
                      <span className="text-xs text-muted-foreground dark:text-gray-400 px-2">
                        {expensePage} / {expenseTotalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => goToExpensePage(expensePage + 1)}
                        disabled={expensePage === expenseTotalPages}
                        className="h-7 px-2 text-xs dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                      >
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Net Profit Summary */}
            <Card className={cn(
              "border-2 dark:bg-gray-900",
              netProfit >= 0 
                ? "border-emerald-500/50 dark:border-emerald-400/50 bg-emerald-500/5 dark:bg-emerald-500/10" 
                : "border-rose-500/50 dark:border-rose-400/50 bg-rose-500/5 dark:bg-rose-500/10"
            )}>
              <CardContent className="p-4 md:p-6">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground dark:text-gray-400">Net Profit / Loss</p>
                    <p className={cn(
                      "text-2xl md:text-3xl font-bold",
                      netProfit >= 0 ? "text-emerald-500 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"
                    )}>
                      {formatCurrency(netProfit)}
                    </p>
                  </div>
                  <div className="text-xs md:text-sm text-muted-foreground dark:text-gray-400 text-right">
                    <p>Total Revenue: <span className="text-emerald-500 dark:text-emerald-400">{formatCurrency(totalIncome)}</span></p>
                    <p>Total Expense: <span className="text-rose-500 dark:text-rose-400">{formatCurrency(totalExpense)}</span></p>
                    <p className={netProfit >= 0 ? "text-emerald-500 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"}>
                      {netProfit >= 0 ? "✅ Profit" : "❌ Loss"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </ResponsiveLayout>
  )
}