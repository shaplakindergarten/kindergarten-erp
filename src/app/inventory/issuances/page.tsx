"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { 
  ArrowLeft,
  Download,
  Loader2,
  Plus,
  Search,
  CheckCircle2,
  Eye,
  Edit,
  Trash2,
  Users,
  User,
  Package,
  Undo2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { formatCurrency, formatDate } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { ResponsiveLayout } from "@/components/layout/responsive-layout"

const supabase = createClient()

type IssueStatus = 'requested' | 'approved' | 'issued' | 'returned'
type IssuedToType = 'staff' | 'student'

interface InventoryIssuance {
  id: string
  issuance_no: string
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
}

interface InventoryItem {
  id: string
  item_code: string
  name: string
  unit: string
}

interface Staff {
  id: string
  name: string
}

export default function IssuancesPage() {
  const [issuances, setIssuances] = useState<InventoryIssuance[]>([])
  const [items, setItems] = useState<InventoryItem[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedStatus, setSelectedStatus] = useState<IssueStatus | 'all'>('all')
  const [selectedType, setSelectedType] = useState<IssuedToType | 'all'>('all')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingName, setDeletingName] = useState("")
  const [deletingQuantity, setDeletingQuantity] = useState<number>(0)
  const [deletingItem, setDeletingItem] = useState("")

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [issuancesRes, itemsRes, staffRes] = await Promise.all([
        supabase.from('inventory_issuances')
          .select('*')
          .order('issuance_date', { ascending: false }),
        supabase.from('inventory_items')
          .select('id, item_code, name, unit')
          .eq('is_active', true),
        supabase.from('staff')
          .select('id, name')
          .eq('role', 'admin_staff')
          .order('name'),
      ])

      if (issuancesRes.error) throw issuancesRes.error
      if (itemsRes.error) throw itemsRes.error
      if (staffRes.error) throw staffRes.error

      setIssuances(issuancesRes.data || [])
      setItems(itemsRes.data || [])
      setStaff(staffRes.data || [])
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const handleReturn = async (id: string) => {
    setSubmitting(true)
    try {
      const { data, error } = await supabase.rpc(
        'return_issuance_and_restore_stock',
        { p_issuance_id: id }
      )

      if (error) {
        console.error('RPC Error:', error)
        toast.error(error.message || 'Failed to return issuance')
        return
      }

      if (data && data.success === false) {
        toast.error(data.error || data.message || 'Failed to return issuance')
        return
      }

      toast.success(data?.message || 'Item returned and stock restored')
      loadData()
    } catch (error: any) {
      console.error('Error returning issuance:', error)
      toast.error(error?.message || 'Failed to return issuance')
    } finally {
      setSubmitting(false)
      setDeleteDialogOpen(false)
      setDeletingId(null)
      setDeletingName("")
      setDeletingQuantity(0)
      setDeletingItem("")
    }
  }

  const openReturnDialog = (issuance: InventoryIssuance) => {
    const item = items.find(i => i.id === issuance.item_id)
    setDeletingId(issuance.id)
    setDeletingName(issuance.issued_to_name)
    setDeletingQuantity(issuance.quantity)
    setDeletingItem(item?.name || 'Unknown Item')
    setDeleteDialogOpen(true)
  }

  const filteredIssuances = useMemo(() => {
    return issuances.filter(i => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        return i.issuance_no.toLowerCase().includes(q) ||
               i.issued_to_name.toLowerCase().includes(q)
      }
      if (selectedStatus !== 'all' && i.status !== selectedStatus) return false
      if (selectedType !== 'all' && i.issued_to_type !== selectedType) return false
      return true
    })
  }, [issuances, searchQuery, selectedStatus, selectedType])

  const statusCounts = useMemo(() => {
    return issuances.reduce((acc, i) => {
      acc[i.status] = (acc[i.status] || 0) + 1
      return acc
    }, {} as Record<IssueStatus, number>)
  }, [issuances])

  const stats = {
    totalIssuances: issuances.length,
    issuedCount: statusCounts.issued || 0,
    returnedCount: statusCounts.returned || 0,
  }

  const getStatusBadge = (status: IssueStatus) => {
    const styles = {
      requested: 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200',
      approved: 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200',
      issued: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200',
      returned: 'bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200'
    }
    const labels = {
      requested: 'Requested',
      approved: 'Approved', 
      issued: 'Issued',
      returned: 'Returned'
    }
    return <Badge className={`text-xs ${styles[status]}`}>{labels[status]}</Badge>
  }

  const getTypeBadge = (type: IssuedToType) => {
    return type === 'staff' 
      ? <Badge className="text-xs bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200">Staff</Badge>
      : <Badge className="text-xs bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200">Student</Badge>
  }

  return (
    <ResponsiveLayout>
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/inventory">
                <Button variant="ghost" size="sm" className="text-white hover:bg-white/10">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">Internal Issuances</h1>
                <p className="text-indigo-100 text-sm">Allocate stock to staff and teachers</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/10">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Link href="/inventory/issuances/new" className="flex items-center gap-2">
                <Button size="sm" className="bg-white text-indigo-700 hover:bg-indigo-50 font-semibold">
                  <Plus className="h-4 w-4 mr-2" />
                  New Issuance
                </Button>
              </Link>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-gradient-to-r from-purple-700 to-indigo-700 border-purple-600 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-white">Total Issuances</CardTitle>
              <CardDescription className="text-purple-200 text-xs">Recorded items</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{stats.totalIssuances}</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-green-700 to-emerald-700 border-green-600 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-white">Issued Items</CardTitle>
              <CardDescription className="text-green-200 text-xs">Successfully issued</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{stats.issuedCount}</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-amber-700 to-orange-700 border-amber-600 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-white">Returned</CardTitle>
              <CardDescription className="text-amber-200 text-xs">Items returned</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{stats.returnedCount}</div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by issuance no or recipient..."
              className="pl-9 bg-white text-gray-900 border-gray-300"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={selectedStatus} onValueChange={(v) => setSelectedStatus(v as any)}>
            <SelectTrigger className="w-full sm:w-40 bg-white text-gray-900">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="requested">Requested</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="issued">Issued</SelectItem>
              <SelectItem value="returned">Returned</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedType} onValueChange={(v) => setSelectedType(v as any)}>
            <SelectTrigger className="w-full sm:w-40 bg-white text-gray-900">
              <SelectValue placeholder="All Recipients" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Recipients</SelectItem>
              <SelectItem value="staff">Staff</SelectItem>
              <SelectItem value="student">Student</SelectItem>
            </SelectContent>
          </Select>
          {(searchQuery || selectedStatus !== 'all' || selectedType !== 'all') && (
            <Button variant="outline" size="sm" onClick={() => {
              setSearchQuery("")
              setSelectedStatus('all')
              setSelectedType('all')
            }}>
              Clear
            </Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Issuances List</CardTitle>
            <CardDescription>{filteredIssuances.length} issuances found</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
              </div>
            ) : filteredIssuances.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No issuances found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-purple-50 dark:bg-zinc-900 border-b">
                      <th className="px-4 py-3 text-left font-medium text-gray-900 dark:text-gray-100">Issuance No</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-900 dark:text-gray-100">Date</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-900 dark:text-gray-100">Recipient</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-900 dark:text-gray-100">Type</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-900 dark:text-gray-100">Quantity</th>
                      <th className="px-4 py-3 text-center font-medium text-gray-900 dark:text-gray-100">Status</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-900 dark:text-gray-100">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredIssuances.map((issuance) => (
                      <tr key={issuance.id} className="border-b hover:bg-gray-50 dark:hover:bg-zinc-800/60">
                        <td className="px-4 py-3 font-mono text-sm text-gray-900 dark:text-gray-100">{issuance.issuance_no}</td>
                        <td className="px-4 py-3 text-gray-800 dark:text-gray-200">{formatDate(issuance.issuance_date)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {issuance.issued_to_type === 'staff' ? (
                              <Users className="h-4 w-4 text-purple-600" />
                            ) : (
                              <User className="h-4 w-4 text-indigo-600" />
                            )}
                            <span className="font-medium text-gray-900 dark:text-gray-100">{issuance.issued_to_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">{getTypeBadge(issuance.issued_to_type)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-gray-400" />
                            <span className="font-medium text-gray-900 dark:text-gray-100">{issuance.quantity} {issuance.unit}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">{getStatusBadge(issuance.status)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Link href={`/inventory/issuances/${issuance.id}`}>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                title="View Details"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Link href={`/inventory/issuances/${issuance.id}/edit`}>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                title="Edit Issuance"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </Link>
                            {issuance.status !== 'returned' && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                title="Return Item (Restore Stock)"
                                onClick={() => openReturnDialog(issuance)}
                                disabled={submitting}
                              >
                                <Undo2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Return Confirmation Dialog - ফিক্স করা হয়েছে */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Return Item to Stock?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-gray-500">
                <p>
                  This will mark the issuance for <strong>{deletingName}</strong> as returned.
                </p>
                <div className="bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
                  <p className="text-sm">
                    <span className="font-semibold">📦 {deletingQuantity}</span> unit(s) of{' '}
                    <span className="font-semibold">{deletingItem}</span> will be{' '}
                    <span className="text-emerald-600 font-semibold">restored to inventory</span>.
                  </p>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  This action cannot be undone.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deletingId && handleReturn(deletingId)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Undo2 className="h-4 w-4 mr-2" />
                  Yes, Return Item
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ResponsiveLayout>
  )
}
