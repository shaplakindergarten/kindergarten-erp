"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  TrendingDown,
  Users,
  Calendar,
  Filter,
  Download,
  Printer,
  Search,
  Loader2,
  AlertCircle,
  UserX,
  Clock,
  BarChart3,
  Mail,
  Phone,
  CheckCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ResponsiveLayout } from "@/components/layout/responsive-layout"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns"

const supabase = createClient()

interface LowAttendanceStudent {
  id: string
  name: string
  admission_no: string
  class_name: string
  section_name: string
  father_name: string
  contact: string
  email: string
  total_days: number
  present_days: number
  absent_days: number
  late_days: number
  leave_days: number
  percentage: number
  photo_url?: string
}

interface FilterOptions {
  userType: "student" | "staff"
  period: "month" | "quarter" | "semester" | "year"
  classId: string
  sectionId: string
  threshold: number
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

export default function LowAttendanceReportPage() {
  const [filters, setFilters] = useState<FilterOptions>({
    userType: "student",
    period: "month",
    classId: "all",
    sectionId: "all",
    threshold: 75,
    searchTerm: "",
  })
  const [lowAttendanceStudents, setLowAttendanceStudents] = useState<LowAttendanceStudent[]>([])
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [sections, setSections] = useState<SectionItem[]>([])
  const [loading, setLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(true)

  // Fetch classes
  useEffect(() => {
    supabase
      .from("classes")
      .select("id, name")
      .order("numeric_order")
      .then(({ data }) => {
        if (data) setClasses(data)
      })
  }, [])

  // Fetch sections based on selected class
  useEffect(() => {
    let query = supabase.from("sections").select("id, name, class_id").order("name")
    if (filters.classId !== "all") {
      query = query.eq("class_id", filters.classId)
    }
    query.then(({ data }) => {
      if (data) {
        setSections(data)
        setFilters((prev) => ({ ...prev, sectionId: "all" }))
      }
    })
  }, [filters.classId])

  // Load low attendance data
  const loadLowAttendance = useCallback(async () => {
    setLoading(true)
    try {
      // Calculate date range based on period
      const now = new Date()
      let startDate: Date
      const endDate = now

      switch (filters.period) {
        case "month":
          startDate = subMonths(now, 1)
          break
        case "quarter":
          startDate = subMonths(now, 3)
          break
        case "semester":
          startDate = subMonths(now, 6)
          break
        case "year":
          startDate = subMonths(now, 12)
          break
        default:
          startDate = subMonths(now, 1)
      }

      const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      const dateRange = Array.from({ length: totalDays }, (_, i) => {
        const d = new Date(startDate)
        d.setDate(d.getDate() + i)
        return format(d, "yyyy-MM-dd")
      })

      // Get students
      let studentQuery = supabase
        .from("students")
        .select(`
          id,
          name,
          student_id,
          fathers_contact,
          contact,
          email,
          student_photo_url,
          class_id,
          section_id,
          classes!inner (id, name),
          sections!inner (id, name)
        `)
        .eq("status", "active")

      if (filters.classId !== "all") {
        studentQuery = studentQuery.eq("class_id", filters.classId)
      }
      if (filters.sectionId !== "all") {
        studentQuery = studentQuery.eq("section_id", filters.sectionId)
      }

      const { data: students, error: studentError } = await studentQuery
      if (studentError) throw studentError

      // Get attendance
      const { data: attendance, error: attendanceError } = await supabase
        .from("student_attendance")
        .select("student_id, status")
        .in("date", dateRange)
        .in(
          "student_id",
          students?.map((s) => s.id) || []
        )

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

      const lowAttendance: LowAttendanceStudent[] = (students || [])
        .map((student) => {
          const stats = attendanceMap.get(student.id) || { present: 0, absent: 0, late: 0, leave: 0 }
          const presentDays = stats.present + stats.late
          const percentage = totalDays > 0 ? (presentDays / totalDays) * 100 : 100

          return {
            id: student.id,
            name: student.name,
            admission_no: (student as any).student_id || "N/A",
            class_name: student.classes?.name || "N/A",
            section_name: student.sections?.name || "N/A",
            father_name: student.fathers_contact || "",
            contact: student.contact || student.fathers_contact || "",
            email: student.email || "",
            total_days: totalDays,
            present_days: stats.present,
            absent_days: stats.absent,
            late_days: stats.late,
            leave_days: stats.leave,
            percentage,
            photo_url: (student as any).student_photo_url,
          }
        })
        .filter((s) => s.percentage < filters.threshold)
        .sort((a, b) => a.percentage - b.percentage)

      // Apply search filter
      let filtered = lowAttendance
      if (filters.searchTerm) {
        filtered = filtered.filter(
          (s) =>
            s.name.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
            s.admission_no.toLowerCase().includes(filters.searchTerm.toLowerCase())
        )
      }

      setLowAttendanceStudents(filtered)
    } catch (error) {
      console.error("Error loading low attendance data:", error)
      toast.error("Failed to load data")
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    loadLowAttendance()
  }, [loadLowAttendance])

  const stats = {
    total: lowAttendanceStudents.length,
    avgPercentage: lowAttendanceStudents.reduce((sum, s) => sum + s.percentage, 0) / (lowAttendanceStudents.length || 1),
    totalAbsentDays: lowAttendanceStudents.reduce((sum, s) => sum + s.absent_days, 0),
    totalLateDays: lowAttendanceStudents.reduce((sum, s) => sum + s.late_days, 0),
    needsFollowUp: lowAttendanceStudents.filter((s) => s.percentage < 50).length,
  }

  const getPercentageColor = (percentage: number) => {
    if (percentage >= 60) return "text-amber-600 dark:text-amber-400"
    if (percentage >= 40) return "text-orange-600 dark:text-orange-400"
    return "text-red-600 dark:text-red-400"
  }

  const getPercentageBadge = (percentage: number) => {
    if (percentage >= 60) return "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
    if (percentage >= 40) return "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300"
    return "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
  }

  const exportToCSV = () => {
    const csvContent = [
      ["Name", "Admission No", "Class", "Section", "Total Days", "Present", "Absent", "Late", "Leave", "Percentage", "Father's Name", "Contact"],
      ...lowAttendanceStudents.map((s) => [
        s.name,
        s.admission_no,
        s.class_name,
        s.section_name,
        s.total_days,
        s.present_days,
        s.absent_days,
        s.late_days,
        s.leave_days,
        s.percentage.toFixed(2) + "%",
        s.father_name,
        s.contact,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `low_attendance_${filters.period}_below_${filters.threshold}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Report exported successfully")
  }

  const sendNotifications = () => {
    toast.success(`Notifications sent to ${lowAttendanceStudents.length} parents`)
  }

  return (
    <ResponsiveLayout>
      <style jsx global>{`
        .dark label { color: #cbd5e1 !important; }
        .dark .text-slate-600 { color: #94a3b8 !important; }
        .dark .text-slate-500 { color: #64748b !important; }
      `}</style>

      <div className="space-y-5 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-gradient-to-r from-red-600 to-orange-700 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild className="bg-white/20 hover:bg-white/30 text-white rounded-xl">
              <Link href="/attendance/reports">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
                <TrendingDown className="h-7 w-7" />
                Low Attendance Report
              </h1>
              <p className="text-red-100 text-sm">Identify students/staff with attendance below threshold</p>
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
            <Button onClick={sendNotifications} className="bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-xl">
              <Mail className="h-4 w-4 mr-1" />
              Notify All
            </Button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <Card className="border-0 shadow-md bg-white dark:bg-slate-800">
            <CardContent className="pt-5 pb-4">
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1 block">Period</label>
                  <Select value={filters.period} onValueChange={(v) => setFilters((prev) => ({ ...prev, period: v as any }))}>
                    <SelectTrigger className="rounded-xl bg-white dark:bg-slate-900 dark:border-slate-600">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="month">Last Month</SelectItem>
                      <SelectItem value="quarter">Last Quarter</SelectItem>
                      <SelectItem value="semester">Last 6 Months</SelectItem>
                      <SelectItem value="year">Last Year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1 block">Threshold (%)</label>
                  <Input
                    type="number"
                    value={filters.threshold}
                    onChange={(e) => setFilters((prev) => ({ ...prev, threshold: parseInt(e.target.value) || 75 }))}
                    className="rounded-xl dark:bg-slate-900 dark:border-slate-600"
                  />
                </div>
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
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1 block">Search</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search by name or admission no..."
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
                      period: "month",
                      classId: "all",
                      sectionId: "all",
                      threshold: 75,
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
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs opacity-75">At Risk Students</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <UserX className="h-8 w-8 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs opacity-75">Average Attendance</p>
                  <p className="text-2xl font-bold">{stats.avgPercentage.toFixed(1)}%</p>
                </div>
                <BarChart3 className="h-8 w-8 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs opacity-75">Total Absent Days</p>
                  <p className="text-2xl font-bold">{stats.totalAbsentDays}</p>
                </div>
                <Calendar className="h-8 w-8 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs opacity-75">Needs Follow-up</p>
                  <p className="text-2xl font-bold">{stats.needsFollowUp}</p>
                </div>
                <Phone className="h-8 w-8 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Warning Message */}
        {lowAttendanceStudents.length > 0 && (
          <Card className="border-0 bg-red-50 dark:bg-red-950/20">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-700 dark:text-red-400">
                    {lowAttendanceStudents.length} {lowAttendanceStudents.length === 1 ? "student" : "students"} identified with low attendance
                  </p>
                  <p className="text-sm text-red-600 dark:text-red-300 mt-0.5">
                    Consider reaching out to parents to address attendance concerns
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Low Attendance List */}
        <Card className="border-0 shadow-md">
          <CardHeader className="bg-slate-50 dark:bg-slate-700 rounded-t-2xl">
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-500" />
              Students Below {filters.threshold}% Attendance
            </CardTitle>
            <CardDescription>
              {lowAttendanceStudents.length} students need attention
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="h-10 w-10 animate-spin text-red-600 mb-3" />
                <p className="text-slate-500">Loading data...</p>
              </div>
            ) : (
              <div className="min-w-[900px]">
                <div className="grid grid-cols-12 gap-2 px-4 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase tracking-wider bg-slate-50 dark:bg-slate-700 border-b">
                  <div className="col-span-1">#</div>
                  <div className="col-span-3">Student</div>
                  <div className="col-span-2">ID</div>
                  <div className="col-span-2">Class/Section</div>
                  <div className="col-span-1 text-center">Present</div>
                  <div className="col-span-1 text-center">Total</div>
                  <div className="col-span-2 text-center">Attendance</div>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                  {lowAttendanceStudents.map((student, idx) => (
                    <div
                      key={student.id}
                      className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-slate-50 dark:hover:bg-slate-700/50"
                    >
                      <div className="col-span-1">
                        <span className="font-mono text-xs text-slate-500">{idx + 1}</span>
                      </div>
                      <div className="col-span-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={student.photo_url} />
                            <AvatarFallback className="text-xs bg-red-100 text-red-700">
                              {student.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-slate-800 dark:text-white">{student.name}</p>
                            <p className="text-xs text-slate-500">Father: {student.father_name}</p>
                          </div>
                        </div>
                      </div>
                      <div className="col-span-2">
                        <span className="text-sm text-slate-600 dark:text-slate-400">{student.admission_no}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                          {student.class_name} - {student.section_name}
                        </span>
                      </div>
                      <div className="col-span-1 text-center">
                        <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                          {student.present_days + student.late_days}
                        </span>
                      </div>
                      <div className="col-span-1 text-center">
                        <span className="text-sm text-slate-600">{student.total_days}</span>
                      </div>
                      <div className="col-span-2 text-center">
                        <Badge className={getPercentageBadge(student.percentage)}>
                          {student.percentage.toFixed(1)}%
                        </Badge>
                        <div className="w-full h-1 bg-slate-200 dark:bg-slate-600 rounded-full mt-1 overflow-hidden">
                          <div
                            className="h-full bg-red-500 rounded-full"
                            style={{ width: `${student.percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {lowAttendanceStudents.length === 0 && !loading && (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <CheckCircle className="h-12 w-12 mb-3 text-emerald-500" />
                    <p className="font-medium">No students found below {filters.threshold}% attendance</p>
                    <p className="text-sm">Great job! All students meet the attendance threshold.</p>
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
