"use client"

import { useState, useEffect } from "react"
import React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { 
  ArrowLeft,
  Edit,
  Trash2,
  Loader2,
  Package,
  Copy,
  MapPin,
  BarChart3
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { formatCurrency } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
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
  created_at?: string
  updated_at?: string
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default function ItemDetailPage({ params }: PageProps) {
  const router = useRouter()
  const [item, setItem] = useState<InventoryItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const resolvedParams = React.use(params)
  const itemId = resolvedParams.id

  useEffect(() => {
    loadItem()
  }, [itemId])

  const loadItem = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('id', itemId)
        .eq('is_active', true)
        .single()

      if (error) throw error
      setItem(data as InventoryItem)
    } catch (error) {
      console.error('Error loading item:', error)
      toast.error('Failed to load item')
      router.push('/inventory/items')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!item) return

    try {
      const { error } = await supabase
        .from('inventory_items')
        .update({ is_active: false })
        .eq('id', item.id)

      if (error) throw error

      toast.success('Item deleted successfully')
      router.push('/inventory/items')
    } catch (error) {
      console.error('Error deleting item:', error)
      toast.error('Failed to delete item')
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast('Copied to clipboard')
  }

  const getStatus = (stock: number, reorderLevel: number) => {
    if (stock === 0) return { status: 'out_of_stock', label: 'Out of Stock' }
    if (stock <= reorderLevel) return { status: 'low_stock', label: 'Low Stock' }
    return { status: 'in_stock', label: 'In Stock' }
  }

  if (loading) {
    return (
      <ResponsiveLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </ResponsiveLayout>
    )
  }

  if (!item) {
    return (
      <ResponsiveLayout>
        <div className="text-center py-12">
          <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground">Item not found</p>
        </div>
      </ResponsiveLayout>
    )
  }

  const statusInfo = getStatus(item.current_stock, item.reorder_level)

  return (
    <ResponsiveLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/inventory/items">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Link>
            </Button>
            <h1 className="text-2xl font-bold font-heading">{item.name}</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm">
              <Copy className="h-4 w-4 mr-2" />
              Copy Code
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/inventory/items/${item.id}/edit`}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowDeleteDialog(true)}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Item Information</CardTitle>
              <CardDescription>Basic details and classification</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Item Code</p>
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-sm bg-muted px-2 py-1 rounded">{item.item_code}</code>
                    <Button variant="ghost" size="sm" onClick={() => copyToClipboard(item.item_code)}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Item Type</p>
                  {item.item_type === 'asset' && (
                    <Badge className="text-xs capitalize bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200" variant="outline">
                      {item.item_type}
                    </Badge>
                  )}
                  {item.item_type === 'saleable' && (
                    <Badge className="text-xs capitalize bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200" variant="outline">
                      {item.item_type}
                    </Badge>
                  )}
                  {item.item_type === 'consumable' && (
                    <Badge className="text-xs capitalize bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200" variant="outline">
                      {item.item_type}
                    </Badge>
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Status</p>
                  <Badge className="text-xs" variant={
                    statusInfo.status === 'in_stock' ? 'success' : 
                    statusInfo.status === 'low_stock' ? 'warning' : 'error'
                  }>
                    {statusInfo.label}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Unit</p>
                  <p className="font-medium">{item.unit}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Stock Information</CardTitle>
                <CardDescription>Current inventory levels</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{item.current_stock}</p>
                    <p className="text-sm text-muted-foreground">Current Stock</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground"> Reorder Level</p>
                    <p className="font-medium">{item.reorder_level}</p>
                  </div>
                </div>
                <div className="border rounded-lg p-3">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Stock Level</span>
                    <span className="font-medium capitalize">{statusInfo.label}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${statusInfo.status === 'in_stock' ? 'bg-success' : statusInfo.status === 'low_stock' ? 'bg-warning' : 'bg-destructive'}`}
                      style={{ width: `${Math.min(item.current_stock / Math.max(item.reorder_level * 2, 1) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pricing</CardTitle>
                <CardDescription>Item cost and selling price</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Purchase Price</p>
                    <p className="font-medium">{formatCurrency(item.purchase_price)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Selling Price</p>
                    <p className="font-medium">{formatCurrency(item.selling_price)}</p>
                  </div>
                </div>
                <div className="pt-2 border-t">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Profit Margin</span>
                    <span className="font-medium">
                      {item.purchase_price > 0 
                        ? `${Math.round(((item.selling_price - item.purchase_price) / item.purchase_price) * 100)}%` 
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Potential Profit</span>
                    <span className="font-medium text-success">{formatCurrency(item.selling_price - item.purchase_price)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Item Location</CardTitle>
              <CardDescription>Where items are stored</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <MapPin className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">{item.location_rack || 'Not assigned'}</p>
                  <p className="text-sm text-muted-foreground">Storage location</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Item</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{item.name}"? This will archive the item.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                Delete Item
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ResponsiveLayout>
  )
}