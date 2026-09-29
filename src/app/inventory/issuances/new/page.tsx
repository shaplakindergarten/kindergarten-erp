"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { 
  ArrowLeft,
  Save,
  Loader2,
  Plus,
  Trash2,
  Users,
  User,
  Package,
  AlertCircle,
  CheckCircle2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { ResponsiveLayout } from "@/components/layout/responsive-layout"
import { convertBanglaToEnglishDigits } from "@/lib/utils"

const supabase = createClient()

type ItemType = 'asset' | 'consumable' | 'saleable'
type IssuedToType = 'staff' | 'student'

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
  reorder_level: number
  location_rack?: string | null
}

interface Staff {
  id: string
  name: string
}

interface Student {
  id: string
  name: string
  student_id: string
}

interface IssuanceItem {
  item_id: string
  quantity: number
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

  // Update display when value changes externally
  useEffect(() => {
    if (value > 0) {
      setDisplayValue(value.toString())
    } else {
      setDisplayValue('')
    }
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value
    // Convert Bangla digits to English
    const englishValue = convertBanglaToEnglishDigits(rawValue)
    setDisplayValue(englishValue)
    
    // Parse to number
    const numValue = parseFloat(englishValue)
    if (!isNaN(numValue) && numValue >= min) {
      onChange(numValue)
    } else if (englishValue === '' || englishValue === '-') {
      onChange(0)
    } else {
      // If invalid, keep the display but don't update the value
      // This allows user to type without immediate validation
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

export default function NewIssuancePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [items, setItems] = useState<InventoryItem[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [students, setStudents] = useState<Student[]>([])
  
  // Selected recipient type with visual indicator
  const [issuedToType, setIssuedToType] = useState<IssuedToType>('staff')
  const [issuedToId, setIssuedToId] = useState<string>('')
  const [purpose, setPurpose] = useState('')
  const [issuanceItems, setIssuanceItems] = useState<IssuanceItem[]>([{ item_id: '', quantity: 1 }])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [itemsRes, staffRes, studentsRes] = await Promise.all([
        supabase.from('inventory_items')
          .select('*')
          .eq('is_active', true)
          .or('item_type.eq.consumable,item_type.eq.asset')
          .order('name'),
        supabase.from('staff')
          .select('id, name')
          .eq('role', 'admin_staff')
          .order('name'),
        supabase.from('students')
          .select('id, name, student_id')
          .eq('status', 'active')
          .order('name')
          .limit(100),
      ])

      if (itemsRes.error) throw itemsRes.error
      if (staffRes.error) throw staffRes.error
      if (studentsRes.error) throw studentsRes.error

      setItems(itemsRes.data || [])
      setStaff(staffRes.data || [])
      setStudents(studentsRes.data || [])
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const addItem = () => {
    setIssuanceItems([...issuanceItems, { item_id: '', quantity: 1 }])
  }

  const removeItem = (index: number) => {
    if (issuanceItems.length > 1) {
      setIssuanceItems(issuanceItems.filter((_, i) => i !== index))
    }
  }

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...issuanceItems]
    newItems[index] = { ...newItems[index], [field]: value }
    setIssuanceItems(newItems)
  }

  const getSelectedItem = (itemId: string) => {
    return items.find(i => i.id === itemId)
  }

  const validateItems = () => {
    for (const item of issuanceItems) {
      if (!item.item_id) {
        toast.error('Please select an item for all rows')
        return false
      }
      if (item.quantity <= 0) {
        toast.error('Quantity must be greater than 0')
        return false
      }
      const selectedItem = getSelectedItem(item.item_id)
      if (selectedItem && selectedItem.current_stock < item.quantity) {
        toast.error(`Insufficient stock for ${selectedItem.name}. Available: ${selectedItem.current_stock}`)
        return false
      }
    }
    return true
  }

  const handleSubmit = async () => {
    if (!issuedToId) {
      toast.error('Please select a recipient')
      return
    }

    const validItems = issuanceItems.filter(item => item.item_id && item.quantity > 0)
    if (validItems.length === 0) {
      toast.error('Please add at least one valid item')
      return
    }

    if (!validateItems()) {
      return
    }

    setSubmitting(true)
    try {
      const issuedToName = issuedToType === 'staff' 
        ? staff.find(s => s.id === issuedToId)?.name 
        : students.find(s => s.id === issuedToId)?.name

      const itemsParam = validItems.map(item => ({
        item_id: item.item_id,
        quantity: item.quantity
      }))

      console.log('Submitting issuance:', {
        p_issued_to_type: issuedToType,
        p_issued_to_id: issuedToId,
        p_issued_to_name: issuedToName,
        p_items: itemsParam,
        p_purpose: purpose || null
      })

      const { data, error } = await supabase.rpc('create_inventory_issuance', {
        p_issued_to_type: issuedToType,
        p_issued_to_id: issuedToId,
        p_issued_to_name: issuedToName,
        p_items: itemsParam,
        p_purpose: purpose || null
      })

      if (error) {
        console.error('RPC Error:', error)
        
        let errorMessage = 'Failed to create issuance'
        if (error.message && error.message.includes('INSUFFICIENT_STOCK')) {
          errorMessage = 'Insufficient stock available for one or more items'
        } else if (error.message && error.message.includes('INVALID_RECIPIENT')) {
          errorMessage = 'Invalid recipient selected'
        } else if (error.message && error.message.includes('NO_ITEMS')) {
          errorMessage = 'No valid items selected'
        } else if (error.message && error.message.includes('INVALID_ITEM')) {
          errorMessage = 'Invalid item selected'
        } else if (error.message && error.message.includes('INVALID_QUANTITY')) {
          errorMessage = 'Invalid quantity entered'
        } else if (error.message) {
          errorMessage = error.message
        }
        
        toast.error(errorMessage)
        return
      }

      // Check if RPC returned error in data
      if (data && data.success === false) {
        toast.error(data.message || data.error || 'Failed to create issuance')
        return
      }

      toast.success('Issuance recorded successfully')
      router.push('/inventory/issuances')
    } catch (error: any) {
      console.error('Error creating issuance:', error)
      toast.error(error?.message || 'Failed to create issuance')
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

  const getRecipients = () => {
    return issuedToType === 'staff' ? staff : students
  }

  const getRecipientLabel = () => {
    return issuedToType === 'staff' ? 'Staff / Teacher' : 'Student'
  }

  const getRecipientPlaceholder = () => {
    return issuedToType === 'staff' ? 'Select staff member' : 'Select student'
  }

  return (
    <ResponsiveLayout>
      <div className="space-y-6 p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => router.back()}
            className="flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold font-heading truncate">New Issuance</h1>
            <p className="text-sm text-muted-foreground">Allocate stock to staff or students</p>
          </div>
        </div>

        {/* Main Card */}
        <Card>
          <CardHeader>
            <CardTitle>Issue Items</CardTitle>
            <CardDescription>Select recipient and items to issue</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Recipient Type Selection */}
            <div>
              <Label className="text-sm font-medium">Issue To</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIssuedToType('staff')
                    setIssuedToId('')
                  }}
                  className={`p-4 border-2 rounded-lg text-left transition-all hover:shadow-md ${
                    issuedToType === 'staff' 
                      ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/30 shadow-md' 
                      : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${
                      issuedToType === 'staff' 
                        ? 'bg-purple-600 text-white' 
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
                    }`}>
                      <Users className="h-5 w-5" />
                    </div>
                    <div>
                      <div className={`font-medium ${
                        issuedToType === 'staff' 
                          ? 'text-purple-700 dark:text-purple-400' 
                          : 'text-gray-700 dark:text-gray-300'
                      }`}>
                        Staff / Teacher
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Office supplies, equipment
                      </div>
                    </div>
                  </div>
                  {issuedToType === 'staff' && (
                    <div className="mt-2 text-xs text-purple-600 dark:text-purple-400 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Selected</span>
                    </div>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIssuedToType('student')
                    setIssuedToId('')
                  }}
                  className={`p-4 border-2 rounded-lg text-left transition-all hover:shadow-md ${
                    issuedToType === 'student' 
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/30 shadow-md' 
                      : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${
                      issuedToType === 'student' 
                        ? 'bg-indigo-600 text-white' 
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
                    }`}>
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <div className={`font-medium ${
                        issuedToType === 'student' 
                          ? 'text-indigo-700 dark:text-indigo-400' 
                          : 'text-gray-700 dark:text-gray-300'
                      }`}>
                        Student
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Personal items, study materials
                      </div>
                    </div>
                  </div>
                  {issuedToType === 'student' && (
                    <div className="mt-2 text-xs text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Selected</span>
                    </div>
                  )}
                </button>
              </div>
            </div>

            {/* Recipient Selection */}
            <div>
              <Label htmlFor="recipient">Select {getRecipientLabel()}</Label>
              <Select value={issuedToId} onValueChange={setIssuedToId}>
                <SelectTrigger className="mt-2 w-full">
                  <SelectValue placeholder={getRecipientPlaceholder()} />
                </SelectTrigger>
                <SelectContent>
                  {getRecipients().map(r => (
                    <SelectItem key={r.id} value={r.id}>
                      {issuedToType === 'staff' 
                        ? (r as Staff).name 
                        : `${(r as Student).student_id} - ${(r as Student).name}`
                      }
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Purpose */}
            <div>
              <Label htmlFor="purpose">Purpose (optional)</Label>
              <Textarea
                id="purpose"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="Reason for issuance..."
                rows={2}
                className="mt-2 resize-y"
              />
            </div>

            {/* Items Section */}
            <div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
                <Label className="text-sm font-medium">Items to Issue</Label>
                <Button variant="outline" size="sm" onClick={addItem} className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                </Button>
              </div>
              
              <div className="space-y-3">
                {issuanceItems.map((item, index) => {
                  const selectedItem = getSelectedItem(item.item_id)
                  const isStockAvailable = selectedItem && selectedItem.current_stock >= item.quantity
                  
                  return (
                    <div key={index} className="p-4 border rounded-lg bg-gray-50 dark:bg-zinc-900/50 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                        <div className="sm:col-span-6">
                          <Label className="text-xs">Item</Label>
                          <Select 
                            value={item.item_id} 
                            onValueChange={(v) => updateItem(index, 'item_id', v)}
                          >
                            <SelectTrigger className="mt-1 bg-white dark:bg-zinc-800">
                              <SelectValue placeholder="Select item" />
                            </SelectTrigger>
                            <SelectContent>
                              {items.map(i => (
                                <SelectItem key={i.id} value={i.id}>
                                  {i.item_code} - {i.name} ({i.current_stock} {i.unit} available)
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {selectedItem && (
                            <div className="mt-1 text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                              <Package className="h-3 w-3 flex-shrink-0" />
                              <span>Available: {selectedItem.current_stock} {selectedItem.unit}</span>
                              {selectedItem.current_stock < item.quantity && (
                                <span className="text-red-600 flex items-center gap-1">
                                  <AlertCircle className="h-3 w-3" />
                                  Insufficient stock
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        
                        <div className="sm:col-span-4">
                          <Label className="text-xs">Quantity ({selectedItem?.unit || 'pcs'})</Label>
                          <NumberInput
                            value={item.quantity}
                            onChange={(value) => updateItem(index, 'quantity', Math.max(1, value))}
                            min={1}
                            placeholder="Enter quantity"
                            className={`mt-1 bg-white dark:bg-zinc-800 ${
                              selectedItem && selectedItem.current_stock < item.quantity
                                ? 'border-red-500 focus:ring-red-500'
                                : ''
                            }`}
                          />
                        </div>
                        
                        <div className="sm:col-span-2 flex items-end justify-end">
                          {issuanceItems.length > 1 ? (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => removeItem(index)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 mt-1"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground self-center">Required</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Submit Button */}
            <Button 
              onClick={handleSubmit} 
              disabled={submitting || !issuedToId || issuanceItems.some(i => !i.item_id)}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-base py-6"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Processing Issuance...
                </>
              ) : (
                <>
                  <Save className="h-5 w-5 mr-2" />
                  Complete Issuance
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </ResponsiveLayout>
  )
}
