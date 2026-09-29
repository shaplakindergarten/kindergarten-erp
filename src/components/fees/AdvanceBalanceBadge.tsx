// H:\kindergarten-erp\src\components\fees\AdvanceBalanceBadge.tsx

"use client";

import { useState, useEffect } from 'react';
import { Wallet, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatCurrency } from '@/app/fees/due/utils/calculations';
import { createClient } from '@/lib/supabase/client';

interface AdvanceBalanceBadgeProps {
  studentId: string;
  showLabel?: boolean;
  className?: string;
}

// 🆕 Function to get advance balance from payment_allocations
async function getAdvanceBalanceFromAllocations(studentId: string): Promise<number> {
  try {
    const supabase = createClient();
    
    // Get all advance payments for this student
    const { data, error } = await supabase
      .from('payment_allocations')
      .select('amount')
      .in('allocation_type', ['advance', 'advance_global'])
      .eq('payment_id', (await supabase
        .from('fee_payments')
        .select('id')
        .eq('student_id', studentId)
        .maybeSingle()
      ).data?.id || '');

    if (error) {
      console.error('Error fetching advance balance:', error);
      return 0;
    }

    // Sum all advance amounts
    const totalAdvance = data?.reduce((sum, alloc) => sum + (alloc.amount || 0), 0) || 0;
    
    // Also check advance_payments table (legacy)
    const { data: legacyData, error: legacyError } = await supabase
      .from('advance_payments')
      .select('remaining_balance')
      .eq('student_id', studentId)
      .maybeSingle();

    if (!legacyError && legacyData) {
      // Combine both sources (legacy + new)
      return totalAdvance + (legacyData.remaining_balance || 0);
    }

    return totalAdvance;
  } catch (error) {
    console.error('Error in getAdvanceBalanceFromAllocations:', error);
    return 0;
  }
}

export function AdvanceBalanceBadge({ 
  studentId, 
  showLabel = true,
  className = '' 
}: AdvanceBalanceBadgeProps) {
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        // 🆕 Use new function instead of getAdvanceBalance
        const balanceAmount = await getAdvanceBalanceFromAllocations(studentId);
        setBalance(balanceAmount);
      } catch (err) {
        console.error('Error fetching advance balance:', err);
        setError('Failed to load advance balance');
        setBalance(0);
      } finally {
        setLoading(false);
      }
    };

    if (studentId) {
      fetchBalance();
    }
  }, [studentId]);

  if (loading) {
    return (
      <Badge variant="outline" className={`bg-gray-50 text-gray-400 ${className}`}>
        <Loader2 className="h-3 w-3 animate-spin mr-1" />
        Loading...
      </Badge>
    );
  }

  if (error || balance === null || balance <= 0) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            className={`bg-gradient-to-r from-yellow-400 to-amber-500 text-yellow-950 border-0 font-medium ${className}`}
          >
            <Wallet className="h-3 w-3 mr-1" />
            {showLabel ? `Advance: ${formatCurrency(balance)}` : formatCurrency(balance)}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>Advance payment balance: {formatCurrency(balance)}</p>
          <p className="text-xs text-muted-foreground">Can be adjusted against future fees</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}