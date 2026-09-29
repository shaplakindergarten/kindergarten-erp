// src/app/finance/reports/general-ledger/page.tsx
"use client"

import React, { useState, useEffect, useRef, forwardRef } from "react"
import Link from "next/link"
import { 
  ArrowLeft,
  Download,
  Loader2,
  Printer,
  BarChart3,
  Calendar,
  BookOpen,
  ChevronLeft,
  ChevronRight
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatCurrency, cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { format } from "date-fns"
import { ResponsiveLayout } from "@/components/layout/responsive-layout"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"

const supabase = createClient()

interface SchoolSettings {
  school_name: string | null
  school_address: string | null
  school_phone: string | null
  school_logo: string | null
}

interface GLOntry {
  id: string
  date: string
  voucher_no: string
  account_code: string
  account_name: string
  account_type: string
  description: string
  debit: number
  credit: number
  balance: number
}

interface UnifiedAccount {
  id: string
  code: string
  name: string
  account_type: 'asset' | 'revenue' | 'expense'
  parent_id: string | null
}

interface AccountBalance {
  account_id: string
  code: string
  name: string
  account_type: string
  debit: number
  credit: number
  balance: number
  balance_type: 'debit' | 'credit'
}

const periodOptions = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'year', label: 'This Year' },
  { value: 'custom', label: 'Custom Range' },
]

// ─── Helper: Build unified accounts ─────────────────────────────────────────
function buildUnifiedAccounts(
  finAccounts: any[],
  incomeHeads: any[],
  expenseHeads: any[]
): UnifiedAccount[] {
  return [
    ...(finAccounts || []).map((fa: any) => ({
      id: fa.id,
      code:
        fa.type === 'cash' ? 'ASS-CASH'
        : fa.type === 'bank' ? 'ASS-BANK'
        : fa.type === 'mobile_bank' ? 'ASS-MOB'
        : 'ASS-' + (fa.type || 'UNKNOWN').toUpperCase(),
      name: fa.account_name,
      account_type: 'asset' as const,
      parent_id: null,
    })),
    ...(incomeHeads || []).map((ih: any) => ({
      id: ih.id,
      code: ih.code || 'REV-' + (ih.id?.slice(0, 4) ?? 'XXXX'),
      name: ih.name,
      account_type: 'revenue' as const,
      parent_id: null,
    })),
    ...(expenseHeads || []).map((eh: any) => ({
      id: eh.id,
      code: eh.code || 'EXP-' + (eh.id?.slice(0, 4) ?? 'XXXX'),
      name: eh.name,
      account_type: 'expense' as const,
      parent_id: null,
    })),
  ]
}

// ─── Print Component ────────────────────────────────────────────────────────
const PrintComponent = forwardRef<HTMLDivElement, {
  schoolInfo: SchoolSettings | null,
  entries: GLOntry[],
  accountBalances: AccountBalance[],
  totalDebit: number,
  totalCredit: number,
  periodLabel: string,
  todayLabel: string,
  accountName: string
}>(({ schoolInfo, entries, accountBalances, totalDebit, totalCredit, periodLabel, todayLabel, accountName }, ref) => {
  const schoolName = schoolInfo?.school_name || 'মাদ্রাসাতুল সুনাহ আল মাদানী'
  const schoolAddress = schoolInfo?.school_address || 'Nowtala, Madhaiya Bazar, Chandina, Cumilla'
  const schoolPhone = schoolInfo?.school_phone || '01923253454'
  
  return (
    <div ref={ref} className="print-content" style={{
      padding: '30px 40px',
      fontFamily: 'Arial, sans-serif',
      backgroundColor: 'white',
      color: '#1a1a1a',
      width: '210mm',
      minHeight: '297mm'
    }}>
      {/* HEADER */}
      <div style={{ 
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
        borderBottom: '3px double #1a1a1a',
        paddingBottom: '15px',
        marginBottom: '20px'
      }}>
        {schoolInfo?.school_logo && (
          <img 
            src={schoolInfo.school_logo} 
            alt="School Logo" 
            style={{ 
              height: '70px', 
              width: '70px', 
              objectFit: 'contain',
              flexShrink: 0
            }} 
          />
        )}
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '22px', fontWeight: 'bold', margin: 0, letterSpacing: '1px', color: '#1a1a1a' }}>
            {schoolName}
          </h1>
          <p style={{ fontSize: '13px', color: '#4a4a4a', margin: '3px 0 0 0' }}>
            {schoolAddress}
          </p>
          <p style={{ fontSize: '13px', color: '#4a4a4a', margin: '2px 0 0 0' }}>
            Phone: {schoolPhone}
          </p>
        </div>
      </div>

      {/* REPORT TITLE */}
      <div style={{ textAlign: 'center', marginBottom: '15px' }}>
        <h2 style={{ 
          fontSize: '18px', 
          fontWeight: 'bold',
          textTransform: 'uppercase',
          letterSpacing: '2px',
          color: '#1a1a1a',
          margin: 0
        }}>
          General Ledger
        </h2>
        {accountName && accountName !== 'All Accounts' && (
          <p style={{ fontSize: '13px', color: '#4a4a4a', marginTop: '3px' }}>
            Account: {accountName}
          </p>
        )}
      </div>

      {/* PERIOD & GENERATED */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        fontSize: '13px',
        color: '#4a4a4a',
        borderBottom: '1px solid #e0e0e0',
        paddingBottom: '8px'
      }}>
        <span><strong>Period:</strong> {periodLabel}</span>
        <span><strong>Generated:</strong> {todayLabel}</span>
      </div>

      {/* JOURNAL ENTRIES TABLE */}
      <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#1a1a1a' }}>Journal Entries</h3>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        marginBottom: '25px',
        fontSize: '10px'
      }}>
        <thead>
          <tr style={{ backgroundColor: '#1a1a1a', color: 'white' }}>
            <th style={{ padding: '4px 6px', textAlign: 'left', border: '1px solid #333' }}>Date</th>
            <th style={{ padding: '4px 6px', textAlign: 'left', border: '1px solid #333' }}>Voucher No</th>
            <th style={{ padding: '4px 6px', textAlign: 'left', border: '1px solid #333' }}>Account</th>
            <th style={{ padding: '4px 6px', textAlign: 'left', border: '1px solid #333' }}>Description</th>
            <th style={{ padding: '4px 6px', textAlign: 'right', border: '1px solid #333' }}>Debit</th>
            <th style={{ padding: '4px 6px', textAlign: 'right', border: '1px solid #333' }}>Credit</th>
            <th style={{ padding: '4px 6px', textAlign: 'right', border: '1px solid #333' }}>Balance</th>
          </tr>
        </thead>
        <tbody>
          {entries.slice(0, 20).map((entry, i) => (
            <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#f8fafc' : 'white' }}>
              <td style={{ padding: '3px 6px', border: '1px solid #e0e0e0' }}>
                {format(new Date(entry.date), 'dd MMM yyyy')}
              </td>
              <td style={{ padding: '3px 6px', border: '1px solid #e0e0e0', fontFamily: 'monospace' }}>
                {entry.voucher_no}
              </td>
              <td style={{ padding: '3px 6px', border: '1px solid #e0e0e0' }}>
                {entry.account_name}
              </td>
              <td style={{ padding: '3px 6px', border: '1px solid #e0e0e0' }}>
                {entry.description || '-'}
              </td>
              <td style={{ padding: '3px 6px', textAlign: 'right', border: '1px solid #e0e0e0', color: '#10b981' }}>
                {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
              </td>
              <td style={{ padding: '3px 6px', textAlign: 'right', border: '1px solid #e0e0e0', color: '#ef4444' }}>
                {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
              </td>
              <td style={{ padding: '3px 6px', textAlign: 'right', border: '1px solid #e0e0e0', fontWeight: 'bold' }}>
                {formatCurrency(entry.balance)}
              </td>
            </tr>
          ))}
          {entries.length > 20 && (
            <tr>
              <td colSpan={7} style={{ padding: '4px 6px', textAlign: 'center', border: '1px solid #e0e0e0', fontStyle: 'italic', color: '#666' }}>
                ... and {entries.length - 20} more entries
              </td>
            </tr>
          )}
          <tr style={{ backgroundColor: '#1a1a1a', color: 'white', fontWeight: 'bold' }}>
            <td colSpan={4} style={{ padding: '4px 6px', border: '1px solid #333' }}>TOTAL</td>
            <td style={{ padding: '4px 6px', textAlign: 'right', border: '1px solid #333', color: '#34d399' }}>
              {formatCurrency(totalDebit)}
            </td>
            <td style={{ padding: '4px 6px', textAlign: 'right', border: '1px solid #333', color: '#f87171' }}>
              {formatCurrency(totalCredit)}
            </td>
            <td style={{ padding: '4px 6px', textAlign: 'right', border: '1px solid #333', color: '#34d399' }}>
              {formatCurrency(totalDebit - totalCredit)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ACCOUNT BALANCES TABLE */}
      <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#1a1a1a' }}>Account Balances</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '10px' }}>
        <thead>
          <tr style={{ backgroundColor: '#1a1a1a', color: 'white' }}>
            <th style={{ padding: '4px 6px', textAlign: 'left', border: '1px solid #333' }}>Code</th>
            <th style={{ padding: '4px 6px', textAlign: 'left', border: '1px solid #333' }}>Account Name</th>
            <th style={{ padding: '4px 6px', textAlign: 'left', border: '1px solid #333' }}>Type</th>
            <th style={{ padding: '4px 6px', textAlign: 'right', border: '1px solid #333' }}>Debit</th>
            <th style={{ padding: '4px 6px', textAlign: 'right', border: '1px solid #333' }}>Credit</th>
            <th style={{ padding: '4px 6px', textAlign: 'right', border: '1px solid #333' }}>Balance</th>
          </tr>
        </thead>
        <tbody>
          {accountBalances.filter(a => a.balance > 0 || a.debit > 0 || a.credit > 0).map((acc, i) => (
            <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#f8fafc' : 'white' }}>
              <td style={{ padding: '3px 6px', border: '1px solid #e0e0e0', fontFamily: 'monospace' }}>
                {acc.code}
              </td>
              <td style={{ padding: '3px 6px', border: '1px solid #e0e0e0' }}>
                {acc.name}
              </td>
              <td style={{ padding: '3px 6px', border: '1px solid #e0e0e0', textTransform: 'capitalize' }}>
                {acc.account_type}
              </td>
              <td style={{ padding: '3px 6px', textAlign: 'right', border: '1px solid #e0e0e0', color: '#10b981' }}>
                {formatCurrency(acc.debit)}
              </td>
              <td style={{ padding: '3px 6px', textAlign: 'right', border: '1px solid #e0e0e0', color: '#ef4444' }}>
                {formatCurrency(acc.credit)}
              </td>
              <td style={{ padding: '3px 6px', textAlign: 'right', border: '1px solid #e0e0e0', fontWeight: 'bold' }}>
                {formatCurrency(acc.balance)}
              </td>
            </tr>
          ))}
          {accountBalances.filter(a => a.balance > 0 || a.debit > 0 || a.credit > 0).length === 0 && (
            <tr>
              <td colSpan={6} style={{ padding: '4px 6px', textAlign: 'center', border: '1px solid #e0e0e0', color: '#666' }}>
                No account balances found
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* SIGNATURES */}
      <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '2px solid #e0e0e0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', textAlign: 'center' }}>
          <div>
            <div style={{ borderBottom: '1px solid #1a1a1a', paddingBottom: '2px', marginBottom: '5px', minHeight: '30px' }}></div>
            <span style={{ fontSize: '12px', color: '#4a4a4a' }}>Prepared By</span>
          </div>
          <div>
            <div style={{ borderBottom: '1px solid #1a1a1a', paddingBottom: '2px', marginBottom: '5px', minHeight: '30px' }}></div>
            <span style={{ fontSize: '12px', color: '#4a4a4a' }}>Verified By</span>
          </div>
          <div>
            <div style={{ borderBottom: '1px solid #1a1a1a', paddingBottom: '2px', marginBottom: '5px', minHeight: '30px' }}></div>
            <span style={{ fontSize: '12px', color: '#4a4a4a' }}>Authorized By</span>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div style={{
        textAlign: 'center',
        marginTop: '20px',
        paddingTop: '10px',
        borderTop: '1px solid #e0e0e0',
        fontSize: '11px',
        color: '#999'
      }}>
        <span>Powered by {schoolName} | Page 1 of 1</span>
      </div>
    </div>
  )
})

PrintComponent.displayName = 'PrintComponent'

export default function GeneralLedgerPage() {
  const [schoolInfo, setSchoolInfo] = useState<SchoolSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [entries, setEntries] = useState<GLOntry[]>([])
  const [accounts, setAccounts] = useState<UnifiedAccount[]>([])
  const [accountBalances, setAccountBalances] = useState<AccountBalance[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState('month')
  const [customDate, setCustomDate] = useState<{ start: string; end: string } | null>(null)
  const [selectedAccount, setSelectedAccount] = useState<string>('all')
  const [periodLabel, setPeriodLabel] = useState('')
  const [todayLabel, setTodayLabel] = useState('')

  const [jeCurrentPage, setJeCurrentPage] = useState(1)
  const [jeItemsPerPage] = useState(8)

  const [abCurrentPage, setAbCurrentPage] = useState(1)
  const [abItemsPerPage] = useState(8)

  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadSchoolInfo()
    loadAccounts()
  }, [])

  useEffect(() => {
    const initData = async () => {
      const dates = getPeriodDates()
      if (dates.start && dates.end && !isNaN(dates.start.getTime()) && !isNaN(dates.end.getTime())) {
        setPeriodLabel(`${format(dates.start, 'MMM d, yyyy')} - ${format(dates.end, 'MMM d, yyyy')}`)
      } else {
        const today = new Date()
        setPeriodLabel(`${format(today, 'MMM d, yyyy')} - ${format(today, 'MMM d, yyyy')}`)
      }
      setTodayLabel(format(new Date(), 'MMM d, yyyy, h:mm:ss a'))
      await loadGeneralLedger()
    }
    initData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeriod, customDate, selectedAccount])

  const loadSchoolInfo = async () => {
    try {
      const { data } = await supabase
        .from('school_settings')
        .select('school_name, school_address, school_phone, school_logo')
        .limit(1)
        .maybeSingle()
      if (data) setSchoolInfo(data)
    } catch (error) {
      console.error('Error loading school info:', error)
    }
  }

  // ─── UPDATED: loadAccounts (unified) ──────────────────────────────────────
  const loadAccounts = async () => {
    try {
      const [finRes, incRes, expRes] = await Promise.all([
        supabase
          .from('financial_accounts')
          .select('id, account_name, type')
          .eq('is_active', true),
        supabase
          .from('income_heads')
          .select('id, name, code')
          .eq('is_active', true),
        supabase
          .from('expense_heads')
          .select('id, name, code')
          .eq('is_active', true),
      ])

      if (finRes.error) throw finRes.error
      if (incRes.error) throw incRes.error
      if (expRes.error) throw expRes.error

      const unified = buildUnifiedAccounts(finRes.data || [], incRes.data || [], expRes.data || [])
      setAccounts(unified)
    } catch (error) {
      console.error('Error loading accounts:', error)
      toast.error('Failed to load accounts')
    }
  }

  const getPeriodDates = () => {
    const today = new Date()
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    const startOfYear = new Date(today.getFullYear(), 0, 1)
    const startOfQuarter = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1)

    if (customDate?.start && customDate?.end) {
      const start = new Date(customDate.start)
      const end = new Date(customDate.end)
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        return { start, end }
      }
    }

    switch (selectedPeriod) {
      case 'today':
        return { start: today, end: today }
      case 'week': {
        const startOfWeek = new Date(today)
        startOfWeek.setDate(today.getDate() - 7)
        return { start: startOfWeek, end: today }
      }
      case 'month':
        return { start: startOfMonth, end: today }
      case 'quarter':
        return { start: startOfQuarter, end: today }
      case 'year':
        return { start: startOfYear, end: today }
      default:
        return { start: startOfMonth, end: today }
    }
  }

  // ─── UPDATED: loadGeneralLedger (double-entry) ────────────────────────────
  const loadGeneralLedger = async () => {
    setLoading(true)
    try {
      const dates = getPeriodDates()

      if (!dates.start || !dates.end || isNaN(dates.start.getTime()) || isNaN(dates.end.getTime())) {
        toast.error('Invalid date range selected')
        setLoading(false)
        return
      }

      const startDate = format(dates.start, 'yyyy-MM-dd')
      const endDate = format(dates.end, 'yyyy-MM-dd')

      // Load accounts fresh so entries can resolve names by id
      const [finRes, incRes, expRes] = await Promise.all([
        supabase
          .from('financial_accounts')
          .select('id, account_name, type, account_category')
          .eq('is_active', true),
        supabase
          .from('income_heads')
          .select('id, name, code')
          .eq('is_active', true),
        supabase
          .from('expense_heads')
          .select('id, name, code')
          .eq('is_active', true),
      ])

      if (finRes.error) throw finRes.error
      if (incRes.error) throw incRes.error
      if (expRes.error) throw expRes.error

      const unifiedAccounts = buildUnifiedAccounts(
        finRes.data || [],
        incRes.data || [],
        expRes.data || []
      )

      // Sync state (in case first load happens before accounts loaded)
      setAccounts(unifiedAccounts)

      const accountById = new Map<string, UnifiedAccount>()
      unifiedAccounts.forEach(a => accountById.set(a.id, a))

      // Build account_category lookup from financial_accounts
      const finCategoryMap: Record<string, string> = {}
      for (const fa of (finRes.data || [])) {
        finCategoryMap[fa.id] = (fa.account_category || '').toLowerCase()
      }

      // ─── 1. Fetch vouchers in date range ───────────────────────────────────
      const { data: voucherData, error: voucherError } = await supabase
        .from('vouchers')
        .select('id, voucher_date, voucher_no, reference_no')
        .gte('voucher_date', startDate)
        .lte('voucher_date', endDate)
        .order('voucher_date', { ascending: false })

      if (voucherError) throw voucherError

      const vouchers = voucherData || []

      // Exclude transfer vouchers (TRF- prefix)
      const filteredVouchers = vouchers.filter((v: any) => {
        const ref = v.reference_no || ''
        return !ref.startsWith('TRF-')
      })

      // Build voucher lookup map for voucher_no / date resolution
      const voucherMap = new Map<string, any>()
      filteredVouchers.forEach((v: any) => voucherMap.set(v.id, v))

      const voucherIds = filteredVouchers.map((v: any) => v.id)

      // ─── 2. Fetch journal_entries (two-step pattern) ───────────────────────
      let jeData: any[] = []
      if (voucherIds.length > 0) {
        const { data: jeRows, error: jeError } = await supabase
          .from('journal_entries')
          .select('id, voucher_id, account_id, debit, credit, description, created_at')
          .in('voucher_id', voucherIds)

        if (jeError) throw jeError
        jeData = jeRows || []
      }

      // ─── 3. Build double-entry entries from journal_entries ────────────────
      const glEntries: GLOntry[] = []

      jeData.forEach((je: any) => {
        const voucher = voucherMap.get(je.voucher_id)
        const acc = accountById.get(je.account_id)

        // Resolve account_type: prefer financial_accounts.account_category
        let accountType: string = acc?.account_type || 'asset'
        const category = finCategoryMap[je.account_id]
        if (category) {
          accountType = category
        }

        glEntries.push({
          id: je.id,
          date: voucher?.voucher_date || je.created_at,
          voucher_no: voucher?.voucher_no || voucher?.reference_no || '',
          account_code: acc?.code || 'ACC-' + (je.account_id?.slice(0, 4) ?? 'XXXX'),
          account_name: acc?.name || 'Unknown Account',
          account_type: accountType,
          description: je.narration || je.description || '',
          debit: Number(je.debit) || 0,
          credit: Number(je.credit) || 0,
          balance: 0,
        })
      })

      let allEntries = [...glEntries]

      // Filter by selected account (match by id → name/code)
      if (selectedAccount !== 'all') {
        const selectedAcc = accountById.get(selectedAccount)
        if (selectedAcc) {
          allEntries = allEntries.filter(
            e =>
              e.account_name === selectedAcc.name ||
              e.account_code === selectedAcc.code
          )
        }
      }

      // Sort ascending for running balance
      allEntries.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      )

      // Running balance
      let runningBalance = 0
      allEntries.forEach(e => {
        runningBalance += e.debit - e.credit
        e.balance = runningBalance
      })

      // Display: newest first
      allEntries.reverse()

      setEntries(allEntries)
      setJeCurrentPage(1)

      // ─── Account balances aggregation ─────────────────────────────────────
      const balanceMap = new Map<string, { debit: number; credit: number; code: string; type: string }>()

      allEntries.forEach(e => {
        const key = e.account_name
        if (!balanceMap.has(key)) {
          balanceMap.set(key, { debit: 0, credit: 0, code: e.account_code, type: e.account_type })
        }
        const current = balanceMap.get(key)!
        current.debit += e.debit
        current.credit += e.credit
      })

      const balances: AccountBalance[] = Array.from(balanceMap.entries()).map(([name, data]) => {
        const balance = data.debit - data.credit
        return {
          account_id: `acc-${name}`,
          code: data.code,
          name: name,
          account_type: data.type,
          debit: data.debit,
          credit: data.credit,
          balance: Math.abs(balance),
          balance_type: balance >= 0 ? 'debit' : 'credit',
        }
      })

      setAccountBalances(balances)
      setAbCurrentPage(1)
    } catch (error) {
      console.error('Error loading general ledger:', error)
      toast.error('Failed to load general ledger data')
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => {
    if (!printRef.current) {
      toast.error('Print content not ready')
      return
    }

    const printContent = printRef.current
    const printWindow = window.open('', '_blank', 'width=800,height=600')

    if (!printWindow) {
      toast.error('Please allow popups for printing')
      return
    }

    const styles = `
      <style>
        @page { size: A4; margin: 0; }
        body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
        .print-content {
          width: 210mm;
          min-height: 297mm;
          padding: 30px 40px !important;
          background: white !important;
        }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 3px 6px; border: 1px solid #e0e0e0; text-align: left; }
        th { background-color: #1a1a1a; color: white; }
        tr:nth-child(even) { background-color: #f8fafc; }
      </style>
    `

    const content = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>General Ledger</title>
          ${styles}
        </head>
        <body>
          ${printContent.outerHTML}
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          <\/script>
        </body>
      </html>
    `

    printWindow.document.write(content)
    printWindow.document.close()
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const headers = ['Date', 'Voucher No', 'Account Name', 'Description', 'Debit', 'Credit', 'Balance']
      const rows = entries.map(e => [
        e.date,
        e.voucher_no,
        e.account_name,
        e.description,
        e.debit,
        e.credit,
        e.balance,
      ])

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(v => `"${v ?? ''}"`).join(',')),
      ].join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `general_ledger_${format(new Date(), 'yyyy-MM-dd')}.csv`
      a.click()
      window.URL.revokeObjectURL(url)

      toast.success('Export successful')
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Failed to export')
    } finally {
      setExporting(false)
    }
  }

  const totalDebit = entries.reduce((sum, e) => sum + e.debit, 0)
  const totalCredit = entries.reduce((sum, e) => sum + e.credit, 0)

  // Journal Entries Pagination
  const jeTotalPages = Math.ceil(entries.length / jeItemsPerPage)
  const paginatedEntries = entries.slice(
    (jeCurrentPage - 1) * jeItemsPerPage,
    jeCurrentPage * jeItemsPerPage
  )
  const goToJePage = (page: number) => {
    if (page >= 1 && page <= jeTotalPages) setJeCurrentPage(page)
  }

  // Account Balances Pagination
  const abFiltered = accountBalances.filter(
    a => a.balance > 0 || a.debit > 0 || a.credit > 0
  )
  const abTotalPages = Math.ceil(abFiltered.length / abItemsPerPage)
  const paginatedBalances = abFiltered.slice(
    (abCurrentPage - 1) * abItemsPerPage,
    abCurrentPage * abItemsPerPage
  )
  const goToAbPage = (page: number) => {
    if (page >= 1 && page <= abTotalPages) setAbCurrentPage(page)
  }

  const getAccountName = () => {
    if (selectedAccount === 'all') return 'All Accounts'
    const account = accounts.find(a => a.id === selectedAccount)
    return account ? `${account.code} - ${account.name}` : 'All Accounts'
  }

  return (
    <ResponsiveLayout>
      <div className="space-y-4 p-4 md:p-6">
        {/* Hidden Print Component */}
        <div style={{ display: 'none' }}>
          <PrintComponent
            ref={printRef}
            schoolInfo={schoolInfo}
            entries={entries}
            accountBalances={accountBalances}
            totalDebit={totalDebit}
            totalCredit={totalCredit}
            periodLabel={periodLabel}
            todayLabel={todayLabel}
            accountName={getAccountName()}
          />
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/finance/reports">
              <Button variant="ghost" size="sm" className="print:hidden">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-xl md:text-2xl font-bold font-heading flex items-center gap-2">
                <BarChart3 className="h-5 w-5 md:h-6 md:w-6 text-blue-500" />
                General Ledger
              </h1>
              <p className="text-xs md:text-sm text-muted-foreground">Detailed account transactions</p>
            </div>
          </div>
          <div className="flex gap-2 print:hidden flex-wrap">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-1" />
              Print
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
              <Download className="h-4 w-4 mr-1" />
              {exporting ? 'Exporting...' : 'Export'}
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 print:hidden overflow-x-auto pb-1 scrollbar-hide flex-nowrap">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[120px] h-8 shrink-0 text-xs">
              <Calendar className="h-3 w-3 mr-1" />
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              {periodOptions.map(p => (
                <SelectItem key={p.value} value={p.value} className="text-xs">{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedPeriod === 'custom' && (
            <div className="flex items-center gap-1 shrink-0">
              <input
                type="date"
                value={customDate?.start || ''}
                onChange={e => setCustomDate({ start: e.target.value, end: customDate?.end || '' })}
                className="px-2 py-1 border rounded-md bg-background text-xs w-[110px] dark:bg-gray-800 dark:border-gray-700 dark:text-white"
              />
              <span className="text-muted-foreground text-xs">to</span>
              <input
                type="date"
                value={customDate?.end || ''}
                onChange={e => setCustomDate({ start: customDate?.start || '', end: e.target.value })}
                className="px-2 py-1 border rounded-md bg-background text-xs w-[110px] dark:bg-gray-800 dark:border-gray-700 dark:text-white"
              />
            </div>
          )}

          <Select value={selectedAccount} onValueChange={setSelectedAccount}>
            <SelectTrigger className="w-[180px] h-8 shrink-0 text-xs">
              <SelectValue placeholder="Filter account" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Accounts</SelectItem>
              {accounts.slice(0, 30).map(acc => (
                <SelectItem key={acc.id} value={acc.id} className="text-xs">
                  {acc.code} - {acc.name}
                </SelectItem>
              ))}
              {accounts.length > 30 && (
                <SelectItem value="__more" disabled className="text-xs text-muted-foreground">
                  + {accounts.length - 30} more
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Journal Entries */}
            <Card className="dark:bg-gray-900 dark:border-gray-800">
              <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm md:text-base dark:text-white">Journal Entries</CardTitle>
                  <CardDescription className="text-xs dark:text-gray-400" suppressHydrationWarning>
                    {periodLabel}
                  </CardDescription>
                </div>
                <div className="text-xs text-muted-foreground dark:text-gray-400">
                  {entries.length} entries
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {entries.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground dark:text-gray-400">
                    <BookOpen className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50 dark:text-gray-600" />
                    <p className="text-sm">No journal entries found</p>
                    <p className="text-xs">Try adjusting your filters</p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="dark:border-gray-800">
                            <TableHead className="min-w-[70px] text-xs dark:text-gray-300">Date</TableHead>
                            <TableHead className="min-w-[90px] text-xs dark:text-gray-300">Voucher No</TableHead>
                            <TableHead className="min-w-[120px] text-xs dark:text-gray-300">Account</TableHead>
                            <TableHead className="min-w-[100px] text-xs dark:text-gray-300">Description</TableHead>
                            <TableHead className="text-right min-w-[60px] text-xs dark:text-gray-300">Debit</TableHead>
                            <TableHead className="text-right min-w-[60px] text-xs dark:text-gray-300">Credit</TableHead>
                            <TableHead className="text-right min-w-[70px] text-xs dark:text-gray-300">Balance</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedEntries.map((entry, i) => (
                            <TableRow
                              key={entry.id || i}
                              className={cn(
                                i % 2 === 0 ? "bg-muted/20 dark:bg-gray-800/30" : "",
                                "dark:border-gray-800"
                              )}
                            >
                              <TableCell className="text-xs dark:text-gray-300">
                                {format(new Date(entry.date), 'dd MMM yyyy')}
                              </TableCell>
                              <TableCell className="font-mono text-xs dark:text-gray-300">
                                {entry.voucher_no}
                              </TableCell>
                              <TableCell className="text-xs dark:text-gray-300 truncate max-w-[140px]" title={entry.account_name}>
                                {entry.account_name}
                              </TableCell>
                              <TableCell className="text-xs dark:text-gray-300 truncate max-w-[100px]" title={entry.description}>
                                {entry.description || '-'}
                              </TableCell>
                              <TableCell className={cn(
                                "text-right font-mono text-xs",
                                entry.debit > 0 ? "text-emerald-500 dark:text-emerald-400" : "dark:text-gray-400"
                              )}>
                                {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                              </TableCell>
                              <TableCell className={cn(
                                "text-right font-mono text-xs",
                                entry.credit > 0 ? "text-rose-500 dark:text-rose-400" : "dark:text-gray-400"
                              )}>
                                {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs font-bold dark:text-white">
                                {formatCurrency(entry.balance)}
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="font-bold border-t-2 dark:border-gray-700 bg-muted/50 dark:bg-gray-800/50">
                            <TableCell colSpan={4} className="text-xs dark:text-white">TOTAL</TableCell>
                            <TableCell className="text-right text-emerald-500 dark:text-emerald-400 text-xs">
                              {formatCurrency(totalDebit)}
                            </TableCell>
                            <TableCell className="text-right text-rose-500 dark:text-rose-400 text-xs">
                              {formatCurrency(totalCredit)}
                            </TableCell>
                            <TableCell className="text-right text-emerald-500 dark:text-emerald-400 text-xs">
                              {formatCurrency(totalDebit - totalCredit)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>

                    {jeTotalPages > 1 && (
                      <div className="flex items-center justify-between px-4 py-2 border-t dark:border-gray-800">
                        <div className="text-xs text-muted-foreground dark:text-gray-400">
                          {entries.length} entries
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => goToJePage(jeCurrentPage - 1)}
                            disabled={jeCurrentPage === 1}
                            className="h-7 px-2 text-xs dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                          >
                            <ChevronLeft className="h-3 w-3" />
                          </Button>
                          <span className="text-xs text-muted-foreground dark:text-gray-400 px-2">
                            {jeCurrentPage} / {jeTotalPages}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => goToJePage(jeCurrentPage + 1)}
                            disabled={jeCurrentPage === jeTotalPages}
                            className="h-7 px-2 text-xs dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                          >
                            <ChevronRight className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Account Balances */}
            <Card className="dark:bg-gray-900 dark:border-gray-800">
              <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm md:text-base dark:text-white">Account Balances</CardTitle>
                  <CardDescription className="text-xs dark:text-gray-400">
                    Summary of all account balances
                  </CardDescription>
                </div>
                <div className="text-xs text-muted-foreground dark:text-gray-400">
                  {abFiltered.length} accounts
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="dark:border-gray-800">
                        <TableHead className="text-xs dark:text-gray-300">Account</TableHead>
                        <TableHead className="text-right text-xs dark:text-gray-300">Debit</TableHead>
                        <TableHead className="text-right text-xs dark:text-gray-300">Credit</TableHead>
                        <TableHead className="text-right text-xs dark:text-gray-300">Balance</TableHead>
                        <TableHead className="text-xs dark:text-gray-300">Type</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedBalances.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-6 text-muted-foreground dark:text-gray-400 text-sm">
                            No account balances found
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedBalances.map((acc, i) => (
                          <TableRow
                            key={acc.account_id}
                            className={cn(
                              i % 2 === 0 ? "bg-muted/20 dark:bg-gray-800/30" : "",
                              "dark:border-gray-800"
                            )}
                          >
                            <TableCell className="text-xs dark:text-gray-300 truncate max-w-[180px]" title={acc.name}>
                              <span className="font-mono text-muted-foreground mr-2">{acc.code}</span>
                              {acc.name}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs text-emerald-500 dark:text-emerald-400">
                              {formatCurrency(acc.debit)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs text-rose-500 dark:text-rose-400">
                              {formatCurrency(acc.credit)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs font-bold dark:text-white">
                              {formatCurrency(acc.balance)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={acc.balance_type === 'debit' ? 'default' : 'secondary'}
                                className={cn(
                                  "text-[10px] px-2 py-0",
                                  acc.balance_type === 'debit'
                                    ? "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
                                    : "bg-rose-500/15 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400"
                                )}
                              >
                                {acc.balance_type}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {abTotalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-2 border-t dark:border-gray-800">
                    <div className="text-xs text-muted-foreground dark:text-gray-400">
                      {abFiltered.length} accounts
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => goToAbPage(abCurrentPage - 1)}
                        disabled={abCurrentPage === 1}
                        className="h-7 px-2 text-xs dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                      >
                        <ChevronLeft className="h-3 w-3" />
                      </Button>
                      <span className="text-xs text-muted-foreground dark:text-gray-400 px-2">
                        {abCurrentPage} / {abTotalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => goToAbPage(abCurrentPage + 1)}
                        disabled={abCurrentPage === abTotalPages}
                        className="h-7 px-2 text-xs dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                      >
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </ResponsiveLayout>
  )
}