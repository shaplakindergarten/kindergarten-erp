"use client"

import { useState, useEffect, useCallback } from "react"
import { ResponsiveLayout } from "@/components/layout/responsive-layout"
import { createClient } from "@/lib/supabase/client"
import { getSchoolPrintHeader } from "@/components/print/SchoolPrintHeader"
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
  BarChart3,
  Medal,
  Trophy
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  format, 
  subYears, 
  addYears, 
  startOfYear, 
  endOfYear, 
  eachMonthOfInterval,
  getYear
} from "date-fns"
import { toast } from "sonner"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import Link from "next/link"

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

interface MonthlySummary {
  month: string
  monthName: string
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

interface StudentYearlyReport {
  id: string
  name: string
  admission_no: string
  class_roll: string
  class_name: string
  section_name: string
  monthlyData: MonthlySummary[]
  totalPresent: number
  totalAbsent: number
  totalLate: number
  totalDays: number
  overallPercentage: number
  bestMonth: string
  worstMonth: string
}

interface YearlyStats {
  totalStudents: number
  totalPresent: number
  totalAbsent: number
  totalLate: number
  avgAttendance: number
  totalWorkingDays: number
  topPerformer: { name: string; percentage: number } | null
  lowestPerformer: { name: string; percentage: number } | null
}

interface SchoolInfo {
  school_name: string
  school_address: string
  school_phone: string
  school_email?: string
  school_logo?: string
}

const fmtYear = (d: Date) => format(d, "yyyy")

export default function YearlyAttendancePage() {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [selectedClass, setSelectedClass] = useState("all")
  const [selectedSection, setSelectedSection] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [activeTab, setActiveTab] = useState("summary")
  
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [sections, setSections] = useState<SectionItem[]>([])
  const [reportData, setReportData] = useState<StudentYearlyReport[]>([])
  const [stats, setStats] = useState<YearlyStats>({
    totalStudents: 0,
    totalPresent: 0,
    totalAbsent: 0,
    totalLate: 0,
    avgAttendance: 0,
    totalWorkingDays: 0,
    topPerformer: null,
    lowestPerformer: null
  })
  const [yearMonths, setYearMonths] = useState<Date[]>([])
  
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo>({
    school_name: "Loading...",
    school_address: "",
    school_phone: "",
    school_email: "",
  })
  
  const [loading, setLoading] = useState(false)
  const [pdfGen, setPdfGen] = useState(false)

  useEffect(() => {
      Promise.resolve(supabase.from("school_settings")
      .select("school_name, school_address, school_phone, school_email, school_logo")
      .limit(1).single()
      .then(({ data }) => { if (data) setSchoolInfo(data) }))
      .catch(() => {
        setSchoolInfo({
          school_name: "School Name",
          school_address: "",
          school_phone: "",
          school_email: "",
          school_logo: "",
        })
      })
  }, [])

  useEffect(() => {
    supabase
      .from("classes")
      .select("id, name, numeric_order")
      .order("numeric_order")
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
    const start = startOfYear(selectedDate)
    const end = endOfYear(selectedDate)
    const months = eachMonthOfInterval({ start, end })
    setYearMonths(months)
  }, [selectedDate])

  const loadReport = useCallback(async () => {
    if (!selectedDate) return
    setLoading(true)
    try {
      const startDate = format(startOfYear(selectedDate), "yyyy-MM-dd")
      const endDate = format(endOfYear(selectedDate), "yyyy-MM-dd")
      
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
        setStats(prev => ({ ...prev, totalStudents: 0 }))
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
      
      const monthlyDataMap: Record<string, Record<string, { present: number; absent: number; late: number }>> = {}
      
      studentsData.forEach(s => {
        monthlyDataMap[s.id] = {}
        yearMonths.forEach(month => {
          const monthStr = format(month, "yyyy-MM")
          monthlyDataMap[s.id][monthStr] = { present: 0, absent: 0, late: 0 }
        })
      })
      
      attendanceData?.forEach(a => {
        const monthStr = a.date.substring(0, 7)
        if (monthlyDataMap[a.student_id]?.[monthStr]) {
          if (a.status === "present") monthlyDataMap[a.student_id][monthStr].present++
          else if (a.status === "absent") monthlyDataMap[a.student_id][monthStr].absent++
          else if (a.status === "late") monthlyDataMap[a.student_id][monthStr].late++
        }
      })
      
      const reportRows: StudentYearlyReport[] = studentsData.map((s: StudentRecord) => {
        const monthlySummaries: MonthlySummary[] = []
        let totalPresent = 0
        let totalAbsent = 0
        let totalLate = 0
        let bestMonthPct = 0
        let worstMonthPct = 100
        let bestMonth = ""
        let worstMonth = ""
        
        yearMonths.forEach(month => {
          const monthStr = format(month, "yyyy-MM")
          const data = monthlyDataMap[s.id]?.[monthStr] || { present: 0, absent: 0, late: 0 }
          const total = data.present + data.absent + data.late
          const percentage = total > 0 ? Math.round((data.present + data.late) / total * 100) : 0
          
          monthlySummaries.push({
            month: monthStr,
            monthName: format(month, "MMM"),
            present: data.present,
            absent: data.absent,
            late: data.late,
            total,
            percentage
          })
          
          totalPresent += data.present
          totalAbsent += data.absent
          totalLate += data.late
          
          if (percentage > bestMonthPct && total > 0) {
            bestMonthPct = percentage
            bestMonth = format(month, "MMM")
          }
          if (percentage < worstMonthPct && total > 0) {
            worstMonthPct = percentage
            worstMonth = format(month, "MMM")
          }
        })
        
        const totalDays = totalPresent + totalAbsent + totalLate
        const overallPercentage = totalDays > 0 ? Math.round((totalPresent + totalLate) / totalDays * 100) : 0
        
        return {
          id: s.id,
          name: s.name,
          admission_no: s.student_id || "N/A",
          class_roll: s.class_roll || "—",
          class_name: classMap.get(s.class_id) || "N/A",
          section_name: sectionMap.get(s.section_id) || "N/A",
          monthlyData: monthlySummaries,
          totalPresent,
          totalAbsent,
          totalLate,
          totalDays,
          overallPercentage,
          bestMonth: bestMonth || "N/A",
          worstMonth: worstMonth || "N/A"
        }
      })
      
      const totalStudents = reportRows.length
      const totalPresent = reportRows.reduce((sum, r) => sum + r.totalPresent, 0)
      const totalAbsent = reportRows.reduce((sum, r) => sum + r.totalAbsent, 0)
      const totalLate = reportRows.reduce((sum, r) => sum + r.totalLate, 0)
      const avgAttendance = totalStudents > 0
        ? Math.round(reportRows.reduce((sum, r) => sum + r.overallPercentage, 0) / totalStudents)
        : 0
      
      const sortedByPercentage = [...reportRows].sort((a, b) => b.overallPercentage - a.overallPercentage)
      const topPerformer = sortedByPercentage[0] ? { name: sortedByPercentage[0].name, percentage: sortedByPercentage[0].overallPercentage } : null
      const lowestPerformer = sortedByPercentage[sortedByPercentage.length - 1] ? { name: sortedByPercentage[sortedByPercentage.length - 1].name, percentage: sortedByPercentage[sortedByPercentage.length - 1].overallPercentage } : null
      
      setStats({
        totalStudents,
        totalPresent,
        totalAbsent,
        totalLate,
        avgAttendance,
        totalWorkingDays: 0,
        topPerformer,
        lowestPerformer
      })
      
      setReportData(reportRows)
      toast.success(`Yearly report loaded for ${fmtYear(selectedDate)}`)
      
    } catch (error) {
      console.error("Error loading report:", error)
      toast.error("Failed to load report data")
    } finally {
      setLoading(false)
    }
  }, [selectedDate, selectedClass, selectedSection, yearMonths])

  useEffect(() => {
    loadReport()
  }, [loadReport])

  const shiftYear = (years: number) => {
    setSelectedDate(prev => years > 0 ? addYears(prev, years) : subYears(prev, Math.abs(years)))
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

  const generatePDF = async () => {
    setPdfGen(true)
    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
      
      doc.setFontSize(20)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(37, 99, 235)
      doc.text(schoolInfo.school_name, 148, 15, { align: "center" })
      
      doc.setFontSize(12)
      doc.setFont("helvetica", "normal"); doc.setTextColor(80, 80, 80)
      doc.text("Yearly Attendance Report", 148, 23, { align: "center" })
      
      doc.setFontSize(9)
      doc.text(`Year: ${fmtYear(selectedDate)}`, 148, 31, { align: "center" })
      doc.text(`Present: ${stats.totalPresent} | Absent: ${stats.totalAbsent} | Late: ${stats.totalLate} | Total Students: ${stats.totalStudents} | Average: ${stats.avgAttendance}%`, 148, 39, { align: "center" })
      
      const monthHeaders = yearMonths.map(m => format(m, "MMM"))
      const tableHeaders = ["#", "Roll", "Student Name", "Class", "Section", ...monthHeaders, "Total", "%"]
      
      const tableBody = filteredData.map((s, i) => {
        const monthlyCells = s.monthlyData.map(m => `${m.percentage}%`)
        return [
          i + 1,
          s.class_roll,
          s.name,
          s.class_name,
          s.section_name,
          ...monthlyCells,
          s.totalDays,
          `${s.overallPercentage}%`
        ]
      })
      
      autoTable(doc, {
        startY: 46,
        head: [tableHeaders],
        body: tableBody,
        theme: "grid",
        styles: { fontSize: 7.5, cellPadding: 2 },
        headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        didParseCell: (d) => {
          if (d.section === "body" && d.column.index === tableHeaders.length - 1) {
            const v = String(d.cell.raw || "0%").replace("%", "")
            const percent = parseInt(v)
            if (percent >= 75) d.cell.styles.textColor = [5, 150, 105]
            else if (percent >= 50) d.cell.styles.textColor = [217, 119, 6]
            else d.cell.styles.textColor = [220, 38, 38]
            d.cell.styles.fontStyle = "bold"
          }
        },
        margin: { left: 10, right: 10 },
      })
      
      const pages = doc.getNumberOfPages()
      for (let i = 1; i <= pages; i++) {
        doc.setPage(i)
        doc.setFontSize(7); doc.setTextColor(160, 160, 160)
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 205)
        doc.text(`Page ${i} of ${pages}`, 282, 205, { align: "right" })
        doc.text(schoolInfo.school_name, 148, 205, { align: "center" })
      }
      
      doc.save(`yearly-attendance-${fmtYear(selectedDate)}.pdf`)
      toast.success("PDF generated successfully")
    } catch (error) {
      console.error("PDF error:", error)
      toast.error("Failed to generate PDF")
    } finally {
      setPdfGen(false)
    }
  }

  const exportToCSV = () => {
    const monthHeaders = yearMonths.map(m => format(m, "MMM"))
    const csvHeaders = ["Roll", "Student Name", "Admission No", "Class", "Section", ...monthHeaders, "Total Present", "Total Absent", "Total Late", "Total Days", "Attendance %"]
    
    const csvRows = filteredData.map(s => {
      const monthlyCells = s.monthlyData.map(m => `${m.percentage}%`)
      return [
        s.class_roll,
        s.name,
        s.admission_no,
        s.class_name,
        s.section_name,
        ...monthlyCells,
        s.totalPresent,
        s.totalAbsent,
        s.totalLate,
        s.totalDays,
        `${s.overallPercentage}%`
      ]
    })
    
    const csvContent = [csvHeaders, ...csvRows].map(row => row.join(",")).join("\n")
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `yearly-attendance-${fmtYear(selectedDate)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("CSV exported successfully")
  }

  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    
    const monthHeaders = yearMonths.map(m => format(m, "MMM"))
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Yearly Attendance Report - ${fmtYear(selectedDate)}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 15px; font-size: 10px; }
          .report-title { font-size: 18px; font-weight: bold; margin: 15px 0 10px; }
          .stats { display: flex; gap: 10px; margin: 10px 0; flex-wrap: wrap; justify-content: center; }
          .stat-card { border: 1px solid #ddd; padding: 8px 15px; border-radius: 8px; text-align: center; min-width: 100px; }
          .stat-card .value { font-size: 18px; font-weight: bold; }
          .stat-card .label { font-size: 9px; color: #666; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 8px; }
          th, td { border: 1px solid #ddd; padding: 6px 4px; text-align: center; }
          th { background: #f0f0f0; font-weight: bold; }
          .text-left { text-align: left; }
          .high { color: #059669; font-weight: bold; }
          .medium { color: #d97706; font-weight: bold; }
          .low { color: #dc2626; font-weight: bold; }
          .footer { margin-top: 15px; text-align: center; font-size: 8px; color: #666; border-top: 1px solid #ccc; padding-top: 8px; }
          @media print { button { display: none; } }
        </style>
      </head>
      <body>
        ${getSchoolPrintHeader(schoolInfo, "Yearly Attendance Report - " + fmtYear(selectedDate))}
        <div class="report-title">Yearly Attendance Report - ${fmtYear(selectedDate)}</div>
        
        <div class="stats">
          <div class="stat-card"><div class="value">${stats.totalStudents}</div><div class="label">Total Students</div></div>
          <div class="stat-card"><div class="value">${stats.totalPresent}</div><div class="label">Total Present</div></div>
          <div class="stat-card"><div class="value">${stats.totalAbsent}</div><div class="label">Total Absent</div></div>
          <div class="stat-card"><div class="value">${stats.totalLate}</div><div class="label">Total Late</div></div>
          <div class="stat-card"><div class="value">${stats.avgAttendance}%</div><div class="label">Average Attendance</div></div>
        </div>
        
        ${stats.topPerformer ? `<div class="stats"><div class="stat-card" style="background:#fef3c7"><div class="value">🏆 ${stats.topPerformer.name}</div><div class="label">Top Performer (${stats.topPerformer.percentage}%)</div></div></div>` : ''}
        
        <table>
          <thead>
            <tr><th>#</th><th>Roll</th><th class="text-left">Student Name</th><th>Class</th><th>Section</th>
            ${monthHeaders.map(h => `<th>${h}</th>`).join('')}
            <th>Total</th><th>%</th></tr>
          </thead>
          <tbody>
            ${filteredData.map((s, i) => {
              let percentClass = ""
              if (s.overallPercentage >= 75) percentClass = "high"
              else if (s.overallPercentage >= 50) percentClass = "medium"
              else percentClass = "low"
              
              const monthlyCells = s.monthlyData.map(m => `<td class="${m.percentage >= 75 ? 'high' : m.percentage >= 50 ? 'medium' : 'low'}">${m.percentage}%</td>`).join('')
              
              return `
                <tr>
                  <td>${i + 1}</td>
                  <td>${s.class_roll}</td>
                  <td class="text-left">${s.name}</td>
                  <td>${s.class_name}</td>
                  <td>${s.section_name}</td>
                  ${monthlyCells}
                  <td>${s.totalDays}</td>
                  <td class="${percentClass}">${s.overallPercentage}%</td>
                </tr>
              `
            }).join("")}
          </tbody>
        </table>
        
        <div class="footer">
          Generated on ${new Date().toLocaleString()} | ${schoolInfo.school_name}
        </div>
        <script>window.print(); setTimeout(() => window.close(), 1000);</script>
      </body>
      </html>
    `)
    printWindow.document.close()
  }

  const monthlySummary = yearMonths.map((month, idx) => {
    const monthData = reportData.flatMap(s => s.monthlyData[idx] || { percentage: 0 })
    const avgPercentage = reportData.length > 0
      ? Math.round(monthData.reduce((sum, m) => sum + (m.percentage || 0), 0) / reportData.length)
      : 0
    return {
      month: format(month, "MMM"),
      percentage: avgPercentage
    }
  })

  return (
    <ResponsiveLayout>
      <div className="space-y-5 p-4 md:p-6">
        
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild className="bg-white/20 hover:bg-white/30 text-white rounded-xl">
              <Link href="/attendance"><ArrowLeft className="h-5 w-5" /></Link>
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">Yearly Attendance Report</h1>
              <p className="text-blue-100 text-sm">Complete yearly attendance analytics and performance tracking</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setShowFilters(!showFilters)} className="bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-xl">
              <Filter className="h-4 w-4 mr-1" />{showFilters ? "Hide" : "Filters"}
            </Button>
            <Button onClick={exportToCSV} className="bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-xl">
              <Download className="h-4 w-4 mr-1" />CSV
            </Button>
            <Button onClick={generatePDF} disabled={pdfGen} className="bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-xl">
              {pdfGen ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileText className="h-4 w-4 mr-1" />}PDF
            </Button>
            <Button onClick={handlePrint} className="bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-xl">
              <Printer className="h-4 w-4 mr-1" />Print
            </Button>
          </div>
        </div>

        {/* Year Navigation */}
        <Card className="border-0 shadow-md bg-white dark:bg-slate-900">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" size="icon" onClick={() => shiftYear(-1)} className="rounded-xl dark:border-slate-700">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-5 py-2 rounded-xl">
                <CalendarDays className="h-5 w-5 text-blue-500" />
                <span className="text-xl font-bold text-slate-700 dark:text-slate-200">
                  {fmtYear(selectedDate)}
                </span>
              </div>
              <Button variant="outline" size="icon" onClick={() => shiftYear(1)} className="rounded-xl dark:border-slate-700">
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => setSelectedDate(new Date())} className="rounded-xl text-blue-600 border-blue-200 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400">
                Current Year
              </Button>
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

        {/* Premium Stats Cards */}
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
                <div><p className="text-xs opacity-75">Total Present</p><p className="text-2xl font-bold">{stats.totalPresent}</p></div>
                <UserCheck className="h-7 w-7 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-500 to-rose-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div><p className="text-xs opacity-75">Total Absent</p><p className="text-2xl font-bold">{stats.totalAbsent}</p></div>
                <UserX className="h-7 w-7 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div><p className="text-xs opacity-75">Total Late</p><p className="text-2xl font-bold">{stats.totalLate}</p></div>
                <Clock className="h-7 w-7 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div><p className="text-xs opacity-75">Average</p><p className="text-2xl font-bold">{stats.avgAttendance}%</p></div>
                <TrendingUp className="h-7 w-7 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Premium Awards Section */}
        {(stats.topPerformer || stats.lowestPerformer) && (
          <div className="grid gap-4 md:grid-cols-2">
            {stats.topPerformer && (
              <Card className="border-0 shadow-md bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="bg-amber-100 dark:bg-amber-900/50 p-3 rounded-full">
                      <Trophy className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold">🏆 TOP PERFORMER</p>
                      <p className="text-lg font-bold text-slate-800 dark:text-white">{stats.topPerformer.name}</p>
                      <p className="text-sm text-emerald-600 font-semibold">{stats.topPerformer.percentage}% Attendance</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {stats.lowestPerformer && (
              <Card className="border-0 shadow-md bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="bg-red-100 dark:bg-red-900/50 p-3 rounded-full">
                      <Medal className="h-8 w-8 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <p className="text-xs text-red-600 dark:text-red-400 font-semibold">📊 NEEDS IMPROVEMENT</p>
                      <p className="text-lg font-bold text-slate-800 dark:text-white">{stats.lowestPerformer.name}</p>
                      <p className="text-sm text-red-600 font-semibold">{stats.lowestPerformer.percentage}% Attendance</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Tabs for different views */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 rounded-xl bg-gray-100 dark:bg-gray-800 p-1">
            <TabsTrigger value="summary" className="rounded-lg">📊 Monthly Summary</TabsTrigger>
            <TabsTrigger value="detailed" className="rounded-lg">📋 Detailed Report</TabsTrigger>
          </TabsList>
          
          <TabsContent value="summary" className="mt-5">
            {/* Monthly Performance Chart */}
            <Card className="border-0 shadow-md bg-white dark:bg-slate-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                  Monthly Attendance Trend
                </CardTitle>
                <CardDescription>Average attendance percentage by month for {fmtYear(selectedDate)}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80 flex items-end gap-2">
                  {monthlySummary.map((item, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                      <div
                        className="w-full bg-gradient-to-t from-blue-500 to-indigo-500 rounded-t-lg transition-all hover:opacity-80 cursor-pointer"
                        style={{ height: `${item.percentage}%`, minHeight: '4px' }}
                        title={`${item.month}: ${item.percentage}%`}
                      />
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{item.month}</span>
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{item.percentage}%</span>
                    </div>
                  ))}
                </div>
                <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
                    <p className="text-2xl font-bold text-emerald-600">{stats.avgAttendance}%</p>
                    <p className="text-xs text-slate-500">Yearly Average</p>
                  </div>
                  <div className="text-center p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">
                      {monthlySummary.reduce((max, m) => Math.max(max, m.percentage), 0)}%
                    </p>
                    <p className="text-xs text-slate-500">Best Month</p>
                  </div>
                  <div className="text-center p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                    <p className="text-2xl font-bold text-amber-600">
                      {monthlySummary.reduce((min, m) => Math.min(min, m.percentage), 100)}%
                    </p>
                    <p className="text-xs text-slate-500">Worst Month</p>
                  </div>
                  <div className="text-center p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                    <p className="text-2xl font-bold text-purple-600">{stats.totalStudents}</p>
                    <p className="text-xs text-slate-500">Active Students</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="detailed" className="mt-5">
            {/* Yearly Attendance Table */}
            <Card className="border-0 shadow-md bg-white dark:bg-slate-800">
              <CardHeader className="bg-slate-50 dark:bg-slate-700 rounded-t-2xl py-4 px-5">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-slate-700 dark:text-slate-100">
                      <Calendar className="h-5 w-5 text-blue-600" />
                      Yearly Attendance Details
                      <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border-0 ml-1">{filteredData.length} students</Badge>
                    </CardTitle>
                    <CardDescription className="dark:text-slate-300">
                      Monthly breakdown for {fmtYear(selectedDate)}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <Loader2 className="h-10 w-10 animate-spin text-blue-600 mb-3" />
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Loading report...</p>
                  </div>
                ) : filteredData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500">
                    <AlertCircle className="h-14 w-14 mb-3" />
                    <p className="font-semibold text-lg">No data found</p>
                    <p className="text-sm">Try changing filters or selecting a different year</p>
                  </div>
                ) : (
                  <div className="min-w-[1100px]">
                    {/* Headers Row */}
                    <div className="grid grid-cols-[50px_60px_180px_85px_85px_repeat(12,minmax(45px,1fr))_65px_60px] gap-1 px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-300 bg-slate-50 dark:bg-slate-700 border-b items-center whitespace-nowrap">
                      <div>#</div>
                      <div>Roll</div>
                      <div>Student Name</div>
                      <div>Class</div>
                      <div>Section</div>
                      {yearMonths.map((month, idx) => (
                        <div key={idx} className="text-center">{format(month, "MMM")}</div>
                      ))}
                      <div className="text-center">Total</div>
                      <div className="text-center">%</div>
                    </div>

                    <div className="divide-y divide-slate-50 dark:divide-slate-700">
                      {filteredData.map((student, idx) => {
                        let percentClass = ""
                        if (student.overallPercentage >= 75) percentClass = "text-emerald-600 dark:text-emerald-400 font-bold"
                        else if (student.overallPercentage >= 50) percentClass = "text-amber-600 dark:text-amber-400 font-bold"
                        else percentClass = "text-red-600 dark:text-red-400 font-bold"
                        
                        return (
                          <div
                            key={student.id}
                            className={`grid grid-cols-[50px_60px_180px_85px_85px_repeat(12,minmax(45px,1fr))_65px_60px] gap-1 px-4 py-2 items-center whitespace-nowrap ${idx % 2 === 0 ? "bg-white dark:bg-slate-800" : "bg-slate-50/40 dark:bg-slate-700/30"}`}
                          >
                            <div className="text-sm font-semibold text-slate-500">{idx + 1}</div>
                            <div className="text-sm text-slate-700 dark:text-slate-200">{student.class_roll}</div>
                            
                            <div className="flex items-center gap-2 overflow-hidden">
                              <div className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white ${student.overallPercentage >= 75 ? "bg-emerald-500" : student.overallPercentage >= 50 ? "bg-amber-500" : "bg-red-500"}`}>
                                {student.name.charAt(0)}
                              </div>
                              <span className="text-sm font-medium text-slate-800 dark:text-white truncate" title={student.name}>{student.name}</span>
                            </div>
                            
                            <div><Badge variant="outline" className="text-xs truncate max-w-[75px]">{student.class_name}</Badge></div>
                            <div><Badge variant="outline" className="text-xs truncate max-w-[75px]">{student.section_name}</Badge></div>
                            
                            {student.monthlyData.map((month, mIdx) => {
                              let monthClass = ""
                              if (month.percentage >= 75) monthClass = "text-emerald-500 font-semibold"
                              else if (month.percentage >= 50) monthClass = "text-amber-500 font-semibold"
                              else monthClass = "text-red-500 font-semibold"
                              return (
                                <div key={mIdx} className={`text-center text-xs ${monthClass}`}>
                                  {month.percentage}%
                                </div>
                              )
                            })}
                            <div className="text-center font-semibold text-xs">{student.totalDays}</div>
                            <div className={`text-center text-sm ${percentClass}`}>{student.overallPercentage}%</div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

      </div>
    </ResponsiveLayout>
  )
}
