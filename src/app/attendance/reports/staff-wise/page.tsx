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
  UserCog,
  Trophy,
  Medal,
  Briefcase,
  Phone,
  Mail,
  Camera,
  User,
  CalendarDays,
  Eye
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { format, subMonths, addMonths, eachDayOfInterval, startOfMonth, endOfMonth } from "date-fns"
import { toast } from "sonner"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import Link from "next/link"

const supabase = createClient()

interface StaffMember {
  id: string
  name: string
  employee_id: string
  designation: string
  role: string
  department?: string
  phone?: string
  email?: string
  joining_date?: string
  photo_url?: string
}

interface StaffAttendanceDetail {
  id: string
  name: string
  employee_id: string
  designation: string
  department: string
  phone?: string
  email?: string
  photo_url?: string
  dailyStatus: Record<string, string>
  present: number
  absent: number
  late: number
  total: number
  percentage: number
}

interface StaffWiseStats {
  totalStaff: number
  totalPresent: number
  totalAbsent: number
  totalLate: number
  avgAttendance: number
  topPerformers: { name: string; percentage: number; designation: string; photo_url?: string }[]
  lowPerformers: { name: string; percentage: number; designation: string; photo_url?: string }[]
  departmentStats: { name: string; count: number; percentage: number }[]
}

interface SchoolInfo {
  school_name: string
  school_address: string
  school_phone: string
  school_email?: string
  school_logo?: string
}

const fmtDate = (d: Date) => format(d, "dd MMMM yyyy")
const fmtMonthYear = (d: Date) => format(d, "MMMM yyyy")

// Sample staff data with photos for demo
const sampleStaffData: StaffMember[] = [
  { id: "1", name: "Rahim Uddin", employee_id: "EMP-001", designation: "Head Teacher", role: "teacher", department: "Academic", phone: "+8801712345678", email: "rahim@school.com", photo_url: "/avatars/avatar-1.png" },
  { id: "2", name: "Fatema Begum", employee_id: "EMP-002", designation: "Class Teacher", role: "teacher", department: "Academic", phone: "+8801712345679", email: "fatema@school.com", photo_url: "/avatars/avatar-2.png" },
  { id: "3", name: "Karim Ahmed", employee_id: "EMP-003", designation: "Admin Staff", role: "admin", department: "Administration", phone: "+8801712345680", email: "karim@school.com", photo_url: "/avatars/avatar-3.png" },
  { id: "4", name: "Nusrat Jahan", employee_id: "EMP-004", designation: "Support Staff", role: "support", department: "Support", phone: "+8801712345681", email: "nusrat@school.com", photo_url: "/avatars/avatar-4.png" },
  { id: "5", name: "Hassan Ali", employee_id: "EMP-005", designation: "Class Teacher", role: "teacher", department: "Academic", phone: "+8801712345682", email: "hassan@school.com", photo_url: "/avatars/avatar-5.png" },
  { id: "6", name: "Shahinur Rahman", employee_id: "EMP-006", designation: "Accounts Officer", role: "accounts", department: "Finance", phone: "+8801712345683", email: "shahinur@school.com", photo_url: "/avatars/avatar-6.png" },
  { id: "7", name: "Morsheda Akter", employee_id: "EMP-007", designation: "Librarian", role: "library", department: "Library", phone: "+8801712345684", email: "morsheda@school.com", photo_url: "/avatars/avatar-7.png" },
]

export default function StaffWiseAttendancePage() {
  const [reportType, setReportType] = useState<"daily" | "monthly">("daily")
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [selectedMonth, setSelectedMonth] = useState(new Date())
  const [selectedDepartment, setSelectedDepartment] = useState("all")
  const [selectedRole, setSelectedRole] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [activeTab, setActiveTab] = useState("summary")
  const [selectedStaff, setSelectedStaff] = useState<StaffAttendanceDetail | null>(null)
  const [showDetailDialog, setShowDetailDialog] = useState(false)
  
  const [staffData, setStaffData] = useState<StaffMember[]>([])
  const [reportData, setReportData] = useState<StaffAttendanceDetail[]>([])
  const [monthDays, setMonthDays] = useState<Date[]>([])
  const [departments, setDepartments] = useState<string[]>([])
  const [roles, setRoles] = useState<string[]>([])
  const [stats, setStats] = useState<StaffWiseStats>({
    totalStaff: 0,
    totalPresent: 0,
    totalAbsent: 0,
    totalLate: 0,
    avgAttendance: 0,
    topPerformers: [],
    lowPerformers: [],
    departmentStats: []
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

  // Generate month days for monthly report
  useEffect(() => {
    if (reportType === "monthly") {
      const start = startOfMonth(selectedMonth)
      const end = endOfMonth(selectedMonth)
      const days = eachDayOfInterval({ start, end })
      setMonthDays(days)
    }
  }, [selectedMonth, reportType])

  // Fetch staff data with error handling
  const fetchStaff = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("staff")
        .select("*")
        .eq("status", "active")
        .order("name")
      
      if (error) {
        console.warn("Staff table not found or error, using sample data:", error.message)
        setStaffData(sampleStaffData)
        const uniqueDepts = [...new Set(sampleStaffData.map(s => s.department).filter(Boolean))] as string[]
        const uniqueRoles = [...new Set(sampleStaffData.map(s => s.role).filter(Boolean))] as string[]
        setDepartments(uniqueDepts)
        setRoles(uniqueRoles)
        return
      }
      
      if (data && data.length > 0) {
        setStaffData(data)
        const uniqueDepts = [...new Set(data.map(s => s.department).filter(Boolean))] as string[]
        const uniqueRoles = [...new Set(data.map(s => s.role).filter(Boolean))] as string[]
        setDepartments(uniqueDepts)
        setRoles(uniqueRoles)
      } else {
        setStaffData(sampleStaffData)
        const uniqueDepts = [...new Set(sampleStaffData.map(s => s.department).filter(Boolean))] as string[]
        const uniqueRoles = [...new Set(sampleStaffData.map(s => s.role).filter(Boolean))] as string[]
        setDepartments(uniqueDepts)
        setRoles(uniqueRoles)
      }
    } catch (error) {
      console.error("Error fetching staff:", error)
      setStaffData(sampleStaffData)
      const uniqueDepts = [...new Set(sampleStaffData.map(s => s.department).filter(Boolean))] as string[]
      const uniqueRoles = [...new Set(sampleStaffData.map(s => s.role).filter(Boolean))] as string[]
      setDepartments(uniqueDepts)
      setRoles(uniqueRoles)
    }
  }, [])

  useEffect(() => {
    fetchStaff()
  }, [fetchStaff])

  // Load report data
  const loadReport = useCallback(async () => {
    if (staffData.length === 0) return
    setLoading(true)
    try {
      let filteredStaff = [...staffData]
      
      if (selectedDepartment !== "all") {
        filteredStaff = filteredStaff.filter(s => s.department === selectedDepartment)
      }
      if (selectedRole !== "all") {
        filteredStaff = filteredStaff.filter(s => s.role === selectedRole)
      }
      
      if (filteredStaff.length === 0) {
        setReportData([])
        setStats({
          totalStaff: 0,
          totalPresent: 0,
          totalAbsent: 0,
          totalLate: 0,
          avgAttendance: 0,
          topPerformers: [],
          lowPerformers: [],
          departmentStats: []
        })
        setLoading(false)
        return
      }
      
      const staffIds = filteredStaff.map(s => s.id)
      
      if (reportType === "daily") {
        const dateStr = format(selectedDate, "yyyy-MM-dd")
        
        let attendanceData = null
        try {
          const { data } = await supabase
            .from("staff_attendance")
            .select("staff_id, status")
            .in("staff_id", staffIds)
            .eq("date", dateStr)
          attendanceData = data
        } catch (err) {
          console.warn("staff_attendance table may not exist:", err)
        }
        
        const attendanceMap: Record<string, string> = {}
        attendanceData?.forEach(a => {
          attendanceMap[a.staff_id] = a.status
        })
        
        let totalPresent = 0
        let totalAbsent = 0
        let totalLate = 0
        
        const staffReportData: StaffAttendanceDetail[] = filteredStaff.map(s => {
          const status = attendanceMap[s.id] || "absent"
          if (status === "present") totalPresent++
          else if (status === "absent") totalAbsent++
          else if (status === "late") totalLate++
          
          return {
            id: s.id,
            name: s.name,
            employee_id: s.employee_id,
            designation: s.designation || "Staff",
            department: s.department || "General",
            phone: s.phone,
            email: s.email,
            photo_url: s.photo_url,
            dailyStatus: {},
            present: status === "present" ? 1 : 0,
            absent: status === "absent" ? 1 : 0,
            late: status === "late" ? 1 : 0,
            total: 1,
            percentage: status === "present" || status === "late" ? 100 : 0
          }
        })
        
        const totalStaff = staffReportData.length
        const avgAttendance = totalStaff > 0 ? Math.round((totalPresent + totalLate) / totalStaff * 100) : 0
        
        const deptMap = new Map<string, { total: number; present: number }>()
        staffReportData.forEach(s => {
          const dept = s.department
          if (!deptMap.has(dept)) {
            deptMap.set(dept, { total: 0, present: 0 })
          }
          const deptStats = deptMap.get(dept)!
          deptStats.total++
          if (s.percentage >= 100) deptStats.present++
        })
        
        const departmentStats = Array.from(deptMap.entries()).map(([name, stats]) => ({
          name,
          count: stats.total,
          percentage: stats.total > 0 ? Math.round(stats.present / stats.total * 100) : 0
        }))
        
        const sorted = [...staffReportData].sort((a, b) => b.percentage - a.percentage)
        const topPerformers = sorted.slice(0, 5).map(s => ({ 
          name: s.name, 
          percentage: s.percentage, 
          designation: s.designation,
          photo_url: s.photo_url 
        }))
        const lowPerformers = sorted.slice(-5).reverse().map(s => ({ 
          name: s.name, 
          percentage: s.percentage, 
          designation: s.designation,
          photo_url: s.photo_url 
        }))
        
        setStats({
          totalStaff,
          totalPresent,
          totalAbsent,
          totalLate,
          avgAttendance,
          topPerformers,
          lowPerformers,
          departmentStats
        })
        
        setReportData(staffReportData)
        toast.success(`Daily staff report loaded for ${fmtDate(selectedDate)}`)
        
      } else {
        const startDate = format(startOfMonth(selectedMonth), "yyyy-MM-dd")
        const endDate = format(endOfMonth(selectedMonth), "yyyy-MM-dd")
        
        let attendanceData = null
        try {
          const { data } = await supabase
            .from("staff_attendance")
            .select("staff_id, status, date")
            .in("staff_id", staffIds)
            .gte("date", startDate)
            .lte("date", endDate)
          attendanceData = data
        } catch (err) {
          console.warn("staff_attendance table may not exist:", err)
        }
        
        const attendanceMap: Record<string, Record<string, string>> = {}
        filteredStaff.forEach(s => {
          attendanceMap[s.id] = {}
        })
        
        attendanceData?.forEach(a => {
          if (attendanceMap[a.staff_id]) {
            attendanceMap[a.staff_id][a.date] = a.status
          }
        })
        
        let totalPresent = 0
        let totalAbsent = 0
        let totalLate = 0
        
        const staffReportData: StaffAttendanceDetail[] = filteredStaff.map(s => {
          let present = 0
          let absent = 0
          let late = 0
          const dailyStatus: Record<string, string> = {}
          
          monthDays.forEach(day => {
            const dateStr = format(day, "yyyy-MM-dd")
            const status = attendanceMap[s.id]?.[dateStr] || "absent"
            dailyStatus[dateStr] = status
            if (status === "present") present++
            else if (status === "absent") absent++
            else if (status === "late") late++
          })
          
          const total = present + absent + late
          const percentage = total > 0 ? Math.round((present + late) / total * 100) : 0
          
          totalPresent += present
          totalAbsent += absent
          totalLate += late
          
          return {
            id: s.id,
            name: s.name,
            employee_id: s.employee_id,
            designation: s.designation || "Staff",
            department: s.department || "General",
            phone: s.phone,
            email: s.email,
            photo_url: s.photo_url,
            dailyStatus,
            present,
            absent,
            late,
            total,
            percentage
          }
        })
        
        const totalStaff = staffReportData.length
        const avgAttendance = totalStaff > 0 ? Math.round((totalPresent + totalLate) / (totalPresent + totalAbsent + totalLate) * 100) : 0
        
        const deptMap = new Map<string, { total: number; totalPercentage: number }>()
        staffReportData.forEach(s => {
          const dept = s.department
          if (!deptMap.has(dept)) {
            deptMap.set(dept, { total: 0, totalPercentage: 0 })
          }
          const deptStats = deptMap.get(dept)!
          deptStats.total++
          deptStats.totalPercentage += s.percentage
        })
        
        const departmentStats = Array.from(deptMap.entries()).map(([name, stats]) => ({
          name,
          count: stats.total,
          percentage: stats.total > 0 ? Math.round(stats.totalPercentage / stats.total) : 0
        }))
        
        const sorted = [...staffReportData].sort((a, b) => b.percentage - a.percentage)
        const topPerformers = sorted.slice(0, 5).map(s => ({ 
          name: s.name, 
          percentage: s.percentage, 
          designation: s.designation,
          photo_url: s.photo_url 
        }))
        const lowPerformers = sorted.slice(-5).reverse().map(s => ({ 
          name: s.name, 
          percentage: s.percentage, 
          designation: s.designation,
          photo_url: s.photo_url 
        }))
        
        setStats({
          totalStaff,
          totalPresent,
          totalAbsent,
          totalLate,
          avgAttendance,
          topPerformers,
          lowPerformers,
          departmentStats
        })
        
        setReportData(staffReportData)
        toast.success(`Monthly staff report loaded for ${fmtMonthYear(selectedMonth)}`)
      }
      
    } catch (error) {
      console.error("Error loading report:", error)
      toast.error("Failed to load report data")
    } finally {
      setLoading(false)
    }
  }, [reportType, selectedDate, selectedMonth, selectedDepartment, selectedRole, staffData, monthDays])

  useEffect(() => {
    if (staffData.length > 0) {
      loadReport()
    }
  }, [loadReport, staffData])

  const shiftDate = (days: number) => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + days)
    setSelectedDate(d)
  }

  const shiftMonth = (months: number) => {
    setSelectedMonth(prev => months > 0 ? addMonths(prev, months) : subMonths(prev, Math.abs(months)))
  }

  const clearFilters = () => {
    setSelectedDepartment("all")
    setSelectedRole("all")
    setSearchTerm("")
    toast.info("Filters cleared")
  }

  const filteredData = reportData.filter(s =>
    !searchTerm ||
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.employee_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.designation.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.department.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // PDF Generation
  const generatePDF = async () => {
    setPdfGen(true)
    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
      
      doc.setFontSize(20); doc.setFont("helvetica", "bold")
      doc.setTextColor(37, 99, 235)
      doc.text(schoolInfo.school_name, 148, 15, { align: "center" })
      
      doc.setFontSize(12); doc.setFont("helvetica", "normal"); doc.setTextColor(80, 80, 80)
      doc.text(`${reportType === "daily" ? "Daily" : "Monthly"} Staff-wise Attendance Report`, 148, 23, { align: "center" })
      
      doc.setFontSize(9)
      if (reportType === "daily") {
        doc.text(`Date: ${fmtDate(selectedDate)}`, 148, 31, { align: "center" })
      } else {
        doc.text(`Month: ${fmtMonthYear(selectedMonth)}`, 148, 31, { align: "center" })
      }
      doc.text(`Total Staff: ${stats.totalStaff} | Present: ${stats.totalPresent} | Absent: ${stats.totalAbsent} | Late: ${stats.totalLate} | Average: ${stats.avgAttendance}%`, 148, 39, { align: "center" })
      
      let tableHeaders: string[] = ["#", "ID", "Staff Name", "Designation", "Department", "Present", "Absent", "Late", "Total", "Attendance %"]
      let tableBody: any[] = []
      
      if (reportType === "monthly" && monthDays.length > 0 && monthDays.length <= 31) {
        const dayHeaders = monthDays.map(day => format(day, "dd"))
        tableHeaders = ["#", "ID", "Staff Name", "Designation", "Department", ...dayHeaders, "P", "A", "L", "Total", "%"]
        
        tableBody = filteredData.map((s, i) => {
          const dailyCells = monthDays.map(day => {
            const dateStr = format(day, "yyyy-MM-dd")
            const status = s.dailyStatus[dateStr] || "absent"
            if (status === "present") return "P"
            if (status === "late") return "L"
            return "A"
          })
          return [
            i + 1,
            s.employee_id,
            s.name,
            s.designation,
            s.department,
            ...dailyCells,
            s.present,
            s.absent,
            s.late,
            s.total,
            `${s.percentage}%`
          ]
        })
      } else {
        tableBody = filteredData.map((s, i) => [
          i + 1,
          s.employee_id,
          s.name,
          s.designation,
          s.department,
          s.present,
          s.absent,
          s.late,
          s.total,
          `${s.percentage}%`
        ])
      }
      
      autoTable(doc, {
        startY: 46,
        head: [tableHeaders],
        body: tableBody,
        theme: "grid",
        styles: { fontSize: reportType === "monthly" && monthDays.length > 0 && monthDays.length <= 31 ? 6.5 : 9, cellPadding: 2 },
        headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        didParseCell: (d) => {
          const lastColIndex = tableHeaders.length - 1
          if (d.section === "body" && d.column.index === lastColIndex) {
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
        doc.setPage(i); doc.setFontSize(7); doc.setTextColor(160, 160, 160)
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 205)
        doc.text(`Page ${i} of ${pages}`, 282, 205, { align: "right" })
        doc.text(schoolInfo.school_name, 148, 205, { align: "center" })
      }
      
      doc.save(`${reportType}-staff-wise-attendance-${reportType === "daily" ? format(selectedDate, "yyyy-MM-dd") : format(selectedMonth, "yyyy-MM")}.pdf`)
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
    let csvHeaders: string[] = ["ID", "Staff Name", "Designation", "Department", "Present", "Absent", "Late", "Total", "Attendance %"]
    let csvRows: any[] = []
    
    if (reportType === "monthly" && monthDays.length > 0 && monthDays.length <= 31) {
      const dayHeaders = monthDays.map(day => format(day, "dd/MM"))
      csvHeaders = ["ID", "Staff Name", "Designation", "Department", ...dayHeaders, "Present", "Absent", "Late", "Total", "Attendance %"]
      
      csvRows = filteredData.map(s => {
        const dailyCells = monthDays.map(day => {
          const dateStr = format(day, "yyyy-MM-dd")
          const status = s.dailyStatus[dateStr] || "absent"
          if (status === "present") return "P"
          if (status === "late") return "L"
          return "A"
        })
        return [
          s.employee_id,
          s.name,
          s.designation,
          s.department,
          ...dailyCells,
          s.present,
          s.absent,
          s.late,
          s.total,
          `${s.percentage}%`
        ]
      })
    } else {
      csvRows = filteredData.map(s => [
        s.employee_id,
        s.name,
        s.designation,
        s.department,
        s.present,
        s.absent,
        s.late,
        s.total,
        `${s.percentage}%`
      ])
    }
    
    const csvContent = [csvHeaders, ...csvRows].map(row => row.join(",")).join("\n")
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${reportType}-staff-wise-attendance-${reportType === "daily" ? format(selectedDate, "yyyy-MM-dd") : format(selectedMonth, "yyyy-MM")}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("CSV exported successfully")
  }

// Print Handler
   const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    
    const dayHeaders = reportType === "monthly" && monthDays.length > 0 && monthDays.length <= 31 ? monthDays.map(day => format(day, "dd")) : []
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${reportType === "daily" ? "Daily" : "Monthly"} Staff-wise Attendance Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 15px; font-size: ${reportType === "monthly" && dayHeaders.length > 0 ? '8px' : '11px'}; }
          .report-title { font-size: 16px; font-weight: bold; margin: 10px 0; text-align: center; }
          .stats { display: flex; gap: 10px; margin: 10px 0; flex-wrap: wrap; justify-content: center; }
          .stat-card { border: 1px solid #ddd; padding: 6px 12px; border-radius: 6px; text-align: center; min-width: 80px; }
          .stat-card .value { font-size: 16px; font-weight: bold; }
          .stat-card .label { font-size: 8px; color: #666; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th, td { border: 1px solid #ddd; padding: 4px 3px; text-align: center; }
          th { background: #f0f0f0; font-weight: bold; font-size: ${reportType === "monthly" && dayHeaders.length > 0 ? '7px' : '10px'}; }
          .text-left { text-align: left; }
          .high { color: #059669; font-weight: bold; }
          .medium { color: #d97706; font-weight: bold; }
          .low { color: #dc2626; font-weight: bold; }
          .present-cell { color: #059669; font-weight: bold; }
          .late-cell { color: #d97706; font-weight: bold; }
          .absent-cell { color: #dc2626; font-weight: bold; }
          .footer { margin-top: 15px; text-align: center; font-size: 8px; color: #666; border-top: 1px solid #ccc; padding-top: 8px; }
          @media print { button { display: none; } }
        </style>
      </head>
      <body>
        ${getSchoolPrintHeader(schoolInfo, reportType === "daily" ? "Daily Staff-wise Attendance Report" : "Monthly Staff-wise Attendance Report")}
        <div class="report-title">${reportType === "daily" ? "Daily" : "Monthly"} Staff-wise Attendance Report</div>
        <p style="text-align:center">${reportType === "daily" ? `Date: ${fmtDate(selectedDate)}` : `Month: ${fmtMonthYear(selectedMonth)}`}</p>
        
        <div class="stats">
          <div class="stat-card"><div class="value">${stats.totalStaff}</div><div class="label">Total Staff</div></div>
          <div class="stat-card"><div class="value" style="color:#059669">${stats.totalPresent}</div><div class="label">Present</div></div>
          <div class="stat-card"><div class="value" style="color:#dc2626">${stats.totalAbsent}</div><div class="label">Absent</div></div>
          <div class="stat-card"><div class="value" style="color:#d97706">${stats.totalLate}</div><div class="label">Late</div></div>
          <div class="stat-card"><div class="value">${stats.avgAttendance}%</div><div class="label">Average</div></div>
        </div>
        
        ${stats.topPerformers.length > 0 ? `
          <div class="stats" style="background:#fef3c7; padding:5px 10px; border-radius:10px;">
            <div style="font-size:12px;">🏆 Top Performers: ${stats.topPerformers.map(p => `${p.name} (${p.percentage}%)`).join(", ")}</div>
          </div>
        ` : ''}
        
        <table>
          <thead>
            <tr>
              <th>#</th><th>ID</th><th class="text-left">Staff Name</th><th>Designation</th><th>Department</th>
              ${dayHeaders.map(d => `<th>${d}</th>`).join('')}
              <th>P</th><th>A</th><th>L</th><th>Total</th><th>%</th>
            </tr>
          </thead>
          <tbody>
            ${filteredData.map((s, i) => {
              let percentClass = ""
              if (s.percentage >= 75) percentClass = "high"
              else if (s.percentage >= 50) percentClass = "medium"
              else percentClass = "low"
              
              let dailyCells = ''
              if (dayHeaders.length > 0) {
                dailyCells = monthDays.map(day => {
                  const dateStr = format(day, "yyyy-MM-dd")
                  const status = s.dailyStatus[dateStr] || "absent"
                  let statusClass = ""
                  let statusText = ""
                  if (status === "present") { statusClass = "present-cell"; statusText = "P" }
                  else if (status === "late") { statusClass = "late-cell"; statusText = "L" }
                  else { statusClass = "absent-cell"; statusText = "A" }
                  return `<td class="${statusClass}">${statusText}</td>`
                }).join('')
              }
              
              return `
                <tr>
                  <td>${i + 1}</td>
                  <td>${s.employee_id}</td>
                  <td class="text-left">${s.name}</td>
                  <td>${s.designation}</td>
                  <td>${s.department}</td>
                  ${dailyCells}
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
        <script>window.print(); setTimeout(() => window.close(), 1000);</script>
      </body>
      </html>
    `)
    printWindow.document.close()
  }

  // Chart data
  const chartData = filteredData.map(s => ({
    name: s.name,
    percentage: s.percentage,
    id: s.employee_id,
    photo_url: s.photo_url
  }))

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
              <h1 className="text-2xl md:text-3xl font-bold text-white">Staff-wise Attendance Report</h1>
              <p className="text-blue-100 text-sm">Track staff attendance performance</p>
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

        {/* Report Type Toggle */}
        <Card className="border-0 shadow-md bg-white dark:bg-slate-900">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                <Button
                  variant={reportType === "daily" ? "default" : "outline"}
                  onClick={() => setReportType("daily")}
                  className={`rounded-xl ${reportType === "daily" ? 'bg-blue-600' : 'dark:border-slate-700'}`}
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Daily Report
                </Button>
                <Button
                  variant={reportType === "monthly" ? "default" : "outline"}
                  onClick={() => setReportType("monthly")}
                  className={`rounded-xl ${reportType === "monthly" ? 'bg-blue-600' : 'dark:border-slate-700'}`}
                >
                  <CalendarDays className="h-4 w-4 mr-2" />
                  Monthly Report
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Date/Month Navigation */}
        <Card className="border-0 shadow-md bg-white dark:bg-slate-900">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              {reportType === "daily" ? (
                <>
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
                  <span className="text-slate-500 dark:text-slate-400 text-sm bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg">
                    {fmtDate(selectedDate)}
                  </span>
                </>
              ) : (
                <>
                  <Button variant="outline" size="icon" onClick={() => shiftMonth(-1)} className="rounded-xl dark:border-slate-700">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-4 py-1.5 rounded-xl">
                    <CalendarDays className="h-4 w-4 text-blue-500" />
                    <span className="text-base font-semibold text-slate-700 dark:text-slate-200">
                      {fmtMonthYear(selectedMonth)}
                    </span>
                  </div>
                  <Button variant="outline" size="icon" onClick={() => shiftMonth(1)} className="rounded-xl dark:border-slate-700">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" onClick={() => setSelectedMonth(new Date())} className="rounded-xl text-blue-600 border-blue-200 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400">
                    Current Month
                  </Button>
                  <span className="text-slate-500 dark:text-slate-400 text-sm bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg">
                    {monthDays.length} days
                  </span>
                </>
              )}
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
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1 block">Department</label>
                  <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                    <SelectTrigger className="rounded-xl bg-white dark:bg-slate-900 dark:border-slate-600 dark:text-white">
                      <SelectValue placeholder="All Departments" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-slate-800">
                      <SelectItem value="all" className="dark:text-white">All Departments</SelectItem>
                      {departments.map(d => <SelectItem key={d} value={d} className="dark:text-white">{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1 block">Role</label>
                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger className="rounded-xl bg-white dark:bg-slate-900 dark:border-slate-600 dark:text-white">
                      <SelectValue placeholder="All Roles" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-slate-800">
                      <SelectItem value="all" className="dark:text-white">All Roles</SelectItem>
                      {roles.map(r => <SelectItem key={r} value={r} className="dark:text-white">{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1 block">Search Staff</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input 
                      placeholder="Name, ID, designation, department..." 
                      value={searchTerm} 
                      onChange={e => setSearchTerm(e.target.value)} 
                      className="pl-9 rounded-xl bg-white dark:bg-slate-900 dark:border-slate-600 dark:text-white dark:placeholder:text-slate-500"
                    />
                  </div>
                </div>
              </div>
              {(selectedDepartment !== "all" || selectedRole !== "all" || searchTerm) && (
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
              <div><p className="text-xs opacity-75">Total Staff</p><p className="text-2xl font-bold">{stats.totalStaff}</p></div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
            <CardContent className="p-4">
              <div><p className="text-xs opacity-75">Present</p><p className="text-2xl font-bold">{stats.totalPresent}</p></div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-500 to-rose-600 text-white">
            <CardContent className="p-4">
              <div><p className="text-xs opacity-75">Absent</p><p className="text-2xl font-bold">{stats.totalAbsent}</p></div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
            <CardContent className="p-4">
              <div><p className="text-xs opacity-75">Late</p><p className="text-2xl font-bold">{stats.totalLate}</p></div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <CardContent className="p-4">
              <div><p className="text-xs opacity-75">Average</p><p className="text-2xl font-bold">{stats.avgAttendance}%</p></div>
            </CardContent>
          </Card>
        </div>

        {/* Department Stats */}
        {stats.departmentStats.length > 0 && (
          <Card className="border-0 shadow-md bg-white dark:bg-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-blue-600" />
                Department-wise Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {stats.departmentStats.map((dept, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                    <div>
                      <p className="font-medium text-slate-700 dark:text-slate-200">{dept.name}</p>
                      <p className="text-xs text-slate-500">{dept.count} staff</p>
                    </div>
                    <div className={`text-xl font-bold ${dept.percentage >= 75 ? 'text-emerald-600' : dept.percentage >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                      {dept.percentage}%
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top Performers Section with Photos */}
        {(stats.topPerformers.length > 0 || stats.lowPerformers.length > 0) && (
          <div className="grid gap-4 md:grid-cols-2">
            {stats.topPerformers.length > 0 && (
              <Card className="border-0 shadow-md bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="bg-amber-100 dark:bg-amber-900/50 p-2 rounded-full">
                      <Trophy className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <p className="font-semibold text-amber-700 dark:text-amber-400">🏆 Top Performers</p>
                  </div>
                  <div className="space-y-3">
                    {stats.topPerformers.map((p, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-amber-600 w-5">{idx + 1}.</span>
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={p.photo_url} alt={p.name} />
                            <AvatarFallback className="bg-amber-200 text-amber-800 text-xs">
                              {p.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{p.name}</p>
                            <p className="text-xs text-slate-500">{p.designation}</p>
                          </div>
                        </div>
                        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400">
                          {p.percentage}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            {stats.lowPerformers.length > 0 && (
              <Card className="border-0 shadow-md bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="bg-red-100 dark:bg-red-900/50 p-2 rounded-full">
                      <Medal className="h-5 w-5 text-red-600 dark:text-red-400" />
                    </div>
                    <p className="font-semibold text-red-700 dark:text-red-400">📊 Needs Improvement</p>
                  </div>
                  <div className="space-y-3">
                    {stats.lowPerformers.map((p, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-red-600 w-5">{idx + 1}.</span>
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={p.photo_url} alt={p.name} />
                            <AvatarFallback className="bg-red-200 text-red-800 text-xs">
                              {p.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{p.name}</p>
                            <p className="text-xs text-slate-500">{p.designation}</p>
                          </div>
                        </div>
                        <Badge className="bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400">
                          {p.percentage}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 rounded-xl bg-gray-100 dark:bg-gray-800 p-1">
            <TabsTrigger value="summary" className="rounded-lg">📊 Summary</TabsTrigger>
            <TabsTrigger value="detailed" className="rounded-lg">📋 Detailed</TabsTrigger>
          </TabsList>
          
          <TabsContent value="summary" className="mt-5">
            <Card className="border-0 shadow-md bg-white dark:bg-slate-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                  Staff Attendance Performance
                </CardTitle>
                <CardDescription>
                  {reportType === "daily" ? `Attendance for ${fmtDate(selectedDate)}` : `Monthly performance for ${fmtMonthYear(selectedMonth)}`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-96 overflow-y-auto pr-2">
                  <div className="space-y-3">
                    {chartData.slice(0, 50).map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <div className="flex items-center gap-2 w-40">
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={item.photo_url} alt={item.name} />
                            <AvatarFallback className="text-xs">
                              {item.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="text-sm font-medium truncate text-slate-700 dark:text-slate-300">
                            {item.name}
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="h-7 bg-slate-100 dark:bg-slate-700 rounded-lg overflow-hidden">
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
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            const staff = filteredData.find(s => s.name === item.name)
                            if (staff && reportType === "monthly") {
                              setSelectedStaff(staff)
                              setShowDetailDialog(true)
                            }
                          }}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="detailed" className="mt-5">
            <Card className="border-0 shadow-md bg-white dark:bg-slate-800">
              <CardHeader className="bg-slate-50 dark:bg-slate-700 rounded-t-2xl py-4 px-5">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-slate-700 dark:text-slate-100">
                      <UserCog className="h-5 w-5 text-blue-600" />
                      Staff-wise Attendance Details
                      <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border-0 ml-1">{filteredData.length} staff</Badge>
                    </CardTitle>
                    <CardDescription className="dark:text-slate-300">
                      {reportType === "daily" ? `Daily attendance for ${fmtDate(selectedDate)}` : `Monthly breakdown for ${fmtMonthYear(selectedMonth)}`}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                {loading ? (
                  <div className="flex justify-center py-16"><Loader2 className="h-10 w-10 animate-spin text-blue-600" /></div>
                ) : filteredData.length === 0 ? (
                  <div className="text-center py-16 text-slate-400"><AlertCircle className="h-14 w-14 mx-auto mb-3" /><p>No data found</p></div>
                ) : (
                  <div className="min-w-[800px]">
                    <div className="grid grid-cols-11 gap-2 px-4 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-700 border-b">
                      <div>#</div><div>Photo</div><div>ID</div><div>Staff Name</div><div>Designation</div><div>Dept</div>
                      <div className="text-center">P</div><div className="text-center">A</div><div className="text-center">L</div>
                      <div className="text-center">Total</div><div className="text-center">%</div>
                    </div>
                    <div className="divide-y">
                      {filteredData.map((staff, idx) => (
                        <div key={staff.id} className={`grid grid-cols-11 gap-2 px-4 py-2 items-center ${idx % 2 === 0 ? "bg-white dark:bg-slate-800" : "bg-slate-50/40 dark:bg-slate-700/30"}`}>
                          <div className="font-semibold text-slate-500">{idx+1}</div>
                          <div>
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={staff.photo_url} alt={staff.name} />
                              <AvatarFallback className="text-xs bg-blue-100 text-blue-800">
                                {staff.name.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                          </div>
                          <div className="font-mono text-sm text-slate-700 dark:text-slate-200">{staff.employee_id}</div>
                          <div className="font-medium text-slate-800 dark:text-white">{staff.name}</div>
                          <div className="text-xs text-slate-500">{staff.designation}</div>
                          <div className="text-xs text-slate-500">{staff.department}</div>
                          <div className="text-center text-emerald-600 font-semibold">{staff.present}</div>
                          <div className="text-center text-red-600 font-semibold">{staff.absent}</div>
                          <div className="text-center text-amber-600 font-semibold">{staff.late}</div>
                          <div className="text-center font-semibold">{staff.total}</div>
                          <div className={`text-center text-sm font-bold ${staff.percentage >= 75 ? 'text-emerald-600' : staff.percentage >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                            {staff.percentage}%
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

      </div>

      {/* Staff Detail Dialog with Photo */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5 text-blue-600" />
              Staff Attendance Details
            </DialogTitle>
          </DialogHeader>
          {selectedStaff && (
            <div className="space-y-4">
              <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={selectedStaff.photo_url} alt={selectedStaff.name} />
                    <AvatarFallback className={`text-xl font-bold text-white ${selectedStaff.percentage >= 75 ? "bg-emerald-500" : selectedStaff.percentage >= 50 ? "bg-amber-500" : "bg-red-500"}`}>
                      {selectedStaff.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-lg font-bold">{selectedStaff.name}</h3>
                    <p className="text-sm text-slate-500">{selectedStaff.employee_id} · {selectedStaff.designation}</p>
                    <p className="text-sm text-slate-500">Department: {selectedStaff.department}</p>
                    {selectedStaff.phone && <p className="text-xs text-slate-400 mt-1 flex items-center gap-1"><Phone className="h-3 w-3" /> {selectedStaff.phone}</p>}
                    {selectedStaff.email && <p className="text-xs text-slate-400 flex items-center gap-1"><Mail className="h-3 w-3" /> {selectedStaff.email}</p>}
                  </div>
                  <div className="ml-auto text-right">
                    <p className={`text-2xl font-bold ${selectedStaff.percentage >= 75 ? "text-emerald-600" : selectedStaff.percentage >= 50 ? "text-amber-600" : "text-red-600"}`}>
                      {selectedStaff.percentage}%
                    </p>
                    <p className="text-xs text-slate-500">Overall Attendance</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
                  <p className="text-2xl font-bold text-emerald-600">{selectedStaff.present}</p>
                  <p className="text-xs text-slate-500">Present</p>
                </div>
                <div className="text-center p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
                  <p className="text-2xl font-bold text-red-600">{selectedStaff.absent}</p>
                  <p className="text-xs text-slate-500">Absent</p>
                </div>
                <div className="text-center p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                  <p className="text-2xl font-bold text-amber-600">{selectedStaff.late}</p>
                  <p className="text-xs text-slate-500">Late</p>
                </div>
              </div>
              {reportType === "monthly" && monthDays.length > 0 && (
                <div>
                  <p className="font-semibold text-slate-700 dark:text-slate-200 mb-3">Daily Attendance ({fmtMonthYear(selectedMonth)})</p>
                  <div className="grid grid-cols-7 gap-1">
                    {monthDays.map((day, idx) => {
                      const dateStr = format(day, "yyyy-MM-dd")
                      const status = selectedStaff.dailyStatus[dateStr] || "absent"
                      let statusColor = ""
                      let statusText = ""
                      if (status === "present") { statusColor = "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400"; statusText = "P" }
                      else if (status === "late") { statusColor = "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400"; statusText = "L" }
                      else { statusColor = "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400"; statusText = "A" }
                      return (
                        <div key={idx} className="text-center">
                          <div className={`p-1 rounded-lg text-xs font-semibold ${statusColor}`}>
                            {format(day, "dd")}
                            <div className="text-sm mt-1">{statusText}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </ResponsiveLayout>
  )
}
