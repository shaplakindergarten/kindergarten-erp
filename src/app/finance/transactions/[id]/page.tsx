"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { 
  Loader2,
  ChevronLeft,
  Printer,
  Edit,
  Trash2,
  FileText
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { formatCurrency } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { format } from "date-fns"
import { ResponsiveLayout } from "@/components/layout/responsive-layout"
import { toast } from "sonner"

const supabase = createClient()

type VoucherType = 'receipt' | 'payment' | 'journal' | 'transfer'

interface SchoolSettings {
  id: number
  school_name: string | null
  school_address: string | null
  school_phone: string | null
  school_email: string | null
  school_logo: string | null
}

interface ChartOfAccount {
  id: string
  code: string
  name: string
  account_type: string
}

interface JournalEntryWithAccount {
  id: string
  voucher_id: string
  account_id: string
  debit: number | null
  credit: number | null
  description?: string | null
  account?: ChartOfAccount | null
}

interface VoucherWithEntries {
  id: string
  voucher_no: string
  voucher_type: VoucherType
  voucher_date: string
  total_amount: number
  paid_to_received_from: string
  reference_no?: string | null
  narration?: string | null
  financial_account_id?: string | null
  created_at?: string
  journal_entries: JournalEntryWithAccount[]
}

export default function VoucherDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [voucher, setVoucher] = useState<VoucherWithEntries | null>(null)
  const [schoolInfo, setSchoolInfo] = useState<SchoolSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    loadVoucher()
    loadSchoolInfo()
  }, [id])

  const loadSchoolInfo = async () => {
    try {
      const { data } = await supabase.from('school_settings').select('*').limit(1).maybeSingle()
      if (data) setSchoolInfo(data)
    } catch (error) {
      console.error('Error loading school info:', error)
    }
  }

  const loadVoucher = async () => {
    setLoading(true)
    try {
      const { data: voucherData, error: voucherError } = await supabase
        .from('vouchers')
        .select('*')
        .eq('id', id)
        .single()

      if (voucherError) {
        console.error('Voucher query error:', voucherError)
        toast.error('Failed to load voucher')
        router.push('/finance/transactions')
        return
      }

      if (!voucherData) {
        toast.error('Voucher not found')
        router.push('/finance/transactions')
        return
      }

      const { data: entriesData, error: entriesError } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('voucher_id', id)

      if (entriesError) {
        console.error('Journal entries query error:', entriesError)
      }

      const journalEntries = entriesData || []

      const accountIds = [...new Set(journalEntries.map(e => e.account_id).filter(Boolean))]
      const { data: accountsData, error: accountsError } = await supabase
        .from('chart_of_accounts')
        .select('id, code, name, account_type')
        .in('id', accountIds)

      if (accountsError) {
        console.error('Chart of accounts query error:', accountsError)
      }

      const accountMap = new Map((accountsData || []).map(a => [a.id, a]))

      const transformedEntries = journalEntries.map(entry => ({
        ...entry,
        account: accountMap.get(entry.account_id) || null
      }))

      setVoucher({
        ...voucherData,
        journal_entries: transformedEntries,
      })
    } catch (error) {
      console.error('Error loading voucher:', error)
      toast.error('Failed to load voucher')
      router.push('/finance/transactions')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this voucher?')) return
    
    setDeleting(true)
    try {
      const { error } = await supabase.from('vouchers').delete().eq('id', id)
      
      if (error) throw error
      toast.success('Voucher deleted successfully')
      router.push('/finance/transactions')
    } catch (error) {
      console.error('Error deleting voucher:', error)
      toast.error('Failed to delete voucher')
    } finally {
      setDeleting(false)
    }
  }

  const voucherTypeConfig: Record<VoucherType, { label: string; color: string; bg: string }> = {
    receipt: { label: 'Receipt Voucher', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800' },
    payment: { label: 'Payment Voucher', color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 border-rose-200 dark:bg-rose-950/30 dark:border-rose-800' },
    journal: { label: 'Journal Entry', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800' },
    transfer: { label: 'Transfer Voucher', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800' },
  }

  const formatVoucherDate = (date: string) => {
    try {
      return format(new Date(date), 'dd MMM yyyy')
    } catch {
      return date
    }
  }

  // Amount to words
  const numberToWords = (num: number): string => {
    if (num === 0) return "Zero"
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
    const numToWords = (n: number): string => {
      if (n < 20) return ones[n]
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '')
      if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + numToWords(n % 100) : '')
      if (n < 1000000) return numToWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + numToWords(n % 1000) : '')
      return numToWords(Math.floor(n / 1000000)) + ' Million' + (n % 1000000 ? ' ' + numToWords(n % 1000000) : '')
    }
    const whole = Math.floor(num)
    const decimal = Math.round((num - whole) * 100)
    let result = numToWords(whole)
    if (decimal > 0) result += ' Point ' + numToWords(decimal)
    return result
  }

  if (loading) {
    return (
      <ResponsiveLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </ResponsiveLayout>
    )
  }

  if (!voucher) {
    return (
      <ResponsiveLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Voucher not found</p>
          <Button variant="outline" className="mt-4" onClick={() => router.push('/finance/transactions')}>
            Back to Transactions
          </Button>
        </div>
      </ResponsiveLayout>
    )
  }

  const config = voucherTypeConfig[voucher.voucher_type] || voucherTypeConfig.journal
  const totalDebit = voucher.journal_entries?.reduce((sum, e) => sum + (Number(e.debit) || 0), 0) || 0
  const totalCredit = voucher.journal_entries?.reduce((sum, e) => sum + (Number(e.credit) || 0), 0) || 0
  const amountInWords = numberToWords(Number(voucher.total_amount) || 0)
  const entriesWithAccount = voucher.journal_entries || []

  return (
    <ResponsiveLayout>
      {/* Exact PDF Layout CSS */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          body * {
            visibility: hidden !important;
          }
          #print-section, #print-section * {
            visibility: visible !important;
          }
          #print-section {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: #fff !important;
            color: #000 !important;
            font-family: Arial, sans-serif !important;
          }
          .pdf-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 2px solid #000;
            padding-bottom: 8px;
            margin-bottom: 12px;
          }
          .pdf-logo-box {
            width: 70px;
            height: 70px;
            display: flex;
            align-items: center;
            justify-content: flex-start;
          }
          .pdf-logo-box img {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
          }
          .pdf-title-box {
            text-align: center;
            flex: 1;
            padding: 0 10px;
          }
          .pdf-school-name {
            font-size: 22px;
            font-weight: bold;
            color: #000;
            margin: 0;
            line-height: 1.2;
          }
          .pdf-school-sub {
            font-size: 11px;
            color: #333;
            margin: 2px 0 0 0;
          }
          .pdf-type-box {
            border: 1px solid #000;
            padding: 6px 12px;
            font-size: 13px;
            font-weight: bold;
            white-space: nowrap;
          }
          .pdf-meta {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            margin-bottom: 12px;
            line-height: 1.5;
          }
          .pdf-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 12px;
          }
          .pdf-table th, .pdf-table td {
            border: 1px solid #000;
            padding: 5px 8px;
            font-size: 11px;
          }
          .pdf-table th {
            background-color: #f5f5f5 !important;
            font-weight: bold;
            -webkit-print-color-adjust: exact;
          }
          .pdf-words {
            font-size: 11px;
            margin-bottom: 55px;
          }
          .pdf-signatures {
            display: flex;
            justify-content: space-between;
            padding: 0 10px;
          }
          .pdf-sig-box {
            text-align: center;
            width: 120px;
            border-top: 1px solid #000;
            padding-top: 4px;
            font-size: 11px;
            font-weight: bold;
          }
        }
      `}</style>

      {/* WEB VIEW */}
      <div className="space-y-6 p-4 md:p-6 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/finance/transactions">
              <Button variant="outline" size="sm" className="bg-white dark:bg-slate-900 border-slate-200 shadow-sm">
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back to Transactions
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                <FileText className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">Voucher Details</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">View and manage voucher information</p>
              </div>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => window.print()} className="bg-white dark:bg-slate-900 border-slate-200 shadow-sm">
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button variant="outline" size="sm" asChild className="bg-white dark:bg-slate-900 border-slate-200 shadow-sm">
              <Link href={`/finance/transactions/${id}/edit`}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Link>
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </div>

        <Card className="border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <CardHeader className="bg-slate-50/60 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800/80 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <CardTitle className="flex flex-wrap items-center gap-2 text-lg font-bold">
                  <span className={config.color}>{config.label}</span>
                  <Badge variant="outline" className={`${config.bg} ${config.color}`}>
                    {voucher.voucher_type.toUpperCase()}
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  Voucher No: <span className="font-mono font-medium">{voucher.voucher_no}</span>
                  {' • '}
                  Date: {formatVoucherDate(voucher.voucher_date)}
                </CardDescription>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black">{formatCurrency(Number(voucher.total_amount) || 0)}</div>
                <div className="text-[10px] text-muted-foreground">Total Amount</div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 p-4 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium text-xs text-muted-foreground mb-2">Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 py-1">
                    <span className="text-muted-foreground">Voucher No:</span>
                    <span className="font-mono font-medium">{voucher.voucher_no}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 py-1">
                    <span className="text-muted-foreground">Date:</span>
                    <span className="font-medium">{formatVoucherDate(voucher.voucher_date)}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 py-1">
                    <span className="text-muted-foreground">Type:</span>
                    <Badge variant="outline" className={`${config.bg} ${config.color}`}>{config.label}</Badge>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 py-1">
                    <span className="text-muted-foreground">Total Amount:</span>
                    <span className="font-bold">{formatCurrency(Number(voucher.total_amount) || 0)}</span>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="font-medium text-xs text-muted-foreground mb-2">Parties</h3>
                <div className="space-y-2 text-sm">
                  <div className="border-b border-slate-100 dark:border-slate-800 py-1">
                    <span className="text-muted-foreground">To/From:</span>
                    <div className="font-medium mt-1 break-words">{voucher.paid_to_received_from || 'N/A'}</div>
                  </div>
                  {voucher.reference_no && (
                    <div className="border-b border-slate-100 dark:border-slate-800 py-1">
                      <span className="text-muted-foreground">Reference No:</span>
                      <div className="font-medium mt-1 break-words">{voucher.reference_no}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {voucher.narration && (
              <div className="border-t pt-4">
                <h3 className="font-medium text-xs text-muted-foreground mb-2">Narration</h3>
                <p className="text-sm p-3 bg-muted/30 dark:bg-muted/20 rounded-lg break-words">{voucher.narration}</p>
              </div>
            )}

            <div className="border-t pt-4">
              <h3 className="font-medium text-xs text-muted-foreground mb-3">Journal Entries</h3>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 dark:bg-muted/10">
                      <TableHead className="text-xs">Account</TableHead>
                      <TableHead className="text-xs">Code</TableHead>
                      <TableHead className="text-right text-xs">Debit</TableHead>
                      <TableHead className="text-right text-xs">Credit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entriesWithAccount.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-4 text-xs">
                          No journal entries found
                        </TableCell>
                      </TableRow>
                    ) : (
                      entriesWithAccount.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="font-medium text-sm">{entry.account?.name || 'Unknown'}</TableCell>
                          <TableCell className="font-mono text-sm">{entry.account?.code || '-'}</TableCell>
                          <TableCell className="text-right font-mono text-emerald-600 dark:text-emerald-400 text-sm">
                            {entry.debit ? formatCurrency(Number(entry.debit)) : '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-rose-600 dark:text-rose-400 text-sm">
                            {entry.credit ? formatCurrency(Number(entry.credit)) : '-'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                {entriesWithAccount.length > 0 && (
                  <div className="border-t p-3 bg-muted/20 dark:bg-muted/10">
                    <div className="flex flex-wrap justify-end gap-6 text-sm">
                      <span className="text-muted-foreground">Total Debit:</span>
                      <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(totalDebit)}</span>
                      <span className="text-muted-foreground">Total Credit:</span>
                      <span className="font-mono font-medium text-rose-600 dark:text-rose-400">{formatCurrency(totalCredit)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* PRINT SECTION - EXACT PDF MATCH */}
      <div id="print-section" className="hidden print:block">
        {/* Header */}
        <div className="pdf-header">
          <div className="pdf-logo-box">
            {schoolInfo?.school_logo && (
              <img src={schoolInfo.school_logo} alt="School Logo" />
            )}
          </div>
          <div className="pdf-title-box">
            <h1 className="pdf-school-name">{schoolInfo?.school_name || 'মাদ্রাসাতুল সুন্নাহ আল মাদানী'}</h1>
            {schoolInfo?.school_address && <p className="pdf-school-sub">{schoolInfo.school_address}</p>}
            {schoolInfo?.school_phone && <p className="pdf-school-sub">Phone: {schoolInfo.school_phone}</p>}
          </div>
          <div className="pdf-type-box">
            {config.label}
          </div>
        </div>

        {/* Voucher Meta Info */}
        <div className="pdf-meta">
          <div>
            <div><strong>Voucher No:</strong> {voucher.voucher_no}</div>
            <div><strong>Paid To/Received from:</strong> {voucher.paid_to_received_from || 'N/A'}</div>
            {voucher.narration && <div><strong>Narration:</strong> {voucher.narration}</div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div><strong>Date:</strong> {formatVoucherDate(voucher.voucher_date)}</div>
            {voucher.reference_no && <div><strong>Ref No:</strong> {voucher.reference_no}</div>}
          </div>
        </div>

        {/* Journal Entries Table */}
        <table className="pdf-table">
          <thead>
            <tr>
              <th style={{ width: '40px', textAlign: 'center' }}>SL</th>
              <th style={{ textAlign: 'left' }}>Account Description</th>
              <th style={{ width: '120px', textAlign: 'right' }}>Debit (BDT)</th>
              <th style={{ width: '120px', textAlign: 'right' }}>Credit (BDT)</th>
            </tr>
          </thead>
          <tbody>
            {entriesWithAccount.length === 0 ? (
              <tr>
                <td style={{ textAlign: 'center' }}>1</td>
                <td>N/A</td>
                <td style={{ textAlign: 'right' }}>BDT 0</td>
                <td style={{ textAlign: 'right' }}>BDT 0</td>
              </tr>
            ) : (
              entriesWithAccount.map((entry, index) => (
                <tr key={entry.id || index}>
                  <td style={{ textAlign: 'center' }}>{index + 1}</td>
                  <td>
                    {entry.account ? `${entry.account.code ? entry.account.code + ' - ' : ''}${entry.account.name}` : 'N/A'}
                    {entry.description && <div style={{ fontSize: '9px', color: '#555' }}>{entry.description}</div>}
                  </td>
                  <td style={{ textAlign: 'right' }}>{entry.debit ? formatCurrency(Number(entry.debit)) : '-'}</td>
                  <td style={{ textAlign: 'right' }}>{entry.credit ? formatCurrency(Number(entry.credit)) : '-'}</td>
                </tr>
              ))
            )}
            <tr style={{ fontWeight: 'bold' }}>
              <td colSpan={2} style={{ textAlign: 'right' }}>Total</td>
              <td style={{ textAlign: 'right' }}>{formatCurrency(totalDebit)}</td>
              <td style={{ textAlign: 'right' }}>{formatCurrency(totalCredit)}</td>
            </tr>
          </tbody>
        </table>

        {/* Amount in words */}
        <div className="pdf-words">
          <strong>Total Amount in word:</strong> {amountInWords} Taka Only.
        </div>

        {/* Signature Line */}
        <div className="pdf-signatures">
          <div className="pdf-sig-box">Prepared By</div>
          <div className="pdf-sig-box">Checked By</div>
          <div className="pdf-sig-box">Approved By</div>
        </div>
      </div>
    </ResponsiveLayout>
  )
}