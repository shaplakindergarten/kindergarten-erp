"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  TrendingUp,
  Users,
  Calendar,
  Filter,
  Download,
  Printer,
  Search,
  Loader2,
  AlertCircle,
  PieChart as LucidePieChart,
  BarChart3,
  Target,
  School,
  UserCheck,
  UserX,
  Clock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ResponsiveLayout } from "@/components/layout/responsive-layout"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, differenceInDays } from "date-fns"
import { getSchoolPrintHeader } from "@/components/print/SchoolPrintHeader"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts"

const supabase = createClient()

interface AttendancePercentage {
  id: string
  name: string
  admission_no?: string
  employee_id?: string
  class_name?: string
  section_name?: string
  designation?: string
  total_days: number
  present_days: number
  absent_days: number
  late_days: number
  leave_days: number
  percentage: number
  type: "student" | "staff"
}

interface FilterOptions {
  userType: "student" | "staff"
  startDate: string
  endDate: string
  classId: string
  sectionId: string
  minPercentage: number
  maxPercentage: number
  searchTerm: string
}

interface ClassItem {
  id: string
  name: string
}

interface SectionItem {
  id: string
  name: string
  class_id: string
}

const startOfMonthStr = () => format(startOfMonth(new Date()), "yyyy-MM-dd")
const endOfMonthStr = () => format(endOfMonth(new Date()), "yyyy-MM-dd")

export default function AttendancePercentageReportPage() {
  const [schoolInfo, setSchoolInfo] = useState({
    school_name: "",
    school_address: "",
    school_phone: "",
    school_email: "",
    school_logo: ""
  })
  const [filters, setFilters] = useState<FilterOptions>({
    userType: "student",
    startDate: startOfMonthStr(),
    endDate: endOfMonthStr(),
    classId: "all",
    sectionId: "all",
    minPercentage: 0,
    maxPercentage: 100,
    searchTerm: "",
  })
  const [attendanceData, setAttendanceData] = useState<AttendancePercentage[]>([])
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [sections, setSections] = useState<SectionItem[]>([])
  const [loading, setLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(true)
  const [chartType, setChartType] = useState<"bar" | "pie">("bar")

// Fetch school info from school_settings
   useEffect(() => {
     const fetchSchoolInfo = async () => {
       try {
         const { data, error } = await supabase
           .from("school_settings")
           .select("school_name, school_address, school_phone, school_email, school_logo")
           .single()
         
         if (error) {
           console.error("Error fetching school info:", error)
         } else if (data) {
           setSchoolInfo(data)
         }
       } catch (error) {
         console.error("Error in fetchSchoolInfo:", error)
       }
     }
     
     fetchSchoolInfo()
   }, [])

  // Fetch classes
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const { data, error } = await supabase
          .from("classes")
          .select("id, name")
          .order("numeric_order", { ascending: true })
        
        if (error) {
          console.error("Error fetching classes:", error)
        } else if (data) {
          setClasses(data)
        }
      } catch (error) {
        console.error("Error in fetchClasses:", error)
      }
    }
    
    fetchClasses()
  }, [])

  // Fetch sections based on selected class
  useEffect(() => {
    const fetchSections = async () => {
      try {
        let query = supabase.from("sections").select("id, name, class_id").order("name")
        
        if (filters.classId !== "all") {
          query = query.eq("class_id", filters.classId)
        }
        
        const { data, error } = await query
        
        if (error) {
          console.error("Error fetching sections:", error)
        } else if (data) {
          setSections(data)
          setFilters((prev) => ({ ...prev, sectionId: "all" }))
        }
      } catch (error) {
        console.error("Error in fetchSections:", error)
      }
    }
    
    fetchSections()
  }, [filters.classId])

  // Load attendance percentage data
  const loadAttendancePercentage = useCallback(async () => {
    setLoading(true)
    try {
      const startDate = new Date(filters.startDate)
      const endDate = new Date(filters.endDate)
      const totalDays = differenceInDays(endDate, startDate) + 1

      if (totalDays <= 0) {
        toast.error("Invalid date range")
        setLoading(false)
        return
      }

      if (filters.userType === "student") {
        // Get all students with filters
        let studentQuery = supabase
          .from("students")
          .select("*")
          .eq("status", "active")

        if (filters.classId !== "all") {
          studentQuery = studentQuery.eq("class_id", filters.classId)
        }
        if (filters.sectionId !== "all") {
          studentQuery = studentQuery.eq("section_id", filters.sectionId)
        }

        const { data: students, error: studentError } = await studentQuery
        if (studentError) throw studentError

        if (!students || students.length === 0) {
          setAttendanceData([])
          setLoading(false)
          return
        }

        // Get class and section names separately
        const classIds = [...new Set(students.map(s => s.class_id).filter(Boolean))]
        const sectionIds = [...new Set(students.map(s => s.section_id).filter(Boolean))]
        
        let classesData: any[] = []
        let sectionsData: any[] = []
        
        if (classIds.length > 0) {
          const { data: cData } = await supabase
            .from("classes")
            .select("id, name")
            .in("id", classIds)
          classesData = cData || []
        }
        
        if (sectionIds.length > 0) {
          const { data: secData } = await supabase
            .from("sections")
            .select("id, name")
            .in("id", sectionIds)
          sectionsData = secData || []
        }

        const dateRange = eachDayOfInterval({ start: startDate, end: endDate }).map((d) => format(d, "yyyy-MM-dd"))

        const { data: attendance, error: attendanceError } = await supabase
          .from("student_attendance")
          .select("student_id, status")
          .in("date", dateRange)
          .in("student_id", students.map(s => s.id))

        if (attendanceError) throw attendanceError

        // Calculate attendance for each student
        const attendanceMap = new Map<string, { present: number; absent: number; late: number; leave: number }>()

        attendance?.forEach((att) => {
          const stats = attendanceMap.get(att.student_id) || { present: 0, absent: 0, late: 0, leave: 0 }
          if (att.status === "present") stats.present++
          else if (att.status === "late") stats.late++
          else if (att.status === "leave") stats.leave++
          else stats.absent++
          attendanceMap.set(att.student_id, stats)
        })

        const data: AttendancePercentage[] = students.map((student) => {
          const stats = attendanceMap.get(student.id) || { present: 0, absent: 0, late: 0, leave: 0 }
          const presentDays = stats.present + stats.late // Late counts as present for percentage
          const percentage = totalDays > 0 ? (presentDays / totalDays) * 100 : 0
          const classInfo = classesData.find(c => c.id === student.class_id)
          const sectionInfo = sectionsData.find(sec => sec.id === student.section_id)

          return {
            id: student.id,
            name: student.name || "Unknown",
            admission_no: (student as any).student_id || "N/A",
            class_name: classInfo?.name || "N/A",
            section_name: sectionInfo?.name || "N/A",
            total_days: totalDays,
            present_days: stats.present,
            absent_days: stats.absent,
            late_days: stats.late,
            leave_days: stats.leave,
            percentage,
            type: "student",
          }
        })

        // Apply filters
        let filtered = data.filter(
          (d) => d.percentage >= filters.minPercentage && d.percentage <= filters.maxPercentage
        )

        if (filters.searchTerm) {
          filtered = filtered.filter(
            (d) =>
              d.name.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
              d.admission_no?.toLowerCase().includes(filters.searchTerm.toLowerCase())
          )
        }

        setAttendanceData(filtered)
      } else {
        // Staff attendance percentage
        const { data: staff, error: staffError } = await supabase
          .from("staff")
          .select("*")
          .eq("status", "active")

        if (staffError) throw staffError

        if (!staff || staff.length === 0) {
          setAttendanceData([])
          setLoading(false)
          return
        }

        const dateRange = eachDayOfInterval({ start: startDate, end: endDate }).map((d) => format(d, "yyyy-MM-dd"))

        const { data: attendance, error: attendanceError } = await supabase
          .from("staff_attendance")
          .select("staff_id, status")
          .in("date", dateRange)
          .in("staff_id", staff.map(s => s.id))

        if (attendanceError) throw attendanceError

        const attendanceMap = new Map<string, { present: number; absent: number; late: number; leave: number }>()

        attendance?.forEach((att) => {
          const stats = attendanceMap.get(att.staff_id) || { present: 0, absent: 0, late: 0, leave: 0 }
          if (att.status === "present") stats.present++
          else if (att.status === "late") stats.late++
          else if (att.status === "leave") stats.leave++
          else stats.absent++
          attendanceMap.set(att.staff_id, stats)
        })

        const data: AttendancePercentage[] = staff.map((staffMember) => {
          const stats = attendanceMap.get(staffMember.id) || { present: 0, absent: 0, late: 0, leave: 0 }
          const presentDays = stats.present + stats.late
          const percentage = totalDays > 0 ? (presentDays / totalDays) * 100 : 0

          return {
            id: staffMember.id,
            name: staffMember.name || "Unknown",
            employee_id: staffMember.employee_id || "N/A",
            designation: staffMember.designation || "Staff",
            total_days: totalDays,
            present_days: stats.present,
            absent_days: stats.absent,
            late_days: stats.late,
            leave_days: stats.leave,
            percentage,
            type: "staff",
          }
        })

        let filtered = data.filter(
          (d) => d.percentage >= filters.minPercentage && d.percentage <= filters.maxPercentage
        )

        if (filters.searchTerm) {
          filtered = filtered.filter(
            (d) =>
              d.name.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
              d.employee_id?.toLowerCase().includes(filters.searchTerm.toLowerCase())
          )
        }

        setAttendanceData(filtered)
      }
    } catch (error: any) {
      console.error("Error loading attendance percentage:", error)
      const errorMessage = error?.message || "Failed to load attendance data"
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    loadAttendancePercentage()
  }, [loadAttendancePercentage])

  // Statistics
  const stats = {
    total: attendanceData.length,
    avgPercentage: attendanceData.reduce((sum, d) => sum + d.percentage, 0) / (attendanceData.length || 1),
    above90: attendanceData.filter((d) => d.percentage >= 90).length,
    below75: attendanceData.filter((d) => d.percentage < 75).length,
    totalPresentDays: attendanceData.reduce((sum, d) => sum + d.present_days, 0),
    totalAbsentDays: attendanceData.reduce((sum, d) => sum + d.absent_days, 0),
    totalLateDays: attendanceData.reduce((sum, d) => sum + d.late_days, 0),
  }

  // Chart data
  const getPercentageDistribution = () => {
    const ranges = [
      { range: "0-50%", min: 0, max: 50, count: 0, color: "#ef4444" },
      { range: "51-75%", min: 51, max: 75, count: 0, color: "#f59e0b" },
      { range: "76-90%", min: 76, max: 90, count: 0, color: "#10b981" },
      { range: "91-100%", min: 91, max: 100, count: 0, color: "#3b82f6" },
    ]

    attendanceData.forEach((d) => {
      const range = ranges.find((r) => d.percentage >= r.min && d.percentage <= r.max)
      if (range) range.count++
    })

    return ranges.filter((r) => r.count > 0)
  }

  const getTopAttendance = () => {
    return [...attendanceData].sort((a, b) => b.percentage - a.percentage).slice(0, 10)
  }

  const getLowAttendance = () => {
    return [...attendanceData].sort((a, b) => a.percentage - b.percentage).slice(0, 10)
  }

  const getPercentageColor = (percentage: number) => {
    if (percentage >= 90) return "text-emerald-600 dark:text-emerald-400"
    if (percentage >= 75) return "text-blue-600 dark:text-blue-400"
    if (percentage >= 50) return "text-amber-600 dark:text-amber-400"
    return "text-red-600 dark:text-red-400"
  }

  const getPercentageBadge = (percentage: number) => {
    if (percentage >= 90) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
    if (percentage >= 75) return "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
    if (percentage >= 50) return "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
    return "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
  }

  const exportToCSV = () => {
    let csvContent = ""

    if (filters.userType === "student") {
      csvContent = [
        ["Name", "Admission No", "Class", "Section", "Total Days", "Present", "Absent", "Late", "Leave", "Percentage"],
        ...attendanceData.map((d) => [
          d.name,
          d.admission_no,
          d.class_name,
          d.section_name,
          d.total_days,
          d.present_days,
          d.absent_days,
          d.late_days,
          d.leave_days,
          d.percentage.toFixed(2) + "%",
        ]),
      ]
        .map((row) => row.join(","))
        .join("\n")
    } else {
      csvContent = [
        ["Name", "Employee ID", "Designation", "Total Days", "Present", "Absent", "Late", "Leave", "Percentage"],
        ...attendanceData.map((d) => [
          d.name,
          d.employee_id,
          d.designation,
          d.total_days,
          d.present_days,
          d.absent_days,
          d.late_days,
          d.leave_days,
          d.percentage.toFixed(2) + "%",
        ]),
      ]
        .map((row) => row.join(","))
        .join("\n")
    }

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `attendance_percentage_${filters.userType}_${filters.startDate}_to_${filters.endDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Report exported successfully")
  }

  const handlePrint = () => {
    const printWindow = window.open("", "_blank")
    if (!printWindow) return

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Attendance Percentage Report</title>
        <style>
          * { font-family: 'Segoe UI', Arial, sans-serif; }
          body { margin: 20px; padding: 0; }
          .report-title { font-size: 18px; font-weight: bold; margin-top: 10px; }
          .report-period { color: #666; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f3f4f6; font-weight: bold; }
          .footer { text-align: center; margin-top: 30px; font-size: 10px; color: #666; }
        </style>
      </head>
      <body>
        ${getSchoolPrintHeader(schoolInfo, `${filters.userType === "student" ? "Student" : "Staff"} Attendance Percentage Report`)}
        <p style="text-align:center">Period: ${filters.startDate} to ${filters.endDate}</p>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>${filters.userType === "student" ? "Admission No" : "Employee ID"}</th>
              <th>${filters.userType === "student" ? "Class" : "Designation"}</th>
              <th>Present</th>
              <th>Total Days</th>
              <th>Percentage</th>
            </tr>
          </thead>
          <tbody>
            ${attendanceData
              .map(
                (d, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${d.name}</td>
                <td>${filters.userType === "student" ? d.admission_no : d.employee_id}</td>
                <td>${filters.userType === "student" ? d.class_name : d.designation}</td>
                <td>${d.present_days + d.late_days}</td>
                <td>${d.total_days}</td>
                <td>${d.percentage.toFixed(1)}%</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
        <div class="footer">Generated on ${new Date().toLocaleString()}</div>
        <script>window.print(); setTimeout(() => window.close(), 1000);<\/script>
      </body>
      </html>
    `)
    printWindow.document.close()
  }

  const COLORS = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6"]

  return (
    <ResponsiveLayout>
      <div className="space-y-5 p-4 md:p-6">
        {/* Header with School Name */}
        {schoolInfo.school_name && (
          <div className="text-center mb-2">
            <div className="text-xl md:text-2xl font-bold text-slate-800 dark:text-white">
              {schoolInfo.school_name}
            </div>
          </div>
        )}

        {/* Main Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild className="bg-white/20 hover:bg-white/30 text-white rounded-xl">
              <Link href="/attendance/reports">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
                <Target className="h-7 w-7" />
                Attendance Percentage Report
              </h1>
              <p className="text-blue-100 text-sm">Track attendance performance metrics</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => setShowFilters(!showFilters)}
              className="bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-xl"
            >
              <Filter className="h-4 w-4 mr-1" />
              {showFilters ? "Hide" : "Filters"}
            </Button>
            <Button onClick={exportToCSV} className="bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-xl">
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
            <Button onClick={handlePrint} className="bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-xl">
              <Printer className="h-4 w-4 mr-1" />
              Print
            </Button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <Card className="border-0 shadow-md bg-white dark:bg-slate-800">
            <CardContent className="pt-5 pb-4">
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1 block">User Type</label>
                  <Select
                    value={filters.userType}
                    onValueChange={(v) => setFilters((prev) => ({ ...prev, userType: v as "student" | "staff" }))}
                  >
                    <SelectTrigger className="rounded-xl bg-white dark:bg-slate-900 dark:border-slate-600">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="student">Students</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1 block">Start Date</label>
                  <Input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))}
                    className="rounded-xl dark:bg-slate-900 dark:border-slate-600"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1 block">End Date</label>
                  <Input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))}
                    className="rounded-xl dark:bg-slate-900 dark:border-slate-600"
                  />
                </div>
                {filters.userType === "student" && (
                  <>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1 block">Class</label>
                      <Select value={filters.classId} onValueChange={(v) => setFilters((prev) => ({ ...prev, classId: v }))}>
                        <SelectTrigger className="rounded-xl bg-white dark:bg-slate-900 dark:border-slate-600">
                          <SelectValue placeholder="All Classes" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Classes</SelectItem>
                          {classes.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1 block">Section</label>
                      <Select
                        value={filters.sectionId}
                        onValueChange={(v) => setFilters((prev) => ({ ...prev, sectionId: v }))}
                        disabled={filters.classId === "all"}
                      >
                        <SelectTrigger className="rounded-xl bg-white dark:bg-slate-900 dark:border-slate-600">
                          <SelectValue placeholder="All Sections" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Sections</SelectItem>
                          {sections.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1 block">Min %</label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={filters.minPercentage}
                    onChange={(e) => setFilters((prev) => ({ ...prev, minPercentage: parseInt(e.target.value) || 0 }))}
                    className="rounded-xl dark:bg-slate-900 dark:border-slate-600"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1 block">Max %</label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={filters.maxPercentage}
                    onChange={(e) => setFilters((prev) => ({ ...prev, maxPercentage: parseInt(e.target.value) || 100 }))}
                    className="rounded-xl dark:bg-slate-900 dark:border-slate-600"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1 block">Search</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder={`Search ${filters.userType === "student" ? "student" : "staff"}...`}
                      value={filters.searchTerm}
                      onChange={(e) => setFilters((prev) => ({ ...prev, searchTerm: e.target.value }))}
                      className="pl-9 rounded-xl dark:bg-slate-900 dark:border-slate-600"
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end mt-4">
                <Button
                  variant="outline"
                  onClick={() =>
                    setFilters((prev) => ({
                      ...prev,
                      startDate: startOfMonthStr(),
                      endDate: endOfMonthStr(),
                      classId: "all",
                      sectionId: "all",
                      minPercentage: 0,
                      maxPercentage: 100,
                      searchTerm: "",
                    }))
                  }
                  className="rounded-xl"
                >
                  Reset Filters
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
          <Card className="bg-gradient-to-br from-slate-600 to-slate-700 text-white">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs opacity-75">Total</p>
                  <p className="text-xl font-bold">{stats.total}</p>
                </div>
                <Users className="h-6 w-6 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs opacity-75">Average %</p>
                  <p className="text-xl font-bold">{stats.avgPercentage.toFixed(1)}%</p>
                </div>
                <TrendingUp className="h-6 w-6 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs opacity-75">Above 90%</p>
                  <p className="text-xl font-bold">{stats.above90}</p>
                </div>
                <UserCheck className="h-6 w-6 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs opacity-75">Below 75%</p>
                  <p className="text-xl font-bold">{stats.below75}</p>
                </div>
                <UserX className="h-6 w-6 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs opacity-75">Present Days</p>
                  <p className="text-xl font-bold">{stats.totalPresentDays}</p>
                </div>
                <UserCheck className="h-6 w-6 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs opacity-75">Late Days</p>
                  <p className="text-xl font-bold">{stats.totalLateDays}</p>
                </div>
                <Clock className="h-6 w-6 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Percentage Distribution Pie Chart */}
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <LucidePieChart className="h-5 w-5 text-blue-500" />
                Attendance Distribution
              </CardTitle>
              <CardDescription>Distribution of attendance percentages</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={getPercentageDistribution()}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ range, percent }: any) => `${range}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      dataKey="count"
                    >
                      {getPercentageDistribution().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Top Performers vs Low Performers */}
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-blue-500" />
                  Performance Comparison
                </CardTitle>
                <Select value={chartType} onValueChange={(v) => setChartType(v as "bar" | "pie")}>
                  <SelectTrigger className="w-24 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bar">Bar Chart</SelectItem>
                    <SelectItem value="pie">Pie Chart</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <CardDescription>Top 5 vs Bottom 5 attendance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      ...getTopAttendance().slice(0, 5).map((d) => ({ name: d.name.substring(0, 15), percentage: d.percentage, type: "Top" })),
                      ...getLowAttendance()
                        .slice(0, 5)
                        .map((d) => ({ name: d.name.substring(0, 15), percentage: d.percentage, type: "Bottom" })),
                    ]}
                    layout="vertical"
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, 100]} />
                    <YAxis dataKey="name" type="category" width={100} />
                    <Tooltip formatter={(value) => `${(value as number).toFixed(1)}%`} />
                    <Legend />
                    <Bar dataKey="percentage" fill="#3b82f6" name="Attendance %" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Attendance List */}
        <Card className="border-0 shadow-md">
          <CardHeader className="bg-slate-50 dark:bg-slate-700 rounded-t-2xl">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
              Top 10 Attendance Performers
            </CardTitle>
            <CardDescription>Highest attendance percentages</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {getTopAttendance().map((item, idx) => (
                <div key={item.id} className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center font-bold text-emerald-600">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800 dark:text-white">{item.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {filters.userType === "student" ? item.class_name : item.designation}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-xl font-bold ${getPercentageColor(item.percentage)}`}>{item.percentage.toFixed(1)}%</p>
                    <p className="text-xs text-slate-500">
                      {item.present_days + item.late_days}/{item.total_days} days
                    </p>
                  </div>
                </div>
              ))}
              {getTopAttendance().length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <AlertCircle className="h-12 w-12 mb-3" />
                  <p>No attendance data found</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Detailed Table */}
        <Card className="border-0 shadow-md">
          <CardHeader className="bg-slate-50 dark:bg-slate-700 rounded-t-2xl">
            <CardTitle className="flex items-center gap-2">
              <School className="h-5 w-5 text-blue-500" />
              Detailed Attendance Percentage
            </CardTitle>
            <CardDescription>
              {attendanceData.length} {filters.userType === "student" ? "students" : "staff"} records found
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="h-10 w-10 animate-spin text-blue-600 mb-3" />
                <p className="text-slate-500">Loading data...</p>
              </div>
            ) : (
              <div className="min-w-[900px]">
                <div className="grid grid-cols-12 gap-2 px-4 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase tracking-wider bg-slate-50 dark:bg-slate-700 border-b">
                  <div className="col-span-1">#</div>
                  <div className="col-span-3">Name</div>
                  <div className="col-span-2">ID</div>
                  <div className="col-span-2">Class/Dept</div>
                  <div className="col-span-1 text-center">Present</div>
                  <div className="col-span-1 text-center">Total</div>
                  <div className="col-span-2 text-center">Percentage</div>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                  {attendanceData.map((item, idx) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-slate-50 dark:hover:bg-slate-700/50"
                    >
                      <div className="col-span-1">
                        <span className="font-mono text-xs text-slate-500">{idx + 1}</span>
                      </div>
                      <div className="col-span-3">
                        <p className="font-medium text-slate-800 dark:text-white">{item.name}</p>
                      </div>
                      <div className="col-span-2">
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                          {filters.userType === "student" ? item.admission_no : item.employee_id}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                          {filters.userType === "student" ? item.class_name : item.designation}
                        </span>
                      </div>
                      <div className="col-span-1 text-center">
                        <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                          {item.present_days + item.late_days}
                        </span>
                      </div>
                      <div className="col-span-1 text-center">
                        <span className="text-sm text-slate-600">{item.total_days}</span>
                      </div>
                      <div className="col-span-2 text-center">
                        <Badge className={getPercentageBadge(item.percentage)}>{item.percentage.toFixed(1)}%</Badge>
                      </div>
                    </div>
                  ))}
                </div>
                {attendanceData.length === 0 && !loading && (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <AlertCircle className="h-12 w-12 mb-3" />
                    <p>No records found for the selected criteria</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ResponsiveLayout>
  )
}
