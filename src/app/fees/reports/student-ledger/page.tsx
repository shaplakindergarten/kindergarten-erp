"use client"

import { useCallback, useEffect, useMemo, useState, useRef, Fragment } from "react"
import Link from "next/link"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

import {
  ArrowLeft,
  Download,
  Loader2,
  Printer,
  RefreshCw,
  Users,
  Wallet,
  Receipt,
  Search,
  Filter,
  BookOpen,
  User,
  Phone,
  Mail,
  CreditCard,
  Eye,
  FileText,
  Calendar,
  Clock,
  X,
  GraduationCap,
   Home,
   TrendingUp,
   AlertCircle,
   CheckCircle,
   ChevronDown,
   ChevronRight,
 } from "lucide-react"

import { ResponsiveLayout } from "@/components/layout/responsive-layout"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { VisuallyHidden } from "@/components/ui/visually-hidden"

import { formatCurrency, isValidUUID } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { getAllPaymentsWithAllocation, getStudentPayments, buildDescriptionFromAllocations } from "@/lib/api/fees-dynamic"
import { useAcademicYears } from "@/hooks/useAcademicYears"
import { getSchoolPrintHeader } from "@/components/print/SchoolPrintHeader"

const supabase = createClient()

// =========================================
// INTERFACES
// =========================================

interface Student {
    id: string
    name: string
    father_name: string
    mother_name: string
    admission_no: string
    class_roll: string
    class_id: string
    section_id: string
    class_name: string
    section_name: string
    contact: string
    fathers_contact: string
    mothers_contact: string
    email: string
    status: string
    gender: string
    dob: string
    student_photo_url?: string
  }

// 🆕 Updated FeeTransaction with due info
interface FeeTransaction {
   id: string
   payment_date: string
   receipt_no: string
   payment_method: string
   amount: number
   paid_amount: number
   due_amount: number
   fine_amount: number
   discount_amount: number
   category_id: string
   status: string
   remarks: string
   invoice_no: string
   category_name?: string
   // 🆕 New fields from student_fee_dues
   month?: string
   expected_amount?: number
   total_due?: number
    is_advance?: boolean
    due_date?: string
    allocations?: Array<{
      id: string
      category_id: string
      category_name: string
      amount: number
      month: string
      allocation_type: string
    }>
  }

interface FeeCategory {
  id: string
  name: string
  amount: number
  frequency: string
}

// 🆕 Updated FeeSummary with due info
interface FeeSummary {
  total_fee: number
  total_paid: number
  total_due: number
  total_fine: number
  total_discount: number
  last_payment_date: string | null
  // 🆕 New fields
  total_expected: number
  overdue_months: number
  pending_months: number
  paid_months: number
  partial_months: number
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

interface SchoolInfo {
  school_name: string
  school_address: string
  school_phone: string
  school_email: string
  school_logo?: string | null
}

// =========================================
// MAIN COMPONENT
// =========================================

export default function StudentWiseLedgerPage() {
  const [loading, setLoading] = useState(true)
  const [pdfGenerating, setPdfGenerating] = useState(false)
  const [students, setStudents] = useState<Student[]>([])
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([])
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [transactions, setTransactions] = useState<FeeTransaction[]>([])
  const [feeCategories, setFeeCategories] = useState<FeeCategory[]>([])
  // 🆕 State for due transactions
  const [dueTransactions, setDueTransactions] = useState<FeeTransaction[]>([])
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // 🆕 Academic year - defaults to current
  const { data: academicYearsData } = useAcademicYears()
  const [academicYearId, setAcademicYearId] = useState<string>('')
  const [feeSummary, setFeeSummary] = useState<FeeSummary>({
    total_fee: 0,
    total_paid: 0,
    total_due: 0,
    total_fine: 0,
    total_discount: 0,
    last_payment_date: null,
    // 🆕 New fields
    total_expected: 0,
    overdue_months: 0,
    pending_months: 0,
    paid_months: 0,
    partial_months: 0,
  })
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [sections, setSections] = useState<SectionItem[]>([])
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo>({
    school_name: "Shapla Kindergarten & Pre-cadet",
    school_address: "Nowtala, Madhaiya Bazar, Chandina, Cumilla",
    school_phone: "01923253454",
    school_email: "shapla.kindergarten@gmail.com",
  })

  // Global totals for dashboard cards
  const [globalTotals, setGlobalTotals] = useState({
    total_collection: 0,
    total_due: 0,
  })

  // Filters
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedClass, setSelectedClass] = useState("all")
  const [selectedSection, setSelectedSection] = useState("all")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  // Print content ref
  const printContentRef = useRef<HTMLDivElement>(null)

  // =========================================
  // DATE FORMATTING
  // =========================================

  const formatDateToDisplay = (dateString: string) => {
    if (!dateString) return ""
    const datePart = dateString.split("T")[0] || dateString
    const parts = datePart.split("-")
    if (parts.length !== 3) return dateString
    const [year, month, day] = parts
    return `${day}-${month}-${year}`
  }

  // =========================================
  // GET PAYMENT METHOD BADGE WITH ICON
  // =========================================

  const getPaymentMethodBadge = (method: string) => {
    const methodLower = method?.toLowerCase() || ""
    
    if (methodLower === "cash") {
      return (
        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 border-0 flex items-center gap-1">
          <Wallet className="h-3 w-3" /> Cash
        </Badge>
      )
    } else if (methodLower === "bikash" || methodLower === "bkash") {
      return (
        <Badge className="bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-300 border-0 flex items-center gap-1">
          <CreditCard className="h-3 w-3" /> bKash
        </Badge>
      )
    } else if (methodLower === "nagad") {
      return (
        <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300 border-0 flex items-center gap-1">
          <CreditCard className="h-3 w-3" /> Nagad
        </Badge>
      )
    } else if (methodLower === "bank") {
      return (
        <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border-0 flex items-center gap-1">
          <CreditCard className="h-3 w-3" /> Bank
        </Badge>
      )
    } else if (method && method !== "N/A" && method !== "-") {
      return (
        <Badge variant="outline" className="flex items-center gap-1 dark:border-slate-700 dark:text-slate-300">
          <Receipt className="h-3 w-3" /> {method}
        </Badge>
      )
    }
    return (
      <Badge variant="outline" className="text-slate-500 dark:text-slate-400">
        —
      </Badge>
    )
  }

  const getPaymentMethodIcon = (method: string) => {
    const methodLower = method?.toLowerCase() || ""
    if (methodLower === "cash") return <Wallet className="h-4 w-4 text-green-600 dark:text-green-400" />
    if (methodLower === "bkash") return <CreditCard className="h-4 w-4 text-pink-600 dark:text-pink-400" />
    if (methodLower === "nagad") return <CreditCard className="h-4 w-4 text-orange-600 dark:text-orange-400" />
    if (methodLower === "bank") return <CreditCard className="h-4 w-4 text-blue-600 dark:text-blue-400" />
    return <Receipt className="h-4 w-4 text-slate-400" />
  }

  // =========================================
  // FETCH SCHOOL INFO
  // =========================================

  const fetchSchoolInfo = async () => {
    try {
      const { data, error } = await supabase
        .from("school_settings")
        .select("school_name, school_address, school_phone, school_email, school_logo")
        .limit(1)
        .single()

      if (!error && data) {
        setSchoolInfo(data as any)
      }
    } catch (error) {
      console.error("Error fetching school info:", error)
    }
  }

  // =========================================
  // FETCH CLASSES
  // =========================================

  const fetchClasses = async () => {
    try {
      const { data, error } = await supabase
        .from("classes")
        .select("id, name, numeric_order")
        .order("numeric_order", { ascending: true })

      if (!error && data) {
        setClasses(data)
      }
    } catch (error) {
      console.error("Error fetching classes:", error)
    }
  }

  // =========================================
  // FETCH SECTIONS
  // =========================================

  const fetchSections = async () => {
    try {
      let query = supabase
        .from("sections")
        .select("id, name, class_id")
        .order("name")

      if (selectedClass !== "all") {
        query = query.eq("class_id", selectedClass)
      }

      const { data, error } = await query

      if (!error && data) {
        setSections(data)
      }
    } catch (error) {
      console.error("Error fetching sections:", error)
    }
  }

  // =========================================
  // FETCH STUDENTS
  // =========================================

  const fetchStudents = async () => {
    try {
      setLoading(true)

      const client = supabase
      let query = client
        .from("students")
        .select(`
          id,
          name,
          father_name,
          mother_name,
          student_id,
          class_roll,
          class_id,
          section_id,
          contact,
          fathers_contact,
          mothers_contact,
          email,
          status,
          gender,
          dob,
          student_photo_url
        `)
        .eq("status", "active")

      if (selectedClass !== "all") {
        query = query.eq("class_id", selectedClass)
      }

      if (selectedSection !== "all") {
        query = query.eq("section_id", selectedSection)
      }

      const { data: studentsData, error: studentsError } = await query

      if (studentsError) {
        console.error("Students error:", studentsError)
        throw studentsError
      }

      if (!studentsData || studentsData.length === 0) {
        setStudents([])
        setFilteredStudents([])
        setLoading(false)
        return
      }

      const classIds = [...new Set(studentsData.map(s => s.class_id).filter(Boolean))]
      const sectionIds = [...new Set(studentsData.map(s => s.section_id).filter(Boolean))]

      let classMap = new Map()
      if (classIds.length > 0) {
        const { data: classesData } = await supabase
          .from("classes")
          .select("id, name")
          .in("id", classIds)
        
        if (classesData) {
          classesData.forEach(c => classMap.set(c.id, c.name))
        }
      }

      let sectionMap = new Map()
      if (sectionIds.length > 0) {
        const { data: sectionsData } = await supabase
          .from("sections")
          .select("id, name")
          .in("id", sectionIds)
        
        if (sectionsData) {
          sectionsData.forEach(s => sectionMap.set(s.id, s.name))
        }
      }

      const formattedStudents: Student[] = studentsData.map((item: any) => ({
          id: item.id,
          name: item.name,
          father_name: item.father_name || "N/A",
          mother_name: item.mother_name || "N/A",
          admission_no: item.student_id || "N/A",
          class_roll: item.class_roll || "N/A",
          class_id: item.class_id,
          section_id: item.section_id,
          class_name: classMap.get(item.class_id) || "N/A",
          section_name: sectionMap.get(item.section_id) || "N/A",
          contact: item.contact || item.fathers_contact || "N/A",
          fathers_contact: item.fathers_contact || "N/A",
          mothers_contact: item.mothers_contact || "N/A",
          email: item.email || "N/A",
          status: item.status,
          gender: item.gender || "N/A",
          dob: item.dob || "",
          student_photo_url: item.student_photo_url || undefined,
        }))

      setStudents(formattedStudents)
      setFilteredStudents(formattedStudents)

      await fetchGlobalTotals()
    } catch (error: any) {
      console.error("Error fetching students:", error)
    } finally {
      setLoading(false)
    }
  }

  // =========================================
  // FETCH GLOBAL TOTALS
  // =========================================

  const fetchGlobalTotals = async () => {
    try {
      const paymentsData = await getAllPaymentsWithAllocation({
        classId: selectedClass !== "all" ? selectedClass : undefined,
        sectionId: selectedSection !== "all" ? selectedSection : undefined,
        academicYearId: academicYearId || undefined
      })
      const total_collection = (paymentsData || []).reduce((sum: number, p: any) => sum + (p.amount || 0), 0)
      
      // 🆕 Get total due from student_fee_dues (filtered by academic year)
      let dueQuery = supabase
        .from('student_fee_dues')
        .select('due_amount')
        .gt('due_amount', 0)

      if (academicYearId && isValidUUID(academicYearId)) {
        dueQuery = dueQuery.eq('academic_year_id', academicYearId)
      }

      const { data: dueData } = await dueQuery
      
      const total_due = dueData?.reduce((sum, d) => sum + (d.due_amount || 0), 0) || 0
      
      setGlobalTotals({ total_collection, total_due })
    } catch (error) {
      console.error("Error fetching global totals:", error)
    }
  }

  // =========================================
  // 🆕 FETCH STUDENT DUES FROM student_fee_dues
  // =========================================

  const fetchStudentDues = async (studentId: string, academicYearId?: string) => {
    try {
      let query = supabase
        .from('student_fee_dues')
        .select('*')
        .eq('student_id', studentId)

      if (academicYearId && isValidUUID(academicYearId)) {
        query = query.eq('academic_year_id', academicYearId)
      }

      const { data, error } = await query
        .gt('due_amount', 0)
        .order('month', { ascending: true })

      if (error) {
        console.error('Error fetching student dues:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error in fetchStudentDues:', error)
      return []
    }
  }

  // =========================================
  // FETCH STUDENT TRANSACTIONS - Updated with due info
  // =========================================

  const fetchStudentTransactions = async (studentId: string) => {
    try {
       // 1. Get payments
      const paymentsData = await getStudentPayments(studentId, {
        dateFrom: fromDate || undefined,
        dateTo: toDate || undefined,
        academicYearId: academicYearId || undefined
      })

      // 2. 🆕 Get dues from student_fee_dues
      const duesData = await fetchStudentDues(studentId, academicYearId)

      // 3. Format payments
      const formattedPayments: FeeTransaction[] = (paymentsData || []).map((p: any): FeeTransaction => {
        const allocations = p.allocations || []
        return {
          id: p.id,
          payment_date: p.payment_date,
          receipt_no: p.receipt_no || "-",
          payment_method: p.payment_method || "Cash",
          amount: Number(p.amount) || 0,
          paid_amount: Number(p.amount) || 0,
          due_amount: 0,
          fine_amount: Number(p.fine_amount) || 0,
          discount_amount: Number(p.discount_amount) || 0,
          category_id: allocations?.[0]?.category_id || "",
          status: "Paid",
          remarks: p.note || "",
          invoice_no: p.receipt_no || "",
          category_name: buildDescriptionFromAllocations(allocations),
          month: allocations?.[0]?.month || undefined,
          expected_amount: 0,
          total_due: 0,
          is_advance: false,
          due_date: undefined,
          allocations: allocations.map((a: any) => ({
            id: String(a.id || ''),
            category_id: String(a.category_id || ''),
            category_name: String(a.category_name || a.fee_categories?.name || 'Unknown'),
            amount: Number(a.amount) || 0,
            month: String(a.month || ''),
            allocation_type: String(a.allocation_type || 'regular'),
          })),
        }
      })

      // 4. 🆕 Format dues as transactions
      const formattedDues: FeeTransaction[] = await Promise.all(duesData.map(async (d: any) => ({
        id: d.id,
        payment_date: d.due_date || d.created_at,
        receipt_no: `DUE-${d.month}`,
        payment_method: "Pending",
        amount: d.expected_amount || 0,
        paid_amount: d.paid_amount || 0,
        due_amount: d.due_amount || 0,
        fine_amount: d.fine_amount || 0,
        discount_amount: d.discount_amount || 0,
        category_id: d.category_id || "",
        status: d.status === 'overdue' ? 'Overdue' : d.status === 'paid' ? 'Paid' : d.status === 'partial' ? 'Partial' : 'Pending',
        remarks: `Due for ${d.month}`,
        invoice_no: "",
        category_name: d.category_id ? await getCategoryName(d.category_id) : "Due",
        month: d.month,
        expected_amount: d.expected_amount,
        total_due: d.due_amount,
        is_advance: d.is_advance || false,
        due_date: d.due_date,
      })))

      // 5. Combine payments and dues
      const allTransactions = [...formattedPayments, ...formattedDues]
      setTransactions(allTransactions)
      setDueTransactions(formattedDues)

      // 6. Calculate summary
      const summary = allTransactions.reduce(
        (acc, tx) => ({
          total_fee: acc.total_fee + (tx.amount || 0),
          total_paid: acc.total_paid + (tx.paid_amount || 0),
          total_due: acc.total_due + (tx.due_amount || 0),
          total_fine: acc.total_fine + (tx.fine_amount || 0),
          total_discount: acc.total_discount + (tx.discount_amount || 0),
          total_expected: acc.total_expected + (tx.expected_amount || 0),
        }),
        { total_fee: 0, total_paid: 0, total_due: 0, total_fine: 0, total_discount: 0, total_expected: 0 }
      )

      const lastPayment = formattedPayments.find((tx) => tx.paid_amount > 0)
      const overdueMonths = formattedDues.filter(d => d.status === 'Overdue').length
      const pendingMonths = formattedDues.filter(d => d.status === 'Pending').length
      const paidMonths = formattedDues.filter(d => d.status === 'Paid').length
      const partialMonths = formattedDues.filter(d => d.status === 'Partial').length

      setFeeSummary({
        ...summary,
        last_payment_date: lastPayment?.payment_date || null,
        // 🆕 New fields
        total_expected: summary.total_expected,
        overdue_months: overdueMonths,
        pending_months: pendingMonths,
        paid_months: paidMonths,
        partial_months: partialMonths,
      })
    } catch (error) {
      console.error("Error fetching transactions:", error)
    }
  }

  // Helper to get category name
  const getCategoryName = async (categoryId: string) => {
    try {
      const { data } = await supabase
        .from('fee_categories')
        .select('name')
        .eq('id', categoryId)
        .single()
      return data?.name || 'Fee'
    } catch {
      return 'Fee'
    }
  }

  // =========================================
  // FILTER STUDENTS
  // =========================================

  useEffect(() => {
    let filtered = [...students]

    if (searchTerm) {
      filtered = filtered.filter(
        (student) =>
          student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          student.admission_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
          student.father_name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    setFilteredStudents(filtered)
  }, [searchTerm, students])

  // =========================================
  // EFFECTS
  // =========================================

  useEffect(() => {
    fetchSchoolInfo()
    fetchClasses()
  }, [])

  // 🆕 Set default academic year
  useEffect(() => {
    if (academicYearsData && academicYearsData.length > 0) {
      const current = academicYearsData.find((ay: any) => ay.is_current) || academicYearsData[0]
      if (current?.id && !academicYearId) {
        setAcademicYearId(current.id)
      }
    }
  }, [academicYearsData, academicYearId])

  useEffect(() => {
    fetchSections()
  }, [selectedClass])

  useEffect(() => {
    fetchStudents()
  }, [selectedClass, selectedSection])

  // =========================================
  // HANDLE STUDENT SELECT
  // =========================================

  const handleStudentSelect = async (student: Student) => {
    setSelectedStudent(student)
    await fetchStudentTransactions(student.id)
    setDialogOpen(true)
  }

  // =========================================
  // GET STATUS BADGE
  // =========================================

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Paid":
        return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0">✓ Paid</Badge>
      case "Partial":
        return <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0">⚠ Partial</Badge>
      case "Pending":
        return <Badge className="bg-slate-500 hover:bg-slate-600 text-white border-0">⏳ Pending</Badge>
      case "Overdue":
        return <Badge className="bg-rose-500 hover:bg-rose-600 text-white border-0">✗ Overdue</Badge>
      default:
        return <Badge variant="outline" className="dark:border-slate-700">{status}</Badge>
    }
  }

  // =========================================
  // GENERATE PDF
  // =========================================

  const generateStudentLedgerPDF = async () => {
    if (!selectedStudent || transactions.length === 0) return

    setPdfGenerating(true)

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    })

    doc.setFontSize(20)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(0, 0, 0)
    doc.text(schoolInfo.school_name || "School Name", 105, 20, { align: "center" })

    doc.setFontSize(14)
    doc.text("Student Fee Ledger", 105, 32, { align: "center" })

    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(80, 80, 80)
    doc.text(`From: ${formatDateToDisplay(fromDate) || "All"} | To: ${formatDateToDisplay(toDate) || "All"}`, 105, 40, { align: "center" })

    doc.setDrawColor(200, 200, 200)
    doc.rect(15, 50, 180, 35)
    doc.setFontSize(10)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(0, 0, 0)
    doc.text("Student Information", 20, 58)

    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.text(`Name: ${selectedStudent.name}`, 20, 68)
    doc.text(`Class: ${selectedStudent.class_name} - ${selectedStudent.section_name}`, 20, 76)
    doc.text(`Admission No: ${selectedStudent.admission_no}`, 110, 68)
    doc.text(`Roll No: ${selectedStudent.class_roll}`, 110, 76)

    doc.setDrawColor(200, 200, 200)
    doc.rect(15, 92, 180, 35)
    doc.setFont("helvetica", "bold")
    doc.text("Fee Summary", 20, 100)

    doc.setFont("helvetica", "normal")
    doc.text(`Total Expected: ${formatCurrency(feeSummary.total_expected)}`, 20, 110)
    doc.text(`Total Paid: ${formatCurrency(feeSummary.total_paid)}`, 80, 110)
    doc.text(`Total Due: ${formatCurrency(feeSummary.total_due)}`, 140, 110)
    doc.text(`Total Fine: ${formatCurrency(feeSummary.total_fine)}`, 20, 120)
    doc.text(`Total Discount: ${formatCurrency(feeSummary.total_discount)}`, 80, 120)
    doc.text(`Overdue Months: ${feeSummary.overdue_months}`, 140, 120)

    const tableData = transactions.map((tx) => [
      formatDateToDisplay(tx.payment_date),
      tx.receipt_no || "-",
      tx.category_name || "-",
      formatCurrency(tx.amount || tx.expected_amount || 0),
      formatCurrency(tx.paid_amount || 0),
      formatCurrency(tx.due_amount || 0),
      formatCurrency(tx.fine_amount || 0),
      formatCurrency(tx.discount_amount || 0),
      tx.payment_method || "-",
      tx.status,
    ])

    autoTable(doc, {
      startY: 135,
      head: [["Date", "Receipt No", "Category", "Amount", "Paid", "Due", "Fine", "Discount", "Method", "Status"]],
      body: tableData,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [200, 200, 200], textColor: [0, 0, 0], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: 15, right: 15 },
      didDrawPage: (data: any) => {
        doc.setFontSize(8)
        doc.setTextColor(100, 100, 100)
        doc.text(`Generated on: ${new Date().toLocaleString()}`, 15, 285)
        doc.text(`Page ${doc.getNumberOfPages()} of ${doc.getNumberOfPages()}`, 195, 285, { align: "right" })
      }
    })

    doc.save(`${selectedStudent.name.replace(/\s/g, "_")}_Ledger.pdf`)
    setPdfGenerating(false)
  }

  // =========================================
  // PRINT FUNCTION
  // =========================================

  const handlePrint = () => {
    if (!selectedStudent) return

    const iframe = document.createElement('iframe')
    iframe.style.position = 'absolute'
    iframe.style.top = '-9999px'
    iframe.style.left = '-9999px'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = 'none'
    
    document.body.appendChild(iframe)
    
    const iframeDoc = iframe.contentWindow?.document
    if (!iframeDoc) return
    
    iframeDoc.open()
    iframeDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Student Fee Ledger - ${selectedStudent.name}</title>
          <style>
            @page { size: A4 portrait; margin: 15mm; }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; line-height: 1.4; padding: 20px; }
            .print-container { max-width: 100%; margin: 0 auto; }
            .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px; }
            .report-title { font-size: 16px; font-weight: bold; margin: 10px 0; }
            .date-range { font-size: 10px; color: #666; margin-top: 5px; }
            .student-info { border: 1px solid #ccc; padding: 12px; margin-bottom: 20px; border-radius: 8px; background: #f9fafb; display: flex; gap: 15px; align-items: flex-start; }
            .info-grid { flex: 1; display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
            .student-info h3 { grid-column: span 2; margin: 0 0 10px 0; font-size: 13px; color: #1e40af; }
            .student-photo { width: 100px; height: 120px; border-radius: 8px; object-fit: cover; border: 2px solid #ddd; }
            .info-row { display: flex; }
            .info-label { font-weight: bold; width: 110px; color: #4b5563; }
            .info-value { flex: 1; color: #1f2937; }
            .summary-cards { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px; }
            .summary-card { border: 1px solid #ddd; padding: 8px 12px; border-radius: 8px; min-width: 90px; text-align: center; background: #f9fafb; }
            .summary-card .label { font-size: 9px; color: #6b7280; }
            .summary-card .value { font-size: 14px; font-weight: bold; margin-top: 5px; color: #1f2937; }
            .summary-card .value.due { color: #dc2626; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 10px; }
            th, td { border: 1px solid #ccc; padding: 6px 4px; text-align: center; }
            th { background-color: #e5e7eb; font-weight: bold; color: #1f2937; }
            .text-right { text-align: right; }
            .footer { margin-top: 20px; padding-top: 8px; border-top: 1px solid #ccc; text-align: center; font-size: 8px; color: #9ca3af; }
            .status-paid { color: #059669; font-weight: bold; }
            .status-partial { color: #d97706; font-weight: bold; }
            .status-pending { color: #6b7280; font-weight: bold; }
            .status-overdue { color: #dc2626; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="print-container">
            ${getSchoolPrintHeader({ ...schoolInfo, school_logo: schoolInfo.school_logo ?? undefined, school_email: schoolInfo.school_email ?? undefined }, "Student Fee Ledger")}
            <div class="date-range" style="text-align:center; font-size:10px; color:#666; margin:5px 0;">
              From: ${formatDateToDisplay(fromDate) || "All"} | To: ${formatDateToDisplay(toDate) || "All"}
            </div>

            <div class="student-info">
              <div style="flex-shrink: 0;">${(selectedStudent.student_photo_url) ? `<img src="${selectedStudent.student_photo_url}" alt="${selectedStudent.name}" class="student-photo" />` : '<div style="width: 100px; height: 120px; border-radius: 8px; background: #e5e7eb; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: bold; color: #4b5563;">' + selectedStudent.name.charAt(0) + '</div>'}</div>
              <div class="info-grid">
                <h3 style="grid-column: span 2; margin: 0 0 10px 0; font-size: 13px; color: #1e40af;">Student Information</h3>
                <div class="info-row"><span class="info-label">Name:</span><span class="info-value">${selectedStudent.name}</span></div>
                <div class="info-row"><span class="info-label">Father's Name:</span><span class="info-value">${selectedStudent.father_name}</span></div>
                <div class="info-row"><span class="info-label">Admission No:</span><span class="info-value">${selectedStudent.admission_no}</span></div>
                <div class="info-row"><span class="info-label">Class & Section:</span><span class="info-value">${selectedStudent.class_name} - ${selectedStudent.section_name}</span></div>
                <div class="info-row"><span class="info-label">Roll No:</span><span class="info-value">${selectedStudent.class_roll}</span></div>
                <div class="info-row"><span class="info-label">Contact:</span><span class="info-value">${selectedStudent.contact}</span></div>
              </div>
            </div>

            <div class="summary-cards">
              <div class="summary-card"><div class="label">Total Expected</div><div class="value">${formatCurrency(feeSummary.total_expected)}</div></div>
              <div class="summary-card"><div class="label">Total Paid</div><div class="value">${formatCurrency(feeSummary.total_paid)}</div></div>
              <div class="summary-card"><div class="label">Total Due</div><div class="value due">${formatCurrency(feeSummary.total_due)}</div></div>
              <div class="summary-card"><div class="label">Total Fine</div><div class="value">${formatCurrency(feeSummary.total_fine)}</div></div>
              <div class="summary-card"><div class="label">Overdue Months</div><div class="value due">${feeSummary.overdue_months}</div></div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Date</th><th>Receipt No</th><th>Category</th><th class="text-right">Amount</th>
                  <th class="text-right">Paid</th><th class="text-right">Due</th><th class="text-right">Fine</th>
                  <th class="text-right">Discount</th><th>Method</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${transactions.map(tx => `
                  <tr>
                    <td>${formatDateToDisplay(tx.payment_date)}</td>
                    <td>${tx.receipt_no}</td>
                    <td>${tx.category_name || "-"}</td>
                    <td class="text-right">${formatCurrency(tx.amount || tx.expected_amount || 0)}</td>
                    <td class="text-right">${formatCurrency(tx.paid_amount || 0)}</td>
                    <td class="text-right">${formatCurrency(tx.due_amount || 0)}</td>
                    <td class="text-right">${formatCurrency(tx.fine_amount || 0)}</td>
                    <td class="text-right">${formatCurrency(tx.discount_amount || 0)}</td>
                    <td>${tx.payment_method || "-"}</td>
                    <td class="status-${tx.status === 'Paid' ? 'paid' : tx.status === 'Partial' ? 'partial' : tx.status === 'Overdue' ? 'overdue' : 'pending'}">${tx.status}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div class="footer">
              Generated on: ${new Date().toLocaleString()}
            </div>
          </div>
        </body>
      </html>
    `)
    iframeDoc.close()
    
    iframe.onload = () => {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
      
      const checkPrintDialog = setInterval(() => {
        if (!iframe.contentWindow || iframe.contentWindow.document.hidden !== false) {
          clearInterval(checkPrintDialog)
          setTimeout(() => {
            if (iframe && iframe.parentNode) {
              iframe.parentNode.removeChild(iframe)
            }
          }, 100)
        }
      }, 500)
      
      setTimeout(() => {
        clearInterval(checkPrintDialog)
        if (iframe && iframe.parentNode) {
          iframe.parentNode.removeChild(iframe)
        }
      }, 10000)
    }
  }

  // =========================================
  // RENDER
  // =========================================

  return (
    <ResponsiveLayout>
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; top: 0; left: 0; width: 100%; }
          .no-print { display: none !important; }
        }

        .fullscreen-dialog {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          max-width: 100vw !important;
          max-height: 100vh !important;
          min-width: 100vw !important;
          min-height: 100vh !important;
          border-radius: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #f8fafc !important;
          z-index: 9999 !important;
          transform: none !important;
          translate: none !important;
        }
        
        .dark .fullscreen-dialog {
          background: #0f172a !important;
        }

        [data-slot="dialog-content"].fullscreen-dialog {
          transform: none !important;
          translate: none !important;
          left: 0 !important;
          top: 0 !important;
        }

        .solid-select-trigger {
          background-color: #ffffff !important;
          border: 1px solid #e2e8f0 !important;
        }
        .dark .solid-select-trigger {
          background-color: #1e293b !important;
          border-color: #334155 !important;
          color: #f1f5f9 !important;
        }
        .solid-select-content {
          background-color: #ffffff !important;
          border: 1px solid #e2e8f0 !important;
        }
        .dark .solid-select-content {
          background-color: #1e293b !important;
          border-color: #334155 !important;
        }

        .student-row:hover {
          background-color: #f1f5f9;
          cursor: pointer;
        }
        .dark .student-row:hover {
          background-color: #1e293b;
        }
      `}</style>

      <div className="space-y-6 p-4 md:p-6">

        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 no-print bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-4 shadow-lg">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild className="bg-white/20 hover:bg-white/30 text-white">
              <Link href="/fees">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">Student Wise Ledger</h1>
              <p className="text-blue-100 text-sm">Complete fee transaction history for each student</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="gap-2 bg-white/20 text-white border-white/30 hover:bg-white/30">
            <Filter className="h-4 w-4" /> {showFilters ? "Hide Filters" : "Show Filters"}
          </Button>
        </div>

        {/* Filters */}
        {showFilters && (
          <Card className="no-print border-0 shadow-md bg-white dark:bg-slate-900">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div><label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Class</label>
                  <Select value={selectedClass} onValueChange={(v) => { setSelectedClass(v); setSelectedSection("all") }}>
                    <SelectTrigger className="solid-select-trigger"><SelectValue placeholder="All Classes" /></SelectTrigger>
                    <SelectContent className="solid-select-content"><SelectItem value="all">All Classes</SelectItem>{classes.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div><label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Section</label>
                  <Select value={selectedSection} onValueChange={setSelectedSection}>
                    <SelectTrigger className="solid-select-trigger"><SelectValue placeholder="All Sections" /></SelectTrigger>
                    <SelectContent className="solid-select-content"><SelectItem value="all">All Sections</SelectItem>{sections.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div><label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Search</label>
                  <Input placeholder="Search by name, admission no..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="solid-select-trigger" />
                </div>
                <div><label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Status</label>
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger className="solid-select-trigger"><SelectValue placeholder="All Students" /></SelectTrigger>
                    <SelectContent className="solid-select-content"><SelectItem value="all">All Students</SelectItem><SelectItem value="has_due">Has Due</SelectItem><SelectItem value="fully_paid">Fully Paid</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Statistics Cards - Updated with due info */}
        <div className="grid gap-4 md:grid-cols-4 no-print">
          <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg border-0"><CardContent className="p-5"><div className="flex items-center justify-between"><div><p className="text-sm text-blue-100">Total Students</p><p className="text-3xl font-bold">{filteredStudents.length}</p></div><Users className="h-8 w-8 text-blue-200" /></div></CardContent></Card>
          <Card className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg border-0"><CardContent className="p-5"><div className="flex items-center justify-between"><div><p className="text-sm text-emerald-100">Total Collection</p><p className="text-2xl font-bold">{formatCurrency(globalTotals.total_collection)}</p></div><Wallet className="h-8 w-8 text-emerald-200" /></div></CardContent></Card>
          <Card className="bg-gradient-to-r from-rose-500 to-rose-600 text-white shadow-lg border-0"><CardContent className="p-5"><div className="flex items-center justify-between"><div><p className="text-sm text-rose-100">Total Due</p><p className="text-2xl font-bold">{formatCurrency(globalTotals.total_due)}</p></div><Receipt className="h-8 w-8 text-rose-200" /></div></CardContent></Card>
          <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg border-0"><CardContent className="p-5"><div className="flex items-center justify-between"><div><p className="text-sm text-purple-100">Total Classes</p><p className="text-3xl font-bold">{classes.length}</p></div><GraduationCap className="h-8 w-8 text-purple-200" /></div></CardContent></Card>
        </div>

        {/* Students Table */}
        <Card className="border-0 shadow-md bg-white dark:bg-slate-900">
          <CardHeader className="bg-slate-50 dark:bg-slate-800 rounded-t-lg">
            <CardTitle className="flex items-center gap-2 text-slate-700 dark:text-slate-200"><Users className="h-5 w-5" /> Student List <Badge variant="secondary" className="ml-2 bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300">{filteredStudents.length} Students</Badge></CardTitle>
            <CardDescription className="dark:text-slate-400">Click on any student to view detailed fee ledger</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {loading ? (<div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>)
            : filteredStudents.length === 0 ? (<div className="text-center py-10 text-slate-500 dark:text-slate-400">No students found</div>)
            : (<div className="overflow-x-auto"><Table><TableHeader><TableRow className="bg-slate-50 dark:bg-slate-800"><TableHead className="dark:text-slate-300">Admission No</TableHead><TableHead className="dark:text-slate-300">Student Name</TableHead><TableHead className="dark:text-slate-300">Father Name</TableHead><TableHead className="dark:text-slate-300">Class</TableHead><TableHead className="dark:text-slate-300">Section</TableHead><TableHead className="dark:text-slate-300">Roll No</TableHead><TableHead className="text-center dark:text-slate-300">Action</TableHead></TableRow></TableHeader><TableBody>{filteredStudents.map((student) => (<TableRow key={student.id} className="student-row border-b border-slate-100 dark:border-slate-800"><TableCell className="font-mono text-sm dark:text-slate-300">{student.admission_no}</TableCell><TableCell className="font-medium dark:text-slate-200"><div className="flex items-center gap-2"><div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold overflow-hidden">{student.student_photo_url ? (<img src={student.student_photo_url} alt={student.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />) : (student.name.charAt(0))}</div><span>{student.name}</span></div></TableCell><TableCell className="dark:text-slate-300">{student.father_name}</TableCell><TableCell><Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border-0">{student.class_name}</Badge></TableCell><TableCell><Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-0">{student.section_name}</Badge></TableCell><TableCell className="dark:text-slate-300">{student.class_roll}</TableCell><TableCell className="text-center"><Button size="sm" onClick={() => handleStudentSelect(student)} className="bg-blue-600 hover:bg-blue-700"><Eye className="h-4 w-4 mr-1" /> View Ledger</Button></TableCell></TableRow>))}</TableBody></Table></div>)}
          </CardContent>
        </Card>
      </div>

      {/* Student Ledger Dialog - Full Screen */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="fullscreen-dialog flex flex-col !p-0 overflow-hidden">
          <VisuallyHidden><DialogTitle>Student Fee Ledger - {selectedStudent?.name || "Student"}</DialogTitle></VisuallyHidden>
          {selectedStudent && (
            <>
              <div className="flex flex-row items-center justify-between p-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm no-print">
                <div><h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Student Fee Ledger</h2><p className="text-sm text-slate-500 dark:text-slate-400">{selectedStudent.name} - {selectedStudent.admission_no}</p></div>
                <div className="flex gap-2">
                  <Button onClick={handlePrint} variant="outline" size="sm" className="border-slate-300 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"><Printer className="h-4 w-4 mr-1" /> Print</Button>
                  <Button variant="ghost" size="icon" onClick={() => setDialogOpen(false)} className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5 dark:text-slate-400" /></Button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-900">
                <div className="max-w-7xl mx-auto space-y-6">
                  {/* Student Profile Card */}
                  <Card className="border-0 shadow-md bg-gradient-to-r from-blue-600 to-indigo-600 text-white"><CardContent className="p-6"><div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between"><div className="flex items-center gap-4"><div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold overflow-hidden">{selectedStudent.student_photo_url ? (<img src={selectedStudent.student_photo_url} alt={selectedStudent.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />) : (selectedStudent.name.charAt(0))}</div><div><h2 className="text-xl font-bold">{selectedStudent.name}</h2><p className="text-blue-100 text-sm">Admission No: {selectedStudent.admission_no}</p></div></div><div className="flex flex-wrap gap-4 text-sm"><div className="flex items-center gap-1"><BookOpen className="h-4 w-4" /> {selectedStudent.class_name} - {selectedStudent.section_name}</div><div className="flex items-center gap-1"><User className="h-4 w-4" /> Roll: {selectedStudent.class_roll}</div><div className="flex items-center gap-1"><Phone className="h-4 w-4" /> {selectedStudent.contact}</div></div></div></CardContent></Card>

                  {/* Fee Summary Cards - Updated with due info */}
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                    <Card className="border-0 shadow-sm bg-blue-50 dark:bg-blue-950/50"><CardContent className="p-4 text-center"><p className="text-xs text-blue-600 dark:text-blue-400">Total Expected</p><p className="text-xl font-bold text-blue-700 dark:text-blue-300">{formatCurrency(feeSummary.total_expected)}</p></CardContent></Card>
                    <Card className="border-0 shadow-sm bg-emerald-50 dark:bg-emerald-950/50"><CardContent className="p-4 text-center"><p className="text-xs text-emerald-600 dark:text-emerald-400">Total Paid</p><p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{formatCurrency(feeSummary.total_paid)}</p></CardContent></Card>
                    <Card className="border-0 shadow-sm bg-rose-50 dark:bg-rose-950/50"><CardContent className="p-4 text-center"><p className="text-xs text-rose-600 dark:text-rose-400">Total Due</p><p className="text-xl font-bold text-rose-700 dark:text-rose-300">{formatCurrency(feeSummary.total_due)}</p></CardContent></Card>
                    <Card className="border-0 shadow-sm bg-amber-50 dark:bg-amber-950/50"><CardContent className="p-4 text-center"><p className="text-xs text-amber-600 dark:text-amber-400">Total Fine</p><p className="text-xl font-bold text-amber-700 dark:text-amber-300">{formatCurrency(feeSummary.total_fine)}</p></CardContent></Card>
                    <Card className="border-0 shadow-sm bg-purple-50 dark:bg-purple-950/50"><CardContent className="p-4 text-center"><p className="text-xs text-purple-600 dark:text-purple-400">Total Discount</p><p className="text-xl font-bold text-purple-700 dark:text-purple-300">{formatCurrency(feeSummary.total_discount)}</p></CardContent></Card>
                    <Card className="border-0 shadow-sm bg-red-50 dark:bg-red-950/50"><CardContent className="p-4 text-center"><p className="text-xs text-red-600 dark:text-red-400">Overdue Months</p><p className="text-xl font-bold text-red-700 dark:text-red-300">{feeSummary.overdue_months}</p></CardContent></Card>
                  </div>

                  {/* Date Range Filters */}
                  <div className="flex flex-wrap gap-4 items-end bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm no-print">
                    <div><label className="text-xs font-semibold dark:text-slate-300">From Date</label><Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-40 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200" /></div>
                    <div><label className="text-xs font-semibold dark:text-slate-300">To Date</label><Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-40 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200" /></div>
                    <Button onClick={() => selectedStudent && fetchStudentTransactions(selectedStudent.id)} variant="outline" className="dark:border-slate-600 dark:text-slate-300">Apply Filter</Button>
                    <div className="flex-1"></div>
                    <Button onClick={generateStudentLedgerPDF} disabled={pdfGenerating} className="bg-rose-600 hover:bg-rose-700 text-white">{pdfGenerating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />} Download PDF</Button>
                  </div>

                  {/* Transactions Table - Updated with Due info */}
                  <Card className="border-0 shadow-md bg-white dark:bg-slate-800">
                    <CardHeader className="bg-slate-50 dark:bg-slate-700/30 rounded-t-lg"><CardTitle className="dark:text-slate-200">Transaction History</CardTitle></CardHeader>
                    <CardContent className="pt-6">
                      {transactions.length === 0 ? (<div className="text-center py-10 text-slate-500 dark:text-slate-400">No transactions found</div>)
                       : (<div className="overflow-x-auto"><Table><TableHeader><TableRow className="bg-slate-50 dark:bg-slate-700/30"><TableHead></TableHead><TableHead className="dark:text-slate-300">Date</TableHead><TableHead className="dark:text-slate-300">Receipt No</TableHead><TableHead className="dark:text-slate-300">Category</TableHead><TableHead className="text-right dark:text-slate-300">Amount</TableHead><TableHead className="text-right dark:text-slate-300">Paid</TableHead><TableHead className="text-right dark:text-slate-300">Due</TableHead><TableHead className="text-right dark:text-slate-300">Fine</TableHead><TableHead className="text-right dark:text-slate-300">Discount</TableHead><TableHead className="dark:text-slate-300">Method</TableHead><TableHead className="dark:text-slate-300">Status</TableHead></TableRow></TableHeader><TableBody>
                        {transactions.map((tx) => {
                          const isDue = tx.status === 'Pending' || tx.status === 'Overdue' || tx.status === 'Partial'
                          const hasAllocations = tx.allocations && tx.allocations.length > 0
                          const isExpanded = expandedRows.has(tx.id)
                          return (
                            <Fragment key={tx.id}>
                              <TableRow className={`border-b border-slate-100 dark:border-slate-700 ${isDue ? 'bg-rose-50/30 dark:bg-rose-950/20' : ''}`}>
                                <TableCell>
                                  {hasAllocations && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0"
                                      onClick={() => toggleRow(tx.id)}
                                    >
                                      {isExpanded ? (
                                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                      )}
                                    </Button>
                                  )}
                                </TableCell>
                                <TableCell className="font-mono text-xs dark:text-slate-300">{formatDateToDisplay(tx.payment_date)}</TableCell>
                                <TableCell className="font-mono text-xs dark:text-slate-300">{tx.receipt_no}</TableCell>
                                <TableCell className="dark:text-slate-300">{tx.category_name || "-"}</TableCell>
                                <TableCell className="text-right dark:text-slate-300">{formatCurrency(tx.amount || tx.expected_amount || 0)}</TableCell>
                                <TableCell className="text-right text-emerald-600 dark:text-emerald-400 font-medium">{formatCurrency(tx.paid_amount || 0)}</TableCell>
                                <TableCell className="text-right text-rose-600 dark:text-rose-400 font-bold">{formatCurrency(tx.due_amount || 0)}</TableCell>
                                <TableCell className="text-right text-amber-600 dark:text-amber-400">{formatCurrency(tx.fine_amount || 0)}</TableCell>
                                <TableCell className="text-right text-purple-600 dark:text-purple-400">{formatCurrency(tx.discount_amount || 0)}</TableCell>
                                <TableCell>{getPaymentMethodBadge(tx.payment_method)}</TableCell>
                                <TableCell>{getStatusBadge(tx.status)}</TableCell>
                              </TableRow>

                              {isExpanded && hasAllocations && tx.allocations?.map((alloc, idx) => (
                                <TableRow key={`${tx.id}-alloc-${idx}`} className="bg-slate-50/50 dark:bg-slate-700/20">
                                  <TableCell colSpan={1} />
                                  <TableCell colSpan={4} className="pl-8 text-sm dark:text-slate-300">
                                    <div className="flex items-center gap-2">
                                      <span className="text-muted-foreground">↳</span>
                                      <span>{alloc.category_name || 'Unknown'}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right dark:text-slate-300">{formatCurrency(alloc.amount || 0)}</TableCell>
                                  <TableCell colSpan={4} className="text-xs text-muted-foreground dark:text-slate-400">
                                    {alloc.month && `Month: ${alloc.month}`} • Type: {alloc.allocation_type}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </Fragment>
                          )
                        })}
                      </TableBody></Table></div>)}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </ResponsiveLayout>
  )
}