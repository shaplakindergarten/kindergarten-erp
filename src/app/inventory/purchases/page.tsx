"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Trash2,
  Search,
  Loader2,
  Plus,
  Eye,
  Edit as EditIcon,
  ShoppingBag,
  Package,
  DollarSign,
  CheckCircle2,
  XCircle,
  Clock
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency, formatDate } from "@/lib/utils"
import { toast } from "sonner"
import { ResponsiveLayout } from "@/components/layout/responsive-layout"

const supabase = createClient()

type PurchaseStatus = 'pending' | 'received' | 'cancelled'

interface Purchase {
  id: string
  purchase_no: string
  supplier_id: string | null
  purchase_date: string
  total_amount: number
  status: PurchaseStatus
  narration?: string | null
  supplier?: InventorySupplier
  purchase_items?: PurchaseItem[]
  created_at?: string
  updated_at?: string
}

interface PurchaseItem {
  id: string
  purchase_id: string
  item_id: string
  quantity: number
  purchase_price: number
  total_price: number
  item?: InventoryItem
}

interface InventorySupplier {
  id: string
  company_name: string
}

interface InventoryItem {
  id: string
  item_code: string
  name: string
  unit: string
}

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<(Purchase & { supplier_name: string; first_item_name?: string; first_item_qty?: number; total_items?: number; total_quantity?: number; avg_unit_price?: number })[]>([])
  const [suppliers, setSuppliers] = useState<InventorySupplier[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedStatus, setSelectedStatus] = useState<PurchaseStatus | 'all'>('all')
  const [selectedSupplier, setSelectedSupplier] = useState<string>('all')
  const [deletingPurchase, setDeletingPurchase] = useState<Purchase | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [purchasesRes, suppliersRes] = await Promise.all([
        supabase.from('inventory_purchases')
          .select(`*, supplier:inventory_suppliers(company_name), purchase_items:inventory_purchase_items(*, item:inventory_items(*))`)
          .order('purchase_date', { ascending: false }),
        supabase.from('inventory_suppliers')
          .select('id, company_name')
          .order('company_name'),
      ])

      if (purchasesRes.error) throw purchasesRes.error
      if (suppliersRes.error) throw suppliersRes.error

      const enrichedPurchases = (purchasesRes.data || []).map((p: any) => {
        const items = p.purchase_items || []
        const totalQuantity = items.reduce((sum: number, pi: any) => sum + (pi.quantity || 0), 0)
        const totalPrice = items.reduce((sum: number, pi: any) => sum + (pi.total_price || 0), 0)
        const avgUnitPrice = totalQuantity > 0 ? totalPrice / totalQuantity : 0
        
        // Get first item name for display
        let firstItemName = 'N/A'
        if (items.length > 0) {
          const firstItem = items[0]
          firstItemName = firstItem.item?.name || firstItem.item?.item_name || `Item #${firstItem.id.slice(0, 8)}`
        }
        
        return {
          ...p,
          supplier_name: p.supplier?.company_name || 'Unknown',
          total_items: items.length,
          total_quantity: totalQuantity,
          avg_unit_price: avgUnitPrice,
          first_item_name: firstItemName,
        }
      })

      setPurchases(enrichedPurchases)
      setSuppliers(suppliersRes.data || [])
    } catch (error) {
      console.error('Error loading purchases:', error)
      toast.error('Failed to load purchases')
    } finally {
      setLoading(false)
    }
  }

  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        return p.purchase_no.toLowerCase().includes(q) ||
               p.supplier_name.toLowerCase().includes(q)
      }
      if (selectedStatus !== 'all' && p.status !== selectedStatus) return false
      if (selectedSupplier !== 'all' && p.supplier_id !== selectedSupplier) return false
      return true
    })
  }, [purchases, searchQuery, selectedStatus, selectedSupplier])

  const statusConfig = {
    pending: { color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200', icon: Clock, label: 'Pending GRN' },
    received: { color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200', icon: CheckCircle2, label: 'Received' },
    cancelled: { color: 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200', icon: XCircle, label: 'Cancelled' },
  }

  const getStatusBadge = (status: PurchaseStatus) => {
    const config = statusConfig[status]
    const Icon = config.icon
    return (
      <Badge className={`text-xs flex items-center gap-1 px-2 py-0.5 ${config.color}`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    )
  }

  const handleDelete = async (purchase: Purchase) => {
    setDeletingPurchase(purchase)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!deletingPurchase) return
    
    setSubmitting(true)
    try {
      const { error } = await supabase
        .from('inventory_purchases')
        .update({ status: 'cancelled' })
        .eq('id', deletingPurchase.id)
      
      if (error) throw error
      toast.success('Purchase cancelled successfully')
      loadData()
    } catch (error) {
      console.error('Error deleting purchase:', error)
      toast.error('Failed to delete purchase')
    } finally {
      setSubmitting(false)
      setDeleteDialogOpen(false)
      setDeletingPurchase(null)
    }
  }

  const stats = {
    totalOrders: purchases.length,
    totalItems: purchases.reduce((sum, p) => sum + (p.total_items || 0), 0),
    totalAmount: purchases.reduce((sum, p) => sum + p.total_amount, 0),
    receivedOrders: purchases.filter(p => p.status === 'received').length,
    pendingOrders: purchases.filter(p => p.status === 'pending').length,
  }

  return (
    <ResponsiveLayout>
      <div className="space-y-3 p-3 sm:p-4">
        {/* Header */}
        <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg p-4 text-white shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Link href="/inventory">
                <Button variant="ghost" size="sm" className="text-white hover:bg-white/10 h-8 px-2">
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-bold">Purchases</h1>
                <p className="text-indigo-100 text-xs">Inward stock receiving & Purchase Orders</p>
              </div>
            </div>
            <Link href="/inventory/purchases/new" className="flex items-center gap-2">
              <Button size="sm" className="bg-white text-indigo-700 hover:bg-indigo-50 font-semibold h-8 text-xs">
                <Plus className="h-3 w-3 mr-1" />
                New Purchase
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <Card className="bg-gradient-to-r from-purple-700 to-indigo-700 border-purple-600 shadow-sm">
            <CardHeader className="p-2 pb-0">
              <CardTitle className="text-[10px] text-white flex items-center gap-1">
                <ShoppingBag className="h-3 w-3" />
                Orders
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 pt-0">
              <div className="text-sm font-bold text-white">{stats.totalOrders}</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-blue-700 to-cyan-700 border-blue-600 shadow-sm">
            <CardHeader className="p-2 pb-0">
              <CardTitle className="text-[10px] text-white flex items-center gap-1">
                <Package className="h-3 w-3" />
                Items
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 pt-0">
              <div className="text-sm font-bold text-white">{stats.totalItems}</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-emerald-700 to-teal-700 border-emerald-600 shadow-sm">
            <CardHeader className="p-2 pb-0">
              <CardTitle className="text-[10px] text-white flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                Amount
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 pt-0">
              <div className="text-[10px] font-bold text-white truncate">
                {formatCurrency(stats.totalAmount)}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-emerald-700 to-teal-700 border-emerald-600 shadow-sm">
            <CardHeader className="p-2 pb-0">
              <CardTitle className="text-[10px] text-white flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Received
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 pt-0">
              <div className="text-sm font-bold text-white">{stats.receivedOrders}</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-amber-700 to-orange-700 border-amber-600 shadow-sm">
            <CardHeader className="p-2 pb-0">
              <CardTitle className="text-[10px] text-white flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Pending
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 pt-0">
              <div className="text-sm font-bold text-white">{stats.pendingOrders}</div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
          <div className="relative flex-1 min-w-[150px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input
              placeholder="Search by PO no, supplier..."
              className="pl-8 bg-white text-gray-900 border-gray-300 h-8 text-xs"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={selectedStatus} onValueChange={(v) => setSelectedStatus(v as any)}>
            <SelectTrigger className="w-full sm:w-32 bg-white text-gray-900 h-8 text-xs">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending GRN</SelectItem>
              <SelectItem value="received">Received</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          {suppliers.length > 0 && (
            <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
              <SelectTrigger className="w-full sm:w-32 bg-white text-gray-900 h-8 text-xs">
                <SelectValue placeholder="All Suppliers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Suppliers</SelectItem>
                {suppliers.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.company_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {(searchQuery || selectedStatus !== 'all' || selectedSupplier !== 'all') && (
            <Button variant="outline" size="sm" onClick={() => {
              setSearchQuery("")
              setSelectedStatus('all')
              setSelectedSupplier('all')
            }} className="h-8 text-xs px-3">
              Clear
            </Button>
          )}
        </div>

        {/* Purchases Table */}
        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 shadow-sm">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-base">Purchase Orders</CardTitle>
            <CardDescription className="text-xs">{loading ? 'Loading...' : `${filteredPurchases.length} purchases found`}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
              </div>
            ) : filteredPurchases.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <ShoppingBag className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No purchases found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-purple-50 dark:bg-slate-800/50">
                      <TableHead className="px-3 py-2 text-left font-medium text-gray-900 dark:text-slate-100 text-xs">Purchase No</TableHead>
                      <TableHead className="px-3 py-2 text-left font-medium text-gray-900 dark:text-slate-100 text-xs">Date</TableHead>
                      <TableHead className="px-3 py-2 text-left font-medium text-gray-900 dark:text-slate-100 text-xs">Supplier</TableHead>
                      <TableHead className="px-3 py-2 text-left font-medium text-gray-900 dark:text-slate-100 text-xs">Item</TableHead>
                      <TableHead className="px-3 py-2 text-center font-medium text-gray-900 dark:text-slate-100 text-xs">Items</TableHead>
                      <TableHead className="px-3 py-2 text-center font-medium text-gray-900 dark:text-slate-100 text-xs">Qty</TableHead>
                      <TableHead className="px-3 py-2 text-right font-medium text-gray-900 dark:text-slate-100 text-xs">Unit Price</TableHead>
                      <TableHead className="px-3 py-2 text-right font-medium text-gray-900 dark:text-slate-100 text-xs">Total</TableHead>
                      <TableHead className="px-3 py-2 text-center font-medium text-gray-900 dark:text-slate-100 text-xs">Status</TableHead>
                      <TableHead className="px-3 py-2 text-right font-medium text-gray-900 dark:text-slate-100 text-xs">Actions</TableHead>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPurchases.map((purchase) => (
                      <TableRow key={purchase.id} className="border-b hover:bg-gray-50 dark:hover:bg-slate-800/30">
                        <TableCell className="px-3 py-2 font-mono text-xs text-gray-900 dark:text-gray-100">
                          {purchase.purchase_no}
                        </TableCell>
                        <TableCell className="px-3 py-2 text-gray-800 dark:text-slate-200">
                          {formatDate(purchase.purchase_date)}
                        </TableCell>
                        <TableCell className="px-3 py-2 font-medium text-gray-900 dark:text-slate-100">
                          {purchase.supplier_name}
                        </TableCell>
                        <TableCell className="px-3 py-2 text-gray-800 dark:text-slate-200 max-w-[120px] truncate">
                          {purchase.first_item_name || 'N/A'}
                        </TableCell>
                        <TableCell className="px-3 py-2 text-center">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {purchase.total_items || 0}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-3 py-2 text-center font-medium text-gray-900 dark:text-slate-100">
                          {purchase.total_quantity || 0}
                        </TableCell>
                        <TableCell className="px-3 py-2 text-right font-mono text-gray-900 dark:text-slate-100">
                          {purchase.total_quantity > 0 ? formatCurrency(purchase.avg_unit_price || 0) : '-'}
                        </TableCell>
                        <TableCell className="px-3 py-2 text-right font-mono font-medium text-gray-900 dark:text-slate-100">
                          {formatCurrency(purchase.total_amount)}
                        </TableCell>
                        <TableCell className="px-3 py-2 text-center">
                          {getStatusBadge(purchase.status)}
                        </TableCell>
                        <TableCell className="px-3 py-2 text-right">
                          <div className="flex items-center gap-0.5 justify-end">
                            <Link href={`/inventory/purchases/${purchase.id}`}>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                title="View Details"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            </Link>
                            {purchase.status !== 'cancelled' && (
                              <Link href={`/inventory/purchases/${purchase.id}/edit`}>
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className="h-7 w-7 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                  title="Edit Purchase"
                                >
                                  <EditIcon className="h-3.5 w-3.5" />
                                </Button>
                              </Link>
                            )}
                            <Button 
                              size="icon" 
                              variant="ghost"
                              title="Cancel Purchase"
                              onClick={() => handleDelete(purchase)}
                              disabled={submitting}
                              className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel Purchase Order</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel purchase order <strong>{deletingPurchase?.purchase_no}</strong>?
              <br />
              <span className="text-xs text-muted-foreground mt-1 block">
                This action cannot be undone. The purchase will be marked as cancelled.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} className="w-full sm:w-auto">
              Keep Order
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={submitting} className="w-full sm:w-auto">
              {submitting ? 'Cancelling...' : 'Cancel Order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ResponsiveLayout>
  )
}
