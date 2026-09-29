"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { 
  Loader2, 
  LayoutDashboard,
  ShoppingCart,
  Package,
  DollarSign,
  FileText,
  ArrowRight,
  Box,
  AlertTriangle,
  CheckCircle2,
  Printer,
  FileSpreadsheet
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { ResponsiveLayout } from "@/components/layout/responsive-layout"
import * as XLSX from "xlsx"
import { saveAs } from "file-saver"

const supabase = createClient()

type ItemType = 'asset' | 'consumable' | 'saleable'

interface InventoryItem {
  id: string
  item_code: string
  name: string
  category_id: string | null
  item_type: ItemType
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
const generatePrintHTML = (stats: any, items: InventoryItem[], school: SchoolSettings | null) => {
  return `<!DOCTYPE html>
<html>
<head>
  <title>Inventory Overview Report</title>
  <meta charset="UTF-8">
  <style>
    @page { size: A4; margin: 0.5in; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; color: #1a1a2e; font-size: 10px; line-height: 1.5; background: white; }
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
    
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 12px 0; }
    .stat-box { border: 1px solid #d1d5db; padding: 8px; text-align: center; border-radius: 4px; }
    .stat-box .label { font-size: 9px; color: #6b7280; text-transform: uppercase; }
    .stat-box .value { font-size: 16px; font-weight: 700; }
    
    .type-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 12px 0; }
    .type-box { border: 1px solid #d1d5db; padding: 8px; border-radius: 4px; border-left: 3px solid #1a1a2e; }
    .type-box .label { font-size: 10px; font-weight: 600; }
    .type-box .value { font-size: 14px; font-weight: 700; margin-top: 2px; }
    .type-box .sub { font-size: 8px; color: #6b7280; }
    
    .total-row { display: flex; justify-content: flex-end; padding: 8px; border-top: 2px solid #1a1a2e; margin-top: 10px; font-size: 14px; font-weight: 700; }
    .footer { text-align: center; font-size: 8px; color: #9ca3af; border-top: 1px solid #d1d5db; padding-top: 8px; margin-top: 15px; }
    
    @media print { 
      .stat-box { border-color: #d1d5db !important; }
      .type-box { border-color: #d1d5db !important; }
    }
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
    
    <div class="title">INVENTORY OVERVIEW</div>
    <div class="sub-title">${new Date().toLocaleDateString('en-BD', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
    
    <div class="stats-grid">
      <div class="stat-box"><div class="label">Total Items</div><div class="value">${stats.totalItems}</div></div>
      <div class="stat-box"><div class="label">Total Value</div><div class="value">${formatCurrency(stats.totalValue)}</div></div>
      <div class="stat-box" style="border-left:3px solid #f59e0b;"><div class="label">Low Stock</div><div class="value" style="color:#d97706;">${stats.lowStock}</div></div>
      <div class="stat-box" style="border-left:3px solid #dc2626;"><div class="label">Out of Stock</div><div class="value" style="color:#dc2626;">${stats.outOfStock}</div></div>
    </div>
    
    <div class="type-grid">
      <div class="type-box" style="border-left-color:#f59e0b;"><div class="label" style="color:#f59e0b;">Fixed Assets</div><div class="value">${formatCurrency(stats.assetValue)}</div><div class="sub">${items.filter(i => i.item_type === 'asset').length} items</div></div>
      <div class="type-box" style="border-left-color:#3b82f6;"><div class="label" style="color:#3b82f6;">Consumables</div><div class="value">${formatCurrency(stats.consumableValue)}</div><div class="sub">${items.filter(i => i.item_type === 'consumable').length} items</div></div>
      <div class="type-box" style="border-left-color:#10b981;"><div class="label" style="color:#10b981;">Saleable Items</div><div class="value">${formatCurrency(stats.saleableValue)}</div><div class="sub">${items.filter(i => i.item_type === 'saleable').length} items</div></div>
    </div>
    
    <div class="total-row">Grand Total Value: ${formatCurrency(stats.totalValue)}</div>
    
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

export default function ReportsOverviewPage() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings | null>(null)
  const [loading, setLoading] = useState(true)

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

  const stats = useMemo(() => {
    const totalValue = items.reduce((sum, i) => sum + (i.current_stock * i.purchase_price), 0)
    const lowStockItems = items.filter(i => i.current_stock <= i.reorder_level && i.current_stock > 0)
    const outOfStockItems = items.filter(i => i.current_stock === 0)
    
    const assetValue = items.filter(i => i.item_type === 'asset')
      .reduce((sum, i) => sum + (i.current_stock * i.purchase_price), 0)
    const consumableValue = items.filter(i => i.item_type === 'consumable')
      .reduce((sum, i) => sum + (i.current_stock * i.purchase_price), 0)
    const saleableValue = items.filter(i => i.item_type === 'saleable')
      .reduce((sum, i) => sum + (i.current_stock * i.purchase_price), 0)

    return {
      totalItems: items.length,
      totalValue,
      lowStock: lowStockItems.length,
      outOfStock: outOfStockItems.length,
      assetValue,
      consumableValue,
      saleableValue,
    }
  }, [items])

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=900,height=700,scrollbars=yes')
    if (!printWindow) {
      toast.error('Please allow popups for printing')
      return
    }
    const html = generatePrintHTML(stats, items, schoolSettings)
    printWindow.document.write(html)
    printWindow.document.close()
  }

  const handleExportExcel = () => {
    try {
      const data = items.map(item => ({
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
      XLSX.utils.book_append_sheet(wb, ws, 'Inventory')
      ws['!cols'] = [
        { wch: 12 }, { wch: 25 }, { wch: 15 }, { wch: 12 },
        { wch: 8 }, { wch: 12 }, { wch: 14 }, { wch: 14 },
        { wch: 14 }, { wch: 14 }
      ]

      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      saveAs(blob, `Inventory_Overview_${new Date().toISOString().split('T')[0]}.xlsx`)
      toast.success('Excel exported successfully')
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Failed to export Excel')
    }
  }

  const reportCards = [
    {
      title: "Purchase Report",
      description: "Track all purchase transactions",
      icon: ShoppingCart,
      href: "/inventory/reports/purchase",
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-50 dark:bg-blue-950/30",
      borderColor: "border-blue-200 dark:border-blue-800",
    },
    {
      title: "Stock Report",
      description: "Current inventory status and valuation",
      icon: Package,
      href: "/inventory/reports/stock",
      color: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
      borderColor: "border-emerald-200 dark:border-emerald-800",
    },
    {
      title: "Sales Report",
      description: "Track all sales transactions",
      icon: DollarSign,
      href: "/inventory/reports/sales",
      color: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-50 dark:bg-purple-950/30",
      borderColor: "border-purple-200 dark:border-purple-800",
    },
    {
      title: "Issue Report",
      description: "Track all internal issuances",
      icon: FileText,
      href: "/inventory/reports/issue",
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-50 dark:bg-amber-950/30",
      borderColor: "border-amber-200 dark:border-amber-800",
    },
  ]

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
        {/* ✅ কালারফুল হেডার */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
          <div className="flex items-center gap-3">
            <LayoutDashboard className="h-5 w-5" />
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">Inventory Reports</h1>
              <p className="text-xs text-indigo-100">Overview and detailed reports</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={handlePrint} className="gap-2 bg-white text-indigo-700 hover:bg-indigo-50">
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="bg-gradient-to-br from-purple-600 to-indigo-600 border-0 shadow-lg">
            <CardHeader className="p-3 pb-0">
              <CardTitle className="text-xs font-medium text-purple-100">Total Items</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold text-white">{stats.totalItems}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-emerald-600 to-green-600 border-0 shadow-lg">
            <CardHeader className="p-3 pb-0">
              <CardTitle className="text-xs font-medium text-emerald-100">Total Value</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-sm font-bold text-white truncate">{formatCurrency(stats.totalValue)}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-600 to-orange-600 border-0 shadow-lg">
            <CardHeader className="p-3 pb-0">
              <CardTitle className="text-xs font-medium text-amber-100">Low Stock</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold text-white">{stats.lowStock}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-600 to-rose-600 border-0 shadow-lg">
            <CardHeader className="p-3 pb-0">
              <CardTitle className="text-xs font-medium text-red-100">Out of Stock</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold text-white">{stats.outOfStock}</div>
            </CardContent>
          </Card>
        </div>

        {/* Type-wise Valuation - কালারফুল কার্ড */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="border-l-4 border-l-amber-500 bg-gradient-to-r from-amber-50 to-amber-100/50 dark:from-amber-950/20 dark:to-amber-950/10">
            <CardHeader className="p-3 pb-0">
              <CardTitle className="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-2">
                <Box className="h-4 w-4" />
                Fixed Assets
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(stats.assetValue)}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{items.filter(i => i.item_type === 'asset').length} items</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-50 to-blue-100/50 dark:from-blue-950/20 dark:to-blue-950/10">
            <CardHeader className="p-3 pb-0">
              <CardTitle className="text-xs font-medium text-blue-600 dark:text-blue-400 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Consumables
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(stats.consumableValue)}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{items.filter(i => i.item_type === 'consumable').length} items</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-emerald-500 bg-gradient-to-r from-emerald-50 to-emerald-100/50 dark:from-emerald-950/20 dark:to-emerald-950/10">
            <CardHeader className="p-3 pb-0">
              <CardTitle className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Saleable Items
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(stats.saleableValue)}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{items.filter(i => i.item_type === 'saleable').length} items</div>
            </CardContent>
          </Card>
        </div>

        {/* Report Cards */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Available Reports</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {reportCards.map((card) => {
              const Icon = card.icon
              return (
                <Link key={card.href} href={card.href}>
                  <Card className={`hover:shadow-lg transition-all hover:scale-[1.02] cursor-pointer border ${card.borderColor} ${card.bgColor}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className={`p-2 rounded-lg ${card.bgColor} w-fit mb-2`}>
                            <Icon className={`h-5 w-5 ${card.color}`} />
                          </div>
                          <h3 className="font-semibold text-sm text-gray-900 dark:text-white">{card.title}</h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{card.description}</p>
                        </div>
                        <ArrowRight className={`h-4 w-4 ${card.color}`} />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </ResponsiveLayout>
  )
}
