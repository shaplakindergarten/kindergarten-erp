// src/app/inventory/reports/assets/[id]/page.tsx
"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { 
  ArrowLeft,
  Loader2,
  Printer,
  Edit,
  Building2,
  Calendar,
  MapPin,
  DollarSign,
  Package,
  History,
  FileText
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { formatCurrency, cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { format } from "date-fns"
import { ResponsiveLayout } from "@/components/layout/responsive-layout"
import { toast } from "sonner"

const supabase = createClient()

interface AssetDetail {
  id: string
  item_code: string
  name: string
  category_id: string
  category_name?: string
  item_type: string
  unit: string
  purchase_price: number
  selling_price: number
  current_stock: number
  reorder_level: number
  location_rack: string
  is_active: boolean
  created_at: string
  description?: string
}

interface PurchaseHistory {
  id: string
  purchase_no: string
  purchase_date: string
  quantity: number
  unit_price: number
  total_price: number
  supplier_name?: string
}

interface IssuanceHistory {
  id: string
  issue_no: string
  issuance_date: string
  quantity: number
  issued_to_name: string
  issued_to_type: string
  purpose: string
}

export default function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [asset, setAsset] = useState<AssetDetail | null>(null)
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseHistory[]>([])
  const [issuanceHistory, setIssuanceHistory] = useState<IssuanceHistory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAssetDetail()
  }, [id])

  const loadAssetDetail = async () => {
    setLoading(true)
    try {
      // Get asset details
      const { data: assetData, error: assetError } = await supabase
        .from('inventory_items')
        .select(`
          *,
          category:inventory_categories(name)
        `)
        .eq('id', id)
        .single()

      if (assetError) throw assetError

      setAsset({
        ...assetData,
        category_name: assetData.category?.name
      })

      // Get purchase history
      const { data: purchases, error: purchasesError } = await supabase
        .from('inventory_purchase_items')
        .select(`
          *,
          purchase:purchase_id(purchase_no, purchase_date, supplier:supplier_id(company_name))
        `)
        .eq('item_id', id)
        .order('created_at', { ascending: false })
        .limit(10)

      if (purchasesError) {
        console.error('Error loading purchases:', purchasesError)
      } else {
        setPurchaseHistory(purchases || [])
      }

      // Get issuance history
      const { data: issuances, error: issuancesError } = await supabase
        .from('inventory_issuance_items')
        .select(`
          *,
          issuance:issuance_id(issue_no, issuance_date, issued_to_name, issued_to_type, purpose)
        `)
        .eq('item_id', id)
        .order('created_at', { ascending: false })
        .limit(10)

      if (issuancesError) {
        console.error('Error loading issuances:', issuancesError)
      } else {
        setIssuanceHistory(issuances || [])
      }

    } catch (error) {
      console.error('Error loading asset:', error)
      toast.error('Asset not found')
      router.push('/inventory/reports/assets')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <ResponsiveLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </ResponsiveLayout>
    )
  }

  if (!asset) {
    return (
      <ResponsiveLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Asset not found</p>
          <Button variant="outline" className="mt-4" onClick={() => router.push('/inventory/reports/assets')}>
            Back to Assets
          </Button>
        </div>
      </ResponsiveLayout>
    )
  }

  const totalValue = (asset.purchase_price || 0) * (asset.current_stock || 0)
  const isLowStock = asset.current_stock <= asset.reorder_level && asset.current_stock > 0
  const isOutOfStock = asset.current_stock === 0

  return (
    <ResponsiveLayout>
      <div className="space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.back()} className="print:hidden">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
                <Building2 className="h-6 w-6 text-blue-500" />
                {asset.name}
              </h1>
              <p className="text-muted-foreground">Code: {asset.item_code}</p>
            </div>
          </div>
          <div className="flex gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/inventory/items/${id}/edit`}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Link>
            </Button>
          </div>
        </div>

        {/* Asset Summary */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Package className="h-4 w-4" />
                <span className="text-sm">Stock</span>
              </div>
              <p className={cn(
                "text-2xl font-bold",
                isOutOfStock ? "text-rose-500" : 
                isLowStock ? "text-amber-500" : 
                "text-emerald-500"
              )}>
                {asset.current_stock || 0} {asset.unit}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                <span className="text-sm">Unit Price</span>
              </div>
              <p className="text-2xl font-bold">{formatCurrency(asset.purchase_price || 0)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                <span className="text-sm">Total Value</span>
              </div>
              <p className="text-2xl font-bold text-blue-500">{formatCurrency(totalValue)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span className="text-sm">Location</span>
              </div>
              <p className="text-2xl font-bold truncate">{asset.location_rack || 'Not specified'}</p>
            </CardContent>
          </Card>
        </div>

        {/* Asset Details */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Asset Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Code</span>
                <span className="font-mono">{asset.item_code}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Category</span>
                <span>{asset.category_name || '-'}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Type</span>
                <Badge variant="outline">{asset.item_type}</Badge>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Unit</span>
                <span>{asset.unit}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Reorder Level</span>
                <span>{asset.reorder_level}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Status</span>
                <Badge variant={
                  isOutOfStock ? "destructive" :
                  isLowStock ? "outline" :
                  asset.is_active ? "default" : "secondary"
                }>
                  {isOutOfStock ? "Out of Stock" :
                   isLowStock ? "Low Stock" :
                   asset.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Additional Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Created</span>
                <span>{format(new Date(asset.created_at), 'dd MMM yyyy')}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Purchases</span>
                <span>{purchaseHistory.length}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Issuances</span>
                <span>{issuanceHistory.length}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">ID</span>
                <span className="font-mono text-sm truncate max-w-[150px]">{asset.id}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Purchase History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-5 w-5" />
              Purchase History
            </CardTitle>
            <CardDescription>Last 10 purchases</CardDescription>
          </CardHeader>
          <CardContent>
            {purchaseHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No purchase history</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Purchase No</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchaseHistory.map((purchase) => (
                    <TableRow key={purchase.id}>
                      <TableCell className="font-mono text-sm">{purchase.purchase_no}</TableCell>
                      <TableCell>{format(new Date(purchase.purchase_date), 'dd MMM yyyy')}</TableCell>
                      <TableCell>{purchase.supplier_name || '-'}</TableCell>
                      <TableCell className="text-right">{purchase.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(purchase.unit_price)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(purchase.total_price)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Issuance History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-5 w-5" />
              Issuance History
            </CardTitle>
            <CardDescription>Last 10 issuances</CardDescription>
          </CardHeader>
          <CardContent>
            {issuanceHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No issuance history</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Issue No</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Issued To</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Purpose</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {issuanceHistory.map((issuance) => (
                    <TableRow key={issuance.id}>
                      <TableCell className="font-mono text-sm">{issuance.issue_no}</TableCell>
                      <TableCell>{format(new Date(issuance.issuance_date), 'dd MMM yyyy')}</TableCell>
                      <TableCell className="font-medium">{issuance.issued_to_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize">
                          {issuance.issued_to_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{issuance.quantity}</TableCell>
                      <TableCell className="text-sm truncate max-w-[150px]">{issuance.purpose || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </ResponsiveLayout>
  )
}