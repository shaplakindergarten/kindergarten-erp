"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { 
  ArrowLeft,
  Save,
  Loader2,
  Plus,
  Trash2,
  Search,
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
import { formatCurrency, convertBanglaToEnglishDigits } from "@/lib/utils"
import { toast } from "sonner"
import { ResponsiveLayout } from "@/components/layout/responsive-layout"

const supabase = createClient()

interface InventoryItem {
  id: string
  item_code: string
  name: string
  unit: string
  current_stock: number
  selling_price: number
  item_type: string
  is_active: boolean
}

interface Student {
  id: string
  name: string
  student_id: string
}

interface SaleItem {
  id?: string
  item_id: string
  quantity: number
  unit_price: number
  total_price: number
}

interface InventorySale {
  id: string
  sale_no: string
  student_id: string
  sale_date: string
  subtotal: number
  discount: number
  net_amount: number
  status: string
  narration?: string
  items: SaleItem[]
}

interface PageProps {
  params: Promise<{ id: string }>
}

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

export default function EditSalePage({ params }: PageProps) {
  const router = useRouter()
  const resolvedParams = React.use(params)
  const saleId = resolvedParams.id
  
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [sale, setSale] = useState<InventorySale | null>(null)
  const [items, setItems] = useState<InventoryItem[]>([])
  const [students, setStudents] = useState<Student[]>([])
  
  const [selectedStudent, setSelectedStudent] = useState<string>('')
  const [saleDate, setSaleDate] = useState('')
  const [narration, setNarration] = useState('')
  const [status, setStatus] = useState<string>('completed')
  const [saleItems, setSaleItems] = useState<SaleItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([])

  useEffect(() => {
    loadData()
  }, [saleId])

  const loadData = async () => {
    setLoading(true)
    try {
      // Sale ডিটেইলস লোড করুন
      const { data: saleData, error: saleError } = await supabase
        .from('inventory_sales')
        .select(`
          *,
          items:inventory_sale_items(*)
        `)
        .eq('id', saleId)
        .single()

      if (saleError) throw saleError

      const saleRecord = saleData as InventorySale
      setSale(saleRecord)
      setSelectedStudent(saleRecord.student_id)
      setSaleDate(saleRecord.sale_date)
      setNarration(saleRecord.narration || '')
      setStatus(saleRecord.status)
      
      // Sale Items সেট করুন
      const itemsWithTotal = (saleRecord.items || []).map(item => ({
        ...item,
        unit_price: item.unit_price || 0,
        total_price: (item.quantity || 0) * (item.unit_price || 0)
      }))
      setSaleItems(itemsWithTotal)

      // Reference Data লোড করুন
      const [itemsRes, studentsRes] = await Promise.all([
        supabase.from('inventory_items')
          .select('*')
          .eq('is_active', true)
          .eq('item_type', 'saleable')
          .order('name'),
        supabase.from('students')
          .select('id, name, student_id')
          .eq('status', 'active')
          .order('name')
          .limit(100),
      ])

      if (itemsRes.error) throw itemsRes.error
      if (studentsRes.error) throw studentsRes.error

      setItems(itemsRes.data || [])
      setStudents(studentsRes.data || [])
      setFilteredStudents(studentsRes.data || [])
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Failed to load sale details')
      router.push('/inventory/sales')
    } finally {
      setLoading(false)
    }
  }

  const handleStudentSearch = (query: string) => {
    setSearchQuery(query)
    if (query.trim() === '') {
      setFilteredStudents(students)
    } else {
      const q = query.toLowerCase()
      setFilteredStudents(students.filter(s => 
        s.name.toLowerCase().includes(q) ||
        s.student_id.toLowerCase().includes(q)
      ))
    }
  }

  const addItem = () => {
    setSaleItems([...saleItems, { item_id: '', quantity: 1, unit_price: 0, total_price: 0 }])
  }

  const removeItem = (index: number) => {
    if (saleItems.length > 1) {
      setSaleItems(saleItems.filter((_, i) => i !== index))
    }
  }

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...saleItems]
    const item = items.find(i => i.id === newItems[index].item_id)
    
    let processedValue = value
    if (field === 'quantity' || field === 'unit_price') {
      processedValue = Number(convertBanglaToEnglishDigits(String(value)) || '0')
    }
    
    newItems[index] = { ...newItems[index], [field]: processedValue }
    
    if (field === 'item_id' && value) {
      const selected = items.find(i => i.id === value)
      if (selected && !newItems[index].unit_price) {
        newItems[index].unit_price = selected.selling_price || 0
      }
    }
    
    if (field === 'unit_price' || field === 'quantity' || field === 'item_id') {
      const quantity = newItems[index].quantity || 0
      const price = newItems[index].unit_price || 0
      newItems[index].total_price = quantity * price
    }
    
    setSaleItems(newItems)
  }

  const totalAmount = saleItems.reduce((sum, i) => sum + (i.total_price || 0), 0)

  const validItems = saleItems.filter(si => 
    si.item_id && si.quantity > 0 && si.unit_price > 0
  )

  const selectedStudentData = selectedStudent ? students.find(s => s.id === selectedStudent) : null

  const handleSubmit = async () => {
    if (!selectedStudent) {
      toast.error('Please select a student')
      return
    }

    if (validItems.length === 0) {
      toast.error('Please add at least one item')
      return
    }

    setSubmitting(true)
    try {
      // পুরানো items ডিলিট করুন
      const { error: deleteError } = await supabase
        .from('inventory_sale_items')
        .delete()
        .eq('sale_id', saleId)

      if (deleteError) throw deleteError

      // নতুন items যোগ করুন
      for (const item of validItems) {
        const { error: insertError } = await supabase
          .from('inventory_sale_items')
          .insert({
            sale_id: saleId,
            item_id: item.item_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price
          })

        if (insertError) throw insertError
      }

      // Sale আপডেট করুন
      const { error: updateError } = await supabase
        .from('inventory_sales')
        .update({
          student_id: selectedStudent,
          sale_date: saleDate,
          narration: narration || null,
          status: status,
          subtotal: totalAmount,
          net_amount: totalAmount
        })
        .eq('id', saleId)

      if (updateError) throw updateError

      toast.success('Sale updated successfully')
      router.push(`/inventory/sales/${saleId}`)
    } catch (error: any) {
      console.error('Error updating sale:', error)
      toast.error(error?.message || 'Failed to update sale')
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

  if (!sale) {
    return (
      <ResponsiveLayout>
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <Package className="h-16 w-16 text-muted-foreground/50 mb-4" />
          <h2 className="text-xl font-semibold">Sale Not Found</h2>
          <p className="text-muted-foreground">The sale you're looking for doesn't exist.</p>
          <Button className="mt-4" onClick={() => router.push('/inventory/sales')}>
            Back to Sales
          </Button>
        </div>
      </ResponsiveLayout>
    )
  }

  return (
    <ResponsiveLayout>
      <div className="space-y-6 p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href={`/inventory/sales/${saleId}`}>
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Edit Sale</h1>
              <p className="text-sm text-muted-foreground">
                {sale.sale_no}
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
            <CardTitle>Sale Details</CardTitle>
            <CardDescription>Update the sale information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Student Selection */}
            <div>
              <Label htmlFor="student-search">Student</Label>
              <div className="mt-2 space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="student-search"
                    placeholder="Search student by name or ID..."
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => handleStudentSearch(e.target.value)}
                  />
                </div>
                {selectedStudentData && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <p className="font-medium text-emerald-900">{selectedStudentData.name}</p>
                    <p className="text-sm text-emerald-700">ID: {selectedStudentData.student_id}</p>
                  </div>
                )}
                {!selectedStudentData && filteredStudents.length > 0 && (
                  <div className="border rounded-lg max-h-40 overflow-y-auto">
                    {filteredStudents.map(s => (
                      <button
                        key={s.id}
                        className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b last:border-b-0 flex justify-between items-center"
                        onClick={() => {
                          setSelectedStudent(s.id)
                          setSearchQuery('')
                          setFilteredStudents(students)
                        }}
                      >
                        <div>
                          <div className="font-medium">{s.name}</div>
                          <div className="text-xs text-gray-500">{s.student_id}</div>
                        </div>
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Sale Date */}
            <div>
              <Label htmlFor="sale_date">Sale Date</Label>
              <Input
                id="sale_date"
                type="date"
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
                className="mt-2"
              />
            </div>

            {/* Status */}
            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="returned">Returned</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Narration */}
            <div>
              <Label htmlFor="narration">Note (optional)</Label>
              <Textarea
                id="narration"
                value={narration}
                onChange={(e) => setNarration(e.target.value)}
                placeholder="Additional notes..."
                rows={2}
                className="mt-2"
              />
            </div>

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium">Items</h3>
                <Button variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                </Button>
              </div>
              
              <div className="space-y-3">
                {saleItems.map((item, index) => {
                  const selectedItem = items.find(i => i.id === item.item_id)
                  return (
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
                                {i.item_code} - {i.name} ({i.current_stock} {i.unit} available)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label>Quantity</Label>
                        <NumberInput
                          value={item.quantity}
                          onChange={(value) => updateItem(index, 'quantity', Math.max(1, value))}
                          min={1}
                          placeholder="Qty"
                          className="mt-1"
                        />
                      </div>
                      
                      <div>
                        <Label>Unit Price</Label>
                        <NumberInput
                          value={item.unit_price}
                          onChange={(value) => updateItem(index, 'unit_price', Math.max(0, value))}
                          min={0}
                          placeholder="Price"
                          className="mt-1"
                        />
                      </div>
                      
                      <div className="pt-5 text-right font-mono font-bold text-lg">
                        {formatCurrency(item.total_price)}
                      </div>
                      
                      <div className="pt-5">
                        {saleItems.length > 1 ? (
                          <Button variant="ghost" size="sm" onClick={() => removeItem(index)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : (
                          <span className="text-sm text-muted-foreground">Required</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Total */}
            <div className="border-t pt-4">
              <div className="flex justify-between items-center text-lg">
                <span className="text-muted-foreground">Total:</span>
                <span className="font-bold text-primary">{formatCurrency(totalAmount)}</span>
              </div>
            </div>

            {/* Submit */}
            <Button 
              onClick={handleSubmit} 
              disabled={submitting || !selectedStudent}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-base py-6"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Updating Sale...
                </>
              ) : (
                <>
                  <Save className="h-5 w-5 mr-2" />
                  Update Sale
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </ResponsiveLayout>
  )
}