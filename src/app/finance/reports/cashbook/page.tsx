// src/app/finance/reports/cashbook/page.tsx
"use client"

import React, { useState, useEffect, useRef, forwardRef } from "react"
import Link from "next/link"
import { 
  ArrowLeft,
  Download,
  Loader2,
  Printer,
  FileText,
  Calendar,
  Wallet,
  TrendingUp,
  TrendingDown,
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

interface CashbookEntry {
  date: string
  voucher_no: string
  description: string
  debit: number
  credit: number
  balance: number
  payment_mode: string
  source_type: string
}

interface AccountInfo {
  id: string
  account_name: string
  type: string
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
  entries: CashbookEntry[],
  totalDebit: number,
  totalCredit: number,
  openingBalance: number,
  closingBalance: number,
  periodLabel: string,
  todayLabel: string,
  accountName: string
}>(({ schoolInfo, entries, totalDebit, totalCredit, openingBalance, closingBalance, periodLabel, todayLabel, accountName }, ref) => {
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
            style={{ 
              height: '70px', 
              width: '70px', 
              objectFit: 'contain',
              flexShrink: 0
            }} 
          />
        )}
        <div style={{ flex: 1 }}>
          <h1 style={{ 
            fontSize: '22px', 
            fontWeight: 'bold', 
            margin: 0,
            letterSpacing: '1px',
            color: '#1a1a1a'
          }}>
            {schoolName}
          </h1>
          <p style={{ 
            fontSize: '13px', 
            color: '#4a4a4a',
            margin: '3px 0 0 0'
          }}>
            {schoolAddress}
          </p>
          <p style={{ 
            fontSize: '13px', 
            color: '#4a4a4a',
            margin: '2px 0 0 0'
          }}>
            Phone: {schoolPhone}
          </p>
        </div>
      </div>

      {/* REPORT TITLE */}
      <div style={{ textAlign: 'center', marginBottom: '15px' }}>
        <h2 style={{ 
          fontSize: '18px', 
          fontWeight: 'bold',
          textTransform: 'uppercase',
          letterSpacing: '2px',
          color: '#1a1a1a',
          margin: 0
        }}>
          Cashbook
        </h2>
        {accountName && accountName !== 'All Accounts' && (
          <p style={{ fontSize: '13px', color: '#4a4a4a', marginTop: '3px' }}>
            Account: {accountName}
          </p>
        )}
      </div>

      {/* PERIOD & GENERATED (Horizontal) */}
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

      {/* TABLE */}
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        marginBottom: '20px',
        fontSize: '11px'
      }}>
        <thead>
          <tr style={{
            backgroundColor: '#1a1a1a',
            color: 'white'
          }}>
            <th style={{ padding: '5px 8px', textAlign: 'left', border: '1px solid #333' }}>Date</th>
            <th style={{ padding: '5px 8px', textAlign: 'left', border: '1px solid #333' }}>Voucher No</th>
            <th style={{ padding: '5px 8px', textAlign: 'left', border: '1px solid #333' }}>Description</th>
            <th style={{ padding: '5px 8px', textAlign: 'right', border: '1px solid #333' }}>Debit</th>
            <th style={{ padding: '5px 8px', textAlign: 'right', border: '1px solid #333' }}>Credit</th>
            <th style={{ padding: '5px 8px', textAlign: 'right', border: '1px solid #333' }}>Balance</th>
          </tr>
        </thead>
        <tbody>
          {/* Opening Balance Row */}
          <tr style={{ backgroundColor: '#f0fdf4', fontWeight: 'bold' }}>
            <td colSpan={3} style={{ padding: '5px 8px', border: '1px solid #e0e0e0' }}>Opening Balance</td>
            <td style={{ padding: '5px 8px', textAlign: 'right', border: '1px solid #e0e0e0', color: '#10b981' }}>
              {openingBalance > 0 ? formatCurrency(openingBalance) : '-'}
            </td>
            <td style={{ padding: '5px 8px', textAlign: 'right', border: '1px solid #e0e0e0', color: '#ef4444' }}>
              {openingBalance < 0 ? formatCurrency(Math.abs(openingBalance)) : '-'}
            </td>
            <td style={{ padding: '5px 8px', textAlign: 'right', border: '1px solid #e0e0e0', fontWeight: 'bold' }}>
              {formatCurrency(openingBalance)}
            </td>
          </tr>
          
          {entries.map((entry, i) => (
            <tr key={i} style={{
              backgroundColor: i % 2 === 0 ? '#f8fafc' : 'white'
            }}>
              <td style={{ padding: '4px 8px', border: '1px solid #e0e0e0' }}>
                {format(new Date(entry.date), 'dd MMM yyyy')}
              </td>
              <td style={{ padding: '4px 8px', border: '1px solid #e0e0e0', fontFamily: 'monospace' }}>
                {entry.voucher_no}
              </td>
              <td style={{ padding: '4px 8px', border: '1px solid #e0e0e0' }}>
                {entry.description || '-'}
              </td>
              <td style={{ padding: '4px 8px', textAlign: 'right', border: '1px solid #e0e0e0', color: '#10b981' }}>
                {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
              </td>
              <td style={{ padding: '4px 8px', textAlign: 'right', border: '1px solid #e0e0e0', color: '#ef4444' }}>
                {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
              </td>
              <td style={{ padding: '4px 8px', textAlign: 'right', border: '1px solid #e0e0e0', fontWeight: 'bold' }}>
                {formatCurrency(entry.balance)}
              </td>
            </tr>
          ))}
          
          {/* Total Row */}
          <tr style={{
            backgroundColor: '#1a1a1a',
            color: 'white',
            fontWeight: 'bold'
          }}>
            <td colSpan={3} style={{ padding: '5px 8px', border: '1px solid #333' }}>TOTAL</td>
            <td style={{ padding: '5px 8px', textAlign: 'right', border: '1px solid #333', color: '#34d399' }}>
              {formatCurrency(totalDebit)}
            </td>
            <td style={{ padding: '5px 8px', textAlign: 'right', border: '1px solid #333', color: '#f87171' }}>
              {formatCurrency(totalCredit)}
            </td>
            <td style={{ padding: '5px 8px', textAlign: 'right', border: '1px solid #333', color: '#34d399' }}>
              {formatCurrency(closingBalance)}
            </td>
          </tr>
          
          {/* Closing Balance Row */}
          <tr style={{ backgroundColor: '#f0fdf4', fontWeight: 'bold' }}>
            <td colSpan={3} style={{ padding: '5px 8px', border: '1px solid #e0e0e0' }}>Closing Balance</td>
            <td style={{ padding: '5px 8px', textAlign: 'right', border: '1px solid #e0e0e0', color: '#10b981' }}>
              {closingBalance > 0 ? formatCurrency(closingBalance) : '-'}
            </td>
            <td style={{ padding: '5px 8px', textAlign: 'right', border: '1px solid #e0e0e0', color: '#ef4444' }}>
              {closingBalance < 0 ? formatCurrency(Math.abs(closingBalance)) : '-'}
            </td>
            <td style={{ padding: '5px 8px', textAlign: 'right', border: '1px solid #e0e0e0', fontWeight: 'bold' }}>
              {formatCurrency(closingBalance)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* SIGNATURES */}
      <div style={{
        marginTop: '30px',
        paddingTop: '20px',
        borderTop: '2px solid #e0e0e0'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '20px',
          textAlign: 'center'
        }}>
          <div>
            <div style={{
              borderBottom: '1px solid #1a1a1a',
              paddingBottom: '2px',
              marginBottom: '5px',
              minHeight: '30px'
            }}></div>
            <span style={{ fontSize: '12px', color: '#4a4a4a' }}>Prepared By</span>
          </div>
          <div>
            <div style={{
              borderBottom: '1px solid #1a1a1a',
              paddingBottom: '2px',
              marginBottom: '5px',
              minHeight: '30px'
            }}></div>
            <span style={{ fontSize: '12px', color: '#4a4a4a' }}>Verified By</span>
          </div>
          <div>
            <div style={{
              borderBottom: '1px solid #1a1a1a',
              paddingBottom: '2px',
              marginBottom: '5px',
              minHeight: '30px'
            }}></div>
            <span style={{ fontSize: '12px', color: '#4a4a4a' }}>Authorized By</span>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div style={{
        textAlign: 'center',
        marginTop: '20px',
        paddingTop: '10px',
        borderTop: '1px solid #e0e0e0',
        fontSize: '11px',
        color: '#999'
      }}>
        <span>Powered by {schoolName} | Page 1 of 1</span>
      </div>
    </div>
  )
})

PrintComponent.displayName = 'PrintComponent'

export default function CashbookPage() {
  const [schoolInfo, setSchoolInfo] = useState<SchoolSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [entries, setEntries] = useState<CashbookEntry[]>([])
  const [filteredEntries, setFilteredEntries] = useState<CashbookEntry[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState('month')
  const [customDate, setCustomDate] = useState<{ start: string; end: string } | null>(null)
  const [accountFilter, setAccountFilter] = useState<string>('all')
  const [financialAccounts, setFinancialAccounts] = useState<AccountInfo[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)

  const [periodLabel, setPeriodLabel] = useState('')
  const [todayLabel, setTodayLabel] = useState('')
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadSchoolInfo()
    loadFinancialAccounts()
  }, [])

  // ===== FIXED: useEffect with proper date handling =====
  useEffect(() => {
    const initData = async () => {
      const dates = getPeriodDates()
      
      // Ensure dates are valid before formatting
      if (dates.start && dates.end && !isNaN(dates.start.getTime()) && !isNaN(dates.end.getTime())) {
        setPeriodLabel(`${format(dates.start, 'MMM d, yyyy')} - ${format(dates.end, 'MMM d, yyyy')}`)
      } else {
        const today = new Date()
        setPeriodLabel(`${format(today, 'MMM d, yyyy')} - ${format(today, 'MMM d, yyyy')}`)
      }
      
      setTodayLabel(format(new Date(), 'MMM d, yyyy, h:mm:ss a'))
      await loadCashbook()
    }
    
    initData()
  }, [selectedPeriod, customDate, accountFilter])

  // Pagination effect
  useEffect(() => {
    const start = (currentPage - 1) * itemsPerPage
    const end = start + itemsPerPage
    setFilteredEntries(entries.slice(start, end))
  }, [entries, currentPage, itemsPerPage])

  const loadSchoolInfo = async () => {
    try {
      const { data } = await supabase.from('school_settings').select('school_name, school_address, school_phone, school_logo').limit(1).maybeSingle()
      if (data) setSchoolInfo(data)
    } catch (error) {
      console.error('Error loading school info:', error)
    }
  }

  const loadFinancialAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('financial_accounts')
        .select('id, account_name, type')
        .eq('is_active', true)
        .order('account_name')
      if (error) throw error
      setFinancialAccounts(data || [])
    } catch (error) {
      console.error('Error loading accounts:', error)
    }
  }

  // ===== FIXED: getPeriodDates with proper validation =====
  const getPeriodDates = () => {
    const today = new Date()
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    const startOfYear = new Date(today.getFullYear(), 0, 1)
    const startOfQuarter = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1)

    // Check if customDate is valid
    if (customDate?.start && customDate?.end) {
      const start = new Date(customDate.start)
      const end = new Date(customDate.end)
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        return { start, end }
      }
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

  const loadCashbook = async () => {
    setLoading(true)
    try {
      const dates = getPeriodDates()
      
      // Ensure dates are valid before querying
      if (!dates.start || !dates.end || isNaN(dates.start.getTime()) || isNaN(dates.end.getTime())) {
        toast.error('Invalid date range selected')
        setLoading(false)
        return
      }
      
      const startDate = format(dates.start, 'yyyy-MM-dd')
      const endDate = format(dates.end, 'yyyy-MM-dd')

      let voucherQuery = supabase
        .from('vouchers')
        .select('*')
        .gte('voucher_date', startDate)
        .lte('voucher_date', endDate)

      if (accountFilter !== 'all') {
        voucherQuery = voucherQuery.eq('financial_account_id', accountFilter)
      }

      const { data: voucherData, error: voucherError } = await voucherQuery

      if (voucherError) throw voucherError

      let txQuery = supabase
        .from('finance_transactions')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)

      if (accountFilter !== 'all') {
        txQuery = txQuery.eq('account_id', accountFilter)
      }

      const { data: txData, error: txError } = await txQuery

      if (txError) throw txError

      const voucherEntries = (voucherData || []).map(v => ({
        date: v.voucher_date,
        voucher_no: v.voucher_no,
        description: v.paid_to_received_from || v.narration || '',
        debit: v.voucher_type === 'receipt' ? Number(v.total_amount) : 0,
        credit: v.voucher_type === 'payment' ? Number(v.total_amount) : 0,
        balance: 0,
        payment_mode: 'bank',
        source_type: 'voucher'
      }))

      const txEntries = (txData || []).map(t => ({
        date: t.date,
        voucher_no: t.reference || `TX-${t.id?.slice(0, 8)}`,
        description: t.description || '',
        debit: t.type === 'income' ? Number(t.amount) : 0,
        credit: t.type === 'expense' ? Number(t.amount) : 0,
        balance: 0,
        payment_mode: t.payment_mode || 'cash',
        source_type: t.source_type || 'manual'
      }))

      const allEntries = [...voucherEntries, ...txEntries].sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      )

      let runningBalance = 0
      allEntries.forEach(e => {
        runningBalance += e.debit - e.credit
        e.balance = runningBalance
      })

      setEntries(allEntries)
      setCurrentPage(1)
    } catch (error) {
      console.error('Error loading cashbook:', error)
      toast.error('Failed to load cashbook data')
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
        @page {
          size: A4;
          margin: 0;
        }
        body {
          margin: 0;
          padding: 0;
          font-family: Arial, sans-serif;
        }
        .print-content {
          width: 210mm;
          min-height: 297mm;
          padding: 30px 40px !important;
          background: white !important;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        th, td {
          padding: 4px 8px;
          border: 1px solid #e0e0e0;
          text-align: left;
        }
        th {
          background-color: #1a1a1a;
          color: white;
        }
        tr:nth-child(even) {
          background-color: #f8fafc;
        }
      </style>
    `

    const content = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Cashbook</title>
          ${styles}
        </head>
        <body>
          ${printContent.outerHTML}
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() {
                window.close();
              }, 500);
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
      const headers = ['Date', 'Voucher No', 'Description', 'Debit', 'Credit', 'Balance', 'Payment Mode', 'Source']
      const rows = entries.map(e => [
        e.date,
        e.voucher_no,
        e.description,
        e.debit,
        e.credit,
        e.balance,
        e.payment_mode,
        e.source_type
      ])

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(v => `"${v}"`).join(','))
      ].join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `cashbook_${format(new Date(), 'yyyy-MM-dd')}.csv`
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

  const totalDebit = entries.reduce((sum, e) => sum + e.debit, 0)
  const totalCredit = entries.reduce((sum, e) => sum + e.credit, 0)
  const openingBalance = entries.length > 0 ? entries[0].balance - entries[0].debit + entries[0].credit : 0
  const closingBalance = entries.length > 0 ? entries[entries.length - 1].balance : 0

  // Pagination
  const totalPages = Math.ceil(entries.length / itemsPerPage)
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
    }
  }

  const getAccountName = () => {
    if (accountFilter === 'all') return 'All Accounts'
    const account = financialAccounts.find(a => a.id === accountFilter)
    return account ? `${account.account_name} (${account.type})` : 'All Accounts'
  }

  return (
    <ResponsiveLayout>
      <div className="space-y-6 p-4 md:p-6">
        {/* Hidden Print Component */}
        <div style={{ display: 'none' }}>
          <PrintComponent
            ref={printRef}
            schoolInfo={schoolInfo}
            entries={entries}
            totalDebit={totalDebit}
            totalCredit={totalCredit}
            openingBalance={openingBalance}
            closingBalance={closingBalance}
            periodLabel={periodLabel}
            todayLabel={todayLabel}
            accountName={getAccountName()}
          />
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/finance/reports">
              <Button variant="ghost" size="sm" className="print:hidden">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Reports
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
                <Wallet className="h-6 w-6 text-emerald-500" />
                Cashbook
              </h1>
              <p className="text-muted-foreground">Cash and bank transactions</p>
            </div>
          </div>
          <div className="flex gap-2 print:hidden flex-wrap">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
              <Download className="h-4 w-4 mr-2" />
              {exporting ? 'Exporting...' : 'Export CSV'}
            </Button>
          </div>
        </div>

        {/* Filters - Responsive */}
        <div className="flex flex-col sm:flex-row gap-4 print:hidden">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-full sm:w-40">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Select Period" />
            </SelectTrigger>
            <SelectContent>
              {periodOptions.map(p => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedPeriod === 'custom' && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={customDate?.start || ''}
                onChange={e => setCustomDate({ start: e.target.value, end: customDate?.end || '' })}
                className="px-3 py-2 border rounded-md bg-background text-sm min-w-[140px]"
              />
              <span className="text-muted-foreground">to</span>
              <input
                type="date"
                value={customDate?.end || ''}
                onChange={e => setCustomDate({ start: customDate?.start || '', end: e.target.value })}
                className="px-3 py-2 border rounded-md bg-background text-sm min-w-[140px]"
              />
            </div>
          )}

          <Select value={accountFilter} onValueChange={setAccountFilter}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder="Filter by account" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Accounts</SelectItem>
              {financialAccounts.map(acc => (
                <SelectItem key={acc.id} value={acc.id}>
                  {acc.account_name} ({acc.type})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Summary Cards - Responsive */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4 print:hidden">
          <Card>
            <CardContent className="p-3 md:p-4">
              <p className="text-xs md:text-sm text-muted-foreground">Opening Balance</p>
              <p className={`text-lg md:text-xl font-bold ${openingBalance >= 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
                {formatCurrency(openingBalance)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 md:p-4">
              <p className="text-xs md:text-sm text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-3 w-3 md:h-4 md:w-4 text-emerald-500" />
                Total Debit
              </p>
              <p className="text-lg md:text-xl font-bold text-emerald-500 dark:text-emerald-400">
                {formatCurrency(totalDebit)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 md:p-4">
              <p className="text-xs md:text-sm text-muted-foreground flex items-center gap-1">
                <TrendingDown className="h-3 w-3 md:h-4 md:w-4 text-rose-500" />
                Total Credit
              </p>
              <p className="text-lg md:text-xl font-bold text-rose-500 dark:text-rose-400">
                {formatCurrency(totalCredit)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 md:p-4">
              <p className="text-xs md:text-sm text-muted-foreground">Closing Balance</p>
              <p className={`text-lg md:text-xl font-bold ${closingBalance >= 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
                {formatCurrency(closingBalance)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Transactions Table - With Pagination */}
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-base md:text-lg dark:text-white">Transactions</CardTitle>
              <CardDescription className="text-xs md:text-sm dark:text-gray-400" suppressHydrationWarning>
                Period: {periodLabel}
              </CardDescription>
            </div>
            <div className="text-sm text-muted-foreground dark:text-gray-400">
              Total: {entries.length} entries
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[90px] dark:text-gray-300">Date</TableHead>
                    <TableHead className="min-w-[110px] dark:text-gray-300">Voucher No</TableHead>
                    <TableHead className="min-w-[140px] dark:text-gray-300">Description</TableHead>
                    <TableHead className="text-right min-w-[80px] dark:text-gray-300">Debit</TableHead>
                    <TableHead className="text-right min-w-[80px] dark:text-gray-300">Credit</TableHead>
                    <TableHead className="text-right min-w-[80px] dark:text-gray-300">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : filteredEntries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground dark:text-gray-400">
                        No transactions found for this period
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {/* Opening Balance Row */}
                      <TableRow className="bg-emerald-50/50 dark:bg-emerald-950/30 font-medium">
                        <TableCell colSpan={3} className="text-sm dark:text-gray-300">Opening Balance</TableCell>
                        <TableCell className="text-right text-sm text-emerald-500 dark:text-emerald-400">
                          {openingBalance > 0 ? formatCurrency(openingBalance) : '-'}
                        </TableCell>
                        <TableCell className="text-right text-sm text-rose-500 dark:text-rose-400">
                          {openingBalance < 0 ? formatCurrency(Math.abs(openingBalance)) : '-'}
                        </TableCell>
                        <TableCell className="text-right text-sm font-bold dark:text-white">
                          {formatCurrency(openingBalance)}
                        </TableCell>
                      </TableRow>
                      
                      {filteredEntries.map((entry, i) => (
                        <TableRow 
                          key={i} 
                          className={cn(
                            i % 2 === 0 ? "bg-muted/20 dark:bg-muted/5" : "",
                            "dark:border-gray-700"
                          )}
                        >
                          <TableCell className="text-xs md:text-sm dark:text-gray-300">
                            {format(new Date(entry.date), 'dd MMM yyyy')}
                          </TableCell>
                          <TableCell className="font-mono text-xs md:text-sm dark:text-gray-300">
                            {entry.voucher_no}
                          </TableCell>
                          <TableCell className="text-xs md:text-sm truncate max-w-[150px] dark:text-gray-300" title={entry.description}>
                            {entry.description || '-'}
                          </TableCell>
                          <TableCell className={cn(
                            "text-right font-mono text-xs md:text-sm",
                            entry.debit > 0 ? "text-emerald-500 dark:text-emerald-400" : "dark:text-gray-400"
                          )}>
                            {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                          </TableCell>
                          <TableCell className={cn(
                            "text-right font-mono text-xs md:text-sm",
                            entry.credit > 0 ? "text-rose-500 dark:text-rose-400" : "dark:text-gray-400"
                          )}>
                            {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs md:text-sm font-bold dark:text-white">
                            {formatCurrency(entry.balance)}
                          </TableCell>
                        </TableRow>
                      ))}
                      
                      {/* Total Row */}
                      <TableRow className="font-bold border-t-2 dark:border-gray-700 bg-muted/50 dark:bg-muted/20">
                        <TableCell colSpan={3} className="text-xs md:text-sm dark:text-white">TOTAL</TableCell>
                        <TableCell className="text-right text-emerald-500 dark:text-emerald-400 text-xs md:text-sm">
                          {formatCurrency(totalDebit)}
                        </TableCell>
                        <TableCell className="text-right text-rose-500 dark:text-rose-400 text-xs md:text-sm">
                          {formatCurrency(totalCredit)}
                        </TableCell>
                        <TableCell className="text-right text-emerald-500 dark:text-emerald-400 text-xs md:text-sm">
                          {formatCurrency(closingBalance)}
                        </TableCell>
                      </TableRow>
                      
                      {/* Closing Balance Row */}
                      <TableRow className="bg-emerald-50/50 dark:bg-emerald-950/30 font-medium">
                        <TableCell colSpan={3} className="text-sm dark:text-gray-300">Closing Balance</TableCell>
                        <TableCell className="text-right text-sm text-emerald-500 dark:text-emerald-400">
                          {closingBalance > 0 ? formatCurrency(closingBalance) : '-'}
                        </TableCell>
                        <TableCell className="text-right text-sm text-rose-500 dark:text-rose-400">
                          {closingBalance < 0 ? formatCurrency(Math.abs(closingBalance)) : '-'}
                        </TableCell>
                        <TableCell className="text-right text-sm font-bold dark:text-white">
                          {formatCurrency(closingBalance)}
                        </TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination - No Scroll */}
            {!loading && entries.length > 0 && totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 print:hidden">
                <div className="text-sm text-muted-foreground dark:text-gray-400">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, entries.length)} of {entries.length} entries
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => goToPage(page)}
                      className={cn(
                        "min-w-[32px]",
                        currentPage === page && "bg-primary text-primary-foreground"
                      )}
                    >
                      {page}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ResponsiveLayout>
  )
}
