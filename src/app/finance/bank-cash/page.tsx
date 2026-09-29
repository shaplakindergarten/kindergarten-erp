"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { 
  ArrowLeft,
  Download,
  Plus,
  Search,
  Loader2,
  Banknote,
  CreditCard,
  Smartphone,
  CheckCircle2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"  // ✅ শুধু একবার
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
// ✅ লাইন 10 থেকে duplicate Input সরানো হয়েছে
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"  // ✅ Select যোগ করা হয়েছে
import { cn } from "@/lib/utils"
import { ResponsiveLayout } from "@/components/layout/responsive-layout"
import { formatCurrency } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

const supabase = createClient()

type FinancialAccountType = 'cash' | 'bank' | 'mobile_bank'

interface FinancialAccount {
  id: string
  account_name: string
  account_number: string
  type: FinancialAccountType
  bank_name: string | null
  branch_name: string | null
  current_balance: number
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export default function BankCashPage() {
  const [accounts, setAccounts] = useState<FinancialAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [openDialog, setOpenDialog] = useState(false)
  const [editingAccount, setEditingAccount] = useState<FinancialAccount | null>(null)
  const [formData, setFormData] = useState({
    account_name: '',
    account_number: '',
    type: 'cash' as FinancialAccountType,
    bank_name: '',
    branch_name: '',
    current_balance: 0,
    is_active: true,
  })

  useEffect(() => {
    loadAccounts()
  }, [])

  useEffect(() => {
    if (searchQuery) {
      setAccounts(prev => prev.filter(a => 
        a.account_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.account_number.toLowerCase().includes(searchQuery.toLowerCase())
      ))
    } else {
      loadAccounts()
    }
  }, [searchQuery])

  const loadAccounts = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('financial_accounts')
        .select('*')
        .order('type')
        .order('account_name')
      
      if (error) throw error
      setAccounts(data || [])
    } catch (error) {
      console.error('Error loading accounts:', error)
      toast.error('Failed to load accounts')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenDialog = (account?: FinancialAccount) => {
    if (account) {
      setEditingAccount(account)
      setFormData({
        account_name: account.account_name,
        account_number: account.account_number,
        type: account.type,
        bank_name: account.bank_name || '',
        branch_name: account.branch_name || '',
        current_balance: account.current_balance,
        is_active: account.is_active,
      })
    } else {
      setEditingAccount(null)
      setFormData({
        account_name: '',
        account_number: '',
        type: 'cash',
        bank_name: '',
        branch_name: '',
        current_balance: 0,
        is_active: true,
      })
    }
    setOpenDialog(true)
  }

  const handleCloseDialog = () => {
    setOpenDialog(false)
    setEditingAccount(null)
    setFormData({
      account_name: '',
      account_number: '',
      type: 'cash',
      bank_name: '',
      branch_name: '',
      current_balance: 0,
      is_active: true,
    })
  }

  const handleSubmit = async () => {
    try {
      if (editingAccount) {
        const { error } = await supabase
          .from('financial_accounts')
          .update({
            account_name: formData.account_name,
            account_number: formData.account_number,
            type: formData.type,
            bank_name: formData.bank_name || null,
            branch_name: formData.branch_name || null,
            current_balance: formData.current_balance,
            is_active: formData.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingAccount.id)
        
        if (error) throw error
        toast.success('Account updated successfully')
      } else {
        const { error } = await supabase
          .from('financial_accounts')
          .insert([{
            account_name: formData.account_name,
            account_number: formData.account_number,
            type: formData.type,
            bank_name: formData.bank_name || null,
            branch_name: formData.branch_name || null,
            current_balance: formData.current_balance,
            is_active: formData.is_active,
          }])
        
        if (error) throw error
        toast.success('Account created successfully')
      }
      
      loadAccounts()
      handleCloseDialog()
    } catch (error) {
      console.error('Error saving account:', error)
      toast.error('Failed to save account')
    }
  }

  const cashAccounts = accounts.filter(a => a.type === 'cash')
  const bankAccounts = accounts.filter(a => a.type === 'bank')
  const mobileAccounts = accounts.filter(a => a.type === 'mobile_bank')

  const totalCash = cashAccounts.reduce((sum, a) => sum + (a.current_balance || 0), 0)
  const totalBank = bankAccounts.reduce((sum, a) => sum + (a.current_balance || 0), 0)
  const totalMobile = mobileAccounts.reduce((sum, a) => sum + (a.current_balance || 0), 0)
  const totalBalance = totalCash + totalBank + totalMobile

  return (
    <ResponsiveLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/finance">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold font-heading">Bank & Cash Accounts</h1>
              <p className="text-muted-foreground">Manage cash, bank, and mobile banking accounts</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button size="sm" onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Account
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Banknote className="h-5 w-5 text-amber-500" />
                Cash
              </CardTitle>
              <CardDescription>Physical cash on hand</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{formatCurrency(totalCash)}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {cashAccounts.length} account{cashAccounts.length !== 1 ? 's' : ''}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-blue-500" />
                Bank
              </CardTitle>
              <CardDescription>Bank accounts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{formatCurrency(totalBank)}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {bankAccounts.length} account{bankAccounts.length !== 1 ? 's' : ''}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-violet-500" />
                Mobile Banking
              </CardTitle>
              <CardDescription>e-money wallets</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-violet-600">{formatCurrency(totalMobile)}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {mobileAccounts.length} account{mobileAccounts.length !== 1 ? 's' : ''}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Accounts</CardTitle>
            <CardDescription>{accounts.length} total accounts</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-2">
                {accounts.map((account) => (
                  <div key={account.id} className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/30 transition-colors">
                    <div>
                      <div className="font-medium">{account.account_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {account.account_number}
                        {account.type === 'bank' && account.bank_name && ` • ${account.branch_name || account.bank_name}`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatCurrency(account.current_balance)}</div>
                      <Badge variant="outline" className="text-xs">
                        {account.type}
                      </Badge>
                    </div>
                  </div>
                ))}
                {accounts.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Banknote className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No accounts found</p>
                    <Button variant="outline" className="mt-4" onClick={() => handleOpenDialog()}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create First Account
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingAccount ? 'Edit Account' : 'New Financial Account'}</DialogTitle>
              <DialogDescription>
                {editingAccount ? 'Update account details' : 'Create a new cash or bank account'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="account_name">Account Name</Label>
                <Input
                  id="account_name"
                  value={formData.account_name}
                  onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                  placeholder="e.g., Cash, Main Bank Account"
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="account_number">Account Number</Label>
                <Input
                  id="account_number"
                  value={formData.account_number}
                  onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                  placeholder="e.g., 12345678"
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="type">Account Type</Label>
                <Select 
                  value={formData.type} 
                  onValueChange={(v) => setFormData({ ...formData, type: v as FinancialAccountType })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank">Bank</SelectItem>
                    <SelectItem value="mobile_bank">Mobile Banking</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.type === 'bank' && (
                <>
                  <div>
                    <Label htmlFor="bank_name">Bank Name</Label>
                    <Input
                      id="bank_name"
                      value={formData.bank_name}
                      onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                      placeholder="e.g., Dhaka Bank"
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="branch_name">Branch Name</Label>
                    <Input
                      id="branch_name"
                      value={formData.branch_name}
                      onChange={(e) => setFormData({ ...formData, branch_name: e.target.value })}
                      placeholder="e.g., Gulshan Branch"
                      className="mt-2"
                    />
                  </div>
                </>
              )}
              <div>
                <Label htmlFor="current_balance">Current Balance</Label>
                <Input
                  id="current_balance"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.current_balance}
                  onChange={(e) => setFormData({ ...formData, current_balance: Number(e.target.value) || 0 })}
                  className="mt-2"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button onClick={handleSubmit}>
                {editingAccount ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ResponsiveLayout>
  )
}
