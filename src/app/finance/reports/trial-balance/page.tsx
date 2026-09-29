// src/app/finance/reports/trial-balance/page.tsx
"use client"

import React, { useState, useEffect, useRef, forwardRef, useMemo } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Download,
  Loader2,
  Printer,
  FileBarChart,
  Calendar,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Wallet,
  Scale,
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

interface TrialBalanceRow {
  id: string
  code: string
  name: string
  account_type: string
  debit: number
  credit: number
  balance: number
  balance_type: "debit" | "credit" | "zero"
  has_transactions: boolean
  tx_count: number
}

const periodOptions = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "quarter", label: "This Quarter" },
  { value: "year", label: "This Year" },
  { value: "custom", label: "Custom Range" },
]

const accountTypeFilterOptions = [
  { value: "all", label: "All Account Types" },
  { value: "asset", label: "Assets" },
  { value: "liability", label: "Liabilities" },
  { value: "equity", label: "Equity" },
  { value: "revenue", label: "Revenue" },
  { value: "expense", label: "Expenses" },
]

// ═══════════════════════════════════════════════════════════════════════
// Helper: derive short code
// ═══════════════════════════════════════════════════════════════════════
function deriveCode(fa: any): string {
  const cat = (fa.account_category || "").toLowerCase()
  if (cat === "fixed_asset") return "FA"
  if (cat === "current_asset") return "CA"
  if (cat === "asset") {
    if (fa.type === "cash") return "CASH"
    if (fa.type === "bank") return "BANK"
    if (fa.type === "mobile_bank") return "MOB"
    return "ASSET"
  }
  if (cat === "payable") return "AP"
  if (cat === "loan") return "LOAN"
  if (cat === "liability") return "LIAB"
  if (cat === "capital") return "CAP"
  if (cat === "drawing") return "DRAW"
  if (cat === "equity") return "EQ"
  if (cat === "revenue") return "REV"
  if (cat === "expense") return "EXP"
  return "ACC"
}

// ═══════════════════════════════════════════════════════════════════════
// PRINT COMPONENT
// ═══════════════════════════════════════════════════════════════════════
const PrintComponent = forwardRef<
  HTMLDivElement,
  {
    schoolInfo: SchoolSettings | null
    trialData: TrialBalanceRow[]
    totalDebit: number
    totalCredit: number
    isBalanced: boolean
    periodLabel: string
    todayLabel: string
    accountTypeFilter: string
  }
>(({ schoolInfo, trialData, totalDebit, totalCredit, isBalanced, periodLabel, todayLabel }, ref) => {
  const schoolName = schoolInfo?.school_name || "মাদ্রাসাতুল সুনাহ আল মাদানী"
  const schoolAddress = schoolInfo?.school_address || "Nowtala, Madhaiya Bazar, Chandina, Cumilla"
  const schoolPhone = schoolInfo?.school_phone || "01923253454"

  return (
    <div
      ref={ref}
      className="print-content"
      style={{
        padding: "30px 40px",
        fontFamily: "Arial, sans-serif",
        backgroundColor: "white",
        color: "#1a1a1a",
        width: "210mm",
        minHeight: "297mm",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "20px",
          borderBottom: "3px double #1a1a1a",
          paddingBottom: "15px",
          marginBottom: "20px",
        }}
      >
        {schoolInfo?.school_logo && (
          <img
            src={schoolInfo.school_logo}
            alt="School Logo"
            style={{ height: "70px", width: "70px", objectFit: "contain", flexShrink: 0 }}
          />
        )}
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: "22px", fontWeight: "bold", margin: 0 }}>{schoolName}</h1>
          <p style={{ fontSize: "13px", color: "#4a4a4a", margin: "3px 0 0 0" }}>{schoolAddress}</p>
          <p style={{ fontSize: "13px", color: "#4a4a4a", margin: "2px 0 0 0" }}>Phone: {schoolPhone}</p>
        </div>
      </div>

      {/* TITLE */}
      <div style={{ textAlign: "center", marginBottom: "15px" }}>
        <h2
          style={{
            fontSize: "18px",
            fontWeight: "bold",
            textTransform: "uppercase",
            letterSpacing: "2px",
            margin: 0,
          }}
        >
          Trial Balance
        </h2>
      </div>

      {/* PERIOD */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
          fontSize: "13px",
          color: "#4a4a4a",
          borderBottom: "1px solid #e0e0e0",
          paddingBottom: "8px",
        }}
      >
        <span>
          <strong>Period:</strong> {periodLabel}
        </span>
        <span>
          <strong>Generated:</strong> {todayLabel}
        </span>
      </div>

      {/* TABLE */}
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          marginBottom: "20px",
          fontSize: "11px",
        }}
      >
        <thead>
          <tr style={{ backgroundColor: "#1a1a1a", color: "white" }}>
            <th style={{ padding: "5px 8px", textAlign: "left", border: "1px solid #333" }}>Code</th>
            <th style={{ padding: "5px 8px", textAlign: "left", border: "1px solid #333" }}>Account Name</th>
            <th style={{ padding: "5px 8px", textAlign: "left", border: "1px solid #333" }}>Type</th>
            <th style={{ padding: "5px 8px", textAlign: "right", border: "1px solid #333" }}>Debit</th>
            <th style={{ padding: "5px 8px", textAlign: "right", border: "1px solid #333" }}>Credit</th>
            <th style={{ padding: "5px 8px", textAlign: "right", border: "1px solid #333" }}>Balance</th>
          </tr>
        </thead>
        <tbody>
          {trialData.map((row, i) => (
            <tr key={row.id} style={{ backgroundColor: i % 2 === 0 ? "#f8fafc" : "white" }}>
              <td style={{ padding: "4px 8px", border: "1px solid #e0e0e0", fontFamily: "monospace" }}>
                {row.code}
              </td>
              <td style={{ padding: "4px 8px", border: "1px solid #e0e0e0" }}>
                {row.name}
                {row.tx_count === 0 && (
                  <span style={{ marginLeft: "6px", fontSize: "9px", color: "#999" }}>(no tx)</span>
                )}
              </td>
              <td
                style={{
                  padding: "4px 8px",
                  border: "1px solid #e0e0e0",
                  textTransform: "capitalize",
                }}
              >
                {row.account_type}
              </td>
              <td
                style={{
                  padding: "4px 8px",
                  textAlign: "right",
                  border: "1px solid #e0e0e0",
                  color: row.debit > 0 ? "#10b981" : "#666",
                }}
              >
                {row.debit > 0 ? formatCurrency(row.debit) : "-"}
              </td>
              <td
                style={{
                  padding: "4px 8px",
                  textAlign: "right",
                  border: "1px solid #e0e0e0",
                  color: row.credit > 0 ? "#ef4444" : "#666",
                }}
              >
                {row.credit > 0 ? formatCurrency(row.credit) : "-"}
              </td>
              <td
                style={{
                  padding: "4px 8px",
                  textAlign: "right",
                  border: "1px solid #e0e0e0",
                  fontWeight: "bold",
                }}
              >
                {formatCurrency(row.balance)}
              </td>
            </tr>
          ))}
          {trialData.length === 0 && (
            <tr>
              <td
                colSpan={6}
                style={{
                  padding: "4px 8px",
                  textAlign: "center",
                  border: "1px solid #e0e0e0",
                  color: "#666",
                }}
              >
                No accounts found
              </td>
            </tr>
          )}
          <tr style={{ backgroundColor: "#1a1a1a", color: "white", fontWeight: "bold" }}>
            <td colSpan={3} style={{ padding: "5px 8px", border: "1px solid #333" }}>
              TOTAL
            </td>
            <td
              style={{
                padding: "5px 8px",
                textAlign: "right",
                border: "1px solid #333",
                color: "#34d399",
              }}
            >
              {formatCurrency(totalDebit)}
            </td>
            <td
              style={{
                padding: "5px 8px",
                textAlign: "right",
                border: "1px solid #333",
                color: "#f87171",
              }}
            >
              {formatCurrency(totalCredit)}
            </td>
            <td
              style={{
                padding: "5px 8px",
                textAlign: "right",
                border: "1px solid #333",
                color: isBalanced ? "#34d399" : "#f87171",
              }}
            >
              {isBalanced ? "✅ Balanced" : `Diff: ${formatCurrency(Math.abs(totalDebit - totalCredit))}`}
            </td>
          </tr>
        </tbody>
      </table>

      {/* SIGNATURES */}
      <div style={{ marginTop: "30px", paddingTop: "20px", borderTop: "2px solid #e0e0e0" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "20px",
            textAlign: "center",
          }}
        >
          {["Prepared By", "Verified By", "Authorized By"].map((label) => (
            <div key={label}>
              <div
                style={{
                  borderBottom: "1px solid #1a1a1a",
                  paddingBottom: "2px",
                  marginBottom: "5px",
                  minHeight: "30px",
                }}
              ></div>
              <span style={{ fontSize: "12px", color: "#4a4a4a" }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* FOOTER */}
      <div
        style={{
          textAlign: "center",
          marginTop: "20px",
          paddingTop: "10px",
          borderTop: "1px solid #e0e0e0",
          fontSize: "11px",
          color: "#999",
        }}
      >
        <span>Powered by {schoolName} | Page 1 of 1</span>
      </div>
    </div>
  )
})

PrintComponent.displayName = "PrintComponent"

// ═══════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════
export default function TrialBalancePage() {
  const [schoolInfo, setSchoolInfo] = useState<SchoolSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [trialData, setTrialData] = useState<TrialBalanceRow[]>([])
  const [summary, setSummary] = useState({
    totalDebit: 0,
    totalCredit: 0,
    difference: 0,
  })
  const [selectedPeriod, setSelectedPeriod] = useState("month")
  const [customDate, setCustomDate] = useState<{ start: string; end: string } | null>(null)
  const [accountTypeFilter, setAccountTypeFilter] = useState("all")
  const [periodLabel, setPeriodLabel] = useState("")
  const [todayLabel, setTodayLabel] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
  const [accountTypeStats, setAccountTypeStats] = useState<
    Record<string, { count: number; balance: number; tx_count: number }>
  >({})
  const [hasTransactions, setHasTransactions] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadSchoolInfo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const initData = async () => {
      const dates = getPeriodDates()
      if (dates.start && dates.end && !isNaN(dates.start.getTime()) && !isNaN(dates.end.getTime())) {
        setPeriodLabel(`${format(dates.start, "MMM d, yyyy")} - ${format(dates.end, "MMM d, yyyy")}`)
      } else {
        const today = new Date()
        setPeriodLabel(`${format(today, "MMM d, yyyy")} - ${format(today, "MMM d, yyyy")}`)
      }
      setTodayLabel(format(new Date(), "MMM d, yyyy, h:mm:ss a"))
      await loadTrialBalance()
    }
    initData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeriod, customDate, accountTypeFilter])

  const loadSchoolInfo = async () => {
    try {
      const { data } = await supabase
        .from("school_settings")
        .select("school_name, school_address, school_phone, school_logo")
        .limit(1)
        .maybeSingle()
      if (data) setSchoolInfo(data)
    } catch (error) {
      console.error("Error loading school info:", error)
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
        end.setHours(23, 59, 59, 999) // End of day
        return { start, end }
      }
    }

    switch (selectedPeriod) {
      case "today": {
        const endOfDay = new Date(today)
        endOfDay.setHours(23, 59, 59, 999) // End of day
        return { start: today, end: endOfDay }
      }
      case "week": {
        const startOfWeek = new Date(today)
        startOfWeek.setDate(today.getDate() - 7)
        const endOfDay = new Date(today)
        endOfDay.setHours(23, 59, 59, 999) // End of day
        return { start: startOfWeek, end: endOfDay }
      }
      case "month": {
        const endOfDay = new Date(today)
        endOfDay.setHours(23, 59, 59, 999) // End of day
        return { start: startOfMonth, end: endOfDay }
      }
      case "quarter": {
        const endOfDay = new Date(today)
        endOfDay.setHours(23, 59, 59, 999) // End of day
        return { start: startOfQuarter, end: endOfDay }
      }
      case "year": {
        const endOfDay = new Date(today)
        endOfDay.setHours(23, 59, 59, 999) // End of day
        return { start: startOfYear, end: endOfDay }
      }
      default: {
        const endOfDay = new Date(today)
        endOfDay.setHours(23, 59, 59, 999) // End of day
        return { start: startOfMonth, end: endOfDay }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // LOAD TRIAL BALANCE — reads from journal_entries (2-step query)
  // ═══════════════════════════════════════════════════════════════════════
  const loadTrialBalance = async () => {
    setLoading(true)
    try {
      const dates = getPeriodDates()
      const startDate = format(dates.start, "yyyy-MM-dd")
      const endDate = format(dates.end, "yyyy-MM-dd")

      console.log("📊 Trial Balance date range:", {
        selectedPeriod,
        startDate,
        endDate,
        rawStart: dates.start,
        rawEnd: dates.end,
      })

      // ─────────────────────────────────────────────────────────────────
      // 1. Load ALL financial_accounts (chart of accounts)
      // ─────────────────────────────────────────────────────────────────
      const { data: accounts, error: accErr } = await supabase
        .from("financial_accounts")
        .select("id, account_name, type, account_category, is_balance_sheet")
        .eq("is_active", true)

      if (accErr) throw accErr

      const accountMeta: Record<string, { code: string; name: string; account_type: string }> = {}
      ;(accounts || []).forEach((a: any) => {
        let account_type = "asset"
        const cat = (a.account_category || "").toLowerCase()
        if (cat === "revenue") account_type = "revenue"
        else if (cat === "expense") account_type = "expense"
        else if (cat === "equity" || cat === "capital" || cat === "drawing") account_type = "equity"
        else if (cat === "liability" || cat === "payable" || cat === "loan") account_type = "liability"

        accountMeta[a.id] = {
          code: deriveCode(a),
          name: a.account_name,
          account_type,
        }
      })

      // ─────────────────────────────────────────────────────────────────
      // 2. Load vouchers in date range (TWO-STEP)
      // ─────────────────────────────────────────────────────────────────
      const { data: voucherRows, error: vErr } = await supabase
        .from("vouchers")
        .select("id")
        .gte("voucher_date", startDate)
        .lte("voucher_date", endDate)

      if (vErr) throw vErr

      console.log("📊 Vouchers in range:", voucherRows?.length || 0)
      console.log("📊 Voucher IDs:", (voucherRows || []).map((v: any) => v.id))

      const voucherIds = (voucherRows || []).map((v: any) => v.id)

      // ─────────────────────────────────────────────────────────────────
      // 3. Load journal entries for those vouchers
      // ─────────────────────────────────────────────────────────────────
      let jeData: any[] = []
      if (voucherIds.length > 0) {
        const { data: jeRows, error: jeErr } = await supabase
          .from("journal_entries")
          .select("debit, credit, account_id")
          .in("voucher_id", voucherIds)

        if (jeErr) throw jeErr
        jeData = jeRows || []
      }

      console.log("📊 Journal entries loaded:", jeData?.length || 0)

      // ─────────────────────────────────────────────────────────────────
      // 4. Aggregate per account
      // ─────────────────────────────────────────────────────────────────
      const agg: Record<string, { debit: number; credit: number; count: number }> = {}
      jeData.forEach((je: any) => {
        if (!je.account_id) return
        if (!agg[je.account_id]) agg[je.account_id] = { debit: 0, credit: 0, count: 0 }
        agg[je.account_id].debit += Number(je.debit) || 0
        agg[je.account_id].credit += Number(je.credit) || 0
        agg[je.account_id].count += 1
      })

      // ─────────────────────────────────────────────────────────────────
      // 5. Build rows (skip accounts with zero debit+credit)
      // ─────────────────────────────────────────────────────────────────
      const rows: TrialBalanceRow[] = Object.entries(agg)
        .map(([id, data]) => {
          const meta = accountMeta[id]
          if (!meta) return null
          const diff = data.debit - data.credit
          return {
            id,
            code: meta.code,
            name: meta.name,
            account_type: meta.account_type,
            debit: data.debit,
            credit: data.credit,
            balance: Math.abs(diff),
            balance_type: Math.abs(diff) < 0.01 ? "zero" : diff > 0 ? "debit" : "credit",
            has_transactions: data.count > 0,
            tx_count: data.count,
          } as TrialBalanceRow
        })
        .filter((r): r is TrialBalanceRow => r !== null)

      rows.sort((a, b) => a.code.localeCompare(b.code))

      // ─────────────────────────────────────────────────────────────────
      // 6. Filter by account type
      // ─────────────────────────────────────────────────────────────────
      const filtered =
        accountTypeFilter === "all"
          ? rows
          : rows.filter((r) => r.account_type === accountTypeFilter)

      setTrialData(filtered)
      setCurrentPage(1)
      setHasTransactions(rows.length > 0)

      // ─────────────────────────────────────────────────────────────────
      // 7. Stats per account type
      // ─────────────────────────────────────────────────────────────────
      const stats: Record<string, { count: number; balance: number; tx_count: number }> = {}
      rows.forEach((r) => {
        if (!stats[r.account_type]) stats[r.account_type] = { count: 0, balance: 0, tx_count: 0 }
        stats[r.account_type].count++
        stats[r.account_type].balance += r.balance
        stats[r.account_type].tx_count += r.tx_count
      })
      setAccountTypeStats(stats)

      // ─────────────────────────────────────────────────────────────────
      // 8. Totals
      // ─────────────────────────────────────────────────────────────────
      const totalDebit = filtered.reduce((s, r) => s + r.debit, 0)
      const totalCredit = filtered.reduce((s, r) => s + r.credit, 0)

      setSummary({ totalDebit, totalCredit, difference: totalDebit - totalCredit })

      if (rows.length === 0) {
        toast.warning("No journal entries found for this period.")
      } else {
        const isBal = Math.abs(totalDebit - totalCredit) < 0.01
        toast.success(
          isBal
            ? `Balanced ✅ (${rows.length} accounts)`
            : `Imbalance: ${formatCurrency(Math.abs(totalDebit - totalCredit))}`
        )
      }
    } catch (error: any) {
      console.error("Error loading trial balance:", error)
      toast.error("Failed to load: " + (error?.message || "unknown error"))
    } finally {
      setLoading(false)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PRINT
  // ═══════════════════════════════════════════════════════════════════════
  const handlePrint = () => {
    if (!printRef.current) {
      toast.error("Print content not ready")
      return
    }

    const printContent = printRef.current
    const printWindow = window.open("", "_blank", "width=800,height=600")

    if (!printWindow) {
      toast.error("Please allow popups for printing")
      return
    }

    const styles = `
      <style>
        @page { size: A4; margin: 0; }
        body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
        .print-content { width: 210mm; min-height: 297mm; padding: 30px 40px !important; background: white !important; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 4px 8px; border: 1px solid #e0e0e0; text-align: left; }
        th { background-color: #1a1a1a; color: white; }
        tr:nth-child(even) { background-color: #f8fafc; }
      </style>
    `

    const content = `
      <!DOCTYPE html>
      <html>
        <head><title>Trial Balance</title>${styles}</head>
        <body>
          ${printContent.outerHTML}
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }
          </script>
        </body>
      </html>
    `

    printWindow.document.write(content)
    printWindow.document.close()
  }

  // ═══════════════════════════════════════════════════════════════════════
  // EXPORT
  // ═══════════════════════════════════════════════════════════════════════
  const handleExport = async () => {
    setExporting(true)
    try {
      const headers = ["Account Code", "Account Name", "Account Type", "Debit", "Credit", "Balance", "Transactions"]
      const rows = trialData.map((r) => [
        r.code,
        r.name,
        r.account_type,
        r.debit,
        r.credit,
        r.balance,
        r.tx_count,
      ])

      const csvContent = [
        headers.join(","),
        ...rows.map((row) => row.map((v) => `"${v}"`).join(",")),
      ].join("\n")

      const blob = new Blob([csvContent], { type: "text/csv" })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `trial_balance_${format(new Date(), "yyyy-MM-dd")}.csv`
      a.click()
      window.URL.revokeObjectURL(url)

      toast.success("Export successful")
    } catch (error) {
      console.error("Export error:", error)
      toast.error("Failed to export")
    } finally {
      setExporting(false)
    }
  }

  const filteredData = useMemo(() => trialData, [trialData])
  const isBalanced = Math.abs(summary.difference) < 0.01

  const totalPages = Math.ceil(filteredData.length / itemsPerPage)
  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
    }
  }

  const getAccountTypeLabel = (type: string) => {
    const found = accountTypeFilterOptions.find((a) => a.value === type)
    return found ? found.label : type
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <ResponsiveLayout>
      <div className="space-y-3 sm:space-y-4 p-3 sm:p-4 md:p-6">
        {/* Hidden Print Component */}
        <div style={{ display: "none" }}>
          <PrintComponent
            ref={printRef}
            schoolInfo={schoolInfo}
            trialData={filteredData}
            totalDebit={summary.totalDebit}
            totalCredit={summary.totalCredit}
            isBalanced={isBalanced}
            periodLabel={periodLabel}
            todayLabel={todayLabel}
            accountTypeFilter={accountTypeFilter}
          />
        </div>

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/finance/reports">
              <Button
                variant="ghost"
                size="sm"
                className="print:hidden h-8 px-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              >
                <ArrowLeft className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Back</span>
              </Button>
            </Link>
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2 text-slate-900 dark:text-white">
                <div className="p-1.5 sm:p-2 rounded-lg bg-purple-100 dark:bg-purple-950/50">
                  <FileBarChart className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 dark:text-purple-400" />
                </div>
                Trial Balance
              </h1>
              <p className="text-[11px] sm:text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Account balances summary
              </p>
            </div>
          </div>

          <div className="flex gap-2 print:hidden flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={loadTrialBalance}
              className="h-8 px-2.5 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <RefreshCw className="h-3.5 w-3.5 sm:mr-1" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="h-8 px-2.5 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <Printer className="h-3.5 w-3.5 sm:mr-1" />
              <span className="hidden sm:inline">Print</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={exporting}
              className="h-8 px-2.5 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              {exporting ? (
                <Loader2 className="h-3.5 w-3.5 sm:mr-1 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5 sm:mr-1" />
              )}
              <span className="hidden sm:inline">{exporting ? "Exporting..." : "Export"}</span>
            </Button>
          </div>
        </div>

        {/* WARNING */}
        {!hasTransactions && !loading && (
          <div className="flex items-start sm:items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-lg">
            <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
            <span className="text-xs sm:text-sm text-amber-700 dark:text-amber-300">
              No journal entries found for this period.
            </span>
          </div>
        )}

        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-2.5 print:hidden">
          <Card className="border-emerald-200/80 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-sm">
            <CardContent className="p-2.5 sm:p-3">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide truncate">
                    Total Debit
                  </p>
                  <p className="text-base sm:text-lg font-black font-mono text-emerald-700 dark:text-emerald-400 truncate mt-0.5">
                    {formatCurrency(summary.totalDebit)}
                  </p>
                </div>
                <div className="p-1.5 sm:p-2 rounded-md bg-emerald-100 dark:bg-emerald-950/50 shrink-0 ml-1">
                  <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-rose-200/80 dark:border-rose-800/60 bg-rose-50/50 dark:bg-rose-950/20 shadow-sm">
            <CardContent className="p-2.5 sm:p-3">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-[11px] font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wide truncate">
                    Total Credit
                  </p>
                  <p className="text-base sm:text-lg font-black font-mono text-rose-700 dark:text-rose-400 truncate mt-0.5">
                    {formatCurrency(summary.totalCredit)}
                  </p>
                </div>
                <div className="p-1.5 sm:p-2 rounded-md bg-rose-100 dark:bg-rose-950/50 shrink-0 ml-1">
                  <TrendingDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-rose-600 dark:text-rose-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className={cn(
              "shadow-sm",
              isBalanced
                ? "border-blue-200/80 dark:border-blue-800/60 bg-blue-50/50 dark:bg-blue-950/20"
                : "border-rose-300/80 dark:border-rose-700/60 bg-rose-50/50 dark:bg-rose-950/30"
            )}
          >
            <CardContent className="p-2.5 sm:p-3">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p
                    className={cn(
                      "text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide truncate",
                      isBalanced
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-rose-600 dark:text-rose-400"
                    )}
                  >
                    Difference
                  </p>
                  <p
                    className={cn(
                      "text-base sm:text-lg font-black font-mono truncate mt-0.5",
                      isBalanced
                        ? "text-blue-700 dark:text-blue-400"
                        : "text-rose-700 dark:text-rose-400"
                    )}
                  >
                    {formatCurrency(Math.abs(summary.difference))}
                  </p>
                </div>
                <div
                  className={cn(
                    "p-1.5 sm:p-2 rounded-md shrink-0 ml-1",
                    isBalanced
                      ? "bg-blue-100 dark:bg-blue-950/50"
                      : "bg-rose-100 dark:bg-rose-950/50"
                  )}
                >
                  <Wallet
                    className={cn(
                      "h-3.5 w-3.5 sm:h-4 sm:w-4",
                      isBalanced
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-rose-600 dark:text-rose-400"
                    )}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className={cn(
              "shadow-sm",
              isBalanced
                ? "border-violet-200/80 dark:border-violet-800/60 bg-violet-50/50 dark:bg-violet-950/20"
                : "border-amber-300/80 dark:border-amber-700/60 bg-amber-50/50 dark:bg-amber-950/30"
            )}
          >
            <CardContent className="p-2.5 sm:p-3">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p
                    className={cn(
                      "text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide truncate",
                      isBalanced
                        ? "text-violet-600 dark:text-violet-400"
                        : "text-amber-600 dark:text-amber-400"
                    )}
                  >
                    Status
                  </p>
                  <p
                    className={cn(
                      "text-sm sm:text-base font-black tracking-tight truncate mt-0.5",
                      isBalanced
                        ? "text-violet-700 dark:text-violet-400"
                        : "text-amber-700 dark:text-amber-400"
                    )}
                  >
                    {isBalanced ? "Balanced ✅" : "Not Balanced ⚠️"}
                  </p>
                </div>
                <div
                  className={cn(
                    "p-1.5 sm:p-2 rounded-md shrink-0 ml-1",
                    isBalanced
                      ? "bg-violet-100 dark:bg-violet-950/50"
                      : "bg-amber-100 dark:bg-amber-950/50"
                  )}
                >
                  <Scale
                    className={cn(
                      "h-3.5 w-3.5 sm:h-4 sm:w-4",
                      isBalanced
                        ? "text-violet-600 dark:text-violet-400"
                        : "text-amber-600 dark:text-amber-400"
                    )}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ACCOUNT TYPE STATS */}
        {Object.keys(accountTypeStats).length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 print:hidden">
            {Object.entries(accountTypeStats).map(([type, stats]) => {
              const colors: Record<string, { bg: string; text: string; border: string }> = {
                asset: {
                  bg: "bg-blue-50 dark:bg-blue-950/20",
                  text: "text-blue-600 dark:text-blue-400",
                  border: "border-blue-200/80 dark:border-blue-800/60",
                },
                liability: {
                  bg: "bg-amber-50 dark:bg-amber-950/20",
                  text: "text-amber-600 dark:text-amber-400",
                  border: "border-amber-200/80 dark:border-amber-800/60",
                },
                equity: {
                  bg: "bg-purple-50 dark:bg-purple-950/20",
                  text: "text-purple-600 dark:text-purple-400",
                  border: "border-purple-200/80 dark:border-purple-800/60",
                },
                revenue: {
                  bg: "bg-emerald-50 dark:bg-emerald-950/20",
                  text: "text-emerald-600 dark:text-emerald-400",
                  border: "border-emerald-200/80 dark:border-emerald-800/60",
                },
                expense: {
                  bg: "bg-rose-50 dark:bg-rose-950/20",
                  text: "text-rose-600 dark:text-rose-400",
                  border: "border-rose-200/80 dark:border-rose-800/60",
                },
              }
              const c = colors[type] || colors.asset

              return (
                <Card key={type} className={cn("border shadow-sm", c.border, c.bg)}>
                  <CardContent className="p-2 sm:p-2.5">
                    <p
                      className={cn(
                        "text-[10px] font-bold uppercase tracking-wide capitalize truncate",
                        c.text
                      )}
                    >
                      {type}
                    </p>
                    <p className="text-sm sm:text-base font-black text-slate-900 dark:text-white mt-0.5">
                      {stats.count}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                      {formatCurrency(stats.balance)}
                    </p>
                    <p className="text-[9px] text-slate-400 dark:text-slate-500">
                      {stats.tx_count} tx
                    </p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* FILTERS */}
        <div className="flex items-center gap-2 print:hidden overflow-x-auto pb-1 scrollbar-hide flex-nowrap">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[130px] h-8 shrink-0 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100">
              <Calendar className="h-3 w-3 mr-1 text-slate-500 dark:text-slate-400" />
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
              {periodOptions.map((p) => (
                <SelectItem key={p.value} value={p.value} className="text-xs">
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedPeriod === "custom" && (
            <div className="flex items-center gap-1 shrink-0">
              <input
                type="date"
                value={customDate?.start || ""}
                onChange={(e) => setCustomDate({ start: e.target.value, end: customDate?.end || "" })}
                className="px-2 py-1 border rounded-md bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs w-[120px] text-slate-900 dark:text-slate-100"
              />
              <span className="text-slate-400 dark:text-slate-500 text-xs">to</span>
              <input
                type="date"
                value={customDate?.end || ""}
                onChange={(e) => setCustomDate({ start: customDate?.start || "", end: e.target.value })}
                className="px-2 py-1 border rounded-md bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs w-[120px] text-slate-900 dark:text-slate-100"
              />
            </div>
          )}

          <Select value={accountTypeFilter} onValueChange={setAccountTypeFilter}>
            <SelectTrigger className="w-[160px] h-8 shrink-0 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
              {accountTypeFilterOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* MAIN TABLE */}
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
          </div>
        ) : (
          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <CardHeader className="py-3 px-3 sm:px-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 dark:border-slate-800">
              <div className="min-w-0">
                <CardTitle className="text-sm sm:text-base text-slate-900 dark:text-white">
                  Account Balances
                </CardTitle>
                <CardDescription
                  className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate"
                  suppressHydrationWarning
                >
                  {periodLabel}{" "}
                  {accountTypeFilter !== "all" && ` • ${getAccountTypeLabel(accountTypeFilter)}`}
                </CardDescription>
              </div>
              <div className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 shrink-0">
                {filteredData.length} accounts{" "}
                {hasTransactions && `(${filteredData.filter((a) => a.has_transactions).length} with tx)`}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-100 dark:border-slate-800 hover:bg-transparent">
                      <TableHead className="min-w-[80px] text-[11px] sm:text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Code
                      </TableHead>
                      <TableHead className="min-w-[140px] text-[11px] sm:text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Account Name
                      </TableHead>
                      <TableHead className="min-w-[80px] text-[11px] sm:text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Type
                      </TableHead>
                      <TableHead className="text-right min-w-[80px] text-[11px] sm:text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Debit
                      </TableHead>
                      <TableHead className="text-right min-w-[80px] text-[11px] sm:text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Credit
                      </TableHead>
                      <TableHead className="text-right min-w-[90px] text-[11px] sm:text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Balance
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedData.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center py-12 text-slate-400 dark:text-slate-500"
                        >
                          <FileBarChart className="h-10 w-10 mx-auto mb-3 opacity-40" />
                          <p className="text-sm font-medium">No accounts found</p>
                          <p className="text-xs mt-1">Try adjusting the filters above</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedData.map((row, i) => (
                        <TableRow
                          key={row.id}
                          className={cn(
                            i % 2 === 0 ? "bg-slate-50/50 dark:bg-slate-800/30" : "bg-white dark:bg-slate-900",
                            "border-slate-100 dark:border-slate-800/60 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 transition-colors",
                            !row.has_transactions && "opacity-55"
                          )}
                        >
                          <TableCell className="font-mono text-[11px] sm:text-xs text-slate-700 dark:text-slate-300">
                            {row.code}
                          </TableCell>
                          <TableCell className="text-[11px] sm:text-xs text-slate-800 dark:text-slate-200">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="truncate max-w-[200px]" title={row.name}>
                                {row.name}
                              </span>
                              {!row.has_transactions && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 shrink-0">
                                  no tx
                                </span>
                              )}
                              {row.has_transactions && row.tx_count > 0 && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 font-semibold shrink-0">
                                  {row.tx_count}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-[11px] sm:text-xs capitalize text-slate-600 dark:text-slate-300">
                            <span
                              className={cn(
                                "inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold",
                                row.account_type === "asset" &&
                                  "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400",
                                row.account_type === "liability" &&
                                  "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
                                row.account_type === "equity" &&
                                  "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400",
                                row.account_type === "revenue" &&
                                  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400",
                                row.account_type === "expense" &&
                                  "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400"
                              )}
                            >
                              {row.account_type}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-mono text-[11px] sm:text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                            {row.debit > 0 ? formatCurrency(row.debit) : "-"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-[11px] sm:text-xs text-rose-600 dark:text-rose-400 font-semibold">
                            {row.credit > 0 ? formatCurrency(row.credit) : "-"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-[11px] sm:text-xs font-bold text-slate-900 dark:text-white">
                            {formatCurrency(row.balance)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}

                    {filteredData.length > 0 && (
                      <TableRow className="font-bold border-t-2 border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800/60">
                        <TableCell
                          colSpan={3}
                          className="text-xs uppercase tracking-wide text-slate-900 dark:text-white"
                        >
                          Total
                        </TableCell>
                        <TableCell className="text-right text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm font-mono font-bold">
                          {formatCurrency(summary.totalDebit)}
                        </TableCell>
                        <TableCell className="text-right text-rose-600 dark:text-rose-400 text-xs sm:text-sm font-mono font-bold">
                          {formatCurrency(summary.totalCredit)}
                        </TableCell>
                        <TableCell className="text-right text-xs sm:text-sm">
                          <span
                            className={cn(
                              "font-bold",
                              isBalanced
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-rose-600 dark:text-rose-400"
                            )}
                          >
                            {isBalanced
                              ? "✅ Balanced"
                              : `⚠️ ${formatCurrency(Math.abs(summary.difference))}`}
                          </span>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-3 sm:px-4 py-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                    Showing {(currentPage - 1) * itemsPerPage + 1}–
                    {Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="h-7 px-2 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40"
                    >
                      <ChevronLeft className="h-3 w-3" />
                    </Button>
                    <span className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 px-2 font-medium">
                      {currentPage} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="h-7 px-2 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40"
                    >
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </ResponsiveLayout>
  )
}