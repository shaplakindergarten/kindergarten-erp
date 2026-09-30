"use client"

import { useState, useEffect } from "react"
import React from "react"
import { useRouter } from "next/navigation"
import { 
  ArrowLeft,
  Save,
  Loader2,
  Plus,
  Trash2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency } from "@/lib/utils"
import { toast } from "sonner"
import { ResponsiveLayout } from "@/components/layout/responsive-layout"
import { convertBanglaToEnglishDigits } from "@/lib/utils"

const supabase = createClient()

type PurchaseStatus = 'pending' | 'received' | 'cancelled'

interface InventoryItem {
  id: string
  item_code: string
  name: string
  unit: string
  current_stock: number
  purchase_price: number
  selling_price: number
  unit_price?: number
  category_id: string | null
  item_type: 'asset' | 'consumable' | 'saleable'
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

interface PageProps {
  params: Promise<{ id: string }>
}

// Number Input Component with Bangla/English support
function NumberInput({ 
  value, 
  onChange, 
  min = 0,
  placeholder = "0",
  className = ""
}: { 
  value: number, 
  onChange: (value: number) => void,
  min?: number,
  placeholder?: string,
  className?: string
}) {
  const [displayValue, setDisplayValue] = useState(value > 0 ? value.toString() : '')

  useEffect(() => {
    if (value > 0) {
      setDisplayValue(value.toString())
    } else {
      setDisplayValue('')
    }
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value
    const englishValue = convertBanglaToEnglishDigits(rawValue)
    setDisplayValue(englishValue)
    
    const numValue = parseFloat(englishValue)
    if (!isNaN(numValue) && numValue >= min) {
      onChange(numValue)
    } else if (englishValue === '' || englishValue === '-') {
      onChange(0)
    }
  }

  const handleBlur = () => {
    if (displayValue === '' || isNaN(parseFloat(displayValue))) {
      setDisplayValue('')
      onChange(0)
    } else {
      const numValue = parseFloat(displayValue)
      if (numValue >= min) {
        setDisplayValue(numValue.toString())
        onChange(numValue)
      } else {
        setDisplayValue('')
        onChange(0)
      }
    }
  }

  const handleFocus = () => {
    if (value === 0) {
      setDisplayValue('')
    } else {
      setDisplayValue(value.toString())
    }
  }

  return (
    <Input
      type="text"
      inputMode="decimal"
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className}
    />
  )
}

export default function PurchaseEditPage({ params }: PageProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [suppliers, setSuppliers] = useState<InventorySupplier[]>([])
  const [items, setItems] = useState<InventoryItem[]>([])
  
  const [purchaseNo, setPurchaseNo] = useState('')
  const [selectedSupplier, setSelectedSupplier] = useState<string>('')
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0])
  const [narration, setNarration] = useState('')
  const [status, setStatus] = useState<PurchaseStatus>('received')
  const [purchaseItems, setPurchaseItems] = useState<Array<{
    id?: string
    item_id: string
    quantity: number
    purchase_price: number
  }>>([{ item_id: '', quantity: 0, purchase_price: 0 }])

  const resolvedParams = React.use(params)
  const purchaseId = resolvedParams.id || ''

  useEffect(() => {
    if (purchaseId) {
      loadPurchase()
    }
    loadReferenceData()
  }, [purchaseId])

  const loadPurchase = async () => {
    try {
      if (!purchaseId) {
        router.push('/inventory/purchases')
        return
      }
      
      const { data, error } = await supabase
        .from('inventory_purchases')
        .select('*, supplier:inventory_suppliers(*), purchase_items:inventory_purchase_items(*, item:inventory_items(*))')
        .eq('id', purchaseId)
        .single()

      if (error) {
        console.error('Supabase error:', error)
        throw error
      }
      
      const purchaseData = data as any
      setSelectedSupplier(purchaseData.supplier_id || '')
      setPurchaseDate((purchaseData.purchase_date || new Date().toISOString().split('T')[0]).split('T')[0])
      setNarration(purchaseData.narration || '')
      setStatus(purchaseData.status as PurchaseStatus || 'received')
      setPurchaseNo(purchaseData.purchase_no || '')
      
      const itemsFromPurchase = (purchaseData.purchase_items && purchaseData.purchase_items.length > 0)
        ? purchaseData.purchase_items.map((pi: any) => ({
            id: pi.id,
            item_id: pi.item_id || '',
            quantity: pi.quantity || 0,
            purchase_price: pi.unit_price ?? pi.purchase_price ?? 0,
          }))
        : [{ item_id: '', quantity: 0, purchase_price: 0 }]
      
      setPurchaseItems(itemsFromPurchase)
    } catch (error: any) {
      console.error('Error loading purchase:', error)
      toast.error('Failed to load purchase')
      router.push('/inventory/purchases')
    } finally {
      setLoading(false)
    }
  }

  const loadReferenceData = async () => {
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
      console.error('Error loading reference data:', error)
      toast.error('Failed to load reference data')
    }
  }

  const addItem = () => {
    setPurchaseItems([...purchaseItems, { item_id: '', quantity: 0, purchase_price: 0 }])
  }

  const removeItem = (index: number) => {
    if (purchaseItems.length > 1) {
      const newItems = purchaseItems.filter((_, i) => i !== index)
      setPurchaseItems(newItems)
    }
  }

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...purchaseItems]
    newItems[index] = { ...newItems[index], [field]: value }
    
    if (field === 'item_id' && value) {
      const selectedItem = items.find(i => i.id === value)
      if (selectedItem && newItems[index].purchase_price === 0) {
        newItems[index].purchase_price = selectedItem.unit_price ?? selectedItem.purchase_price ?? 0
      }
    }
    
    setPurchaseItems(newItems)
  }

  const calculateTotal = () => {
    return purchaseItems.reduce((sum, item) => {
      return sum + (item.quantity * item.purchase_price)
    }, 0)
  }

  const handleUpdate = async () => {
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
      const itemsParam = validItems.map(item => ({
        item_id: item.item_id,
        quantity: Number(item.quantity),
        purchase_price: Number(item.purchase_price)
      }))

      const payload = {
        p_purchase_id: purchaseId,
        p_supplier_id: selectedSupplier,
        p_purchase_date: purchaseDate,
        p_narration: narration || null,
        p_status: status,
        p_items: itemsParam,
      }

      console.log('RPC Payload:', JSON.stringify(payload, null, 2))

      const { data, error } = await supabase.rpc('edit_inventory_purchase', payload)

      if (error) {
        console.error('RPC Error:', JSON.stringify(error, Object.getOwnPropertyNames(error ?? {}), 2))
        console.error('RPC Error Type:', typeof error)
        console.error('RPC Error Message:', error?.message)
        console.error('RPC Error Details:', error?.details)
        console.error('RPC Error Code:', error?.code)
        if (error) {
          console.error('RPC Error Keys:', Object.keys(error))
          console.error('RPC Error ownProperties:', Object.getOwnPropertyNames(error))
        }
        if (error?.code === 'PGRST203') {
          console.error('CRITICAL: Database has multiple overloaded edit_inventory_purchase functions.')
          console.error('REQUIRED: Run: DROP FUNCTION public.edit_inventory_purchase(uuid,uuid,date,text,text,jsonb) CASCADE;')
        }
        throw error
      }

      console.log('RPC Success:', data)

      toast.success('Purchase order updated successfully')
      router.push(`/inventory/purchases/${purchaseId}`)
    } catch (error: any) {
      console.error('Error updating purchase:', error)
      
      let errorMessage = 'Failed to update purchase order'
      if (error?.message?.includes('PGRST203') || error?.message?.includes('candidate function')) {
        errorMessage = 'Database overloaded function - remove duplicate edit_inventory_purchase'
      } else if (error?.message?.includes('Invalid supplier')) {
        errorMessage = 'Invalid supplier selected'
      } else if (error?.message?.includes('Invalid item')) {
        errorMessage = 'Invalid item selected'
      } else if (error?.message?.includes('Invalid quantity')) {
        errorMessage = 'Invalid quantity entered'
      } else if (error?.message?.includes('Invalid price')) {
        errorMessage = 'Invalid price entered'
      } else if (error?.message?.includes('Purchase not found')) {
        errorMessage = 'Purchase order not found'
      } else if (error?.message) {
        errorMessage = error.message
      }
      
      toast.error(errorMessage)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <ResponsiveLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </ResponsiveLayout>
    )
  }

  return (
    <ResponsiveLayout>
      <div className="space-y-6 p-4 sm:p-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-bold font-heading">Edit Purchase Order</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Edit Purchase Order</CardTitle>
            <CardDescription>Update purchase order details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="supplier">Supplier *</Label>
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

            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as PurchaseStatus)}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending GRN</SelectItem>
                  <SelectItem value="received">Received</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
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

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium">Items</h3>
                <Button variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                </Button>
              </div>
              
              <div className="space-y-3">
                {purchaseItems.map((item, index) => {
                  const selectedItem = items.find(i => i.id === item.item_id)
                  return (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-5 gap-3 p-3 border rounded-lg">
                      <div className="md:col-span-2">
                        <Label>Item</Label>
                        <Select 
                          value={item.item_id} 
                          onValueChange={(v) => updateItem(index, 'item_id', v)}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select item" />
                          </SelectTrigger>
                          <SelectContent>
                            {items.map(i => (
                              <SelectItem key={i.id} value={i.id}>
                                {i.item_code} - {i.name} ({i.current_stock || 0} in stock)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label>Quantity ({selectedItem?.unit || 'pcs'})</Label>
                        <NumberInput
                          value={item.quantity}
                          onChange={(value) => updateItem(index, 'quantity', Math.max(0, value))}
                          min={0}
                          placeholder="0"
                          className="mt-1"
                        />
                      </div>
                      
                      <div>
                        <Label>Purchase Price</Label>
                        <NumberInput
                          value={item.purchase_price}
                          onChange={(value) => updateItem(index, 'purchase_price', Math.max(0, value))}
                          min={0}
                          placeholder="0.00"
                          className="mt-1"
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="pt-6 text-sm font-medium text-primary">
                          {formatCurrency(Number(item.quantity) * Number(item.purchase_price))}
                        </div>
                        {purchaseItems.length > 1 && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => removeItem(index)} 
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="flex justify-between items-center text-lg">
                <span className="text-muted-foreground">Total Amount:</span>
                <span className="font-bold text-primary">{formatCurrency(calculateTotal())}</span>
              </div>
            </div>

            <Button onClick={handleUpdate} disabled={submitting} className="w-full">
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Purchase Order'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </ResponsiveLayout>
  )
}