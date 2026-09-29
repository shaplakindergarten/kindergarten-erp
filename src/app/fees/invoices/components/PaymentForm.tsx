'use client';

import { useState } from 'react';
import { processPartialPayment } from '@/lib/api/fees';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface PaymentFormProps {
  invoiceId: string;
  totalDue: number;
  onPaymentComplete: () => void;
  onCancel?: () => void;
}

export function PaymentForm({ invoiceId, totalDue, onPaymentComplete, onCancel }: PaymentFormProps) {
  const [amount, setAmount] = useState<number>(totalDue);
  const [method, setMethod] = useState<string>('cash');
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState('');

  const isPartial = amount < totalDue;
  const isValid = amount > 0 && amount <= totalDue;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isValid) {
      toast.error('Please enter a valid amount');
      return;
    }

    setLoading(true);

    try {
      const result = await processPartialPayment(
        invoiceId,
        amount,
        method
      );

      if (result.success) {
        toast.success(
          isPartial 
            ? `Partial payment of $${amount} processed. Remaining: $${result.remaining_due}`
            : `Full payment of $${amount} processed successfully!`
        );
        onPaymentComplete();
      } else {
        toast.error('Payment failed. Please try again.');
      }
    } catch (error: any) {
      toast.error(error.message || 'Payment processing failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          {isPartial ? 'Make Partial Payment' : 'Make Full Payment'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Total Due Display */}
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Total Due</span>
              <span className="text-lg font-bold text-red-600">
                ${totalDue.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <Label htmlFor="amount" className="text-sm font-medium">
              Payment Amount
            </Label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <Input
                id="amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                max={totalDue}
                min={0.01}
                step="0.01"
                className="pl-8"
                disabled={loading}
                required
              />
            </div>
            {isPartial && (
              <p className="text-xs text-yellow-600 mt-1 flex items-center gap-1">
                ⚠️ Remaining due: ${(totalDue - amount).toFixed(2)}
              </p>
            )}
            {amount > totalDue && (
              <p className="text-xs text-red-600 mt-1">
                Amount cannot exceed total due
              </p>
            )}
          </div>

          {/* Payment Method */}
          <div>
            <Label htmlFor="method" className="text-sm font-medium">
              Payment Method
            </Label>
            <Select value={method} onValueChange={setMethod} disabled={loading}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select payment method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">💵 Cash</SelectItem>
                <SelectItem value="bank">🏦 Bank Transfer</SelectItem>
                <SelectItem value="bkash">📱 bKash</SelectItem>
                <SelectItem value="nagad">📱 Nagad</SelectItem>
                <SelectItem value="rocket">📱 Rocket</SelectItem>
                <SelectItem value="card">💳 Card</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Note */}
          <div>
            <Label htmlFor="note" className="text-sm font-medium">
              Note (Optional)
            </Label>
            <Input
              id="note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note..."
              className="mt-1"
              disabled={loading}
            />
          </div>

          {/* Summary */}
          {isPartial && (
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
              <p className="text-sm text-blue-800">
                <span className="font-medium">Partial Payment:</span> You are paying ${amount.toFixed(2)} 
                of ${totalDue.toFixed(2)}. Remaining due will be ${(totalDue - amount).toFixed(2)}.
              </p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            <Button
              type="submit"
              className="flex-1"
              disabled={loading || !isValid}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                `Pay ${isPartial ? 'Partial' : 'Full'} Amount`
              )}
            </Button>
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={loading}
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}