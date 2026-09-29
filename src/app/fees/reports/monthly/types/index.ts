// H:\kindergarten-erp\src\app\fees\reports\monthly\types\index.ts

export interface MonthlyData {
  month: string
  month_key: string
  year: number
  total_collected: number
  transaction_count: number
  students_count: number
  unique_students: number
  discount_total: number
  fine_total: number
  cash_total: number
  bkash_total: number
  nagad_total: number
  bank_total: number
  percentage: number
}

export interface MonthlyTransactionDetail {
  id: string
  receipt_no: string
  payment_date: string
  student_id: string
  student_name: string
  student_id_card: string
  admission_no: string
  class_roll: string
  class_name: string
  section_name: string
  father_name: string
  mother_name: string
  phone: string
  fee_category: string
  month: string
  total_fee: number
  discount_amount: number
  fine_amount: number
  paid_amount: number
  due_amount: number
  status: 'paid' | 'partial' | 'pending'
  payment_method: string
  transaction_id: string | null
  transaction_type: 'regular' | 'advance' | 'adjustment'
  collected_by: string | null
  remarks: string | null
  created_at: string
}

export interface MonthlySummary {
  total_collected: number
  total_discount: number
  total_fine: number
  total_transactions: number
  unique_students: number
  paid_count: number
  partial_count: number
  pending_count: number
  cash_total: number
  bkash_total: number
  nagad_total: number
  bank_total: number
  average_monthly: number
  peak_month: string
  peak_amount: number
}

export interface FilterOptions {
  year: number
  class_id?: string
  section_id?: string
  status?: string
  search?: string
}

export interface ClassOption {
  id: string
  name: string
}