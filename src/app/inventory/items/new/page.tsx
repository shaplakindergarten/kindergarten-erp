"use client"

import { useState, useEffect } from "react"
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
import { CurrencyInput } from "@/components/currency-input"

const supabase = createClient()

type ItemType = 'asset' | 'consumable' | 'saleable'

const FIXED_CATEGORIES = [
  { value: 'asset', label: 'Asset (সম্পদ) - Fixed Assets / সম্পদ' },
  { value: 'consumable', label: 'Consumable (ব্যবহার্য) - Office Supplies / ব্যবহার্য' },
  { value: 'saleable', label: 'Saleable (বিক্রয়যোগ্য) - Items for Sale / বিক্রয়যোগ্য' },
] as const

const generateUniqueItemCode = (): string => {
  const prefix = 'ITM';
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const timestamp = Date.now().toString().slice(-4);
  return `${prefix}-${timestamp}-${randomNum}`;
};

export default function NewItemPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  
  const [itemCode, setItemCode] = useState(generateUniqueItemCode)
  const [itemName, setItemName] = useState('')
  const [itemType, setItemType] = useState<ItemType>('consumable')
  const [unit, setUnit] = useState('pcs')
  const [purchasePrice, setPurchasePrice] = useState(0)
  const [sellingPrice, setSellingPrice] = useState(0)
  const [reorderLevel, setReorderLevel] = useState(10)
  const [locationRack, setLocationRack] = useState('')

  const handleSubmit = async () => {
    if (!itemName) {
      toast.error('Please fill in item name')
      return
    }

    setSubmitting(true)
    try {
      const { error } = await supabase.from('inventory_items').insert([{
        item_code: itemCode,
        name: itemName,
        item_type: itemType,
        category_id: null,
        unit: unit,
        purchase_price: purchasePrice,
        selling_price: sellingPrice,
        current_stock: 0,
        reorder_level: reorderLevel,
        location_rack: locationRack || null,
        is_active: true,
      }])

      if (error) {
        if (error.code === '23505' || (error.message && error.message.includes('duplicate key'))) {
          const newCode = generateUniqueItemCode()
          setItemCode(newCode)
          toast('Item code already exists! A new code has been generated.')
          return
        }
        throw error
      }

      toast.success('Item created successfully')
      router.push('/inventory/items')
    } catch (error) {
      console.error('Error creating item:', (error as any)?.message || error)
      toast.error('Failed to create item')
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    setLoading(false)
  }, [])

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
          <h1 className="text-2xl font-bold font-heading">New Item</h1>
        </div>

      <Card>
        <CardHeader>
          <CardTitle>Item Details</CardTitle>
          <CardDescription>Create a new product or asset</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="item_code">Item Code</Label>
              <Input
                id="item_code"
                value={itemCode}
                onChange={(e) => setItemCode(e.target.value)}
                placeholder="Auto-generated, edit if needed"
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
              <CurrencyInput
                value={purchasePrice}
                onValueChange={setPurchasePrice}
                inputMode="decimal"
              />
            </div>

            <div>
              <Label htmlFor="selling_price">Selling Price (BDT)</Label>
              <CurrencyInput
                value={sellingPrice}
                onValueChange={setSellingPrice}
                inputMode="decimal"
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="reorder_level">Reorder Level</Label>
              <CurrencyInput
                value={reorderLevel}
                onValueChange={setReorderLevel}
                inputMode="numeric"
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
                Creating...
              </>
            ) : (
              'Create Item'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  </ResponsiveLayout>
)
}
