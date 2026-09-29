"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { 
  ArrowLeft,
  Download,
  Loader2,
  Plus,
  Search,
  DollarSign,
  Edit,
  Trash2,
  Eye
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { formatCurrency, formatDate } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { ResponsiveLayout } from "@/components/layout/responsive-layout"

const supabase = createClient()

type SaleStatus = 'completed' | 'cancelled' | 'returned'

interface SalesItem {
  id: string
  sale_id: string
  item_id: string
  quantity: number
  selling_price: number
  total_price: number
  item?: InventoryItem
}

interface InventoryItem {
  id: string
  item_code: string
  name: string
  unit: string
  current_stock: number
}

interface Student {
  id: string
  name: string
  student_id: string
}

interface InventorySale {
  id: string
  sale_no: string
  student_id?: string | null
  sale_date: string
  subtotal: number
  discount: number
  net_amount: number
  paid_amount: number
  due_amount: number
  status: SaleStatus
  narration?: string | null
  student?: Student
  items?: SalesItem[]
  created_at?: string
  updated_at?: string
}

export default function SalesPage() {
  const [sales, setSales] = useState<InventorySale[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedStatus, setSelectedStatus] = useState<SaleStatus | 'all'>('all')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  
  // Delete Dialog State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deletingName, setDeletingName] = useState("")
  const [deletingItems, setDeletingItems] = useState(0)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('inventory_sales')
        .select(`
          *,
          student:students(name, student_id),
          items:inventory_sale_items(*, item:inventory_items(*))
        `)
        .order('sale_date', { ascending: false })
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setSales(data || [])
    } catch (error) {
      console.error('Error loading sales:', error)
      toast.error('Failed to load sales')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    setSubmitting(true)
    try {
      const { data, error } = await supabase.rpc(
        'delete_sale_and_restore_stock',
        { p_sale_id: id }
      )

      if (error) {
        console.error('RPC Error:', error)
        toast.error(error.message || 'Failed to delete sale')
        return
      }

      if (data && data.success === false) {
        toast.error(data.error || data.message || 'Failed to delete sale')
        return
      }

      toast.success(data?.message || 'Sale deleted and stock restored')
      loadData()
    } catch (error: any) {
      console.error('Error deleting sale:', error)
      toast.error(error?.message || 'Failed to delete sale')
    } finally {
      setSubmitting(false)
      setDeleteDialogOpen(false)
      setDeletingId(null)
      setDeletingName("")
      setDeletingItems(0)
    }
  }

  const openDeleteDialog = (sale: InventorySale) => {
    setDeletingId(sale.id)
    setDeletingName(sale.sale_no)
    setDeletingItems(sale.items?.length || 0)
    setDeleteDialogOpen(true)
  }

  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        return s.sale_no.toLowerCase().includes(q) ||
               (s.student?.name || '').toLowerCase().includes(q)
      }
      if (selectedStatus !== 'all' && s.status !== selectedStatus) return false
      if (dateRange.start && s.sale_date < dateRange.start) return false
      if (dateRange.end && s.sale_date > dateRange.end) return false
      return true
    })
  }, [sales, searchQuery, selectedStatus, dateRange])

  const statusCounts = useMemo(() => {
    return sales.reduce((acc, s) => {
      acc[s.status] = (acc[s.status] || 0) + 1
      return acc
    }, {} as Record<SaleStatus, number>)
  }, [sales])

  const stats = {
    totalSales: sales.length,
    totalRevenue: sales.reduce((sum, s) => sum + (s.net_amount || 0), 0),
    totalItems: sales.reduce((sum, s) => sum + (s.items?.length || 0), 0),
    completed: statusCounts.completed || 0,
  }

  const getStatusBadge = (status: SaleStatus) => {
    const styles = {
      completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200',
      cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900/60 dark:text-gray-200',
      returned: 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200'
    }
    const labels = {
      completed: 'Completed',
      cancelled: 'Cancelled',
      returned: 'Returned'
    }
    return <Badge className={`text-xs ${styles[status]}`}>{labels[status]}</Badge>
  }

  return (
    <ResponsiveLayout>
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/inventory">
                <Button variant="ghost" size="sm" className="text-white hover:bg-white/10">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">Sales</h1>
                <p className="text-indigo-100 text-sm">POS - Sell books and uniforms to students</p>
              </div>
            </div>
            <Link href="/inventory/sales/new" className="flex items-center gap-2">
              <Button size="sm" className="bg-white text-indigo-700 hover:bg-indigo-50 font-semibold">
                <Plus className="h-4 w-4 mr-2" />
                New Sale
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-to-r from-purple-700 to-indigo-700 border-purple-600 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-white">Total Sales</CardTitle>
              <CardDescription className="text-purple-200 text-xs">All records</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{stats.totalSales}</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-green-700 to-emerald-700 border-green-600 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-white">Total Revenue</CardTitle>
              <CardDescription className="text-green-200 text-xs">BDT</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{formatCurrency(stats.totalRevenue)}</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-blue-700 to-cyan-700 border-blue-600 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-white">Items Sold</CardTitle>
              <CardDescription className="text-blue-200 text-xs">Total products</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{stats.totalItems}</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-amber-700 to-orange-700 border-amber-600 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-white">Completed</CardTitle>
              <CardDescription className="text-amber-200 text-xs">Successful sales</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{stats.completed}</div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by sale no or student..."
              className="pl-9 bg-white text-gray-900 border-gray-300"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={selectedStatus} onValueChange={(v) => setSelectedStatus(v as any)}>
            <SelectTrigger className="w-40 bg-white text-gray-900">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="returned">Returned</SelectItem>
            </SelectContent>
          </Select>
          {(searchQuery || selectedStatus !== 'all' || dateRange.start || dateRange.end) && (
            <Button variant="outline" size="sm" onClick={() => {
              setSearchQuery("")
              setSelectedStatus('all')
              setDateRange({ start: '', end: '' })
            }}>
              Clear
            </Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sales Records</CardTitle>
            <CardDescription>{filteredSales.length} sales found</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
              </div>
            ) : filteredSales.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No sales found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-purple-50 dark:bg-gray-100 border-b">
                      <th className="px-4 py-3 text-left font-medium text-gray-900 dark:text-gray-800">Sale No</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-900 dark:text-gray-800">Date</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-900 dark:text-gray-800">Student</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-900 dark:text-gray-800">Items</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-900 dark:text-gray-800">Total</th>
                      <th className="px-4 py-3 text-center font-medium text-gray-900 dark:text-gray-800">Status</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-900 dark:text-gray-800">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSales.map((sale) => (
                      <tr key={sale.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-100">
                        <td className="px-4 py-3 font-mono text-sm text-gray-900 dark:text-gray-800">{sale.sale_no}</td>
                        <td className="px-4 py-3 text-gray-800 dark:text-gray-700">{formatDate(sale.sale_date)}</td>
                        <td className="px-4 py-3">
                          {sale.student ? (
                            <div>
                              <div className="font-medium text-gray-900 dark:text-gray-800">{sale.student.name}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">{sale.student.student_id}</div>
                            </div>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-3 text-gray-800 dark:text-gray-700">{sale.items?.length || 0}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-gray-900 dark:text-gray-800">
                          {formatCurrency(sale.net_amount || sale.subtotal || 0)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {getStatusBadge(sale.status)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* View Button - ডিটেইল পেজে নিয়ে যাবে */}
                            <Link href={`/inventory/sales/${sale.id}`}>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                title="View Sale"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                            
                            {/* Edit Button */}
                            <Link href={`/inventory/sales/${sale.id}/edit`}>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                title="Edit Sale"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </Link>
                            
                            {/* Delete Button */}
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                              title="Delete Sale"
                              onClick={() => openDeleteDialog(sale)}
                              disabled={submitting}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog - ফিক্স করা হয়েছে */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sale?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-gray-500">
                <p>
                  This will permanently delete sale <strong>{deletingName}</strong>.
                </p>
                <div className="bg-emerald-50 dark:bg-emerald-950/30 p-3 rounded-lg border border-emerald-200 dark:border-emerald-800">
                  <p className="text-sm text-emerald-800 dark:text-emerald-200">
                    <span className="font-semibold">📦 {deletingItems}</span> item(s) will be 
                    <span className="text-emerald-600 font-semibold"> restored to inventory</span>.
                  </p>
                </div>
                <p className="text-xs text-red-600 font-medium">
                  ⚠️ This action cannot be undone.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deletingId && handleDelete(deletingId)}
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Yes, Delete & Restore Stock'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ResponsiveLayout>
  )
}
