"use client"

import { useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  Loader2,
  RefreshCw,
  Search,
  X,
  CheckCircle,
  XCircle,
  AlertCircle,
  DollarSign,
  Tag,
  Clock,
  Calendar,
  TrendingUp,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ResponsiveLayout } from "@/components/layout/responsive-layout"
import { formatCurrency } from "@/lib/utils"
import { useFeeCategories, type FeeCategory } from "@/hooks/useFeeCategories"
import { CustomScheduleInput } from "@/components/fees/CustomScheduleInput"

// Frequency options with brighter colors
const FREQUENCY_OPTIONS = [
  { value: "monthly", label: "Monthly", icon: Calendar, color: "from-blue-600 to-cyan-600" },
  { value: "quarterly", label: "Quarterly", icon: Calendar, color: "from-cyan-600 to-teal-600" },
  { value: "yearly", label: "Yearly", icon: TrendingUp, color: "from-emerald-600 to-teal-600" },
  { value: "one_time", label: "One Time", icon: Tag, color: "from-purple-600 to-pink-600" },
  { value: "custom", label: "Custom Schedule", icon: Calendar, color: "from-orange-600 to-amber-600" },
]

// Bright stat card component
const StatCard = ({ title, value, icon: Icon, gradient, iconGradient, trend, valueColor }: any) => (
  <Card className="group relative overflow-hidden border-0 shadow-md hover:shadow-lg transition-all duration-300">
    <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-15 group-hover:opacity-25 transition-opacity duration-300`} />
    <CardContent className="p-3 relative z-10">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className={`text-xl font-bold tracking-tight ${valueColor || "text-foreground"}`}>{value}</p>
          {trend && (
            <div className="flex items-center gap-0.5 text-[10px]">
              <TrendingUp className="h-2.5 w-2.5 text-emerald-500" />
              <span className="text-emerald-500">+12.5%</span>
              <span className="text-muted-foreground ml-0.5">vs last month</span>
            </div>
          )}
        </div>
        <div className={`p-2 rounded-xl bg-gradient-to-br ${iconGradient} shadow-lg group-hover:scale-105 transition-transform duration-300`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
      </div>
    </CardContent>
  </Card>
)

export default function FeeCategoriesPage() {
  const {
    categories,
    loading,
    error,
    refresh,
    createCategory,
    updateCategory,
    toggleActive,
    deleteCategory,
  } = useFeeCategories()

  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<FeeCategory | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    name: "",
    amount: "",
    frequency: "monthly",
    description: "",
    custom_schedule: null as any,
  })
  const [formErrors, setFormErrors] = useState<{ name?: string; amount?: string }>({})

  const filteredCategories = categories.filter(cat =>
    cat.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const totalCategories = categories.length
  const activeCategories = categories.filter(c => c.is_active).length
  const totalAmount = categories.reduce((sum, c) => sum + (c.amount || 0), 0)

  const getFrequencyBadge = (frequency: string) => {
    const freq = FREQUENCY_OPTIONS.find(f => f.value === frequency) || FREQUENCY_OPTIONS[0]
    return {
      label: freq.label,
      gradient: freq.color,
    }
  }

  const validateForm = (): boolean => {
    const errors: { name?: string; amount?: string } = {}

    if (!formData.name.trim()) {
      errors.name = "Category name is required"
    }

    if (formData.frequency !== "custom") {
      const amountNum = parseFloat(formData.amount)
      if (!formData.amount) {
        errors.amount = "Amount is required"
      } else if (isNaN(amountNum) || amountNum <= 0) {
        errors.amount = "Please enter a valid amount"
      }
    } else if (formData.frequency === "custom") {
      if (!formData.custom_schedule || formData.custom_schedule.months?.length === 0) {
        errors.amount = "Please configure custom schedule"
      }
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async () => {
    if (!validateForm()) return

    setIsSubmitting(true)
    let amountNum = parseFloat(formData.amount)

    if (formData.frequency === "custom" && formData.custom_schedule) {
      amountNum = formData.custom_schedule.total_amount || 0
    }

    let result
    if (editingItem) {
      result = await updateCategory(editingItem.id, {
        name: formData.name.trim(),
        amount: amountNum,
        frequency: formData.frequency,
        description: formData.description.trim() || null,
        custom_schedule: formData.frequency === "custom" ? formData.custom_schedule : null,
      })
    } else {
       result = await createCategory({
        name: formData.name.trim(),
        amount: amountNum,
        frequency: formData.frequency,
        description: formData.description.trim() || undefined,
        custom_schedule: formData.frequency === "custom" ? formData.custom_schedule : null,
      })
    }

    setIsSubmitting(false)

    if (result.success) {
      setModalOpen(false)
      resetForm()
    } else {
      alert(result.error)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    const result = await deleteCategory(deleteId)
    if (result.success) {
      setDeleteId(null)
    } else {
      alert(result.error)
    }
  }

  const handleEdit = (category: FeeCategory) => {
    setEditingItem(category)
    setFormData({
      name: category.name,
      amount: category.amount.toString(),
      frequency: category.frequency || "monthly",
      description: category.description || "",
      custom_schedule: category.custom_schedule || null,
    })
    setModalOpen(true)
  }

  const resetForm = () => {
    setEditingItem(null)
    setFormData({ 
      name: "", 
      amount: "", 
      frequency: "monthly", 
      description: "",
      custom_schedule: null,
    })
    setFormErrors({})
  }

  if (loading) {
    return (
      <ResponsiveLayout>
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <div className="text-center space-y-2">
            <div className="relative w-8 h-8 mx-auto">
              <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
              <div className="absolute inset-0 rounded-full border-t-2 border-primary animate-spin" />
            </div>
            <p className="text-xs text-muted-foreground animate-pulse">Loading fee categories...</p>
          </div>
        </div>
      </ResponsiveLayout>
    )
  }

  if (error) {
    return (
      <ResponsiveLayout>
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <div className="text-center space-y-3 max-w-md p-4 rounded-xl bg-gradient-to-br from-red-500/5 to-rose-500/5 border border-red-200 dark:border-red-800/30">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-red-600 to-rose-600 shadow-md">
              <AlertCircle className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-base font-semibold">Connection Error</h2>
            <p className="text-xs text-muted-foreground">{error}</p>
            <Button onClick={() => refresh()} className="mt-1 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white shadow-sm h-8 text-xs px-3">
              <RefreshCw className="h-3 w-3 mr-1" />
              Try Again
            </Button>
          </div>
        </div>
      </ResponsiveLayout>
    )
  }

  return (
    <ResponsiveLayout>
      <div className="space-y-4 p-4 min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/20 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/20">
        
        {/* Bright header gradient */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-700 p-3 shadow-md">
          <div className="absolute top-0 right-0 -mt-6 -mr-6 w-24 h-24 rounded-full bg-white/30 blur-2xl animate-pulse" />
          <div className="absolute bottom-0 left-0 -mb-6 -ml-6 w-24 h-24 rounded-full bg-yellow-500/30 blur-2xl animate-pulse delay-1000" />
          
          <div className="relative z-10 flex items-center flex-wrap justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-lg bg-white/20 backdrop-blur-sm">
                <Tag className="h-4 w-4 text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold text-white">Fee Categories</h1>
                <p className="text-white/80 text-[10px]">Manage all fee types, amounts, and frequency</p>
              </div>
            </div>
            <div className="flex gap-1.5">
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={() => refresh()} 
                className="bg-white/15 backdrop-blur-sm text-white border-white/25 hover:bg-white/25 transition-all duration-200 rounded-lg h-7 px-2 text-xs"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Refresh
              </Button>
              <Button 
                size="sm" 
                onClick={() => setModalOpen(true)}
                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-sm hover:shadow-md transition-all duration-200 rounded-lg h-7 px-2 text-xs"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add
              </Button>
            </div>
          </div>
        </div>

        {/* Bright stats cards */}
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
          <StatCard 
            title="Total Categories" 
            value={totalCategories} 
            icon={Tag} 
            gradient="from-indigo-600 to-purple-600"
            iconGradient="from-indigo-600 to-purple-600"
            valueColor="text-indigo-700 dark:text-indigo-400"
          />
          <StatCard 
            title="Active Categories" 
            value={activeCategories} 
            icon={CheckCircle} 
            gradient="from-emerald-600 to-teal-600"
            iconGradient="from-emerald-600 to-teal-600"
            valueColor="text-emerald-700 dark:text-emerald-400"
          />
          <StatCard 
            title="Total Amount" 
            value={formatCurrency(totalAmount)} 
            icon={DollarSign} 
            gradient="from-blue-600 to-cyan-600"
            iconGradient="from-blue-600 to-cyan-600"
            valueColor="text-blue-700 dark:text-blue-400"
            trend={true}
          />
        </div>

        {/* Compact search bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <Input
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8 py-1.5 h-8 text-sm rounded-lg bg-white dark:bg-slate-900 border border-border focus:ring-2 focus:ring-primary/20 transition-all duration-200"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted transition-colors"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>
          <div className="text-[10px] text-muted-foreground bg-muted/30 px-2 py-1 rounded-full">
            {filteredCategories.length} of {categories.length} categories
          </div>
        </div>

        {/* Compact table */}
        <Card className="border-0 shadow-md overflow-hidden rounded-xl">
          <CardHeader className="py-2 px-3 bg-gradient-to-r from-primary/5 to-transparent border-b border-border/50">
            <CardTitle className="text-xs font-semibold flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <div className="p-0.5 rounded bg-primary/10">
                  <Tag className="h-3 w-3 text-primary" />
                </div>
                All Categories
              </span>
              <Badge variant="secondary" className="text-[10px] px-2 py-0.5 rounded-full">
                {filteredCategories.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {filteredCategories.length === 0 ? (
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500/10 to-purple-500/10 mb-2">
                  <Tag className="h-5 w-5 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-sm mb-1">No categories found</h3>
                <p className="text-xs text-muted-foreground">
                  {searchQuery ? "Try a different search term" : "Click 'Add' to create your first fee category"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gradient-to-r from-muted/30 to-transparent border-b border-border/50">
                      <TableHead className="py-2 px-3 text-[10px] font-semibold uppercase tracking-wider">Name</TableHead>
                      <TableHead className="py-2 px-3 text-[10px] font-semibold uppercase tracking-wider">Description</TableHead>
                      <TableHead className="py-2 px-3 text-[10px] font-semibold uppercase tracking-wider">Amount</TableHead>
                      <TableHead className="py-2 px-3 text-[10px] font-semibold uppercase tracking-wider">Frequency</TableHead>
                      <TableHead className="py-2 px-3 text-[10px] font-semibold uppercase tracking-wider">Status</TableHead>
                      <TableHead className="py-2 px-3 text-[10px] font-semibold uppercase tracking-wider">Created</TableHead>
                      <TableHead className="py-2 px-3 text-right text-[10px] font-semibold uppercase tracking-wider">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCategories.map((category) => {
                      const freq = getFrequencyBadge(category.frequency || "monthly")
                      return (
                        <TableRow 
                          key={category.id} 
                          className="group border-b border-border/40 hover:bg-muted/20 transition-all duration-200"
                        >
                          <TableCell className="py-2 px-3 font-medium text-sm">{category.name}</TableCell>
                          <TableCell className="py-2 px-3 text-muted-foreground truncate max-w-[150px] text-xs">
                            {category.description || "—"}
                          </TableCell>
                          <TableCell className="py-2 px-3 font-semibold text-emerald-600 dark:text-emerald-400 text-sm">
                            {formatCurrency(category.amount)}
                          </TableCell>
                          <TableCell className="py-2 px-3">
                            <Badge className={`bg-gradient-to-r ${freq.gradient} text-white border-0 px-2 py-0.5 rounded-full text-[10px] font-medium shadow-sm`}>
                              {freq.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2 px-3">
                            <button
                              onClick={() => toggleActive(category.id, category.is_active)}
                              className="focus:outline-none"
                            >
                              {category.is_active ? (
                                <Badge className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white cursor-pointer gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium hover:shadow-md transition-all duration-200">
                                  <CheckCircle className="h-2.5 w-2.5" />
                                  Active
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="cursor-pointer gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-400/20 hover:bg-muted transition-all duration-200">
                                  <XCircle className="h-2.5 w-2.5" />
                                  Inactive
                                </Badge>
                              )}
                            </button>
                          </TableCell>
                          <TableCell className="py-2 px-3 text-[10px] text-muted-foreground">
                            {new Date(category.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="py-2 px-3 text-right">
                            <div className="flex items-center justify-end gap-0.5">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEdit(category)}
                                className="h-7 w-7 p-0 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all duration-200"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setDeleteId(category.id)}
                                className="h-7 w-7 p-0 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all duration-200"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Compact create/edit modal */}
      <Dialog open={modalOpen} onOpenChange={(open) => {
        if (!open && !isSubmitting) setModalOpen(false)
      }}>
        <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden rounded-xl border border-border/60 shadow-lg bg-white dark:bg-slate-900">
          <DialogHeader className="p-3 pb-2 bg-gradient-to-r from-indigo-600/10 to-purple-600/10 border-b border-border/50">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 shadow-md">
                <Tag className="h-3.5 w-3.5 text-white" />
              </div>
              <DialogTitle className="text-sm font-semibold bg-gradient-to-r from-indigo-700 to-purple-700 bg-clip-text text-transparent">
                {editingItem ? "Edit Category" : "Create Category"}
              </DialogTitle>
            </div>
            <DialogDescription className="text-[10px] text-muted-foreground pt-0.5">
              {editingItem ? "Update the fee category details" : "Add a new fee category"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 p-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-1">
              <Label className="text-xs font-medium">
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Monthly Tuition Fee"
                className={`h-8 text-sm rounded-lg ${formErrors.name ? "border-red-500 focus:ring-red-500/20" : ""}`}
              />
              {formErrors.name && <p className="text-[10px] text-red-500 flex items-center gap-1 mt-0.5"><AlertCircle className="h-2.5 w-2.5" />{formErrors.name}</p>}
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">Frequency</Label>
              <Select value={formData.frequency} onValueChange={(value) => setFormData({ ...formData, frequency: value })}>
                <SelectTrigger className="h-8 text-sm rounded-lg">
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="text-sm">
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${option.color}`} />
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.frequency === "custom" && (
              <div className="space-y-1">
                <Label className="text-xs font-medium">Custom Schedule</Label>
                <CustomScheduleInput
                  value={formData.custom_schedule}
                  onChange={(schedule) => setFormData({ ...formData, custom_schedule: schedule })}
                />
              </div>
            )}

            {formData.frequency !== "custom" && (
              <div className="space-y-1">
                <Label className="text-xs font-medium">
                  Amount (BDT) <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="2500"
                  className={`h-8 text-sm rounded-lg ${formErrors.amount ? "border-red-500 focus:ring-red-500/20" : ""}`}
                />
                {formErrors.amount && <p className="text-[10px] text-red-500 flex items-center gap-1 mt-0.5"><AlertCircle className="h-2.5 w-2.5" />{formErrors.amount}</p>}
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs font-medium">Description (Optional)</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Additional details..."
                rows={2}
                className="resize-none text-sm rounded-lg"
              />
            </div>
          </div>

          <DialogFooter className="p-3 pt-2 border-t border-border/50 bg-white dark:bg-slate-900 gap-2">
            <Button
              variant="outline"
              onClick={() => setModalOpen(false)}
              disabled={isSubmitting}
              className="rounded-lg h-8 px-3 text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !formData.name}
              className="rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-sm hover:shadow-md transition-all duration-200 h-8 px-3 text-xs"
            >
              {isSubmitting && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              {editingItem ? (isSubmitting ? "Updating..." : "Update") : (isSubmitting ? "Creating..." : "Create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Compact delete modal */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm p-0 gap-0 overflow-hidden rounded-xl border border-border/60 shadow-lg bg-white dark:bg-slate-900">
          <DialogHeader className="p-3 pb-2 bg-gradient-to-r from-red-600/10 to-rose-600/10 border-b border-border/50">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-lg bg-gradient-to-r from-red-600 to-rose-600 shadow-md">
                <AlertCircle className="h-3.5 w-3.5 text-white" />
              </div>
              <DialogTitle className="text-sm font-semibold text-red-600 dark:text-red-400">
                Delete Category
              </DialogTitle>
            </div>
            <DialogDescription className="text-[10px] text-muted-foreground pt-0.5">
              Are you sure you want to delete this category?
              <span className="text-red-600 dark:text-red-400 text-[10px] font-medium block mt-1">
                ⚠️ This action cannot be undone.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="p-3 pt-2 gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)} disabled={isSubmitting} className="rounded-lg h-8 px-3 text-xs">
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete} 
              disabled={isSubmitting}
              className="rounded-lg bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white shadow-sm hover:shadow-md transition-all duration-200 h-8 px-3 text-xs"
            >
              {isSubmitting && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ResponsiveLayout>
  )
}
