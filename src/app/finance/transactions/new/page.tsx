// src/app/finance/transactions/new/page.tsx
"use client"

import { useState, useEffect, useMemo } from "react"
import { Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  Save,
  Loader2,
  Trash2,
  Plus,
  FileText,
  Tag,
  User,
  Calendar,
  BookOpen,
  Info,
  Landmark,
  Wallet,
  Building2,
  AlertCircle,
  TrendingUp,
  DollarSign,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { formatCurrency, cn } from "@/lib/utils"
import { ResponsiveLayout } from "@/components/layout/responsive-layout"

const supabase = createClient()

type VoucherType = "receipt" | "payment" | "journal" | "transfer"

interface FinancialAccount {
  id: string
  account_name: string
  type: string
  account_category: string
  current_balance?: number
}

interface SchoolSettings {
  id: number
  school_name: string | null
  school_address: string | null
  school_phone: string | null
  school_email: string | null
  school_logo: string | null
}

const CATEGORY_META: Record<
  string,
  { label: string; group: string; color: string; icon: any }
> = {
  asset: { label: "Cash & Bank", group: "asset", color: "text-blue-600 dark:text-blue-400", icon: Wallet },
  current_asset: { label: "Current Assets", group: "asset", color: "text-sky-600 dark:text-sky-400", icon: TrendingUp },
  fixed_asset: { label: "Fixed Assets", group: "asset", color: "text-indigo-600 dark:text-indigo-400", icon: Building2 },
  liability: { label: "Other Liabilities", group: "liability", color: "text-amber-600 dark:text-amber-400", icon: AlertCircle },
  payable: { label: "Accounts Payable", group: "liability", color: "text-orange-600 dark:text-orange-400", icon: AlertCircle },
  loan: { label: "Loans", group: "liability", color: "text-rose-600 dark:text-rose-400", icon: Landmark },
  equity: { label: "Retained Earnings", group: "equity", color: "text-purple-600 dark:text-purple-400", icon: DollarSign },
  capital: { label: "Capital", group: "equity", color: "text-violet-600 dark:text-violet-400", icon: DollarSign },
  drawing: { label: "Drawings", group: "equity", color: "text-fuchsia-600 dark:text-fuchsia-400", icon: DollarSign },
}

const ALLOWED_CATEGORIES = [
  { value: "asset", label: "Cash & Bank (Asset)" },
  { value: "current_asset", label: "Current Asset" },
  { value: "fixed_asset", label: "Fixed Asset" },
  { value: "payable", label: "Accounts Payable" },
  { value: "loan", label: "Loan" },
  { value: "liability", label: "Other Liability" },
  { value: "capital", label: "Owner Capital" },
  { value: "drawing", label: "Owner Drawings" },
  { value: "equity", label: "Retained Earnings" },
]

// ═══════════════════════════════════════════════════════════════════════
// Helper: pure cash/bank account?
// ═══════════════════════════════════════════════════════════════════════
function isCashBankAccount(acc: FinancialAccount): boolean {
  return (
    acc.account_category === "asset" &&
    (acc.type === "cash" || acc.type === "bank" || acc.type === "mobile_bank")
  )
}

function NewVoucherContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [voucherType, setVoucherType] = useState<VoucherType>("receipt")
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().split("T")[0])
  const [financialAccountId, setFinancialAccountId] = useState<string>("")
  const [paidToReceivedFrom, setPaidToReceivedFrom] = useState("")
  const [referenceNo, setReferenceNo] = useState("")
  const [narration, setNarration] = useState("")
  const [schoolInfo, setSchoolInfo] = useState<SchoolSettings | null>(null)

  const getDefaultEntries = (type: VoucherType) => {
    if (type === "receipt" || type === "payment" || type === "transfer") {
      return [{ account_id: "", debit: null, credit: null, description: "" }]
    }
    return [
      { account_id: "", debit: null, credit: null, description: "" },
      { account_id: "", debit: null, credit: null, description: "" },
    ]
  }

  const [entries, setEntries] = useState<
    Array<{ account_id: string; debit: number | null; credit: number | null; description?: string }>
  >(getDefaultEntries("receipt"))
  const [accounts, setAccounts] = useState<FinancialAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [addAccountOpen, setAddAccountOpen] = useState(false)
  const [addingAccount, setAddingAccount] = useState(false)
  const [newAccount, setNewAccount] = useState({
    account_name: "",
    account_category: "fixed_asset",
    opening_balance: "",
  })

  useEffect(() => {
    const type = (searchParams.get("type") || "receipt") as VoucherType
    setVoucherType(type)
    setEntries(getDefaultEntries(type))
  }, [searchParams])

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setEntries(getDefaultEntries(voucherType))
    if (voucherType === "journal") setFinancialAccountId("")
  }, [voucherType])

  const loadData = async () => {
    setLoading(true)
    try {
      const [accountsRes, schoolRes] = await Promise.all([
        supabase
          .from("financial_accounts")
          .select("id, account_name, type, account_category, current_balance")
          .eq("is_active", true)
          .order("account_category")
          .order("account_name"),
        supabase.from("school_settings").select("*").limit(1).maybeSingle(),
      ])

      if (accountsRes.error) throw accountsRes.error

      setAccounts(accountsRes.data || [])
      if (schoolRes.data) setSchoolInfo(schoolRes.data)
    } catch (error) {
      console.error("Error loading data:", error)
      toast.error("Failed to load data")
    } finally {
      setLoading(false)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // FILTERED LISTS
  // ═══════════════════════════════════════════════════════════════════════
  const cashBankAccounts = useMemo(() => {
    return accounts.filter(isCashBankAccount)
  }, [accounts])

  const journalAccountGroups = useMemo(() => {
    const eligible = accounts.filter((a) => {
      // Journal: show everything (user needs full flexibility)
      if (voucherType === "journal") return true
      // Receipt/Payment/Transfer: hide cash/bank from row (they go in Cash/Bank dropdown)
      return !isCashBankAccount(a)
    })

    const map = new Map<string, FinancialAccount[]>()
    eligible.forEach((acc) => {
      const cat = acc.account_category || "asset"
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(acc)
    })
    return Array.from(map.entries()).sort(([a], [b]) => {
      const groupOrder: Record<string, number> = { asset: 1, liability: 2, equity: 3 }
      const orderA = groupOrder[CATEGORY_META[a]?.group] || 99
      const orderB = groupOrder[CATEGORY_META[b]?.group] || 99
      return orderA - orderB
    })
  }, [accounts, voucherType])

  // ─────────────────────────────────────────────────────────────────
  const addEntry = () => {
    setEntries([...entries, { account_id: "", debit: null, credit: null, description: "" }])
  }

  const removeEntry = (index: number) => {
    if (entries.length > 1) {
      setEntries(entries.filter((_, i) => i !== index))
    }
  }

  const updateEntry = (index: number, field: string, value: any) => {
    const newEntries = [...entries]
    newEntries[index] = { ...newEntries[index], [field]: value }

    if (voucherType === "receipt" && field === "credit") {
      newEntries[index].debit = null
    } else if (voucherType === "payment" && field === "debit") {
      newEntries[index].credit = null
    } else if (voucherType === "transfer") {
      if (field === "debit") newEntries[index].credit = null
      if (field === "credit") newEntries[index].debit = null
    }

    setEntries(newEntries)
  }

  const handleNumberInput = (value: string, index: number, field: "debit" | "credit") => {
    const bengaliToEnglish: Record<string, string> = {
      "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4",
      "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9",
    }

    let cleanValue = value
    for (const [bengali, english] of Object.entries(bengaliToEnglish)) {
      cleanValue = cleanValue.replace(new RegExp(bengali, "g"), english)
    }
    cleanValue = cleanValue.replace(/[^0-9.]/g, "")
    const parts = cleanValue.split(".")
    if (parts.length > 2) {
      cleanValue = parts[0] + "." + parts.slice(1).join("")
    }
    const numValue = parseFloat(cleanValue) || null
    updateEntry(index, field, numValue)
  }

  const isDebitDisabled = (): boolean => voucherType === "receipt"
  const isCreditDisabled = (): boolean => voucherType === "payment"

  const totalDebit = entries.reduce((sum, e) => sum + (Number(e.debit) || 0), 0)
  const totalCredit = entries.reduce((sum, e) => sum + (Number(e.credit) || 0), 0)

  const isAutoBalanced = () => {
    if (voucherType === "journal") {
      return Math.abs(totalDebit - totalCredit) < 0.01
    }
    if (entries.length === 1) {
      const entry = entries[0]
      const hasDebit = entry.debit && entry.debit > 0
      const hasCredit = entry.credit && entry.credit > 0
      if (hasDebit || hasCredit) return true
    }
    return Math.abs(totalDebit - totalCredit) < 0.01
  }

  const isBalanced = isAutoBalanced()

  // ═══════════════════════════════════════════════════════════════════════
  // VALIDATION
  // ═══════════════════════════════════════════════════════════════════════
  const validateEntries = (): boolean => {
    if (
      (voucherType === "receipt" || voucherType === "payment" || voucherType === "transfer") &&
      !financialAccountId
    ) {
      toast.error("Please select a Bank/Cash account")
      return false
    }

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]
      if (!entry.account_id) {
        toast.error(`Row #${i + 1}: Please select an account`)
        return false
      }
      const hasDebit = entry.debit && entry.debit > 0
      const hasCredit = entry.credit && entry.credit > 0
      if (!hasDebit && !hasCredit) {
        toast.error(`Row #${i + 1}: Please enter amount`)
        return false
      }
    }

    if (
      (voucherType === "receipt" || voucherType === "payment" || voucherType === "transfer") &&
      entries.length === 1
    ) {
      if (entries[0].account_id === financialAccountId) {
        toast.error(
          "❌ Bank/Cash Account এবং Row Account একই হতে পারে না! আলাদা account select করুন।"
        )
        return false
      }
    }

    return true
  }

  // ─────────────────────────────────────────────────────────────────
  const handleAddAccount = async () => {
    if (!newAccount.account_name.trim()) {
      toast.error("Account name is required")
      return
    }

    setAddingAccount(true)
    try {
      const { data, error } = await supabase.rpc("create_balance_sheet_account", {
        p_account_name: newAccount.account_name.trim(),
        p_account_category: newAccount.account_category,
        p_opening_balance: parseFloat(newAccount.opening_balance) || 0,
        p_account_number: null,
        p_bank_name: null,
        p_branch_name: null,
      })

      if (error) throw error

      const result = data as any
      if (!result?.success) {
        throw new Error(result?.error || "Failed to create account")
      }

      toast.success(`Account "${newAccount.account_name}" created ✅`)

      const { data: freshAccounts } = await supabase
        .from("financial_accounts")
        .select("id, account_name, type, account_category, current_balance")
        .eq("is_active", true)
        .order("account_category")
        .order("account_name")

      setAccounts(freshAccounts || [])

      if (result.id) {
        const emptyIdx = entries.findIndex((e) => !e.account_id)
        if (emptyIdx >= 0) {
          const newEntries = [...entries]
          newEntries[emptyIdx].account_id = result.id
          setEntries(newEntries)
        }
      }

      setAddAccountOpen(false)
      setNewAccount({ account_name: "", account_category: "fixed_asset", opening_balance: "" })
    } catch (error: any) {
      console.error("Error adding account:", error)
      toast.error(error?.message || "Failed to add account")
    } finally {
      setAddingAccount(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!paidToReceivedFrom || paidToReceivedFrom.trim() === "") {
      toast.error("Please enter party name")
      return
    }
    if (!validateEntries()) return
    if (voucherType === "journal" && !isBalanced) {
      toast.error("Journal entries must be balanced (Debit = Credit)")
      return
    }

    setSubmitting(true)
    try {
      const voucherNo = `VCH-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}${Math.floor(
        Math.random() * 10000
      )
        .toString()
        .padStart(4, "0")}`
      const maxAmount = Math.max(totalDebit, totalCredit)

      const { data: voucherData, error: voucherError } = await supabase
        .from("vouchers")
        .insert([
          {
            voucher_no: voucherNo,
            voucher_type: voucherType,
            voucher_date: voucherDate,
            financial_account_id: financialAccountId || null,
            total_amount: maxAmount || 0,
            paid_to_received_from: paidToReceivedFrom.trim(),
            reference_no: referenceNo || null,
            narration: narration || null,
          },
        ])
        .select()
        .single()

      if (voucherError) throw voucherError

      const voucherId = voucherData.id
      let journalEntriesToInsert: any[] = []

      if (
        (voucherType === "receipt" || voucherType === "payment" || voucherType === "transfer") &&
        entries.length === 1
      ) {
        const userEntry = entries[0]
        const cashAccountId = financialAccountId || null

        if (voucherType === "receipt") {
          journalEntriesToInsert.push({
            voucher_id: voucherId,
            account_id: cashAccountId,
            debit: userEntry.credit || 0,
            credit: null,
            description: "Cash received",
          })
          journalEntriesToInsert.push({
            voucher_id: voucherId,
            account_id: userEntry.account_id,
            debit: null,
            credit: userEntry.credit || 0,
            description: userEntry.description || null,
          })
        } else if (voucherType === "payment") {
          journalEntriesToInsert.push({
            voucher_id: voucherId,
            account_id: userEntry.account_id,
            debit: userEntry.debit || 0,
            credit: null,
            description: userEntry.description || null,
          })
          journalEntriesToInsert.push({
            voucher_id: voucherId,
            account_id: cashAccountId,
            debit: null,
            credit: userEntry.debit || 0,
            description: "Cash payment",
          })
        } else if (voucherType === "transfer") {
          if (userEntry.debit && userEntry.debit > 0) {
            journalEntriesToInsert.push({
              voucher_id: voucherId,
              account_id: userEntry.account_id,
              debit: userEntry.debit || 0,
              credit: null,
              description: userEntry.description || null,
            })
            journalEntriesToInsert.push({
              voucher_id: voucherId,
              account_id: cashAccountId,
              debit: null,
              credit: userEntry.debit || 0,
              description: "Transferred to cash",
            })
          } else if (userEntry.credit && userEntry.credit > 0) {
            journalEntriesToInsert.push({
              voucher_id: voucherId,
              account_id: cashAccountId,
              debit: userEntry.credit || 0,
              credit: null,
              description: "Transferred from cash",
            })
            journalEntriesToInsert.push({
              voucher_id: voucherId,
              account_id: userEntry.account_id,
              debit: null,
              credit: userEntry.credit || 0,
              description: userEntry.description || null,
            })
          }
        }
      } else {
        journalEntriesToInsert = entries.map((entry) => ({
          voucher_id: voucherId,
          account_id: entry.account_id,
          debit: entry.debit && entry.debit > 0 ? entry.debit : null,
          credit: entry.credit && entry.credit > 0 ? entry.credit : null,
          description: entry.description || null,
        }))
      }

      const entryPromises = journalEntriesToInsert
        .filter((e) => e.account_id)
        .map((entry) => supabase.from("journal_entries").insert([entry]))

      await Promise.all(entryPromises)

      // ═══════════════════════════════════════════════════════════
      // Sync to finance_transactions
      // ═══════════════════════════════════════════════════════════
      const { error: syncError } = await supabase.rpc("sync_voucher_to_finance", {
        p_voucher_id: voucherId,
      })

      if (syncError) {
        console.error("Sync failed:", syncError)
        toast.warning(
          "Voucher saved, কিন্তু Balance Sheet-এ sync হয়নি। Admin-কে জানান।",
          { duration: 5000 }
        )
      }

      // ═══════════════════════════════════════════════════════════
      // Force recalc account balances (Cash/Bank)
      // ═══════════════════════════════════════════════════════════
      try {
        // Recalc for all touched accounts
        const accountIdsToRecalc = new Set<string>()
        journalEntriesToInsert.forEach((e) => {
          if (e.account_id) accountIdsToRecalc.add(e.account_id)
        })

        for (const accId of accountIdsToRecalc) {
          await supabase.rpc("fn_recalc_account_balance", { p_account_id: accId })
        }
      } catch (recalcErr) {
        console.warn("Recalc warning:", recalcErr)
      }

      toast.success("Voucher created & synced ✅")
      router.push("/finance/transactions")
    } catch (error: any) {
      console.error("Error creating voucher:", error)
      toast.error(error?.message || "Failed to create voucher")
    } finally {
      setSubmitting(false)
    }
  }

  const voucherTypeConfig: Record<
    VoucherType,
    { title: string; description: string; color: string; border: string; bg: string }
  > = {
    receipt: {
      title: "Receipt Voucher",
      description: "Record money received",
      color: "text-emerald-600 dark:text-emerald-400",
      border: "border-emerald-200 dark:border-emerald-900/60",
      bg: "bg-emerald-50/70 dark:bg-emerald-950/40",
    },
    payment: {
      title: "Payment Voucher",
      description: "Record money paid",
      color: "text-rose-600 dark:text-rose-400",
      border: "border-rose-200 dark:border-rose-900/60",
      bg: "bg-rose-50/70 dark:bg-rose-950/40",
    },
    journal: {
      title: "Journal Entry",
      description: "Record adjusting entries",
      color: "text-amber-600 dark:text-amber-400",
      border: "border-amber-200 dark:border-amber-900/60",
      bg: "bg-amber-50/70 dark:bg-amber-950/40",
    },
    transfer: {
      title: "Transfer Voucher",
      description: "Record transfers between accounts",
      color: "text-blue-600 dark:text-blue-400",
      border: "border-blue-200 dark:border-blue-900/60",
      bg: "bg-blue-50/70 dark:bg-blue-950/40",
    },
  }

  const numberToWords = (num: number): string => {
    if (num === 0) return "Zero"
    const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"]
    const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]
    const numToWords = (n: number): string => {
      if (n < 20) return ones[n]
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "")
      if (n < 1000) return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + numToWords(n % 100) : "")
      if (n < 1000000) return numToWords(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + numToWords(n % 1000) : "")
      return numToWords(Math.floor(n / 1000000)) + " Million" + (n % 1000000 ? " " + numToWords(n % 1000000) : "")
    }
    const whole = Math.floor(num)
    const decimal = Math.round((num - whole) * 100)
    let result = numToWords(whole)
    if (decimal > 0) result += " Point " + numToWords(decimal)
    return result
  }

  if (loading) {
    return (
      <ResponsiveLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </ResponsiveLayout>
    )
  }

  const config = voucherTypeConfig[voucherType]

  return (
    <ResponsiveLayout>
      <div className="flex flex-col h-full lg:h-[calc(100vh-4rem)] p-3 sm:p-5 max-w-7xl mx-auto space-y-3 bg-slate-50/50 dark:bg-transparent overflow-hidden">
        {/* HEADER */}
        <div className="flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.back()}
              className="h-9 px-3 text-sm font-semibold bg-white dark:bg-slate-900"
            >
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Back
            </Button>
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-xl ${config.bg} ${config.color} shrink-0`}>
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white leading-tight truncate">
                  New {config.title}
                </h1>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate hidden sm:block">
                  {config.description}
                </p>
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAddAccountOpen(true)}
            className="h-9 text-sm font-semibold px-3 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 shrink-0"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add Account
          </Button>
        </div>

        {/* FORM GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 flex-1 min-h-0 items-stretch">
          {/* LEFT: Voucher Details */}
          <Card className={`border ${config.border} bg-white dark:bg-slate-900 shadow-sm rounded-xl overflow-hidden flex flex-col min-h-0`}>
            <CardHeader className={`${config.bg} border-b ${config.border} py-2.5 px-4 shrink-0`}>
              <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
                <Info className="h-4 w-4" />
                Voucher Details
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3.5 sm:p-4 space-y-3 flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5 text-blue-500" /> Voucher Type
                  </Label>
                  <Select value={voucherType} onValueChange={(v) => setVoucherType(v as VoucherType)}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="receipt" className="text-sm">Receipt</SelectItem>
                      <SelectItem value="payment" className="text-sm">Payment</SelectItem>
                      <SelectItem value="journal" className="text-sm">Journal Entry</SelectItem>
                      <SelectItem value="transfer" className="text-sm">Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-purple-500" /> Voucher Date
                  </Label>
                  <Input
                    type="date"
                    value={voucherDate}
                    onChange={(e) => setVoucherDate(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              {(voucherType === "receipt" || voucherType === "payment" || voucherType === "transfer") && (
                <div className="space-y-1">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Landmark className="h-3.5 w-3.5 text-indigo-500" /> Bank/Cash Account *
                  </Label>
                  <Select value={financialAccountId} onValueChange={setFinancialAccountId}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Select Bank or Cash" />
                    </SelectTrigger>
                    <SelectContent>
                      {cashBankAccounts.length === 0 ? (
                        <SelectItem value="__none" disabled className="text-xs">
                          No cash/bank accounts found
                        </SelectItem>
                      ) : (
                        cashBankAccounts.map((account) => (
                          <SelectItem key={account.id} value={account.id} className="text-sm">
                            {account.account_name} ({account.type}) — {formatCurrency(Number(account.current_balance || 0))}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-slate-500">
                    শুধু cash/bank/mobile banking এখানে select করা যাবে
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-indigo-500" /> Party Name
                  </Label>
                  <Input
                    value={paidToReceivedFrom}
                    onChange={(e) => setPaidToReceivedFrom(e.target.value)}
                    placeholder="Student, Supplier, etc."
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-amber-500" /> Reference No
                  </Label>
                  <Input
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                    placeholder="Invoice / Cheque no"
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Narration</Label>
                <Textarea
                  value={narration}
                  onChange={(e) => setNarration(e.target.value)}
                  placeholder="Brief description..."
                  rows={2}
                  className="text-sm resize-none"
                />
              </div>
            </CardContent>
          </Card>

          {/* RIGHT: Journal Entries */}
          <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-xl overflow-hidden flex flex-col min-h-0">
            <CardHeader className="bg-slate-50/80 dark:bg-slate-800/40 border-b py-2.5 px-4 shrink-0">
              <div className="flex justify-between items-center">
                <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-emerald-500" />
                  Journal Entries
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addEntry}
                  className="h-8 text-xs font-semibold px-2.5"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Row
                </Button>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 mt-1.5 text-xs sm:text-sm font-semibold pt-1.5 border-t">
                <span className="text-slate-600 dark:text-slate-400">
                  Debit: <strong className="text-emerald-600 font-mono text-sm">{formatCurrency(totalDebit)}</strong>
                </span>
                <span className="text-slate-600 dark:text-slate-400">
                  Credit: <strong className="text-rose-600 font-mono text-sm">{formatCurrency(totalCredit)}</strong>
                </span>
                <span className={isBalanced ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>
                  {isBalanced ? "✓ Balanced" : "✗ Unbalanced"}
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-y-auto">
              <div className="divide-y">
                {entries.map((entry, index) => (
                  <div key={index} className="p-3 space-y-2 hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                    <div className="flex justify-between items-center">
                      <span className="text-xs sm:text-sm font-bold">
                        Row #{index + 1}
                      </span>
                      {entries.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeEntry(index)}
                          className="text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 h-7 px-2"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">
                        Account
                        {(voucherType === "receipt" || voucherType === "payment" || voucherType === "transfer") && (
                          <span className="text-[10px] text-slate-500 ml-1">
                            (cash/bank dropdown-এ select করা account এখানে আসবে না)
                          </span>
                        )}
                      </Label>
                      <Select
                        value={entry.account_id}
                        onValueChange={(v) => updateEntry(index, "account_id", v)}
                      >
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="Select account" />
                        </SelectTrigger>
                        <SelectContent className="max-h-80">
                          {journalAccountGroups.length === 0 ? (
                            <SelectItem value="__empty" disabled className="text-xs">
                              No accounts available — click "Add Account"
                            </SelectItem>
                          ) : (
                            journalAccountGroups.map(([category, categoryAccounts]) => {
                              const meta = CATEGORY_META[category] || CATEGORY_META.asset
                              return (
                                <div key={category}>
                                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide bg-slate-50 dark:bg-slate-800">
                                    {meta.label}
                                  </div>
                                  {categoryAccounts.map((account) => (
                                    <SelectItem
                                      key={account.id}
                                      value={account.id}
                                      className="text-sm pl-4"
                                    >
                                      {account.account_name}
                                      {account.current_balance !== undefined && (
                                        <span className="text-xs text-muted-foreground ml-2">
                                          (৳{Number(account.current_balance || 0).toFixed(2)})
                                        </span>
                                      )}
                                    </SelectItem>
                                  ))}
                                </div>
                              )
                            })
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <Label className={`text-xs font-bold ${voucherType === "receipt" ? "text-slate-400" : "text-emerald-600"}`}>
                          Debit {voucherType === "receipt" && "(N/A)"}
                        </Label>
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={entry.debit || ""}
                          onChange={(e) => handleNumberInput(e.target.value, index, "debit")}
                          placeholder={voucherType === "receipt" ? "Disabled" : "0.00"}
                          disabled={isDebitDisabled()}
                          className={`h-9 text-sm font-mono ${isDebitDisabled() ? "bg-slate-100 dark:bg-slate-800/60 opacity-60" : ""}`}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className={`text-xs font-bold ${voucherType === "payment" ? "text-slate-400" : "text-rose-600"}`}>
                          Credit {voucherType === "payment" && "(N/A)"}
                        </Label>
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={entry.credit || ""}
                          onChange={(e) => handleNumberInput(e.target.value, index, "credit")}
                          placeholder={voucherType === "payment" ? "Disabled" : "0.00"}
                          disabled={isCreditDisabled()}
                          className={`h-9 text-sm font-mono ${isCreditDisabled() ? "bg-slate-100 dark:bg-slate-800/60 opacity-60" : ""}`}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Description</Label>
                      <Input
                        value={entry.description || ""}
                        onChange={(e) => updateEntry(index, "description", e.target.value)}
                        placeholder="Row detail"
                        className="h-9 text-sm"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ACTION BAR */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-2.5 p-3 rounded-xl bg-white dark:bg-slate-900 border shrink-0 shadow-sm">
          <div className="text-xs sm:text-sm font-medium">
            <span className="text-slate-500">Difference: </span>
            <span className={isBalanced ? "text-emerald-600 font-bold font-mono" : "text-rose-600 font-bold font-mono"}>
              {formatCurrency(Math.abs(totalDebit - totalCredit))}
              {isBalanced ? " (Balanced ✓)" : " (Unbalanced ✗)"}
            </span>
          </div>
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.back()}
              className="h-9 flex-1 sm:flex-none text-sm font-medium"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!isBalanced || submitting || (entries.length === 1 && !entries[0].account_id)}
              className="h-9 flex-1 sm:flex-none min-w-[130px] text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {submitting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
              {submitting ? "Saving..." : "Save Voucher"}
            </Button>
          </div>
        </div>
      </div>

      {/* Add Account Dialog */}
      <Dialog open={addAccountOpen} onOpenChange={setAddAccountOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-indigo-500" />
              Add Account
            </DialogTitle>
            <DialogDescription className="text-xs">
              নতুন account যোগ করুন (Furniture, Loan, Capital)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Category *</Label>
              <Select
                value={newAccount.account_category}
                onValueChange={(v) => setNewAccount({ ...newAccount, account_category: v })}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALLOWED_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value} className="text-sm">
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Account Name *</Label>
              <Input
                value={newAccount.account_name}
                onChange={(e) => setNewAccount({ ...newAccount, account_name: e.target.value })}
                placeholder="e.g., Furniture, Bank Loan"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Opening Balance (BDT)</Label>
              <Input
                type="number"
                step="0.01"
                value={newAccount.opening_balance}
                onChange={(e) => setNewAccount({ ...newAccount, opening_balance: e.target.value })}
                placeholder="0.00"
                className="h-9 text-sm font-mono"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddAccountOpen(false)} disabled={addingAccount}>
              Cancel
            </Button>
            <Button onClick={handleAddAccount} disabled={addingAccount} className="bg-indigo-600 hover:bg-indigo-700">
              {addingAccount ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Create Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ResponsiveLayout>
  )
}

export default function NewVoucherPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <NewVoucherContent />
    </Suspense>
  )
}