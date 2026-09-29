"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { 
  ArrowLeft,
  Loader2,
  Search,
  Trash2,
  Plus
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

const supabase = createClient()

const toEnglishDigits = (value: string): string => {
  return value.replace(/[০-৯]/g, (digit) => {
    return String('০১২৩৪৫৬৭৮৯'.indexOf(digit))
  })
}

type ItemType = 'asset' | 'consumable' | 'saleable'

interface InventoryItem {
  id: string
  item_code: string
  name: string
  unit: string
  current_stock: number
  category_id: string | null
  item_type: ItemType
  is_active: boolean
  reorder_level: number
  selling_price: number
}

interface Class {
  id: string
  name: string
  numeric_order?: number
}

interface Section {
  id: string
  name: string
  class_id: string
}

interface Student {
  id: string
  name: string
  name_bn?: string | null
  student_id: string
  class_roll?: string | null
  class_id: string
  section_id: string
  classes?: { name: string }
  sections?: { name: string }
}

interface SaleItem {
  item_id: string
  quantity: number
  unit_price: number
  total_price: number
}

export default function NewSalePage() {
  const router = useRouter()
  const [items, setItems] = useState<InventoryItem[]>([])
  const [studentsList, setStudentsList] = useState<Student[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  
  const [selectedStudent, setSelectedStudent] = useState<string>('')
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0])
  const [narration, setNarration] = useState('')
  const [saleItems, setSaleItems] = useState<SaleItem[]>([
    { item_id: '', quantity: 1, unit_price: 0, total_price: 0 }
  ])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedClass, setSelectedClass] = useState<string>('all')
  const [selectedSection, setSelectedSection] = useState<string>('all')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [itemsRes, studentsRes, classesRes, sectionsRes] = await Promise.all([
        supabase.from('inventory_items')
          .select('*')
          .eq('is_active', true)
          .eq('item_type', 'saleable')
          .order('name'),
        supabase
          .from('students')
          .select(`
            id, name, name_bn, student_id, class_roll, class_id, section_id,
            classes(name), sections(name)
          `)
          .eq('status', 'active')
          .order('name'),
        supabase.from('classes')
          .select('id, name, numeric_order')
          .order('numeric_order'),
        supabase.from('sections')
          .select('id, name, class_id')
          .order('name'),
      ])

      if (itemsRes.error) throw itemsRes.error
      if (studentsRes.error) throw studentsRes.error
      if (classesRes.error) throw classesRes.error
      if (sectionsRes.error) throw sectionsRes.error

      setItems(itemsRes.data || [])
      setStudentsList(studentsRes.data || [])
      setClasses(classesRes.data || [])
      setSections(sectionsRes.data || [])
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const hasActiveFilter = searchQuery.trim().length > 0 || selectedClass !== 'all' || selectedSection !== 'all'

  const filteredStudents = useMemo(() => {
    if (!hasActiveFilter) {
      return []
    }
    return studentsList.filter(s => {
      const searchLower = searchQuery.trim().toLowerCase()
      
      const matchesSearch = 
        s.student_id.toLowerCase().includes(searchLower) ||
        s.name.toLowerCase().includes(searchLower) ||
        (s.name_bn || '').toLowerCase().includes(searchLower) ||
        (s.class_roll || '').toLowerCase().includes(searchLower)
      
      const matchesClass = selectedClass === 'all' || s.class_id === selectedClass
      
      const matchesSection = selectedSection === 'all' || s.section_id === selectedSection
      
      return matchesSearch && matchesClass && matchesSection
    })
  }, [studentsList, searchQuery, selectedClass, selectedSection, hasActiveFilter])

  const filteredSections = useMemo(() => {
    if (selectedClass === 'all') return sections
    return sections.filter(sec => sec.class_id === selectedClass)
  }, [sections, selectedClass])

  const addItem = () => {
    setSaleItems([...saleItems, { item_id: '', quantity: 1, unit_price: 0, total_price: 0 }])
  }

  const removeItem = (index: number) => {
    if (saleItems.length > 1) {
      setSaleItems(saleItems.filter((_, i) => i !== index))
    } else {
      setSaleItems([{ item_id: '', quantity: 1, unit_price: 0, total_price: 0 }])
    }
  }

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...saleItems]
    const item = items.find(i => i.id === newItems[index].item_id)
    
    let processedValue = value
    if (field === 'quantity' || field === 'unit_price') {
      const strValue = String(value || '0')
      const englishValue = toEnglishDigits(strValue)
      processedValue = parseFloat(englishValue) || 0
    }
    
    newItems[index] = { ...newItems[index], [field]: processedValue }
    
    if (field === 'item_id' && value) {
      const selected = items.find(i => i.id === value)
      if (selected && !newItems[index].unit_price) {
        newItems[index].unit_price = selected.selling_price || 0
      }
    }
    
    const quantity = newItems[index].quantity || 0
    const price = newItems[index].unit_price || 0
    newItems[index].total_price = quantity * price
    
    setSaleItems(newItems)
  }

  const totalAmount = saleItems.reduce((sum, i) => sum + (i.total_price || 0), 0)

  const validItems = saleItems.filter(si => 
    si.item_id && si.quantity > 0 && si.unit_price > 0
  )

  const selectedStudentData = selectedStudent ? studentsList.find(s => s.id === selectedStudent) : null

  // ✅ Stock check function
  const checkStockAvailability = () => {
    for (const si of validItems) {
      const item = items.find(i => i.id === si.item_id)
      if (!item) {
        return { valid: false, message: `Item not found` }
      }
      if (item.current_stock < si.quantity) {
        return { 
          valid: false, 
          message: `Insufficient stock for "${item.name}". Available: ${item.current_stock} ${item.unit}, Requested: ${si.quantity} ${item.unit}`
        }
      }
    }
    return { valid: true, message: '' }
  }

  // ✅ Check if all items have valid stock (for button disable)
  const hasValidStock = useMemo(() => {
    for (const si of validItems) {
      const item = items.find(i => i.id === si.item_id)
      if (!item || item.current_stock < si.quantity) {
        return false
      }
    }
    return true
  }, [validItems, items])

  // ✅ Get stock status for individual item (for UI display)
  const getItemStockStatus = (itemId: string, quantity: number) => {
    const item = items.find(i => i.id === itemId)
    if (!item) return { hasStock: false, available: 0 }
    return {
      hasStock: item.current_stock >= quantity,
      available: item.current_stock
    }
  }

  const handleSubmit = async () => {
    if (!selectedStudent) {
      toast.error('Please select a student')
      return
    }

    if (validItems.length === 0) {
      toast.error('Please add at least one valid item (with quantity and price)')
      return
    }

    // ✅ Check stock before submitting
    const stockCheck = checkStockAvailability()
    if (!stockCheck.valid) {
      toast.error(stockCheck.message)
      return
    }

    setSubmitting(true)
    try {
      const itemsParam = validItems.map(si => ({
        item_id: si.item_id,
        quantity: si.quantity,
        selling_price: si.unit_price
      }))

      console.log('Submitting sale:', {
        student_id: selectedStudent,
        sale_date: saleDate,
        narration: narration || null,
        items: itemsParam
      })

      const { data, error } = await supabase.rpc('create_inventory_sale', {
        p_student_id: selectedStudent,
        p_sale_date: saleDate,
        p_narration: narration || null,
        p_items: itemsParam,
        p_status: 'completed'
      })

      if (error) {
        console.error('RPC Error Details:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        })
        
        let errorMessage = 'Failed to create sale'
        if (error.message) {
          const msg = error.message
          if (msg.includes('INSUFFICIENT_STOCK')) {
            // Parse which item has insufficient stock
            const match = msg.match(/Item\s+([a-f0-9-]+)\s+has\s+([\d.]+)\s+available,\s+but\s+([\d.]+)\s+requested/i)
            if (match) {
              const itemId = match[1]
              const available = match[2]
              const requested = match[3]
              const item = items.find(i => i.id === itemId)
              if (item) {
                errorMessage = `Insufficient stock for "${item.name}". Available: ${available} ${item.unit}, Requested: ${requested} ${item.unit}`
              } else {
                errorMessage = `Insufficient stock available. Available: ${available}, Requested: ${requested}`
              }
            } else {
              errorMessage = 'Insufficient stock available. Please check item quantities.'
            }
          } else if (msg.includes('INVALID_STUDENT')) {
            errorMessage = 'Selected student is not active or invalid.'
          } else if (msg.includes('INVALID_ITEM')) {
            errorMessage = 'Invalid item selected. Please select a valid item.'
          } else if (msg.includes('INVALID_QUANTITY')) {
            errorMessage = 'Invalid quantity entered. Quantity must be greater than 0.'
          } else if (msg.includes('NO_ITEMS')) {
            errorMessage = 'No valid items to sell. Please add items.'
          } else if (msg.includes('permission denied')) {
            errorMessage = 'You do not have permission to create a sale.'
          } else {
            errorMessage = msg
          }
        }
        toast.error(errorMessage)
        setSubmitting(false)
        return
      }

      if (data) {
        if (data.success === false) {
          const errorMsg = data.error || data.message || 'Failed to create sale'
          
          if (data.error === 'INSUFFICIENT_STOCK') {
            const item = items.find(i => i.id === data.item_id)
            if (item) {
              toast.error(`Insufficient stock for "${item.name}". Available: ${data.available} ${item.unit}, Requested: ${data.requested} ${item.unit}`)
            } else {
              toast.error(`Insufficient stock available. ${errorMsg}`)
            }
          } else {
            toast.error(errorMsg)
          }
          setSubmitting(false)
          return
        }
        
        if (data.sale_id || data.success === true) {
          toast.success(data.message || 'Sale recorded successfully')
          router.push('/inventory/sales')
          return
        }
      }

      toast.success('Sale recorded successfully')
      router.push('/inventory/sales')
      
    } catch (error: any) {
      console.error('Error creating sale:', error)
      
      let errorMessage = 'Failed to create sale'
      if (error?.message) {
        const msg = error.message
        if (msg.includes('INSUFFICIENT_STOCK')) {
          const match = msg.match(/Item\s+([a-f0-9-]+)\s+has\s+([\d.]+)\s+available/i)
          if (match) {
            const itemId = match[1]
            const available = match[2]
            const item = items.find(i => i.id === itemId)
            if (item) {
              errorMessage = `Insufficient stock for "${item.name}". Available: ${available} ${item.unit}`
            } else {
              errorMessage = `Insufficient stock available. Available: ${available}`
            }
          } else {
            errorMessage = 'Insufficient stock available.'
          }
        } else if (msg.includes('INVALID_STUDENT')) {
          errorMessage = 'Invalid student selected.'
        } else if (msg.includes('INVALID_ITEM')) {
          errorMessage = 'Invalid item selected.'
        } else if (msg.includes('NO_ITEMS')) {
          errorMessage = 'No items selected.'
        } else {
          errorMessage = msg
        }
      }
      toast.error(errorMessage)
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
          <h1 className="text-2xl font-bold font-heading">New Sale (POS)</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sale Details</CardTitle>
            <CardDescription>Sell books and uniforms to students</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="student-search" className="block text-sm font-medium mb-2">Student</Label>
              <div className="grid grid-cols-1 lg:grid-cols-[355px_150px_150px] gap-3" style={{ gap: '12px' }}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
                  <Input
                    id="student-search"
                    type="text"
                    placeholder="Search by ID, Roll or Name..."
                    className="pl-9 w-full"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div>
                  <Select value={selectedClass} onValueChange={setSelectedClass}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Classes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Classes</SelectItem>
                      {classes.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Select value={selectedSection} onValueChange={setSelectedSection}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Sections" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sections</SelectItem>
                      {filteredSections.map(sec => (
                        <SelectItem key={sec.id} value={sec.id}>
                          {sec.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            
            {selectedStudent && selectedStudentData && (
              <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <p className="font-medium text-emerald-900">{selectedStudentData.name}</p>
                <p className="text-sm text-emerald-700">
                  {selectedStudentData.student_id}
                  {selectedStudentData.class_roll && ` • Roll: ${selectedStudentData.class_roll}`}
                </p>
                <p className="text-xs text-emerald-600">
                  {selectedStudentData.classes?.name}
                  {selectedStudentData.sections?.name && ' • ' + selectedStudentData.sections.name}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 h-6 px-2 text-xs text-emerald-700 hover:bg-emerald-100"
                  onClick={() => {
                    setSelectedStudent('')
                    setSearchQuery('')
                    setSelectedClass('all')
                    setSelectedSection('all')
                  }}
                >
                  Change Student
                </Button>
              </div>
            )}

            {!selectedStudent && !hasActiveFilter && studentsList.length > 0 && (
              <p className="mt-2 text-sm text-muted-foreground">
                Type to search, or select a class/section
              </p>
            )}

            {!selectedStudent && filteredStudents.length > 0 && (
              <div className="mt-2 border rounded-lg max-h-60 overflow-y-auto">
                {filteredStudents.map(s => (
                  <button
                    key={s.id}
                    className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b last:border-b-0 flex justify-between items-center"
                    onClick={() => {
                      setSelectedStudent(s.id)
                      setSelectedClass(s.class_id)
                      setSelectedSection(s.section_id)
                      setSearchQuery('')
                    }}
                  >
                    <div>
                      <div className="font-medium">{s.name}</div>
                      <div className="text-xs text-gray-500">
                        {s.student_id}
                        {s.class_roll && ' • '}
                        {s.class_roll && `Roll ${s.class_roll}`}
                        {s.classes?.name && `${s.class_roll ? ' • ' : ''}${s.classes.name}`}
                        {s.sections?.name && ` • ${s.sections.name}`}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {!selectedStudent && filteredStudents.length === 0 && hasActiveFilter && studentsList.length > 0 && (
              <p className="mt-2 text-sm text-muted-foreground">
                No students found
              </p>
            )}

            {!selectedStudent && studentsList.length === 0 && !searchQuery && (
              <p className="mt-2 text-sm text-muted-foreground">No active students found</p>
            )}

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

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium">Items to Sell</h3>
                <Button variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                </Button>
              </div>
              
              <div className="space-y-3">
                {saleItems.map((si, index) => {
                  const item = items.find(i => i.id === si.item_id)
                  const stockStatus = item ? getItemStockStatus(item.id, si.quantity) : { hasStock: false, available: 0 }
                  const isStockInsufficient = si.item_id && !stockStatus.hasStock
                  
                  return (
                    <div key={index} className={`grid md:grid-cols-5 gap-3 p-3 border rounded-lg ${isStockInsufficient ? 'border-red-300 bg-red-50' : ''}`}>
                      <div>
                        <Label>Item</Label>
                        <Select 
                          value={si.item_id} 
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
                        {item && (
                          <div className={`text-xs mt-1 ${isStockInsufficient ? 'text-red-600 font-bold' : 'text-muted-foreground'}`}>
                            Available: {item.current_stock} {item.unit}
                            {isStockInsufficient && ` ⚠️ Insufficient stock!`}
                          </div>
                        )}
                      </div>
                      
                      <div>
                        <Label>Quantity ({item?.unit || 'pcs'})</Label>
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={si.quantity || ''}
                          onChange={(e) => {
                            const val = toEnglishDigits(e.target.value)
                            const num = parseFloat(val) || 0
                            updateItem(index, 'quantity', Math.max(1, num))
                          }}
                          placeholder="0"
                          className={isStockInsufficient ? 'border-red-500' : ''}
                        />
                      </div>
                      
                      <div>
                        <Label>Unit Price</Label>
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={si.unit_price || ''}
                          onChange={(e) => {
                            const val = toEnglishDigits(e.target.value)
                            const num = parseFloat(val) || 0
                            updateItem(index, 'unit_price', Math.max(0, num))
                          }}
                          placeholder="0.00"
                        />
                      </div>
                      
                      <div className="pt-5 text-right font-mono font-bold text-lg">
                        {formatCurrency(si.total_price || 0)}
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

              {/* ✅ Show warning if stock is insufficient */}
              {!hasValidStock && validItems.length > 0 && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600 font-medium">
                    ⚠️ Some items have insufficient stock. Please adjust quantities.
                  </p>
                </div>
              )}
            </div>

            <div className="border-t pt-4">
              <div className="flex justify-between items-center text-lg">
                <span className="text-muted-foreground">Total:</span>
                <span className="font-bold text-primary">{formatCurrency(totalAmount)}</span>
              </div>
            </div>

            {/* ✅ Button with stock validation */}
            <Button 
              onClick={handleSubmit} 
              disabled={submitting || !selectedStudent || validItems.length === 0 || !hasValidStock}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                'Complete Sale'
              )}
            </Button>

            {/* ✅ Additional help text when stock is insufficient */}
            {!hasValidStock && validItems.length > 0 && (
              <p className="text-xs text-center text-red-500">
                * Sale cannot be completed due to insufficient stock
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </ResponsiveLayout>
  )
}
