"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { 
  Loader2, 
  DollarSign, 
  Calendar,
  Printer,
  Search,
  ArrowLeft,
  FileBarChart,
  FileSpreadsheet
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatCurrency, formatDate } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { ResponsiveLayout } from "@/components/layout/responsive-layout"
import * as XLSX from "xlsx"
import { saveAs } from "file-saver"

const supabase = createClient()

interface Sale {
  id: string
  sale_no: string
  student_id: string
  sale_date: string
  net_amount: number
  status: string
  student?: { name: string; student_id: string }
  items?: { quantity: number; total_price: number }[]
}

interface SchoolSettings {
  school_name: string
  school_address: string
  school_phone: string
  school_email: string
  school_logo: string | null
}

// ✅ প্রিন্ট HTML
const generatePrintHTML = (sales: Sale[], startDate: string, endDate: string, stats: any, school: SchoolSettings | null) => {
  return `<!DOCTYPE html>
<html>
<head>
  <title>Sales Report</title>
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
    
    <div class="title">SALES REPORT</div>
    <div class="sub-title">${formatDate(startDate)} to ${formatDate(endDate)}</div>
    
    <div class="table-wrap">
      <table>
        <thead><tr><th>Sale No</th><th>Date</th><th>Student</th><th class="text-right">Items</th><th class="text-right">Total</th><th class="text-center">Status</th></tr></thead>
        <tbody>
          ${sales.slice(0, 100).map(s => `
            <tr>
              <td>${s.sale_no}</td>
              <td>${formatDate(s.sale_date)}</td>
              <td>${s.student?.name || '-'}</td>
              <td class="text-right">${s.items?.length || 0}</td>
              <td class="text-right">${formatCurrency(s.net_amount)}</td>
              <td class="text-center">${s.status || 'completed'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    
    <div class="total-row">Total Revenue: ${formatCurrency(stats.totalRevenue)}</div>
    
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

export default function SalesReportPage() {
  const [sales, setSales] = useState<Sale[]>([])
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return d.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    loadData()
  }, [startDate, endDate])

  const loadData = async () => {
    setLoading(true)
    try {
      const [salesRes, settingsRes] = await Promise.all([
        supabase
          .from('inventory_sales')
          .select(`
            *,
            student:students(name, student_id)
          `)
          .gte('sale_date', startDate)
          .lte('sale_date', endDate)
          .order('sale_date', { ascending: false }),
        supabase
          .from('school_settings')
          .select('school_name, school_address, school_phone, school_email, school_logo')
          .limit(1)
          .single()
      ])

      if (salesRes.error) throw salesRes.error

      if (!settingsRes.error && settingsRes.data) {
        setSchoolSettings(settingsRes.data as SchoolSettings)
      }

      if (salesRes.data && salesRes.data.length > 0) {
        const salesWithItems = await Promise.all(
          salesRes.data.map(async (sale) => {
            const { data: itemsData } = await supabase
              .from('inventory_sale_items')
              .select('quantity, total_price')
              .eq('sale_id', sale.id)
            return { ...sale, items: itemsData || [] }
          })
        )
        setSales(salesWithItems)
      } else {
        setSales([])
      }
    } catch (error: any) {
      console.error('Error loading sales:', error)
      toast.error(error?.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const filteredSales = useMemo(() => {
    if (!searchQuery) return sales
    const q = searchQuery.toLowerCase()
    return sales.filter(s => 
      s.sale_no.toLowerCase().includes(q) ||
      s.student?.name?.toLowerCase().includes(q)
    )
  }, [sales, searchQuery])

  const stats = useMemo(() => {
    const totalRevenue = sales.reduce((sum, s) => sum + (s.net_amount || 0), 0)
    const totalItems = sales.reduce((sum, s) => sum + (s.items?.length || 0), 0)
    const students = new Set(sales.map(s => s.student_id)).size
    return { totalRevenue, totalItems, students, count: sales.length }
  }, [sales])

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=900,height=700,scrollbars=yes')
    if (!printWindow) {
      toast.error('Please allow popups for printing')
      return
    }
    const html = generatePrintHTML(filteredSales, startDate, endDate, stats, schoolSettings)
    printWindow.document.write(html)
    printWindow.document.close()
  }

  const handleExportExcel = () => {
    try {
      const data = filteredSales.map(s => ({
        'Sale No': s.sale_no,
        'Date': formatDate(s.sale_date),
        'Student': s.student?.name || '-',
        'Student ID': s.student?.student_id || '-',
        'Items': s.items?.length || 0,
        'Total Amount': s.net_amount,
        'Status': s.status || 'completed'
      }))

      const ws = XLSX.utils.json_to_sheet(data)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Sales')
      ws['!cols'] = [{ wch: 15 }, { wch: 14 }, { wch: 20 }, { wch: 15 }, { wch: 10 }, { wch: 16 }, { wch: 12 }]
      
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      saveAs(blob, `Sales_Report_${new Date().toISOString().split('T')[0]}.xlsx`)
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
          <div className="flex items-center gap-3">
            <Link href="/inventory/reports">
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/10 h-8 w-8 p-0">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2 text-white">
                <DollarSign className="h-5 w-5" />
                Sales Report
              </h2>
              <p className="text-xs text-purple-100">
                {formatDate(startDate)} to {formatDate(endDate)}
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={handlePrint} className="gap-2 bg-white text-purple-700 hover:bg-purple-50">
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
              <CardTitle className="text-[10px] sm:text-xs font-medium text-purple-100">Total Sales</CardTitle>
            </CardHeader>
            <CardContent className="p-2 sm:p-3 pt-0">
              <div className="text-sm sm:text-lg font-bold text-white">{stats.count}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-emerald-600 to-green-600 border-0 shadow-lg">
            <CardHeader className="p-2 sm:p-3 pb-0">
              <CardTitle className="text-[10px] sm:text-xs font-medium text-emerald-100">Total Revenue</CardTitle>
            </CardHeader>
            <CardContent className="p-2 sm:p-3 pt-0">
              <div className="text-[10px] sm:text-base font-bold text-white truncate">{formatCurrency(stats.totalRevenue)}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-600 to-cyan-600 border-0 shadow-lg">
            <CardHeader className="p-2 sm:p-3 pb-0">
              <CardTitle className="text-[10px] sm:text-xs font-medium text-blue-100">Items Sold</CardTitle>
            </CardHeader>
            <CardContent className="p-2 sm:p-3 pt-0">
              <div className="text-sm sm:text-lg font-bold text-white">{stats.totalItems}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-600 to-orange-600 border-0 shadow-lg">
            <CardHeader className="p-2 sm:p-3 pb-0">
              <CardTitle className="text-[10px] sm:text-xs font-medium text-amber-100">Students</CardTitle>
            </CardHeader>
            <CardContent className="p-2 sm:p-3 pt-0">
              <div className="text-sm sm:text-lg font-bold text-white">{stats.students}</div>
            </CardContent>
          </Card>
        </div>

        {/* Date Range */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 bg-gray-50 dark:bg-zinc-900/50 p-3 rounded-lg border border-gray-200 dark:border-zinc-700">
          <Calendar className="h-4 w-4 text-gray-400" />
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-auto h-8 sm:h-9 text-xs sm:text-sm max-w-[140px] sm:max-w-[160px] bg-white dark:bg-zinc-800 border-gray-300 dark:border-zinc-600 text-gray-900 dark:text-white"
          />
          <span className="text-xs text-gray-500 dark:text-gray-400">to</span>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-auto h-8 sm:h-9 text-xs sm:text-sm max-w-[140px] sm:max-w-[160px] bg-white dark:bg-zinc-800 border-gray-300 dark:border-zinc-600 text-gray-900 dark:text-white"
          />
          <div className="flex-1 min-w-[100px]">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <Input
                placeholder="Search..."
                className="pl-8 h-8 sm:h-9 text-xs sm:text-sm bg-white dark:bg-zinc-800 border-gray-300 dark:border-zinc-600 text-gray-900 dark:text-white"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
          <CardHeader className="p-3 sm:p-4 pb-0">
            <CardTitle className="text-sm sm:text-base text-gray-900 dark:text-white">Sales History</CardTitle>
            <CardDescription className="text-xs text-gray-500 dark:text-gray-400">{filteredSales.length} sales found</CardDescription>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-2">
            {filteredSales.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <FileBarChart className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No sales found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[10px] sm:text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700">
                      <th className="px-2 sm:px-3 py-1.5 text-left font-medium text-gray-600 dark:text-gray-300">Sale No</th>
                      <th className="px-2 sm:px-3 py-1.5 text-left font-medium text-gray-600 dark:text-gray-300">Date</th>
                      <th className="px-2 sm:px-3 py-1.5 text-left font-medium text-gray-600 dark:text-gray-300">Student</th>
                      <th className="px-2 sm:px-3 py-1.5 text-right font-medium text-gray-600 dark:text-gray-300">Items</th>
                      <th className="px-2 sm:px-3 py-1.5 text-right font-medium text-gray-600 dark:text-gray-300">Total</th>
                      <th className="px-2 sm:px-3 py-1.5 text-center font-medium text-gray-600 dark:text-gray-300">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSales.slice(0, 50).map((sale) => (
                      <tr key={sale.id} className="border-b border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                        <td className="px-2 sm:px-3 py-1.5 font-mono text-[10px] sm:text-xs text-gray-700 dark:text-gray-300">{sale.sale_no}</td>
                        <td className="px-2 sm:px-3 py-1.5 text-gray-700 dark:text-gray-300">{formatDate(sale.sale_date)}</td>
                        <td className="px-2 sm:px-3 py-1.5 text-gray-700 dark:text-gray-300">{sale.student?.name || '-'}</td>
                        <td className="px-2 sm:px-3 py-1.5 text-right text-gray-700 dark:text-gray-300">{sale.items?.length || 0}</td>
                        <td className="px-2 sm:px-3 py-1.5 text-right font-mono font-medium text-gray-900 dark:text-white">{formatCurrency(sale.net_amount)}</td>
                        <td className="px-2 sm:px-3 py-1.5 text-center">
                          <Badge className={`text-[8px] sm:text-[10px] ${
                            sale.status === 'completed' ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200' :
                            sale.status === 'returned' ? 'bg-red-100 dark:bg-red-900/60 text-red-800 dark:text-red-200' :
                            'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200'
                          }`}>
                            {sale.status || 'completed'}
                          </Badge>
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
    </ResponsiveLayout>
  )
}
