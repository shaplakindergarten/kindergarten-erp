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
  Download,
  BarChart3,
  Layers,
  School,
  GraduationCap,
  Trophy,
  Medal,
  Building2,
  ChevronDown,
  ChevronUp
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { format } from "date-fns"
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
  class_name?: string
}

interface SectionAttendanceData {
  section_id: string
  section_name: string
  class_id: string
  class_name: string
  total_students: number
  present: number
  absent: number
  late: number
  percentage: number
  students: StudentAttendanceDetail[]
}

interface StudentAttendanceDetail {
  id: string
  name: string
  admission_no: string
  class_roll: string
  student_id: string | null
  status: string
}

type StudentRecord = {
  id: string
  name: string
  student_id: string | null
  class_roll: string | null
  status: string
}

interface SectionWiseStats {
  totalSections: number
  totalStudents: number
  totalPresent: number
  totalAbsent: number
  totalLate: number
  avgAttendance: number
  bestSection: { name: string; percentage: number; class_name: string } | null
  worstSection: { name: string; percentage: number; class_name: string } | null
}

interface SchoolInfo {
  school_name: string
  school_address: string
  school_phone: string
  school_email?: string
  school_logo?: string
}

const fmtDate = (d: Date) => format(d, "dd MMMM yyyy")

export default function SectionWiseAttendancePage() {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [selectedClass, setSelectedClass] = useState("all")
  const [selectedSection, setSelectedSection] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [activeTab, setActiveTab] = useState("summary")
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [sections, setSections] = useState<SectionItem[]>([])
  const [reportData, setReportData] = useState<SectionAttendanceData[]>([])
  const [stats, setStats] = useState<SectionWiseStats>({
    totalSections: 0,
    totalStudents: 0,
    totalPresent: 0,
    totalAbsent: 0,
    totalLate: 0,
    avgAttendance: 0,
    bestSection: null,
    worstSection: null
  })
  
  // School info
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo>({
    school_name: "Loading...",
    school_address: "",
    school_phone: "",
    school_email: "",
  })
  
  const [loading, setLoading] = useState(false)
  const [pdfGen, setPdfGen] = useState(false)

// Fetch school info
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

  // Toggle section expansion
  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId)
    } else {
      newExpanded.add(sectionId)
    }
    setExpandedSections(newExpanded)
  }

  // Load report data
  const loadReport = useCallback(async () => {
    if (!selectedDate) return
    setLoading(true)
    try {
      const dateStr = format(selectedDate, "yyyy-MM-dd")
      
      // Get sections with class info
      let sectionsQuery = supabase
        .from("sections")
        .select("id, name, class_id")
        .order("name")
      
      if (selectedClass !== "all") {
        sectionsQuery = sectionsQuery.eq("class_id", selectedClass)
      }
      
      const { data: sectionsData } = await sectionsQuery
      
      if (!sectionsData || sectionsData.length === 0) {
        setReportData([])
        setLoading(false)
        return
      }
      
      // Get class names for sections
      const classIds = [...new Set(sectionsData.map(s => s.class_id))]
      const { data: classesData } = await supabase
        .from("classes")
        .select("id, name")
        .in("id", classIds)
      
      const classMap = new Map<string, string>()
      classesData?.forEach(c => classMap.set(c.id, c.name))
      
      const sectionWiseData: SectionAttendanceData[] = []
      let totalStudentsOverall = 0
      let totalPresentOverall = 0
      let totalAbsentOverall = 0
      let totalLateOverall = 0
      
      // Process each section
      for (const section of sectionsData) {
        // Get students for this section
        let studentsQuery = supabase
          .from("students")
          .select("id, name, student_id, class_roll")
          .eq("section_id", section.id)
          .eq("status", "active")
          .order("class_roll")
        
        const { data: studentsData } = await studentsQuery
        
        if (!studentsData || studentsData.length === 0) {
          sectionWiseData.push({
            section_id: section.id,
            section_name: section.name,
            class_id: section.class_id,
            class_name: classMap.get(section.class_id) || "N/A",
            total_students: 0,
            present: 0,
            absent: 0,
            late: 0,
            percentage: 0,
            students: []
          })
          continue
        }
        
        const studentIds = studentsData.map(s => s.id)
        
        // Get attendance for this date
        const { data: attendanceData } = await supabase
          .from("student_attendance")
          .select("student_id, status")
          .in("student_id", studentIds)
          .eq("date", dateStr)
        
        const attendanceMap: Record<string, string> = {}
        attendanceData?.forEach(a => {
          attendanceMap[a.student_id] = a.status
        })
        
        // Calculate section totals and student details
        let present = 0
        let absent = 0
        let late = 0
        const studentsDetail: StudentAttendanceDetail[] = []
        
        studentsData.forEach((s: any) => {
          const status = attendanceMap[s.id] || "absent"
          if (status === "present") present++
          else if (status === "absent") absent++
          else if (status === "late") late++
          
          studentsDetail.push({
            id: s.id,
            name: s.name,
            admission_no: s.student_id || "N/A",
            class_roll: s.class_roll || "—",
            student_id: s.student_id,
            status
          })
        })
        
        const total = studentsData.length
        const percentage = total > 0 ? Math.round((present + late) / total * 100) : 0
        
        totalStudentsOverall += total
        totalPresentOverall += present
        totalAbsentOverall += absent
        totalLateOverall += late
        
        sectionWiseData.push({
          section_id: section.id,
          section_name: section.name,
          class_id: section.class_id,
          class_name: classMap.get(section.class_id) || "N/A",
          total_students: total,
          present,
          absent,
          late,
          percentage,
          students: studentsDetail
        })
      }
      
      // Apply section filter
      let filteredData = sectionWiseData
      if (selectedSection !== "all") {
        filteredData = filteredData.filter(s => s.section_id === selectedSection)
      }
      
      // Calculate overall stats
      const avgAttendance = totalStudentsOverall > 0 
        ? Math.round((totalPresentOverall + totalLateOverall) / totalStudentsOverall * 100)
        : 0
      
      // Find best and worst section
      const validSections = filteredData.filter(s => s.total_students > 0)
      const sortedByPercentage = [...validSections].sort((a, b) => b.percentage - a.percentage)
      const bestSection = sortedByPercentage[0] 
        ? { name: sortedByPercentage[0].section_name, percentage: sortedByPercentage[0].percentage, class_name: sortedByPercentage[0].class_name }
        : null
      const worstSection = sortedByPercentage[sortedByPercentage.length - 1] 
        ? { name: sortedByPercentage[sortedByPercentage.length - 1].section_name, percentage: sortedByPercentage[sortedByPercentage.length - 1].percentage, class_name: sortedByPercentage[sortedByPercentage.length - 1].class_name }
        : null
      
      setStats({
        totalSections: filteredData.length,
        totalStudents: totalStudentsOverall,
        totalPresent: totalPresentOverall,
        totalAbsent: totalAbsentOverall,
        totalLate: totalLateOverall,
        avgAttendance,
        bestSection,
        worstSection
      })
      
      setReportData(filteredData)
      toast.success(`Report loaded for ${fmtDate(selectedDate)}`)
      
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
    setSelectedDate(d)
  }

  const clearFilters = () => {
    setSelectedClass("all")
    setSelectedSection("all")
    setSearchTerm("")
    toast.info("Filters cleared")
  }

  const filteredReportData = reportData.filter(section =>
    !searchTerm ||
    section.section_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    section.class_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Chart data for visualization
  const chartData = filteredReportData.map(s => ({
    name: `${s.class_name} - ${s.section_name}`,
    percentage: s.percentage,
    students: s.total_students
  }))

  // PDF Generation
  const generatePDF = async () => {
    setPdfGen(true)
    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
      
      // School Header
      doc.setFontSize(20); doc.setFont("helvetica", "bold")
      doc.setTextColor(37, 99, 235)
      doc.text(schoolInfo.school_name, 148, 15, { align: "center" })
      
      doc.setFontSize(12); doc.setFont("helvetica", "normal"); doc.setTextColor(80, 80, 80)
      doc.text("Section-wise Attendance Report", 148, 23, { align: "center" })
      
      doc.setFontSize(9)
      doc.text(`Date: ${fmtDate(selectedDate)}`, 148, 31, { align: "center" })
      doc.text(`Total Sections: ${stats.totalSections} | Students: ${stats.totalStudents} | Present: ${stats.totalPresent} | Absent: ${stats.totalAbsent} | Late: ${stats.totalLate} | Average: ${stats.avgAttendance}%`, 148, 39, { align: "center" })
      
      // Prepare table data
      const tableHeaders = ["#", "Class", "Section", "Students", "Present", "Absent", "Late", "Attendance %"]
      const tableBody = filteredReportData.map((s, i) => [
        i + 1,
        s.class_name,
        s.section_name,
        s.total_students,
        s.present,
        s.absent,
        s.late,
        `${s.percentage}%`
      ])
      
      autoTable(doc, {
        startY: 46,
        head: [tableHeaders],
        body: tableBody,
        theme: "grid",
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        didParseCell: (d) => {
          if (d.section === "body" && d.column.index === 7) {
            const v = String(d.cell.raw || "0%").replace("%", "")
            const percent = parseInt(v)
            if (percent >= 75) d.cell.styles.textColor = [5, 150, 105]
            else if (percent >= 50) d.cell.styles.textColor = [217, 119, 6]
            else d.cell.styles.textColor = [220, 38, 38]
            d.cell.styles.fontStyle = "bold"
          }
        },
        margin: { left: 14, right: 14 },
      })
      
      const pages = doc.getNumberOfPages()
      for (let i = 1; i <= pages; i++) {
        doc.setPage(i); doc.setFontSize(7); doc.setTextColor(160, 160, 160)
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 205)
        doc.text(`Page ${i} of ${pages}`, 282, 205, { align: "right" })
        doc.text(schoolInfo.school_name, 148, 205, { align: "center" })
      }
      
      doc.save(`section-wise-attendance-${format(selectedDate, "yyyy-MM-dd")}.pdf`)
      toast.success("PDF generated successfully")
    } catch (error) {
      console.error("PDF error:", error)
      toast.error("Failed to generate PDF")
    } finally {
      setPdfGen(false)
    }
  }

  // Export to CSV
  const exportToCSV = () => {
    const csvHeaders = ["Class", "Section", "Total Students", "Present", "Absent", "Late", "Attendance %"]
    
    const csvRows = filteredReportData.map(s => [
      s.class_name,
      s.section_name,
      s.total_students,
      s.present,
      s.absent,
      s.late,
      `${s.percentage}%`
    ])
    
    const csvContent = [csvHeaders, ...csvRows].map(row => row.join(",")).join("\n")
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `section-wise-attendance-${format(selectedDate, "yyyy-MM-dd")}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("CSV exported successfully")
  }

// Print Handler
   const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Section-wise Attendance Report - ${fmtDate(selectedDate)}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; font-size: 11px; }
          .report-title { font-size: 18px; font-weight: bold; margin: 15px 0 10px; text-align: center; }
          .stats { display: flex; gap: 12px; margin: 15px 0; flex-wrap: wrap; justify-content: center; }
          .stat-card { border: 1px solid #ddd; padding: 8px 15px; border-radius: 8px; text-align: center; min-width: 90px; }
          .stat-card .value { font-size: 18px; font-weight: bold; }
          .stat-card .label { font-size: 9px; color: #666; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th, td { border: 1px solid #ddd; padding: 8px 6px; text-align: center; }
          th { background: #f0f0f0; font-weight: bold; }
          .text-left { text-align: left; }
          .high { color: #059669; font-weight: bold; }
          .medium { color: #d97706; font-weight: bold; }
          .low { color: #dc2626; font-weight: bold; }
          .footer { margin-top: 20px; text-align: center; font-size: 9px; color: #666; border-top: 1px solid #ccc; padding-top: 10px; }
          @media print { button { display: none; } }
        </style>
      </head>
      <body>
        ${getSchoolPrintHeader(schoolInfo, "Section-wise Attendance Report")}
        <div class="report-title">Section-wise Attendance Report</div>
        <p style="text-align:center">Date: ${fmtDate(selectedDate)}</p>
        
        <div class="stats">
          <div class="stat-card"><div class="value">${stats.totalSections}</div><div class="label">Total Sections</div></div>
          <div class="stat-card"><div class="value">${stats.totalStudents}</div><div class="label">Total Students</div></div>
          <div class="stat-card"><div class="value" style="color:#059669">${stats.totalPresent}</div><div class="label">Present</div></div>
          <div class="stat-card"><div class="value" style="color:#dc2626">${stats.totalAbsent}</div><div class="label">Absent</div></div>
          <div class="stat-card"><div class="value" style="color:#d97706">${stats.totalLate}</div><div class="label">Late</div></div>
          <div class="stat-card"><div class="value">${stats.avgAttendance}%</div><div class="label">Average</div></div>
        </div>
        
        ${stats.bestSection ? `<div class="stats"><div class="stat-card" style="background:#fef3c7"><div class="value">🏆 ${stats.bestSection.name}</div><div class="label">Best Section (${stats.bestSection.percentage}%)</div><div class="label">${stats.bestSection.class_name}</div></div></div>` : ''}
        
        <table>
          <thead><tr><th>#</th><th class="text-left">Class</th><th class="text-left">Section</th><th>Students</th><th>Present</th><th>Absent</th><th>Late</th><th>%</th></tr></thead>
          <tbody>
            ${filteredReportData.map((s, i) => {
              let percentClass = ""
              if (s.percentage >= 75) percentClass = "high"
              else if (s.percentage >= 50) percentClass = "medium"
              else percentClass = "low"
              return `
                <tr>
                  <td>${i + 1}</td>
                  <td class="text-left">${s.class_name}</td>
                  <td class="text-left">${s.section_name}</td>
                  <td>${s.total_students}</td>
                  <td style="color:#059669">${s.present}</td>
                  <td style="color:#dc2626">${s.absent}</td>
                  <td style="color:#d97706">${s.late}</td>
                  <td class="${percentClass}">${s.percentage}%</td>
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
              <h1 className="text-2xl md:text-3xl font-bold text-white">Section-wise Attendance Report</h1>
              <p className="text-blue-100 text-sm">Detailed attendance breakdown by section</p>
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

        {/* Date Navigation */}
        <Card className="border-0 shadow-md bg-white dark:bg-slate-900">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" size="icon" onClick={() => shiftDate(-1)} className="rounded-xl dark:border-slate-700">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Input
                type="date"
                value={format(selectedDate, "yyyy-MM-dd")}
                onChange={e => setSelectedDate(new Date(e.target.value))}
                className="w-44 font-medium rounded-xl dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              />
              <Button variant="outline" size="icon" onClick={() => shiftDate(1)} className="rounded-xl dark:border-slate-700">
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => setSelectedDate(new Date())} className="rounded-xl text-blue-600 border-blue-200 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400">
                Today
              </Button>
              <span className="text-slate-500 dark:text-slate-400 text-sm font-medium bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg">
                {fmtDate(selectedDate)}
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
                      placeholder="Section name..." 
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
        <div className="grid gap-4 grid-cols-2 md:grid-cols-6">
          <Card className="bg-gradient-to-br from-slate-600 to-slate-700 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div><p className="text-xs opacity-75">Total Sections</p><p className="text-2xl font-bold">{stats.totalSections}</p></div>
                <Layers className="h-7 w-7 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
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
        {(stats.bestSection || stats.worstSection) && (
          <div className="grid gap-4 md:grid-cols-2">
            {stats.bestSection && (
              <Card className="border-0 shadow-md bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="bg-amber-100 dark:bg-amber-900/50 p-3 rounded-full">
                      <Trophy className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold">🏆 BEST PERFORMING SECTION</p>
                      <p className="text-lg font-bold text-slate-800 dark:text-white">{stats.bestSection.name}</p>
                      <p className="text-sm text-slate-500">{stats.bestSection.class_name}</p>
                      <p className="text-sm text-emerald-600 font-semibold">{stats.bestSection.percentage}% Attendance</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {stats.worstSection && (
              <Card className="border-0 shadow-md bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="bg-red-100 dark:bg-red-900/50 p-3 rounded-full">
                      <Medal className="h-8 w-8 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <p className="text-xs text-red-600 dark:text-red-400 font-semibold">📊 NEEDS IMPROVEMENT</p>
                      <p className="text-lg font-bold text-slate-800 dark:text-white">{stats.worstSection.name}</p>
                      <p className="text-sm text-slate-500">{stats.worstSection.class_name}</p>
                      <p className="text-sm text-red-600 font-semibold">{stats.worstSection.percentage}% Attendance</p>
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
            <TabsTrigger value="summary" className="rounded-lg">📊 Summary View</TabsTrigger>
            <TabsTrigger value="detailed" className="rounded-lg">📋 Detailed Report</TabsTrigger>
          </TabsList>
          
          <TabsContent value="summary" className="mt-5">
            {/* Section-wise Performance Chart */}
            <Card className="border-0 shadow-md bg-white dark:bg-slate-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                  Section-wise Attendance Comparison
                </CardTitle>
                <CardDescription>Attendance percentage by section for {fmtDate(selectedDate)}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80 overflow-y-auto">
                  <div className="flex flex-col gap-3">
                    {chartData.filter(c => c.students > 0).map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <div className="w-32 text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                          {item.name}
                        </div>
                        <div className="flex-1">
                          <div className="h-8 bg-slate-100 dark:bg-slate-700 rounded-lg overflow-hidden">
                            <div 
                              className={`h-full flex items-center justify-end px-2 text-xs font-bold text-white transition-all ${item.percentage >= 75 ? 'bg-emerald-500' : item.percentage >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                              style={{ width: `${item.percentage}%` }}
                            >
                              {item.percentage > 30 && `${item.percentage}%`}
                            </div>
                          </div>
                        </div>
                        <div className="w-12 text-right font-bold text-slate-700 dark:text-slate-300">
                          {item.percentage}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
                    <p className="text-2xl font-bold text-emerald-600">{stats.avgAttendance}%</p>
                    <p className="text-xs text-slate-500">Overall Average</p>
                  </div>
                  <div className="text-center p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">
                      {chartData.filter(c => c.students > 0).reduce((max, c) => Math.max(max, c.percentage), 0)}%
                    </p>
                    <p className="text-xs text-slate-500">Highest Attendance</p>
                  </div>
                  <div className="text-center p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                    <p className="text-2xl font-bold text-amber-600">
                      {chartData.filter(c => c.students > 0).reduce((min, c) => Math.min(min, c.percentage), 100)}%
                    </p>
                    <p className="text-xs text-slate-500">Lowest Attendance</p>
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
            {/* Section-wise Data Table */}
            <Card className="border-0 shadow-md bg-white dark:bg-slate-800">
              <CardHeader className="bg-slate-50 dark:bg-slate-700 rounded-t-2xl py-4 px-5">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-slate-700 dark:text-slate-100">
                      <Building2 className="h-5 w-5 text-blue-600" />
                      Section-wise Attendance Details
                      <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border-0 ml-1">{filteredReportData.length} sections</Badge>
                    </CardTitle>
                    <CardDescription className="dark:text-slate-300">
                      Attendance breakdown by section for {fmtDate(selectedDate)}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <Loader2 className="h-10 w-10 animate-spin text-blue-600 mb-3" />
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Loading report...</p>
                  </div>
                ) : filteredReportData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500">
                    <AlertCircle className="h-14 w-14 mb-3" />
                    <p className="font-semibold text-lg">No data found</p>
                    <p className="text-sm">Try changing filters or selecting a different date</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-50 dark:divide-slate-700">
                    {filteredReportData.map((section) => {
                      const isExpanded = expandedSections.has(section.section_id)
                      const percentClass = section.percentage >= 75 ? 'text-emerald-600' : section.percentage >= 50 ? 'text-amber-600' : 'text-red-600'
                      
                      return (
                        <div key={section.section_id} className="p-4">
                          {/* Section Header */}
                          <div 
                            className="flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 p-2 rounded-lg transition-colors"
                            onClick={() => toggleSection(section.section_id)}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`bg-blue-100 dark:bg-blue-900/50 p-2 rounded-lg ${isExpanded ? 'rotate-180' : ''} transition-transform`}>
                                <ChevronDown className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                              </div>
                              <div>
                                <h3 className="font-bold text-slate-800 dark:text-white">
                                  {section.class_name} - {section.section_name}
                                </h3>
                                <p className="text-xs text-slate-500">{section.total_students} students</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`text-xl font-bold ${percentClass}`}>
                                {section.percentage}%
                              </p>
                              <p className="text-xs text-slate-500">Attendance</p>
                            </div>
                          </div>
                          
                          {/* Progress bar */}
                          <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden my-3">
                            <div 
                              className={`h-full transition-all ${section.percentage >= 75 ? 'bg-emerald-500' : section.percentage >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                              style={{ width: `${section.percentage}%` }}
                            />
                          </div>
                          
                          {/* Stats row */}
                          <div className="grid grid-cols-3 gap-3 mb-4">
                            <div className="text-center p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
                              <p className="text-lg font-bold text-emerald-600">{section.present}</p>
                              <p className="text-xs text-slate-500">Present</p>
                            </div>
                            <div className="text-center p-2 bg-red-50 dark:bg-red-950/30 rounded-lg">
                              <p className="text-lg font-bold text-red-600">{section.absent}</p>
                              <p className="text-xs text-slate-500">Absent</p>
                            </div>
                            <div className="text-center p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                              <p className="text-lg font-bold text-amber-600">{section.late}</p>
                              <p className="text-xs text-slate-500">Late</p>
                            </div>
                          </div>
                          
                          {/* Expanded Student List */}
                          {isExpanded && section.students.length > 0 && (
                            <div className="mt-3 border-t border-slate-100 dark:border-slate-700 pt-3">
                              <p className="text-xs font-semibold text-slate-500 mb-2">Student Details</p>
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="border-b border-slate-200 dark:border-slate-700">
                                      <th className="text-left py-2 px-2 font-semibold text-slate-600 dark:text-slate-400">Roll</th>
                                      <th className="text-left py-2 px-2 font-semibold text-slate-600 dark:text-slate-400">Student Name</th>
                                      <th className="text-left py-2 px-2 font-semibold text-slate-600 dark:text-slate-400">Admission No</th>
                                      <th className="text-center py-2 px-2 font-semibold text-slate-600 dark:text-slate-400">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {section.students.map(student => (
                                      <tr key={student.id} className="border-b border-slate-100 dark:border-slate-700">
                                        <td className="py-2 px-2 font-mono text-xs">{student.class_roll}</td>
                                        <td className="py-2 px-2 font-medium">{student.name}</td>
                                        <td className="py-2 px-2 text-xs text-slate-500">{student.admission_no}</td>
                                        <td className="py-2 px-2 text-center">
                                          <Badge className={`${student.status === 'present' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400' : student.status === 'late' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400' : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400'} border-0`}>
                                            {student.status === 'present' ? 'Present' : student.status === 'late' ? 'Late' : 'Absent'}
                                          </Badge>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
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
