"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { 
  ArrowLeft, Plus, Edit, Trash2, Loader2, AlertTriangle, 
  Clock, AlertCircle, TrendingUp, DollarSign, Zap, Sparkles 
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
import { ResponsiveLayout } from "@/components/layout/responsive-layout"
import { formatCurrency } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

const supabase = createClient()

interface FineRule {
  id: string
  name: string
  days_delay: number
  fine_type: "percentage" | "fixed"
  fine_value: number
  max_fine: number | null
  is_active: boolean
}

// Colorful Stat Card Component
const StatCard = ({ title, value, icon: Icon, gradient, iconBg, suffix = "" }: any) => (
  <Card className="group relative overflow-hidden border-none shadow-md hover:shadow-lg transition-all duration-300">
    <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-10 group-hover:opacity-20 transition-opacity duration-300`} />
    <CardContent className="p-4 relative z-10">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold tracking-tight">{value}{suffix}</p>
        </div>
        <div className={`p-2 rounded-xl ${iconBg} group-hover:scale-105 transition-transform duration-300 shadow-md`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </CardContent>
  </Card>
)

// Get fine type badge
const getFineTypeBadge = (type: string) => {
  if (type === "percentage") {
    return {
      label: "Percentage",
      gradient: "from-blue-500 to-cyan-500",
      icon: TrendingUp
    }
  }
  return {
    label: "Fixed Amount",
    gradient: "from-emerald-500 to-teal-500",
    icon: DollarSign
  }
}

export default function FineRulesPage() {
  const [rules, setRules] = useState<FineRule[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<FineRule | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    days_delay: "",
    fine_type: "percentage" as "percentage" | "fixed",
    fine_value: "",
    max_fine: "",
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadRules()
  }, [])

  async function loadRules() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("fine_rules")
        .select("*")
        .order("days_delay")
      
      if (error) throw error
      setRules(data || [])
    } catch (err) {
      console.error("Error loading fine rules:", err)
      setRules([])
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!formData.name || !formData.days_delay || !formData.fine_value) {
      alert("Please fill all required fields")
      return
    }

    setSubmitting(true)
    try {
      if (editing) {
        await supabase
          .from("fine_rules")
          .update({
            name: formData.name,
            days_delay: parseInt(formData.days_delay),
            fine_type: formData.fine_type,
            fine_value: parseFloat(formData.fine_value),
            max_fine: formData.max_fine ? parseFloat(formData.max_fine) : null,
          })
          .eq("id", editing.id)
      } else {
        await supabase.from("fine_rules").insert({
          name: formData.name,
          days_delay: parseInt(formData.days_delay),
          fine_type: formData.fine_type,
          fine_value: parseFloat(formData.fine_value),
          max_fine: formData.max_fine ? parseFloat(formData.max_fine) : null,
          is_active: true,
        })
      }
      
      setModalOpen(false)
      resetForm()
      loadRules()
    } catch (err) {
      console.error("Error saving fine rule:", err)
      alert("Failed to save fine rule")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this fine rule?")) return
    try {
      await supabase.from("fine_rules").delete().eq("id", id)
      loadRules()
    } catch (err) {
      console.error("Error deleting fine rule:", err)
    }
  }

  const resetForm = () => {
    setEditing(null)
    setFormData({ name: "", days_delay: "", fine_type: "percentage", fine_value: "", max_fine: "" })
  }

  // Calculate stats
  const totalRules = rules.length
  const activeRules = rules.filter(r => r.is_active).length
  const percentageRules = rules.filter(r => r.fine_type === "percentage").length
  const fixedRules = rules.filter(r => r.fine_type === "fixed").length
  const highestDelay = rules.length > 0 ? Math.max(...rules.map(r => r.days_delay)) : 0

  if (loading) {
    return (
      <ResponsiveLayout>
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <div className="text-center space-y-3">
            <div className="relative w-10 h-10 mx-auto">
              <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
              <div className="absolute inset-0 rounded-full border-t-2 border-primary animate-spin" />
            </div>
            <p className="text-sm text-muted-foreground animate-pulse">Loading fine rules...</p>
          </div>
        </div>
      </ResponsiveLayout>
    )
  }

  return (
    <ResponsiveLayout>
      <div className="space-y-5 p-4 md:p-6 bg-gradient-to-br from-slate-50 via-white to-orange-50/20 dark:from-slate-950 dark:via-slate-900 dark:to-orange-950/20">
        
        {/* Colorful Header with Gradient Background */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-orange-600 via-amber-600 to-yellow-600 p-4 shadow-md">
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
                <h1 className="text-xl font-bold text-white">Fine Rules & Penalties</h1>
                <p className="text-white/80 text-xs">Setup late payment fine rules and penalties</p>
              </div>
            </div>
            <Button 
              onClick={() => { resetForm(); setModalOpen(true); }} 
              className="bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 border-white/25 shadow-sm gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Fine Rule
            </Button>
          </div>
        </div>

        {/* Colorful Stats Cards */}
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-5">
          <StatCard 
            title="Total Rules" 
            value={totalRules} 
            icon={AlertTriangle}
            gradient="from-red-500 to-rose-500"
            iconBg="bg-gradient-to-br from-red-500 to-rose-500"
          />
          <StatCard 
            title="Active Rules" 
            value={activeRules} 
            icon={Zap}
            gradient="from-emerald-500 to-teal-500"
            iconBg="bg-gradient-to-br from-emerald-500 to-teal-500"
          />
          <StatCard 
            title="Percentage Rules" 
            value={percentageRules} 
            icon={TrendingUp}
            gradient="from-blue-500 to-cyan-500"
            iconBg="bg-gradient-to-br from-blue-500 to-cyan-500"
          />
          <StatCard 
            title="Fixed Fine" 
            value={fixedRules} 
            icon={DollarSign}
            gradient="from-purple-500 to-pink-500"
            iconBg="bg-gradient-to-br from-purple-500 to-pink-500"
          />
          <StatCard 
            title="Max Delay" 
            value={highestDelay} 
            icon={Clock}
            gradient="from-orange-500 to-amber-500"
            iconBg="bg-gradient-to-br from-orange-500 to-amber-500"
            suffix=" days"
          />
        </div>

        {/* Table with Colorful Badges */}
        <Card className="border-0 shadow-md overflow-hidden rounded-xl">
          <CardHeader className="py-3 px-4 bg-gradient-to-r from-orange-500/10 to-transparent border-b border-border/50">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className="p-1 rounded bg-gradient-to-r from-orange-500 to-amber-500">
                <AlertTriangle className="h-3 w-3 text-white" />
              </div>
              All Fine Rules
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="py-2.5 px-4 text-xs font-semibold">Rule Name</TableHead>
                    <TableHead className="py-2.5 px-4 text-xs font-semibold">Days Delay</TableHead>
                    <TableHead className="py-2.5 px-4 text-xs font-semibold">Fine Type</TableHead>
                    <TableHead className="py-2.5 px-4 text-xs font-semibold">Fine Amount</TableHead>
                    <TableHead className="py-2.5 px-4 text-xs font-semibold">Max Fine</TableHead>
                    <TableHead className="py-2.5 px-4 text-xs font-semibold">Status</TableHead>
                    <TableHead className="py-2.5 px-4 text-right text-xs font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10">
                        <div className="flex flex-col items-center gap-2">
                          <div className="h-12 w-12 bg-muted rounded-full flex items-center justify-center">
                            <AlertTriangle className="h-6 w-6 text-muted-foreground" />
                          </div>
                          <p className="text-sm font-medium">No fine rules found</p>
                          <p className="text-xs text-muted-foreground">Click "Add Fine Rule" to create your first penalty rule</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    rules.map((rule) => {
                      const fineBadge = getFineTypeBadge(rule.fine_type)
                      const FineIcon = fineBadge.icon
                      const isHighFine = rule.fine_type === "percentage" && rule.fine_value > 10
                      
                      return (
                        <TableRow key={rule.id} className="group hover:bg-muted/30 transition-colors">
                          <TableCell className="py-2.5 px-4">
                            <div className="flex items-center gap-2">
                              <div className={`p-1.5 rounded-lg bg-gradient-to-br ${fineBadge.gradient} shadow-sm`}>
                                <FineIcon className="h-3 w-3 text-white" />
                              </div>
                              <span className="font-medium text-sm">{rule.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-2.5 px-4">
                            <Badge className="bg-gradient-to-r from-orange-500 to-amber-500 text-white border-0 px-2 py-0.5 text-xs gap-1">
                              <Clock className="h-2.5 w-2.5" />
                              {rule.days_delay} days
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2.5 px-4">
                            <Badge className={`capitalize bg-gradient-to-r ${fineBadge.gradient} text-white border-0 px-2 py-0.5 text-xs`}>
                              {fineBadge.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2.5 px-4">
                            <span className={`font-semibold text-sm ${isHighFine ? 'text-red-600' : rule.fine_type === 'percentage' ? 'text-blue-600' : 'text-emerald-600'}`}>
                              {rule.fine_type === "percentage" ? `${rule.fine_value}%` : formatCurrency(rule.fine_value)}
                            </span>
                          </TableCell>
                          <TableCell className="py-2.5 px-4">
                            <span className="text-sm">
                              {rule.max_fine ? formatCurrency(rule.max_fine) : "No limit"}
                            </span>
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
                                  setEditing(rule)
                                  setFormData({
                                    name: rule.name,
                                    days_delay: rule.days_delay.toString(),
                                    fine_type: rule.fine_type,
                                    fine_value: rule.fine_value.toString(),
                                    max_fine: rule.max_fine?.toString() || "",
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
                                onClick={() => handleDelete(rule.id)}
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

      {/* Dialog with Solid Gradient Background */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-white dark:bg-slate-900">
          {/* Dialog Header with Gradient */}
          <div className="bg-gradient-to-r from-orange-600 via-amber-600 to-yellow-600 p-4 text-white">
            <DialogTitle className="text-white text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              {editing ? "Edit Fine Rule" : "Create New Fine Rule"}
            </DialogTitle>
          </div>
          
          <div className="p-5 space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Rule Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Late Fee - 1 Month"
                className="h-10 bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  Days Delay *
                </Label>
                <Input
                  type="number"
                  value={formData.days_delay}
                  onChange={(e) => setFormData({ ...formData, days_delay: e.target.value })}
                  placeholder="30"
                  className="h-10 bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700"
                />
                <p className="text-[10px] text-muted-foreground">After how many days fine applies</p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Fine Type</Label>
                <select
                  value={formData.fine_type}
                  onChange={(e) => setFormData({ ...formData, fine_type: e.target.value as "percentage" | "fixed" })}
                  className="w-full h-10 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed Amount (BDT)</option>
                </select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Fine Value *</Label>
                <Input
                  type="number"
                  value={formData.fine_value}
                  onChange={(e) => setFormData({ ...formData, fine_value: e.target.value })}
                  placeholder={formData.fine_type === "percentage" ? "5" : "500"}
                  className="h-10 bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Maximum Fine (Optional)</Label>
                <Input
                  type="number"
                  value={formData.max_fine}
                  onChange={(e) => setFormData({ ...formData, max_fine: e.target.value })}
                  placeholder="e.g., 5000"
                  className="h-10 bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700"
                />
                <p className="text-[10px] text-muted-foreground">Leave empty for no limit</p>
              </div>
            </div>
          </div>
          
          <DialogFooter className="p-4 pt-0 gap-2">
            <Button variant="outline" onClick={() => setModalOpen(false)} className="border-gray-200 dark:border-slate-700">
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting} className="bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white shadow-md gap-2">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {editing ? "Update Rule" : "Create Rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ResponsiveLayout>
  )
}
