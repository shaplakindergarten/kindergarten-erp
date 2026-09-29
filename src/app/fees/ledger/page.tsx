// src/app/fees/ledger/page.tsx
// Final Version — Date Range + Modal Due/Status + Auto-Close Print + Screen-Fit Nav
// ✅ Mobile View Fix Applied — 4 Changes
// ✅ StatCard Fixed — Full number display (no ellipsis)

"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Search,
  Eye,
  Printer,
  Download,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  FileText,
  Receipt,
  Banknote,
  Landmark,
  Smartphone,
  X,
  RefreshCw,
  User,
  Phone,
  MoreHorizontal,
  CreditCard,
  TrendingUp,
  Copy,
  Share2,
  FileSpreadsheet,
  AlertCircle,
  CalendarDays,
  Filter,
  Users,
  Wallet,
  Clock,
  UserCircle2,
  BookOpen,
  Hash,
  Fingerprint,
  CheckCircle2,
  XCircle,
  Layers,
  Loader2,
  Maximize2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ResponsiveLayout } from "@/components/layout/responsive-layout"
import { formatCurrency, cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { format, subDays, startOfMonth, endOfMonth } from "date-fns"

const supabase = createClient()

// ============================================
// TYPES
// ============================================

interface SchoolSettings {
  id: number
  school_name: string
  school_address: string | null
  school_phone: string | null
  school_email: string | null
  school_logo: string | null
}

interface PaymentAllocation {
  id: string
  payment_id: string
  category_id: string
  category_name: string | null
  amount: number
  allocation_type: string
  month: string | null
  month_display: string | null
  frequency: string | null
  expected_amount?: number
  paid_amount?: number
  due_amount?: number
  fine_amount?: number
  discount_amount?: number
  status?: string
  due_date?: string
  is_advance?: boolean
}

interface Student {
  id: string
  name: string
  student_id: string
  class_roll: string | null
  contact: string | null
  father_name: string | null
  mother_name: string | null
  blood_group: string | null
  student_photo_url: string | null
  class_id: string | null
  section_id: string | null
  class_name?: string | null
  section_name?: string | null
  academic_year_id?: string | null
  status?: string
}

interface FeePayment {
  id: string
  student_id: string | null
  amount: number
  payment_method: string
  receipt_no: string
  payment_date: string
  note: string | null
  students: Student | null
  payment_allocations: PaymentAllocation[]
  discount_amount?: number
  fine_amount?: number
  is_advance?: boolean
  advance_month?: number | null
  paid_amount?: number
}

interface ClassOption {
  id: string
  name: string
}

interface SectionOption {
  id: string
  name: string
  class_id: string
}

// ============================================
// CONSTANTS
// ============================================

const PAYMENT_METHODS = [
  { value: "all", label: "All Methods" },
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank" },
  { value: "bkash", label: "bKash" },
  { value: "nagad", label: "Nagad" },
  { value: "rocket", label: "Rocket" },
  { value: "card", label: "Card" },
  { value: "mobile", label: "Mobile Banking" },
]

const SORT_OPTIONS = [
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
  { value: "amount_high", label: "Amount (High → Low)" },
  { value: "amount_low", label: "Amount (Low → High)" },
]

const DATE_RANGE_PRESETS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last7", label: "Last 7 Days" },
  { value: "last30", label: "Last 30 Days" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "custom", label: "Custom Range" },
]

const ROWS_PER_PAGE_OPTIONS = [10, 15, 25, 50, 100]

// ============================================
// HELPERS
// ============================================

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

const getInitials = (name: string | null | undefined): string => {
  if (!name) return "?"
  return name
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return "-"
  try {
    return format(new Date(dateString), "dd MMM yyyy")
  } catch {
    return "-"
  }
}

const formatDateTime = (dateString: string | null | undefined): string => {
  if (!dateString) return "-"
  try {
    return format(new Date(dateString), "dd MMM yyyy, hh:mm a")
  } catch {
    return "-"
  }
}

const getMonthName = (month: string | null | undefined): string => {
  if (!month) return "—"
  if (isNaN(parseInt(month)) && !month.includes("-")) return month
  if (month.includes("-")) {
    const parts = month.split("-")
    if (parts.length === 2) {
      const year = parts[0]
      const monthNum = parseInt(parts[1])
      if (monthNum >= 1 && monthNum <= 12) {
        return `${format(new Date(2024, monthNum - 1, 1), "MMMM")} ${year}`
      }
    }
    return month
  }
  const num = parseInt(month)
  if (num >= 1 && num <= 12) {
    return format(new Date(2024, num - 1, 1), "MMMM")
  }
  return month
}

const getPaymentMethodIcon = (method: string | null | undefined): React.ElementType => {
  const normalized = method?.toLowerCase() || ""
  const icons: Record<string, React.ElementType> = {
    cash: Banknote,
    bank: Landmark,
    mobile: Smartphone,
    bkash: Smartphone,
    nagad: Smartphone,
    rocket: Smartphone,
    card: CreditCard,
  }
  return icons[normalized] || Banknote
}

const getPaymentMethodColor = (method: string | null | undefined): string => {
  const normalized = method?.toLowerCase() || ""
  const colors: Record<string, string> = {
    cash: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
    bank: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
    mobile: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800",
    bkash: "bg-pink-100 text-pink-800 border-pink-300 dark:bg-pink-950 dark:text-pink-300 dark:border-pink-800",
    nagad: "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800",
    rocket: "bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-950 dark:text-cyan-300 dark:border-cyan-800",
    card: "bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800",
  }
  return colors[normalized] || "bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-200"
}

const getStatusBadge = (allocations: PaymentAllocation[] | undefined) => {
  if (!allocations || allocations.length === 0) {
    return { label: "Pending", color: "bg-amber-500 text-white", icon: Clock }
  }
  const hasRefund = allocations.some((a) => a.allocation_type === "refund")
  if (hasRefund) return { label: "Refund", color: "bg-rose-500 text-white", icon: XCircle }

  const hasAdvanceGlobal = allocations.some((a) => a.allocation_type === "advance_global" || a.is_advance === true)
  const hasRegular = allocations.some((a) => a.allocation_type !== "advance_global" && a.allocation_type !== "refund")

  if (hasAdvanceGlobal && hasRegular) return { label: "Mixed", color: "bg-blue-500 text-white", icon: Wallet }
  if (hasAdvanceGlobal) return { label: "Advance", color: "bg-purple-500 text-white", icon: TrendingUp }
  return { label: "Paid", color: "bg-emerald-500 text-white", icon: CheckCircle2 }
}

const getCategoryColor = (name: string | null | undefined): string => {
  const colors = [
    "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200",
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200",
    "bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200",
    "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200",
    "bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200",
    "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200",
    "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/60 dark:text-cyan-200",
    "bg-pink-100 text-pink-800 dark:bg-pink-900/60 dark:text-pink-200",
  ]
  const hash = (name || "").split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return colors[hash % colors.length]
}

const getDateRangeLabel = (
  dateRange: string,
  dateFrom: string,
  dateTo: string
): string => {
  if (dateRange === "custom") {
    if (dateFrom && dateTo) return `${formatDate(dateFrom)} - ${formatDate(dateTo)}`
    if (dateFrom) return `From ${formatDate(dateFrom)}`
    if (dateTo) return `Until ${formatDate(dateTo)}`
    return "Custom Range"
  }
  const preset = DATE_RANGE_PRESETS.find((p) => p.value === dateRange)
  return preset?.label || "Last 30 Days"
}

// ============================================
// A5 RECEIPT HTML GENERATOR (Logo Header + 0.5" margin)
// ============================================

const generateA5ReceiptHTML = (
  payment: FeePayment,
  schoolSettings: SchoolSettings | null
): string => {
  const student = payment.students
  const school = schoolSettings

  const regularAllocations = (payment.payment_allocations || []).filter(
    (a) => a.allocation_type !== "advance" && a.allocation_type !== "advance_global"
  )
  const advanceAllocations = (payment.payment_allocations || []).filter(
    (a) => a.allocation_type === "advance" || a.allocation_type === "advance_global"
  )

  const regularTotal = regularAllocations.reduce((sum, a) => sum + a.amount, 0)
  const advanceTotal = advanceAllocations.reduce((sum, a) => sum + a.amount, 0)
  const totalPaid = payment.amount || regularTotal + advanceTotal
  const totalDue = payment.payment_allocations?.reduce((sum, a) => sum + (a.due_amount || 0), 0) || 0

  const logoSrc = school?.school_logo && school.school_logo.trim() !== "" ? school.school_logo : null

  const allocationRows =
    payment.payment_allocations && payment.payment_allocations.length > 0
      ? payment.payment_allocations
          .map((alloc, idx) => {
            const isAdvance =
              alloc.allocation_type === "advance" || alloc.allocation_type === "advance_global"
            const status = alloc.status || (alloc.due_amount && alloc.due_amount > 0 ? "pending" : "paid")
            const statusClass = isAdvance
              ? "status-advance"
              : status === "paid"
                ? "status-paid"
                : status === "partial"
                  ? "status-partial"
                  : "status-pending"
            const statusLabel = isAdvance ? "Advance" : status

            return `
              <tr class="${isAdvance ? "advance-row" : ""}">
                <td class="col-sl">${idx + 1}</td>
                <td class="category-name">${alloc.category_name || "Fee"}</td>
                <td class="month-info">${alloc.month_display || alloc.month || "—"}</td>
                <td class="col-amount">${formatCurrency(alloc.amount)}</td>
                <td class="col-status">
                  <span class="status-badge ${statusClass}">${statusLabel}</span>
                </td>
              </tr>
            `
          })
          .join("")
      : `
        <tr>
          <td colspan="5" style="text-align: center; padding: 4mm; color: #94a3b8;">
            No allocation details
          </td>
        </tr>
      `

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Receipt ${payment.receipt_no}</title>
        <style>
          @page {
            size: A5 portrait;
            margin: 12.7mm 12.7mm 12.7mm 12.7mm;
          }

          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          html, body {
            width: 148mm;
            min-height: 210mm;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 10pt;
            color: #1e293b;
            background: white;
          }

          body { padding: 0; }

          .a5-receipt {
            width: 100%;
            max-width: 122.6mm;
            margin: 0 auto;
            background: white;
          }

          .school-header {
            display: flex;
            align-items: center;
            gap: 4mm;
            padding-bottom: 2.5mm;
            border-bottom: 2.5px solid #1e293b;
            margin-bottom: 3mm;
          }

          .school-logo {
            width: 20mm;
            height: 20mm;
            object-fit: contain;
            flex-shrink: 0;
          }

          .school-logo-placeholder {
            width: 20mm;
            height: 20mm;
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 22pt;
            font-weight: bold;
            color: #1e293b;
            background: #f1f5f9;
            border-radius: 50%;
            border: 2px solid #cbd5e1;
          }

          .school-info {
            flex: 1;
            min-width: 0;
          }

          .school-name {
            font-size: 15pt;
            font-weight: bold;
            color: #0f172a;
            line-height: 1.2;
            margin-bottom: 1mm;
          }

          .school-address {
            font-size: 10pt;
            color: #334155;
            line-height: 1.3;
            margin-bottom: 0.5mm;
          }

          .school-contact {
            font-size: 10pt;
            color: #334155;
            line-height: 1.3;
          }

          .receipt-title-bar {
            background: #1e293b;
            color: white;
            text-align: center;
            padding: 2mm 3mm;
            border-radius: 1.5mm;
            margin-bottom: 3mm;
          }

          .receipt-title-bar h1 {
            font-size: 11pt;
            font-weight: bold;
            letter-spacing: 2px;
            text-transform: uppercase;
            margin-bottom: 0.5mm;
          }

          .receipt-meta {
            display: flex;
            justify-content: center;
            gap: 6mm;
            font-size: 8pt;
            color: #cbd5e1;
          }

          .receipt-meta strong { color: white; font-weight: bold; }

          .section-title {
            font-size: 8pt;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #0f172a;
            background: #f1f5f9;
            padding: 1mm 2mm;
            border-left: 2.5px solid #1e293b;
            margin-bottom: 2mm;
          }

          .student-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1.5mm 4mm;
            margin-bottom: 3mm;
            font-size: 9pt;
          }

          .info-row {
            display: flex;
            gap: 1mm;
            line-height: 1.4;
            border-bottom: 0.5px dotted #cbd5e1;
            padding-bottom: 0.8mm;
          }

          .info-label {
            color: #64748b;
            font-weight: 500;
            min-width: 16mm;
            flex-shrink: 0;
          }

          .info-value {
            color: #0f172a;
            font-weight: 600;
            flex: 1;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .breakdown-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 3mm;
            font-size: 8.5pt;
          }

          .breakdown-table thead { background: #e2e8f0; }

          .breakdown-table th {
            padding: 1.5mm 2mm;
            text-align: left;
            font-weight: bold;
            color: #0f172a;
            border: 0.5px solid #94a3b8;
            font-size: 8pt;
            text-transform: uppercase;
          }

          .breakdown-table td {
            padding: 1.3mm 2mm;
            border: 0.5px solid #cbd5e1;
            color: #1e293b;
            line-height: 1.3;
          }

          .breakdown-table .col-sl { width: 8mm; text-align: center; }
          .breakdown-table .col-amount { width: 22mm; text-align: right; font-weight: 600; }
          .breakdown-table .col-status { width: 18mm; text-align: center; }

          .breakdown-table .category-name { font-weight: 600; }
          .breakdown-table .month-info { font-size: 7.5pt; color: #64748b; }
          .breakdown-table .advance-row { background: #faf5ff; }
          .breakdown-table .advance-row .category-name { color: #7c3aed; }

          .breakdown-table .status-badge {
            display: inline-block;
            padding: 0.5mm 1.5mm;
            border-radius: 1mm;
            font-size: 7pt;
            font-weight: bold;
            text-transform: uppercase;
          }

          .status-paid { background: #d1fae5; color: #065f46; }
          .status-advance { background: #ede9fe; color: #6d28d9; }
          .status-partial { background: #fef3c7; color: #92400e; }
          .status-pending { background: #fee2e2; color: #991b1b; }

          .totals-section { margin-top: 2mm; margin-bottom: 3mm; }

          .totals-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9pt;
          }

          .totals-table td {
            padding: 1.2mm 2mm;
            border-bottom: 0.5px solid #e2e8f0;
          }

          .totals-table .label { color: #475569; font-weight: 500; }
          .totals-table .value {
            text-align: right;
            font-weight: 600;
            color: #0f172a;
            font-family: 'Courier New', monospace;
          }

          .totals-table .grand-total-row { background: #1e293b; color: white; }
          .totals-table .grand-total-row td { padding: 2mm; border: none; }
          .totals-table .grand-total-row .label {
            color: white;
            font-size: 10pt;
            font-weight: bold;
            letter-spacing: 1px;
          }
          .totals-table .grand-total-row .value {
            color: #86efac;
            font-size: 13pt;
            font-weight: bold;
          }

          .in-words {
            margin-top: 2mm;
            padding: 1.5mm 2mm;
            background: #f8fafc;
            border-left: 2px solid #1e293b;
            font-size: 8pt;
            color: #475569;
            line-height: 1.4;
          }

          .in-words strong { color: #0f172a; }

          .payment-info {
            margin-bottom: 4mm;
            padding: 1.5mm 2mm;
            background: #f8fafc;
            border-radius: 1mm;
            font-size: 8.5pt;
          }

          .payment-info-row {
            display: flex;
            justify-content: space-between;
            padding: 0.8mm 0;
          }

          .payment-info-row .label { color: #64748b; }
          .payment-info-row .value {
            color: #0f172a;
            font-weight: 600;
            text-transform: capitalize;
          }

          .signature-section {
            display: flex;
            justify-content: space-between;
            margin-top: 10mm;
            padding-top: 3mm;
          }

          .signature-box {
            text-align: center;
            font-size: 8pt;
            color: #475569;
            width: 40mm;
          }

          .signature-line {
            border-top: 0.8px solid #1e293b;
            margin-bottom: 1mm;
            padding-top: 0;
          }

          .signature-label { font-weight: 500; color: #334155; }

          .receipt-footer {
            text-align: center;
            margin-top: 5mm;
            padding-top: 2mm;
            border-top: 0.5px dashed #cbd5e1;
            font-size: 7.5pt;
            color: #94a3b8;
            line-height: 1.4;
          }

          .receipt-footer .thank-you {
            font-size: 10pt;
            font-weight: bold;
            color: #1e293b;
            margin-bottom: 1mm;
            letter-spacing: 1px;
          }
        </style>
      </head>
      <body>
        <div class="a5-receipt">

          <div class="school-header">
            ${
              logoSrc
                ? `<img src="${logoSrc}" alt="School Logo" class="school-logo" />`
                : `<div class="school-logo-placeholder">${(school?.school_name || "S").charAt(0)}</div>`
            }
            <div class="school-info">
              <div class="school-name">${school?.school_name || "School Name"}</div>
              ${school?.school_address ? `<div class="school-address">${school.school_address}</div>` : ""}
              <div class="school-contact">
                ${school?.school_phone ? `Phone: ${school.school_phone}` : ""}
              </div>
            </div>
          </div>

          <div class="receipt-title-bar">
            <h1>Fee Receipt</h1>
            <div class="receipt-meta">
              <span>Receipt No: <strong>${payment.receipt_no || "N/A"}</strong></span>
              <span>Date: <strong>${formatDateTime(payment.payment_date)}</strong></span>
            </div>
          </div>

          <div class="section-title">Student Information</div>
          <div class="student-grid">
            <div class="info-row">
              <span class="info-label">Name</span>
              <span class="info-value">${student?.name || "N/A"}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Student ID</span>
              <span class="info-value">${student?.student_id || "N/A"}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Class</span>
              <span class="info-value">${student?.class_name || "N/A"}${student?.section_name ? ` (${student.section_name})` : ""}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Roll</span>
              <span class="info-value">${student?.class_roll || "N/A"}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Father</span>
              <span class="info-value">${student?.father_name || "N/A"}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Contact</span>
              <span class="info-value">${student?.contact || "N/A"}</span>
            </div>
          </div>

          <div class="section-title">Fee Breakdown</div>
          <table class="breakdown-table">
            <thead>
              <tr>
                <th class="col-sl">#</th>
                <th>Category</th>
                <th>Month</th>
                <th class="col-amount">Amount</th>
                <th class="col-status">Status</th>
              </tr>
            </thead>
            <tbody>
              ${allocationRows}
            </tbody>
          </table>

          <div class="totals-section">
            <table class="totals-table">
              ${regularTotal > 0 ? `<tr><td class="label">Regular Fee Paid</td><td class="value">${formatCurrency(regularTotal)}</td></tr>` : ""}
              ${advanceTotal > 0 ? `<tr><td class="label">Advance Fee Paid</td><td class="value" style="color: #7c3aed;">${formatCurrency(advanceTotal)}</td></tr>` : ""}
              ${payment.discount_amount && payment.discount_amount > 0 ? `<tr><td class="label">Discount</td><td class="value" style="color: #d97706;">- ${formatCurrency(payment.discount_amount)}</td></tr>` : ""}
              ${payment.fine_amount && payment.fine_amount > 0 ? `<tr><td class="label">Fine</td><td class="value" style="color: #dc2626;">+ ${formatCurrency(payment.fine_amount)}</td></tr>` : ""}
              <tr class="grand-total-row">
                <td class="label">TOTAL PAID</td>
                <td class="value">${formatCurrency(totalPaid)}</td>
              </tr>
            </table>
          </div>

          <div class="in-words">
            <strong>In Words:</strong> ${payment.amount ? numberToWords(payment.amount) : "Zero"} Taka Only
          </div>

          <div class="payment-info">
            <div class="payment-info-row">
              <span class="label">Payment Method</span>
              <span class="value">${payment.payment_method || "Cash"}</span>
            </div>
            ${totalDue > 0 ? `<div class="payment-info-row"><span class="label">Remaining Due</span><span class="value" style="color: #dc2626;">${formatCurrency(totalDue)}</span></div>` : ""}
            ${payment.note ? `<div class="payment-info-row"><span class="label">Note</span><span class="value" style="font-style: italic; font-weight: 400;">${payment.note}</span></div>` : ""}
          </div>

          <div class="signature-section">
            <div class="signature-box">
              <div class="signature-line"></div>
              <div class="signature-label">Guardian Signature</div>
            </div>
            <div class="signature-box">
              <div class="signature-line"></div>
              <div class="signature-label">Cashier Signature</div>
            </div>
          </div>

          <div class="receipt-footer">
            <div class="thank-you">Thank You!</div>
            <div>This is a computer-generated receipt. Please keep it safe for future reference.</div>
            <div style="margin-top: 1mm; font-size: 7pt;">
              Generated on ${format(new Date(), "dd MMM yyyy, hh:mm a")}
            </div>
          </div>

        </div>
      </body>
    </html>
  `
}

// ============================================
// FILTER CHIP
// ============================================

interface FilterChipProps {
  label: string
  onRemove: () => void
}

const FilterChip = ({ label, onRemove }: FilterChipProps) => (
  <span className="inline-flex items-center gap-1 bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded-full border border-primary/30 font-medium">
    {label}
    <button
      onClick={onRemove}
      className="hover:text-rose-500 focus:outline-none rounded-full ml-0.5 transition-colors"
      aria-label={`Remove filter: ${label}`}
    >
      <X className="h-2.5 w-2.5" />
    </button>
  </span>
)

// ============================================
// ✅ FIXED STAT CARD — Full number display, no ellipsis
// ============================================

interface StatCardProps {
  title: string
  value: string | number
  icon: React.ElementType
  gradient: string
  iconBg: string
}

const StatCard = ({ title, value, icon: Icon, gradient, iconBg }: StatCardProps) => (
  <div
    className={cn(
      "relative overflow-hidden rounded-xl p-2 sm:p-2.5 md:p-3 text-white shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5",
      gradient
    )}
  >
    {/* Title Row — compact, truncate title only */}
    <div className="flex items-center justify-between gap-1 mb-1 sm:mb-1.5">
      <p className="text-[8px] sm:text-[9px] md:text-[10px] font-semibold text-white/85 uppercase tracking-wider leading-none truncate">
        {title}
      </p>
      <div
        className={cn(
          "p-1 sm:p-1.5 rounded-md sm:rounded-lg shrink-0 backdrop-blur-sm",
          iconBg
        )}
      >
        <Icon className="h-2.5 w-2.5 sm:h-3 sm:w-3 md:h-3.5 md:w-3.5" />
      </div>
    </div>

    {/* Value — full visible, auto-scales, wraps if needed, no truncate */}
    <p      className="font-bold text-white tracking-tight tabular-nums"
      style={{
        fontSize: "clamp(10px, 2.3vw, 18px)",
        lineHeight: 1.15,
        wordBreak: "break-word",
        overflowWrap: "anywhere",
      }}
      title={typeof value === "string" ? value : String(value)}
    >
      {value}
    </p>
  </div>
)

// ============================================
// STUDENT CELL
// ============================================

const StudentCell = ({ student }: { student: Student | null }) => {
  if (!student) {
    return (
      <div className="flex items-center gap-2 min-w-[160px]">
        <Avatar className="h-8 w-8 border border-destructive shrink-0">
          <AvatarFallback className="text-[10px] font-medium bg-destructive/10 text-destructive">
            <User className="h-3 w-3" />
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-destructive">Student Not Found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 min-w-[180px] group">
      <Avatar className="h-8 w-8 border border-border shrink-0 transition-all group-hover:ring-2 group-hover:ring-primary/20">
        <AvatarImage src={student.student_photo_url || undefined} />
        <AvatarFallback className="text-[10px] font-medium bg-indigo-600 text-white">
          {getInitials(student.name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold truncate text-foreground leading-none group-hover:text-primary transition-colors">
          {student.name}
        </p>
        <div className="flex items-center flex-wrap gap-1 text-[9px] text-muted-foreground leading-none mt-1">
          <span className="font-mono">{student.student_id || "N/A"}</span>
          {student.class_name && (
            <>
              <span className="w-px h-2 bg-border" />
              <span>{student.class_name}</span>
            </>
          )}
          {student.class_roll && (
            <>
              <span className="w-px h-2 bg-border" />
              <span>Roll {student.class_roll}</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================
// PAYMENT METHOD BADGE
// ============================================

const PaymentMethodBadge = ({ method, size = "sm" }: { method: string | null | undefined; size?: "sm" | "md" }) => {
  const Icon = getPaymentMethodIcon(method)
  const colorClass = getPaymentMethodColor(method)
  const textSize = size === "sm" ? "text-[9px]" : "text-[10px]"
  const iconSize = size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"
  const padding = size === "sm" ? "px-2 py-0.5" : "px-2.5 py-1"

  return (
    <Badge className={cn("border font-medium capitalize", textSize, padding, colorClass)}>
      <Icon className={cn(iconSize, "mr-1")} />
      {method || "Cash"}
    </Badge>
  )
}

// ============================================
// PAYMENT DETAILS MODAL
// ============================================

interface PaymentDetailsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  payment: FeePayment | null
  onPrintReceipt: () => void
  onExport: () => void
}

const PaymentDetailsModal = ({
  open,
  onOpenChange,
  payment,
  onPrintReceipt,
  onExport,
}: PaymentDetailsModalProps) => {
  const [isFullscreen, setIsFullscreen] = useState(false)

  if (!payment) return null

  const totalDue = payment.payment_allocations?.reduce((sum, a) => sum + (a.due_amount || 0), 0) || 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "bg-white dark:bg-slate-950 p-0 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 transition-all duration-300",
          isFullscreen
            ? "max-w-[98vw] max-h-[98vh] w-[98vw] h-[98vh]"
            : "max-w-5xl max-h-[90vh] w-full"
        )}
      >
        <DialogHeader className="sticky top-0 z-10 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 p-4">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                <Receipt className="h-4.5 w-4.5 text-primary" />
                Payment Details
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5 font-mono">
                Receipt No: {payment.receipt_no}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="h-8 w-8 p-0 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="h-8 w-8 p-0 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className={cn(
          "p-6 space-y-6 overflow-y-auto",
          isFullscreen ? "h-[calc(98vh-80px)]" : "max-h-[calc(90vh-80px)]"
        )}>
          {/* Student Profile */}
          <Card className="border shadow-sm rounded-lg bg-white dark:bg-slate-900 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-2.5 flex items-center gap-2">
              <UserCircle2 className="h-4 w-4 text-white" />
              <span className="text-xs font-bold text-white uppercase tracking-wide">
                Student Profile
              </span>
            </div>
            <CardContent className="p-4 space-y-3">
              {payment.students ? (
                <>
                  <div className="flex items-center gap-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                    <Avatar className="h-14 w-14 border-2 border-primary/20 shadow-sm shrink-0">
                      <AvatarImage src={payment.students.student_photo_url || undefined} />
                      <AvatarFallback className="text-base font-bold bg-indigo-600 text-white">
                        {getInitials(payment.students.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-foreground truncate">
                        {payment.students.name}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5">
                        <span className="text-xs font-mono font-medium text-primary bg-primary/10 px-2 py-0.5 rounded">
                          ID: {payment.students.student_id || "N/A"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-2 text-xs">
                    <div>
                      <span className="text-[10px] uppercase text-muted-foreground block font-medium flex items-center gap-1">
                        <BookOpen className="h-3 w-3" /> Class
                      </span>
                      <p className="font-medium text-foreground">
                        {payment.students.class_name || "N/A"}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-muted-foreground block font-medium flex items-center gap-1">
                        <Hash className="h-3 w-3" /> Roll
                      </span>
                      <p className="font-medium text-foreground">{payment.students.class_roll || "N/A"}</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-muted-foreground block font-medium flex items-center gap-1">
                        <Fingerprint className="h-3 w-3" /> Blood
                      </span>
                      <p className="font-medium text-foreground">{payment.students.blood_group || "N/A"}</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-muted-foreground block font-medium flex items-center gap-1">
                        <User className="h-3 w-3" /> Father
                      </span>
                      <p className="font-medium text-foreground truncate">{payment.students.father_name || "N/A"}</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-muted-foreground block font-medium flex items-center gap-1">
                        <User className="h-3 w-3" /> Mother
                      </span>
                      <p className="font-medium text-foreground truncate">{payment.students.mother_name || "N/A"}</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-muted-foreground block font-medium flex items-center gap-1">
                        <Phone className="h-3 w-3" /> Contact
                      </span>
                      <p className="font-medium text-foreground font-mono">{payment.students.contact || "N/A"}</p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-4">
                  <User className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm font-medium text-destructive">Student Not Found</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Transaction Summary */}
          <Card className="border shadow-sm rounded-lg bg-white dark:bg-slate-900 overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2.5 flex items-center gap-2">
              <Receipt className="h-4 w-4 text-white" />
              <span className="text-xs font-bold text-white uppercase tracking-wide">
                Transaction Summary
              </span>
            </div>
            <CardContent className="p-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-slate-800">
                <div className="p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Receipt No</span>
                    <span className="text-xs font-mono font-bold text-primary">{payment.receipt_no}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Payment Date</span>
                    <span className="text-xs font-medium">{formatDateTime(payment.payment_date)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Payment Method</span>
                    <span><PaymentMethodBadge method={payment.payment_method} size="sm" /></span>
                  </div>
                </div>
                <div className="p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Paid Amount</span>
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(payment.amount)}
                    </span>
                  </div>
                  {totalDue > 0 && (
                    <div className="flex justify-between border-t border-dashed border-slate-200 dark:border-slate-700 pt-2 mt-1">
                      <span className="text-xs font-semibold text-muted-foreground">Remaining Due</span>
                      <span className="text-sm font-bold text-rose-600 dark:text-rose-400">
                        {formatCurrency(totalDue)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Note</span>
                    <span className="text-xs text-muted-foreground italic">{payment.note || "—"}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Fee Allocations — WITH Due + Status columns */}
          <Card className="border shadow-sm rounded-lg bg-white dark:bg-slate-900 overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2.5 flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wide flex items-center gap-2">
                <Layers className="h-4 w-4" /> Fee Allocations
              </span>
              <Badge variant="outline" className="text-[9px] px-2 py-0 font-mono bg-white/20 text-white border-white/30">
                {payment.payment_allocations?.length || 0} items
              </Badge>
            </div>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-[9px] uppercase font-bold text-muted-foreground">
                    <tr>
                      <th className="py-2 px-4">Category</th>
                      <th className="py-2 px-2">Month</th>
                      <th className="py-2 px-2">Type</th>
                      <th className="py-2 px-4 text-right">Allocated</th>
                      <th className="py-2 px-4 text-right">Due</th>
                      <th className="py-2 px-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {payment.payment_allocations && payment.payment_allocations.length > 0 ? (
                      payment.payment_allocations.map((alloc, idx) => {
                        const isAdvance = alloc.allocation_type === "advance" || alloc.is_advance === true
                        const dueAmount = alloc.due_amount || 0
                        const status = alloc.status || (dueAmount > 0 ? "pending" : "paid")

                        return (
                          <tr key={alloc.id || idx} className={cn(
                            idx % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/70 dark:bg-slate-800/40"
                          )}>
                            <td className="py-2 px-4 font-medium text-foreground">
                              {alloc.category_name || "Fee"}
                            </td>
                            <td className="py-2 px-2 text-muted-foreground font-mono">
                              {alloc.month_display || getMonthName(alloc.month)}
                            </td>
                            <td className="py-2 px-2">
                              <Badge
                                className={cn(
                                  "text-[8px] px-1.5 py-0 border-0 rounded font-normal capitalize",
                                  isAdvance
                                    ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                                    : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                )}
                              >
                                {alloc.allocation_type || "Regular"}
                              </Badge>
                            </td>
                            <td className="py-2 px-4 text-right font-bold font-mono text-slate-900 dark:text-slate-100">
                              {formatCurrency(alloc.amount)}
                            </td>
                            <td className="py-2 px-4 text-right font-mono text-rose-600 dark:text-rose-400">
                              {dueAmount > 0 ? formatCurrency(dueAmount) : "—"}
                            </td>
                            <td className="py-2 px-2 text-center">
                              <Badge
                                className={cn(
                                  "text-[7px] px-1.5 py-0 border-0 rounded-full font-medium capitalize",
                                  status === "paid" && "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
                                  status === "partial" && "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
                                  status === "overdue" && "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
                                  status === "pending" && "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                )}
                              >
                                {status || "pending"}
                              </Badge>
                            </td>
                          </tr>
                        )
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-muted-foreground text-xs">
                          No allocation details available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button
              onClick={onPrintReceipt}
              className="flex-1 gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-sm rounded-lg h-9 text-xs font-semibold transition-all"
            >
              <Printer className="h-3.5 w-3.5" /> Print Receipt
            </Button>
            <Button
              variant="outline"
              onClick={onExport}
              className="flex-1 gap-2 rounded-lg h-9 text-xs font-semibold transition-colors"
            >
              <Download className="h-3.5 w-3.5" /> Download Statement
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function FeesLedgerPage() {
  const [payments, setPayments] = useState<FeePayment[]>([])
  const [classes, setClasses] = useState<ClassOption[]>([])
  const [sections, setSections] = useState<SectionOption[]>([])
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPayment, setSelectedPayment] = useState<FeePayment | null>(null)
  const [showModal, setShowModal] = useState(false)

  const ledgerPrintRef = useRef<HTMLDivElement>(null)

  const [searchQuery, setSearchQuery] = useState("")
  const [filterClass, setFilterClass] = useState("all")
  const [filterSection, setFilterSection] = useState("all")
  const [filterPaymentMethod, setFilterPaymentMethod] = useState("all")
  const [dateRange, setDateRange] = useState<"today" | "yesterday" | "last7" | "last30" | "this_month" | "last_month" | "custom">("last30")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "amount_high" | "amount_low">("newest")
  const [limit, setLimit] = useState(15)
  const [currentPage, setCurrentPage] = useState(1)
  const [showFilters, setShowFilters] = useState(false)

  const [stats, setStats] = useState({
    totalPayments: 0,
    totalCollected: 0,
    todayCollected: 0,
    filteredCollected: 0,
    totalTransactions: 0,
    averageCollection: 0,
    uniqueStudents: 0,
  })

  const totalCount = payments.length
  const totalPages = Math.ceil(totalCount / limit)
  const startRecord = (currentPage - 1) * limit + 1
  const endRecord = Math.min(currentPage * limit, totalCount)
  const displayedPayments = payments.slice((currentPage - 1) * limit, currentPage * limit)

  const filteredSections = useMemo(() => {
    if (filterClass === "all") return sections
    return sections.filter((s) => s.class_id === filterClass)
  }, [sections, filterClass])

  const filterChips = useMemo(() => {
    const chips: { id: string; label: string }[] = []
    if (filterClass !== "all") {
      const cls = classes.find((c) => c.id === filterClass)
      chips.push({ id: "class", label: `Class: ${cls?.name || ""}` })
    }
    if (filterSection !== "all") {
      const sec = sections.find((s) => s.id === filterSection)
      chips.push({ id: "section", label: `Section: ${sec?.name || ""}` })
    }
    if (filterPaymentMethod !== "all") {
      const method = PAYMENT_METHODS.find((m) => m.value === filterPaymentMethod)
      chips.push({ id: "method", label: `Method: ${method?.label || filterPaymentMethod}` })
    }
    if (searchQuery.trim()) {
      chips.push({ id: "search", label: `Search: "${searchQuery.trim()}"` })
    }
    return chips
  }, [filterClass, filterSection, filterPaymentMethod, searchQuery, classes, sections])

  // ═══════════════════════════════════════════════════════════════════
  // ✅ LOAD DATA — WITH student_fee_dues JOIN for due + status
  // ═══════════════════════════════════════════════════════════════════
  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const { data: studentsData, error: studentsError } = await supabase
        .from("students")
        .select(`id, name, student_id, class_roll, contact, father_name, mother_name, blood_group, student_photo_url, class_id, section_id, academic_year_id, status`)

      if (studentsError) throw studentsError

      const classIds = new Set<string>()
      const sectionIds = new Set<string>()
      ;(studentsData || []).forEach((s: any) => {
        if (s.class_id) classIds.add(s.class_id)
        if (s.section_id) sectionIds.add(s.section_id)
      })

      let classMap: Record<string, string> = {}
      let sectionMap: Record<string, string> = {}

      if (classIds.size > 0) {
        const { data: classData } = await supabase.from("classes").select("id, name").in("id", Array.from(classIds))
        if (classData) classMap = classData.reduce((acc: any, c: any) => ({ ...acc, [c.id]: c.name }), {})
      }
      if (sectionIds.size > 0) {
        const { data: sectionData } = await supabase.from("sections").select("id, name").in("id", Array.from(sectionIds))
        if (sectionData) sectionMap = sectionData.reduce((acc: any, s: any) => ({ ...acc, [s.id]: s.name }), {})
      }

      const studentMap: Record<string, Student> = {}
      ;(studentsData || []).forEach((s: any) => {
        studentMap[s.id] = {
          ...s,
          class_name: s.class_id ? classMap[s.class_id] || null : null,
          section_name: s.section_id ? sectionMap[s.section_id] || null : null,
        }
      })

      const { data: classesData } = await supabase.from("classes").select("id, name").order("name")
      if (classesData) setClasses(classesData)

      const { data: sectionsData } = await supabase.from("sections").select("id, name, class_id").order("name")
      if (sectionsData) setSections(sectionsData)

      const { data: settingsData } = await supabase.from("school_settings").select("*").single()
      if (settingsData) setSchoolSettings(settingsData)

      let query = supabase.from("fee_payments").select(`id, student_id, amount, paid_amount, payment_method, receipt_no, payment_date, note, discount_amount, fine_amount, is_advance, advance_month`)

      if (dateFrom) query = query.gte("payment_date", `${dateFrom}T00:00:00`)
      if (dateTo) query = query.lte("payment_date", `${dateTo}T23:59:59`)
      if (filterPaymentMethod !== "all") query = query.eq("payment_method", filterPaymentMethod)

      const sortMapping: Record<string, { column: string; ascending: boolean }> = {
        newest: { column: "payment_date", ascending: false },
        oldest: { column: "payment_date", ascending: true },
        amount_high: { column: "amount", ascending: false },
        amount_low: { column: "amount", ascending: true },
      }
      const sortConfig = sortMapping[sortBy] || sortMapping.newest
      query = query.order(sortConfig.column as any, { ascending: sortConfig.ascending })

      const { data: paymentsData, error: paymentsError } = await query
      if (paymentsError) throw paymentsError

      const paymentIds = (paymentsData || []).map((p: any) => p.id).filter(Boolean)
      let allocationsData: any[] = []

      if (paymentIds.length > 0) {
        const { data: allocs } = await supabase
          .from("payment_allocations")
          .select(`id, payment_id, category_id, amount, allocation_type, month, created_at`)
          .in("payment_id", paymentIds)

        if (allocs) {
          const categoryIds = allocs.map((a: any) => a.category_id).filter(Boolean)
          let categoryNameMap: Record<string, string> = {}
          if (categoryIds.length > 0) {
            const { data: catData } = await supabase.from("fee_categories").select("id, name").in("id", categoryIds)
            if (catData) categoryNameMap = catData.reduce((acc: any, c: any) => ({ ...acc, [c.id]: c.name }), {})
          }

          // ✅ Fetch matching student_fee_dues for due + status
          const months = allocs.map((a: any) => a.month).filter(Boolean)
          const uniqueStudentIds = paymentsData.map((p: any) => p.student_id).filter(Boolean)

          let dueMap: Record<string, any> = {}

          if (uniqueStudentIds.length > 0 && months.length > 0) {
            const { data: duesData } = await supabase
              .from("student_fee_dues")
              .select(`id, student_id, category_id, month, expected_amount, paid_amount, due_amount, status, is_advance`)
              .in("student_id", uniqueStudentIds)
              .in("month", months)

            if (duesData) {
              duesData.forEach((d: any) => {
                const key = `${d.student_id}-${d.category_id}-${d.month}`
                dueMap[key] = d
              })
            }
          }

          allocationsData = allocs.map((alloc: any) => {
            const payment = paymentsData.find((p: any) => p.id === alloc.payment_id)
            const dueKey = payment && alloc.category_id && alloc.month
              ? `${payment.student_id}-${alloc.category_id}-${alloc.month}`
              : null
            const dueInfo = dueKey ? dueMap[dueKey] : null

            return {
              ...alloc,
              category_name: alloc.category_id
                ? (categoryNameMap[alloc.category_id] || "Fee")
                : (alloc.allocation_type === "advance_global" ? "Advance (Global)" : alloc.allocation_type === "advance" ? "Advance" : "Fee"),
              month_display: getMonthName(alloc.month),
              due_amount: dueInfo?.due_amount || 0,
              status: dueInfo?.status || (alloc.allocation_type === "advance" || alloc.allocation_type === "advance_global" ? "advance" : "paid"),
              is_advance: alloc.allocation_type === "advance" || alloc.allocation_type === "advance_global",
            }
          })
        }
      }

      const allocationsByPaymentId: Record<string, any[]> = {}
      allocationsData.forEach((alloc: any) => {
        if (!allocationsByPaymentId[alloc.payment_id]) {
          allocationsByPaymentId[alloc.payment_id] = []
        }
        allocationsByPaymentId[alloc.payment_id].push({
          id: alloc.id,
          payment_id: alloc.payment_id,
          category_id: alloc.category_id,
          category_name: alloc.category_name || "Fee",
          amount: alloc.amount,
          month: alloc.month,
          month_display: alloc.month_display || getMonthName(alloc.month),
          allocation_type: alloc.allocation_type || "regular",
          due_amount: alloc.due_amount || 0,
          status: alloc.status || "paid",
          is_advance: alloc.is_advance || false,
        })
      })

      let processedData = (paymentsData || []).map((payment: any) => ({
        ...payment,
        students: studentMap[payment.student_id] || null,
        payment_allocations: allocationsByPaymentId[payment.id] || [],
      }))

      let filtered = processedData

      if (filterClass !== "all") {
        filtered = filtered.filter((p) => p.students?.class_id === filterClass)
      }
      if (filterSection !== "all") {
        filtered = filtered.filter((p) => p.students?.section_id === filterSection)
      }
      if (searchQuery.trim()) {
        const term = searchQuery.trim().toLowerCase()
        filtered = filtered.filter((p) => {
          const student = p.students
          if (!student) return false
          return (
            student.name?.toLowerCase().includes(term) ||
            student.student_id?.toLowerCase().includes(term) ||
            student.class_roll?.toLowerCase().includes(term) ||
            student.contact?.toLowerCase().includes(term) ||
            p.receipt_no?.toLowerCase().includes(term)
          )
        })
      }

      setPayments(filtered)

      const today = new Date().toDateString()
      let totalCollected = 0
      let todayCollected = 0
      const uniqueStudents = new Set<string>()

      filtered.forEach((p) => {
        totalCollected += p.amount || 0
        if (p.students?.id) uniqueStudents.add(p.students.id)
        const paymentDate = p.payment_date ? new Date(p.payment_date).toDateString() : ""
        if (paymentDate === today) todayCollected += p.amount || 0
      })

      setStats({
        totalPayments: filtered.length,
        totalCollected,
        todayCollected,
        filteredCollected: totalCollected,
        totalTransactions: filtered.length,
        averageCollection: filtered.length > 0 ? totalCollected / filtered.length : 0,
        uniqueStudents: uniqueStudents.size,
      })

    } catch (err) {
      console.error("Load data error:", err)
      setError(err instanceof Error ? err.message : "Failed to load data")
      toast.error("Failed to load data")
    } finally {
      setLoading(false)
    }
  }, [searchQuery, filterClass, filterSection, filterPaymentMethod, dateFrom, dateTo, sortBy])

  const applyDateRange = useCallback((range: typeof dateRange) => {
    const today = new Date()
    let from = ""
    let to = ""

    switch (range) {
      case "today":
        from = format(today, "yyyy-MM-dd")
        to = format(today, "yyyy-MM-dd")
        break
      case "yesterday": {
        const yesterday = subDays(today, 1)
        from = format(yesterday, "yyyy-MM-dd")
        to = format(yesterday, "yyyy-MM-dd")
        break
      }
      case "last7": {
        from = format(subDays(today, 7), "yyyy-MM-dd")
        to = format(today, "yyyy-MM-dd")
        break
      }
      case "last30": {
        from = format(subDays(today, 30), "yyyy-MM-dd")
        to = format(today, "yyyy-MM-dd")
        break
      }
      case "this_month": {
        from = format(startOfMonth(today), "yyyy-MM-dd")
        to = format(endOfMonth(today), "yyyy-MM-dd")
        break
      }
      case "last_month": {
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        from = format(startOfMonth(lastMonth), "yyyy-MM-dd")
        to = format(endOfMonth(lastMonth), "yyyy-MM-dd")
        break
      }
      case "custom":
        return
    }

    setDateRange(range)
    setDateFrom(from)
    setDateTo(to)
    setCurrentPage(1)
  }, [])

  useEffect(() => {
    applyDateRange("last30")
  }, [applyDateRange])

  useEffect(() => {
    if (dateFrom || dateTo) {
      loadData()
    }
  }, [dateFrom, dateTo, loadData])

  const resetFilters = () => {
    setSearchQuery("")
    setFilterClass("all")
    setFilterSection("all")
    setFilterPaymentMethod("all")
    applyDateRange("last30")
    setSortBy("newest")
    setCurrentPage(1)
    toast.info("Filters reset")
  }

  const viewPaymentDetails = (payment: FeePayment) => {
    setSelectedPayment(payment)
    setShowModal(true)
  }

  const handlePrintLedger = useCallback(() => {
    if (!ledgerPrintRef.current) return
    const printWindow = window.open('', '_blank', 'width=1200,height=800')
    if (!printWindow) return

    const content = ledgerPrintRef.current.innerHTML
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Fees Ledger</title>
          <style>
            * { box-sizing: border-box; }
            body { padding: 40px; font-family: system-ui, sans-serif; background: white; color: #0f172a; }
            .print-header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #1e293b; padding-bottom: 20px; }
            .print-header h1 { font-size: 24px; margin: 0; }
            .print-header .school-info { color: #475569; margin: 4px 0; font-size: 13px; }
            .print-header h2 { margin-top: 20px; font-size: 18px; }
            .print-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 20px; }
            .print-table th { background: #f1f5f9; font-weight: 700; text-transform: uppercase; font-size: 10px; padding: 10px 12px; border: 1px solid #cbd5e1; text-align: left; }
            .print-table td { padding: 8px 12px; border: 1px solid #e2e8f0; }
            .print-table .text-right { text-align: right; }
            .print-table .total-row { font-weight: bold; background: #f8fafc; }
          </style>
        </head>
        <body>
          <div class="print-header">
            <h1>${schoolSettings?.school_name || 'School Name'}</h1>
            ${schoolSettings?.school_address ? `<p class="school-info">${schoolSettings.school_address}</p>` : ''}
            <h2>Fees Ledger Report</h2>
            <p class="school-info">Generated: ${format(new Date(), 'dd MMM yyyy, hh:mm a')}</p>
          </div>
          ${content}
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
      printWindow.close()
    }, 1000)
    toast.success('Print job sent')
  }, [schoolSettings])

  // ═══════════════════════════════════════════════════════════════════
  // ✅ PRINT RECEIPT — Auto-close after print
  // ═══════════════════════════════════════════════════════════════════
  const handlePrintReceipt = useCallback(() => {
    if (!selectedPayment) {
      toast.error('No receipt selected')
      return
    }

    try {
      const html = generateA5ReceiptHTML(selectedPayment, schoolSettings)
      const printWindow = window.open('', '_blank', 'width=800,height=1000')

      if (!printWindow) {
        toast.error('Please allow pop-ups')
        return
      }

      printWindow.document.open()
      printWindow.document.write(html)
      printWindow.document.close()
      printWindow.focus()

      // Auto-close after print
      let hasClosed = false
      const closeWindow = () => {
        if (!hasClosed) {
          hasClosed = true
          try {
            printWindow.close()
          } catch {
            // Ignore
          }
        }
      }

      // Listen for afterprint event
      printWindow.addEventListener("afterprint", closeWindow)

      // Trigger print after content is loaded
      setTimeout(() => {
        printWindow.print()
      }, 500)

      // Fallback: close after 3 seconds if afterprint doesn't fire
      setTimeout(closeWindow, 3000)

      toast.success('Opening print dialog...')
    } catch (error) {
      console.error('Print error:', error)
      toast.error('Failed to print receipt')
    }
  }, [selectedPayment, schoolSettings])

  const handleExport = useCallback(async () => {
    try {
      toast.loading("Exporting...")
      const rows = [
        ["Date", "Receipt No.", "Student ID", "Name", "Class", "Section", "Roll", "Contact", "Father", "Method", "Amount", "Categories", "Months", "Types"],
        ...payments.map((p) => {
          const s = p.students
          return [
            p.payment_date ? format(new Date(p.payment_date), "yyyy-MM-dd HH:mm") : "",
            p.receipt_no || "",
            s?.student_id || "",
            s?.name || "",
            s?.class_name || "",
            s?.section_name || "",
            s?.class_roll || "",
            s?.contact || "",
            s?.father_name || "",
            p.payment_method || "",
            (p.amount || 0).toString(),
            p.payment_allocations?.map((a) => a.category_name).filter(Boolean).join("; ") || "",
            p.payment_allocations?.map((a) => a.month_display || getMonthName(a.month)).filter(Boolean).join("; ") || "",
            p.payment_allocations?.map((a) => a.allocation_type).filter(Boolean).join("; ") || "",
          ]
        }),
      ]
      const csv = rows.map((row) => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n")
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `fees-ledger-${format(new Date(), "yyyy-MM-dd")}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`Exported ${payments.length} records`)
    } catch (err) {
      toast.error("Export failed")
    } finally {
      toast.dismiss()
    }
  }, [payments])

  // ============================================================
  // RENDER
  // ============================================================

  if (loading) {
    return (
      <ResponsiveLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </ResponsiveLayout>
    )
  }

  if (error) {
    return (
      <ResponsiveLayout>
        <div className="flex flex-col items-center justify-center h-96 space-y-4">
          <AlertCircle className="h-12 w-12 text-rose-500" />
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={() => loadData()}>
            <RefreshCw className="h-3.5 w-3.5 mr-2" /> Try Again
          </Button>
        </div>
      </ResponsiveLayout>
    )
  }

  return (
    <ResponsiveLayout>
      {/* ═══════════════════════════════════════════════════════════
          ✅ FIX 1: Mobile-এ natural scroll, Desktop-এ screen-fit
          ═══════════════════════════════════════════════════════════ */}
      <div
        className="flex flex-col gap-3 p-3 sm:p-4 max-w-[1400px] mx-auto md:h-[calc(100vh-80px)] md:overflow-hidden"
        id="ledger-content"
      >
        {/* HEADER */}
        <div className="flex-shrink-0 relative overflow-hidden rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-3 sm:p-4 shadow-lg text-white">
          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3">
              <Button
                variant="ghost"
                size="icon"
                asChild
                className="bg-white/20 hover:bg-white/30 text-white h-8 w-8 rounded-lg shrink-0"
              >
                <Link href="/fees"><ArrowLeft className="h-4 w-4" /></Link>
              </Button>
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-bold tracking-tight flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Fees Ledger
                </h1>
                <p className="text-white/80 text-[10px] truncate">
                  {schoolSettings?.school_name || "Payment History"}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Button
                size="sm"
                onClick={handleExport}
                className="bg-white/20 hover:bg-white/30 text-white border-0 h-7 gap-1 text-[10px] rounded-lg px-2.5 sm:px-3"
              >
                <FileSpreadsheet className="h-3 w-3" /> <span className="hidden sm:inline">Export</span>
              </Button>
              <Button
                size="sm"
                onClick={handlePrintLedger}
                className="bg-white/20 hover:bg-white/30 text-white border-0 h-7 gap-1 text-[10px] rounded-lg px-2.5 sm:px-3"
              >
                <Printer className="h-3 w-3" /> <span className="hidden sm:inline">Print</span>
              </Button>
              <Button
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="bg-white/20 hover:bg-white/30 text-white border-0 h-7 gap-1 text-[10px] rounded-lg px-2.5 sm:px-3"
              >
                <Filter className="h-3 w-3" /> <span className="hidden sm:inline">Filters</span>
              </Button>
            </div>
          </div>
        </div>

        {/* ✅ FIX 3: STATS CARDS — Mobile-এ 3-column compact */}
        <div className="flex-shrink-0 grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 sm:gap-2 md:gap-3">
          <StatCard
            title="Total"
            value={formatCurrency(stats.totalCollected)}
            icon={DollarSign}
            gradient="bg-gradient-to-br from-emerald-500 to-teal-600"
            iconBg="bg-white/20"
          />
          <StatCard
            title="Today"
            value={formatCurrency(stats.todayCollected)}
            icon={TrendingUp}
            gradient="bg-gradient-to-br from-blue-500 to-cyan-600"
            iconBg="bg-white/20"
          />
          <StatCard
            title="Filtered"
            value={formatCurrency(stats.filteredCollected)}
            icon={Filter}
            gradient="bg-gradient-to-br from-indigo-500 to-purple-600"
            iconBg="bg-white/20"
          />
          <StatCard
            title="Count"
            value={stats.totalTransactions}
            icon={FileText}
            gradient="bg-gradient-to-br from-slate-600 to-slate-800"
            iconBg="bg-white/20"
          />
          <StatCard
            title="Average"
            value={formatCurrency(stats.averageCollection)}
            icon={Wallet}
            gradient="bg-gradient-to-br from-amber-500 to-orange-600"
            iconBg="bg-white/20"
          />
          <StatCard
            title="Students"
            value={stats.uniqueStudents}
            icon={Users}
            gradient="bg-gradient-to-br from-pink-500 to-rose-600"
            iconBg="bg-white/20"
          />
        </div>

        {/* FILTER PANEL (collapsible) — with Date Range */}
        {showFilters && (
          <div className="flex-shrink-0 bg-white dark:bg-slate-900 rounded-xl border shadow-sm p-3 space-y-2">
            {filterChips.length > 0 && (
              <div className="flex flex-wrap gap-1 pb-2 border-b border-border">
                {filterChips.map((chip) => (
                  <FilterChip
                    key={chip.id}
                    label={chip.label}
                    onRemove={() => {
                      if (chip.id === "class") { setFilterClass("all"); setFilterSection("all") }
                      if (chip.id === "section") setFilterSection("all")
                      if (chip.id === "method") setFilterPaymentMethod("all")
                      if (chip.id === "search") setSearchQuery("")
                      setCurrentPage(1)
                    }}
                  />
                ))}
                <button
                  onClick={resetFilters}
                  className="text-[10px] font-medium text-muted-foreground hover:text-rose-500 ml-1 px-1.5"
                >
                  Clear all
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {/* Search */}
              <div className="relative col-span-2">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1) }}
                  className="pl-8 h-8 text-xs rounded-md"
                />
              </div>

              {/* Class */}
              <Select value={filterClass} onValueChange={(v) => { setFilterClass(v); setFilterSection("all"); setCurrentPage(1) }}>
                <SelectTrigger className="h-8 text-xs rounded-md"><SelectValue placeholder="Class" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Classes</SelectItem>
                  {classes.map((c) => <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>)}
                </SelectContent>
              </Select>

              {/* Section */}
              <Select value={filterSection} onValueChange={(v) => { setFilterSection(v); setCurrentPage(1) }}>
                <SelectTrigger className="h-8 text-xs rounded-md"><SelectValue placeholder="Section" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Sections</SelectItem>
                  {filteredSections.map((s) => <SelectItem key={s.id} value={s.id} className="text-xs">{s.name}</SelectItem>)}
                </SelectContent>
              </Select>

              {/* Payment Method */}
              <Select value={filterPaymentMethod} onValueChange={(v) => { setFilterPaymentMethod(v); setCurrentPage(1) }}>
                <SelectTrigger className="h-8 text-xs rounded-md"><SelectValue placeholder="Method" /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>)}
                </SelectContent>
              </Select>

              {/* Date Range */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5 rounded-md px-2.5 font-medium justify-start"
                  >
                    <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">
                      {getDateRangeLabel(dateRange, dateFrom, dateTo)}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-3 bg-white dark:bg-slate-950 border shadow-lg rounded-lg" align="end">
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-foreground">Date Range</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {["today", "yesterday", "last7", "last30", "this_month", "last_month"].map((range) => (
                        <Button
                          key={range}
                          variant={dateRange === range ? "default" : "ghost"}
                          size="sm"
                          className="h-7 text-[10px] rounded-md font-medium capitalize"
                          onClick={() => applyDateRange(range as any)}
                        >
                          {range === "this_month" ? "This Month" : range === "last_month" ? "Last Month" : range}
                        </Button>
                      ))}
                      <Button
                        variant={dateRange === "custom" ? "default" : "ghost"}
                        size="sm"
                        className="h-7 text-[10px] rounded-md font-medium"
                        onClick={() => setDateRange("custom")}
                      >
                        Custom
                      </Button>
                    </div>
                    {dateRange === "custom" && (
                      <div className="space-y-2 pt-2 border-t border-border">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] font-medium text-muted-foreground block mb-0.5">From</label>
                            <Input
                              type="date"
                              value={dateFrom}
                              onChange={(e) => {
                                setDateFrom(e.target.value)
                                setCurrentPage(1)
                              }}
                              className="h-8 text-xs rounded-md"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-medium text-muted-foreground block mb-0.5">To</label>
                            <Input
                              type="date"
                              value={dateTo}
                              onChange={(e) => {
                                setDateTo(e.target.value)
                                setCurrentPage(1)
                              }}
                              className="h-8 text-xs rounded-md"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Sort */}
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                <SelectTrigger className="h-8 text-xs rounded-md"><SelectValue placeholder="Sort" /></SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* ✅ FIX 2: TABLE CONTAINER — Mobile-এ natural height, Desktop-এ flex-fill */}
        <div className="rounded-xl border shadow-sm bg-white dark:bg-slate-900 overflow-hidden flex flex-col md:flex-1 md:min-h-0">
          {/* Table Header Summary */}
          <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b bg-slate-50 dark:bg-slate-800/50">
            <div className="text-[10px] text-muted-foreground">
              Showing <strong className="text-foreground">{displayedPayments.length}</strong> of{" "}
              <strong className="text-foreground">{totalCount}</strong> •{" "}
              Total: <strong className="text-emerald-600">{formatCurrency(stats.filteredCollected)}</strong>
            </div>
            <div className="text-[10px] text-muted-foreground">
              Page <strong className="text-foreground">{currentPage}</strong> of{" "}
              <strong className="text-foreground">{totalPages || 1}</strong>
            </div>
          </div>

          {/* Scrollable Table Body */}
          <div className="flex-1 min-h-0 overflow-auto">
            <Table>
              <TableHeader className="bg-slate-100 dark:bg-slate-800 sticky top-0 z-10">
                <TableRow className="text-[9px] font-bold uppercase">
                  <TableHead className="px-3 py-2 text-left min-w-[180px]">Student</TableHead>
                  <TableHead className="px-3 py-2 text-left min-w-[100px] hidden sm:table-cell">Receipt</TableHead>
                  <TableHead className="px-3 py-2 text-left min-w-[120px] hidden md:table-cell">Description</TableHead>
                  <TableHead className="px-3 py-2 text-right min-w-[90px]">Amount</TableHead>
                  <TableHead className="px-3 py-2 text-right min-w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                      <Receipt className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No payments found</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  displayedPayments.map((p) => {
                    const status = getStatusBadge(p.payment_allocations)
                    const StatusIcon = status.icon
                    return (
                      <TableRow
                        key={p.id}
                        className="border-b hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                        onClick={() => viewPaymentDetails(p)}
                      >
                        <TableCell className="px-3 py-2">
                          <StudentCell student={p.students} />
                          <div className="sm:hidden mt-1 text-[9px] text-muted-foreground">
                            <span className="font-mono text-primary">{p.receipt_no}</span>
                            <span className="mx-1">•</span>
                            <span>{formatDate(p.payment_date)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="px-3 py-2 hidden sm:table-cell">
                          <p className="font-mono text-[10px] font-semibold text-primary">{p.receipt_no}</p>
                          <p className="text-[9px] text-muted-foreground">{formatDate(p.payment_date)}</p>
                          <Badge className={cn(status.color, "text-[7px] px-1.5 py-0 mt-0.5 inline-flex items-center gap-0.5")}>
                            <StatusIcon className="h-2.5 w-2.5" />
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-3 py-2 hidden md:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {p.payment_allocations?.slice(0, 3).map((a, i) => (
                              <Badge key={i} className={cn(getCategoryColor(a.category_name || ""), "text-[8px] px-1.5 py-0 border-0 rounded-full")}>
                                {a.category_name || "Fee"}
                              </Badge>
                            ))}
                            {(p.payment_allocations?.length || 0) > 3 && (
                              <Badge variant="outline" className="text-[8px] px-1 py-0 rounded-full">
                                +{(p.payment_allocations?.length || 0) - 3}
                              </Badge>
                            )}
                          </div>
                          {p.payment_method && <div className="mt-1"><PaymentMethodBadge method={p.payment_method} size="sm" /></div>}
                        </TableCell>
                        <TableCell className="px-3 py-2 text-right">
                          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(p.amount)}
                          </p>
                        </TableCell>
                        <TableCell className="px-3 py-2 text-right">
                          <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => viewPaymentDetails(p)}
                              className="h-7 w-7 p-0 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md"
                              title="View"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedPayment(p)
                                setTimeout(() => handlePrintReceipt(), 200)
                              }}
                              className="h-7 w-7 p-0 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
                              title="Print"
                            >
                              <Printer className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* BOTTOM NAVIGATION BAR — Single row */}
          <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-t bg-slate-50 dark:bg-slate-900/50 gap-2">
            {/* Left: rows per page + record range */}
            <div className="flex items-center gap-2">
              <Select value={limit.toString()} onValueChange={(v) => { setLimit(parseInt(v)); setCurrentPage(1) }}>
                <SelectTrigger className="h-7 w-[70px] text-xs rounded-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROWS_PER_PAGE_OPTIONS.map((n) => (
                    <SelectItem key={n} value={n.toString()} className="text-xs">{n} / page</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                {startRecord}–{endRecord} of {totalCount}
              </span>
            </div>

            {/* Right: pagination */}
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="h-7 w-7 p-0 text-xs rounded-md"
                title="First"
              >
                <ChevronLeft className="h-3 w-3" /><ChevronLeft className="h-3 w-3 -ml-2" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="h-7 px-2 text-xs rounded-md"
              >
                <ChevronLeft className="h-3 w-3 mr-0.5" /> Prev
              </Button>
              <Badge variant="outline" className="h-7 px-3 text-xs rounded-md bg-white dark:bg-slate-900">
                {currentPage} / {totalPages || 1}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="h-7 px-2 text-xs rounded-md"
              >
                Next <ChevronRight className="h-3 w-3 ml-0.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages || totalPages === 0}
                className="h-7 w-7 p-0 text-xs rounded-md"
                title="Last"
              >
                <ChevronRight className="h-3 w-3" /><ChevronRight className="h-3 w-3 -ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* PAYMENT DETAILS MODAL */}
      <PaymentDetailsModal
        open={showModal}
        onOpenChange={setShowModal}
        payment={selectedPayment}
        onPrintReceipt={() => {
          setShowModal(false)
          setTimeout(() => handlePrintReceipt(), 200)
        }}
        onExport={handleExport}
      />

      {/* LEDGER PRINT LAYOUT (hidden, for print) */}
      <div className="hidden">
        <div ref={ledgerPrintRef}>
          <table className="print-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Date</th>
                <th>Receipt No</th>
                <th>Student</th>
                <th>Class</th>
                <th>Roll</th>
                <th>Method</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment, index) => (
                <tr key={payment.id}>
                  <td>{index + 1}</td>
                  <td>{formatDate(payment.payment_date)}</td>
                  <td><strong>{payment.receipt_no}</strong></td>
                  <td><strong>{payment.students?.name || 'N/A'}</strong></td>
                  <td>{payment.students?.class_name || 'N/A'}</td>
                  <td>{payment.students?.class_roll || 'N/A'}</td>
                  <td>{payment.payment_method || 'Cash'}</td>
                  <td className="text-right"><strong>{formatCurrency(payment.amount)}</strong></td>
                </tr>
              ))}
              <tr className="total-row">
                <td colSpan={7} className="text-right"><strong>TOTAL</strong></td>
                <td className="text-right"><strong>{formatCurrency(stats.totalCollected)}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </ResponsiveLayout>
  )
}