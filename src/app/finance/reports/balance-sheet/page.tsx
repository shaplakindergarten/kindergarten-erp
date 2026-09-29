// src/app/finance/reports/balance-sheet/page.tsx
"use client"

import React, { useState, useEffect, useRef, forwardRef } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Download,
  Loader2,
  Printer,
  DollarSign,
  Building2,
  Wallet,
  Scale,
  Calendar,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  TrendingDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableRow, TableCell } from "@/components/ui/table"
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

interface BsAccount {
  id: string
  code: string
  name: string
  category: string
  balance: number
  debit_total: number
  credit_total: number
  has_transactions: boolean
  tx_count: number
}

interface BsGroup {
  category: string
  label: string
  accounts: BsAccount[]
  total: number
}

const periodOptions = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "quarter", label: "This Quarter" },
  { value: "year", label: "This Year" },
  { value: "custom", label: "Custom Range" },
]

const CATEGORY_GROUPS = {
  current_asset: { label: "Current Assets", group: "asset", order: 1 },
  fixed_asset: { label: "Fixed Assets", group: "asset", order: 2 },
  asset: { label: "Cash & Bank", group: "asset", order: 0 },
  payable: { label: "Accounts Payable", group: "liability", order: 1 },
  loan: { label: "Loans", group: "liability", order: 2 },
  liability: { label: "Other Liabilities", group: "liability", order: 3 },
  capital: { label: "Capital", group: "equity", order: 1 },
  drawing: { label: "Drawings", group: "equity", order: 2 },
  equity: { label: "Retained Earnings", group: "equity", order: 3 },
} as const

function getCodeFromCategory(category: string, type: string): string {
  if (category === "fixed_asset") return "FA"
  if (category === "current_asset") return "CA"
  if (category === "asset") {
    if (type === "cash") return "CASH"
    if (type === "bank") return "BANK"
    if (type === "mobile_bank") return "MOB"
    return "ASSET"
  }
  if (category === "payable") return "AP"
  if (category === "loan") return "LOAN"
  if (category === "liability") return "LIAB"
  if (category === "capital") return "CAP"
  if (category === "drawing") return "DRAW"
  if (category === "equity") return "EQ"
  return category.toUpperCase()
}

// ═══════════════════════════════════════════════════════════════════════
// PRINT COMPONENT
// ═══════════════════════════════════════════════════════════════════════
const PrintComponent = forwardRef<
  HTMLDivElement,
  {
    schoolInfo: SchoolSettings | null
    assetGroups: BsGroup[]
    liabilityGroups: BsGroup[]
    equityGroups: BsGroup[]
    totalAssets: number
    totalLiabilities: number
    totalEquity: number
    netProfit: number
    retainedEarnings: number
    totalLiabilitiesAndEquity: number
    difference: number
    isBalanced: boolean
    periodLabel: string
    todayLabel: string
  }
>(
  (
    {
      schoolInfo,
      assetGroups,
      liabilityGroups,
      equityGroups,
      totalAssets,
      totalLiabilities,
      totalEquity,
      netProfit,
      retainedEarnings,
      totalLiabilitiesAndEquity,
      difference,
      isBalanced,
      periodLabel,
      todayLabel,
    },
    ref
  ) => {
    const schoolName = schoolInfo?.school_name || "মাদ্রাসাতুল সুনাহ আল মাদানী"
    const schoolAddress = schoolInfo?.school_address || "Nowtala, Madhaiya Bazar, Chandina, Cumilla"
    const schoolPhone = schoolInfo?.school_phone || "01923253454"

    const renderGroup = (group: BsGroup, color: string) => {
      if (group.accounts.length === 0 && group.total === 0) return null
      return (
        <div key={group.category} style={{ marginBottom: "8px" }}>
          <div
            style={{
              fontSize: "10px",
              fontWeight: "bold",
              color: "#444",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              paddingBottom: "2px",
              borderBottom: "1px dashed #ccc",
              marginBottom: "3px",
            }}
          >
            {group.label}
          </div>
          {group.accounts.map((acc) => (
            <div
              key={acc.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "10px",
                padding: "1px 0",
                color: "#1a1a1a",
              }}
            >
              <span style={{ paddingLeft: "8px" }}>
                {acc.name}
                {!acc.has_transactions && (
                  <span style={{ color: "#999", fontSize: "8px" }}> (no tx)</span>
                )}
              </span>
              <span style={{ fontFamily: "monospace", color }}>
                {formatCurrency(acc.balance)}
              </span>
            </div>
          ))}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "10px",
              fontWeight: "bold",
              paddingTop: "2px",
              borderTop: "1px solid #e0e0e0",
              marginTop: "2px",
            }}
          >
            <span style={{ paddingLeft: "8px" }}>Total {group.label}</span>
            <span style={{ fontFamily: "monospace" }}>{formatCurrency(group.total)}</span>
          </div>
        </div>
      )
    }

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
            <h1 style={{ fontSize: "22px", fontWeight: "bold", margin: 0, letterSpacing: "1px" }}>
              {schoolName}
            </h1>
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
            Balance Sheet
          </h2>
          <p style={{ fontSize: "13px", color: "#4a4a4a", marginTop: "3px" }}>As of {periodLabel}</p>
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

        {/* TWO COLUMN */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
          {/* ASSETS */}
          <div>
            <h3
              style={{
                fontSize: "14px",
                fontWeight: "bold",
                marginBottom: "8px",
                color: "#2563eb",
                borderBottom: "2px solid #2563eb",
                paddingBottom: "3px",
              }}
            >
              ASSETS
            </h3>
            {assetGroups.map((g) => renderGroup(g, "#2563eb"))}
            {assetGroups.every((g) => g.accounts.length === 0) && (
              <div style={{ fontSize: "10px", color: "#999", padding: "10px 0" }}>
                No assets found
              </div>
            )}
            <div
              style={{
                marginTop: "10px",
                padding: "8px 12px",
                backgroundColor: "#eff6ff",
                border: "2px solid #2563eb",
                borderRadius: "4px",
                display: "flex",
                justifyContent: "space-between",
                fontWeight: "bold",
                fontSize: "13px",
              }}
            >
              <span style={{ color: "#1e40af" }}>TOTAL ASSETS</span>
              <span style={{ fontFamily: "monospace", color: "#2563eb" }}>
                {formatCurrency(totalAssets)}
              </span>
            </div>
          </div>

          {/* LIABILITIES + EQUITY */}
          <div>
            <h3
              style={{
                fontSize: "14px",
                fontWeight: "bold",
                marginBottom: "8px",
                color: "#d97706",
                borderBottom: "2px solid #d97706",
                paddingBottom: "3px",
              }}
            >
              LIABILITIES
            </h3>
            {liabilityGroups.map((g) => renderGroup(g, "#d97706"))}
            {liabilityGroups.every((g) => g.accounts.length === 0) && (
              <div style={{ fontSize: "10px", color: "#999", padding: "10px 0" }}>
                No liabilities found
              </div>
            )}
            <div
              style={{
                marginTop: "6px",
                marginBottom: "15px",
                padding: "6px 12px",
                backgroundColor: "#fef3c7",
                border: "1px solid #d97706",
                borderRadius: "4px",
                display: "flex",
                justifyContent: "space-between",
                fontWeight: "bold",
                fontSize: "11px",
              }}
            >
              <span style={{ color: "#92400e" }}>TOTAL LIABILITIES</span>
              <span style={{ fontFamily: "monospace", color: "#d97706" }}>
                {formatCurrency(totalLiabilities)}
              </span>
            </div>

            <h3
              style={{
                fontSize: "14px",
                fontWeight: "bold",
                marginBottom: "8px",
                color: "#7c3aed",
                borderBottom: "2px solid #7c3aed",
                paddingBottom: "3px",
              }}
            >
              EQUITY
            </h3>
            {equityGroups.map((g) => renderGroup(g, "#7c3aed"))}

            <div style={{ marginTop: "6px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "10px",
                  padding: "2px 0 2px 8px",
                  color: "#1a1a1a",
                }}
              >
                <span>Net {netProfit >= 0 ? "Profit" : "Loss"} (Current Period)</span>
                <span
                  style={{
                    fontFamily: "monospace",
                    color: netProfit >= 0 ? "#059669" : "#dc2626",
                  }}
                >
                  {formatCurrency(netProfit)}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "10px",
                  padding: "2px 0 2px 8px",
                  fontWeight: "bold",
                  borderTop: "1px dashed #ccc",
                  marginTop: "2px",
                  paddingTop: "4px",
                }}
              >
                <span>Retained Earnings (Cumulative)</span>
                <span style={{ fontFamily: "monospace" }}>
                  {formatCurrency(retainedEarnings)}
                </span>
              </div>
            </div>

            <div
              style={{
                marginTop: "6px",
                padding: "6px 12px",
                backgroundColor: "#f5f3ff",
                border: "1px solid #7c3aed",
                borderRadius: "4px",
                display: "flex",
                justifyContent: "space-between",
                fontWeight: "bold",
                fontSize: "11px",
              }}
            >
              <span style={{ color: "#5b21b6" }}>TOTAL EQUITY</span>
              <span style={{ fontFamily: "monospace", color: "#7c3aed" }}>
                {formatCurrency(totalEquity + retainedEarnings)}
              </span>
            </div>

            <div
              style={{
                marginTop: "15px",
                padding: "10px 12px",
                border: `2px solid ${isBalanced ? "#10b981" : "#ef4444"}`,
                borderRadius: "6px",
                backgroundColor: isBalanced ? "#f0fdf4" : "#fef2f2",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: "13px", fontWeight: "bold" }}>
                TOTAL LIABILITIES + EQUITY
              </span>
              <span
                style={{
                  fontSize: "14px",
                  fontFamily: "monospace",
                  fontWeight: "bold",
                  color: "#6366f1",
                }}
              >
                {formatCurrency(totalLiabilitiesAndEquity)}
              </span>
            </div>

            <div
              style={{
                marginTop: "6px",
                fontSize: "10px",
                textAlign: "right",
                color: isBalanced ? "#10b981" : "#ef4444",
                fontWeight: "bold",
              }}
            >
              Difference: {formatCurrency(Math.abs(difference))}
              {isBalanced ? " ✅ Balanced" : " ❌ Not Balanced"}
            </div>
          </div>
        </div>

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
  }
)

PrintComponent.displayName = "PrintComponent"

// ═══════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════
export default function BalanceSheetPage() {
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [schoolInfo, setSchoolInfo] = useState<SchoolSettings | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState("year")
  const [customDate, setCustomDate] = useState<{ start: string; end: string } | null>(null)

  const [assetGroups, setAssetGroups] = useState<BsGroup[]>([])
  const [liabilityGroups, setLiabilityGroups] = useState<BsGroup[]>([])
  const [equityGroups, setEquityGroups] = useState<BsGroup[]>([])

  const [summary, setSummary] = useState({
    totalAssets: 0,
    totalLiabilities: 0,
    totalEquity: 0,
    netProfit: 0,
    retainedEarnings: 0,
    totalLiabilitiesAndEquity: 0,
    difference: 0,
  })

  const [periodLabel, setPeriodLabel] = useState("")
  const [todayLabel, setTodayLabel] = useState("")
  const [hasTransactions, setHasTransactions] = useState(false)

  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadSchoolInfo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const dates = getPeriodDates()
    setPeriodLabel(`As of ${format(dates.end, "MMM d, yyyy")}`)
    setTodayLabel(format(new Date(), "MMM d, yyyy, h:mm:ss a"))
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeriod, customDate])

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
        return { start, end }
      }
    }

    switch (selectedPeriod) {
      case "today":
        return { start: today, end: today }
      case "week": {
        const startOfWeek = new Date(today)
        startOfWeek.setDate(today.getDate() - 7)
        return { start: startOfWeek, end: today }
      }
      case "month":
        return { start: startOfMonth, end: today }
      case "quarter":
        return { start: startOfQuarter, end: today }
      case "year":
        return { start: startOfYear, end: today }
      default:
        return { start: startOfYear, end: today }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // LOAD DATA — journal_entries only (2-step query)
  // ═══════════════════════════════════════════════════════════════════════
  const loadData = async () => {
    setLoading(true)
    try {
      const dates = getPeriodDates()
      const endDate = format(dates.end, "yyyy-MM-dd")

      // 1. Load all financial accounts (BS + P&L for net profit)
      const { data: accounts, error: accErr } = await supabase
        .from("financial_accounts")
        .select("id, account_name, type, account_category, current_balance")
        .eq("is_active", true)

      if (accErr) throw accErr

      // 2. Load vouchers up to endDate
      const { data: voucherRows, error: vErr } = await supabase
        .from("vouchers")
        .select("id")
        .lte("voucher_date", endDate)

      if (vErr) throw vErr

      const voucherIds = (voucherRows || []).map((v: any) => v.id)

      // 3. Load journal entries
      let jeData: any[] = []
      if (voucherIds.length > 0) {
        const { data: jeRows, error: jeErr } = await supabase
          .from("journal_entries")
          .select("debit, credit, account_id")
          .in("voucher_id", voucherIds)

        if (jeErr) throw jeErr
        jeData = jeRows || []
      }

      // 4. Aggregate per account
      const debitMap: Record<string, number> = {}
      const creditMap: Record<string, number> = {}
      const countMap: Record<string, number> = {}

      jeData.forEach((je: any) => {
        if (!je.account_id) return
        debitMap[je.account_id] = (debitMap[je.account_id] || 0) + (Number(je.debit) || 0)
        creditMap[je.account_id] = (creditMap[je.account_id] || 0) + (Number(je.credit) || 0)
        countMap[je.account_id] = (countMap[je.account_id] || 0) + 1
      })

      // 5. Compute Net Profit from revenue/expense accounts via journal entries
      let totalRevenue = 0
      let totalExpense = 0

      for (const a of (accounts || [])) {
        const cat = (a.account_category || "").toLowerCase()
        const dr = debitMap[a.id] || 0
        const cr = creditMap[a.id] || 0

        if (cat === "revenue") {
          totalRevenue += cr - dr
        } else if (cat === "expense") {
          totalExpense += dr - cr
        }
      }
      const netProfit = totalRevenue - totalExpense

      // 6. Build BsAccount list
      const built: BsAccount[] = (accounts || []).map((a: any) => {
        const cat = (a.account_category || "asset").toLowerCase()
        const dr = debitMap[a.id] || 0
        const cr = creditMap[a.id] || 0
        const txCount = countMap[a.id] || 0

        // Assets: Dr - Cr | Others: Cr - Dr
        let bal = 0
        if (cat === "asset" || cat === "fixed_asset" || cat === "current_asset") {
          bal = dr - cr
        } else {
          bal = cr - dr
        }

        // Fallback to current_balance if no journal entries
        if (txCount === 0 && Number(a.current_balance) !== 0) {
          bal = Number(a.current_balance)
        }

        return {
          id: a.id,
          code: getCodeFromCategory(cat, a.type),
          name: a.account_name,
          category: cat,
          balance: Math.abs(bal),
          debit_total: dr,
          credit_total: cr,
          has_transactions: txCount > 0,
          tx_count: txCount,
        }
      })

      // 7. Group
      const groupBy = (grpType: "asset" | "liability" | "equity"): BsGroup[] => {
        const filtered = built.filter((a) => {
          const meta = CATEGORY_GROUPS[a.category as keyof typeof CATEGORY_GROUPS]
          return meta && meta.group === grpType
        })
        const map = new Map<string, BsAccount[]>()
        filtered.forEach((a) => {
          if (!map.has(a.category)) map.set(a.category, [])
          map.get(a.category)!.push(a)
        })
        return Array.from(map.entries())
          .map(([category, accs]) => ({
            category,
            label:
              CATEGORY_GROUPS[category as keyof typeof CATEGORY_GROUPS]?.label || category,
            accounts: accs.sort((x, y) => x.name.localeCompare(y.name)),
            total: accs.reduce((s, a) => s + a.balance, 0),
          }))
          .sort((x, y) => {
            const ox = CATEGORY_GROUPS[x.category as keyof typeof CATEGORY_GROUPS]?.order ?? 99
            const oy = CATEGORY_GROUPS[y.category as keyof typeof CATEGORY_GROUPS]?.order ?? 99
            return ox - oy
          })
      }

      const assetGroups = groupBy("asset")
      const liabilityGroups = groupBy("liability")
      const equityGroups = groupBy("equity")

      const totalAssets = assetGroups.reduce((s, g) => s + g.total, 0)
      const totalLiabilities = liabilityGroups.reduce((s, g) => s + g.total, 0)
      const totalEquity = equityGroups.reduce((s, g) => s + g.total, 0)
      const retainedEarnings = netProfit
      const totalLiabilitiesAndEquity = totalLiabilities + totalEquity + retainedEarnings

      console.log("📊 Balance Sheet calculation:", {
        accountsLoaded: (accounts || []).length,
        vouchersInRange: voucherIds.length,
        journalEntriesLoaded: jeData.length,
        totalRevenue,
        totalExpense,
        netProfit,
        totalAssets,
        totalLiabilities,
        totalEquity,
        retainedEarnings: netProfit,
        totalLiabilitiesAndEquity,
        difference: totalAssets - totalLiabilitiesAndEquity,
      })

      setAssetGroups(assetGroups)
      setLiabilityGroups(liabilityGroups)
      setEquityGroups(equityGroups)
      setSummary({
        totalAssets,
        totalLiabilities,
        totalEquity,
        netProfit,
        retainedEarnings,
        totalLiabilitiesAndEquity,
        difference: totalAssets - totalLiabilitiesAndEquity,
      })

      setHasTransactions(built.some((a) => a.has_transactions) || netProfit !== 0)

      const diff = totalAssets - totalLiabilitiesAndEquity
      if (Math.abs(diff) < 0.01) {
        toast.success("Balance Sheet balanced ✅")
      } else {
        toast.warning(`Difference: ${formatCurrency(Math.abs(diff))}`)
      }
    } catch (error: any) {
      console.error("Error loading balance sheet:", error)
      toast.error("Failed: " + (error?.message || "unknown"))
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
        th, td { padding: 3px 8px; border: 1px solid #e0e0e0; text-align: left; }
        th { background-color: #1a1a1a; color: white; }
        tr:nth-child(even) { background-color: #f8fafc; }
      </style>
    `

    const content = `
      <!DOCTYPE html>
      <html>
        <head><title>Balance Sheet</title>${styles}</head>
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
      const headers = ["Section", "Group", "Account", "Balance"]
      const rows: (string | number)[][] = []

      assetGroups.forEach((g) => g.accounts.forEach((a) => rows.push(["Asset", g.label, a.name, a.balance])))
      liabilityGroups.forEach((g) => g.accounts.forEach((a) => rows.push(["Liability", g.label, a.name, a.balance])))
      equityGroups.forEach((g) => g.accounts.forEach((a) => rows.push(["Equity", g.label, a.name, a.balance])))

      rows.push(["TOTAL", "", "Net Profit", summary.netProfit])
      rows.push(["TOTAL", "", "Total Assets", summary.totalAssets])
      rows.push(["TOTAL", "", "Total Liabilities", summary.totalLiabilities])
      rows.push(["TOTAL", "", "Total Equity", summary.totalEquity])
      rows.push(["TOTAL", "", "Retained Earnings", summary.retainedEarnings])
      rows.push(["TOTAL", "", "Liabilities + Equity", summary.totalLiabilitiesAndEquity])
      rows.push(["TOTAL", "", "Difference", summary.difference])

      const csvContent = [
        headers.join(","),
        ...rows.map((row) => row.map((v) => `"${v}"`).join(",")),
      ].join("\n")

      const blob = new Blob([csvContent], { type: "text/csv" })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `balance_sheet_${format(new Date(), "yyyy-MM-dd")}.csv`
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

  const isBalanced = Math.abs(summary.difference) < 0.01

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <ResponsiveLayout>
      <div className="space-y-3 sm:space-y-4 p-3 sm:p-4 md:p-6">
        {/* Hidden Print */}
        <div style={{ display: "none" }}>
          <PrintComponent
            ref={printRef}
            schoolInfo={schoolInfo}
            assetGroups={assetGroups}
            liabilityGroups={liabilityGroups}
            equityGroups={equityGroups}
            totalAssets={summary.totalAssets}
            totalLiabilities={summary.totalLiabilities}
            totalEquity={summary.totalEquity}
            netProfit={summary.netProfit}
            retainedEarnings={summary.retainedEarnings}
            totalLiabilitiesAndEquity={summary.totalLiabilitiesAndEquity}
            difference={summary.difference}
            isBalanced={isBalanced}
            periodLabel={periodLabel}
            todayLabel={todayLabel}
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
                <div className="p-1.5 sm:p-2 rounded-lg bg-indigo-100 dark:bg-indigo-950/50">
                  <Scale className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                Balance Sheet
              </h1>
              <p className="text-[11px] sm:text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Assets = Liabilities + Equity + Net Profit
              </p>
            </div>
          </div>

          <div className="flex gap-2 print:hidden flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadData()}
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
              No transactions found for this period.
            </span>
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
        </div>

        {/* LOADING */}
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          </div>
        ) : (
          <>
            {/* SUMMARY CARDS */}
            <div className="grid gap-2 sm:gap-2.5 grid-cols-2 md:grid-cols-4 print:hidden">
              <Card className="border-blue-200/80 dark:border-blue-800/60 bg-blue-50/50 dark:bg-blue-950/20 shadow-sm">
                <CardContent className="p-2.5 sm:p-3">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-[10px] sm:text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide truncate">
                        Total Assets
                      </p>
                      <p className="text-base sm:text-lg font-black font-mono text-blue-700 dark:text-blue-400 truncate mt-0.5">
                        {formatCurrency(summary.totalAssets)}
                      </p>
                    </div>
                    <div className="p-1.5 sm:p-2 rounded-md bg-blue-100 dark:bg-blue-950/50 shrink-0 ml-1">
                      <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-amber-200/80 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-950/20 shadow-sm">
                <CardContent className="p-2.5 sm:p-3">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-[10px] sm:text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide truncate">
                        Liabilities
                      </p>
                      <p className="text-base sm:text-lg font-black font-mono text-amber-700 dark:text-amber-400 truncate mt-0.5">
                        {formatCurrency(summary.totalLiabilities)}
                      </p>
                    </div>
                    <div className="p-1.5 sm:p-2 rounded-md bg-amber-100 dark:bg-amber-950/50 shrink-0 ml-1">
                      <Wallet className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-600 dark:text-amber-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-purple-200/80 dark:border-purple-800/60 bg-purple-50/50 dark:bg-purple-950/20 shadow-sm">
                <CardContent className="p-2.5 sm:p-3">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-[10px] sm:text-[11px] font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wide truncate">
                        Total Equity
                      </p>
                      <p className="text-base sm:text-lg font-black font-mono text-purple-700 dark:text-purple-400 truncate mt-0.5">
                        {formatCurrency(summary.totalEquity + summary.retainedEarnings)}
                      </p>
                    </div>
                    <div className="p-1.5 sm:p-2 rounded-md bg-purple-100 dark:bg-purple-950/50 shrink-0 ml-1">
                      <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-purple-600 dark:text-purple-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card
                className={cn(
                  "shadow-sm",
                  isBalanced
                    ? "border-emerald-200/80 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-950/20"
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
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400"
                        )}
                      >
                        Difference
                      </p>
                      <p
                        className={cn(
                          "text-base sm:text-lg font-black font-mono truncate mt-0.5",
                          isBalanced
                            ? "text-emerald-700 dark:text-emerald-400"
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
                          ? "bg-emerald-100 dark:bg-emerald-950/50"
                          : "bg-rose-100 dark:bg-rose-950/50"
                      )}
                    >
                      <Scale
                        className={cn(
                          "h-3.5 w-3.5 sm:h-4 sm:w-4",
                          isBalanced
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400"
                        )}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* NET PROFIT HIGHLIGHT */}
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm print:hidden">
              <CardContent className="p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {summary.netProfit >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-rose-500" />
                  )}
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">
                    Net {summary.netProfit >= 0 ? "Profit" : "Loss"} (Current Period)
                  </span>
                </div>
                <span
                  className={cn(
                    "font-mono font-bold text-base",
                    summary.netProfit >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  )}
                >
                  {formatCurrency(summary.netProfit)}
                </span>
              </CardContent>
            </Card>

            {/* BALANCE CHECK BANNER */}
            <Card
              className={cn(
                "border-2 print:hidden bg-white dark:bg-slate-900 shadow-sm",
                isBalanced
                  ? "border-emerald-500/50 dark:border-emerald-500/40"
                  : "border-rose-500/50 dark:border-rose-500/40"
              )}
            >
              <CardContent className="p-3 md:p-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Scale
                      className={cn(
                        "h-4 w-4",
                        isBalanced
                          ? "text-emerald-500 dark:text-emerald-400"
                          : "text-rose-500 dark:text-rose-400"
                      )}
                    />
                    <span className="font-semibold text-sm md:text-base text-slate-900 dark:text-white">
                      Accounting Equation
                    </span>
                  </div>
                  <span
                    className={cn(
                      "text-xs md:text-sm font-mono font-bold",
                      isBalanced
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    )}
                  >
                    Assets − (Liabilities + Equity + Net Profit) ={" "}
                    {formatCurrency(summary.difference)}
                    {isBalanced ? " ✅ Balanced" : " ❌ Not Balanced"}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* TWO COLUMN LAYOUT */}
            <div className="grid lg:grid-cols-2 gap-3 sm:gap-4">
              {/* ASSETS */}
              <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                <CardHeader className="py-3 px-3 sm:px-4 flex flex-row items-center justify-between border-b border-slate-100 dark:border-slate-800">
                  <CardTitle className="text-sm md:text-base flex items-center gap-2 text-blue-600 dark:text-blue-400">
                    <div className="p-1.5 rounded-md bg-blue-100 dark:bg-blue-950/50">
                      <Building2 className="h-4 w-4" />
                    </div>
                    Assets
                  </CardTitle>
                  <div className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                    {assetGroups.reduce((sum, g) => sum + g.accounts.length, 0)} accounts
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {assetGroups.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-sm">
                      No assets found
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {assetGroups.map((group) => (
                        <div key={group.category}>
                          <div className="px-3 sm:px-4 py-2 bg-slate-50/80 dark:bg-slate-800/50 flex items-center justify-between">
                            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                              {group.label}
                            </span>
                            <span className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                              {group.accounts.length} acc
                            </span>
                          </div>
                          <div className="overflow-x-auto">
                            <Table>
                              <TableBody>
                                {group.accounts.map((item, i) => (
                                  <TableRow
                                    key={item.id}
                                    className={cn(
                                      i % 2 === 0
                                        ? "bg-white dark:bg-slate-900"
                                        : "bg-slate-50/40 dark:bg-slate-800/20",
                                      "border-slate-100 dark:border-slate-800/60",
                                      !item.has_transactions && "opacity-60"
                                    )}
                                  >
                                    <TableCell className="font-mono text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 w-[80px]">
                                      {item.code}
                                    </TableCell>
                                    <TableCell className="text-[11px] sm:text-xs text-slate-800 dark:text-slate-200">
                                      {item.name}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-[11px] sm:text-xs font-bold text-slate-900 dark:text-white">
                                      {formatCurrency(item.balance)}
                                    </TableCell>
                                  </TableRow>
                                ))}
                                <TableRow className="bg-blue-50/40 dark:bg-blue-950/20">
                                  <TableCell
                                    colSpan={2}
                                    className="text-[10px] sm:text-[11px] font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide"
                                  >
                                    Total {group.label}
                                  </TableCell>
                                  <TableCell className="text-right font-mono text-[11px] sm:text-xs font-bold text-blue-700 dark:text-blue-400">
                                    {formatCurrency(group.total)}
                                  </TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      ))}
                      <div className="px-3 sm:px-4 py-3 bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-between border-t-2 border-blue-300 dark:border-blue-700">
                        <span className="text-xs sm:text-sm font-bold uppercase tracking-wide text-blue-800 dark:text-blue-300">
                          Total Assets
                        </span>
                        <span className="text-sm sm:text-base font-mono font-bold text-blue-700 dark:text-blue-400">
                          {formatCurrency(summary.totalAssets)}
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* LIABILITIES + EQUITY */}
              <div className="space-y-3 sm:space-y-4">
                {/* LIABILITIES */}
                <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                  <CardHeader className="py-3 px-3 sm:px-4 flex flex-row items-center justify-between border-b border-slate-100 dark:border-slate-800">
                    <CardTitle className="text-sm md:text-base flex items-center gap-2 text-amber-600 dark:text-amber-400">
                      <div className="p-1.5 rounded-md bg-amber-100 dark:bg-amber-950/50">
                        <Wallet className="h-4 w-4" />
                      </div>
                      Liabilities
                    </CardTitle>
                    <div className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                      {liabilityGroups.reduce((sum, g) => sum + g.accounts.length, 0)} accounts
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {liabilityGroups.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-sm">
                        No liabilities found
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {liabilityGroups.map((group) => (
                          <div key={group.category}>
                            <div className="px-3 sm:px-4 py-2 bg-slate-50/80 dark:bg-slate-800/50 flex items-center justify-between">
                              <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                                {group.label}
                              </span>
                              <span className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                                {group.accounts.length} acc
                              </span>
                            </div>
                            <div className="overflow-x-auto">
                              <Table>
                                <TableBody>
                                  {group.accounts.map((item, i) => (
                                    <TableRow
                                      key={item.id}
                                      className={cn(
                                        i % 2 === 0
                                          ? "bg-white dark:bg-slate-900"
                                          : "bg-slate-50/40 dark:bg-slate-800/20",
                                        "border-slate-100 dark:border-slate-800/60",
                                        !item.has_transactions && "opacity-60"
                                      )}
                                    >
                                      <TableCell className="font-mono text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 w-[80px]">
                                        {item.code}
                                      </TableCell>
                                      <TableCell className="text-[11px] sm:text-xs text-slate-800 dark:text-slate-200">
                                        {item.name}
                                      </TableCell>
                                      <TableCell className="text-right font-mono text-[11px] sm:text-xs font-bold text-slate-900 dark:text-white">
                                        {formatCurrency(item.balance)}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                  <TableRow className="bg-amber-50/40 dark:bg-amber-950/20">
                                    <TableCell
                                      colSpan={2}
                                      className="text-[10px] sm:text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide"
                                    >
                                      Total {group.label}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-[11px] sm:text-xs font-bold text-amber-700 dark:text-amber-400">
                                      {formatCurrency(group.total)}
                                    </TableCell>
                                  </TableRow>
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        ))}
                        <div className="px-3 sm:px-4 py-3 bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-between border-t-2 border-amber-300 dark:border-amber-700">
                          <span className="text-xs sm:text-sm font-bold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                            Total Liabilities
                          </span>
                          <span className="text-sm sm:text-base font-mono font-bold text-amber-700 dark:text-amber-400">
                            {formatCurrency(summary.totalLiabilities)}
                          </span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* EQUITY */}
                <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                  <CardHeader className="py-3 px-3 sm:px-4 flex flex-row items-center justify-between border-b border-slate-100 dark:border-slate-800">
                    <CardTitle className="text-sm md:text-base flex items-center gap-2 text-purple-600 dark:text-purple-400">
                      <div className="p-1.5 rounded-md bg-purple-100 dark:bg-purple-950/50">
                        <DollarSign className="h-4 w-4" />
                      </div>
                      Equity
                    </CardTitle>
                    <div className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                      {equityGroups.reduce((sum, g) => sum + g.accounts.length, 0)} accounts
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {equityGroups.map((group) => (
                        <div key={group.category}>
                          <div className="px-3 sm:px-4 py-2 bg-slate-50/80 dark:bg-slate-800/50 flex items-center justify-between">
                            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                              {group.label}
                            </span>
                            <span className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                              {group.accounts.length} acc
                            </span>
                          </div>
                          <div className="overflow-x-auto">
                            <Table>
                              <TableBody>
                                {group.accounts.map((item, i) => (
                                  <TableRow
                                    key={item.id}
                                    className={cn(
                                      i % 2 === 0
                                        ? "bg-white dark:bg-slate-900"
                                        : "bg-slate-50/40 dark:bg-slate-800/20",
                                      "border-slate-100 dark:border-slate-800/60",
                                      !item.has_transactions && "opacity-60"
                                    )}
                                  >
                                    <TableCell className="font-mono text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 w-[80px]">
                                      {item.code}
                                    </TableCell>
                                    <TableCell className="text-[11px] sm:text-xs text-slate-800 dark:text-slate-200">
                                      {item.name}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-[11px] sm:text-xs font-bold text-slate-900 dark:text-white">
                                      {formatCurrency(item.balance)}
                                    </TableCell>
                                  </TableRow>
                                ))}
                                <TableRow className="bg-purple-50/40 dark:bg-purple-950/20">
                                  <TableCell
                                    colSpan={2}
                                    className="text-[10px] sm:text-[11px] font-semibold text-purple-700 dark:text-purple-400 uppercase tracking-wide"
                                  >
                                    Total {group.label}
                                  </TableCell>
                                  <TableCell className="text-right font-mono text-[11px] sm:text-xs font-bold text-purple-700 dark:text-purple-400">
                                    {formatCurrency(group.total)}
                                  </TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      ))}

                      <div className="px-3 sm:px-4 py-2 bg-emerald-50/50 dark:bg-emerald-950/20 flex items-center justify-between">
                        <span className="text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Net {summary.netProfit >= 0 ? "Profit" : "Loss"} (Current Period)
                        </span>
                        <span
                          className={cn(
                            "text-[11px] sm:text-xs font-mono font-bold",
                            summary.netProfit >= 0
                              ? "text-emerald-700 dark:text-emerald-400"
                              : "text-rose-700 dark:text-rose-400"
                          )}
                        >
                          {formatCurrency(summary.netProfit)}
                        </span>
                      </div>

                      <div className="px-3 sm:px-4 py-2 bg-slate-50/80 dark:bg-slate-800/50 flex items-center justify-between">
                        <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                          Retained Earnings (Cumulative)
                        </span>
                        <span className="text-[11px] sm:text-xs font-mono font-bold text-slate-900 dark:text-white">
                          {formatCurrency(summary.retainedEarnings)}
                        </span>
                      </div>

                      <div className="px-3 sm:px-4 py-3 bg-purple-500/10 dark:bg-purple-500/20 flex items-center justify-between border-t-2 border-purple-300 dark:border-purple-700">
                        <span className="text-xs sm:text-sm font-bold uppercase tracking-wide text-purple-800 dark:text-purple-300">
                          Total Equity
                        </span>
                        <span className="text-sm sm:text-base font-mono font-bold text-purple-700 dark:text-purple-400">
                          {formatCurrency(summary.totalEquity + summary.retainedEarnings)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* L + E TOTAL */}
                <Card
                  className={cn(
                    "border-2 bg-white dark:bg-slate-900 shadow-sm",
                    isBalanced
                      ? "border-emerald-500/50 dark:border-emerald-500/40"
                      : "border-rose-500/50 dark:border-rose-500/40"
                  )}
                >
                  <CardContent className="p-3 sm:p-4 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">
                        Liabilities + Equity
                      </span>
                      <span className="text-base md:text-lg font-black font-mono text-indigo-600 dark:text-indigo-400">
                        {formatCurrency(summary.totalLiabilitiesAndEquity)}
                      </span>
                    </div>
                    <div className="h-px bg-slate-100 dark:bg-slate-800" />
                    <div className="flex justify-between items-center text-xs sm:text-sm">
                      <span className="text-slate-500 dark:text-slate-400">Assets</span>
                      <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                        {formatCurrency(summary.totalAssets)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs sm:text-sm">
                      <span className="text-slate-500 dark:text-slate-400">Difference</span>
                      <span
                        className={cn(
                          "font-mono font-semibold",
                          isBalanced
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400"
                        )}
                      >
                        {formatCurrency(summary.difference)}
                        {isBalanced ? " ✅" : " ❌"}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        )}
      </div>
    </ResponsiveLayout>
  )
}