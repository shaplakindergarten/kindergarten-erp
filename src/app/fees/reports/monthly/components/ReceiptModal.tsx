// H:\kindergarten-erp\src\app\fees\reports\monthly\components\ReceiptModal.tsx

"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Printer, CheckCircle, Clock, XCircle, Landmark, Smartphone, Building2 } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { MonthlyTransactionDetail } from "../types"
import { createClient } from "@/lib/supabase/client"

const supabase = createClient()

interface SchoolSettings {
  school_name: string
  school_address: string
  school_phone: string
  school_email: string
  school_logo?: string | null
}

interface ReceiptModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction: MonthlyTransactionDetail | null
  onPrint: (tx: MonthlyTransactionDetail) => void
}

const getStatusBadge = (status: string, dueAmount: number) => {
  if (status === 'paid' || dueAmount === 0) {
    return { label: "Fully Paid", icon: CheckCircle, color: "bg-emerald-500" }
  }
  if (status === 'partial' || (dueAmount > 0 && dueAmount < 100)) {
    return { label: "Partial Payment", icon: Clock, color: "bg-amber-500" }
  }
  return { label: "Pending", icon: XCircle, color: "bg-red-500" }
}

const getPaymentMethodIcon = (method: string) => {
  const methods: Record<string, { icon: any, label: string }> = {
    cash: { icon: Landmark, label: "Cash" },
    bkash: { icon: Smartphone, label: "bKash" },
    nagad: { icon: Smartphone, label: "Nagad" },
    bank: { icon: Building2, label: "Bank" },
  }
  return methods[method] || { icon: Landmark, label: method || "Cash" }
}

export function ReceiptModal({ open, onOpenChange, transaction, onPrint }: ReceiptModalProps) {
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings | null>(null)

  useEffect(() => {
    if (open) {
      supabase.from("school_settings").select("school_name, school_address, school_phone, school_email, school_logo").maybeSingle().then(({ data }) => {
        if (data) setSchoolSettings(data)
      })
    }
  }, [open])

  if (!transaction) return null

  const status = getStatusBadge(transaction.status, transaction.due_amount)
  const StatusIcon = status.icon
  const PaymentIcon = getPaymentMethodIcon(transaction.payment_method).icon
  const isAdvance = transaction.transaction_type === 'advance'
  const isPaid = transaction.status === 'paid' || transaction.due_amount === 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Payment Receipt</span>
            <Button size="sm" variant="outline" onClick={() => onPrint(transaction)}>
              <Printer className="h-4 w-4 mr-2" />
              Print / Save PDF
            </Button>
          </DialogTitle>
        </DialogHeader>

<div className="space-y-6 p-4 border rounded-lg">
           {/* School Header */}
           <div className="text-center border-b pb-4">
             <h2 className="text-2xl font-bold text-indigo-800">{schoolSettings?.school_name || "School Name"}</h2>
             <p className="text-sm text-muted-foreground">{schoolSettings?.school_address || "School Address"}</p>
             <p className="text-xs text-muted-foreground">Payment Receipt</p>
           </div>

           {/* Student Info */}
           <div className="space-y-3">
             <div className="flex items-center gap-2 flex-wrap">
               <h3 className="text-lg font-bold">{transaction.student_name}</h3>
               <Badge className={status.color}>
                 <StatusIcon className="h-3 w-3 mr-1" />
                 {status.label}
               </Badge>
             </div>
             <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
               <div><span className="text-muted-foreground">Student ID:</span> {transaction.admission_no || 'N/A'}</div>
               <div><span className="text-muted-foreground">Roll No:</span> {transaction.class_roll || 'N/A'}</div>
               <div><span className="text-muted-foreground">Class:</span> {transaction.class_name} {transaction.section_name ? `(${transaction.section_name})` : ''}</div>
               <div><span className="text-muted-foreground">Guardian:</span> {transaction.father_name || 'N/A'}</div>
             </div>
           </div>

          {/* Transaction Details */}
          <div className="grid grid-cols-2 gap-4 p-3 bg-muted/20 rounded-lg">
            <div><span className="text-muted-foreground text-sm">Receipt No:</span> <p className="font-mono font-medium">{transaction.receipt_no}</p></div>
            <div><span className="text-muted-foreground text-sm">Month:</span> <p className="font-medium">{transaction.month}</p></div>
            <div><span className="text-muted-foreground text-sm">Fee Category:</span> <p>{transaction.fee_category}</p></div>
            <div><span className="text-muted-foreground text-sm">Payment Date:</span> <p>{new Date(transaction.payment_date).toLocaleDateString()}</p></div>
            <div><span className="text-muted-foreground text-sm">Payment Method:</span> <p className="capitalize">{transaction.payment_method}</p></div>
            {transaction.transaction_id && (
              <div><span className="text-muted-foreground text-sm">Transaction ID:</span> <p className="font-mono text-xs">{transaction.transaction_id}</p></div>
            )}
            <div><span className="text-muted-foreground text-sm">Received By:</span> <p>{transaction.collected_by || 'System'}</p></div>
            {transaction.remarks && (
              <div className="col-span-2"><span className="text-muted-foreground text-sm">Remarks:</span> <p className="italic">{transaction.remarks}</p></div>
            )}
          </div>

          {/* Financial Breakdown */}
          <div className="space-y-2">
            <h4 className="font-semibold border-b pb-1">Fee Breakdown</h4>
            <div className="flex justify-between text-sm">
              <span>Total Fee (Payable):</span>
              <span className="font-medium">{formatCurrency(transaction.total_fee)}</span>
            </div>
            {transaction.discount_amount > 0 && (
              <div className="flex justify-between text-sm text-red-600">
                <span>Discount:</span>
                <span>- {formatCurrency(transaction.discount_amount)}</span>
              </div>
            )}
            {transaction.fine_amount > 0 && (
              <div className="flex justify-between text-sm text-orange-600">
                <span>Late Fine:</span>
                <span>+ {formatCurrency(transaction.fine_amount)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold pt-2 border-t">
              <span>Amount Paid:</span>
              <span className="text-emerald-600">{formatCurrency(transaction.paid_amount)}</span>
            </div>
            {!isPaid && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Remaining Due:</span>
                <span className="text-red-600 font-medium">{formatCurrency(transaction.due_amount)}</span>
              </div>
            )}
          </div>

          {/* Signature Area */}
          <div className="flex justify-between text-sm pt-4 border-t">
            <div className="text-center">
              <div className="w-32 border-b border-dashed border-gray-300 mb-1"></div>
              <span className="text-xs text-muted-foreground">Cashier Signature</span>
            </div>
            <div className="text-center">
              <div className="w-32 border-b border-dashed border-gray-300 mb-1"></div>
              <span className="text-xs text-muted-foreground">Guardian Signature</span>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-[10px] text-muted-foreground pt-2 border-t">
            <p>This is a computer generated receipt. Valid without signature.</p>
            <p>For verification, contact school office.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}