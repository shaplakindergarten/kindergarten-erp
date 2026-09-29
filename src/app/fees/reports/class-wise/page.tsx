"use client"

import { useCallback, useEffect, useMemo, useState, useRef } from "react"
import Link from "next/link"

import {
  ArrowLeft,
  Download,
  Loader2,
  Printer,
  RefreshCw,
  Users,
  Wallet,
  PieChart,
  Receipt,
  GraduationCap,
  FileText,
} from "lucide-react"

import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

import { ResponsiveLayout } from "@/components/layout/responsive-layout"

import { Button } from "@/components/ui/button"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { Input } from "@/components/ui/input"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { formatCurrency } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { getAllPaymentsWithAllocation, buildDescriptionFromAllocations } from "@/lib/api/fees-dynamic"
const supabase = createClient()

interface ClassItem {
  id: string
  name: string
}

interface SectionItem {
  id: string
  name: string
}

interface ReportItem {
  id: string
  payment_date: string
  receipt_no: string
  payment_method: string
  month: string
  amount: number
  paid_amount: number
  due_amount: number
  fine_amount: number
  discount_amount: number
  student_id: string
  student_name: string
  father_name: string
  admission_no: string
  class_roll: string
  class_id: string
  section_id: string
  class_name: string
  section_name: string
  fee_category: string
}

interface SummaryItem {
  class_name: string
  section_name: string
  total_collected: number
  transaction_count: number
  student_count: number
  percentage: number
}

interface SchoolInfo {
  school_name: string
  school_address: string
  school_phone: string
  school_email: string
  school_logo?: string
  school_watermark?: string
}

export default function ClassWiseReportPage() {
  const [loading, setLoading] = useState(true)
  const [pdfGenerating, setPdfGenerating] = useState(false)
  const [reportData, setReportData] = useState<ReportItem[]>([])
  const [summaryData, setSummaryData] = useState<SummaryItem[]>([])
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [sections, setSections] = useState<SectionItem[]>([])
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo>({
    school_name: "Shapla Kindergarten & Pre-cadet",
    school_address: "Nowtala, Madhaiya Bazar, Chandina, Cumilla",
    school_phone: "01923253454",
    school_email: "shapla.kindergarten@gmail.com"
  })

  const today = new Date().toISOString().split("T")[0]
  const [fromDate, setFromDate] = useState(today)
  const [toDate, setToDate] = useState(today)
  const [selectedClass, setSelectedClass] = useState("all")
  const [selectedSection, setSelectedSection] = useState("all")

  // =========================================
  // Date Formatting Functions (Fixed: DD-MM-YYYY)
  // =========================================
  
  // Format YYYY-MM-DD to DD-MM-YYYY for display
  const formatDateToDisplay = (dateString: string) => {
    if (!dateString) return ""
    const parts = dateString.split("-")
    if (parts.length !== 3) return dateString
    return `${parts[2]}-${parts[1]}-${parts[0]}`
  }

  // Format DD-MM-YYYY to YYYY-MM-DD for database/storage
  const formatDateToDatabase = (dateString: string) => {
    if (!dateString) return ""
    const parts = dateString.split("-")
    if (parts.length !== 3) return dateString
    return `${parts[2]}-${parts[1]}-${parts[0]}`
  }

  // Get display value for input field (YYYY-MM-DD for date input)
  const getInputDateValue = (dateString: string) => {
    if (!dateString) return ""
    if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) return dateString
    const parts = dateString.split("-")
    if (parts.length === 3) {
      if (parts[0].length === 2 && parts[2].length === 4) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`
      }
    }
    return dateString
  }

  const handleFromDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value
    setFromDate(inputValue)
  }

  const handleToDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value
    setToDate(inputValue)
  }

  // =========================================
  // Fetch School Info
  // =========================================
  const fetchSchoolInfo = async () => {
    try {
      const { data, error } = await supabase
        .from("school_settings")
        .select("school_name, school_address, school_phone, school_email, school_logo, school_watermark")
        .order("id", { ascending: true })
        .limit(1)
        .single()

      if (!error && data) {
        setSchoolInfo(data)
      } else {
        console.log("Using default school info")
      }
    } catch (error) {
      console.error("Error fetching school info:", error)
    }
  }

  // =========================================
  // Fetch Classes
  // =========================================
  const fetchClasses = async () => {
    const { data, error } = await supabase
      .from("classes")
      .select("id, name")
      .order("numeric_order")

    if (error) {
      console.error(error)
      return
    }

    setClasses(data || [])
  }

  // =========================================
  // Fetch Sections
  // =========================================
  const fetchSections = async () => {
    let query = supabase
      .from("sections")
      .select("id, name, class_id")
      .order("name")

    if (selectedClass !== "all") {
      query = query.eq("class_id", selectedClass)
    }

    const { data, error } = await query

    if (error) {
      console.error(error)
      return
    }

    setSections(data || [])
  }

  // =========================================
  // Fetch Report Data
  // =========================================
  const loadData = useCallback(async () => {
    try {
      setLoading(true)

      const payments = await getAllPaymentsWithAllocation({
        dateFrom: fromDate,
        dateTo: toDate,
      })

      if (!payments || payments.length === 0) {
        setReportData([])
        setSummaryData([])
        setLoading(false)
        return
      }

      // Filter by class and section after fetch
      const filteredPayments = payments.filter((p: any) => {
        if (selectedClass !== "all" && p.student?.class_id !== selectedClass) return false
        if (selectedSection !== "all" && p.student?.section_id !== selectedSection) return false
        return true
      })

      const transactions: ReportItem[] = filteredPayments.map((p: any) => {
        const student = p.student || {}
        return {
          id: p.id,
          payment_date: p.payment_date,
          receipt_no: p.receipt_no || `RCP-${p.id.slice(0, 8)}`,
          payment_method: p.payment_method || "cash",
          month: p.allocations?.[0]?.month || "",
          amount: Number(p.amount || 0),
          paid_amount: Number(p.amount || 0),
          due_amount: 0,
          fine_amount: Number(p.fine_amount || 0),
          discount_amount: Number(p.discount_amount || 0),
          student_id: p.student_id,
          student_name: student?.name || "Unknown",
          father_name: student?.father_name || "",
          admission_no: student?.student_id || "",
          class_roll: student?.class_roll || "",
          class_id: student?.class_id || "",
          section_id: student?.section_id || "",
          class_name: student?.class_name || "N/A",
          section_name: student?.section_name || "N/A",
          fee_category: buildDescriptionFromAllocations(p.allocations),
        }
      })

      setReportData(transactions)

      const classMap = new Map<
        string,
        {
          total: number
          count: number
          students: Set<string>
          class_name: string
          section_name: string
        }
      >()

      for (const tx of transactions) {
        const key = `${tx.class_name}-${tx.section_name}`

        const existing = classMap.get(key) || {
          total: 0,
          count: 0,
          students: new Set<string>(),
          class_name: tx.class_name,
          section_name: tx.section_name,
        }

        existing.total += Number(tx.paid_amount || 0)
        existing.count += 1
        existing.students.add(tx.student_id)
        classMap.set(key, existing)
      }

      const totalAll = Array.from(classMap.values()).reduce(
        (sum, item) => sum + item.total,
        0
      )

      const summaryResult: SummaryItem[] = Array.from(
        classMap.values()
      )
        .map((item) => ({
          class_name: item.class_name,
          section_name: item.section_name,
          total_collected: item.total,
          transaction_count: item.count,
          student_count: item.students.size,
          percentage:
            totalAll > 0
              ? (item.total / totalAll) * 100
              : 0,
        }))
        .sort(
          (a, b) =>
            b.total_collected - a.total_collected
        )

      setSummaryData(summaryResult)
    } catch (error) {
      console.error(error)
      setSummaryData([])
      setReportData([])
    } finally {
      setLoading(false)
    }
  }, [
    fromDate,
    toDate,
    selectedClass,
    selectedSection,
  ])

  // =========================================
  // Effects
  // =========================================
  useEffect(() => {
    fetchSchoolInfo()
    fetchClasses()
  }, [])

  useEffect(() => {
    fetchSections()
  }, [selectedClass])

  useEffect(() => {
    loadData()
  }, [loadData])

  // =========================================
  // Dashboard Summary
  // =========================================
  const dashboardSummary = useMemo(() => {
    let totalCollected = 0
    let totalFine = 0
    let totalDiscount = 0
    const studentSet = new Set<string>()

    reportData.forEach((item) => {
      totalCollected += Number(item.paid_amount || 0)
      totalFine += Number(item.fine_amount || 0)
      totalDiscount += Number(item.discount_amount || 0)
      studentSet.add(item.student_id)
    })

    return {
      totalCollected,
      totalFine,
      totalDiscount,
      totalStudents: studentSet.size,
      totalTransactions: reportData.length,
    }
  }, [reportData])

  // =========================================
  // Export CSV
  // =========================================
  const handleExport = () => {
    const headers = [
      "Class",
      "Section",
      "Collection",
      "Transactions",
      "Students",
      "Contribution",
    ]

    const rows = summaryData.map((item) => [
      item.class_name,
      item.section_name,
      item.total_collected,
      item.transaction_count,
      item.student_count,
      `${item.percentage.toFixed(2)}%`,
    ])

    const csv = [headers, ...rows]
      .map((row) => row.join(","))
      .join("\n")

    const blob = new Blob([csv], {
      type: "text/csv",
    })

    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `class-wise-report-${formatDateToDisplay(fromDate)}.csv`
    a.click()
  }

  // =========================================
  // PDF DOWNLOAD (Black & White using jsPDF)
  // =========================================

  const generatePDFDirect = async () => {
    try {
      if (summaryData.length === 0) {
        alert("No data found to generate PDF")
        return
      }

      setPdfGenerating(true)

      // Create PDF with landscape orientation
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      })

      // ========== HEADER SECTION (Black & White) ==========
      
      // School Name
      doc.setFontSize(20)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(0, 0, 0) // Black
      doc.text(
        schoolInfo.school_name || "School Name",
        148,
        20,
        { align: "center" }
      )

      // Report Title
      doc.setFontSize(14)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(0, 0, 0)
      doc.text(
        "Class Wise Fees Collection Report",
        148,
        30,
        { align: "center" }
      )

      // Date Range (DD-MM-YYYY format in one line)
      doc.setFontSize(10)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(80, 80, 80) // Dark Gray
      doc.text(
        `From: ${formatDateToDisplay(fromDate)}    To: ${formatDateToDisplay(toDate)}`,
        148,
        38,
        { align: "center" }
      )

      // ========== TABLE SECTION (Black & White) ==========
      
      // Prepare table data with simple formatting
      const tableBody = summaryData.map((item) => [
        item.class_name,
        item.section_name,
        `Tk ${item.total_collected.toLocaleString()}`,
        item.transaction_count.toString(),
        item.student_count.toString(),
        item.student_count > 0 
          ? `Tk ${(item.total_collected / item.student_count).toLocaleString()}`
          : "Tk 0",
        `${item.percentage.toFixed(1)}%`,
      ])

      // Generate table with autoTable (Black & White theme)
      autoTable(doc, {
        startY: 45,
        head: [
          [
            "Class",
            "Section",
            "Collection (Tk)",
            "Transactions",
            "Students",
            "Avg / Student",
            "Contribution",
          ],
        ],
        body: tableBody,
        theme: "grid",
        styles: {
          fontSize: 9,
          cellPadding: 3,
          valign: "middle",
          textColor: [0, 0, 0], // Black text
        },
        headStyles: {
          fillColor: [200, 200, 200], // Light Gray background
          textColor: [0, 0, 0], // Black text
          fontStyle: "bold",
          fontSize: 10,
          halign: "center",
        },
        alternateRowStyles: {
          fillColor: [240, 240, 240], // Very Light Gray for alternate rows
        },
        columnStyles: {
          0: { cellWidth: 35, halign: "left" },
          1: { cellWidth: 35, halign: "left" },
          2: { cellWidth: 40, halign: "right" },
          3: { cellWidth: 30, halign: "center" },
          4: { cellWidth: 30, halign: "center" },
          5: { cellWidth: 40, halign: "right" },
          6: { cellWidth: 35, halign: "right" },
        },
        margin: { left: 10, right: 10 },
      })

      // ========== FOOTER SECTION ==========
      
      const pageCount = doc.getNumberOfPages()

      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        
        // Footer line
        doc.setDrawColor(150, 150, 150)
        doc.line(10, 195, 287, 195)
        
        // Footer text
        doc.setFontSize(8)
        doc.setFont("helvetica", "normal")
        doc.setTextColor(100, 100, 100)
        
        doc.text(
          `Generated on: ${new Date().toLocaleString()}`,
          10,
          202
        )
        
        doc.text(
          `Page ${i} of ${pageCount}`,
          287,
          202,
          { align: "right" }
        )
      }

      // ========== SAVE PDF ==========
      doc.save(
        `class-wise-fees-report-${formatDateToDisplay(fromDate)}-to-${formatDateToDisplay(toDate)}.pdf`
      )
      
    } catch (error) {
      console.error("PDF generation error:", error)
      alert("PDF generation failed. Please try again.")
    } finally {
      setPdfGenerating(false)
    }
  }

  // =========================================
  // Print (Black & White Simple)
  // =========================================
  const handlePrint = () => {
    window.print()
  }

  return (
    <ResponsiveLayout>

      {/* ========================================= */}
      {/* PRINT STYLES - Black & White Simple */}
      {/* ========================================= */}

      <style jsx global>{`
        /* Print Styles - Black & White, No Colors */
        @media print {
          @page {
            size: A4 landscape;
            margin: 10mm;
          }

          * {
            background: transparent !important;
            color: black !important;
            box-shadow: none !important;
            text-shadow: none !important;
          }

          body * {
            visibility: hidden;
          }

          .print-area,
          .print-area * {
            visibility: visible;
          }

          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white;
          }

          .no-print {
            display: none !important;
          }

          .print-header-inline {
            display: flex !important;
            justify-content: center !important;
            align-items: center !important;
            gap: 20px !important;
            font-size: 13px !important;
            margin-top: 10px !important;
          }

          table {
            width: 100%;
            border-collapse: collapse;
          }

          th,
          td {
            border: 1px solid black !important;
            padding: 6px;
            font-size: 11px;
          }

          th {
            background: #ddd !important;
            color: black !important;
            font-weight: bold;
          }

          tr {
            page-break-inside: avoid;
          }

          thead {
            display: table-header-group;
          }
        }

        /* Screen Styles - Colorful UI */
        
        /* Colorful Card Styles for Screen Only */
        .stat-card-1 {
          background: linear-gradient(135deg, #fef3c7, #fde68a);
          border: none;
          transition: transform 0.2s ease;
        }
        .stat-card-1:hover { transform: translateY(-2px); }
        
        .stat-card-2 {
          background: linear-gradient(135deg, #dbeafe, #bfdbfe);
          border: none;
          transition: transform 0.2s ease;
        }
        .stat-card-2:hover { transform: translateY(-2px); }
        
        .stat-card-3 {
          background: linear-gradient(135deg, #dcfce7, #bbf7d0);
          border: none;
          transition: transform 0.2s ease;
        }
        .stat-card-3:hover { transform: translateY(-2px); }
        
        .stat-card-4 {
          background: linear-gradient(135deg, #f3e8ff, #e9d5ff);
          border: none;
          transition: transform 0.2s ease;
        }
        .stat-card-4:hover { transform: translateY(-2px); }
        
        /* Colorful Labels for Screen Only */
        .label-class {
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          color: white;
          padding: 0.25rem 0.75rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 500;
          display: inline-block;
        }
        
        .label-section {
          background: linear-gradient(135deg, #10b981, #059669);
          color: white;
          padding: 0.25rem 0.75rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 500;
          display: inline-block;
        }
        
        .label-date {
          background: linear-gradient(135deg, #8b5cf6, #7c3aed);
          color: white;
          padding: 0.25rem 0.75rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 500;
          display: inline-block;
        }
        
        /* Solid Color Dropdowns */
        .solid-select {
          background-color: #ffffff !important;
          border: 1px solid #e2e8f0 !important;
          transition: all 0.2s ease;
        }
        
        .dark .solid-select {
          background-color: #1e293b !important;
          border-color: #334155 !important;
          color: #f1f5f9 !important;
        }
        
        /* Dark Mode Support for Screen */
        .dark .stat-card-1 { background: linear-gradient(135deg, #451a03, #78350f); }
        .dark .stat-card-2 { background: linear-gradient(135deg, #1e3a8a, #1e40af); }
        .dark .stat-card-3 { background: linear-gradient(135deg, #14532d, #166534); }
        .dark .stat-card-4 { background: linear-gradient(135deg, #4c1d95, #5b21b6); }
        
        .dark .label-class {
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
        }
        
        .dark .label-section {
          background: linear-gradient(135deg, #059669, #047857);
        }
        
        .dark .label-date {
          background: linear-gradient(135deg, #7c3aed, #6d28d9);
        }
        
        /* Responsive */
        @media (max-width: 768px) {
          .responsive-grid {
            grid-template-columns: 1fr !important;
          }
          .filter-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      <div className="space-y-6 p-4 md:p-6">

        {/* HEADER */}

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 no-print">

          <div className="flex items-center gap-4">

            <Button
              variant="ghost"
              size="icon"
              asChild
              className="hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <Link href="/fees/reports">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>

            <div>

              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Class Wise Fees Report
              </h1>

              <p className="text-muted-foreground">
                Production ERP Report
              </p>

            </div>

          </div>

          <div className="flex flex-wrap gap-2">

            <Button
              variant="outline"
              onClick={loadData}
              disabled={loading}
              className="border-blue-200 hover:bg-blue-50 dark:border-blue-800"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>

            <Button
              variant="outline"
              onClick={handleExport}
              disabled={summaryData.length === 0}
              className="border-green-200 hover:bg-green-50 dark:border-green-800"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>

            <Button
              variant="outline"
              onClick={handlePrint}
              disabled={summaryData.length === 0}
              className="border-purple-200 hover:bg-purple-50 dark:border-purple-800"
            >
              <Printer className="h-4 w-4 mr-2" />
              Print Preview
            </Button>

            <Button
              onClick={generatePDFDirect}
              disabled={pdfGenerating || summaryData.length === 0}
              className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white"
            >
              {pdfGenerating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              Download PDF
            </Button>

          </div>

        </div>

        {/* FILTERS - Solid Color Dialogs */}

        <Card className="no-print border-0 shadow-lg bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900 dark:to-gray-900">

          <CardContent className="pt-6">

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 filter-grid">

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <span className="label-date">From Date</span>
                </label>
                <Input
                  type="date"
                  value={getInputDateValue(fromDate)}
                  onChange={handleFromDateChange}
                  className="solid-select"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <span className="label-date">To Date</span>
                </label>
                <Input
                  type="date"
                  value={getInputDateValue(toDate)}
                  onChange={handleToDateChange}
                  className="solid-select"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <span className="label-class">Select Class</span>
                </label>
                <Select
                  value={selectedClass}
                  onValueChange={(value) => {
                    setSelectedClass(value)
                    setSelectedSection("all")
                  }}
                >
                  <SelectTrigger className="solid-select">
                    <SelectValue placeholder="Class" />
                  </SelectTrigger>

                  <SelectContent className="solid-select">
                    <SelectItem value="all">All Classes</SelectItem>
                    {classes.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <span className="label-section">Select Section</span>
                </label>
                <Select
                  value={selectedSection}
                  onValueChange={setSelectedSection}
                >
                  <SelectTrigger className="solid-select">
                    <SelectValue placeholder="Section" />
                  </SelectTrigger>

                  <SelectContent className="solid-select">
                    <SelectItem value="all">All Sections</SelectItem>
                    {sections.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs opacity-0 hidden md:block">Action</label>
                <Button
                  onClick={loadData}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <PieChart className="h-4 w-4 mr-2" />
                  )}
                  Generate Report
                </Button>
              </div>

            </div>

          </CardContent>

        </Card>

        {/* DASHBOARD CARDS - Colorful for Screen */}

        <div className="grid gap-4 md:grid-cols-4 no-print responsive-grid">

          <Card className="stat-card-1 shadow-md">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Total Collection</p>
                  <h2 className="text-2xl font-bold text-green-700 dark:text-green-300">
                    {formatCurrency(dashboardSummary.totalCollected)}
                  </h2>
                </div>
                <div className="p-3 rounded-xl bg-green-100 dark:bg-green-900/30">
                  <Wallet className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card-2 shadow-md">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Total Students</p>
                  <h2 className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                    {dashboardSummary.totalStudents}
                  </h2>
                </div>
                <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                  <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card-3 shadow-md">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Transactions</p>
                  <h2 className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                    {dashboardSummary.totalTransactions}
                  </h2>
                </div>
                <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                  <Receipt className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card-4 shadow-md">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Class Groups</p>
                  <h2 className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                    {summaryData.length}
                  </h2>
                </div>
                <div className="p-3 rounded-xl bg-purple-100 dark:bg-purple-900/30">
                  <GraduationCap className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>

        </div>

        {/* PRINT AREA - Black & White Simple for Print */}

        <div className="print-area">

          {/* PRINT HEADER - Black & White */}

          <div className="hidden print:block mb-6">

            <div className="text-center border-b border-black pb-4">

              <h1 className="text-3xl font-bold">
                {schoolInfo.school_name}
              </h1>

              <h2 className="text-xl font-semibold mt-3">
                Class Wise Fees Collection Report
              </h2>

              {/* Date Range in One Line */}
              <div className="print-header-inline">
                <span>From: {formatDateToDisplay(fromDate)}</span>
                <span>To: {formatDateToDisplay(toDate)}</span>
              </div>

            </div>

          </div>

          {/* SUMMARY TABLE - Colorful for Screen, Black & White for Print */}

          <Card className="border-0 shadow-lg">

            <CardHeader className="no-print bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-t-lg">
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5 text-blue-600" />
                Class & Section Collection Summary
              </CardTitle>
            </CardHeader>

            <CardContent className="pt-6">

              {loading ? (

                <div className="flex justify-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>

              ) : summaryData.length === 0 ? (

                <div className="text-center py-10 text-muted-foreground">
                  No data found
                </div>

              ) : (

                <div className="overflow-x-auto">

                  <Table>

                    <TableHeader>
                      <TableRow className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
                        <TableHead className="font-bold text-blue-700 dark:text-blue-300">Class</TableHead>
                        <TableHead className="font-bold text-blue-700 dark:text-blue-300">Section</TableHead>
                        <TableHead className="text-right font-bold text-blue-700 dark:text-blue-300">Collection</TableHead>
                        <TableHead className="text-right font-bold text-blue-700 dark:text-blue-300">Transactions</TableHead>
                        <TableHead className="text-right font-bold text-blue-700 dark:text-blue-300">Students</TableHead>
                        <TableHead className="text-right font-bold text-blue-700 dark:text-blue-300">Avg / Student</TableHead>
                        <TableHead className="text-right font-bold text-blue-700 dark:text-blue-300">Contribution</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>

                      {summaryData.map((item, index) => (

                        <TableRow 
                          key={index}
                          className={`hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                            index % 2 === 0 ? 'bg-white dark:bg-gray-950' : 'bg-gray-50/50 dark:bg-gray-900/50'
                          }`}
                        >

                          <TableCell>
                            <span className="label-class">{item.class_name}</span>
                          </TableCell>

                          <TableCell>
                            <span className="label-section">{item.section_name}</span>
                          </TableCell>

                          <TableCell className="text-right font-bold text-green-600 dark:text-green-400">
                            {formatCurrency(item.total_collected)}
                          </TableCell>

                          <TableCell className="text-right font-medium">
                            {item.transaction_count}
                          </TableCell>

                          <TableCell className="text-right font-medium">
                            {item.student_count}
                          </TableCell>

                          <TableCell className="text-right font-medium">
                            {formatCurrency(
                              item.student_count > 0
                                ? item.total_collected / item.student_count
                                : 0
                            )}
                          </TableCell>

                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <span className="font-semibold text-blue-600 dark:text-blue-400">
                                {item.percentage.toFixed(1)}%
                              </span>
                              <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                                  style={{ width: `${Math.min(item.percentage, 100)}%` }}
                                />
                              </div>
                            </div>
                          </TableCell>

                        </TableRow>

                      ))}

                    </TableBody>

                  </Table>

                </div>

              )}

            </CardContent>

          </Card>

          {/* PRINT FOOTER - Black & White */}
          <div className="hidden print:block mt-4 pt-2 border-t border-black text-center text-xs">
            Generated on: {new Date().toLocaleString()}
          </div>

        </div>

      </div>

    </ResponsiveLayout>
  )
}
