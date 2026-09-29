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
  Printer
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { format } from "date-fns"
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

interface StudentAttendanceReport {
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
}

type StudentRecord = {
  id: string
  name: string
  student_id: string | null
  class_roll: string | null
  class_id: string
  section_id: string
}

interface DailyStats {
  totalStudents: number
  totalPresent: number
  totalAbsent: number
  totalLate: number
  avgAttendance: number
}

interface SchoolInfo {
  school_name: string
  school_address: string
  school_phone: string
}

const fmtDisplay = (d: string) => {
  if (!d) return ""
  const [y, m, day] = d.split("-")
  return `${day}/${m}/${y}`
}

export default function DailyAttendancePage() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [selectedClass, setSelectedClass] = useState("all")
  const [selectedSection, setSelectedSection] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [sections, setSections] = useState<SectionItem[]>([])
  const [reportData, setReportData] = useState<StudentAttendanceReport[]>([])
  const [stats, setStats] = useState<DailyStats>({
    totalStudents: 0,
    totalPresent: 0,
    totalAbsent: 0,
    totalLate: 0,
    avgAttendance: 0
  })
  
  // ✅ স্কুল ইনফো - students/page.tsx এর মতো করে
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo>({
    school_name: "Loading...",
    school_address: "",
    school_phone: "",
  })
  
  const [loading, setLoading] = useState(false)
  const [pdfGen, setPdfGen] = useState(false)

  // ✅ fetch school - students/page.tsx এর মতো একই পদ্ধতি
  useEffect(() => {
    supabase.from("school_settings")
      .select("school_name, school_address, school_phone")
      .limit(1).single()
      .then(({ data }) => { if (data) setSchoolInfo(data) })
      .catch(() => {
        setSchoolInfo({
          school_name: "School Name",
          school_address: "",
          school_phone: "",
        })
      })
  }, [])

  // Fetch classes
  useEffect(() => {
    supabase
      .from("classes")
      .select("id, name, numeric_order")
      .order("numeric_order")
      .then(({ data }) => { if (data) setClasses(data) })
  }, [])

  // Fetch sections when class changes
  useEffect(() => {
    let q = supabase.from("sections").select("id, name, class_id").order("name")
    if (selectedClass !== "all") q = q.eq("class_id", selectedClass)
    q.then(({ data }) => {
      if (data) setSections(data)
      setSelectedSection("all")
    })
  }, [selectedClass])

  // Load report data
  const loadReport = useCallback(async () => {
    if (!selectedDate) return
    setLoading(true)
    try {
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
        setStats({
          totalStudents: 0,
          totalPresent: 0,
          totalAbsent: 0,
          totalLate: 0,
          avgAttendance: 0
        })
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
        .eq("date", selectedDate)
      
      const attendanceCount: Record<string, { present: number; absent: number; late: number; total: number }> = {}
      
      studentsData.forEach(s => {
        attendanceCount[s.id] = { present: 0, absent: 0, late: 0, total: 0 }
      })
      
      attendanceData?.forEach(a => {
        if (attendanceCount[a.student_id]) {
          if (a.status === "present") attendanceCount[a.student_id].present++
          else if (a.status === "absent") attendanceCount[a.student_id].absent++
          else if (a.status === "late") attendanceCount[a.student_id].late++
          attendanceCount[a.student_id].total++
        }
      })
      
      const reportRows: StudentAttendanceReport[] = studentsData.map((s: StudentRecord) => {
        const counts = attendanceCount[s.id] || { present: 0, absent: 0, late: 0, total: 0 }
        const total = counts.present + counts.absent + counts.late
        const percentage = total > 0 ? Math.round((counts.present + counts.late) / total * 100) : 0
        
        return {
          id: s.id,
          name: s.name,
          admission_no: s.student_id || "N/A",
          class_roll: s.class_roll || "—",
          class_name: classMap.get(s.class_id) || "N/A",
          section_name: sectionMap.get(s.section_id) || "N/A",
          present: counts.present,
          absent: counts.absent,
          late: counts.late,
          total: total,
          percentage: percentage
        }
      })
      
      const totalStudents = reportRows.length
      const totalPresent = reportRows.reduce((sum, r) => sum + r.present, 0)
      const totalAbsent = reportRows.reduce((sum, r) => sum + r.absent, 0)
      const totalLate = reportRows.reduce((sum, r) => sum + r.late, 0)
      const avgAttendance = totalStudents > 0 
        ? Math.round(reportRows.reduce((sum, r) => sum + r.percentage, 0) / totalStudents)
        : 0
      
      setStats({
        totalStudents,
        totalPresent,
        totalAbsent,
        totalLate,
        avgAttendance
      })
      
      setReportData(reportRows)
      toast.success(`Report loaded for ${fmtDisplay(selectedDate)}`)
      
    } catch (error) {
      console.error("Error loading report:", error)
      toast.error("Failed to load report data")
    } finally {
      setLoading(false)
    }
  }, [selectedDate, selectedClass, selectedSection])

  useEffect(() => {
    loadReport()
  }, [loadReport])

  const shiftDate = (days: number) => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + days)
    setSelectedDate(format(d, "yyyy-MM-dd"))
  }

  const clearFilters = () => {
    setSelectedClass("all")
    setSelectedSection("all")
    setSearchTerm("")
    toast.info("Filters cleared")
  }

  const filteredData = reportData.filter(s =>
    !searchTerm ||
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.admission_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.class_roll && s.class_roll.includes(searchTerm))
  )

  // ✅ PDF Generation with School Header (students/page.tsx এর PDF স্টাইল)
  const generatePDF = async () => {
    setPdfGen(true)
    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
      
      // School Header
      doc.setFontSize(18); doc.setFont("helvetica", "bold")
      doc.text(schoolInfo.school_name, 148, 15, { align: "center" })
      
      doc.setFontSize(12); doc.setFont("helvetica", "normal"); doc.setTextColor(80, 80, 80)
      doc.text("Daily Attendance Report", 148, 23, { align: "center" })
      
      doc.setFontSize(9)
      doc.text(`Date: ${fmtDisplay(selectedDate)} | Present: ${stats.totalPresent} | Absent: ${stats.totalAbsent} | Late: ${stats.totalLate} | Total: ${stats.totalStudents} | Average: ${stats.avgAttendance}%`, 148, 31, { align: "center" })
      
      autoTable(doc, {
        startY: 38,
        head: [["#", "Roll", "Student Name", "Admission No", "Class", "Section", "P", "A", "L", "Total", "%"]],
        body: filteredData.map((s, i) => [
          i + 1,
          s.class_roll,
          s.name,
          s.admission_no,
          s.class_name,
          s.section_name,
          s.present,
          s.absent,
          s.late,
          s.total,
          `${s.percentage}%`
        ]),
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        didParseCell: (d) => {
          if (d.section === "body" && d.column.index === 10) {
            const v = String(d.cell.raw || "0%").replace("%", "")
            const percent = parseInt(v)
            if (percent >= 75) d.cell.styles.textColor = [5, 150, 105]
            else if (percent >= 50) d.cell.styles.textColor = [217, 119, 6]
            else d.cell.styles.textColor = [220, 38, 38]
          }
        },
        margin: { left: 14, right: 14 },
      })
      
      const pages = doc.getNumberOfPages()
      for (let i = 1; i <= pages; i++) {
        doc.setPage(i); doc.setFontSize(7.5); doc.setTextColor(160, 160, 160)
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 200)
        doc.text(`Page ${i} of ${pages}`, 282, 200, { align: "right" })
        doc.text(schoolInfo.school_name, 148, 200, { align: "center" })
      }
      
      doc.save(`daily-attendance-${selectedDate}.pdf`)
      toast.success("PDF generated successfully")
    } catch (error) {
      console.error("PDF error:", error)
      toast.error("Failed to generate PDF")
    } finally {
      setPdfGen(false)
    }
  }

  // ✅ Print Handler
  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Daily Attendance Report - ${fmtDisplay(selectedDate)}</title>
<style>
           body { font-family: Arial, sans-serif; margin: 20px; }
           .report-title { font-size: 18px; font-weight: bold; margin: 15px 0; }
          .stats { display: flex; gap: 15px; margin: 15px 0; flex-wrap: wrap; justify-content: center; }
          .stat-card { border: 1px solid #ddd; padding: 10px; border-radius: 5px; min-width: 100px; text-align: center; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }
          th { background: #f0f0f0; font-weight: bold; }
          .text-left { text-align: left; }
          .high { color: #059669; font-weight: bold; }
          .medium { color: #d97706; font-weight: bold; }
          .low { color: #dc2626; font-weight: bold; }
          .footer { margin-top: 20px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #ccc; padding-top: 10px; }
          @media print { button { display: none; } }
</style>
      </head>
      <body>
        ${getSchoolPrintHeader(schoolInfo, `Daily Attendance Report`)}
        <p style="text-align:center">Date: ${fmtDisplay(selectedDate)}</p>

        <div class="stats">
          <div class="stat-card"><strong>Total Students</strong><br>${stats.totalStudents}</div>
          <div class="stat-card" style="border-color: #059669;"><strong>Present</strong><br>${stats.totalPresent}</div>
          <div class="stat-card" style="border-color: #dc2626;"><strong>Absent</strong><br>${stats.totalAbsent}</div>
          <div class="stat-card" style="border-color: #d97706;"><strong>Late</strong><br>${stats.totalLate}</div>
          <div class="stat-card"><strong>Average</strong><br>${stats.avgAttendance}%</div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>#</th><th>Roll</th><th class="text-left">Student Name</th><th>Admission No</th><th>Class</th><th>Section</th><th>P</th><th>A</th><th>L</th><th>Total</th><th>%</th>
            </tr>
          </thead>
          <tbody>
            ${filteredData.map((s, i) => {
              let percentClass = ""
              if (s.percentage >= 75) percentClass = "high"
              else if (s.percentage >= 50) percentClass = "medium"
              else percentClass = "low"
              return `
                <tr>
                  <td>${i + 1}</td>
                  <td>${s.class_roll}</td>
                  <td class="text-left">${s.name}</td>
                  <td>${s.admission_no}</td>
                  <td>${s.class_name}</td>
                  <td>${s.section_name}</td>
                  <td>${s.present}</td>
                  <td>${s.absent}</td>
                  <td>${s.late}</td>
                  <td>${s.total}</td>
                  <td class="${percentClass}">${s.percentage}%</td>
                </tr>
              `
            }).join("")}
          </tbody>
        </table>
        
        <div class="footer">
          Generated on ${new Date().toLocaleString()} | ${schoolInfo.school_name}
        </div>
        <script>window.print(); setTimeout(() => window.close(), 1000);<\/script>
      </body>
      </html>
    `)
    printWindow.document.close()
  }

  return (
    <ResponsiveLayout>
      <style jsx global>{`
        .dark .text-slate-700, .dark .text-slate-800 { color: #e2e8f0 !important; }
        .dark .bg-white { background-color: #0f172a !important; }
        .dark .bg-slate-50 { background-color: #1e293b !important; }
        .dark .border-slate-200 { border-color: #334155 !important; }
      `}</style>

      <div className="space-y-5 p-4 md:p-6">
        
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild className="bg-white/20 hover:bg-white/30 text-white rounded-xl">
              <Link href="/attendance"><ArrowLeft className="h-5 w-5" /></Link>
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">Daily Attendance Report</h1>
              <p className="text-blue-100 text-sm">View daily attendance summary and details</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setShowFilters(!showFilters)} className="bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-xl">
              <Filter className="h-4 w-4 mr-1" />{showFilters ? "Hide" : "Filters"}
            </Button>
            <Button onClick={generatePDF} disabled={pdfGen} className="bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-xl">
              {pdfGen ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileText className="h-4 w-4 mr-1" />}PDF
            </Button>
            <Button onClick={handlePrint} className="bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-xl">
              <Printer className="h-4 w-4 mr-1" />Print
            </Button>
          </div>
        </div>

        {/* Date Navigation */}
        <Card className="border-0 shadow-md bg-white dark:bg-slate-900">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" size="icon" onClick={() => shiftDate(-1)} className="rounded-xl dark:border-slate-700">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="w-44 font-medium rounded-xl dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              />
              <Button variant="outline" size="icon" onClick={() => shiftDate(1)} className="rounded-xl dark:border-slate-700">
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => setSelectedDate(format(new Date(), "yyyy-MM-dd"))} className="rounded-xl text-blue-600 border-blue-200 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400">
                Today
              </Button>
              <span className="text-slate-500 dark:text-slate-400 text-sm font-medium bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg">
                {fmtDisplay(selectedDate)}
              </span>
              <Button onClick={loadReport} variant="outline" size="sm" className="rounded-xl ml-auto">
                <RefreshCw className="h-4 w-4 mr-1" />Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        {showFilters && (
          <Card className="border-0 shadow-md bg-white dark:bg-slate-800">
            <CardContent className="pt-5 pb-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1 block">Class</label>
                  <Select value={selectedClass} onValueChange={v => { setSelectedClass(v); setSelectedSection("all") }}>
                    <SelectTrigger className="rounded-xl bg-white dark:bg-slate-900 dark:border-slate-600 dark:text-white">
                      <SelectValue placeholder="All Classes" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-slate-800">
                      <SelectItem value="all" className="dark:text-white">All Classes</SelectItem>
                      {classes.map(c => <SelectItem key={c.id} value={c.id} className="dark:text-white">{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1 block">Section</label>
                  <Select value={selectedSection} onValueChange={setSelectedSection}>
                    <SelectTrigger className="rounded-xl bg-white dark:bg-slate-900 dark:border-slate-600 dark:text-white">
                      <SelectValue placeholder="All Sections" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-slate-800">
                      <SelectItem value="all" className="dark:text-white">All Sections</SelectItem>
                      {sections.map(s => <SelectItem key={s.id} value={s.id} className="dark:text-white">{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1 block">Search</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input 
                      placeholder="Name, roll, admission..." 
                      value={searchTerm} 
                      onChange={e => setSearchTerm(e.target.value)} 
                      className="pl-9 rounded-xl bg-white dark:bg-slate-900 dark:border-slate-600 dark:text-white dark:placeholder:text-slate-500"
                    />
                  </div>
                </div>
              </div>
              {(selectedClass !== "all" || selectedSection !== "all" || searchTerm) && (
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 flex justify-end">
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="text-red-500 hover:text-red-700">
                    Clear all filters
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
          <Card className="bg-gradient-to-br from-slate-600 to-slate-700 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div><p className="text-xs opacity-75">Total Students</p><p className="text-2xl font-bold">{stats.totalStudents}</p></div>
                <Users className="h-7 w-7 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div><p className="text-xs opacity-75">Present</p><p className="text-2xl font-bold">{stats.totalPresent}</p></div>
                <UserCheck className="h-7 w-7 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-500 to-rose-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div><p className="text-xs opacity-75">Absent</p><p className="text-2xl font-bold">{stats.totalAbsent}</p></div>
                <UserX className="h-7 w-7 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div><p className="text-xs opacity-75">Late</p><p className="text-2xl font-bold">{stats.totalLate}</p></div>
                <Clock className="h-7 w-7 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div><p className="text-xs opacity-75">Avg Attendance</p><p className="text-2xl font-bold">{stats.avgAttendance}%</p></div>
                <TrendingUp className="h-7 w-7 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Progress Bar */}
        <div>
          <div className="w-full h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden flex">
            {stats.totalStudents > 0 && (
              <>
                <div className="bg-emerald-500 h-full transition-all" style={{ width: `${(stats.totalPresent / stats.totalStudents) * 100}%` }} />
                <div className="bg-amber-500 h-full transition-all" style={{ width: `${(stats.totalLate / stats.totalStudents) * 100}%` }} />
                <div className="bg-red-500 h-full transition-all" style={{ width: `${(stats.totalAbsent / stats.totalStudents) * 100}%` }} />
              </>
            )}
          </div>
          <div className="flex gap-4 mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />Present ({stats.totalPresent})</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" />Late ({stats.totalLate})</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500" />Absent ({stats.totalAbsent})</span>
          </div>
        </div>

        {/* Attendance Table */}
        <Card className="border-0 shadow-md bg-white dark:bg-slate-800">
          <CardHeader className="bg-slate-50 dark:bg-slate-700 rounded-t-2xl py-4 px-5">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-slate-700 dark:text-slate-100">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  Attendance Details
                  <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border-0 ml-1">{filteredData.length} students</Badge>
                </CardTitle>
                <CardDescription className="dark:text-slate-300">Attendance summary for {fmtDisplay(selectedDate)}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="h-10 w-10 animate-spin text-blue-600 mb-3" />
                <p className="text-slate-500 dark:text-slate-400 text-sm">Loading report...</p>
              </div>
            ) : filteredData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500">
                <AlertCircle className="h-14 w-14 mb-3" />
                <p className="font-semibold text-lg">No data found</p>
                <p className="text-sm">Try changing filters or selecting a different date</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-12 gap-2 px-4 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase tracking-wider bg-slate-50 dark:bg-slate-700 border-b border-slate-100 dark:border-slate-600">
                  <div className="col-span-1">#</div>
                  <div className="col-span-1">Roll</div>
                  <div className="col-span-3">Student Name</div>
                  <div className="col-span-2 hidden md:block">Admission No</div>
                  <div className="col-span-1 hidden md:block">Class</div>
                  <div className="col-span-1 hidden md:block">Section</div>
                  <div className="col-span-1">P</div>
                  <div className="col-span-1">A</div>
                  <div className="col-span-1">L</div>
                  <div className="col-span-1">%</div>
                </div>

                <div className="divide-y divide-slate-50 dark:divide-slate-700">
                  {filteredData.map((student, idx) => {
                    let percentClass = ""
                    if (student.percentage >= 75) percentClass = "text-emerald-600 dark:text-emerald-400 font-bold"
                    else if (student.percentage >= 50) percentClass = "text-amber-600 dark:text-amber-400 font-bold"
                    else percentClass = "text-red-600 dark:text-red-400 font-bold"
                    
                    return (
                      <div
                        key={student.id}
                        className={`grid grid-cols-12 gap-2 px-4 py-3 items-center ${idx % 2 === 0 ? "bg-white dark:bg-slate-800" : "bg-slate-50/40 dark:bg-slate-700/30"}`}
                      >
                        <div className="col-span-1">
                          <span className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md">{idx + 1}</span>
                        </div>
                        <div className="col-span-1">
                          <span className="text-sm text-slate-700 dark:text-slate-200">{student.class_roll}</span>
                        </div>
                        <div className="col-span-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${student.percentage >= 75 ? "bg-emerald-500" : student.percentage >= 50 ? "bg-amber-500" : "bg-red-500"}`}>
                              {student.name.charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-800 dark:text-white">{student.name}</p>
                              <p className="text-xs text-slate-400 dark:text-slate-400">{student.class_roll}</p>
                            </div>
                          </div>
                        </div>
                        <div className="col-span-2 hidden md:block">
                          <span className="text-xs text-slate-500 dark:text-slate-400">{student.admission_no}</span>
                        </div>
                        <div className="col-span-1 hidden md:block">
                          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border-0">{student.class_name}</Badge>
                        </div>
                        <div className="col-span-1 hidden md:block">
                          <Badge variant="outline" className="text-xs bg-slate-50 text-slate-600 dark:bg-slate-700 dark:text-slate-300 border-0">{student.section_name}</Badge>
                        </div>
                        <div className="col-span-1 text-center">
                          <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{student.present}</span>
                        </div>
                        <div className="col-span-1 text-center">
                          <span className="text-sm font-medium text-red-600 dark:text-red-400">{student.absent}</span>
                        </div>
                        <div className="col-span-1 text-center">
                          <span className="text-sm font-medium text-amber-600 dark:text-amber-400">{student.late}</span>
                        </div>
                        <div className="col-span-1 text-center">
                          <span className={`text-sm font-bold ${percentClass}`}>{student.percentage}%</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

      </div>
    </ResponsiveLayout>
  )
}
