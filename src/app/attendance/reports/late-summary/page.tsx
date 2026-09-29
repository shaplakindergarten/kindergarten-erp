"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Clock,
  Users,
  Calendar,
  Filter,
  Download,
  Printer,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  TrendingUp,
  UserCheck,
  ClockAlert,
  BarChart3,
  ChevronDown,
  X,
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
import { format, startOfMonth, endOfMonth } from "date-fns"
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
  LineChart,
  Line,
} from "recharts"

const supabase = createClient()

interface LateRecord {
  id: string
  student_id: string
  student_name: string
  admission_no: string
  class_name: string
  section_name: string
  date: string
  status: string
  check_in: string
  late_minutes: number
  father_name: string
  contact: string
  photo_url?: string
}

interface StaffLateRecord {
  id: string
  staff_id: string
  staff_name: string
  employee_id: string
  designation: string
  date: string
  status: string
  check_in: string
  late_minutes: number
  phone: string
  photo_url?: string
}

interface FilterOptions {
  userType: "student" | "staff"
  startDate: string
  endDate: string
  classId: string
  sectionId: string
  minLateMinutes: number
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

export default function LateSummaryReportPage() {
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
    minLateMinutes: 0,
    searchTerm: "",
  })
  const [lateRecords, setLateRecords] = useState<LateRecord[]>([])
  const [staffLateRecords, setStaffLateRecords] = useState<StaffLateRecord[]>([])
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [sections, setSections] = useState<SectionItem[]>([])
  const [loading, setLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(true)
  const [chartType, setChartType] = useState<"bar" | "line" | "pie">("bar")

// Fetch school info from school_settings
   useEffect(() => {
     const fetchSchoolInfo = async () => {
       const { data, error } = await supabase
         .from("school_settings")
         .select("school_name, school_address, school_phone, school_email, school_logo")
         .single()
       
       if (error) {
         console.error("Error fetching school info:", error)
       } else if (data) {
         setSchoolInfo(data)
       }
     }
     
     fetchSchoolInfo()
   }, [])

  // Fetch classes
  useEffect(() => {
    const fetchClasses = async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("id, name")
        .order("numeric_order", { ascending: true })
      
      if (error) {
        console.error("Error fetching classes:", error)
      } else if (data) {
        setClasses(data)
      }
    }
    
    fetchClasses()
  }, [])

  // Fetch sections based on selected class
  useEffect(() => {
    const fetchSections = async () => {
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
    }
    
    fetchSections()
  }, [filters.classId])

  // Calculate late minutes based on check_in time
  const calculateLateMinutes = (checkInTime: string | null): number => {
    if (!checkInTime) return 0
    
    try {
      const [hours, minutes] = checkInTime.split(":").map(Number)
      if (isNaN(hours) || isNaN(minutes)) return 0
      
      const checkInMinutes = hours * 60 + minutes
      const lateThreshold = 8 * 60 + 15 // 8:15 AM
      
      if (checkInMinutes > lateThreshold) {
        return checkInMinutes - lateThreshold
      }
      return 0
    } catch (error) {
      return 0
    }
  }

  // Load late records
  const loadLateRecords = useCallback(async () => {
    setLoading(true)
    try {
      if (filters.userType === "student") {
        console.log("Fetching student late records...")
        
        // Step 1: Build query for students
        let studentsQuery = supabase
          .from("students")
          .select("*")
          .eq("status", "active")

        if (filters.classId !== "all") {
          studentsQuery = studentsQuery.eq("class_id", filters.classId)
        }
        if (filters.sectionId !== "all") {
          studentsQuery = studentsQuery.eq("section_id", filters.sectionId)
        }

        const { data: studentsData, error: studentsError } = await studentsQuery
        
        if (studentsError) {
          console.error("Students fetch error:", studentsError)
          throw studentsError
        }

        if (!studentsData || studentsData.length === 0) {
          console.log("No students found")
          setLateRecords([])
          setLoading(false)
          return
        }

        const studentIds = studentsData.map(s => s.id)
        console.log(`Found ${studentIds.length} students`)

        // Step 2: Get attendance records for these students
        const { data: attendanceData, error: attendanceError } = await supabase
          .from("student_attendance")
          .select("*")
          .in("student_id", studentIds)
          .gte("date", filters.startDate)
          .lte("date", filters.endDate)
          .eq("status", "late")

        if (attendanceError) {
          console.error("Attendance fetch error:", attendanceError)
          throw attendanceError
        }

        if (!attendanceData || attendanceData.length === 0) {
          console.log("No late attendance records found")
          setLateRecords([])
          setLoading(false)
          return
        }

        console.log(`Found ${attendanceData.length} late records`)

        // Step 3: Get class and section names
        const classIds = [...new Set(studentsData.map(s => s.class_id).filter(Boolean))]
        const sectionIds = [...new Set(studentsData.map(s => s.section_id).filter(Boolean))]
        
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

        // Transform data
        const records: LateRecord[] = attendanceData.map((item: any) => {
          const student = studentsData.find(s => s.id === item.student_id)
          const classInfo = classesData.find(c => c.id === student?.class_id)
          const sectionInfo = sectionsData.find(sec => sec.id === student?.section_id)
          
          const lateMinutes = calculateLateMinutes(item.check_in)

          return {
            id: item.id,
            student_id: item.student_id,
            student_name: student?.name || student?.student_name || "Unknown",
            admission_no: (student as any)?.student_id || "N/A",
            class_name: classInfo?.name || "N/A",
            section_name: sectionInfo?.name || "N/A",
            date: item.date,
            status: item.status,
            check_in: item.check_in || "--:--",
            late_minutes: lateMinutes,
            father_name: student?.father_name || student?.fathers_contact || "",
            contact: student?.fathers_contact || student?.contact || "",
            photo_url: student?.photo_url || (student as any)?.student_photo_url,
          }
        })

        // Filter by min late minutes
        const filtered = records.filter((r) => r.late_minutes >= filters.minLateMinutes)
        
        // Filter by search term
        const searched = filtered.filter(
          (r) =>
            !filters.searchTerm ||
            r.student_name.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
            r.admission_no.toLowerCase().includes(filters.searchTerm.toLowerCase())
        )

        console.log(`Filtered to ${searched.length} records`)
        setLateRecords(searched)
      } else {
        // Staff late records
        console.log("Fetching staff late records...")
        
        // Step 1: Get all staff
        const { data: staffData, error: staffError } = await supabase
          .from("staff")
          .select("*")
          .eq("status", "active")

        if (staffError) {
          console.error("Staff fetch error:", staffError)
          throw staffError
        }

        if (!staffData || staffData.length === 0) {
          console.log("No staff found")
          setStaffLateRecords([])
          setLoading(false)
          return
        }

        const staffIds = staffData.map(s => s.id)
        console.log(`Found ${staffIds.length} staff members`)

        // Step 2: Get attendance records
        const { data: attendanceData, error: attendanceError } = await supabase
          .from("staff_attendance")
          .select("*")
          .in("staff_id", staffIds)
          .gte("date", filters.startDate)
          .lte("date", filters.endDate)
          .eq("status", "late")

        if (attendanceError) {
          console.error("Staff attendance fetch error:", attendanceError)
          throw attendanceError
        }

        if (!attendanceData || attendanceData.length === 0) {
          console.log("No late staff records found")
          setStaffLateRecords([])
          setLoading(false)
          return
        }

        console.log(`Found ${attendanceData.length} late staff records`)

        const records: StaffLateRecord[] = attendanceData.map((item: any) => {
          const staff = staffData.find(s => s.id === item.staff_id)
          const lateMinutes = calculateLateMinutes(item.check_in)

          return {
            id: item.id,
            staff_id: item.staff_id,
            staff_name: staff?.name || "Unknown",
            employee_id: staff?.employee_id || "N/A",
            designation: staff?.designation || "Staff",
            date: item.date,
            status: item.status,
            check_in: item.check_in || "--:--",
            late_minutes: lateMinutes,
            phone: staff?.phone || staff?.contact || "",
            photo_url: staff?.photo_url,
          }
        })

        const filtered = records.filter((r) => r.late_minutes >= filters.minLateMinutes)
        const searched = filtered.filter(
          (r) =>
            !filters.searchTerm ||
            r.staff_name.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
            r.employee_id.toLowerCase().includes(filters.searchTerm.toLowerCase())
        )

        console.log(`Filtered to ${searched.length} records`)
        setStaffLateRecords(searched)
      }
    } catch (error) {
      console.error("Error loading late records:", error)
      toast.error("Failed to load late records. Please check your database connection.")
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    loadLateRecords()
  }, [loadLateRecords])

  // Chart data preparation
  const getDailyLateChartData = () => {
    const dateMap = new Map<string, number>()
    const records = filters.userType === "student" ? lateRecords : staffLateRecords

    records.forEach((record) => {
      const count = dateMap.get(record.date) || 0
      dateMap.set(record.date, count + 1)
    })

    return Array.from(dateMap.entries())
      .map(([date, count]) => ({ date: format(new Date(date), "dd MMM"), count }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }

  const getLateRangeChartData = () => {
    const ranges = [
      { label: "1-15 min", min: 1, max: 15, count: 0 },
      { label: "16-30 min", min: 16, max: 30, count: 0 },
      { label: "31-60 min", min: 31, max: 60, count: 0 },
      { label: "60+ min", min: 61, max: Infinity, count: 0 },
    ]

    const records = filters.userType === "student" ? lateRecords : staffLateRecords

    records.forEach((record) => {
      const range = ranges.find((r) => record.late_minutes >= r.min && record.late_minutes <= r.max)
      if (range) range.count++
    })

    return ranges.filter((r) => r.count > 0)
  }

  const getTopLateStudents = () => {
    const lateCountMap = new Map<string, { name: string; count: number; totalMinutes: number }>()
    const records = filters.userType === "student" ? lateRecords : staffLateRecords

    records.forEach((record) => {
      const id = filters.userType === "student" ? (record as LateRecord).student_id : (record as StaffLateRecord).staff_id
      const name = filters.userType === "student" ? (record as LateRecord).student_name : (record as StaffLateRecord).staff_name
      const existing = lateCountMap.get(id)
      if (existing) {
        existing.count++
        existing.totalMinutes += record.late_minutes
      } else {
        lateCountMap.set(id, { name, count: 1, totalMinutes: record.late_minutes })
      }
    })

    return Array.from(lateCountMap.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }

  const stats = {
    totalLate: filters.userType === "student" ? lateRecords.length : staffLateRecords.length,
    avgLateMinutes:
      (filters.userType === "student" ? lateRecords : staffLateRecords).reduce((sum, r) => sum + r.late_minutes, 0) /
        (filters.userType === "student" ? lateRecords.length || 1 : staffLateRecords.length || 1) || 0,
    maxLateMinutes: Math.max(
      ...(filters.userType === "student" ? lateRecords : staffLateRecords).map((r) => r.late_minutes),
      0
    ),
    uniqueLateCount: new Set(
      (filters.userType === "student" ? lateRecords : staffLateRecords).map((r) =>
        filters.userType === "student" ? (r as LateRecord).student_id : (r as StaffLateRecord).staff_id
      )
    ).size,
  }

  const exportToCSV = () => {
    const records = filters.userType === "student" ? lateRecords : staffLateRecords
    let csvContent = ""

    if (filters.userType === "student") {
      csvContent = [
        ["Date", "Student Name", "Admission No", "Class", "Section", "Check-In Time", "Late Minutes", "Father's Name", "Contact"],
        ...(records as LateRecord[]).map((r) => [
          r.date,
          r.student_name,
          r.admission_no,
          r.class_name,
          r.section_name,
          r.check_in,
          r.late_minutes,
          r.father_name,
          r.contact,
        ]),
      ]
        .map((row) => row.join(","))
        .join("\n")
    } else {
      csvContent = [
        ["Date", "Staff Name", "Employee ID", "Designation", "Check-In Time", "Late Minutes", "Phone"],
        ...(records as StaffLateRecord[]).map((r) => [
          r.date,
          r.staff_name,
          r.employee_id,
          r.designation,
          r.check_in,
          r.late_minutes,
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
    a.download = `late_summary_${filters.userType}_${filters.startDate}_to_${filters.endDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Report exported successfully")
  }

  const handlePrint = () => {
    const printWindow = window.open("", "_blank")
    if (!printWindow) return

    const records = filters.userType === "student" ? lateRecords : staffLateRecords

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Late Summary Report - ${filters.userType === "student" ? "Students" : "Staff"}</title>
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
        ${getSchoolPrintHeader(schoolInfo, `${filters.userType === "student" ? "Student" : "Staff"} Late Attendance Report`)}
        <p style="text-align:center">Period: ${filters.startDate} to ${filters.endDate}</p>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Date</th>
              <th>Name</th>
              <th>${filters.userType === "student" ? "Admission No" : "Employee ID"}</th>
              <th>Check-In</th>
              <th>Late Minutes</th>
            </tr>
          </thead>
          <tbody>
            ${records
              .map(
                (r, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${r.date}</td>
                <td>${filters.userType === "student" ? (r as LateRecord).student_name : (r as StaffLateRecord).staff_name}</td>
                <td>${filters.userType === "student" ? (r as LateRecord).admission_no : (r as StaffLateRecord).employee_id}</td>
                <td>${r.check_in}</td>
                <td>${r.late_minutes} min</td>
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

  const COLORS = ["#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#3b82f6", "#ec4899"]

  return (
    <ResponsiveLayout>
      <div className="space-y-5 p-4 md:p-6">
        {/* Header with School Name */}
        <div className="text-center mb-2">
          {schoolInfo.school_name && (
            <div className="text-xl md:text-2xl font-bold text-slate-800 dark:text-white">
              {schoolInfo.school_name}
            </div>
          )}
        </div>

        {/* Main Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-gradient-to-r from-amber-600 to-orange-700 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild className="bg-white/20 hover:bg-white/30 text-white rounded-xl">
              <Link href="/attendance/reports">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
                <ClockAlert className="h-7 w-7" />
                Late Summary Report
              </h1>
              <p className="text-amber-100 text-sm">Track and analyze late attendance patterns</p>
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

        {/* Rest of the component remains the same */}
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
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1 block">Min Late (mins)</label>
                  <Input
                    type="number"
                    min="0"
                    value={filters.minLateMinutes}
                    onChange={(e) => setFilters((prev) => ({ ...prev, minLateMinutes: parseInt(e.target.value) || 0 }))}
                    className="rounded-xl dark:bg-slate-900 dark:border-slate-600"
                  />
                </div>
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
                      minLateMinutes: 0,
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
          <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs opacity-75">Total Late</p>
                  <p className="text-2xl font-bold">{stats.totalLate}</p>
                </div>
                <ClockAlert className="h-8 w-8 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs opacity-75">Avg Late (mins)</p>
                  <p className="text-2xl font-bold">{Math.round(stats.avgLateMinutes)}</p>
                </div>
                <Clock className="h-8 w-8 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs opacity-75">Max Late (mins)</p>
                  <p className="text-2xl font-bold">{stats.maxLateMinutes}</p>
                </div>
                <TrendingUp className="h-8 w-8 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs opacity-75">Unique Late</p>
                  <p className="text-2xl font-bold">{stats.uniqueLateCount}</p>
                </div>
                <Users className="h-8 w-8 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Daily Late Chart */}
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-amber-500" />
                  Daily Late Trend
                </CardTitle>
                <Select value={chartType} onValueChange={(v) => setChartType(v as "bar" | "line" | "pie")}>
                  <SelectTrigger className="w-24 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bar">Bar</SelectItem>
                    <SelectItem value="line">Line</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <CardDescription>Number of late arrivals per day</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === "bar" ? (
                    <BarChart data={getDailyLateChartData()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="count" fill="#f59e0b" name="Late Count" />
                    </BarChart>
                  ) : (
                    <LineChart data={getDailyLateChartData()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="count" stroke="#f59e0b" name="Late Count" strokeWidth={2} />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Late Range Distribution */}
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <PieChart className="h-5 w-5 text-amber-500" />
                Late Duration Distribution
              </CardTitle>
              <CardDescription>Distribution of late minutes ranges</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={getLateRangeChartData()}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ label, percent }) => `${label}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {getLateRangeChartData().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Late List */}
        <Card className="border-0 shadow-md">
          <CardHeader className="bg-slate-50 dark:bg-slate-700 rounded-t-2xl">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-amber-500" />
              Top {filters.userType === "student" ? "Students" : "Staff"} by Late Count
            </CardTitle>
            <CardDescription>Most frequent late arrivals</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {getTopLateStudents().map((item, idx) => (
                <div key={item.id} className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center font-bold text-amber-600">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800 dark:text-white">{item.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{item.totalMinutes} total late minutes</p>
                    </div>
                  </div>
                  <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                    {item.count} times
                  </Badge>
                </div>
              ))}
              {getTopLateStudents().length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <AlertCircle className="h-12 w-12 mb-3" />
                  <p>No late records found</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Detailed Records Table */}
        <Card className="border-0 shadow-md">
          <CardHeader className="bg-slate-50 dark:bg-slate-700 rounded-t-2xl">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              Detailed Late Records
            </CardTitle>
            <CardDescription>
              {filters.userType === "student" ? lateRecords.length : staffLateRecords.length} records found
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="h-10 w-10 animate-spin text-amber-600 mb-3" />
                <p className="text-slate-500">Loading records...</p>
              </div>
            ) : (
              <div className="min-w-[800px]">
                <div className="grid grid-cols-12 gap-2 px-4 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase tracking-wider bg-slate-50 dark:bg-slate-700 border-b">
                  <div className="col-span-1">#</div>
                  <div className="col-span-2">Date</div>
                  <div className="col-span-3">Name</div>
                  <div className="col-span-2">ID</div>
                  <div className="col-span-2">Check-In</div>
                  <div className="col-span-2">Late (min)</div>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                  {(filters.userType === "student" ? lateRecords : staffLateRecords).map((record, idx) => (
                    <div
                      key={record.id}
                      className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-slate-50 dark:hover:bg-slate-700/50"
                    >
                      <div className="col-span-1">
                        <span className="font-mono text-xs text-slate-500">{idx + 1}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-sm text-slate-700 dark:text-slate-300">
                          {format(new Date(record.date), "dd MMM yyyy")}
                        </span>
                      </div>
                      <div className="col-span-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={record.photo_url} />
                            <AvatarFallback className="text-xs bg-amber-100 text-amber-700">
                              {filters.userType === "student"
                                ? (record as LateRecord).student_name?.charAt(0) || "S"
                                : (record as StaffLateRecord).staff_name?.charAt(0) || "T"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-slate-800 dark:text-white">
                            {filters.userType === "student"
                              ? (record as LateRecord).student_name
                              : (record as StaffLateRecord).staff_name}
                          </span>
                        </div>
                      </div>
                      <div className="col-span-2">
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                          {filters.userType === "student"
                            ? (record as LateRecord).admission_no
                            : (record as StaffLateRecord).employee_id}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <Badge variant="outline" className="text-amber-600 border-amber-200 dark:border-amber-800">
                          {record.check_in}
                        </Badge>
                      </div>
                      <div className="col-span-2">
                        <Badge className="bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300">
                          +{record.late_minutes} min
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
                {(filters.userType === "student" ? lateRecords : staffLateRecords).length === 0 && !loading && (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <AlertCircle className="h-12 w-12 mb-3" />
                    <p>No late records found for the selected criteria</p>
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
