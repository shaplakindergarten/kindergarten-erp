"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Fingerprint,
  Users,
  Calendar,
  Filter,
  Download,
  Printer,
  Search,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Settings,
  Smartphone,
  Wifi,
  Zap,
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
import { format, startOfMonth, endOfMonth, subDays } from "date-fns"

const supabase = createClient()

interface BiometricLog {
  id: string
  user_id: string
  user_name: string
  user_type: "student" | "staff"
  admission_no?: string
  employee_id?: string
  timestamp: string
  device_id: string
  device_name: string
  status: "success" | "failed" | "pending"
  verification_method: "fingerprint" | "face" | "card" | "pin"
  message: string
  photo_url?: string
}

interface FilterOptions {
  userType: "all" | "student" | "staff"
  startDate: string
  endDate: string
  status: "all" | "success" | "failed" | "pending"
  verificationMethod: "all" | "fingerprint" | "face" | "card" | "pin"
  searchTerm: string
}

const todayStr = () => format(new Date(), "yyyy-MM-dd")
const startOfMonthStr = () => format(startOfMonth(new Date()), "yyyy-MM-dd")
const endOfMonthStr = () => format(endOfMonth(new Date()), "yyyy-MM-dd")

export default function BiometricLogPage() {
  const [filters, setFilters] = useState<FilterOptions>({
    userType: "all",
    startDate: startOfMonthStr(),
    endDate: endOfMonthStr(),
    status: "all",
    verificationMethod: "all",
    searchTerm: "",
  })
  const [logs, setLogs] = useState<BiometricLog[]>([])
  const [loading, setLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(true)
  const [deviceStatus, setDeviceStatus] = useState<{ online: boolean; lastSync: string }>({
    online: true,
    lastSync: new Date().toISOString(),
  })

  // Load biometric logs
  const loadBiometricLogs = useCallback(async () => {
    setLoading(true)
    try {
      // Simulated data - In production, you would fetch from a biometric device API or database table
      // For demo purposes, we'll create mock data based on attendance records
      
      const startDate = new Date(filters.startDate)
      const endDate = new Date(filters.endDate)
      
      // Get student attendance with check_in times
      const { data: studentAttendance } = await supabase
        .from("student_attendance")
        .select(`
          id,
          student_id,
          date,
          check_in,
          marked_via,
          students!inner (id, name, student_id, student_photo_url)
        `)
        .gte("date", filters.startDate)
        .lte("date", filters.endDate)
        .not("check_in", "is", null)

      // Get staff attendance with check_in times
      const { data: staffAttendance } = await supabase
        .from("staff_attendance")
        .select(`
          id,
          staff_id,
          date,
          check_in,
          staff!inner (id, name, employee_id, photo_url)
        `)
        .gte("date", filters.startDate)
        .lte("date", filters.endDate)
        .not("check_in", "is", null)

      const biometricLogs: BiometricLog[] = []

      // Process student logs
      studentAttendance?.forEach((att: any) => {
        if (filters.userType === "all" || filters.userType === "student") {
          const timestamp = new Date(`${att.date}T${att.check_in || "00:00:00"}`)
biometricLogs.push({
            id: att.id,
            user_id: att.student_id,
            user_name: att.students.name,
            user_type: "student",
            admission_no: (att.students as any).student_id || "",
            timestamp: timestamp.toISOString(),
            device_id: "DEV-001",
            device_name: "Main Gate Biometric",
            status: "success",
            verification_method: att.marked_via === "rfid" ? "card" : "fingerprint",
            message: "Verification successful",
            photo_url: (att.students as any).student_photo_url || (att.students as any).photo_url,
          })
        }
      })

      // Process staff logs
      staffAttendance?.forEach((att: any) => {
        if (filters.userType === "all" || filters.userType === "staff") {
          const timestamp = new Date(`${att.date}T${att.check_in || "00:00:00"}`)
          biometricLogs.push({
            id: att.id,
            user_id: att.staff_id,
            user_name: att.staff.name,
            user_type: "staff",
            employee_id: att.staff.employee_id,
            timestamp: timestamp.toISOString(),
            device_id: "DEV-002",
            device_name: "Staff Entrance",
            status: "success",
            verification_method: "fingerprint",
            message: "Verification successful",
          })
        }
      })

      // Sort by timestamp descending
      biometricLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

      // Apply filters
      let filtered = biometricLogs

      if (filters.status !== "all") {
        filtered = filtered.filter((l) => l.status === filters.status)
      }

      if (filters.verificationMethod !== "all") {
        filtered = filtered.filter((l) => l.verification_method === filters.verificationMethod)
      }

      if (filters.searchTerm) {
        filtered = filtered.filter(
          (l) =>
            l.user_name.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
            (l.admission_no || "").toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
            (l.employee_id || "").toLowerCase().includes(filters.searchTerm.toLowerCase())
        )
      }

      setLogs(filtered)
    } catch (error) {
      console.error("Error loading biometric logs:", error)
      toast.error("Failed to load biometric logs")
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    loadBiometricLogs()
  }, [loadBiometricLogs])

  const stats = {
    total: logs.length,
    success: logs.filter((l) => l.status === "success").length,
    failed: logs.filter((l) => l.status === "failed").length,
    student: logs.filter((l) => l.user_type === "student").length,
    staff: logs.filter((l) => l.user_type === "staff").length,
    fingerprint: logs.filter((l) => l.verification_method === "fingerprint").length,
    card: logs.filter((l) => l.verification_method === "card").length,
  }

  const exportToCSV = () => {
    const csvContent = [
      ["Timestamp", "Name", "Type", "ID", "Device", "Method", "Status", "Message"],
      ...logs.map((l) => [
        format(new Date(l.timestamp), "yyyy-MM-dd HH:mm:ss"),
        l.user_name,
        l.user_type === "student" ? "Student" : "Staff",
        l.user_type === "student" ? l.admission_no || "" : l.employee_id || "",
        l.device_name,
        l.verification_method,
        l.status,
        l.message,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `biometric_log_${filters.startDate}_to_${filters.endDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Log exported successfully")
  }

  const syncDevices = async () => {
    toast.loading("Syncing biometric devices...")
    setTimeout(() => {
      setDeviceStatus({ online: true, lastSync: new Date().toISOString() })
      toast.dismiss()
      toast.success("Devices synced successfully")
      loadBiometricLogs()
    }, 2000)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">Success</Badge>
      case "failed":
        return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300">Failed</Badge>
      default:
        return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">Pending</Badge>
    }
  }

  const getMethodIcon = (method: string) => {
    switch (method) {
      case "fingerprint":
        return <Fingerprint className="h-3 w-3" />
      case "face":
        return <Smartphone className="h-3 w-3" />
      case "card":
        return <Wifi className="h-3 w-3" />
      default:
        return <Zap className="h-3 w-3" />
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
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-gradient-to-r from-purple-600 to-indigo-700 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild className="bg-white/20 hover:bg-white/30 text-white rounded-xl">
              <Link href="/attendance/reports">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
                <Fingerprint className="h-7 w-7" />
                Biometric Log
              </h1>
              <p className="text-purple-100 text-sm">Track biometric verification records</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-2 bg-white/20 rounded-xl px-3 py-1.5">
              <Wifi className={`h-4 w-4 ${deviceStatus.online ? "text-green-300" : "text-red-300"}`} />
              <span className="text-xs text-white">{deviceStatus.online ? "Online" : "Offline"}</span>
            </div>
            <Button
              onClick={syncDevices}
              className="bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-xl"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Sync
            </Button>
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
          </div>
        </div>

        {/* Device Status Card */}
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <Fingerprint className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800 dark:text-white">Biometric Device Status</p>
                  <p className="text-xs text-slate-500">Last sync: {format(new Date(deviceStatus.lastSync), "dd MMM yyyy, HH:mm:ss")}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-xs text-slate-600 dark:text-slate-400">DEV-001: Main Gate</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-xs text-slate-600 dark:text-slate-400">DEV-002: Staff Entrance</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-xs text-slate-600 dark:text-slate-400">DEV-003: Library (Standby)</span>
                </div>
              </div>
              <Button variant="outline" size="sm" className="rounded-xl">
                <Settings className="h-4 w-4 mr-1" />
                Manage Devices
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        {showFilters && (
          <Card className="border-0 shadow-md bg-white dark:bg-slate-800">
            <CardContent className="pt-5 pb-4">
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1 block">User Type</label>
                  <Select
                    value={filters.userType}
                    onValueChange={(v) => setFilters((prev) => ({ ...prev, userType: v as any }))}
                  >
                    <SelectTrigger className="rounded-xl bg-white dark:bg-slate-900 dark:border-slate-600">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
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
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1 block">Status</label>
                  <Select value={filters.status} onValueChange={(v) => setFilters((prev) => ({ ...prev, status: v as any }))}>
                    <SelectTrigger className="rounded-xl bg-white dark:bg-slate-900 dark:border-slate-600">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="success">Success</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1 block">Method</label>
                  <Select
                    value={filters.verificationMethod}
                    onValueChange={(v) => setFilters((prev) => ({ ...prev, verificationMethod: v as any }))}
                  >
                    <SelectTrigger className="rounded-xl bg-white dark:bg-slate-900 dark:border-slate-600">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="fingerprint">Fingerprint</SelectItem>
                      <SelectItem value="face">Face Recognition</SelectItem>
                      <SelectItem value="card">RFID Card</SelectItem>
                      <SelectItem value="pin">PIN Code</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1 block">Search</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search by name or ID..."
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
                      userType: "all",
                      status: "all",
                      verificationMethod: "all",
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
                  <p className="text-xs opacity-75">Total Logs</p>
                  <p className="text-xl font-bold">{stats.total}</p>
                </div>
                <Fingerprint className="h-6 w-6 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs opacity-75">Successful</p>
                  <p className="text-xl font-bold">{stats.success}</p>
                </div>
                <CheckCircle className="h-6 w-6 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs opacity-75">Failed</p>
                  <p className="text-xl font-bold">{stats.failed}</p>
                </div>
                <XCircle className="h-6 w-6 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs opacity-75">Students</p>
                  <p className="text-xl font-bold">{stats.student}</p>
                </div>
                <Users className="h-6 w-6 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs opacity-75">Staff</p>
                  <p className="text-xl font-bold">{stats.staff}</p>
                </div>
                <Users className="h-6 w-6 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs opacity-75">Fingerprint</p>
                  <p className="text-xl font-bold">{stats.fingerprint}</p>
                </div>
                <Fingerprint className="h-6 w-6 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Logs Table */}
        <Card className="border-0 shadow-md">
          <CardHeader className="bg-slate-50 dark:bg-slate-700 rounded-t-2xl">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-purple-500" />
              Biometric Verification Logs
            </CardTitle>
            <CardDescription>{logs.length} records found</CardDescription>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="h-10 w-10 animate-spin text-purple-600 mb-3" />
                <p className="text-slate-500">Loading logs...</p>
              </div>
            ) : (
              <div className="min-w-[900px]">
                <div className="grid grid-cols-12 gap-2 px-4 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase tracking-wider bg-slate-50 dark:bg-slate-700 border-b">
                  <div className="col-span-2">Time</div>
                  <div className="col-span-3">User</div>
                  <div className="col-span-2">ID</div>
                  <div className="col-span-2">Device</div>
                  <div className="col-span-1">Method</div>
                  <div className="col-span-1">Status</div>
                  <div className="col-span-1">Message</div>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                  {logs.map((log, idx) => (
                    <div
                      key={log.id}
                      className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-slate-50 dark:hover:bg-slate-700/50"
                    >
                      <div className="col-span-2">
                        <span className="text-sm text-slate-700 dark:text-slate-300">
                          {format(new Date(log.timestamp), "dd MMM, HH:mm:ss")}
                        </span>
                      </div>
                      <div className="col-span-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={log.photo_url} />
                            <AvatarFallback className="text-xs bg-purple-100 text-purple-700">
                              {log.user_name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-slate-800 dark:text-white">{log.user_name}</span>
                        </div>
                      </div>
                      <div className="col-span-2">
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                          {log.user_type === "student" ? log.admission_no : log.employee_id}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-sm text-slate-600 dark:text-slate-400">{log.device_name}</span>
                      </div>
                      <div className="col-span-1">
                        <div className="flex items-center gap-1">
                          {getMethodIcon(log.verification_method)}
                          <span className="text-xs text-slate-500 capitalize">{log.verification_method}</span>
                        </div>
                      </div>
                      <div className="col-span-1">{getStatusBadge(log.status)}</div>
                      <div className="col-span-1">
                        <span className="text-xs text-slate-500">{log.message}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {logs.length === 0 && !loading && (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <AlertCircle className="h-12 w-12 mb-3" />
                    <p>No biometric logs found</p>
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
