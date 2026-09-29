// ERP Standard Salary Types
export interface SalaryBalance {
  id: string;
  staff_id: string;
  month: string;
  year: number;
  expected_salary: number;
  paid_amount: number;
  balance: number;
  status: 'pending' | 'partial' | 'paid' | 'overpaid';
  created_at: string;
}

export interface SalaryAdvance {
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

export interface SalaryIncrement {
  id: string;
  staff_id: string;
  old_salary: number;
  new_salary: number;
  increment_percentage: number;
  effective_from: string;
  reason: string | null;
}

export interface SalaryPromotion {
  id: string;
  staff_id: string;
  old_designation: string;
  new_designation: string;
  old_salary_category_id: string;
  new_salary_category_id: string;
  effective_from: string;
  increment_amount: number;
}

export interface StaffBalanceSheet {
  staff_id: string;
  staff_name: string;
  staff_employee_id: string;
  staff_designation: string;
  total_expected: number;
  total_paid: number;
  total_balance: number;
  total_advance: number;
  monthly_breakdown: MonthlyBalance[];
}

export interface MonthlyBalance {
  month: string;
  year: number;
  expected: number;
  paid: number;
  balance: number;
  status: string;
}