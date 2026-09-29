"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { 
  Loader2, 
  FileText, 
  Users, 
  Package, 
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
import { formatDate } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { ResponsiveLayout } from "@/components/layout/responsive-layout"
import * as XLSX from "xlsx"
import { saveAs } from "file-saver"

const supabase = createClient()

interface Issue {
  id: string
  issuance_no: string
  issue_no?: string
  issued_to_type: string
  issued_to_id: string
  issued_to_name: string
  issuance_date: string
  quantity: number
  unit: string
  status: string
  item_id?: string
  item?: { name: string; item_code: string }
}

interface SchoolSettings {
  school_name: string
  school_address: string
  school_phone: string
  school_email: string
  school_logo: string | null
}

// ✅ প্রিন্ট HTML
const generatePrintHTML = (issues: Issue[], startDate: string, endDate: string, stats: any, school: SchoolSettings | null) => {
  return `<!DOCTYPE html>
<html>
<head>
  <title>Issue Report</title>
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
    
    <div class="title">ISSUE REPORT</div>
    <div class="sub-title">${formatDate(startDate)} to ${formatDate(endDate)}</div>
    
    <div class="table-wrap">
      <table>
        <thead><tr><th>Issue No</th><th>Date</th><th>Recipient</th><th>Item</th><th class="text-right">Qty</th><th class="text-center">Status</th></tr></thead>
        <tbody>
          ${issues.slice(0, 100).map(i => `
            <tr>
              <td>${i.issuance_no || i.issue_no || 'N/A'}</td>
              <td>${formatDate(i.issuance_date)}</td>
              <td>${i.issued_to_name}</td>
              <td>${i.item?.name || i.item_id || '-'}</td>
              <td class="text-right">${i.quantity} ${i.unit}</td>
              <td class="text-center">${i.status || 'issued'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    
    <div class="total-row">Total Items Issued: ${stats.totalItems}</div>
    
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

export default function IssueReportPage() {
  const [issues, setIssues] = useState<Issue[]>([])
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
      const [issuesRes, settingsRes] = await Promise.all([
        supabase
          .from('inventory_issuances')
          .select('*')
          .gte('issuance_date', startDate)
          .lte('issuance_date', endDate)
          .order('issuance_date', { ascending: false }),
        supabase
          .from('school_settings')
          .select('school_name, school_address, school_phone, school_email, school_logo')
          .limit(1)
          .single()
      ])

      if (issuesRes.error) throw issuesRes.error

      if (!settingsRes.error && settingsRes.data) {
        setSchoolSettings(settingsRes.data as SchoolSettings)
      }

      if (issuesRes.data && issuesRes.data.length > 0) {
        const itemIds = issuesRes.data
          .map((i: any) => i.item_id)
          .filter((id: string) => id)

        if (itemIds.length > 0) {
          const { data: itemsData } = await supabase
            .from('inventory_items')
            .select('id, name, item_code')
            .in('id', itemIds)

          const itemMap = new Map()
          itemsData?.forEach((item: any) => {
            itemMap.set(item.id, item)
          })

          const enrichedData = issuesRes.data.map((issue: any) => ({
            ...issue,
            item: itemMap.get(issue.item_id) || null
          }))
          setIssues(enrichedData)
        } else {
          setIssues(issuesRes.data)
        }
      } else {
        setIssues([])
      }
    } catch (error: any) {
      console.error('Error loading issues:', error)
      toast.error(error?.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const filteredIssues = useMemo(() => {
    if (!searchQuery) return issues
    const q = searchQuery.toLowerCase()
    return issues.filter(i => 
      (i.issuance_no || i.issue_no || '').toLowerCase().includes(q) ||
      i.issued_to_name.toLowerCase().includes(q)
    )
  }, [issues, searchQuery])

  const stats = useMemo(() => {
    const totalItems = issues.reduce((sum, i) => sum + (i.quantity || 0), 0)
    const recipients = new Set(issues.map(i => i.issued_to_name)).size
    return { totalItems, recipients, count: issues.length }
  }, [issues])

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=900,height=700,scrollbars=yes')
    if (!printWindow) {
      toast.error('Please allow popups for printing')
      return
    }
    const html = generatePrintHTML(filteredIssues, startDate, endDate, stats, schoolSettings)
    printWindow.document.write(html)
    printWindow.document.close()
  }

  const handleExportExcel = () => {
    try {
      const data = filteredIssues.map(i => ({
        'Issue No': i.issuance_no || i.issue_no || 'N/A',
        'Date': formatDate(i.issuance_date),
        'Recipient': i.issued_to_name,
        'Recipient Type': i.issued_to_type,
        'Item': i.item?.name || i.item_id || '-',
        'Quantity': i.quantity,
        'Unit': i.unit,
        'Status': i.status || 'issued'
      }))

      const ws = XLSX.utils.json_to_sheet(data)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Issues')
      ws['!cols'] = [{ wch: 15 }, { wch: 14 }, { wch: 20 }, { wch: 12 }, { wch: 20 }, { wch: 10 }, { wch: 8 }, { wch: 12 }]
      
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      saveAs(blob, `Issue_Report_${new Date().toISOString().split('T')[0]}.xlsx`)
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 text-white">
          <div className="flex items-center gap-3">
            <Link href="/inventory/reports">
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/10 h-8 w-8 p-0">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2 text-white">
                <FileText className="h-5 w-5" />
                Issue Report
              </h2>
              <p className="text-xs text-amber-100">
                {formatDate(startDate)} to {formatDate(endDate)}
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={handlePrint} className="gap-2 bg-white text-amber-700 hover:bg-amber-50">
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
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
          <Card className="bg-gradient-to-br from-purple-600 to-indigo-600 border-0 shadow-lg">
            <CardHeader className="p-2 sm:p-3 pb-0">
              <CardTitle className="text-[10px] sm:text-xs font-medium text-purple-100">Total Issues</CardTitle>
            </CardHeader>
            <CardContent className="p-2 sm:p-3 pt-0">
              <div className="text-sm sm:text-lg font-bold text-white">{stats.count}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-emerald-600 to-green-600 border-0 shadow-lg">
            <CardHeader className="p-2 sm:p-3 pb-0">
              <CardTitle className="text-[10px] sm:text-xs font-medium text-emerald-100">Items Issued</CardTitle>
            </CardHeader>
            <CardContent className="p-2 sm:p-3 pt-0">
              <div className="text-sm sm:text-lg font-bold text-white">{stats.totalItems}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-600 to-orange-600 border-0 shadow-lg">
            <CardHeader className="p-2 sm:p-3 pb-0">
              <CardTitle className="text-[10px] sm:text-xs font-medium text-amber-100">Recipients</CardTitle>
            </CardHeader>
            <CardContent className="p-2 sm:p-3 pt-0">
              <div className="text-sm sm:text-lg font-bold text-white">{stats.recipients}</div>
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
            <CardTitle className="text-sm sm:text-base text-gray-900 dark:text-white">Issue History</CardTitle>
            <CardDescription className="text-xs text-gray-500 dark:text-gray-400">{filteredIssues.length} issues found</CardDescription>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-2">
            {filteredIssues.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <FileBarChart className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No issues found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[10px] sm:text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700">
                      <th className="px-2 sm:px-3 py-1.5 text-left font-medium text-gray-600 dark:text-gray-300">Issue No</th>
                      <th className="px-2 sm:px-3 py-1.5 text-left font-medium text-gray-600 dark:text-gray-300">Date</th>
                      <th className="px-2 sm:px-3 py-1.5 text-left font-medium text-gray-600 dark:text-gray-300">Recipient</th>
                      <th className="px-2 sm:px-3 py-1.5 text-left font-medium text-gray-600 dark:text-gray-300">Item</th>
                      <th className="px-2 sm:px-3 py-1.5 text-right font-medium text-gray-600 dark:text-gray-300">Qty</th>
                      <th className="px-2 sm:px-3 py-1.5 text-center font-medium text-gray-600 dark:text-gray-300">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredIssues.slice(0, 50).map((issue) => (
                      <tr key={issue.id} className="border-b border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                        <td className="px-2 sm:px-3 py-1.5 font-mono text-[10px] sm:text-xs text-gray-700 dark:text-gray-300">
                          {issue.issuance_no || issue.issue_no || 'N/A'}
                        </td>
                        <td className="px-2 sm:px-3 py-1.5 text-gray-700 dark:text-gray-300">{formatDate(issue.issuance_date)}</td>
                        <td className="px-2 sm:px-3 py-1.5 text-gray-700 dark:text-gray-300">
                          <span className="text-[10px] sm:text-xs text-gray-400 mr-1">
                            {issue.issued_to_type === 'staff' ? '👤' : '🎓'}
                          </span>
                          {issue.issued_to_name}
                        </td>
                        <td className="px-2 sm:px-3 py-1.5 text-gray-700 dark:text-gray-300">{issue.item?.name || issue.item_id || '-'}</td>
                        <td className="px-2 sm:px-3 py-1.5 text-right text-gray-700 dark:text-gray-300">{issue.quantity} {issue.unit}</td>
                        <td className="px-2 sm:px-3 py-1.5 text-center">
                          <Badge className={`text-[8px] sm:text-[10px] ${
                            issue.status === 'issued' ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200' :
                            issue.status === 'returned' ? 'bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-200' :
                            issue.status === 'requested' ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200' :
                            'bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200'
                          }`}>
                            {issue.status || 'issued'}
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
