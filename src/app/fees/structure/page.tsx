// E:\kindergarten-erp\src\app\fees\structure\page.tsx

"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  Loader2,
  RefreshCw,
  Search,
  AlertCircle,
  FolderTree,
  Tag,
  Eye,
  EyeOff,
  Filter,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Square,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { ResponsiveLayout } from "@/components/layout/responsive-layout"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

// ============================================
// TYPES
// ============================================

interface AcademicYear {
  id: string
  year_name: string
  name: string
  is_active: boolean
}

interface Class {
  id: string
  name: string
}

interface FeeCategory {
  id: string
  name: string
  amount: number
  frequency: "monthly" | "quarterly" | "yearly" | "one_time"
  description: string | null
  is_active: boolean
}

interface FeeStructureItem {
  id: string
  fee_structure_id: string
  category_id: string
  fee_category?: FeeCategory
  amount: number
  frequency: string
  name: string
}

interface FeeStructure {
  id: string
  name: string
  academic_year_id: string
  class_id: string | null
  description: string | null
  total_amount: number
  is_active: boolean
  created_at: string
  academic_year?: AcademicYear
  class?: Class
  items?: FeeStructureItem[]
}

// ============================================
// CONSTANTS
// ============================================

const FREQUENCY_LABELS: Record<string, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
  one_time: "One Time",
}

// FIXED: Currency format with English numbers
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "BDT",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount).replace("BDT", "৳")
}

const supabase = createClient()

// ============================================
// API FUNCTIONS
// ============================================

async function fetchAcademicYears(): Promise<AcademicYear[]> {
  const { data, error } = await supabase
    .from("academic_years")
    .select("*")
    .eq("is_active", true)
    .order("year_name", { ascending: false })

  if (error) throw new Error("Failed to fetch academic years")
  return data || []
}

async function fetchClasses(): Promise<Class[]> {
  const { data, error } = await supabase
    .from("classes")
    .select("*")
    .order("name", { ascending: true })

  if (error) throw new Error("Failed to fetch classes")
  return data || []
}

async function fetchFeeCategories(): Promise<FeeCategory[]> {
  const { data, error } = await supabase
    .from("fee_categories")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true })

  if (error) throw new Error("Failed to fetch fee categories")
  return data || []
}

async function fetchStructures(): Promise<FeeStructure[]> {
  const { data: structures, error: structuresError } = await supabase
    .from("fee_structures")
    .select("*")
    .order("created_at", { ascending: false })

  if (structuresError) {
    console.error("Error fetching structures:", structuresError)
    throw new Error("Failed to fetch fee structures")
  }

  if (!structures || structures.length === 0) {
    return []
  }

  const { data: academicYears } = await supabase
    .from("academic_years")
    .select("id, year_name, name, is_active")
    .in("id", structures.map(s => s.academic_year_id))

  const classIds = structures
    .filter(s => s.class_id)
    .map(s => s.class_id)
    .filter((id): id is string => id !== null)
  
  const { data: classes } = classIds.length > 0
    ? await supabase.from("classes").select("id, name").in("id", classIds)
    : { data: [] }

  const structureIds = structures.map(s => s.id)
  const { data: items } = await supabase
    .from("fee_structure_items")
    .select("id, fee_structure_id, category_id, amount, frequency, name")
    .in("fee_structure_id", structureIds)

  const categoryIds = items?.map(i => i.category_id) || []
  const { data: categories } = categoryIds.length > 0
    ? await supabase
        .from("fee_categories")
        .select("id, name, amount, frequency, description, is_active")
        .in("id", categoryIds)
    : { data: [] }

  const academicYearMap = new Map(academicYears?.map(y => [y.id, y]) || [])
  const classMap = new Map(classes?.map(c => [c.id, c]) || [])
  const categoryMap = new Map(categories?.map(c => [c.id, c]) || [])

  const itemsByStructure: Record<string, FeeStructureItem[]> = {}
  items?.forEach(item => {
    if (!itemsByStructure[item.fee_structure_id]) {
      itemsByStructure[item.fee_structure_id] = []
    }
    itemsByStructure[item.fee_structure_id].push({
      ...item,
      fee_category: categoryMap.get(item.category_id)
    })
  })

  return structures.map(structure => ({
    ...structure,
    academic_year: academicYearMap.get(structure.academic_year_id),
    class: structure.class_id ? classMap.get(structure.class_id) : undefined,
    items: itemsByStructure[structure.id] || []
  }))
}

async function createStructure(data: {
  academic_year_id: string
  class_id: string
  description?: string
  category_ids: string[]
}): Promise<FeeStructure> {
  try {
    const { data: existing, error: checkError } = await supabase
      .from("fee_structures")
      .select("id")
      .eq("academic_year_id", data.academic_year_id)
      .eq("class_id", data.class_id)

    if (checkError) {
      console.error("Error checking duplicate:", checkError)
      throw new Error("Failed to check duplicate: " + checkError.message)
    }

    if (existing && existing.length > 0) {
      throw new Error("A fee structure already exists for this academic year and class")
    }

    const { data: categories, error: categoriesError } = await supabase
      .from("fee_categories")
      .select("id, name, amount, frequency")
      .in("id", data.category_ids)

    if (categoriesError) {
      console.error("Error fetching categories:", categoriesError)
      throw new Error("Failed to fetch categories: " + categoriesError.message)
    }

    if (!categories || categories.length === 0) {
      throw new Error("No valid categories found")
    }

    const totalAmount = categories.reduce((sum, cat) => sum + cat.amount, 0)

    const { data: year } = await supabase
      .from("academic_years")
      .select("year_name")
      .eq("id", data.academic_year_id)
      .single()

    const { data: cls } = await supabase
      .from("classes")
      .select("name")
      .eq("id", data.class_id)
      .single()

    const structureName = `${year?.year_name || ""} - ${cls?.name || ""}`

    const { data: structure, error: structureError } = await supabase
      .from("fee_structures")
      .insert({
        name: structureName,
        academic_year_id: data.academic_year_id,
        class_id: data.class_id,
        description: data.description || null,
        total_amount: totalAmount,
        is_active: true,
      })
      .select()
      .single()

    if (structureError) {
      console.error("Error creating structure:", structureError)
      throw new Error("Failed to create fee structure: " + structureError.message)
    }

    const items = data.category_ids.map((categoryId) => {
      const category = categories.find(c => c.id === categoryId)
      if (!category) {
        throw new Error(`Category ${categoryId} not found`)
      }
      return {
        fee_structure_id: structure.id,
        category_id: categoryId,
        amount: category.amount,
        frequency: category.frequency,
        name: category.name,
      }
    })

    const { error: itemsError } = await supabase
      .from("fee_structure_items")
      .insert(items)

    if (itemsError) {
      console.error("Error creating structure items:", itemsError)
      await supabase.from("fee_structures").delete().eq("id", structure.id)
      throw new Error("Failed to create fee structure items: " + itemsError.message)
    }

    return structure
  } catch (error) {
    console.error("createStructure error:", error)
    throw error
  }
}

async function updateStructure(
  id: string,
  data: {
    category_ids?: string[]
    description?: string
    is_active?: boolean
  }
): Promise<FeeStructure> {
  const updateData: any = {}

  if (data.description !== undefined) updateData.description = data.description
  if (data.is_active !== undefined) updateData.is_active = data.is_active

  if (data.category_ids) {
    const { data: categories, error: categoriesError } = await supabase
      .from("fee_categories")
      .select("id, name, amount, frequency")
      .in("id", data.category_ids)

    if (categoriesError) {
      console.error("Error fetching categories:", categoriesError)
      throw new Error("Failed to fetch categories: " + categoriesError.message)
    }

    if (!categories || categories.length === 0) {
      throw new Error("No valid categories found")
    }

    const totalAmount = categories.reduce((sum, cat) => sum + cat.amount, 0)
    updateData.total_amount = totalAmount

    // Delete existing items
    const { error: deleteError } = await supabase
      .from("fee_structure_items")
      .delete()
      .eq("fee_structure_id", id)

    if (deleteError) {
      console.error("Error deleting structure items:", deleteError)
      throw new Error("Failed to delete existing items: " + deleteError.message)
    }

    const items = data.category_ids.map((categoryId) => {
      const category = categories.find(c => c.id === categoryId)
      if (!category) {
        throw new Error(`Category ${categoryId} not found`)
      }
      return {
        fee_structure_id: id,
        category_id: categoryId,
        amount: category.amount,
        frequency: category.frequency,
        name: category.name,
      }
    })

    const { error: itemsError } = await supabase
      .from("fee_structure_items")
      .insert(items)

    if (itemsError) {
      console.error("Error updating structure items:", itemsError)
      throw new Error("Failed to update fee structure items: " + itemsError.message)
    }
  }

  const { data: structure, error } = await supabase
    .from("fee_structures")
    .update(updateData)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    console.error("Error updating structure:", error)
    throw new Error("Failed to update fee structure: " + error.message)
  }
  return structure
}

async function deleteStructure(id: string): Promise<void> {
  // First delete related items (explicitly handle cascade)
  const { error: itemsError } = await supabase
    .from("fee_structure_items")
    .delete()
    .eq("fee_structure_id", id)

  if (itemsError) {
    console.error("Error deleting structure items:", itemsError)
    throw new Error("Failed to delete fee structure items: " + itemsError.message)
  }

  // Then delete the structure
  const { error } = await supabase
    .from("fee_structures")
    .delete()
    .eq("id", id)

  if (error) {
    console.error("Error deleting structure:", error)
    throw new Error("Failed to delete fee structure: " + error.message)
  }
}

async function toggleStructureStatus(id: string, currentStatus: boolean): Promise<void> {
  const { error } = await supabase
    .from("fee_structures")
    .update({ is_active: !currentStatus })
    .eq("id", id)

  if (error) {
    console.error("Error toggling structure status:", error)
    throw new Error("Failed to toggle fee structure status: " + error.message)
  }
}

// ============================================
// HOOKS
// ============================================

function useFeeStructures() {
  const queryClient = useQueryClient()

  const structuresQuery = useQuery({
    queryKey: ["fee-structures"],
    queryFn: fetchStructures,
  })

  const academicYearsQuery = useQuery({
    queryKey: ["academic-years"],
    queryFn: fetchAcademicYears,
  })

  const classesQuery = useQuery({
    queryKey: ["classes"],
    queryFn: fetchClasses,
  })

  const feeCategoriesQuery = useQuery({
    queryKey: ["fee-categories"],
    queryFn: fetchFeeCategories,
  })

  const createMutation = useMutation({
    mutationFn: createStructure,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fee-structures"] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      updateStructure(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fee-structures"] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteStructure,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fee-structures"] })
    },
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: boolean }) =>
      toggleStructureStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fee-structures"] })
    },
  })

  useEffect(() => {
    const channel = supabase
      .channel("fee-structures-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "fee_structures",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["fee-structures"] })
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "fee_structure_items",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["fee-structures"] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])

  return {
    structures: structuresQuery.data || [],
    academicYears: academicYearsQuery.data || [],
    classes: classesQuery.data || [],
    feeCategories: feeCategoriesQuery.data || [],
    isLoading:
      structuresQuery.isLoading ||
      academicYearsQuery.isLoading ||
      classesQuery.isLoading ||
      feeCategoriesQuery.isLoading,
    error:
      structuresQuery.error ||
      academicYearsQuery.error ||
      classesQuery.error ||
      feeCategoriesQuery.error,
    refresh: () => {
      queryClient.invalidateQueries({ queryKey: ["fee-structures"] })
      queryClient.invalidateQueries({ queryKey: ["academic-years"] })
      queryClient.invalidateQueries({ queryKey: ["classes"] })
      queryClient.invalidateQueries({ queryKey: ["fee-categories"] })
    },
    createStructure: createMutation.mutateAsync,
    updateStructure: updateMutation.mutateAsync,
    deleteStructure: deleteMutation.mutateAsync,
    toggleStatus: toggleMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isToggling: toggleMutation.isPending,
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function getFrequencyLabel(frequency: string): string {
  return FREQUENCY_LABELS[frequency] || frequency
}

// ============================================
// COMPONENTS
// ============================================

// FIXED: FeeCategorySelector with proper Select All
function FeeCategorySelector({
  categories,
  selectedIds,
  onToggle,
  onSelectAll,
}: {
  categories: FeeCategory[]
  selectedIds: Set<string>
  onToggle: (id: string) => void
  onSelectAll: (select: boolean) => void
}) {
  const allSelected = categories.length > 0 && categories.every(cat => selectedIds.has(cat.id))
  const someSelected = categories.some(cat => selectedIds.has(cat.id))

  if (categories.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-lg">
        <p className="text-sm">No fee categories available</p>
      </div>
    )
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-white dark:bg-slate-950">
      {/* Header with Select All */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-b border-border">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onSelectAll(!allSelected)}
            className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
          >
            {allSelected ? (
              <CheckSquare className="h-4 w-4 text-primary" />
            ) : someSelected ? (
              <CheckSquare className="h-4 w-4 text-primary/70" />
            ) : (
              <Square className="h-4 w-4" />
            )}
            {allSelected ? "Deselect All" : "Select All"}
          </button>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-muted/50">
            {selectedIds.size} / {categories.length} selected
          </Badge>
        </div>
      </div>

      {/* Category List */}
      <div className="divide-y divide-border max-h-[350px] overflow-y-auto">
        {categories.map((category) => {
          const isSelected = selectedIds.has(category.id)

          return (
            <div
              key={category.id}
              className={`
                flex items-center gap-3 px-4 py-3 transition-all duration-150
                ${isSelected 
                  ? "bg-primary/10 border-l-2 border-l-primary" 
                  : "hover:bg-muted/30"
                }
              `}
            >
              {/* Custom checkbox with visible checkmark */}
              <div className="relative flex-shrink-0">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggle(category.id)}
                  id={`category-${category.id}`}
                  className={`
                    appearance-none h-5 w-5 rounded border-2 cursor-pointer
                    transition-all duration-150
                    ${isSelected 
                      ? "bg-primary border-primary" 
                      : "bg-white dark:bg-slate-900 border-border hover:border-primary/50"
                    }
                  `}
                />
                {isSelected && (
                  <svg
                    className="absolute inset-0 h-5 w-5 text-white pointer-events-none"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </div>

              <label
                htmlFor={`category-${category.id}`}
                className="flex-1 flex items-center gap-3 cursor-pointer min-w-0"
              >
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${isSelected ? "text-primary font-semibold" : "text-foreground"}`}>
                    {category.name}
                  </p>
                  {category.description && (
                    <p className="text-xs text-muted-foreground truncate">
                      {category.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-muted/30 text-muted-foreground">
                    {getFrequencyLabel(category.frequency)}
                  </Badge>
                  <span className={`text-sm font-medium whitespace-nowrap ${isSelected ? "text-primary" : "text-emerald-600 dark:text-emerald-400"}`}>
                    {formatCurrency(category.amount)}
                  </span>
                </div>
              </label>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// PREVIEW COMPONENT
function FeePreview({ categories }: { categories: FeeCategory[] }) {
  if (categories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-lg bg-muted/10 h-full">
        <p className="text-sm text-muted-foreground">No categories selected</p>
        <p className="text-xs text-muted-foreground mt-1">Select categories from the left panel</p>
      </div>
    )
  }

  const total = categories.reduce((sum, cat) => sum + cat.amount, 0)

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-white dark:bg-slate-950 h-full">
      <div className="px-4 py-2.5 bg-gradient-to-r from-primary/5 to-primary/10 border-b border-border">
        <h4 className="text-sm font-semibold text-foreground flex items-center justify-between">
          <span>Selected Categories</span>
          <Badge className="bg-primary text-primary-foreground text-[10px] px-2 py-0">
            {categories.length} items
          </Badge>
        </h4>
      </div>
      <div className="p-3 space-y-1.5 max-h-[350px] overflow-y-auto">
        {categories.map((category) => (
          <div key={category.id} className="flex justify-between items-center text-sm px-2 py-1.5 rounded-lg hover:bg-muted/20 border border-transparent hover:border-border">
            <span className="text-foreground font-medium">{category.name}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {getFrequencyLabel(category.frequency)}
              </span>
              <span className="font-semibold text-foreground">
                {formatCurrency(category.amount)}
              </span>
            </div>
          </div>
        ))}
        <div className="pt-2 mt-2 border-t border-border flex justify-between items-center px-3 py-2 bg-primary/5 rounded-lg">
          <span className="text-sm font-semibold text-foreground">Total</span>
          <span className="text-sm font-bold text-primary">{formatCurrency(total)}</span>
        </div>
      </div>
    </div>
  )
}

// TABLE ROW
function StructureRow({
  structure,
  onEdit,
  onToggle,
  onDelete,
}: {
  structure: FeeStructure
  onEdit: (structure: FeeStructure) => void
  onToggle: (id: string, currentStatus: boolean) => void
  onDelete: (id: string, name: string) => void
}) {
  const categoryCount = structure.items?.length || 0

  const displayName = useMemo(() => {
    const year = structure.academic_year?.year_name || structure.academic_year?.name || ""
    const className = structure.class?.name || ""
    return `${year} - ${className}`
  }, [structure])

  return (
    <TableRow className="group hover:bg-muted/30 transition-colors duration-150">
      <TableCell className="px-4 py-3 whitespace-nowrap">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <FolderTree className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{displayName}</p>
            {structure.description && (
              <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                {structure.description}
              </p>
            )}
          </div>
        </div>
      </TableCell>

      <TableCell className="px-4 py-3 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <Tag className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">{categoryCount}</span>
        </div>
      </TableCell>

      <TableCell className="px-4 py-3 whitespace-nowrap">
        <Badge
          className={`text-[10px] px-2.5 py-0.5 font-medium border ${
            structure.is_active 
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" 
              : "bg-gray-500/15 text-gray-600 dark:text-gray-400 border-gray-500/20"
          }`}
        >
          {structure.is_active ? "Active" : "Inactive"}
        </Badge>
      </TableCell>

      <TableCell className="px-4 py-3 whitespace-nowrap text-right">
        <div className="flex items-center justify-end gap-0.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onEdit(structure)}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <Edit className="h-4 w-4" />
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => onToggle(structure.id, structure.is_active)}
            className={`h-8 w-8 p-0 transition-colors ${
              structure.is_active 
                ? "text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10" 
                : "text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10"
            }`}
          >
            {structure.is_active ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDelete(structure.id, displayName)}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

// EMPTY STATE
function EmptyState({
  onCreate,
  hasFilters,
  onClearFilters,
}: {
  onCreate: () => void
  hasFilters?: boolean
  onClearFilters?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mb-6">
        <FolderTree className="h-10 w-10 text-primary/60" />
      </div>
      <h3 className="text-xl font-semibold text-foreground mb-2">
        {hasFilters ? "No matching structures found" : "No fee structures created yet"}
      </h3>
      <p className="text-sm text-muted-foreground max-w-md mb-6">
        {hasFilters
          ? "Try adjusting your filters or search query"
          : "Create a fee structure for a class to get started"}
      </p>
      {hasFilters ? (
        <Button variant="outline" size="sm" onClick={onClearFilters} className="h-9 px-6">
          Clear Filters
        </Button>
      ) : (
        <Button
          size="sm"
          onClick={onCreate}
          className="h-9 px-6 bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Structure
        </Button>
      )}
    </div>
  )
}

// ============================================
// MAIN PAGE
// ============================================

export default function FeeStructurePage() {
  const {
    structures,
    academicYears,
    classes,
    feeCategories,
    isLoading,
    error,
    refresh,
    createStructure,
    updateStructure,
    deleteStructure,
    toggleStatus,
    isCreating,
    isUpdating,
    isDeleting,
  } = useFeeStructures()

  const [searchQuery, setSearchQuery] = useState("")
  const [filterAcademicYear, setFilterAcademicYear] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all")

  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingStructure, setEditingStructure] = useState<FeeStructure | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletingStructure, setDeletingStructure] = useState<{ id: string; name: string } | null>(null)

  const [academicYearId, setAcademicYearId] = useState("")
  const [classId, setClassId] = useState("")
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set())
  const [description, setDescription] = useState("")
  const [formError, setFormError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const filteredStructures = useMemo(() => {
    return structures.filter((s) => {
      const searchLower = searchQuery.toLowerCase()
      const yearName = (s.academic_year?.year_name || s.academic_year?.name || "").toLowerCase()
      const className = (s.class?.name || "").toLowerCase()
      const categoryNames = s.items?.map(item => 
        (item.fee_category?.name || item.name || "").toLowerCase()
      ).join(" ") || ""

      const matchesSearch =
        !searchQuery ||
        yearName.includes(searchLower) ||
        className.includes(searchLower) ||
        categoryNames.includes(searchLower)

      const matchesYear = !filterAcademicYear || s.academic_year_id === filterAcademicYear
      const matchesStatus =
        filterStatus === "all" || (filterStatus === "active" ? s.is_active : !s.is_active)

      return matchesSearch && matchesYear && matchesStatus
    })
  }, [structures, searchQuery, filterAcademicYear, filterStatus])

  const hasFilters = useMemo(() => {
    return !!(filterAcademicYear || filterStatus !== "all")
  }, [filterAcademicYear, filterStatus])

  // FIXED: Selected categories filtered from available categories
  const selectedCategories = useMemo(() => {
    return feeCategories.filter((cat) => selectedCategoryIds.has(cat.id))
  }, [feeCategories, selectedCategoryIds])

  const totalPages = Math.ceil(filteredStructures.length / itemsPerPage)
  const paginatedStructures = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredStructures.slice(start, start + itemsPerPage)
  }, [filteredStructures, currentPage])

  const resetForm = useCallback(() => {
    setAcademicYearId("")
    setClassId("")
    setSelectedCategoryIds(new Set())
    setDescription("")
    setFormError("")
  }, [])

  const handleCreate = useCallback(() => {
    resetForm()
    setEditingStructure(null)
    setDialogOpen(true)
  }, [resetForm])

  const handleEdit = useCallback((structure: FeeStructure) => {
    setEditingStructure(structure)
    setAcademicYearId(structure.academic_year_id)
    setClassId(structure.class_id || "")
    setDescription(structure.description || "")
    
    // FIXED: Filter only existing category IDs
    const existingCategoryIds = structure.items?.map((item) => item.category_id) || []
    const validCategoryIds = existingCategoryIds.filter(id => 
      feeCategories.some(cat => cat.id === id)
    )
    setSelectedCategoryIds(new Set(validCategoryIds))
    
    setDialogOpen(true)
  }, [feeCategories])

  // FIXED: Proper functional update for toggleCategory
  const toggleCategory = useCallback((categoryId: string) => {
    setFormError("")
    setSelectedCategoryIds(prev => {
      const next = new Set(prev)
      if (next.has(categoryId)) {
        next.delete(categoryId)
      } else {
        next.add(categoryId)
      }
      return next
    })
  }, [])

  // FIXED: Select All / Deselect All handler
  const handleSelectAll = useCallback((select: boolean) => {
    setFormError("")
    if (select) {
      // Select all available categories
      setSelectedCategoryIds(new Set(feeCategories.map(cat => cat.id)))
    } else {
      // Deselect all
      setSelectedCategoryIds(new Set())
    }
  }, [feeCategories])

  const handleSubmit = useCallback(async () => {
    setFormError("")

    if (!academicYearId) {
      setFormError("Please select an academic year")
      return
    }

    if (!classId) {
      setFormError("Please select a class")
      return
    }

    if (selectedCategoryIds.size === 0) {
      setFormError("Please select at least one fee category")
      return
    }

    setIsSubmitting(true)

    const formData = {
      academic_year_id: academicYearId,
      class_id: classId,
      description: description || undefined,
      category_ids: Array.from(selectedCategoryIds),
    }

    try {
      if (editingStructure) {
        await updateStructure({
          id: editingStructure.id,
          data: {
            category_ids: formData.category_ids,
            description: formData.description,
          },
        })
        toast.success("Fee structure updated successfully")
      } else {
        await createStructure(formData)
        toast.success("Fee structure created successfully")
      }

      setDialogOpen(false)
      resetForm()
    } catch (err: any) {
      const errorMessage = err.message || "Failed to save fee structure"
      setFormError(errorMessage)
      toast.error(errorMessage)
      console.error("Submit error:", err)
    } finally {
      setIsSubmitting(false)
    }
  }, [
    academicYearId,
    classId,
    selectedCategoryIds,
    description,
    editingStructure,
    createStructure,
    updateStructure,
    resetForm,
  ])

  const handleDelete = useCallback((id: string, name: string) => {
    setDeletingStructure({ id, name })
    setDeleteOpen(true)
  }, [])

  const handleDeleteConfirm = useCallback(async () => {
    if (!deletingStructure) return

    try {
      await deleteStructure(deletingStructure.id)
      toast.success("Fee structure deleted successfully")
      setDeleteOpen(false)
      setDeletingStructure(null)
    } catch (err: any) {
      toast.error(err.message || "Failed to delete fee structure")
    }
  }, [deletingStructure, deleteStructure])

  const handleToggle = useCallback(
    async (id: string, currentStatus: boolean) => {
      try {
        await toggleStatus({ id, status: currentStatus })
        toast.success(`Fee structure ${currentStatus ? "disabled" : "enabled"} successfully`)
      } catch (err: any) {
        toast.error(err.message || "Failed to toggle fee structure status")
      }
    },
    [toggleStatus]
  )

  const clearFilters = useCallback(() => {
    setFilterAcademicYear(null)
    setFilterStatus("all")
    setSearchQuery("")
    setCurrentPage(1)
  }, [])

  const goToPage = useCallback((page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)))
  }, [totalPages])

  if (error) {
    return (
      <ResponsiveLayout>
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
          <p className="text-muted-foreground mb-4">Failed to load fee structures</p>
          <Button variant="outline" onClick={() => refresh()}>
            Try Again
          </Button>
        </div>
      </ResponsiveLayout>
    )
  }

  return (
    <ResponsiveLayout>
      <div className="pb-8">
        {/* HEADER - Modern Design */}
        <div className="sticky top-0 z-20 bg-gradient-to-r from-indigo-600/10 via-purple-600/10 to-pink-600/10 backdrop-blur-sm border-b border-border shadow-sm">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              {/* Left */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="h-9 w-9 p-0 rounded-lg hover:bg-white/50 dark:hover:bg-slate-800/50"
                >
                  <Link href="/fees">
                    <ArrowLeft className="h-4 w-4" />
                  </Link>
                </Button>
                <div>
                  <h1 className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
                    Fee Structures
                  </h1>
                  <p className="text-xs text-muted-foreground">Manage fee structures for classes</p>
                </div>
              </div>

              {/* Right */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refresh()}
                  disabled={isLoading}
                  className="h-9 px-3 text-xs bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-border text-foreground hover:bg-white dark:hover:bg-slate-900 rounded-lg"
                >
                  <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreate}
                  className="h-9 px-4 text-xs bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-md shadow-indigo-600/20 rounded-lg"
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  New
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Search & Filters - ALL IN ONE HORIZONTAL ROW */}
        <div className="bg-white/50 dark:bg-slate-950/50 border-b border-border">
          <div className="container mx-auto px-4 py-2">
            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative flex-1 min-w-[160px] max-w-[240px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="pl-8 h-8 text-xs bg-white dark:bg-slate-900 border-border text-foreground placeholder:text-muted-foreground rounded-lg focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* Academic Year */}
              <Select
                value={filterAcademicYear || "all"}
                onValueChange={(value) => {
                  setFilterAcademicYear(value === "all" ? null : value)
                  setCurrentPage(1)
                }}
              >
                <SelectTrigger className="h-8 w-[110px] text-xs bg-white dark:bg-slate-900 border-border text-foreground rounded-lg flex-shrink-0">
                  <SelectValue placeholder="All Years" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-950 border-border rounded-lg shadow-lg">
                  <SelectItem value="all" className="text-xs text-foreground">All Years</SelectItem>
                  {academicYears.map((year) => (
                    <SelectItem key={year.id} value={year.id} className="text-xs text-foreground">
                      {year.year_name || year.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Status */}
              <Select
                value={filterStatus}
                onValueChange={(value) => {
                  setFilterStatus(value as "all" | "active" | "inactive")
                  setCurrentPage(1)
                }}
              >
                <SelectTrigger className="h-8 w-[100px] text-xs bg-white dark:bg-slate-900 border-border text-foreground rounded-lg flex-shrink-0">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-950 border-border rounded-lg shadow-lg">
                  <SelectItem value="all" className="text-xs text-foreground">All Status</SelectItem>
                  <SelectItem value="active" className="text-xs text-foreground">Active</SelectItem>
                  <SelectItem value="inactive" className="text-xs text-foreground">Inactive</SelectItem>
                </SelectContent>
              </Select>

              {/* Filters Badge */}
              {hasFilters && (
                <Badge variant="secondary" className="h-8 px-2.5 text-xs bg-muted/50 text-foreground border-border rounded-lg flex-shrink-0">
                  <Filter className="h-3.5 w-3.5 mr-1.5" />
                  Filters
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="container mx-auto px-4 mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="relative">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary"></div>
              </div>
            </div>
          ) : filteredStructures.length === 0 ? (
            <EmptyState
              onCreate={handleCreate}
              hasFilters={hasFilters}
              onClearFilters={clearFilters}
            />
          ) : (
            <>
              <div className="rounded-xl border border-border overflow-hidden bg-white dark:bg-slate-950 shadow-sm">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow className="hover:bg-transparent border-b border-border">
                        <TableHead className="text-xs font-semibold text-muted-foreground h-10 px-4 uppercase tracking-wider">
                          Academic Year / Class
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-muted-foreground h-10 px-4 uppercase tracking-wider">
                          Categories
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-muted-foreground h-10 px-4 uppercase tracking-wider">
                          Status
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-muted-foreground h-10 px-4 uppercase tracking-wider text-right">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedStructures.map((structure) => (
                        <StructureRow
                          key={structure.id}
                          structure={structure}
                          onEdit={handleEdit}
                          onToggle={handleToggle}
                          onDelete={handleDelete}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-xs text-muted-foreground">
                    Showing <span className="font-medium text-foreground">{paginatedStructures.length}</span> of{" "}
                    <span className="font-medium text-foreground">{filteredStructures.length}</span> items
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="h-8 w-8 p-0 rounded-lg bg-white dark:bg-slate-900 border-border text-foreground hover:bg-muted/50"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs px-3 py-1 rounded-lg bg-primary/10 text-primary font-medium">
                      {currentPage} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="h-8 w-8 p-0 rounded-lg bg-white dark:bg-slate-900 border-border text-foreground hover:bg-muted/50"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* CREATE/EDIT DIALOG */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && setDialogOpen(false)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0 gap-0 rounded-2xl bg-white dark:bg-slate-950 shadow-2xl border-border">
          <DialogHeader className="px-6 py-4 bg-gradient-to-r from-indigo-600/5 via-purple-600/5 to-pink-600/5 border-b border-border">
            <DialogTitle className="text-lg font-bold text-foreground">
              {editingStructure ? "Edit" : "Create"} Fee Structure
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Assign fee categories to a class
            </DialogDescription>
          </DialogHeader>

          <div className="p-6">
            {/* Academic Year & Class */}
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-foreground">
                  Academic Year <span className="text-red-500">*</span>
                </Label>
                <Select value={academicYearId} onValueChange={setAcademicYearId}>
                  <SelectTrigger className="h-10 bg-white dark:bg-slate-900 border-border text-foreground rounded-lg">
                    <SelectValue placeholder="Select academic year" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-950 border-border rounded-lg shadow-lg">
                    {academicYears.map((year) => (
                      <SelectItem key={year.id} value={year.id} className="text-foreground">
                        {year.year_name || year.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-foreground">
                  Class <span className="text-red-500">*</span>
                </Label>
                <Select value={classId} onValueChange={setClassId}>
                  <SelectTrigger className="h-10 bg-white dark:bg-slate-900 border-border text-foreground rounded-lg">
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-950 border-border rounded-lg shadow-lg">
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id} className="text-foreground">
                        {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-2 gap-5">
              {/* Left: Fee Categories */}
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                  Fee Categories <span className="text-red-500">*</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {selectedCategoryIds.size} selected
                  </Badge>
                </Label>
                <FeeCategorySelector
                  categories={feeCategories}
                  selectedIds={selectedCategoryIds}
                  onToggle={toggleCategory}
                  onSelectAll={handleSelectAll}
                />
              </div>

              {/* Right: Preview */}
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-foreground">Selected Categories Preview</Label>
                <FeePreview categories={selectedCategories} />
              </div>
            </div>

            {/* Error */}
            {formError && (
              <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-500">{formError}</p>
              </div>
            )}
          </div>

          <DialogFooter className="px-6 py-4 border-t border-border gap-2 bg-muted/10">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={isSubmitting}
              className="h-9 px-6 text-sm bg-white dark:bg-slate-900 border-border text-foreground hover:bg-muted/50 rounded-lg"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="h-9 px-6 text-sm bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-md shadow-indigo-600/20 rounded-lg"
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingStructure ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={(open) => !open && setDeleteOpen(false)}>
        <DialogContent className="max-w-md p-0 gap-0 rounded-2xl bg-white dark:bg-slate-950 shadow-2xl border-border">
          <DialogHeader className="px-6 py-4 border-b border-border">
            <div className="flex items-center gap-3 text-red-500">
              <div className="p-2 rounded-lg bg-red-500/10">
                <AlertCircle className="h-5 w-5" />
              </div>
              <DialogTitle className="text-lg font-bold text-foreground">Delete Fee Structure</DialogTitle>
            </div>
            <DialogDescription className="text-sm text-muted-foreground mt-1">
              Are you sure you want to delete{" "}
              <strong className="text-foreground">“{deletingStructure?.name}”</strong>?
            </DialogDescription>
          </DialogHeader>

          <div className="p-6">
            <p className="text-sm text-muted-foreground">
              This action cannot be undone. All associated fee items will be permanently removed.
            </p>
          </div>

          <DialogFooter className="px-6 py-4 border-t border-border gap-2 bg-muted/10">
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={isDeleting}
              className="h-9 px-6 text-sm bg-white dark:bg-slate-900 border-border text-foreground hover:bg-muted/50 rounded-lg"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="h-9 px-6 text-sm bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white shadow-md shadow-red-600/20 rounded-lg"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ResponsiveLayout>
  )
}
