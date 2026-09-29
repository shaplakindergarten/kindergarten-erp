// src/app/finance/accounts/page.tsx
"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Plus,
  Loader2,
  Search,
  Edit2,
  Trash2,
  Wallet,
  Building2,
  Landmark,
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertCircle,
  X,
  Save,
  RefreshCw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatCurrency, cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { ResponsiveLayout } from "@/components/layout/responsive-layout"
import { toast } from "sonner"

const supabase = createClient()

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────
interface FinancialAccount {
  id: string
  account_name: string
  account_number: string | null
  type: string
  bank_name: string | null
  branch_name: string | null
  current_balance: number
  is_active: boolean
  account_category: string
  is_balance_sheet: boolean
  created_at?: string
  updated_at?: string
}

// ─────────────────────────────────────────────────────────────────────
// Category metadata
// ─────────────────────────────────────────────────────────────────────
const CATEGORY_META: Record<
  string,
  { label: string; group: string; color: string; bg: string; icon: any }
> = {
  asset: {
    label: "Cash & Bank",
    group: "asset",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    icon: Wallet,
  },
  current_asset: {
    label: "Current Assets",
    group: "asset",
    color: "text-sky-600 dark:text-sky-400",
    bg: "bg-sky-50 dark:bg-sky-950/40",
    icon: TrendingUp,
  },
  fixed_asset: {
    label: "Fixed Assets",
    group: "asset",
    color: "text-indigo-600 dark:text-indigo-400",
    bg: "bg-indigo-50 dark:bg-indigo-950/40",
    icon: Building2,
  },
  liability: {
    label: "Other Liabilities",
    group: "liability",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    icon: AlertCircle,
  },
  payable: {
    label: "Accounts Payable",
    group: "liability",
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-950/40",
    icon: AlertCircle,
  },
  loan: {
    label: "Loans",
    group: "liability",
    color: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-50 dark:bg-rose-950/40",
    icon: Landmark,
  },
  equity: {
    label: "Retained Earnings",
    group: "equity",
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-50 dark:bg-purple-950/40",
    icon: DollarSign,
  },
  capital: {
    label: "Capital",
    group: "equity",
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-50 dark:bg-violet-950/40",
    icon: DollarSign,
  },
  drawing: {
    label: "Drawings",
    group: "equity",
    color: "text-fuchsia-600 dark:text-fuchsia-400",
    bg: "bg-fuchsia-50 dark:bg-fuchsia-950/40",
    icon: TrendingDown,
  },
}

const ALLOWED_CATEGORIES = [
  { value: "asset", label: "Cash & Bank (Asset)" },
  { value: "current_asset", label: "Current Asset" },
  { value: "fixed_asset", label: "Fixed Asset (Furniture, Building...)" },
  { value: "payable", label: "Accounts Payable" },
  { value: "loan", label: "Loan" },
  { value: "liability", label: "Other Liability" },
  { value: "capital", label: "Owner Capital" },
  { value: "drawing", label: "Owner Drawings" },
  { value: "equity", label: "Retained Earnings" },
]

// ─────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────
export default function FinancialAccountsPage() {
  const [accounts, setAccounts] = useState<FinancialAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create")
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    account_name: "",
    account_category: "fixed_asset",
    opening_balance: "",
    account_number: "",
    bank_name: "",
    branch_name: "",
  })

  // ─────────────────────────────────────────────────────────────────
  const loadAccounts = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("financial_accounts")
        .select("*")
        .order("account_category")
        .order("account_name")

      if (error) throw error
      setAccounts(data || [])
    } catch (error) {
      console.error("Error loading accounts:", error)
      toast.error("Failed to load accounts")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAccounts()
  }, [])

  // ─────────────────────────────────────────────────────────────────
  const filteredAccounts = useMemo(() => {
    if (!searchQuery.trim()) return accounts
    const q = searchQuery.toLowerCase()
    return accounts.filter(
      (a) =>
        a.account_name.toLowerCase().includes(q) ||
        a.account_category.toLowerCase().includes(q) ||
        (a.account_number || "").toLowerCase().includes(q)
    )
  }, [accounts, searchQuery])

  const groupedAccounts = useMemo(() => {
    const map = new Map<string, FinancialAccount[]>()
    filteredAccounts.forEach((acc) => {
      const cat = acc.account_category || "asset"
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(acc)
    })
    return Array.from(map.entries()).sort(([a], [b]) => {
      const metaA = CATEGORY_META[a]
      const metaB = CATEGORY_META[b]
      const groupOrder: Record<string, number> = { asset: 1, liability: 2, equity: 3 }
      return (groupOrder[metaA?.group] || 99) - (groupOrder[metaB?.group] || 99)
    })
  }, [filteredAccounts])

  const stats = useMemo(() => {
    const totalAssets = accounts
      .filter((a) => ["asset", "current_asset", "fixed_asset"].includes(a.account_category))
      .reduce((sum, a) => sum + Number(a.current_balance || 0), 0)
    const totalLiabilities = accounts
      .filter((a) => ["liability", "payable", "loan"].includes(a.account_category))
      .reduce((sum, a) => sum + Number(a.current_balance || 0), 0)
    const totalEquity = accounts
      .filter((a) => ["equity", "capital", "drawing"].includes(a.account_category))
      .reduce((sum, a) => sum + Number(a.current_balance || 0), 0)
    return { totalAssets, totalLiabilities, totalEquity }
  }, [accounts])

  // ─────────────────────────────────────────────────────────────────
  const handleOpenCreate = () => {
    setDialogMode("create")
    setEditingId(null)
    setFormData({
      account_name: "",
      account_category: "fixed_asset",
      opening_balance: "",
      account_number: "",
      bank_name: "",
      branch_name: "",
    })
    setDialogOpen(true)
  }

  const handleOpenEdit = (acc: FinancialAccount) => {
    setDialogMode("edit")
    setEditingId(acc.id)
    setFormData({
      account_name: acc.account_name,
      account_category: acc.account_category,
      opening_balance: String(acc.current_balance || 0),
      account_number: acc.account_number || "",
      bank_name: acc.bank_name || "",
      branch_name: acc.branch_name || "",
    })
    setDialogOpen(true)
  }

  // ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!formData.account_name.trim()) {
      toast.error("Account name is required")
      return
    }

    setSubmitting(true)
    try {
      if (dialogMode === "create") {
        const { data, error } = await supabase.rpc("create_balance_sheet_account", {
          p_account_name: formData.account_name.trim(),
          p_account_category: formData.account_category,
          p_opening_balance: parseFloat(formData.opening_balance) || 0,
          p_account_number: formData.account_number || null,
          p_bank_name: formData.bank_name || null,
          p_branch_name: formData.branch_name || null,
        })

        if (error) throw error

        const result = data as any
        if (!result?.success) {
          throw new Error(result?.error || "Failed to create account")
        }

        toast.success(`Account "${formData.account_name}" created ✅`)
      } else if (dialogMode === "edit" && editingId) {
        const { error } = await supabase
          .from("financial_accounts")
          .update({
            account_name: formData.account_name.trim(),
            account_category: formData.account_category,
            current_balance: parseFloat(formData.opening_balance) || 0,
            account_number: formData.account_number || null,
            bank_name: formData.bank_name || null,
            branch_name: formData.branch_name || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingId)

        if (error) throw error
        toast.success(`Account "${formData.account_name}" updated ✅`)
      }

      setDialogOpen(false)
      await loadAccounts()
    } catch (error: any) {
      console.error("Error saving account:", error)
      toast.error(error?.message || "Failed to save account")
    } finally {
      setSubmitting(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────
  const handleDelete = async (acc: FinancialAccount) => {
    const balance = Number(acc.current_balance || 0)
    const confirmMsg =
      balance !== 0
        ? `⚠️ এই account-এ ৳${balance.toFixed(2)} balance আছে!\n\nDelete করলে data হারিয়ে যাবে। চালিয়ে যাবেন?`
        : `Delete "${acc.account_name}"?`

    if (!confirm(confirmMsg)) return

    try {
      const { error } = await supabase
        .from("financial_accounts")
        .delete()
        .eq("id", acc.id)

      if (error) throw error
      toast.success(`Account "${acc.account_name}" deleted`)
      await loadAccounts()
    } catch (error: any) {
      console.error("Error deleting account:", error)
      toast.error(error?.message || "Failed to delete")
    }
  }

  // ─────────────────────────────────────────────────────────────────
  const handleToggleActive = async (acc: FinancialAccount) => {
    try {
      const { error } = await supabase
        .from("financial_accounts")
        .update({ is_active: !acc.is_active, updated_at: new Date().toISOString() })
        .eq("id", acc.id)

      if (error) throw error
      toast.success(acc.is_active ? "Account deactivated" : "Account activated")
      await loadAccounts()
    } catch (error: any) {
      toast.error("Failed to update status")
    }
  }

  // ─────────────────────────────────────────────────────────────────
  return (
    <ResponsiveLayout>
      <div className="space-y-4 p-4 md:p-6 max-w-7xl mx-auto">
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/finance">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
                <Wallet className="h-5 w-5 md:h-6 md:w-6 text-indigo-500" />
                Financial Accounts
              </h1>
              <p className="text-xs md:text-sm text-muted-foreground">
                Assets, Liabilities & Equity — editable accounts
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadAccounts} size="sm">
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
            <Button onClick={handleOpenCreate} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4 mr-1" />
              Add Account
            </Button>
          </div>
        </div>

        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20">
            <CardContent className="p-3">
              <p className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                Total Assets
              </p>
              <p className="text-lg font-black font-mono text-blue-700 dark:text-blue-400 mt-1">
                {formatCurrency(stats.totalAssets)}
              </p>
            </CardContent>
          </Card>
          <Card className="border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20">
            <CardContent className="p-3">
              <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                Total Liabilities
              </p>
              <p className="text-lg font-black font-mono text-amber-700 dark:text-amber-400 mt-1">
                {formatCurrency(stats.totalLiabilities)}
              </p>
            </CardContent>
          </Card>
          <Card className="border-purple-200 dark:border-purple-900/60 bg-purple-50/50 dark:bg-purple-950/20">
            <CardContent className="p-3">
              <p className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wide">
                Total Equity
              </p>
              <p className="text-lg font-black font-mono text-purple-700 dark:text-purple-400 mt-1">
                {formatCurrency(stats.totalEquity)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* SEARCH */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            placeholder="Search account name, category..."
            className="pl-8 h-9 text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* LOADING */}
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
          </div>
        ) : groupedAccounts.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Wallet className="h-12 w-12 mx-auto text-slate-300 mb-3" />
              <p className="text-sm text-slate-500">No accounts found</p>
              <p className="text-xs text-slate-400 mt-1">
                Click "Add Account" to create your first account
              </p>
            </CardContent>
          </Card>
        ) : (
          groupedAccounts.map(([category, categoryAccounts]) => {
            const meta = CATEGORY_META[category] || CATEGORY_META.asset
            const Icon = meta.icon
            const total = categoryAccounts.reduce(
              (s, a) => s + Number(a.current_balance || 0),
              0
            )

            return (
              <Card key={category} className="overflow-hidden">
                <CardHeader className={cn("py-2.5 px-4 border-b", meta.bg)}>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Icon className={cn("h-4 w-4", meta.color)} />
                      <span className={meta.color}>{meta.label}</span>
                      <Badge variant="outline" className="ml-2 text-[10px]">
                        {categoryAccounts.length}
                      </Badge>
                    </CardTitle>
                    <span className="text-sm font-bold font-mono">
                      {formatCurrency(total)}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Account Name</TableHead>
                          <TableHead className="text-xs">Type</TableHead>
                          <TableHead className="text-xs">Number</TableHead>
                          <TableHead className="text-right text-xs">Balance</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                          <TableHead className="text-right text-xs">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {categoryAccounts.map((acc, i) => (
                          <TableRow
                            key={acc.id}
                            className={cn(
                              i % 2 === 0 ? "bg-muted/20" : "",
                              !acc.is_active && "opacity-50"
                            )}
                          >
                            <TableCell className="text-xs font-medium">
                              {acc.account_name}
                            </TableCell>
                            <TableCell className="text-xs capitalize text-muted-foreground">
                              {acc.type}
                            </TableCell>
                            <TableCell className="text-xs font-mono text-muted-foreground">
                              {acc.account_number || "—"}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs font-bold">
                              {formatCurrency(Number(acc.current_balance || 0))}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] cursor-pointer",
                                  acc.is_active
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400"
                                    : "bg-slate-100 text-slate-500 dark:bg-slate-800"
                                )}
                                onClick={() => handleToggleActive(acc)}
                              >
                                {acc.is_active ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenEdit(acc)}
                                  className="h-7 w-7 p-0"
                                  title="Edit"
                                >
                                  <Edit2 className="h-3.5 w-3.5 text-blue-500" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(acc)}
                                  className="h-7 w-7 p-0"
                                  title="Delete"
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}

        {/* DIALOG */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {dialogMode === "create" ? (
                  <>
                    <Plus className="h-4 w-4 text-emerald-500" />
                    Add Account
                  </>
                ) : (
                  <>
                    <Edit2 className="h-4 w-4 text-blue-500" />
                    Edit Account
                  </>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {dialogMode === "create"
                  ? "Create a new account (Furniture, Loan, Capital, etc.)"
                  : "Update account details"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="space-y-1">
                <Label className="text-xs">Category *</Label>
                <Select
                  value={formData.account_category}
                  onValueChange={(v) =>
                    setFormData({ ...formData, account_category: v })
                  }
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
                  value={formData.account_name}
                  onChange={(e) =>
                    setFormData({ ...formData, account_name: e.target.value })
                  }
                  placeholder="e.g., Furniture & Fixtures, Bank Loan, Owner Capital"
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Opening Balance (BDT)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.opening_balance}
                  onChange={(e) =>
                    setFormData({ ...formData, opening_balance: e.target.value })
                  }
                  placeholder="0.00"
                  className="h-9 text-sm font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Account Number</Label>
                  <Input
                    value={formData.account_number}
                    onChange={(e) =>
                      setFormData({ ...formData, account_number: e.target.value })
                    }
                    placeholder="Optional"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Bank Name</Label>
                  <Input
                    value={formData.bank_name}
                    onChange={(e) =>
                      setFormData({ ...formData, bank_name: e.target.value })
                    }
                    placeholder="Optional"
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={submitting}
              >
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                {dialogMode === "create" ? "Create Account" : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ResponsiveLayout>
  )
}