'use client';
// src/hooks/useSalaryData.ts
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useToastStore } from '@/store/useStore';
import { isStaffActive, getStaffCurrentSalary } from '@/lib/api/staff';

// ============================================================
// UPDATED INTERFACES
// ============================================================

interface SalaryBalance {
  id: string;
  staff_id: string;
  month: string;
  year: number;
  expected_salary: number;
  paid_amount: number;
  balance: number; // paid - expected (Positive = Advance, Negative = Due)
  status: 'pending' | 'partial' | 'paid' | 'advance' | 'due' | 'settled';
  created_at: string;
}

interface SalaryAdvance {
  id: string;
  staff_id: string;
  staff_name?: string;
  amount: number;
  advance_date: string;
  reason: string | null;
  total_installments: number;
  paid_installments: number;
  installment_amount: number;
  status: 'pending' | 'active' | 'completed';
}

interface SalaryIncrement {
  id: string;
  staff_id: string;
  old_salary: number;
  new_salary: number;
  increment_percentage: number;
  effective_from: string;
  reason: string | null;
}

interface SalaryPromotion {
  id: string;
  staff_id: string;
  old_designation: string;
  new_designation: string;
  old_salary_category_id: string;
  new_salary_category_id: string;
  effective_from: string;
  increment_amount: number;
}

interface StaffBalanceSheet {
  staff_id: string;
  staff_name: string;
  staff_employee_id: string;
  staff_designation: string;
  total_expected: number;
  total_paid: number;
  total_advance: number;  // paid > expected
  total_due: number;      // expected > paid
  total_balance: number;  // absolute difference
  monthly_breakdown: MonthlyBalance[];
}

interface MonthlyBalance {
  month: string;
  year: number;
  expected: number;
  paid: number;
  balance: number; // paid - expected
  status: string;
}

// ============================================================
// MAIN HOOK
// ============================================================

export function useSalaryData() {
  const [balances, setBalances] = useState<SalaryBalance[]>([]);
  const [advances, setAdvances] = useState<SalaryAdvance[]>([]);
  const [increments, setIncrements] = useState<SalaryIncrement[]>([]);
  const [promotions, setPromotions] = useState<SalaryPromotion[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const addToast = useToastStore((state) => state.addToast);

  const supabase = createClient();

  // ============================================================
  // LOAD FUNCTIONS
  // ============================================================

  const loadBalances = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('salary_balances')
        .select('*, staff:staff_id(name, employee_id)')
        .order('year', { ascending: false })
        .order('month', { ascending: false });
      
      if (error) throw error;
      setBalances(data || []);
    } catch (err) {
      console.error('Error loading balances:', err);
      setBalances([]);
    }
  }, [supabase]);

  const loadPayments = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('salary_payments')
        .select('*, staff:staff_id(name, employee_id, photo_url)')
        .order('payment_date', { ascending: false });
      
      if (error) throw error;
      setPayments(data || []);
    } catch (err) {
      console.error('Error loading payments:', err);
      setPayments([]);
    }
  }, [supabase]);

  const loadAdvances = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('salary_advances')
        .select('*, staff:staff_id(name, employee_id, photo_url)')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setAdvances(data || []);
    } catch (err) {
      console.error('Error loading advances:', err);
      setAdvances([]);
    }
  }, [supabase]);

  const loadIncrements = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('salary_increments')
        .select('*, staff:staff_id(name, employee_id, photo_url)')
        .order('effective_from', { ascending: false });
      
      if (error) throw error;
      setIncrements(data || []);
    } catch (err) {
      console.error('Error loading increments:', err);
      setIncrements([]);
    }
  }, [supabase]);

  const loadPromotions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('salary_promotions')
        .select('*, staff:staff_id(name, employee_id, photo_url)')
        .order('effective_from', { ascending: false });
      
      if (error) throw error;
      setPromotions(data || []);
    } catch (err) {
      console.error('Error loading promotions:', err);
      setPromotions([]);
    }
  }, [supabase]);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      loadBalances(),
      loadPayments(),
      loadAdvances(),
      loadIncrements(),
      loadPromotions()
    ]);
    setLoading(false);
  }, [loadBalances, loadPayments, loadAdvances, loadIncrements, loadPromotions]);

  // ============================================================
  // BALANCE SHEET - FIXED
  // ============================================================

  const getStaffBalanceSheet = useCallback(async (staffId: string): Promise<StaffBalanceSheet | null> => {
    try {
      const { data: staffData } = await supabase
        .from('staff')
        .select('id, name, employee_id, designation, photo_url')
        .eq('id', staffId)
        .single();

      if (!staffData) return null;

      const { data: balanceData } = await supabase
        .from('salary_balances')
        .select('*')
        .eq('staff_id', staffId)
        .order('year', { ascending: true })
        .order('month', { ascending: true });

      const { data: advanceData } = await supabase
        .from('salary_advances')
        .select('*')
        .eq('staff_id', staffId)
        .eq('status', 'active');

      const monthlyBreakdown = (balanceData || []).map(b => ({
        month: b.month,
        year: b.year,
        expected: b.expected_salary,
        paid: b.paid_amount,
        balance: b.balance, // paid - expected
        status: b.status
      }));

      const totalExpected = monthlyBreakdown.reduce((sum, m) => sum + m.expected, 0);
      const totalPaid = monthlyBreakdown.reduce((sum, m) => sum + m.paid, 0);
      // FIXED: balance = paid - expected
      const totalBalance = totalPaid - totalExpected;
      
      // FIXED: Positive = Advance, Negative = Due
      const totalAdvance = totalBalance > 0 ? totalBalance : 0;
      const totalDue = totalBalance < 0 ? Math.abs(totalBalance) : 0;

      return {
        staff_id: staffData.id,
        staff_name: staffData.name,
        staff_employee_id: staffData.employee_id,
        staff_designation: staffData.designation,
        total_expected: totalExpected,
        total_paid: totalPaid,
        total_advance: totalAdvance,
        total_due: totalDue,
        total_balance: Math.abs(totalBalance),
        monthly_breakdown: monthlyBreakdown
      };
    } catch (err) {
      console.error('Error getting staff balance sheet:', err);
      return null;
    }
  }, [supabase]);

  // ============================================================
  // PAYMENT FUNCTIONS - FIXED
  // ============================================================

  const checkPaymentExists = useCallback(async (staffId: string, month: string, year: number): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('salary_payments')
        .select('id')
        .eq('staff_id', staffId)
        .eq('month', month)
        .eq('year', year);
      
      if (error) throw error;
      return (data?.length || 0) > 0;
    } catch (err) {
      console.error('Error checking payment:', err);
      return false;
    }
  }, [supabase]);

  const recordPayment = useCallback(async (
    staffId: string,
    amount: number,
    month: string,
    year: number,
    paymentMethod: string
  ) => {
    // Check if staff is active
    const active = await isStaffActive(staffId);
    if (!active) {
      addToast({ type: "error", title: "Error", message: "Cannot pay salary to resigned/terminated staff!" });
      return false;
    }

    const exists = await checkPaymentExists(staffId, month, year);
    if (exists) {
      addToast({ type: "error", title: "Error", message: `Salary for ${month} ${year} has already been paid!` });
      return false;
    }

    const expectedSalary = await getStaffCurrentSalary(staffId);

    // Get pending advances for deduction
    const { data: advancesData } = await supabase
      .from('salary_advances')
      .select('*')
      .eq('staff_id', staffId)
      .eq('status', 'active');

    let deduction = 0;
    if (advancesData && advancesData.length > 0) {
      deduction = advancesData.reduce((sum, a) => sum + (a.installment_amount || 0), 0);
    }

    const finalAmount = amount - deduction;
    
    // FIXED: balance = paid - expected (Positive = Advance, Negative = Due)
    const balance = finalAmount - expectedSalary;

    console.log('📝 Payment form inputs:', {
      staffId,
      amount: finalAmount,
      month,
      year,
      paymentMethod,
      finalAmountType: typeof finalAmount,
      yearType: typeof year,
    })

    // Insert payment
    const {
      data: paymentData,
      error: paymentError,
      status: httpStatus,
      statusText: httpStatusText
    } = await supabase
      .from('salary_payments')
      .insert({
        staff_id: staffId,
        amount: finalAmount,
        month: month,
        year: year,
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: paymentMethod,
        status: 'paid'
      })
      .select();

    if (paymentError) {
      // Detailed error logging
      console.error('❌ ========================================')
      console.error('❌ SALARY PAYMENT INSERT FAILED')
      console.error('❌ ========================================')
      console.error('❌ Raw error object:', paymentError)
      console.error('❌ JSON:', JSON.stringify(paymentError, null, 2))
      console.error('❌ Object keys:', Object.keys(paymentError))
      console.error('❌ message:', paymentError.message)
      console.error('❌ code:', (paymentError as any).code)
      console.error('❌ details:', (paymentError as any).details)
      console.error('❌ hint:', (paymentError as any).hint)
      console.error('❌ HTTP status:', httpStatus, httpStatusText)
      console.error('❌ Data:', paymentData)
      console.error('❌ ========================================')

      // Show meaningful error to user
      const errorMessage =
        paymentError.message
        || (paymentError as any).details
        || (paymentError as any).hint
        || `Insert failed (HTTP ${httpStatus})`

      addToast({
        type: "error",
        title: "Payment Failed",
        message: errorMessage
      });
      return false;
    }

    // FIXED: সঠিক স্ট্যাটাস
    let balanceStatus: 'paid' | 'advance' | 'due' | 'settled';
    if (balance === 0) {
      balanceStatus = 'settled';
    } else if (balance > 0) {
      balanceStatus = 'advance';
    } else {
      balanceStatus = 'due';
    }

    // Update or create balance record
    const { data: existingBalance } = await supabase
      .from('salary_balances')
      .select('id')
      .eq('staff_id', staffId)
      .eq('month', month)
      .eq('year', year)
      .single();

    if (existingBalance) {
      await supabase
        .from('salary_balances')
        .update({
          paid_amount: finalAmount,
          balance: balance,
          status: balanceStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingBalance.id);
    } else {
      await supabase
        .from('salary_balances')
        .insert({
          staff_id: staffId,
          month: month,
          year: year,
          expected_salary: expectedSalary,
          paid_amount: finalAmount,
          balance: balance,
          status: balanceStatus
        });
    }

    // Create notification
    await supabase
      .from('salary_notifications')
      .insert({
        staff_id: staffId,
        type: 'payment',
        title: 'Salary Paid',
        message: `Salary for ${month} ${year} has been paid. Amount: ${finalAmount}`,
        sent_via: 'system',
        sent_at: new Date().toISOString(),
        status: 'sent',
        is_read: false,
      });

    addToast({ type: "success", title: "Success", message: "Payment recorded successfully!" });
    return true;
  }, [supabase, addToast, checkPaymentExists]);

  // ============================================================
  // INCREMENT FUNCTIONS
  // ============================================================

  const recordIncrement = useCallback(async (
    staffId: string,
    newSalary: number,
    effectiveFrom: string,
    reason: string
  ) => {
    try {
      const active = await isStaffActive(staffId);
      if (!active) {
        addToast({ type: "error", title: "Error", message: "Cannot give increment to resigned/terminated staff!" });
        return false;
      }

      const oldSalary = await getStaffCurrentSalary(staffId);
      const incrementAmount = newSalary - oldSalary;
      const incrementPercentage = oldSalary > 0 ? (incrementAmount / oldSalary) * 100 : 0;

      const { error: incrementError } = await supabase
        .from('salary_increments')
        .insert({
          staff_id: staffId,
          old_salary: oldSalary,
          new_salary: newSalary,
          increment_percentage: incrementPercentage,
          effective_from: effectiveFrom,
          reason: reason,
        });

      if (incrementError) throw incrementError;

      // Update staff_salaries
      await supabase
        .from('staff_salaries')
        .insert({
          staff_id: staffId,
          basic: newSalary,
          effective_from: effectiveFrom,
        });

      await supabase
        .from('salary_notifications')
        .insert({
          staff_id: staffId,
          type: 'increment',
          title: 'Salary Increment',
          message: `Salary increased from ${oldSalary} to ${newSalary} (${incrementPercentage.toFixed(2)}%) effective ${effectiveFrom}`,
          sent_via: 'system',
          sent_at: new Date().toISOString(),
          status: 'sent',
          is_read: false,
        });

      addToast({ type: "success", title: "Success", message: "Increment recorded successfully!" });
      return true;
    } catch (err) {
      console.error('Error recording increment:', err);
      addToast({ type: "error", title: "Error", message: "Failed to record increment!" });
      return false;
    }
  }, [supabase, addToast]);

  // ============================================================
  // PROMOTION FUNCTIONS
  // ============================================================

  const recordPromotion = useCallback(async (
    staffId: string,
    newDesignation: string,
    newSalaryCategoryId: string,
    effectiveFrom: string,
    reason: string
  ) => {
    try {
      const active = await isStaffActive(staffId);
      if (!active) {
        addToast({ type: "error", title: "Error", message: "Cannot promote resigned/terminated staff!" });
        return false;
      }

      const { data: staffData } = await supabase
        .from('staff')
        .select('*, salary_category:salary_category_id(*)')
        .eq('id', staffId)
        .single();

      const oldDesignation = staffData?.designation || '';
      const oldSalaryCategoryId = staffData?.salary_category_id || '';
      const oldSalary = staffData?.salary_category 
        ? (staffData.salary_category.basic || 0) + 
          (staffData.salary_category.hra || 0) + 
          (staffData.salary_category.da || 0) + 
          (staffData.salary_category.allowances || 0) - 
          (staffData.salary_category.deductions || 0)
        : 0;

      const { data: newCategory } = await supabase
        .from('salary_categories')
        .select('*')
        .eq('id', newSalaryCategoryId)
        .single();

      const newSalary = newCategory 
        ? (newCategory.basic || 0) + 
          (newCategory.hra || 0) + 
          (newCategory.da || 0) + 
          (newCategory.allowances || 0) - 
          (newCategory.deductions || 0)
        : 0;

      const incrementAmount = newSalary - oldSalary;

      const { error: promotionError } = await supabase
        .from('salary_promotions')
        .insert({
          staff_id: staffId,
          old_designation: oldDesignation,
          new_designation: newDesignation,
          old_salary_category_id: oldSalaryCategoryId,
          new_salary_category_id: newSalaryCategoryId,
          effective_from: effectiveFrom,
          increment_amount: incrementAmount,
          reason: reason,
        });

      if (promotionError) throw promotionError;

      // Update staff
      await supabase
        .from('staff')
        .update({
          designation: newDesignation,
          salary_category_id: newSalaryCategoryId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', staffId);

      await supabase
        .from('salary_notifications')
        .insert({
          staff_id: staffId,
          type: 'promotion',
          title: 'Staff Promoted',
          message: `${staffData?.name} promoted to ${newDesignation} effective ${effectiveFrom}`,
          sent_via: 'system',
          sent_at: new Date().toISOString(),
          status: 'sent',
          is_read: false,
        });

      addToast({ type: "success", title: "Success", message: "Promotion recorded successfully!" });
      return true;
    } catch (err) {
      console.error('Error recording promotion:', err);
      addToast({ type: "error", title: "Error", message: "Failed to record promotion!" });
      return false;
    }
  }, [supabase, addToast]);

  // ============================================================
  // EFFECTS & RETURN
  // ============================================================

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  return {
    balances,
    advances,
    increments,
    promotions,
    payments,
    loading,
    loadBalances,
    loadAdvances,
    loadIncrements,
    loadPromotions,
    loadPayments,
    loadAllData,
    getStaffBalanceSheet,
    checkPaymentExists,
    recordPayment,
    recordIncrement,
    recordPromotion
  };
}