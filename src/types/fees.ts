// ============================================================
// src/types/fees.ts - আপডেটেড (পুরনো + নতুন টাইপ)
// ============================================================

export type Frequency = "one_time" | "monthly" | "quarterly" | "annual" | "custom"

export interface FeeCategory {
  id: string
  name: string
  amount: number
  frequency: Frequency
  class_id?: string | null
  class?: { id: string; name: string }
  description?: string | null
  is_active: boolean
  created_at?: string
  created_date?: string
}

export interface FeeStructureItem {
  category_id: string
  category_name?: string
  amount: number
  is_optional: boolean
  due_date?: string
}

export interface FeeStructure {
  id: string
  name: string
  academic_year_id: string
  class_id: string
  items: FeeStructureItem[]
  version: number
  is_active: boolean
  description?: string | null
  created_at?: string
  updated_at?: string
  academic_year?: { id: string; name: string; year_name: string }
  class?: { id: string; name: string }
}

export interface FeeStructureInput {
  name: string
  academic_year_id: string
  class_id: string
  categories: FeeStructureItem[]
  description?: string
}

export interface FeeInvoice {
  id: string
  student_id: string
  academic_year_id: string
  month: number
  amount: number
  discount_amount: number
  discount_reason?: string
  fine_amount: number
  total: number
  paid_amount: number
  due_amount: number
  status: 'pending' | 'partial' | 'paid'
  due_date: string
   created_at: string
   updated_at: string
   version?: number;
}

export interface FeePayment {
   id: string
   fee_transaction_id: string
   student_id?: string
   amount: number
    payment_method: 'cash' | 'bank' | 'mobile_banking'
    receipt_no?: string
    note?: string
   payment_date: string
 }

export interface FeeTransaction {
  id: string
  student_id: string
  invoice_no: string | null
  category_id: string
  amount: number
  paid_amount: number
  payment_date: string | null
  payment_method: string
  receipt_no: string
  month?: string | null
  transaction_type?: string | null
  due_amount?: number
  discount?: number
  fine?: number
  remarks?: string
}

// ============================================
// FEE STRUCTURE MODULE (NEW)
// ============================================

export interface FeeStructureExtendedItem {
  id?: string
  name: string
  amount: number
  frequency: 'monthly' | 'quarterly' | 'yearly' | 'one_time' | 'custom'
  category_id?: string | null
  category_name?: string
  is_optional?: boolean
  custom_multiplier?: number
}

export interface FeeStructureExtended {
  id: string
  academic_year_id: string
  class_id: string
  name: string
  description: string | null
  items: FeeStructureExtendedItem[]
  total_amount: number
  is_active: boolean
  created_at: string
  updated_at: string
  academic_year?: { id: string; name: string; year_name: string }
  class?: { id: string; name: string }
}

export interface FeeStructureExtendedInput {
  academic_year_id: string
  class_id: string
  name: string
  description?: string
  items: FeeStructureExtendedItem[]
  is_active?: boolean
}

// ============================================
// NEW TYPES FOR STUDENT FEE DUES (Refactored)
// Add these below existing types
// ============================================

// ==================== STUDENT FEE DUES ====================

/**
 * মাসিক ডিউ ট্র্যাকিং - student_fee_dues টেবিলের জন্য
 */
export interface StudentFeeDue {
  id: string;
  student_id: string;
  category_id: string | null;
  academic_year_id: string;
  month: string; // 'YYYY-MM' format
  expected_amount: number;
  paid_amount: number;
  due_amount: number;
  discount_amount: number;
  fine_amount: number;
  status: 'pending' | 'partial' | 'paid' | 'waived' | 'overdue';
  due_date: string; // date
  paid_date: string | null; // date
  is_advance: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * ডিউ সারাংশ - v_due_summary ভিউ থেকে
 */
export interface DueSummary {
  student_id: string;
  admission_no: string;
  student_name: string;
  class_name: string;
  section_name: string;
  total_expected: number;
  total_paid: number;
  total_due: number;
  total_fine: number;
  total_discount: number;
  paid_months: number;
  partial_months: number;
  pending_months: number;
  overdue_months: number;
  earliest_due_date: string | null;
  overall_status: '✅ Paid' | '⚠️ Overdue' | '🟡 Partial' | '🔴 Pending';
}

/**
 * মাসিক ইনভয়েস - v_monthly_invoice ভিউ থেকে
 */
export interface MonthlyInvoice {
  student_id: string;
  admission_no: string;
  student_name: string;
  class_name: string;
  section_name: string;
  month: string;
  total_fee: number;
  paid: number;
  due: number;
  fine: number;
  discount: number;
  status: string;
  due_date: string;
  is_advance: boolean;
  days_overdue: number;
  month_name: string;
}

/**
 * ড্যাশবোর্ড স্ট্যাটস - v_fee_dashboard_stats ভিউ থেকে
 */
export interface FeeDashboardStats {
  total_students: number;
  students_with_due: number;
  overdue_students: number;
  fully_paid_students: number;
  total_due: number;
  overdue_amount: number;
  total_expected: number;
  total_paid: number;
  current_month_invoices: number;
  current_month_due: number;
}

// ==================== STUDENT FEE DUE WITH DETAILS ====================

/**
 * StudentFeeDue ক্যাটাগরি নাম সহ
 */
export interface StudentFeeDueWithDetails extends StudentFeeDue {
  category_name: string;
  student_name: string;
  admission_no: string;
  class_name: string;
  section_name: string;
}

// ==================== DISCOUNT LOG ====================

export interface FeeDiscountLog {
  id: string;
  student_id: string;
  category_id: string | null;
  month: string;
  discount_amount: number;
  reason: string | null;
  applied_by: string | null;
  applied_at: string;
  created_at: string;
}

// ==================== PAYMENT REQUEST & RESPONSE ====================

export interface PaymentRequest {
  student_id: string;
  amount: number;
  payment_method: 'cash' | 'bank' | 'mobile';
  receipt_no?: string;
  payment_date?: string;
  discount_amount?: number;
  fine_amount?: number;
  note?: string;
}

export interface PaymentAllocationDetail {
  category_id: string | null;
  month: string | null;
  allocated_amount: number;
  type: 'due_payment' | 'advance_payment' | 'regular' | 'advance_global';
}

export interface PaymentResponse {
  success: boolean;
  payment_id: string;
  total_amount: number;
  total_allocated: number;
  remaining: number;
  details: PaymentAllocationDetail[];
}

// ==================== STUDENT FEE SUMMARY ====================

export interface FeeSummary {
  total_expected: number;
  total_paid: number;
  total_due: number;
  total_fine: number;
  total_discount: number;
  total_advance: number;
  net_due: number;
}

export interface MonthDetail {
  month: string;
  expected: number;
  paid: number;
  due: number;
  fine: number;
  discount: number;
  status: 'paid' | 'partial' | 'pending' | 'overdue';
  due_date: string;
  is_advance: boolean;
}

export interface CategoryBreakdown {
  category_id: string;
  category_name: string;
  total_expected: number;
  total_paid: number;
  total_due: number;
  total_fine: number;
  total_discount: number;
  months: MonthDetail[];
}

export interface FeeSummaryResponse {
  summary: FeeSummary;
  category_breakdown: CategoryBreakdown[];
  total_months_with_due: number;
}

export interface StudentFeeSummary {
  student_id: string;
  academic_year_id: string;
  summary: FeeSummary;
  category_breakdown: CategoryBreakdown[];
  total_months_with_due: number;
}

// ==================== RPC FUNCTION PARAMS ====================

export interface GetAllStudentDueDetailsParams {
  p_academic_year_id?: string;
  p_class_id?: string;
  p_section_id?: string;
  p_status?: string;
}

export interface GetStudentFeeSummaryParams {
  p_student_id: string;
  p_academic_year_id?: string;
}

// ============================================
// EXISTING TYPES (Keep all existing below)
// ============================================

// ==================== ADVANCE PAYMENT ====================

export interface AdvancePayment {
  id: string;
  student_id: string;
  amount: number;
  remaining_balance: number;
  created_at: string;
  updated_at: string;
}

// ==================== INVOICE ITEMS ====================

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  category_id: string;
  category_name?: string;
  amount: number;
  discount_amount: number;
  paid_amount: number;
  due_amount: number;
  status: 'pending' | 'partial' | 'paid' | 'waived';
  created_at: string;
  updated_at: string;
}

// Extended Invoice with items and payments
export interface InvoiceWithItems extends FeeInvoice {
  items: InvoiceItem[];
  previous_due: number;
  payments: FeePayment[];
}

// ==================== SCHOLARSHIP ====================

export interface ScholarshipApplication {
  id: string;
  student_id: string;
  discount_id: string;
  academic_year_id: string;
  percentage: number;
  amount?: number;
  reason: string;
  approved_by?: string;
  approved_at?: string;
  valid_from: string;
  valid_to: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  created_at: string;
  updated_at: string;
}

// ==================== REFUND ====================

export interface PaymentRefund {
  id: string;
  payment_id: string;
  invoice_id: string;
  refund_amount: number;
  refund_date: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  approved_by?: string;
  approved_at?: string;
  processed_at?: string;
  created_at: string;
}

// ==================== DUE STUDENTS ====================

export interface DueStudent {
  student_id: string;
  student_name: string;
  admission_no: string;
  roll_no: string;
  class_id: string;
  class_name: string;
  section_id: string;
  section_name: string;
  father_name: string;
  mother_name: string;
  phone: string;
  email: string;
  total_fees: number;
  total_paid: number;
  due_amount: number;
  last_payment_date?: string;
  days_overdue: number;
  overdue_status: 'Current' | 'Low' | 'Medium' | 'High' | 'Critical';
  student_status: string;
  created_at: string;
  advance_balance?: number;
}

export interface DueFilters {
  classId: string | null;
  sectionId: string | null;
  search: string;
  minDue: number | null;
  maxDue: number | null;
  status: string | null;
}

// ==================== PAYMENT ALLOCATION ====================

export interface PaymentAllocation {
  id: string;
  payment_id: string;
  category_id: string;
  amount: number;
  month?: string;
  allocation_type?: string;
  created_at: string;
}

// ==================== FINE RULES ====================

export interface FineRule {
  id: string;
  name: string;
  days_delay: number;
  fine_type: 'percentage' | 'fixed';
  fine_value: number;
  max_fine?: number;
  is_active: boolean;
  created_at: string;
}

// ==================== DISCOUNT ====================

export interface FeeDiscount {
  id: string;
  name: string;
  description?: string | null;
  discount_type: 'percentage' | 'fixed';
  amount: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface FeeDiscountExtended extends FeeDiscount {
  scope_type: 'all' | 'class' | 'section' | 'student' | 'sibling';
  scope_class_id?: string;
  scope_section_id?: string;
  scope_student_ids?: string[];
  sibling_group_id?: string;
  valid_from?: string;
  valid_to?: string;
}

// ==================== STATS ====================

export interface FeeStats {
  totalDue: number;
  count: number;
  overdueCount: number;
  totalCollected: number;
  collectionRate: number;
}

// ==================== PAYMENT REQUEST (Existing) ====================

export interface PaymentRequest {
  invoiceId: string;
  amount: number;
  method: string;
  note?: string;
}

export interface PartialPaymentResponse {
  success: boolean;
  payment_id: string;
  remaining_due: number;
  status: 'pending' | 'partial' | 'paid';
}

export interface RefundRequest {
  paymentId: string;
  reason: string;
}

export interface RefundResponse {
  success: boolean;
  refund_id: string;
}

export interface AdvancePaymentRequest {
  studentId: string;
  amount: number;
  method: string;
}

export interface AdvancePaymentResponse {
  success: boolean;
  invoice_id: string;
  advance_amount: number;
  next_month: number;
}