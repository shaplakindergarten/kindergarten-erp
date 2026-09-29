// src/app/inventory/reports/assets/page.tsx
"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { 
  ArrowLeft,
  Download,
  Loader2,
  Printer,
  Building2,
  Search,
  Filter,
  Eye,
  Plus,
  RefreshCw
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatCurrency, cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { format } from "date-fns"
import { ResponsiveLayout } from "@/components/layout/responsive-layout"
import { toast } from "sonner"

const supabase = createClient()

interface AssetItem {
  id: string
  item_code: string
  name: string
  category_id: string
  category_name?: string
  item_type: string
  unit: string
  purchase_price: number
  current_stock: number
  reorder_level: number
  location_rack: string
  is_active: boolean
  created_at: string
  purchase_count?: number
  total_purchase_value?: number
  issued_count?: number
  last_purchase_date?: string
}

export default function AssetRegisterPage() {
  const [assets, setAssets] = useState<AssetItem[]>([])
  const [filteredAssets, setFilteredAssets] = useState<AssetItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    loadAssets()
    loadCategories()
  }, [])

  useEffect(() => {
    let filtered = assets
    
    if (searchQuery) {
      filtered = filtered.filter(a => 
        a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.item_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.location_rack || "").toLowerCase().includes(searchQuery.toLowerCase())
      )
    }
    
    if (statusFilter === "active") {
      filtered = filtered.filter(a => a.is_active)
    } else if (statusFilter === "inactive") {
      filtered = filtered.filter(a => !a.is_active)
    } else if (statusFilter === "low_stock") {
      filtered = filtered.filter(a => a.current_stock <= a.reorder_level && a.current_stock > 0)
    } else if (statusFilter === "out_of_stock") {
      filtered = filtered.filter(a => a.current_stock === 0)
    }
    
    if (categoryFilter !== "all") {
      filtered = filtered.filter(a => a.category_id === categoryFilter)
    }
    
    setFilteredAssets(filtered)
  }, [assets, searchQuery, statusFilter, categoryFilter])

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_categories')
        .select('id, name')
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      setCategories(data || [])
    } catch (error) {
      console.error('Error loading categories:', error)
    }
  }

  const loadAssets = async () => {
    setLoading(true)
    try {
      // Get all asset items
      const { data: items, error: itemsError } = await supabase
        .from('inventory_items')
        .select(`
          *,
          category:inventory_categories(name)
        `)
        .eq('item_type', 'asset')
        .order('name')

      if (itemsError) throw itemsError

      // Get purchase summary for each asset
      const assetIds = items?.map(i => i.id) || []
      
      let purchaseData: any[] = []
      if (assetIds.length > 0) {
        const { data: purchases, error: purchasesError } = await supabase
          .from('inventory_purchase_items')
          .select(`
            item_id,
            quantity,
            unit_price,
            purchase:purchase_id(created_at)
          `)
          .in('item_id', assetIds)

        if (purchasesError) {
          console.error('Error loading purchase data:', purchasesError)
        } else {
          purchaseData = purchases || []
        }
      }

      // Get issuance summary for each asset
      let issuanceData: any[] = []
      if (assetIds.length > 0) {
        const { data: issuances, error: issuancesError } = await supabase
          .from('inventory_issuance_items')
          .select('item_id, quantity')
          .in('item_id', assetIds)

        if (issuancesError) {
          console.error('Error loading issuance data:', issuancesError)
        } else {
          issuanceData = issuances || []
        }
      }

      // Map data
      const mappedAssets: AssetItem[] = (items || []).map(item => {
        const itemPurchases = purchaseData.filter(p => p.item_id === item.id)
        const totalQuantity = itemPurchases.reduce((sum, p) => sum + (p.quantity || 0), 0)
        const totalValue = itemPurchases.reduce((sum, p) => sum + ((p.quantity || 0) * (p.unit_price || 0)), 0)
        const itemIssuances = issuanceData.filter(i => i.item_id === item.id)
        const issuedCount = itemIssuances.reduce((sum, i) => sum + (i.quantity || 0), 0)

        return {
          ...item,
          category_name: item.category?.name,
          purchase_count: itemPurchases.length,
          total_purchase_value: totalValue,
          issued_count: issuedCount,
          last_purchase_date: itemPurchases.length > 0 
            ? itemPurchases.sort((a, b) => new Date(b.purchase?.created_at).getTime() - new Date(a.purchase?.created_at).getTime())[0]?.purchase?.created_at
            : undefined
        }
      })

      setAssets(mappedAssets)
      setFilteredAssets(mappedAssets)
    } catch (error) {
      console.error('Error loading assets:', error)
      toast.error('Failed to load assets')
    } finally {
      setLoading(false)
    }
  }

  const totalAssets = filteredAssets.length
  const totalValue = filteredAssets.reduce((sum, a) => sum + (a.purchase_price || 0) * (a.current_stock || 0), 0)
  const activeAssets = filteredAssets.filter(a => a.is_active).length

  return (
    <ResponsiveLayout>
      <div className="space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:flex-row print:justify-between">
          <div className="flex items-center gap-4">
            <Link href="/inventory/reports">
              <Button variant="ghost" size="sm" className="print:hidden">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Reports
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
                <Building2 className="h-6 w-6 text-blue-500" />
                Asset Register
              </h1>
              <p className="text-muted-foreground">Track and manage fixed assets</p>
            </div>
          </div>
          <div className="flex gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button variant="outline" size="sm" onClick={loadAssets}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Link href="/inventory/items/new?type=asset">
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Asset
              </Button>
            </Link>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Total Assets</p>
              <p className="text-2xl font-bold">{totalAssets}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Active Assets</p>
              <p className="text-2xl font-bold text-emerald-500">{activeAssets}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Total Asset Value</p>
              <p className="text-2xl font-bold text-blue-500">{formatCurrency(totalValue)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Inactive Assets</p>
              <p className="text-2xl font-bold text-rose-500">{totalAssets - activeAssets}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, code, or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="low_stock">Low Stock</SelectItem>
              <SelectItem value="out_of_stock">Out of Stock</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Asset Table */}
        <Card>
          <CardHeader>
            <CardTitle>Asset List</CardTitle>
            <CardDescription>
              {filteredAssets.length} assets found
              {statusFilter !== "all" && ` (Filter: ${statusFilter})`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredAssets.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No assets found</p>
                <Link href="/inventory/items/new?type=asset">
                  <Button variant="outline" className="mt-4">
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Asset
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total Value</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAssets.map((asset) => {
                      const totalValue = (asset.purchase_price || 0) * (asset.current_stock || 0)
                      const isLowStock = asset.current_stock <= asset.reorder_level && asset.current_stock > 0
                      const isOutOfStock = asset.current_stock === 0

                      return (
                        <TableRow key={asset.id}>
                          <TableCell className="font-mono text-sm">{asset.item_code}</TableCell>
                          <TableCell className="font-medium">{asset.name}</TableCell>
                          <TableCell>{asset.category_name || '-'}</TableCell>
                          <TableCell>{asset.location_rack || '-'}</TableCell>
                          <TableCell className="text-right">
                            <span className={cn(
                              isOutOfStock ? "text-rose-500" : 
                              isLowStock ? "text-amber-500" : 
                              "text-emerald-500"
                            )}>
                              {asset.current_stock || 0}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(asset.purchase_price || 0)}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(totalValue)}</TableCell>
                          <TableCell>
                            <Badge variant={
                              isOutOfStock ? "destructive" :
                              isLowStock ? "outline" :
                              asset.is_active ? "default" : "secondary"
                            }>
                              {isOutOfStock ? "Out of Stock" :
                               isLowStock ? "Low Stock" :
                               asset.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Link href={`/inventory/assets/${asset.id}`}>
                              <Button variant="ghost" size="sm">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
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
    </ResponsiveLayout>
  )
}
