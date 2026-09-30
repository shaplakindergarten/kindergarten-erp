"use client"

import { useState, useEffect } from "react"
import React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { 
  ArrowLeft,
  Printer,
  Package,
  Phone,
  Mail,
  Loader2,
  Award
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

interface InventoryItem {
  id: string
  item_code: string
  name: string
  item_name?: string
  unit: string
}

interface PurchaseItem {
  id: string
  purchase_id: string
  item_id: string
  item_name?: string
  quantity: number
  unit_price?: number | null
  purchase_price?: number | null
  total_price: number
  item?: InventoryItem
}

interface InventorySupplier {
  id: string
  company_name: string
  contact_person: string
  phone: string
  email?: string | null
  address?: string | null
}

interface SchoolSettings {
  school_name: string
  school_address: string
  school_phone: string
  school_email: string
  school_logo: string | null
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
  supplier?: InventorySupplier
  purchase_items?: PurchaseItem[]
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default function PurchaseDetailPage({ params }: PageProps) {
  const router = useRouter()
  const [purchase, setPurchase] = useState<Purchase | null>(null)
  const [loading, setLoading] = useState(true)
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings | null>(null)

  const resolvedParams = React.use(params)
  const purchaseId = resolvedParams.id

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        console.log('🔍 Loading purchase:', purchaseId)
        
        // STEP 1: Load school settings directly
        const { data: settingsData, error: settingsError } = await supabase
          .from('school_settings')
          .select('school_name, school_address, school_phone, school_email, school_logo')
          .limit(1)
          .single()

        if (settingsError) {
          console.error('Error loading school settings:', settingsError)
        } else {
          setSchoolSettings(settingsData as SchoolSettings)
          console.log('✅ School settings loaded:', settingsData)
        }

        // STEP 2: Load purchase with supplier and items
        const { data, error } = await supabase
          .from('inventory_purchases')
          .select('*, supplier: inventory_suppliers(*), purchase_items: inventory_purchase_items(*, item: inventory_items(*))')
          .eq('id', purchaseId)
          .single()

        if (error) {
          console.error('Error loading purchase:', error)
          throw error
        }

        console.log('🛒 Purchase data loaded:', data)
        console.log('📦 Purchase items:', data.purchase_items)
        
        setPurchase(data as Purchase)
      } catch (error) {
        console.error('Error loading purchase:', error)
        toast.error('Failed to load purchase')
        router.push('/inventory/purchases')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [purchaseId, router])

  const getStatusBadge = (status: PurchaseStatus) => {
    switch (status) {
      case 'received':
        return <Badge variant="success" className="text-xs">Received</Badge>
      case 'pending':
        return <Badge variant="warning" className="text-xs">Pending GRN</Badge>
      case 'cancelled':
        return <Badge variant="error" className="text-xs">Cancelled</Badge>
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>
    }
  }

  const handlePrint = () => {
    if (!purchase) {
      toast.error('Purchase data not loaded')
      return
    }
    
    if (!schoolSettings) {
      toast.error('School settings not loaded yet')
      return
    }
    
    // Debug: Check purchase items
    console.log('🖨️ PRINTING - Purchase items:', purchase.purchase_items)
    console.log('🖨️ PRINTING - First item:', purchase.purchase_items?.[0])
    
    const itemsHtml = purchase.purchase_items && purchase.purchase_items.length > 0 
      ? purchase.purchase_items.map((item, index) => {
          const itemName = item.item_name || item.item?.item_name || item.item?.name || item.item_id || `Item ${index + 1}`
          const qty = Number(item.quantity) || 0
          const price = Number(item.unit_price ?? item.purchase_price ?? 0)
          const total = qty * price
          return `
            <tr>
              <td class="border px-4 py-2 text-center">${index + 1}</td>
              <td class="border px-4 py-2">${itemName}</td>
              <td class="border px-4 py-2 text-right">${qty}</td>
              <td class="border px-4 py-2 text-right">${formatCurrency(price)}</td>
              <td class="border px-4 py-2 text-right font-bold">${formatCurrency(total)}</td>
            </tr>
          `
        }).join('')
      : ''

    const supplierName = purchase.supplier?.company_name || 'Unknown'
    
    const printWindow = window.open('', '_blank', 'width=800,height=600')
    if (printWindow) {
      const schoolName = schoolSettings.school_name || ''
      const schoolAddress = schoolSettings.school_address || ''
      const schoolPhone = schoolSettings.school_phone || ''
      const schoolEmail = schoolSettings.school_email || ''
      const schoolLogo = schoolSettings.school_logo
      
      const logoHtml = schoolLogo 
        ? `<img src="${schoolLogo}" alt="${schoolName} Logo" class="school-logo" />`
        : ''
      
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Purchase Invoice - ${purchase.purchase_no}</title>
          <style>
            @page { size: A4 portrait; margin: 20mm; }
            body { font-family: Arial, sans-serif; margin: 0; padding: 20mm; background: white; }
            .invoice-header { text-align: center; margin-bottom: 20mm; }
            .school-logo { width: 60px; height: 60px; margin: 0 auto 10px; background: #e5e7eb; border-radius: 8px; object-fit: contain; }
            .school-name { font-size: 20px; font-weight: bold; margin: 5px 0; }
            .school-address { font-size: 12px; color: #6b7280; margin: 2px 0; }
            .school-contact { font-size: 11px; color: #6b7280; }
            .invoice-title { text-align: center; margin: 20mm 0 10mm; font-size: 24px; font-weight: bold; }
            .invoice-info { margin-bottom: 15mm; }
            .info-row { display: flex; justify-content: space-between; margin: 5px 0; }
            .info-label { font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 15mm; }
            th, td { border: 1px solid #ddd; }
            th { background: #f3f4f6; font-weight: bold; }
            td { padding: 8px 12px; }
            .grand-total { font-size: 18px; font-weight: bold; text-align: right; margin-top: 10mm; }
          </style>
        </head>
        <body>
          <div class="invoice-header">
            ${logoHtml}
            <div class="school-name">${schoolName}</div>
            <div class="school-address">${schoolAddress}</div>
            <div class="school-contact">
              Phone: ${schoolPhone} | Email: ${schoolEmail}
            </div>
          </div>
          
          <div class="invoice-title">PURCHASE INVOICE</div>
          
          <div class="invoice-info">
            <div class="info-row">
              <span class="info-label">Purchase No:</span>
              <span>${purchase.purchase_no}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Date:</span>
              <span>${new Date(purchase.purchase_date).toLocaleDateString()}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Supplier:</span>
              <span>${supplierName}</span>
            </div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Item Name</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml || `<tr><td colspan="5" class="text-center py-8">No items in this purchase</td></tr>`}
              <tr class="border-t">
                <td colspan="4" class="border px-4 py-2 text-right font-bold">Grand Total</td>
                <td class="border px-4 py-2 text-right font-bold">${formatCurrency(purchase.total_amount)}</td>
              </tr>
            </tbody>
          </table>
          
          <div style="margin-top: 20mm; display: flex; justify-content: space-between;">
            <div>
              <div style="margin-bottom: 40mm"></div>
              <div>Prepared By</div>
              <div>___________________________</div>
            </div>
            <div>
              <div style="margin-bottom: 40mm"></div>
              <div>Authorized Signature</div>
              <div>___________________________</div>
            </div>
          </div>
        </body>
        </html>
      `)
      printWindow.document.close()
      printWindow.focus()
      printWindow.print()
      printWindow.close()
    }
  }

  if (loading || !purchase) {
    return (
      <ResponsiveLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </ResponsiveLayout>
    )
  }

  return (
    <ResponsiveLayout>
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl p-4 text-white mb-4 print:shadow-none print:bg-white print:text-gray-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              <div>
                <h1 className="text-lg font-bold">{schoolSettings?.school_name || 'School Name'}</h1>
                <p className="text-xs opacity-90">{schoolSettings?.school_address || 'School Address'}</p>
                <p className="text-xs opacity-75 text-indigo-100">Purchase Invoice</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/inventory/purchases">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold font-heading">{purchase.purchase_no}</h1>
              <p className="text-muted-foreground">Purchase Invoice Details</p>
            </div>
          </div>
          <Button onClick={handlePrint} className="flex items-center gap-2">
            <Printer className="h-4 w-4" />
            Print
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Status</CardTitle>
              <CardDescription>Invoice status</CardDescription>
            </CardHeader>
            <CardContent>
              {getStatusBadge(purchase.status)}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Total Amount</CardTitle>
              <CardDescription>BDT</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(purchase.total_amount)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Items</CardTitle>
              <CardDescription>Purchased items</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{purchase.purchase_items?.length || 0}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Supplier Information</CardTitle>
              <CardDescription>Who supplied this order</CardDescription>
            </CardHeader>
            <CardContent>
              {purchase.supplier ? (
                <div className="space-y-3">
                  <div>
                    <p className="font-medium">{purchase.supplier.company_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {purchase.supplier.contact_person}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      {purchase.supplier.phone}
                    </div>
                    {purchase.supplier.email && (
                      <div className="flex items-center gap-1">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        {purchase.supplier.email}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">No supplier info</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Purchase Details</CardTitle>
              <CardDescription>When and why purchased</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Purchase Date</p>
                  <p className="font-medium">
                    {new Date(purchase.purchase_date).toLocaleDateString()}
                  </p>
                </div>
                {purchase.narration && (
                  <div>
                    <p className="text-sm text-muted-foreground">Narration</p>
                    <p className="font-medium">{purchase.narration}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="font-medium">
                    {purchase.created_at ? new Date(purchase.created_at).toLocaleString() : 'N/A'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Items Purchased</CardTitle>
            <CardDescription>{purchase.purchase_items?.length || 0} items</CardDescription>
          </CardHeader>
          <CardContent>
{purchase.purchase_items && purchase.purchase_items.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Item Name</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Qty</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Unit Price</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Total</th>
                    </tr>
                  </thead>
                  <tbody>
{purchase.purchase_items.map((item) => {
                      const itemName = item.item_name || item.item?.item_name || item.item?.name || item.item_id || `Item #${item.id.slice(0, 8)}`
                     
                       return (
                         <tr key={item.id} className="border-b hover:bg-muted/30">
                           <td className="px-4 py-3 font-medium">{itemName}</td>
                           <td className="px-4 py-3 text-right">{item.quantity}</td>
                           <td className="px-4 py-3 text-right font-mono">{formatCurrency(item.unit_price ?? item.purchase_price ?? 0)}</td>
                           <td className="px-4 py-3 text-right font-mono font-medium">{formatCurrency(item.total_price)}</td>
                         </tr>
                       )
                     })}
                    <tr className="border-t font-bold">
                      <td colSpan={3} className="px-4 py-3 text-right">Total</td>
                      <td className="px-4 py-3 text-right font-mono">
                        {formatCurrency(purchase.total_amount)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No items in this purchase</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ResponsiveLayout>
  )
}