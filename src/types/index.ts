// types/index.ts

// ═══════════════════════════════════════════════════════════════════
// User Roles
// ═══════════════════════════════════════════════════════════════════
export type UserRole =
  | 'super_admin'
  | 'admin'
  | 'teacher'
  | 'staff'
  | 'accountant'
  | 'store'
  | 'student'
  | 'user'
  | 'parent'

// ═══════════════════════════════════════════════════════════════════
// User
// ═══════════════════════════════════════════════════════════════════
export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  role_id?: string | null
  status?: string
  avatar?: string
  organization_id?: string
  created_at?: string
  updated_at?: string
}

// ═══════════════════════════════════════════════════════════════════
// Organization
// ═══════════════════════════════════════════════════════════════════
export interface Organization {
  id: string
  name: string
  address?: string
  phone?: string
  email?: string
  logo_url?: string
  created_at: string
}

// ═══════════════════════════════════════════════════════════════════
// Academic Year
// ═══════════════════════════════════════════════════════════════════
export interface AcademicYear {
  id: string
  year_name: string
  name?: string
  start_date: string
  end_date: string
  is_current: boolean
  is_active: boolean
  created_at?: string
}

// ═══════════════════════════════════════════════════════════════════
// Class
// ═══════════════════════════════════════════════════════════════════
export interface Class {
  id: string
  name: string
  numeric_order: number
  sections?: Section[]
  created_at?: string
}

// ═══════════════════════════════════════════════════════════════════
// Section
// ═══════════════════════════════════════════════════════════════════
export interface Section {
  id: string
  class_id: string
  name: string
  capacity: number
  class_teacher_id?: string
  organization_id?: string
  created_at?: string
}

// ═══════════════════════════════════════════════════════════════════
// Student
// ═══════════════════════════════════════════════════════════════════
export interface Student {
  id: string
  student_id: string
  name: string
  name_bn?: string
  father_name: string
  father_name_bn?: string
  mother_name: string
  mother_name_bn?: string
  dob: string
  birth_cert_no?: string
  blood_group?: string
  particular_disease?: string
  gender: 'male' | 'female' | 'other'
  contact: string
  address?: string
  village?: string
  post_office?: string
  police_station?: string
  district?: string
  fathers_contact?: string
  mothers_contact?: string
  email?: string
  whatsapp?: string
  photo_url?: string
  student_photo_url?: string
  class_id: string
  section_id: string
  class_roll?: string
  academic_year_id?: string
  admission_date?: string
  father_nid_no?: string
  mother_nid_no?: string
  rfid_uid?: string
  qr_code?: string
  student_group?: string
  permanent_village?: string
  permanent_post_office?: string
  permanent_police_station?: string
  permanent_district?: string
  status: 'active' | 'inactive' | 'transferred' | 'released'
  current_fee_structure_id?: string
  user_id?: string
  created_at?: string
  updated_at?: string
}

// ═══════════════════════════════════════════════════════════════════
// Staff
// ═══════════════════════════════════════════════════════════════════
export interface Staff {
  id: string
  employee_id: string
  name: string
  name_bn?: string
  father_name?: string
  mother_name?: string
  nid_no?: string
  designation: string
  qualification?: string
  experience?: number
  dob?: string
  gender?: 'male' | 'female' | 'other'
  address?: string
  contact?: string
  email?: string
  photo_url?: string
  salary_category_id?: string
  role?: 'teacher' | 'staff' | 'accountant' | 'store' | 'admin_staff' | 'support_staff'
  status?: 'active' | 'inactive' | 'on_leave' | 'terminated'
  resign_date?: string
  resign_reason?: string
  salary?: number
  joining_date?: string
  village?: string
  post_office?: string
  police_station?: string
  district?: string
  created_at?: string
  updated_at?: string
  organization_id?: string
  user_id?: string
  bank_name?: string
  account_number?: string
  phone?: string
  emergency_contact?: string
  remarks?: string
}

// ═══════════════════════════════════════════════════════════════════
// Attendance
// ═══════════════════════════════════════════════════════════════════
export interface AttendanceRecord {
  id: string
  date: string
  status: 'present' | 'absent' | 'late'
  remarks?: string
  created_at?: string
}

export interface StudentAttendance extends AttendanceRecord {
  student_id: string
  marked_by?: string
  marked_via?: string
  check_in?: string
  check_out?: string
}

export interface StaffAttendance extends AttendanceRecord {
  staff_id: string
  check_in?: string
  check_out?: string
}

// ═══════════════════════════════════════════════════════════════════
// Fee Category
// ═══════════════════════════════════════════════════════════════════
export interface FeeCategory {
  id: string
  name: string
  amount: number
  frequency: 'one_time' | 'monthly' | 'quarterly' | 'annual' | 'custom'
  class_id?: string
  description?: string
  is_active?: boolean
  custom_schedule?: any
  created_at?: string
  created_date?: string
}

// ═══════════════════════════════════════════════════════════════════
// Fee Transaction
// ═══════════════════════════════════════════════════════════════════
export interface FeeTransaction {
  id: string
  student_id: string
  category_id: string
  amount: number
  paid_amount: number
  payment_date: string
  payment_method: 'cash' | 'bank' | 'mobile_banking'
  receipt_no: string
  status: 'pending' | 'partial' | 'paid'
  due_date?: string
  remarks?: string
  created_at?: string
  updated_at?: string
  due_amount?: number
  discount?: number
  fine?: number
  discount_id?: string
  fine_rule_id?: string
  fee_structure_id?: string
  invoice_no?: string
  month?: string
  transaction_type?: 'regular' | 'advance' | 'adjustment'
}

// ═══════════════════════════════════════════════════════════════════
// Fee Payment
// ═══════════════════════════════════════════════════════════════════
export interface FeePayment {
  id: string
  fee_transaction_id?: string
  student_id: string
  amount: number
  payment_method: 'cash' | 'bank' | 'mobile_banking'
  receipt_no: string
  note?: string
  payment_date: string
  created_at?: string
  updated_at?: string
  discount_amount?: number
  fine_amount?: number
}

// ═══════════════════════════════════════════════════════════════════
// Fee Structure
// ═══════════════════════════════════════════════════════════════════
export interface FeeStructure {
  id: string
  name: string
  academic_year_id: string
  class_id: string
  items: any[]
  total_amount: number
  description?: string
  version: number
  is_active: boolean
  created_at?: string
  updated_at?: string
}

// ═══════════════════════════════════════════════════════════════════
// Fee Student Assignment
// ═══════════════════════════════════════════════════════════════════
export interface FeeStudentAssignment {
  id: string
  student_id: string
  fee_structure_id: string
  academic_year_id: string
  assigned_date: string
  effective_from: string
  effective_to?: string
  is_active: boolean
  notes?: string
  created_by?: string
  created_at?: string
  updated_at?: string
}

// ═══════════════════════════════════════════════════════════════════
// Exam
// ═══════════════════════════════════════════════════════════════════
export interface Exam {
  id: string
  name: string
  term_code: string
  start_date: string
  end_date: string
  academic_year_id: string
  weightage_percentage?: number
  status?: 'upcoming' | 'ongoing' | 'completed'
  result_status?: 'draft' | 'generating' | 'generated' | 'published'
  created_at?: string
  updated_at?: string
}

// ═══════════════════════════════════════════════════════════════════
// Subject
// ═══════════════════════════════════════════════════════════════════
export interface Subject {
  id: string
  name: string
  code: string
  class_id?: string
  organization_id?: string
  subject_type?: 'compulsory' | 'elective' | 'group_science' | 'group_humanities' | 'group_commerce'
  created_at?: string
}

// ═══════════════════════════════════════════════════════════════════
// Exam Subject
// ═══════════════════════════════════════════════════════════════════
export interface ExamSubject {
  id: string
  term_id: string
  class_id: string
  section_id?: string
  subject_id: string
  subject_type: 'compulsory' | 'elective' | 'optional'
  full_marks: number
  pass_marks: number
  order_index?: number
  created_at?: string
}

// ═══════════════════════════════════════════════════════════════════
// Student Marks
// ═══════════════════════════════════════════════════════════════════
export interface StudentMarks {
  id: string
  student_id: string
  term_id: string
  exam_subject_id: string
  marks_obtained: number
  is_absent: boolean
  entry_status: 'draft' | 'submitted' | 'verified' | 'locked'
  entered_by?: string
  entered_at?: string
  locked_by?: string
  locked_at?: string
  remarks?: string
  created_at?: string
  updated_at?: string
}

// ═══════════════════════════════════════════════════════════════════
// Compiled Result
// ═══════════════════════════════════════════════════════════════════
export interface CompiledResult {
  id: string
  student_id: string
  term_id: string
  academic_year_id: string
  total_marks_obtained: number
  total_full_marks: number
  percentage: number
  gpa: number
  letter_grade: string
  class_rank?: number
  section_rank?: number
  result_status: 'pending' | 'generated' | 'published'
  is_published: boolean
  published_at?: string
  failed_subjects?: any[]
  has_failed_compulsory?: boolean
  merit_position?: number
  created_at?: string
  updated_at?: string
}

// ═══════════════════════════════════════════════════════════════════
// Exam Result (legacy)
// ═══════════════════════════════════════════════════════════════════
export interface ExamResult {
  id: string
  exam_id: string
  student_id: string
  subject_id: string
  marks: number
  grade: string
  created_at?: string
}

// ═══════════════════════════════════════════════════════════════════
// Product (legacy inventory)
// ═══════════════════════════════════════════════════════════════════
export interface Product {
  id: string
  name: string
  category: string
  purchase_price: number
  sale_price: number
  quantity: number
  min_quantity?: number
  unit?: string
  sku?: string
  description?: string
  photo_url?: string
  created_at?: string
  updated_at?: string
}

// ═══════════════════════════════════════════════════════════════════
// Inventory Transaction (legacy)
// ═══════════════════════════════════════════════════════════════════
export interface InventoryTransaction {
  id: string
  product_id: string
  type: 'buy' | 'sale'
  quantity: number
  price: number
  date: string
  remarks?: string
  created_at?: string
}

// ═══════════════════════════════════════════════════════════════════
// Inventory Item
// ═══════════════════════════════════════════════════════════════════
export interface InventoryItem {
  id: string
  item_code: string
  name: string
  category_id?: string
  item_type: 'asset' | 'consumable' | 'saleable'
  unit: string
  purchase_price: number
  selling_price: number
  current_stock: number
  reorder_level: number
  location_rack?: string
  is_active: boolean
  created_at?: string
}

// ═══════════════════════════════════════════════════════════════════
// Inventory Supplier
// ═══════════════════════════════════════════════════════════════════
export interface InventorySupplier {
  id: string
  company_name: string
  contact_person?: string
  phone?: string
  email?: string
  address?: string
  current_due: number
  status: 'active' | 'inactive'
  created_at?: string
}

// ═══════════════════════════════════════════════════════════════════
// Inventory Purchase
// ═══════════════════════════════════════════════════════════════════
export interface InventoryPurchase {
  id: string
  purchase_no: string
  supplier_id: string
  purchase_date: string
  total_amount: number
  paid_amount: number
  due_amount: number
  status: 'pending' | 'received' | 'cancelled'
  narration?: string
  voucher_id?: string
  created_by?: string
  created_at?: string
}

// ═══════════════════════════════════════════════════════════════════
// Inventory Sale
// ═══════════════════════════════════════════════════════════════════
export interface InventorySale {
  id: string
  invoice_no: string
  sale_no: string
  student_id: string
  sale_date: string
  subtotal: number
  discount: number
  net_amount: number
  paid_amount: number
  due_amount: number
  status: 'completed' | 'cancelled' | 'returned'
  narration?: string
  voucher_id?: string
  created_at?: string
}

// ═══════════════════════════════════════════════════════════════════
// Inventory Issuance
// ═══════════════════════════════════════════════════════════════════
export interface InventoryIssuance {
  id: string
  issue_no: string
  issuance_no: string
  item_id: string
  item_type: 'asset' | 'consumable' | 'saleable'
  issued_to_type: 'staff' | 'student'
  issued_to_id: string
  issued_to_name: string
  quantity: number
  unit: string
  issuance_date: string
  purpose?: string
  status: 'requested' | 'approved' | 'issued' | 'returned'
  created_at?: string
}

// ═══════════════════════════════════════════════════════════════════
// Income Head
// ═══════════════════════════════════════════════════════════════════
export interface IncomeHead {
  id: string
  name: string
  type: 'student_fees' | 'product_sale' | 'donation' | 'other'
  code?: string
  description?: string
  is_active?: boolean
  created_at?: string
}

// ═══════════════════════════════════════════════════════════════════
// Expense Head
// ═══════════════════════════════════════════════════════════════════
export interface ExpenseHead {
  id: string
  name: string
  type: 'salary' | 'administrative' | 'utility' | 'stationery' | 'maintenance' | 'other'
  code?: string
  description?: string
  is_active?: boolean
  created_at?: string
}

// ═══════════════════════════════════════════════════════════════════
// Finance Transaction
// ═══════════════════════════════════════════════════════════════════
export interface FinanceTransaction {
  id: string
  type: 'income' | 'expense'
  head_id: string
  account_id?: string
  amount: number
  date: string
  description: string
  payment_mode: 'cash' | 'bank' | 'mobile_banking'
  reference?: string
  source_type?: string
  source_id?: string
  created_at?: string
  organization_id?: string
}

// ═══════════════════════════════════════════════════════════════════
// Financial Account
// ═══════════════════════════════════════════════════════════════════
export interface FinancialAccount {
  id: string
  account_name: string
  account_number?: string
  type: 'cash' | 'bank' | 'mobile_bank'
  bank_name?: string
  branch_name?: string
  current_balance: number
  is_active: boolean
  created_at?: string
  updated_at?: string
}

// ═══════════════════════════════════════════════════════════════════
// Salary Category
// ═══════════════════════════════════════════════════════════════════
export interface SalaryCategory {
  id: string
  name: string
  basic: number
  hra: number
  da: number
  allowances: number
  deductions: number
  is_active?: boolean
  created_at?: string
  organization_id?: string
}

// ═══════════════════════════════════════════════════════════════════
// Staff Salary
// ═══════════════════════════════════════════════════════════════════
export interface StaffSalary {
  id: string
  staff_id: string
  salary_category_id: string
  basic: number
  hra: number
  da: number
  allowances: number
  personal_allowance: number
  special_allowance: number
  other_deductions: number
  total_salary: number
  effective_from: string
  effective_to?: string
  is_current: boolean
  version: number
  created_by?: string
  created_at?: string
  updated_at?: string
}

// ═══════════════════════════════════════════════════════════════════
// Salary Payment
// ═══════════════════════════════════════════════════════════════════
export interface SalaryPayment {
  id: string
  staff_id: string
  category_id: string
  amount: number
  payment_date: string
  payment_method: 'cash' | 'bank' | 'mobile_banking'
  month: string
  year: number
  status: 'paid' | 'pending' | 'partial'
  created_at?: string
}

// ═══════════════════════════════════════════════════════════════════
// Salary Advance
// ═══════════════════════════════════════════════════════════════════
export interface SalaryAdvance {
  id: string
  staff_id: string
  amount: number
  advance_date: string
  reason?: string
  total_installments: number
  paid_installments: number
  installment_amount?: number
  status: 'pending' | 'approved' | 'paid' | 'cancelled'
  created_at?: string
}

// ═══════════════════════════════════════════════════════════════════
// Leave
// ═══════════════════════════════════════════════════════════════════
export interface Leave {
  id: string
  staff_id?: string
  type: 'sick' | 'casual' | 'maternity' | 'unpaid'
  start_date: string
  end_date: string
  reason: string
  status: 'pending' | 'approved' | 'rejected' | 'expired'
  approved_by?: string
  approved_at?: string
  created_at?: string
  updated_at?: string
  user_type?: 'student' | 'staff'
  student_id?: string
}

// ═══════════════════════════════════════════════════════════════════
// Leave Balance
// ═══════════════════════════════════════════════════════════════════
export interface LeaveBalance {
  id: string
  staff_id: string
  category_name: string
  total_days: number
  used_days: number
  remaining_days: number
  created_at?: string
  updated_at?: string
}

// ═══════════════════════════════════════════════════════════════════
// Notification
// ═══════════════════════════════════════════════════════════════════
export interface Notification {
  id: string
  type: 'due' | 'attendance' | 'result' | 'general'
  title: string
  message: string
  recipient_type: 'student' | 'staff' | 'all'
  sent_at?: string
  is_read?: boolean
  created_at?: string
  organization_id?: string
  status?: 'sent' | 'pending' | 'failed'
  channel?: 'general' | 'email' | 'sms'
}

// ═══════════════════════════════════════════════════════════════════
// Question
// ═══════════════════════════════════════════════════════════════════
export interface Question {
  id: string
  subject_id: string
  type: 'mcq' | 'short' | 'long'
  question: string
  options?: string[]
  correct_answer?: string
  marks: number
  difficulty: 'easy' | 'medium' | 'hard'
  tags?: string[]
  organization_id?: string
  created_at?: string
}

// ═══════════════════════════════════════════════════════════════════
// Role
// ═══════════════════════════════════════════════════════════════════
export interface Role {
  id: string
  name: string
  permissions: string[]
  created_at?: string
  updated_at?: string
}

// ═══════════════════════════════════════════════════════════════════
// School Settings
// ═══════════════════════════════════════════════════════════════════
export interface SchoolSettings {
  id?: number
  school_name?: string
  school_address?: string
  school_phone?: string
  school_email?: string
  school_logo?: string | null
  school_watermark?: string | null
  founder_message?: string
  half_day_after?: string
  is_friday_off?: boolean
  is_saturday_off?: boolean
  sms_notification_enabled?: boolean
  school_start_time?: string
  late_after?: string
  school_end_time?: string
  created_at?: string
  updated_at?: string
}

// ═══════════════════════════════════════════════════════════════════
// UserType (Settings Page)
// ═══════════════════════════════════════════════════════════════════
export interface UserType {
  id: string
  email: string
  name: string
  role_id?: string | null
  status?: string
  role?: {
    id: string
    name: string
  } | null
  created_at?: string
  updated_at?: string
}

// ═══════════════════════════════════════════════════════════════════
// AcademicYearType (Settings Page)
// ═══════════════════════════════════════════════════════════════════
export interface AcademicYearType {
  id: string
  year_name: string
  start_date: string
  end_date: string
  is_current: boolean
  is_active?: boolean
  created_at?: string
}

// ═══════════════════════════════════════════════════════════════════
// RoleType (Settings Page)
// ═══════════════════════════════════════════════════════════════════
export interface RoleType {
  id: string
  name: string
  permissions: string[]
  created_at?: string
  updated_at?: string
}

// ═══════════════════════════════════════════════════════════════════
// Profile
// ═══════════════════════════════════════════════════════════════════
export interface Profile {
  id: string
  email: string
  full_name: string
  phone?: string
  avatar_url?: string
  organization_id?: string
  role?: string
  created_at?: string
  updated_at?: string
}

// ═══════════════════════════════════════════════════════════════════
// Student Fee Dues
// ═══════════════════════════════════════════════════════════════════

export interface StudentFeeDue {
  id: string
  student_id: string
  category_id: string | null
  academic_year_id: string
  month: string
  expected_amount: number
  paid_amount: number
  due_amount: number
  discount_amount: number
  fine_amount: number
  status: 'pending' | 'partial' | 'paid' | 'waived' | 'overdue'
  due_date: string
  paid_date: string | null
  is_advance: boolean
  created_at: string
  updated_at: string
}

export interface DueSummary {
  student_id: string
  admission_no: string
  student_name: string
  class_name: string
  section_name: string
  total_expected: number
  total_paid: number
  total_due: number
  total_fine: number
  total_discount: number
  paid_months: number
  partial_months: number
  pending_months: number
  overdue_months: number
  earliest_due_date: string | null
  overall_status: '✅ Paid' | '⚠️ Overdue' | '🟡 Partial' | '🔴 Pending'
}

export interface MonthlyInvoice {
  student_id: string
  admission_no: string
  student_name: string
  class_name: string
  section_name: string
  month: string
  total_fee: number
  paid: number
  due: number
  fine: number
  discount: number
  status: string
  due_date: string
  is_advance: boolean
  days_overdue: number
  month_name: string
}

export interface FeeDashboardStats {
  total_students: number
  students_with_due: number
  overdue_students: number
  fully_paid_students: number
  total_due: number
  overdue_amount: number
  total_expected: number
  total_paid: number
  current_month_invoices: number
  current_month_due: number
}

export interface StudentFeeDueWithDetails extends StudentFeeDue {
  category_name: string
  student_name: string
  admission_no: string
  class_name: string
  section_name: string
}

export interface FeeDiscountLog {
  id: string
  student_id: string
  category_id: string | null
  month: string
  discount_amount: number
  reason: string | null
  applied_by: string | null
  applied_at: string
  created_at: string
}

export interface PaymentRequest {
  student_id: string
  amount: number
  payment_method: 'cash' | 'bank' | 'mobile'
  receipt_no?: string
  payment_date?: string
  discount_amount?: number
  fine_amount?: number
  note?: string
}

export interface PaymentAllocationDetail {
  category_id: string | null
  month: string | null
  allocated_amount: number
  type: 'due_payment' | 'advance_payment' | 'regular' | 'advance_global'
}

export interface PaymentResponse {
  success: boolean
  payment_id: string
  total_amount: number
  total_allocated: number
  remaining: number
  details: PaymentAllocationDetail[]
}

export interface StudentFeeSummary {
  student_id: string
  academic_year_id: string
  summary: {
    total_expected: number
    total_paid: number
    total_due: number
    total_fine: number
    total_discount: number
    total_advance: number
    net_due: number
    total_months: number
    paid_count: number
    partial_count: number
    pending_count: number
    overdue_count: number
  }
  category_breakdown: Array<{
    category_id: string | null
    category_name: string
    total_expected: number
    total_paid: number
    total_due: number
    total_fine: number
    total_discount: number
    status: 'paid' | 'partial' | 'pending'
    months: Array<{
      month: string
      expected: number
      paid: number
      due: number
      fine: number
      discount: number
      status: string
      due_date: string
      is_advance: boolean
    }>
  }>
  total_months_with_due: number
}

export interface GetAllStudentDueDetailsParams {
  p_academic_year_id?: string
  p_class_id?: string
  p_section_id?: string
  p_status?: string
}

export interface GetStudentFeeSummaryParams {
  p_student_id: string
  p_academic_year_id?: string
}