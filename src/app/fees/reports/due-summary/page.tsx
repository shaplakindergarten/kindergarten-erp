"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

import {
  ArrowLeft,
  Download,
  Loader2,
  AlertCircle,
  TrendingUp,
  Users,
  Wallet,
  RefreshCw,
  FileText,
  Printer,
  Search,
  Filter,
  GraduationCap,
  ChevronUp,
  ChevronDown,
  User,
  Phone,
  BookOpen,
  Home,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import { ResponsiveLayout } from "@/components/layout/responsive-layout"
import { formatCurrency } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { getSchoolPrintHeader } from "@/components/print/SchoolPrintHeader"

const supabase = createClient()

// 🆕 Updated DueSummary with more fields
interface DueSummary {
  student_id: string
  student_name: string
  admission_no: string
  class_id: string
  class_name: string
  section_name: string
  father_name: string
  contact: string
  total_amount: number
  paid_amount: number
  due_amount: number
  fine_amount: number
  discount_amount: number
  due_percentage: number
  transaction_count: number
  status: "critical" | "warning" | "normal"
  // 🆕 New fields
  expected_amount: number
  overdue_months: number
  pending_months: number
  partial_months: number
  paid_months: number
  earliest_due_date: string | null
  latest_payment_date: string | null
}

interface ClassItem {
  id: string
  name: string
  numeric_order: number
}

interface SectionItem {
  id: string
  name: string
  class_id: string
}

interface SchoolInfo {
  school_name: string
  school_address: string
  school_phone: string
  school_email: string
  school_logo?: string | null
}

type SortKey =
  | "student_name"
  | "due_amount"
  | "due_percentage"
  | "total_amount"
  | "paid_amount"
  | "overdue_months"
  | "expected_amount"

type SortDir = "asc" | "desc"

export default function DueSummaryPage() {
  const [data, setData] = useState<DueSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [pdfGenerating, setPdfGenerating] = useState(false)

  const [classes, setClasses] = useState<ClassItem[]>([])
  const [sections, setSections] = useState<SectionItem[]>([])

  const [filterClass, setFilterClass] = useState("all")
  const [filterSection, setFilterSection] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")

  const [searchTerm, setSearchTerm] = useState("")
  const [showFilters, setShowFilters] = useState(false)

  const [sortKey, setSortKey] = useState<SortKey>("due_amount")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo>({
    school_name: "Shapla Kindergarten & Pre-cadet",
    school_address: "Nowtala, Madhaiya Bazar, Chandina, Cumilla",
    school_phone: "01923253454",
    school_email: "shapla.kindergarten@gmail.com",
  })

  const fetchSchoolInfo = async () => {
    try {
      const { data, error } = await supabase
        .from("school_settings")
        .select("school_name, school_address, school_phone, school_email, school_logo")
        .limit(1)
        .single()

      if (!error && data) {
        setSchoolInfo(data)
      }
    } catch (error) {
      console.error(error)
    }
  }

  const fetchClasses = async () => {
    try {
      const { data, error } = await supabase
        .from("classes")
        .select("id, name, numeric_order")
        .order("numeric_order", { ascending: true })

      if (!error && data) {
        setClasses(data)
      }
    } catch (error) {
      console.error(error)
    }
  }

  const fetchSections = async () => {
    try {
      let query = supabase
        .from("sections")
        .select("id, name, class_id")
        .order("name")

      if (filterClass !== "all") {
        query = query.eq("class_id", filterClass)
      }

      const { data, error } = await query

      if (!error && data) {
        setSections(data)
      }
    } catch (error) {
      console.error(error)
    }
  }

  /**
   * 🆕 MAIN DATA LOAD - Using v_due_summary and student_fee_dues
   */
  const loadData = useCallback(async () => {
    try {
      console.log("Loading due summary data with filters:", { filterClass, filterSection })
      setLoading(true)

      // 1. Get data from v_due_summary view
       let query = supabase
        .from('v_due_summary')
        .select('*')
        .gt('total_due', 0)

      if (filterClass !== "all") {
        query = query.eq('class_id', filterClass)
      }
      if (filterSection !== "all") {
        query = query.eq('section_id', filterSection)
      }

      const { data: summaryData, error: summaryError } = await query
        .order('total_due', { ascending: false })

      if (summaryError) {
        console.error('Error loading due summary:', summaryError)
        setData([])
        return
      }

      if (!summaryData || summaryData.length === 0) {
        setData([])
        return
      }

      // 2. 🆕 Get additional due details from student_fee_dues
      const studentIds = summaryData.map((s: any) => s.student_id)
      const { data: duesData, error: duesError } = await supabase
        .from('student_fee_dues')
        .select('student_id, month, due_amount, status, due_date, expected_amount, paid_amount')
        .in('student_id', studentIds)
        .gt('due_amount', 0)

      if (duesError) {
        console.error('Error loading dues details:', duesError)
      }

      // 3. Get latest payment date for each student
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('fee_payments')
        .select('student_id, payment_date')
        .in('student_id', studentIds)
        .order('payment_date', { ascending: false })

      // Build maps
      const dueMap = new Map()
      duesData?.forEach((d: any) => {
        if (!dueMap.has(d.student_id)) {
          dueMap.set(d.student_id, {
            overdue_months: 0,
            pending_months: 0,
            partial_months: 0,
            paid_months: 0,
            expected_amount: 0,
            earliest_due: null,
          })
        }
        const entry = dueMap.get(d.student_id)
        if (d.status === 'overdue') entry.overdue_months++
        else if (d.status === 'pending') entry.pending_months++
        else if (d.status === 'partial') entry.partial_months++
        else if (d.status === 'paid') entry.paid_months++
        entry.expected_amount += d.expected_amount || 0
        if (!entry.earliest_due || d.due_date < entry.earliest_due) {
          entry.earliest_due = d.due_date
        }
      })

      const paymentMap = new Map()
      paymentsData?.forEach((p: any) => {
        if (!paymentMap.has(p.student_id)) {
          paymentMap.set(p.student_id, p.payment_date)
        }
      })

      // 4. Combine data
      const formattedData: DueSummary[] = summaryData.map((item: any) => {
        const dueDetails = dueMap.get(item.student_id) || {
          overdue_months: 0,
          pending_months: 0,
          partial_months: 0,
          paid_months: 0,
          expected_amount: 0,
          earliest_due: null,
        }

        const dueAmount = Number(item.total_due) || 0
        let status: "critical" | "warning" | "normal" = "normal"
        if (dueAmount >= 800) status = "critical"
        else if (dueAmount >= 200) status = "warning"

        const duePercentage = item.total_expected > 0 ? (dueAmount / item.total_expected) * 100 : 0

        return {
          student_id: item.student_id,
          student_name: item.student_name || "N/A",
          admission_no: item.admission_no || "N/A",
          father_name: item.father_name || "N/A",
          contact: item.phone || "N/A",
          class_id: item.class_id,
          class_name: item.class_name || "N/A",
          section_name: item.section_name || "N/A",
          total_amount: Number(item.total_expected) || 0,
          paid_amount: Number(item.total_paid) || 0,
          due_amount: dueAmount,
          fine_amount: Number(item.total_fine) || 0,
          discount_amount: Number(item.total_discount) || 0,
          due_percentage: duePercentage,
          transaction_count: item.paid_months || 0,
          status,
          // 🆕 New fields
          expected_amount: dueDetails.expected_amount,
          overdue_months: dueDetails.overdue_months,
          pending_months: dueDetails.pending_months,
          partial_months: dueDetails.partial_months,
          paid_months: dueDetails.paid_months,
          earliest_due_date: dueDetails.earliest_due,
          latest_payment_date: paymentMap.get(item.student_id) || null,
        }
      })

      console.log("Loaded due students:", formattedData.length)
      console.log("Total due:", formattedData.reduce((sum, s) => sum + s.due_amount, 0))

      setData(formattedData)
    } catch (error) {
      console.error("Due summary error:", error)
      setData([])
    } finally {
      setLoading(false)
    }
  }, [filterClass, filterSection])

  useEffect(() => {
    fetchSchoolInfo()
    fetchClasses()
  }, [])

  useEffect(() => {
    fetchSections()
  }, [filterClass])

  useEffect(() => {
    loadData()
  }, [loadData])

  /**
   * FILTER
   */

  const processedData = (() => {
    let filtered = [...data]

    if (filterStatus !== "all") {
      filtered = filtered.filter((d) => d.status === filterStatus)
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter((d) =>
        d.student_name.toLowerCase().includes(term) ||
        d.admission_no.toLowerCase().includes(term) ||
        d.father_name.toLowerCase().includes(term) ||
        d.contact.toLowerCase().includes(term)
      )
    }

    filtered.sort((a, b) => {
      const av = a[sortKey] as number | string
      const bv = b[sortKey] as number | string

      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av
      }

      return sortDir === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av))
    })

    return filtered
  })()

  /**
   * SORT
   */

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => prev === "asc" ? "desc" : "asc")
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) {
      return <ChevronUp className="h-3 w-3 text-slate-300 dark:text-slate-600" />
    }
    return sortDir === "asc" ? (
      <ChevronUp className="h-3 w-3 text-red-600 dark:text-red-400" />
    ) : (
      <ChevronDown className="h-3 w-3 text-red-600 dark:text-red-400" />
    )
  }

  /**
   * TOTALS
   */

  const totalDue = processedData.reduce((sum, item) => sum + item.due_amount, 0)
  const totalAmount = processedData.reduce((sum, item) => sum + item.total_amount, 0)
  const totalPaid = processedData.reduce((sum, item) => sum + item.paid_amount, 0)
  const totalFine = processedData.reduce((sum, item) => sum + item.fine_amount, 0)
  const totalDiscount = processedData.reduce((sum, item) => sum + item.discount_amount, 0)
  const totalExpected = processedData.reduce((sum, item) => sum + item.expected_amount, 0)
  const totalOverdueMonths = processedData.reduce((sum, item) => sum + item.overdue_months, 0)

  const criticalCount = processedData.filter((item) => item.status === "critical").length
  const warningCount = processedData.filter((item) => item.status === "warning").length

  /**
   * BADGE - Dark mode fixed
   */

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "critical":
        return (
          <Badge className="bg-red-100 text-red-700 dark:bg-red-950/70 dark:text-red-300 border border-red-200 dark:border-red-800">
            🔴 Critical
          </Badge>
        )
      case "warning":
        return (
          <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            🟡 Warning
          </Badge>
        )
      default:
        return (
          <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-950/70 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
            🟠 Normal
          </Badge>
        )
    }
  }

  /**
   * CSV Export
   */

  const handleExportCSV = () => {
    const headers = [
      "Student", "Admission", "Father", "Contact", "Class", "Section",
      "Total", "Paid", "Due", "Fine", "Discount", "Due %",
      "Overdue Months", "Pending", "Partial", "Status"
    ]

    const rows = processedData.map((d) => [
      d.student_name,
      d.admission_no,
      d.father_name,
      d.contact,
      d.class_name,
      d.section_name,
      d.total_amount,
      d.paid_amount,
      d.due_amount,
      d.fine_amount,
      d.discount_amount,
      d.due_percentage.toFixed(1) + "%",
      d.overdue_months,
      d.pending_months,
      d.partial_months,
      d.status,
    ])

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n")
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `due-summary-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  /**
   * PDF Export
   */

  const handleExportPDF = async () => {
    try {
      setPdfGenerating(true)

      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      })

      doc.setFontSize(18)
      doc.text(schoolInfo.school_name || "School Name", 148, 14, { align: "center" })

      doc.setFontSize(13)
      doc.text("Due Summary Report", 148, 22, { align: "center" })

      doc.setFontSize(9)
      doc.text(`Generated: ${new Date().toLocaleString()}`, 148, 28, { align: "center" })

      // 🆕 Add summary stats
      doc.setFillColor(241, 245, 249)
      doc.rect(15, 35, 267, 20, "F")
      doc.setFontSize(8)
      doc.text(`Total Due: ${totalDue.toLocaleString()} ৳`, 25, 45)
      doc.text(`Students: ${processedData.length}`, 85, 45)
      doc.text(`Critical: ${criticalCount}`, 145, 45)
      doc.text(`Warning: ${warningCount}`, 205, 45)
      doc.text(`Overdue Months: ${totalOverdueMonths}`, 265, 45, { align: "right" })

      autoTable(doc, {
        startY: 60,
        head: [[
          "#", "Student", "Admission", "Class", "Section",
          "Total", "Paid", "Due", "Fine", "Discount", "Due %",
          "Overdue", "Pending", "Partial", "Status"
        ]],
        body: processedData.map((d, i) => [
          i + 1,
          d.student_name,
          d.admission_no,
          d.class_name,
          d.section_name,
          formatCurrency(d.total_amount),
          formatCurrency(d.paid_amount),
          formatCurrency(d.due_amount),
          formatCurrency(d.fine_amount),
          formatCurrency(d.discount_amount),
          d.due_percentage.toFixed(1) + "%",
          d.overdue_months,
          d.pending_months,
          d.partial_months,
          d.status,
        ]),
        foot: [[
          "", "TOTAL", "", "", "",
          formatCurrency(totalAmount),
          formatCurrency(totalPaid),
          formatCurrency(totalDue),
          formatCurrency(totalFine),
          formatCurrency(totalDiscount),
          "",
          totalOverdueMonths,
          "",
          "",
          "",
        ]],
        theme: "grid",
        styles: { fontSize: 7, cellPadding: 3 },
        headStyles: { fillColor: [220, 38, 38], textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        columnStyles: {
          6: { textColor: [5, 150, 105] },
          7: { textColor: [220, 38, 38] },
          11: { textColor: [220, 38, 38] },
        },
      })

      doc.save("due-summary-report.pdf")
    } catch (error) {
      console.error(error)
    } finally {
      setPdfGenerating(false)
    }
  }

  /**
   * PRINT
   */

  const handlePrint = () => {
    const printContainer = document.createElement("div")
    printContainer.id = "due-print-area"

    printContainer.innerHTML = `
      <div class="print-wrapper">
        ${getSchoolPrintHeader({ ...schoolInfo, school_logo: schoolInfo.school_logo ?? undefined, school_email: schoolInfo.school_email ?? undefined }, "Due Summary Report")}
        <div style="display:flex; justify-content:space-between; margin:10px 0; background:#f1f5f9; padding:10px; border-radius:6px;">
          <div><strong>Total Due:</strong> ${formatCurrency(totalDue)}</div>
          <div><strong>Students:</strong> ${processedData.length}</div>
          <div><strong>Critical:</strong> ${criticalCount}</div>
          <div><strong>Warning:</strong> ${warningCount}</div>
          <div><strong>Overdue Months:</strong> ${totalOverdueMonths}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th><th>Student</th><th>Admission</th><th>Class</th><th>Section</th>
              <th>Total</th><th>Paid</th><th>Due</th><th>Fine</th><th>Discount</th>
              <th>Due %</th><th>Overdue</th><th>Pending</th><th>Partial</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${processedData.map((d, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${d.student_name}</td>
                <td>${d.admission_no}</td>
                <td>${d.class_name}</td>
                <td>${d.section_name}</td>
                <td>${formatCurrency(d.total_amount)}</td>
                <td>${formatCurrency(d.paid_amount)}</td>
                <td>${formatCurrency(d.due_amount)}</td>
                <td>${formatCurrency(d.fine_amount)}</td>
                <td>${formatCurrency(d.discount_amount)}</td>
                <td>${d.due_percentage.toFixed(1)}%</td>
                <td>${d.overdue_months}</td>
                <td>${d.pending_months}</td>
                <td>${d.partial_months}</td>
                <td>${d.status}</td>
              </tr>
            `).join("")}
          </tbody>
          <tfoot>
            <tr style="font-weight:bold; background:#f1f5f9;">
              <td colspan="5" style="text-align:right;">TOTAL</td>
              <td>${formatCurrency(totalAmount)}</td>
              <td>${formatCurrency(totalPaid)}</td>
              <td style="color:#dc2626;">${formatCurrency(totalDue)}</td>
              <td>${formatCurrency(totalFine)}</td>
              <td>${formatCurrency(totalDiscount)}</td>
              <td></td>
              <td>${totalOverdueMonths}</td>
              <td></td>
              <td></td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    `

    const style = document.createElement("style")
    style.innerHTML = `
      @media print {
        body * { visibility: hidden; }
        #due-print-area, #due-print-area * { visibility: visible; }
        #due-print-area { position: absolute; inset: 0; background: white; padding: 20px; }
        @page { size: landscape; margin: 10mm; }
      }
      .print-wrapper { font-family: Arial; }
      table { width: 100%; border-collapse: collapse; font-size: 10px; }
      th, td { border: 1px solid #ccc; padding: 6px; text-align: center; }
      th { background: #f3f4f6; }
      .text-right { text-align: right; }
    `

    document.head.appendChild(style)
    document.body.appendChild(printContainer)

    const cleanup = () => {
      document.body.removeChild(printContainer)
      document.head.removeChild(style)
      window.removeEventListener("afterprint", cleanup)
    }

    window.addEventListener("afterprint", cleanup)
    window.print()
  }

  return (
    <ResponsiveLayout>
      <div className="space-y-6 p-4 md:p-6">

        {/* HEADER */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-gradient-to-r from-red-600 to-rose-700 rounded-xl p-5 shadow-lg">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild className="bg-white/20 hover:bg-white/30 text-white">
              <Link href="/fees/reports">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-white">Due Summary Report</h1>
              <p className="text-red-100 text-sm">Student wise pending fee report</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setShowFilters(!showFilters)} className="bg-white/20 text-white hover:bg-white/30">
              <Filter className="h-4 w-4 mr-1" /> Filters
            </Button>
            <Button onClick={loadData} className="bg-white/20 text-white hover:bg-white/30">
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh
            </Button>
            <Button onClick={handleExportCSV} className="bg-white/20 text-white hover:bg-white/30">
              <Download className="h-4 w-4 mr-1" /> CSV
            </Button>
            <Button onClick={handleExportPDF} disabled={pdfGenerating} className="bg-white/20 text-white hover:bg-white/30">
              {pdfGenerating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileText className="h-4 w-4 mr-1" />} PDF
            </Button>
            <Button onClick={handlePrint} className="bg-white/20 text-white hover:bg-white/30">
              <Printer className="h-4 w-4 mr-1" /> Print
            </Button>
          </div>
        </div>

        {/* FILTERS */}
        {showFilters && (
          <Card className="dark:bg-slate-900 dark:border-slate-800">
            <CardContent className="pt-5">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs font-semibold dark:text-slate-400">Class</label>
                  <Select value={filterClass} onValueChange={(v) => { setFilterClass(v); setFilterSection("all") }}>
                    <SelectTrigger className="h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-200 rounded-lg">
                      <SelectValue placeholder="All Classes" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg">
                      <SelectItem value="all">All Classes</SelectItem>
                      {classes.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-semibold dark:text-slate-400">Section</label>
                  <Select value={filterSection} onValueChange={setFilterSection}>
                    <SelectTrigger className="h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-200 rounded-lg">
                      <SelectValue placeholder="All Sections" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg">
                      <SelectItem value="all">All Sections</SelectItem>
                      {sections.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-semibold dark:text-slate-400">Status</label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-200 rounded-lg">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg">
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="critical">🔴 Critical</SelectItem>
                      <SelectItem value="warning">🟡 Warning</SelectItem>
                      <SelectItem value="normal">🟠 Normal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-semibold dark:text-slate-400">Search</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400 dark:text-slate-500" />
                    <Input placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-500" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STATS CARDS - Updated */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div><p className="text-blue-100">Due Students</p><h2 className="text-3xl font-bold">{processedData.length}</h2></div>
                <Users className="h-10 w-10 text-blue-200" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-slate-600 to-slate-700 text-white border-0">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div><p className="text-slate-200">Total Expected</p><h2 className="text-2xl font-bold">{formatCurrency(totalAmount)}</h2></div>
                <GraduationCap className="h-10 w-10 text-slate-300" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-0">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div><p className="text-emerald-100">Total Paid</p><h2 className="text-2xl font-bold">{formatCurrency(totalPaid)}</h2></div>
                <Wallet className="h-10 w-10 text-emerald-200" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-500 to-rose-600 text-white border-0">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div><p className="text-red-100">Total Due</p><h2 className="text-2xl font-bold">{formatCurrency(totalDue)}</h2></div>
                <AlertCircle className="h-10 w-10 text-red-200" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-orange-500 to-amber-600 text-white border-0">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div><p className="text-orange-100">Critical</p><h2 className="text-3xl font-bold">{criticalCount}</h2></div>
                <XCircle className="h-10 w-10 text-orange-200" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-500 to-violet-600 text-white border-0">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div><p className="text-purple-100">Overdue Months</p><h2 className="text-3xl font-bold">{totalOverdueMonths}</h2></div>
                <Clock className="h-10 w-10 text-purple-200" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* TABLE */}
        <Card className="dark:bg-slate-900 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="dark:text-slate-100">Due Summary</CardTitle>
            <CardDescription className="dark:text-slate-400">Student wise due information with overdue tracking</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-10 w-10 animate-spin text-red-500" />
              </div>
            ) : processedData.length === 0 ? (
              <div className="text-center py-16 text-slate-500 dark:text-slate-400">No due data found</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="dark:border-slate-800">
                      <TableHead className="dark:text-slate-300">#</TableHead>
                      <TableHead className="cursor-pointer dark:text-slate-300" onClick={() => handleSort("student_name")}>
                        <div className="flex items-center gap-1">Student <SortIcon k="student_name" /></div>
                      </TableHead>
                      <TableHead className="dark:text-slate-300">Admission</TableHead>
                      <TableHead className="dark:text-slate-300">Class</TableHead>
                      <TableHead className="dark:text-slate-300">Section</TableHead>
                      <TableHead className="text-right cursor-pointer dark:text-slate-300" onClick={() => handleSort("total_amount")}>
                        <div className="flex items-center justify-end gap-1">Total <SortIcon k="total_amount" /></div>
                      </TableHead>
                      <TableHead className="text-right cursor-pointer dark:text-slate-300" onClick={() => handleSort("paid_amount")}>
                        <div className="flex items-center justify-end gap-1">Paid <SortIcon k="paid_amount" /></div>
                      </TableHead>
                      <TableHead className="text-right cursor-pointer dark:text-slate-300" onClick={() => handleSort("due_amount")}>
                        <div className="flex items-center justify-end gap-1">Due <SortIcon k="due_amount" /></div>
                      </TableHead>
                      <TableHead className="text-right dark:text-slate-300">Fine</TableHead>
                      <TableHead className="text-right dark:text-slate-300">Due %</TableHead>
                      <TableHead className="text-right cursor-pointer dark:text-slate-300" onClick={() => handleSort("overdue_months")}>
                        <div className="flex items-center justify-end gap-1">Overdue <SortIcon k="overdue_months" /></div>
                      </TableHead>
                      <TableHead className="dark:text-slate-300">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {processedData.map((item, idx) => (
                      <TableRow key={item.student_id} className="dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <TableCell className="dark:text-slate-400">{idx + 1}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-semibold dark:text-slate-200">{item.student_name}</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500">{item.contact}</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500">Father: {item.father_name}</p>
                          </div>
                        </TableCell>
                        <TableCell className="dark:text-slate-300">{item.admission_no}</TableCell>
                        <TableCell className="dark:text-slate-300">{item.class_name}</TableCell>
                        <TableCell className="dark:text-slate-300">{item.section_name}</TableCell>
                        <TableCell className="text-right dark:text-slate-300">{formatCurrency(item.total_amount)}</TableCell>
                        <TableCell className="text-right text-emerald-600 dark:text-emerald-400 font-semibold">{formatCurrency(item.paid_amount)}</TableCell>
                        <TableCell className="text-right text-red-600 dark:text-red-400 font-bold">{formatCurrency(item.due_amount)}</TableCell>
                        <TableCell className="text-right text-amber-600 dark:text-amber-400">{formatCurrency(item.fine_amount)}</TableCell>
                        <TableCell className="text-right dark:text-slate-300">{item.due_percentage.toFixed(1)}%</TableCell>
                        <TableCell className="text-right text-red-600 dark:text-red-400 font-bold">{item.overdue_months}</TableCell>
                        <TableCell>{getStatusBadge(item.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ResponsiveLayout>
  )
}