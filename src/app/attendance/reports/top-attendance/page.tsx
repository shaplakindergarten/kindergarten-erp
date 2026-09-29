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
  Award,
  Star,
  Trophy,
  Medal,
  UserCheck,
  Clock,
  Crown,
  Mail,
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
import { getSchoolPrintHeader } from "@/components/print/SchoolPrintHeader"

const supabase = createClient()

interface TopAttendanceStudent {
  id: string
  name: string
  admission_no: string
  class_name: string
  section_name: string
  total_days: number
  present_days: number
  late_days: number
  percentage: number
  perfect_days: number
  photo_url?: string
  rank: number
}

interface FilterOptions {
  userType: "student" | "staff"
  period: "month" | "quarter" | "semester" | "year"
  classId: string
  sectionId: string
  limit: number
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

export default function TopAttendanceReportPage() {
  const [schoolInfo, setSchoolInfo] = useState({
    school_name: "",
    school_address: "",
    school_phone: "",
    school_email: "",
    school_logo: ""
  })
  const [filters, setFilters] = useState<FilterOptions>({
    userType: "student",
    period: "month",
    classId: "all",
    sectionId: "all",
    limit: 10,
    searchTerm: "",
  })
  const [topAttendance, setTopAttendance] = useState<TopAttendanceStudent[]>([])
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

  // Load top attendance data
  const loadTopAttendance = useCallback(async () => {
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

      // Get students with their class and section info
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
        setTopAttendance([])
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

      // Get attendance
      const { data: attendance, error: attendanceError } = await supabase
        .from("student_attendance")
        .select("student_id, status, date")
        .in("date", dateRange)
        .in("student_id", students.map(s => s.id))

      if (attendanceError) throw attendanceError

      // Calculate attendance for each student
      const attendanceMap = new Map<string, { present: number; late: number; absent: number; perfect: number }>()

      attendance?.forEach((att) => {
        const stats = attendanceMap.get(att.student_id) || { present: 0, late: 0, absent: 0, perfect: 0 }
        if (att.status === "present") {
          stats.present++
          stats.perfect++
        } else if (att.status === "late") {
          stats.late++
        } else {
          stats.absent++
        }
        attendanceMap.set(att.student_id, stats)
      })

      const topAttendanceData: TopAttendanceStudent[] = students
        .map((student) => {
          const stats = attendanceMap.get(student.id) || { present: 0, late: 0, absent: 0, perfect: 0 }
          const presentDays = stats.present + stats.late
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
            late_days: stats.late,
            percentage,
            perfect_days: stats.perfect,
            photo_url: student.photo_url || (student as any).student_photo_url,
            rank: 0,
          }
        })
        .filter((s) => s.percentage > 0)
        .sort((a, b) => b.percentage - a.percentage || b.perfect_days - a.perfect_days)
        .slice(0, filters.limit)
        .map((s, idx) => ({ ...s, rank: idx + 1 }))

      // Apply search filter
      let filtered = topAttendanceData
      if (filters.searchTerm) {
        filtered = filtered.filter(
          (s) =>
            s.name.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
            s.admission_no.toLowerCase().includes(filters.searchTerm.toLowerCase())
        )
      }

      setTopAttendance(filtered)
    } catch (error: any) {
      console.error("Error loading top attendance data:", error)
      toast.error(error?.message || "Failed to load data")
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    loadTopAttendance()
  }, [loadTopAttendance])

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-5 w-5 text-yellow-500" />
      case 2:
        return <Medal className="h-5 w-5 text-gray-400" />
      case 3:
        return <Medal className="h-5 w-5 text-amber-600" />
      default:
        return <Award className="h-5 w-5 text-blue-500" />
    }
  }

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300"
      case 2:
        return "bg-gray-100 text-gray-700 dark:bg-gray-900/50 dark:text-gray-300"
      case 3:
        return "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
      default:
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
    }
  }

  const getPeriodText = () => {
    switch (filters.period) {
      case "month": return "Last Month"
      case "quarter": return "Last Quarter"
      case "semester": return "Last 6 Months"
      case "year": return "Last Year"
      default: return "Selected Period"
    }
  }

  const exportToCSV = () => {
    const csvContent = [
      ["Rank", "Name", "Admission No", "Class", "Section", "Total Days", "Present", "Late", "Perfect Days", "Percentage"],
      ...topAttendance.map((s) => [
        s.rank,
        s.name,
        s.admission_no,
        s.class_name,
        s.section_name,
        s.total_days,
        s.present_days,
        s.late_days,
        s.perfect_days,
        s.percentage.toFixed(2) + "%",
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `top_attendance_${filters.period}_top_${filters.limit}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Report exported successfully")
  }

// Print Certificates Function
  const handlePrintCertificates = () => {
    if (topAttendance.length === 0) {
      toast.error("No data available to generate certificates")
      return
    }

    const printWindow = window.open("", "_blank")
    if (!printWindow) return

    const periodText = getPeriodText()
    const currentDate = format(new Date(), "dd MMMM yyyy")

    let certificatesHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Attendance Certificates - ${schoolInfo.school_name}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Segoe UI', 'Georgia', 'Times New Roman', serif;
            background: #f0f0f0;
            padding: 20px;
          }
          
          .certificate-container {
            max-width: 800px;
            margin: 0 auto;
          }
          
          .certificate {
            background: white;
            margin-bottom: 30px;
            padding: 40px;
            border: 2px solid #fbbf24;
            border-radius: 20px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            position: relative;
            page-break-after: always;
            break-inside: avoid;
          }
          
          .certificate:last-child {
            page-break-after: auto;
          }
          
          .border-decoration {
            position: absolute;
            top: 20px;
            left: 20px;
            right: 20px;
            bottom: 20px;
            border: 1px solid #fcd34d;
            border-radius: 15px;
            pointer-events: none;
          }
          
          .certificate-title {
            text-align: center;
            font-size: 36px;
            font-weight: bold;
            color: #d97706;
            margin: 20px 0;
            text-transform: uppercase;
            letter-spacing: 4px;
          }
          
          .award-icon {
            text-align: center;
            font-size: 48px;
            margin: 20px 0;
          }
          
          .presented-to {
            text-align: center;
            font-size: 18px;
            color: #4b5563;
            margin: 20px 0 10px;
          }
          
          .student-name {
            text-align: center;
            font-size: 42px;
            font-weight: bold;
            color: #1e3a8a;
            margin: 20px 0;
            font-family: 'Georgia', serif;
            border-bottom: 2px solid #fbbf24;
            display: inline-block;
            width: auto;
            padding-bottom: 10px;
          }
          
          .student-details {
            text-align: center;
            font-size: 18px;
            color: #4b5563;
            margin: 20px 0;
          }
          
          .achievement-text {
            text-align: center;
            font-size: 20px;
            color: #374151;
            margin: 30px 0;
            line-height: 1.6;
          }
          
          .percentage-highlight {
            font-size: 28px;
            font-weight: bold;
            color: #10b981;
          }
          
          .rank-badge {
            text-align: center;
            margin: 20px 0;
          }
          
          .rank-circle {
            display: inline-block;
            width: 80px;
            height: 80px;
            border-radius: 50%;
            background: linear-gradient(135deg, #fbbf24, #d97706);
            color: white;
            font-size: 36px;
            font-weight: bold;
            line-height: 80px;
            text-align: center;
          }
          
          .signature-section {
            margin-top: 50px;
            display: flex;
            justify-content: space-between;
            padding-top: 30px;
            border-top: 1px solid #e5e7eb;
          }
          
          .signature {
            text-align: center;
          }
          
          .signature-line {
            width: 200px;
            border-top: 1px solid #000;
            margin-bottom: 5px;
          }
          
          .signature-label {
            font-size: 12px;
            color: #6b7280;
          }
          
          .date {
            text-align: center;
            margin-top: 20px;
            font-size: 14px;
            color: #6b7280;
          }
          
          .footer {
            text-align: center;
            margin-top: 20px;
            font-size: 10px;
            color: #9ca3af;
          }
          
          @media print {
            body {
              background: white;
              padding: 0;
              margin: 0;
            }
            .certificate {
              box-shadow: none;
              margin: 0;
              page-break-after: always;
            }
            .certificate:last-child {
              page-break-after: auto;
            }
          }
        </style>
      </head>
      <body>
        <div class="certificate-container">
    `

    topAttendance.forEach((student) => {
      const rankText = student.rank === 1 ? "1st" : student.rank === 2 ? "2nd" : student.rank === 3 ? "3rd" : `${student.rank}th`
      
      certificatesHtml += `
        <div class="certificate">
          <div class="border-decoration"></div>
          ${getSchoolPrintHeader(schoolInfo, "Certificate of Excellence")}
          <div class="award-icon">🏆</div>
          <div class="presented-to">This certificate is proudly presented to</div>
          <div style="text-align: center;">
            <div class="student-name">${student.name}</div>
          </div>
          <div class="student-details">
            ${student.class_name} - ${student.section_name} | Admission No: ${student.admission_no}
          </div>
          <div class="achievement-text">
            for achieving <span class="percentage-highlight">${student.percentage.toFixed(1)}%</span> attendance<br>
            during the period of <strong>${periodText}</strong><br>
            ranking <strong>${rankText}</strong> among top performers
          </div>
          <div class="rank-badge">
            <div class="rank-circle">#${student.rank}</div>
          </div>
          <div class="signature-section">
            <div class="signature">
              <div class="signature-line"></div>
              <div class="signature-label">Principal</div>
            </div>
            <div class="signature">
              <div class="signature-line"></div>
              <div class="signature-label">Class Teacher</div>
            </div>
            <div class="signature">
              <div class="signature-line"></div>
              <div class="signature-label">Parent/Guardian</div>
            </div>
          </div>
          <div class="date">Date: ${currentDate}</div>
          <div class="footer">* This certificate is awarded for outstanding attendance performance</div>
        </div>
      `
    })

    certificatesHtml += `
        </div>
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() {
              window.close();
            }, 1000);
          };
        </script>
      </body>
      </html>
    `

    printWindow.document.write(certificatesHtml)
    printWindow.document.close()
  }

  // Email Recognition Function
  const handleEmailRecognition = () => {
    if (topAttendance.length === 0) {
      toast.error("No students selected for email recognition")
      return
    }

    // Create email content
    const recipientEmails = topAttendance.map(s => `${s.name} <${s.admission_no}@school.com>`).join(", ")
    
    toast.success(`Preparing email for ${topAttendance.length} recipients`, {
      description: "Email feature will be available soon",
    })
    
    // You can integrate with an email API here
    console.log("Email recipients:", topAttendance.map(s => ({ name: s.name, rank: s.rank, percentage: s.percentage })))
  }

// Publish Notice Function
   const handlePublishNotice = () => {
    if (topAttendance.length === 0) {
      toast.error("No data to publish")
      return
    }

    const noticeWindow = window.open("", "_blank")
    if (!noticeWindow) return

    const periodText = getPeriodText()
    const currentDate = format(new Date(), "dd MMMM yyyy")

    let topListHtml = ""
    topAttendance.forEach((student, idx) => {
      topListHtml += `
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${student.rank}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${student.name}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${student.class_name} - ${student.section_name}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${student.admission_no}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${student.percentage.toFixed(1)}%</td>
        </tr>
      `
    })

    noticeWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Notice Board - Top Attendance Performers</title>
        <style>
          * { font-family: 'Segoe UI', Arial, sans-serif; }
          body { margin: 20px; padding: 20px; background: #fefce8; }
          .notice {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border: 3px solid #fbbf24;
            border-radius: 15px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.1);
          }
          .notice-title { font-size: 28px; font-weight: bold; color: #d97706; margin: 10px 0; text-transform: uppercase; }
          .date { color: #666; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th { background-color: #fbbf24; border: 1px solid #ddd; padding: 10px; text-align: center; font-weight: bold; }
          td { border: 1px solid #ddd; padding: 8px; }
          .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="notice">
          ${getSchoolPrintHeader(schoolInfo, "NOTICE BOARD")}
          <h3 style="text-align: center; color: #1e3a8a;">Top Attendance Performers</h3>
          <p style="text-align: center;">Period: ${periodText}</p>
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Student Name</th>
                <th>Class</th>
                <th>Admission No</th>
                <th>Attendance %</th>
              </tr>
            </thead>
            <tbody>
              ${topListHtml}
            </tbody>
          </table>
          <p style="text-align: center; font-size: 16px; color: #10b981;">
            🎉 Congratulations to all the winners! Keep up the excellent attendance! 🎉
          </p>
          <div class="footer">
            Published on ${currentDate} | Principal's Office
          </div>
        </div>
        <script>window.print(); setTimeout(() => window.close(), 1000);<\/script>
      </body>
      </html>
    `)
    noticeWindow.document.close()
  }

  const stats = {
    averageTopPercentage: topAttendance.reduce((sum, s) => sum + s.percentage, 0) / (topAttendance.length || 1),
    perfectAttendanceCount: topAttendance.filter((s) => s.percentage === 100).length,
    totalPerfectDays: topAttendance.reduce((sum, s) => sum + s.perfect_days, 0),
    totalPresentDays: topAttendance.reduce((sum, s) => sum + s.present_days, 0),
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
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-gradient-to-r from-yellow-600 to-amber-700 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild className="bg-white/20 hover:bg-white/30 text-white rounded-xl">
              <Link href="/attendance/reports">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
                <Crown className="h-7 w-7" />
                Top Attendance Report
              </h1>
              <p className="text-yellow-100 text-sm">Recognize students with outstanding attendance</p>
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
            <Button onClick={handlePrintCertificates} className="bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-xl">
              <Printer className="h-4 w-4 mr-1" />
              Print Certificates
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
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1 block">Top Count</label>
                  <Input
                    type="number"
                    min="1"
                    max="50"
                    value={filters.limit}
                    onChange={(e) => setFilters((prev) => ({ ...prev, limit: parseInt(e.target.value) || 10 }))}
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
                      limit: 10,
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
          <Card className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs opacity-75">Top Performer Avg</p>
                  <p className="text-2xl font-bold">{stats.averageTopPercentage.toFixed(1)}%</p>
                </div>
                <TrendingUp className="h-8 w-8 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs opacity-75">Perfect Attendance</p>
                  <p className="text-2xl font-bold">{stats.perfectAttendanceCount}</p>
                </div>
                <Star className="h-8 w-8 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs opacity-75">Total Perfect Days</p>
                  <p className="text-2xl font-bold">{stats.totalPerfectDays}</p>
                </div>
                <UserCheck className="h-8 w-8 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs opacity-75">Total Present Days</p>
                  <p className="text-2xl font-bold">{stats.totalPresentDays}</p>
                </div>
                <Clock className="h-8 w-8 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Performers List */}
        <Card className="border-0 shadow-md">
          <CardHeader className="bg-slate-50 dark:bg-slate-700 rounded-t-2xl">
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Top {filters.limit} Attendance Performers
            </CardTitle>
            <CardDescription>Celebrating excellence in attendance</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="h-10 w-10 animate-spin text-yellow-600 mb-3" />
                <p className="text-slate-500">Loading data...</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {topAttendance.map((student) => (
                  <div key={student.id} className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full ${getRankColor(student.rank)} flex items-center justify-center font-bold`}>
                        {student.rank}
                      </div>
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={student.photo_url} />
                        <AvatarFallback className="bg-yellow-100 text-yellow-700 text-lg font-bold">
                          {student.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-slate-800 dark:text-white">{student.name}</p>
                          {getRankIcon(student.rank)}
                        </div>
                        <p className="text-xs text-slate-500">
                          {student.class_name} - {student.section_name} • {student.admission_no}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{student.percentage.toFixed(1)}%</p>
                      <p className="text-xs text-slate-500">
                        {student.present_days + student.late_days}/{student.total_days} days • {student.perfect_days} perfect
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {topAttendance.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <AlertCircle className="h-12 w-12 mb-3" />
                <p>No data found for the selected criteria</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Certificate Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-0 shadow-md bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-950/20 dark:to-amber-950/20">
            <CardContent className="p-4 text-center">
              <Trophy className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
              <h3 className="font-semibold">Download Certificates</h3>
              <p className="text-xs text-slate-500 mt-1">Generate attendance certificates for top performers</p>
              <Button variant="outline" size="sm" className="mt-3 rounded-xl" onClick={handlePrintCertificates}>
                <Download className="h-3 w-3 mr-1" />
                Generate
              </Button>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
            <CardContent className="p-4 text-center">
              <Mail className="h-8 w-8 text-blue-500 mx-auto mb-2" />
              <h3 className="font-semibold">Email Recognition</h3>
              <p className="text-xs text-slate-500 mt-1">Send congratulatory emails to parents</p>
              <Button variant="outline" size="sm" className="mt-3 rounded-xl" onClick={handleEmailRecognition}>
                <Mail className="h-3 w-3 mr-1" />
                Send
              </Button>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20">
            <CardContent className="p-4 text-center">
              <Star className="h-8 w-8 text-purple-500 mx-auto mb-2" />
              <h3 className="font-semibold">Announce Winners</h3>
              <p className="text-xs text-slate-500 mt-1">Publish on school notice board</p>
              <Button variant="outline" size="sm" className="mt-3 rounded-xl" onClick={handlePublishNotice}>
                <Printer className="h-3 w-3 mr-1" />
                Publish
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </ResponsiveLayout>
  )
}
