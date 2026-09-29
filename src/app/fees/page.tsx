"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { 
  Wallet, AlertCircle, Users, 
  Bookmark, FolderTree, UserPlus, Receipt,
  DollarSign, Bell, Gift, FileBarChart,
  Download, RefreshCw,
  CheckCircle, Clock, Receipt as ReceiptIcon,
  Landmark, Smartphone, Zap, Sparkles,
  CircleDollarSign, PiggyBank, Target, BadgeDollarSign,
  ArrowUpRight
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ResponsiveLayout } from "@/components/layout/responsive-layout"
import { formatCurrency } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { getFeeStats as getFeeStatsFromApi } from "@/lib/api/fees"

const supabase = createClient()

// ============================================
// StatCard Component - Safe number handling
// ============================================
const StatCard = ({ title, value, icon: Icon, gradient, iconBg }: any) => {
  // Safe number extraction
  let numericValue = 0
  if (typeof value === 'number') {
    numericValue = value
  } else if (typeof value === 'string') {
    numericValue = parseFloat(value.replace(/[^0-9.-]/g, '')) || 0
  }
  
  const progressWidth = Math.min(100, (numericValue / 100000) * 100)
  
  return (
    <Card className="group relative overflow-hidden border-none shadow-md hover:shadow-lg transition-all duration-300">
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-5 group-hover:opacity-10 transition-opacity duration-300`} />
      <CardContent className="p-3 relative z-10">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className="text-xl font-bold tracking-tight">
              {typeof value === 'number' ? formatCurrency(value) : value}
            </p>
          </div>
          <div className={`p-2 rounded-xl ${iconBg} group-hover:scale-105 transition-transform duration-300 shadow-md`}>
            <Icon className="h-4 w-4 text-white" />
          </div>
        </div>
        <div className="mt-2 h-1 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
          <div 
            className="h-full rounded-full transition-all duration-1000 ease-out bg-gradient-to-r from-indigo-500 to-purple-500"
            style={{ width: `${progressWidth}%` }}
          />
        </div>
      </CardContent>
    </Card>
  )
}

// Compact Quick Action Card
const QuickActionCard = ({ title, href, icon: Icon, iconBg, description }: any) => (
  <Link href={href}>
    <Card className="group cursor-pointer hover:shadow-md transition-all duration-200 border-none overflow-hidden relative">
      <CardContent className="p-2.5 relative z-10">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${iconBg} group-hover:scale-105 transition-transform duration-200 shadow-sm`}>
            <Icon className="h-3.5 w-3.5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-sm">{title}</h3>
            <p className="text-[10px] text-muted-foreground">{description}</p>
          </div>
          <ArrowUpRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all duration-200" />
        </div>
      </CardContent>
    </Card>
  </Link>
)

// Compact Transaction Row
const TransactionRow = ({ tx }: any) => {
  const amount = Number(tx.amount) || 0
  const paid = Number(tx.paid_amount) || 0
  const dueAmount = amount - paid
  const status = dueAmount <= 0 ? 'paid' : (paid > 0 ? 'partial' : 'pending')
  
  return (
    <div className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-lg transition-all duration-200">
      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded-md ${
          status === 'paid' ? 'bg-emerald-100 dark:bg-emerald-900/30' :
          status === 'partial' ? 'bg-amber-100 dark:bg-amber-900/30' :
          'bg-rose-100 dark:bg-rose-900/30'
        }`}>
          {tx.payment_method === 'cash' && <Landmark className="h-3 w-3 text-emerald-600" />}
          {tx.payment_method === 'bank' && <Landmark className="h-3 w-3 text-blue-600" />}
          {tx.payment_method === 'mobile_banking' && <Smartphone className="h-3 w-3 text-purple-600" />}
          {!tx.payment_method && <ReceiptIcon className="h-3 w-3 text-muted-foreground" />}
        </div>
        <div>
          <p className="font-medium text-xs">{tx.student?.name || tx.student_name || 'Unknown'}</p>
          <p className="text-[10px] text-muted-foreground">{tx.receipt_no || 'No receipt'}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-semibold text-xs text-emerald-600 dark:text-emerald-400">
          {formatCurrency(paid)}
        </p>
        <p className={`text-[10px] capitalize ${
          status === 'paid' ? 'text-emerald-600' :
          status === 'partial' ? 'text-amber-600' :
          'text-rose-600'
        }`}>{status}</p>
      </div>
    </div>
  )
}

const menuItems = [
  { title: "Fee Categories", href: "/fees/categories", icon: Bookmark, iconBg: "bg-gradient-to-br from-blue-500 to-cyan-500", description: "Manage fee types" },
  { title: "Fee Structure", href: "/fees/structure", icon: FolderTree, iconBg: "bg-gradient-to-br from-emerald-500 to-teal-500", description: "Setup class-wise fees" },
  { title: "Fee Assign", href: "/fees/assign", icon: UserPlus, iconBg: "bg-gradient-to-br from-purple-500 to-pink-500", description: "Assign to students" },
  { title: "Receive Fees", href: "/fees/receive", icon: Receipt, iconBg: "bg-gradient-to-br from-green-500 to-lime-500", description: "Collect payments" },
  { title: "Fees Ledger", href: "/fees/ledger", icon: DollarSign, iconBg: "bg-gradient-to-br from-amber-500 to-orange-500", description: "View transactions" },
  { title: "Due List", href: "/fees/due", icon: Bell, iconBg: "bg-gradient-to-br from-rose-500 to-red-500", description: "Track pending" },
  { title: "Discounts", href: "/fees/discounts", icon: Gift, iconBg: "bg-gradient-to-br from-pink-500 to-rose-500", description: "Manage waivers" },
  { title: "Reports", href: "/fees/reports", icon: FileBarChart, iconBg: "bg-gradient-to-br from-indigo-500 to-purple-500", description: "View reports" },
]

// ============================================
// ✅ getFeeStats - Uses v_due_summary with Fallback
// ============================================

async function getFeeStats() {
  try {
    console.log('📊 Fetching fee stats...')

    let totalNetDue = 0
    let totalGrossDue = 0
    let dueStudentsCount = 0
    let criticalCount = 0
    let warningCount = 0
    let totalAdvance = 0
    let fallbackUsed = false

    // ============================================
    // 1. GET DUE DATA - TRY v_due_summary FIRST
    // ============================================
    try {
      const { data: dueData, error: dueError } = await supabase
        .from('v_due_summary')
        .select('total_due, net_due, total_advance, student_id')
        .gt('total_due', 0)

      if (dueError) {
        console.warn('⚠️ v_due_summary error, using fallback:', dueError.message)
        fallbackUsed = true
        
        // ✅ FALLBACK: Direct query from student_fee_dues
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('student_fee_dues')
          .select('student_id, due_amount')
          .gt('due_amount', 0)

        if (fallbackError) {
          console.error('❌ Fallback query also failed:', fallbackError)
        } else if (fallbackData && fallbackData.length > 0) {
          // Group by student_id
          const studentMap = new Map()
          fallbackData.forEach((item: any) => {
            const existing = studentMap.get(item.student_id) || 0
            studentMap.set(item.student_id, existing + (item.due_amount || 0))
          })
          
          const dueValues = Array.from(studentMap.values())
          totalNetDue = dueValues.reduce((sum, val) => sum + val, 0)
          totalGrossDue = totalNetDue
          dueStudentsCount = studentMap.size
          
          criticalCount = dueValues.filter((val: number) => val >= 800).length
          warningCount = dueValues.filter((val: number) => val >= 200 && val < 800).length
          
          console.log('✅ Fallback due data:', { totalNetDue, dueStudentsCount })
        }
      } else if (dueData && dueData.length > 0) {
        // Gross due (before advance adjustment)
        totalGrossDue = dueData.reduce((sum, item) => sum + (item.total_due || 0), 0)
        // Net due (after advance adjustment) - This is what students actually owe
        totalNetDue = dueData.reduce((sum, item) => sum + (item.net_due || 0), 0)
        dueStudentsCount = dueData.length
        totalAdvance = dueData.reduce((sum, item) => sum + (item.total_advance || 0), 0)
        
        // Critical: net_due >= 800
        criticalCount = dueData.filter((s: any) => (s.net_due || 0) >= 800).length
        // Warning: net_due 200-800
        warningCount = dueData.filter((s: any) => (s.net_due || 0) >= 200 && (s.net_due || 0) < 800).length
        
        console.log('✅ Due data from v_due_summary:', { 
          totalGrossDue, 
          totalNetDue, 
          dueStudentsCount,
          totalAdvance,
          criticalCount,
          warningCount
        })
      } else {
        console.log('ℹ️ No due data found')
      }
    } catch (dueError) {
      console.error('❌ Error fetching due data:', dueError)
    }

    // ============================================
    // 2. GET MONTHLY COLLECTION (Last 30 days)
    // ============================================
    let monthCollection = 0
    try {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const startDate = thirtyDaysAgo.toISOString().split('T')[0]

      const { data: recentPayments, error: paymentsError } = await supabase
        .from('fee_payments')
        .select('amount')
        .gte('payment_date', startDate)

      if (paymentsError) {
        console.error('❌ Monthly payments error:', paymentsError)
      } else if (recentPayments) {
        monthCollection = recentPayments.reduce((sum, p: any) => {
          const amount = typeof p.amount === 'number' ? p.amount : parseFloat(p.amount) || 0
          return sum + amount
        }, 0)
        console.log('📊 Monthly collection:', monthCollection)
      }
    } catch (monthError) {
      console.error('❌ Error fetching monthly payments:', monthError)
    }

    // ============================================
    // 3. GET TOTAL COLLECTION
    // ============================================
    let totalCollection = 0
    try {
      const { data: allPayments, error: allPaymentsError } = await supabase
        .from('fee_payments')
        .select('amount')

      if (allPaymentsError) {
        console.error('❌ Total payments error:', allPaymentsError)
      } else if (allPayments) {
        totalCollection = allPayments.reduce((sum, p: any) => {
          const amount = typeof p.amount === 'number' ? p.amount : parseFloat(p.amount) || 0
          return sum + amount
        }, 0)
        console.log('📊 Total collection:', totalCollection)
      }
    } catch (totalError) {
      console.error('❌ Error fetching total payments:', totalError)
    }

    // ============================================
    // 4. GET CATEGORIES COUNT
    // ============================================
    let totalCategories = 0
    try {
      const { count, error: catError } = await supabase
        .from('fee_categories')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
      
      if (catError) {
        console.error('❌ Categories count error:', catError)
      } else {
        totalCategories = count || 0
        console.log('📊 Total categories:', totalCategories)
      }
    } catch (catError) {
      console.error('❌ Error fetching categories:', catError)
    }

    // ============================================
    // 5. GET STRUCTURES COUNT
    // ============================================
    let totalStructures = 0
    try {
      const { count, error: structError } = await supabase
        .from('fee_structures')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
      
      if (structError) {
        console.error('❌ Structures count error:', structError)
      } else {
        totalStructures = count || 0
        console.log('📊 Total structures:', totalStructures)
      }
    } catch (structError) {
      console.error('❌ Error fetching structures:', structError)
    }

    // ============================================
    // 6. RETURN RESULT WITH SAFE DEFAULTS
    // ============================================
    const result = {
      monthCollection: monthCollection || 0,
      totalCollection: totalCollection || 0,
      // ✅ Use net_due for Pending Dues (after advance adjustment)
      totalDue: totalNetDue || 0,
      // ✅ Keep gross due for reference
      totalGrossDue: totalGrossDue || 0,
      dueStudentsCount: dueStudentsCount || 0,
      totalCategories: totalCategories || 0,
      totalStructures: totalStructures || 0,
      criticalCount: criticalCount || 0,
      warningCount: warningCount || 0,
      totalAdvance: totalAdvance || 0,
      fallbackUsed: fallbackUsed,
    }

    console.log('✅ Final stats result:', result)
    return result

    } catch (error) {
      console.error('❌ Unexpected error in getFeeStats:', error)
      // ✅ Fallback: Use API service getFeeStats (v_fee_dashboard_stats)
      try {
        const apiStats = await getFeeStatsFromApi()
        return {
          monthCollection: 0,
          totalCollection: 0,
          totalDue: apiStats.totalDue || 0,
          totalGrossDue: apiStats.totalDue || 0,
          dueStudentsCount: apiStats.count || 0,
          totalCategories: 0,
          totalStructures: 0,
          criticalCount: 0,
          warningCount: 0,
          totalAdvance: 0,
          fallbackUsed: true
        }
      } catch (apiError) {
        console.error('❌ API fallback also failed:', apiError)
        return {
      monthCollection: 0,
      totalCollection: 0,
      totalDue: 0,
      totalGrossDue: 0,
      dueStudentsCount: 0,
      totalCategories: 0,
      totalStructures: 0,
      criticalCount: 0,
      warningCount: 0,
      totalAdvance: 0,
      fallbackUsed: false,
      }
    }
  }
}



async function getRecentTransactions(limit: number = 5) {
  try {
    console.log('📊 Fetching recent transactions...')

    const { data: payments, error } = await supabase
      .from('fee_payments')
      .select(`
        id,
        amount,
        receipt_no,
        payment_method,
        payment_date,
        student_id,
        students!fee_payments_student_id_fkey (name)
      `)
      .order('payment_date', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('❌ Payments fetch error:', error)
      return []
    }

    console.log('📊 Recent payments found:', payments?.length || 0)

    return (payments || []).map((p: any) => {
      let studentName = 'Unknown'
      if (p.students) {
        if (Array.isArray(p.students) && p.students.length > 0) {
          studentName = p.students[0]?.name || 'Unknown'
        } else if (typeof p.students === 'object' && p.students !== null) {
          studentName = p.students.name || 'Unknown'
        }
      }

      return {
        id: p.id,
        amount: p.amount || 0,
        paid_amount: p.amount || 0,
        receipt_no: p.receipt_no || `RCP-${p.id?.slice(0, 8) || 'unknown'}`,
        payment_method: p.payment_method || 'cash',
        created_at: p.payment_date,
        student_id: p.student_id,
        student_name: studentName,
        due_amount: 0,
      }
    })

  } catch (error) {
    console.error('❌ Error in getRecentTransactions:', error)
    return []
  }
}

export default function FeesDashboardPage() {
  const queryClient = useQueryClient()
  
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['fee-stats'],
    queryFn: getFeeStats,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 2,
  })
  
  const { data: recentTransactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ['recent-transactions'],
    queryFn: () => getRecentTransactions(5),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 2,
  })
  
  useEffect(() => {
    const channel = supabase
      .channel('fee-payments-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'fee_payments' }, 
        () => {
          queryClient.refetchQueries({ queryKey: ['fee-stats'] })
          queryClient.refetchQueries({ queryKey: ['recent-transactions'] })
        }
      )
      .subscribe()
    
    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])

  const statsData = stats || {
    monthCollection: 0,
    totalCollection: 0,
    totalDue: 0,
    totalGrossDue: 0,
    dueStudentsCount: 0,
    totalCategories: 0,
    totalStructures: 0,
    criticalCount: 0,
    warningCount: 0,
    totalAdvance: 0,
    fallbackUsed: false,
  }
  
  const targetAmount = 100000
  const collectionRate = statsData.monthCollection > 0 ? (statsData.monthCollection / targetAmount) * 100 : 0
  const overallRate = statsData.totalCollection + statsData.totalDue > 0 
    ? (statsData.totalCollection / (statsData.totalCollection + statsData.totalDue)) * 100 
    : 0

  const isLoading = statsLoading || transactionsLoading

  // Show fallback warning if needed
  useEffect(() => {
    if (statsData.fallbackUsed) {
      console.warn('⚠️ Fees Dashboard using fallback data (v_due_summary not available)')
    }
  }, [statsData.fallbackUsed])

  return (
    <ResponsiveLayout>
      <div className="space-y-4 p-4 bg-gradient-to-br from-slate-50 via-white to-indigo-50/20 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/20">
        
        {/* Compact Header Section */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-3 shadow-md">
          <div className="absolute top-0 right-0 -mt-6 -mr-6 w-24 h-24 rounded-full bg-white/20 blur-2xl" />
          <div className="absolute bottom-0 left-0 -mb-6 -ml-6 w-24 h-24 rounded-full bg-yellow-400/20 blur-2xl" />
          
          <div className="relative z-10">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-lg bg-white/20 backdrop-blur">
                  <Wallet className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h1 className="text-base font-semibold text-white">Fees Management</h1>
                  <p className="text-white/70 text-[10px]">Track collections, manage dues, and generate reports</p>
                </div>
              </div>
              <div className="flex gap-1.5">
                <Button 
                  variant="secondary" 
                  size="sm" 
                  onClick={() => {
                    queryClient.refetchQueries({ queryKey: ['fee-stats'] })
                    queryClient.refetchQueries({ queryKey: ['recent-transactions'] })
                    toast.success('Dashboard refreshed successfully')
                  }} 
                  className="bg-white/20 backdrop-blur text-white hover:bg-white/30 border-0 h-7 px-2 text-xs"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Refresh
                </Button>
                <Button size="sm" className="bg-white text-indigo-600 hover:bg-white/90 shadow-md h-7 px-2 text-xs">
                  <Download className="h-3 w-3 mr-1" />
                  Export
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-3">
              <div className="relative w-10 h-10 mx-auto">
                <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
                <div className="absolute inset-0 rounded-full border-t-2 border-primary animate-spin" />
              </div>
              <p className="text-sm text-muted-foreground animate-pulse">Loading dashboard...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Compact Stats Grid - 4 Cards */}
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
              <StatCard 
                title="This Month" 
                value={statsData.monthCollection} 
                icon={CircleDollarSign}
                gradient="from-emerald-500 to-teal-500"
                iconBg="bg-gradient-to-br from-emerald-500 to-teal-500"
              />
              <StatCard 
                title="Total Collected" 
                value={statsData.totalCollection} 
                icon={PiggyBank}
                gradient="from-blue-500 to-cyan-500"
                iconBg="bg-gradient-to-br from-blue-500 to-cyan-500"
              />
              <StatCard 
                title="Pending Dues" 
                value={statsData.totalDue} 
                icon={AlertCircle}
                gradient="from-rose-500 to-red-500"
                iconBg="bg-gradient-to-br from-rose-500 to-red-500"
              />
              <StatCard 
                title="Due Students" 
                value={statsData.dueStudentsCount} 
                icon={Users}
                gradient="from-orange-500 to-amber-500"
                iconBg="bg-gradient-to-br from-orange-500 to-amber-500"
              />
            </div>

            {/* Progress Section */}
            <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
              <Card className="md:col-span-2 overflow-hidden border-0 shadow-sm bg-gradient-to-br from-white to-indigo-50/30 dark:from-slate-900 dark:to-indigo-950/10">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Target className="h-3.5 w-3.5 text-indigo-500" />
                      <p className="text-xs font-medium text-muted-foreground">Monthly Progress</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Target: {formatCurrency(100000)}</p>
                    </div>
                  </div>
                  <div className="flex items-baseline justify-between mb-1">
                    <p className="text-sm font-bold">{formatCurrency(statsData.monthCollection)}</p>
                    <p className="text-xs font-semibold text-indigo-600">{collectionRate.toFixed(0)}%</p>
                  </div>
                  <div className="relative h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="absolute left-0 top-0 h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full transition-all duration-1000"
                      style={{ width: `${Math.min(100, collectionRate)}%` }}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-amber-50/20 dark:from-slate-900 dark:to-amber-950/10">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 shadow-sm">
                        <BadgeDollarSign className="h-3.5 w-3.5 text-white" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Overall Collection</p>
                        <p className="text-base font-bold">{overallRate.toFixed(0)}%</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground">Collected</p>
                      <p className="text-xs font-semibold">{formatCurrency(statsData.totalCollection)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions Grid */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Zap className="h-3 w-3" />
                  Quick Actions
                </h2>
                <Link href="/fees/receive" className="text-[10px] text-indigo-600 hover:text-indigo-700">View All →</Link>
              </div>
              <div className="grid gap-2 grid-cols-2 sm:grid-cols-4 lg:grid-cols-8">
                {menuItems.map((item) => (
                  <QuickActionCard key={item.title} {...item} />
                ))}
              </div>
            </div>

            {/* Recent Transactions & Due Summary */}
            <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
              <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-blue-50/20 dark:from-slate-900 dark:to-blue-950/10">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-xs font-semibold flex items-center gap-1.5">
                      <div className="p-0.5 rounded bg-gradient-to-r from-blue-500 to-cyan-500">
                        <Clock className="h-2.5 w-2.5 text-white" />
                      </div>
                      Recent Transactions
                    </h2>
                    <Link href="/fees/ledger" className="text-[10px] text-indigo-600 hover:text-indigo-700">View All →</Link>
                  </div>
                  <div className="space-y-1 max-h-[200px] overflow-y-auto">
                    {!recentTransactions || recentTransactions.length === 0 ? (
                      <div className="text-center py-4 text-xs text-muted-foreground">No recent transactions</div>
                    ) : (
                      recentTransactions.map((tx: any, idx: number) => (
                        <TransactionRow key={idx} tx={tx} />
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-rose-50/20 dark:from-slate-900 dark:to-rose-950/10">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-xs font-semibold flex items-center gap-1.5">
                      <div className="p-0.5 rounded bg-gradient-to-r from-rose-500 to-red-500">
                        <AlertCircle className="h-2.5 w-2.5 text-white" />
                      </div>
                      Due Summary
                    </h2>
                    <Link href="/fees/due" className="text-[10px] text-indigo-600 hover:text-indigo-700">View All →</Link>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2 bg-gradient-to-r from-rose-50 to-red-50 dark:from-rose-950/10 dark:to-red-950/10 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="p-1 rounded-md bg-rose-100 dark:bg-rose-900/30">
                          <AlertCircle className="h-3 w-3 text-rose-600" />
                        </div>
                        <div>
                          <p className="text-xs font-medium">Critical Due</p>
                          <p className="text-[10px] text-muted-foreground">50%+ pending</p>
                        </div>
                      </div>
                      <p className="text-sm font-bold text-rose-600">
                        {statsData.criticalCount || 0}
                      </p>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/10 dark:to-yellow-950/10 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="p-1 rounded-md bg-amber-100 dark:bg-amber-900/30">
                          <Clock className="h-3 w-3 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-xs font-medium">Warning Due</p>
                          <p className="text-[10px] text-muted-foreground">20-50% pending</p>
                        </div>
                      </div>
                      <p className="text-sm font-bold text-amber-600">
                        {statsData.warningCount || 0}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-border">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Total Due Students</span>
                      <span className="font-bold text-sm text-rose-600">{statsData.dueStudentsCount}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </ResponsiveLayout>
  )
}