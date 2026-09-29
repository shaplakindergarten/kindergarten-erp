"use client"

import Link from "next/link"
import { 
  FileText,
  Download,
  Award,
  BookOpen,
  GraduationCap,
  Users,
  Calendar,
  Clock
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ResponsiveLayout } from "@/components/layout/responsive-layout"

const reportTypes = [
  {
    title: "Testimonial Generate",
    description: "Generate testimonials for students with custom remarks and signatures",
    icon: Award,
    color: "bg-primary",
    href: "/reports/testimonial",
  },
  {
    title: "Transfer Certificate",
    description: "Generate Transfer Certificates (TC) as per education board format",
    icon: FileText,
    color: "bg-secondary",
    href: "/reports/tc",
  },
  {
    title: "Admit Card",
    description: "Generate examination admit cards with student photos and details",
    icon: BookOpen,
    color: "bg-accent",
    href: "/reports/admit",
  },
  {
    title: "ID Card Generate",
    description: "Create student and staff ID cards with barcode/QR code",
    icon: GraduationCap,
    color: "bg-info",
    href: "/reports/idcard",
  },
]

export default function ReportsPage() {
  return (
    <ResponsiveLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold font-heading">Academic Reports</h1>
            <p className="text-text-muted">Generate and print various academic documents.</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {reportTypes.map((report) => (
            <Card key={report.title} className="hover:shadow-lg transition-shadow cursor-pointer group">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className={`p-3 rounded-xl ${report.color}`}>
                    <report.icon className="h-6 w-6 text-white" />
                  </div>
                </div>
                <CardTitle className="mt-4">{report.title}</CardTitle>
                <CardDescription>{report.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full group-hover:gap-2" asChild>
                  <Link href={report.href}>
                    Generate Report
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Quick Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="p-4 rounded-lg bg-primary/10 text-center">
                <p className="text-3xl font-bold text-primary">256</p>
                <p className="text-sm text-text-muted">Total Students</p>
              </div>
              <div className="p-4 rounded-lg bg-secondary/10 text-center">
                <p className="text-3xl font-bold text-secondary">32</p>
                <p className="text-sm text-text-muted">Total Staff</p>
              </div>
              <div className="p-4 rounded-lg bg-accent/10 text-center">
                <p className="text-3xl font-bold text-accent">15</p>
                <p className="text-sm text-text-muted">Classes</p>
              </div>
              <div className="p-4 rounded-lg bg-info/10 text-center">
                <p className="text-3xl font-bold text-info">5</p>
                <p className="text-sm text-text-muted">Sections</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </ResponsiveLayout>
  )
}

