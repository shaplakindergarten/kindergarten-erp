// src/app/staff/salary/reports/staff-wise/page.tsx
"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, Download, Printer, Calendar, DollarSign, 
  Users, TrendingUp, TrendingDown, Search, FileText,
  Eye, Award, CreditCard, Home, Briefcase, Gift,
  PrintIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ResponsiveLayout } from "@/components/layout/responsive-layout";
import { getSchoolPrintHeader } from "@/components/print/SchoolPrintHeader";
import { getStaff } from "@/lib/api/staff";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, months, getCurrentYear } from "@/lib/salary/salaryUtils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { motion } from "framer-motion";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ============================================================
// TYPES
// ============================================================

interface StaffWiseData {
  staff_id: string;
  staff_name: string;
  staff_employee_id: string;
  staff_designation: string;
  staff_photo_url?: string;
  staff_joining_date?: string;
  salary_category_name?: string;
  basic: number;
  hra: number;
  da: number;
  allowances: number;
  personal_allowance: number;
  special_allowance: number;
  other_deductions: number;
  total_salary: number;
  yearly_paid: number;
  yearly_expected: number;
  yearly_balance: number;
  monthly_breakdown: {
    month: string;
    expected: number;
    paid: number;
    balance: number;
    status: string;
  }[];
  advance_details?: {
    id: string;
    amount: number;
    remaining: number;
    installments: number;
  }[];
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

const useNumberInput = (initialValue: string = '') => {
  const [value, setValue] = useState(initialValue);
  const [displayValue, setDisplayValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let rawValue = e.target.value;
    let englishValue = convertBengaliToEnglish(rawValue);
    const cleaned = englishValue.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    let finalValue = cleaned;
    if (parts.length > 2) {
      finalValue = parts[0] + '.' + parts.slice(1).join('');
    }
    setValue(finalValue);
    setDisplayValue(rawValue);
  };

  const handleFocus = () => {
    if (value === '0' || value === '0.00' || value === '') {
      setValue('');
      setDisplayValue('');
    }
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.select();
      }
    }, 10);
  };

  const handleBlur = () => {
    if (value === '' || value === '.') {
      setValue('0');
      setDisplayValue('0');
    }
  };

  return {
    value,
    displayValue,
    setValue,
    setDisplayValue,
    handleChange,
    handleFocus,
    handleBlur,
    inputRef
  };
};

const NumberInputField = ({ 
  label, 
  placeholder, 
  value, 
  onChange 
}: any) => {
  const {
    value: internalValue,
    displayValue,
    setValue,
    setDisplayValue,
    handleChange,
    handleFocus,
    handleBlur,
    inputRef
  } = useNumberInput(value);

  useEffect(() => {
    if (value !== internalValue) {
      setValue(value);
      setDisplayValue(value);
    }
  }, [value]);

  useEffect(() => {
    if (onChange) {
      onChange(internalValue);
    }
  }, [internalValue]);

  return (
    <div className="space-y-1">
      {label && (
        <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </Label>
      )}
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-right font-mono"
        autoComplete="off"
        dir="ltr"
      />
    </div>
  );
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function StaffWiseReportPage() {
  const router = useRouter();
  const [staff, setStaff] = useState<any[]>([]);
  const [reportData, setReportData] = useState<StaffWiseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(getCurrentYear().toString());
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStaff, setSelectedStaff] = useState<StaffWiseData | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);

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
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  const loadStaffWiseReport = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const [staffData, balancesData, paymentsData, salariesData, advancesData] = await Promise.all([
        getStaff(),
        supabase
          .from("salary_balances")
          .select("*")
          .eq("year", parseInt(selectedYear)),
        supabase
          .from("salary_payments")
          .select("*")
          .eq("year", parseInt(selectedYear)),
        supabase.from("staff_salaries").select("*"),
        supabase.from("salary_advances").select("*").eq("status", "active"),
      ]);

      setStaff(staffData || []);

      // Build maps for O(1) lookup
      const balanceMap = new Map();
      (balancesData.data || []).forEach((b: any) => {
        const key = `${b.staff_id}-${b.month}`;
        balanceMap.set(key, b);
      });

      const paymentMap = new Map();
      (paymentsData.data || []).forEach((p: any) => {
        const key = `${p.staff_id}-${p.month}`;
        paymentMap.set(key, p);
      });

      const salaryMap = new Map();
      (salariesData.data || []).forEach((s: any) => {
        salaryMap.set(s.staff_id, s);
      });

      const advanceMap = new Map();
      (advancesData.data || []).forEach((a: any) => {
        if (!advanceMap.has(a.staff_id)) {
          advanceMap.set(a.staff_id, []);
        }
        advanceMap.get(a.staff_id).push(a);
      });

      const report: StaffWiseData[] = [];

      for (const staffMember of staffData || []) {
        const staffSalary = salaryMap.get(staffMember.id);
        const category = staffMember.salary_category;
        
        const basic = staffSalary?.basic || category?.basic || 0;
        const hra = staffSalary?.hra || category?.hra || 0;
        const da = staffSalary?.da || category?.da || 0;
        const allowances = staffSalary?.allowances || category?.allowances || 0;
        const personalAllowance = staffSalary?.personal_allowance || 0;
        const specialAllowance = staffSalary?.special_allowance || 0;
        const otherDeductions = staffSalary?.other_deductions || 0;
        
        // Display-only total (not used for expected calculation)
        const totalSalary = basic + hra + da + allowances + personalAllowance + specialAllowance - otherDeductions;

        let yearlyPaid = 0;
        let yearlyExpected = 0;
        const monthlyBreakdown = [];

        for (const month of months) {
          const key = `${staffMember.id}-${month}`;
          const balance = balanceMap.get(key);
          const payment = paymentMap.get(key);
          
          const paid = payment?.amount || balance?.paid_amount || 0;
          
          // ✅ FIX: Use balance.expected_salary (business-rule applied)
          // If no balance record, staff wasn't eligible that month (0 expected)
          const expected = balance?.expected_salary || 0;
          const balanceAmount = expected - paid;

          monthlyBreakdown.push({
            month,
            expected,
            paid,
            balance: balanceAmount,
            status: balance?.status || (paid > 0 ? "paid" : "pending"),
          });

          yearlyPaid += paid;
          yearlyExpected += expected;
        }

        const staffAdvances = advanceMap.get(staffMember.id) || [];
        const advanceDetails = staffAdvances.map((a: any) => ({
          id: a.id,
          amount: a.amount,
          remaining: a.amount - (a.installment_amount * a.paid_installments),
          installments: a.total_installments - a.paid_installments,
        }));

        // ✅ FIX: expected - paid gives correct semantics
        // positive = due (expected > paid, money owed to staff)
        // negative = advance (paid > expected, overpayment)
        const diff = yearlyExpected - yearlyPaid;

        report.push({
          staff_id: staffMember.id,
          staff_name: staffMember.name,
          staff_employee_id: staffMember.employee_id,
          staff_designation: staffMember.designation,
          staff_photo_url: staffMember.photo_url,
          staff_joining_date: staffMember.joining_date,
          salary_category_name: category?.name,
          basic,
          hra,
          da,
          allowances,
          personal_allowance: personalAllowance,
          special_allowance: specialAllowance,
          other_deductions: otherDeductions,
          total_salary: totalSalary,
          yearly_paid: yearlyPaid,
          yearly_expected: yearlyExpected,
          yearly_balance: diff, // positive = due, negative = advance
          monthly_breakdown: monthlyBreakdown,
          advance_details: advanceDetails,
        });
      }

      setReportData(report);
    } catch (err) {
      console.error("Failed to load staff-wise report:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    loadStaffWiseReport();
    loadSchoolSettings();
  }, [loadStaffWiseReport, loadSchoolSettings]);

  // ============================================================
  // FILTERED DATA & STATISTICS
  // ============================================================

  const filteredData = useMemo(() => {
    return reportData.filter(item => {
      if (searchTerm && !item.staff_name.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !item.staff_employee_id.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [reportData, searchTerm]);

  const statistics = useMemo(() => {
    const totalDue = filteredData.reduce((sum, item) => sum + (item.yearly_balance > 0 ? item.yearly_balance : 0), 0);
    const totalAdvance = filteredData.reduce((sum, item) => sum + (item.yearly_balance < 0 ? Math.abs(item.yearly_balance) : 0), 0);
    
    return {
      totalStaff: filteredData.length,
      totalPaid: filteredData.reduce((sum, item) => sum + item.yearly_paid, 0),
      totalExpected: filteredData.reduce((sum, item) => sum + item.yearly_expected, 0),
      totalDue: totalDue,
      totalAdvance: totalAdvance,
      totalBalance: filteredData.reduce((sum, item) => sum + Math.abs(item.yearly_balance), 0),
      avgPerStaff: filteredData.reduce((sum, item) => sum + item.yearly_paid, 0) / (filteredData.length || 1),
    };
  }, [filteredData]);

  const stats = useMemo(() => [
    { 
      title: "Total Staff", 
      value: statistics.totalStaff, 
      icon: Users,
      bgGradient: "from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/30",
      iconBg: "bg-blue-500 dark:bg-blue-600",
      textColor: "text-gray-900 dark:text-white"
    },
    { 
      title: "Total Paid", 
      value: formatCurrency(statistics.totalPaid), 
      icon: DollarSign,
      bgGradient: "from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/30",
      iconBg: "bg-emerald-500 dark:bg-emerald-600",
      textColor: "text-gray-900 dark:text-white"
    },
    { 
      title: "Total Due", 
      value: formatCurrency(statistics.totalDue), 
      icon: TrendingDown,
      bgGradient: "from-rose-50 to-rose-100 dark:from-rose-950/30 dark:to-rose-900/30",
      iconBg: "bg-rose-500 dark:bg-rose-600",
      textColor: "text-gray-900 dark:text-white"
    },
    { 
      title: "Total Advance", 
      value: formatCurrency(statistics.totalAdvance), 
      icon: TrendingUp,
      bgGradient: "from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/30",
      iconBg: "bg-emerald-500 dark:bg-emerald-600",
      textColor: "text-gray-900 dark:text-white"
    },
  ], [statistics]);

  // ============================================================
  // EXPORT FUNCTIONS
  // ============================================================

  const handleExportExcel = useCallback(() => {
    const exportData = filteredData.map(item => ({
      "Staff ID": item.staff_employee_id,
      "Staff Name": item.staff_name,
      "Designation": item.staff_designation,
      "Salary Category": item.salary_category_name || "-",
      "Basic": item.basic,
      "HRA": item.hra,
      "DA": item.da,
      "Allowances": item.allowances,
      "Personal Allowance": item.personal_allowance,
      "Special Allowance": item.special_allowance,
      "Other Deductions": item.other_deductions,
      "Total Monthly": item.total_salary,
      "Yearly Expected": item.yearly_expected,
      "Yearly Paid": item.yearly_paid,
      "Due": item.yearly_balance > 0 ? item.yearly_balance : 0,
      "Advance": item.yearly_balance < 0 ? Math.abs(item.yearly_balance) : 0,
      "Balance": Math.abs(item.yearly_balance),
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Staff Wise Report");
    XLSX.writeFile(wb, `staff_wise_salary_report_${selectedYear}.xlsx`);
  }, [filteredData, selectedYear]);

  // ============================================================
  // PDF EXPORT
  // ============================================================

  const handleExportPDF = useCallback(async () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });
    
    const margin = 14;
    const pageWidth = 210;
    const contentWidth = pageWidth - (margin * 2);
    const pageHeight = doc.internal.pageSize.height;
    const centerX = pageWidth / 2;
    
    const settings = schoolSettings || {
      school_name: "চে আলী মডেল একাডেমী",
      school_address: "Nowtala, Madhaiya Bazar, Chandina, Cumilla",
      school_phone: "01923253454",
      school_email: "shapla.kindergarten@gmail.com",
      school_logo: "",
    };
    
    let yOffset = margin;
    
    // ===== HEADER: Logo on Left, Text Centered =====
    let logoHeight = 0;
    let logoWidth = 0;
    
    // Logo on the left
    if (settings?.school_logo) {
      try {
        const img = new Image();
        img.src = settings.school_logo;
        await new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        });
        logoWidth = 25;
        logoHeight = 25;
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
      const addressLines = doc.splitTextToSize(settings.school_address, contentWidth - 50);
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
    
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text("Staff Wise Salary Report", centerX, yOffset, { align: 'center' });
    yOffset += 7;
    
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text(`Year: ${selectedYear}`, centerX, yOffset, { align: 'center' });
    yOffset += 4.5;
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, centerX, yOffset, { align: 'center' });
    yOffset += 8;
    
    const tableData = filteredData.map(item => [
      item.staff_employee_id,
      item.staff_name,
      item.staff_designation,
      `BDT ${item.total_salary.toLocaleString('en-US')}`,
      `BDT ${item.yearly_paid.toLocaleString('en-US')}`,
      item.yearly_balance > 0 ? `BDT ${item.yearly_balance.toLocaleString('en-US')}` : '0',
      item.yearly_balance < 0 ? `BDT ${Math.abs(item.yearly_balance).toLocaleString('en-US')}` : '0',
      `BDT ${Math.abs(item.yearly_balance).toLocaleString('en-US')}`,
    ]);

    autoTable(doc, {
      head: [["ID", "Name", "Designation", "Monthly", "Yearly Paid", "Due", "Advance", "Balance"]],
      body: tableData,
      startY: yOffset,
      margin: { left: margin, right: margin, top: yOffset, bottom: 20 },
      styles: { fontSize: 7, cellPadding: 1.5, overflow: 'linebreak' },
      headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
      columnStyles: {
        0: { cellWidth: 20, halign: 'center' },
        1: { cellWidth: 25, halign: 'left' },
        2: { cellWidth: 20, halign: 'left' },
        3: { cellWidth: 20, halign: 'right' },
        4: { cellWidth: 22, halign: 'right' },
        5: { cellWidth: 18, halign: 'right' },
        6: { cellWidth: 18, halign: 'right' },
        7: { cellWidth: 20, halign: 'right' },
      },
      didDrawPage: (data) => {
        const pageCount = doc.getNumberOfPages();
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        
        doc.text(settings?.school_name || 'চে আলী মডেল একাডেমী', centerX, pageHeight - 6, { align: 'center' });
        doc.text(`Page ${data.pageNumber} of ${pageCount}`, centerX, pageHeight - 10, { align: 'center' });
      },
    });

    doc.save(`staff_wise_salary_report_${selectedYear}.pdf`);
  }, [filteredData, schoolSettings, selectedYear]);

  // ============================================================
  // PRINT SINGLE STAFF DETAILS
  // ============================================================

  const handlePrintStaffDetails = useCallback((staffData: StaffWiseData) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups for this site to print.');
      return;
    }

    let monthlyRows = '';
    staffData.monthly_breakdown.forEach((month, index) => {
      monthlyRows += `
        <tr>
          <td style="padding:4px 6px; border:1px solid #ddd; text-align:center; font-size:9px;">${index + 1}</td>
          <td style="padding:4px 6px; border:1px solid #ddd; text-align:left; font-size:9px;">${month.month}</td>
          <td style="padding:4px 6px; border:1px solid #ddd; text-align:right; font-size:9px;">BDT ${month.expected.toLocaleString()}</td>
          <td style="padding:4px 6px; border:1px solid #ddd; text-align:right; font-size:9px;">BDT ${month.paid.toLocaleString()}</td>
          <td style="padding:4px 6px; border:1px solid #ddd; text-align:right; font-size:9px; color:${month.balance > 0 ? '#ef4444' : month.balance < 0 ? '#22c55e' : '#666'};">BDT ${Math.abs(month.balance).toLocaleString()}</td>
          <td style="padding:4px 6px; border:1px solid #ddd; text-align:center; font-size:9px;">
            <span style="background:${month.status === 'paid' ? '#22c55e' : month.status === 'partial' ? '#eab308' : '#ef4444'}; color:white; padding:2px 8px; border-radius:4px; font-size:8px;">${month.status === 'paid' ? 'Paid' : month.status === 'partial' ? 'Partial' : 'Pending'}</span>
          </td>
        </tr>
      `;
    });

    let advanceRows = '';
    if (staffData.advance_details && staffData.advance_details.length > 0) {
      staffData.advance_details.forEach((advance, index) => {
        advanceRows += `
          <tr>
            <td style="padding:4px 6px; border:1px solid #ddd; text-align:center; font-size:9px;">${index + 1}</td>
            <td style="padding:4px 6px; border:1px solid #ddd; text-align:right; font-size:9px;">BDT ${advance.amount.toLocaleString()}</td>
            <td style="padding:4px 6px; border:1px solid #ddd; text-align:right; font-size:9px;">BDT ${advance.remaining.toLocaleString()}</td>
            <td style="padding:4px 6px; border:1px solid #ddd; text-align:center; font-size:9px;">${advance.installments}</td>
          </tr>
        `;
      });
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Staff Salary Details - ${staffData.staff_name}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: Arial, sans-serif; 
              margin: 0; 
              padding: 10mm 8mm;
              background: white;
              width: 210mm;
              min-height: 297mm;
              margin: 0 auto;
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
              margin: 12px 0 8px 0;
              color: #1a1a2e;
              border-bottom: 1px solid #e2e8f0;
              padding-bottom: 4px;
            }
            
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 6px;
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
            
            .summary-box {
              display: grid;
              grid-template-columns: 1fr 1fr 1fr 1fr;
              gap: 8px;
              margin: 10px 0;
            }
            .summary-item {
              text-align: center;
              padding: 8px;
              border-radius: 6px;
              border: 1px solid #e2e8f0;
            }
            .summary-item .label {
              font-size: 8px;
              color: #666;
            }
            .summary-item .value {
              font-size: 12px;
              font-weight: bold;
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
              body {
                padding: 10mm 8mm;
                width: 100%;
                min-height: 100vh;
              }
              th {
                background-color: #4f46e5 !important;
                color: white !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .staff-info {
                background: #f8fafc !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
            }
            
            @page {
              size: A4;
              margin: 0;
            }
          </style>
        </head>
        <body>
          ${getSchoolPrintHeader(
            { school_logo: schoolSettings?.school_logo, school_name: schoolSettings?.school_name, school_address: schoolSettings?.school_address, school_phone: schoolSettings?.school_phone, school_email: schoolSettings?.school_email },
            "Staff Salary Details"
          )}

          <!-- Staff Information -->
          <div class="staff-info">
            <div class="staff-info-grid">
              <div class="staff-info-item"><strong>Name:</strong> <span class="value">${staffData.staff_name}</span></div>
              <div class="staff-info-item"><strong>ID:</strong> <span class="value">${staffData.staff_employee_id}</span></div>
              <div class="staff-info-item"><strong>Designation:</strong> <span class="value">${staffData.staff_designation}</span></div>
              <div class="staff-info-item"><strong>Category:</strong> <span class="value">${staffData.salary_category_name || '-'}</span></div>
              <div class="staff-info-item"><strong>Monthly Salary:</strong> <span class="value">BDT ${staffData.total_salary.toLocaleString()}</span></div>
              <div class="staff-info-item"><strong>Joining Date:</strong> <span class="value">${staffData.staff_joining_date ? new Date(staffData.staff_joining_date).toLocaleDateString('en-CA') : '-'}</span></div>
            </div>
          </div>

          <!-- Salary Structure -->
          <div class="section-title">Salary Structure</div>
          <table>
            <thead>
              <tr>
                <th style="width:12%;">Basic</th>
                <th style="width:10%;">HRA</th>
                <th style="width:10%;">DA</th>
                <th style="width:12%;">Allowances</th>
                <th style="width:12%;">Personal Allow.</th>
                <th style="width:12%;">Special Allow.</th>
                <th style="width:12%;">Deductions</th>
                <th style="width:12%;">Total Monthly</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="text-align:right;">BDT ${staffData.basic.toLocaleString()}</td>
                <td style="text-align:right;">BDT ${staffData.hra.toLocaleString()}</td>
                <td style="text-align:right;">BDT ${staffData.da.toLocaleString()}</td>
                <td style="text-align:right;">BDT ${staffData.allowances.toLocaleString()}</td>
                <td style="text-align:right;">BDT ${staffData.personal_allowance.toLocaleString()}</td>
                <td style="text-align:right;">BDT ${staffData.special_allowance.toLocaleString()}</td>
                <td style="text-align:right; color:#ef4444;">BDT ${staffData.other_deductions.toLocaleString()}</td>
                <td style="text-align:right; font-weight:bold; color:#22c55e;">BDT ${staffData.total_salary.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>

          <!-- Yearly Summary -->
          <div class="section-title">Yearly Summary (${selectedYear})</div>
          <div class="summary-box">
            <div class="summary-item" style="background:#f0fdf4;">
              <div class="label">Yearly Expected</div>
              <div class="value" style="color:#16a34a;">BDT ${staffData.yearly_expected.toLocaleString()}</div>
            </div>
            <div class="summary-item" style="background:#f0fdf4;">
              <div class="label">Yearly Paid</div>
              <div class="value" style="color:#22c55e;">BDT ${staffData.yearly_paid.toLocaleString()}</div>
            </div>
            <div class="summary-item" style="background:${staffData.yearly_balance > 0 ? '#fef2f2' : '#f0fdf4'};">
              <div class="label">${staffData.yearly_balance > 0 ? 'Due' : 'Advance'}</div>
              <div class="value" style="color:${staffData.yearly_balance > 0 ? '#dc2626' : '#22c55e'};">BDT ${Math.abs(staffData.yearly_balance).toLocaleString()}</div>
            </div>
            <div class="summary-item" style="background:#eff6ff;">
              <div class="label">Average Monthly</div>
              <div class="value" style="color:#2563eb;">BDT ${(staffData.yearly_paid / 12).toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
            </div>
          </div>

          <!-- Monthly Breakdown -->
          <div class="section-title">Monthly Breakdown</div>
          <table>
            <thead>
              <tr>
                <th style="width:5%;">SL</th>
                <th style="width:15%;">Month</th>
                <th style="width:20%; text-align:right;">Expected</th>
                <th style="width:20%; text-align:right;">Paid</th>
                <th style="width:20%; text-align:right;">Balance</th>
                <th style="width:20%;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${monthlyRows}
            </tbody>
          </table>

          ${advanceRows ? `
            <div class="section-title">Advance Details</div>
            <table>
              <thead>
                <tr>
                  <th style="width:5%;">SL</th>
                  <th style="width:35%; text-align:right;">Amount</th>
                  <th style="width:35%; text-align:right;">Remaining</th>
                  <th style="width:25%;">Installments Left</th>
                </tr>
              </thead>
              <tbody>
                ${advanceRows}
              </tbody>
            </table>
          ` : ''}

          <div class="footer">
            <div>${schoolSettings?.school_name || 'চে আলী মডেল একাডেমী'}</div>
            <div>Page 1 of 1</div>
            <div>${new Date().toLocaleDateString()}</div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 1000);
  }, [schoolSettings, selectedYear]);

  // ============================================================
  // PRINT ALL STAFF REPORT
  // ============================================================

  const handlePrintAll = useCallback(async () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.print();
      return;
    }
    
    const allData = filteredData;
    
    let tableRows = '';
    allData.forEach((item, index) => {
      tableRows += `
        <tr>
          <td style="padding:4px 6px; border:1px solid #ddd; text-align:center; font-size:9px;">${index + 1}</td>
          <td style="padding:4px 6px; border:1px solid #ddd; text-align:left; font-size:9px;">${item.staff_employee_id}</td>
          <td style="padding:4px 6px; border:1px solid #ddd; text-align:left; font-size:9px;">${item.staff_name}</td>
          <td style="padding:4px 6px; border:1px solid #ddd; text-align:left; font-size:9px;">${item.staff_designation}</td>
          <td style="padding:4px 6px; border:1px solid #ddd; text-align:right; font-size:9px;">BDT ${item.total_salary.toLocaleString()}</td>
          <td style="padding:4px 6px; border:1px solid #ddd; text-align:right; font-size:9px;">BDT ${item.yearly_paid.toLocaleString()}</td>
          <td style="padding:4px 6px; border:1px solid #ddd; text-align:right; font-size:9px; color:#ef4444;">BDT ${item.yearly_balance > 0 ? item.yearly_balance.toLocaleString() : '0'}</td>
          <td style="padding:4px 6px; border:1px solid #ddd; text-align:right; font-size:9px; color:#22c55e;">BDT ${item.yearly_balance < 0 ? Math.abs(item.yearly_balance).toLocaleString() : '0'}</td>
          <td style="padding:4px 6px; border:1px solid #ddd; text-align:right; font-size:9px; font-weight:600;">BDT ${Math.abs(item.yearly_balance).toLocaleString()}</td>
        </tr>
      `;
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Staff Wise Salary Report - ${selectedYear}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: Arial, sans-serif; 
              margin: 0; 
              padding: 8mm 6mm;
              background: white;
              width: 210mm;
              min-height: 297mm;
              margin: 0 auto;
            }
            
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 8px;
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
            
            .footer {
              margin-top: 12px;
              padding-top: 6px;
              border-top: 1px solid #e5e7eb;
              font-size: 8px;
              color: #999;
              text-align: center;
            }
            .footer div {
              margin: 2px 0;
            }
            
            @media print {
              body {
                padding: 8mm 6mm;
                width: 100%;
                min-height: 100vh;
              }
              th {
                background-color: #4f46e5 !important;
                color: white !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
            }
            
            @page {
              size: A4;
              margin: 0;
            }
          </style>
        </head>
        <body>
          ${getSchoolPrintHeader(
            { school_logo: schoolSettings?.school_logo, school_name: schoolSettings?.school_name, school_address: schoolSettings?.school_address, school_phone: schoolSettings?.school_phone, school_email: schoolSettings?.school_email },
            "Staff Wise Salary Report"
          )}

          <table>
            <thead>
              <tr>
                <th style="width:4%;">SL</th>
                <th style="width:12%;">ID</th>
                <th style="width:16%;">Name</th>
                <th style="width:14%;">Designation</th>
                <th style="width:12%; text-align:right;">Monthly</th>
                <th style="width:12%; text-align:right;">Yearly Paid</th>
                <th style="width:10%; text-align:right;">Due</th>
                <th style="width:10%; text-align:right;">Advance</th>
                <th style="width:10%; text-align:right;">Balance</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>

          <div class="footer">
            <div>${schoolSettings?.school_name || 'চে আলী মডেল একাডেমী'}</div>
            <div>Page 1 of 1</div>
            <div>${new Date().toLocaleDateString()}</div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 1000);
  }, [filteredData, schoolSettings, selectedYear]);

  const handleViewDetails = (staff: StaffWiseData) => {
    setSelectedStaff(staff);
    setDetailDialogOpen(true);
  };

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

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <ResponsiveLayout>
      <div className="space-y-6 p-4 sm:p-6 print:p-0">
        {/* Header - Vibrant Gradient (Screen Only) */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 dark:from-emerald-700 dark:via-teal-700 dark:to-cyan-700 p-6 shadow-xl print:hidden"
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
                  Staff Wise Salary Report
                </h1>
                <p className="text-white/80 text-sm drop-shadow">Staff wise salary report and analysis</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[120px] rounded-xl bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm">
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                  {years.map((y) => (
                    <SelectItem key={y} value={y} className="text-gray-900 dark:text-white">{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                variant="outline" 
                onClick={handleExportExcel} 
                className="rounded-xl bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm"
              >
                <Download className="h-4 w-4 mr-2" /> Excel
              </Button>
              <Button 
                variant="outline" 
                onClick={handleExportPDF} 
                className="rounded-xl bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm"
              >
                <FileText className="h-4 w-4 mr-2" /> PDF
              </Button>
              <Button 
                variant="outline" 
                onClick={handlePrintAll} 
                className="rounded-xl bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm"
              >
                <Printer className="h-4 w-4 mr-2" /> Print All
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Stats Cards - Modern & Vibrant with Visible Text */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 print:hidden">
          {stats.map((stat, idx) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: idx * 0.1 }}
            >
              <Card className="border-0 shadow-lg rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white dark:bg-gray-800">
                <div className={`bg-gradient-to-br ${stat.bgGradient} p-5`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-2xl sm:text-3xl font-bold ${stat.textColor}`}>
                        {stat.value}
                      </p>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mt-1">{stat.title}</p>
                    </div>
                    <div className={`p-3 rounded-2xl ${stat.iconBg} shadow-lg`}>
                      <stat.icon className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Search Filter - Screen Only */}
        <Card className="border-0 shadow-md rounded-2xl mt-6 print:hidden bg-white dark:bg-gray-800">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
              <Input
                placeholder="Search by staff name or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 rounded-xl bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* Report Table - Modern Header */}
        <div className="print-content">
          <Card className="border-0 shadow-lg rounded-2xl overflow-hidden bg-white dark:bg-gray-800">
            {/* Table Header - Screen Only */}
            <div className="bg-gradient-to-r from-emerald-500 to-teal-500 dark:from-emerald-600 dark:to-teal-600 p-4 print:hidden">
              <CardHeader className="p-0">
                <CardTitle className="text-white text-lg font-semibold">Staff Wise Report - {selectedYear}</CardTitle>
                <CardDescription className="text-white/70 text-sm">Salary details for each staff member</CardDescription>
              </CardHeader>
            </div>
            
            <CardContent className="p-0 sm:p-6 overflow-x-auto">
              {loading ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading...</div>
              ) : filteredData.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 dark:text-gray-400">No data found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gradient-to-r from-emerald-500 to-teal-500 dark:from-emerald-600 dark:to-teal-600">
                        <TableHead className="text-white text-xs sm:text-sm font-semibold">Staff</TableHead>
                        <TableHead className="text-white text-xs sm:text-sm font-semibold hidden md:table-cell">Designation</TableHead>
                        <TableHead className="text-white text-xs sm:text-sm font-semibold hidden lg:table-cell">Category</TableHead>
                        <TableHead className="text-white text-xs sm:text-sm font-semibold">Monthly Salary</TableHead>
                        <TableHead className="text-white text-xs sm:text-sm font-semibold">Yearly Paid</TableHead>
                        <TableHead className="text-white text-xs sm:text-sm font-semibold">Due</TableHead>
                        <TableHead className="text-white text-xs sm:text-sm font-semibold">Advance</TableHead>
                        <TableHead className="text-white text-xs sm:text-sm font-semibold">Balance</TableHead>
                        <TableHead className="text-center text-white text-xs sm:text-sm font-semibold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredData.map((item, idx) => (
                        <motion.tr
                          key={item.staff_id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3, delay: idx * 0.03 }}
                          className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-100 dark:border-gray-700"
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={item.staff_photo_url} />
                                <AvatarFallback className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs">
                                  {item.staff_name?.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium text-sm text-gray-900 dark:text-white">{item.staff_name}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{item.staff_employee_id}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-gray-700 dark:text-gray-300 hidden md:table-cell">{item.staff_designation}</TableCell>
                          <TableCell className="text-sm text-gray-700 dark:text-gray-300 hidden lg:table-cell">{item.salary_category_name || "-"}</TableCell>
                          <TableCell className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(item.total_salary)}</TableCell>
                          <TableCell className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(item.yearly_paid)}</TableCell>
                          <TableCell className="text-sm font-semibold text-rose-600 dark:text-rose-400">{formatCurrency(item.yearly_balance > 0 ? item.yearly_balance : 0)}</TableCell>
                          <TableCell className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(item.yearly_balance < 0 ? Math.abs(item.yearly_balance) : 0)}</TableCell>
                          <TableCell className={`text-sm font-semibold ${item.yearly_balance > 0 ? 'text-rose-600 dark:text-rose-400' : item.yearly_balance < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-600 dark:text-gray-400'}`}>
                            {formatCurrency(Math.abs(item.yearly_balance))}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewDetails(item)}
                                className="text-blue-500 dark:text-blue-400 hover:text-blue-700"
                                title="View Details"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handlePrintStaffDetails(item)}
                                className="text-purple-500 dark:text-purple-400 hover:text-purple-700"
                                title="Print Details"
                              >
                                <Printer className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </motion.tr>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Staff Details Dialog - Solid Background */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="rounded-2xl max-w-3xl max-h-[85vh] overflow-y-auto bg-white dark:bg-gray-900 border-0 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white">Staff Salary Details</DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-400">
              Complete salary structure and annual statement
            </DialogDescription>
          </DialogHeader>
          {selectedStaff && (
            <div className="space-y-5">
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 rounded-xl p-4">
                <div className="flex items-center gap-4 flex-col sm:flex-row text-center sm:text-left">
                  <Avatar className="h-16 w-16 border-2 border-white dark:border-gray-700 shadow-md">
                    <AvatarImage src={selectedStaff.staff_photo_url} />
                    <AvatarFallback className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-lg">
                      {selectedStaff.staff_name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{selectedStaff.staff_name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">ID: {selectedStaff.staff_employee_id}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{selectedStaff.staff_designation}</p>
                    {selectedStaff.staff_joining_date && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">Joining: {new Date(selectedStaff.staff_joining_date).toLocaleDateString("en-CA")}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                <h4 className="font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-emerald-500" /> Salary Structure
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="text-center p-2 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Basic</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(selectedStaff.basic)}</p>
                  </div>
                  <div className="text-center p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
                    <p className="text-xs text-gray-500 dark:text-gray-400">HRA</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(selectedStaff.hra)}</p>
                  </div>
                  <div className="text-center p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                    <p className="text-xs text-gray-500 dark:text-gray-400">DA</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(selectedStaff.da)}</p>
                  </div>
                  <div className="text-center p-2 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Allowances</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(selectedStaff.allowances)}</p>
                  </div>
                  <div className="text-center p-2 bg-pink-50 dark:bg-pink-950/30 rounded-lg">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Personal Allow.</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(selectedStaff.personal_allowance)}</p>
                  </div>
                  <div className="text-center p-2 bg-orange-50 dark:bg-orange-950/30 rounded-lg">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Special Allow.</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(selectedStaff.special_allowance)}</p>
                  </div>
                  <div className="text-center p-2 bg-rose-50 dark:bg-rose-950/30 rounded-lg">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Deductions</p>
                    <p className="font-semibold text-rose-600 dark:text-rose-400">-{formatCurrency(selectedStaff.other_deductions)}</p>
                  </div>
                  <div className="text-center p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Total Monthly</p>
                    <p className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(selectedStaff.total_salary)}</p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                <h4 className="font-semibold text-gray-800 dark:text-white mb-3">Yearly Summary</h4>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Expected</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(selectedStaff.yearly_expected)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Paid</p>
                    <p className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(selectedStaff.yearly_paid)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Balance</p>
                    <p className={`font-semibold ${selectedStaff.yearly_balance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {formatCurrency(Math.abs(selectedStaff.yearly_balance))}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-gray-800 dark:text-white mb-3">Monthly Breakdown</h4>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gradient-to-r from-emerald-500 to-teal-500 dark:from-emerald-600 dark:to-teal-600">
                        <TableHead className="text-white font-semibold">Month</TableHead>
                        <TableHead className="text-white font-semibold text-right">Expected</TableHead>
                        <TableHead className="text-white font-semibold text-right">Paid</TableHead>
                        <TableHead className="text-white font-semibold text-right">Balance</TableHead>
                        <TableHead className="text-white font-semibold text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedStaff.monthly_breakdown.map((month, i) => (
                        <TableRow key={i} className="border-b border-gray-100 dark:border-gray-700">
                          <TableCell className="font-medium text-gray-900 dark:text-white">{month.month}</TableCell>
                          <TableCell className="text-gray-700 dark:text-gray-300 text-right">{formatCurrency(month.expected)}</TableCell>
                          <TableCell className="text-emerald-600 dark:text-emerald-400 text-right">{formatCurrency(month.paid)}</TableCell>
                          <TableCell className={`text-right ${month.balance > 0 ? 'text-rose-600 dark:text-rose-400' : month.balance < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-600 dark:text-gray-400'}`}>
                            {formatCurrency(Math.abs(month.balance))}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={`rounded-xl ${
                              month.status === "paid" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" :
                              month.status === "partial" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" :
                              "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400"
                            }`}>
                              {month.status === "paid" ? "Paid" : month.status === "partial" ? "Partial" : "Pending"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {selectedStaff.advance_details && selectedStaff.advance_details.length > 0 && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <h4 className="font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-emerald-500" /> Advance Details
                  </h4>
                  {selectedStaff.advance_details.map((advance, i) => (
                    <div key={i} className="bg-orange-50 dark:bg-orange-950/30 rounded-lg p-3 mb-2">
                      <div className="flex justify-between items-center flex-wrap gap-2">
                        <span className="text-gray-700 dark:text-gray-300">Advance Amount: <span className="font-semibold">{formatCurrency(advance.amount)}</span></span>
                        <span className="text-gray-700 dark:text-gray-300">Remaining: <span className="font-semibold text-rose-600 dark:text-rose-400">{formatCurrency(advance.remaining)}</span></span>
                        <span className="text-gray-700 dark:text-gray-300">Installments Left: <span className="font-semibold">{advance.installments}</span></span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setDetailDialogOpen(false);
                    if (selectedStaff) {
                      handlePrintStaffDetails(selectedStaff);
                    }
                  }} 
                  className="rounded-xl border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
                >
                  <Printer className="h-4 w-4 mr-2" /> Print
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setDetailDialogOpen(false)} 
                  className="rounded-xl border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </ResponsiveLayout>
  );
}
