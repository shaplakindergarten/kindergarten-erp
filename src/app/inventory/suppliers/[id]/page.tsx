"use client"

import { useState, useEffect } from "react"
import React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { 
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Loader2,
  Package
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { ResponsiveLayout } from "@/components/layout/responsive-layout"

const supabase = createClient()

type PurchaseStatus = 'pending' | 'received' | 'cancelled'

interface InventorySupplier {
  id: string
  company_name: string
  contact_person: string
  phone: string
  email?: string | null
  address?: string | null
  current_due: number
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
  created_at?: string
  updated_at?: string
}

interface Purchase {
  id: string
  purchase_no: string
  supplier_id: string
  purchase_date: string
  total_amount: number
  status: PurchaseStatus
  narration?: string | null
  created_at?: string
  updated_at?: string
  purchase_items?: PurchaseItem[]
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default function SupplierDetailPage({ params }: PageProps) {
  const router = useRouter()
  const [supplier, setSupplier] = useState<InventorySupplier | null>(null)
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)

  const resolvedParams = React.use(params)
  const supplierId = resolvedParams.id

  useEffect(() => {
    loadSupplier()
    loadPurchases()
  }, [supplierId])

  const loadSupplier = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_suppliers')
        .select('*')
        .eq('id', supplierId)
        .single()

      if (error) throw error
      setSupplier(data as InventorySupplier)
    } catch (error) {
      console.error('Error loading supplier:', error)
      toast.error('Failed to load supplier')
      router.push('/inventory/suppliers')
    }
  }

  const loadPurchases = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_purchases')
        .select('*, purchase_items: inventory_purchase_items(*)')
        .eq('supplier_id', supplierId)
        .order('purchase_date', { ascending: false })

      if (error) throw error
      setPurchases(data as Purchase[])
    } catch (error) {
      console.error('Error loading purchases:', error)
      toast.error('Failed to load purchases')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: PurchaseStatus) => {
    switch (status) {
      case 'received':
        return <Badge variant="success" className="text-xs">Received</Badge>
      case 'pending':
        return <Badge variant="warning" className="text-xs">Pending</Badge>
      case 'cancelled':
        return <Badge variant="error" className="text-xs">Cancelled</Badge>
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>
    }
  }

  const calculateTotals = () => {
    const totalPurchases = purchases.reduce((sum, p) => sum + p.total_amount, 0)
    const pendingPurchases = purchases.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.total_amount, 0)
    return { totalPurchases, pendingPurchases }
  }

  if (loading || !supplier) {
    return (
      <ResponsiveLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </ResponsiveLayout>
    )
  }

  const totals = calculateTotals()

  return (
    <ResponsiveLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/inventory/suppliers">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
          <h1 className="text-2xl font-bold font-heading">{supplier.company_name}</h1>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Current Due</CardTitle>
              <CardDescription>Outstanding amount</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {formatCurrency(supplier.current_due || 0)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Total Purchases</CardTitle>
              <CardDescription>All time purchases</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totals.totalPurchases)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Pending</CardTitle>
              <CardDescription>Pending GRN</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">{formatCurrency(totals.pendingPurchases)}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Supplier Information</CardTitle>
            <CardDescription>Contact and address details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Contact Person</p>
                  <p className="font-medium">{supplier.contact_person}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Phone</p>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{supplier.phone}</span>
                  </div>
                </div>
                {supplier.email && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Email</p>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{supplier.email}</span>
                    </div>
                  </div>
                )}
              </div>
              <div>
                {supplier.address ? (
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Address</p>
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <span className="font-medium text-sm">{supplier.address}</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Since</p>
                      <p className="font-medium">
                        {supplier.created_at ? new Date(supplier.created_at).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No address on file</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Purchases</CardTitle>
            <CardDescription>{purchases.length} total purchases</CardDescription>
          </CardHeader>
          <CardContent>
            {purchases.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No purchases recorded</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">PO No</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Items</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Total</th>
                      <th className="px-4 py-3 text-center font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchases.map(purchase => (
                      <tr key={purchase.id} className="border-b hover:bg-muted/30">
                        <td className="px-4 py-3 font-mono">{purchase.purchase_no}</td>
                        <td className="px-4 py-3">
                          {new Date(purchase.purchase_date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {purchase.purchase_items?.length || 0} items
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          {formatCurrency(purchase.total_amount)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {getStatusBadge(purchase.status)}
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
    </ResponsiveLayout>
  )
}