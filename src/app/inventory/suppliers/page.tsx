"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { 
  ArrowLeft,
  Download,
  Plus,
  Search,
  Loader2,
  UserPlus,
  Edit as EditIcon,
  Trash2,
  AlertCircle,
  Phone,
  Mail,
  MapPin,
  Eye,
  Users,
  DollarSign,
  CreditCard
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { CurrencyInput } from "@/components/currency-input"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatCurrency } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { ResponsiveLayout } from "@/components/layout/responsive-layout"

const supabase = createClient()

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
  status?: string
}

interface SupplierForm {
  company_name: string
  contact_person: string
  phone: string
  email: string
  address: string
  current_due: number
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<InventorySupplier[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<InventorySupplier | null>(null)
  const [deletingSupplier, setDeletingSupplier] = useState<InventorySupplier | null>(null)
  const [addLoading, setAddLoading] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [formData, setFormData] = useState<SupplierForm>({
    company_name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    current_due: 0
  })

  useEffect(() => {
    loadSuppliers()
  }, [])

  const loadSuppliers = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('inventory_suppliers')
        .select('*')
        .eq('status', 'active')
        .order('company_name')
      
      if (error) throw error
      setSuppliers(data || [])
    } catch (error) {
      console.error('Error loading suppliers:', error)
      toast.error('Failed to load suppliers')
    } finally {
      setLoading(false)
    }
  }

  const filteredSuppliers = suppliers.filter(s => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return s.company_name.toLowerCase().includes(q) ||
             s.contact_person.toLowerCase().includes(q) ||
             s.phone.includes(searchQuery)
    }
    return true
  })

  const totalDue = suppliers.reduce((sum, s) => sum + (s.current_due || 0), 0)
  const suppliersWithDue = suppliers.filter(s => s.current_due > 0).length
  const zeroDueSuppliers = suppliers.filter(s => s.current_due === 0).length

  const stats = {
    totalSuppliers: suppliers.length,
    totalDue: totalDue,
    withDueBalance: suppliersWithDue,
    zeroDue: zeroDueSuppliers,
  }

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddLoading(true)

    const { error } = await supabase
      .from('inventory_suppliers')
      .insert([{
        company_name: formData.company_name,
        contact_person: formData.contact_person,
        phone: formData.phone,
        email: formData.email || null,
        address: formData.address || null,
        current_due: formData.current_due
      }])

    if (error) {
      console.error('Error adding supplier:', error.message || error)
      toast.error('Failed to add supplier')
    } else {
      toast.success('Supplier added successfully')
      setIsAddModalOpen(false)
      setFormData({
        company_name: '',
        contact_person: '',
        phone: '',
        email: '',
        address: '',
        current_due: 0
      })
      loadSuppliers()
    }
    setAddLoading(false)
  }

  const handleEditClick = (supplier: InventorySupplier) => {
    setEditingSupplier(supplier)
    setFormData({
      company_name: supplier.company_name,
      contact_person: supplier.contact_person,
      phone: supplier.phone,
      email: supplier.email || '',
      address: supplier.address || '',
      current_due: supplier.current_due || 0
    })
    setIsEditModalOpen(true)
  }

  const handleUpdateSupplier = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingSupplier) return
    
    setFormLoading(true)

    const { error } = await supabase
      .from('inventory_suppliers')
      .update({
        company_name: formData.company_name,
        contact_person: formData.contact_person,
        phone: formData.phone,
        email: formData.email || null,
        address: formData.address || null,
        current_due: formData.current_due || 0
      })
      .eq('id', editingSupplier.id)

    if (error) {
      console.error('Error updating supplier:', error.message || error)
      toast.error('Failed to update supplier')
    } else {
      toast.success('Supplier updated successfully')
      setIsEditModalOpen(false)
      setEditingSupplier(null)
      loadSuppliers()
    }
    setFormLoading(false)
  }

  const handleDeleteClick = (supplier: InventorySupplier) => {
    setDeletingSupplier(supplier)
    setIsDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!deletingSupplier) return
    
    setFormLoading(true)

    const { error: deleteError } = await supabase
      .from('inventory_suppliers')
      .update({ status: 'inactive' })
      .eq('id', deletingSupplier.id)

    if (deleteError) {
      console.error('Error deleting supplier:', deleteError.message || deleteError)
      toast.error('Failed to delete supplier')
    } else {
      toast.success('Supplier deleted successfully')
      setIsDeleteDialogOpen(false)
      setDeletingSupplier(null)
      loadSuppliers()
    }
    setFormLoading(false)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
  }

  const handleNumberChange = (field: keyof typeof formData) => (value: number) => {
    setFormData({ ...formData, [field]: value })
  }

  const getDueStatus = (due: number) => {
    if (due === 0) {
      return <Badge variant="success" className="text-xs">Cleared</Badge>
    }
    return <Badge variant="warning" className="text-xs">Due: {formatCurrency(due)}</Badge>
  }

  return (
    <ResponsiveLayout>
      <div className="space-y-6 p-4 sm:p-6">
        {/* Header */}
        <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link href="/inventory">
                <Button variant="ghost" size="sm" className="text-white hover:bg-white/10">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">Suppliers</h1>
                <p className="text-indigo-100 text-sm">Supplier directory with payable tracking</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/10">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button 
                onClick={() => setIsAddModalOpen(true)} 
                className="flex items-center gap-2 bg-white text-indigo-700 hover:bg-indigo-50 font-semibold"
              >
                <Plus className="h-4 w-4" />
                Add Supplier
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Cards - 50% smaller in horizontal row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <Card className="bg-gradient-to-r from-blue-700 to-indigo-700 border-blue-600 shadow-md">
            <CardHeader className="p-2 sm:p-3 pb-1">
              <CardTitle className="text-[10px] sm:text-xs text-white flex items-center gap-1">
                <Users className="h-3 w-3" />
                Total Suppliers
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 sm:p-3 pt-0">
              <div className="text-sm sm:text-base font-bold text-white">{stats.totalSuppliers}</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-emerald-700 to-teal-700 border-emerald-600 shadow-md">
            <CardHeader className="p-2 sm:p-3 pb-1">
              <CardTitle className="text-[10px] sm:text-xs text-white flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                Total Due
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 sm:p-3 pt-0">
              <div className="text-[11px] sm:text-sm font-bold text-white truncate">
                {formatCurrency(stats.totalDue)}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-amber-700 to-orange-700 border-amber-600 shadow-md">
            <CardHeader className="p-2 sm:p-3 pb-1">
              <CardTitle className="text-[10px] sm:text-xs text-white flex items-center gap-1">
                <CreditCard className="h-3 w-3" />
                With Due Balance
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 sm:p-3 pt-0">
              <div className="text-sm sm:text-base font-bold text-white">{stats.withDueBalance}</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-green-700 to-emerald-700 border-green-600 shadow-md">
            <CardHeader className="p-2 sm:p-3 pb-1">
              <CardTitle className="text-[10px] sm:text-xs text-white flex items-center gap-1">
                <UserPlus className="h-3 w-3" />
                Cleared
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 sm:p-3 pt-0">
              <div className="text-sm sm:text-base font-bold text-white">{stats.zeroDue}</div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filter - Horizontal Row */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by name, contact, or phone..."
              className="pl-9 bg-white text-gray-900 border-gray-300 h-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {searchQuery && (
            <Button variant="outline" size="sm" onClick={() => setSearchQuery("")} className="h-10">
              Clear
            </Button>
          )}
        </div>

        {/* Suppliers Table */}
        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle>Supplier Directory</CardTitle>
            <CardDescription>{loading ? 'Loading...' : `${filteredSuppliers.length} suppliers found`}</CardDescription>
          </CardHeader>
          <CardContent className="p-0 sm:p-6 pt-0">
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
              </div>
            ) : filteredSuppliers.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <UserPlus className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No suppliers found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-purple-50 dark:bg-slate-800/50">
                      <TableHead className="text-gray-900 dark:text-slate-100 font-semibold">Company</TableHead>
                      <TableHead className="text-gray-900 dark:text-slate-100 font-semibold">Contact Person</TableHead>
                      <TableHead className="text-gray-900 dark:text-slate-100 font-semibold">Phone</TableHead>
                      <TableHead className="text-gray-900 dark:text-slate-100 font-semibold hidden sm:table-cell">Email</TableHead>
                      <TableHead className="text-gray-900 dark:text-slate-100 font-semibold hidden md:table-cell">Address</TableHead>
                      <TableHead className="text-gray-900 dark:text-slate-100 font-semibold text-right">Due</TableHead>
                      <TableHead className="text-gray-900 dark:text-slate-100 font-semibold text-right">Actions</TableHead>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSuppliers.map((supplier) => (
                      <TableRow key={supplier.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/30">
                        <TableCell className="font-medium text-gray-900 dark:text-slate-100">
                          {supplier.company_name}
                        </TableCell>
                        <TableCell className="text-gray-800 dark:text-slate-200">
                          {supplier.contact_person}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                            <span className="text-gray-800 dark:text-slate-200">{supplier.phone}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {supplier.email ? (
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                              <span className="text-gray-800 dark:text-slate-200 truncate max-w-[120px]">{supplier.email}</span>
                            </div>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {supplier.address ? (
                            <div className="flex items-start gap-2">
                              <MapPin className="h-4 w-4 text-gray-500 dark:text-gray-400 flex-shrink-0 mt-0.5" />
                              <span className="text-sm text-gray-800 dark:text-slate-200 truncate max-w-[150px]">{supplier.address}</span>
                            </div>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {supplier.current_due > 0 ? (
                            <span className="font-medium text-amber-600 dark:text-amber-400">
                              {formatCurrency(supplier.current_due)}
                            </span>
                          ) : (
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">Cleared</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center gap-1 justify-end">
                            <Link href={`/inventory/suppliers/${supplier.id}`}>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                title="View Details"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                              title="Edit Supplier"
                              onClick={() => handleEditClick(supplier)}
                            >
                              <EditIcon className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                              title="Delete Supplier"
                              onClick={() => handleDeleteClick(supplier)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Supplier Dialog */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleAddSupplier}>
            <DialogHeader>
              <DialogTitle>Add New Supplier</DialogTitle>
              <DialogDescription>
                Enter supplier details to add to the directory
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="company_name">Company Name *</Label>
                <Input
                  id="company_name"
                  name="company_name"
                  value={formData.company_name}
                  onChange={handleInputChange}
                  placeholder="Company name"
                  required
                />
              </div>
              <div>
                <Label htmlFor="contact_person">Contact Person</Label>
                <Input
                  id="contact_person"
                  name="contact_person"
                  value={formData.contact_person}
                  onChange={handleInputChange}
                  placeholder="Contact person name"
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone *</Label>
                <Input
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="Phone number"
                  required
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Email address"
                />
              </div>
              <div>
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  placeholder="Supplier address"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="current_due">Opening Due / Balance (BDT)</Label>
                <CurrencyInput
                  value={formData.current_due}
                  onValueChange={handleNumberChange('current_due')}
                />
              </div>
            </div>
            <DialogFooter className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" type="button" onClick={() => setIsAddModalOpen(false)} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button type="submit" disabled={addLoading || !formData.company_name || !formData.phone} className="w-full sm:w-auto">
                {addLoading ? 'Adding...' : 'Add Supplier'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Supplier Dialog */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleUpdateSupplier}>
            <DialogHeader>
              <DialogTitle>Edit Supplier</DialogTitle>
              <DialogDescription>
                Update supplier information
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="company_name">Company Name *</Label>
                <Input
                  id="company_name"
                  name="company_name"
                  value={formData.company_name}
                  onChange={handleInputChange}
                  placeholder="Company name"
                  required
                />
              </div>
              <div>
                <Label htmlFor="contact_person">Contact Person</Label>
                <Input
                  id="contact_person"
                  name="contact_person"
                  value={formData.contact_person}
                  onChange={handleInputChange}
                  placeholder="Contact person name"
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone *</Label>
                <Input
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="Phone number"
                  required
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Email address"
                />
              </div>
              <div>
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  placeholder="Supplier address"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="current_due">Opening Due / Balance (BDT)</Label>
                <CurrencyInput
                  value={formData.current_due}
                  onValueChange={handleNumberChange('current_due')}
                />
              </div>
            </div>
            <DialogFooter className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" type="button" onClick={() => setIsEditModalOpen(false)} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button type="submit" disabled={formLoading || !formData.company_name || !formData.phone} className="w-full sm:w-auto">
                {formLoading ? 'Updating...' : 'Update Supplier'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Supplier Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Supplier</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {deletingSupplier?.company_name}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deletingSupplier && (
            <Alert variant="destructive" className="mt-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This will permanently remove the supplier. Any linked transactions will remain but the supplier will be archived.
              </AlertDescription>
            </Alert>
          )}
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={formLoading} className="w-full sm:w-auto">
              {formLoading ? 'Deleting...' : 'Delete Supplier'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ResponsiveLayout>
  )
}
