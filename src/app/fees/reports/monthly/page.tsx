"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Download,
  Loader2,
  TrendingUp,
  Calendar,
  Wallet,
  Users,
  Receipt,
  Search,
  RefreshCw,
  Eye,
  Printer,
  FileText,
  AlertCircle,
  X,
  School,
  BookOpen,
  Layers,
  Filter,
  User,
  Hash,
  UserRound,
  Smartphone,
  Landmark,
  Building2,
  CheckCircle,
  Clock,
  XCircle,
  CreditCard,
  Banknote,
   Coins,
   ChevronLeft,
   ChevronRight,
 } from "lucide-react"

import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

import { ResponsiveLayout } from "@/components/layout/responsive-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { getSchoolPrintHeader } from "@/components/print/SchoolPrintHeader"
import { formatCurrency } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { getAllPaymentsWithAllocation, buildDescriptionFromAllocations } from "@/lib/api/fees-dynamic"
import { toast } from "sonner"

const supabase = createClient()

// School Settings Interface
interface SchoolSettings {
  name: string
  address: string
  phone: string
  email: string
  school_logo: string
  tagline: string
}

const DEFAULT_SETTINGS: SchoolSettings = {
  name: "Cherag Ali Memorial Academy",
  address: "Dhaka, Bangladesh",
  phone: "+880XXXXXXXXX",
  email: "info@cheragali.edu.bd",
  school_logo: "",
  tagline: "Quality Education for Better Future",
}

interface AcademicYear {
  id: string
  name: string
  start_date: string
  end_date: string
  is_active: boolean
}

interface ClassItem {
  id: string
  name: string
  numeric_order: number
}

interface SectionItem {
  id: string
  name: string
  class_id: string
}

// 🆕 Updated MonthlyData with due info
interface MonthlyData {
  month: string
  month_key: string
  year: number
  total_collected: number
  transaction_count: number
  students_count: number
  discount_total: number
  fine_total: number
  cash_total: number
  bkash_total: number
  nagad_total: number
  bank_total: number
  percentage: number
  // 🆕 New fields
  total_due: number
  due_students: number
  overdue_students: number
}

// 🆕 Updated TransactionDetail with due info
interface TransactionDetail {
  id: string
  receipt_no: string
  payment_date: string
  student_name: string
  admission_no: string
  class_roll: string
  class_name: string
  section_name: string
  father_name: string
  mother_name: string
  phone: string
  fee_category: string
  total_fee: number
  discount_amount: number
  fine_amount: number
  paid_amount: number
  due_amount: number
  status: string
  payment_method: string
  student_photo_url?: string
  photo_url?: string
  // 🆕 New fields
  month?: string
  total_due?: number
  overdue_status?: string
}

interface SearchFilters {
  name: string
  admission_no: string
  class_roll: string
  father_name: string
  mother_name: string
  phone: string
  receipt_no: string
}

// Payment method configs
const paymentMethodConfigs = {
  cash: { icon: Banknote, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/30", label: "Cash" },
  bkash: { icon: Smartphone, color: "text-pink-600 dark:text-pink-400", bg: "bg-pink-50 dark:bg-pink-950/30", label: "bKash" },
  nagad: { icon: Smartphone, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-950/30", label: "Nagad" },
  bank: { icon: Building2, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/30", label: "Bank" },
}

export default function MonthlyReportPage() {
  // State declarations
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([])
  const [transactions, setTransactions] = useState<TransactionDetail[]>([])
  const [filteredTransactions, setFilteredTransactions] = useState<TransactionDetail[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [sections, setSections] = useState<SectionItem[]>([])
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [exportingPDF, setExportingPDF] = useState(false)
  const [printingSummary, setPrintingSummary] = useState(false)
  const [printingTransactions, setPrintingTransactions] = useState(false)

  // 📄 Pagination computed values
  const totalPages = Math.ceil(filteredTransactions.length / pageSize)
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  // Filter states
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>("")
  const [selectedMonth, setSelectedMonth] = useState("")
  const [selectedClass, setSelectedClass] = useState<string>("all")
  const [selectedSection, setSelectedSection] = useState<string>("all")
  
  // Search states
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    name: "", admission_no: "", class_roll: "", father_name: "", mother_name: "", phone: "", receipt_no: "",
  })
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false)

  // Receipt Dialog state
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionDetail | null>(null)
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false)

  // Summary state - Updated with due info
  const [summary, setSummary] = useState({
    total_collected: 0,
    total_discount: 0,
    total_fine: 0,
    total_transactions: 0,
    unique_students: 0,
    average_monthly: 0,
    peak_month: "",
    peak_amount: 0,
    cash_total: 0,
    bkash_total: 0,
    nagad_total: 0,
    bank_total: 0,
    // 🆕 New fields
    total_due: 0,
    overdue_students: 0,
    total_overdue_amount: 0,
  })

  // Load initial data
  useEffect(() => {
    loadSchoolSettings()
    loadAcademicYears()
    loadClasses()
    loadSections()
  }, [])

  async function loadSchoolSettings() {
    try {
      const { data, error } = await supabase.from("school_settings").select("*").single()
      if (!error && data) {
        setSchoolSettings({
          name: data.school_name || DEFAULT_SETTINGS.name,
          address: data.school_address || DEFAULT_SETTINGS.address,
          phone: data.school_phone || DEFAULT_SETTINGS.phone,
          email: data.school_email || DEFAULT_SETTINGS.email,
          school_logo: data.school_logo || data.logo_url || DEFAULT_SETTINGS.school_logo,
          tagline: data.tagline || DEFAULT_SETTINGS.tagline,
        })
      }
    } catch (err) { console.error("Error loading school settings:", err) }
  }

  async function loadAcademicYears() {
    try {
      const { data, error } = await supabase.from("academic_years").select("*").order("start_date", { ascending: false })
      if (error) throw error
      if (data && data.length > 0) {
        setAcademicYears(data)
        const activeYear = data.find(y => y.is_active)
        setSelectedAcademicYear(activeYear ? activeYear.id : data[0].id)
      }
    } catch (err: any) { toast.error("Failed to load academic years") }
  }

  async function loadClasses() {
    try {
      const { data, error } = await supabase.from("classes").select("id, name, numeric_order").order("numeric_order", { ascending: true })
      if (error) throw error
      if (data) setClasses(data)
    } catch (err: any) { toast.error("Failed to load classes") }
  }

  async function loadSections() {
    try {
      const { data, error } = await supabase.from("sections").select("id, name, class_id")
      if (error) throw error
      if (data) setSections(data)
    } catch (err: any) { toast.error("Failed to load sections") }
  }

  const getFilteredSections = useCallback(() => {
    if (selectedClass === "all") return sections
    return sections.filter(s => s.class_id === selectedClass)
  }, [selectedClass, sections])

  // 🆕 Load monthly due data
  const loadMonthlyDueData = useCallback(async (monthKey: string) => {
    try {
      const [year, month] = monthKey.split("-")
      const startDate = `${year}-${month}-01`
      const lastDay = new Date(Number(year), Number(month), 0).getDate()
      const endDate = `${year}-${month}-${lastDay}`

      const { data: dues, error } = await supabase
        .from('student_fee_dues')
        .select('student_id, due_amount, status')
        .gte('due_date', startDate)
        .lte('due_date', endDate)
        .gt('due_amount', 0)

      if (error) {
        console.error('Error loading due data:', error)
        return { total_due: 0, due_students: 0, overdue_students: 0 }
      }

      const totalDue = dues?.reduce((sum, d) => sum + (d.due_amount || 0), 0) || 0
      const dueStudents = new Set(dues?.map(d => d.student_id)).size
      const overdueStudents = dues?.filter(d => d.status === 'overdue').length || 0

      return { total_due: totalDue, due_students: dueStudents, overdue_students: overdueStudents }
    } catch (error) {
      console.error('Error in loadMonthlyDueData:', error)
      return { total_due: 0, due_students: 0, overdue_students: 0 }
    }
  }, [])

  // Load monthly summary data
  const loadMonthlySummary = useCallback(async () => {
    try {
      setLoading(true)

      const payments = await getAllPaymentsWithAllocation()

      const monthlyMap = new Map()
      const currentYear = new Date().getFullYear()
      for (let i = 1; i <= 12; i++) {
        const key = `${currentYear}-${String(i).padStart(2, "0")}`
        monthlyMap.set(key, { 
          total: 0, discount: 0, fine: 0, count: 0, 
          students: new Set<string>(), cash: 0, bkash: 0, nagad: 0, bank: 0,
          // 🆕 New fields
          total_due: 0, due_students: new Set<string>(), overdue_students: 0
        })
      }

      let totalCollection = 0, totalDiscount = 0, totalFine = 0, totalTransactions = 0
      const allStudents = new Set<string>()
      let totalDue = 0
      let totalOverdueStudents = 0

      for (const p of payments || []) {
        const month = p.payment_date?.substring(0, 7)
        if (!month || !monthlyMap.has(month)) continue
        const existing = monthlyMap.get(month)
        const amount = Number(p.amount || 0)
        existing.total += amount
        existing.discount += Number(p.discount_amount || 0)
        existing.fine += Number(p.fine_amount || 0)
        existing.count += 1
        existing.students.add(p.student_id)
        totalCollection += amount
        totalDiscount += Number(p.discount_amount || 0)
        totalFine += Number(p.fine_amount || 0)
        totalTransactions += 1
        allStudents.add(p.student_id)
        if (p.payment_method === "cash") existing.cash += amount
        else if (p.payment_method === "bkash") existing.bkash += amount
        else if (p.payment_method === "nagad") existing.nagad += amount
        else if (p.payment_method === "bank") existing.bank += amount
      }

      // 🆕 Load due data for each month
      for (const [key, item] of monthlyMap) {
        const dueData = await loadMonthlyDueData(key)
        item.total_due = dueData.total_due
        item.overdue_students = dueData.overdue_students
        dueData.due_students > 0 && item.due_students.add(key)
        totalDue += dueData.total_due
        totalOverdueStudents += dueData.overdue_students
      }

      const result: MonthlyData[] = []
      let peakMonth = "", peakAmount = 0

      for (const [key, item] of monthlyMap) {
        const [year, month] = key.split("-")
        const monthName = new Date(Number(year), Number(month) - 1, 1).toLocaleString("default", { month: "long" })
        if (item.total > peakAmount) { peakAmount = item.total; peakMonth = monthName }
        result.push({
          month: monthName,
          month_key: key,
          year: Number(year),
          total_collected: item.total,
          transaction_count: item.count,
          students_count: item.students.size,
          discount_total: item.discount,
          fine_total: item.fine,
          cash_total: item.cash,
          bkash_total: item.bkash,
          nagad_total: item.nagad,
          bank_total: item.bank,
          percentage: 0,
          // 🆕 New fields
          total_due: item.total_due,
          due_students: item.due_students.size,
          overdue_students: item.overdue_students,
        })
      }

      const yearlyTotal = result.reduce((sum, item) => sum + item.total_collected, 0)
      result.forEach((item) => { item.percentage = yearlyTotal > 0 ? (item.total_collected / yearlyTotal) * 100 : 0 })

      setMonthlyData(result)
      setSummary({
        total_collected: totalCollection,
        total_discount: totalDiscount,
        total_fine: totalFine,
        total_transactions: totalTransactions,
        unique_students: allStudents.size,
        average_monthly: yearlyTotal / (result.length || 1),
        peak_month: peakMonth,
        peak_amount: peakAmount,
        cash_total: result.reduce((s, d) => s + d.cash_total, 0),
        bkash_total: result.reduce((s, d) => s + d.bkash_total, 0),
        nagad_total: result.reduce((s, d) => s + d.nagad_total, 0),
        bank_total: result.reduce((s, d) => s + d.bank_total, 0),
        // 🆕 New fields
        total_due: totalDue,
        overdue_students: totalOverdueStudents,
        total_overdue_amount: totalDue,
      })
    } catch (err: any) {
      toast.error(err?.message || "Failed to load report")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [loadMonthlyDueData])

  // Load month details - Updated with due info
  const loadMonthDetails = useCallback(async (monthKey: string) => {
    if (!monthKey || !monthKey.includes("-")) { toast.error("Invalid month selection"); return }
    try {
      setLoading(true)
      const [year, month] = monthKey.split("-")
      const startDate = `${year}-${month}-01`
      const lastDay = new Date(Number(year), Number(month), 0).getDate()
      const endDate = `${year}-${month}-${lastDay}`

      const payments = await getAllPaymentsWithAllocation({
        dateFrom: startDate,
        dateTo: endDate
      })

      // 🆕 Get due data for this month
      const { data: dues } = await supabase
        .from('student_fee_dues')
        .select('student_id, due_amount, status')
        .gte('due_date', startDate)
        .lte('due_date', endDate)
        .gt('due_amount', 0)

      const dueMap = new Map()
      dues?.forEach(d => {
        dueMap.set(d.student_id, { due_amount: d.due_amount, status: d.status })
      })

      if (!payments || payments.length === 0) {
        setTransactions([])
        setFilteredTransactions([])
        setLoading(false)
        return
      }

      const formatted: TransactionDetail[] = payments.map((p: any) => {
        const student = p.student || {}
        const dueInfo = dueMap.get(p.student_id)
        return {
          id: p.id,
          receipt_no: p.receipt_no || `RCP-${p.id.slice(0, 8)}`,
          payment_date: p.payment_date,
          student_name: student?.name || "Unknown",
          admission_no: student?.student_id || "",
          class_roll: student?.class_roll || "",
          class_name: student?.class_name || "N/A",
          section_name: student?.section_name || "N/A",
          father_name: student?.father_name || "",
          mother_name: student?.mother_name || "",
          phone: student?.contact || "",
          fee_category: buildDescriptionFromAllocations(p.allocations),
          total_fee: Number(p.amount) || 0,
          discount_amount: Number(p.discount_amount || 0),
          fine_amount: Number(p.fine_amount || 0),
          paid_amount: Number(p.amount || 0),
          due_amount: dueInfo?.due_amount || 0,
          status: dueInfo?.status || "paid",
          payment_method: p.payment_method || "cash",
          student_photo_url: student?.student_photo_url || student?.photo_url,
          // 🆕 New fields
          month: monthKey,
          total_due: dueInfo?.due_amount || 0,
          overdue_status: dueInfo?.status === 'overdue' ? 'Overdue' : 'Current',
        }
      })

      setTransactions(formatted)
      filterTransactions(formatted)
    } catch (err: any) {
      toast.error(err?.message || "Failed to load transactions")
      setTransactions([])
      setFilteredTransactions([])
    } finally {
      setLoading(false)
    }
  }, [selectedClass, selectedSection, selectedAcademicYear])

  const filterTransactions = useCallback((data: TransactionDetail[]) => {
    let filtered = [...data]
    if (searchFilters.name) filtered = filtered.filter(t => t.student_name.toLowerCase().includes(searchFilters.name.toLowerCase()))
    if (searchFilters.admission_no) filtered = filtered.filter(t => t.admission_no.toLowerCase().includes(searchFilters.admission_no.toLowerCase()))
    if (searchFilters.class_roll) filtered = filtered.filter(t => t.class_roll.toLowerCase().includes(searchFilters.class_roll.toLowerCase()))
    if (searchFilters.father_name) filtered = filtered.filter(t => t.father_name.toLowerCase().includes(searchFilters.father_name.toLowerCase()))
    if (searchFilters.mother_name) filtered = filtered.filter(t => t.mother_name.toLowerCase().includes(searchFilters.mother_name.toLowerCase()))
    if (searchFilters.phone) filtered = filtered.filter(t => t.phone.toLowerCase().includes(searchFilters.phone.toLowerCase()))
    if (searchFilters.receipt_no) filtered = filtered.filter(t => t.receipt_no.toLowerCase().includes(searchFilters.receipt_no.toLowerCase()))
    setFilteredTransactions(filtered)
  }, [searchFilters])

  const resetSearchFilters = () => {
    setSearchFilters({ name: "", admission_no: "", class_roll: "", father_name: "", mother_name: "", phone: "", receipt_no: "" })
    setFilteredTransactions(transactions)
  }

  useEffect(() => { loadMonthlySummary() }, [loadMonthlySummary])
  useEffect(() => { if (selectedMonth) loadMonthDetails(selectedMonth) }, [selectedMonth, loadMonthDetails])
  useEffect(() => { if (transactions.length > 0) filterTransactions(transactions) }, [searchFilters, transactions, filterTransactions])
  
  // 🔄 Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchFilters])

  const handleMonthClick = (monthKey: string) => { 
    if (selectedMonth === monthKey) {
      setSelectedMonth("")
      setTransactions([])
      setFilteredTransactions([])
    } else {
      setSelectedMonth(monthKey)
      resetSearchFilters()
    }
  }
  
  const handleAcademicYearChange = (yearId: string) => { 
    setSelectedAcademicYear(yearId); 
    setSelectedMonth(""); 
    setTransactions([]); 
    setFilteredTransactions([]) 
  }
  
  const handleClassChange = (classId: string) => { 
    setSelectedClass(classId); 
    setSelectedSection("all"); 
    setSelectedMonth(""); 
    setTransactions([]); 
    setFilteredTransactions([]) 
  }
  
  const handleSectionChange = (sectionId: string) => { 
    setSelectedSection(sectionId); 
    setSelectedMonth(""); 
    setTransactions([]); 
    setFilteredTransactions([]) 
  }

  // Open Receipt Dialog
  const openReceiptDialog = (transaction: TransactionDetail) => {
    setSelectedTransaction(transaction)
    setReceiptDialogOpen(true)
  }

  // ==================== PRINT RECEIPT ====================
  const printReceipt = (transaction: TransactionDetail) => {
    const printWindow = window.open("", "_blank")
    if (!printWindow) { 
      toast.error("Please allow popups to print"); 
      return 
    }

    printWindow.document.write(`<!DOCTYPE html><html><head><title>Payment Receipt</title><meta charset="UTF-8">
      <style>
        @page { size: A4; margin: 15mm; }
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; background: white; }
        .receipt { max-width: 700px; margin: 0 auto; border: 2px solid #e2e8f0; border-radius: 12px; padding: 30px; }
        .header { text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; margin-bottom: 20px; }
        .header h1 { font-size: 24px; color: #1e293b; margin: 0; }
        .header p { color: #64748b; margin: 5px 0; }
        .title { text-align: center; font-size: 18px; font-weight: bold; color: #1e293b; margin: 15px 0; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }
        .info-grid .label { color: #64748b; font-size: 12px; }
        .info-grid .value { font-weight: 500; }
        .breakdown { border-top: 2px solid #e2e8f0; border-bottom: 2px solid #e2e8f0; padding: 15px 0; margin: 15px 0; }
        .row { display: flex; justify-content: space-between; padding: 5px 0; }
        .total { display: flex; justify-content: space-between; padding: 10px 0; font-size: 18px; font-weight: bold; border-top: 2px solid #e2e8f0; margin-top: 10px; }
        .signature { display: flex; justify-content: space-between; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; }
        .sig-box { text-align: center; width: 45%; }
        .sig-box .line { border-bottom: 1px solid #94a3b8; width: 80%; margin: 5px auto; }
        .sig-box .label { font-size: 11px; color: #64748b; }
        .footer { text-align: center; font-size: 10px; color: #94a3b8; margin-top: 20px; padding-top: 15px; border-top: 1px solid #e2e8f0; }
        .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; color: white; }
        .badge-paid { background: #10b981; }
        .badge-partial { background: #f59e0b; }
        .badge-pending { background: #ef4444; }
        .badge-overdue { background: #dc2626; }
      </style>
    </head><body>
      <div class="receipt">
        <div class="header">
          <h1>${schoolSettings.name}</h1>
          <p>${schoolSettings.address}</p>
          <p>Phone: ${schoolSettings.phone} | Email: ${schoolSettings.email}</p>
        </div>
        <div class="title">Payment Receipt</div>
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
          <div><span class="label">Receipt No:</span> <span class="value">${transaction.receipt_no}</span></div>
          <div><span class="label">Date:</span> <span class="value">${new Date(transaction.payment_date).toLocaleDateString()}</span></div>
        </div>
        
        <div style="margin-bottom: 15px;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
            <strong style="font-size: 16px;">${transaction.student_name}</strong>
            <span class="badge ${transaction.status === 'paid' ? 'badge-paid' : transaction.status === 'partial' ? 'badge-partial' : transaction.status === 'overdue' ? 'badge-overdue' : 'badge-pending'}">${transaction.status === 'paid' ? 'Fully Paid' : transaction.status === 'partial' ? 'Partial' : transaction.status === 'overdue' ? 'Overdue' : 'Pending'}</span>
          </div>
          <div class="info-grid">
            <div><span class="label">Student ID:</span> <span class="value">${transaction.admission_no || 'N/A'}</span></div>
            <div><span class="label">Roll No:</span> <span class="value">${transaction.class_roll || 'N/A'}</span></div>
            <div><span class="label">Class:</span> <span class="value">${transaction.class_name}${transaction.section_name ? ` (${transaction.section_name})` : ''}</span></div>
            <div><span class="label">Guardian:</span> <span class="value">${transaction.father_name || 'N/A'}</span></div>
          </div>
        </div>
        
        <div class="breakdown">
          <div class="row"><span>Fee Category:</span> <span>${transaction.fee_category}</span></div>
          <div class="row"><span>Payment Method:</span> <span>${transaction.payment_method.charAt(0).toUpperCase() + transaction.payment_method.slice(1)}</span></div>
          ${transaction.discount_amount > 0 ? `<div class="row" style="color: #dc2626;"><span>Discount:</span> <span>- ${formatCurrency(transaction.discount_amount)}</span></div>` : ''}
          ${transaction.fine_amount > 0 ? `<div class="row" style="color: #ea580c;"><span>Late Fine:</span> <span>+ ${formatCurrency(transaction.fine_amount)}</span></div>` : ''}
          <div class="total"><span>Amount Paid:</span> <span style="color: #059669;">${formatCurrency(transaction.paid_amount)}</span></div>
          ${transaction.due_amount > 0 ? `<div class="row" style="color: #dc2626;"><span>Remaining Due:</span> <span>${formatCurrency(transaction.due_amount)}</span></div>` : ''}
        </div>
        
        <div class="signature">
          <div class="sig-box"><div class="line"></div><div class="label">Cashier Signature</div></div>
          <div class="sig-box"><div class="line"></div><div class="label">Guardian Signature</div></div>
        </div>
        
        <div class="footer"><p>This is a computer generated receipt. Valid without signature.</p></div>
      </div>
    </body></html>`)
    
    printWindow.document.close()
    
    printWindow.onafterprint = function() {
      printWindow.close()
      toast.success("Receipt printed successfully")
    }
    
    printWindow.print()
    
    setTimeout(() => {
      if (printWindow && !printWindow.closed) {
        printWindow.close()
      }
    }, 30000)
  }

  // ==================== PRINT SUMMARY REPORT ====================
  const printSummaryReport = () => {
    setPrintingSummary(true)
    const printWindow = window.open("", "_blank")
    if (!printWindow) { 
      toast.error("Please allow popups to print"); 
      setPrintingSummary(false); 
      return 
    }

    const summaryRows = monthlyData.map(item => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${item.month}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">${item.total_collected.toLocaleString()} ৳</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">${item.discount_total.toLocaleString()} ৳</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">${item.fine_total.toLocaleString()} ৳</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">${item.transaction_count}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">${item.students_count}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #dc2626;">${item.total_due.toLocaleString()} ৳</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">${item.percentage.toFixed(1)}%</td>
      </tr>
    `).join("")

    printWindow.document.write(`<!DOCTYPE html><html><head><title>Monthly Summary Report</title><meta charset="UTF-8">
      <style>
        @page { size: landscape; margin: 15mm; }
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; }
        .summary-cards { display: flex; justify-content: space-between; margin: 20px 0; background: #f1f5f9; padding: 15px; border-radius: 8px; flex-wrap: wrap; }
        .summary-card { text-align: center; flex: 1; min-width: 80px; }
        .payment-methods { display: flex; justify-content: space-between; margin: 15px 0; padding: 12px; background: #f8fafc; border-radius: 8px; flex-wrap: wrap; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th { background: #e2e8f0; padding: 10px; border: 1px solid #cbd5e1; }
        td { padding: 8px; border: 1px solid #e2e8f0; }
        .footer { margin-top: 25px; text-align: center; font-size: 9px; border-top: 1px solid #e2e8f0; padding-top: 15px; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .text-due { color: #dc2626; }
      </style>
    </head><body>
      ${getSchoolPrintHeader({ 
        school_name: schoolSettings.name, 
        school_address: schoolSettings.address, 
        school_phone: schoolSettings.phone, 
        school_email: schoolSettings.email, 
        school_logo: schoolSettings.school_logo 
      }, "Monthly Collection Summary Report")}
      <div class="summary-cards">
        <div class="summary-card"><strong>Total Collection</strong><br/>${summary.total_collected.toLocaleString()} ৳</div>
        <div class="summary-card"><strong>Monthly Average</strong><br/>${summary.average_monthly.toLocaleString()} ৳</div>
        <div class="summary-card"><strong>Transactions</strong><br/>${summary.total_transactions}</div>
        <div class="summary-card"><strong>Students</strong><br/>${summary.unique_students}</div>
        <div class="summary-card"><strong>Peak Month</strong><br/>${summary.peak_month}<br/>${summary.peak_amount.toLocaleString()} ৳</div>
        <div class="summary-card"><strong>Total Due</strong><br/><span style="color:#dc2626;">${summary.total_due.toLocaleString()} ৳</span></div>
        <div class="summary-card"><strong>Overdue</strong><br/><span style="color:#dc2626;">${summary.overdue_students}</span></div>
      </div>
      <div class="payment-methods">
        <div><strong>Cash</strong><br/>${summary.cash_total.toLocaleString()} ৳</div>
        <div><strong>bKash</strong><br/>${summary.bkash_total.toLocaleString()} ৳</div>
        <div><strong>Nagad</strong><br/>${summary.nagad_total.toLocaleString()} ৳</div>
        <div><strong>Bank</strong><br/>${summary.bank_total.toLocaleString()} ৳</div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Month</th><th>Collection</th><th>Discount</th><th>Fine</th>
            <th>Transactions</th><th>Students</th><th>Due</th><th>%</th>
          </tr>
        </thead>
        <tbody>
          ${summaryRows}
          <tr style="background:#f1f5f9;font-weight:bold">
            <td>Total</td>
            <td class="text-right">${monthlyData.reduce((s, d) => s + d.total_collected, 0).toLocaleString()} ৳</td>
            <td class="text-right">${monthlyData.reduce((s, d) => s + d.discount_total, 0).toLocaleString()} ৳</td>
            <td class="text-right">${monthlyData.reduce((s, d) => s + d.fine_total, 0).toLocaleString()} ৳</td>
            <td class="text-center">${monthlyData.reduce((s, d) => s + d.transaction_count, 0)}</td>
            <td class="text-center">${monthlyData.reduce((s, d) => s + d.students_count, 0)}</td>
            <td class="text-right text-due">${monthlyData.reduce((s, d) => s + d.total_due, 0).toLocaleString()} ৳</td>
            <td class="text-center">100%</td>
          </tr>
        </tbody>
      </table>
      <div class="footer"><p>This is a computer generated report</p></div>
    </body></html>`)
    
    printWindow.document.close()
    
    printWindow.onafterprint = function() {
      printWindow.close()
      setPrintingSummary(false)
      toast.success("Summary printed successfully")
    }
    
    printWindow.print()
    
    setTimeout(() => {
      if (printWindow && !printWindow.closed) {
        printWindow.close()
        setPrintingSummary(false)
      }
    }, 60000)
  }

  // ==================== PDF SUMMARY REPORT ====================
  const pdfSummaryReport = async () => {
    setExportingPDF(true)
    try {
      const academicYear = academicYears.find(y => y.id === selectedAcademicYear)
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
      
      pdf.setFontSize(18); pdf.setTextColor(30, 58, 138); pdf.text(schoolSettings.name, 148, 20, { align: "center" })
      pdf.setFontSize(12); pdf.setTextColor(71, 85, 105); pdf.text("Monthly Collection Summary Report", 148, 30, { align: "center" })
      pdf.setFontSize(9); pdf.text(`${academicYear?.name || ""} | Generated: ${new Date().toLocaleDateString()}`, 148, 38, { align: "center" })

      pdf.setFillColor(241, 245, 249); pdf.rect(15, 48, 267, 25, "F")
      pdf.setFontSize(9); pdf.setTextColor(100, 116, 139)
      pdf.text("Total Collection", 35, 56); pdf.text("Monthly Average", 85, 56)
      pdf.text("Transactions", 135, 56); pdf.text("Students", 185, 56); pdf.text("Peak Month", 235, 56)
      pdf.setFontSize(10); pdf.setTextColor(0, 0, 0)
      pdf.text(`${summary.total_collected.toLocaleString()} ৳`, 35, 66)
      pdf.text(`${summary.average_monthly.toLocaleString()} ৳`, 85, 66)
      pdf.text(summary.total_transactions.toString(), 135, 66)
      pdf.text(summary.unique_students.toString(), 185, 66)
      pdf.text(`${summary.peak_month}`, 235, 66)

      // 🆕 Add due row
      pdf.setFillColor(254, 226, 226); pdf.rect(15, 75, 267, 10, "F")
      pdf.setFontSize(9); pdf.setTextColor(220, 38, 38)
      pdf.text("Total Due", 35, 83)
      pdf.text(`${summary.total_due.toLocaleString()} ৳`, 85, 83)
      pdf.text(`Overdue Students: ${summary.overdue_students}`, 135, 83)

      pdf.setFillColor(248, 250, 252); pdf.rect(15, 88, 267, 15, "F")
      pdf.setFontSize(9); pdf.setTextColor(100, 116, 139)
      pdf.text("Cash", 40, 98); pdf.text("bKash", 110, 98); pdf.text("Nagad", 180, 98); pdf.text("Bank", 250, 98)
      pdf.setFontSize(10); pdf.text(`${summary.cash_total.toLocaleString()} ৳`, 35, 106)
      pdf.text(`${summary.bkash_total.toLocaleString()} ৳`, 105, 106)
      pdf.text(`${summary.nagad_total.toLocaleString()} ৳`, 175, 106)
      pdf.text(`${summary.bank_total.toLocaleString()} ৳`, 245, 106)

      const tableData = monthlyData.map(item => [
        item.month,
        `${item.total_collected.toLocaleString()} ৳`,
        `${item.discount_total.toLocaleString()} ৳`,
        `${item.fine_total.toLocaleString()} ৳`,
        item.transaction_count.toString(),
        item.students_count.toString(),
        `${item.total_due.toLocaleString()} ৳`,
        `${item.percentage.toFixed(1)}%`
      ])
      tableData.push([
        "TOTAL",
        `${monthlyData.reduce((s, d) => s + d.total_collected, 0).toLocaleString()} ৳`,
        `${monthlyData.reduce((s, d) => s + d.discount_total, 0).toLocaleString()} ৳`,
        `${monthlyData.reduce((s, d) => s + d.fine_total, 0).toLocaleString()} ৳`,
        monthlyData.reduce((s, d) => s + d.transaction_count, 0).toString(),
        monthlyData.reduce((s, d) => s + d.students_count, 0).toString(),
        `${monthlyData.reduce((s, d) => s + d.total_due, 0).toLocaleString()} ৳`,
        "100%"
      ])

      autoTable(pdf, {
        startY: 105,
        head: [["Month", "Collection", "Discount", "Fine", "Transactions", "Students", "Due", "%"]],
        body: tableData,
        theme: "striped",
        headStyles: { fillColor: [226, 232, 240], fontStyle: "bold" },
        styles: { fontSize: 8, cellPadding: 4 },
        columnStyles: { 6: { textColor: [220, 38, 38] } },
        didDrawPage: (data: any) => {
          pdf.setFontSize(8); pdf.setTextColor(148, 163, 184)
          pdf.text(schoolSettings.address, 148, data.cursor.y + 10, { align: "center" })
        }
      })
      pdf.save(`monthly-summary-report-${new Date().getFullYear()}.pdf`)
      toast.success("PDF exported successfully!")
    } catch (error) { 
      toast.error("Failed to generate PDF") 
      console.error(error)
    } finally {
      setExportingPDF(false)
    }
  }

  // ==================== PRINT TRANSACTIONS REPORT ====================
  const printTransactionsReport = () => {
    if (filteredTransactions.length === 0) { 
      toast.error("No transactions to print"); 
      return 
    }
    
    setPrintingTransactions(true)
    const printWindow = window.open("", "_blank")
    if (!printWindow) { 
      toast.error("Please allow popups to print"); 
      setPrintingTransactions(false); 
      return 
    }

    const selectedMonthData = monthlyData.find(m => m.month_key === selectedMonth)

    const transactionRows = filteredTransactions.map(tx => `
      <tr>
        <td style="padding: 6px;">${tx.receipt_no}</td>
        <td style="padding: 6px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 32px; height: 32px; border-radius: 50%; background: #e5e7eb; overflow: hidden; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              ${(tx.student_photo_url || tx.photo_url) ? 
                `<img src="${tx.student_photo_url || tx.photo_url}" alt="${tx.student_name}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'; this.parentNode.textContent='${tx.student_name.charAt(0)}'" />` : 
                tx.student_name.charAt(0)
              }
            </div>
            <div>${tx.student_name}<br/><small>${tx.admission_no} | Roll: ${tx.class_roll}</small></div>
          </div>
        </td>
        <td style="padding: 6px;">${tx.class_name}</td>
        <td style="padding: 6px;">${tx.fee_category}</td>
        <td style="padding: 6px; text-align: right;">${tx.total_fee.toLocaleString()} ৳</td>
        <td style="padding: 6px; text-align: right; color: #dc2626;">${tx.discount_amount.toLocaleString()} ৳</td>
        <td style="padding: 6px; text-align: right; color: #ea580c;">${tx.fine_amount.toLocaleString()} ৳</td>
        <td style="padding: 6px; text-align: right; font-weight: bold; color: #059669;">${tx.paid_amount.toLocaleString()} ৳</td>
        <td style="padding: 6px; text-align: right; color: #dc2626;">${tx.due_amount.toLocaleString()} ৳</td>
        <td style="padding: 6px;">${tx.payment_method}</td>
        <td style="padding: 6px;">
          <span style="background: ${tx.status === 'paid' ? '#059669' : tx.status === 'partial' ? '#d97706' : tx.status === 'overdue' ? '#dc2626' : '#6b7280'}; color: white; padding: 2px 8px; border-radius: 12px;">
            ${tx.status}
          </span>
        </td>
      </tr>
    `).join("")

    const totalPaid = filteredTransactions.reduce((sum, t) => sum + t.paid_amount, 0)
    const totalDiscount = filteredTransactions.reduce((sum, t) => sum + t.discount_amount, 0)
    const totalFine = filteredTransactions.reduce((sum, t) => sum + t.fine_amount, 0)
    const totalDue = filteredTransactions.reduce((sum, t) => sum + t.due_amount, 0)

    printWindow.document.write(`<!DOCTYPE html><html><head><title>Transactions Report</title><meta charset="UTF-8">
      <style>
        @page { size: landscape; margin: 12mm; }
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 15px; }
        .filters-info { background: #f8fafc; padding: 10px; margin: 15px 0; border-radius: 6px; display: flex; justify-content: space-between; flex-wrap: wrap; }
        table { width: 100%; border-collapse: collapse; font-size: 9px; }
        th { background: #e2e8f0; padding: 8px; border: 1px solid #cbd5e1; }
        td { padding: 6px; border: 1px solid #e2e8f0; }
        .summary-row { margin-top: 15px; padding: 10px; background: #f1f5f9; border-radius: 6px; display: flex; justify-content: space-between; flex-wrap: wrap; }
        .footer { margin-top: 20px; text-align: center; font-size: 8px; border-top: 1px solid #e2e8f0; padding-top: 12px; }
      </style>
    </head><body>
      ${getSchoolPrintHeader({ 
        school_name: schoolSettings.name, 
        school_address: schoolSettings.address, 
        school_phone: schoolSettings.phone, 
        school_email: schoolSettings.email, 
        school_logo: schoolSettings.school_logo 
      }, "Transaction Details Report")}
      <div class="filters-info">
        <span><strong>Class:</strong> ${selectedClass === "all" ? "All Classes" : classes.find(c => c.id === selectedClass)?.name || "All"}</span>
        <span><strong>Section:</strong> ${selectedSection === "all" ? "All Sections" : sections.find(s => s.id === selectedSection)?.name || "All"}</span>
        <span><strong>Month:</strong> ${selectedMonthData?.month || selectedMonth}</span>
        <span><strong>Records:</strong> ${filteredTransactions.length}</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Receipt</th><th>Student</th><th>Class</th><th>Category</th>
            <th>Amount</th><th>Discount</th><th>Fine</th><th>Paid</th>
            <th>Due</th><th>Method</th><th>Status</th>
          </tr>
        </thead>
        <tbody>${transactionRows}</tbody>
      </table>
      <div class="summary-row">
        <span>Total: ${filteredTransactions.length}</span>
        <span>Discount: ${totalDiscount.toLocaleString()} ৳</span>
        <span>Fine: ${totalFine.toLocaleString()} ৳</span>
        <span>Collected: ${totalPaid.toLocaleString()} ৳</span>
        <span style="color:#dc2626;">Due: ${totalDue.toLocaleString()} ৳</span>
      </div>
      <div class="footer"><p>Computer generated report</p></div>
    </body></html>`)
    
    printWindow.document.close()
    
    printWindow.onafterprint = function() {
      printWindow.close()
      setPrintingTransactions(false)
      toast.success("Transactions printed successfully")
    }
    
    printWindow.print()
    
    setTimeout(() => {
      if (printWindow && !printWindow.closed) {
        printWindow.close()
        setPrintingTransactions(false)
      }
    }, 60000)
  }

  // ==================== PDF TRANSACTIONS REPORT ====================
  const pdfTransactionsReport = async () => {
    if (filteredTransactions.length === 0) { 
      toast.error("No transactions to export"); 
      return 
    }
    
    setExportingPDF(true)
    try {
      const academicYear = academicYears.find(y => y.id === selectedAcademicYear)
      const selectedMonthData = monthlyData.find(m => m.month_key === selectedMonth)
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
      
      pdf.setFontSize(16); pdf.setTextColor(30, 58, 138); pdf.text(schoolSettings.name, 148, 20, { align: "center" })
      pdf.setFontSize(12); pdf.setTextColor(71, 85, 105); pdf.text("Transaction Details Report", 148, 30, { align: "center" })
      pdf.setFontSize(9); pdf.text(`${academicYear?.name || ""} | ${selectedMonthData?.month || selectedMonth} | Generated: ${new Date().toLocaleDateString()}`, 148, 38, { align: "center" })

      const tableData = filteredTransactions.map(tx => [
        tx.receipt_no,
        `${tx.student_name}\n${tx.admission_no}`,
        tx.class_name,
        tx.fee_category,
        `${tx.total_fee.toLocaleString()} ৳`,
        `${tx.discount_amount.toLocaleString()} ৳`,
        `${tx.fine_amount.toLocaleString()} ৳`,
        `${tx.paid_amount.toLocaleString()} ৳`,
        `${tx.due_amount.toLocaleString()} ৳`,
        tx.payment_method,
        tx.status
      ])
      const totalPaid = filteredTransactions.reduce((sum, t) => sum + t.paid_amount, 0)
      const totalDiscount = filteredTransactions.reduce((sum, t) => sum + t.discount_amount, 0)
      const totalFine = filteredTransactions.reduce((sum, t) => sum + t.fine_amount, 0)
      const totalDue = filteredTransactions.reduce((sum, t) => sum + t.due_amount, 0)

      autoTable(pdf, { 
        startY: 48, 
        head: [["Receipt", "Student", "Class", "Category", "Amount", "Discount", "Fine", "Paid", "Due", "Method", "Status"]], 
        body: tableData, 
        theme: "striped", 
        headStyles: { fillColor: [226, 232, 240], fontStyle: "bold" }, 
        styles: { fontSize: 7, cellPadding: 3 },
        columnStyles: { 8: { textColor: [220, 38, 38] } },
        didDrawPage: (data: any) => { 
          pdf.setFillColor(241, 245, 249); 
          pdf.rect(15, data.cursor.y + 8, 267, 10, "F"); 
          pdf.setFontSize(8); 
          pdf.text(`Total Collection: ${totalPaid.toLocaleString()} ৳`, 20, data.cursor.y + 14); 
          pdf.text(`Total Discount: ${totalDiscount.toLocaleString()} ৳`, 130, data.cursor.y + 14); 
          pdf.text(`Total Fine: ${totalFine.toLocaleString()} ৳`, 240, data.cursor.y + 14);
          pdf.text(`Total Due: ${totalDue.toLocaleString()} ৳`, 340, data.cursor.y + 14, { align: "right" });
          pdf.setFontSize(7); 
          pdf.setTextColor(148, 163, 184); 
          pdf.text(schoolSettings.address, 148, data.cursor.y + 25, { align: "center" }) 
        } 
      })
      
      pdf.save(`transactions-report-${selectedMonthData?.month || "monthly"}.pdf`)
      toast.success("PDF exported successfully!")
    } catch (error) { 
      toast.error("Failed to generate PDF") 
      console.error(error)
    } finally {
      setExportingPDF(false)
    }
  }

  const totalYearly = monthlyData.reduce((sum, d) => sum + d.total_collected, 0)
  const totalDueYearly = monthlyData.reduce((sum, d) => sum + d.total_due, 0)

  if (loading && monthlyData.length === 0) {
    return <ResponsiveLayout><div className="flex items-center justify-center h-[70vh]"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div></ResponsiveLayout>
  }

  return (
    <ResponsiveLayout>
      <div className="space-y-5 p-5 bg-gradient-to-br from-slate-50 via-white to-indigo-50/20 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-950/20">
        
        {/* Header with Print & PDF Buttons */}
        <div className="rounded-xl bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-700 p-5 text-white shadow-lg">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button asChild variant="secondary" size="icon" className="bg-white/10 hover:bg-white/20 text-white">
                <Link href="/fees/reports"><ArrowLeft className="h-4 w-4" /></Link>
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Monthly Collection Report</h1>
                <p className="text-white/80 text-sm">Collection analytics and transaction overview</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button 
                variant="secondary" 
                onClick={printSummaryReport} 
                disabled={printingSummary} 
                className="bg-white/20 text-white hover:bg-white/30"
              >
                <Printer className="h-4 w-4 mr-1" /> 
                {printingSummary ? "Printing..." : "Print Summary"}
              </Button>
              <Button 
                variant="secondary" 
                onClick={pdfSummaryReport} 
                disabled={exportingPDF} 
                className="bg-white/20 text-white hover:bg-white/30"
              >
                {exportingPDF ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileText className="h-4 w-4 mr-1" />}
                PDF Summary
              </Button>
            </div>
          </div>
        </div>

        {/* Filters - Academic Year, Class, Section only */}
        <Card className="border-0 shadow-md dark:bg-slate-800/50 dark:border-slate-700">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block dark:text-slate-300">Academic Year</label>
                <Select value={selectedAcademicYear} onValueChange={handleAcademicYearChange}>
                  <SelectTrigger className="dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200">
                    <School className="h-4 w-4 mr-2 text-indigo-500" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-slate-800 dark:border-slate-700">
                    {academicYears.map((year) => (
                      <SelectItem key={year.id} value={year.id} className="dark:text-slate-200">{year.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block dark:text-slate-300">Class</label>
                <Select value={selectedClass} onValueChange={handleClassChange}>
                  <SelectTrigger className="dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200">
                    <BookOpen className="h-4 w-4 mr-2 text-indigo-500" />
                    <SelectValue placeholder="All Classes" />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-slate-800 dark:border-slate-700">
                    <SelectItem value="all" className="dark:text-slate-200">All Classes</SelectItem>
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id} className="dark:text-slate-200">{cls.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block dark:text-slate-300">Section</label>
                <Select value={selectedSection} onValueChange={handleSectionChange}>
                  <SelectTrigger className="dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200">
                    <Layers className="h-4 w-4 mr-2 text-indigo-500" />
                    <SelectValue placeholder="All Sections" />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-slate-800 dark:border-slate-700">
                    <SelectItem value="all" className="dark:text-slate-200">All Sections</SelectItem>
                    {getFilteredSections().map((section) => (
                      <SelectItem key={section.id} value={section.id} className="dark:text-slate-200">{section.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Colorful Summary Cards - Updated with Due */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
            <CardContent className="p-3">
              <div className="flex justify-between">
                <div>
                  <p className="text-xs text-white/80">Total Collection</p>
                  <p className="text-lg font-bold">{formatCurrency(summary.total_collected)}</p>
                </div>
                <Wallet className="h-5 w-5 text-white/80" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-500 to-cyan-600 text-white">
            <CardContent className="p-3">
              <div className="flex justify-between">
                <div>
                  <p className="text-xs text-white/80">Transactions</p>
                  <p className="text-lg font-bold">{summary.total_transactions}</p>
                </div>
                <Receipt className="h-5 w-5 text-white/80" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-500 to-pink-600 text-white">
            <CardContent className="p-3">
              <div className="flex justify-between">
                <div>
                  <p className="text-xs text-white/80">Students</p>
                  <p className="text-lg font-bold">{summary.unique_students}</p>
                </div>
                <Users className="h-5 w-5 text-white/80" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-lg bg-gradient-to-br from-red-500 to-rose-600 text-white">
            <CardContent className="p-3">
              <div className="flex justify-between">
                <div>
                  <p className="text-xs text-white/80">Discount</p>
                  <p className="text-lg font-bold">{formatCurrency(summary.total_discount)}</p>
                </div>
                <TrendingUp className="h-5 w-5 text-white/80" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-lg bg-gradient-to-br from-orange-500 to-amber-600 text-white">
            <CardContent className="p-3">
              <div className="flex justify-between">
                <div>
                  <p className="text-xs text-white/80">Fine</p>
                  <p className="text-lg font-bold">{formatCurrency(summary.total_fine)}</p>
                </div>
                <AlertCircle className="h-5 w-5 text-white/80" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
            <CardContent className="p-3">
              <div className="flex justify-between">
                <div>
                  <p className="text-xs text-white/80">Peak Month</p>
                  <p className="text-sm font-bold">{summary.peak_month}</p>
                  <p className="text-xs text-white/80">{formatCurrency(summary.peak_amount)}</p>
                </div>
                <Calendar className="h-5 w-5 text-white/80" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-lg bg-gradient-to-br from-rose-500 to-red-600 text-white">
            <CardContent className="p-3">
              <div className="flex justify-between">
                <div>
                  <p className="text-xs text-white/80">Total Due</p>
                  <p className="text-lg font-bold">{formatCurrency(summary.total_due)}</p>
                </div>
                <AlertCircle className="h-5 w-5 text-white/80" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-lg bg-gradient-to-br from-teal-500 to-emerald-600 text-white">
            <CardContent className="p-3">
              <div className="flex justify-between">
                <div>
                  <p className="text-xs text-white/80">Monthly Avg</p>
                  <p className="text-lg font-bold">{formatCurrency(summary.average_monthly)}</p>
                </div>
                <TrendingUp className="h-5 w-5 text-white/80" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payment Methods - Dark Mode Compatible */}
        <div className="grid grid-cols-4 gap-3">
          {Object.entries(paymentMethodConfigs).map(([key, config]) => {
            const Icon = config.icon
            const amount = summary[`${key}_total` as keyof typeof summary] as number || 0
            return (
              <Card key={key} className={`border-0 shadow-md ${config.bg}`}>
                <CardContent className="p-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs dark:text-slate-400">{config.label}</span>
                    <span className={`font-bold text-sm ${config.color}`}>
                      <Icon className="h-3 w-3 inline mr-1" />
                      {formatCurrency(amount)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Monthly Summary Table - Updated with Due column */}
        <Card className="border-0 shadow-md overflow-hidden dark:bg-slate-800/50 dark:border-slate-700">
          <CardHeader className="py-3 px-4 bg-gradient-to-r from-indigo-500/10 to-transparent border-b dark:border-slate-700">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 dark:text-slate-200">
              <div className="p-1 rounded bg-gradient-to-r from-indigo-500 to-purple-500">
                <Calendar className="h-3 w-3 text-white" />
              </div>
              Monthly Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 dark:bg-slate-700/50">
                    <TableHead className="dark:text-slate-300">Month</TableHead>
                    <TableHead className="text-right dark:text-slate-300">Collection</TableHead>
                    <TableHead className="text-right dark:text-slate-300">Discount</TableHead>
                    <TableHead className="text-right dark:text-slate-300">Fine</TableHead>
                    <TableHead className="text-right dark:text-slate-300">Transactions</TableHead>
                    <TableHead className="text-right dark:text-slate-300">Students</TableHead>
                    <TableHead className="text-right dark:text-slate-300">Due</TableHead>
                    <TableHead className="text-right dark:text-slate-300">%</TableHead>
                    <TableHead className="text-center dark:text-slate-300">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthlyData.map((item) => (
                    <TableRow 
                      key={item.month_key} 
                      className={`cursor-pointer hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 ${selectedMonth === item.month_key ? 'bg-indigo-50 dark:bg-indigo-950/40' : ''}`} 
                      onClick={() => handleMonthClick(item.month_key)}
                    >
                      <TableCell className="font-medium dark:text-slate-200">{item.month}</TableCell>
                      <TableCell className="text-right font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(item.total_collected)}</TableCell>
                      <TableCell className="text-right text-red-500 dark:text-red-400">{formatCurrency(item.discount_total)}</TableCell>
                      <TableCell className="text-right text-orange-500 dark:text-orange-400">{formatCurrency(item.fine_total)}</TableCell>
                      <TableCell className="text-right dark:text-slate-300">{item.transaction_count}</TableCell>
                      <TableCell className="text-right dark:text-slate-300">{item.students_count}</TableCell>
                      <TableCell className="text-right text-red-600 dark:text-red-400 font-bold">{formatCurrency(item.total_due)}</TableCell>
                      <TableCell className="text-right dark:text-slate-300">
                        <div className="flex items-center justify-end gap-1">
                          <span>{item.percentage.toFixed(1)}%</span>
                          <div className="w-12 h-1 bg-gray-200 dark:bg-slate-600 rounded-full">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${item.percentage}%` }} />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-7 w-7 p-0 dark:text-slate-300 dark:hover:bg-slate-700" 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            handleMonthClick(item.month_key); 
                          }}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-gray-100 dark:bg-slate-700/50 font-bold">
                    <TableCell className="dark:text-slate-200">Total</TableCell>
                    <TableCell className="text-right text-emerald-700 dark:text-emerald-400">{formatCurrency(totalYearly)}</TableCell>
                    <TableCell className="text-right text-red-600 dark:text-red-400">{formatCurrency(monthlyData.reduce((s, d) => s + d.discount_total, 0))}</TableCell>
                    <TableCell className="text-right text-orange-600 dark:text-orange-400">{formatCurrency(monthlyData.reduce((s, d) => s + d.fine_total, 0))}</TableCell>
                    <TableCell className="text-right dark:text-slate-300">{monthlyData.reduce((s, d) => s + d.transaction_count, 0)}</TableCell>
                    <TableCell className="text-right dark:text-slate-300">{monthlyData.reduce((s, d) => s + d.students_count, 0)}</TableCell>
                    <TableCell className="text-right text-red-600 dark:text-red-400 font-bold">{formatCurrency(totalDueYearly)}</TableCell>
                    <TableCell colSpan={2} />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Transactions Section - Updated with Due column */}
        {selectedMonth && (
          <Card className="border-0 shadow-md overflow-hidden dark:bg-slate-800/50 dark:border-slate-700">
            <CardHeader className="py-3 px-4 bg-gradient-to-r from-emerald-500/10 to-transparent border-b dark:border-slate-700">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 dark:text-slate-200">
                  <div className="p-1 rounded bg-gradient-to-r from-emerald-500 to-teal-500">
                    <Receipt className="h-3 w-3 text-white" />
                  </div>
                  Transactions - {monthlyData.find(m => m.month_key === selectedMonth)?.month}
                </CardTitle>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={printTransactionsReport} 
                    disabled={printingTransactions} 
                    className="dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    <Printer className="h-3.5 w-3.5 mr-1" /> 
                    {printingTransactions ? "Printing..." : "Print"}
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={pdfTransactionsReport} 
                    disabled={exportingPDF} 
                    className="dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    {exportingPDF ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <FileText className="h-3.5 w-3.5 mr-1" />}
                    PDF
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => setSelectedMonth("")} 
                    className="dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    <X className="h-3.5 w-3.5 mr-1" /> Close
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {/* Advanced Search - Dark Mode Compatible */}
              <div className="mb-4">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowAdvancedSearch(!showAdvancedSearch)} 
                  className="gap-2 mb-3 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  <Filter className="h-3.5 w-3.5" />
                  {showAdvancedSearch ? "Hide Advanced Search" : "Show Advanced Search"}
                </Button>
                {showAdvancedSearch && (
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3 p-4 bg-gray-50 dark:bg-slate-700/30 rounded-lg mb-4">
                    <div className="relative">
                      <User className="absolute left-2 top-2.5 h-3.5 w-3.5 text-gray-400 dark:text-slate-500" />
                      <Input 
                        placeholder="Student Name" 
                        value={searchFilters.name} 
                        onChange={(e) => setSearchFilters(p => ({ ...p, name: e.target.value }))} 
                        className="pl-7 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:placeholder:text-slate-500" 
                      />
                    </div>
                    <div className="relative">
                      <Hash className="absolute left-2 top-2.5 h-3.5 w-3.5 text-gray-400 dark:text-slate-500" />
                      <Input 
                        placeholder="Admission No" 
                        value={searchFilters.admission_no} 
                        onChange={(e) => setSearchFilters(p => ({ ...p, admission_no: e.target.value }))} 
                        className="pl-7 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:placeholder:text-slate-500" 
                      />
                    </div>
                    <div className="relative">
                      <Hash className="absolute left-2 top-2.5 h-3.5 w-3.5 text-gray-400 dark:text-slate-500" />
                      <Input 
                        placeholder="Class Roll" 
                        value={searchFilters.class_roll} 
                        onChange={(e) => setSearchFilters(p => ({ ...p, class_roll: e.target.value }))} 
                        className="pl-7 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:placeholder:text-slate-500" 
                      />
                    </div>
                    <div className="relative">
                      <UserRound className="absolute left-2 top-2.5 h-3.5 w-3.5 text-gray-400 dark:text-slate-500" />
                      <Input 
                        placeholder="Father Name" 
                        value={searchFilters.father_name} 
                        onChange={(e) => setSearchFilters(p => ({ ...p, father_name: e.target.value }))} 
                        className="pl-7 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:placeholder:text-slate-500" 
                      />
                    </div>
                    <div className="relative">
                      <UserRound className="absolute left-2 top-2.5 h-3.5 w-3.5 text-gray-400 dark:text-slate-500" />
                      <Input 
                        placeholder="Mother Name" 
                        value={searchFilters.mother_name} 
                        onChange={(e) => setSearchFilters(p => ({ ...p, mother_name: e.target.value }))} 
                        className="pl-7 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:placeholder:text-slate-500" 
                      />
                    </div>
                    <div className="relative">
                      <Smartphone className="absolute left-2 top-2.5 h-3.5 w-3.5 text-gray-400 dark:text-slate-500" />
                      <Input 
                        placeholder="Phone" 
                        value={searchFilters.phone} 
                        onChange={(e) => setSearchFilters(p => ({ ...p, phone: e.target.value }))} 
                        className="pl-7 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:placeholder:text-slate-500" 
                      />
                    </div>
                    <div className="relative">
                      <Receipt className="absolute left-2 top-2.5 h-3.5 w-3.5 text-gray-400 dark:text-slate-500" />
                      <Input 
                        placeholder="Receipt No" 
                        value={searchFilters.receipt_no} 
                        onChange={(e) => setSearchFilters(p => ({ ...p, receipt_no: e.target.value }))} 
                        className="pl-7 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:placeholder:text-slate-500" 
                      />
                    </div>
                    <Button 
                      variant="outline" 
                      onClick={resetSearchFilters} 
                      className="dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                    >
                      <RefreshCw className="h-3.5 w-3.5 mr-1" /> Reset
                    </Button>
                  </div>
                )}
                {!showAdvancedSearch && (
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400 dark:text-slate-500" />
                    <Input 
                      placeholder="Search by Name, Admission, Roll, Father, Receipt..." 
                      value={searchFilters.name} 
                      onChange={(e) => setSearchFilters(p => ({ ...p, name: e.target.value }))} 
                      className="pl-8 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:placeholder:text-slate-500" 
                    />
                  </div>
                )}
              </div>

              {/* Transactions Table - Updated with Due column */}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50 dark:bg-slate-700/50">
                      <TableHead className="dark:text-slate-300">Receipt</TableHead>
                      <TableHead className="dark:text-slate-300">Student</TableHead>
                      <TableHead className="dark:text-slate-300">Class</TableHead>
                      <TableHead className="dark:text-slate-300">Category</TableHead>
                      <TableHead className="text-right dark:text-slate-300">Amount</TableHead>
                      <TableHead className="text-right dark:text-slate-300">Discount</TableHead>
                      <TableHead className="text-right dark:text-slate-300">Fine</TableHead>
                      <TableHead className="text-right dark:text-slate-300">Paid</TableHead>
                      <TableHead className="text-right dark:text-slate-300">Due</TableHead>
                      <TableHead className="dark:text-slate-300">Method</TableHead>
                      <TableHead className="dark:text-slate-300">Status</TableHead>
                      <TableHead className="text-center dark:text-slate-300">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={12} className="text-center py-8">
                          <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                        </TableCell>
                      </TableRow>
                    ) : paginatedTransactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={12} className="text-center py-8 text-muted-foreground dark:text-slate-400">
                          No transactions found
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedTransactions.map((tx) => {
                        const paymentMethod = paymentMethodConfigs[tx.payment_method as keyof typeof paymentMethodConfigs] || paymentMethodConfigs.cash
                        const PaymentIcon = paymentMethod.icon
                        return (
                          <TableRow key={tx.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30">
                            <TableCell className="font-mono text-xs dark:text-slate-300">{tx.receipt_no}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center text-xs font-bold overflow-hidden shadow-sm">
                                  {(tx.student_photo_url || tx.photo_url) ? (
                                    <img src={tx.student_photo_url || tx.photo_url} alt={tx.student_name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                                  ) : (tx.student_name?.charAt(0) || "?")}
                                </div>
                                <div>
                                  <p className="font-medium dark:text-slate-200">{tx.student_name}</p>
                                  <p className="text-xs text-muted-foreground dark:text-slate-400">ID: {tx.admission_no} | Roll: {tx.class_roll}</p>
                                  {tx.father_name && <p className="text-xs text-muted-foreground dark:text-slate-400">Father: {tx.father_name}</p>}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="dark:text-slate-300">{tx.class_name}</TableCell>
                            <TableCell className="max-w-[150px] truncate dark:text-slate-300">{tx.fee_category}</TableCell>
                            <TableCell className="text-right dark:text-slate-300">{formatCurrency(tx.total_fee)}</TableCell>
                            <TableCell className="text-right text-red-600 dark:text-red-400">{formatCurrency(tx.discount_amount)}</TableCell>
                            <TableCell className="text-right text-orange-600 dark:text-orange-400">{formatCurrency(tx.fine_amount)}</TableCell>
                            <TableCell className="text-right font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(tx.paid_amount)}</TableCell>
                            <TableCell className="text-right font-semibold text-red-600 dark:text-red-400">{formatCurrency(tx.due_amount)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`capitalize ${paymentMethod.color} ${paymentMethod.bg} dark:border-slate-600`}>
                                <PaymentIcon className="h-3 w-3 mr-1" />
                                {paymentMethod.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={tx.status === 'paid' ? 'bg-emerald-500' : tx.status === 'partial' ? 'bg-amber-500' : tx.status === 'overdue' ? 'bg-red-500' : 'bg-slate-500'}>
                                {tx.status === 'paid' ? 'Paid' : tx.status === 'partial' ? 'Partial' : tx.status === 'overdue' ? 'Overdue' : 'Pending'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-7 w-7 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/30"
                                onClick={() => openReceiptDialog(tx)}
                              >
                                <Receipt className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {filteredTransactions.length > 0 && (
                <div className="mt-4 p-3 bg-gray-50 dark:bg-slate-700/30 rounded-lg flex flex-wrap justify-between items-center">
                  <span className="text-sm dark:text-slate-300">Total: <strong>{filteredTransactions.length}</strong> transactions</span>
                  <span className="text-sm dark:text-slate-300">Total Paid: <span className="text-emerald-600 dark:text-emerald-400 font-bold">{formatCurrency(filteredTransactions.reduce((s, t) => s + (t.paid_amount || 0), 0))}</span></span>
                  <span className="text-sm dark:text-slate-300">Total Due: <span className="text-red-600 dark:text-red-400 font-bold">{formatCurrency(filteredTransactions.reduce((s, t) => s + (t.due_amount || 0), 0))}</span></span>
                </div>
              )}

              {/* 📄 Pagination */}
              {filteredTransactions.length > 0 && (
                <div className="flex items-center justify-between mt-4 flex-wrap gap-3 print:hidden">
                  <div className="text-sm text-muted-foreground dark:text-slate-400">
                    Showing {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, filteredTransactions.length)} of {filteredTransactions.length} transactions
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Page size selector */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm dark:text-slate-300">Show:</span>
                      <Select
                        value={String(pageSize)}
                        onValueChange={(v) => {
                          setPageSize(Number(v))
                          setCurrentPage(1)
                        }}
                      >
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="20">20</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Page navigation */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        Previous
                      </Button>
                      <span className="text-sm dark:text-slate-300">
                        Page {currentPage} of {totalPages || 1}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages || totalPages === 0}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Receipt Dialog - Updated with Due info */}
      <Dialog open={receiptDialogOpen} onOpenChange={setReceiptDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto dark:bg-slate-800 dark:border-slate-700">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between dark:text-slate-200">
              <span>Payment Receipt</span>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => selectedTransaction && printReceipt(selectedTransaction)}
                className="dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                <Printer className="h-4 w-4 mr-2" />
                Print / Save PDF
              </Button>
            </DialogTitle>
            <DialogDescription className="dark:text-slate-400">
              Detailed payment information
            </DialogDescription>
          </DialogHeader>

          {selectedTransaction && (
            <div className="space-y-6 p-4 border rounded-lg dark:border-slate-700 dark:bg-slate-800/50">
              {/* School Header */}
              <div className="text-center border-b pb-4 dark:border-slate-700">
                <h2 className="text-2xl font-bold text-indigo-800 dark:text-indigo-400">{schoolSettings.name}</h2>
                <p className="text-sm text-muted-foreground dark:text-slate-400">{schoolSettings.address}</p>
                <p className="text-xs text-muted-foreground dark:text-slate-400">Payment Receipt</p>
              </div>

              {/* Student Info */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-bold dark:text-slate-200">{selectedTransaction.student_name}</h3>
                  <Badge className={selectedTransaction.status === 'paid' ? 'bg-emerald-500' : selectedTransaction.status === 'partial' ? 'bg-amber-500' : selectedTransaction.status === 'overdue' ? 'bg-red-500' : 'bg-slate-500'}>
                    {selectedTransaction.status === 'paid' ? <CheckCircle className="h-3 w-3 mr-1" /> : selectedTransaction.status === 'partial' ? <Clock className="h-3 w-3 mr-1" /> : selectedTransaction.status === 'overdue' ? <AlertCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                    {selectedTransaction.status === 'paid' ? 'Fully Paid' : selectedTransaction.status === 'partial' ? 'Partial' : selectedTransaction.status === 'overdue' ? 'Overdue' : 'Pending'}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground dark:text-slate-400">Student ID:</span> 
                    <span className="dark:text-slate-300">{selectedTransaction.admission_no || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground dark:text-slate-400">Roll No:</span> 
                    <span className="dark:text-slate-300">{selectedTransaction.class_roll || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground dark:text-slate-400">Class:</span> 
                    <span className="dark:text-slate-300">{selectedTransaction.class_name} {selectedTransaction.section_name ? `(${selectedTransaction.section_name})` : ''}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground dark:text-slate-400">Guardian:</span> 
                    <span className="dark:text-slate-300">{selectedTransaction.father_name || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Transaction Details */}
              <div className="grid grid-cols-2 gap-4 p-3 bg-muted/20 dark:bg-slate-700/30 rounded-lg">
                <div>
                  <span className="text-muted-foreground dark:text-slate-400 text-sm">Receipt No:</span> 
                  <p className="font-mono font-medium dark:text-slate-300">{selectedTransaction.receipt_no}</p>
                </div>
                <div>
                  <span className="text-muted-foreground dark:text-slate-400 text-sm">Month:</span> 
                  <p className="dark:text-slate-300">{selectedTransaction.month || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground dark:text-slate-400 text-sm">Fee Category:</span> 
                  <p className="dark:text-slate-300">{selectedTransaction.fee_category}</p>
                </div>
                <div>
                  <span className="text-muted-foreground dark:text-slate-400 text-sm">Payment Date:</span> 
                  <p className="dark:text-slate-300">{new Date(selectedTransaction.payment_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <span className="text-muted-foreground dark:text-slate-400 text-sm">Payment Method:</span> 
                  <p className="capitalize flex items-center gap-1 dark:text-slate-300">
                    {selectedTransaction.payment_method === 'cash' && <Landmark className="h-3.5 w-3.5" />}
                    {(selectedTransaction.payment_method === 'bkash' || selectedTransaction.payment_method === 'nagad') && <Smartphone className="h-3.5 w-3.5" />}
                    {selectedTransaction.payment_method === 'bank' && <Building2 className="h-3.5 w-3.5" />}
                    {selectedTransaction.payment_method}
                  </p>
                </div>
              </div>

              {/* Financial Breakdown */}
              <div className="space-y-2">
                <h4 className="font-semibold border-b pb-1 dark:border-slate-700 dark:text-slate-200">Fee Breakdown</h4>
                <div className="flex justify-between text-sm">
                  <span className="dark:text-slate-400">Total Fee (Payable):</span>
                  <span className="font-medium dark:text-slate-300">{formatCurrency(selectedTransaction.total_fee)}</span>
                </div>
                {selectedTransaction.discount_amount > 0 && (
                  <div className="flex justify-between text-sm text-red-600 dark:text-red-400">
                    <span>Discount:</span>
                    <span>- {formatCurrency(selectedTransaction.discount_amount)}</span>
                  </div>
                )}
                {selectedTransaction.fine_amount > 0 && (
                  <div className="flex justify-between text-sm text-orange-600 dark:text-orange-400">
                    <span>Late Fine:</span>
                    <span>+ {formatCurrency(selectedTransaction.fine_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold pt-2 border-t dark:border-slate-700">
                  <span className="dark:text-slate-200">Amount Paid:</span>
                  <span className="text-emerald-600 dark:text-emerald-400">{formatCurrency(selectedTransaction.paid_amount)}</span>
                </div>
                {selectedTransaction.due_amount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground dark:text-slate-400">Remaining Due:</span>
                    <span className="text-red-600 dark:text-red-400 font-medium">{formatCurrency(selectedTransaction.due_amount)}</span>
                  </div>
                )}
              </div>

              {/* Signature Area */}
              <div className="flex justify-between text-sm pt-4 border-t dark:border-slate-700">
                <div className="text-center">
                  <div className="w-32 border-b border-dashed border-gray-300 dark:border-slate-600 mb-1"></div>
                  <span className="text-xs text-muted-foreground dark:text-slate-400">Cashier Signature</span>
                </div>
                <div className="text-center">
                  <div className="w-32 border-b border-dashed border-gray-300 dark:border-slate-600 mb-1"></div>
                  <span className="text-xs text-muted-foreground dark:text-slate-400">Guardian Signature</span>
                </div>
              </div>

              {/* Footer */}
              <div className="text-center text-[10px] text-muted-foreground dark:text-slate-400 pt-2 border-t dark:border-slate-700">
                <p>This is a computer generated receipt. Valid without signature.</p>
                <p>For verification, contact school office.</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </ResponsiveLayout>
  )
}