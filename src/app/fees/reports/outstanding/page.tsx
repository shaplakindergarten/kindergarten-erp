"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { 
  ArrowLeft, Download, Loader2, Printer, RefreshCw, AlertTriangle,
  Users, Wallet, Clock, Phone, User, BookOpen, XCircle, CheckCircle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ResponsiveLayout } from "@/components/layout/responsive-layout"
import { formatCurrency } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { getSchoolPrintHeader } from "@/components/print/SchoolPrintHeader"

const supabase = createClient()

// 🆕 Updated OutstandingRecord with more details
interface OutstandingRecord {
  student_id: string
  student_name: string
  student_number: string
  class_id: string
  class_name: string
  section_name: string
  father_name: string
  contact: string
  total_amount: number
  paid_amount: number
  due_amount: number
  days_overdue: number
  last_payment_date: string | null
  payment_count: number
  // 🆕 New fields
  overdue_months: number
  pending_months: number
  partial_months: number
  earliest_due_date: string | null
  expected_amount: number
  fine_amount: number
  discount_amount: number
  overdue_status: "critical" | "high" | "medium" | "low"
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

export default function OutstandingReportPage() {
  const [loading, setLoading] = useState(true)
  const [records, setRecords] = useState<OutstandingRecord[]>([])
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [sections, setSections] = useState<SectionItem[]>([])

  const [selectedClass, setSelectedClass] = useState("all")
  const [selectedSection, setSelectedSection] = useState("all")
  const [selectedOverdueLevel, setSelectedOverdueLevel] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [showFilters, setShowFilters] = useState(true)

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

  const fetchClasses = async () => {
    try {
      const { data } = await supabase.from("classes").select("id, name, numeric_order").order("numeric_order")
      setClasses(data || [])
    } catch (error) {
      console.error(error)
    }
  }

  const fetchSections = async () => {
    try {
      let query = supabase.from("sections").select("id, name, class_id").order("name")
      if (selectedClass !== "all") query = query.eq("class_id", selectedClass)
      const { data } = await query
      setSections(data || [])
    } catch (error) {
      console.error(error)
    }
  }

  // 🆕 Load data from v_due_summary and student_fee_dues
  const loadData = useCallback(async () => {
    try {
      setLoading(true)

      // 1. Get data from v_due_summary
       let query = supabase
        .from('v_due_summary')
        .select('*')
        .gt('total_due', 0)
        .gt('overdue_months', 0) // Only students with overdue

      if (selectedClass !== "all") {
        query = query.eq('class_id', selectedClass)
      }
      if (selectedSection !== "all") {
        query = query.eq('section_id', selectedSection)
      }

      const { data: summaryData, error: summaryError } = await query
        .order('total_due', { ascending: false })

      if (summaryError) {
        console.error('Error loading outstanding data:', summaryError)
        setRecords([])
        return
      }

      if (!summaryData || summaryData.length === 0) {
        setRecords([])
        return
      }

      // 2. 🆕 Get detailed due info from student_fee_dues
      const studentIds = summaryData.map((s: any) => s.student_id)
      const { data: duesData, error: duesError } = await supabase
        .from('student_fee_dues')
        .select('student_id, due_amount, status, due_date, expected_amount, fine_amount, discount_amount, month')
        .in('student_id', studentIds)
        .gt('due_amount', 0)

      if (duesError) {
        console.error('Error loading dues details:', duesError)
      }

      // 3. Get latest payment date
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
            total_due: 0,
            expected_amount: 0,
            fine_amount: 0,
            discount_amount: 0,
            earliest_due: null,
            months: [],
          })
        }
        const entry = dueMap.get(d.student_id)
        if (d.status === 'overdue') entry.overdue_months++
        else if (d.status === 'pending') entry.pending_months++
        else if (d.status === 'partial') entry.partial_months++
        entry.total_due += d.due_amount || 0
        entry.expected_amount += d.expected_amount || 0
        entry.fine_amount += d.fine_amount || 0
        entry.discount_amount += d.discount_amount || 0
        entry.months.push(d.month)
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

      // 4. Calculate days overdue
      const today = new Date()
      
      // 5. Combine data
      const formattedRecords: OutstandingRecord[] = summaryData.map((item: any) => {
        const dueDetails = dueMap.get(item.student_id) || {
          overdue_months: 0,
          pending_months: 0,
          partial_months: 0,
          total_due: 0,
          expected_amount: 0,
          fine_amount: 0,
          discount_amount: 0,
          earliest_due: null,
          months: [],
        }

        const dueAmount = Number(item.total_due) || 0
        
        // Calculate overdue status based on days and amount
        let overdue_status: "critical" | "high" | "medium" | "low" = "low"
        if (dueAmount >= 500 && dueDetails.overdue_months >= 3) overdue_status = "critical"
        else if (dueAmount >= 300 && dueDetails.overdue_months >= 2) overdue_status = "high"
        else if (dueAmount >= 100 && dueDetails.overdue_months >= 1) overdue_status = "medium"
        else overdue_status = "low"

        // Calculate days overdue
        let daysOverdue = 0
        if (dueDetails.earliest_due) {
          daysOverdue = Math.floor((today.getTime() - new Date(dueDetails.earliest_due).getTime()) / (1000 * 60 * 60 * 24))
        }

        return {
          student_id: item.student_id,
          student_name: item.student_name || "Unknown",
          student_number: item.admission_no || "",
          class_id: item.class_id || "",
          class_name: item.class_name || "N/A",
          section_name: item.section_name || "N/A",
          father_name: item.father_name || "",
          contact: item.phone || "",
          total_amount: Number(item.total_expected) || 0,
          paid_amount: Number(item.total_paid) || 0,
          due_amount: dueAmount,
          days_overdue: daysOverdue,
          last_payment_date: paymentMap.get(item.student_id) || null,
          payment_count: item.paid_months || 0,
          // 🆕 New fields
          overdue_months: dueDetails.overdue_months,
          pending_months: dueDetails.pending_months,
          partial_months: dueDetails.partial_months,
          earliest_due_date: dueDetails.earliest_due,
          expected_amount: dueDetails.expected_amount,
          fine_amount: dueDetails.fine_amount,
          discount_amount: dueDetails.discount_amount,
          overdue_status: overdue_status,
        }
      })

      console.log("✅ Loaded outstanding students:", formattedRecords.length)
      console.log("💰 Total due:", formattedRecords.reduce((sum, r) => sum + r.due_amount, 0))

      setRecords(formattedRecords)
    } catch (error) {
      console.error("Error loading outstanding records:", error)
      setRecords([])
    } finally {
      setLoading(false)
    }
  }, [selectedClass, selectedSection])

  useEffect(() => {
    fetchSchoolInfo()
    fetchClasses()
  }, [])

  useEffect(() => {
    fetchSections()
  }, [selectedClass])

  useEffect(() => {
    loadData()
  }, [loadData])

  // 🆕 Get overdue badge with more details
  const getOverdueBadge = (record: OutstandingRecord) => {
    const { days_overdue, overdue_status, overdue_months, due_amount } = record
    
    if (overdue_status === "critical") {
      return <Badge className="bg-red-100 text-red-700 dark:bg-red-950/70 dark:text-red-300 border-red-200 dark:border-red-800">
        <XCircle className="h-3 w-3 mr-1" /> Critical ({overdue_months}m)
      </Badge>
    }
    if (overdue_status === "high") {
      return <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-950/70 dark:text-orange-300 border-orange-200 dark:border-orange-800">
        <AlertTriangle className="h-3 w-3 mr-1" /> High ({overdue_months}m)
      </Badge>
    }
    if (overdue_status === "medium") {
      return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-950/70 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800">
        <Clock className="h-3 w-3 mr-1" /> Medium ({overdue_months}m)
      </Badge>
    }
    return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 border-blue-200 dark:border-blue-800">
      <Clock className="h-3 w-3 mr-1" /> Low ({overdue_months}m)
    </Badge>
  }

  // Filter records
  const filteredRecords = records.filter(r => {
    if (selectedOverdueLevel !== "all" && r.overdue_status !== selectedOverdueLevel) return false
    if (searchTerm && !r.student_name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !r.student_number.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !r.father_name.toLowerCase().includes(searchTerm.toLowerCase())) return false
    return true
  })

  const totalDue = filteredRecords.reduce((sum, r) => sum + r.due_amount, 0)
  const totalPaid = filteredRecords.reduce((sum, r) => sum + r.paid_amount, 0)
  const totalAmount = filteredRecords.reduce((sum, r) => sum + r.total_amount, 0)
  const totalOverdueMonths = filteredRecords.reduce((sum, r) => sum + r.overdue_months, 0)

  const handleExportCSV = () => {
    const headers = ["Student", "ID", "Class", "Section", "Father", "Total", "Paid", "Due", "Fine", "Overdue Months", "Status"]
    const rows = filteredRecords.map(r => [
      r.student_name,
      r.student_number,
      r.class_name,
      r.section_name,
      r.father_name,
      formatCurrency(r.total_amount),
      formatCurrency(r.paid_amount),
      formatCurrency(r.due_amount),
      formatCurrency(r.fine_amount),
      r.overdue_months,
      r.overdue_status,
    ])
    const csv = [headers, ...rows].map(row => Array.isArray(row) ? row.join(",") : row).join("\n")
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `outstanding-report-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handlePrint = () => {
    const printContainer = document.createElement("div")
    printContainer.id = "outstanding-print-area"

    printContainer.innerHTML = `
      <div class="print-wrapper">
        ${getSchoolPrintHeader({ ...schoolInfo, school_logo: schoolInfo.school_logo ?? undefined, school_email: schoolInfo.school_email ?? undefined }, "Outstanding / Defaulter Report")}
        <div style="display:flex; justify-content:space-between; margin:15px 0; background:#f1f5f9; padding:12px; border-radius:6px;">
          <div><strong>Total Due:</strong> ${formatCurrency(totalDue)}</div>
          <div><strong>Students:</strong> ${filteredRecords.length}</div>
          <div><strong>Overdue Months:</strong> ${totalOverdueMonths}</div>
          <div><strong>Critical:</strong> ${filteredRecords.filter(r => r.overdue_status === "critical").length}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Student ID</th><th>Student Name</th><th>Class</th><th>Section</th>
              <th>Total</th><th>Paid</th><th>Due</th><th>Fine</th>
              <th>Overdue Months</th><th>Last Payment</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${filteredRecords.map(r => `
              <tr>
                <td>${r.student_number}</td>
                <td>${r.student_name}</td>
                <td>${r.class_name}</td>
                <td>${r.section_name}</td>
                <td>${formatCurrency(r.total_amount)}</td>
                <td>${formatCurrency(r.paid_amount)}</td>
                <td>${formatCurrency(r.due_amount)}</td>
                <td>${formatCurrency(r.fine_amount)}</td>
                <td>${r.overdue_months}</td>
                <td>${r.last_payment_date ? new Date(r.last_payment_date).toLocaleDateString() : '-'}</td>
                <td>${r.overdue_status}</td>
              </tr>
            `).join("")}
          </tbody>
          <tfoot>
            <tr style="font-weight:bold; background:#f1f5f9;">
              <td colspan="4" style="text-align:right;">TOTAL</td>
              <td>${formatCurrency(totalAmount)}</td>
              <td>${formatCurrency(totalPaid)}</td>
              <td style="color:#dc2626;">${formatCurrency(totalDue)}</td>
              <td>${formatCurrency(filteredRecords.reduce((s, r) => s + r.fine_amount, 0))}</td>
              <td>${totalOverdueMonths}</td>
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
        #outstanding-print-area, #outstanding-print-area * { visibility: visible; }
        #outstanding-print-area { position: absolute; inset: 0; background: white; padding: 20px; }
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

  if (loading && records.length === 0) {
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
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-gradient-to-r from-red-600 to-rose-700 rounded-xl p-5 shadow-lg">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild className="bg-white/20 hover:bg-white/30 text-white">
              <Link href="/fees/reports"><ArrowLeft className="h-5 w-5" /></Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-white">Outstanding / Defaulter Report</h1>
              <p className="text-red-100 text-sm">Students with pending overdue fees</p>
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

        {/* FILTERS */}
        {showFilters && (
          <Card className="dark:bg-slate-900 dark:border-slate-800">
            <CardContent className="pt-5">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs font-semibold dark:text-slate-400">Class</label>
                  <Select value={selectedClass} onValueChange={(v) => { setSelectedClass(v); setSelectedSection("all") }}>
                    <SelectTrigger className="dark:bg-slate-800 dark:border-slate-700">
                      <SelectValue placeholder="All Classes" />
                    </SelectTrigger>
                    <SelectContent className="dark:bg-slate-800 dark:border-slate-700">
                      <SelectItem value="all">All Classes</SelectItem>
                      {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-semibold dark:text-slate-400">Section</label>
                  <Select value={selectedSection} onValueChange={setSelectedSection}>
                    <SelectTrigger className="dark:bg-slate-800 dark:border-slate-700">
                      <SelectValue placeholder="All Sections" />
                    </SelectTrigger>
                    <SelectContent className="dark:bg-slate-800 dark:border-slate-700">
                      <SelectItem value="all">All Sections</SelectItem>
                      {sections.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-semibold dark:text-slate-400">Overdue Level</label>
                  <Select value={selectedOverdueLevel} onValueChange={setSelectedOverdueLevel}>
                    <SelectTrigger className="dark:bg-slate-800 dark:border-slate-700">
                      <SelectValue placeholder="All Levels" />
                    </SelectTrigger>
                    <SelectContent className="dark:bg-slate-800 dark:border-slate-700">
                      <SelectItem value="all">All Levels</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-semibold dark:text-slate-400">Search</label>
                  <Input 
                    placeholder="Search by name, ID..." 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-500"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STATS CARDS */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="bg-gradient-to-br from-rose-500 to-red-600 text-white border-0">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-rose-100">Total Due</p>
                  <p className="text-2xl font-bold">{formatCurrency(totalDue)}</p>
                </div>
                <AlertTriangle className="h-10 w-10 text-rose-200" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-emerald-500 to-green-600 text-white border-0">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-emerald-100">Total Paid</p>
                  <p className="text-2xl font-bold">{formatCurrency(totalPaid)}</p>
                </div>
                <Wallet className="h-10 w-10 text-emerald-200" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white border-0">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100">Students with Due</p>
                  <p className="text-2xl font-bold">{filteredRecords.length}</p>
                </div>
                <Users className="h-10 w-10 text-blue-200" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-orange-500 to-amber-600 text-white border-0">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100">Overdue Months</p>
                  <p className="text-2xl font-bold">{totalOverdueMonths}</p>
                </div>
                <Clock className="h-10 w-10 text-orange-200" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* TABLE */}
        <Card className="dark:bg-slate-900 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="dark:text-slate-100">Outstanding Records</CardTitle>
            <p className="text-sm text-muted-foreground dark:text-slate-400">
              {filteredRecords.length} students with overdue fees
            </p>
          </CardHeader>
          <CardContent>
            {filteredRecords.length === 0 ? (
              <div className="text-center py-10 text-slate-500 dark:text-slate-400">
                <CheckCircle className="h-12 w-12 mx-auto text-emerald-500 mb-4" />
                <p>No outstanding records found</p>
                <p className="text-sm">All students are up to date with their fees</p>
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
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Due</TableHead>
                      <TableHead className="text-right">Fine</TableHead>
                      <TableHead className="text-right">Overdue</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecords.map((r) => (
                      <TableRow key={r.student_id} className="dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <TableCell className="font-mono dark:text-slate-300">{r.student_number}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium dark:text-slate-200">{r.student_name}</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500">Father: {r.father_name}</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                              <Phone className="h-3 w-3" /> {r.contact || 'N/A'}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="dark:text-slate-300">{r.class_name}</TableCell>
                        <TableCell className="dark:text-slate-300">{r.section_name}</TableCell>
                        <TableCell className="text-right dark:text-slate-300">{formatCurrency(r.total_amount)}</TableCell>
                        <TableCell className="text-right text-emerald-600 dark:text-emerald-400">{formatCurrency(r.paid_amount)}</TableCell>
                        <TableCell className="text-right text-red-600 dark:text-red-400 font-bold">{formatCurrency(r.due_amount)}</TableCell>
                        <TableCell className="text-right text-amber-600 dark:text-amber-400">{formatCurrency(r.fine_amount)}</TableCell>
                        <TableCell className="text-right text-red-600 dark:text-red-400 font-bold">{r.overdue_months}m</TableCell>
                        <TableCell>{getOverdueBadge(r)}</TableCell>
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