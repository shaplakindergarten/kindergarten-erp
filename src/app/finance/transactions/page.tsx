"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { 
  ArrowLeft,
  Download,
  Loader2,
  Search,
  Plus,
  Eye,
  TrendingUp,
  TrendingDown,
  Scale,
  FileText,
  ChevronLeft,
  ChevronRight
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { formatCurrency } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { ResponsiveLayout } from "@/components/layout/responsive-layout"

const supabase = createClient()

type VoucherType = 'receipt' | 'payment' | 'journal' | 'transfer'

interface Voucher {
  id: string
  voucher_no: string
  voucher_type: VoucherType
  voucher_date: string
  total_amount: number
  paid_to_received_from: string
  financial_account_id?: string | null
  created_at?: string
}

export default function TransactionsPage() {
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 8

  useEffect(() => {
    loadTransactions()
  }, [])

  const loadTransactions = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('vouchers')
        .select('*')
        .order('voucher_date', { ascending: false })
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setVouchers(data || [])
    } catch (error) {
      console.error('Error loading transactions:', error)
      toast.error('Failed to load transactions')
    } finally {
      setLoading(false)
    }
  }

  const filteredVouchers = useMemo(() => {
    if (!searchQuery.trim()) return vouchers
    const q = searchQuery.toLowerCase()
    return vouchers.filter(v => 
      v.voucher_no.toLowerCase().includes(q) ||
      (v.paid_to_received_from && v.paid_to_received_from.toLowerCase().includes(q))
    )
  }, [vouchers, searchQuery])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])

  const totalPages = Math.ceil(filteredVouchers.length / itemsPerPage) || 1
  const paginatedVouchers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredVouchers.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredVouchers, currentPage])

  const handleExportCSV = () => {
    if (filteredVouchers.length === 0) {
      toast.error('No transaction data to export')
      return
    }

    try {
      const headers = ['Voucher No', 'Type', 'Date', 'Party Name', 'Amount (BDT)']
      const rows = filteredVouchers.map(v => [
        `"${v.voucher_no || ''}"`,
        `"${v.voucher_type.toUpperCase()}"`,
        `"${v.voucher_date}"`,
        `"${(v.paid_to_received_from || '').replace(/"/g, '""')}"`,
        `"${v.total_amount || 0}"`
      ])

      const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
      const encodedUri = encodeURI(csvContent)
      const link = document.createElement('a')
      link.setAttribute('href', encodedUri)
      link.setAttribute('download', `Transaction_Report_${new Date().toISOString().split('T')[0]}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      toast.success('Transaction list exported successfully')
    } catch (err) {
      console.error('Export Error:', err)
      toast.error('Failed to export transaction list')
    }
  }

  const totalRevenue = vouchers.filter(v => v.voucher_type === 'receipt')
    .reduce((sum, v) => sum + Number(v.total_amount), 0)
  const totalPayments = vouchers.filter(v => v.voucher_type === 'payment')
    .reduce((sum, v) => sum + Number(v.total_amount), 0)
  const totalNet = totalRevenue - totalPayments

  const voucherTypeConfig: Record<VoucherType, { label: string; color: string; bg: string }> = {
    receipt: { label: 'Receipt', color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/60 dark:border-emerald-800' },
    payment: { label: 'Payment', color: 'text-rose-700 dark:text-rose-300', bg: 'bg-rose-50 border-rose-200 dark:bg-rose-950/60 dark:border-rose-800' },
    journal: { label: 'Journal', color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 border-amber-200 dark:bg-amber-950/60 dark:border-amber-800' },
    transfer: { label: 'Transfer', color: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-50 border-blue-200 dark:bg-blue-950/60 dark:border-blue-800' },
  }

  return (
    <ResponsiveLayout>
      <div className="flex flex-col justify-between h-full lg:h-[calc(100vh-4rem)] p-3 sm:p-4 max-w-7xl mx-auto space-y-3 bg-slate-50/50 dark:bg-transparent overflow-hidden">
        
        {/* Top Header */}
        <div className="flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <Link href="/finance">
              <Button variant="outline" size="sm" className="h-7.5 px-2.5 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
                <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                Back
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-md bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400">
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <h1 className="text-base font-bold text-slate-900 dark:text-white leading-tight">All Vouchers</h1>
              </div>
            </div>
          </div>
          <Link href="/finance/transactions/new">
            <Button size="sm" className="h-7.5 text-xs px-3 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
              <Plus className="h-3.5 w-3.5 mr-1" />
              New Voucher
            </Button>
          </Link>
        </div>

        {/* SUMMARY CARDS (15% Size Increase) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 shrink-0">
          <Card className="border border-emerald-200/80 dark:border-emerald-900/50 bg-gradient-to-br from-emerald-50/50 to-white dark:from-emerald-950/20 dark:to-slate-900 p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" /> Revenue
              </span>
              <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(totalRevenue)}</span>
            </div>
          </Card>

          <Card className="border border-rose-200/80 dark:border-rose-900/50 bg-gradient-to-br from-rose-50/50 to-white dark:from-rose-950/20 dark:to-slate-900 p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                <TrendingDown className="h-3.5 w-3.5" /> Payments
              </span>
              <span className="text-sm font-black text-rose-600 dark:text-rose-400">{formatCurrency(totalPayments)}</span>
            </div>
          </Card>

          <Card className="border border-blue-200/80 dark:border-blue-900/50 bg-gradient-to-br from-blue-50/50 to-white dark:from-blue-950/20 dark:to-slate-900 p-3 shadow-sm sm:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                <Scale className="h-3.5 w-3.5" /> Net Flow
              </span>
              <span className="text-sm font-black text-blue-600 dark:text-blue-400">{formatCurrency(totalNet)}</span>
            </div>
          </Card>
        </div>

        {/* Search & Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Search voucher no or party..."
              className="pl-8 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 h-7.5 text-xs rounded-md shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button onClick={handleExportCSV} variant="outline" size="sm" className="h-7.5 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shrink-0">
            <Download className="h-3.5 w-3.5 mr-1" />
            Export
          </Button>
        </div>

        {/* Transaction Table Container - Strict Fit (No Vertical Scrollbar) */}
        <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex-1 flex flex-col min-h-0 overflow-hidden rounded-lg">
          <CardHeader className="py-2 px-3 bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-200/80 dark:border-slate-800 shrink-0">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-900 dark:text-white">Transaction History</h2>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">{filteredVouchers.length} items</span>
            </div>
          </CardHeader>
          
          <CardContent className="p-0 flex-1 overflow-hidden flex flex-col justify-between">
            {loading ? (
              <div className="flex items-center justify-center flex-1">
                <Loader2 className="h-5 w-5 animate-spin text-emerald-600 dark:text-emerald-400" />
              </div>
            ) : paginatedVouchers.length === 0 ? (
              <div className="flex items-center justify-center flex-1 text-slate-400 text-xs">
                <p>No transactions found</p>
              </div>
            ) : (
              <>
                {/* Desktop/Tablet Table (Strict Layout) */}
                <div className="hidden sm:block w-full">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/50 dark:bg-slate-800/20 border-b border-slate-200/80 dark:border-slate-800">
                        <TableHead className="text-[11px] font-bold uppercase py-2 h-auto">Voucher No</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase py-2 h-auto">Type</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase py-2 h-auto">Date</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase py-2 h-auto">Party</TableHead>
                        <TableHead className="text-right text-[11px] font-bold uppercase py-2 h-auto">Amount</TableHead>
                        <TableHead className="text-right text-[11px] font-bold uppercase py-2 h-auto">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedVouchers.map((voucher) => {
                        const config = voucherTypeConfig[voucher.voucher_type]
                        return (
                          <TableRow key={voucher.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800/50">
                            <TableCell className="font-mono text-xs font-medium py-1.5">{voucher.voucher_no}</TableCell>
                            <TableCell className="py-1.5">
                              <Badge variant="outline" className={`${config.bg} ${config.color} text-[10px] font-semibold border px-1.5 py-0`}>
                                {config.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs py-1.5 text-slate-600 dark:text-slate-300">{voucher.voucher_date}</TableCell>
                            <TableCell className="text-xs py-1.5 text-slate-700 dark:text-slate-300 font-medium max-w-[180px] truncate">{voucher.paid_to_received_from || '-'}</TableCell>
                            <TableCell className="text-right font-mono font-bold text-xs py-1.5">
                              {formatCurrency(voucher.total_amount)}
                            </TableCell>
                            <TableCell className="text-right py-1.5">
                              <Link 
                                href={`/finance/transactions/${voucher.id}`}
                                className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-0.5 text-xs font-medium"
                              >
                                <Eye className="h-3 w-3" /> View
                              </Link>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile View */}
                <div className="block sm:hidden divide-y divide-slate-100 dark:divide-slate-800">
                  {paginatedVouchers.map((voucher) => {
                    const config = voucherTypeConfig[voucher.voucher_type]
                    return (
                      <div key={voucher.id} className="p-2 space-y-1 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">{voucher.voucher_no}</span>
                          <Badge variant="outline" className={`${config.bg} ${config.color} text-[9px] font-semibold border px-1.5 py-0`}>
                            {config.label}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span className="truncate max-w-[150px]">{voucher.paid_to_received_from || '-'}</span>
                          <span>{voucher.voucher_date}</span>
                        </div>
                        <div className="flex items-center justify-between pt-0.5">
                          <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">{formatCurrency(voucher.total_amount)}</span>
                          <Link 
                            href={`/finance/transactions/${voucher.id}`}
                            className="text-blue-600 dark:text-blue-400 inline-flex items-center gap-0.5 text-xs font-medium"
                          >
                            <Eye className="h-3 w-3" /> View
                          </Link>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </CardContent>

          {/* Bottom Pagination Bar */}
          <div className="flex items-center justify-between px-3 py-1.5 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 shrink-0 bg-slate-50/60 dark:bg-slate-900">
            <span>
              <b>{filteredVouchers.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}</b>-<b>{Math.min(currentPage * itemsPerPage, filteredVouchers.length)}</b> of <b>{filteredVouchers.length}</b>
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                className="h-6 px-1.5 text-[11px] bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
              >
                <ChevronLeft className="h-3 w-3" />
              </Button>
              <span className="px-1.5 font-semibold text-slate-700 dark:text-slate-300">
                {currentPage}/{totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                className="h-6 px-1.5 text-[11px] bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
              >
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </ResponsiveLayout>
  )
}
