// src/lib/salary/salaryService.ts
import { createClient } from "@/lib/supabase/client";
const supabase = createClient();
export interface SalaryCategory {
  id: string;
  name: string;
  basic: number;
  hra: number;
  da: number;
  allowances: number;
  deductions: number;
}

export interface StaffSalaryView {
  staff_id: string;
  staff_name: string;
  employee_id: string;
  designation: string;
  photo_url: string;
  status: string;
  salary_id: string;
  salary_category_id: string;
  category_name: string;
  basic: number;
  hra: number;
  da: number;
  allowances: number;
  personal_allowance: number;
  special_allowance: number;
  other_deductions: number;
  total_salary: number;
  effective_from: string;
  is_current: boolean;
  version: number;
}

export interface PayrollReportRPCResponse {
  total_staff: number;
  total_demand: number;
  total_paid: number;
  total_due: number;
}

export const salaryService = {
  /**
   * Fetch all staff salaries with optional filters
   */
  async getAllStaffSalaries(params?: {
    category?: string;
    status?: string;
    search?: string;
  }): Promise<StaffSalaryView[]> {
    let query = supabase.from("v_staff_salaries").select("*");

    if (params?.category && params.category !== "all") {
      query = query.eq("category_name", params.category);
    }

    if (params?.status && params.status !== "all") {
      query = query.eq("status", params.status);
    }

    if (params?.search) {
      query = query.or(
        `staff_name.ilike.%${params.search}%,employee_id.ilike.%${params.search}%`
      );
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching staff salaries:", error);
      throw error;
    }

    return data || [];
  },

  /**
   * Fetch all salary categories
   */
  async getSalaryCategories(): Promise<SalaryCategory[]> {
    const { data, error } = await supabase
      .from("salary_categories")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching salary categories:", error);
      throw error;
    }

    return data || [];
  },

  /**
   * Insert or update a staff member's individual salary structure
   */
  async upsertSalary(
    staffId: string,
    salaryComponents: {
      basic: number;
      hra: number;
      da: number;
      allowances: number;
      personal_allowance: number;
      special_allowance: number;
      other_deductions: number;
    },
    effectiveFrom: string,
    userId?: string,
    reason?: string
  ) {
    const { data, error } = await supabase.rpc("upsert_staff_salary", {
      p_staff_id: staffId,
      p_basic: salaryComponents.basic,
      p_hra: salaryComponents.hra,
      p_da: salaryComponents.da,
      p_allowances: salaryComponents.allowances,
      p_personal_allowance: salaryComponents.personal_allowance,
      p_special_allowance: salaryComponents.special_allowance,
      p_other_deductions: salaryComponents.other_deductions,
      p_effective_from: effectiveFrom,
      p_created_by: userId,
      p_reason: reason,
    });

    if (error) {
      console.error("Error upserting staff salary:", error);
      throw error;
    }

    return data;
  },

  /**
   * Bulk setup salaries for active staff without salary structure
   */
  async bulkSetupSalaries(
    categoryId?: string,
    statusId?: string,
    userId?: string
  ) {
    const { data, error } = await supabase.rpc("bulk_setup_staff_salaries", {
      p_category_id: categoryId || null,
      p_user_id: userId || null,
    });

    if (error) {
      console.error("Error running bulk setup:", error);
      throw error;
    }

    return data;
  },

  /**
   * Fetch salary version history for a specific staff member
   */
  async getSalaryHistory(staffId: string) {
    const { data, error } = await supabase
      .from("staff_salary_history")
      .select("*")
      .eq("staff_id", staffId)
      .order("changed_at", { ascending: false });

    if (error) {
      console.error("Error fetching salary history:", error);
      throw error;
    }

    return data || [];
  },

  /**
   * Fetch payslip data for single staff
   */
  async fetchStaffPayslipData(staffId: string, monthIndex: number, year: number) {
    const { data, error } = await supabase.rpc("get_staff_payslip_data", {
      p_staff_id: staffId,
      p_month: monthIndex,
      p_year: year,
    });

    if (error) {
      console.error("Error fetching payslip data:", error);
      throw error;
    }

    return data;
  },

  /**
   * Fetch monthly payroll report data
   */
  async fetchMonthlyPayrollReport(monthIndex: number, year: number): Promise<PayrollReportRPCResponse> {
    const { data, error } = await supabase.rpc("get_monthly_payroll_report", {
      p_month: monthIndex,
      p_year: year,
    });

    if (error) {
      console.error("Error fetching monthly payroll report:", error);
      throw error;
    }

    // RPC may return array or single object
    const row = Array.isArray(data) ? data[0] : data;

    // Map RPC field names to PayrollReportCard's expected shape
    return {
      total_staff: row?.total_staff ?? 0,
      total_demand: row?.total_payroll_payable ?? 0,
      total_paid: row?.total_paid_amount ?? 0,
      total_due: row?.total_due_amount ?? 0,
    };
  },
};

/**
 * Named export wrapper for PayrollReportCard
 * Delegates to salaryService.fetchMonthlyPayrollReport with field mapping
 */
export async function fetchMonthlyPayrollReport(month: number, year: number): Promise<PayrollReportRPCResponse> {
  return salaryService.fetchMonthlyPayrollReport(month, year);
}

export default salaryService;