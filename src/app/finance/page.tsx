"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { 
  DollarSign,
  TrendingUp,
  TrendingDown,
  Download,
  Loader2,
  Banknote,
  CreditCard,
  RefreshCw,
  AlertCircle,
  FileBarChart,
  Plus,
  Receipt,
  Calendar,
  Printer,
  ChevronRight
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ResponsiveLayout } from "@/components/layout/responsive-layout"
import { formatCurrency, cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { format } from "date-fns"

const supabase = createClient()

interface SummaryCard {
  title: string
  value: number
  change: number
  icon: React.ElementType
  colorClass: string
  bgClass: string
  borderClass: string
}

interface RecentVoucher {
  id: string
  voucher_no: string
  voucher_type: string
  voucher_date: string
  total_amount: number
  paid_to_received_from: string
}

interface SchoolSettings {
  school_name: string
  school_logo: string
  school_address: string
  school_phone: string
}

const SummarySkeleton = () => (
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 shrink-0">
    {[...Array(4)].map((_, i) => (
      <Card key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5">
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-24" />
          </div>
          <Skeleton className="h-7 w-7 rounded-md" />
        </div>
      </Card>
    ))}
  </div>
)

const DashboardContentSkeleton = () => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 flex-1 min-h-0">
    <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 flex flex-col justify-between">
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-48" />
      </div>
      <div className="space-y-2 my-auto">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-7 w-full rounded-md" />
        ))}
      </div>
    </Card>
    <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 flex flex-col justify-between">
      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-3 w-40" />
      </div>
      <div className="space-y-2 my-auto">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-9 w-full rounded-md" />
        ))}
      </div>
    </Card>
  </div>
)

export default function FinancePage() {
  const [selectedPeriod, setSelectedPeriod] = useState("month")
  const [summary, setSummary] = useState<SummaryCard[]>([])
  const [vouchers, setVouchers] = useState<RecentVoucher[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings>({
    school_name: 'মাদ্রাসাতুল সুন্নাহ আল মাদানী',
    school_logo: '',
    school_address: 'Nowtala, Madhaiya Bazar, Chandina, Cumilla',
    school_phone: '01923253454'
  })

  useEffect(() => {
    loadDashboardData()
    loadSchoolSettings()
  }, [selectedPeriod])

  const loadSchoolSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('school_settings')
        .select('school_name, school_logo, school_address, school_phone')
        .maybeSingle()

      if (error) {
        console.warn('Using default school settings:', error.message)
        return
      }

      if (data) {
        setSchoolSettings({
          school_name: data.school_name || 'মাদ্রাসাতুল সুন্নাহ আল মাদানী',
          school_logo: data.school_logo || '',
          school_address: data.school_address || 'Nowtala, Madhaiya Bazar, Chandina, Cumilla',
          school_phone: data.school_phone || '01923253454'
        })
      }
    } catch (error) {
      console.warn('Could not load school settings, using defaults')
    }
  }

  const getDateFilter = (period: string) => {
    const today = new Date()
    let startDate: Date
    let endDate = new Date(today)

    switch (period) {
      case "week":
        startDate = new Date(today)
        startDate.setDate(today.getDate() - 7)
        break
      case "month":
        startDate = new Date(today.getFullYear(), today.getMonth(), 1)
        break
      case "year":
        startDate = new Date(today.getFullYear(), 0, 1)
        break
      default:
        startDate = new Date(today.getFullYear(), today.getMonth(), 1)
    }

    return {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0],
    }
  }

  const loadDashboardData = async () => {
    setLoading(true)
    try {
      const dateFilter = getDateFilter(selectedPeriod)
      
      const [accountsRes, vouchersRes] = await Promise.all([
        supabase
          .from('financial_accounts')
          .select('type, current_balance')
          .eq('is_active', true),
        supabase
          .from('vouchers')
          .select('id, voucher_no, voucher_type, voucher_date, total_amount, paid_to_received_from')
          .order('voucher_date', { ascending: false })
          .limit(10)
      ])

      const { data: voucherRows } = await supabase
        .from('vouchers')
        .select('id')
        .gte('voucher_date', dateFilter.start)
        .lte('voucher_date', dateFilter.end)

      const voucherIds = (voucherRows || []).map((v: any) => v.id)

      let jeData: any[] = []
      if (voucherIds.length > 0) {
        const { data: jeRows } = await supabase
          .from('journal_entries')
          .select('debit, credit, account_id')
          .in('voucher_id', voucherIds)
        jeData = jeRows || []
      }

      const accountIds = [...new Set(jeData.map((j) => j.account_id).filter(Boolean))]
      const accountMap: Record<string, string> = {}

      if (accountIds.length > 0) {
        const { data: accts } = await supabase
          .from('financial_accounts')
          .select('id, account_category')
          .in('id', accountIds)

        for (const a of (accts || [])) {
          accountMap[a.id] = (a.account_category || '').toLowerCase()
        }
      }

      let totalIncome = 0
      let totalExpense = 0

      for (const je of jeData) {
        const cat = accountMap[je.account_id]
        if (cat === 'revenue') {
          totalIncome += Number(je.credit) - Number(je.debit)
        } else if (cat === 'expense') {
          totalExpense += Number(je.debit) - Number(je.credit)
        }
      }

      const netFlow = totalIncome - totalExpense

      console.log('📊 Finance Dashboard:', {
        vouchersInPeriod: voucherIds.length,
        journalEntriesLoaded: jeData.length,
        totalRevenue: totalIncome,
        totalExpense,
        netFlow,
      })

      const accounts = accountsRes.data || []
      const cashBalance = accounts
        .filter(a => a.type === 'cash')
        .reduce((sum: number, a: any) => sum + Number(a.current_balance), 0)
      const bankBalance = accounts
        .filter(a => a.type === 'bank')
        .reduce((sum: number, a: any) => sum + Number(a.current_balance), 0)
      const mobileBankBalance = accounts
        .filter(a => a.type === 'mobile_bank')
        .reduce((sum: number, a: any) => sum + Number(a.current_balance), 0)

      setSummary([
        {
          title: "Total Revenue",
          value: totalIncome,
          change: 0,
          icon: TrendingUp,
          colorClass: "text-emerald-600 dark:text-emerald-400",
          bgClass: "bg-emerald-50 dark:bg-emerald-950/60",
          borderClass: "border-emerald-200/80 dark:border-emerald-800/60"
        },
        {
          title: "Total Expense",
          value: totalExpense,
          change: 0,
          icon: TrendingDown,
          colorClass: "text-rose-600 dark:text-rose-400",
          bgClass: "bg-rose-50 dark:bg-rose-950/60",
          borderClass: "border-rose-200/80 dark:border-rose-800/60"
        },
        {
          title: "Net Flow",
          value: netFlow,
          change: 0,
          icon: DollarSign,
          colorClass: "text-blue-600 dark:text-blue-400",
          bgClass: "bg-blue-50 dark:bg-blue-950/60",
          borderClass: "border-blue-200/80 dark:border-blue-800/60"
        },
        {
          title: "Total Balance",
          value: cashBalance + bankBalance + mobileBankBalance,
          change: 0,
          icon: Banknote,
          colorClass: "text-violet-600 dark:text-violet-400",
          bgClass: "bg-violet-50 dark:bg-violet-950/60",
          borderClass: "border-violet-200/80 dark:border-violet-800/60"
        },
      ])

      setVouchers(vouchersRes.data || [])
    } catch (error) {
      console.error("Error loading dashboard data:", error)
      toast.error("Failed to load financial data")
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const dateFilter = getDateFilter(selectedPeriod)
      
      const { data, error } = await supabase
        .from('finance_transactions')
        .select('*')
        .gte('date', dateFilter.start)
        .lte('date', dateFilter.end)
        .order('date', { ascending: false })

      if (error) throw error

      if (!data || data.length === 0) {
        toast.error('No data to export')
        return
      }

      const headers = ['Date', 'Type', 'Amount', 'Description', 'Payment Mode', 'Reference']
      const rows = data.map(t => [
        t.date,
        t.type,
        t.amount,
        `"${(t.description || '').replace(/"/g, '""')}"`,
        `"${(t.payment_mode || '').replace(/"/g, '""')}"`,
        `"${(t.reference || '').replace(/"/g, '""')}"`
      ])

      const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
      const encodedUri = encodeURI(csvContent)
      const link = document.createElement('a')
      link.setAttribute('href', encodedUri)
      link.setAttribute('download', `finance_report_${format(new Date(), 'yyyy-MM-dd')}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast.success('Export successful')
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Failed to export data')
    } finally {
      setExporting(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const quickActions = useMemo(() => [
    { 
      title: "New Voucher", 
      href: "/finance/transactions/new", 
      icon: Receipt, 
      desc: "Create receipt, payment, journal or transfer" 
    },
    { 
      title: "Chart of Accounts", 
      href: "/finance/accounts", 
      icon: AlertCircle, 
      desc: "Manage account heads" 
    },
    { 
      title: "Bank/Cash Accounts", 
      href: "/finance/bank-cash", 
      icon: Banknote, 
      desc: "Manage cash and bank accounts" 
    },
    { 
      title: "Transactions", 
      href: "/finance/transactions", 
      icon: CreditCard, 
      desc: "View all transactions" 
    },
    { 
      title: "Reports", 
      href: "/finance/reports", 
      icon: FileBarChart, 
      desc: "Cashbook, Ledger, Trial Balance" 
    },
  ], [])

  // Cleaned & Optimized Print Styles
  useEffect(() => {
    const style = document.createElement('style')
    style.innerHTML = `
      @media print {
        body * {
          visibility: hidden;
        }
        #print-area, #print-area * {
          visibility: visible;
        }
        #print-area {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          background: #fff !important;
          color: #000 !important;
          padding: 10px 20px;
        }
        .no-print {
          display: none !important;
        }
        .print-header-box {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          border-bottom: 2px solid #000;
          padding-bottom: 10px;
          margin-bottom: 16px;
        }
        .print-school-logo {
          height: 65px;
          width: auto;
          object-fit: contain;
        }
        .print-title-main {
          font-size: 22px;
          font-weight: 800;
          color: #000;
          line-height: 1.2;
        }
        .print-subtitle-sub {
          font-size: 13px;
          color: #000;
          line-height: 1.3;
        }
        .print-voucher-badge-container {
          text-align: center;
          margin-bottom: 16px;
        }
        .print-voucher-badge {
          display: inline-block;
          background-color: #000 !important;
          color: #fff !important;
          padding: 4px 18px;
          font-size: 14px;
          font-weight: bold;
          text-decoration: underline;
          text-underline-offset: 4px;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .print-voucher-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
          margin-top: 10px;
        }
        .print-voucher-table th,
        .print-voucher-table td {
          border: 1px solid #000;
          padding: 6px;
          text-align: left;
          color: #000 !important;
        }
        .print-voucher-table th {
          background-color: #000 !important;
          color: #fff !important;
          font-weight: bold;
          text-transform: uppercase;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .print-footer-signatures {
          margin-top: 50px;
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          font-weight: bold;
          color: #000;
        }
        .print-signature-line {
          border-top: 1px solid #000;
          padding-top: 4px;
          width: 140px;
          text-align: center;
        }
        .print-word-spec {
          margin-top: 15px;
          font-size: 12px;
          font-weight: bold;
          color: #000;
        }
      }
    `
    document.head.appendChild(style)
    return () => {
      document.head.removeChild(style)
    }
  }, [])

  const totalAmount = vouchers.reduce((sum, v) => sum + v.total_amount, 0)

  const numberToWords = (num: number): string => {
    if (num === 0) return 'Zero'
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine']
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
    
    const numStr = Math.floor(num).toString()
    if (numStr.length === 1) return ones[parseInt(numStr)]
    if (numStr.length === 2) {
      if (parseInt(numStr) < 20) return teens[parseInt(numStr) - 10]
      return tens[parseInt(numStr[0])] + (numStr[1] !== '0' ? ' ' + ones[parseInt(numStr[1])] : '')
    }
    if (numStr.length === 3) {
      return ones[parseInt(numStr[0])] + ' Hundred' + (numStr.slice(1) !== '00' ? ' ' + numberToWords(parseInt(numStr.slice(1))) : '')
    }
    if (numStr.length === 4) {
      return ones[parseInt(numStr[0])] + ' Thousand' + (numStr.slice(1) !== '000' ? ' ' + numberToWords(parseInt(numStr.slice(1))) : '')
    }
    if (numStr.length === 5) {
      return numberToWords(parseInt(numStr.slice(0, 2))) + ' Thousand' + (numStr.slice(2) !== '000' ? ' ' + numberToWords(parseInt(numStr.slice(2))) : '')
    }
    return numStr
  }

  return (
    <ResponsiveLayout>
      <div className="flex flex-col h-full lg:h-[calc(100vh-3.5rem)] p-2.5 sm:p-4 max-w-7xl mx-auto space-y-2.5 bg-slate-50/50 dark:bg-slate-950 overflow-y-auto lg:overflow-hidden text-slate-900 dark:text-slate-100">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0 no-print">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 leading-tight">
              Finance Management
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Double-Entry Bookkeeping & Smart Asset System
            </p>
          </div>
          
          <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => loadDashboardData()} 
              disabled={loading}
              className="h-8 px-2.5 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <RefreshCw className={cn("h-3.5 w-3.5 mr-1", loading && "animate-spin")} />
              Refresh
            </Button>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleExport} 
              disabled={exporting}
              className="h-8 px-2.5 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              {exporting ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
              Export
            </Button>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handlePrint} 
              className="h-8 px-2.5 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <Printer className="h-3.5 w-3.5 mr-1" />
              Print
            </Button>
            
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-28 sm:w-32 h-8 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100">
                <Calendar className="h-3.5 w-3.5 mr-1 text-slate-500 dark:text-slate-400" />
                <SelectValue placeholder="Select Period" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs">
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Dynamic Print Layout */}
        <div id="print-area" className="hidden print:block">
          <div className="print-header-box">
            {schoolSettings?.school_logo && (
              <img 
                src={schoolSettings.school_logo} 
                alt="School Logo" 
                className="print-school-logo"
              />
            )}
            <div>
              <div className="print-title-main">{schoolSettings?.school_name}</div>
              <div className="print-subtitle-sub">{schoolSettings?.school_address}</div>
              <div className="print-subtitle-sub">Phone: {schoolSettings?.school_phone}</div>
            </div>
          </div>

          <div className="print-voucher-badge-container">
            <div className="print-voucher-badge">
              Financial Summary Report
            </div>
          </div>

          <div className="flex justify-between items-center my-3 text-xs">
            <div><strong>Report Type:</strong> Financial Summary & Recent Vouchers</div>
            <div><strong>Date:</strong> {format(new Date(), 'dd MMM yyyy')}</div>
          </div>

          <table className="print-voucher-table">
            <thead>
              <tr>
                <th style={{ width: '5%' }}>SL</th>
                <th style={{ width: '20%' }}>Voucher No</th>
                <th style={{ width: '15%' }}>Type</th>
                <th style={{ width: '35%' }}>Paid To / Received From</th>
                <th style={{ width: '25%' }} className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {vouchers.map((v, i) => (
                <tr key={v.id}>
                  <td className="text-center">{i + 1}</td>
                  <td>{v.voucher_no}</td>
                  <td className="capitalize">{v.voucher_type}</td>
                  <td>{v.paid_to_received_from || 'N/A'}</td>
                  <td className="text-right">{formatCurrency(v.total_amount)}</td>
                </tr>
              ))}
              <tr style={{ fontWeight: 'bold', backgroundColor: '#f9f9f9' }}>
                <td colSpan={4} className="text-right">Total:</td>
                <td className="text-right">{formatCurrency(totalAmount)}</td>
              </tr>
            </tbody>
          </table>

          <div className="print-word-spec">
            Total Amount in word: {numberToWords(totalAmount)} Taka Only.
          </div>

          <div className="print-footer-signatures">
            <div className="print-signature-line">Prepared By</div>
            <div className="print-signature-line">Checked By</div>
            <div className="print-signature-line">Approved By</div>
          </div>
        </div>

        {/* Content Section */}
        {loading ? (
          <>
            <SummarySkeleton />
            <DashboardContentSkeleton />
          </>
        ) : (
          <>
            {/* Summary Cards Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 shrink-0 no-print">
              {summary.map((card, idx) => {
                const Icon = card.icon
                return (
                  <Card key={idx} className={cn("border bg-white dark:bg-slate-900 p-2.5 sm:p-3 shadow-sm rounded-lg backdrop-blur-sm", card.borderClass)}>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5 min-w-0">
                        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide truncate">{card.title}</p>
                        <p className={cn("text-base sm:text-lg font-black font-mono tracking-tight truncate", card.colorClass)}>
                          {formatCurrency(card.value)}
                        </p>
                      </div>
                      <div className={cn("p-2 rounded-md shrink-0 ml-1", card.bgClass)}>
                        <Icon className={cn("h-4 w-4 sm:h-5 sm:w-5", card.colorClass)} />
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>

            {/* Main Operational Split Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 flex-1 min-h-0 overflow-hidden no-print">
              
              {/* Recent Vouchers Card */}
              <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col min-h-0 overflow-hidden rounded-lg">
                <CardHeader className="py-2 px-3 bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200/80 dark:border-slate-800 shrink-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xs font-bold text-slate-900 dark:text-slate-100">Recent Vouchers</CardTitle>
                      <CardDescription className="text-[10px] text-slate-500 dark:text-slate-400">Latest financial transactions</CardDescription>
                    </div>
                    <Link href="/finance/transactions" className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-bold flex items-center">
                      View All <ChevronRight className="h-3 w-3 ml-0.5" />
                    </Link>
                  </div>
                </CardHeader>

                <CardContent className="p-0 flex-1 overflow-hidden flex flex-col justify-between">
                  {vouchers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center flex-1 p-4 text-center">
                      <Receipt className="h-8 w-8 text-slate-400 dark:text-slate-600 mb-2" />
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">No recent vouchers found</p>
                      <Link href="/finance/transactions/new" className="mt-2">
                        <Button size="sm" variant="outline" className="h-7 text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                          <Plus className="h-3.5 w-3.5 mr-1 text-emerald-600" /> Create First Voucher
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="w-full overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/60 flex flex-col h-full">
                      {/* Responsive Table Header */}
                      <div className="grid grid-cols-12 gap-2 px-3 py-1.5 text-[10px] font-extrabold uppercase text-slate-700 dark:text-slate-300 bg-slate-50/40 dark:bg-slate-800/30">
                        <div className="col-span-3 truncate">Type</div>
                        <div className="col-span-4 truncate">Party / Details</div>
                        <div className="col-span-2 truncate">Date</div>
                        <div className="col-span-3 text-right truncate">Amount</div>
                      </div>
                      
                      {/* Items Row Container */}
                      <div className="overflow-y-auto flex-1">
                        {vouchers.map((voucher) => (
                          <Link 
                            key={voucher.id} 
                            href={`/finance/transactions/${voucher.id}`}
                            className="grid grid-cols-12 gap-2 items-center px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                          >
                            <div className="col-span-3 min-w-0">
                              <Badge variant="outline" className="text-[9px] font-bold px-1.5 py-0 capitalize border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 truncate max-w-full">
                                {voucher.voucher_type}
                              </Badge>
                            </div>
                            <div className="col-span-4 font-medium text-slate-800 dark:text-slate-200 truncate text-[11px]">
                              {voucher.paid_to_received_from || '-'}
                            </div>
                            <div className="col-span-2 text-[10px] text-slate-500 dark:text-slate-400 truncate">
                              {format(new Date(voucher.voucher_date), 'dd MMM')}
                            </div>
                            <div className="col-span-3 text-right font-mono font-black text-xs text-slate-900 dark:text-slate-100 truncate">
                              {formatCurrency(voucher.total_amount)}
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick Actions Card */}
              <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col min-h-0 overflow-hidden rounded-lg">
                <CardHeader className="py-2 px-3 bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200/80 dark:border-slate-800 shrink-0">
                  <CardTitle className="text-xs font-bold text-slate-900 dark:text-slate-100">Quick Actions</CardTitle>
                  <CardDescription className="text-[10px] text-slate-500 dark:text-slate-400">Start frequent operations instantly</CardDescription>
                </CardHeader>
                
                <CardContent className="p-2.5 flex-1 overflow-y-auto">
                  <div className="grid gap-2">
                    {quickActions.map((action) => {
                      const ActionIcon = action.icon
                      return (
                        <Link 
                          key={action.title} 
                          href={action.href}
                          className="flex items-center gap-2.5 p-2 rounded-md border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group"
                        >
                          <div className="p-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white transition-colors shrink-0">
                            <ActionIcon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">{action.title}</div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{action.desc}</div>
                          </div>
                          <ChevronRight className="h-3.5 w-3.5 text-slate-400 dark:text-slate-600 group-hover:text-slate-700 dark:group-hover:text-slate-300 shrink-0" />
                        </Link>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

            </div>
          </>
        )}
      </div>
    </ResponsiveLayout>
  )
}
