"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import { 
  ArrowLeft, Download, Loader2, 
  Receipt, TrendingUp, Users, Wallet, Printer, FileText,
  CheckCircle, AlertCircle, Search, RefreshCw,
  Landmark, Smartphone, Building2, Eye
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ResponsiveLayout } from "@/components/layout/responsive-layout"
import { formatCurrency } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { getAllPaymentsWithAllocation, buildDescriptionFromAllocations } from "@/lib/api/fees-dynamic"
import { getSchoolPrintHeader } from "@/components/print/SchoolPrintHeader"
import jsPDF from "jspdf"
import html2canvas from "html2canvas-pro"
import { toast } from "sonner"

const supabase = createClient()

interface SchoolSettings {
  school_name?: string
  school_address?: string
  school_phone?: string
  school_email?: string
  school_logo?: string | null
}

const DEFAULT_SCHOOL_SETTINGS: SchoolSettings = {
  school_name: "Your School Name",
  school_address: "School Address",
  school_phone: "",
  school_email: "",
  school_logo: null,
}

// 🆕 Updated PaymentRecord with due info
interface PaymentRecord {
  id: string
  receipt_no: string
  student_id: string
  student_name: string
  admission_no: string
  class_roll: string
  class_name: string
  section_name: string
  father_name: string
  phone: string
  amount: number
  payment_method: string
  transaction_id: string | null
  payment_date: string
  created_at: string
  collected_by: string | null
  note: string | null
  fee_category: string
  discount: number
  fine: number
  previous_due: number
  remaining_due: number
  net_pay: number
  // 🆕 New fields from student_fee_dues
  total_due?: number
  due_amount?: number
  overdue_months?: number
}

interface DailySummary {
  total_collected: number
  total_discount: number
  total_fine: number
  total_transactions: number
  unique_students: number
  cash_total: number
  bkash_total: number
  nagad_total: number
  bank_total: number
  // 🆕 New summary fields
  total_due: number
  overdue_students: number
}

// Colorful Stat Card Component
const StatCard = ({ title, value, icon: Icon, gradient, iconBg }: any) => (
  <Card className="group relative overflow-hidden border-none shadow-md hover:shadow-lg transition-all duration-300">
    <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-10 group-hover:opacity-20 transition-opacity`} />
    <CardContent className="p-4 relative z-10">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
        </div>
        <div className={`p-2 rounded-xl ${iconBg} group-hover:scale-105 transition-transform shadow-md`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </CardContent>
  </Card>
)

const getPaymentMethodBadge = (method: string) => {
  const methods: Record<string, { label: string; gradient: string; icon: any }> = {
    cash: { label: "Cash", gradient: "from-emerald-500 to-teal-500", icon: Landmark },
    bkash: { label: "bKash", gradient: "from-pink-500 to-rose-500", icon: Smartphone },
    nagad: { label: "Nagad", gradient: "from-purple-500 to-indigo-500", icon: Smartphone },
    bank: { label: "Bank", gradient: "from-blue-500 to-cyan-500", icon: Building2 },
  }
  return methods[method] || { label: method || "Cash", gradient: "from-gray-500 to-gray-600", icon: Wallet }
}

export default function DailyReportPage() {
  const [transactions, setTransactions] = useState<PaymentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [previewReceipt, setPreviewReceipt] = useState<PaymentRecord | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [filterClass, setFilterClass] = useState("all")
  const [filterMethod, setFilterMethod] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [exportingPDF, setExportingPDF] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings>(DEFAULT_SCHOOL_SETTINGS)
  const reportRef = useRef<HTMLDivElement>(null)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // 🆕 State for due summary
  const [dueSummary, setDueSummary] = useState<{ total_due: number; overdue_count: number }>({
    total_due: 0,
    overdue_count: 0
  })

  const loadSchoolSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("school_settings")
        .select("*")
        .maybeSingle()
      if (!error && data) {
        setSchoolSettings({
          school_name: data.school_name || DEFAULT_SCHOOL_SETTINGS.school_name,
          school_address: data.school_address || DEFAULT_SCHOOL_SETTINGS.school_address,
          school_phone: data.school_phone || DEFAULT_SCHOOL_SETTINGS.school_phone,
          school_email: data.school_email || DEFAULT_SCHOOL_SETTINGS.school_email,
          school_logo: data.school_logo || DEFAULT_SCHOOL_SETTINGS.school_logo,
        })
      }
    } catch (error) {
      console.error("Error loading school settings:", error)
    }
  }, [])

  useEffect(() => {
    loadSchoolSettings()
  }, [loadSchoolSettings])

  const formatDateLong = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
  }

  // 🆕 Load due data for the selected date
  const loadDueData = useCallback(async (date: string) => {
    try {
      // Get overdue dues for this date
      const { data: dues, error } = await supabase
        .from('student_fee_dues')
        .select('student_id, due_amount, status')
        .lte('due_date', date)
        .gt('due_amount', 0)

      if (error) {
        console.error('Error loading due data:', error)
        return { total_due: 0, overdue_count: 0 }
      }

      const totalDue = dues?.reduce((sum, d) => sum + (d.due_amount || 0), 0) || 0
      const overdueCount = dues?.filter(d => d.status === 'overdue').length || 0

      return { total_due: totalDue, overdue_count: overdueCount }
    } catch (error) {
      console.error('Error in loadDueData:', error)
      return { total_due: 0, overdue_count: 0 }
    }
  }, [])

  // Load data function - using fee_payments table (Dynamic Architecture)
  const loadData = useCallback(async (showToastMessage: boolean = false) => {
    try {
      setLoading(true)

      console.log("Fetching payments for date:", selectedDate)

      // Query fee_payments table via dynamic service
      const payments = await getAllPaymentsWithAllocation({
        dateFrom: selectedDate,
        dateTo: selectedDate
      })

      console.log("Payments found:", payments?.length || 0)

      // 🆕 Load due data for this date
      const dueData = await loadDueData(selectedDate)
      setDueSummary(dueData)

      if (!payments || payments.length === 0) {
        setTransactions([])
        if (showToastMessage) {
          toast.info(`No payments found for ${selectedDate}`)
        }
        return
      }

      // Get class and section names for all students
      const classIds = [...new Set(payments.map((p: any) => p.students?.class_id).filter(Boolean))]
      const sectionIds = [...new Set(payments.map((p: any) => p.students?.section_id).filter(Boolean))]

      let classNames: Record<string, string> = {}
      let sectionNames: Record<string, string> = {}

      if (classIds.length > 0) {
        const { data: classes } = await supabase
          .from("classes")
          .select("id, name")
          .in("id", classIds)
        if (classes) {
          classNames = classes.reduce((acc, c) => { acc[c.id] = c.name; return acc }, {} as Record<string, string>)
        }
      }

      if (sectionIds.length > 0) {
        const { data: sections } = await supabase
          .from("sections")
          .select("id, name")
          .in("id", sectionIds)
        if (sections) {
          sectionNames = sections.reduce((acc, s) => { acc[s.id] = s.name; return acc }, {} as Record<string, string>)
        }
      }

      // 🆕 Get student due amounts
      const studentIds = payments.map((p: any) => p.student_id).filter(Boolean)
      let dueMap: Record<string, number> = {}
      if (studentIds.length > 0) {
        const { data: dues } = await supabase
          .from('student_fee_dues')
          .select('student_id, due_amount')
          .in('student_id', studentIds)
          .gt('due_amount', 0)

        if (dues) {
          dueMap = dues.reduce((acc: any, d: any) => {
            acc[d.student_id] = (acc[d.student_id] || 0) + d.due_amount
            return acc
          }, {})
        }
      }

      const formattedTransactions: PaymentRecord[] = payments.map((payment: any) => {
        const student = payment.student
        const paidAmount = payment.amount || 0

        return {
          id: payment.id,
          receipt_no: payment.receipt_no || `RCP-${payment.id.slice(0, 8)}`,
          student_id: payment.student_id,
          student_name: student?.name || "Unknown",
          admission_no: student?.student_id || "",
          class_roll: student?.class_roll || "",
          class_name: student?.class_name || classNames[student?.class_id] || "N/A",
          section_name: student?.section_name || sectionNames[student?.section_id] || "N/A",
          father_name: student?.father_name || "",
          phone: student?.contact || student?.fathers_contact || "",
          amount: paidAmount,
          payment_method: payment.payment_method || "cash",
          transaction_id: null,
          payment_date: payment.payment_date,
          created_at: payment.payment_date,
          collected_by: null,
          note: payment.note,
          fee_category: buildDescriptionFromAllocations(payment.allocations),
          discount: payment.discount_amount || 0,
          fine: payment.fine_amount || 0,
          previous_due: 0,
          remaining_due: dueMap[payment.student_id] || 0,
          net_pay: paidAmount,
          // 🆕 New fields
          total_due: dueMap[payment.student_id] || 0,
          due_amount: dueMap[payment.student_id] || 0
        }
      })

      setTransactions(formattedTransactions)

      if (showToastMessage) {
        toast.success(`Found ${formattedTransactions.length} transactions for ${selectedDate}`)
      }

    } catch (err) {
      console.error("Error loading data:", err)
      setTransactions([])
    } finally {
      setLoading(false)
    }
  }, [selectedDate, loadDueData])

  // Initial load
  useEffect(() => {
    loadData(false)
  }, [loadData])

  // Setup polling every 60 seconds (manual refresh recommended for faster updates)
  useEffect(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
    }
    
    pollingIntervalRef.current = setInterval(() => {
      console.log("🔄 Auto-refreshing report...")
      loadData(true)
    }, 60000)

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }
  }, [loadData])

  const filteredTransactions = transactions.filter(tx => {
    if (filterClass !== "all" && tx.class_name !== filterClass) return false
    if (filterMethod !== "all" && tx.payment_method !== filterMethod) return false
    if (searchQuery && !tx.student_name?.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !tx.receipt_no?.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !tx.admission_no?.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  // 🆕 Updated summary with due data
  const summary: DailySummary = {
    total_collected: filteredTransactions.reduce((sum, tx) => sum + (tx.amount || 0), 0),
    total_discount: filteredTransactions.reduce((sum, tx) => sum + (tx.discount || 0), 0),
    total_fine: filteredTransactions.reduce((sum, tx) => sum + (tx.fine || 0), 0),
    total_transactions: filteredTransactions.length,
    unique_students: new Set(filteredTransactions.map(tx => tx.student_id)).size,
    cash_total: filteredTransactions.filter(tx => tx.payment_method === 'cash').reduce((sum, tx) => sum + (tx.amount || 0), 0),
    bkash_total: filteredTransactions.filter(tx => tx.payment_method === 'bkash').reduce((sum, tx) => sum + (tx.amount || 0), 0),
    nagad_total: filteredTransactions.filter(tx => tx.payment_method === 'nagad').reduce((sum, tx) => sum + (tx.amount || 0), 0),
    bank_total: filteredTransactions.filter(tx => tx.payment_method === 'bank').reduce((sum, tx) => sum + (tx.amount || 0), 0),
    // 🆕 New summary fields
    total_due: dueSummary.total_due,
    overdue_students: dueSummary.overdue_count,
  }

  const handleExportCSV = () => {
    const headers = [
        "Receipt No", "Date", "Student Name", "Admission No", "Class Roll",
        "Class", "Section", "Father Name", "Phone", "Fee Category",
        "Discount", "Fine", "Net Pay", "Due", "Payment Method", "Note"
      ]
      
      const rows = filteredTransactions.map(tx => [
        tx.receipt_no,
        new Date(tx.payment_date).toLocaleDateString(),
        tx.student_name,
        tx.admission_no,
        tx.class_roll,
        tx.class_name,
        tx.section_name,
        tx.father_name,
        tx.phone,
        tx.fee_category,
        tx.discount.toString(),
        tx.fine.toString(),
        tx.amount.toString(),
        (tx.remaining_due || 0).toString(),
        tx.payment_method,
        tx.note || ""
      ])
    
    const csv = [headers, ...rows].map(row => row.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `daily-collection-${selectedDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("CSV exported successfully!")
  }

  // ==================== PRINT FUNCTION WITH AUTO-CLOSE ====================
  const handlePrint = () => {
    if (!schoolSettings.school_name) {
      toast.error("School settings not loaded")
      return
    }

    setPrinting(true)
    const printWindow = window.open("", "_blank")
    if (!printWindow) {
      setPrinting(false)
      toast.error("Please allow popups to print")
      return
    }
    
    const printDate = new Date().toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric"
    })
    
    // 🆕 Updated print content with due info
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Daily Collection Report - ${selectedDate}</title>
        <style>
          @page { size: landscape; margin: 12mm; }
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; color: #1e293b; }
          .report-header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #1e3a8a; padding-bottom: 12px; }
          .report-title { font-size: 16px; font-weight: 600; color: #475569; margin: 5px 0; }
          .report-date { font-size: 11px; color: #64748b; margin-top: 5px; }
          .summary { display: flex; justify-content: space-between; margin-bottom: 20px; background: #f1f5f9; padding: 12px; border-radius: 6px; flex-wrap: wrap; }
          .summary-item { text-align: center; flex: 1; min-width: 80px; }
          .summary-item .label { font-size: 9px; color: #64748b; }
          .summary-item .value { font-size: 13px; font-weight: bold; color: #0f172a; }
          .summary-item .value.due { color: #dc2626; }
          table { width: 100%; border-collapse: collapse; font-size: 9px; }
          th { background: #e2e8f0; padding: 6px 4px; border: 1px solid #cbd5e1; text-align: left; font-weight: 700; }
          td { padding: 5px 4px; border: 1px solid #e2e8f0; }
          .text-right { text-align: right; }
          .footer { margin-top: 20px; text-align: center; font-size: 8px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }
        </style>
      </head>
      <body>
        ${getSchoolPrintHeader(schoolSettings, "Daily Collection Report")}
        <p class="report-date" style="text-align: center; margin: 5px 0; font-size: 11px; color: #64748b;">${formatDateLong(selectedDate)} | Printed: ${printDate}</p>
        <div class="summary">
          <div class="summary-item"><div class="label">Total Transactions</div><div class="value">${summary.total_transactions}</div></div>
          <div class="summary-item"><div class="label">Total Collected</div><div class="value">${summary.total_collected.toLocaleString()} ৳</div></div>
          <div class="summary-item"><div class="label">Total Discount</div><div class="value">${summary.total_discount.toLocaleString()} ৳</div></div>
          <div class="summary-item"><div class="label">Total Fine</div><div class="value">${summary.total_fine.toLocaleString()} ৳</div></div>
          <div class="summary-item"><div class="label">Unique Students</div><div class="value">${summary.unique_students}</div></div>
          <div class="summary-item"><div class="label">Total Due</div><div class="value due">${summary.total_due.toLocaleString()} ৳</div></div>
          <div class="summary-item"><div class="label">Overdue</div><div class="value due">${summary.overdue_students}</div></div>
        </div>
        <table>
           <thead><tr><th>Receipt</th><th>Student</th><th>Admission</th><th>Class</th><th>Category</th><th class="text-right">Discount</th><th class="text-right">Fine</th><th class="text-right">Paid</th><th class="text-right">Due</th><th>Method</th></tr></thead>
           <tbody>
             ${filteredTransactions.map(tx => `
               <tr>
                 <td>${tx.receipt_no}</td>
                 <td>${tx.student_name}</td>
                 <td>${tx.admission_no}</td>
                 <td>${tx.class_name}</td>
                 <td>${tx.fee_category}</td>
                 <td class="text-right">${tx.discount.toLocaleString()}</td>
                 <td class="text-right">${tx.fine.toLocaleString()}</td>
                 <td class="text-right">${tx.amount.toLocaleString()}</td>
                 <td class="text-right">${(tx.remaining_due || 0).toLocaleString()}</td>
                 <td>${tx.payment_method}</td>
               </tr>
             `).join("")}
           </tbody>
        </table>
        <div class="footer">
          <p>Generated on ${new Date().toLocaleString()}</p>
        </div>
      </body>
      </html>
    `)
    
    printWindow.document.close()
    
    printWindow.onafterprint = function() {
      printWindow.close()
      setPrinting(false)
      toast.success("Report printed successfully")
    }
    
    printWindow.print()
    
    setTimeout(() => {
      if (printWindow && !printWindow.closed) {
        printWindow.close()
        setPrinting(false)
      }
    }, 60000)
  }

  // ==================== PDF FUNCTION ====================
  const handlePDF = async () => {
    setExportingPDF(true)
    try {
      const printDate = new Date().toLocaleDateString("en-US", {
        weekday: "long", year: "numeric", month: "long", day: "numeric"
      })
      
      const pdfContent = document.createElement("div")
      pdfContent.style.width = "1200px"
      pdfContent.style.padding = "20px"
      pdfContent.style.backgroundColor = "#ffffff"
      pdfContent.style.position = "absolute"
      pdfContent.style.left = "-9999px"
      pdfContent.style.top = "0"
      
      pdfContent.innerHTML = `
        ${getSchoolPrintHeader(schoolSettings, "Daily Collection Report")}
        <p style="text-align:center; font-size:11px; color:#64748b; margin:5px 0;">${formatDateLong(selectedDate)} | Printed: ${printDate}</p>
        <div style="display:flex; justify-content:space-between; margin-bottom:20px; background:#f1f5f9; padding:12px; border-radius:6px; flex-wrap:wrap;">
          <div style="text-align:center; flex:1; min-width:80px;"><div style="font-size:9px;">Total Transactions</div><div style="font-size:13px; font-weight:bold;">${summary.total_transactions}</div></div>
          <div style="text-align:center; flex:1; min-width:80px;"><div style="font-size:9px;">Total Collected</div><div style="font-size:13px; font-weight:bold;">${summary.total_collected.toLocaleString()} ৳</div></div>
          <div style="text-align:center; flex:1; min-width:80px;"><div style="font-size:9px;">Total Discount</div><div style="font-size:13px; font-weight:bold;">${summary.total_discount.toLocaleString()} ৳</div></div>
          <div style="text-align:center; flex:1; min-width:80px;"><div style="font-size:9px;">Total Fine</div><div style="font-size:13px; font-weight:bold;">${summary.total_fine.toLocaleString()} ৳</div></div>
          <div style="text-align:center; flex:1; min-width:80px;"><div style="font-size:9px;">Unique Students</div><div style="font-size:13px; font-weight:bold;">${summary.unique_students}</div></div>
          <div style="text-align:center; flex:1; min-width:80px;"><div style="font-size:9px; color:#dc2626;">Total Due</div><div style="font-size:13px; font-weight:bold; color:#dc2626;">${summary.total_due.toLocaleString()} ৳</div></div>
          <div style="text-align:center; flex:1; min-width:80px;"><div style="font-size:9px; color:#dc2626;">Overdue</div><div style="font-size:13px; font-weight:bold; color:#dc2626;">${summary.overdue_students}</div></div>
        </div>
        <table style="width:100%; border-collapse:collapse; font-size:9px;">
           <thead><tr style="background:#e2e8f0;"><th>Receipt</th><th>Student</th><th>Admission</th><th>Class</th><th>Category</th><th style="text-align:right">Discount</th><th style="text-align:right">Fine</th><th style="text-align:right">Paid</th><th style="text-align:right">Due</th><th>Method</th></tr></thead>
           <tbody>
             ${filteredTransactions.map(tx => `
               <tr>
                 <td style="padding:5px 4px; border:1px solid #e2e8f0;">${tx.receipt_no}</td>
                 <td style="padding:5px 4px; border:1px solid #e2e8f0;">${tx.student_name}</td>
                 <td style="padding:5px 4px; border:1px solid #e2e8f0;">${tx.admission_no}</td>
                 <td style="padding:5px 4px; border:1px solid #e2e8f0;">${tx.class_name}</td>
                 <td style="padding:5px 4px; border:1px solid #e2e8f0;">${tx.fee_category}</td>
                 <td style="padding:5px 4px; border:1px solid #e2e8f0; text-align:right; color:#dc2626;">${tx.discount.toLocaleString()}</td>
                 <td style="padding:5px 4px; border:1px solid #e2e8f0; text-align:right; color:#ea580c;">${tx.fine.toLocaleString()}</td>
                 <td style="padding:5px 4px; border:1px solid #e2e8f0; text-align:right; color:#059669;">${tx.amount.toLocaleString()}</td>
                 <td style="padding:5px 4px; border:1px solid #e2e8f0; text-align:right; color:#dc2626;">${(tx.remaining_due || 0).toLocaleString()}</td>
                 <td style="padding:5px 4px; border:1px solid #e2e8f0;">${tx.payment_method}</td>
               </tr>
             `).join("")}
           </tbody>
         </table>
        <div style="margin-top:20px; text-align:center; font-size:8px; color:#94a3b8; border-top:1px solid #e2e8f0; padding-top:12px;">
          <p>Generated on ${new Date().toLocaleString()}</p>
        </div>
      `
      
      document.body.appendChild(pdfContent)
      const canvas = await html2canvas(pdfContent, { scale: 2, logging: false, useCORS: true, backgroundColor: "#ffffff" })
      document.body.removeChild(pdfContent)
      
      const imgData = canvas.toDataURL("image/png")
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
      const imgWidth = 297
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight)
      pdf.save(`daily-collection-report-${selectedDate}.pdf`)
      toast.success("PDF downloaded successfully!")
    } catch (error) {
      console.error("PDF generation error:", error)
      toast.error("Failed to generate PDF")
    } finally {
      setExportingPDF(false)
    }
  }

  const uniqueClasses = [...new Set(transactions.map(tx => tx.class_name))].filter(Boolean)

  if (loading && transactions.length === 0) {
    return (
      <ResponsiveLayout>
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <div className="text-center space-y-3">
            <div className="relative w-10 h-10 mx-auto">
              <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
              <div className="absolute inset-0 rounded-full border-t-2 border-primary animate-spin" />
            </div>
            <p className="text-sm text-muted-foreground animate-pulse">Loading daily report...</p>
          </div>
        </div>
      </ResponsiveLayout>
    )
  }

  return (
    <ResponsiveLayout>
      <div ref={reportRef} className="space-y-5 p-4 md:p-6 bg-gradient-to-br from-slate-50 via-white to-indigo-50/20 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/20">
        
        {/* Gradient Action Bar */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-4 shadow-md">
          <div className="absolute top-0 right-0 -mt-6 -mr-6 w-24 h-24 rounded-full bg-white/20 blur-2xl" />
          <div className="absolute bottom-0 left-0 -mb-6 -ml-6 w-24 h-24 rounded-full bg-yellow-400/20 blur-2xl" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" asChild className="bg-white/10 hover:bg-white/20 text-white border-white/20 print:hidden">
                <Link href="/fees"><ArrowLeft className="h-5 w-5" /></Link>
              </Button>
              <div>
                <h1 className="text-xl font-bold text-white">Daily Collection Report</h1>
                <p className="text-white/80 text-xs">Real-time fee collection tracking</p>
              </div>
            </div>
            <div className="flex gap-2 print:hidden">
              <Button variant="secondary" size="sm" onClick={() => loadData(true)} className="bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 gap-1">
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </Button>
              <Button variant="secondary" size="sm" onClick={handlePrint} disabled={printing} className="bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 gap-1">
                {printing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />} 
                {printing ? "Printing..." : "Print"}
              </Button>
              <Button variant="secondary" size="sm" onClick={handlePDF} disabled={exportingPDF} className="bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 gap-1">
                {exportingPDF ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />} PDF
              </Button>
              <Button variant="secondary" size="sm" onClick={handleExportCSV} className="bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 gap-1">
                <Download className="h-3.5 w-3.5" /> Export
              </Button>
            </div>
          </div>
        </div>

        {/* Date Filter Row */}
        <div className="flex flex-wrap gap-3 items-end bg-card/50 p-3 rounded-xl border shadow-sm print:hidden">
          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">Select Date</Label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => { setSelectedDate(e.target.value); setLoading(true); loadData(false); }}
              className="h-9 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm"
            />
          </div>
          
          <div className="space-y-1 flex-1">
            <Label className="text-xs font-medium text-muted-foreground">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Search by name, receipt, admission..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-9 text-sm" />
            </div>
          </div>
          
          <div className="space-y-1 w-36">
            <Label className="text-xs font-medium text-muted-foreground">Class</Label>
            <Select value={filterClass} onValueChange={setFilterClass}>
              <SelectTrigger className="h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"><SelectValue placeholder="All Classes" /></SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg">
                <SelectItem value="all">All Classes</SelectItem>
                {uniqueClasses.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-1 w-36">
            <Label className="text-xs font-medium text-muted-foreground">Method</Label>
            <Select value={filterMethod} onValueChange={setFilterMethod}>
              <SelectTrigger className="h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"><SelectValue placeholder="All Methods" /></SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg">
                <SelectItem value="all">All Methods</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="bkash">bKash</SelectItem>
                <SelectItem value="nagad">Nagad</SelectItem>
                <SelectItem value="bank">Bank</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 🆕 Summary Cards - Updated with due info */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-7 print:hidden">
          <StatCard title="Total Collected" value={formatCurrency(summary.total_collected)} icon={Wallet} gradient="from-emerald-500 to-teal-500" iconBg="bg-gradient-to-br from-emerald-500 to-teal-500" />
          <StatCard title="Total Discount" value={formatCurrency(summary.total_discount)} icon={TrendingUp} gradient="from-orange-500 to-amber-500" iconBg="bg-gradient-to-br from-orange-500 to-amber-500" />
          <StatCard title="Total Fine" value={formatCurrency(summary.total_fine)} icon={AlertCircle} gradient="from-red-500 to-rose-500" iconBg="bg-gradient-to-br from-red-500 to-rose-500" />
          <StatCard title="Transactions" value={summary.total_transactions} icon={Receipt} gradient="from-blue-500 to-cyan-500" iconBg="bg-gradient-to-br from-blue-500 to-cyan-500" />
          <StatCard title="Students" value={summary.unique_students} icon={Users} gradient="from-purple-500 to-pink-500" iconBg="bg-gradient-to-br from-purple-500 to-pink-500" />
          <StatCard title="Total Due" value={formatCurrency(summary.total_due)} icon={AlertCircle} gradient="from-red-500 to-rose-500" iconBg="bg-gradient-to-br from-red-500 to-rose-500" />
          <StatCard title="Overdue" value={summary.overdue_students} icon={AlertCircle} gradient="from-rose-500 to-red-600" iconBg="bg-gradient-to-br from-rose-500 to-red-600" />
        </div>

        {/* Payment Method Breakdown */}
        <div className="grid gap-3 grid-cols-4 print:hidden">
          <Card className="border-0 shadow-sm bg-gradient-to-br from-pink-50 to-rose-50"><CardContent className="p-3"><div className="flex justify-between"><div className="flex gap-2"><Smartphone className="h-4 w-4 text-pink-600" /><span>bKash</span></div><span className="font-bold">{formatCurrency(summary.bkash_total)}</span></div></CardContent></Card>
          <Card className="border-0 shadow-sm bg-gradient-to-br from-purple-50 to-indigo-50"><CardContent className="p-3"><div className="flex justify-between"><div className="flex gap-2"><Smartphone className="h-4 w-4 text-purple-600" /><span>Nagad</span></div><span className="font-bold">{formatCurrency(summary.nagad_total)}</span></div></CardContent></Card>
          <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-cyan-50"><CardContent className="p-3"><div className="flex justify-between"><div className="flex gap-2"><Building2 className="h-4 w-4 text-blue-600" /><span>Bank</span></div><span className="font-bold">{formatCurrency(summary.bank_total)}</span></div></CardContent></Card>
          <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-teal-50"><CardContent className="p-3"><div className="flex justify-between"><Landmark className="h-4 w-4 text-emerald-600" /><span>Cash</span><span className="font-bold">{formatCurrency(summary.cash_total)}</span></div></CardContent></Card>
        </div>

        {/* Transactions Table - Updated with Due column */}
        <Card className="border-0 shadow-md overflow-hidden rounded-xl">
          <CardHeader className="py-3 px-4 bg-gradient-to-r from-blue-500/10 to-transparent border-b border-border/50">
            <div className="flex justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2"><div className="p-1 rounded bg-gradient-to-r from-blue-500 to-cyan-500"><Receipt className="h-3 w-3 text-white" /></div>Payment Transactions</CardTitle>
              <div className="text-xs text-muted-foreground">{filteredTransactions.length} records found</div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {filteredTransactions.length === 0 ? (
              <div className="text-center py-10">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-3"><Receipt className="h-6 w-6 text-muted-foreground" /></div>
                <p className="text-sm text-muted-foreground">No transactions found for {selectedDate}</p>
                <p className="text-xs text-muted-foreground mt-1">Try selecting a different date or add a payment first</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Receipt</TableHead><TableHead>Student</TableHead><TableHead>Admission</TableHead><TableHead>Class</TableHead>
                      <TableHead>Category</TableHead><TableHead className="text-right">Discount</TableHead>
                      <TableHead className="text-right">Fine</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Due</TableHead>
                      <TableHead>Method</TableHead><TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.map((tx) => {
                      const methodBadge = getPaymentMethodBadge(tx.payment_method)
                      const MethodIcon = methodBadge.icon
                      return (
                        <TableRow key={tx.id} className="group hover:bg-muted/30">
                          <TableCell><span className="font-mono text-xs">{tx.receipt_no}</span></TableCell>
                          <TableCell><div><p className="font-medium text-sm">{tx.student_name}</p><p className="text-[10px] text-muted-foreground">{tx.father_name || "-"}</p></div></TableCell>
                          <TableCell><span className="font-mono text-xs">{tx.admission_no}</span></TableCell>
                          <TableCell>{tx.class_name}</TableCell>
                          <TableCell>{tx.fee_category}</TableCell>
                          <TableCell className="text-right text-red-600">{formatCurrency(tx.discount)}</TableCell>
                          <TableCell className="text-right text-orange-600">{formatCurrency(tx.fine)}</TableCell>
                          <TableCell className="text-right font-semibold text-emerald-600">{formatCurrency(tx.amount)}</TableCell>
                          <TableCell className="text-right font-semibold text-red-600">{formatCurrency(tx.remaining_due || 0)}</TableCell>
                          <TableCell><Badge className={`bg-gradient-to-r ${methodBadge.gradient} text-white px-2 py-0.5 text-[10px]`}><MethodIcon className="h-2.5 w-2.5" />{methodBadge.label}</Badge></TableCell>
                          <TableCell><Button size="sm" variant="ghost" onClick={() => { setPreviewReceipt(tx); setShowPreview(true) }} className="h-7 w-7 p-0 text-blue-600"><Eye className="h-3.5 w-3.5" /></Button></TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {filteredTransactions.length > 0 && (
          <Card className="border-0 shadow-sm bg-gradient-to-r from-slate-100 to-slate-50 print:hidden">
            <CardContent className="p-3">
              <div className="flex flex-wrap justify-between gap-3">
                <div className="flex gap-4">
                  <div><p className="text-[10px] text-muted-foreground">Total Transactions</p><p className="font-bold text-sm">{summary.total_transactions}</p></div>
                  <div><p className="text-[10px] text-muted-foreground">Unique Students</p><p className="font-bold text-sm">{summary.unique_students}</p></div>
                  <div><p className="text-[10px] text-muted-foreground">Total Discount</p><p className="font-bold text-sm text-red-600">{formatCurrency(summary.total_discount)}</p></div>
                  <div><p className="text-[10px] text-muted-foreground">Total Fine</p><p className="font-bold text-sm text-orange-600">{formatCurrency(summary.total_fine)}</p></div>
                  <div><p className="text-[10px] text-muted-foreground">Total Due</p><p className="font-bold text-sm text-red-600">{formatCurrency(summary.total_due)}</p></div>
                </div>
                <div><p className="text-[10px] text-muted-foreground">Net Collection</p><p className="font-bold text-lg text-emerald-600">{formatCurrency(summary.total_collected)}</p></div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Receipt Preview Dialog - Updated with Due info */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-white dark:bg-slate-950">
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-4 text-white">
            <DialogHeader><DialogTitle className="text-white flex items-center gap-2"><Receipt className="h-5 w-5" />Payment Receipt</DialogTitle></DialogHeader>
          </div>
          {previewReceipt && (
             <div className="p-5 space-y-4">
               <div className="text-center border-b pb-3"><h3 className="font-bold text-lg">{schoolSettings.school_name || "School Name"}</h3><p className="text-xs">Payment Receipt</p></div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Receipt No:</span><span className="font-mono">{previewReceipt.receipt_no}</span></div>
                <div className="flex justify-between"><span>Date:</span><span>{new Date(previewReceipt.payment_date).toLocaleDateString()}</span></div>
                <div className="flex justify-between"><span>Student:</span><span className="font-medium">{previewReceipt.student_name}</span></div>
                <div className="flex justify-between"><span>Admission:</span><span>{previewReceipt.admission_no}</span></div>
                <div className="flex justify-between"><span>Class:</span><span>{previewReceipt.class_name}</span></div>
              </div>
              <div className="border-t border-b py-2 space-y-1">
                <div className="flex justify-between"><span>Previous Due:</span><span>{formatCurrency(previewReceipt.previous_due)}</span></div>
                {previewReceipt.discount > 0 && <div className="flex justify-between text-red-600"><span>Discount:</span><span>- {formatCurrency(previewReceipt.discount)}</span></div>}
                {previewReceipt.fine > 0 && <div className="flex justify-between text-orange-600"><span>Late Fine:</span><span>+ {formatCurrency(previewReceipt.fine)}</span></div>}
                <div className="flex justify-between pt-1 border-t font-bold"><span>Amount Paid:</span><span className="text-emerald-600">{formatCurrency(previewReceipt.amount)}</span></div>
                <div className="flex justify-between"><span>Remaining Due:</span><span className="text-red-600">{formatCurrency(previewReceipt.remaining_due || 0)}</span></div>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span>Payment Method:</span><span className="capitalize">{previewReceipt.payment_method}</span></div>
                <div className="flex justify-between"><span>Received By:</span><span>System</span></div>
              </div>
              <div className="text-center pt-3 border-t"><p className="text-[10px]">Thank you for your payment</p></div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </ResponsiveLayout>
  )
}