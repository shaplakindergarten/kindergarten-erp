"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Download,
  Plus,
  Search,
  Loader2,
  Package,
  Edit,
  Trash2,
  Eye,
  Boxes,
  DollarSign,
  PackageCheck,
  PackageX
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatCurrency } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { ResponsiveLayout } from "@/components/layout/responsive-layout"

const supabase = createClient()

type ItemType = 'asset' | 'consumable' | 'saleable'

const FIXED_CATEGORIES = [
  { value: 'asset', label: 'Asset' },
  { value: 'consumable', label: 'Consumable' },
  { value: 'saleable', label: 'Saleable' },
] as const

interface InventoryItem {
  id: string
  item_code: string
  name: string
  category_id: string | null
  item_type: ItemType
  unit: string
  purchase_price: number
  selling_price: number
  current_stock: number
  reorder_level: number
  location_rack?: string | null
  is_active: boolean
  created_at?: string
  updated_at?: string
  category?: { name: string }
}

export default function ItemsPage() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedType, setSelectedType] = useState<ItemType | 'all'>('all')
  const [selectedCategory, setSelectedCategory] = useState<ItemType | 'all'>('all')
  const [deletingItem, setDeletingItem] = useState<InventoryItem | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const itemsRes = await supabase
        .from('inventory_items')
        .select('*, category:inventory_categories(name)')
        .eq('is_active', true)

      if (itemsRes.error) throw itemsRes.error

      setItems(itemsRes.data || [])
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Failed to load items')
    } finally {
      setLoading(false)
    }
  }

  const filteredItems = items.filter(item => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (!item.name.toLowerCase().includes(q) && 
          !item.item_code.toLowerCase().includes(q)) {
        return false
      }
    }
    if (selectedType !== 'all' && item.item_type !== selectedType) return false
    if (selectedCategory !== 'all' && item.item_type !== selectedCategory) return false
    return true
  })

  const getStatus = (item: InventoryItem) => {
    if (item.current_stock === 0) return 'out_of_stock'
    if (item.current_stock <= item.reorder_level) return 'low_stock'
    return 'in_stock'
  }

  const stats = {
    totalItems: items.length,
    totalStockValue: items.reduce((sum, i) => sum + (i.current_stock * i.purchase_price), 0),
    outOfStock: items.filter(i => i.current_stock === 0).length,
    inStock: items.filter(i => i.current_stock > i.reorder_level).length,
  }

  const handleDelete = async (id: string, name: string) => {
    try {
      const { error } = await supabase
        .from('inventory_items')
        .update({ is_active: false })
        .eq('id', id)
      
      if (error) throw error
      toast.success('Item deleted successfully')
      loadData()
    } catch (error) {
      console.error('Error deleting item:', error)
      toast.error('Failed to delete item')
    }
  }

  const confirmDelete = (item: InventoryItem) => {
    setDeletingItem(item)
    setDeleteDialogOpen(true)
  }

  const executeDelete = () => {
    if (deletingItem) {
      handleDelete(deletingItem.id, deletingItem.name)
    }
    setDeleteDialogOpen(false)
    setDeletingItem(null)
  }

  const getTypeColor = (type: ItemType) => {
    const colors = {
      asset: 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 dark:border-amber-700',
      consumable: 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200 dark:border-blue-700',
      saleable: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200 dark:border-emerald-700',
    }
    return colors[type]
  }

  return (
    <ResponsiveLayout>
      <div className="space-y-6 p-4 sm:p-6">
        {/* Header */}
        <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link href="/inventory">
                <Button variant="ghost" size="sm" className="text-white hover:bg-white/10">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">Inventory Items</h1>
                <p className="text-indigo-100 text-sm">Product & Fixed Asset catalog</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/10">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Link href="/inventory/items/new">
                <Button size="sm" className="bg-white text-indigo-700 hover:bg-indigo-50 font-semibold">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Stats Cards - 50% smaller in horizontal row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <Card className="bg-gradient-to-r from-purple-700 to-indigo-700 border-purple-600 shadow-md">
            <CardHeader className="p-2 sm:p-3 pb-1">
              <CardTitle className="text-[10px] sm:text-xs text-white flex items-center gap-1">
                <Package className="h-3 w-3" />
                Total Items
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 sm:p-3 pt-0">
              <div className="text-sm sm:text-base font-bold text-white">{stats.totalItems}</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-blue-700 to-cyan-700 border-blue-600 shadow-md">
            <CardHeader className="p-2 sm:p-3 pb-1">
              <CardTitle className="text-[10px] sm:text-xs text-white flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                Stock Value
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 sm:p-3 pt-0">
              <div className="text-[11px] sm:text-sm font-bold text-white truncate">
                {formatCurrency(stats.totalStockValue)}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-emerald-700 to-teal-700 border-emerald-600 shadow-md">
            <CardHeader className="p-2 sm:p-3 pb-1">
              <CardTitle className="text-[10px] sm:text-xs text-white flex items-center gap-1">
                <PackageCheck className="h-3 w-3" />
                In Stock
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 sm:p-3 pt-0">
              <div className="text-sm sm:text-base font-bold text-white">{stats.inStock}</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-red-700 to-rose-700 border-red-600 shadow-md">
            <CardHeader className="p-2 sm:p-3 pb-1">
              <CardTitle className="text-[10px] sm:text-xs text-white flex items-center gap-1">
                <PackageX className="h-3 w-3" />
                Out of Stock
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 sm:p-3 pt-0">
              <div className="text-sm sm:text-base font-bold text-white">{stats.outOfStock}</div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filter - Horizontal Row */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by name or code..."
              className="pl-9 bg-white text-gray-900 border-gray-300 h-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={selectedType} onValueChange={(v) => setSelectedType(v as ItemType)}>
            <SelectTrigger className="w-full sm:w-40 bg-white text-gray-900 h-10">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {FIXED_CATEGORIES.map(cat => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full sm:w-40 bg-white text-gray-900 h-10">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {FIXED_CATEGORIES.map(cat => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(searchQuery || selectedType !== 'all' || selectedCategory !== 'all') && (
            <Button variant="outline" size="sm" onClick={() => {
              setSearchQuery("")
              setSelectedType('all')
              setSelectedCategory('all')
            }} className="h-10">
              Clear
            </Button>
          )}
        </div>

        {/* Items Table */}
        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle>Products</CardTitle>
            <CardDescription>{loading ? 'Loading...' : `${filteredItems.length} items found`}</CardDescription>
          </CardHeader>
          <CardContent className="p-0 sm:p-6 pt-0">
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No items found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-purple-50 dark:bg-slate-800/50">
                      <TableHead className="text-gray-900 dark:text-slate-100 font-semibold">Code</TableHead>
                      <TableHead className="text-gray-900 dark:text-slate-100 font-semibold">Name</TableHead>
                      <TableHead className="text-gray-900 dark:text-slate-100 font-semibold">Type</TableHead>
                      <TableHead className="text-gray-900 dark:text-slate-100 font-semibold text-right">Stock</TableHead>
                      <TableHead className="text-gray-900 dark:text-slate-100 font-semibold text-right">Purchase</TableHead>
                      <TableHead className="text-gray-900 dark:text-slate-100 font-semibold text-right">Selling</TableHead>
                      <TableHead className="text-gray-900 dark:text-slate-100 font-semibold text-center">Status</TableHead>
                      <TableHead className="text-gray-900 dark:text-slate-100 font-semibold text-right">Actions</TableHead>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item) => {
                      const status = getStatus(item)
                      const stockColor = status === 'out_of_stock' ? 'text-red-600 dark:text-red-400' :
                                        status === 'low_stock' ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                      return (
                        <TableRow key={item.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/30">
                          <TableCell className="font-mono text-xs text-gray-900 dark:text-gray-100">{item.item_code}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                              <span className="font-medium text-sm text-gray-900 dark:text-gray-100">{item.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={`text-xs ${getTypeColor(item.item_type)}`}>
                              {item.item_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={`font-medium text-sm ${stockColor}`}>
                              {item.current_stock} {item.unit}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm text-gray-900 dark:text-gray-100">
                            {formatCurrency(item.purchase_price)}
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium text-sm text-gray-900 dark:text-gray-100">
                            {formatCurrency(item.selling_price)}
                          </TableCell>
                          <TableCell className="text-center">
                            {status === 'out_of_stock' ? (
                              <Badge variant="destructive" className="text-xs">Out of Stock</Badge>
                            ) : status === 'low_stock' ? (
                              <Badge variant="warning" className="text-xs">Low Stock</Badge>
                            ) : (
                              <Badge variant="success" className="text-xs">In Stock</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center gap-1 justify-end">
                              <Link href={`/inventory/items/${item.id}`}>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" title="View Details">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </Link>
                              <Link href={`/inventory/items/${item.id}/edit`}>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50" title="Edit Item">
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </Link>
                              <Button 
                                size="icon" 
                                variant="ghost"
                                title="Delete Item"
                                onClick={() => confirmDelete(item)}
                                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
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
            <DialogTitle>Delete Item</DialogTitle>
            <DialogDescription>
              Are you sure you want to archive "{deletingItem?.name}"? This will soft-delete the item.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button variant="destructive" onClick={executeDelete} className="w-full sm:w-auto">
              Delete Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ResponsiveLayout>
  )
}
