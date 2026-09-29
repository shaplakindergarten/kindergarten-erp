// src/app/fees/discounts/page.tsx
// Fee Discounts - Complete with Header, Table, Filters

"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { 
  ArrowLeft, Plus, Edit, Trash2, Loader2, Tag, Percent, DollarSign, Sparkles, 
  Check, ChevronsUpDown, Layers, AlertCircle, Users, School, User, Search,
  Filter, X
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { cn, formatCurrency } from "@/lib/utils"
import { ResponsiveLayout } from "@/components/layout/responsive-layout"
import { createClient } from "@/lib/supabase/client"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const supabase = createClient()

// ============================================
// INTERFACES
// ============================================

interface Discount {
  id: string
  name: string
  type: "percentage" | "fixed"
  value: number
  applicable_on: string
  applicable_categories: string[]
  is_active: boolean
  created_at?: string
  scope_type: 'all' | 'class' | 'section' | 'student' | 'sibling'
  scope_class_id?: string
  scope_section_id?: string
  scope_student_ids?: string[]
  sibling_group_id?: string
  valid_from?: string
  valid_to?: string
}

interface FeeCategory {
  id: string
  name: string
  amount: number
  description: string | null
  is_active: boolean
}

interface Class {
  id: string
  name: string
}

interface Section {
  id: string
  name: string
  class_id: string
}

interface Student {
  id: string
  name: string
  student_id: string
  class_id: string
  section_id: string
  class_roll?: string
  contact?: string
  fathers_contact?: string
  mothers_contact?: string
}

// ============================================
// HELPERS
// ============================================

const getScopeBadge = (scopeType: string, scopeData?: any) => {
  switch (scopeType) {
    case 'all':
      return { label: 'All Students', color: 'bg-blue-500', icon: Users }
    case 'class':
      return { label: `Class: ${scopeData?.class_name || 'N/A'}`, color: 'bg-purple-500', icon: School }
    case 'section':
      return { label: `Section: ${scopeData?.section_name || 'N/A'}`, color: 'bg-indigo-500', icon: Layers }
    case 'student':
      return { label: 'Specific Students', color: 'bg-emerald-500', icon: User }
    case 'sibling':
      return { label: 'Sibling Discount', color: 'bg-pink-500', icon: Users }
    default:
      return { label: 'All Students', color: 'bg-blue-500', icon: Users }
  }
}

const getDiscountBadge = (type: string, value: number) => {
  if (type === "percentage") {
    return {
      label: `${value}% OFF`,
      gradient: "from-purple-500 to-pink-500",
      icon: Percent
    }
  }
  return {
    label: `${formatCurrency(value)} OFF`,
    gradient: "from-emerald-500 to-teal-500",
    icon: DollarSign
  }
}

// ============================================
// STAT CARD COMPONENT
// ============================================

const StatCard = ({ title, value, icon: Icon, gradient, iconBg }: any) => (
  <Card className="group relative overflow-hidden border-none shadow-md hover:shadow-lg transition-all duration-300">
    <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-10 group-hover:opacity-20 transition-opacity duration-300`} />
    <CardContent className="p-4 relative z-10">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
        </div>
        <div className={`p-2 rounded-xl ${iconBg} group-hover:scale-105 transition-transform duration-300 shadow-md`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </CardContent>
  </Card>
)

// ============================================
// MAIN COMPONENT
// ============================================

export default function DiscountsPage() {
  const [discounts, setDiscounts] = useState<Discount[]>([])
  const [categories, setCategories] = useState<FeeCategory[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Discount | null>(null)
  const [openCategorySelect, setOpenCategorySelect] = useState(false)
  const [openStudentSelect, setOpenStudentSelect] = useState(false)
  
  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("")
  const [filterScope, setFilterScope] = useState<string>("all")
  
  const [formData, setFormData] = useState({
    name: "",
    type: "percentage" as "percentage" | "fixed",
    value: "",
    applicable_categories: [] as string[],
    scope_type: "all" as 'all' | 'class' | 'section' | 'student' | 'sibling',
    scope_class_id: "",
    scope_section_id: "",
    scope_student_ids: [] as string[],
    sibling_group_id: "",
    valid_from: "",
    valid_to: "",
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      
      // Load discounts
      const { data: discountsData, error: discountsError } = await supabase
        .from("fee_discounts")
        .select("*")
        .order("created_at", { ascending: false })
      
      if (discountsError) throw discountsError
      
      const parsedDiscounts = (discountsData || []).map((discount: any) => ({
        ...discount,
        applicable_categories: Array.isArray(discount.applicable_categories) 
          ? discount.applicable_categories 
          : discount.applicable_categories 
            ? JSON.parse(discount.applicable_categories) 
            : [],
        scope_student_ids: discount.scope_student_ids || [],
      }))
      
      // Load categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from("fee_categories")
        .select("id, name, amount, description, is_active")
        .eq("is_active", true)
        .order("name")
      
      if (categoriesError) throw categoriesError
      
      // Load classes
      const { data: classesData, error: classesError } = await supabase
        .from("classes")
        .select("id, name")
        .order("name")
      
      if (classesError) throw classesError
      
      // Load sections
      const { data: sectionsData, error: sectionsError } = await supabase
        .from("sections")
        .select("id, name, class_id")
        .order("name")
      
      if (sectionsError) throw sectionsError
      
      // Load students for selection with search fields
      const { data: studentsData, error: studentsError } = await supabase
        .from("students")
        .select("id, name, student_id, class_id, section_id, class_roll, contact, fathers_contact, mothers_contact")
        .eq("status", "active")
        .order("name")
      
      if (studentsError) throw studentsError
      
      setDiscounts(parsedDiscounts)
      setCategories(categoriesData || [])
      setClasses(classesData || [])
      setSections(sectionsData || [])
      setStudents(studentsData || [])
      
    } catch (err) {
      console.error("Error loading data:", err)
    } finally {
      setLoading(false)
    }
  }

  // ============================================
  // FILTERED STUDENTS FOR SEARCH
  // ============================================
  
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students
    
    const query = searchQuery.toLowerCase().trim()
    return students.filter(s => 
      s.name.toLowerCase().includes(query) ||
      s.student_id.toLowerCase().includes(query) ||
      (s.class_roll && s.class_roll.toString().toLowerCase().includes(query)) ||
      (s.contact && s.contact.includes(query)) ||
      (s.fathers_contact && s.fathers_contact.includes(query)) ||
      (s.mothers_contact && s.mothers_contact.includes(query))
    )
  }, [students, searchQuery])

  // ============================================
  // FILTERED DISCOUNTS
  // ============================================
  
  const filteredDiscounts = useMemo(() => {
    let result = discounts
    
    if (filterScope !== "all") {
      result = result.filter(d => d.scope_type === filterScope)
    }
    
    return result
  }, [discounts, filterScope])

  // ============================================
  // STATS
  // ============================================
  
  const totalDiscounts = discounts.length
  const percentageCount = discounts.filter(d => d.type === "percentage").length
  const fixedCount = discounts.filter(d => d.type === "fixed").length
  const allScopeCount = discounts.filter(d => d.scope_type === "all").length
  const classScopeCount = discounts.filter(d => d.scope_type === "class").length
  const sectionScopeCount = discounts.filter(d => d.scope_type === "section").length
  const studentScopeCount = discounts.filter(d => d.scope_type === "student").length
  const siblingScopeCount = discounts.filter(d => d.scope_type === "sibling").length

  // ============================================
  // FORM HANDLERS
  // ============================================

  const handleSubmit = async () => {
    if (!formData.name || !formData.value || formData.applicable_categories.length === 0) {
      alert("Please fill all required fields and select at least one fee category")
      return
    }

    if (formData.scope_type === 'class' && !formData.scope_class_id) {
      alert("Please select a class")
      return
    }
    if (formData.scope_type === 'section' && !formData.scope_section_id) {
      alert("Please select a section")
      return
    }
    if (formData.scope_type === 'student' && formData.scope_student_ids.length === 0) {
      alert("Please select at least one student")
      return
    }

    setSubmitting(true)
    try {
      const discountData = {
        name: formData.name,
        type: formData.type,
        value: parseFloat(formData.value),
        applicable_categories: formData.applicable_categories,
        applicable_on: formData.applicable_categories.length === categories.length ? "all" : "multiple",
        is_active: true,
        scope_type: formData.scope_type,
        scope_class_id: formData.scope_type === 'class' ? formData.scope_class_id : null,
        scope_section_id: formData.scope_type === 'section' ? formData.scope_section_id : null,
        scope_student_ids: formData.scope_type === 'student' ? formData.scope_student_ids : [],
        sibling_group_id: formData.scope_type === 'sibling' ? formData.sibling_group_id : null,
        valid_from: formData.valid_from || null,
        valid_to: formData.valid_to || null,
      }

      if (editing) {
        await supabase
          .from("fee_discounts")
          .update(discountData)
          .eq("id", editing.id)
      } else {
        await supabase.from("fee_discounts").insert(discountData)
      }
      
      setModalOpen(false)
      resetForm()
      loadData()
    } catch (err) {
      console.error("Error saving discount:", err)
      alert("Failed to save discount")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this discount?")) return
    try {
      await supabase.from("fee_discounts").delete().eq("id", id)
      loadData()
    } catch (err) {
      console.error("Error deleting discount:", err)
    }
  }

  const resetForm = () => {
    setEditing(null)
    setFormData({ 
      name: "", 
      type: "percentage", 
      value: "", 
      applicable_categories: [],
      scope_type: "all",
      scope_class_id: "",
      scope_section_id: "",
      scope_student_ids: [],
      sibling_group_id: "",
      valid_from: "",
      valid_to: "",
    })
    setOpenCategorySelect(false)
    setOpenStudentSelect(false)
    setSearchQuery("")
  }

  const toggleCategory = (categoryId: string) => {
    setFormData(prev => ({
      ...prev,
      applicable_categories: prev.applicable_categories.includes(categoryId)
        ? prev.applicable_categories.filter(id => id !== categoryId)
        : [...prev.applicable_categories, categoryId]
    }))
  }

  const selectAllCategories = () => {
    if (formData.applicable_categories.length === categories.length) {
      setFormData(prev => ({ ...prev, applicable_categories: [] }))
    } else {
      setFormData(prev => ({ ...prev, applicable_categories: categories.map(c => c.id) }))
    }
  }

  // ============================================
  // LOADING STATE
  // ============================================

  if (loading) {
    return (
      <ResponsiveLayout>
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <div className="text-center space-y-3">
            <div className="relative w-10 h-10 mx-auto">
              <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
              <div className="absolute inset-0 rounded-full border-t-2 border-primary animate-spin" />
            </div>
            <p className="text-sm text-muted-foreground animate-pulse">Loading discounts...</p>
          </div>
        </div>
      </ResponsiveLayout>
    )
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <ResponsiveLayout>
      <div className="space-y-5 p-4 md:p-6 bg-gradient-to-br from-slate-50 via-white to-indigo-50/20 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/20">
        
        {/* ==========================================
            HEADER WITH GRADIENT
            ========================================== */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 p-4 shadow-md">
          <div className="absolute top-0 right-0 -mt-6 -mr-6 w-24 h-24 rounded-full bg-white/20 blur-2xl" />
          <div className="absolute bottom-0 left-0 -mb-6 -ml-6 w-24 h-24 rounded-full bg-yellow-400/20 blur-2xl" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" asChild className="bg-white/10 hover:bg-white/20 text-white border-white/20">
                <Link href="/fees">
                  <ArrowLeft className="h-5 w-5" />
                </Link>
              </Button>
              <div>
                <h1 className="text-xl font-bold text-white">Fee Discounts & Waivers</h1>
                <p className="text-white/80 text-xs">Apply discounts to specific students, classes, sections, or sibling groups</p>
              </div>
            </div>
            <Button 
              onClick={() => { resetForm(); setModalOpen(true); }} 
              className="bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 border-white/25 shadow-sm gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Discount
            </Button>
          </div>
        </div>

        {/* ==========================================
            STATS CARDS
            ========================================== */}
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-6">
          <StatCard title="Total" value={totalDiscounts} icon={Tag} gradient="from-purple-500 to-pink-500" iconBg="bg-gradient-to-br from-purple-500 to-pink-500" />
          <StatCard title="All Students" value={allScopeCount} icon={Users} gradient="from-blue-500 to-cyan-500" iconBg="bg-gradient-to-br from-blue-500 to-cyan-500" />
          <StatCard title="Class" value={classScopeCount} icon={School} gradient="from-purple-500 to-indigo-500" iconBg="bg-gradient-to-br from-purple-500 to-indigo-500" />
          <StatCard title="Section" value={sectionScopeCount} icon={Layers} gradient="from-indigo-500 to-purple-500" iconBg="bg-gradient-to-br from-indigo-500 to-purple-500" />
          <StatCard title="Students" value={studentScopeCount} icon={User} gradient="from-emerald-500 to-teal-500" iconBg="bg-gradient-to-br from-emerald-500 to-teal-500" />
          <StatCard title="Sibling" value={siblingScopeCount} icon={Users} gradient="from-pink-500 to-rose-500" iconBg="bg-gradient-to-br from-pink-500 to-rose-500" />
        </div>

        {/* ==========================================
            FILTERS & SEARCH
            ========================================== */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex flex-wrap gap-2">
            <Button 
              variant={filterScope === "all" ? "default" : "outline"} 
              size="sm"
              onClick={() => setFilterScope("all")}
              className={filterScope === "all" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}
            >
              All
            </Button>
            <Button 
              variant={filterScope === "all" ? "default" : "outline"} 
              size="sm"
              onClick={() => setFilterScope("all")}
              className={filterScope === "all" ? "bg-blue-500 hover:bg-blue-600 text-white" : ""}
            >
              <Users className="h-3 w-3 mr-1" /> All Students
            </Button>
            <Button 
              variant={filterScope === "class" ? "default" : "outline"} 
              size="sm"
              onClick={() => setFilterScope("class")}
              className={filterScope === "class" ? "bg-purple-500 hover:bg-purple-600 text-white" : ""}
            >
              <School className="h-3 w-3 mr-1" /> Class
            </Button>
            <Button 
              variant={filterScope === "section" ? "default" : "outline"} 
              size="sm"
              onClick={() => setFilterScope("section")}
              className={filterScope === "section" ? "bg-indigo-500 hover:bg-indigo-600 text-white" : ""}
            >
              <Layers className="h-3 w-3 mr-1" /> Section
            </Button>
            <Button 
              variant={filterScope === "student" ? "default" : "outline"} 
              size="sm"
              onClick={() => setFilterScope("student")}
              className={filterScope === "student" ? "bg-emerald-500 hover:bg-emerald-600 text-white" : ""}
            >
              <User className="h-3 w-3 mr-1" /> Students
            </Button>
            <Button 
              variant={filterScope === "sibling" ? "default" : "outline"} 
              size="sm"
              onClick={() => setFilterScope("sibling")}
              className={filterScope === "sibling" ? "bg-pink-500 hover:bg-pink-600 text-white" : ""}
            >
              <Users className="h-3 w-3 mr-1" /> Sibling
            </Button>
          </div>
          
          {filterScope !== "all" && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setFilterScope("all")}
              className="text-muted-foreground"
            >
              <X className="h-3 w-3 mr-1" /> Clear Filter
            </Button>
          )}
        </div>

        {/* ==========================================
            TABLE
            ========================================== */}
        <Card className="border-0 shadow-md overflow-hidden rounded-xl">
          <CardHeader className="py-3 px-4 bg-gradient-to-r from-primary/5 to-transparent border-b border-border/50 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-gray-900 dark:text-gray-100">
              <div className="p-1 rounded bg-gradient-to-r from-emerald-500 to-teal-500">
                <Tag className="h-3 w-3 text-white" />
              </div>
              All Discount Rules
              <Badge variant="secondary" className="ml-2 text-xs bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                {filteredDiscounts.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="py-2.5 px-4 text-xs font-semibold text-gray-700 dark:text-gray-300">Name</TableHead>
                    <TableHead className="py-2.5 px-4 text-xs font-semibold text-gray-700 dark:text-gray-300">Type</TableHead>
                    <TableHead className="py-2.5 px-4 text-xs font-semibold text-gray-700 dark:text-gray-300">Value</TableHead>
                    <TableHead className="py-2.5 px-4 text-xs font-semibold text-gray-700 dark:text-gray-300">Apply To</TableHead>
                    <TableHead className="py-2.5 px-4 text-xs font-semibold text-gray-700 dark:text-gray-300">Status</TableHead>
                    <TableHead className="py-2.5 px-4 text-right text-xs font-semibold text-gray-700 dark:text-gray-300">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDiscounts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10">
                        <div className="flex flex-col items-center gap-2">
                          <div className="h-12 w-12 bg-muted rounded-full flex items-center justify-center">
                            <Tag className="h-6 w-6 text-muted-foreground" />
                          </div>
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">No discounts found</p>
                          <p className="text-xs text-muted-foreground">Click "Add Discount" to create your first discount rule</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDiscounts.map((discount) => {
                      const discountBadge = getDiscountBadge(discount.type, discount.value)
                      const DiscountIcon = discountBadge.icon
                      const scopeBadge = getScopeBadge(discount.scope_type)
                      const ScopeIcon = scopeBadge.icon
                      
                      return (
                        <TableRow key={discount.id} className="group hover:bg-muted/30 transition-colors">
                          <TableCell className="py-2.5 px-4">
                            <div className="flex items-center gap-2">
                              <div className={`p-1.5 rounded-lg bg-gradient-to-br ${discountBadge.gradient} shadow-sm`}>
                                <DiscountIcon className="h-3 w-3 text-white" />
                              </div>
                              <span className="font-medium text-sm text-gray-900 dark:text-gray-100">{discount.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-2.5 px-4">
                            <Badge className={`capitalize bg-gradient-to-r ${discount.type === 'percentage' ? 'from-blue-500 to-cyan-500' : 'from-emerald-500 to-teal-500'} text-white border-0 px-2 py-0.5 text-xs`}>
                              {discount.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2.5 px-4">
                            <span className={`font-semibold text-sm ${discount.type === 'percentage' ? 'text-blue-600' : 'text-emerald-600'}`}>
                              {discount.type === "percentage" ? `${discount.value}%` : formatCurrency(discount.value)}
                            </span>
                          </TableCell>
                          <TableCell className="py-2.5 px-4">
                            <Badge className={`bg-gradient-to-r ${scopeBadge.color} text-white border-0 px-2 py-0.5 text-xs capitalize flex items-center gap-1 w-fit`}>
                              <ScopeIcon className="h-2.5 w-2.5" />
                              {scopeBadge.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2.5 px-4">
                            <Badge className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-0 px-2 py-0.5 text-xs gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-white/80 animate-pulse" />
                              Active
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                onClick={() => {
                                  setEditing(discount)
                                  setFormData({
                                    name: discount.name,
                                    type: discount.type,
                                    value: discount.value.toString(),
                                    applicable_categories: discount.applicable_categories || [],
                                    scope_type: discount.scope_type,
                                    scope_class_id: discount.scope_class_id || "",
                                    scope_section_id: discount.scope_section_id || "",
                                    scope_student_ids: discount.scope_student_ids || [],
                                    sibling_group_id: discount.sibling_group_id || "",
                                    valid_from: discount.valid_from || "",
                                    valid_to: discount.valid_to || "",
                                  })
                                  setModalOpen(true)
                                }}
                                className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                onClick={() => handleDelete(discount.id)}
                                className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
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
          </CardContent>
        </Card>
      </div>

      {/* ==========================================
          ADD/EDIT DISCOUNT MODAL
          ========================================== */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0 bg-white dark:bg-slate-900">
          {/* Modal Header */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-4 text-white sticky top-0 z-10">
            <DialogTitle className="text-white text-lg flex items-center gap-2">
              <Tag className="h-5 w-5" />
              {editing ? "Edit Discount" : "Create New Discount"}
            </DialogTitle>
          </div>
          
          <div className="p-5 space-y-4">
            {/* Discount Name */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Discount Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Early Bird Discount, Sibling Discount"
                className="h-10 bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            
            {/* Type & Value */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Type *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: any) => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger className="h-10 bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-900 dark:text-gray-100">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700">
                    <SelectItem value="percentage" className="text-gray-900 dark:text-gray-100">Percentage (%)</SelectItem>
                    <SelectItem value="fixed" className="text-gray-900 dark:text-gray-100">Fixed Amount (BDT)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Value *</Label>
                <Input
                  type="number"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  placeholder={formData.type === "percentage" ? "10" : "500"}
                  className="h-10 bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
            
            {/* Categories */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Select Fee Categories *</Label>
              <Popover open={openCategorySelect} onOpenChange={setOpenCategorySelect}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between h-10 bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-slate-700">
                    <span className="truncate">
                      {formData.applicable_categories.length === 0 ? (
                        "Select fee categories..."
                      ) : formData.applicable_categories.length === categories.length ? (
                        "All Categories Selected"
                      ) : (
                        `${formData.applicable_categories.length} categor${formData.applicable_categories.length === 1 ? 'y' : 'ies'} selected`
                      )}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0 bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700">
                  <Command className="bg-white dark:bg-slate-800">
                    <CommandInput placeholder="Search categories..." className="h-9 text-gray-900 dark:text-gray-100" />
                    <CommandList className="max-h-64">
                      <CommandEmpty className="text-gray-500 dark:text-gray-400">No category found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem onSelect={selectAllCategories} className="cursor-pointer text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-700">
                          <div className={cn(
                            "mr-2 flex h-4 w-4 items-center justify-center rounded border",
                            formData.applicable_categories.length === categories.length && categories.length > 0
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-gray-300 dark:border-gray-600"
                          )}>
                            {formData.applicable_categories.length === categories.length && categories.length > 0 && (
                              <Check className="h-3 w-3" />
                            )}
                          </div>
                          <Layers className="mr-2 h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Select All Categories</span>
                          <span className="ml-auto text-xs text-muted-foreground">
                            {categories.length} items
                          </span>
                        </CommandItem>
                        <div className="my-1 h-px bg-gray-200 dark:bg-gray-700" />
                        {categories.map((category) => (
                          <CommandItem
                            key={category.id}
                            onSelect={() => toggleCategory(category.id)}
                            className="cursor-pointer text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-700"
                          >
                            <div className={cn(
                              "mr-2 flex h-4 w-4 items-center justify-center rounded border",
                              formData.applicable_categories.includes(category.id)
                                ? "bg-primary border-primary text-primary-foreground"
                                : "border-gray-300 dark:border-gray-600"
                            )}>
                              {formData.applicable_categories.includes(category.id) && (
                                <Check className="h-3 w-3" />
                              )}
                            </div>
                            <div className="flex-1">
                              <span className="text-sm">{category.name}</span>
                              <span className="ml-2 text-xs text-muted-foreground">
                                {formatCurrency(category.amount)}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* SCOPE SELECTION */}
            <div className="space-y-2 border-t pt-4 mt-2 border-gray-200 dark:border-gray-700">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Apply To *</Label>
              <Select
                value={formData.scope_type}
                onValueChange={(value: any) => setFormData({ ...formData, scope_type: value })}
              >
                <SelectTrigger className="h-10 bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-900 dark:text-gray-100">
                  <SelectValue placeholder="Select scope" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700">
                  <SelectItem value="all" className="text-gray-900 dark:text-gray-100">🌐 All Students</SelectItem>
                  <SelectItem value="class" className="text-gray-900 dark:text-gray-100">🏫 Specific Class</SelectItem>
                  <SelectItem value="section" className="text-gray-900 dark:text-gray-100">📚 Specific Section</SelectItem>
                  <SelectItem value="student" className="text-gray-900 dark:text-gray-100">👤 Specific Students</SelectItem>
                  <SelectItem value="sibling" className="text-gray-900 dark:text-gray-100">👨‍👩‍👧‍👦 Sibling Discount</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Class Selection */}
            {formData.scope_type === 'class' && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Select Class</Label>
                <Select
                  value={formData.scope_class_id}
                  onValueChange={(value) => setFormData({ ...formData, scope_class_id: value })}
                >
                  <SelectTrigger className="h-10 bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-900 dark:text-gray-100">
                    <SelectValue placeholder="Select a class" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700">
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id} className="text-gray-900 dark:text-gray-100">{cls.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Section Selection */}
            {formData.scope_type === 'section' && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Select Section</Label>
                <Select
                  value={formData.scope_section_id}
                  onValueChange={(value) => setFormData({ ...formData, scope_section_id: value })}
                >
                  <SelectTrigger className="h-10 bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-900 dark:text-gray-100">
                    <SelectValue placeholder="Select a section" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700">
                    {sections.map((sec) => (
                      <SelectItem key={sec.id} value={sec.id} className="text-gray-900 dark:text-gray-100">
                        {sec.name} ({classes.find(c => c.id === sec.class_id)?.name})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Student Selection with Search */}
            {formData.scope_type === 'student' && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Select Students</Label>
                
                {/* Search Input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, ID, roll, or mobile..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-10 bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
                
                <Popover open={openStudentSelect} onOpenChange={setOpenStudentSelect}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between h-10 bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-slate-700">
                      <span className="truncate">
                        {formData.scope_student_ids.length === 0 
                          ? "Select students..." 
                          : `${formData.scope_student_ids.length} student(s) selected`}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[500px] p-0 bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700">
                    <Command className="bg-white dark:bg-slate-800">
                      <CommandInput placeholder="Search students..." className="h-9 text-gray-900 dark:text-gray-100" />
                      <CommandList className="max-h-64">
                        <CommandEmpty className="text-gray-500 dark:text-gray-400">No student found.</CommandEmpty>
                        <CommandGroup>
                          {filteredStudents.map((student) => (
                            <CommandItem
                              key={student.id}
                              onSelect={() => {
                                setFormData(prev => ({
                                  ...prev,
                                  scope_student_ids: prev.scope_student_ids.includes(student.id)
                                    ? prev.scope_student_ids.filter(id => id !== student.id)
                                    : [...prev.scope_student_ids, student.id]
                                }))
                              }}
                              className="cursor-pointer text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-700"
                            >
                              <div className={cn(
                                "mr-2 flex h-4 w-4 items-center justify-center rounded border",
                                formData.scope_student_ids.includes(student.id)
                                  ? "bg-primary border-primary text-primary-foreground"
                                  : "border-gray-300 dark:border-gray-600"
                              )}>
                                {formData.scope_student_ids.includes(student.id) && (
                                  <Check className="h-3 w-3" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">{student.name}</span>
                                  <span className="text-xs text-muted-foreground">({student.student_id})</span>
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                  <span>Roll: {student.class_roll || 'N/A'}</span>
                                  <span>|</span>
                                  <span>Class: {classes.find(c => c.id === student.class_id)?.name || 'N/A'}</span>
                                  <span>|</span>
                                  <span>Contact: {student.contact || student.fathers_contact || 'N/A'}</span>
                                </div>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                
                {/* Selected Students Preview */}
                {formData.scope_student_ids.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {formData.scope_student_ids.slice(0, 5).map((id) => {
                      const student = students.find(s => s.id === id)
                      return student ? (
                        <Badge key={id} variant="secondary" className="text-xs gap-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                          {student.name}
                          <button
                            onClick={() => {
                              setFormData(prev => ({
                                ...prev,
                                scope_student_ids: prev.scope_student_ids.filter(sid => sid !== id)
                              }))
                            }}
                            className="ml-1 hover:text-red-500"
                          >
                            ×
                          </button>
                        </Badge>
                      ) : null
                    })}
                    {formData.scope_student_ids.length > 5 && (
                      <Badge variant="secondary" className="text-xs bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                        +{formData.scope_student_ids.length - 5} more
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Sibling Group ID */}
            {formData.scope_type === 'sibling' && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Sibling Group ID</Label>
                <Input
                  value={formData.sibling_group_id}
                  onChange={(e) => setFormData({ ...formData, sibling_group_id: e.target.value })}
                  placeholder="Enter sibling group UUID (e.g., a1b2c3d4-...)"
                  className="h-10 font-mono text-xs bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-900 dark:text-gray-100"
                />
                <p className="text-[10px] text-muted-foreground">
                  Create a sibling group first in the database or use existing group ID
                </p>
              </div>
            )}

            {/* Valid From / To */}
            <div className="grid grid-cols-2 gap-4 border-t pt-4 mt-2 border-gray-200 dark:border-gray-700">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Valid From</Label>
                <Input
                  type="date"
                  value={formData.valid_from}
                  onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                  className="h-10 bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Valid To</Label>
                <Input
                  type="date"
                  value={formData.valid_to}
                  onChange={(e) => setFormData({ ...formData, valid_to: e.target.value })}
                  className="h-10 bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
          </div>
          
          <DialogFooter className="p-4 pt-0 gap-2 border-t border-gray-200 dark:border-gray-700">
            <Button variant="outline" onClick={() => setModalOpen(false)} className="border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800">
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={submitting || formData.applicable_categories.length === 0 || categories.length === 0} 
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md gap-2"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {editing ? "Update Discount" : "Create Discount"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ResponsiveLayout>
  )
}
