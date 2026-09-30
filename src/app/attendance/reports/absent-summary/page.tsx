"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  XCircle,
  Users,
  Calendar,
  Filter,
  Download,
  Printer,
  Search,
  Loader2,
  AlertCircle,
  TrendingDown,
  UserX,
  BarChart3,
  ChevronLeft,
  ChevronRight,
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
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns"
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
  PieChart,
  Pie,
  Cell,
} from "recharts"

const supabase = createClient()

interface AbsentRecord {
  id: string
  student_id: string
  student_name: string
  admission_no: string
  class_name: string
  section_name: string
  date: string
  status: string
  father_name: string
  contact: string
  photo_url?: string
  total_absent_days: number
}

interface StaffAbsentRecord {
  id: string
  staff_id: string
  staff_name: string
  employee_id: string
  designation: string
  date: string
  status: string
  phone: string
  photo_url?: string
  total_absent_days: number
}

interface FilterOptions {
  userType: "student" | "staff"
  startDate: string
  endDate: string
  classId: string
  sectionId: string
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

export default function AbsentSummaryReportPage() {
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
    searchTerm: "",
  })
  const [absentRecords, setAbsentRecords] = useState<AbsentRecord[]>([])
  const [staffAbsentRecords, setStaffAbsentRecords] = useState<StaffAbsentRecord[]>([])
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [sections, setSections] = useState<SectionItem[]>([])
  const [loading, setLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(true)

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

  // Load absent records
  const loadAbsentRecords = useCallback(async () => {
    setLoading(true)
    try {
      const startDate = new Date(filters.startDate)
      const endDate = new Date(filters.endDate)
      
      const dateRange = eachDayOfInterval({
        start: startDate,
        end: endDate,
      }).map((d) => format(d, "yyyy-MM-dd"))

      if (filters.userType === "student") {
        // First, get all active students with their basic info
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
        
        if (studentError) {
          console.error("Student fetch error details:", studentError)
          throw new Error(`Failed to fetch students: ${studentError.message}`)
        }

        if (!students || students.length === 0) {
          setAbsentRecords([])
          setLoading(false)
          return
        }

        // Get class names
        const classIds = [...new Set(students.map(s => s.class_id).filter(Boolean))]
        let classesData: any[] = []
        if (classIds.length > 0) {
          const { data: cData, error: cError } = await supabase
            .from("classes")
            .select("id, name")
            .in("id", classIds)
          if (!cError && cData) {
            classesData = cData
          }
        }
        
        // Get section names
        const sectionIds = [...new Set(students.map(s => s.section_id).filter(Boolean))]
        let sectionsData: any[] = []
        if (sectionIds.length > 0) {
          const { data: secData, error: secError } = await supabase
            .from("sections")
            .select("id, name")
            .in("id", sectionIds)
          if (!secError && secData) {
            sectionsData = secData
          }
        }

        // Get attendance records for the date range
        const { data: attendance, error: attendanceError } = await supabase
          .from("student_attendance")
          .select("student_id, date, status")
          .in("date", dateRange)
          .in("student_id", students.map(s => s.id))

        if (attendanceError) {
          console.error("Attendance fetch error details:", attendanceError)
          throw new Error(`Failed to fetch attendance: ${attendanceError.message}`)
        }

        // Create attendance map for absent days
        const attendanceMap = new Map<string, Set<string>>()
        
        if (attendance) {
          attendance.forEach((att) => {
            if (!attendanceMap.has(att.student_id)) {
              attendanceMap.set(att.student_id, new Set())
            }
            // Count as absent if status is not 'present' or 'late'
            if (att.status !== "present" && att.status !== "late") {
              attendanceMap.get(att.student_id)?.add(att.date)
            }
          })
        }

        // Build absent records
        const records: AbsentRecord[] = students.map((student) => {
          const absentDates = attendanceMap.get(student.id) || new Set()
          const classInfo = classesData.find(c => c.id === student.class_id)
          const sectionInfo = sectionsData.find(sec => sec.id === student.section_id)
          
          return {
            id: student.id,
            student_id: student.id,
            student_name: student.name || "Unknown",
            admission_no: (student as any).student_id || "N/A",
            class_name: classInfo?.name || "N/A",
            section_name: sectionInfo?.name || "N/A",
            date: filters.startDate,
            status: "absent",
            father_name: student.father_name || student.fathers_contact || "",
            contact: student.contact || student.fathers_contact || "",
            photo_url: student.photo_url || (student as any).student_photo_url,
            total_absent_days: absentDates.size,
          }
        }).filter((r) => r.total_absent_days > 0)

        // Filter by search term
        const searched = records.filter(
          (r) =>
            !filters.searchTerm ||
            r.student_name.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
            r.admission_no.toLowerCase().includes(filters.searchTerm.toLowerCase())
        )

        setAbsentRecords(searched)
      } else {
        // Staff absent records
        const { data: staff, error: staffError } = await supabase
          .from("staff")
          .select("*")
          .eq("status", "active")

        if (staffError) {
          console.error("Staff fetch error details:", staffError)
          throw new Error(`Failed to fetch staff: ${staffError.message}`)
        }

        if (!staff || staff.length === 0) {
          setStaffAbsentRecords([])
          setLoading(false)
          return
        }

        const { data: attendance, error: attendanceError } = await supabase
          .from("staff_attendance")
          .select("staff_id, date, status")
          .in("date", dateRange)
          .in("staff_id", staff.map(s => s.id))

        if (attendanceError) {
          console.error("Staff attendance fetch error details:", attendanceError)
          throw new Error(`Failed to fetch staff attendance: ${attendanceError.message}`)
        }

        const attendanceMap = new Map<string, Set<string>>()
        
        if (attendance) {
          attendance.forEach((att) => {
            if (!attendanceMap.has(att.staff_id)) {
              attendanceMap.set(att.staff_id, new Set())
            }
            if (att.status !== "present" && att.status !== "late") {
              attendanceMap.get(att.staff_id)?.add(att.date)
            }
          })
        }

        const records: StaffAbsentRecord[] = staff.map((staffMember) => {
          const absentDates = attendanceMap.get(staffMember.id) || new Set()
          return {
            id: staffMember.id,
            staff_id: staffMember.id,
            staff_name: staffMember.name || "Unknown",
            employee_id: staffMember.employee_id || "N/A",
            designation: staffMember.designation || "Staff",
            date: filters.startDate,
            status: "absent",
            phone: staffMember.phone || staffMember.contact || "",
            photo_url: staffMember.photo_url,
            total_absent_days: absentDates.size,
          }
        }).filter((r) => r.total_absent_days > 0)

        const searched = records.filter(
          (r) =>
            !filters.searchTerm ||
            r.staff_name.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
            r.employee_id.toLowerCase().includes(filters.searchTerm.toLowerCase())
        )

        setStaffAbsentRecords(searched)
      }
    } catch (error: any) {
      console.error("Error loading absent records:", error)
      const errorMessage = error?.message || "Failed to load absent records. Please check your database connection."
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    loadAbsentRecords()
  }, [loadAbsentRecords])

  // Get top absent students/staff
  const getTopAbsentStudents = () => {
    const records = filters.userType === "student" ? absentRecords : staffAbsentRecords
    return [...records].sort((a, b) => b.total_absent_days - a.total_absent_days).slice(0, 10)
  }

  const stats = {
    totalAbsent: filters.userType === "student" ? absentRecords.length : staffAbsentRecords.length,
    totalAbsentDays:
      (filters.userType === "student" ? absentRecords : staffAbsentRecords).reduce(
        (sum, r) => sum + r.total_absent_days,
        0
      ) || 0,
    avgAbsentDays:
      ((filters.userType === "student" ? absentRecords : staffAbsentRecords).reduce(
        (sum, r) => sum + r.total_absent_days,
        0
      ) /
        ((filters.userType === "student" ? absentRecords.length : staffAbsentRecords.length) || 1)) || 0,
    maxAbsentDays: Math.max(
      ...(filters.userType === "student" ? absentRecords : staffAbsentRecords).map((r) => r.total_absent_days),
      0
    ),
  }

  const exportToCSV = () => {
    const records = filters.userType === "student" ? absentRecords : staffAbsentRecords
    let csvContent = ""

    if (filters.userType === "student") {
      csvContent = [
        ["Student Name", "Admission No", "Class", "Section", "Absent Days", "Father's Name", "Contact"],
        ...(records as AbsentRecord[]).map((r) => [
          r.student_name,
          r.admission_no,
          r.class_name,
          r.section_name,
          r.total_absent_days,
          r.father_name,
          r.contact,
        ]),
      ]
        .map((row) => row.join(","))
        .join("\n")
    } else {
      csvContent = [
        ["Staff Name", "Employee ID", "Designation", "Absent Days", "Phone"],
        ...(records as StaffAbsentRecord[]).map((r) => [
          r.staff_name,
          r.employee_id,
          r.designation,
          r.total_absent_days,
          r.phone,
        ]),
      ]
        .map((row) => row.join(","))
        .join("\n")
    }

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `absent_summary_${filters.userType}_${filters.startDate}_to_${filters.endDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Report exported successfully")
  }

  const handlePrint = () => {
    const printWindow = window.open("", "_blank")
    if (!printWindow) return

    const records = filters.userType === "student" ? absentRecords : staffAbsentRecords

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Absent Summary Report - ${filters.userType === "student" ? "Students" : "Staff"}</title>
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
        ${getSchoolPrintHeader(schoolInfo, `${filters.userType === "student" ? "Student" : "Staff"} Absent Summary Report`)}
        <p style="text-align:center">Period: ${filters.startDate} to ${filters.endDate}</p>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>${filters.userType === "student" ? "Admission No" : "Employee ID"}</th>
              <th>${filters.userType === "student" ? "Class" : "Designation"}</th>
              <th>Absent Days</th>
            </tr>
          </thead>
          <tbody>
            ${records
              .map(
                (r, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${filters.userType === "student" ? (r as AbsentRecord).student_name : (r as StaffAbsentRecord).staff_name}</td>
                <td>${filters.userType === "student" ? (r as AbsentRecord).admission_no : (r as StaffAbsentRecord).employee_id}</td>
                <td>${filters.userType === "student" ? (r as AbsentRecord).class_name : (r as StaffAbsentRecord).designation}</td>
                <td>${r.total_absent_days}</td>
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
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-gradient-to-r from-red-600 to-rose-700 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild className="bg-white/20 hover:bg-white/30 text-white rounded-xl">
              <Link href="/attendance/reports">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
                <XCircle className="h-7 w-7" />
                Absent Summary Report
              </h1>
              <p className="text-red-100 text-sm">Track and analyze absenteeism patterns</p>
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
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
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
                  <p className="text-xs opacity-75">Total Absent</p>
                  <p className="text-2xl font-bold">{stats.totalAbsent}</p>
                </div>
                <UserX className="h-8 w-8 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
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
          <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs opacity-75">Avg Absent Days</p>
                  <p className="text-2xl font-bold">{stats.avgAbsentDays.toFixed(1)}</p>
                </div>
                <TrendingDown className="h-8 w-8 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs opacity-75">Max Absent Days</p>
                  <p className="text-2xl font-bold">{stats.maxAbsentDays}</p>
                </div>
                <BarChart3 className="h-8 w-8 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Absent List */}
        <Card className="border-0 shadow-md">
          <CardHeader className="bg-slate-50 dark:bg-slate-700 rounded-t-2xl">
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-500" />
              Top {filters.userType === "student" ? "Students" : "Staff"} by Absent Days
            </CardTitle>
            <CardDescription>Most frequent absentees</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {getTopAbsentStudents().map((item, idx) => (
                <div key={item.id} className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center font-bold text-red-600">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800 dark:text-white">
                        {filters.userType === "student" ? (item as AbsentRecord).student_name : (item as StaffAbsentRecord).staff_name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {filters.userType === "student" ? (item as AbsentRecord).class_name : (item as StaffAbsentRecord).designation}
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300">
                    {item.total_absent_days} days absent
                  </Badge>
                </div>
              ))}
              {getTopAbsentStudents().length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <AlertCircle className="h-12 w-12 mb-3" />
                  <p>No absent records found</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Detailed Records Table */}
        <Card className="border-0 shadow-md">
          <CardHeader className="bg-slate-50 dark:bg-slate-700 rounded-t-2xl">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-red-500" />
              Detailed Absent Summary
            </CardTitle>
            <CardDescription>
              {filters.userType === "student" ? absentRecords.length : staffAbsentRecords.length} {filters.userType === "student" ? "students" : "staff"} with absences
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="h-10 w-10 animate-spin text-red-600 mb-3" />
                <p className="text-slate-500">Loading records...</p>
              </div>
            ) : (
              <div className="min-w-[800px]">
                <div className="grid grid-cols-12 gap-2 px-4 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase tracking-wider bg-slate-50 dark:bg-slate-700 border-b">
                  <div className="col-span-1">#</div>
                  <div className="col-span-3">Name</div>
                  <div className="col-span-2">ID</div>
                  <div className="col-span-3">Class/Designation</div>
                  <div className="col-span-2">Absent Days</div>
                  <div className="col-span-1">Contact</div>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                  {(filters.userType === "student" ? absentRecords : staffAbsentRecords).map((record, idx) => (
                    <div
                      key={record.id}
                      className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-slate-50 dark:hover:bg-slate-700/50"
                    >
                      <div className="col-span-1">
                        <span className="font-mono text-xs text-slate-500">{idx + 1}</span>
                      </div>
                      <div className="col-span-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={record.photo_url} />
                            <AvatarFallback className="text-xs bg-red-100 text-red-700">
                              {filters.userType === "student"
                                ? (record as AbsentRecord).student_name?.charAt(0) || "S"
                                : (record as StaffAbsentRecord).staff_name?.charAt(0) || "T"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-slate-800 dark:text-white">
                            {filters.userType === "student"
                              ? (record as AbsentRecord).student_name
                              : (record as StaffAbsentRecord).staff_name}
                          </span>
                        </div>
                      </div>
                      <div className="col-span-2">
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                          {filters.userType === "student"
                            ? (record as AbsentRecord).admission_no
                            : (record as StaffAbsentRecord).employee_id}
                        </span>
                      </div>
                      <div className="col-span-3">
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                          {filters.userType === "student"
                            ? `${(record as AbsentRecord).class_name} - ${(record as AbsentRecord).section_name}`
                            : (record as StaffAbsentRecord).designation}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <Badge className="bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300">
                          {record.total_absent_days} days
                        </Badge>
                      </div>
                      <div className="col-span-1">
                        <span className="text-xs text-slate-500">
                          {filters.userType === "student"
                            ? (record as AbsentRecord).contact
                            : (record as StaffAbsentRecord).phone}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                {(filters.userType === "student" ? absentRecords : staffAbsentRecords).length === 0 && !loading && (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <AlertCircle className="h-12 w-12 mb-3" />
                    <p>No absent records found for the selected criteria</p>
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
