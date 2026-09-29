"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { 
  Package,
  Plus,
  Loader2,
  Search,
  Boxes,
  TrendingUp,
  AlertTriangle,
  PackageX,
  DollarSign
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency } from "@/lib/utils"
import { toast } from "sonner"
import { ResponsiveLayout } from "@/components/layout/responsive-layout"

const supabase = createClient()

type ItemType = 'asset' | 'consumable' | 'saleable'

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
  category?: InventoryCategory
  created_at?: string
  updated_at?: string
}

interface InventoryCategory {
  id: string
  name: string
  description?: string | null
}

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [categories, setCategories] = useState<InventoryCategory[]>([])
  const [selectedType, setSelectedType] = useState<ItemType | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [itemsRes, categoriesRes] = await Promise.all([
        supabase.from('inventory_items').select('*, category:inventory_categories(*)').eq('is_active', true),
        supabase.from('inventory_categories').select('*').eq('is_active', true),
      ])

      if (itemsRes.error) throw itemsRes.error
      if (categoriesRes.error) throw categoriesRes.error

      setItems(itemsRes.data || [])
      setCategories(categoriesRes.data || [])
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Failed to load inventory data')
    } finally {
      setLoading(false)
    }
  }

  const filteredItems = items.filter(item => {
    if (selectedType !== 'all' && item.item_type !== selectedType) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return item.name.toLowerCase().includes(q) || 
             item.item_code.toLowerCase().includes(q)
    }
    return true
  })

  const stats = useMemo(() => {
    const assets = items.filter(i => i.item_type === 'asset')
    const consumables = items.filter(i => i.item_type === 'consumable')
    const saleables = items.filter(i => i.item_type === 'saleable')

    const totalValue = items.reduce((sum, i) => sum + (i.current_stock * i.purchase_price), 0)
    const lowStock = items.filter(i => i.current_stock <= i.reorder_level && i.current_stock > 0).length
    const outOfStock = items.filter(i => i.current_stock === 0).length

    return {
      totalItems: items.length,
      assets: assets.length,
      consumables: consumables.length,
      saleables: saleables.length,
      totalValue,
      lowStock,
      outOfStock,
    }
  }, [items])

  const getStatusBadge = (item: InventoryItem) => {
    if (item.current_stock === 0) {
      return <Badge variant="destructive" className="text-xs">Out of Stock</Badge>
    }
    if (item.current_stock <= item.reorder_level) {
      return <Badge variant="warning" className="text-xs">Low Stock</Badge>
    }
    return <Badge variant="success" className="text-xs">In Stock</Badge>
  }

  const getStockColor = (stock: number, reorder: number) => {
    if (stock === 0) return 'text-red-600 dark:text-red-400'
    if (stock <= reorder) return 'text-amber-600 dark:text-amber-400'
    return 'text-emerald-600 dark:text-emerald-400'
  }

  // Get category name from ID
  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return '-'
    const category = categories.find(c => c.id === categoryId)
    return category?.name || '-'
  }

  return (
    <ResponsiveLayout>
      <div className="space-y-6 p-4 sm:p-6">
        {/* Header */}
        <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">Inventory Management</h1>
              <p className="text-indigo-100 text-sm">Manage products, stock, and sales</p>
            </div>
            <Link href="/inventory/items/new" className="flex items-center gap-2">
              <Button size="sm" className="bg-white text-indigo-700 hover:bg-indigo-50 font-semibold w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Cards - 50% smaller in horizontal row */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3">
          <Card className="bg-gradient-to-r from-amber-700 to-orange-700 border-amber-600 shadow-md">
            <CardHeader className="p-2 sm:p-3 pb-1">
              <CardTitle className="text-[10px] sm:text-xs text-white flex items-center gap-1">
                <Boxes className="h-3 w-3" />
                Assets
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 sm:p-3 pt-0">
              <div className="text-sm sm:text-base font-bold text-white">{stats.assets}</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-blue-700 to-cyan-700 border-blue-600 shadow-md">
            <CardHeader className="p-2 sm:p-3 pb-1">
              <CardTitle className="text-[10px] sm:text-xs text-white flex items-center gap-1">
                <Package className="h-3 w-3" />
                Consumables
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 sm:p-3 pt-0">
              <div className="text-sm sm:text-base font-bold text-white">{stats.consumables}</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-emerald-700 to-teal-700 border-emerald-600 shadow-md">
            <CardHeader className="p-2 sm:p-3 pb-1">
              <CardTitle className="text-[10px] sm:text-xs text-white flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                Saleable
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 sm:p-3 pt-0">
              <div className="text-sm sm:text-base font-bold text-white">{stats.saleables}</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-green-700 to-emerald-700 border-green-600 shadow-md">
            <CardHeader className="p-2 sm:p-3 pb-1">
              <CardTitle className="text-[10px] sm:text-xs text-white flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                Stock Value
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 sm:p-3 pt-0">
              <div className="text-[11px] sm:text-sm font-bold text-white truncate">{formatCurrency(stats.totalValue)}</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-amber-700 to-yellow-700 border-amber-600 shadow-md">
            <CardHeader className="p-2 sm:p-3 pb-1">
              <CardTitle className="text-[10px] sm:text-xs text-white flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Low Stock
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 sm:p-3 pt-0">
              <div className="text-sm sm:text-base font-bold text-white">{stats.lowStock}</div>
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
              placeholder="Search by item name or code..."
              className="pl-9 bg-white text-gray-900 border-gray-300 h-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={selectedType} onValueChange={(v) => setSelectedType(v as any)}>
            <SelectTrigger className="w-full sm:w-40 bg-white text-gray-900 h-10">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="asset">Asset</SelectItem>
              <SelectItem value="consumable">Consumable</SelectItem>
              <SelectItem value="saleable">Saleable</SelectItem>
            </SelectContent>
          </Select>
          {(searchQuery || selectedType !== 'all') && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                setSearchQuery("")
                setSelectedType('all')
              }}
              className="h-10"
            >
              Clear
            </Button>
          )}
        </div>

        {/* Items Table */}
        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle>Items</CardTitle>
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
                      <TableHead className="text-gray-900 dark:text-slate-100 font-semibold">Item Name</TableHead>
                      <TableHead className="text-gray-900 dark:text-slate-100 font-semibold">Category</TableHead>
                      <TableHead className="text-gray-900 dark:text-slate-100 font-semibold">Type</TableHead>
                      <TableHead className="text-gray-900 dark:text-slate-100 font-semibold text-right">Stock</TableHead>
                      <TableHead className="text-gray-900 dark:text-slate-100 font-semibold text-right">Selling Price</TableHead>
                      <TableHead className="text-gray-900 dark:text-slate-100 font-semibold text-center">Status</TableHead>
                    </tr>
                  </thead>
                  <TableBody>
                    {filteredItems.map((item) => (
                      <TableRow key={item.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/30">
                        <TableCell className="font-mono text-xs text-gray-900 dark:text-gray-100">{item.item_code}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                            <span className="font-medium text-sm text-gray-900 dark:text-gray-100">{item.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-gray-800 dark:text-gray-200">
                            {getCategoryName(item.category_id)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${
                            item.item_type === 'asset' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200' :
                            item.item_type === 'consumable' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200' :
                            'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200'
                          }`}>
                            {item.item_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`font-medium text-sm ${getStockColor(item.current_stock, item.reorder_level)}`}>
                            {item.current_stock} {item.unit}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-gray-900 dark:text-gray-100">
                          {formatCurrency(item.selling_price)}
                        </TableCell>
                        <TableCell className="text-center">
                          {getStatusBadge(item)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ResponsiveLayout>
  )
}
