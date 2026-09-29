'use client';

import { useState } from 'react';
import { reversePayment } from '@/lib/api/fees';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, XCircle } from 'lucide-react';

interface RefundModalProps {
  paymentId: string;
  onSuccess: () => void;
  trigger?: React.ReactNode;
}

export function RefundModal({ paymentId, onSuccess, trigger }: RefundModalProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRefund = async () => {
    if (!reason.trim()) {
      toast.error('Please provide a reason for the refund');
      return;
    }

    setLoading(true);
    try {
      const result = await reversePayment(paymentId, reason);
      
      if (result.success) {
        toast.success('Payment refunded successfully!');
        setOpen(false);
        setReason('');
        onSuccess();
      } else {
        toast.error('Refund failed. Please try again.');
      }
    } catch (error: any) {
      toast.error(error.message || 'Refund processing failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="destructive" size="sm">
            <XCircle className="h-4 w-4 mr-1" />
            Refund
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Refund Payment</DialogTitle>
          <DialogDescription>
            This action will reverse the payment and update the invoice balance.
            This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="refund-reason" className="text-sm font-medium">
              Reason for Refund
            </Label>
            <Textarea
              id="refund-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter reason for refund..."
              className="mt-1"
              disabled={loading}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleRefund}
            disabled={loading || !reason.trim()}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              'Confirm Refund'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}