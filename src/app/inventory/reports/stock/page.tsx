"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { 
  Loader2, 
  Package, 
  Search, 
  AlertTriangle, 
  CheckCircle2,
  ArrowLeft,
  FileBarChart,
  Printer,
  FileSpreadsheet
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatCurrency } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { ResponsiveLayout } from "@/components/layout/responsive-layout"
import * as XLSX from "xlsx"
import { saveAs } from "file-saver"

const supabase = createClient()

type ItemType = 'all' | 'asset' | 'consumable' | 'saleable'

interface InventoryItem {
  id: string
  item_code: string
  name: string
  category_id: string | null
  item_type: string
  unit: string
  purchase_price: number
  current_stock: number
  reorder_level: number
  category?: { name: string }
}

interface SchoolSettings {
  school_name: string
  school_address: string
  school_phone: string
  school_email: string
  school_logo: string | null
}

// ✅ প্রিন্ট HTML
const generatePrintHTML = (items: InventoryItem[], stats: any, school: SchoolSettings | null) => {
  return `<!DOCTYPE html>
<html>
<head>
  <title>Stock Report</title>
  <meta charset="UTF-8">
  <style>
    @page { size: A4; margin: 0.5in; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; color: #1a1a2e; font-size: 9px; line-height: 1.5; background: white; }
    .container { max-width: 100%; padding: 0; }
    
    .header { 
      display: flex; 
      align-items: center; 
      justify-content: center;
      gap: 30px;
      border-bottom: 2px solid #1a1a2e; 
      padding-bottom: 12px; 
      margin-bottom: 16px; 
    }
    .header-left .logo { max-height: 60px; width: auto; }
    .header-right .school-name { font-size: 18px; font-weight: 700; text-transform: uppercase; }
    .header-right .school-address { font-size: 10px; color: #4b5563; margin: 2px 0; }
    .header-right .school-contact { font-size: 9px; color: #6b7280; }
    
    .title { 
      text-align: center; 
      font-size: 22px; 
      font-weight: 900; 
      padding: 10px 0; 
      margin: 10px 0; 
      color: #1a1a2e; 
      letter-spacing: 1px;
    }
    .sub-title { text-align: center; font-size: 12px; color: #4b5563; margin-bottom: 15px; }
    
    .table-wrap { margin: 12px 0; }
    table { width: 100%; border-collapse: collapse; font-size: 8px; }
    th { background: #1a1a2e; color: white; padding: 3px 5px; text-align: left; font-size: 7px; text-transform: uppercase; }
    th.text-right { text-align: right; }
    th.text-center { text-align: center; }
    td { padding: 3px 5px; border-bottom: 1px solid #e5e7eb; }
    td.text-right { text-align: right; }
    td.text-center { text-align: center; }
    
    .total-row { display: flex; justify-content: flex-end; padding: 8px; border-top: 2px solid #1a1a2e; margin-top: 10px; font-size: 14px; font-weight: 700; }
    .footer { text-align: center; font-size: 8px; color: #9ca3af; border-top: 1px solid #d1d5db; padding-top: 8px; margin-top: 15px; }
    
    @media print { th { background: #1a1a2e !important; -webkit-print-color-adjust: exact !important; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-left">
        ${school?.school_logo ? `<img src="${school.school_logo}" class="logo" alt="School Logo" />` : ''}
      </div>
      <div class="header-right">
        <div class="school-name">${school?.school_name || 'School Name'}</div>
        ${school?.school_address ? `<div class="school-address">${school.school_address}</div>` : ''}
        <div class="school-contact">
          ${school?.school_phone ? `📞 ${school.school_phone}` : ''}
          ${school?.school_email && school?.school_phone ? ' | ' : ''}
          ${school?.school_email ? `✉️ ${school.school_email}` : ''}
        </div>
      </div>
    </div>
    
    <div class="title">STOCK REPORT</div>
    <div class="sub-title">As of ${new Date().toLocaleDateString()}</div>
    
    <div class="table-wrap">
      <table>
        <thead><tr><th>Code</th><th>Name</th><th>Category</th><th>Type</th><th class="text-right">Stock</th><th class="text-right">Value</th><th class="text-center">Status</th></tr></thead>
        <tbody>
          ${items.slice(0, 100).map(item => {
            const value = item.current_stock * item.purchase_price
            const status = item.current_stock === 0 ? 'Out of Stock' : item.current_stock <= item.reorder_level ? 'Low Stock' : 'In Stock'
            return `
              <tr>
                <td>${item.item_code}</td>
                <td>${item.name}</td>
                <td>${item.category?.name || '-'}</td>
                <td>${item.item_type}</td>
                <td class="text-right">${item.current_stock} ${item.unit}</td>
                <td class="text-right">${formatCurrency(value)}</td>
                <td class="text-center">${status}</td>
              </tr>
            `
          }).join('')}
        </tbody>
      </table>
    </div>
    
    <div class="total-row">Total Value: ${formatCurrency(stats.totalValue)}</div>
    
    <div class="footer">Generated on ${new Date().toLocaleDateString('en-BD', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} • Powered by Kindergarten ERP</div>
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 300);
      window.onafterprint = function() { window.close(); };
    };
  </script>
</body>
</html>`
}

export default function StockReportPage() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedType, setSelectedType] = useState<ItemType>('all')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [itemsRes, settingsRes] = await Promise.all([
        supabase
          .from('inventory_items')
          .select('*, category:inventory_categories(name)')
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('school_settings')
          .select('school_name, school_address, school_phone, school_email, school_logo')
          .limit(1)
          .single()
      ])

      if (itemsRes.error) throw itemsRes.error
      setItems(itemsRes.data || [])

      if (!settingsRes.error && settingsRes.data) {
        setSchoolSettings(settingsRes.data as SchoolSettings)
      }
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        if (!item.name.toLowerCase().includes(q) && !item.item_code.toLowerCase().includes(q)) {
          return false
        }
      }
      if (selectedType !== 'all' && item.item_type !== selectedType) return false
      return true
    })
  }, [items, searchQuery, selectedType])

  const stats = useMemo(() => {
    const totalValue = items.reduce((sum, i) => sum + (i.current_stock * i.purchase_price), 0)
    const lowStock = items.filter(i => i.current_stock <= i.reorder_level && i.current_stock > 0).length
    const outOfStock = items.filter(i => i.current_stock === 0).length
    return { totalItems: items.length, totalValue, lowStock, outOfStock }
  }, [items])

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=900,height=700,scrollbars=yes')
    if (!printWindow) {
      toast.error('Please allow popups for printing')
      return
    }
    const html = generatePrintHTML(filteredItems, stats, schoolSettings)
    printWindow.document.write(html)
    printWindow.document.close()
  }

  const handleExportExcel = () => {
    try {
      const data = filteredItems.map(item => ({
        'Item Code': item.item_code,
        'Name': item.name,
        'Category': item.category?.name || '-',
        'Type': item.item_type,
        'Unit': item.unit,
        'Current Stock': item.current_stock,
        'Purchase Price': item.purchase_price,
        'Total Value': item.current_stock * item.purchase_price,
        'Reorder Level': item.reorder_level,
        'Status': item.current_stock === 0 ? 'Out of Stock' :
                  item.current_stock <= item.reorder_level ? 'Low Stock' : 'In Stock'
      }))

      const ws = XLSX.utils.json_to_sheet(data)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Stock')
      ws['!cols'] = [{ wch: 12 }, { wch: 25 }, { wch: 15 }, { wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }]
      
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      saveAs(blob, `Stock_Report_${new Date().toISOString().split('T')[0]}.xlsx`)
      toast.success('Excel exported successfully')
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Failed to export Excel')
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
      <div className="space-y-4">
        {/* ✅ কালারফুল হেডার */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
          <div className="flex items-center gap-3">
            <Link href="/inventory/reports">
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/10 h-8 w-8 p-0">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2 text-white">
                <Package className="h-5 w-5" />
                Stock Report
              </h2>
              <p className="text-xs text-emerald-100">Current inventory status</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={handlePrint} className="gap-2 bg-white text-emerald-700 hover:bg-emerald-50">
              <Printer className="h-4 w-4" />
              Print
            </Button>
            <Button size="sm" variant="ghost" onClick={handleExportExcel} className="gap-2 text-white hover:bg-white/10">
              <FileSpreadsheet className="h-4 w-4" />
              Excel
            </Button>
          </div>
        </div>

        {/* Stats - কালারফুল কার্ড */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <Card className="bg-gradient-to-br from-purple-600 to-indigo-600 border-0 shadow-lg">
            <CardHeader className="p-2 sm:p-3 pb-0">
              <CardTitle className="text-[10px] sm:text-xs font-medium text-purple-100">Total Items</CardTitle>
            </CardHeader>
            <CardContent className="p-2 sm:p-3 pt-0">
              <div className="text-sm sm:text-lg font-bold text-white">{stats.totalItems}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-emerald-600 to-green-600 border-0 shadow-lg">
            <CardHeader className="p-2 sm:p-3 pb-0">
              <CardTitle className="text-[10px] sm:text-xs font-medium text-emerald-100">Total Value</CardTitle>
            </CardHeader>
            <CardContent className="p-2 sm:p-3 pt-0">
              <div className="text-[10px] sm:text-base font-bold text-white truncate">{formatCurrency(stats.totalValue)}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-600 to-orange-600 border-0 shadow-lg">
            <CardHeader className="p-2 sm:p-3 pb-0">
              <CardTitle className="text-[10px] sm:text-xs font-medium text-amber-100">Low Stock</CardTitle>
            </CardHeader>
            <CardContent className="p-2 sm:p-3 pt-0">
              <div className="text-sm sm:text-lg font-bold text-white">{stats.lowStock}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-600 to-rose-600 border-0 shadow-lg">
            <CardHeader className="p-2 sm:p-3 pb-0">
              <CardTitle className="text-[10px] sm:text-xs font-medium text-red-100">Out of Stock</CardTitle>
            </CardHeader>
            <CardContent className="p-2 sm:p-3 pt-0">
              <div className="text-sm sm:text-lg font-bold text-white">{stats.outOfStock}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[120px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input
              placeholder="Search..."
              className="pl-8 h-8 sm:h-9 text-xs sm:text-sm bg-white dark:bg-zinc-800 border-gray-300 dark:border-zinc-600 text-gray-900 dark:text-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={selectedType} onValueChange={(v) => setSelectedType(v as ItemType)}>
            <SelectTrigger className="w-[100px] sm:w-36 h-8 sm:h-9 text-xs sm:text-sm bg-white dark:bg-zinc-800 border-gray-300 dark:border-zinc-600 text-gray-900 dark:text-white">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="asset">Asset</SelectItem>
              <SelectItem value="consumable">Consumable</SelectItem>
              <SelectItem value="saleable">Saleable</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
          <CardHeader className="p-3 sm:p-4 pb-0">
            <CardTitle className="text-sm sm:text-base text-gray-900 dark:text-white">Stock List</CardTitle>
            <CardDescription className="text-xs text-gray-500 dark:text-gray-400">{filteredItems.length} items found</CardDescription>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-2">
            {filteredItems.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <FileBarChart className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No items found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[10px] sm:text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700">
                      <th className="px-2 sm:px-3 py-1.5 text-left font-medium text-gray-600 dark:text-gray-300">Code</th>
                      <th className="px-2 sm:px-3 py-1.5 text-left font-medium text-gray-600 dark:text-gray-300">Name</th>
                      <th className="px-2 sm:px-3 py-1.5 text-left font-medium text-gray-600 dark:text-gray-300 hidden sm:table-cell">Category</th>
                      <th className="px-2 sm:px-3 py-1.5 text-left font-medium text-gray-600 dark:text-gray-300 hidden sm:table-cell">Type</th>
                      <th className="px-2 sm:px-3 py-1.5 text-right font-medium text-gray-600 dark:text-gray-300">Stock</th>
                      <th className="px-2 sm:px-3 py-1.5 text-right font-medium text-gray-600 dark:text-gray-300">Value</th>
                      <th className="px-2 sm:px-3 py-1.5 text-center font-medium text-gray-600 dark:text-gray-300">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.slice(0, 50).map((item) => {
                      const value = item.current_stock * item.purchase_price
                      const status = item.current_stock === 0 ? 'Out of Stock' :
                                     item.current_stock <= item.reorder_level ? 'Low Stock' : 'In Stock'
                      const statusColor = item.current_stock === 0 ? 'bg-red-100 dark:bg-red-900/60 text-red-800 dark:text-red-200' :
                                          item.current_stock <= item.reorder_level ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200' :
                                          'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200'
                      return (
                        <tr key={item.id} className="border-b border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                          <td className="px-2 sm:px-3 py-1.5 font-mono text-[10px] sm:text-xs text-gray-700 dark:text-gray-300">{item.item_code}</td>
                          <td className="px-2 sm:px-3 py-1.5 font-medium text-gray-900 dark:text-white">{item.name}</td>
                          <td className="px-2 sm:px-3 py-1.5 hidden sm:table-cell text-gray-700 dark:text-gray-300">{item.category?.name || '-'}</td>
                          <td className="px-2 sm:px-3 py-1.5 hidden sm:table-cell">
                            <Badge className="text-[8px] sm:text-[10px] capitalize bg-gray-100 dark:bg-zinc-700 text-gray-700 dark:text-gray-300">{item.item_type}</Badge>
                          </td>
                          <td className="px-2 sm:px-3 py-1.5 text-right text-gray-700 dark:text-gray-300">{item.current_stock} {item.unit}</td>
                          <td className="px-2 sm:px-3 py-1.5 text-right font-mono font-medium text-gray-900 dark:text-white">{formatCurrency(value)}</td>
                          <td className="px-2 sm:px-3 py-1.5 text-center">
                            <Badge className={`text-[8px] sm:text-[10px] ${statusColor}`}>{status}</Badge>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ResponsiveLayout>
  )
}
