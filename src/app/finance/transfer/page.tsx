// src/app/finance/transfer/page.tsx
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { 
  ArrowLeft,
  Loader2,
  Printer,
  ArrowRightLeft,
  Banknote,
  Building2,
  Smartphone,
  AlertCircle,
  CheckCircle2,
  Scissors
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/utils"
import { ResponsiveLayout } from "@/components/layout/responsive-layout"
import { createCashTransfer } from "@/lib/api/finance"
import { cn } from "@/lib/utils"

const supabase = createClient()

interface FinancialAccount {
  id: string
  account_name: string
  account_number: string
  type: 'cash' | 'bank' | 'mobile_bank'
  current_balance: number
  is_active: boolean
}

interface SchoolSettings {
  id: number
  school_name: string | null
  school_address: string | null
  school_phone: string | null
  school_email: string | null
  school_logo: string | null
}

const accountTypeIcons: Record<string, LucideIcon> = {
  cash: Banknote,
  bank: Building2,
  mobile_bank: Smartphone
}

const accountTypeLabels: Record<string, string> = {
  cash: 'Cash',
  bank: 'Bank',
  mobile_bank: 'Mobile Banking'
}

export default function TransferPage() {
  const router = useRouter()
  
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [accounts, setAccounts] = useState<FinancialAccount[]>([])
  const [schoolInfo, setSchoolInfo] = useState<SchoolSettings | null>(null)
  const [generatedVoucherNo, setGeneratedVoucherNo] = useState<string>('TRF-001')
  
  const [formData, setFormData] = useState({
    from_account_id: '',
    to_account_id: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    reference_no: '',
    description: '',
  })

  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadAccounts()
    loadSchoolSettings()
  }, [])

  const loadSchoolSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('school_settings')
        .select('*')
        .limit(1)
        .maybeSingle()

      if (!error && data) {
        setSchoolInfo(data)
      }
    } catch (error) {
      console.error('Error loading school settings:', error)
    }
  }

  const loadAccounts = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('financial_accounts')
        .select('*')
        .eq('is_active', true)
        .order('type')
        .order('account_name')

      if (error) throw error

      if (!data || data.length < 2) {
        setError('At least two active accounts required for transfer')
      }

      setAccounts(data || [])
    } catch (error) {
      console.error('Error loading accounts:', error)
      toast.error('Failed to load accounts')
    } finally {
      setLoading(false)
    }
  }

  const handleNumberInput = (value: string) => {
    const bengaliToEnglish: Record<string, string> = {
      '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
      '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
    }
    
    let cleanValue = value
    for (const [bengali, english] of Object.entries(bengaliToEnglish)) {
      cleanValue = cleanValue.replace(new RegExp(bengali, 'g'), english)
    }
    
    cleanValue = cleanValue.replace(/[^0-9.]/g, '')
    
    const parts = cleanValue.split('.')
    if (parts.length > 2) {
      cleanValue = parts[0] + '.' + parts.slice(1).join('')
    }
    
    const numValue = parseFloat(cleanValue)
    setFormData({ ...formData, amount: numValue || 0 })
  }

  const getAccountBalance = (accountId: string) => {
    const account = accounts.find(a => a.id === accountId)
    return account?.current_balance || 0
  }

  const getAccountName = (accountId: string) => {
    const account = accounts.find(a => a.id === accountId)
    if (!account) return ''
    return `${account.account_name} (${accountTypeLabels[account.type]})`
  }

  const fromAccountBalance = getAccountBalance(formData.from_account_id)
  const toAccountBalance = getAccountBalance(formData.to_account_id)
  const hasSufficientBalance = fromAccountBalance >= formData.amount

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
    if (decimal > 0) {
      result += ' Point ' + numToWords(decimal)
    }
    
    return result
  }

  const handleSubmit = async () => {
    if (!formData.from_account_id || !formData.to_account_id) {
      toast.error('Please select both accounts')
      return
    }

    if (formData.from_account_id === formData.to_account_id) {
      toast.error('From and To accounts cannot be the same')
      return
    }

    if (formData.amount <= 0) {
      toast.error('Amount must be greater than 0')
      return
    }

    if (!hasSufficientBalance) {
      toast.error(`Insufficient balance! Available: ${formatCurrency(fromAccountBalance)}`)
      return
    }

    setSubmitting(true)
    try {
      const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
      const voucherNo = `TRF-${randomSuffix}`
      setGeneratedVoucherNo(voucherNo)

      const result = await createCashTransfer({
        fromAccountId: formData.from_account_id,
        toAccountId: formData.to_account_id,
        amount: formData.amount,
        date: formData.date,
        referenceNo: formData.reference_no,
        description: formData.description,
      })

      if (result.success) {
        toast.success('Transfer completed successfully ✅')
        router.push('/finance/bank-cash')
      } else {
        toast.error((result as { error?: string }).error || result.message || 'Transfer failed')
      }
    } catch (error) {
      console.error('Transfer error:', error)
      toast.error('Failed to complete transfer')
    } finally {
      setSubmitting(false)
    }
  }

  const availableFromAccounts = accounts.filter(a => a.id !== formData.to_account_id)
  const availableToAccounts = accounts.filter(a => a.id !== formData.from_account_id)

  const renderVoucherHalf = () => (
    <div className="print-voucher-half">
      {/* Header - Left Logo & Right Header */}
      <div className="border-b pb-3 mb-3 flex items-center justify-between gap-3">
        {schoolInfo?.school_logo ? (
          <img 
            src={schoolInfo.school_logo} 
            alt="School Logo" 
            className="w-16 h-16 object-contain shrink-0 print-image" 
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center font-bold text-slate-700 text-xs text-center shrink-0">
            LOGO
          </div>
        )}
        <div className="text-right flex-1 min-w-0">
          <h2 className="text-lg font-bold text-slate-900 leading-tight truncate">
            {schoolInfo?.school_name || 'SHAPLA KINDERGARTEN & PRE-CADET'}
          </h2>
          <p className="text-xs text-slate-600 truncate">{schoolInfo?.school_address || 'Nowtala, Madhaiya Bazar, Chandina, Cumilla'}</p>
          <p className="text-xs text-slate-600">Phone: {schoolInfo?.school_phone || '01923253454'}</p>
        </div>
      </div>

      {/* Bold Underlined Voucher Title */}
      <div className="text-center mb-3">
        <h3 className="text-base font-extrabold text-blue-800 tracking-wide uppercase inline-block border-b-2 border-blue-800 pb-0.5">
          TRANSFER VOUCHER / স্থানান্তর রসিদ
        </h3>
      </div>

      {/* Voucher Info */}
      <div className="flex justify-between items-center mb-2.5 text-xs">
        <div>
          <span className="font-semibold text-slate-700">Voucher No:</span> <span className="font-mono font-bold text-slate-900">{generatedVoucherNo}</span>
        </div>
        <div>
          <span className="font-semibold text-slate-700">Date:</span> {formData.date ? new Date(formData.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
        </div>
      </div>

      {/* Info Grids */}
      <div className="grid grid-cols-2 gap-2 mb-2.5">
        <div className="border border-blue-200 rounded p-1.5 bg-blue-50/50">
          <p className="text-[10px] font-bold text-blue-800 border-b border-blue-200 pb-0.5 mb-1 uppercase tracking-wider">FROM ACCOUNT</p>
          <div className="space-y-0.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Account:</span>
              <span className="font-semibold text-slate-800 truncate">{accounts.find(a => a.id === formData.from_account_id)?.account_name || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Type:</span>
              <span className="font-semibold capitalize text-slate-800">{accounts.find(a => a.id === formData.from_account_id)?.type || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Balance Before:</span>
              <span className="font-semibold text-slate-800">{formatCurrency(fromAccountBalance)}</span>
            </div>
          </div>
        </div>

        <div className="border border-blue-200 rounded p-1.5 bg-blue-50/50">
          <p className="text-[10px] font-bold text-blue-800 border-b border-blue-200 pb-0.5 mb-1 uppercase tracking-wider">TO ACCOUNT</p>
          <div className="space-y-0.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Account:</span>
              <span className="font-semibold text-slate-800 truncate">{accounts.find(a => a.id === formData.to_account_id)?.account_name || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Type:</span>
              <span className="font-semibold capitalize text-slate-800">{accounts.find(a => a.id === formData.to_account_id)?.type || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Balance After:</span>
              <span className="font-semibold text-slate-800">{formatCurrency(toAccountBalance + formData.amount)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <table className="w-full text-xs border-collapse mb-2.5">
        <thead>
          <tr className="bg-blue-700 text-white">
            <th className="border border-blue-700 p-1.5 text-left w-8">SL</th>
            <th className="border border-blue-700 p-1.5 text-left">DESCRIPTION / বিবরণ</th>
            <th className="border border-blue-700 p-1.5 text-right w-24">AMOUNT (BDT)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-slate-300 p-1.5 text-center">1</td>
            <td className="border border-slate-300 p-1.5">
              <div className="font-semibold text-slate-800">Fund Transfer</div>
              {formData.description && <div className="text-[10px] text-slate-600">{formData.description}</div>}
              {formData.reference_no && <div className="text-[10px] text-slate-600">Ref: {formData.reference_no}</div>}
            </td>
            <td className="border border-slate-300 p-1.5 text-right font-semibold text-slate-900">{formatCurrency(formData.amount)}</td>
          </tr>
        </tbody>
      </table>

      {/* Amount in words & Total */}
      <div className="grid grid-cols-3 border border-slate-300 text-xs mb-3">
        <div className="col-span-2 p-1.5 flex items-center gap-1.5 border-r border-slate-300">
          <span className="font-bold text-slate-700">In Words:</span>
          <span className="font-medium text-slate-800 truncate">{numberToWords(formData.amount)} Taka Only</span>
        </div>
        <div className="p-1.5 text-right font-bold bg-slate-50">
          <span className="block text-[9px] text-slate-500 font-normal leading-none mb-0.5">TOTAL BDT</span>
          <span className="text-sm text-slate-900">{formatCurrency(formData.amount)}</span>
        </div>
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-3 text-center text-xs mt-5 pt-1">
        <div>
          <div className="border-t border-slate-400 pt-0.5 font-semibold text-slate-800">PREPARED BY</div>
          <div className="text-slate-500 text-[10px]">Accounts Dept</div>
        </div>
        <div>
          <div className="border-t border-slate-400 pt-0.5 font-semibold text-slate-800">CHECKED BY</div>
          <div className="text-slate-500 text-[10px]">Finance Officer</div>
        </div>
        <div>
          <div className="border-t border-slate-400 pt-0.5 font-semibold text-slate-800">APPROVED BY</div>
          <div className="text-slate-500 text-[10px]">Principal / Head</div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center text-[10px] text-slate-500 border-t border-slate-200 pt-1.5 mt-2">
        <div className="flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-blue-600 shrink-0" />
          <span>Computer generated receipt.</span>
        </div>
        <div>System-Verified Transfer</div>
      </div>
    </div>
  )

  if (loading) {
    return (
      <ResponsiveLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </ResponsiveLayout>
    )
  }

  return (
    <ResponsiveLayout>
      <style jsx global>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 0;
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            background: #fff !important;
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
            width: 297mm !important;
            height: 210mm !important;
            display: flex !important;
            flex-direction: row !important;
            gap: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
            background: #fff !important;
            color: #000 !important;
          }
          .print-voucher-half {
            width: 50% !important;
            height: 100% !important;
            padding: 8mm 10mm !important;
            box-sizing: border-box !important;
            border-right: 1px dashed #cbd5e1 !important;
          }
          .print-voucher-half:last-child {
            border-right: none !important;
          }
          .cut-here-badge {
            position: absolute;
            top: 4px;
            left: 50%;
            transform: translateX(-50%);
            font-size: 8px;
            color: #64748b;
            background: #fff;
            padding: 2px 8px;
            border: 1px dashed #cbd5e1;
            border-radius: 4px;
            display: flex;
            align-items: center;
            gap: 4px;
            z-index: 10;
          }
          img.print-image {
            max-width: 100% !important;
            display: block !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      {/* PRINT CONTAINER */}
      <div id="print-section" className="hidden print:flex relative">
        <div className="cut-here-badge print:flex hidden">
          <Scissors className="w-3 h-3" /> Cut Here
        </div>
        {renderVoucherHalf()}
        {renderVoucherHalf()}
      </div>

      {/* UI DESIGN */}
      <div className="space-y-4 sm:space-y-6 p-2 sm:p-4 md:p-6 print:hidden max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.back()} className="print:hidden shrink-0 h-8 sm:h-9 px-2 sm:px-3">
              <ArrowLeft className="h-4 w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Back</span>
            </Button>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold font-heading flex items-center gap-2 truncate text-slate-900 dark:text-slate-100">
                <ArrowRightLeft className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500 dark:text-blue-400 shrink-0" />
                <span className="truncate">Cash/Bank Transfer</span>
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground dark:text-slate-400 truncate">Transfer funds between accounts</p>
            </div>
          </div>
          <div className="flex gap-2 print:hidden flex-wrap">
            <Button variant="outline" size="sm" onClick={() => window.print()} className="h-8 sm:h-9 text-xs sm:text-sm dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
              <Printer className="h-4 w-4 mr-1 sm:mr-2" />
              <span>Print</span>
            </Button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="text-xs sm:text-sm">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Account Balance Summary */}
        <div className="grid gap-2.5 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.slice(0, 3).map((account) => {
            const Icon = accountTypeIcons[account.type]
            return (
              <Card key={account.id} className="bg-gradient-to-br from-white to-gray-50 dark:from-slate-800 dark:to-slate-900 border dark:border-slate-800">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <div className="p-1.5 sm:p-2 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 shrink-0">
                      <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-semibold truncate dark:text-slate-200">{account.account_name}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground dark:text-slate-400">{accountTypeLabels[account.type]}</p>
                    </div>
                  </div>
                  <p className="text-base sm:text-lg font-bold mt-2 dark:text-slate-100">{formatCurrency(account.current_balance)}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Main Form */}
        <Card className="print:shadow-none print:border-0 dark:border-slate-800 dark:bg-slate-900">
          <CardHeader className="print:hidden p-3 sm:p-6 pb-2 sm:pb-4 border-b dark:border-slate-800">
            <CardTitle className="text-base sm:text-xl dark:text-slate-100">Transfer Details</CardTitle>
            <CardDescription className="text-xs sm:text-sm dark:text-slate-400">Fill in the transfer information below</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 sm:space-y-6 p-3 sm:p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6">
              {/* From Account */}
              <div className="space-y-1 sm:space-y-1.5">
                <Label className="text-xs sm:text-sm dark:text-slate-300">
                  From Account <span className="text-rose-500">*</span>
                </Label>
                <Select 
                  value={formData.from_account_id} 
                  onValueChange={(v) => setFormData({ ...formData, from_account_id: v })}
                >
                  <SelectTrigger className="h-9 sm:h-10 text-xs sm:text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200">
                    <SelectValue placeholder="Select from account" />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-slate-800 dark:border-slate-700">
                    {availableFromAccounts.map(account => {
                      const Icon = accountTypeIcons[account.type]
                      return (
                        <SelectItem key={account.id} value={account.id} className="text-xs sm:text-sm dark:text-slate-200 dark:focus:bg-slate-700">
                          <div className="flex items-center gap-2">
                            <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                            <span className="truncate">{account.account_name}</span>
                            <span className="text-[10px] sm:text-xs text-muted-foreground dark:text-slate-400">
                              ({formatCurrency(account.current_balance)})
                            </span>
                          </div>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                {formData.from_account_id && (
                  <p className="text-[10px] sm:text-xs text-muted-foreground dark:text-slate-400 mt-1">
                    Balance: <span className="font-semibold">{formatCurrency(fromAccountBalance)}</span>
                  </p>
                )}
              </div>

              {/* To Account */}
              <div className="space-y-1 sm:space-y-1.5">
                <Label className="text-xs sm:text-sm dark:text-slate-300">
                  To Account <span className="text-rose-500">*</span>
                </Label>
                <Select 
                  value={formData.to_account_id} 
                  onValueChange={(v) => setFormData({ ...formData, to_account_id: v })}
                >
                  <SelectTrigger className="h-9 sm:h-10 text-xs sm:text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200">
                    <SelectValue placeholder="Select to account" />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-slate-800 dark:border-slate-700">
                    {availableToAccounts.map(account => {
                      const Icon = accountTypeIcons[account.type]
                      return (
                        <SelectItem key={account.id} value={account.id} className="text-xs sm:text-sm dark:text-slate-200 dark:focus:bg-slate-700">
                          <div className="flex items-center gap-2">
                            <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                            <span className="truncate">{account.account_name}</span>
                            <span className="text-[10px] sm:text-xs text-muted-foreground dark:text-slate-400">
                              ({formatCurrency(account.current_balance)})
                            </span>
                          </div>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                {formData.to_account_id && (
                  <p className="text-[10px] sm:text-xs text-muted-foreground dark:text-slate-400 mt-1">
                    Balance: <span className="font-semibold">{formatCurrency(toAccountBalance)}</span>
                  </p>
                )}
              </div>

              {/* Amount */}
              <div className="space-y-1 sm:space-y-1.5">
                <Label className="text-xs sm:text-sm dark:text-slate-300">
                  Amount (BDT) <span className="text-rose-500">*</span>
                </Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={formData.amount || ''}
                  onChange={(e) => handleNumberInput(e.target.value)}
                  placeholder="0.00"
                  className="h-9 sm:h-10 text-xs sm:text-sm font-mono dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                />
                <p className="text-[10px] sm:text-xs text-muted-foreground dark:text-slate-400">
                  বাংলা ও ইংরেজি উভয় ভাষায় সংখ্যা লিখতে পারেন
                </p>
                {formData.from_account_id && formData.amount > 0 && (
                  <p className={cn(
                    "text-[10px] sm:text-xs mt-0.5 font-medium",
                    hasSufficientBalance ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                  )}>
                    {hasSufficientBalance 
                      ? `✅ Sufficient balance. After transfer: ${formatCurrency(fromAccountBalance - formData.amount)}`
                      : `❌ Insufficient balance. Available: ${formatCurrency(fromAccountBalance)}`
                    }
                  </p>
                )}
              </div>

              {/* Date */}
              <div className="space-y-1 sm:space-y-1.5">
                <Label className="text-xs sm:text-sm dark:text-slate-300">
                  Date <span className="text-rose-500">*</span>
                </Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="h-9 sm:h-10 text-xs sm:text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:[color-scheme:dark]"
                />
              </div>

              {/* Reference No */}
              <div className="space-y-1 sm:space-y-1.5 md:col-span-2">
                <Label className="text-xs sm:text-sm dark:text-slate-300">Reference No</Label>
                <Input
                  value={formData.reference_no}
                  onChange={(e) => setFormData({ ...formData, reference_no: e.target.value })}
                  placeholder="Optional reference number"
                  className="h-9 sm:h-10 text-xs sm:text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1 sm:space-y-1.5">
              <Label className="text-xs sm:text-sm dark:text-slate-300">Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the transfer..."
                rows={2}
                className="text-xs sm:text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-500"
              />
            </div>

            {/* Transfer Preview */}
            {formData.from_account_id && formData.to_account_id && formData.amount > 0 && (
              <div className="p-3 sm:p-4 border rounded-lg bg-blue-500/5 border-blue-500/20 dark:bg-blue-950/20 dark:border-blue-800/40">
                <h4 className="font-semibold text-xs sm:text-sm dark:text-slate-200 mb-2">Transfer Preview</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground dark:text-slate-400">From:</p>
                    <p className="font-semibold dark:text-slate-200 truncate">{getAccountName(formData.from_account_id)}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground dark:text-slate-400">Balance After: <span className={hasSufficientBalance ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-rose-600 dark:text-rose-400 font-semibold"}>{formatCurrency(fromAccountBalance - formData.amount)}</span></p>
                  </div>
                  <div>
                    <p className="text-muted-foreground dark:text-slate-400">To:</p>
                    <p className="font-semibold dark:text-slate-200 truncate">{getAccountName(formData.to_account_id)}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground dark:text-slate-400">Balance After: <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{formatCurrency(toAccountBalance + formData.amount)}</span></p>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-blue-200/50 dark:border-blue-800/50 flex justify-between items-center text-xs sm:text-sm">
                  <span className="text-muted-foreground dark:text-slate-400">Transfer Amount:</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">{formatCurrency(formData.amount)}</span>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4 p-3 sm:p-4 border rounded-lg bg-slate-50 border-slate-200 dark:bg-slate-800/40 dark:border-slate-800">
              <div className="text-xs text-center sm:text-left">
                <span className="text-muted-foreground dark:text-slate-400">Status: </span>
                <span className={formData.from_account_id && formData.to_account_id && formData.amount > 0 && hasSufficientBalance ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-amber-600 dark:text-amber-400 font-medium"}>
                  {formData.from_account_id && formData.to_account_id && formData.amount > 0 && hasSufficientBalance 
                    ? "✅ Ready to transfer" 
                    : "⚠️ Please complete all fields"
                  }
                </span>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button variant="outline" onClick={() => router.back()} className="flex-1 sm:flex-none text-xs sm:text-sm h-9 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                  Cancel
                </Button>
                <Button 
                  onClick={handleSubmit} 
                  disabled={submitting || !formData.from_account_id || !formData.to_account_id || formData.amount <= 0 || !hasSufficientBalance}
                  className="flex-1 sm:flex-none min-w-[110px] text-xs sm:text-sm h-9 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white"
                >
                  {submitting ? <Loader2 className="h-4 w-4 mr-1 sm:mr-2 animate-spin" /> : <ArrowRightLeft className="h-4 w-4 mr-1 sm:mr-2" />}
                  {submitting ? 'Processing...' : 'Transfer'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </ResponsiveLayout>
  )
}
