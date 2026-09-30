"use client"

import { useState, useEffect, useCallback } from "react"
import { ResponsiveLayout } from "@/components/layout/responsive-layout"
import { createClient } from "@/lib/supabase/client"
import {
  Calendar,
  FileText,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Users,
  UserCheck,
  UserX,
  Clock,
  Filter,
  Search,
  RefreshCw,
  ArrowLeft,
  Printer,
  CalendarDays,
  Download,
  X
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  format,
  subMonths,
  addMonths,
  getDaysInMonth,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isWeekend
} from "date-fns"
import { toast } from "sonner"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import Link from "next/link"
import { getSchoolPrintHeader } from "@/components/print/SchoolPrintHeader"

const supabase = createClient()

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

interface StudentMonthlyReport {
  id: string
  name: string
  admission_no: string
  class_roll: string
  class_name: string
  section_name: string
  present: number
  absent: number
  late: number
  total: number
  percentage: number
  dailyStatus: Record<string, string>
}

type StudentRecord = {
  id: string
  name: string
  student_id: string | null
  class_roll: string | null
  class_id: string
  section_id: string
}

interface MonthlyStats {
  totalStudents: number
  totalPresent: number
  totalAbsent: number
  totalLate: number
  avgAttendance: number
  totalWorkingDays: number
}

interface SchoolInfo {
  school_name: string
  school_address: string
  school_phone: string
  school_logo?: string | null
  school_email?: string | null
}

const fmtDisplay = (d: Date) => format(d, "dd MMMM yyyy")
const fmtMonthYear = (d: Date) => format(d, "MMMM yyyy")

export default function MonthlyAttendancePage() {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [selectedClass, setSelectedClass] = useState("all")
  const [selectedSection, setSelectedSection] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [showFilters, setShowFilters] = useState(false)

  const [classes, setClasses] = useState<ClassItem[]>([])
  const [sections, setSections] = useState<SectionItem[]>([])
  const [reportData, setReportData] = useState<StudentMonthlyReport[]>([])
  const [stats, setStats] = useState<MonthlyStats>({
    totalStudents: 0,
    totalPresent: 0,
    totalAbsent: 0,
    totalLate: 0,
    avgAttendance: 0,
    totalWorkingDays: 0
  })
  const [monthDays, setMonthDays] = useState<Date[]>([])

  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo>({
    school_name: "Loading...",
    school_address: "",
    school_phone: "",
    school_logo: null,
    school_email: null,
  })

  const [loading, setLoading] = useState(false)
  const [pdfGen, setPdfGen] = useState(false)

  useEffect(() => {
      Promise.resolve(supabase.from("school_settings")
      .select("school_name, school_address, school_phone, school_logo, school_email")
      .limit(1).single()
      .then(({ data }) => { if (data) setSchoolInfo(data) }))
      .catch(() => setSchoolInfo({ school_name: "School Name", school_address: "", school_phone: "", school_logo: null, school_email: null }))
  }, [])

  useEffect(() => {
    supabase.from("classes").select("id, name, numeric_order").order("numeric_order")
      .then(({ data }) => { if (data) setClasses(data) })
  }, [])

  useEffect(() => {
    let q = supabase.from("sections").select("id, name, class_id").order("name")
    if (selectedClass !== "all") q = q.eq("class_id", selectedClass)
    q.then(({ data }) => {
      if (data) setSections(data)
      setSelectedSection("all")
    })
  }, [selectedClass])

  useEffect(() => {
    const start = startOfMonth(selectedDate)
    const end = endOfMonth(selectedDate)
    const days = eachDayOfInterval({ start, end })
    setMonthDays(days)
    setStats(prev => ({ ...prev, totalWorkingDays: days.length }))
  }, [selectedDate])

  const loadReport = useCallback(async () => {
    if (!selectedDate) return
    setLoading(true)
    try {
      const startDate = format(startOfMonth(selectedDate), "yyyy-MM-dd")
      const endDate = format(endOfMonth(selectedDate), "yyyy-MM-dd")

      let query = supabase
        .from("students")
        .select("id, name, student_id, class_roll, class_id, section_id")
        .eq("status", "active")
        .order("class_roll")

      if (selectedClass !== "all") query = query.eq("class_id", selectedClass)
      if (selectedSection !== "all") query = query.eq("section_id", selectedSection)

      const { data: studentsData } = await query

      if (!studentsData || studentsData.length === 0) {
        setReportData([])
        setStats(prev => ({ ...prev, totalStudents: 0, totalPresent: 0, totalAbsent: 0, totalLate: 0, avgAttendance: 0 }))
        setLoading(false)
        return
      }

      const classIds = [...new Set(studentsData.map(s => s.class_id).filter(Boolean))]
      const classMap = new Map<string, string>()
      if (classIds.length) {
        const { data: classData } = await supabase.from("classes").select("id, name").in("id", classIds)
        classData?.forEach(c => classMap.set(c.id, c.name))
      }

      const sectionIds = [...new Set(studentsData.map(s => s.section_id).filter(Boolean))]
      const sectionMap = new Map<string, string>()
      if (sectionIds.length) {
        const { data: sectionData } = await supabase.from("sections").select("id, name").in("id", sectionIds)
        sectionData?.forEach(s => sectionMap.set(s.id, s.name))
      }

      const { data: attendanceData } = await supabase
        .from("student_attendance")
        .select("student_id, status, date")
        .in("student_id", studentsData.map(s => s.id))
        .gte("date", startDate)
        .lte("date", endDate)

      const attendanceMap: Record<string, Record<string, string>> = {}
      studentsData.forEach(s => { attendanceMap[s.id] = {} })
      attendanceData?.forEach(a => {
        if (attendanceMap[a.student_id]) {
          attendanceMap[a.student_id][a.date] = a.status
        }
      })

      const reportRows: StudentMonthlyReport[] = studentsData.map((s: StudentRecord) => {
        let present = 0, absent = 0, late = 0
        monthDays.forEach(day => {
          const dateStr = format(day, "yyyy-MM-dd")
          const status = attendanceMap[s.id]?.[dateStr] || "absent"
          if (status === "present") present++
          else if (status === "absent") absent++
          else if (status === "late") late++
        })
        const total = present + absent + late
        const percentage = total > 0 ? Math.round((present + late) / total * 100) : 0
        return {
          id: s.id, name: s.name,
          admission_no: s.student_id || "N/A",
          class_roll: s.class_roll || "—",
          class_name: classMap.get(s.class_id) || "N/A",
          section_name: sectionMap.get(s.section_id) || "N/A",
          present, absent, late, total, percentage,
          dailyStatus: attendanceMap[s.id] || {}
        }
      })

      const totalStudents = reportRows.length
      const totalPresent = reportRows.reduce((sum, r) => sum + r.present, 0)
      const totalAbsent = reportRows.reduce((sum, r) => sum + r.absent, 0)
      const totalLate = reportRows.reduce((sum, r) => sum + r.late, 0)
      const avgAttendance = totalStudents > 0
        ? Math.round(reportRows.reduce((sum, r) => sum + r.percentage, 0) / totalStudents)
        : 0

      setStats({ totalStudents, totalPresent, totalAbsent, totalLate, avgAttendance, totalWorkingDays: monthDays.length })
      setReportData(reportRows)
      toast.success(`Report loaded for ${fmtMonthYear(selectedDate)}`)
    } catch (error) {
      console.error(error)
      toast.error("Failed to load report data")
    } finally {
      setLoading(false)
    }
  }, [selectedDate, selectedClass, selectedSection, monthDays])

  useEffect(() => { loadReport() }, [loadReport])

  const shiftMonth = (months: number) => {
    setSelectedDate(prev => months > 0 ? addMonths(prev, months) : subMonths(prev, Math.abs(months)))
  }

  const clearFilters = () => {
    setSelectedClass("all"); setSelectedSection("all"); setSearchTerm("")
    toast.info("Filters cleared")
  }

  const filteredData = reportData.filter(s =>
    !searchTerm ||
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.admission_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.class_roll && s.class_roll.includes(searchTerm))
  )

  const getPctStyles = (p: number) => 
    p >= 75 ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30" : 
    p >= 50 ? "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30" : 
    "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/30"
    
  const getAvatarStyles = (p: number) => 
    p >= 75 ? "bg-gradient-to-br from-emerald-400 to-emerald-600" : 
    p >= 50 ? "bg-gradient-to-br from-amber-400 to-amber-600" : 
    "bg-gradient-to-br from-red-400 to-red-600"

  // PDF Generation
  const generatePDF = async () => {
    setPdfGen(true)
    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
      doc.setFontSize(18); doc.setFont("helvetica", "bold")
      doc.text(schoolInfo.school_name, 148, 15, { align: "center" })
      doc.setFontSize(12); doc.setFont("helvetica", "normal"); doc.setTextColor(80, 80, 80)
      doc.text("Monthly Attendance Report", 148, 23, { align: "center" })
      doc.setFontSize(9)
      doc.text(`Month: ${fmtMonthYear(selectedDate)} | Working Days: ${stats.totalWorkingDays}`, 148, 31, { align: "center" })
      doc.text(`Present: ${stats.totalPresent} | Absent: ${stats.totalAbsent} | Late: ${stats.totalLate} | Students: ${stats.totalStudents} | Avg: ${stats.avgAttendance}%`, 148, 39, { align: "center" })

      const dayHeaders = monthDays.map(day => format(day, "dd"))
      const tableHeaders = ["#", "Roll", "Student Name", "Adm No", "Class", "Sec", ...dayHeaders, "P", "A", "L", "Total", "%"]
      const tableBody = filteredData.map((s, i) => {
        const dailyCells = monthDays.map(day => {
          const status = s.dailyStatus[format(day, "yyyy-MM-dd")] || "absent"
          return status === "present" ? "P" : status === "late" ? "L" : "A"
        })
        return [i + 1, s.class_roll, s.name, s.admission_no, s.class_name, s.section_name, ...dailyCells, s.present, s.absent, s.late, s.total, `${s.percentage}%`]
      })

      autoTable(doc, {
        startY: 46,
        head: [tableHeaders],
        body: tableBody,
        theme: "grid",
        styles: { fontSize: 6.5, cellPadding: 1.5 },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        didParseCell: (d) => {
          if (d.section === "body" && d.column.index >= 6 && d.column.index < 6 + monthDays.length) {
            const status = d.cell.raw
            if (status === "P") d.cell.styles.textColor = [5, 150, 105]
            else if (status === "L") d.cell.styles.textColor = [217, 119, 6]
            else if (status === "A") d.cell.styles.textColor = [220, 38, 38]
            d.cell.styles.fontStyle = "bold"
          }
          if (d.section === "body" && d.column.index === tableHeaders.length - 1) {
            const v = parseInt(String(d.cell.raw || "0%").replace("%", ""))
            if (v >= 75) d.cell.styles.textColor = [5, 150, 105]
            else if (v >= 50) d.cell.styles.textColor = [217, 119, 6]
            else d.cell.styles.textColor = [220, 38, 38]
            d.cell.styles.fontStyle = "bold"
          }
        },
        margin: { left: 10, right: 10 },
      })

      const pages = doc.getNumberOfPages()
      for (let i = 1; i <= pages; i++) {
        doc.setPage(i); doc.setFontSize(7); doc.setTextColor(160, 160, 160)
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 205)
        doc.text(`Page ${i} of ${pages}`, 282, 205, { align: "right" })
        doc.text(schoolInfo.school_name, 148, 205, { align: "center" })
      }

      doc.save(`monthly-attendance-${format(selectedDate, "yyyy-MM")}.pdf`)
      toast.success("PDF generated successfully")
    } catch (error) {
      console.error(error)
      toast.error("Failed to generate PDF")
    } finally {
      setPdfGen(false)
    }
  }

  // Print
  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    const dayHeaders = monthDays.map(day => format(day, "dd"))
    printWindow.document.write(`<!DOCTYPE html><html><head>
      <title>Monthly Attendance - ${fmtMonthYear(selectedDate)}</title>
<style>
         body { font-family: Arial, sans-serif; margin: 15px; font-size: 10px; }
         .report-title { font-size: 18px; font-weight: bold; margin: 15px 0; }
        .stats { display: flex; gap: 10px; margin: 10px 0; flex-wrap: wrap; }
        .stat-card { border: 1px solid #ddd; padding: 6px 12px; border-radius: 5px; text-align: center; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 8px; }
        th, td { border: 1px solid #ddd; padding: 4px 2px; text-align: center; }
        th { background: #f0f0f0; font-weight: bold; }
        .present { color: #059669; font-weight: bold; }
        .late { color: #d97706; font-weight: bold; }
        .absent { color: #dc2626; font-weight: bold; }
        .high { color: #059669; font-weight: bold; }
        .medium { color: #d97706; font-weight: bold; }
        .low { color: #dc2626; font-weight: bold; }
</style></head><body>
       ${getSchoolPrintHeader({ ...schoolInfo, school_logo: schoolInfo.school_logo ?? undefined, school_email: schoolInfo.school_email ?? undefined }, `Monthly Attendance Report — ${fmtMonthYear(selectedDate)}`)}
       <div class="stats">
        <div class="stat-card"><strong>Students</strong><br>${stats.totalStudents}</div>
        <div class="stat-card"><strong>Working Days</strong><br>${stats.totalWorkingDays}</div>
        <div class="stat-card"><strong>Present</strong><br>${stats.totalPresent}</div>
        <div class="stat-card"><strong>Absent</strong><br>${stats.totalAbsent}</div>
        <div class="stat-card"><strong>Late</strong><br>${stats.totalLate}</div>
        <div class="stat-card"><strong>Average</strong><br>${stats.avgAttendance}%</div>
      </div>
      <table><thead><tr>
        <th>#</th><th>Roll</th><th>Student Name</th><th>Adm No</th><th>Class</th><th>Section</th>
        ${dayHeaders.map(d => `<th>${d}</th>`).join('')}
        <th>P</th><th>A</th><th>L</th><th>Total</th><th>%</th>
      </tr></thead><tbody>
        ${filteredData.map((s, i) => {
          const dailyCells = monthDays.map(day => {
            const status = s.dailyStatus[format(day, "yyyy-MM-dd")] || "absent"
            const cls = status === "present" ? "present" : status === "late" ? "late" : "absent"
            const txt = status === "present" ? "P" : status === "late" ? "L" : "A"
            return `<td class="${cls}">${txt}</td>`
          }).join('')
          const pctCls = s.percentage >= 75 ? "high" : s.percentage >= 50 ? "medium" : "low"
          return `<tr><td>${i + 1}</td><td>${s.class_roll}</td><td style="text-align:left">${s.name}</td><td>${s.admission_no}</td><td>${s.class_name}</td><td>${s.section_name}</td>${dailyCells}<td>${s.present}</td><td>${s.absent}</td><td>${s.late}</td><td>${s.total}</td><td class="${pctCls}">${s.percentage}%</td></tr>`
        }).join('')}
      </tbody></table>
      <div style="margin-top:15px;text-align:center;font-size:8px;color:#666;border-top:1px solid #ccc;padding-top:8px">
        Generated on ${new Date().toLocaleString()} | ${schoolInfo.school_name}
      </div>
      <script>window.print(); setTimeout(() => window.close(), 1000);</script>
    </body></html>`)
    printWindow.document.close()
  }

  // CSV Export
  const exportToCSV = () => {
    const dayHeaders = monthDays.map(day => format(day, "dd/MM"))
    const headers = ["Roll", "Student Name", "Admission No", "Class", "Section", ...dayHeaders, "Present", "Absent", "Late", "Total", "Attendance %"]
    const rows = filteredData.map(s => {
      const dailyCells = monthDays.map(day => {
        const status = s.dailyStatus[format(day, "yyyy-MM-dd")] || "absent"
        return status === "present" ? "P" : status === "late" ? "L" : "A"
      })
      return [s.class_roll, s.name, s.admission_no, s.class_name, s.section_name, ...dailyCells, s.present, s.absent, s.late, s.total, `${s.percentage}%`]
    })
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = `monthly-attendance-${format(selectedDate, "yyyy-MM")}.csv`; a.click()
    URL.revokeObjectURL(url)
    toast.success("CSV exported successfully")
  }

  const hasActiveFilters = selectedClass !== "all" || selectedSection !== "all" || searchTerm

  return (
    <ResponsiveLayout>
      <div className="min-h-screen bg-slate-50 bg-gradient-to-br from-blue-50 via-slate-50 to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 p-3 font-sans transition-colors duration-200">
        
        {/* ── Compact Header ── */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-lg px-4 py-3 mb-4 shadow-md text-white flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link 
              href="/attendance" 
              className="flex items-center justify-center w-8 h-8 rounded-md bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-all backdrop-blur-sm"
            >
              <ArrowLeft size={16} />
            </Link>
            <div>
              <h1 className="text-lg md:text-xl font-bold tracking-tight leading-tight">
                Monthly Attendance
              </h1>
              <p className="text-xs text-indigo-100">
                {fmtMonthYear(selectedDate)} matrix
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all border backdrop-blur-sm ${
                showFilters 
                  ? "bg-white text-indigo-600 border-white" 
                  : "bg-white/10 text-white border-white/20 hover:bg-white/20"
              }`}
            >
              <Filter size={14} />
              {showFilters ? "Hide" : "Filters"}
              {hasActiveFilters && !showFilters && (
                <span className="w-1.5 h-1.5 rounded-full bg-pink-400 ml-1"></span>
              )}
            </button>
            <div className="w-px h-4 bg-white/30 hidden md:block"></div>
            <button onClick={exportToCSV} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-all backdrop-blur-sm">
              <Download size={14} /> CSV
            </button>
            <button onClick={generatePDF} disabled={pdfGen} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-all backdrop-blur-sm disabled:opacity-50">
              {pdfGen ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
              PDF
            </button>
            <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-all backdrop-blur-sm">
              <Printer size={14} /> Print
            </button>
          </div>
        </div>

        {/* ── Compact Month Navigation ── */}
        <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm mb-4">
          <button onClick={() => shiftMonth(-1)} className="flex items-center justify-center w-8 h-8 rounded border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            <ChevronLeft size={16} />
          </button>
          
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded text-sm">
            <CalendarDays size={14} className="text-blue-600 dark:text-blue-400" />
            <span className="font-semibold text-slate-800 dark:text-slate-200">{fmtMonthYear(selectedDate)}</span>
          </div>
          
          <button onClick={() => shiftMonth(1)} className="flex items-center justify-center w-8 h-8 rounded border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            <ChevronRight size={16} />
          </button>
          
          <button onClick={() => setSelectedDate(new Date())} className="px-3 py-1.5 rounded text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors">
            Today
          </button>
          
          <span className="hidden sm:inline-flex px-2 py-1.5 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs font-medium">
            {getDaysInMonth(selectedDate)}d · {stats.totalWorkingDays}w
          </span>
          
          <button onClick={loadReport} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors">
            <RefreshCw size={12} /> Refresh
          </button>
        </div>

        {/* ── Filter Panel (Solid Select Background) ── */}
        {showFilters && (
          <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm mb-4 animate-in slide-in-from-top-2 duration-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Class</label>
                <Select value={selectedClass} onValueChange={v => { setSelectedClass(v); setSelectedSection("all") }}>
                  <SelectTrigger className="w-full h-8 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 dark:text-slate-200">
                    <SelectValue placeholder="All Classes" />
                  </SelectTrigger>
                  {/* Solid Dropdown Background */}
                  <SelectContent className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-lg">
                    <SelectItem value="all" className="text-xs dark:text-slate-200">All Classes</SelectItem>
                    {classes.map(c => <SelectItem key={c.id} value={c.id} className="text-xs dark:text-slate-200">{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Section</label>
                <Select value={selectedSection} onValueChange={setSelectedSection}>
                  <SelectTrigger className="w-full h-8 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 dark:text-slate-200">
                    <SelectValue placeholder="All Sections" />
                  </SelectTrigger>
                  {/* Solid Dropdown Background */}
                  <SelectContent className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-lg">
                    <SelectItem value="all" className="text-xs dark:text-slate-200">All Sections</SelectItem>
                    {sections.map(s => <SelectItem key={s.id} value={s.id} className="text-xs dark:text-slate-200">{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Search</label>
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Name, roll, id..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-8 h-8 text-xs w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 dark:text-slate-200"
                  />
                </div>
              </div>
            </div>
            {hasActiveFilters && (
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <button onClick={clearFilters} className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors">
                  <X size={12} /> Clear filters
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Ultra Compact & Wide Stats Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2 mb-4">
          <div className="bg-gradient-to-br from-indigo-500 to-blue-600 p-2 rounded-lg shadow-sm relative overflow-hidden group hover:-translate-y-0.5 transition-all text-white flex flex-col justify-center">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold text-white/90 uppercase tracking-wide">Students</span>
              <Users size={14} className="opacity-70" />
            </div>
            <div className="text-lg font-bold leading-none">{stats.totalStudents}</div>
          </div>
          
          <div className="bg-gradient-to-br from-cyan-500 to-blue-500 p-2 rounded-lg shadow-sm relative overflow-hidden group hover:-translate-y-0.5 transition-all text-white flex flex-col justify-center">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold text-white/90 uppercase tracking-wide">Work Days</span>
              <CalendarDays size={14} className="opacity-70" />
            </div>
            <div className="text-lg font-bold leading-none">{stats.totalWorkingDays}</div>
          </div>

          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-2 rounded-lg shadow-sm relative overflow-hidden group hover:-translate-y-0.5 transition-all text-white flex flex-col justify-center">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold text-white/90 uppercase tracking-wide">Present</span>
              <UserCheck size={14} className="opacity-70" />
            </div>
            <div className="text-lg font-bold leading-none">{stats.totalPresent}</div>
          </div>

          <div className="bg-gradient-to-br from-red-500 to-rose-600 p-2 rounded-lg shadow-sm relative overflow-hidden group hover:-translate-y-0.5 transition-all text-white flex flex-col justify-center">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold text-white/90 uppercase tracking-wide">Absent</span>
              <UserX size={14} className="opacity-70" />
            </div>
            <div className="text-lg font-bold leading-none">{stats.totalAbsent}</div>
          </div>

          <div className="bg-gradient-to-br from-amber-500 to-orange-500 p-2 rounded-lg shadow-sm relative overflow-hidden group hover:-translate-y-0.5 transition-all text-white flex flex-col justify-center">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold text-white/90 uppercase tracking-wide">Late</span>
              <Clock size={14} className="opacity-70" />
            </div>
            <div className="text-lg font-bold leading-none">{stats.totalLate}</div>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-fuchsia-600 p-2 rounded-lg shadow-sm relative overflow-hidden group hover:-translate-y-0.5 transition-all text-white flex flex-col justify-center">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold text-white/90 uppercase tracking-wide">Average</span>
              <TrendingUp size={14} className="opacity-70" />
            </div>
            <div className="text-lg font-bold leading-none flex items-end gap-2">
              {stats.avgAttendance}%
              <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden mb-1">
                <div className="h-full bg-white rounded-full" style={{ width: `${stats.avgAttendance}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* ── Table Card ── */}
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
              <Calendar size={16} className="text-blue-600 dark:text-blue-400" />
              Attendance Matrix
              <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 text-[10px] font-semibold ml-1">
                {filteredData.length}
              </span>
            </div>
            
            <div className="flex items-center gap-3 text-[10px] font-medium">
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> <span className="text-slate-600 dark:text-slate-300">Present</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500" /> <span className="text-slate-600 dark:text-slate-300">Late</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500" /> <span className="text-slate-600 dark:text-slate-300">Absent</span>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 size={32} className="animate-spin text-blue-500" />
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Loading data...</span>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-center px-4">
              <AlertCircle size={28} className="text-slate-400 dark:text-slate-500 mb-1" />
              <div className="text-base font-bold text-slate-800 dark:text-slate-200">No data found</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse min-w-[900px] text-slate-800 dark:text-slate-200">
                <thead className="text-[10px] text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-3 py-2 font-semibold text-center w-8">#</th>
                    <th className="px-3 py-2 font-semibold w-12 text-center">Roll</th>
                    <th className="px-3 py-2 font-semibold min-w-[160px]">Student Details</th>
                    <th className="px-2 py-2 font-semibold text-center">Class</th>
                    <th className="px-2 py-2 font-semibold text-center">Sec</th>
                    {monthDays.map((day, idx) => (
                      <th key={idx} className={`px-0.5 py-2 text-center font-semibold w-6 ${isWeekend(day) ? 'text-amber-500/70' : ''}`}>
                        {format(day, "d")}
                      </th>
                    ))}
                    <th className="px-1 py-2 font-semibold text-center w-8">P</th>
                    <th className="px-1 py-2 font-semibold text-center w-8">A</th>
                    <th className="px-1 py-2 font-semibold text-center w-8">L</th>
                    <th className="px-2 py-2 font-semibold text-center w-10">Total</th>
                    <th className="px-3 py-2 font-semibold text-center w-14">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredData.map((student, idx) => {
                    const pctStyles = getPctStyles(student.percentage)
                    const avatarStyles = getAvatarStyles(student.percentage)
                    return (
                      <tr key={student.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors group">
                        <td className="px-3 py-2 text-center text-slate-400 dark:text-slate-500 font-medium">{idx + 1}</td>
                        <td className="px-3 py-2 text-center font-semibold text-slate-700 dark:text-slate-300">{student.class_roll}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded flex items-center justify-center text-white font-bold text-[10px] shadow-sm ${avatarStyles}`}>
                              {student.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="leading-tight">
                              <div className="font-semibold text-slate-800 dark:text-slate-100">{student.name}</div>
                              <div className="text-[9px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">ID: {student.admission_no}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-2 text-center">
                          <span className="inline-flex px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded text-[10px] font-medium">{student.class_name}</span>
                        </td>
                        <td className="px-2 py-2 text-center">
                          <span className="inline-flex px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded text-[10px] font-medium">{student.section_name}</span>
                        </td>
                        {monthDays.map((day, dayIdx) => {
                          const status = student.dailyStatus[format(day, "yyyy-MM-dd")] || "absent"
                          return (
                            <td key={dayIdx} className={`px-0.5 py-2 text-center ${isWeekend(day) ? "bg-amber-50/30 dark:bg-amber-900/10" : ""}`}>
                              {status === "present" ? <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">P</span> : 
                               status === "late" ? <span className="text-amber-500 dark:text-amber-400 font-bold text-[10px]">L</span> : 
                               <span className="text-red-400 dark:text-red-500 font-bold text-[10px] opacity-80">A</span>}
                            </td>
                          )
                        })}
                        <td className="px-1 py-2 text-center font-bold text-emerald-600 dark:text-emerald-400">{student.present}</td>
                        <td className="px-1 py-2 text-center font-bold text-red-500 dark:text-red-400">{student.absent}</td>
                        <td className="px-1 py-2 text-center font-bold text-amber-500 dark:text-amber-400">{student.late}</td>
                        <td className="px-2 py-2 text-center font-bold text-slate-600 dark:text-slate-300">{student.total}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`inline-flex items-center justify-center min-w-[2.5rem] px-1.5 py-0.5 rounded text-[10px] font-bold border ${pctStyles}`}>
                            {student.percentage}%
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </ResponsiveLayout>
  )
}
