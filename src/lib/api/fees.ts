// ============================================
// src/lib/api/fees.ts
// FEE MANAGEMENT API SERVICES (COMPLETE - REFACTORED)
// ============================================

import { createClient } from "@/lib/supabase/client"
import { DueStudent } from "@/app/fees/due/types"
import { getAllStudentsWithDues, getStudentPayments, getStudentDynamicLedger } from "@/lib/api/fees-dynamic"
import {
  FeeCategory,
  FeeInvoice,
  FeePayment,
  FeeStructureExtended,
  FeeStructureExtendedInput,
  AdvancePayment,
  InvoiceWithItems,
  InvoiceItem,
  ScholarshipApplication,
  PaymentRefund,
  DueFilters,
  PartialPaymentResponse,
  RefundResponse,
  AdvancePaymentResponse,
  FeeStats,
  FeeDiscountExtended,
  FineRule,
  PaymentAllocation,
  // 🆕 নতুন টাইপ
  StudentFeeDue,
  DueSummary,
  MonthlyInvoice,
  FeeDashboardStats,
  StudentFeeDueWithDetails,
  FeeDiscountLog,
  PaymentRequest,
  PaymentResponse,
  StudentFeeSummary
} from '@/types/fees';

// ============================================
// 0. ফি বিলিং শুরু তারিখ হিসাব করার জন্য
// ============================================
export function getJan1BillingStartDate(referenceDate: Date = new Date()): string {
  const year = referenceDate.getFullYear()
  return new Date(year, 0, 1).toISOString().split("T")[0]
}

// ============================================
// HELPERS
// ============================================

export function generateReceiptNo(prefix: string = 'PAY'): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

// ============================================
// 1. ডিউ স্টুডেন্ট লিস্ট আনার জন্য (Due List Page এর জন্য) - ✅ আপডেটেড
// ============================================
export async function getDueStudents(): Promise<DueStudent[]> {
  try {
    // 🆕 নতুন v_due_summary ভিউ ব্যবহার করুন
    const supabase = createClient()
    const { data, error } = await supabase
      .from('v_due_summary')
      .select('*')
      .gt('total_due', 0)
      .order('total_due', { ascending: false })

    if (error) throw error

    const dueStudents: DueStudent[] = (data || []).map((s: any) => ({
      id: s.student_id,
      student_id: s.student_id,
      name: s.student_name || "Unknown",
      admission_no: s.admission_no || "",
      roll_no: s.roll_no || "",
      class_id: s.class_id,
      class_name: s.class_name || "N/A",
      section_id: s.section_id,
      section_name: s.section_name || "",
      father_name: s.father_name || "",
      mother_name: s.mother_name || "",
      phone: s.phone || null,
      email: s.email || "",
      total_fees: s.total_expected || 0,
      total_paid: s.total_paid || 0,
      due_amount: s.total_due || 0,
      last_payment_date: null,
      days_overdue: 0,
      overdue_status: 'Current' as const,
      student_status: 'active',
      parent_email: null,
      student_name: s.student_name,
      overdue_months: s.overdue_months || 0,
      overall_status: s.overall_status || 'pending',
      created_at: s.created_at || new Date().toISOString(),
    })) as unknown as DueStudent[];

    return dueStudents

  } catch (error) {
    console.error('Error in getDueStudents:', error)
    return []
  }
}

// ============================================
// 1.1 🆕 নতুন: সকল ডিউ ডিটেইলস আনার জন্য (getAllStudentDueDetails RPC)
// ============================================
export async function getAllStudentDueDetails(params?: {
  academic_year_id?: string
  class_id?: string
  section_id?: string
  status?: string
}): Promise<StudentFeeDueWithDetails[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc('get_all_student_due_details', {
      p_academic_year_id: params?.academic_year_id || null,
      p_class_id: params?.class_id || null,
      p_section_id: params?.section_id || null,
      p_status: params?.status || 'active'
    })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error in getAllStudentDueDetails:', error)
    return []
  }
}

// ============================================
// 1.2 🆕 নতুন: শিক্ষার্থীর ফি সারাংশ (getStudentFeeSummary RPC)
// ============================================
export async function getStudentFeeSummary(
  studentId: string,
  academicYearId?: string
): Promise<StudentFeeSummary | null> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc('get_student_fee_summary', {
      p_student_id: studentId,
      p_academic_year_id: academicYearId || null
    })

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error in getStudentFeeSummary:', error)
    return null
  }
}

// ============================================
// 2. স্টুডেন্টের ফি ডিটেইলস আনার জন্য - ✅ আপডেটেড
// ============================================
export async function getStudentFees(studentId: string) {
  try {
    const supabase = createClient()
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, name, student_id, class_id, classes(name), fathers_contact, mothers_contact, email')
      .eq('id', studentId)
      .single()

    if (studentError) throw studentError

    // 🆕 student_fee_dues থেকে ডেটা নিন
    const { data: dues, error: duesError } = await supabase
      .from('student_fee_dues')
      .select('*')
      .eq('student_id', studentId)
      .order('month', { ascending: false })

    if (duesError) throw duesError

    const payments = await getStudentPayments(studentId)
    const totalPaid = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0
    
    const totalDue = dues?.reduce((sum, d) => sum + (d.due_amount || 0), 0) || 0
    const totalExpected = dues?.reduce((sum, d) => sum + (d.expected_amount || 0), 0) || 0

    return {
      student: student,
      dues: dues || [],
      payments: payments || [],
      total_fees: totalExpected,
      total_paid: totalPaid,
      due_amount: totalDue
    }
  } catch (error) {
    console.error('Error in getStudentFees:', error)
    return null
  }
}

// ============================================
// 3. ফি অ্যাসাইন করার জন্য - ⚠️ ডিপ্রিকেটেড (পুরনো সিস্টেম)
// @deprecated - student_fee_dues ব্যবহার করুন
// ============================================
export async function assignFeeToStudent(data: {
  studentId: string
  categoryId: string
  amount: number
  dueDate?: string
}) {
  try {
    // ⚠️ এই ফাংশনটি পুরনো fee_transactions ব্যবহার করে
    // নতুন সিস্টেমে student_fee_dues ব্যবহার করুন
    console.warn('assignFeeToStudent is deprecated. Use student_fee_dues instead.')
    
    const supabase = createClient()
    const receiptNo = `FEE-${Date.now()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`
    const dueDate = data.dueDate || getJan1BillingStartDate()

    const { data: transaction, error } = await supabase
      .from('fee_transactions')
      .insert({
        student_id: data.studentId,
        category_id: data.categoryId,
        amount: data.amount,
        paid_amount: 0,
        due_amount: data.amount,
        status: 'pending',
        due_date: dueDate,
        receipt_no: receiptNo
      })
      .select()
      .single()

    if (error) throw error
    return { success: true, data: transaction }
  } catch (error) {
    console.error('Error in assignFeeToStudent:', error)
    return { success: false, error: String(error) }
  }
}

// ============================================
// 4. পেমেন্ট প্রসেস করার জন্য - ✅ আপডেটেড (process_fee_payment RPC ব্যবহার)
// ============================================
export async function processPayment(paymentData: {
  studentId: string
  transactionId?: string
  amount: number
  paymentMethod: 'cash' | 'bank' | 'online' | 'bkash' | 'nagad'
  note?: string
  discountAmount?: number
  fineAmount?: number
}) {
  try {
    const supabase = createClient()
    const receiptNo = `RCP-${Date.now()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`
    
    // 🆕 নতুন: fee_payments INSERT (ট্রিগার auto process করবে)
    const { data: payment, error: paymentError } = await supabase
      .from('fee_payments')
      .insert({
        student_id: paymentData.studentId,
        amount: paymentData.amount,
        payment_method: paymentData.paymentMethod,
        receipt_no: receiptNo,
        note: paymentData.note || null,
        payment_date: new Date().toISOString(),
        discount_amount: paymentData.discountAmount || 0,
        fine_amount: paymentData.fineAmount || 0
      })
      .select()
      .single()

    if (paymentError) throw paymentError

    // ✅ ট্রিগার auto_create_fee_transaction স্বয়ংক্রিয়ভাবে কাজ করবে
    // ✅ process_fee_payment() RPC কল হবে

    return { success: true, payment }

  } catch (error) {
    console.error('Error in processPayment:', error)
    return { success: false, error: String(error) }
  }
}

// ============================================
// 5. ক্লাস ওয়াইজ ডিউ সামারি - ✅ আপডেটেড
// ============================================
export async function getClassWiseDueSummary() {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('v_due_summary')
      .select('class_name, total_due')
      .gt('total_due', 0)

    if (error) throw error

    const summary: Record<string, { count: number; totalDue: number }> = {}
    
    data?.forEach((item: any) => {
      const className = item.class_name || 'N/A'
      if (!summary[className]) {
        summary[className] = { count: 0, totalDue: 0 }
      }
      summary[className].count++
      summary[className].totalDue += item.total_due || 0
    })

    return summary

  } catch (error) {
    console.error('Error in getClassWiseDueSummary:', error)
    return {}
  }
}

// ============================================
// 6. ড্যাশবোর্ডের জন্য সারাংশ - ✅ আপডেটেড (v_fee_dashboard_stats ব্যবহার)
// ============================================
export async function getFeeDashboardSummary() {
  try {
    const supabase = createClient()
    
    // 🆕 v_fee_dashboard_stats ভিউ ব্যবহার করুন
    const { data, error } = await supabase
      .from('v_fee_dashboard_stats')
      .select('*')
      .single()

    if (error) throw error

    return {
      total_due: data?.total_due || 0,
      total_fees: data?.total_expected || 0,
      total_paid: data?.total_paid || 0,
      collection_rate: data?.total_expected > 0 ? (data.total_paid / data.total_expected) * 100 : 0,
      due_students_count: data?.students_with_due || 0,
      high_due_count: 0, // গণনা করতে হবে
      medium_due_count: 0,
      low_due_count: 0,
      critical_overdue: data?.overdue_students || 0
    }
  } catch (error) {
    console.error('Error in getFeeDashboardSummary:', error)
    return null
  }
}

// ============================================
// 7. ফি ট্রানজাকশনের স্ট্যাটাস আপডেট - ⚠️ ডিপ্রিকেটেড
// @deprecated - student_fee_dues ব্যবহার করুন
// ============================================
export async function updateTransactionStatus(transactionId: string, status: 'pending' | 'partial' | 'paid' | 'overdue') {
  try {
    console.warn('updateTransactionStatus is deprecated. Use student_fee_dues instead.')
    const supabase = createClient()
    const { error } = await supabase
      .from('fee_transactions')
      .update({ 
        status, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', transactionId)

    if (error) throw error
    return { success: true }
  } catch (error) {
    console.error('Error in updateTransactionStatus:', error)
    return { success: false, error: String(error) }
  }
}

// ============================================
// 8. ওভারডিউ ট্রানজাকশন চেক ও আপডেট - ⚠️ ডিপ্রিকেটেড
// @deprecated - student_fee_dues এবং update_daily_due_status() ব্যবহার করুন
// ============================================
export async function checkAndUpdateOverdueTransactions() {
  try {
    console.warn('checkAndUpdateOverdueTransactions is deprecated. Use student_fee_dues and update_daily_due_status() instead.')
    const supabase = createClient()
    const today = new Date().toISOString().split('T')[0]
    
    // 🆕 student_fee_dues আপডেট করুন
    const { data, error } = await supabase
      .from('student_fee_dues')
      .update({ status: 'overdue' })
      .lt('due_date', today)
      .in('status', ['pending', 'partial'])
      .gt('due_amount', 0)
      .select()

    if (error) throw error
    
    return { success: true, updated_count: data?.length || 0 }
  } catch (error) {
    console.error('Error in checkAndUpdateOverdueTransactions:', error)
    return { success: false, error: String(error) }
  }
}

// ============================================
// 9. FEE CATEGORY APIs - ✅ অপরিবর্তিত
// ============================================

export async function getFeeCategories(): Promise<FeeCategory[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('fee_categories')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (error) throw new Error(error.message);
  return data || [];
}

export async function getFeeCategory(id: string): Promise<FeeCategory> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('fee_categories')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function createFeeCategory(category: Partial<FeeCategory>): Promise<FeeCategory> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('fee_categories')
    .insert([category])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateFeeCategory(id: string, category: Partial<FeeCategory>): Promise<FeeCategory> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('fee_categories')
    .update(category)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteFeeCategory(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('fee_categories')
    .update({ is_active: false })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

// ============================================
// 10. FEE STRUCTURE APIs - ✅ অপরিবর্তিত
// ============================================

export async function getFeeStructures(): Promise<FeeStructureExtended[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('fee_structures')
    .select(`
      *,
      academic_year:academic_year_id(id, name, year_name),
      class:class_id(id, name)
    `)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function getFeeStructuresByClass(classId: string): Promise<FeeStructureExtended[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('fee_structures')
    .select(`
      *,
      academic_year:academic_year_id(id, name, year_name),
      class:class_id(id, name)
    `)
    .eq('class_id', classId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function getFeeStructure(id: string): Promise<FeeStructureExtended> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('fee_structures')
    .select(`
      *,
      academic_year:academic_year_id(id, name, year_name),
      class:class_id(id, name)
    `)
    .eq('id', id)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function createFeeStructure(structure: FeeStructureExtendedInput): Promise<FeeStructureExtended> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('fee_structures')
    .insert([{
      name: structure.name,
      academic_year_id: structure.academic_year_id,
      class_id: structure.class_id,
      description: structure.description,
      items: structure.items,
      is_active: structure.is_active !== undefined ? structure.is_active : true,
      version: 1
    }])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateFeeStructure(id: string, structure: Partial<FeeStructureExtendedInput>): Promise<FeeStructureExtended> {
  const supabase = createClient()
  
  const { data: current } = await supabase
    .from('fee_structures')
    .select('version')
    .eq('id', id)
    .single();
  
  const newVersion = (current?.version || 0) + 1;
  
  const { data, error } = await supabase
    .from('fee_structures')
    .update({
      ...structure,
      version: newVersion
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteFeeStructure(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('fee_structures')
    .update({ is_active: false })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

// ============================================
// 11. FEE INVOICE APIs - ✅ অপরিবর্তিত (পুরনো সিস্টেমের জন্য)
// ============================================

export async function getInvoicesByStudent(studentId: string): Promise<FeeInvoice[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('fee_invoices')
    .select('*')
    .eq('student_id', studentId)
    .order('month', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function getInvoice(id: string): Promise<FeeInvoice> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('fee_invoices')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function getInvoiceWithItems(invoiceId: string): Promise<InvoiceWithItems> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('fee_invoices')
    .select(`
      *,
      items:fee_invoice_items(
        *,
        category:category_id(
          id,
          name
        )
      ),
      payments:fee_payments(*)
    `)
    .eq('id', invoiceId)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function getInvoiceItems(invoiceId: string): Promise<InvoiceItem[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('fee_invoice_items')
    .select('*, category:category_id(id, name)')
    .eq('invoice_id', invoiceId);

  if (error) throw new Error(error.message);
  return data || [];
}

// ============================================
// 11.1 🆕 নতুন: মাসিক ইনভয়েস (v_monthly_invoice ভিউ)
// ============================================
export async function getMonthlyInvoices(params?: {
  student_id?: string
  class_id?: string
  month?: string
}): Promise<MonthlyInvoice[]> {
  try {
    const supabase = createClient()
    let query = supabase.from('v_monthly_invoice').select('*')

    if (params?.student_id) {
      query = query.eq('student_id', params.student_id)
    }
    if (params?.class_id) {
      query = query.eq('class_id', params.class_id)
    }
    if (params?.month) {
      query = query.eq('month', params.month)
    }

    const { data, error } = await query.order('month', { ascending: false })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error in getMonthlyInvoices:', error)
    return []
  }
}

// ============================================
// 12. FEE PAYMENT APIs - ✅ আপডেটেড
// ============================================

export async function createPayment(payment: Partial<FeePayment>): Promise<FeePayment> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('fee_payments')
    .insert([{
      ...payment,
      receipt_no: generateReceiptNo('PAY'),
      payment_date: payment.payment_date || new Date().toISOString(),
    }])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function getPaymentsByStudent(studentId: string): Promise<FeePayment[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('fee_payments')
    .select('*')
    .eq('student_id', studentId)
    .order('payment_date', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function getPaymentsByInvoice(invoiceId: string): Promise<FeePayment[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('fee_payments')
    .select('*')
    .eq('fee_transaction_id', invoiceId)
    .order('payment_date', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

// ============================================
// 12.1 🆕 নতুন: process_fee_payment RPC ব্যবহার
// ============================================
export async function processFeePayment(paymentId: string): Promise<PaymentResponse> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc('process_fee_payment', {
      p_payment_id: paymentId
    })

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error in processFeePayment:', error)
    throw error
  }
}

export async function processPartialPayment(
  invoiceId: string,
  amount: number,
  method: string
): Promise<PartialPaymentResponse> {
  const supabase = createClient()
  const receiptNo = generateReceiptNo('PARTIAL');

  const { data, error } = await supabase.rpc('process_partial_payment', {
    p_invoice_id: invoiceId,
    p_amount: amount,
    p_payment_method: method,
    p_receipt_no: receiptNo
  });

  if (error) throw new Error(error.message);
  return data;
}

// ============================================
// 13. ADVANCE PAYMENT APIs - ✅ আপডেটেড
// ============================================

export async function getAdvanceBalance(studentId: string): Promise<AdvancePayment | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('advance_payments')
    .select('*')
    .eq('student_id', studentId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function processAdvancePayment(
  studentId: string,
  amount: number,
  method: string
): Promise<AdvancePaymentResponse> {
  const supabase = createClient()
  const receiptNo = generateReceiptNo('ADV');

  const { data, error } = await supabase.rpc('process_advance_payment_manual', {
    p_student_id: studentId,
    p_amount: amount,
    p_payment_method: method,
    p_receipt_no: receiptNo
  });

  if (error) throw new Error(error.message);
  return data;
}

// ============================================
// 14. REFUND APIs - ✅ অপরিবর্তিত
// ============================================

export async function reversePayment(
  paymentId: string,
  reason: string
): Promise<RefundResponse> {
  const supabase = createClient()
  const { data: userData } = await supabase.auth.getUser();

  const { data, error } = await supabase.rpc('reverse_payment', {
    p_payment_id: paymentId,
    p_reason: reason,
    p_approved_by: userData.user?.id
  });

  if (error) throw new Error(error.message);
  return data;
}

export async function getRefundsByPayment(paymentId: string): Promise<PaymentRefund[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('payment_refunds')
    .select('*')
    .eq('payment_id', paymentId);

  if (error) throw new Error(error.message);
  return data || [];
}

// ============================================
// 15. SCHOLARSHIP APIs - ✅ অপরিবর্তিত
// ============================================

export async function applyScholarship(
  data: Partial<ScholarshipApplication>
): Promise<ScholarshipApplication> {
  const supabase = createClient()
  const { data: result, error } = await supabase
    .from('scholarship_applications')
    .insert([data])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return result;
}

export async function getScholarshipsByStudent(studentId: string): Promise<ScholarshipApplication[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('scholarship_applications')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function approveScholarship(id: string): Promise<ScholarshipApplication> {
  const supabase = createClient()
  const { data: userData } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('scholarship_applications')
    .update({
      status: 'approved',
      approved_by: userData.user?.id,
      approved_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// ============================================
// 16. DISCOUNT APIs - ✅ অপরিবর্তিত
// ============================================

export async function getDiscounts(): Promise<FeeDiscountExtended[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('fee_discounts')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function createDiscount(discount: Partial<FeeDiscountExtended>): Promise<FeeDiscountExtended> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('fee_discounts')
    .insert([discount])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// ============================================
// 17. FINE RULE APIs - ✅ অপরিবর্তিত
// ============================================

export async function getFineRules(): Promise<FineRule[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('fine_rules')
    .select('*')
    .eq('is_active', true)
    .order('days_delay');

  if (error) throw new Error(error.message);
  return data || [];
}

// ============================================
// 18. DUE STUDENT APIs (Filtered) - ✅ আপডেটেড
// ============================================

export async function getDueStudentsFiltered(filters: DueFilters): Promise<DueStudent[]> {
  try {
    const supabase = createClient()
    
    // 🆕 v_due_summary ব্যবহার করুন
    let query = supabase
      .from('v_due_summary')
      .select('*')
      .gt('total_due', 0)

    if (filters.classId) {
      query = query.eq('class_id', filters.classId)
    }
    if (filters.sectionId) {
      query = query.eq('section_id', filters.sectionId)
    }
    if (filters.search) {
      query = query.or(`student_name.ilike.%${filters.search}%,admission_no.ilike.%${filters.search}%`)
    }
    if (filters.minDue) {
      query = query.gte('total_due', filters.minDue)
    }
    if (filters.maxDue) {
      query = query.lte('total_due', filters.maxDue)
    }
    if (filters.status) {
      if (filters.status === 'overdue') {
        query = query.gt('overdue_months', 0)
      } else if (filters.status === 'partial') {
        query = query.gt('partial_months', 0)
      } else if (filters.status === 'pending') {
        query = query.gt('pending_months', 0)
      }
    }

    const { data, error } = await query
      .order('total_due', { ascending: false })
      .limit(1000)

    if (error) throw error

    return (data || []).map((s: any) => ({
      id: s.student_id,
      student_id: s.student_id,
      student_name: s.student_name,
      admission_no: s.admission_no,
      class_name: s.class_name,
      total_fees: s.total_expected || 0,
      total_paid: s.total_paid || 0,
      due_amount: s.total_due || 0,
      days_overdue: 0,
      overdue_months: s.overdue_months || 0,
      overall_status: s.overall_status || 'pending'
    })) as unknown as DueStudent[]

  } catch (error) {
    console.error('Error in getDueStudentsFiltered:', error)
    return []
  }
}

export async function getFeeStats(): Promise<FeeStats> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('v_fee_dashboard_stats')
      .select('*')
      .single()

    if (error) throw error

    return {
      totalDue: data?.total_due || 0,
      count: data?.students_with_due || 0,
      overdueCount: data?.overdue_students || 0,
      totalCollected: data?.total_paid || 0,
      collectionRate: data?.total_expected > 0 ? (data.total_paid / data.total_expected) * 100 : 0
    }
  } catch (error) {
    console.error('Error in getFeeStats:', error)
    return {
      totalDue: 0,
      count: 0,
      overdueCount: 0,
      totalCollected: 0,
      collectionRate: 0
    }
  }
}

// ============================================
// 19. PAYMENT ALLOCATION APIs - ✅ আপডেটেড
// ============================================

export async function getPaymentAllocations(paymentId: string): Promise<PaymentAllocation[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('payment_allocations')
    .select('*, category:category_id(id, name)')
    .eq('payment_id', paymentId);

  if (error) throw new Error(error.message);
  return data || [];
}

// ============================================
// 19.1 🆕 নতুন: student_fee_dues থেকে ডিউ ডেটা
// ============================================
export async function getStudentDueDetails(studentId: string): Promise<StudentFeeDue[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('student_fee_dues')
      .select('*')
      .eq('student_id', studentId)
      .gt('due_amount', 0)
      .order('month', { ascending: true })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error in getStudentDueDetails:', error)
    return []
  }
}

// ============================================
// 19.2 🆕 নতুন: ডিউ সারাংশ (v_due_summary)
// ============================================
export async function getDueSummary(params?: {
  class_id?: string
  section_id?: string
}): Promise<DueSummary[]> {
  try {
    const supabase = createClient()
    let query = supabase.from('v_due_summary').select('*')

    if (params?.class_id) {
      query = query.eq('class_id', params.class_id)
    }
    if (params?.section_id) {
      query = query.eq('section_id', params.section_id)
    }

    const { data, error } = await query
      .gt('total_due', 0)
      .order('total_due', { ascending: false })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error in getDueSummary:', error)
    return []
  }
}

// ============================================
// 20. REPORT APIs - ✅ আপডেটেড
// ============================================

export async function getDailyCollection(date: string): Promise<any[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('fee_payments')
    .select(`
      *,
      student:student_id(id, name, student_id, class_id, section_id)
    `)
    .gte('payment_date', `${date}T00:00:00`)
    .lte('payment_date', `${date}T23:59:59`)
    .order('payment_date', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function getMonthlyCollection(month: number, year: number): Promise<any[]> {
  const supabase = createClient()
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

  const { data, error } = await supabase
    .from('fee_payments')
    .select(`
      *,
      student:student_id(id, name, student_id, class_id, section_id)
    `)
    .gte('payment_date', startDate)
    .lte('payment_date', endDate)
    .order('payment_date', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

// ============================================
// 20.1 🆕 নতুন: ডিউ রিপোর্ট (ক্লাস ভিত্তিক)
// ============================================
export async function getClassDueReport() {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('v_due_summary')
      .select('class_name, total_due, overdue_months, partial_months, pending_months')
      .gt('total_due', 0)

    if (error) throw error

    const report: Record<string, {
      total_due: number
      overdue_count: number
      partial_count: number
      pending_count: number
      student_count: number
    }> = {}

    data?.forEach((item: any) => {
      const className = item.class_name || 'N/A'
      if (!report[className]) {
        report[className] = {
          total_due: 0,
          overdue_count: 0,
          partial_count: 0,
          pending_count: 0,
          student_count: 0
        }
      }
      report[className].total_due += item.total_due || 0
      report[className].overdue_count += (item.overdue_months || 0) > 0 ? 1 : 0
      report[className].partial_count += (item.partial_months || 0) > 0 ? 1 : 0
      report[className].pending_count += (item.pending_months || 0) > 0 ? 1 : 0
      report[className].student_count++
    })

    return report
  } catch (error) {
    console.error('Error in getClassDueReport:', error)
    return {}
  }
}