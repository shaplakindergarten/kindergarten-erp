// E:\kindergarten-erp\src\app\fees\receive\page.tsx
// Complete File — Option C: 6 Fixes + Layout + Class/Section Filters + UX
// Schema Verified: students.class_roll is character varying(20) (TEXT)
// ✅ FIXED: URL param auto-select from /fees/due Quick Payment
// ✅ FIXED: UI improvements — stray 0, input width, button text, responsive
// ✅ FIXED: Compact table columns + removed redundant "selected categories" block

"use client"

import { Suspense, useState, useEffect, useMemo, useCallback, useRef, Fragment } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft,
  Loader2,
  User,
  Receipt,
  Printer,
  Check,
  Banknote,
  Landmark,
  Smartphone,
  Search,
  Download,
  Zap,
  Percent,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CardTitle } from "@/components/ui/card"
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
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { ResponsiveLayout } from "@/components/layout/responsive-layout"
import { supabase } from "@/lib/supabase/client"
import { cn, formatCurrency } from "@/lib/utils"
import { toast } from "sonner"
import { FeeSummaryResponse, CategoryBreakdown, MonthDetail } from "@/types/fees"

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

interface CategoryDue {
  id: string
  name: string
  amount: number
  paid: number
  due: number
  selected: boolean
  payAmount: number | string
  month?: string
  expected_amount?: number
  due_date?: string
  status?: string
  is_advance?: boolean
  months?: MonthDetail[]
}

interface AdvanceAllocation {
  category_id: string
  category_name: string
  month: string
  amount: number
  allocation_type: string
  payment_id: string
  receipt_no: string | null
  payment_date: string | null
}

interface AcademicYearInfo {
  id: string
  name: string
  start_date: string | null
  end_date: string | null
}

interface DynamicStudentDue {
  student: {
    id: string
    name: string
    student_id: string
    father_name?: string
  }
  opening_balance: number
  current_charges: number
  discount: number
  fine: number
  total_payable: number
  total_paid: number
  remaining_due: number
  categories: CategoryDue[]
  discount_applied?: boolean
  discount_student_ids?: string[]
  advance_balance?: number
  due_details?: Array<{
    id: string
    month: string
    category_id: string | null
    expected_amount: number
    paid_amount: number
    due_amount: number
    fine_amount: number
    discount_amount: number
    status: string
    due_date: string
    is_advance: boolean
  }>
  summary: FeeSummaryResponse['summary'] | null
  category_breakdown?: CategoryBreakdown[]
  total_months_with_due?: number
  advance_allocations?: AdvanceAllocation[]
  academic_year?: AcademicYearInfo | null
}

interface Student {
  id: string
  student_id?: string
  name: string
  class_id: string
  class_name?: string
  father_name?: string
  class_roll?: string
  section?: string
  section_id?: string
  mobile?: string
  student_photo_url?: string | null
  academic_year_id?: string
  status?: string
}

interface SchoolSetting {
  school_name: string
  school_address: string
  school_phone: string
  school_email: string
  school_logo?: string | null
}

interface Section {
  id: string
  name: string
  class_id: string
}

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

function numberToWords(num: number): string {
  if (num === 0) return "Zero"
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"]
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]
  const teens = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"]

  function convert(n: number): string {
    if (n < 10) return ones[n]
    if (n < 20) return teens[n - 10]
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "")
    if (n < 1000) return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + convert(n % 100) : "")
    if (n < 100000) return convert(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + convert(n % 1000) : "")
    return convert(Math.floor(n / 100000)) + " Lakh" + (n % 100000 ? " " + convert(n % 100000) : "")
  }
  return convert(num)
}

function formatMonthRange(months: string[]): string {
  if (!months || months.length === 0) return ""

  const uniqueMonths = [...new Set(months)].sort()
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

  const byYear = new Map<string, number[]>()
  uniqueMonths.forEach((m) => {
    const [year, monthNum] = m.split("-")
    if (!byYear.has(year)) byYear.set(year, [])
    byYear.get(year)!.push(parseInt(monthNum))
  })

  const parts: string[] = []

  for (const [year, monthNums] of byYear) {
    const sorted = [...new Set(monthNums)].sort((a, b) => a - b)

    if (sorted.length === 1) {
      parts.push(`${monthNames[sorted[0] - 1]} ${year}`)
      continue
    }

    let isConsecutive = true
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] !== sorted[i - 1] + 1) {
        isConsecutive = false
        break
      }
    }

    if (isConsecutive) {
      parts.push(`${monthNames[sorted[0] - 1]}-${monthNames[sorted[sorted.length - 1] - 1]} ${year}`)
    } else {
      parts.push(`${sorted.map((n) => monthNames[n - 1]).join(", ")} ${year}`)
    }
  }

  return parts.join(", ")
}

function calculateAdvanceMonths(
  startMonth: string,
  endDate: string,
  monthlyAmount: number,
  totalAdvance: number
): Array<{ month: string; amount: number }> {
  const result: Array<{ month: string; amount: number }> = []
  if (monthlyAmount <= 0 || totalAdvance <= 0) return result

  const [startY, startM] = startMonth.split("-").map(Number)
  let year = startY
  let month = startM

  const end = new Date(endDate)
  const endY = end.getFullYear()
  const endM = end.getMonth() + 1

  let remaining = totalAdvance
  while (remaining > 0.01) {
    if (year > endY || (year === endY && month > endM)) break

    const monthStr = `${year}-${String(month).padStart(2, "0")}`
    const alloc = Math.min(remaining, monthlyAmount)
    result.push({ month: monthStr, amount: alloc })
    remaining -= alloc

    month++
    if (month > 12) {
      month = 1
      year++
    }
  }

  return result
}

const getSafeSrc = (src: string | null | undefined): string | undefined => {
  return src && src.trim() !== "" ? src : undefined
}

function generateReceiptNo(classPrefix?: string) {
  const date = new Date()
  const year = date.getFullYear()
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, "0")
  const prefix = classPrefix ? classPrefix.charAt(0).toUpperCase() : "P"
  return `${year}-${prefix}-${random}`
}

function normalizeDigits(val: string | number): number {
  const raw = typeof val === "number" ? String(val) : (val ?? "")
  const englishVal = raw.replace(/[০-৯]/g, (d) =>
    String("০১২৩৪৫৬৭৮৯".indexOf(d))
  )
  return parseFloat(englishVal) || 0
}

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

function ReceiveFeesContent() {
  const queryClient = useQueryClient()

  const [students, setStudents] = useState<Student[]>([])
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [receiptNo, setReceiptNo] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("cash")
  const [paymentNote, setPaymentNote] = useState("")
  const [showReceipt, setShowReceipt] = useState(false)
  const [lastReceipt, setLastReceipt] = useState<any>(null)

  const [isClient, setIsClient] = useState(false)
  const [isPdfGenerating, setIsPdfGenerating] = useState(false)
  const [dynamicDue, setDynamicDue] = useState<DynamicStudentDue | null>(null)
  const [quickSearch, setQuickSearch] = useState("")
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [loadingDue, setLoadingDue] = useState(false)

  const [filterClass, setFilterClass] = useState<string>("all")
  const [filterSection, setFilterSection] = useState<string>("all")

  const receiptRef = useRef<HTMLDivElement>(null)

  const searchParams = useSearchParams()

  useEffect(() => {
    setIsClient(true)
  }, [])

  const { data: schoolSettingsData } = useQuery({
    queryKey: ["school-settings"] as const,
    queryFn: async (): Promise<SchoolSetting> => {
      const { data, error } = await supabase.from("school_settings").select("*").single()
      if (error || !data) {
        return {
          school_name: "School Name",
          school_address: "School Address",
          school_phone: "01700000000",
          school_email: "info@school.com",
          school_logo: null,
        }
      }
      return {
        school_name: data.school_name || "School Name",
        school_address: data.school_address || "School Address",
        school_phone: data.school_phone || "01700000000",
        school_email: data.school_email || "info@school.com",
        school_logo: data.school_logo || null,
      }
    },
    staleTime: 10 * 60 * 1000,
  })

  const { data: studentsData, isLoading: isStudentsLoading } = useQuery({
    queryKey: ["students-quick-list"] as const,
    queryFn: async (): Promise<any[]> => {
      const { data, error } = await supabase.from("students").select("*")
      if (error) throw error
      return data || []
    },
    staleTime: 5 * 60 * 1000,
  })

  const { data: classesData } = useQuery({
    queryKey: ["classes"] as const,
    queryFn: async (): Promise<{ id: string; name: string }[]> => {
      const { data, error } = await supabase.from("classes").select("id, name")
      if (error) throw error
      return data || []
    },
    staleTime: 10 * 60 * 1000,
  })

  const { data: sectionsData } = useQuery({
    queryKey: ["sections-quick-list"] as const,
    queryFn: async (): Promise<Section[]> => {
      const { data, error } = await supabase.from("sections").select("id, name, class_id")
      if (error) throw error
      return data || []
    },
    staleTime: 10 * 60 * 1000,
  })

  useEffect(() => {
    if (studentsData) {
      const classMap = new Map(classesData?.map((c) => [c.id, c.name]) || [])
      const mapped = studentsData.map((s: any) => ({
        id: s.id,
        student_id: s.student_id || "N/A",
        name: s.name || "Unknown",
        class_id: s.class_id,
        class_name: classMap.get(s.class_id) || "N/A",
        father_name: s.father_name || "",
        class_roll: s.class_roll || "",
        section: s.section || "",
        section_id: s.section_id || null,
        mobile: s.mobile_no || s.mobile || "",
        student_photo_url: s.student_photo_url || null,
        academic_year_id: s.academic_year_id || null,
        status: s.status || "active",
      }))
      setStudents(mapped)
    }
  }, [studentsData, classesData])

  const availableSections = useMemo(() => {
    if (!sectionsData) return []
    if (filterClass === "all") return sectionsData
    return sectionsData.filter((s) => s.class_id === filterClass)
  }, [sectionsData, filterClass])

  useEffect(() => {
    if (filterSection !== "all" && filterClass !== "all") {
      const section = sectionsData?.find((s) => s.id === filterSection)
      if (section && section.class_id !== filterClass) {
        setFilterSection("all")
      }
    }
  }, [filterClass, filterSection, sectionsData])

  const filteredStudents = useMemo(() => {
    const hasSearch = quickSearch.trim().length > 0
    const hasFilter = filterClass !== "all" || filterSection !== "all"

    if (!hasSearch && !hasFilter) return students.slice(0, 15)

    const query = quickSearch.toLowerCase().trim()

    return students
      .filter((s) => {
        if (filterClass !== "all" && s.class_id !== filterClass) return false
        if (filterSection !== "all" && s.section_id !== filterSection) return false

        if (!hasSearch) return true

        if (s.name?.toLowerCase().includes(query)) return true
        if (s.student_id?.toLowerCase().includes(query)) return true
        const rollStr = String(s.class_roll ?? "").toLowerCase().trim()
        if (rollStr && rollStr.includes(query)) return true
        const mobileStr = String(s.mobile ?? "").toLowerCase()
        if (mobileStr && mobileStr.includes(query)) return true
        if (s.class_name?.toLowerCase().includes(query)) return true
        return false
      })
      .slice(0, 50)
  }, [students, quickSearch, filterClass, filterSection])

  const clearFilters = useCallback(() => {
    setQuickSearch("")
    setFilterClass("all")
    setFilterSection("all")
  }, [])

  const hasActiveFilters =
    quickSearch.trim().length > 0 || filterClass !== "all" || filterSection !== "all"

  const fetchDynamicDue = useCallback(async (studentId: string) => {
    try {
      setLoadingDue(true)
      const result = await fetch(`/api/fees/student-due?student_id=${studentId}`).then((r) => r.json())

      if (result?.success) {
        let categories: CategoryDue[] = []
        let dueDetails: DynamicStudentDue['due_details'] = []

        if (result.category_breakdown && result.category_breakdown.length > 0) {
          categories = result.category_breakdown.map((cat: any) => ({
            id: cat.category_id || `cat-${cat.category_name}`,
            name: cat.category_name || 'N/A',
            amount: cat.total_expected || 0,
            paid: cat.total_paid || 0,
            due: cat.total_due || 0,
            selected: (cat.total_due || 0) > 0,
            payAmount: (cat.total_due || 0) > 0 ? cat.total_due : 0,
            due_date: cat.months?.[0]?.due_date || null,
            status: cat.total_due > 0 ? 'pending' : 'paid',
            is_advance: false,
            months: cat.months || [],
          }))
        } else if (result.categories && result.categories.length > 0) {
          categories = result.categories.map((cat: any) => ({
            ...cat,
            selected: cat.due > 0,
            payAmount: cat.due > 0 ? cat.due : 0,
            due_date: cat.due_date || null,
            status: cat.status || 'pending',
            is_advance: cat.is_advance || false,
          }))
        } else if (result.due_details && result.due_details.length > 0) {
          dueDetails = result.due_details
          categories = result.due_details.map((d: any) => ({
            id: d.category_id || `due-${d.month}`,
            name: `Due for ${d.month}`,
            amount: d.expected_amount || 0,
            paid: d.paid_amount || 0,
            due: d.due_amount || 0,
            selected: d.due_amount > 0,
            payAmount: d.due_amount > 0 ? d.due_amount : 0,
            due_date: d.due_date || null,
            status: d.status || 'pending',
            is_advance: d.is_advance || false,
          }))
        }

        const summary = result.summary || null
        const advanceBalance = summary?.total_advance || 0

        setDynamicDue({
          ...result,
          categories,
          discount_student_ids: result.discount_student_ids || [],
          due_details: dueDetails,
          summary: summary,
          advance_balance: advanceBalance,
          advance_allocations: result.advance_allocations || [],
          academic_year: result.academic_year || null,
        })

        if (advanceBalance > 0) {
          toast.info(`💡 এই শিক্ষার্থীর অ্যাডভান্স ব্যালেন্স: ${formatCurrency(advanceBalance)}`, {
            duration: 4000,
          })
        }

        if (categories.length === 0 && !(dueDetails?.length)) {
          const netDue = summary?.net_due || 0
          if (netDue === 0 && summary) {
            toast.info('এই শিক্ষার্থীর কোনো বকেয়া নেই')
          } else if (!summary) {
            toast.error('সার্ভার থেকে তথ্য আসেনি, আবার চেষ্টা করুন')
          } else {
            toast.info('এই শিক্ষার্থীর জন্য কোনো বকেয়া খাত নেই')
          }
          setDynamicDue(null)
        }
      } else {
        toast.error(result?.error || "বকেয়ার তথ্য লোড করতে ব্যর্থ হয়েছে")
      }
    } catch (err) {
      console.error("Error fetching due:", err)
      toast.error("বকেয়ার তথ্য লোড করতে ব্যর্থ হয়েছে")
    } finally {
      setLoadingDue(false)
    }
  }, [])

  const toggleCategoryExpand = useCallback((categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(categoryId)) next.delete(categoryId)
      else next.add(categoryId)
      return next
    })
  }, [])

  const handleSelectStudent = useCallback((student: Student) => {
    setSelectedStudent(student)
    setReceiptNo(generateReceiptNo(student.class_name))
    fetchDynamicDue(student.id)
    toast.success(`${student.name} সিলেক্ট করা হয়েছে`)
  }, [fetchDynamicDue])

  const autoSelectAttempted = useRef<string | null>(null)

  useEffect(() => {
    const studentIdFromUrl = searchParams?.get("student_id")
    const sourceFromUrl = searchParams?.get("source")

    if (!studentIdFromUrl) return
    if (sourceFromUrl !== "due-list") return
    if (autoSelectAttempted.current === studentIdFromUrl) return

    if (!students || students.length === 0) {
      console.log("[receive] Waiting for students to load...")
      return
    }

    const targetStudent = students.find((s) => s.id === studentIdFromUrl)

    if (targetStudent) {
      autoSelectAttempted.current = studentIdFromUrl
      console.log("[receive] Auto-selecting student:", targetStudent.name)
      handleSelectStudent(targetStudent)
    } else {
      autoSelectAttempted.current = studentIdFromUrl
      console.warn("[receive] Student from URL not found:", studentIdFromUrl)
      toast.warning("Student not found — search manually")
    }
  }, [searchParams, students, handleSelectStudent])

  const handleCategoryToggle = (categoryId: string) => {
    if (!dynamicDue) return
    setDynamicDue((prev) => {
      if (!prev) return null
      const updated = prev.categories.map((c) => {
        if (c.id === categoryId) {
          const nextSelected = !c.selected
          return {
            ...c,
            selected: nextSelected,
            payAmount: nextSelected ? (c.due > 0 ? c.due : 0) : 0,
          }
        }
        return c
      })
      return { ...prev, categories: updated }
    })
  }

  const handleCategoryAmountChange = (categoryId: string, val: string) => {
    setDynamicDue((prev) => {
      if (!prev) return null
      const updated = prev.categories.map((c) => {
        if (c.id === categoryId) {
          const numVal = normalizeDigits(val)
          return {
            ...c,
            selected: numVal > 0 ? true : c.selected,
            payAmount: val,
          }
        }
        return c
      })
      return { ...prev, categories: updated }
    })
  }

  const totalPayingAmount = useMemo(() => {
    if (!dynamicDue) return 0
    return dynamicDue.categories
      .filter((c) => c.selected)
      .reduce((sum, c) => sum + normalizeDigits(c.payAmount), 0)
  }, [dynamicDue])

  const selectedDueAmount = useMemo(() => {
    if (!dynamicDue) return 0
    return dynamicDue.categories
      .filter((c) => c.selected)
      .reduce((sum, c) => sum + c.due, 0)
  }, [dynamicDue])

  const hasAdvanceBalance = useMemo(() => {
    return Boolean(
      dynamicDue?.advance_balance && dynamicDue.advance_balance > 0
    )
  }, [dynamicDue])

  const doesDiscountApplyToStudent = useCallback(() => {
    if (!dynamicDue || !selectedStudent) return false
    if (!dynamicDue.discount_applied) return false
    if (dynamicDue.discount <= 0) return false

    if (!dynamicDue.discount_student_ids || dynamicDue.discount_student_ids.length === 0) {
      return true
    }
    return dynamicDue.discount_student_ids.includes(selectedStudent.id)
  }, [dynamicDue, selectedStudent])

  const handleSubmit = useCallback(async () => {
    if (!selectedStudent || totalPayingAmount <= 0 || !dynamicDue) {
      toast.error("অনুগ্রহ করে অন্তত একটি খাত সিলেক্ট করুন এবং সঠিক পরিমাণ লিখুন")
      return
    }

    const selectedCategories = dynamicDue.categories
      .filter((c) => c.selected && normalizeDigits(c.payAmount) > 0)
      .map((c) => ({
        ...c,
        numPayAmount: normalizeDigits(c.payAmount),
      }))

    setSubmitting(true)
    try {
      const response = await fetch("/api/receive-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: selectedStudent.id,
          allocations: selectedCategories.map((c) => ({
            category_id: c.id,
            amount: c.numPayAmount,
          })),
          totalPaid: totalPayingAmount,
          paymentMethod,
          receiptNo,
          note: paymentNote,
          discountAmount: dynamicDue.discount_applied ? dynamicDue.discount : 0,
          fineAmount: dynamicDue.fine || 0,
        }),
      })

      const result = await response.json()
      if (!result.success) throw new Error(result.error || "Payment failed")

      const receiptItems: Array<{
        category_name: string
        paying_amount: number
        category_id: string
        is_advance: boolean
      }> = []

      const academicYearEnd = dynamicDue.academic_year?.end_date
        ? dynamicDue.academic_year.end_date
        : null

      const now = new Date()
      const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      const nextMonthStr = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, "0")}`

      selectedCategories.forEach((c) => {
        const payAmt = c.numPayAmount
        const duePortion = Math.min(payAmt, c.due)
        const advancePortion = Math.max(0, payAmt - c.due)
        const categoryMonths = (c.months || []) as Array<{
          month: string
          expected: number
          paid: number
          due: number
          status: string
        }>

        if (duePortion > 0) {
          const dueMonths = categoryMonths
            .filter((m) => m.due > 0)
            .sort((a, b) => a.month.localeCompare(b.month))

          let remaining = duePortion
          const monthAllocs: Array<{ month: string; amount: number }> = []

          for (const m of dueMonths) {
            if (remaining <= 0.01) break
            const alloc = Math.min(remaining, m.due)
            if (alloc > 0) {
              monthAllocs.push({ month: m.month, amount: alloc })
              remaining -= alloc
            }
          }

          const monthStr = formatMonthRange(monthAllocs.map((m) => m.month))

          receiptItems.push({
            category_id: c.id,
            category_name: monthStr ? `${c.name} (${monthStr})` : c.name,
            paying_amount: duePortion,
            is_advance: false,
          })
        }

        if (advancePortion > 0) {
          const structureAmount =
            c.months && c.months.length > 0
              ? c.months[0].expected
              : c.amount / Math.max(1, c.months?.length || 1)

          const effectiveEndDate = academicYearEnd
            ? academicYearEnd
            : new Date(now.getFullYear(), 11, 31).toISOString().slice(0, 10)

          const advanceMonths = calculateAdvanceMonths(
            nextMonthStr,
            effectiveEndDate,
            structureAmount,
            advancePortion
          )

          const academicYearAdvanceTotal = advanceMonths.reduce(
            (s, m) => s + m.amount,
            0
          )
          const carryForwardAmount = advancePortion - academicYearAdvanceTotal

          if (academicYearAdvanceTotal > 0.01) {
            const advanceMonthStr = formatMonthRange(advanceMonths.map((m) => m.month))
            receiptItems.push({
              category_id: c.id,
              category_name: advanceMonthStr
                ? `${c.name} — Advance (${advanceMonthStr})`
                : `${c.name} — Advance`,
              paying_amount: academicYearAdvanceTotal,
              is_advance: true,
            })
          }

          if (carryForwardAmount > 0.01) {
            receiptItems.push({
              category_id: c.id,
              category_name: `${c.name} — Carry Forward (Next Year)`,
              paying_amount: carryForwardAmount,
              is_advance: true,
            })
          }
        }
      })

      const currentSchool = schoolSettingsData || {
        school_name: "School Name",
        school_address: "School Address",
        school_phone: "01700000000",
        school_email: "info@school.com",
        school_logo: null,
      }

      setLastReceipt({
        receipt: {
          receiptNo,
          date: new Date().toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          }),
          status: "Paid",
          paidAmount: totalPayingAmount,
          paymentMethod,
        },
        student: selectedStudent,
        items: receiptItems,
        schoolSettings: currentSchool,
        hasAdvance: (dynamicDue.advance_balance || 0) > 0,
        advanceAmount: dynamicDue.advance_balance || 0,
        discountApplied: dynamicDue.discount_applied,
        discountAmount: dynamicDue.discount,
        fineAmount: dynamicDue.fine || 0,
        remainingDue: dynamicDue.remaining_due - totalPayingAmount,
      })

      toast.success(`${formatCurrency(totalPayingAmount)} ফি জমা সফল হয়েছে!`)

      await fetchDynamicDue(selectedStudent.id)
      queryClient.invalidateQueries({ refetchType: "all" })

      setPaymentNote("")
      setShowReceipt(true)
    } catch (err: any) {
      toast.error(`পেমেন্ট ব্যর্থ হয়েছে: ${err.message || "Unknown Error"}`)
    } finally {
      setSubmitting(false)
    }
  }, [
    selectedStudent,
    totalPayingAmount,
    dynamicDue,
    paymentMethod,
    receiptNo,
    paymentNote,
    schoolSettingsData,
    queryClient,
    fetchDynamicDue,
  ])

  const handlePrintReceipt = useCallback(() => {
    const printContent = document.getElementById("receipt-content")
    if (!printContent) {
      toast.error("Receipt content not found")
      return
    }

    const printWindow = window.open("", "_blank")
    if (!printWindow) {
      toast.error("Please allow popups to print")
      return
    }

    const styles = document.querySelectorAll('style, link[rel="stylesheet"]')
    let styleHTML = ""
    styles.forEach((style) => {
      if (style.tagName === "STYLE") {
        styleHTML += `<style>${(style as HTMLStyleElement).innerHTML}</style>`
      } else if (style.tagName === "LINK") {
        const link = style as HTMLLinkElement
        if (link.href) {
          styleHTML += `<link href="${link.href}" rel="stylesheet">`
        }
      }
    })

    const originalContent = printContent.cloneNode(true) as HTMLElement

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Payment Receipt - ${lastReceipt?.receipt.receiptNo || "Receipt"}</title>
          <meta charset="UTF-8">
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
          ${styleHTML}
          <style>
            body { background: white; padding: 10px; margin: 0; font-family: 'Inter', sans-serif; }
            @media print {
              body { padding: 0; margin: 0; }
              @page {
                size: A4 landscape;
                margin: 0.5in;
              }
              @page :first {
                margin: 0.5in;
              }
              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .print-container {
                max-width: 100%;
                margin: 0 auto;
                background: white;
                page-break-inside: avoid;
              }
            }
            .print-container { max-width: 100%; margin: 0 auto; background: white; }
          </style>
        </head>
        <body>
          <div class="print-container">
            ${originalContent.outerHTML}
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                setTimeout(function() { window.close(); }, 300);
              }, 100);
            }
          </script>
        </body>
      </html>
    `)

    printWindow.document.close()
    setShowReceipt(false)
    setLastReceipt(null)
  }, [lastReceipt])

  const handleExportPDF = useCallback(async () => {
    if (!isClient || !lastReceipt) return
    if (isPdfGenerating) return

    setIsPdfGenerating(true)
    toast.loading("PDF জেনারেট হচ্ছে...")

    try {
      const html2canvasModule = await import("html2canvas-pro")
      const html2canvasFn = (html2canvasModule as any).default || html2canvasModule
      const jsPDFModule = await import("jspdf")
      const jsPDF = jsPDFModule.default

      const tempDiv = document.createElement("div")
      tempDiv.style.position = "absolute"
      tempDiv.style.left = "-9999px"
      tempDiv.style.top = "-9999px"
      tempDiv.style.width = "297mm"
      tempDiv.style.backgroundColor = "white"
      document.body.appendChild(tempDiv)

      const r = lastReceipt
      const totalPaid = r.items.reduce((s: number, i: any) => s + (i.paying_amount || 0), 0)

      const SingleCopy = (title: string) => `
        <div style="padding: 4mm; font-family: Arial; font-size: 9pt; color: black; background: white; width: 49%; border: 1px dashed #ccc; box-sizing: border-box;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #ccc; padding-bottom: 2mm; margin-bottom: 2mm;">
            <div style="display: flex; gap: 2mm; align-items: center;">
              ${r.schoolSettings.school_logo ? `<img src="${getSafeSrc(r.schoolSettings.school_logo)}" style="height: 38px; width: auto;" />` : ""}
              <div>
                <h2 style="font-size: 11pt; font-weight: bold; margin: 0;">${r.schoolSettings.school_name}</h2>
                <p style="margin: 1px 0; font-size: 7.5pt;">${r.schoolSettings.school_address}</p>
                <p style="margin: 1px 0; font-size: 7.5pt;">Phone: ${r.schoolSettings.school_phone}</p>
              </div>
            </div>
            <div style="background: #fef3c7; padding: 1mm 3mm; text-align: right;">
              <h3 style="font-weight: bold; margin: 0; font-size: 9pt;">Payment Receipt</h3>
              <p style="margin: 1px 0; font-size: 7.5pt;">No: ${r.receipt.receiptNo}</p>
              <p style="margin: 1px 0; font-size: 7.5pt;">Date: ${r.receipt.date}</p>
            </div>
          </div>

          <p style="text-align: center; font-weight: bold; margin: 1mm 0; font-size: 9pt;">${title}</p>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 2mm; font-size: 8pt;">
            <tbody>
              <tr>
                <td style="border: 1px solid #ccc; padding: 1mm;">Student ID</td>
                <td style="border: 1px solid #ccc; padding: 1mm;">${r.student.student_id || "N/A"}</td>
                <td style="border: 1px solid #ccc; padding: 1mm;">Class</td>
                <td style="border: 1px solid #ccc; padding: 1mm;">${r.student.class_name}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #ccc; padding: 1mm;">Name</td>
                <td style="border: 1px solid #ccc; padding: 1mm;">${r.student.name}</td>
                <td style="border: 1px solid #ccc; padding: 1mm;">Roll / Sec</td>
                <td style="border: 1px solid #ccc; padding: 1mm;">${r.student.class_roll || "N/A"} (${r.student.section || "A"})</td>
              </tr>
            </tbody>
          </table>

          <p style="font-weight: bold; margin: 1mm 0; font-size: 8.5pt;">Payment Breakdown</p>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 2mm; font-size: 8pt;">
            <thead>
              <tr style="background: #f3f4f6;">
                <th style="border: 1px solid #ccc; padding: 1mm; text-align: left;">SL</th>
                <th style="border: 1px solid #ccc; padding: 1mm; text-align: left;">Description</th>
                <th style="border: 1px solid #ccc; padding: 1mm; text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${r.items
                .map(
                  (item: any, idx: number) => `
                <tr>
                  <td style="border: 1px solid #ccc; padding: 1mm;">${idx + 1}</td>
                  <td style="border: 1px solid #ccc; padding: 1mm;">${item.category_name}</td>
                  <td style="border: 1px solid #ccc; padding: 1mm; text-align: right; font-weight: bold;">${formatCurrency(item.paying_amount || 0)}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>

          <div style="display: flex; justify-content: flex-end; margin: 1mm 0;">
            <table style="width: 50%; font-size: 8.5pt;">
              <tr style="font-weight: bold; color: #059669;"><td style="padding: 1mm;">Total Paid:</td><td style="text-align: right;">${formatCurrency(totalPaid)}</td></tr>
            </table>
          </div>

          <p style="margin: 1mm 0; font-size: 8pt;"><strong>In word:</strong> ${numberToWords(totalPaid)} taka only.</p>

          <div style="display: flex; justify-content: space-between; margin-top: 6mm; font-size: 7.5pt;">
            <div>_________________<br/>Cashier Signature</div>
            <div>_________________<br/>Guardian Signature</div>
          </div>
        </div>
      `

      tempDiv.innerHTML = `
        <div style="width: 297mm; margin: 0 auto; background: white; display: flex; justify-content: space-between; padding: 4mm;">
          ${SingleCopy("Student Copy")}
          ${SingleCopy("Office Copy")}
        </div>
      `

      const canvas = await html2canvasFn(tempDiv, {
        scale: 2,
        backgroundColor: "#ffffff",
        logging: false,
        useCORS: true,
      })

      document.body.removeChild(tempDiv)

      const imgData = canvas.toDataURL("image/png", 1.0)
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const imgHeight = (canvas.height * pdfWidth) / canvas.width

      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, imgHeight)
      pdf.save(`Receipt-${lastReceipt.receipt.receiptNo}.pdf`)

      toast.dismiss()
      toast.success("PDF ডাউনলোড সম্পন্ন হয়েছে!")
      setShowReceipt(false)
      setLastReceipt(null)
    } catch (error: any) {
      toast.dismiss()
      toast.error("PDF তৈরি করতে সমস্যা হয়েছে")
    } finally {
      setIsPdfGenerating(false)
    }
  }, [isClient, lastReceipt, isPdfGenerating])

  const ReceiptContent = () => {
    const r = lastReceipt
    if (!r) return null

    const totalPaid = r.items.reduce((s: number, i: any) => s + (i.paying_amount || 0), 0)

    const SingleCopy = ({ title }: { title: string }) => (
      <div
        className="p-3 text-[9pt] text-black bg-white border border-dashed border-gray-300 w-[49%] min-w-0 flex flex-col justify-between"
        style={{ fontFamily: "Arial" }}
      >
        <div>
          <div className="flex justify-between items-start border-b pb-1.5 mb-2">
            <div className="flex gap-2 items-center">
              {r.schoolSettings?.school_logo && (
                <img src={getSafeSrc(r.schoolSettings.school_logo)} className="h-9 w-9 object-contain" alt="Logo" />
              )}
              <div>
                <h2 className="text-xs font-bold">{r.schoolSettings?.school_name}</h2>
                <p className="text-[8pt] text-gray-600">{r.schoolSettings?.school_address}</p>
                <p className="text-[7.5pt] text-gray-500">Phone: {r.schoolSettings?.school_phone}</p>
              </div>
            </div>
            <div className="bg-amber-100 px-2 py-1 text-right rounded">
              <h2 className="font-bold text-[9pt]">Payment Receipt</h2>
              <p className="text-[7.5pt]">No: {r.receipt.receiptNo}</p>
              <p className="text-[7.5pt]">Date: {r.receipt.date}</p>
            </div>
          </div>

          <p className="text-center font-bold text-[9.5pt] mb-1.5 underline">{title}</p>

          <table className="w-full border-collapse text-[8.5pt] mb-2">
            <tbody>
              <tr>
                <td className="border p-1 bg-gray-50">Student ID</td>
                <td className="border p-1 font-semibold">{r.student.student_id || "N/A"}</td>
                <td className="border p-1 bg-gray-50">Class</td>
                <td className="border p-1 font-semibold">{r.student.class_name}</td>
              </tr>
              <tr>
                <td className="border p-1 bg-gray-50">Name</td>
                <td className="border p-1 font-semibold">{r.student.name}</td>
                <td className="border p-1 bg-gray-50">Roll / Sec</td>
                <td className="border p-1">
                  {r.student.class_roll || "N/A"} ({r.student.section || "A"})
                </td>
              </tr>
              <tr>
                <td className="border p-1 bg-gray-50">Payment Method</td>
                <td className="border p-1 capitalize">{r.receipt.paymentMethod}</td>
                <td className="border p-1 bg-gray-50">Guardian</td>
                <td className="border p-1">{r.student.father_name || "N/A"}</td>
              </tr>
            </tbody>
          </table>

          <p className="font-bold text-[9pt] mb-1">Payment Breakdown</p>
          <table className="w-full border-collapse text-[8.5pt]">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-1 text-left">SL</th>
                <th className="border p-1 text-left">Description</th>
                <th className="border p-1 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {r.items.map((item: any, i: number) => (
                <tr key={i}>
                  <td className="border p-1 text-center">{i + 1}</td>
                  <td className="border p-1">{item.category_name}</td>
                  <td className="border p-1 text-right font-semibold">
                    {formatCurrency(item.paying_amount || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end my-1.5">
            <table className="w-1/2 text-[9pt]">
              <tbody>
                <tr className="font-bold text-emerald-700">
                  <td className="p-0.5">Total Paid:</td>
                  <td className="text-right">{formatCurrency(totalPaid)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="text-[8pt] text-gray-700">
            <strong>In word:</strong> {numberToWords(totalPaid)} taka only.
          </p>
        </div>

        <div className="flex justify-between mt-8 text-[8pt] text-gray-600">
          <div className="text-center">
            _________________
            <br />
            Cashier Signature
          </div>
          <div className="text-center">
            _________________
            <br />
            Guardian Signature
          </div>
        </div>
      </div>
    )

    return (
      <div style={{ width: "100%", background: "white" }}>
        <div className="flex justify-between gap-2 p-2">
          <SingleCopy title="Student Copy" />
          <SingleCopy title="Office Copy" />
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
    <ResponsiveLayout>
      <div className="space-y-3 sm:space-y-4 p-2 sm:p-4 max-w-full mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between bg-gradient-to-r from-emerald-800 to-teal-700 p-2.5 sm:p-3.5 rounded-xl text-white shadow-md gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              asChild
              className="bg-white/10 hover:bg-white/20 text-white h-8 w-8 shrink-0"
            >
              <Link href="/fees">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-lg font-bold flex items-center gap-1.5 truncate">
                <Zap className="h-4 w-4 text-yellow-300 fill-yellow-300 shrink-0" /> Fast Fee Collection
              </h1>
              <p className="text-white/80 text-[10px] sm:text-xs truncate hidden sm:block">
                দ্রুত ফি গ্রহণ এবং স্লিপ প্রিন্ট সিস্টেম
              </p>
            </div>
          </div>
          <Badge className="bg-emerald-500/30 text-white border-emerald-400/30 shrink-0 text-[10px]">
            <Banknote className="h-3 w-3 mr-1" /> Quick Pay
          </Badge>
        </div>

        {/* Layout: Search 25% | Fee Table 50% | Payment 25% */}
        <div className="grid gap-3 sm:gap-4 lg:grid-cols-12">
          {/* Search sidebar */}
          <div className="lg:col-span-3 bg-white dark:bg-gray-900 rounded-xl border p-2 sm:p-3 shadow-sm flex flex-col h-[calc(100vh-140px)] h-[calc(100dvh-140px)] lg:h-[calc(100vh-140px)]">
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="ID, Roll বা নাম দিয়ে খুঁজুন..."
                value={quickSearch}
                onChange={(e) => setQuickSearch(e.target.value)}
                className="pl-9 pr-8 h-9 text-sm"
                autoFocus
              />
              {quickSearch && (
                <button
                  onClick={() => setQuickSearch("")}
                  className="absolute right-2 top-2.5 h-4 w-4 text-gray-400 hover:text-gray-600"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-1.5 mb-2">
              <Select value={filterClass} onValueChange={setFilterClass}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="সব ক্লাস" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">সব ক্লাস</SelectItem>
                  {classesData?.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterSection} onValueChange={setFilterSection}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="সব সেকশন" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">সব সেকশন</SelectItem>
                  {availableSections.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="text-xs">
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {hasActiveFilters && (
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-[10px] text-gray-500">
                  <strong className="text-emerald-600">{filteredStudents.length}</strong> জন পাওয়া গেছে
                  {filteredStudents.length === 50 && " (আরো থাকতে পারে)"}
                </span>
                <button
                  onClick={clearFilters}
                  className="text-[10px] text-rose-500 hover:text-rose-700 font-medium flex items-center gap-0.5"
                >
                  <X className="h-3 w-3" /> ক্লিয়ার
                </button>
              </div>
            )}

            <div
              className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              {isStudentsLoading ? (
                <div className="p-4 space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-xs">
                  {hasActiveFilters
                    ? `"${quickSearch}" এ কোনো শিক্ষার্থী পাওয়া যায়নি`
                    : "শিক্ষার্থী পাওয়া যায়নি"}
                </div>
              ) : (
                filteredStudents.map((student) => (
                  <div
                    key={student.id}
                    onClick={() => handleSelectStudent(student)}
                    className={cn(
                      "p-2.5 cursor-pointer rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-all flex items-center gap-3 my-0.5",
                      selectedStudent?.id === student.id &&
                        "bg-emerald-100 dark:bg-emerald-900/50 border-l-4 border-emerald-600"
                    )}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={getSafeSrc(student.student_photo_url)} />
                      <AvatarFallback className="text-xs">{student.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-xs text-gray-900 dark:text-gray-100 truncate">
                        {student.name}
                      </p>
                      <p className="text-[10px] text-gray-500 truncate">
                        ID: {student.student_id} | {student.class_name} ({student.class_roll || "N/A"})
                      </p>
                    </div>
                    {selectedStudent?.id === student.id && (
                      <Check className="h-4 w-4 text-emerald-600" />
                    )}
                  </div>
                ))
              )}
            </div>

            {!hasActiveFilters && students.length > 15 && (
              <div className="text-center py-2 mt-2 text-[10px] text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                💡 আরো শিক্ষার্থী দেখতে সার্চ বা ফিল্টার করুন
              </div>
            )}
          </div>

          {/* Main content */}
          <div className="lg:col-span-9 space-y-4">
            {!selectedStudent ? (
              <div className="bg-white dark:bg-gray-900 border rounded-xl p-12 text-center h-[calc(100vh-140px)] h-[calc(100dvh-140px)] lg:h-[calc(100vh-140px)] flex flex-col justify-center items-center text-gray-400">
                <User className="h-12 w-12 mb-2 stroke-1" />
                <p className="text-sm font-medium">বাম পাশের তালিকা থেকে শিক্ষার্থী সিলেক্ট করুন</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
                {/* ফি খাতসমূহ — বড় (2/3) */}
                <div className="md:col-span-2 bg-white dark:bg-gray-900 border rounded-xl p-3 sm:p-4 shadow-sm space-y-3">
                  <div className="flex items-center gap-3 border-b pb-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={getSafeSrc(selectedStudent.student_photo_url)} />
                      <AvatarFallback>{selectedStudent.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-sm text-gray-900 dark:text-gray-100 truncate">
                        {selectedStudent.name}
                      </h3>
                      <p className="text-xs text-gray-500 truncate">
                        Class: {selectedStudent.class_name} | Roll: {selectedStudent.class_roll || "N/A"}
                      </p>
                      {hasAdvanceBalance && (
                        <Badge className="mt-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 text-[9px]">
                          💰 Advance: {formatCurrency(dynamicDue?.advance_balance ?? 0)}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {loadingDue ? (
                    <div className="py-8 text-center text-xs text-gray-500 flex justify-center items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-emerald-600" /> লোড হচ্ছে...
                    </div>
                  ) : !dynamicDue ? (
                    <div className="py-8 text-center text-xs text-gray-500">
                      শিক্ষার্থী সিলেক্ট করুন অথবা সার্ভারের সংযোগ আবার চেষ্টা করুন
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center gap-2">
                        <p className="font-bold text-xs sm:text-sm">ফি খাতসমূহ সিলেক্ট করুন:</p>
                        <span className="text-[10px] text-gray-400 text-right">
                          * বকেয়ার চেয়ে বেশি লিখলে অগ্রীম জমা হবে
                        </span>
                      </div>

                      {hasAdvanceBalance && (
                        <div className="bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-950/30 dark:to-amber-950/30 p-2 rounded-lg border border-yellow-200 dark:border-yellow-800 flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-yellow-600 shrink-0" />
                          <span className="text-xs font-medium text-yellow-700 dark:text-yellow-300">
                            💰 অ্যাডভান্স ব্যালেন্স: {formatCurrency(dynamicDue?.advance_balance ?? 0)}
                          </span>
                        </div>
                      )}

                      {doesDiscountApplyToStudent() && (
                        <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 p-2 rounded-lg border border-purple-200 dark:border-purple-800 flex items-center gap-2">
                          <Percent className="h-4 w-4 text-purple-600 shrink-0" />
                          <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
                            ✅ Discount Applied: {formatCurrency(dynamicDue.discount)}
                          </span>
                        </div>
                      )}

                      {dynamicDue.fine > 0 && (
                        <div className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30 p-2 rounded-lg border border-red-200 dark:border-red-800 flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                          <span className="text-xs font-medium text-red-700 dark:text-red-300">
                            ⚠️ Fine: {formatCurrency(dynamicDue.fine)}
                          </span>
                        </div>
                      )}

                      {/* ═══════════════════════════════════════════════════
                          ✅ COMPACT TABLE — Smaller column sizes
                      ═══════════════════════════════════════════════════ */}
                      <div className="max-h-[400px] overflow-y-auto overflow-x-auto border rounded-lg">
                        <Table className="w-full">
                          <TableHeader>
                            <TableRow className="bg-gray-50 dark:bg-gray-800">
                              <TableHead className="w-8 h-7 text-center text-[10px] px-1">#</TableHead>
                              <TableHead className="h-7 text-[10px] px-2 min-w-[80px]">খাত</TableHead>
                              <TableHead className="h-7 text-[10px] px-1 hidden md:table-cell w-16">বিস্তারিত</TableHead>
                              <TableHead className="h-7 text-right text-[10px] px-1 w-20">বকেয়া</TableHead>
                              <TableHead className="h-7 text-right text-[10px] px-1 w-24">পরিশোধ</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {dynamicDue.categories.map((c) => (
                              <Fragment key={c.id}>
                                <TableRow className="text-[11px]">
                                  <TableCell className="py-1.5 text-center px-1">
                                    <Checkbox
                                      checked={c.selected === true}
                                      onCheckedChange={() => handleCategoryToggle(c.id)}
                                      className="h-3.5 w-3.5 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                                    />
                                  </TableCell>
                                  <TableCell className="py-1.5 font-medium px-2 text-xs">
                                    {c.name}
                                  </TableCell>
                                  <TableCell className="py-1.5 hidden md:table-cell px-1 text-center">
                                    {c.months && c.months.length > 0 ? (
                                      <button
                                        onClick={() => toggleCategoryExpand(c.id)}
                                        className="flex items-center gap-0.5 text-[10px] text-gray-500 hover:text-gray-700 mx-auto"
                                      >
                                        {expandedCategories.has(c.id) ? (
                                          <ChevronDown className="h-3 w-3" />
                                        ) : (
                                          <ChevronRight className="h-3 w-3" />
                                        )}
                                        {c.months.length}
                                      </button>
                                    ) : (
                                      <span className="text-[10px] text-gray-400">—</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="py-1.5 text-right text-red-500 px-1 text-[11px] tabular-nums">
                                    {c.due > 0 ? (
                                      formatCurrency(c.due)
                                    ) : (
                                      <span className="text-gray-400">—</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="py-1.5 text-right px-1">
                                    <Input
                                      type="text"
                                      inputMode="decimal"
                                      value={c.payAmount}
                                      onChange={(e) => handleCategoryAmountChange(c.id, e.target.value)}
                                      disabled={!c.selected}
                                      placeholder="0"
                                      className="h-7 text-right text-[11px] p-1 font-semibold border-emerald-300 focus-visible:ring-emerald-500 w-20 tabular-nums"
                                    />
                                  </TableCell>
                                </TableRow>
                                {c.months && expandedCategories.has(c.id) && (
                                  <TableRow className="bg-gray-50/50 dark:bg-gray-800/30">
                                    <TableCell colSpan={5} className="p-2">
                                      <div className="space-y-1 ml-3 border-l-2 border-gray-200 dark:border-gray-700 pl-2">
                                        <p className="text-[9px] font-semibold text-gray-500 uppercase">
                                          মাসের বিবরণী
                                        </p>
                                        {c.months.map((m, idx) => (
                                          <div
                                            key={idx}
                                            className="grid grid-cols-2 sm:grid-cols-7 gap-1 sm:gap-2 text-[9px] sm:text-[10px] py-0.5 border-b border-dashed border-gray-100 dark:border-gray-800 sm:border-0 last:border-0"
                                          >
                                            <span className="font-mono font-semibold sm:col-span-2">
                                              {m.month}
                                            </span>
                                            <span className="sm:col-span-2 text-right sm:text-left">
                                              Expected: {formatCurrency(m.expected)}
                                            </span>
                                            <span className="sm:col-span-1 text-right sm:text-left">
                                              Paid: {formatCurrency(m.paid)}
                                            </span>
                                            <span
                                              className={`sm:col-span-1 font-medium text-right sm:text-left ${
                                                m.due > 0 ? "text-red-500" : "text-gray-400"
                                              }`}
                                            >
                                              Due: {formatCurrency(m.due)}
                                            </span>
                                            <span className="sm:col-span-1 text-right capitalize">
                                              {m.status}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                )}
                              </Fragment>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      {/* ✅ Selected due summary (kept) */}
                      <div className="flex justify-between items-center pt-2 border-t">
                        <span className="text-xs text-gray-500">সিলেক্টেড বকেয়া:</span>
                        <span className="text-xs font-bold text-red-600 tabular-nums">
                          {formatCurrency(selectedDueAmount)}
                        </span>
                      </div>

                      {/* ✅ REMOVED: "সিলেক্টেড খাতসমূহের বকেয়া" block — replaced with compact summary */}

                      <div className="flex justify-between items-center text-[10px] text-gray-400 pt-1 border-t">
                        <span>মোট বকেয়া (সব খাত):</span>
                        <span className="tabular-nums">{formatCurrency(dynamicDue.remaining_due)}</span>
                      </div>

                      {hasAdvanceBalance && dynamicDue.remaining_due > 0 && (
                        <div className="flex justify-between items-center text-[10px] text-yellow-600 bg-yellow-50 dark:bg-yellow-950/20 p-1 rounded">
                          <span>অ্যাডভান্স বাদে নেট বকেয়া:</span>
                          <span className="font-bold tabular-nums">
                            {formatCurrency(
                              Math.max(0, dynamicDue.remaining_due - (dynamicDue.advance_balance || 0))
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* পেমেন্ট এন্ট্রি — ছোট (1/3) */}
                <div className="md:col-span-1 bg-white dark:bg-gray-900 border rounded-xl p-3 sm:p-4 shadow-sm flex flex-col justify-between gap-3">
                  <div className="space-y-3">
                    <CardTitle className="text-xs font-bold uppercase text-gray-500">
                      পেমেন্ট এন্ট্রি
                    </CardTitle>

                    <div>
                      <Label className="text-xs">রসিদ নং</Label>
                      <Input
                        value={receiptNo}
                        onChange={(e) => setReceiptNo(e.target.value)}
                        className="h-8 text-xs font-mono mt-1"
                      />
                    </div>

                    <div>
                      <Label className="text-xs">পেমেন্ট মেথড</Label>
                      <div className="grid grid-cols-3 gap-1 mt-1">
                        {[
                          { id: "cash", label: "Cash", icon: Banknote },
                          { id: "bank", label: "Bank", icon: Landmark },
                          { id: "mobile", label: "Mobile", icon: Smartphone },
                        ].map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setPaymentMethod(m.id)}
                            className={cn(
                              "flex items-center justify-center gap-1 p-1.5 border rounded text-[10px] sm:text-xs transition-all",
                              paymentMethod === m.id
                                ? "bg-emerald-50 border-emerald-600 text-emerald-700 font-bold"
                                : "text-gray-600"
                            )}
                          >
                            <m.icon className="h-3 w-3" /> {m.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="bg-emerald-50 dark:bg-emerald-950/30 p-3 rounded-lg border border-emerald-200">
                      <Label className="text-[10px] sm:text-xs font-bold text-emerald-800 dark:text-emerald-300">
                        সর্বমোট জমা হতে যাচ্ছে (৳)
                      </Label>
                      <div className="text-xl sm:text-2xl font-black text-emerald-600 mt-1 tabular-nums break-all leading-tight">
                        {formatCurrency(totalPayingAmount)}
                      </div>
                      {totalPayingAmount > 0 && totalPayingAmount > selectedDueAmount && (
                        <div className="text-[10px] text-amber-600 mt-1">
                          ⚡ {formatCurrency(totalPayingAmount - selectedDueAmount)} টাকা অগ্রীম জমা হবে
                        </div>
                      )}
                    </div>

                    <div>
                      <Input
                        placeholder="নোট (ঐচ্ছিক)..."
                        value={paymentNote}
                        onChange={(e) => setPaymentNote(e.target.value)}
                        className="h-8 text-xs mt-2"
                      />
                    </div>
                  </div>

                  <Button
                    onClick={handleSubmit}
                    disabled={submitting || totalPayingAmount <= 0}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-auto min-h-[42px] py-2 px-2 transition-all whitespace-normal leading-tight"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1.5 shrink-0" />
                    ) : (
                      <Receipt className="h-4 w-4 mr-1.5 shrink-0" />
                    )}
                    <span className="text-xs sm:text-sm text-center">
                      ফি জমা নিশ্চিত করুন
                    </span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="max-w-[95vw] w-full lg:max-w-[1100px] h-[90vh] max-h-[90vh] p-0 gap-0 bg-gray-100 dark:bg-gray-950 flex flex-col overflow-hidden">
          <DialogHeader className="sticky top-0 bg-white dark:bg-gray-900 z-20 px-4 sm:px-6 py-3 border-b shadow-sm">
            <div className="flex justify-between items-center gap-2 flex-wrap">
              <DialogTitle className="text-sm sm:text-base font-bold flex gap-2 items-center text-gray-900 dark:text-gray-100">
                <Receipt className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" /> Payment Receipt
              </DialogTitle>
              <div className="flex gap-2 sm:gap-3">
                <Button onClick={handlePrintReceipt} variant="outline" size="sm" className="text-xs">
                  <Printer className="h-3.5 w-3.5 mr-1.5" /> Print
                </Button>
                <Button
                  onClick={handleExportPDF}
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-xs"
                  disabled={isPdfGenerating}
                >
                  {isPdfGenerating ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  PDF
                </Button>
              </div>
            </div>
          </DialogHeader>

          <DialogDescription className="sr-only">
            Payment receipt preview with student and office copy
          </DialogDescription>

          {lastReceipt && (
            <div className="flex-1 overflow-auto p-2 sm:p-4 bg-gray-200 dark:bg-gray-950 flex justify-center">
              <div ref={receiptRef} id="receipt-content" className="w-full max-w-[297mm] min-w-0">
                <ReceiptContent />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </ResponsiveLayout>
  )
}

export default function ReceiveFeesPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ReceiveFeesContent />
    </Suspense>
  )
}