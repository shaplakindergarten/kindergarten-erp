"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Download,
  FileSpreadsheet,
  FileText,
  FileJson,
  Printer,
  Calendar,
  Users,
  Filter,
  CheckCircle,
  Loader2,
  AlertCircle,
  School,
  UserCheck,
  Clock,
  Database,
  Mail,
  Share2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ResponsiveLayout } from "@/components/layout/responsive-layout"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { format, startOfMonth, endOfMonth } from "date-fns"

const supabase = createClient()

interface ExportOption {
  id: string
  name: string
  description: string
  icon: any
  formats: ("csv" | "excel" | "pdf" | "json")[]
  category: "attendance" | "students" | "staff" | "fees"
}

interface ExportHistory {
  id: string
  report_name: string
  format: string
  generated_at: string
  file_size: string
  status: "completed" | "pending" | "failed"
}

const exportOptions: ExportOption[] = [
  {
    id: "daily_attendance",
    name: "Daily Attendance Report",
    description: "Complete attendance for a specific date",
    icon: Clock,
    formats: ["csv", "excel", "pdf", "json"],
    category: "attendance",
  },
  {
    id: "monthly_attendance",
    name: "Monthly Attendance Summary",
    description: "Attendance summary for a month",
    icon: Calendar,
    formats: ["csv", "excel", "pdf", "json"],
    category: "attendance",
  },
  {
    id: "late_summary",
    name: "Late Arrivals Report",
    description: "Detailed late attendance report",
    icon: Clock,
    formats: ["csv", "excel", "pdf"],
    category: "attendance",
  },
  {
    id: "absent_summary",
    name: "Absenteeism Report",
    description: "Track absent students/staff",
    icon: UserCheck,
    formats: ["csv", "excel", "pdf"],
    category: "attendance",
  },
  {
    id: "attendance_percentage",
    name: "Attendance Percentage",
    description: "Percentage-based attendance report",
    icon: School,
    formats: ["csv", "excel", "pdf"],
    category: "attendance",
  },
  {
    id: "student_list",
    name: "Student Directory",
    description: "Complete student list with details",
    icon: Users,
    formats: ["csv", "excel", "pdf"],
    category: "students",
  },
  {
    id: "staff_list",
    name: "Staff Directory",
    description: "Complete staff list with details",
    icon: Users,
    formats: ["csv", "excel", "pdf"],
    category: "staff",
  },
  {
    id: "fee_collection",
    name: "Fee Collection Report",
    description: "Fee payment and collection report",
    icon: Database,
    formats: ["csv", "excel", "pdf"],
    category: "fees",
  },
]

const startOfMonthStr = () => format(startOfMonth(new Date()), "yyyy-MM-dd")
const endOfMonthStr = () => format(endOfMonth(new Date()), "yyyy-MM-dd")

export default function ExportCenterPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("attendance")
  const [activeTab, setActiveTab] = useState<string>("export")
  const [exportHistory, setExportHistory] = useState<ExportHistory[]>([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({
    reportType: "",
    startDate: startOfMonthStr(),
    endDate: endOfMonthStr(),
    classId: "all",
    format: "csv",
  })
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([])

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

  // Load export history
  useEffect(() => {
    const savedHistory = localStorage.getItem("export_history")
    if (savedHistory) {
      setExportHistory(JSON.parse(savedHistory))
    } else {
      // Mock history
      setExportHistory([
        {
          id: "1",
          report_name: "Daily Attendance Report",
          format: "CSV",
          generated_at: new Date().toISOString(),
          file_size: "245 KB",
          status: "completed",
        },
        {
          id: "2",
          report_name: "Monthly Attendance Summary",
          format: "PDF",
          generated_at: new Date(Date.now() - 86400000).toISOString(),
          file_size: "1.2 MB",
          status: "completed",
        },
      ])
    }
  }, [])

  const handleExport = async () => {
    if (!filters.reportType) {
      toast.error("Please select a report type")
      return
    }

    setLoading(true)
    const option = exportOptions.find((o) => o.id === filters.reportType)
    
    try {
      // Simulate export process
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Save to history
      const newExport: ExportHistory = {
        id: Date.now().toString(),
        report_name: option?.name || "Report",
        format: filters.format.toUpperCase(),
        generated_at: new Date().toISOString(),
        file_size: `${Math.floor(Math.random() * 500) + 100} KB`,
        status: "completed",
      }

      const updatedHistory = [newExport, ...exportHistory].slice(0, 20)
      setExportHistory(updatedHistory)
      localStorage.setItem("export_history", JSON.stringify(updatedHistory))

      toast.success(`${option?.name} exported successfully as ${filters.format.toUpperCase()}`)

      // Trigger download
      const blob = new Blob(["Sample report content"], { type: "text/csv" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${option?.id}_${format(new Date(), "yyyy-MM-dd_HH-mm")}.${filters.format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      toast.error("Export failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const filteredOptions = exportOptions.filter((o) => o.category === selectedCategory)

  return (
    <ResponsiveLayout>
      <style jsx global>{`
        .dark label { color: #cbd5e1 !important; }
        .dark .text-slate-600 { color: #94a3b8 !important; }
        .dark .text-slate-500 { color: #64748b !important; }
      `}</style>

      <div className="space-y-5 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-gradient-to-r from-emerald-600 to-teal-700 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild className="bg-white/20 hover:bg-white/30 text-white rounded-xl">
              <Link href="/attendance/reports">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
                <Download className="h-7 w-7" />
                Export Center
              </h1>
              <p className="text-emerald-100 text-sm">Export reports in multiple formats</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-white/20 text-white border-0">CSV</Badge>
            <Badge className="bg-white/20 text-white border-0">Excel</Badge>
            <Badge className="bg-white/20 text-white border-0">PDF</Badge>
            <Badge className="bg-white/20 text-white border-0">JSON</Badge>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
          <TabsList className="grid w-full grid-cols-2 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
            <TabsTrigger value="export" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900">
              <Download className="h-4 w-4 mr-2" />
              Export Reports
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900">
              <Clock className="h-4 w-4 mr-2" />
              Export History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="export" className="space-y-5">
            {/* Category Selector */}
            <Card className="border-0 shadow-md">
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-2">
                  {["attendance", "students", "staff", "fees"].map((category) => (
                    <Button
                      key={category}
                      variant={selectedCategory === category ? "default" : "outline"}
                      onClick={() => setSelectedCategory(category)}
                      className={`rounded-xl capitalize ${
                        selectedCategory === category
                          ? "bg-emerald-600 hover:bg-emerald-700"
                          : "dark:border-slate-600 dark:text-slate-300"
                      }`}
                    >
                      {category === "attendance" && <Clock className="h-4 w-4 mr-2" />}
                      {category === "students" && <Users className="h-4 w-4 mr-2" />}
                      {category === "staff" && <UserCheck className="h-4 w-4 mr-2" />}
                      {category === "fees" && <Database className="h-4 w-4 mr-2" />}
                      {category}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Export Options Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredOptions.map((option) => (
                <Card
                  key={option.id}
                  className={`border-2 cursor-pointer transition-all hover:shadow-lg ${
                    filters.reportType === option.id
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20"
                      : "border-transparent hover:border-emerald-200 dark:hover:border-emerald-800"
                  }`}
                  onClick={() => setFilters((prev) => ({ ...prev, reportType: option.id }))}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                        <option.icon className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-slate-800 dark:text-white">{option.name}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{option.description}</p>
                        <div className="flex gap-1 mt-2">
                          {option.formats.map((fmt) => (
                            <Badge key={fmt} variant="outline" className="text-[10px] uppercase">
                              {fmt}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      {filters.reportType === option.id && <CheckCircle className="h-5 w-5 text-emerald-500" />}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Export Configuration */}
            {filters.reportType && (
              <Card className="border-0 shadow-md">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Filter className="h-5 w-5 text-emerald-500" />
                    Export Configuration
                  </CardTitle>
                  <CardDescription>Configure your export settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                    {selectedCategory === "attendance" && (
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
                    )}
                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1 block">Export Format</label>
                      <Select value={filters.format} onValueChange={(v) => setFilters((prev) => ({ ...prev, format: v }))}>
                        <SelectTrigger className="rounded-xl bg-white dark:bg-slate-900 dark:border-slate-600">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="csv">CSV</SelectItem>
                          <SelectItem value="excel">Excel (.xlsx)</SelectItem>
                          <SelectItem value="pdf">PDF</SelectItem>
                          <SelectItem value="json">JSON</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button onClick={handleExport} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 rounded-xl">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                      Generate & Download
                    </Button>
                    <Button variant="outline" className="rounded-xl">
                      <Mail className="h-4 w-4 mr-2" />
                      Email Report
                    </Button>
                    <Button variant="outline" className="rounded-xl">
                      <Share2 className="h-4 w-4 mr-2" />
                      Share
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history">
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-emerald-500" />
                  Recent Exports
                </CardTitle>
                <CardDescription>Your previously generated reports</CardDescription>
              </CardHeader>
              <CardContent>
                {exportHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <AlertCircle className="h-12 w-12 mb-3" />
                    <p>No export history found</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {exportHistory.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-xl"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-800 dark:text-white">{item.report_name}</p>
                            <p className="text-xs text-slate-500">
                              {format(new Date(item.generated_at), "dd MMM yyyy, HH:mm")} • {item.file_size}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                            {item.format}
                          </Badge>
                          <Button size="sm" variant="ghost" className="rounded-xl">
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Bulk Export Options */}
        <Card className="border-0 shadow-md bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-800">
          <CardContent className="p-5">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-slate-800 dark:text-white">Need to export everything?</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Download complete database backup</p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="rounded-xl">
                  <Database className="h-4 w-4 mr-2" />
                  Full Database Backup
                </Button>
                <Button variant="outline" className="rounded-xl">
                  <FileJson className="h-4 w-4 mr-2" />
                  JSON Export
                </Button>
                <Button variant="outline" className="rounded-xl">
                  <FileText className="h-4 w-4 mr-2" />
                  PDF Archive
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </ResponsiveLayout>
  )
}
