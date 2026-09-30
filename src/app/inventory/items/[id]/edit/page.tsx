"use client"

import { useState, useEffect } from "react"
import React from "react"
import { useRouter } from "next/navigation"
import { 
  ArrowLeft,
  Save,
  Loader2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { ResponsiveLayout } from "@/components/layout/responsive-layout"
import { convertBanglaToEnglishDigits } from "@/lib/utils"

const supabase = createClient()

type ItemType = 'asset' | 'consumable' | 'saleable'

const FIXED_CATEGORIES = [
  { value: 'asset', label: 'Asset (সম্পদ) - Fixed Assets / সম্পদ' },
  { value: 'consumable', label: 'Consumable (ব্যবহার্য) - Office Supplies / ব্যবহার্য' },
  { value: 'saleable', label: 'Saleable (বিক্রয়যোগ্য) - Items for Sale / বিক্রয়যোগ্য' },
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
}

interface PageProps {
  params: Promise<{ id: string }>
}

interface NumberInputProps {
  value: number
  onChange: (value: number) => void
  min?: number
  step?: number
}

function NumberInput({ value, onChange, min = 0, step }: NumberInputProps) {
  const [displayValue, setDisplayValue] = useState(value.toString())

  const handleFocus = () => {
    if (value === 0) {
      setDisplayValue('')
    } else {
      setDisplayValue(value.toString())
    }
  }

  const handleBlur = () => {
    if (displayValue === '' || isNaN(Number(displayValue))) {
      onChange(0)
    } else {
      onChange(Number(displayValue))
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value
    const englishValue = convertBanglaToEnglishDigits(rawValue)
    setDisplayValue(englishValue)
    
    const numValue = Number(englishValue)
    if (!isNaN(numValue)) {
      onChange(numValue)
    }
  }

  return (
    <Input
      type="text"
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      min={min}
      step={step}
      className="mt-2"
    />
  )
}

export default function ItemEditPage({ params }: PageProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  
  const [itemCode, setItemCode] = useState('')
  const [itemName, setItemName] = useState('')
  const [itemType, setItemType] = useState<ItemType>('consumable')
  const [unit, setUnit] = useState('pcs')
  const [purchasePrice, setPurchasePrice] = useState(0)
  const [sellingPrice, setSellingPrice] = useState(0)
  const [reorderLevel, setReorderLevel] = useState(10)
  const [locationRack, setLocationRack] = useState('')

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
      
      const item = data as InventoryItem
      setItemCode(item.item_code)
      setItemName(item.name)
      setItemType(item.item_type)
      setUnit(item.unit)
      setPurchasePrice(Number(item.purchase_price) || 0)
      setSellingPrice(Number(item.selling_price) || 0)
      setReorderLevel(Number(item.reorder_level) || 0)
      setLocationRack(item.location_rack || '')
    } catch (error) {
      console.error('Error loading item:', error)
      toast.error('Failed to load item')
      router.push('/inventory/items')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!itemName) {
      toast.error('Please fill in item name')
      return
    }

    setSubmitting(true)
    try {
      const { error } = await supabase.from('inventory_items').update({
        name: itemName,
        item_type: itemType,
        unit: unit,
        purchase_price: purchasePrice,
        selling_price: sellingPrice,
        reorder_level: reorderLevel,
        location_rack: locationRack || null
      }).eq('id', itemId)

      if (error) throw error

      toast.success('Item updated successfully')
      router.push(`/inventory/items/${itemId}`)
    } catch (error) {
      console.error('Error updating item:', (error as any)?.message || error)
      toast.error('Failed to update item')
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
          <h1 className="text-2xl font-bold font-heading">Edit Item</h1>
        </div>

      <Card>
        <CardHeader>
          <CardTitle>Edit Item Details</CardTitle>
          <CardDescription>Update product or asset information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="item_code">Item Code</Label>
              <Input
                id="item_code"
                value={itemCode}
                onChange={(e) => setItemCode(e.target.value)}
                placeholder="e.g., ITEM-001"
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="item_type">Item Type / Category</Label>
              <Select value={itemType} onValueChange={(v) => setItemType(v as ItemType)}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIXED_CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="item_name">Item Name</Label>
              <Input
                id="item_name"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="e.g., School Bag, Notebook"
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="unit">Unit</Label>
              <Input
                id="unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="e.g., pcs, kg, set"
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="location_rack">Location / Rack</Label>
              <Input
                id="location_rack"
                value={locationRack}
                onChange={(e) => setLocationRack(e.target.value)}
                placeholder="e.g., Shelf A-3"
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="purchase_price">Purchase Price (BDT)</Label>
              <NumberInput
                value={purchasePrice}
                onChange={setPurchasePrice}
                min={0}
                step={0.01}
              />
            </div>

            <div>
              <Label htmlFor="selling_price">Selling Price (BDT)</Label>
              <NumberInput
                value={sellingPrice}
                onChange={setSellingPrice}
                min={0}
                step={0.01}
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="reorder_level">Reorder Level</Label>
              <NumberInput
                value={reorderLevel}
                onChange={setReorderLevel}
                min={0}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Alert when stock falls below this level
              </p>
            </div>
          </div>

          <Button onClick={handleSubmit} disabled={submitting} className="w-full">
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  </ResponsiveLayout>
)
}