"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { 
  ArrowLeft, Download, Loader2, Printer, RefreshCw, 
  Calendar, Wallet, TrendingUp, Users, AlertCircle,
  CheckCircle, XCircle, Clock, FileText, BookOpen
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ResponsiveLayout } from "@/components/layout/responsive-layout"
import { formatCurrency } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { getSchoolPrintHeader } from "@/components/print/SchoolPrintHeader"

const supabase = createClient()

interface AcademicYear {
  id: string
  name: string
  year_name: string
  start_date: string
  end_date: string
  is_current: boolean
}

// 🆕 Updated YearClosingSummary with more details
interface YearClosingSummary {
  total_collection: number
  total_students: number
  total_payments: number
  avg_per_student: number
  // 🆕 New fields
  total_due: number
  total_fine: number
  total_discount: number
  overdue_students: number
  fully_paid_students: number
  collection_rate: number
}

// 🆕 Updated DueRecord with more details
interface DueRecord {
  student_id: string
  student_name: string
  student_number: string
  class_name: string
  section_name: string
  total_due: number
  // 🆕 New fields
  total_expected: number
  total_paid: number
  total_fine: number
  total_discount: number
  overdue_months: number
  pending_months: number
  partial_months: number
  status: "critical" | "warning" | "normal"
}

interface SchoolInfo {
  school_name: string
  school_address: string
  school_phone: string
  school_email: string
  school_logo?: string | null
}

export default function YearClosingReportPage() {
  const [loading, setLoading] = useState(true)
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [selectedYear, setSelectedYear] = useState<string>("")
  // 🆕 State for summary with due info
  const [summary, setSummary] = useState<YearClosingSummary>({
    total_collection: 0,
    total_students: 0,
    total_payments: 0,
    avg_per_student: 0,
    total_due: 0,
    total_fine: 0,
    total_discount: 0,
    overdue_students: 0,
    fully_paid_students: 0,
    collection_rate: 0,
  })
  const [dueRecords, setDueRecords] = useState<DueRecord[]>([])

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
        .maybeSingle()

      if (!error && data) {
        console.log("✅ School info loaded:", data)
        setSchoolInfo(data)
      }
    } catch (error) {
      console.error("Error loading school info:", error)
    }
  }

  const fetchAcademicYears = async () => {
    try {
      const { data } = await supabase
        .from("academic_years")
        .select("id, name, year_name, start_date, end_date, is_current")
        .order("start_date", { ascending: false })
      
      if (data && data.length > 0) {
        setAcademicYears(data)
        const current = data.find(y => y.is_current)
        setSelectedYear(current ? current.id : data[0].id)
      }
    } catch (error) {
      console.error(error)
    }
  }

  // 🆕 Load data from v_due_summary and student_fee_dues
  const loadData = useCallback(async () => {
    try {
      setLoading(true)

      const year = academicYears.find(y => y.id === selectedYear)
      if (!year) {
        console.error("No academic year found")
        return
      }

      const startDate = year.start_date
      const endDate = year.end_date

      console.log("📅 Date range:", startDate, "to", endDate)

      // 1. Get payments for collection summary
      const { data: payments, error: paymentsError } = await supabase
        .from("fee_payments")
        .select("id, student_id, amount, payment_date, discount_amount, fine_amount")
        .gte("payment_date", startDate)
        .lte("payment_date", endDate)

      if (paymentsError) {
        console.error("Payments error:", paymentsError)
      }

      const totalCollection = (payments || []).reduce((sum, p) => sum + (p.amount || 0), 0)
      const uniqueStudents = new Set((payments || []).map(p => p.student_id)).size
      const totalPayments = payments?.length || 0
      const totalDiscount = (payments || []).reduce((sum, p) => sum + (p.discount_amount || 0), 0)
      const totalFine = (payments || []).reduce((sum, p) => sum + (p.fine_amount || 0), 0)

      // 2. 🆕 Get due data from v_due_summary for the year
      const { data: dueSummary, error: dueError } = await supabase
        .from('v_due_summary')
        .select('*')
        .gt('total_due', 0)
        .eq('academic_year_id', year.id)

      if (dueError) {
        console.error('Error loading due summary:', {
          message: (dueError as any)?.message,
          details: (dueError as any)?.details,
          hint: (dueError as any)?.hint,
          code: (dueError as any)?.code,
          full: JSON.stringify(dueError, null, 2)
        })
      }

      // 3. 🆕 Get detailed due info from student_fee_dues
      const studentIds = dueSummary?.map((s: any) => s.student_id) || []
      const { data: duesData, error: duesError } = await supabase
        .from('student_fee_dues')
        .select('student_id, due_amount, status, expected_amount, paid_amount, fine_amount, discount_amount')
        .in('student_id', studentIds)
        .gt('due_amount', 0)

      if (duesError) {
        console.error('Error loading dues details:', duesError)
      }

      // Build due map
      const dueMap = new Map()
      duesData?.forEach((d: any) => {
        if (!dueMap.has(d.student_id)) {
          dueMap.set(d.student_id, {
            total_due: 0,
            total_expected: 0,
            total_paid: 0,
            total_fine: 0,
            total_discount: 0,
            overdue_months: 0,
            pending_months: 0,
            partial_months: 0,
          })
        }
        const entry = dueMap.get(d.student_id)
        entry.total_due += d.due_amount || 0
        entry.total_expected += d.expected_amount || 0
        entry.total_paid += d.paid_amount || 0
        entry.total_fine += d.fine_amount || 0
        entry.total_discount += d.discount_amount || 0
        if (d.status === 'overdue') entry.overdue_months++
        else if (d.status === 'pending') entry.pending_months++
        else if (d.status === 'partial') entry.partial_months++
      })

      const totalDue = Array.from(dueMap.values()).reduce((sum, d) => sum + d.total_due, 0)
      const overdueStudents = Array.from(dueMap.values()).filter(d => d.overdue_months > 0).length

      // 4. Calculate collection rate
      const totalExpected = Array.from(dueMap.values()).reduce((sum, d) => sum + d.total_expected, 0) + totalCollection
      const collectionRate = totalExpected > 0 ? (totalCollection / totalExpected) * 100 : 0

      // 5. Format due records
      const formattedDues: DueRecord[] = dueSummary?.map((item: any) => {
        const dueDetails = dueMap.get(item.student_id) || {
          total_due: 0,
          total_expected: 0,
          total_paid: 0,
          total_fine: 0,
          total_discount: 0,
          overdue_months: 0,
          pending_months: 0,
          partial_months: 0,
        }

        const dueAmount = Number(item.total_due) || 0
        let status: "critical" | "warning" | "normal" = "normal"
        if (dueAmount >= 800) status = "critical"
        else if (dueAmount >= 200) status = "warning"

        return {
          student_id: item.student_id,
          student_name: item.student_name || "Unknown",
          student_number: item.admission_no || "",
          class_name: item.class_name || "N/A",
          section_name: item.section_name || "N/A",
          total_due: dueAmount,
          total_expected: dueDetails.total_expected,
          total_paid: dueDetails.total_paid,
          total_fine: dueDetails.total_fine,
          total_discount: dueDetails.total_discount,
          overdue_months: dueDetails.overdue_months,
          pending_months: dueDetails.pending_months,
          partial_months: dueDetails.partial_months,
          status: status,
        }
      }) || []

      setSummary({
        total_collection: totalCollection,
        total_students: uniqueStudents,
        total_payments: totalPayments,
        avg_per_student: uniqueStudents > 0 ? totalCollection / uniqueStudents : 0,
        total_due: totalDue,
        total_fine: totalFine,
        total_discount: totalDiscount,
        overdue_students: overdueStudents,
        fully_paid_students: uniqueStudents - overdueStudents,
        collection_rate: collectionRate,
      })

      setDueRecords(formattedDues)

      console.log("✅ Year closing data loaded:")
      console.log("  📊 Total Collection:", totalCollection)
      console.log("  📊 Total Due:", totalDue)
      console.log("  📊 Students:", uniqueStudents)

    } catch (error) {
      console.error("Error loading year closing data:", error)
      toast.error("Failed to load year closing data")
    } finally {
      setLoading(false)
    }
  }, [selectedYear, academicYears])

  useEffect(() => {
    fetchSchoolInfo()
    fetchAcademicYears()
  }, [])

  useEffect(() => {
    if (selectedYear && academicYears.length > 0) {
      loadData()
    }
  }, [selectedYear, academicYears, loadData])

  // 🆕 Status badge
  const getStatusBadge = (record: DueRecord) => {
    if (record.status === "critical") {
      return <Badge className="bg-red-100 text-red-700 dark:bg-red-950/70 dark:text-red-300">
        <XCircle className="h-3 w-3 mr-1" /> Critical ({record.overdue_months}m)
      </Badge>
    }
    if (record.status === "warning") {
      return <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-950/70 dark:text-orange-300">
        <AlertCircle className="h-3 w-3 mr-1" /> Warning ({record.overdue_months}m)
      </Badge>
    }
    return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-950/70 dark:text-yellow-300">
      <Clock className="h-3 w-3 mr-1" /> Normal ({record.overdue_months}m)
    </Badge>
  }

  const handlePrint = () => {
    const printContainer = document.createElement("div")
    printContainer.id = "year-closing-print-area"

    printContainer.innerHTML = `
      <div class="print-wrapper">
        ${getSchoolPrintHeader(schoolInfo, "Year Closing Report")}
        <div style="display:flex; justify-content:space-between; flex-wrap:wrap; margin:20px 0; background:#f1f5f9; padding:12px; border-radius:6px;">
          <div style="text-align:center; flex:1; min-width:80px;">
            <div style="font-size:10px; color:#64748b;">Total Collection</div>
            <div style="font-size:18px; font-weight:bold; color:#0f172a;">${formatCurrency(summary.total_collection)}</div>
          </div>
          <div style="text-align:center; flex:1; min-width:80px;">
            <div style="font-size:10px; color:#64748b;">Total Due</div>
            <div style="font-size:18px; font-weight:bold; color:#dc2626;">${formatCurrency(summary.total_due)}</div>
          </div>
          <div style="text-align:center; flex:1; min-width:80px;">
            <div style="font-size:10px; color:#64748b;">Students</div>
            <div style="font-size:18px; font-weight:bold; color:#0f172a;">${summary.total_students}</div>
          </div>
          <div style="text-align:center; flex:1; min-width:80px;">
            <div style="font-size:10px; color:#64748b;">Collection Rate</div>
            <div style="font-size:18px; font-weight:bold; color:#059669;">${summary.collection_rate.toFixed(1)}%</div>
          </div>
          <div style="text-align:center; flex:1; min-width:80px;">
            <div style="font-size:10px; color:#64748b;">Overdue Students</div>
            <div style="font-size:18px; font-weight:bold; color:#dc2626;">${summary.overdue_students}</div>
          </div>
          <div style="text-align:center; flex:1; min-width:80px;">
            <div style="font-size:10px; color:#64748b;">Avg/Student</div>
            <div style="font-size:18px; font-weight:bold; color:#0f172a;">${formatCurrency(summary.avg_per_student)}</div>
          </div>
        </div>
        <h3 style="margin-top:15px; margin-bottom:10px; font-size:14px; font-weight:bold; color:#0f172a;">
          Carry Forward Due (${dueRecords.length} students)
        </h3>
        <table>
          <thead>
            <tr>
              <th>Student ID</th><th>Student Name</th><th>Class</th><th>Section</th>
              <th>Due</th><th>Fine</th><th>Overdue Months</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${dueRecords.map((r) => `
              <tr>
                <td>${r.student_number}</td>
                <td>${r.student_name}</td>
                <td>${r.class_name}</td>
                <td>${r.section_name}</td>
                <td style="color:#dc2626;font-weight:bold;">${formatCurrency(r.total_due)}</td>
                <td>${formatCurrency(r.total_fine)}</td>
                <td>${r.overdue_months}m</td>
                <td>${r.status}</td>
              </tr>
            `).join("")}
          </tbody>
          <tfoot>
            <tr style="font-weight:bold; background:#f1f5f9;">
              <td colspan="4" style="text-align:right;">TOTAL</td>
              <td style="color:#dc2626;">${formatCurrency(summary.total_due)}</td>
              <td>${formatCurrency(summary.total_fine)}</td>
              <td>${dueRecords.reduce((s, r) => s + r.overdue_months, 0)}</td>
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
        #year-closing-print-area, #year-closing-print-area * { visibility: visible; }
        #year-closing-print-area { position: absolute; inset: 0; background: white; padding: 20px; }
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

  const handleExportCSV = () => {
    const headers = ["Student ID", "Student Name", "Class", "Section", "Due", "Fine", "Overdue Months", "Status"]
    const rows = dueRecords.map(r => [
      r.student_number,
      r.student_name,
      r.class_name,
      r.section_name,
      formatCurrency(r.total_due),
      formatCurrency(r.total_fine),
      r.overdue_months,
      r.status,
    ])
    const csv = [headers, ...rows].map(row => Array.isArray(row) ? row.join(",") : row).join("\n")
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `year-closing-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const year = academicYears.find(y => y.id === selectedYear)

  if (loading && dueRecords.length === 0) {
    return (
      <ResponsiveLayout>
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      </ResponsiveLayout>
    )
  }

  return (
    <ResponsiveLayout>
      <div className="space-y-6 p-4 md:p-6">
        {/* HEADER */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-gradient-to-r from-purple-600 to-indigo-700 rounded-xl p-5 shadow-lg">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild className="bg-white/20 hover:bg-white/30 text-white">
              <Link href="/fees/reports"><ArrowLeft className="h-5 w-5" /></Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-white">Year Closing Report</h1>
              <p className="text-purple-100 text-sm">Academic year carry forward summary</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={loadData} className="bg-white/20 text-white hover:bg-white/30">
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh
            </Button>
            <Button variant="secondary" onClick={handlePrint} className="bg-white/20 text-white hover:bg-white/30">
              <Printer className="h-4 w-4 mr-1" /> Print
            </Button>
            <Button variant="secondary" onClick={handleExportCSV} className="bg-white/20 text-white hover:bg-white/30">
              <Download className="h-4 w-4 mr-1" /> CSV
            </Button>
          </div>
        </div>

        {/* Academic Year Selector */}
        <div className="space-y-2">
          <label className="text-sm font-semibold dark:text-slate-400 flex items-center gap-2">
            <Calendar className="h-4 w-4" /> Academic Year
          </label>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-64 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="dark:bg-slate-800 dark:border-slate-700">
              {academicYears.map((y) => (
                <SelectItem key={y.id} value={y.id} className="dark:text-slate-200">
                  {y.name} {y.is_current && "(Current)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* SUMMARY CARDS - Updated */}
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          <Card className="bg-gradient-to-br from-emerald-500 to-green-600 text-white border-0">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-emerald-100 text-sm">Collection</p>
                  <p className="text-2xl font-bold">{formatCurrency(summary.total_collection)}</p>
                </div>
                <Wallet className="h-10 w-10 text-emerald-200" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-rose-500 to-red-600 text-white border-0">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-rose-100 text-sm">Total Due</p>
                  <p className="text-2xl font-bold">{formatCurrency(summary.total_due)}</p>
                </div>
                <AlertCircle className="h-10 w-10 text-rose-200" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white border-0">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm">Payments</p>
                  <p className="text-2xl font-bold">{summary.total_payments}</p>
                </div>
                <FileText className="h-10 w-10 text-blue-200" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-500 to-violet-600 text-white border-0">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm">Students</p>
                  <p className="text-2xl font-bold">{summary.total_students}</p>
                </div>
                <Users className="h-10 w-10 text-purple-200" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-orange-500 to-amber-600 text-white border-0">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-sm">Collection Rate</p>
                  <p className="text-2xl font-bold">{summary.collection_rate.toFixed(1)}%</p>
                </div>
                <TrendingUp className="h-10 w-10 text-orange-200" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-500 to-rose-600 text-white border-0">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-red-100 text-sm">Overdue</p>
                  <p className="text-2xl font-bold">{summary.overdue_students}</p>
                </div>
                <AlertCircle className="h-10 w-10 text-red-200" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* DUE TABLE */}
        <Card className="dark:bg-slate-900 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 dark:text-slate-100">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Carry Forward Due
              <Badge variant="secondary" className="ml-2 dark:bg-slate-700 dark:text-slate-300">
                {dueRecords.length} students
              </Badge>
            </CardTitle>
            <p className="text-sm text-muted-foreground dark:text-slate-400">
              Total due to carry forward: {formatCurrency(summary.total_due)}
            </p>
          </CardHeader>
          <CardContent>
            {dueRecords.length === 0 ? (
              <div className="text-center py-10">
                <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
                <p className="text-slate-500 dark:text-slate-400">No outstanding dues to carry forward</p>
                <p className="text-sm text-slate-400 dark:text-slate-500">All students have cleared their fees</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="dark:border-slate-800">
                      <TableHead>Student ID</TableHead>
                      <TableHead>Student Name</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Section</TableHead>
                      <TableHead className="text-right">Due</TableHead>
                      <TableHead className="text-right">Fine</TableHead>
                      <TableHead className="text-right">Overdue</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dueRecords.map((r) => (
                      <TableRow key={r.student_id} className="dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <TableCell className="font-mono dark:text-slate-300">{r.student_number}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium dark:text-slate-200">{r.student_name}</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500">
                              Expected: {formatCurrency(r.total_expected)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="dark:text-slate-300">{r.class_name}</TableCell>
                        <TableCell className="dark:text-slate-300">{r.section_name}</TableCell>
                        <TableCell className="text-right text-red-600 dark:text-red-400 font-bold">
                          {formatCurrency(r.total_due)}
                        </TableCell>
                        <TableCell className="text-right text-amber-600 dark:text-amber-400">
                          {formatCurrency(r.total_fine)}
                        </TableCell>
                        <TableCell className="text-right text-red-600 dark:text-red-400">
                          {r.overdue_months}m
                        </TableCell>
                        <TableCell>{getStatusBadge(r)}</TableCell>
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