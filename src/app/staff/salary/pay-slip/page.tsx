// src/app/staff/salary/pay-slip/page.tsx
"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, Download, Printer, Calendar, 
  Search, Eye, User, Mail, Phone, FileText, DollarSign,
  Users, TrendingUp, TrendingDown, CheckCircle, XCircle,
  Loader2, Plus, Trash2, Edit, RefreshCw, AlertCircle,
  UserCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ResponsiveLayout } from "@/components/layout/responsive-layout";
import { getStaff } from "@/lib/api/staff";
import { createClient } from "@/lib/supabase/client";
import { months, getCurrentMonth, getCurrentYear, formatCurrency } from "@/lib/salary/salaryUtils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { motion } from "framer-motion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useToastStore } from "@/store/useStore";
import { getSchoolPrintHeader } from "@/components/print/SchoolPrintHeader";

// ============================================================
// TYPES
// ============================================================

interface PaySlipData {
  staff_id: string;
  staff_name: string;
  staff_employee_id: string;
  staff_designation: string;
  staff_photo_url?: string;
  staff_email?: string;
  staff_phone?: string;
  staff_address?: string;
  joining_date?: string;
  bank_name?: string;
  account_number?: string;
  month: string;
  year: number;
  // Earnings components
  basic: number;
  hra: number;
  da: number;
  allowances: number;
  personal_allowance: number;
  special_allowance: number;
  total_earnings: number;
  // Deductions
  other_deductions: number;
  advance_deduction: number;
  total_deductions: number;
  // Net salary (calculated)
  net_salary: number;
  // Payment info (if any)
  payment_date?: string;
  payment_method?: string;
  paid_amount: number;       // actual amount paid (from salary_payments)
  in_words: string;
  is_paid: boolean;
  is_pro_rata?: boolean;
  full_salary?: number;
}

interface SchoolSettings {
  id: number;
  school_name: string;
  school_address: string;
  school_phone: string;
  school_email: string;
  school_logo: string;
  school_watermark: string;
  created_at: string;
  updated_at: string;
}

// ============================================================
// NUMBER INPUT WITH BENGALI SUPPORT
// ============================================================

const convertBengaliToEnglish = (str: string): string => {
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  const englishDigits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  
  let result = '';
  for (let char of str) {
    const index = bengaliDigits.indexOf(char);
    if (index !== -1) {
      result += englishDigits[index];
    } else {
      result += char;
    }
  }
  return result;
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function PaySlipPage() {
  const router = useRouter();
  const addToast = useToastStore((state) => state.addToast);
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStaff, setSelectedStaff] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [selectedYear, setSelectedYear] = useState(getCurrentYear().toString());
  const [paySlipData, setPaySlipData] = useState<PaySlipData | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const payslipRef = useRef<HTMLDivElement>(null);

  // Bulk Pay Slip States
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkMonth, setBulkMonth] = useState(getCurrentMonth());
  const [bulkYear, setBulkYear] = useState(getCurrentYear().toString());
  const [bulkStaffList, setBulkStaffList] = useState<any[]>([]);
  const [bulkSelectedStaff, setBulkSelectedStaff] = useState<string[]>([]);
  const [bulkSelectAll, setBulkSelectAll] = useState(false);
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ total: 0, completed: 0, failed: 0 });
  const [bulkResults, setBulkResults] = useState<{ staff_id: string; name: string; success: boolean; error?: string }[]>([]);
  const [bulkGeneratedData, setBulkGeneratedData] = useState<PaySlipData[]>([]);
  const [bulkPrintReady, setBulkPrintReady] = useState(false);

  // ============================================================
  // LOAD FUNCTIONS
  // ============================================================

  const loadSchoolSettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("school_settings")
        .select("*")
        .limit(1)
        .single();
      
      if (error || !data) {
        setSchoolSettings({
          id: 0,
          school_name: "চে আলী মডেল একাডেমী",
          school_address: "Nowtala, Madhaiya Bazar, Chandina, Cumilla",
          school_phone: "01923253454",
          school_email: "shapla.kindergarten@gmail.com",
          school_logo: "",
          school_watermark: "",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      } else {
        setSchoolSettings(data);
      }
    } catch (error) {
      console.error("Error loading school settings:", error);
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  const loadStaff = useCallback(async () => {
    setLoading(true);
    try {
      const staffData = await getStaff();
      setStaff(staffData || []);
    } catch (err) {
      console.error("Failed to load staff:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBulkStaff = useCallback(async () => {
    setLoading(true);
    try {
      const staffData = await getStaff();
      const filteredStaff = (staffData || []).filter(s => 
        s.salary_category_id || s.salary_category
      );

      setBulkStaffList(filteredStaff);
      setBulkSelectedStaff([]);
      setBulkSelectAll(false);
      setBulkResults([]);
      setBulkGeneratedData([]);
      setBulkPrintReady(false);
      
      if (filteredStaff.length === 0) {
        addToast({
          type: "warning",
          title: "No Staff Found",
          message: `No staff found with salary structure for ${bulkMonth} ${bulkYear}`
        });
      }
    } catch (err) {
      console.error("Failed to load bulk staff:", err);
      addToast({
        type: "error",
        title: "Error",
        message: "Failed to load staff data"
      });
    } finally {
      setLoading(false);
    }
  }, [bulkMonth, bulkYear, addToast]);

  useEffect(() => {
    loadStaff();
    loadSchoolSettings();
  }, [loadStaff, loadSchoolSettings]);

  // ============================================================
  // GENERATE PAY SLIP
  // ============================================================

  const numberToWords = (num: number): string => {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    
    const convert = (n: number): string => {
      if (n === 0) return '';
      if (n < 10) return ones[n];
      if (n < 20) return teens[n - 10];
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
      if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '');
      if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
      return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
    };
    
    const taka = Math.floor(num);
    const paisa = Math.round((num - taka) * 100);
    let result = convert(taka) + ' Taka';
    if (paisa > 0) result += ' and ' + convert(paisa) + ' Paisa';
    return result || 'Zero Taka';
  };

  // ---------- FIXED: generatePaySlipForStaff ----------
  const generatePaySlipForStaff = useCallback(async (staffId: string, month: string, year: number): Promise<PaySlipData | null> => {
    try {
      const supabase = createClient();
      const staffMember = staff.find(s => s.id === staffId);
      if (!staffMember) {
        console.error("Staff member not found:", staffId);
        return null;
      }

      // Get staff salary
      let staffSalary = null;
      try {
        const { data, error } = await supabase
          .from("staff_salaries")
          .select("*")
          .eq("staff_id", staffId)
          .maybeSingle();
        if (error) console.warn("Salary fetch warning:", error.message);
        else staffSalary = data;
      } catch (err) { console.warn("Salary fetch error:", err); }

      const category = staffMember?.salary_category;

      const basic = staffSalary?.basic || category?.basic || 0;
      const hra = staffSalary?.hra || category?.hra || 0;
      const da = staffSalary?.da || category?.da || 0;
      const allowances = staffSalary?.allowances || category?.allowances || 0;
      const personalAllowance = staffSalary?.personal_allowance || 0;
      const specialAllowance = staffSalary?.special_allowance || 0;
      const otherDeductions = staffSalary?.other_deductions || 0;

      // ✅ FIX: Check if month is before joining (staff not yet eligible)
      const joiningDate = staffMember.joining_date ? new Date(staffMember.joining_date) : null;
      const monthStart = new Date(year, months.indexOf(month), 1);
      if (joiningDate && monthStart < joiningDate) {
        return null;
      }

      // ✅ FIX: Fetch salary_balances for the specific month (has business-rule applied expected_salary)
      let balanceData = null;
      try {
        const { data, error } = await supabase
          .from("salary_balances")
          .select("expected_salary, paid_amount, due_amount, status, due_date")
          .eq("staff_id", staffId)
          .eq("month", month)
          .eq("year", year)
          .maybeSingle();
        if (error) console.warn("Balance fetch warning:", error.message);
        else balanceData = data;
      } catch (err) { console.warn("Balance fetch error:", err); }

      // Get payment (if any)
      let payment = null;
      try {
        const { data, error } = await supabase
          .from("salary_payments")
          .select("*")
          .eq("staff_id", staffId)
          .eq("month", month)
          .eq("year", year)
          .maybeSingle();
        if (error) console.warn("Payment fetch warning:", error.message);
        else payment = data;
      } catch (err) { console.warn("Payment fetch error:", err); }

      // Get advances
      let advances = [];
      try {
        const { data, error } = await supabase
          .from("salary_advances")
          .select("*")
          .eq("staff_id", staffId)
          .eq("status", "active");
        if (error) console.warn("Advance fetch warning:", error.message);
        else advances = data || [];
      } catch (err) { console.warn("Advance fetch error:", err); }

      const advanceDeduction = advances.reduce((sum, a) => sum + (a.installment_amount || 0), 0);

      // Display-only full structure total
      const fullEarnings = basic + hra + da + allowances + personalAllowance + specialAllowance;

      // ✅ FIX: Use balance.expected_salary (pro-rata applied) if available
      // Otherwise fall back to full structure total
      const totalEarnings = balanceData?.expected_salary || fullEarnings;
      // Use small tolerance (0.01) to avoid floating-point false positive.
      // is_pro_rata is only true when the difference is meaningfully > 0.
      const isProRata = !!balanceData && 
        (fullEarnings - Number(balanceData.expected_salary)) > 0.01;
      const totalDeductions = otherDeductions + advanceDeduction;
      const netSalary = totalEarnings - totalDeductions;

      const isPaid = !!payment;
      const paidAmount = payment?.amount || 0; // This is the net salary paid

      return {
        staff_id: staffMember.id,
        staff_name: staffMember.name || "",
        staff_employee_id: staffMember.employee_id || "",
        staff_designation: staffMember.designation || "",
        staff_photo_url: staffMember.photo_url || "",
        staff_email: staffMember.email || "",
        staff_phone: staffMember.phone || "",
        staff_address: staffMember.address || "",
        joining_date: staffMember.joining_date || "",
        bank_name: staffMember.bank_name || "",
        account_number: staffMember.account_number || "",
        month,
        year,
        basic,
        hra,
        da,
        allowances,
        personal_allowance: personalAllowance,
        special_allowance: specialAllowance,
        total_earnings: totalEarnings,
        other_deductions: otherDeductions,
        advance_deduction: advanceDeduction,
        total_deductions: totalDeductions,
        net_salary: netSalary,
        payment_date: payment?.payment_date,
        payment_method: payment?.payment_method,
        paid_amount: paidAmount,
          // Show words only for paid salaries; otherwise mark as Not Paid Yet
          in_words: isPaid ? numberToWords(netSalary) : 'Not Paid Yet',
          is_paid: isPaid,
          is_pro_rata: isProRata,
          full_salary: fullEarnings,
      };
    } catch (err) {
      console.error("Failed to generate pay slip for staff:", err);
      return null;
    }
  }, [staff]);

  const generatePaySlip = useCallback(async () => {
    if (!selectedStaff) {
      addToast({
        type: "error",
        title: "Error",
        message: "Please select a staff member"
      });
      return;
    }

    setLoading(true);
    try {
      const data = await generatePaySlipForStaff(selectedStaff, selectedMonth, parseInt(selectedYear));
      if (data) {
        setPaySlipData(data);
        setShowPreview(true);
        addToast({
          type: "success",
          title: "Success",
          message: "Pay slip generated successfully"
        });
      } else {
        addToast({
          type: "error",
          title: "Error",
          message: "Failed to generate pay slip"
        });
      }
    } catch (err) {
      console.error("Failed to generate pay slip:", err);
      addToast({
        type: "error",
        title: "Error",
        message: "Failed to generate pay slip"
      });
    } finally {
      setLoading(false);
    }
  }, [selectedStaff, selectedMonth, selectedYear, generatePaySlipForStaff, addToast]);

  // ============================================================
  // BULK PAY SLIP GENERATION
  // ============================================================

  const handleBulkGenerate = useCallback(async () => {
    if (bulkSelectedStaff.length === 0) {
      addToast({
        type: "error",
        title: "Error",
        message: "Please select at least one staff member"
      });
      return;
    }

    setIsBulkGenerating(true);
    setBulkProgress({ total: bulkSelectedStaff.length, completed: 0, failed: 0 });
    setBulkResults([]);
    setBulkGeneratedData([]);
    setBulkPrintReady(false);

    let completed = 0;
    let failed = 0;
    const results: { staff_id: string; name: string; success: boolean; error?: string }[] = [];
    const generatedSlips: PaySlipData[] = [];

    const generatePromises = bulkSelectedStaff.map(async (staffId) => {
      try {
        const staffMember = staff.find(s => s.id === staffId);
        const data = await generatePaySlipForStaff(staffId, bulkMonth, parseInt(bulkYear));
        if (data) {
          completed++;
          results.push({ staff_id: staffId, name: staffMember?.name || 'Unknown', success: true });
          generatedSlips.push(data);
        } else {
          failed++;
          results.push({ 
            staff_id: staffId, 
            name: staffMember?.name || 'Unknown', 
            success: false, 
            error: "Failed to generate pay slip" 
          });
        }
      } catch (err) {
        failed++;
        const staffMember = staff.find(s => s.id === staffId);
        results.push({ 
          staff_id: staffId, 
          name: staffMember?.name || 'Unknown', 
          success: false, 
          error: err instanceof Error ? err.message : "Unknown error" 
        });
      }
    });

    await Promise.all(generatePromises);

    setBulkGeneratedData(generatedSlips);
    setBulkProgress({ total: bulkSelectedStaff.length, completed, failed });
    setBulkResults(results);
    setIsBulkGenerating(false);

    if (completed > 0) {
      setBulkPrintReady(true);
      addToast({
        type: "success",
        title: "Bulk Pay Slip Generated",
        message: `${completed} pay slips generated successfully! ${failed > 0 ? `${failed} failed` : ''}`
      });
    } else {
      addToast({
        type: "error",
        title: "Generation Failed",
        message: "Failed to generate any pay slips"
      });
    }
  }, [bulkSelectedStaff, bulkMonth, bulkYear, staff, generatePaySlipForStaff, addToast]);

  // ============================================================
  // BULK PRINT FUNCTION - FIXED columns
  // ============================================================

  const handleBulkPrint = useCallback(() => {
    if (bulkGeneratedData.length === 0) {
      addToast({
        type: "error",
        title: "Error",
        message: "No pay slips to print"
      });
      return;
    }

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      addToast({
        type: "error",
        title: "Popup Blocked",
        message: "Please allow pop-ups for this site"
      });
      return;
    }

    let allSlipsHTML = '';

    bulkGeneratedData.forEach((data, index) => {
      const isLast = index === bulkGeneratedData.length - 1;
      
      const paymentDate = data.payment_date 
        ? new Date(data.payment_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
        : 'Not Paid Yet';
      
      const paymentMethod = data.payment_method 
        ? data.payment_method.charAt(0).toUpperCase() + data.payment_method.slice(1) 
        : 'N/A';
      
      const bankName = data.bank_name || 'N/A';
      const accountNumber = data.account_number || 'N/A';
      
      // Earnings items
      const earningsItems = [
        { sl: 1, desc: 'Basic Salary', expected: data.basic, paid: data.is_paid ? data.basic : null },
        { sl: 2, desc: 'House Rent Allowance (HRA)', expected: data.hra, paid: data.is_paid ? data.hra : null },
        { sl: 3, desc: 'Dearness Allowance (DA)', expected: data.da, paid: data.is_paid ? data.da : null },
        { sl: 4, desc: 'Other Allowances', expected: data.allowances, paid: data.is_paid ? data.allowances : null },
        { sl: 5, desc: 'Personal Allowance', expected: data.personal_allowance, paid: data.is_paid ? data.personal_allowance : null },
        { sl: 6, desc: 'Special Allowance', expected: data.special_allowance, paid: data.is_paid ? data.special_allowance : null },
      ];
      
      const earningsRows = earningsItems.map(item => `
        <tr>
          <td style="text-align:center;">${item.sl}</td>
          <td>${item.desc}</td>
          <td style="text-align:right;">BDT ${item.expected.toLocaleString()}</td>
          <td style="text-align:right;">
            ${item.paid !== null ? `BDT ${item.paid.toLocaleString()}` : '<span style="color:red;">Not Paid Yet</span>'}
          </td>
        </tr>
      `).join('');

      // Deductions items
      const deductionsItems = [
        { sl: 1, desc: 'Other Deductions', expected: data.other_deductions, actual: data.is_paid ? data.other_deductions : null },
        { sl: 2, desc: 'Advance / Loan Deduction', expected: data.advance_deduction, actual: data.is_paid ? data.advance_deduction : null },
      ];
      
      const deductionsRows = deductionsItems.map(item => `
        <tr>
          <td style="text-align:center;">${item.sl}</td>
          <td>${item.desc}</td>
          <td style="text-align:right;">BDT ${item.expected.toLocaleString()}</td>
          <td style="text-align:right;">
            ${item.actual !== null ? `BDT ${item.actual.toLocaleString()}` : '<span style="color:red;">Not Paid Yet</span>'}
          </td>
        </tr>
      `).join('');

      allSlipsHTML += `
        <div class="pay-slip-container" style="page-break-after: ${isLast ? 'avoid' : 'always'};">
          ${getSchoolPrintHeader(
            { school_logo: schoolSettings?.school_logo, school_name: schoolSettings?.school_name, school_address: schoolSettings?.school_address, school_phone: schoolSettings?.school_phone, school_email: schoolSettings?.school_email },
            "SALARY PAY SLIP"
          )}

          <div class="pay-slip-subtitle">${data.month} ${data.year}</div>

          <div class="staff-info">
            <div class="staff-info-grid">
              <div class="staff-info-item"><strong>Name:</strong> <span class="value">${data.staff_name}</span></div>
              <div class="staff-info-item"><strong>ID:</strong> <span class="value">${data.staff_employee_id}</span></div>
              <div class="staff-info-item"><strong>Designation:</strong> <span class="value">${data.staff_designation}</span></div>
              <div class="staff-info-item"><strong>Email:</strong> <span class="value">${data.staff_email || 'N/A'}</span></div>
              <div class="staff-info-item"><strong>Phone:</strong> <span class="value">${data.staff_phone || 'N/A'}</span></div>
              <div class="staff-info-item"><strong>Joining:</strong> <span class="value">${data.joining_date ? new Date(data.joining_date).toLocaleDateString() : 'N/A'}</span></div>
            </div>
          </div>

          <div class="section-title">Earnings</div>
          <table>
            <thead>
              <tr>
                <th style="width:8%;">SL</th>
                <th style="width:42%;">Pay Type / Description</th>
                <th style="width:25%; text-align:right;">Expected Amount</th>
                <th style="width:25%; text-align:right;">Paid Amount</th>
              </tr>
            </thead>
            <tbody>
              ${earningsRows}
              <tr class="total-row">
                <td colspan="2" style="text-align:right;">Total Earnings</td>
                <td style="text-align:right; font-weight:bold;">BDT ${data.total_earnings.toLocaleString()}</td>
                <td style="text-align:right; font-weight:bold;">
                  ${data.is_paid ? `BDT ${data.total_earnings.toLocaleString()}` : '<span style="color:red;">Not Paid Yet</span>'}
                </td>
              </tr>
            </tbody>
          </table>

          <div class="section-title">Deductions</div>
          <table>
            <thead>
              <tr>
                <th style="width:8%;">SL</th>
                <th style="width:42%;">Description</th>
                <th style="width:25%; text-align:right;">Expected Deductions</th>
                <th style="width:25%; text-align:right;">Deductions</th>
              </tr>
            </thead>
            <tbody>
              ${deductionsRows}
              <tr class="total-row">
                <td colspan="2" style="text-align:right;">Total Deductions</td>
                <td style="text-align:right; font-weight:bold;">BDT ${data.total_deductions.toLocaleString()}</td>
                <td style="text-align:right; font-weight:bold;">
                  ${data.is_paid ? `BDT ${data.total_deductions.toLocaleString()}` : '<span style="color:red;">Not Paid Yet</span>'}
                </td>
              </tr>
            </tbody>
          </table>

          <div class="net-salary-box">
            <span class="label">Net Salary</span>
            <span class="value">
              ${data.is_paid ? `BDT ${data.net_salary.toLocaleString()}` : '<span style="color:red;">Not Paid Yet</span>'}
            </span>
          </div>

          <div class="in-words">In Words: ${data.is_paid ? data.in_words : '<span style="color:red;">Not Paid Yet</span>'}</div>

          <div class="payment-info">
            <div class="payment-info-item"><strong>Payment Date:</strong> ${paymentDate}</div>
            <div class="payment-info-item"><strong>Payment Method:</strong> ${paymentMethod}</div>
            <div class="payment-info-item"><strong>Bank Name:</strong> ${bankName}</div>
            <div class="payment-info-item"><strong>Account Number:</strong> ${accountNumber}</div>
          </div>

          <div class="footer">
            ${schoolSettings?.school_name || 'Kindergarten School'} &nbsp;|&nbsp; Page ${index + 1} of ${bulkGeneratedData.length} &nbsp;|&nbsp; ${new Date().toLocaleDateString()}
          </div>
        </div>
      `;
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bulk Pay Slips - ${bulkGeneratedData.length} Staff</title>
          <style>
            @font-face { font-family: 'NotoSansBengali'; src: url('/fonts/NotoSansBengali-Regular.ttf') format('truetype'); font-weight: normal; font-style: normal; }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: 'NotoSansBengali', Arial, sans-serif; 
              margin: 0; 
              padding: 10mm 8mm;
              background: white;
              width: 210mm;
              min-height: 297mm;
              margin: 0 auto;
            }
            .pay-slip-container {
              margin-bottom: 20px;
              padding-bottom: 20px;
            }
            .pay-slip-title {
              text-align: center;
              margin-top: 8px;
              margin-bottom: 4px;
              font-size: 18px;
              font-weight: bold;
              color: #1a1a2e;
            }
            .pay-slip-subtitle {
              text-align: center;
              font-size: 11px;
              color: #666;
              margin-bottom: 8px;
            }
            .staff-info {
              background: #f8fafc;
              padding: 10px 14px;
              border-radius: 6px;
              margin-bottom: 12px;
              border: 1px solid #e2e8f0;
            }
            .staff-info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr 1fr;
              gap: 8px;
            }
            .staff-info-item {
              font-size: 10px;
            }
            .staff-info-item strong {
              color: #475569;
            }
            .staff-info-item .value {
              font-weight: 600;
              color: #1a1a2e;
            }
            .section-title {
              font-size: 12px;
              font-weight: bold;
              margin: 10px 0 6px 0;
              color: #1a1a2e;
              border-bottom: 1px solid #e2e8f0;
              padding-bottom: 4px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 4px;
              font-size: 9px;
            }
            th {
              background-color: #4f46e5;
              color: white;
              font-weight: bold;
              padding: 4px 6px;
              border: 1px solid #4f46e5;
              text-align: center;
            }
            td {
              padding: 4px 6px;
              border: 1px solid #ddd;
              text-align: left;
              vertical-align: middle;
            }
            td.amount {
              text-align: right;
              font-weight: 600;
            }
            td.total-amount {
              text-align: right;
              font-weight: bold;
              font-size: 11px;
            }
            .total-row {
              background: #f1f5f9;
              font-weight: bold;
            }
            .net-salary-box {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 12px 16px;
              background: #eff6ff;
              border-radius: 8px;
              border: 2px solid #4f46e5;
              margin: 10px 0;
            }
            .net-salary-box .label {
              font-size: 14px;
              font-weight: bold;
              color: #1a1a2e;
            }
            .net-salary-box .value {
              font-size: 20px;
              font-weight: bold;
              color: #4f46e5;
            }
            .in-words {
              font-size: 9px;
              color: #475569;
              font-style: italic;
              margin: 6px 0;
              padding: 6px;
              background: #f1f5f9;
              border-radius: 4px;
            }
            .payment-info {
              display: grid;
              grid-template-columns: 1fr 1fr 1fr 1fr;
              gap: 8px;
              margin: 10px 0;
              padding: 8px;
              background: #f8fafc;
              border-radius: 6px;
            }
            .payment-info-item {
              font-size: 9px;
            }
            .payment-info-item strong {
              color: #475569;
            }
            .footer {
              margin-top: 15px;
              padding-top: 8px;
              border-top: 1px solid #e5e7eb;
              font-size: 8px;
              color: #999;
              text-align: center;
            }
            @media print {
              body { padding: 10mm 8mm; width: 100%; min-height: 100vh; }
              th { background-color: #4f46e5 !important; color: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              .staff-info { background: #f8fafc !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              .net-salary-box { background: #eff6ff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              .payment-info { background: #f8fafc !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              .pay-slip-container { page-break-after: always; }
              .pay-slip-container:last-child { page-break-after: avoid; }
            }
            @page { 
              size: A4; 
              margin: 10mm 8mm;
            }
          </style>
        </head>
        <body>
          ${allSlipsHTML}
          <script>
            window.onload = function() {
              setTimeout(function() {
                try { window.focus(); } catch(e){}
                window.print();
              }, 200);
            }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }, [bulkGeneratedData, schoolSettings, addToast]);

  const toggleStaffSelection = (staffId: string) => {
    if (isBulkGenerating || bulkPrintReady) return;
    setBulkSelectedStaff(prev => 
      prev.includes(staffId) 
        ? prev.filter(id => id !== staffId)
        : [...prev, staffId]
    );
  };

  const toggleAllStaff = () => {
    if (isBulkGenerating || bulkPrintReady) return;
    if (bulkSelectAll) {
      setBulkSelectedStaff([]);
      setBulkSelectAll(false);
    } else {
      setBulkSelectedStaff(bulkStaffList.map(s => s.id));
      setBulkSelectAll(true);
    }
  };

  // ============================================================
  // PDF EXPORT - FIXED columns
  // ============================================================

  const handleDownloadPDF = useCallback(async () => {
    if (!paySlipData) return;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });
    
    const margin = 14;
    const pageWidth = 210;
    const centerX = pageWidth / 2;
    let yOffset = margin;
    
    const settings = schoolSettings || {
      school_name: "চে আলী মডেল একাডেমী",
      school_address: "Nowtala, Madhaiya Bazar, Chandina, Cumilla",
      school_phone: "01923253454",
      school_email: "shapla.kindergarten@gmail.com",
      school_logo: "",
    };
    
    // ===== HEADER =====
    let logoHeight = 0;
    let logoWidth = 0;
    
    if (settings?.school_logo) {
      try {
        const img = new Image();
        img.src = settings.school_logo;
        await new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        });
        logoWidth = 20;
        logoHeight = 20;
        doc.addImage(settings.school_logo, 'PNG', margin, yOffset, logoWidth, logoHeight);
      } catch (err) {
        console.error("Logo load error:", err);
      }
    }
    
    let textY = yOffset + 3;
    
    if (settings?.school_name) {
      doc.setFontSize(14);
      doc.setTextColor(99, 102, 241);
      doc.text(settings.school_name, centerX, textY, { align: 'center' });
      textY += 6;
    }
    
    if (settings?.school_address) {
      doc.setFontSize(8);
      doc.setTextColor(80, 80, 80);
      const addressLines = doc.splitTextToSize(settings.school_address, pageWidth - margin - 30);
      doc.text(addressLines, centerX, textY, { align: 'center' });
      textY += (addressLines.length * 4) + 1;
    }
    
    let contactText = "";
    if (settings?.school_phone) contactText += `Tel: ${settings.school_phone}`;
    if (settings?.school_email) {
      if (contactText) contactText += ` | `;
      contactText += `Email: ${settings.school_email}`;
    }
    if (contactText) {
      doc.setFontSize(7);
      doc.setTextColor(120, 120, 120);
      doc.text(contactText, centerX, textY, { align: 'center' });
      textY += 4;
    }
    
    yOffset = Math.max(yOffset + logoHeight + 2, textY + 2);
    
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yOffset, pageWidth - margin, yOffset);
    yOffset += 6;
    
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text("SALARY PAY SLIP", centerX, yOffset, { align: 'center' });
    yOffset += 6;
    
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text(`${paySlipData.month} ${paySlipData.year}`, centerX, yOffset, { align: 'center' });
    yOffset += 8;
    
    // Staff Information
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text("Staff Information", margin, yOffset);
    yOffset += 5;
    
    const staffInfo = [
      ["Name:", paySlipData.staff_name],
      ["Employee ID:", paySlipData.staff_employee_id],
      ["Designation:", paySlipData.staff_designation],
      ["Email:", paySlipData.staff_email || "N/A"],
      ["Phone:", paySlipData.staff_phone || "N/A"],
      ["Joining Date:", paySlipData.joining_date ? new Date(paySlipData.joining_date).toLocaleDateString() : "N/A"],
    ];
    
    autoTable(doc, {
      body: staffInfo,
      startY: yOffset,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 35 }, 1: { cellWidth: 'auto' } },
      theme: 'plain',
    });
    
    yOffset = (doc as any).lastAutoTable.finalY + 5;
    
    // Earnings Table - updated columns
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text("Earnings", margin, yOffset);
    yOffset += 4;
    
    const earningsData = [
      ["1", "Basic Salary", `BDT ${paySlipData.basic.toLocaleString()}`, paySlipData.is_paid ? `BDT ${paySlipData.basic.toLocaleString()}` : "Not Paid Yet"],
      ["2", "House Rent Allowance (HRA)", `BDT ${paySlipData.hra.toLocaleString()}`, paySlipData.is_paid ? `BDT ${paySlipData.hra.toLocaleString()}` : "Not Paid Yet"],
      ["3", "Dearness Allowance (DA)", `BDT ${paySlipData.da.toLocaleString()}`, paySlipData.is_paid ? `BDT ${paySlipData.da.toLocaleString()}` : "Not Paid Yet"],
      ["4", "Other Allowances", `BDT ${paySlipData.allowances.toLocaleString()}`, paySlipData.is_paid ? `BDT ${paySlipData.allowances.toLocaleString()}` : "Not Paid Yet"],
      ["5", "Personal Allowance", `BDT ${paySlipData.personal_allowance.toLocaleString()}`, paySlipData.is_paid ? `BDT ${paySlipData.personal_allowance.toLocaleString()}` : "Not Paid Yet"],
      ["6", "Special Allowance", `BDT ${paySlipData.special_allowance.toLocaleString()}`, paySlipData.is_paid ? `BDT ${paySlipData.special_allowance.toLocaleString()}` : "Not Paid Yet"],
    ];
    
    autoTable(doc, {
      head: [["SL", "Pay Type / Description", "Expected Amount", "Paid Amount"]],
      body: earningsData,
      startY: yOffset,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 1: { cellWidth: 70 }, 2: { cellWidth: 35, halign: 'right' }, 3: { cellWidth: 35, halign: 'right' } },
      headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255] },
      theme: 'striped',
    });
    
    yOffset = (doc as any).lastAutoTable.finalY + 5;
    
    // Total Earnings
    autoTable(doc, {
      body: [["", "Total Earnings", `BDT ${paySlipData.total_earnings.toLocaleString()}`, paySlipData.is_paid ? `BDT ${paySlipData.total_earnings.toLocaleString()}` : "Not Paid Yet"]],
      startY: yOffset,
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, fontStyle: 'bold', cellPadding: 2 },
      columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 70 }, 2: { cellWidth: 35, halign: 'right' }, 3: { cellWidth: 35, halign: 'right' } },
      theme: 'plain',
    });
    
    yOffset = (doc as any).lastAutoTable.finalY + 5;
    
    // Deductions Table
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text("Deductions", margin, yOffset);
    yOffset += 4;
    
    const deductionsData = [
      ["1", "Other Deductions", `BDT ${paySlipData.other_deductions.toLocaleString()}`, paySlipData.is_paid ? `BDT ${paySlipData.other_deductions.toLocaleString()}` : "Not Paid Yet"],
      ["2", "Advance / Loan Deduction", `BDT ${paySlipData.advance_deduction.toLocaleString()}`, paySlipData.is_paid ? `BDT ${paySlipData.advance_deduction.toLocaleString()}` : "Not Paid Yet"],
    ];
    
    autoTable(doc, {
      head: [["SL", "Description", "Expected Deductions", "Deductions"]],
      body: deductionsData,
      startY: yOffset,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 1: { cellWidth: 70 }, 2: { cellWidth: 35, halign: 'right' }, 3: { cellWidth: 35, halign: 'right' } },
      headStyles: { fillColor: [239, 68, 68], textColor: [255, 255, 255] },
      theme: 'striped',
    });
    
    yOffset = (doc as any).lastAutoTable.finalY + 5;
    
    // Total Deductions
    autoTable(doc, {
      body: [["", "Total Deductions", `BDT ${paySlipData.total_deductions.toLocaleString()}`, paySlipData.is_paid ? `BDT ${paySlipData.total_deductions.toLocaleString()}` : "Not Paid Yet"]],
      startY: yOffset,
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, fontStyle: 'bold', cellPadding: 2 },
      columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 70 }, 2: { cellWidth: 35, halign: 'right' }, 3: { cellWidth: 35, halign: 'right' } },
      theme: 'plain',
    });
    
    yOffset = (doc as any).lastAutoTable.finalY + 5;
    
    // Net Salary
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text("Summary", margin, yOffset);
    yOffset += 4;
    
    autoTable(doc, {
      body: [["", "Net Salary", paySlipData.is_paid ? `BDT ${paySlipData.net_salary.toLocaleString()}` : "Not Paid Yet"]],
      startY: yOffset,
      margin: { left: margin, right: margin },
      styles: { fontSize: 11, fontStyle: 'bold', cellPadding: 3 },
      columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 70 }, 2: { cellWidth: 70, halign: 'right' } },
      theme: 'grid',
    });
    
    yOffset = (doc as any).lastAutoTable.finalY + 5;
    
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text(`In Words: ${paySlipData.in_words}`, margin, yOffset);
    yOffset += 5;
    
    // Payment Info
    const paymentDate = paySlipData.payment_date 
      ? new Date(paySlipData.payment_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : 'Not Paid Yet';
    
    const paymentMethod = paySlipData.payment_method 
      ? paySlipData.payment_method.charAt(0).toUpperCase() + paySlipData.payment_method.slice(1) 
      : 'N/A';
    
    const bankName = paySlipData.bank_name || 'N/A';
    const accountNumber = paySlipData.account_number || 'N/A';
    
    const paymentInfo = [
      ["Payment Date:", paymentDate],
      ["Payment Method:", paymentMethod],
      ["Bank Name:", bankName],
      ["Account Number:", accountNumber],
    ];
    
    autoTable(doc, {
      body: paymentInfo,
      startY: yOffset,
      margin: { left: margin, right: margin },
      styles: { fontSize: 7, cellPadding: 1.5 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 35 }, 1: { cellWidth: 'auto' } },
      theme: 'plain',
    });
    
    yOffset = (doc as any).lastAutoTable.finalY + 10;
    
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text("This is a computer generated document. No signature required.", centerX, yOffset, { align: 'center' });
    
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `${settings?.school_name || 'চে আলী মডেল একাডেমী'} | Page ${i} of ${pageCount} | ${new Date().toLocaleDateString()}`, 
        centerX, 
        doc.internal.pageSize.height - 8, 
        { align: 'center' }
      );
    }
    
    doc.save(`payslip_${paySlipData.staff_employee_id}_${selectedMonth}_${selectedYear}.pdf`);
  }, [paySlipData, schoolSettings, selectedMonth, selectedYear]);

// ============================================================
  // PRINT FUNCTION - UPDATED with getSchoolPrintHeader
  // ============================================================

  const handlePrint = useCallback(() => {
    const printContent = payslipRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.print();
      return;
    }

    if (!paySlipData) return;

    const paymentDate = paySlipData.payment_date 
      ? new Date(paySlipData.payment_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : 'Not Paid Yet';

    const paymentMethod = paySlipData.payment_method 
      ? paySlipData.payment_method.charAt(0).toUpperCase() + paySlipData.payment_method.slice(1) 
      : 'N/A';

    const bankName = paySlipData.bank_name || 'N/A';
    const accountNumber = paySlipData.account_number || 'N/A';

    // Build earnings rows
    const earningsItems = [
      { sl: 1, desc: 'Basic Salary', expected: paySlipData.basic, paid: paySlipData.is_paid ? paySlipData.basic : null },
      { sl: 2, desc: 'House Rent Allowance (HRA)', expected: paySlipData.hra, paid: paySlipData.is_paid ? paySlipData.hra : null },
      { sl: 3, desc: 'Dearness Allowance (DA)', expected: paySlipData.da, paid: paySlipData.is_paid ? paySlipData.da : null },
      { sl: 4, desc: 'Other Allowances', expected: paySlipData.allowances, paid: paySlipData.is_paid ? paySlipData.allowances : null },
      { sl: 5, desc: 'Personal Allowance', expected: paySlipData.personal_allowance, paid: paySlipData.is_paid ? paySlipData.personal_allowance : null },
      { sl: 6, desc: 'Special Allowance', expected: paySlipData.special_allowance, paid: paySlipData.is_paid ? paySlipData.special_allowance : null },
    ];
    
    const earningsRows = earningsItems.map(item => `
      <tr>
        <td style="text-align:center;">${item.sl}</td>
        <td>${item.desc}</td>
        <td style="text-align:right;">BDT ${item.expected.toLocaleString()}</td>
        <td style="text-align:right;">
          ${item.paid !== null ? `BDT ${item.paid.toLocaleString()}` : '<span style="color:red;">Not Paid Yet</span>'}
        </td>
      </tr>
    `).join('');

    // Deductions rows
    const deductionsItems = [
      { sl: 1, desc: 'Other Deductions', expected: paySlipData.other_deductions, actual: paySlipData.is_paid ? paySlipData.other_deductions : null },
      { sl: 2, desc: 'Advance / Loan Deduction', expected: paySlipData.advance_deduction, actual: paySlipData.is_paid ? paySlipData.advance_deduction : null },
    ];
    
    const deductionsRows = deductionsItems.map(item => `
      <tr>
        <td style="text-align:center;">${item.sl}</td>
        <td>${item.desc}</td>
        <td style="text-align:right;">BDT ${item.expected.toLocaleString()}</td>
        <td style="text-align:right;">
          ${item.actual !== null ? `BDT ${item.actual.toLocaleString()}` : '<span style="color:red;">Not Paid Yet</span>'}
        </td>
      </tr>
    `).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Pay Slip - ${paySlipData.staff_name}</title>
          <style>
            @font-face { font-family: 'NotoSansBengali'; src: url('/fonts/NotoSansBengali-Regular.ttf') format('truetype'); font-weight: normal; font-style: normal; }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: 'NotoSansBengali', Arial, sans-serif; 
              margin: 0; 
              padding: 10mm 8mm;
              background: white;
              width: 210mm;
              min-height: 297mm;
              margin: 0 auto;
            }
            .pay-slip-title {
              text-align: center;
              margin-top: 8px;
              margin-bottom: 4px;
              font-size: 18px;
              font-weight: bold;
              color: #1a1a2e;
            }
            .pay-slip-subtitle {
              text-align: center;
              font-size: 11px;
              color: #666;
              margin-bottom: 8px;
            }
            .staff-info {
              background: #f8fafc;
              padding: 10px 14px;
              border-radius: 6px;
              margin-bottom: 12px;
              border: 1px solid #e2e8f0;
            }
            .staff-info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr 1fr;
              gap: 8px;
            }
            .staff-info-item {
              font-size: 10px;
            }
            .staff-info-item strong {
              color: #475569;
            }
            .staff-info-item .value {
              font-weight: 600;
              color: #1a1a2e;
            }
            .section-title {
              font-size: 12px;
              font-weight: bold;
              margin: 10px 0 6px 0;
              color: #1a1a2e;
              border-bottom: 1px solid #e2e8f0;
              padding-bottom: 4px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 4px;
              font-size: 9px;
            }
            th {
              background-color: #4f46e5;
              color: white;
              font-weight: bold;
              padding: 4px 6px;
              border: 1px solid #4f46e5;
              text-align: center;
            }
            td {
              padding: 4px 6px;
              border: 1px solid #ddd;
              text-align: left;
              vertical-align: middle;
            }
            td.amount {
              text-align: right;
              font-weight: 600;
            }
            td.total-amount {
              text-align: right;
              font-weight: bold;
              font-size: 11px;
            }
            .total-row {
              background: #f1f5f9;
              font-weight: bold;
            }
            .net-salary-box {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 12px 16px;
              background: #eff6ff;
              border-radius: 8px;
              border: 2px solid #4f46e5;
              margin: 10px 0;
            }
            .net-salary-box .label {
              font-size: 14px;
              font-weight: bold;
              color: #1a1a2e;
            }
            .net-salary-box .value {
              font-size: 20px;
              font-weight: bold;
              color: #4f46e5;
            }
            .in-words {
              font-size: 9px;
              color: #475569;
              font-style: italic;
              margin: 6px 0;
              padding: 6px;
              background: #f1f5f9;
              border-radius: 4px;
            }
            .payment-info {
              display: grid;
              grid-template-columns: 1fr 1fr 1fr 1fr;
              gap: 8px;
              margin: 10px 0;
              padding: 8px;
              background: #f8fafc;
              border-radius: 6px;
            }
            .payment-info-item {
              font-size: 9px;
            }
            .payment-info-item strong {
              color: #475569;
            }
            .footer {
              margin-top: 15px;
              padding-top: 8px;
              border-top: 1px solid #e5e7eb;
              font-size: 8px;
              color: #999;
              text-align: center;
            }
            @media print {
              body { padding: 10mm 8mm; width: 100%; min-height: 100vh; }
              th { background-color: #4f46e5 !important; color: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              .staff-info { background: #f8fafc !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              .net-salary-box { background: #eff6ff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              .payment-info { background: #f8fafc !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            }
            @page { size: A4; margin: 0; }
          </style>
        </head>
        <body>
          ${getSchoolPrintHeader(
            { school_logo: schoolSettings?.school_logo, school_name: schoolSettings?.school_name, school_address: schoolSettings?.school_address, school_phone: schoolSettings?.school_phone, school_email: schoolSettings?.school_email },
            "SALARY PAY SLIP"
          )}

          <div class="pay-slip-subtitle">${paySlipData.month} ${paySlipData.year}</div>

          <div class="staff-info">
            <div class="staff-info-grid">
              <div class="staff-info-item"><strong>Name:</strong> <span class="value">${paySlipData.staff_name}</span></div>
              <div class="staff-info-item"><strong>ID:</strong> <span class="value">${paySlipData.staff_employee_id}</span></div>
              <div class="staff-info-item"><strong>Designation:</strong> <span class="value">${paySlipData.staff_designation}</span></div>
              <div class="staff-info-item"><strong>Email:</strong> <span class="value">${paySlipData.staff_email || 'N/A'}</span></div>
              <div class="staff-info-item"><strong>Phone:</strong> <span class="value">${paySlipData.staff_phone || 'N/A'}</span></div>
              <div class="staff-info-item"><strong>Joining:</strong> <span class="value">${paySlipData.joining_date ? new Date(paySlipData.joining_date).toLocaleDateString() : 'N/A'}</span></div>
            </div>
          </div>

          <div class="section-title">Earnings</div>
          <table>
            <thead>
              <tr>
                <th style="width:8%;">SL</th>
                <th style="width:42%;">Pay Type / Description</th>
                <th style="width:25%; text-align:right;">Expected Amount</th>
                <th style="width:25%; text-align:right;">Paid Amount</th>
              </tr>
            </thead>
            <tbody>
              ${earningsRows}
              <tr class="total-row">
                <td colspan="2" style="text-align:right;">Total Earnings</td>
                <td style="text-align:right; font-weight:bold;">BDT ${paySlipData.total_earnings.toLocaleString()}</td>
                <td style="text-align:right; font-weight:bold;">
                  ${paySlipData.is_paid ? `BDT ${paySlipData.total_earnings.toLocaleString()}` : '<span style="color:red;">Not Paid Yet</span>'}
                </td>
              </tr>
            </tbody>
          </table>

          <div class="section-title">Deductions</div>
          <table>
            <thead>
              <tr>
                <th style="width:8%;">SL</th>
                <th style="width:42%;">Description</th>
                <th style="width:25%; text-align:right;">Expected Deductions</th>
                <th style="width:25%; text-align:right;">Deductions</th>
              </tr>
            </thead>
            <tbody>
              ${deductionsRows}
              <tr class="total-row">
                <td colspan="2" style="text-align:right;">Total Deductions</td>
                <td style="text-align:right; font-weight:bold;">BDT ${paySlipData.total_deductions.toLocaleString()}</td>
                <td style="text-align:right; font-weight:bold;">
                  ${paySlipData.is_paid ? `BDT ${paySlipData.total_deductions.toLocaleString()}` : '<span style="color:red;">Not Paid Yet</span>'}
                </td>
              </tr>
            </tbody>
          </table>

          <div class="net-salary-box">
            <span class="label">Net Salary</span>
            <span class="value">
              ${paySlipData.is_paid ? `BDT ${paySlipData.net_salary.toLocaleString()}` : '<span style="color:red;">Not Paid Yet</span>'}
            </span>
          </div>

          <div class="in-words">In Words: ${paySlipData.is_paid ? paySlipData.in_words : '<span style="color:red;">Not Paid Yet</span>'}</div>

          <div class="payment-info">
            <div class="payment-info-item"><strong>Payment Date:</strong> ${paymentDate}</div>
            <div class="payment-info-item"><strong>Payment Method:</strong> ${paymentMethod}</div>
            <div class="payment-info-item"><strong>Bank Name:</strong> ${bankName}</div>
            <div class="payment-info-item"><strong>Account Number:</strong> ${accountNumber}</div>
          </div>

          <div class="footer">
            ${schoolSettings?.school_name || 'Kindergarten School'} &nbsp;|&nbsp; Page 1 of 1 &nbsp;|&nbsp; ${new Date().toLocaleDateString()}
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    setTimeout(() => {
      try { printWindow.focus(); } catch(e){}
      printWindow.print();
      printWindow.close();
    }, 200);
  }, [paySlipData, schoolSettings]);

  // ============================================================
  // FILTERS
  // ============================================================

  const filteredStaff = useMemo(() => {
    return staff.filter(s => 
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.employee_id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [staff, searchTerm]);

  const years = Array.from({ length: 5 }, (_, i) => (getCurrentYear() - 2 + i).toString());

  if (settingsLoading) {
    return (
      <ResponsiveLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading settings...</p>
          </div>
        </div>
      </ResponsiveLayout>
    );
  }

  return (
    <ResponsiveLayout>
      <div className="space-y-6 p-4 sm:p-6 bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 min-h-screen">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 dark:from-emerald-700 dark:via-teal-700 dark:to-cyan-700 p-6 shadow-xl"
        >
          <div className="absolute inset-0 bg-white/10 dark:bg-white/5 backdrop-blur-sm"></div>
          <div className="relative flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => router.back()} 
                className="rounded-xl bg-white/20 hover:bg-white/30 text-white border-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white drop-shadow-lg">
                  Pay Slip Generator
                </h1>
                <p className="text-white/80 text-sm drop-shadow">Generate and download staff salary pay slips</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button 
                onClick={() => {
                  setBulkDialogOpen(true);
                  loadBulkStaff();
                }}
                className="rounded-xl bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm"
              >
                <Users className="h-4 w-4 mr-2" /> Bulk Pay Slip
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Pay Slip Information Card */}
        <Card className="border-0 shadow-md rounded-2xl bg-white dark:bg-gray-800">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white">Pay Slip Information</CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">Select staff member and month to generate pay slip</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label className="text-gray-700 dark:text-gray-300 mb-2 block">Select Staff Member *</Label>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
                  <Input
                    placeholder="Search by staff name or ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 rounded-xl bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                  />
                </div>
                <Select value={selectedStaff} onValueChange={setSelectedStaff}>
                  <SelectTrigger className="rounded-xl bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                    <SelectValue placeholder="Select staff member" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                    {filteredStaff.map((s) => (
                      <SelectItem key={s.id} value={s.id} className="text-gray-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={s.photo_url} />
                            <AvatarFallback className="bg-emerald-100 text-emerald-600 text-xs">
                              {s.name?.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <span>{s.employee_id} - {s.name} ({s.designation})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-700 dark:text-gray-300 mb-2 block">Month *</Label>
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger className="rounded-xl bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                      <Calendar className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Month" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                      {months.map((m) => (
                        <SelectItem key={m} value={m} className="text-gray-900 dark:text-white">{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-gray-700 dark:text-gray-300 mb-2 block">Year *</Label>
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger className="rounded-xl bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                      {years.map((y) => (
                        <SelectItem key={y} value={y} className="text-gray-900 dark:text-white">{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end mt-6">
              <Button 
                onClick={generatePaySlip} 
                disabled={!selectedStaff || loading}
                className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
              >
                <Eye className="h-4 w-4 mr-2" />
                Preview Pay Slip
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Pay Slip Preview - Updated with new columns */}
        {showPreview && paySlipData && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="flex justify-end gap-2 print:hidden">
              <Button variant="outline" onClick={handleDownloadPDF} className="rounded-xl border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
                <Download className="h-4 w-4 mr-2" /> PDF
              </Button>
              <Button variant="outline" onClick={handlePrint} className="rounded-xl border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
                <Printer className="h-4 w-4 mr-2" /> Print
              </Button>
            </div>
            
            <div ref={payslipRef} className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg overflow-hidden print:shadow-none">
              <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-6 text-center print:bg-emerald-600">
                <h2 className="text-2xl font-bold">SALARY PAY SLIP</h2>
                  <p className="text-emerald-100">{paySlipData.month} {paySlipData.year}</p>
                </div>
                
                {paySlipData.is_pro_rata && (
                  <Alert className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 mb-4 mx-6">
                    <AlertDescription className="text-amber-700 dark:text-amber-400 text-sm">
                      ⓘ Pro-rata applied: This month's salary is calculated based on
                      joining/resign dates. Full monthly salary would be BDT {paySlipData.full_salary?.toLocaleString()}.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="p-6">
                  <div className="text-center border-b pb-4 mb-4">
                  <h3 className="text-xl font-bold text-gray-800 dark:text-white">{schoolSettings?.school_name || 'Kindergarten School'}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{schoolSettings?.school_address || '123, School Road, Dhaka - 1212'}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {schoolSettings?.school_phone ? `Phone: ${schoolSettings.school_phone}` : 'Phone: +880 1234 567890'} 
                    {schoolSettings?.school_email ? ` | Email: ${schoolSettings.school_email}` : ' | Email: info@kindergarten.edu'}
                  </p>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-6 mb-6">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-20 w-20 border-2 border-emerald-200 dark:border-emerald-700">
                      <AvatarImage src={paySlipData.staff_photo_url} />
                      <AvatarFallback className="bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-400 text-xl">
                        {paySlipData.staff_name?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="text-lg font-bold text-gray-800 dark:text-white">{paySlipData.staff_name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">ID: {paySlipData.staff_employee_id}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{paySlipData.staff_designation}</p>
                    </div>
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm flex items-center gap-2 text-gray-700 dark:text-gray-300">
                      <User className="h-4 w-4 text-gray-400" /> {paySlipData.staff_name}
                    </p>
                    <p className="text-sm flex items-center gap-2 text-gray-700 dark:text-gray-300">
                      <Mail className="h-4 w-4 text-gray-400" /> {paySlipData.staff_email || "N/A"}
                    </p>
                    <p className="text-sm flex items-center gap-2 text-gray-700 dark:text-gray-300">
                      <Phone className="h-4 w-4 text-gray-400" /> {paySlipData.staff_phone || "N/A"}
                    </p>
                    <p className="text-sm flex items-center gap-2 text-gray-700 dark:text-gray-300">
                      <Calendar className="h-4 w-4 text-gray-400" /> Joining: {paySlipData.joining_date ? new Date(paySlipData.joining_date).toLocaleDateString() : "N/A"}
                    </p>
                  </div>
                </div>
                
                {/* Earnings Table - Updated columns */}
                <div className="mb-6">
                  <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3 border-l-4 border-emerald-500 pl-3">Earnings</h4>
                  <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
                    <table className="w-full">
                      <thead className="bg-emerald-500 dark:bg-emerald-600">
                        <tr>
                          <th className="text-white py-2 px-3 text-center text-xs font-semibold w-[10%]">SL</th>
                          <th className="text-white py-2 px-3 text-left text-xs font-semibold w-[40%]">Pay Type / Description</th>
                          <th className="text-white py-2 px-3 text-right text-xs font-semibold w-[25%]">Expected Amount</th>
                          <th className="text-white py-2 px-3 text-right text-xs font-semibold w-[25%]">Paid Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="py-2 px-3 text-center text-sm text-gray-600 dark:text-gray-400">1</td>
                          <td className="py-2 px-3 text-sm text-gray-700 dark:text-gray-300">Basic Salary</td>
                          <td className="py-2 px-3 text-right text-sm font-medium text-gray-900 dark:text-white">৳{paySlipData.basic.toLocaleString()}</td>
                          <td className="py-2 px-3 text-right text-sm font-medium">
                            {paySlipData.is_paid ? `৳${paySlipData.basic.toLocaleString()}` : <span className="text-red-500">Not Paid Yet</span>}
                          </td>
                        </tr>
                        <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="py-2 px-3 text-center text-sm text-gray-600 dark:text-gray-400">2</td>
                          <td className="py-2 px-3 text-sm text-gray-700 dark:text-gray-300">House Rent Allowance (HRA)</td>
                          <td className="py-2 px-3 text-right text-sm font-medium text-gray-900 dark:text-white">৳{paySlipData.hra.toLocaleString()}</td>
                          <td className="py-2 px-3 text-right text-sm font-medium">
                            {paySlipData.is_paid ? `৳${paySlipData.hra.toLocaleString()}` : <span className="text-red-500">Not Paid Yet</span>}
                          </td>
                        </tr>
                        <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="py-2 px-3 text-center text-sm text-gray-600 dark:text-gray-400">3</td>
                          <td className="py-2 px-3 text-sm text-gray-700 dark:text-gray-300">Dearness Allowance (DA)</td>
                          <td className="py-2 px-3 text-right text-sm font-medium text-gray-900 dark:text-white">৳{paySlipData.da.toLocaleString()}</td>
                          <td className="py-2 px-3 text-right text-sm font-medium">
                            {paySlipData.is_paid ? `৳${paySlipData.da.toLocaleString()}` : <span className="text-red-500">Not Paid Yet</span>}
                          </td>
                        </tr>
                        <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="py-2 px-3 text-center text-sm text-gray-600 dark:text-gray-400">4</td>
                          <td className="py-2 px-3 text-sm text-gray-700 dark:text-gray-300">Other Allowances</td>
                          <td className="py-2 px-3 text-right text-sm font-medium text-gray-900 dark:text-white">৳{paySlipData.allowances.toLocaleString()}</td>
                          <td className="py-2 px-3 text-right text-sm font-medium">
                            {paySlipData.is_paid ? `৳${paySlipData.allowances.toLocaleString()}` : <span className="text-red-500">Not Paid Yet</span>}
                          </td>
                        </tr>
                        <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="py-2 px-3 text-center text-sm text-gray-600 dark:text-gray-400">5</td>
                          <td className="py-2 px-3 text-sm text-gray-700 dark:text-gray-300">Personal Allowance</td>
                          <td className="py-2 px-3 text-right text-sm font-medium text-gray-900 dark:text-white">৳{paySlipData.personal_allowance.toLocaleString()}</td>
                          <td className="py-2 px-3 text-right text-sm font-medium">
                            {paySlipData.is_paid ? `৳${paySlipData.personal_allowance.toLocaleString()}` : <span className="text-red-500">Not Paid Yet</span>}
                          </td>
                        </tr>
                        <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="py-2 px-3 text-center text-sm text-gray-600 dark:text-gray-400">6</td>
                          <td className="py-2 px-3 text-sm text-gray-700 dark:text-gray-300">Special Allowance</td>
                          <td className="py-2 px-3 text-right text-sm font-medium text-gray-900 dark:text-white">৳{paySlipData.special_allowance.toLocaleString()}</td>
                          <td className="py-2 px-3 text-right text-sm font-medium">
                            {paySlipData.is_paid ? `৳${paySlipData.special_allowance.toLocaleString()}` : <span className="text-red-500">Not Paid Yet</span>}
                          </td>
                        </tr>
                        <tr className="bg-emerald-50 dark:bg-emerald-950/20">
                          <td colSpan={2} className="py-2 px-3 text-right text-sm font-bold text-gray-700 dark:text-gray-300">Total Earnings</td>
                          <td className="py-2 px-3 text-right text-sm font-bold text-emerald-600 dark:text-emerald-400">৳{paySlipData.total_earnings.toLocaleString()}</td>
                          <td className="py-2 px-3 text-right text-sm font-bold text-emerald-600 dark:text-emerald-400">
                            {paySlipData.is_paid ? `৳${paySlipData.total_earnings.toLocaleString()}` : <span className="text-red-500">Not Paid Yet</span>}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                
                {/* Deductions Table - Updated columns */}
                <div className="mb-6">
                  <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3 border-l-4 border-rose-500 pl-3">Deductions</h4>
                  <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
                    <table className="w-full">
                      <thead className="bg-rose-500 dark:bg-rose-600">
                        <tr>
                          <th className="text-white py-2 px-3 text-center text-xs font-semibold w-[10%]">SL</th>
                          <th className="text-white py-2 px-3 text-left text-xs font-semibold w-[40%]">Description</th>
                          <th className="text-white py-2 px-3 text-right text-xs font-semibold w-[25%]">Expected Deductions</th>
                          <th className="text-white py-2 px-3 text-right text-xs font-semibold w-[25%]">Deductions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="py-2 px-3 text-center text-sm text-gray-600 dark:text-gray-400">1</td>
                          <td className="py-2 px-3 text-sm text-gray-700 dark:text-gray-300">Other Deductions</td>
                          <td className="py-2 px-3 text-right text-sm font-medium text-gray-900 dark:text-white">-৳{paySlipData.other_deductions.toLocaleString()}</td>
                          <td className="py-2 px-3 text-right text-sm font-medium">
                            {paySlipData.is_paid ? `-৳${paySlipData.other_deductions.toLocaleString()}` : <span className="text-red-500">Not Paid Yet</span>}
                          </td>
                        </tr>
                        <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="py-2 px-3 text-center text-sm text-gray-600 dark:text-gray-400">2</td>
                          <td className="py-2 px-3 text-sm text-gray-700 dark:text-gray-300">Advance / Loan Deduction</td>
                          <td className="py-2 px-3 text-right text-sm font-medium text-gray-900 dark:text-white">-৳{paySlipData.advance_deduction.toLocaleString()}</td>
                          <td className="py-2 px-3 text-right text-sm font-medium">
                            {paySlipData.is_paid ? `-৳${paySlipData.advance_deduction.toLocaleString()}` : <span className="text-red-500">Not Paid Yet</span>}
                          </td>
                        </tr>
                        <tr className="bg-rose-50 dark:bg-rose-950/20">
                          <td colSpan={2} className="py-2 px-3 text-right text-sm font-bold text-gray-700 dark:text-gray-300">Total Deductions</td>
                          <td className="py-2 px-3 text-right text-sm font-bold text-rose-600 dark:text-rose-400">-৳{paySlipData.total_deductions.toLocaleString()}</td>
                          <td className="py-2 px-3 text-right text-sm font-bold text-rose-600 dark:text-rose-400">
                            {paySlipData.is_paid ? `-৳${paySlipData.total_deductions.toLocaleString()}` : <span className="text-red-500">Not Paid Yet</span>}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                
                {/* Net Salary */}
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 rounded-xl p-5 mb-4 border border-emerald-200 dark:border-emerald-800">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-lg text-gray-700 dark:text-gray-300">Net Salary</span>
                    <span className="font-bold text-2xl text-emerald-600 dark:text-emerald-400">
                      {paySlipData.is_paid 
                        ? `৳${paySlipData.net_salary.toLocaleString()}`
                        : <span className="text-red-500">Not Paid Yet</span>}
                    </span>
                  </div>
                  {paySlipData.is_paid && paySlipData.paid_amount !== paySlipData.net_salary && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      ⓘ Actually paid: ৳{paySlipData.paid_amount.toLocaleString()} 
                      ({paySlipData.paid_amount > paySlipData.net_salary ? 'overpayment' : 'underpayment'} 
                      of ৳{Math.abs(paySlipData.paid_amount - paySlipData.net_salary).toLocaleString()})
                    </p>
                  )}
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 italic">In Words: {paySlipData.in_words}</p>
                </div>
                
                {/* Payment Info */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm border-t border-gray-200 dark:border-gray-700 pt-4">
                  <div>
                    <p className="text-gray-500 dark:text-gray-400 text-xs">Payment Date</p>
                    <p className="font-medium text-gray-700 dark:text-gray-300 text-sm">
                      {paySlipData.is_paid ? new Date(paySlipData.payment_date!).toLocaleDateString() : <span className="text-red-500">Not Paid Yet</span>}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400 text-xs">Payment Method</p>
                    <p className="font-medium text-gray-700 dark:text-gray-300 text-sm capitalize">{paySlipData.payment_method || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400 text-xs">Bank Name</p>
                    <p className="font-medium text-gray-700 dark:text-gray-300 text-sm">{paySlipData.bank_name || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400 text-xs">Account Number</p>
                    <p className="font-medium text-gray-700 dark:text-gray-300 text-sm">{paySlipData.account_number || "N/A"}</p>
                  </div>
                </div>
                
                <div className="text-center text-xs text-gray-400 dark:text-gray-500 border-t border-gray-200 dark:border-gray-700 mt-4 pt-4">
                  This is a computer generated document. No signature required.
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Bulk Pay Slip Dialog - size="lg" (smaller than bulk) */}
      <Dialog open={bulkDialogOpen} onOpenChange={(open) => {
        if (!open && bulkPrintReady) {
          return;
        }
        setBulkDialogOpen(open);
        if (!open) {
          setBulkPrintReady(false);
          setBulkGeneratedData([]);
        }
      }}>
        <DialogContent size="lg" className="p-4 sm:p-6 max-w-4xl">
          <DialogHeader className="border-b border-gray-200 dark:border-gray-700 pb-4">
            <DialogTitle className="text-gray-900 dark:text-white text-xl sm:text-2xl font-bold flex items-center gap-3">
              <Users className="h-6 w-6 sm:h-7 sm:w-7 text-emerald-500" />
              Bulk Pay Slip Generation
            </DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-400 text-sm sm:text-base mt-2">
              Generate pay slips for multiple staff members at once
              {bulkSelectedStaff.length > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-xs sm:text-sm font-semibold">
                  <UserCheck className="h-3 w-3 sm:h-4 sm:w-4" />
                  {bulkSelectedStaff.length} staff selected
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 sm:space-y-6 mt-4">
            {/* Month/Year Selection */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div>
                <Label className="text-gray-700 dark:text-gray-300 text-sm sm:text-base font-medium">Month *</Label>
                <Select 
                  value={bulkMonth} 
                  onValueChange={(v) => {
                    if (!isBulkGenerating && !bulkPrintReady) {
                      setBulkMonth(v);
                      setBulkSelectedStaff([]);
                    }
                  }}
                  disabled={isBulkGenerating || bulkPrintReady}
                >
                  <SelectTrigger className="rounded-xl h-10 sm:h-12 text-sm sm:text-base">
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-gray-700 dark:text-gray-300 text-sm sm:text-base font-medium">Year *</Label>
                <Select 
                  value={bulkYear} 
                  onValueChange={(v) => {
                    if (!isBulkGenerating && !bulkPrintReady) {
                      setBulkYear(v);
                      setBulkSelectedStaff([]);
                    }
                  }}
                  disabled={isBulkGenerating || bulkPrintReady}
                >
                  <SelectTrigger className="rounded-xl h-10 sm:h-12 text-sm sm:text-base">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={y}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Staff Selection */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-3 sm:pt-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 mb-3">
                <div>
                  <Label className="text-gray-700 dark:text-gray-300 font-semibold text-base sm:text-lg">
                    Select Staff
                    <span className="ml-2 text-sm font-normal text-gray-500">
                      ({bulkStaffList.length} staff available)
                    </span>
                  </Label>
                  {bulkSelectedStaff.length > 0 && (
                    <div className="mt-1 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                      ✓ {bulkSelectedStaff.length} staff selected
                    </div>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleAllStaff}
                    className="text-xs sm:text-sm rounded-xl px-3 sm:px-4"
                    disabled={isBulkGenerating || bulkPrintReady}
                  >
                    {bulkSelectAll ? 'Deselect All' : 'Select All'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadBulkStaff}
                    className="text-xs sm:text-sm rounded-xl px-3 sm:px-4"
                    disabled={loading || isBulkGenerating || bulkPrintReady}
                  >
                    <RefreshCw className={`h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </div>

              {bulkStaffList.length === 0 ? (
                <div className="text-center py-6 sm:py-8 text-gray-500 dark:text-gray-400">
                  <AlertCircle className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-2 sm:mb-3 text-amber-500" />
                  <p className="text-sm sm:text-base">No staff found with salary structure for {bulkMonth} {bulkYear}</p>
                </div>
              ) : (
                <>
                  {bulkSelectedStaff.length > 0 && (
                    <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-2 sm:p-3 mb-3 flex items-center gap-2">
                      <UserCheck className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-xs sm:text-sm text-emerald-700 dark:text-emerald-400 font-medium">
                        {bulkSelectedStaff.length} staff selected — click Generate to create pay slips
                      </span>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 max-h-[250px] sm:max-h-[350px] overflow-y-auto p-1">
                    {bulkStaffList.map((s) => (
                      <div
                        key={s.id}
                        className={`flex items-center gap-2 sm:gap-3 p-2 sm:p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          bulkSelectedStaff.includes(s.id)
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 shadow-md'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm'
                        } ${(isBulkGenerating || bulkPrintReady) ? 'opacity-50 cursor-not-allowed' : ''}`}
                        onClick={() => {
                          if (!isBulkGenerating && !bulkPrintReady) {
                            toggleStaffSelection(s.id);
                          }
                        }}
                      >
                        <div className="flex-shrink-0">
                          <Avatar className="h-8 w-8 sm:h-10 sm:w-10 border-2 border-white dark:border-gray-700 shadow-sm">
                            <AvatarImage src={s.photo_url} />
                            <AvatarFallback className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs sm:text-sm font-bold">
                              {s.name?.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-xs sm:text-sm text-gray-900 dark:text-white truncate">
                            {s.name}
                            <span className="ml-1.5 text-xs font-normal text-gray-400 dark:text-gray-500">
                              ({s.employee_id})
                            </span>
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {s.designation || 'No Designation'}
                          </p>
                        </div>
                        <div className="flex-shrink-0">
                          {bulkSelectedStaff.includes(s.id) ? (
                            <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-500" />
                          ) : (
                            <div className="h-5 w-5 sm:h-6 sm:w-6 rounded-full border-2 border-gray-300 dark:border-gray-600" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Progress */}
            {isBulkGenerating && (
              <div className="space-y-2 sm:space-y-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 sm:p-4">
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Generating pay slips...</span>
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {bulkProgress.completed} / {bulkProgress.total}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 sm:h-3">
                  <div 
                    className="bg-gradient-to-r from-emerald-600 to-teal-600 h-2 sm:h-3 rounded-full transition-all duration-300"
                    style={{ width: `${(bulkProgress.completed / bulkProgress.total) * 100}%` }}
                  />
                </div>
                {bulkResults.length > 0 && (
                  <div className="max-h-20 sm:max-h-24 overflow-y-auto text-xs space-y-1">
                    {bulkResults.map((result, i) => (
                      <div key={i} className={`flex items-center gap-2 ${result.success ? 'text-emerald-600' : 'text-red-600'}`}>
                        {result.success ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        <span>{result.name}</span>
                        {result.error && <span className="text-gray-500">- {result.error}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Print Ready Section */}
            {bulkPrintReady && bulkGeneratedData.length > 0 && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-3 sm:pt-4 mt-2">
                <Alert className="bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 mb-3 sm:mb-4 p-3 sm:p-4">
                  <AlertDescription className="text-emerald-700 dark:text-emerald-400 text-sm sm:text-base flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                    {bulkGeneratedData.length} pay slips generated successfully! Click Print to download all.
                  </AlertDescription>
                </Alert>
                <div className="flex gap-2 sm:gap-3 justify-end flex-wrap">
                  <Button
                    onClick={handleBulkPrint}
                    className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700 text-sm sm:text-base px-4 sm:px-6 py-2 sm:py-3"
                  >
                    <Printer className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2" />
                    Print All ({bulkGeneratedData.length} Slips)
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setBulkDialogOpen(false);
                      setBulkPrintReady(false);
                      setBulkGeneratedData([]);
                    }}
                    className="rounded-xl text-sm sm:text-base px-4 sm:px-6 py-2 sm:py-3"
                  >
                    Close
                  </Button>
                </div>
              </div>
            )}

            <Alert className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
              <AlertDescription className="text-amber-700 dark:text-amber-400 text-xs sm:text-sm">
                This will generate pay slips for selected staff for {bulkMonth} {bulkYear}.
                Pay slips will be saved as payment records automatically.
              </AlertDescription>
            </Alert>

            <div className="flex justify-end gap-2 sm:gap-3 border-t border-gray-200 dark:border-gray-700 pt-3 sm:pt-4">
              <Button 
                variant="outline" 
                onClick={() => {
                  if (bulkPrintReady) return;
                  setBulkDialogOpen(false);
                }}
                disabled={isBulkGenerating || bulkPrintReady}
                className="rounded-xl text-sm sm:text-base px-4 sm:px-6 py-2 sm:py-3"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleBulkGenerate}
                disabled={isBulkGenerating || bulkSelectedStaff.length === 0 || bulkPrintReady}
                className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700 text-sm sm:text-base px-4 sm:px-6 py-2 sm:py-3"
              >
                {isBulkGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2" />
                    Generate {bulkSelectedStaff.length} Pay Slips
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </ResponsiveLayout>
  );
}
