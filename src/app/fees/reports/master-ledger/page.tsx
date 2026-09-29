// E:\kindergarten-erp\src\app\fees\reports\master-ledger\page.tsx
// Master Fee Ledger — Clean table header (no hyphen in sub-row)

"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Download,
  Loader2,
  Printer,
  RefreshCw,
  Layers,
  FileSpreadsheet,
  GraduationCap,
} from "lucide-react"

import { ResponsiveLayout } from "@/components/layout/responsive-layout"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { formatCurrency } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

const supabase = createClient()

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

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

interface Student {
  id: string
  student_id: string
  name: string
  father_name: string
  class_id: string
  section_id: string
  class_roll: string
  class_name?: string
  section_name?: string
}

interface FeeCategory {
  id: string
  name: string
  frequency: "monthly" | "quarterly" | "yearly" | "one_time" | "custom"
  custom_schedule?: {
    months?: number[]
    amount_per_month?: number
  } | null
}

interface FeeDue {
  id: string
  student_id: string
  category_id: string | null
  month: string
  expected_amount: number
  paid_amount: number
  due_amount: number
  discount_amount: number
  fine_amount: number
  status: string
}

interface PaymentAllocation {
  id: string
  payment_id: string
  student_id: string | null
  category_id: string | null
  month: string | null
  amount: number
  allocation_type: string
}

interface CarryForwardDue {
  student_id: string
  amount: number
}

interface SchoolInfo {
  school_name: string
  school_address: string
  school_phone: string
  school_email: string
  school_logo?: string | null
}

interface AcademicYear {
  id: string
  name: string
  start_date: string
  end_date: string
  is_current: boolean
}

interface ColumnDef {
  id: string
  label: string
  categoryId: string | null
  month: string | null
  type: "category" | "areas" | "advance"
  frequency?: string
  isMonthly?: boolean
  groupId: string
  groupLabel: string
  groupSpan: number
  isGroupStart: boolean
  subLabel: string
  hasSubRow: boolean  // ✅ New: does this column need a sub-row label?
}

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

const MONTH_KEYS = ["01","02","03","04","05","06","07","08","09","10","11","12"]
const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

function getMonthLabel(monthKey: string): string {
  const parts = monthKey.split("-")
  if (parts.length !== 2) return monthKey
  const mNum = parseInt(parts[1])
  return MONTH_LABELS[mNum - 1] || parts[1]
}

function getShortMonthName(name: string): string {
  return name.replace(/\s*Fee\s*/i, "").trim() || name
}

const PRIORITY_KEYWORDS = ["admission", "tuition", "exam"]

function getCategoryPriority(name: string): number {
  const lower = name.toLowerCase()
  for (let i = 0; i < PRIORITY_KEYWORDS.length; i++) {
    if (lower.includes(PRIORITY_KEYWORDS[i])) return i
  }
  return 999
}

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

export default function MasterFeeLedgerPage() {
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  const [classes, setClasses] = useState<ClassItem[]>([])
  const [sections, setSections] = useState<SectionItem[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [categories, setCategories] = useState<FeeCategory[]>([])
  const [dues, setDues] = useState<FeeDue[]>([])
  const [allocations, setAllocations] = useState<PaymentAllocation[]>([])
  const [carryForward, setCarryForward] = useState<CarryForwardDue[]>([])
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo>({
    school_name: "School Name",
    school_address: "School Address",
    school_phone: "00000000000",
    school_email: "info@school.com",
    school_logo: null,
  })

  const [filterClass, setFilterClass] = useState("all")
  const [filterSection, setFilterSection] = useState("all")
  const [academicYearId, setAcademicYearId] = useState<string>("")

  const [hiddenCategoryIds, setHiddenCategoryIds] = useState<Set<string>>(new Set())

  const [isDark, setIsDark] = useState(false)

  const printRef = useRef<HTMLDivElement>(null)
  const tableScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains("dark"))
    check()
    const observer = new MutationObserver(check)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])

  // ═══════════════════════════════════════════════════════════════
  // INITIAL LOAD
  // ═══════════════════════════════════════════════════════════════

  useEffect(() => {
    async function loadInitial() {
      try {
        const [schoolRes, classesRes, sectionsRes, ayRes, catRes] = await Promise.all([
          supabase.from("school_settings").select("*").limit(1).single(),
          supabase.from("classes").select("id, name, numeric_order").order("numeric_order"),
          supabase.from("sections").select("id, name, class_id").order("name"),
          supabase.from("academic_years").select("*").order("start_date", { ascending: false }),
          supabase
            .from("fee_categories")
            .select("id, name, frequency, custom_schedule")
            .eq("is_active", true)
            .order("name"),
        ])

        if (schoolRes.data) setSchoolInfo(schoolRes.data)
        if (classesRes.data) setClasses(classesRes.data)
        if (sectionsRes.data) setSections(sectionsRes.data)
        if (catRes.data) setCategories(catRes.data)
        if (ayRes.data) {
          setAcademicYears(ayRes.data)
          const current = ayRes.data.find((ay: AcademicYear) => ay.is_current)
          if (current) setAcademicYearId(current.id)
        }
      } catch (err) {
        console.error("Initial load error:", err)
        toast.error("Initial data load failed")
      }
    }
    loadInitial()
  }, [])

  // ═══════════════════════════════════════════════════════════════
  // BUILD DYNAMIC COLUMNS
  // ═══════════════════════════════════════════════════════════════

  const dynamicColumns = useMemo<ColumnDef[]>(() => {
    const cols: ColumnDef[] = []

    const currentAY = academicYears.find((ay) => ay.id === academicYearId)
    const yearPrefix = currentAY?.start_date
      ? new Date(currentAY.start_date).getFullYear().toString()
      : new Date().getFullYear().toString()

    let activeMonths: string[] = MONTH_KEYS.map((mk) => `${yearPrefix}-${mk}`)
    if (currentAY?.start_date && currentAY?.end_date) {
      const start = new Date(currentAY.start_date)
      const end = new Date(currentAY.end_date)
      activeMonths = []
      const curr = new Date(start.getFullYear(), start.getMonth(), 1)
      while (curr <= end) {
        const y = curr.getFullYear()
        const m = String(curr.getMonth() + 1).padStart(2, "0")
        activeMonths.push(`${y}-${m}`)
        curr.setMonth(curr.getMonth() + 1)
      }
    }

    const sortedCategories = [...categories]
      .filter((c) => !hiddenCategoryIds.has(c.id))
      .sort((a, b) => {
        const pA = getCategoryPriority(a.name)
        const pB = getCategoryPriority(b.name)
        if (pA !== pB) return pA - pB
        return a.name.localeCompare(b.name)
      })

    sortedCategories.forEach((cat) => {
      const shortName = getShortMonthName(cat.name)

      if (cat.frequency === "monthly") {
        const span = activeMonths.length
        activeMonths.forEach((mKey, idx) => {
          cols.push({
            id: `cat-${cat.id}-${mKey}`,
            label: `${shortName} ${getMonthLabel(mKey)}`,
            categoryId: cat.id,
            month: mKey,
            type: "category",
            frequency: "monthly",
            isMonthly: true,
            groupId: `cat-${cat.id}`,
            groupLabel: shortName,
            groupSpan: span,
            isGroupStart: idx === 0,
            subLabel: getMonthLabel(mKey),
            hasSubRow: true,  // ✅ monthly → sub-row (Jan, Feb, ...)
          })
        })
      } else if (cat.frequency === "quarterly") {
        const quarters = ["Q1", "Q2", "Q3", "Q4"]
        const validQuarters: Array<{ q: string; months: string }> = []
        quarters.forEach((q, idx) => {
          const qMonths = activeMonths.filter((m) => {
            const mNum = parseInt(m.split("-")[1])
            return mNum >= idx * 3 + 1 && mNum <= idx * 3 + 3
          })
          if (qMonths.length > 0) {
            validQuarters.push({ q, months: qMonths.join(",") })
          }
        })
        validQuarters.forEach((item, idx) => {
          cols.push({
            id: `cat-${cat.id}-${item.q}-${yearPrefix}`,
            label: `${shortName} ${item.q}`,
            categoryId: cat.id,
            month: item.months,
            type: "category",
            frequency: "quarterly",
            groupId: `cat-${cat.id}`,
            groupLabel: shortName,
            groupSpan: validQuarters.length,
            isGroupStart: idx === 0,
            subLabel: item.q,
            hasSubRow: true,  // ✅ quarterly → sub-row (Q1, Q2, ...)
          })
        })
      } else if (cat.frequency === "custom" && cat.custom_schedule?.months) {
        const months = cat.custom_schedule.months
        const span = months.length
        months.forEach((mNum, idx) => {
          const mKey = `${yearPrefix}-${String(mNum).padStart(2, "0")}`
          cols.push({
            id: `cat-${cat.id}-${mKey}`,
            label: `${shortName} ${getMonthLabel(mKey)}`,
            categoryId: cat.id,
            month: mKey,
            type: "category",
            frequency: "custom",
            groupId: `cat-${cat.id}`,
            groupLabel: shortName,
            groupSpan: span,
            isGroupStart: idx === 0,
            subLabel: getMonthLabel(mKey),
            hasSubRow: true,  // ✅ custom → sub-row
          })
        })
      } else {
        // ✅ one_time, yearly — single column, NO sub-row
        cols.push({
          id: `cat-${cat.id}`,
          label: cat.name,
          categoryId: cat.id,
          month: null,
          type: "category",
          frequency: cat.frequency,
          groupId: `cat-${cat.id}`,
          groupLabel: cat.name,
          groupSpan: 1,
          isGroupStart: true,
          subLabel: "",
          hasSubRow: false,  // ✅ NO sub-row → rowSpan=2 in thead
        })
      }
    })

    // Areas — NO sub-row
    cols.push({
      id: "areas",
      label: "Areas",
      categoryId: null,
      month: null,
      type: "areas",
      groupId: "areas",
      groupLabel: "Areas",
      groupSpan: 1,
      isGroupStart: true,
      subLabel: "",
      hasSubRow: false,
    })

    // Advance — NO sub-row
    cols.push({
      id: "advance",
      label: "Advance",
      categoryId: null,
      month: null,
      type: "advance",
      groupId: "advance",
      groupLabel: "Advance",
      groupSpan: 1,
      isGroupStart: true,
      subLabel: "",
      hasSubRow: false,
    })

    return cols
  }, [categories, academicYears, academicYearId, hiddenCategoryIds])

  // ✅ NEW: Filtered list for row 2 (only columns with sub-row)
  const subRowColumns = useMemo(() => {
    return dynamicColumns.filter((col) => col.hasSubRow)
  }, [dynamicColumns])

  // ✅ NEW: Check if we have any sub-row columns
  const hasSubRow = useMemo(() => {
    return subRowColumns.length > 0
  }, [subRowColumns])

  // ═══════════════════════════════════════════════════════════════
  // LOAD MASTER DATA
  // ═══════════════════════════════════════════════════════════════

  const loadMasterData = useCallback(async () => {
    try {
      setLoading(true)

      let studentQuery = supabase
        .from("students")
        .select(`id, student_id, name, father_name, class_id, section_id, class_roll`)
        .eq("status", "active")
        .order("class_roll", { ascending: true })

      if (filterClass !== "all") studentQuery = studentQuery.eq("class_id", filterClass)
      if (filterSection !== "all") studentQuery = studentQuery.eq("section_id", filterSection)

      const { data: studentData, error: studentErr } = await studentQuery
      if (studentErr) throw studentErr

      if (!studentData || studentData.length === 0) {
        setStudents([])
        setDues([])
        setAllocations([])
        setCarryForward([])
        setLoading(false)
        return
      }

      const studentIds = studentData.map((s: any) => s.id)

      const classMap = new Map(classes.map((c) => [c.id, c.name]))
      const sectionMap = new Map(sections.map((s) => [s.id, s.name]))

      setStudents(
        studentData.map((s: any) => ({
          id: s.id,
          student_id: s.student_id || "N/A",
          name: s.name || "Unknown",
          father_name: s.father_name || "",
          class_id: s.class_id,
          section_id: s.section_id,
          class_roll: s.class_roll || "",
          class_name: classMap.get(s.class_id) || "N/A",
          section_name: sectionMap.get(s.section_id) || "N/A",
        }))
      )

      let dueQuery = supabase
        .from("student_fee_dues")
        .select(`id, student_id, category_id, month, expected_amount, paid_amount, due_amount, discount_amount, fine_amount, status`)
        .in("student_id", studentIds)

      if (academicYearId) {
        dueQuery = dueQuery.eq("academic_year_id", academicYearId)
      }

      const { data: dueData } = await dueQuery
      setDues((dueData || []) as FeeDue[])

      const { data: payments } = await supabase
        .from("fee_payments")
        .select("id, student_id")
        .in("student_id", studentIds)

      const paymentIds = (payments || []).map((p: any) => p.id)
      const paymentStudentMap = new Map((payments || []).map((p: any) => [p.id, p.student_id]))

      if (paymentIds.length > 0) {
        const { data: allocData } = await supabase
          .from("payment_allocations")
          .select(`id, payment_id, category_id, month, amount, allocation_type`)
          .in("payment_id", paymentIds)

        setAllocations(
          (allocData || []).map((a: any) => ({
            id: a.id,
            payment_id: a.payment_id,
            student_id: paymentStudentMap.get(a.payment_id) || null,
            category_id: a.category_id,
            month: a.month,
            amount: a.amount || 0,
            allocation_type: a.allocation_type || "regular",
          })) as PaymentAllocation[]
        )
      } else {
        setAllocations([])
      }

      const { data: carryData } = await supabase
        .from("fee_invoices")
        .select("student_id, amount, due_amount, paid_amount")
        .in("student_id", studentIds)
        .eq("month", 0)

      if (carryData && carryData.length > 0) {
        const grouped = new Map<string, number>()
        carryData.forEach((inv: any) => {
          const amount = (inv.due_amount || inv.amount || 0) - (inv.paid_amount || 0)
          if (amount > 0) {
            grouped.set(inv.student_id, (grouped.get(inv.student_id) || 0) + amount)
          }
        })

        setCarryForward(
          Array.from(grouped.entries()).map(([student_id, amount]) => ({
            student_id,
            amount,
          }))
        )
      } else {
        setCarryForward([])
      }
    } catch (err: any) {
      console.error("Load master data error:", err)
      toast.error("ডাটা লোড করতে সমস্যা হয়েছে")
    } finally {
      setLoading(false)
    }
  }, [filterClass, filterSection, academicYearId, classes, sections])

  useEffect(() => {
    if (classes.length > 0 && sections.length > 0) {
      loadMasterData()
    }
  }, [classes, sections, loadMasterData])

  // ═══════════════════════════════════════════════════════════════
  // BUILD STUDENT ROWS
  // ═══════════════════════════════════════════════════════════════

  const studentRows = useMemo(() => {
    const duesByStudent = new Map<string, FeeDue[]>()
    dues.forEach((d) => {
      if (!duesByStudent.has(d.student_id)) duesByStudent.set(d.student_id, [])
      duesByStudent.get(d.student_id)!.push(d)
    })

    const allocsByStudent = new Map<string, PaymentAllocation[]>()
    allocations.forEach((a) => {
      if (!a.student_id) return
      if (!allocsByStudent.has(a.student_id)) allocsByStudent.set(a.student_id, [])
      allocsByStudent.get(a.student_id)!.push(a)
    })

    const areasByStudent = new Map<string, number>()
    carryForward.forEach((cf) => {
      areasByStudent.set(cf.student_id, (areasByStudent.get(cf.student_id) || 0) + cf.amount)
    })

    return students.map((student) => {
      const studentDues = duesByStudent.get(student.id) || []
      const studentAllocs = allocsByStudent.get(student.id) || []
      const areasAmount = areasByStudent.get(student.id) || 0

      const cells: Record<string, { paid: number; due: number; expected: number }> = {}

      dynamicColumns.forEach((col) => {
        let paid = 0
        let due = 0
        let expected = 0

        if (col.type === "category" && col.categoryId) {
          if (col.month && !col.month.includes(",")) {
            studentDues.forEach((d) => {
              if (d.category_id === col.categoryId && d.month === col.month) {
                expected += d.expected_amount || 0
                paid += d.paid_amount || 0
                due += d.due_amount || 0
              }
            })
            studentAllocs.forEach((a) => {
              if (a.category_id === col.categoryId && a.month === col.month) {
                if (expected === 0 && due === 0) {
                  paid += a.amount || 0
                }
              }
            })
          } else if (col.month && col.month.includes(",")) {
            const months = col.month.split(",")
            studentDues.forEach((d) => {
              if (d.category_id === col.categoryId && months.includes(d.month)) {
                expected += d.expected_amount || 0
                paid += d.paid_amount || 0
                due += d.due_amount || 0
              }
            })
            studentAllocs.forEach((a) => {
              if (a.category_id === col.categoryId && a.month && months.includes(a.month)) {
                if (expected === 0 && due === 0) {
                  paid += a.amount || 0
                }
              }
            })
          } else {
            studentDues.forEach((d) => {
              if (d.category_id === col.categoryId) {
                expected += d.expected_amount || 0
                paid += d.paid_amount || 0
                due += d.due_amount || 0
              }
            })
            studentAllocs.forEach((a) => {
              if (a.category_id === col.categoryId) {
                if (expected === 0 && due === 0) {
                  paid += a.amount || 0
                }
              }
            })
          }
        } else if (col.type === "areas") {
          due = areasAmount
          expected = areasAmount
        } else if (col.type === "advance") {
          const adv = studentAllocs
            .filter((a) => a.allocation_type === "advance" || a.allocation_type === "advance_global")
            .reduce((s, a) => s + (a.amount || 0), 0)
          paid = adv
        }

        cells[col.id] = { paid, due, expected }
      })

      let totalPaid = 0
      let totalDue = 0
      let totalExpected = 0

      dynamicColumns.forEach((col) => {
        const c = cells[col.id]
        if (c) {
          totalPaid += c.paid
          totalDue += c.due
          totalExpected += c.expected
        }
      })

      return {
        student,
        cells,
        totalPaid,
        totalDue,
        totalExpected,
      }
    })
  }, [students, dues, allocations, carryForward, dynamicColumns])

  // ═══════════════════════════════════════════════════════════════
  // GRAND TOTALS
  // ═══════════════════════════════════════════════════════════════

  const grandTotals = useMemo(() => {
    const columnTotals: Record<string, { paid: number; due: number; expected: number }> = {}
    dynamicColumns.forEach((col) => {
      columnTotals[col.id] = { paid: 0, due: 0, expected: 0 }
    })

    studentRows.forEach((row) => {
      dynamicColumns.forEach((col) => {
        const v = row.cells[col.id]
        if (v) {
          columnTotals[col.id].paid += v.paid
          columnTotals[col.id].due += v.due
          columnTotals[col.id].expected += v.expected
        }
      })
    })

    return {
      columns: columnTotals,
      totalPaid: studentRows.reduce((s, r) => s + r.totalPaid, 0),
      totalDue: studentRows.reduce((s, r) => s + r.totalDue, 0),
      totalExpected: studentRows.reduce((s, r) => s + r.totalExpected, 0),
      totalAreas: studentRows.reduce((s, r) => s + (r.cells["areas"]?.due || 0), 0),
      totalAdvance: studentRows.reduce((s, r) => s + (r.cells["advance"]?.paid || 0), 0),
    }
  }, [studentRows, dynamicColumns])

  // ═══════════════════════════════════════════════════════════════
  // EXPORT CSV
  // ═══════════════════════════════════════════════════════════════

  const handleExportCSV = useCallback(() => {
    try {
      setExporting(true)

      const header = [
        "Roll", "ID", "Name", "Father Name", "Class", "Section",
        ...dynamicColumns.map((c) => c.label),
        "Total Expected", "Total Paid", "Total Due",
      ]

      const rows: string[][] = [header]

      studentRows.forEach((row) => {
        rows.push([
          row.student.class_roll,
          row.student.student_id,
          row.student.name,
          row.student.father_name,
          row.student.class_name || "",
          row.student.section_name || "",
          ...dynamicColumns.map((c) => {
            const v = row.cells[c.id]
            if (!v) return "0.00"
            return (v.paid || 0).toFixed(2)
          }),
          row.totalExpected.toFixed(2),
          row.totalPaid.toFixed(2),
          row.totalDue.toFixed(2),
        ])
      })

      rows.push([
        "", "", "GRAND TOTAL", "", "", "",
        ...dynamicColumns.map((c) => (grandTotals.columns[c.id]?.paid || 0).toFixed(2)),
        grandTotals.totalExpected.toFixed(2),
        grandTotals.totalPaid.toFixed(2),
        grandTotals.totalDue.toFixed(2),
      ])

      const csv = rows
        .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        .join("\n")

      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `Master-Fee-Ledger-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)

      toast.success(`${studentRows.length} জন শিক্ষার্থীর ডাটা export হয়েছে`)
    } catch (err) {
      console.error("Export error:", err)
      toast.error("Export করতে সমস্যা হয়েছে")
    } finally {
      setExporting(false)
    }
  }, [studentRows, dynamicColumns, grandTotals])

  // ═══════════════════════════════════════════════════════════════
  // PRINT
  // ═══════════════════════════════════════════════════════════════

  const handlePrint = useCallback(() => {
    if (!printRef.current) return

    const printWindow = window.open("", "_blank", "width=1400,height=900")
    if (!printWindow) {
      toast.error("Popup blocked")
      return
    }

    const currentAY = academicYears.find((ay) => ay.id === academicYearId)
    const currentClass = classes.find((c) => c.id === filterClass)
    const currentSection = sections.find((s) => s.id === filterSection)

    const logoSrc = schoolInfo.school_logo && schoolInfo.school_logo.trim() !== ""
      ? schoolInfo.school_logo
      : null

    const tableHTML = printRef.current.innerHTML

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Master Fee Ledger</title>
          <meta charset="UTF-8">
          <style>
            @page { size: A3 landscape; margin: 0.4in; }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body {
              font-family: 'Segoe UI', Arial, sans-serif;
              font-size: 8pt;
              margin: 0;
              padding: 0;
              color: #1e293b !important;
              background: white !important;
            }
            .header {
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 10px;
              border-bottom: 2px solid #1e293b;
              padding-bottom: 8px;
              margin-bottom: 8px;
            }
            .logo { width: 55px; height: 55px; object-fit: contain; flex-shrink: 0; }
            .logo-placeholder {
              width: 55px; height: 55px;
              display: flex; align-items: center; justify-content: center;
              font-size: 20pt; font-weight: bold;
              background: #f1f5f9; border-radius: 50%;
              border: 2px solid #cbd5e1; flex-shrink: 0;
            }
            .header-info { text-align: left; }
            .school-name { font-size: 14pt; font-weight: bold; margin: 0; line-height: 1.2; }
            .school-info { font-size: 8pt; color: #475569; margin: 1px 0; }
            .title {
              font-size: 11pt; font-weight: bold;
              margin: 4px 0 2px 0;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .footer {
              margin-top: 8px; text-align: center;
              font-size: 7pt; color: #94a3b8;
            }

            table { width: 100%; border-collapse: collapse; font-size: 6.5pt; }
            table th {
              background-color: #f1f5f9 !important;
              color: #1e293b !important;
              border: 0.5px solid #cbd5e1 !important;
              padding: 2px 2px !important;
              font-weight: 700 !important;
              font-size: 5.5pt !important;
              text-align: center !important;
              white-space: nowrap !important;
            }
            table td {
              padding: 1.5px 2px !important;
              border: 0.5px solid #e2e8f0 !important;
              font-size: 6pt !important;
              color: #1e293b !important;
              background-color: white !important;
            }
            table tbody tr:nth-child(even) td {
              background-color: #f8fafc !important;
            }
            table tbody td span {
              color: #1e293b !important;
            }

            table th.areas-col { background-color: #fed7aa !important; color: #7c2d12 !important; }
            table th.advance-col { background-color: #e9d5ff !important; color: #581c87 !important; }
            table th.expected-col { background-color: #dbeafe !important; color: #1e3a8a !important; }
            table th.paid-col { background-color: #d1fae5 !important; color: #064e3b !important; }
            table th.due-col { background-color: #fee2e2 !important; color: #7f1d1d !important; }

            table tfoot td {
              background-color: #e2e8f0 !important;
              color: #1e293b !important;
              font-weight: 700 !important;
              border-top: 2px solid #94a3b8 !important;
              border: 0.5px solid #cbd5e1 !important;
              padding: 3px 2px !important;
              font-size: 6pt !important;
            }

            @media print {
              @page { size: A3 landscape; margin: 0.35in; }
              body { background: white !important; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            ${logoSrc
              ? `<img src="${logoSrc}" alt="School Logo" class="logo" />`
              : `<div class="logo-placeholder">${(schoolInfo.school_name || "S").charAt(0)}</div>`
            }
            <div class="header-info">
              <h1 class="school-name">${schoolInfo.school_name}</h1>
              <p class="school-info">${schoolInfo.school_address} | Phone: ${schoolInfo.school_phone}</p>
              <p class="title">Master Fee Ledger</p>
              <p class="school-info">
                ${currentAY ? `Academic Year: ${currentAY.name} | ` : ""}
                ${currentClass ? `Class: ${currentClass.name} | ` : ""}
                ${currentSection ? `Section: ${currentSection.name} | ` : ""}
                Total Students: ${studentRows.length}
              </p>
            </div>
          </div>
          ${tableHTML}
          <div class="footer">Generated on: ${new Date().toLocaleString("en-GB")}</div>
        </body>
      </html>
    `)
    printWindow.document.close()

    let closed = false
    const closeWindow = () => {
      if (closed) return
      closed = true
      try {
        printWindow.close()
      } catch (e) {}
    }

    printWindow.addEventListener("afterprint", () => {
      setTimeout(closeWindow, 200)
    })

    setTimeout(() => {
      try {
        printWindow.focus()
        printWindow.print()
      } catch (e) {
        console.error("Print error:", e)
      }
    }, 500)

    setTimeout(closeWindow, 20000)
  }, [schoolInfo, classes, sections, academicYears, academicYearId, filterClass, filterSection, studentRows.length])

  // ═══════════════════════════════════════════════════════════════
  // CATEGORY TOGGLE
  // ═══════════════════════════════════════════════════════════════

  const toggleCategoryVisibility = useCallback((categoryId: string) => {
    setHiddenCategoryIds((prev) => {
      const next = new Set(prev)
      if (next.has(categoryId)) next.delete(categoryId)
      else next.add(categoryId)
      return next
    })
  }, [])

  // ═══════════════════════════════════════════════════════════════
  // DYNAMIC COLORS
  // ═══════════════════════════════════════════════════════════════

  const colors = {
    headerBg: isDark ? "#334155" : "#f1f5f9",
    headerText: isDark ? "#f1f5f9" : "#1e293b",
    headerBorder: isDark ? "#475569" : "#cbd5e1",
    stickyHeadBg: isDark ? "#475569" : "#e2e8f0",
    rowEven: isDark ? "#0f172a" : "#ffffff",
    rowOdd: isDark ? "#1e293b" : "#f8fafc",
    cellText: isDark ? "#e2e8f0" : "#1e293b",
    cellMuted: isDark ? "#64748b" : "#94a3b8",
    cellBorder: isDark ? "#334155" : "#e2e8f0",
    footerBg: isDark ? "#334155" : "#f1f5f9",
    footerText: isDark ? "#f1f5f9" : "#1e293b",
    footerBorder: isDark ? "#64748b" : "#cbd5e1",
    footerTopBorder: isDark ? "#94a3b8" : "#94a3b8",
    areasHeaderBg: isDark ? "#b45309" : "#fed7aa",
    advanceHeaderBg: isDark ? "#6d28d9" : "#e9d5ff",
    expectedHeaderBg: isDark ? "#1d4ed8" : "#dbeafe",
    paidHeaderBg: isDark ? "#047857" : "#d1fae5",
    dueHeaderBg: isDark ? "#be123c" : "#fee2e2",
    areasCellBg: isDark ? "#3b1a0a" : "#fef3c7",
    advanceCellBg: isDark ? "#2e1065" : "#f3e8ff",
    paidText: isDark ? "#6ee7b7" : "#047857",
    dueText: isDark ? "#fda4af" : "#be123c",
  }

  // ═══════════════════════════════════════════════════════════════
  // HEADER GROUPS — for row 1 (single headers)
  // ═══════════════════════════════════════════════════════════════

  // ✅ Now: Build a unified "headerCells" list for row 1
  //    Each cell either spans 2 rows (no sub-row) or spans multiple cols (has sub-row)
  const headerRow1Cells = useMemo(() => {
    const cells: Array<{
      key: string
      label: string
      colSpan?: number
      rowSpan?: number
      type: "fixed" | "category" | "areas" | "advance" | "expected" | "paid" | "due"
      className?: string
    }> = []

    // Fixed columns (rowSpan=2)
    cells.push({ key: "Roll", label: "Roll", rowSpan: 2, type: "fixed" })
    cells.push({ key: "ID", label: "ID", rowSpan: 2, type: "fixed" })
    cells.push({ key: "Name", label: "Name", rowSpan: 2, type: "fixed" })
    cells.push({ key: "Father", label: "Father", rowSpan: 2, type: "fixed" })
    cells.push({ key: "Class", label: "Class", rowSpan: 2, type: "fixed" })

    // Category columns — group by groupId
    const categoryGroups = new Map<string, { label: string; columns: ColumnDef[] }>()
    dynamicColumns.forEach((col) => {
      if (col.type === "category") {
        if (!categoryGroups.has(col.groupId)) {
          categoryGroups.set(col.groupId, { label: col.groupLabel, columns: [] })
        }
        categoryGroups.get(col.groupId)!.columns.push(col)
      }
    })

    categoryGroups.forEach((group, groupId) => {
      const hasSub = group.columns.some((c) => c.hasSubRow)
      if (hasSub) {
        // Multi-column group → colSpan, no rowSpan (will have sub-row)
        cells.push({
          key: groupId,
          label: group.label,
          colSpan: group.columns.length,
          type: "category",
        })
      } else {
        // Single column → rowSpan=2
        cells.push({
          key: groupId,
          label: group.label,
          rowSpan: 2,
          type: "category",
        })
      }
    })

    // Areas — rowSpan=2
    cells.push({ key: "areas", label: "Areas", rowSpan: 2, type: "areas", className: "areas-col" })

    // Advance — rowSpan=2
    cells.push({ key: "advance", label: "Advance", rowSpan: 2, type: "advance", className: "advance-col" })

    // Expected, Paid, Due — rowSpan=2
    cells.push({ key: "expected", label: "Expected", rowSpan: 2, type: "expected", className: "expected-col" })
    cells.push({ key: "paid", label: "Total Paid", rowSpan: 2, type: "paid", className: "paid-col" })
    cells.push({ key: "due", label: "Total Due", rowSpan: 2, type: "due", className: "due-col" })

    return cells
  }, [dynamicColumns])

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  return (
    <ResponsiveLayout>
      <div className="space-y-3 p-3 sm:space-y-4 sm:p-4 max-w-[1700px] mx-auto">

        {/* HEADER — Magenta */}
        <div className="bg-gradient-to-r from-pink-600 via-fuchsia-600 to-purple-600 rounded-xl p-3 sm:p-4 shadow-lg text-white">
          <div className="flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-3 lg:flex-nowrap">
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="ghost" size="icon" asChild className="bg-white/20 hover:bg-white/30 text-white h-8 w-8 shrink-0">
                <Link href="/fees/reports">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-base md:text-lg font-bold flex items-center gap-1.5 whitespace-nowrap">
                  <FileSpreadsheet className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                  Master Fee Ledger
                </h1>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 sm:gap-2 flex-1 lg:min-w-0">
              <div className="flex-1 min-w-[110px] sm:min-w-[130px]">
                <Select value={academicYearId} onValueChange={setAcademicYearId}>
                  <SelectTrigger className="h-8 text-[11px] sm:text-xs bg-white/15 border-white/25 text-white">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                    {academicYears.map((ay) => (
                      <SelectItem key={ay.id} value={ay.id} className="text-xs">
                        {ay.name} {ay.is_current ? "(Current)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1 min-w-[100px] sm:min-w-[120px]">
                <Select value={filterClass} onValueChange={(v) => { setFilterClass(v); setFilterSection("all") }}>
                  <SelectTrigger className="h-8 text-[11px] sm:text-xs bg-white/15 border-white/25 text-white">
                    <SelectValue placeholder="Class" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                    <SelectItem value="all" className="text-xs">All Classes</SelectItem>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1 min-w-[100px] sm:min-w-[120px]">
                <Select value={filterSection} onValueChange={setFilterSection}>
                  <SelectTrigger className="h-8 text-[11px] sm:text-xs bg-white/15 border-white/25 text-white">
                    <SelectValue placeholder="Section" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                    <SelectItem value="all" className="text-xs">All Sections</SelectItem>
                    {sections
                      .filter((s) => filterClass === "all" || s.class_id === filterClass)
                      .map((s) => (
                        <SelectItem key={s.id} value={s.id} className="text-xs">{s.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 shrink-0">
              <Popover>
                <PopoverTrigger asChild>
                  <Button size="sm" className="bg-white/20 hover:bg-white/30 text-white border-0 gap-1 h-8 text-[11px] sm:text-xs px-2">
                    <Layers className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Cols </span>({categories.length - hiddenCategoryIds.size})
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-64 p-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-xl"
                  align="end"
                >
                  <p className="text-xs font-bold mb-2 text-slate-900 dark:text-slate-100">Show/Hide Fee Categories</p>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {categories.map((cat) => (
                      <label key={cat.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 p-1.5 rounded text-slate-800 dark:text-slate-200">
                        <Checkbox
                          checked={!hiddenCategoryIds.has(cat.id)}
                          onCheckedChange={() => toggleCategoryVisibility(cat.id)}
                        />
                        <span className="flex-1">{cat.name}</span>
                        <Badge variant="outline" className="text-[9px] px-1 py-0">
                          {cat.frequency === "monthly" ? "12" : cat.frequency === "quarterly" ? "4" : "1"}
                        </Badge>
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              <Button size="sm" onClick={handleExportCSV} disabled={exporting || loading} className="bg-white/20 hover:bg-white/30 text-white border-0 gap-1 h-8 text-[11px] sm:text-xs px-2">
                {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">CSV</span>
              </Button>
              <Button size="sm" onClick={handlePrint} disabled={loading} className="bg-white/20 hover:bg-white/30 text-white border-0 gap-1 h-8 text-[11px] sm:text-xs px-2">
                <Printer className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Print</span>
              </Button>
              <Button size="sm" onClick={loadMasterData} disabled={loading} className="bg-white/20 hover:bg-white/30 text-white border-0 gap-1 h-8 text-[11px] sm:text-xs px-2">
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
            </div>
          </div>
        </div>

        {/* MAIN TABLE */}
        <Card className="border-0 shadow-md">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                <span className="ml-3 text-sm text-slate-500 dark:text-slate-400">ডাটা লোড হচ্ছে...</span>
              </div>
            ) : studentRows.length === 0 ? (
              <div className="text-center py-20 text-slate-500 dark:text-slate-400">
                <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p className="text-sm">কোনো শিক্ষার্থী পাওয়া যায়নি</p>
              </div>
            ) : (
              <div
                ref={tableScrollRef}
                className="master-ledger-scroll"
                style={{
                  maxHeight: "calc(100vh - 200px)",
                  overflowX: "auto",
                  overflowY: "auto",
                  position: "relative",
                }}
              >
                <div ref={printRef}>
                  <table
                    style={{
                      minWidth: "max-content",
                      fontSize: "11px",
                      borderCollapse: "separate",
                      borderSpacing: 0,
                      width: "100%",
                    }}
                  >
                    {/* ✅ 2-ROW HEADER — clean */}
                    <thead>
                      {/* ═══ ROW 1 ═══ */}
                      <tr>
                        {headerRow1Cells.map((cell) => {
                          const isFixed = cell.type === "fixed"
                          const isAreas = cell.type === "areas"
                          const isAdvance = cell.type === "advance"
                          const isExpected = cell.type === "expected"
                          const isPaid = cell.type === "paid"
                          const isDue = cell.type === "due"

                          let bgColor = colors.headerBg
                          let textColor = colors.headerText
                          if (isFixed) {
                            bgColor = colors.stickyHeadBg
                          } else if (isAreas) {
                            bgColor = colors.areasHeaderBg
                            textColor = isDark ? "white" : "#1e293b"
                          } else if (isAdvance) {
                            bgColor = colors.advanceHeaderBg
                            textColor = isDark ? "white" : "#1e293b"
                          } else if (isExpected) {
                            bgColor = colors.expectedHeaderBg
                            textColor = isDark ? "white" : "#1e3a8a"
                          } else if (isPaid) {
                            bgColor = colors.paidHeaderBg
                            textColor = isDark ? "white" : "#064e3b"
                          } else if (isDue) {
                            bgColor = colors.dueHeaderBg
                            textColor = isDark ? "white" : "#7f1d1d"
                          }

                          // Sticky left for fixed columns
                          const stickyStyle: React.CSSProperties = {}
                          if (isFixed) {
                            if (cell.key === "Roll") {
                              stickyStyle.left = 0
                              stickyStyle.zIndex = 40
                            } else if (cell.key === "ID") {
                              stickyStyle.left = 55
                              stickyStyle.zIndex = 40
                            } else if (cell.key === "Name") {
                              stickyStyle.left = 155
                              stickyStyle.zIndex = 40
                            } else {
                              stickyStyle.zIndex = 35
                            }
                          } else {
                            stickyStyle.zIndex = 35
                          }

                          const minW = isFixed
                            ? (cell.key === "Roll" ? 55 : cell.key === "ID" ? 100 : cell.key === "Name" ? 140 : cell.key === "Father" ? 110 : 80)
                            : (isAreas || isAdvance) ? 75 : (isExpected ? 90 : (isPaid || isDue) ? 100 : 60)

                          return (
                            <th
                              key={cell.key}
                              colSpan={cell.colSpan}
                              rowSpan={cell.rowSpan}
                              className={cell.className}
                              style={{
                                position: "sticky",
                                top: 0,
                                ...stickyStyle,
                                backgroundColor: bgColor,
                                color: textColor,
                                fontWeight: 700,
                                fontSize: "10px",
                                padding: "6px 8px",
                                borderRight: `1px solid ${colors.headerBorder}`,
                                borderBottom: `1px solid ${colors.headerBorder}`,
                                whiteSpace: "nowrap",
                                minWidth: minW,
                                textAlign: isFixed && cell.key === "Name" ? "left" : (isFixed && (cell.key === "Father" || cell.key === "Class")) ? "left" : "center",
                                verticalAlign: "middle",
                              }}
                            >
                              {cell.label}
                            </th>
                          )
                        })}
                      </tr>

                      {/* ═══ ROW 2 — ONLY for grouped columns (hasSubRow) ═══ */}
                      {hasSubRow && (
                        <tr>
                          {subRowColumns.map((col) => {
                            const isAreas = col.type === "areas"
                            const isAdvance = col.type === "advance"
                            return (
                              <th
                                key={`sub-${col.id}`}
                                style={{
                                  position: "sticky",
                                  top: 32,
                                  zIndex: 35,
                                  backgroundColor: isAreas
                                    ? colors.areasHeaderBg
                                    : isAdvance
                                    ? colors.advanceHeaderBg
                                    : colors.headerBg,
                                  color: isAreas || isAdvance
                                    ? (isDark ? "white" : "#1e293b")
                                    : colors.headerText,
                                  fontWeight: 600,
                                  fontSize: "9px",
                                  padding: "3px 4px",
                                  borderRight: `1px solid ${colors.headerBorder}`,
                                  borderBottom: `1px solid ${colors.headerBorder}`,
                                  whiteSpace: "nowrap",
                                  minWidth: 55,
                                  textAlign: "center",
                                }}
                              >
                                {col.subLabel}
                              </th>
                            )
                          })}
                        </tr>
                      )}
                    </thead>

                    <tbody>
                      {studentRows.map((row, idx) => {
                        const rowBg = idx % 2 === 0 ? colors.rowEven : colors.rowOdd

                        return (
                          <tr key={row.student.id}>
                            <td
                              style={{
                                position: "sticky",
                                left: 0,
                                zIndex: 10,
                                padding: "4px 6px",
                                fontSize: "10px",
                                borderBottom: `1px solid ${colors.cellBorder}`,
                                borderRight: `1px solid ${colors.cellBorder}`,
                                fontFamily: "monospace",
                                backgroundColor: rowBg,
                                color: colors.cellText,
                              }}
                            >
                              {row.student.class_roll || "—"}
                            </td>
                            <td
                              style={{
                                position: "sticky",
                                left: 55,
                                zIndex: 10,
                                padding: "4px 6px",
                                fontSize: "10px",
                                borderBottom: `1px solid ${colors.cellBorder}`,
                                borderRight: `1px solid ${colors.cellBorder}`,
                                fontFamily: "monospace",
                                backgroundColor: rowBg,
                                color: colors.cellText,
                              }}
                            >
                              {row.student.student_id}
                            </td>
                            <td
                              style={{
                                position: "sticky",
                                left: 155,
                                zIndex: 10,
                                padding: "4px 6px",
                                fontSize: "10px",
                                borderBottom: `1px solid ${colors.cellBorder}`,
                                borderRight: `1px solid ${colors.cellBorder}`,
                                fontWeight: 500,
                                maxWidth: 140,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                backgroundColor: rowBg,
                                color: colors.cellText,
                              }}
                            >
                              {row.student.name}
                            </td>
                            <td
                              style={{
                                padding: "4px 6px",
                                fontSize: "10px",
                                borderBottom: `1px solid ${colors.cellBorder}`,
                                borderRight: `1px solid ${colors.cellBorder}`,
                                maxWidth: 110,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                backgroundColor: rowBg,
                                color: colors.cellText,
                              }}
                            >
                              {row.student.father_name || "—"}
                            </td>
                            <td
                              style={{
                                padding: "4px 6px",
                                fontSize: "10px",
                                borderBottom: `1px solid ${colors.cellBorder}`,
                                borderRight: `1px solid ${colors.cellBorder}`,
                                backgroundColor: rowBg,
                                color: colors.cellText,
                              }}
                            >
                              {row.student.class_name}{row.student.section_name && ` (${row.student.section_name})`}
                            </td>
                            {dynamicColumns.map((col) => {
                              const v = row.cells[col.id]
                              const paid = v?.paid || 0
                              const due = v?.due || 0
                              const isAreas = col.type === "areas"
                              const isAdvance = col.type === "advance"

                              let cellBg = rowBg
                              if (isAreas) cellBg = colors.areasCellBg
                              else if (isAdvance) cellBg = colors.advanceCellBg

                              return (
                                <td
                                  key={col.id}
                                  style={{
                                    padding: "4px 6px",
                                    fontSize: "10px",
                                    borderBottom: `1px solid ${colors.cellBorder}`,
                                    borderRight: `1px solid ${colors.cellBorder}`,
                                    textAlign: "right",
                                    fontFamily: "monospace",
                                    backgroundColor: cellBg,
                                    color: colors.cellText,
                                  }}
                                >
                                  {paid > 0 ? (
                                    <span style={{ color: colors.paidText }}>{formatCurrency(paid)}</span>
                                  ) : due > 0 ? (
                                    <span style={{ color: colors.dueText, fontWeight: 600 }}>{formatCurrency(due)}</span>
                                  ) : (
                                    <span style={{ color: colors.cellMuted }}>—</span>
                                  )}
                                </td>
                              )
                            })}
                            <td
                              style={{
                                padding: "4px 6px",
                                fontSize: "10px",
                                borderBottom: `1px solid ${colors.cellBorder}`,
                                borderRight: `1px solid ${colors.cellBorder}`,
                                textAlign: "right",
                                fontFamily: "monospace",
                                fontWeight: 600,
                                backgroundColor: rowBg,
                                color: isDark ? "#93c5fd" : "#1d4ed8",
                              }}
                            >
                              {formatCurrency(row.totalExpected)}
                            </td>
                            <td
                              style={{
                                padding: "4px 6px",
                                fontSize: "10px",
                                borderBottom: `1px solid ${colors.cellBorder}`,
                                borderRight: `1px solid ${colors.cellBorder}`,
                                textAlign: "right",
                                fontFamily: "monospace",
                                fontWeight: 700,
                                backgroundColor: rowBg,
                                color: colors.paidText,
                              }}
                            >
                              {formatCurrency(row.totalPaid)}
                            </td>
                            <td
                              style={{
                                padding: "4px 6px",
                                fontSize: "10px",
                                borderBottom: `1px solid ${colors.cellBorder}`,
                                textAlign: "right",
                                fontFamily: "monospace",
                                fontWeight: 700,
                                backgroundColor: rowBg,
                                color: colors.dueText,
                              }}
                            >
                              {row.totalDue > 0 ? formatCurrency(row.totalDue) : "—"}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>

                    {/* ✅ GRAND TOTAL — with high z-index to cover */}
                    <tfoot>
                      <tr>
                        <td
                          colSpan={5}
                          style={{
                            position: "sticky",
                            bottom: 0,
                            left: 0,
                            zIndex: 50,          // ✅ Highest z-index
                            backgroundColor: colors.footerBg,
                            color: colors.footerText,
                            fontWeight: 700,
                            fontSize: "10px",
                            padding: "6px 8px",
                            borderTop: `2px solid ${colors.footerTopBorder}`,
                            boxShadow: "0 0 8px rgba(0,0,0,0.1)",  // ✅ Shadow to separate
                          }}
                        >
                          GRAND TOTAL ({studentRows.length})
                        </td>
                        {dynamicColumns.map((col) => (
                          <td
                            key={col.id}
                            style={{
                              position: "sticky",
                              bottom: 0,
                              zIndex: 45,        // ✅ Higher than cells
                              backgroundColor: colors.footerBg,
                              color: colors.footerText,
                              fontWeight: 700,
                              fontSize: "10px",
                              padding: "6px 8px",
                              textAlign: "right",
                              fontFamily: "monospace",
                              borderRight: `1px solid ${colors.footerBorder}`,
                              borderTop: `2px solid ${colors.footerTopBorder}`,
                            }}
                          >
                            {grandTotals.columns[col.id]?.paid > 0
                              ? formatCurrency(grandTotals.columns[col.id].paid)
                              : "—"}
                          </td>
                        ))}
                        <td
                          style={{
                            position: "sticky",
                            bottom: 0,
                            zIndex: 45,
                            backgroundColor: colors.footerBg,
                            color: isDark ? "#93c5fd" : "#1d4ed8",
                            fontWeight: 700,
                            fontSize: "10px",
                            padding: "6px 8px",
                            textAlign: "right",
                            fontFamily: "monospace",
                            borderRight: `1px solid ${colors.footerBorder}`,
                            borderTop: `2px solid ${colors.footerTopBorder}`,
                          }}
                        >
                          {formatCurrency(grandTotals.totalExpected)}
                        </td>
                        <td
                          style={{
                            position: "sticky",
                            bottom: 0,
                            zIndex: 45,
                            backgroundColor: colors.footerBg,
                            color: isDark ? "#6ee7b7" : "#047857",
                            fontWeight: 700,
                            fontSize: "10px",
                            padding: "6px 8px",
                            textAlign: "right",
                            fontFamily: "monospace",
                            borderRight: `1px solid ${colors.footerBorder}`,
                            borderTop: `2px solid ${colors.footerTopBorder}`,
                          }}
                        >
                          {formatCurrency(grandTotals.totalPaid)}
                        </td>
                        <td
                          style={{
                            position: "sticky",
                            bottom: 0,
                            zIndex: 45,
                            backgroundColor: colors.footerBg,
                            color: isDark ? "#fda4af" : "#be123c",
                            fontWeight: 700,
                            fontSize: "10px",
                            padding: "6px 8px",
                            textAlign: "right",
                            fontFamily: "monospace",
                            borderTop: `2px solid ${colors.footerTopBorder}`,
                          }}
                        >
                          {formatCurrency(grandTotals.totalDue)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Custom scrollbar CSS */}
      <style jsx global>{`
        .master-ledger-scroll {
          scrollbar-width: thin;
          scrollbar-color: #94a3b8 #f1f5f9;
        }
        .dark .master-ledger-scroll {
          scrollbar-color: #64748b #1e293b;
        }
        .master-ledger-scroll::-webkit-scrollbar {
          height: 14px;
          width: 12px;
        }
        .master-ledger-scroll::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 6px;
        }
        .dark .master-ledger-scroll::-webkit-scrollbar-track {
          background: #1e293b;
        }
        .master-ledger-scroll::-webkit-scrollbar-thumb {
          background: #94a3b8;
          border-radius: 6px;
          border: 2px solid #f1f5f9;
        }
        .master-ledger-scroll::-webkit-scrollbar-thumb:hover {
          background: #64748b;
        }
        .dark .master-ledger-scroll::-webkit-scrollbar-thumb {
          background: #64748b;
          border: 2px solid #1e293b;
        }
      `}</style>
    </ResponsiveLayout>
  )
}