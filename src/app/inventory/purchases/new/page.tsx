"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { 
  ArrowLeft,
  Save,
  Loader2,
  Plus,
  Trash2,
  RefreshCw
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { CurrencyInput } from "@/components/currency-input"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency } from "@/lib/utils"
import { toast } from "sonner"
import { ResponsiveLayout } from "@/components/layout/responsive-layout"

const supabase = createClient()

type PurchaseStatus = 'pending' | 'received' | 'cancelled'
type ItemType = 'asset' | 'consumable' | 'saleable'

interface InventoryItem {
  id: string
  item_code: string
  name: string
  unit: string
  current_stock: number
  purchase_price: number
  selling_price: number
  category_id: string | null
  item_type: ItemType
  is_active: boolean
}

interface InventorySupplier {
  id: string
  company_name: string
  contact_person: string
  phone: string
  email?: string | null
  address?: string | null
  current_due: number
}

interface PurchaseItem {
  id: string
  purchase_id: string
  item_id: string
  quantity: number
  purchase_price: number
  total_price: number
  item?: InventoryItem
  created_at?: string
  updated_at?: string
}

interface NewPurchase {
  purchase_no: string
  supplier_id: string
  purchase_date: string
  narration?: string | null
  items: Array<{
    item_id: string
    quantity: number
    purchase_price: number
  }>
}

export default function NewPurchasePage() {
  const router = useRouter()
  const [suppliers, setSuppliers] = useState<InventorySupplier[]>([])
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  
  const [selectedSupplier, setSelectedSupplier] = useState<string>('')
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0])
  const [narration, setNarration] = useState('')
  const [purchaseItems, setPurchaseItems] = useState<Array<{
    item_id: string
    quantity: number
    purchase_price: number
  }>>([{ item_id: '', quantity: 0, purchase_price: 0 }])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [suppliersRes, itemsRes] = await Promise.all([
        supabase.from('inventory_suppliers').select('*').order('company_name'),
        supabase.from('inventory_items').select('*').eq('is_active', true).order('name'),
      ])

      if (suppliersRes.error) throw suppliersRes.error
      if (itemsRes.error) throw itemsRes.error

      setSuppliers(suppliersRes.data || [])
      setItems(itemsRes.data || [])
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const addItem = () => {
    setPurchaseItems([...purchaseItems, { item_id: '', quantity: 0, purchase_price: 0 }])
  }

  const removeItem = (index: number) => {
    if (purchaseItems.length > 1) {
      setPurchaseItems(purchaseItems.filter((_, i) => i !== index))
    }
  }

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...purchaseItems]
    newItems[index] = { ...newItems[index], [field]: value }
    
    if (field === 'item_id' && value) {
      const selectedItem = items.find(i => i.id === value)
      if (selectedItem && newItems[index].purchase_price === 0) {
        newItems[index].purchase_price = selectedItem.purchase_price
      }
    }
    
    setPurchaseItems(newItems)
  }

  const calculateTotal = () => {
    return purchaseItems.reduce((sum, item) => {
      return sum + (item.quantity * item.purchase_price)
    }, 0)
  }

  const generatePurchaseNo = () => {
    const date = new Date().toISOString().slice(2, 10).replace(/-/g, '')
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
    return `PUR-${date}-${random}`
  }

  const handleSubmit = async () => {
    if (!selectedSupplier) {
      toast.error('Please select a supplier')
      return
    }

    const validItems = purchaseItems.filter(i => i.item_id && i.quantity > 0 && i.purchase_price > 0)
    
    if (validItems.length === 0) {
      toast.error('Please add at least one valid item')
      return
    }

    setSubmitting(true)
    try {
      const purchaseDateObj = new Date(purchaseDate)
      const itemsParam = validItems.map(i => ({
        item_id: i.item_id,
        quantity: i.quantity,
        purchase_price: i.purchase_price
      }))

      const rpcPayload = {
        p_supplier_id: selectedSupplier,
        p_purchase_date: purchaseDateObj,
        p_narration: narration || null,
        p_items: itemsParam
      }

      console.log('========== PURCHASE RPC DEBUG ==========')
      console.log('RPC: create_inventory_purchase')
      console.log('p_supplier_id:', rpcPayload.p_supplier_id)
      console.log('p_purchase_date:', rpcPayload.p_purchase_date)
      console.log('p_narration:', rpcPayload.p_narration)
      console.log('p_items:', rpcPayload.p_items)
      console.log('p_items JSON:', JSON.stringify(rpcPayload.p_items, null, 2))
      console.log('p_items type:', typeof rpcPayload.p_items)
      console.log('p_items isArray:', Array.isArray(rpcPayload.p_items))
      console.log('=========================================')

      console.log('create_inventory_purchase RPC PAYLOAD:', JSON.stringify(rpcPayload, null, 2))

      const { data, error } = await supabase.rpc('create_inventory_purchase', rpcPayload)

      if (error) {
        console.error('========== PURCHASE RPC ERROR ==========')
        console.error('RAW ERROR:', error)
        console.error('ERROR TYPE:', typeof error)
        console.error('ERROR CONSTRUCTOR:', error?.constructor?.name)
        console.error('ERROR STRING:', String(error))

        try {
          console.error(
            'ERROR JSON:',
            JSON.stringify(
              error,
              Object.getOwnPropertyNames(error ?? {}),
              2
            )
          )
        } catch (jsonError) {
          console.error('ERROR JSON SERIALIZATION FAILED:', jsonError)
        }

        try {
          console.error(
            'ERROR PROPERTIES:',
            Object.getOwnPropertyNames(error ?? {})
          )
        } catch (propertyError) {
          console.error('ERROR PROPERTY INSPECTION FAILED:', propertyError)
        }

        console.error('ERROR MESSAGE:', error?.message)
        console.error('ERROR DETAILS:', error?.details)
        console.error('ERROR HINT:', error?.hint)
        console.error('ERROR CODE:', error?.code)
        console.error('ERROR STATUS:', (error as any)?.status)
        console.error('ERROR NAME:', error?.name)
        console.error('========================================')
        console.error('RPC RETURN DATA:', data)
        console.error('create_inventory_purchase RPC error:', error)
        throw error
      }

      toast.success('Purchase recorded successfully')
      router.push('/inventory/purchases')
    } catch (error: any) {
      console.error('Error creating purchase:', {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
        fullError: error
      })
      const errorMessage = error?.message || error?.details || 'Failed to create purchase'
      if (errorMessage.includes('INSUFFICIENT_STOCK')) {
        toast.error('Insufficient stock available')
      } else if (errorMessage.includes('INVALID_SUPPLIER')) {
        toast.error('Invalid supplier selected')
      } else if (errorMessage.includes('NO_ITEMS') || errorMessage.includes('INVALID_ITEM')) {
        toast.error('Invalid item selected')
      } else if (errorMessage.includes('INVALID_QUANTITY')) {
        toast.error('Invalid quantity entered')
      } else {
        toast.error(errorMessage)
      }
    } finally {
      setSubmitting(false)
    }
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

  return (
    <ResponsiveLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-bold font-heading">New Purchase Order</h1>
        </div>

      <Card>
        <CardHeader>
          <CardTitle>Purchase Details</CardTitle>
          <CardDescription>Record stock arrival and update inventory</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div>
              <Label htmlFor="supplier">Supplier</Label>
              <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="purchase_date">Purchase Date</Label>
              <Input
                id="purchase_date"
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="mt-2"
              />
            </div>
          </div>

          <div className="mb-6">
            <Label htmlFor="narration">Narration (optional)</Label>
            <Textarea
              id="narration"
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              placeholder="Brief description of the purchase..."
              rows={2}
              className="mt-2"
            />
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">Items</h3>
              <Button variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </Button>
            </div>
            
            <div className="space-y-3">
              {purchaseItems.map((item, index) => (
                <div key={index} className="grid md:grid-cols-5 gap-3 p-3 border rounded-lg">
                  <div>
                    <Label>Item</Label>
                    <Select 
                      value={item.item_id} 
                      onValueChange={(v) => updateItem(index, 'item_id', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select item" />
                      </SelectTrigger>
                      <SelectContent>
                        {items.map(i => (
                          <SelectItem key={i.id} value={i.id}>
                            {i.item_code} - {i.name} ({i.current_stock} in stock)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>Quantity ({items.find(i => i.id === item.item_id)?.unit || 'pcs'})</Label>
                    <CurrencyInput
                      value={item.quantity}
                      onValueChange={(value) => updateItem(index, 'quantity', value)}
                    />
                  </div>
                  
                  <div>
                    <Label>Purchase Price</Label>
                    <CurrencyInput
                      value={item.purchase_price}
                      onValueChange={(value) => updateItem(index, 'purchase_price', value)}
                    />
                  </div>
                  
                  <div className="pt-6 text-right font-mono font-bold text-lg">
                    {item.quantity * item.purchase_price}
                  </div>
                  
                  <div className="pt-6">
                    {purchaseItems.length > 1 ? (
                      <Button variant="ghost" size="sm" onClick={() => removeItem(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : (
                      <span className="text-sm text-muted-foreground">Items</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t pt-4 mb-6">
            <div className="flex justify-between items-center text-lg">
              <span className="text-muted-foreground">Total Amount:</span>
              <span className="font-bold text-primary">{formatCurrency(calculateTotal())}</span>
            </div>
          </div>

          <Button onClick={handleSubmit} disabled={submitting} className="w-full">
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Complete Purchase
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  </ResponsiveLayout>
)
}
