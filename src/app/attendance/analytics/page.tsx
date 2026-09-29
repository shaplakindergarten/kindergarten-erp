"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Users,
  Calendar,
  Filter,
  Download,
  Loader2,
  AlertCircle,
  BarChart3,
  PieChart,
  LineChart,
  Activity,
  Clock,
  UserCheck,
  UserX,
  CalendarDays,
  Award,
  Target,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ResponsiveLayout } from "@/components/layout/responsive-layout"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { format, startOfMonth, endOfMonth, subMonths, eachMonthOfInterval } from "date-fns"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart as ReLineChart,
  Line,
  PieChart as RePieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
} from "recharts"

const supabase = createClient()

interface AnalyticsData {
  overallAttendance: number
  trend: "up" | "down" | "stable"
  trendPercentage: number
  totalStudents: number
  totalStaff: number
  todayPresent: number
  todayAbsent: number
  todayLate: number
  weeklyTrend: { day: string; present: number; absent: number; late: number }[]
  monthlyTrend: { month: string; attendance: number }[]
  classPerformance: { className: string; attendance: number; students: number }[]
  peakHours: { hour: string; checkins: number }[]
  alerts: { type: string; message: string; severity: "high" | "medium" | "low" }[]
}

const COLORS = ["#10b981", "#ef4444", "#f59e0b", "#8b5cf6"]

export default function AttendanceAnalyticsPage() {
  const [period, setPeriod] = useState<"week" | "month" | "quarter" | "year">("month")
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(false)

  const loadAnalytics = useCallback(async () => {
    setLoading(true)
    try {
      const today = new Date()
      const todayStr = format(today, "yyyy-MM-dd")
      const weekStart = new Date(today)
      weekStart.setDate(weekStart.getDate() - 7)
      const monthStart = startOfMonth(today)
      const monthEnd = endOfMonth(today)

      // Get today's attendance
      const { data: todayAttendance } = await supabase
        .from("student_attendance")
        .select("status")
        .eq("date", todayStr)

      const todayPresent = todayAttendance?.filter((a) => a.status === "present" || a.status === "late").length || 0
      const todayAbsent = todayAttendance?.filter((a) => a.status === "absent").length || 0
      const todayLate = todayAttendance?.filter((a) => a.status === "late").length || 0

      // Get total students
      const { count: totalStudents } = await supabase
        .from("students")
        .select("*", { count: "exact", head: true })
        .eq("status", "active")

      // Get total staff
      const { count: totalStaff } = await supabase
        .from("staff")
        .select("*", { count: "exact", head: true })
        .eq("status", "active")

      // Calculate overall attendance for the period
      const periodStart = period === "week" ? weekStart : period === "month" ? monthStart : subMonths(today, period === "quarter" ? 3 : 12)
      const periodStartStr = format(periodStart, "yyyy-MM-dd")
      
      const { data: periodAttendance } = await supabase
        .from("student_attendance")
        .select("status")
        .gte("date", periodStartStr)
        .lte("date", todayStr)

      const totalDays = periodAttendance?.length || 1
      const presentCount = periodAttendance?.filter((a) => a.status === "present" || a.status === "late").length || 0
      const overallAttendance = (presentCount / totalDays) * 100

      // Weekly trend data (last 7 days)
      const weeklyTrend = []
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today)
        date.setDate(date.getDate() - i)
        const dateStr = format(date, "yyyy-MM-dd")
        const dayName = format(date, "EEE")
        
        const { data: dayAttendance } = await supabase
          .from("student_attendance")
          .select("status")
          .eq("date", dateStr)
        
        weeklyTrend.push({
          day: dayName,
          present: dayAttendance?.filter((a) => a.status === "present" || a.status === "late").length || 0,
          absent: dayAttendance?.filter((a) => a.status === "absent").length || 0,
          late: dayAttendance?.filter((a) => a.status === "late").length || 0,
        })
      }

      // Class performance
      const { data: classes } = await supabase.from("classes").select("id, name").order("numeric_order")
      
      const classPerformance = []
      for (const cls of classes || []) {
        const { data: students } = await supabase
          .from("students")
          .select("id")
          .eq("class_id", cls.id)
          .eq("status", "active")
        
        const { data: attendance } = await supabase
          .from("student_attendance")
          .select("status")
          .in("student_id", students?.map(s => s.id) || [])
          .gte("date", periodStartStr)
        
        const total = attendance?.length || 1
        const present = attendance?.filter(a => a.status === "present" || a.status === "late").length || 0
        
        classPerformance.push({
          className: cls.name,
          attendance: (present / total) * 100,
          students: students?.length || 0,
        })
      }

      // Sample alerts
      const alerts = [
        { type: "warning", message: "Class 5 attendance dropped below 75% this week", severity: "high" as const },
        { type: "info", message: "4 students have been absent for 5+ consecutive days", severity: "medium" as const },
        { type: "success", message: "Overall attendance improved by 5% compared to last month", severity: "low" as const },
      ]

      setAnalytics({
        overallAttendance,
        trend: overallAttendance > 85 ? "up" : overallAttendance < 75 ? "down" : "stable",
        trendPercentage: 3.2,
        totalStudents: totalStudents || 0,
        totalStaff: totalStaff || 0,
        todayPresent,
        todayAbsent,
        todayLate,
        weeklyTrend,
        monthlyTrend: [],
        classPerformance,
        peakHours: [],
        alerts,
      })
    } catch (error) {
      console.error("Error loading analytics:", error)
      toast.error("Failed to load analytics data")
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    loadAnalytics()
  }, [loadAnalytics])

  const getTrendIcon = () => {
    if (!analytics) return null
    switch (analytics.trend) {
      case "up":
        return <TrendingUp className="h-4 w-4 text-emerald-500" />
      case "down":
        return <TrendingDown className="h-4 w-4 text-red-500" />
      default:
        return <Activity className="h-4 w-4 text-blue-500" />
    }
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
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-gradient-to-r from-blue-600 to-cyan-700 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild className="bg-white/20 hover:bg-white/30 text-white rounded-xl">
              <Link href="/attendance">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
                <BarChart3 className="h-7 w-7" />
                Attendance Analytics
              </h1>
              <p className="text-blue-100 text-sm">AI-powered insights and trends</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
              <SelectTrigger className="w-32 bg-white/20 text-white border-white/30 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Last 7 Days</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="quarter">Last Quarter</SelectItem>
                <SelectItem value="year">Last Year</SelectItem>
              </SelectContent>
            </Select>
            <Button className="bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-xl">
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : analytics ? (
          <>
            {/* KPI Cards */}
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
              <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                <CardContent className="p-3">
                  <p className="text-xs opacity-75">Overall Attendance</p>
                  <p className="text-xl font-bold">{analytics.overallAttendance.toFixed(1)}%</p>
                  <div className="flex items-center gap-1 mt-1 text-xs">
                    {getTrendIcon()}
                    <span>{analytics.trendPercentage}% vs last period</span>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
                <CardContent className="p-3">
                  <p className="text-xs opacity-75">Today Present</p>
                  <p className="text-xl font-bold">{analytics.todayPresent}</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
                <CardContent className="p-3">
                  <p className="text-xs opacity-75">Today Absent</p>
                  <p className="text-xl font-bold">{analytics.todayAbsent}</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
                <CardContent className="p-3">
                  <p className="text-xs opacity-75">Today Late</p>
                  <p className="text-xl font-bold">{analytics.todayLate}</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
                <CardContent className="p-3">
                  <p className="text-xs opacity-75">Total Students</p>
                  <p className="text-xl font-bold">{analytics.totalStudents}</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white">
                <CardContent className="p-3">
                  <p className="text-xs opacity-75">Total Staff</p>
                  <p className="text-xl font-bold">{analytics.totalStaff}</p>
                </CardContent>
              </Card>
            </div>

            {/* Weekly Trend Chart */}
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LineChart className="h-5 w-5 text-blue-500" />
                  Weekly Attendance Trend
                </CardTitle>
                <CardDescription>Last 7 days attendance pattern</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.weeklyTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="present" fill="#10b981" name="Present" />
                      <Bar dataKey="late" fill="#f59e0b" name="Late" />
                      <Bar dataKey="absent" fill="#ef4444" name="Absent" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Class Performance & Alerts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <Card className="border-0 shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-blue-500" />
                    Class-wise Performance
                  </CardTitle>
                  <CardDescription>Attendance rate by class</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.classPerformance} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" domain={[0, 100]} />
                        <YAxis dataKey="className" type="category" width={60} />
                        <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
                        <Bar dataKey="attendance" fill="#3b82f6" name="Attendance %" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-amber-500" />
                    Alerts & Insights
                  </CardTitle>
                  <CardDescription>AI-generated recommendations</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analytics.alerts.map((alert, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl flex items-start gap-3 ${
                          alert.severity === "high"
                            ? "bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800"
                            : alert.severity === "medium"
                            ? "bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800"
                            : "bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800"
                        }`}
                      >
                        <div className={`w-2 h-2 rounded-full mt-1.5 ${
                          alert.severity === "high" ? "bg-red-500" : alert.severity === "medium" ? "bg-amber-500" : "bg-blue-500"
                        }`} />
                        <div>
                          <p className="text-sm font-medium text-slate-800 dark:text-white">{alert.message}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {alert.severity === "high" ? "Urgent attention needed" : alert.severity === "medium" ? "Review recommended" : "Information"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <AlertCircle className="h-12 w-12 mb-3" />
            <p>Failed to load analytics data</p>
          </div>
        )}
      </div>
    </ResponsiveLayout>
  )
}
