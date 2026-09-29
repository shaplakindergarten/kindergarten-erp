// src/app/finance/reports/source-wise/page.tsx
"use client"
import React, { useState, useEffect, useRef, forwardRef } from "react"
import Link from "next/link"
import { 
  ArrowLeft,
  Download,
  Loader2,
  Printer,
  PieChart,
  TrendingUp,
  TrendingDown,
  Calendar
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

interface SourceData {
  source: string
  source_type: string
  income: number
  expense: number
  net: number
  count: number
}

const sourceLabels: Record<string, { label: string; color: string; icon: any }> = {
  'fee_payment': { 
    label: 'Student Fees', 
    color: 'text-emerald-500',
    icon: TrendingUp
  },
  'inventory_purchase': { 
    label: 'Inventory Purchase', 
    color: 'text-rose-500',
    icon: TrendingDown
  },
  'inventory_sale': { 
    label: 'Inventory Sale', 
    color: 'text-blue-500',
    icon: TrendingUp
  },
  'salary_payment': { 
    label: 'Staff Salary', 
    color: 'text-amber-500',
    icon: TrendingDown
  },
  'manual_income': { 
    label: 'Manual Income', 
    color: 'text-emerald-500',
    icon: TrendingUp
  },
  'manual_expense': { 
    label: 'Manual Expense', 
    color: 'text-rose-500',
    icon: TrendingDown
  },
  'manual': { 
    label: 'Manual Entry', 
    color: 'text-gray-500',
    icon: TrendingUp
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

// Print Component - As per your design (Logo Left | School Info Right)
const PrintComponent = forwardRef<HTMLDivElement, {
  schoolInfo: SchoolSettings | null,
  reportData: SourceData[],
  summary: any,
  periodLabel: string,
  todayLabel: string
}>(({ schoolInfo, reportData, summary, periodLabel, todayLabel }, ref) => {
  const schoolName = schoolInfo?.school_name || 'মাদ্রাসাতুল সুনাহ আল মাদানী'
  
  return (
    <div ref={ref} className="print-content" style={{
      padding: '30px 40px',
      fontFamily: 'Arial, sans-serif',
      backgroundColor: 'white',
      color: '#1a1a1a',
      width: '210mm',
      minHeight: '297mm'
    }}>
      {/* ===== HEADER: Logo Left | School Info Right ===== */}
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
            {schoolInfo?.school_address || 'Nowtala, Madhaiya Bazar, Chandina, Cumilla'}
          </p>
          <p style={{ 
            fontSize: '13px', 
            color: '#4a4a4a',
            margin: '2px 0 0 0'
          }}>
            Phone: {schoolInfo?.school_phone || '01923253454'}
          </p>
        </div>
      </div>

      {/* ===== REPORT TITLE ===== */}
      <div style={{ textAlign: 'center', marginBottom: '15px' }}>
        <h2 style={{ 
          fontSize: '18px', 
          fontWeight: 'bold',
          textTransform: 'uppercase',
          letterSpacing: '2px',
          color: '#1a1a1a',
          margin: 0
        }}>
          Source-wise Report
        </h2>
      </div>

      {/* ===== PERIOD & GENERATED (Horizontal) ===== */}
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

      {/* ===== TABLE ===== */}
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        marginBottom: '20px',
        fontSize: '12px'
      }}>
        <thead>
          <tr style={{
            backgroundColor: '#1a1a1a',
            color: 'white'
          }}>
            <th style={{
              padding: '6px 10px',
              textAlign: 'left',
              border: '1px solid #333'
            }}>Source</th>
            <th style={{
              padding: '6px 10px',
              textAlign: 'right',
              border: '1px solid #333'
            }}>Income</th>
            <th style={{
              padding: '6px 10px',
              textAlign: 'right',
              border: '1px solid #333'
            }}>Expense</th>
            <th style={{
              padding: '6px 10px',
              textAlign: 'right',
              border: '1px solid #333'
            }}>Net</th>
            <th style={{
              padding: '6px 10px',
              textAlign: 'right',
              border: '1px solid #333'
            }}>Transactions</th>
            <th style={{
              padding: '6px 10px',
              textAlign: 'right',
              border: '1px solid #333'
            }}>% of Total</th>
          </tr>
        </thead>
        <tbody>
          {reportData.map((row, i) => {
            const config = sourceLabels[row.source_type]
            return (
              <tr key={i} style={{
                backgroundColor: i % 2 === 0 ? '#f8fafc' : 'white'
              }}>
                <td style={{
                  padding: '5px 10px',
                  border: '1px solid #e0e0e0',
                  fontWeight: '500'
                }}>{row.source}</td>
                <td style={{
                  padding: '5px 10px',
                  textAlign: 'right',
                  border: '1px solid #e0e0e0',
                  color: '#10b981'
                }}>{formatCurrency(row.income)}</td>
                <td style={{
                  padding: '5px 10px',
                  textAlign: 'right',
                  border: '1px solid #e0e0e0',
                  color: '#ef4444'
                }}>{formatCurrency(row.expense)}</td>
                <td style={{
                  padding: '5px 10px',
                  textAlign: 'right',
                  border: '1px solid #e0e0e0',
                  fontWeight: 'bold',
                  color: row.net >= 0 ? '#10b981' : '#ef4444'
                }}>{formatCurrency(row.net)}</td>
                <td style={{
                  padding: '5px 10px',
                  textAlign: 'right',
                  border: '1px solid #e0e0e0'
                }}>{row.count}</td>
                <td style={{
                  padding: '5px 10px',
                  textAlign: 'right',
                  border: '1px solid #e0e0e0'
                }}>
                  {summary.totalIncome + summary.totalExpense > 0 
                    ? (((row.income + row.expense) / (summary.totalIncome + summary.totalExpense)) * 100).toFixed(1) 
                    : 0}%
                </td>
              </tr>
            )
          })}
          {/* Total Row */}
          <tr style={{
            backgroundColor: '#1a1a1a',
            color: 'white',
            fontWeight: 'bold'
          }}>
            <td style={{
              padding: '6px 10px',
              border: '1px solid #333'
            }}>TOTAL</td>
            <td style={{
              padding: '6px 10px',
              textAlign: 'right',
              border: '1px solid #333',
              color: '#34d399'
            }}>{formatCurrency(summary.totalIncome)}</td>
            <td style={{
              padding: '6px 10px',
              textAlign: 'right',
              border: '1px solid #333',
              color: '#f87171'
            }}>{formatCurrency(summary.totalExpense)}</td>
            <td style={{
              padding: '6px 10px',
              textAlign: 'right',
              border: '1px solid #333',
              color: summary.netProfit >= 0 ? '#34d399' : '#f87171'
            }}>{formatCurrency(summary.netProfit)}</td>
            <td style={{
              padding: '6px 10px',
              textAlign: 'right',
              border: '1px solid #333'
            }}>{reportData.reduce((s, r) => s + r.count, 0)}</td>
            <td style={{
              padding: '6px 10px',
              textAlign: 'right',
              border: '1px solid #333'
            }}>100%</td>
          </tr>
        </tbody>
      </table>

      {/* ===== SIGNATURES ===== */}
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

      {/* ===== FOOTER ===== */}
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

export default function SourceWiseReportPage() {
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [schoolInfo, setSchoolInfo] = useState<SchoolSettings | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState('month')
  const [customDate, setCustomDate] = useState<{ start: string; end: string } | null>(null)
  const [reportData, setReportData] = useState<SourceData[]>([])
  const [periodLabel, setPeriodLabel] = useState('')
  const [todayLabel, setTodayLabel] = useState('')
  const [summary, setSummary] = useState({
    totalIncome: 0,
    totalExpense: 0,
    netProfit: 0,
    totalSources: 0
  })
  const printRef = useRef<HTMLDivElement>(null)

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
          padding: 5px 10px;
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
          <title>Source-wise Report</title>
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
      // Check if dates are valid
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

  const loadSchoolInfo = async () => {
    try {
      const { data } = await supabase.from('school_settings').select('school_name, school_address, school_phone, school_logo').limit(1).maybeSingle()
      if (data) setSchoolInfo(data)
    } catch (error) {
      console.error('Error loading school info:', error)
    }
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const dates = getPeriodDates()
      const startDate = format(dates.start, "yyyy-MM-dd")
      const endDate = format(dates.end, "yyyy-MM-dd")

      // 1. Load vouchers in date range
      const { data: vouchers, error: vErr } = await supabase
        .from("vouchers")
        .select("id, reference_no, voucher_type, voucher_date, total_amount")
        .gte("voucher_date", startDate)
        .lte("voucher_date", endDate)

      if (vErr) throw vErr

      const voucherIds = (vouchers || []).map((v: any) => v.id)

      // 2. Load journal entries for those vouchers
      let jeData: any[] = []
      if (voucherIds.length > 0) {
        const { data: jeRows, error: jeErr } = await supabase
          .from("journal_entries")
          .select("voucher_id, account_id, debit, credit")
          .in("voucher_id", voucherIds)

        if (jeErr) throw jeErr
        jeData = jeRows || []
      }

      // 3. Load financial_accounts metadata for accounts referenced in JEs
      const accountIds = Array.from(new Set(jeData.map((j) => j.account_id).filter(Boolean)))
      const accountMap: Record<string, { name: string; category: string }> = {}

      if (accountIds.length > 0) {
        const { data: accts, error: aErr } = await supabase
          .from("financial_accounts")
          .select("id, account_name, account_category")
          .in("id", accountIds)

        if (aErr) throw aErr

        for (const a of (accts || [])) {
          accountMap[a.id] = {
            name: a.account_name,
            category: (a.account_category || "").toLowerCase(),
          }
        }
      }

      // 4. Map voucher_id → reference_no (for source detection)
      const voucherRefMap: Record<string, string> = {}
      for (const v of (vouchers || [])) {
        voucherRefMap[v.id] = v.reference_no || ""
      }

      // 5. Determine source_type from reference_no prefix
      const getSourceTypeFromRef = (ref: string): string => {
        if (!ref) return "manual"
        if (ref.startsWith("FEE-")) return "fee_payment"
        if (ref.startsWith("SAL-")) return "salary_payment"
        if (ref.startsWith("SALE-")) return "inventory_sale"
        if (ref.startsWith("PUR-")) return "inventory_purchase"
        if (ref.startsWith("INC-")) return "manual_income"
        if (ref.startsWith("EXP-")) return "manual_expense"
        if (ref.startsWith("TRF-")) return "transfer"
        return "manual"
      }

      // 6. Aggregate by source (only revenue/expense accounts)
      const sourceMap: Record<string, { income: number; expense: number; count: number }> = {}

      for (const je of jeData) {
        const acct = accountMap[je.account_id]
        if (!acct) continue

        let amount = 0
        let txType: "income" | "expense" | null = null

        if (acct.category === "revenue") {
          amount = Number(je.credit) - Number(je.debit)
          if (amount > 0) {
            txType = "income"
          } else {
            continue
          }
        } else if (acct.category === "expense") {
          amount = Number(je.debit) - Number(je.credit)
          if (amount > 0) {
            txType = "expense"
          } else {
            continue
          }
        } else {
          continue
        }

        if (amount <= 0) continue

        const ref = voucherRefMap[je.voucher_id] || ""
        const sourceType = getSourceTypeFromRef(ref)
        if (sourceType === "transfer") continue

        if (!sourceMap[sourceType]) {
          sourceMap[sourceType] = { income: 0, expense: 0, count: 0 }
        }
        if (txType === "income") {
          sourceMap[sourceType].income += amount
        } else {
          sourceMap[sourceType].expense += amount
        }
        sourceMap[sourceType].count += 1
      }

      // 7. Format to SourceData[]
      const formattedData = Object.entries(sourceMap)
        .filter(([_, data]) => data.income + data.expense > 0)
        .map(([sourceType, data]) => ({
          source: sourceLabels[sourceType]?.label || sourceType,
          source_type: sourceType,
          income: data.income,
          expense: data.expense,
          net: data.income - data.expense,
          count: data.count,
        }))

      console.log("📊 Source-wise Report:", {
        vouchers: vouchers?.length || 0,
        journalEntries: jeData.length,
        accounts: Object.keys(accountMap).length,
        sources: formattedData,
      })

      setReportData(formattedData)

      const totalIncome = formattedData.reduce((sum, d) => sum + d.income, 0)
      const totalExpense = formattedData.reduce((sum, d) => sum + d.expense, 0)

      setSummary({
        totalIncome,
        totalExpense,
        netProfit: totalIncome - totalExpense,
        totalSources: formattedData.length,
      })
    } catch (error: any) {
      console.error("Error loading source-wise report:", error)
      toast.error("Failed: " + (error?.message || "unknown"))
    } finally {
      setLoading(false)
    }
  }

  // ===== FIXED: useEffect with proper date handling =====
  useEffect(() => {
    const initData = async () => {
      await loadSchoolInfo()
      const dates = getPeriodDates()
      
      // Ensure dates are valid before formatting
      if (dates.start && dates.end && !isNaN(dates.start.getTime()) && !isNaN(dates.end.getTime())) {
        setPeriodLabel(`${format(dates.start, 'MMM d, yyyy')} - ${format(dates.end, 'MMM d, yyyy')}`)
      } else {
        const today = new Date()
        setPeriodLabel(`${format(today, 'MMM d, yyyy')} - ${format(today, 'MMM d, yyyy')}`)
      }
      
      setTodayLabel(format(new Date(), 'MMM d, yyyy, h:mm:ss a'))
      await loadData()
    }
    
    initData()
  }, [selectedPeriod, customDate])

  const generateCSV = () => {
    const headers = ['Source', 'Income', 'Expense', 'Net', 'Transactions', '% of Total']
    const rows = reportData.map(r => [
      r.source,
      r.income,
      r.expense,
      r.net,
      r.count,
      summary.totalIncome + summary.totalExpense > 0 
        ? (((r.income + r.expense) / (summary.totalIncome + summary.totalExpense)) * 100).toFixed(1) 
        : 0
    ])

    rows.push([
      'TOTAL',
      summary.totalIncome,
      summary.totalExpense,
      summary.netProfit,
      reportData.reduce((s, r) => s + r.count, 0),
      '100%'
    ])

    const schoolName = schoolInfo?.school_name || 'মাদ্রাসাতুল সুনাহ আল মাদানী'
    const schoolAddress = schoolInfo?.school_address || 'Nowtala, Madhaiya Bazar, Chandina, Cumilla'
    const schoolPhone = schoolInfo?.school_phone || '01923253454'
    
    const csvLines = [
      `"${schoolName}"`,
      `"${schoolAddress}"`,
      `"Phone: ${schoolPhone}"`,
      `"Source-wise Report"`,
      `"Period: ${periodLabel}"`,
      `"Generated: ${todayLabel}"`,
      '',
      headers.join(','),
      ...rows.map(row => row.map(v => `"${v}"`).join(','))
    ]

    return csvLines.join('\n')
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const csvContent = generateCSV()
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `source_wise_report_${format(new Date(), 'yyyy-MM-dd')}.csv`
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

  return (
    <ResponsiveLayout>
      <div className="space-y-6 p-4 md:p-6">
        {/* Hidden Print Component */}
        <div style={{ display: 'none' }}>
          <PrintComponent
            ref={printRef}
            schoolInfo={schoolInfo}
            reportData={reportData}
            summary={summary}
            periodLabel={periodLabel}
            todayLabel={todayLabel}
          />
        </div>

        {/* Screen View */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/finance/reports">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Reports
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
                <PieChart className="h-6 w-6 text-amber-500" />
                Source-wise Report
              </h1>
              <p className="text-muted-foreground">Income and expense breakdown by source</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
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

        {/* Period Selector */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-[160px]">
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
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Summary Cards - Responsive */}
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
              <Card>
                <CardContent className="p-3 md:p-4">
                  <p className="text-xs md:text-sm text-muted-foreground">Total Income</p>
                  <p className="text-lg md:text-2xl font-bold text-emerald-500 dark:text-emerald-400">
                    {formatCurrency(summary.totalIncome)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 md:p-4">
                  <p className="text-xs md:text-sm text-muted-foreground">Total Expense</p>
                  <p className="text-lg md:text-2xl font-bold text-rose-500 dark:text-rose-400">
                    {formatCurrency(summary.totalExpense)}
                  </p>
                </CardContent>
              </Card>
              <Card className={cn(
                "border-2",
                summary.netProfit >= 0 
                  ? "border-emerald-500/50 dark:border-emerald-400/50" 
                  : "border-rose-500/50 dark:border-rose-400/50"
              )}>
                <CardContent className="p-3 md:p-4">
                  <p className="text-xs md:text-sm text-muted-foreground">Net Profit</p>
                  <p className={cn(
                    "text-lg md:text-2xl font-bold",
                    summary.netProfit >= 0 ? "text-emerald-500 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"
                  )}>
                    {formatCurrency(summary.netProfit)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 md:p-4">
                  <p className="text-xs md:text-sm text-muted-foreground">Active Sources</p>
                  <p className="text-lg md:text-2xl font-bold dark:text-white">
                    {summary.totalSources}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Main Table - Responsive with Dark Mode */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base md:text-lg dark:text-white">Source Breakdown</CardTitle>
                <CardDescription className="text-xs md:text-sm dark:text-gray-400">
                  Detailed analysis by source
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[140px] dark:text-gray-300">Source</TableHead>
                        <TableHead className="text-right min-w-[90px] dark:text-gray-300">Income</TableHead>
                        <TableHead className="text-right min-w-[90px] dark:text-gray-300">Expense</TableHead>
                        <TableHead className="text-right min-w-[90px] dark:text-gray-300">Net</TableHead>
                        <TableHead className="text-right min-w-[80px] dark:text-gray-300">Transactions</TableHead>
                        <TableHead className="text-right min-w-[80px] dark:text-gray-300">% of Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData.length > 0 ? (
                        reportData.map((row, i) => {
                          const config = sourceLabels[row.source_type]
                          return (
                            <TableRow 
                              key={i} 
                              className={cn(
                                i % 2 === 0 ? "bg-muted/20 dark:bg-muted/5" : "",
                                "dark:border-gray-700"
                              )}
                            >
                              <TableCell className="font-medium text-xs md:text-sm dark:text-gray-300">
                                <span className={cn(config?.color || '', "dark:font-medium")}>
                                  {row.source}
                                </span>
                              </TableCell>
                              <TableCell className="text-right text-emerald-500 dark:text-emerald-400 text-xs md:text-sm">
                                {formatCurrency(row.income)}
                              </TableCell>
                              <TableCell className="text-right text-rose-500 dark:text-rose-400 text-xs md:text-sm">
                                {formatCurrency(row.expense)}
                              </TableCell>
                              <TableCell className={cn(
                                "text-right font-bold text-xs md:text-sm",
                                row.net >= 0 ? "text-emerald-500 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"
                              )}>
                                {formatCurrency(row.net)}
                              </TableCell>
                              <TableCell className="text-right text-xs md:text-sm dark:text-gray-300">{row.count}</TableCell>
                              <TableCell className="text-right text-xs md:text-sm dark:text-gray-300">
                                {summary.totalIncome + summary.totalExpense > 0 
                                  ? (((row.income + row.expense) / (summary.totalIncome + summary.totalExpense)) * 100).toFixed(1) 
                                  : 0}%
                              </TableCell>
                            </TableRow>
                          )
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm dark:text-gray-400">
                            No data found for this period
                          </TableCell>
                        </TableRow>
                      )}
                      {reportData.length > 0 && (
                        <TableRow className="font-bold border-t-2 dark:border-gray-700">
                          <TableCell className="text-xs md:text-sm dark:text-white">TOTAL</TableCell>
                          <TableCell className="text-right text-emerald-500 dark:text-emerald-400 text-xs md:text-sm">
                            {formatCurrency(summary.totalIncome)}
                          </TableCell>
                          <TableCell className="text-right text-rose-500 dark:text-rose-400 text-xs md:text-sm">
                            {formatCurrency(summary.totalExpense)}
                          </TableCell>
                          <TableCell className={cn(
                            "text-right text-xs md:text-sm",
                            summary.netProfit >= 0 ? "text-emerald-500 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"
                          )}>
                            {formatCurrency(summary.netProfit)}
                          </TableCell>
                          <TableCell className="text-right text-xs md:text-sm dark:text-white">
                            {reportData.reduce((s, r) => s + r.count, 0)}
                          </TableCell>
                          <TableCell className="text-right text-xs md:text-sm dark:text-white">100%</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Summary Footer - Responsive */}
            <Card className="bg-muted/30 dark:bg-muted/10 dark:border-gray-700">
              <CardContent className="p-3 md:p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 text-xs md:text-sm">
                  <div>
                    <span className="text-muted-foreground dark:text-gray-400">Total Income:</span>
                    <span className="text-emerald-500 dark:text-emerald-400 font-medium ml-1 md:ml-2">
                      {formatCurrency(summary.totalIncome)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground dark:text-gray-400">Total Expense:</span>
                    <span className="text-rose-500 dark:text-rose-400 font-medium ml-1 md:ml-2">
                      {formatCurrency(summary.totalExpense)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground dark:text-gray-400">Net Profit:</span>
                    <span className={cn(
                      "font-medium ml-1 md:ml-2",
                      summary.netProfit >= 0 ? "text-emerald-500 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"
                    )}>
                      {formatCurrency(summary.netProfit)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground dark:text-gray-400">Total Sources:</span>
                    <span className="font-medium ml-1 md:ml-2 dark:text-white">
                      {summary.totalSources}
                    </span>
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
