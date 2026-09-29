"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { 
  ArrowLeft,
  Save,
  Loader2,
  Printer,
  TrendingUp,
  Plus,
  X,
  Landmark,
  Calendar,
  User,
  FileText,
  Wallet,
  BookOpen,
  Info,
  CheckCircle2,
  Scissors
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/utils"
import { ResponsiveLayout } from "@/components/layout/responsive-layout"

type PaymentMode = 'cash' | 'bank' | 'mobile_banking'

interface IncomeHead {
  id: string
  name: string
  type: string
  code: string
  is_active: boolean
}

interface FinancialAccount {
  id: string
  account_name: string
  type: string
  current_balance?: number
}

interface SchoolSettings {
  id: number
  school_name: string | null
  school_address: string | null
  school_phone: string | null
  school_email: string | null
  school_logo: string | null
  school_watermark: string | null
}

interface IncomeFormData {
  income_head_id: string
  financial_account_id: string
  amount: number | string
  date: string
  payment_mode: PaymentMode
  reference_no: string
  description: string
  received_from: string
}

const convertBanglaToEnglishNumbers = (str: string | number): string => {
  if (typeof str === "number") return str.toString()
  if (!str) return ""
  const banglaDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯']
  return str.replace(/[০-৯]/g, (digit) => banglaDigits.indexOf(digit).toString())
}

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

export default function ManualIncomePage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [incomeHeads, setIncomeHeads] = useState<IncomeHead[]>([])
  const [financialAccounts, setFinancialAccounts] = useState<FinancialAccount[]>([])
  const [schoolInfo, setSchoolInfo] = useState<SchoolSettings | null>(null)
  
  const [formData, setFormData] = useState<IncomeFormData>({
    income_head_id: '',
    financial_account_id: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    payment_mode: 'cash',
    reference_no: '',
    description: '',
    received_from: '',
  })

  const [showAddHead, setShowAddHead] = useState(false)
  const [newHeadName, setNewHeadName] = useState('')
  const [newHeadCode, setNewHeadCode] = useState('')
  const [shouldRedirectAfterPrint, setShouldRedirectAfterPrint] = useState(false)
  const [generatedVoucherNo, setGeneratedVoucherNo] = useState<string>('INC-OTH-001')

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    const handleAfterPrint = () => {
      if (shouldRedirectAfterPrint) {
        router.push('/finance')
      }
    }
    
    window.addEventListener('afterprint', handleAfterPrint)
    return () => window.removeEventListener('afterprint', handleAfterPrint)
  }, [shouldRedirectAfterPrint, router])

  const loadData = async () => {
    setLoading(true)
    try {
      const [headsRes, accountsRes, schoolRes] = await Promise.all([
        supabase.from('income_heads').select('*').eq('is_active', true).order('name'),
        supabase.from('financial_accounts').select('*').eq('is_active', true).order('account_name'),
        supabase.from('school_settings').select('*').limit(1).maybeSingle(),
      ])
      
      if (headsRes.error) throw headsRes.error
      if (accountsRes.error) throw accountsRes.error
      
      setIncomeHeads(headsRes.data || [])
      setFinancialAccounts(accountsRes.data || [])
      if (schoolRes.data) {
        setSchoolInfo(schoolRes.data)
      }
    } catch (error: any) {
      console.error('Error loading data:', error?.message || error)
      toast.error('Failed to load initial data')
    } finally {
      setLoading(false)
    }
  }

  const addIncomeHead = async () => {
    if (!newHeadName.trim()) {
      toast.error('Please enter income head name')
      return
    }
    
    const code = newHeadCode.trim() || `INC-${newHeadName.trim().toUpperCase().slice(0, 3)}${Date.now().toString().slice(-4)}`
    
    try {
      const { data, error } = await supabase
        .from('income_heads')
        .insert([{
          name: newHeadName.trim(),
          type: 'income',
          code: code,
          is_active: true,
        }])
        .select()
        .single()
      
      if (error) throw error
      
      setIncomeHeads(prev => [...prev, data])
      setFormData(prev => ({ ...prev, income_head_id: data.id }))
      setShowAddHead(false)
      setNewHeadName('')
      setNewHeadCode('')
      toast.success('Income head added successfully')
    } catch (error: any) {
      console.error('Error adding income head:', error?.message || error)
      toast.error(error?.message || 'Failed to add income head')
    }
  }

  const numericAmount = Number(convertBanglaToEnglishNumbers(formData.amount)) || 0
  const amountInWords = numberToWords(numericAmount)

  const validateForm = (): boolean => {
    if (!formData.income_head_id) {
      toast.error('Please select an income head')
      return false
    }
    if (!formData.financial_account_id) {
      toast.error('Please select a financial account')
      return false
    }
    if (numericAmount <= 0) {
      toast.error('Amount must be greater than 0')
      return false
    }
    if (!formData.received_from.trim()) {
      toast.error('Please enter received from name')
      return false
    }
    return true
  }

  const handleSave = async (shouldPrint: boolean): Promise<boolean> => {
    if (!validateForm()) return false

    setSubmitting(true)
    try {
      const response = await fetch('/api/finance/income', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          income_head_id: formData.income_head_id,
          financial_account_id: formData.financial_account_id,
          amount: numericAmount,
          date: formData.date,
          payment_mode: formData.payment_mode,
          description: formData.description,
          received_from: formData.received_from,
          reference_no: formData.reference_no || undefined,
        }),
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || result.message || 'Failed to record income')
      }

      setGeneratedVoucherNo(`INC-${String(result.voucher_id ?? '').slice(0, 8)}`)

      toast.success('Income recorded successfully')

      if (shouldPrint) {
        setShouldRedirectAfterPrint(true)
        setTimeout(() => {
          window.print()
        }, 300)
      } else {
        router.push('/finance')
      }
      
      return true
    } catch (error: any) {
      console.error('Error recording income:', error?.message || JSON.stringify(error))
      toast.error(error?.message || 'Failed to record income')
      return false
    } finally {
      setSubmitting(false)
    }
  }

  const selectedHead = incomeHeads.find(h => h.id === formData.income_head_id)
  const selectedAccount = financialAccounts.find(a => a.id === formData.financial_account_id)

  if (loading) {
    return (
      <ResponsiveLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </ResponsiveLayout>
    )
  }

  // Print Voucher Template (2 copies) - English name removed
  const renderVoucherHalf = () => (
    <div className="print-voucher-half">
      {/* Header */}
      <div className="flex justify-between items-start mb-2 pb-1 border-b border-slate-200">
        <div className="flex items-center gap-2">
          {schoolInfo?.school_logo ? (
            <img src={schoolInfo.school_logo} alt="Logo" className="w-12 h-12 object-contain" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-xs">
              LOGO
            </div>
          )}
          <div>
            <h1 className="text-sm font-bold text-slate-900 leading-tight">
              {schoolInfo?.school_name || 'শাপলা কিন্ডারগার্টেন ও প্রি-ক্যাডেট'}
            </h1>
            {/* English name removed */}
            <p className="text-[8px] text-slate-500 leading-tight mt-0.5">
              📍 {schoolInfo?.school_address || 'Nowtala, Madhaiya Bazar, Chandina, Cumilla'}
            </p>
            <p className="text-[8px] text-slate-500 leading-tight">
              📞 {schoolInfo?.school_phone || '01923253454'}
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="bg-[#0d9488] text-white font-bold text-[10px] px-3 py-1 rounded tracking-wide text-center mb-1">
            INCOME VOUCHER<br />আয়ের রসিদ
          </div>
          <div className="text-[9px] text-slate-600">
            <span className="font-semibold">Voucher No.</span> {generatedVoucherNo}
          </div>
          <div className="text-[9px] text-slate-600">
            <span className="font-semibold">Date</span> {formData.date ? new Date(formData.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
          </div>
        </div>
      </div>

      {/* Info Grids */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        {/* Income Details */}
        <div className="border border-emerald-100 rounded bg-emerald-50/20 p-1.5">
          <div className="flex items-center gap-1 text-[9px] font-bold text-[#0d9488] border-b border-emerald-100 pb-1 mb-1">
            <Info className="w-3 h-3" />
            INCOME DETAILS
          </div>
          <div className="space-y-1 text-[8.5px]">
            <div className="flex justify-between">
              <span className="text-slate-500">Income Head</span>
              <span className="font-semibold text-slate-800">{selectedHead?.name || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Code</span>
              <span className="font-semibold text-slate-800">{selectedHead?.code || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Description</span>
              <span className="font-semibold text-slate-800">{formData.description || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Reference No</span>
              <span className="font-semibold text-slate-800">{formData.reference_no || 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* Receipt Information */}
        <div className="border border-emerald-100 rounded bg-emerald-50/20 p-1.5">
          <div className="flex items-center gap-1 text-[9px] font-bold text-[#0d9488] border-b border-emerald-100 pb-1 mb-1">
            <Landmark className="w-3 h-3" />
            RECEIPT INFORMATION
          </div>
          <div className="space-y-1 text-[8.5px]">
            <div className="flex justify-between">
              <span className="text-slate-500">Receives to Account</span>
              <span className="font-semibold text-slate-800">{selectedAccount?.account_name || 'Main Cash'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Received From</span>
              <span className="font-semibold text-slate-800">{formData.received_from || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Date</span>
              <span className="font-semibold text-slate-800">
                {formData.date ? new Date(formData.date).toLocaleDateString('en-GB') : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Payment Mode</span>
              <span className="font-semibold text-slate-800 capitalize">{formData.payment_mode}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <table className="w-full text-[8.5px] border-collapse mb-2">
        <thead>
          <tr className="bg-[#0d9488] text-white">
            <th className="border border-[#0d9488] p-1 text-left w-8">SL.</th>
            <th className="border border-[#0d9488] p-1 text-left">DESCRIPTION / বিবরণ</th>
            <th className="border border-[#0d9488] p-1 text-right w-24">AMOUNT (BDT)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-slate-200 p-1 text-center">1</td>
            <td className="border border-slate-200 p-1">
              <div className="font-semibold text-slate-800">{selectedHead?.name || 'Income Head'}</div>
              {selectedHead?.code && <div className="text-[7.5px] text-slate-500">Code: {selectedHead.code}</div>}
            </td>
            <td className="border border-slate-200 p-1 text-right font-semibold">{formatCurrency(numericAmount)}</td>
          </tr>
        </tbody>
      </table>

      {/* Amount in words & Total */}
      <div className="grid grid-cols-3 border border-slate-200 text-[8.5px] mb-4">
        <div className="col-span-2 p-1.5 flex items-center gap-2 border-r border-slate-200">
          <span className="font-bold text-slate-700">TOTAL AMOUNT IN WORDS</span>
          <span className="font-medium text-slate-900">{amountInWords} Taka Only</span>
        </div>
        <div className="p-1.5 text-right font-bold bg-slate-50">
          <span className="block text-[7.5px] text-slate-500 font-normal">TOTAL AMOUNT (BDT)</span>
          <span className="text-sm text-slate-900">{formatCurrency(numericAmount)}</span>
        </div>
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-3 text-center text-[8px] mt-6 pt-2">
        <div>
          <div className="border-t border-slate-300 pt-1 font-semibold text-slate-700">RECEIVED BY</div>
          <div className="text-slate-500 text-[7px] mt-0.5">{formData.received_from || 'Receiver'}</div>
        </div>
        <div>
          <div className="border-t border-slate-300 pt-1 font-semibold text-slate-700">ACCOUNTS</div>
          <div className="text-slate-500 text-[7px] mt-0.5">Accounts Department</div>
        </div>
        <div>
          <div className="border-t border-slate-300 pt-1 font-semibold text-slate-700">APPROVED BY</div>
          <div className="text-slate-500 text-[7px] mt-0.5">Principal / Head</div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center text-[7.5px] text-slate-500 border-t border-slate-200 pt-1 mt-3">
        <div className="flex items-center gap-1">
          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
          Thank you for your payment.
        </div>
        <div>This is a computer generated receipt and does not require signature.</div>
      </div>
    </div>
  )

  return (
    <ResponsiveLayout>
      <style jsx global>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 0;
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
            padding: 8mm !important;
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
      <div className="space-y-6 p-4 md:p-6 print:hidden max-w-7xl mx-auto bg-slate-50/50 dark:bg-transparent min-h-screen">
        {/* Top Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => router.back()} className="bg-white dark:bg-slate-900 border-slate-200 shadow-sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">Manual Income Entry</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">Record income from sources other than fees and sales</p>
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => window.print()} className="bg-white dark:bg-slate-900 border-slate-200 shadow-sm">
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>

        {/* Form Container Grids */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          
          {/* Left Card: Income Details */}
          <Card className="border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-xl overflow-hidden">
            <CardHeader className="bg-slate-50/60 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800/80 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    Income Details
                    <Info className="h-4 w-4 text-slate-400" />
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">Fill in the income information below</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-5">
              
              {/* Income Head Select */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Income Head <span className="text-rose-500">*</span>
                  </Label>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setShowAddHead(true)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 h-6 px-2 bg-blue-50 dark:bg-blue-950/40 font-medium"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add New
                  </Button>
                </div>
                <div className="relative">
                  <Select 
                    value={formData.income_head_id} 
                    onValueChange={(value) => {
                      if (value === "__add_new__") {
                        setShowAddHead(true)
                      } else {
                        setFormData(prev => ({ ...prev, income_head_id: value }))
                      }
                    }}
                  >
                    <SelectTrigger className="pl-10 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 h-11 text-sm">
                      <SelectValue placeholder="Select Income Head" />
                    </SelectTrigger>
                    <SelectContent>
                      {incomeHeads.map(head => (
                        <SelectItem key={head.id} value={head.id}>
                          {head.code} - {head.name}
                        </SelectItem>
                      ))}
                      <SelectItem value="__add_new__" className="text-blue-600 dark:text-blue-400 font-medium">
                        ➕ Add New Income Head...
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <BookOpen className="w-4 h-4 text-blue-500 absolute left-3.5 top-3.5 pointer-events-none" />
                </div>
              </div>

              {/* Amount Input */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Amount (BDT) <span className="text-rose-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={formData.amount}
                    onChange={(e) => {
                      const val = e.target.value
                      const converted = convertBanglaToEnglishNumbers(val)
                      if (/^\d*\.?\d*$/.test(converted)) {
                        setFormData(prev => ({ ...prev, amount: val }))
                      }
                    }}
                    placeholder="টাকার সংখ্যা লিখুন"
                    className="pl-10 pr-14 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 h-11 text-sm font-medium"
                  />
                  <Wallet className="w-4 h-4 text-blue-500 absolute left-3.5 top-3.5 pointer-events-none" />
                  <span className="absolute right-3 top-2.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-md">
                    BDT
                  </span>
                </div>
              </div>

              {/* Payment Mode */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Payment Mode</Label>
                <div className="relative">
                  <Select 
                    value={formData.payment_mode} 
                    onValueChange={(value: PaymentMode) => setFormData(prev => ({ ...prev, payment_mode: value }))}
                  >
                    <SelectTrigger className="pl-10 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 h-11 text-sm capitalize">
                      <SelectValue placeholder="Cash" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank">Bank</SelectItem>
                      <SelectItem value="mobile_banking">Mobile Banking</SelectItem>
                    </SelectContent>
                  </Select>
                  <Wallet className="w-4 h-4 text-purple-500 absolute left-3.5 top-3.5 pointer-events-none" />
                </div>
              </div>

              {/* Reference No */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Reference No</Label>
                <div className="relative">
                  <Input
                    value={formData.reference_no}
                    onChange={(e) => setFormData(prev => ({ ...prev, reference_no: e.target.value }))}
                    placeholder="রসিদ নম্বর লিখুন"
                    className="pl-10 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 h-11 text-sm"
                  />
                  <FileText className="w-4 h-4 text-emerald-500 absolute left-3.5 top-3.5 pointer-events-none" />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Description</Label>
                <div className="relative">
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="আয়ের বিবরণ লিখুন"
                    rows={3}
                    className="pl-10 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-sm resize-none pt-2.5"
                  />
                  <FileText className="w-4 h-4 text-amber-500 absolute left-3.5 top-3.5 pointer-events-none" />
                </div>
              </div>

            </CardContent>
          </Card>

          {/* Right Card: Receives & Date Info */}
          <div className="space-y-6">
            <Card className="border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-xl overflow-hidden">
              <CardHeader className="bg-slate-50/60 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800/80 pb-4">
                <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
                  Receives & Date Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-5">
                
                {/* Receive to Account */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Receive to Account <span className="text-rose-500">*</span>
                  </Label>
                  <div className="relative">
                    <Select 
                      value={formData.financial_account_id} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, financial_account_id: value }))}
                    >
                      <SelectTrigger className="pl-10 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 h-11 text-sm">
                        <SelectValue placeholder="নির্বাচন করুন Cash/Bsnk/Mobile Bank" />
                      </SelectTrigger>
                      <SelectContent>
                        {financialAccounts.map(account => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.account_name} ({account.type}) - {formatCurrency(account.current_balance || 0)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Landmark className="w-4 h-4 text-indigo-500 absolute left-3.5 top-3.5 pointer-events-none" />
                  </div>
                </div>

                {/* Date */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Date <span className="text-rose-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                      className="pl-10 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 h-11 text-sm"
                    />
                    <Calendar className="w-4 h-4 text-purple-500 absolute left-3.5 top-3.5 pointer-events-none" />
                  </div>
                </div>

                {/* Received From */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Received From <span className="text-rose-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      value={formData.received_from}
                      onChange={(e) => setFormData(prev => ({ ...prev, received_from: e.target.value }))}
                      placeholder="নাম লিখুন"
                      className="pl-10 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 h-11 text-sm"
                    />
                    <User className="w-4 h-4 text-indigo-500 absolute left-3.5 top-3.5 pointer-events-none" />
                  </div>
                </div>

              </CardContent>
            </Card>

            {/* Total Amount Summary Box */}
            <div className="p-5 border border-emerald-100 dark:border-emerald-900/40 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 flex justify-between items-center">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Income Amount</p>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight mt-0.5">
                  {formatCurrency(numericAmount)}
                </p>
              </div>
              <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/60 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-xl shadow-inner">
                💰
              </div>
            </div>

            {/* Bottom Buttons */}
            <div className="flex gap-3">
              <Button 
                variant="outline"
                onClick={() => router.back()}
                className="flex-1 h-11 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-medium text-slate-700 dark:text-slate-300"
              >
                <X className="h-4 w-4 mr-2 text-slate-500" />
                Cancel
              </Button>
              <Button 
                onClick={() => handleSave(false)} 
                disabled={submitting || numericAmount <= 0}
                className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-md shadow-emerald-600/20"
              >
                {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                {submitting ? 'Saving...' : 'Record Income'}
              </Button>
            </div>

          </div>
        </div>
      </div>

      {/* Add New Head Modal */}
      {showAddHead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in-0 duration-200">
          <Card className="w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <CardTitle className="text-base font-bold">Add New Income Head</CardTitle>
                <CardDescription className="text-xs">Create a custom income head</CardDescription>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setShowAddHead(false)}
                className="h-8 w-8 rounded-full"
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div>
                <Label className="text-xs font-semibold">Income Head Name *</Label>
                <Input
                  value={newHeadName}
                  onChange={(e) => setNewHeadName(e.target.value)}
                  placeholder="e.g., Book Fees, Canteen Income"
                  className="mt-1.5 h-10 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Code (Optional)</Label>
                <Input
                  value={newHeadCode}
                  onChange={(e) => setNewHeadCode(e.target.value)}
                  placeholder="e.g., INC-BOOK"
                  className="mt-1.5 h-10 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setShowAddHead(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={addIncomeHead} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  Add Head
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </ResponsiveLayout>
  )
}
