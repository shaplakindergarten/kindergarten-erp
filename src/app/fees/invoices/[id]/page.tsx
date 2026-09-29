'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Download,
  Printer,
  RefreshCw,
  Receipt,
  Calendar,
  User,
  Banknote,
  CreditCard,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  Plus
} from 'lucide-react';

import { getInvoiceWithItems, processPartialPayment, reversePayment } from '@/lib/api/fees';
import { InvoiceWithItems, InvoiceItem } from '@/types/fees';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { bn } from 'date-fns/locale';

// ============================================
// STATUS BADGE COMPONENT
// ============================================

const StatusBadge = ({ status }: { status: string }) => {
  const variants: Record<string, { label: string; className: string }> = {
    paid: { label: '✅ Paid', className: 'bg-green-100 text-green-800 border-green-200' },
    partial: { label: '⚠️ Partial', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
    pending: { label: '⏳ Pending', className: 'bg-blue-100 text-blue-800 border-blue-200' },
    overdue: { label: '🔴 Overdue', className: 'bg-red-100 text-red-800 border-red-200' },
    waived: { label: '✨ Waived', className: 'bg-purple-100 text-purple-800 border-purple-200' },
  };

  const variant = variants[status] || variants.pending;
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${variant.className}`}>
      {variant.label}
    </span>
  );
};

// ============================================
// PAYMENT FORM COMPONENT
// ============================================

const PaymentForm = ({
  invoiceId,
  dueAmount,
  onSuccess,
}: {
  invoiceId: string;
  dueAmount: number;
  onSuccess: () => void;
}) => {
  const [amount, setAmount] = useState(dueAmount);
  const [method, setMethod] = useState('cash');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await processPartialPayment(invoiceId, amount, method);
      toast.success(`Payment of $${amount} processed successfully!`);
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  const isPartial = amount < dueAmount;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="amount">Amount</Label>
        <Input
          id="amount"
          type="number"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          max={dueAmount}
          step="0.01"
          className="mt-1"
        />
        {isPartial && (
          <p className="text-sm text-yellow-600 mt-1">
            ⚠️ Partial payment: Remaining due will be ${(dueAmount - amount).toFixed(2)}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="method">Payment Method</Label>
        <Select value={method} onValueChange={setMethod}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Select method" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cash">Cash</SelectItem>
            <SelectItem value="bank">Bank Transfer</SelectItem>
            <SelectItem value="bkash">bKash</SelectItem>
            <SelectItem value="nagad">Nagad</SelectItem>
            <SelectItem value="rocket">Rocket</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Processing...' : `Pay ${isPartial ? 'Partial' : 'Full'} Amount`}
      </Button>
    </form>
  );
};

// ============================================
// REFUND MODAL COMPONENT
// ============================================

const RefundModal = ({
  paymentId,
  onSuccess,
}: {
  paymentId: string;
  onSuccess: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRefund = async () => {
    if (!reason.trim()) {
      toast.error('Please provide a reason for refund');
      return;
    }

    setLoading(true);
    try {
      const result = await reversePayment(paymentId, reason);
      toast.success('Payment refunded successfully!');
      setOpen(false);
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || 'Refund failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <XCircle className="h-4 w-4 mr-1" />
          Refund
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Refund Payment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="reason">Reason for Refund</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter reason for refund..."
              className="mt-1"
            />
          </div>
          <Button onClick={handleRefund} disabled={loading} className="w-full">
            {loading ? 'Processing...' : 'Confirm Refund'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ============================================
// MAIN PAGE COMPONENT
// ============================================

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [invoice, setInvoice] = useState<InvoiceWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchInvoice = async () => {
    try {
      const data = await getInvoiceWithItems(id as string);
      setInvoice(data);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load invoice');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchInvoice();
    }
  }, [id]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchInvoice();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading invoice...</p>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Receipt className="h-16 w-16 text-gray-300 mx-auto" />
          <h2 className="mt-4 text-xl font-semibold text-gray-700">Invoice Not Found</h2>
          <p className="text-gray-500">The invoice you're looking for doesn't exist.</p>
          <Button className="mt-4" onClick={() => router.push('/fees')}>
            Back to Fees
          </Button>
        </div>
      </div>
    );
  }

  const isOverdue = new Date(invoice.due_date) < new Date() && invoice.due_amount > 0;

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => router.push('/fees')}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <h1 className="text-2xl font-bold">Invoice Details</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Printer className="h-4 w-4 mr-1" />
            Print
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-1" />
            Download
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Total Amount</p>
            <p className="text-2xl font-bold">${invoice.total.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Paid Amount</p>
            <p className="text-2xl font-bold text-green-600">${invoice.paid_amount.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Due Amount</p>
            <p className={`text-2xl font-bold ${isOverdue ? 'text-red-600' : 'text-orange-500'}`}>
              ${invoice.due_amount.toFixed(2)}
            </p>
            {isOverdue && (
              <p className="text-xs text-red-500 mt-1">⚠️ Overdue</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Status</p>
            <div className="mt-1">
              <StatusBadge status={invoice.status} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Previous Due Warning */}
      {invoice.previous_due > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-800">Previous Due Included</p>
              <p className="text-sm text-yellow-700">
                This invoice includes ${invoice.previous_due.toFixed(2)} from previous months.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invoice Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Invoice ID</span>
              <span className="font-mono">{invoice.id.slice(0, 8)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Student ID</span>
              <span>{invoice.student_id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Month</span>
              <span>{invoice.month}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Due Date</span>
              <span>{format(new Date(invoice.due_date), 'PPP', { locale: bn })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Version</span>
              <span>v{invoice.version || 1}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Total Payments</span>
              <span>{invoice.payments?.length || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Total Paid</span>
              <span className="text-green-600">${invoice.paid_amount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Remaining Due</span>
              <span className="text-red-600">${invoice.due_amount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Discount Applied</span>
              <span className="text-green-600">${invoice.discount_amount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Fine Applied</span>
              <span className="text-red-600">${invoice.fine_amount.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invoice Items */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Invoice Items</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Discount</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Due</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.items?.map((item: InvoiceItem) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.category_name || 'Unknown'}</TableCell>
                  <TableCell className="text-right">${item.amount.toFixed(2)}</TableCell>
                  <TableCell className="text-right text-green-600">
                    ${item.discount_amount.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">${item.paid_amount.toFixed(2)}</TableCell>
                  <TableCell className="text-right text-red-600">
                    ${item.due_amount.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={item.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Payment History */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          {invoice.payments && invoice.payments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Receipt No</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      {format(new Date(payment.payment_date), 'PPP', { locale: bn })}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${payment.amount.toFixed(2)}
                    </TableCell>
                    <TableCell className="capitalize">{payment.payment_method}</TableCell>
                    <TableCell className="font-mono text-sm">{payment.receipt_no}</TableCell>
                    <TableCell>
                      <RefundModal
                        paymentId={payment.id}
                        onSuccess={fetchInvoice}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Banknote className="h-12 w-12 mx-auto text-gray-300 mb-2" />
              <p>No payments recorded yet</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Form */}
      {invoice.due_amount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Make Payment</CardTitle>
          </CardHeader>
          <CardContent>
            <PaymentForm
              invoiceId={invoice.id}
              dueAmount={invoice.due_amount}
              onSuccess={fetchInvoice}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}