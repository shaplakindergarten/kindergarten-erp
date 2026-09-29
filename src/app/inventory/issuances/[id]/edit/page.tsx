"use client"

import { useState, useEffect } from "react"
import React from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { 
  ArrowLeft,
  Save,
  Loader2,
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
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { ResponsiveLayout } from "@/components/layout/responsive-layout"
import { convertBanglaToEnglishDigits } from "@/lib/utils"

const supabase = createClient()

type IssueStatus = 'requested' | 'approved' | 'issued' | 'returned'
type IssuedToType = 'staff' | 'student'

interface InventoryIssuance {
  id: string
  issuance_no: string
  issue_no?: string
  item_id: string
  item_type: 'asset' | 'consumable' | 'saleable'
  issued_to_type: IssuedToType
  issued_to_id: string
  issued_to_name: string
  quantity: number
  unit: string
  issuance_date: string
  purpose?: string | null
  status: IssueStatus
  created_at?: string
  updated_at?: string
}

interface InventoryItem {
  id: string
  item_code: string
  name: string
  unit: string
  current_stock: number
  purchase_price: number
  selling_price: number
  item_type: 'asset' | 'consumable' | 'saleable'
  is_active: boolean
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

export default function IssuanceEditPage({ params }: PageProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [issuance, setIssuance] = useState<InventoryIssuance | null>(null)
  const [items, setItems] = useState<InventoryItem[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [students, setStudents] = useState<Student[]>([])
  
  // Form state
  const [issuedToType, setIssuedToType] = useState<IssuedToType>('staff')
  const [issuedToId, setIssuedToId] = useState<string>('')
  const [purpose, setPurpose] = useState('')
  const [status, setStatus] = useState<IssueStatus>('issued')
  const [itemId, setItemId] = useState<string>('')
  const [quantity, setQuantity] = useState<number>(1)
  const [unit, setUnit] = useState<string>('pcs')

  const resolvedParams = React.use(params)
  const issuanceId = resolvedParams.id

  useEffect(() => {
    loadData()
  }, [issuanceId])

  const loadData = async () => {
    setLoading(true)
    try {
      // Load issuance details
      const { data: issuanceData, error: issuanceError } = await supabase
        .from('inventory_issuances')
        .select('*')
        .eq('id', issuanceId)
        .single()

      if (issuanceError) throw issuanceError

      const issuanceRecord = issuanceData as InventoryIssuance
      setIssuance(issuanceRecord)
      
      // Set form data
      setIssuedToType(issuanceRecord.issued_to_type)
      setIssuedToId(issuanceRecord.issued_to_id)
      setPurpose(issuanceRecord.purpose || '')
      setStatus(issuanceRecord.status)
      setItemId(issuanceRecord.item_id)
      setQuantity(issuanceRecord.quantity)
      setUnit(issuanceRecord.unit)

      // Load reference data
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
      toast.error('Failed to load issuance details')
      router.push('/inventory/issuances')
    } finally {
      setLoading(false)
    }
  }

  const getRecipients = () => {
    return issuedToType === 'staff' ? staff : students
  }

  const getRecipientLabel = () => {
    return issuedToType === 'staff' ? 'Staff / Teacher' : 'Student'
  }

  const getSelectedItem = (id: string) => {
    return items.find(i => i.id === id)
  }

  const handleSubmit = async () => {
    if (!issuedToId) {
      toast.error('Please select a recipient')
      return
    }

    if (!itemId) {
      toast.error('Please select an item')
      return
    }

    if (quantity <= 0) {
      toast.error('Quantity must be greater than 0')
      return
    }

    // Get recipient name
    const recipientName = issuedToType === 'staff' 
      ? staff.find(s => s.id === issuedToId)?.name 
      : students.find(s => s.id === issuedToId)?.name

    setSubmitting(true)
    try {
      // Only update fields that exist in the table
      const updateData: any = {
        issued_to_type: issuedToType,
        issued_to_id: issuedToId,
        issued_to_name: recipientName || '',
        purpose: purpose || null,
        status: status,
        // Only update these if they exist in the table
        // item_id, quantity, unit are usually not updated in issuance
        // because issuance is a single transaction record
      }

      // Check if we need to update item_id, quantity, unit
      // Only if they are different from original
      if (issuance && itemId !== issuance.item_id) {
        updateData.item_id = itemId
      }
      if (issuance && quantity !== issuance.quantity) {
        updateData.quantity = quantity
      }
      if (issuance && unit !== issuance.unit) {
        updateData.unit = unit
      }

      console.log('Updating issuance with data:', updateData)

      const { error } = await supabase
        .from('inventory_issuances')
        .update(updateData)
        .eq('id', issuanceId)

      if (error) {
        console.error('Supabase error:', error)
        throw error
      }

      toast.success('Issuance updated successfully')
      router.push(`/inventory/issuances/${issuanceId}`)
    } catch (error: any) {
      console.error('Error updating issuance:', error)
      toast.error(error?.message || 'Failed to update issuance')
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusOptions = () => {
    return [
      { value: 'requested', label: 'Requested' },
      { value: 'approved', label: 'Approved' },
      { value: 'issued', label: 'Issued' },
      { value: 'returned', label: 'Returned' }
    ]
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

  if (!issuance) {
    return (
      <ResponsiveLayout>
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <Package className="h-16 w-16 text-muted-foreground/50 mb-4" />
          <h2 className="text-xl font-semibold">Issuance Not Found</h2>
          <p className="text-muted-foreground">The issuance you're looking for doesn't exist.</p>
          <Button className="mt-4" onClick={() => router.push('/inventory/issuances')}>
            Back to Issuances
          </Button>
        </div>
      </ResponsiveLayout>
    )
  }

  const selectedItem = getSelectedItem(itemId)

  return (
    <ResponsiveLayout>
      <div className="space-y-6 p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href={`/inventory/issuances/${issuanceId}`}>
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Edit Issuance</h1>
              <p className="text-sm text-muted-foreground">
                {issuance.issuance_no || issuance.issue_no}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-sm">
            Status: {status}
          </Badge>
        </div>

        {/* Edit Form */}
        <Card>
          <CardHeader>
            <CardTitle>Issuance Details</CardTitle>
            <CardDescription>Update the issuance information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Recipient Type */}
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
                      : 'border-gray-200 dark:border-gray-700 hover:border-purple-300'
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
                      : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300'
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
                  <SelectValue placeholder={`Select ${getRecipientLabel()}`} />
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

            {/* Item Selection */}
            <div>
              <Label htmlFor="item">Item</Label>
              <Select value={itemId} onValueChange={setItemId}>
                <SelectTrigger className="mt-2 w-full">
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
                <div className="mt-1 text-xs text-muted-foreground flex items-center gap-2">
                  <Package className="h-3 w-3" />
                  Available: {selectedItem.current_stock} {selectedItem.unit}
                  {selectedItem.current_stock < quantity && (
                    <span className="text-red-600 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Insufficient stock
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Quantity */}
            <div>
              <Label htmlFor="quantity">Quantity ({selectedItem?.unit || 'pcs'})</Label>
              <NumberInput
                value={quantity}
                onChange={(value) => setQuantity(Math.max(1, value))}
                min={1}
                placeholder="Enter quantity"
                className="mt-2 bg-white dark:bg-zinc-800"
              />
            </div>

            {/* Status */}
            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as IssueStatus)}>
                <SelectTrigger className="mt-2 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getStatusOptions().map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
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

            {/* Submit Button */}
            <Button 
              onClick={handleSubmit} 
              disabled={submitting || !issuedToId || !itemId}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-base py-6"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Updating Issuance...
                </>
              ) : (
                <>
                  <Save className="h-5 w-5 mr-2" />
                  Update Issuance
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </ResponsiveLayout>
  )
}