"use client"

import Link from "next/link"

import {
  Calendar,
  LineChart,
  Users,
  ClipboardCheck,
  Clock,
  TrendingUp,
  FileSpreadsheet,
  Printer,
  FileDown,
} from "lucide-react"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import { Button } from "@/components/ui/button"

import { ResponsiveLayout } from "@/components/layout/responsive-layout"

export default function AttendanceReportsPage() {
  const reports = [
    {
      title: "Daily Report",
      description: "View day-wise attendance records",
      href: "/attendance/reports/daily",
      icon: Calendar,
      color: "from-blue-500 to-indigo-600",
    },

    {
      title: "Monthly Report",
      description: "Monthly attendance summary analytics",
      href: "/attendance/reports/monthly",
      icon: LineChart,
      color: "from-green-500 to-emerald-600",
    },

    {
      title: "Class-wise Report",
      description: "Attendance report by class & section",
      href: "/attendance/reports/class-wise",
      icon: Users,
      color: "from-orange-500 to-red-500",
    },
  ]

  return (
    <ResponsiveLayout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Attendance Reports Dashboard
            </h1>

            <p className="text-muted-foreground mt-1">
              Analyze attendance performance and generate reports
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline">
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>

            <Button variant="outline">
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Excel
            </Button>

            <Button>
              <FileDown className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">

          <Card className="border-0 shadow-md bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-white/80">
                  Today Present
                </p>

                <h2 className="text-3xl font-bold mt-1">
                  248
                </h2>
              </div>

              <ClipboardCheck className="h-10 w-10 text-white/80" />
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-gradient-to-r from-red-500 to-rose-600 text-white">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-white/80">
                  Today Absent
                </p>

                <h2 className="text-3xl font-bold mt-1">
                  18
                </h2>
              </div>

              <Users className="h-10 w-10 text-white/80" />
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-gradient-to-r from-amber-500 to-orange-600 text-white">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-white/80">
                  Late Students
                </p>

                <h2 className="text-3xl font-bold mt-1">
                  12
                </h2>
              </div>

              <Clock className="h-10 w-10 text-white/80" />
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-gradient-to-r from-green-500 to-emerald-600 text-white">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-white/80">
                  Monthly Average
                </p>

                <h2 className="text-3xl font-bold mt-1">
                  94%
                </h2>
              </div>

              <TrendingUp className="h-10 w-10 text-white/80" />
            </CardContent>
          </Card>
        </div>

        {/* Reports Grid */}
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {reports.map((report) => {
            const Icon = report.icon

            return (
              <Link
                key={report.href}
                href={report.href}
              >
                <Card className="group overflow-hidden border-0 shadow-md hover:shadow-2xl transition-all duration-300 cursor-pointer h-full">
                  
                  <div className={`h-2 bg-gradient-to-r ${report.color}`} />

                  <CardHeader className="pb-2">
                    <div className={`h-14 w-14 rounded-2xl bg-gradient-to-r ${report.color} flex items-center justify-center shadow-lg`}>
                      <Icon className="h-7 w-7 text-white" />
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-2">
                    <CardTitle className="text-xl">
                      {report.title}
                    </CardTitle>

                    <p className="text-sm text-muted-foreground">
                      {report.description}
                    </p>

                    <div className="pt-3">
                      <Button
                        variant="outline"
                        className="w-full group-hover:bg-primary group-hover:text-white transition-colors"
                      >
                        Open Report
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>

        {/* Analytics Section */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle>
              Attendance Analytics Overview
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">

              <div className="rounded-xl border p-5 bg-muted/30">
                <p className="text-sm text-muted-foreground">
                  Best Attendance Class
                </p>

                <h3 className="text-xl font-bold mt-2">
                  Class Five - A
                </h3>

                <p className="text-sm text-green-600 mt-1">
                  98% Attendance Rate
                </p>
              </div>

              <div className="rounded-xl border p-5 bg-muted/30">
                <p className="text-sm text-muted-foreground">
                  Lowest Attendance
                </p>

                <h3 className="text-xl font-bold mt-2">
                  Class Three - B
                </h3>

                <p className="text-sm text-red-600 mt-1">
                  81% Attendance Rate
                </p>
              </div>

              <div className="rounded-xl border p-5 bg-muted/30">
                <p className="text-sm text-muted-foreground">
                  Overall Attendance
                </p>

                <h3 className="text-xl font-bold mt-2">
                  Excellent
                </h3>

                <p className="text-sm text-primary mt-1">
                  School performance is stable
                </p>
              </div>

            </div>
          </CardContent>
        </Card>

      </div>
    </ResponsiveLayout>
  )
}
