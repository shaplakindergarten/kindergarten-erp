// src/app/staff/salary/advance/page.tsx
"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, Plus, Edit, Trash2, Eye, CreditCard, 
  Calendar, DollarSign, Users, TrendingDown, CheckCircle,
  Clock, AlertCircle, Search, Filter, Download, Printer
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ResponsiveLayout } from "@/components/layout/responsive-layout";
import { getSchoolPrintHeader } from "@/components/print/SchoolPrintHeader";
import { getStaff } from "@/lib/api/staff";
import { useToastStore } from "@/store/useStore";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, months, getCurrentMonth, getCurrentYear } from "@/lib/salary/salaryUtils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { motion } from "framer-motion";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface AdvanceRequest {
  id: string;
  staff_id: string;
  staff_name: string;
  staff_employee_id: string;
  staff_photo_url?: string;
  amount: number;
  advance_date: string;
  reason: string;
  total_installments: number;
  paid_installments: number;
  installment_amount: number;
  status: 'pending' | 'active' | 'completed' | 'rejected';
  created_at: string;
}

interface Installment {
  id: string;
  advance_id: string;
  month: string;
  year: number;
  amount: number;
  status: 'pending' | 'paid';
  paid_at: string | null;
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
  onChange,
  disabled = false
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
        disabled={disabled}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-right font-mono disabled:opacity-60 disabled:cursor-not-allowed"
        autoComplete="off"
        dir="ltr"
      />
    </div>
  );
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function AdvanceLoanPage() {
  const router = useRouter();
  const [staff, setStaff] = useState<any[]>([]);
  const [advances, setAdvances] = useState<AdvanceRequest[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editingAdvance, setEditingAdvance] = useState<AdvanceRequest | null>(null);
  const [selectedAdvance, setSelectedAdvance] = useState<AdvanceRequest | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  
  const [formData, setFormData] = useState({
    staff_id: "",
    amount: "",
    advance_date: new Date().toISOString().split("T")[0],
    reason: "",
    total_installments: "1",
    installment_amount: "",
  });

  const addToast = useToastStore((state) => state.addToast);

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

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const [staffData, advancesData, installmentsData] = await Promise.all([
        getStaff(),
        supabase.from("salary_advances").select("*").order("created_at", { ascending: false }),
        supabase.from("advance_installments").select("*"),
      ]);
      
      setStaff(staffData || []);
      
      const mappedAdvances = (advancesData.data || []).map((a: any) => {
        const staffMember = staffData?.find((s: any) => s.id === a.staff_id);
        return {
          id: a.id,
          staff_id: a.staff_id,
          staff_name: staffMember?.name || "",
          staff_employee_id: staffMember?.employee_id || "",
          staff_photo_url: staffMember?.photo_url || "",
          amount: a.amount,
          advance_date: a.advance_date,
          reason: a.reason,
          total_installments: a.total_installments,
          paid_installments: a.paid_installments,
          installment_amount: a.installment_amount,
          status: a.status,
          created_at: a.created_at,
        };
      });
      
      setAdvances(mappedAdvances);
      setInstallments(installmentsData.data || []);
      
    } catch (err) {
      console.error("Failed to load data:", err);
      addToast({ type: "error", title: "Error", message: "Failed to load advance data" });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadData();
    loadSchoolSettings();
  }, [loadData, loadSchoolSettings]);

  // ============================================================
  // CALCULATIONS
  // ============================================================

  const calculateInstallmentAmount = (amount: number, installments: number) => {
    return Math.ceil(amount / installments);
  };

  const handleAmountChange = (amount: string) => {
    setFormData({ ...formData, amount });
    if (formData.total_installments && amount) {
      const installmentAmount = calculateInstallmentAmount(parseFloat(amount) || 0, parseInt(formData.total_installments));
      setFormData({ ...formData, amount, installment_amount: installmentAmount.toString() });
    }
  };

  const handleInstallmentsChange = (installments: string) => {
    setFormData({ ...formData, total_installments: installments });
    if (formData.amount && installments) {
      const installmentAmount = calculateInstallmentAmount(parseFloat(formData.amount) || 0, parseInt(installments));
      setFormData({ ...formData, total_installments: installments, installment_amount: installmentAmount.toString() });
    }
  };

  // ============================================================
  // CRUD OPERATIONS
  // ============================================================

  const handleSubmit = async () => {
    if (!formData.staff_id || !formData.amount || parseFloat(formData.amount) <= 0) {
      addToast({ type: "error", title: "Error", message: "Please fill all required fields" });
      return;
    }

    try {
      const supabase = createClient();
      const installmentAmount = calculateInstallmentAmount(parseFloat(formData.amount), parseInt(formData.total_installments));
      
      const advanceData = {
        staff_id: formData.staff_id,
        amount: parseFloat(formData.amount),
        advance_date: formData.advance_date,
        reason: formData.reason,
        total_installments: parseInt(formData.total_installments),
        paid_installments: 0,
        installment_amount: installmentAmount,
        status: 'active',
      };

      if (editingAdvance) {
        await supabase.from("salary_advances").update(advanceData).eq("id", editingAdvance.id);
        addToast({ type: "success", title: "Success", message: "Advance updated successfully" });
      } else {
        const { data: newAdvance, error } = await supabase
          .from("salary_advances")
          .insert(advanceData)
          .select()
          .single();
        
        if (error) throw error;
        
        const installmentData = [];
        let currentDate = new Date();
        for (let i = 0; i < parseInt(formData.total_installments); i++) {
          const monthIndex = (currentDate.getMonth() + i) % 12;
          const yearOffset = Math.floor((currentDate.getMonth() + i) / 12);
          installmentData.push({
            advance_id: newAdvance.id,
            month: months[monthIndex],
            year: currentDate.getFullYear() + yearOffset,
            amount: installmentAmount,
            status: 'pending',
          });
        }
        
        await supabase.from("advance_installments").insert(installmentData);
        addToast({ type: "success", title: "Success", message: "Advance created successfully" });
      }

      setDialogOpen(false);
      setEditingAdvance(null);
      setFormData({
        staff_id: "",
        amount: "",
        advance_date: new Date().toISOString().split("T")[0],
        reason: "",
        total_installments: "1",
        installment_amount: "",
      });
      await loadData();
    } catch (err) {
      console.error(err);
      addToast({ type: "error", title: "Error", message: "Failed to save advance" });
    }
  };

  const handleDelete = async (id: string, staffName: string) => {
    if (!confirm(`Are you sure you want to delete advance for "${staffName}"?`)) return;
    
    try {
      const supabase = createClient();
      await supabase.from("advance_installments").delete().eq("advance_id", id);
      await supabase.from("salary_advances").delete().eq("id", id);
      addToast({ type: "success", title: "Success", message: "Advance deleted successfully" });
      await loadData();
    } catch (err) {
      console.error(err);
      addToast({ type: "error", title: "Error", message: "Failed to delete advance" });
    }
  };

  const handleViewDetails = async (advance: AdvanceRequest) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("advance_installments")
      .select("*")
      .eq("advance_id", advance.id)
      .order("year", { ascending: true })
      .order("month", { ascending: true });
    
    setSelectedAdvance({ ...advance, installments: data || [] } as any);
    setViewDialogOpen(true);
  };

  const handlePayInstallment = async (installmentId: string, advanceId: string) => {
    try {
      const supabase = createClient();
      
      await supabase
        .from("advance_installments")
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq("id", installmentId);
      
      const { data: advance } = await supabase
        .from("salary_advances")
        .select("*")
        .eq("id", advanceId)
        .single();
      
      const newPaidCount = (advance.paid_installments || 0) + 1;
      const newStatus = newPaidCount >= advance.total_installments ? 'completed' : 'active';
      
      await supabase
        .from("salary_advances")
        .update({ paid_installments: newPaidCount, status: newStatus })
        .eq("id", advanceId);
      
      addToast({ type: "success", title: "Success", message: "Installment paid successfully" });
      await loadData();
      if (selectedAdvance) handleViewDetails(selectedAdvance);
    } catch (err) {
      console.error(err);
      addToast({ type: "error", title: "Error", message: "Failed to pay installment" });
    }
  };

  // ============================================================
  // UTILITIES
  // ============================================================

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return { label: 'Active', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' };
      case 'completed':
        return { label: 'Completed', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' };
      case 'pending':
        return { label: 'Pending', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' };
      case 'rejected':
        return { label: 'Rejected', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' };
      default:
        return { label: status, color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400' };
    }
  };

  // ============================================================
  // FILTERED DATA & STATISTICS
  // ============================================================

  const filteredAdvances = useMemo(() => {
    return advances.filter(advance => {
      if (searchTerm && !advance.staff_name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (filterStatus !== "all" && advance.status !== filterStatus) return false;
      return true;
    });
  }, [advances, searchTerm, filterStatus]);

  const statistics = useMemo(() => ({
    totalActive: advances.filter(a => a.status === 'active').length,
    totalCompleted: advances.filter(a => a.status === 'completed').length,
    totalAmount: advances.reduce((sum, a) => sum + a.amount, 0),
    totalRemaining: advances
      .filter(a => a.status === 'active')
      .reduce((sum, a) => sum + (a.amount - (a.installment_amount * a.paid_installments)), 0),
  }), [advances]);

  const stats = useMemo(() => [
    { 
      title: "Active Advances", 
      value: statistics.totalActive, 
      icon: CreditCard,
      bgGradient: "from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/30",
      iconBg: "bg-blue-500 dark:bg-blue-600",
      textColor: "text-gray-900 dark:text-white"
    },
    { 
      title: "Completed", 
      value: statistics.totalCompleted, 
      icon: CheckCircle,
      bgGradient: "from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/30",
      iconBg: "bg-emerald-500 dark:bg-emerald-600",
      textColor: "text-gray-900 dark:text-white"
    },
    { 
      title: "Total Advances", 
      value: formatCurrency(statistics.totalAmount), 
      icon: DollarSign,
      bgGradient: "from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/30",
      iconBg: "bg-purple-500 dark:bg-purple-600",
      textColor: "text-gray-900 dark:text-white"
    },
    { 
      title: "Remaining", 
      value: formatCurrency(statistics.totalRemaining), 
      icon: TrendingDown,
      bgGradient: "from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/30",
      iconBg: "bg-orange-500 dark:bg-orange-600",
      textColor: "text-gray-900 dark:text-white"
    },
  ], [statistics]);

  // ============================================================
  // EXPORT FUNCTIONS
  // ============================================================

  const handleExportExcel = () => {
    const exportData = advances.map(item => ({
      "Staff ID": item.staff_employee_id,
      "Staff Name": item.staff_name,
      "Amount": item.amount,
      "Date": item.advance_date,
      "Reason": item.reason,
      "Total Installments": item.total_installments,
      "Paid Installments": item.paid_installments,
      "Installment Amount": item.installment_amount,
      "Status": item.status,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Advance Report");
    XLSX.writeFile(wb, `advance_report_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  // ============================================================
  // PRINT FUNCTION
  // ============================================================

  const handlePrint = useCallback(async () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.print();
      return;
    }

    let tableRows = '';
    filteredAdvances.forEach((item, index) => {
      const statusInfo = getStatusBadge(item.status);
      tableRows += `
        <tr>
          <td style="padding:6px; border:1px solid #ddd; text-align:center; font-size:10px;">${index + 1}</td>
          <td style="padding:6px; border:1px solid #ddd; text-align:left; font-size:10px;">${item.staff_employee_id}</td>
          <td style="padding:6px; border:1px solid #ddd; text-align:left; font-size:10px;">${item.staff_name}</td>
          <td style="padding:6px; border:1px solid #ddd; text-align:right; font-size:10px;">BDT ${item.amount.toLocaleString()}</td>
          <td style="padding:6px; border:1px solid #ddd; text-align:center; font-size:10px;">${new Date(item.advance_date).toLocaleDateString()}</td>
          <td style="padding:6px; border:1px solid #ddd; text-align:center; font-size:10px;">${item.paid_installments}/${item.total_installments}</td>
          <td style="padding:6px; border:1px solid #ddd; text-align:center; font-size:10px;">
            <span style="background:${item.status === 'active' ? '#3b82f6' : item.status === 'completed' ? '#22c55e' : item.status === 'pending' ? '#eab308' : '#ef4444'}; color:white; padding:2px 10px; border-radius:12px; font-size:9px;">
              ${statusInfo.label}
            </span>
          </td>
        </tr>
      `;
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Advance & Loan Report</title>
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
            
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
              font-size: 10px;
            }
            th {
              background-color: #4f46e5;
              color: white;
              font-weight: bold;
              padding: 6px;
              border: 1px solid #4f46e5;
              text-align: center;
            }
            td {
              padding: 6px;
              border: 1px solid #ddd;
              text-align: left;
              vertical-align: middle;
            }
            
            .footer {
              margin-top: 15px;
              padding-top: 8px;
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
            "Advance & Loan Report"
          )}
          
          <table>
            <thead>
              <tr>
                <th style="width:5%;">SL</th>
                <th style="width:12%;">ID</th>
                <th style="width:18%;">Staff Name</th>
                <th style="width:15%; text-align:right;">Amount</th>
                <th style="width:12%;">Date</th>
                <th style="width:15%;">Installments</th>
                <th style="width:13%;">Status</th>
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
  }, [filteredAdvances, schoolSettings]);

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
      <div className="space-y-6 p-4 sm:p-6">
        {/* Header - Vibrant Gradient */}
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
                  Advance & Loan Management
                </h1>
                <p className="text-white/80 text-sm drop-shadow">Manage staff advances and loans</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={handlePrint} 
                className="rounded-xl bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm"
              >
                <Printer className="h-4 w-4 mr-2" /> Print
              </Button>
              <Button 
                variant="outline" 
                onClick={handleExportExcel} 
                className="rounded-xl bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm"
              >
                <Download className="h-4 w-4 mr-2" /> Export
              </Button>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button 
                    onClick={() => setEditingAdvance(null)} 
                    className="rounded-xl bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm"
                  >
                    <Plus className="h-4 w-4 mr-2" /> New Advance
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-2xl max-w-md bg-white dark:bg-gray-900 border-0 shadow-2xl">
                  <DialogHeader>
                    <DialogTitle className="text-gray-900 dark:text-white">
                      {editingAdvance ? "Edit Advance" : "New Advance Request"}
                    </DialogTitle>
                    <DialogDescription className="text-gray-600 dark:text-gray-400">
                      Enter staff advance information
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-gray-700 dark:text-gray-300">Staff Member *</Label>
                      <Select value={formData.staff_id} onValueChange={(v) => setFormData({ ...formData, staff_id: v })}>
                        <SelectTrigger className="rounded-xl bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                          <SelectValue placeholder="Select staff member" />
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                          {staff.map((s) => (
                            <SelectItem key={s.id} value={s.id} className="text-gray-900 dark:text-white">
                              {s.employee_id} - {s.name} ({s.designation})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <NumberInputField
                      label="Advance Amount *"
                      value={formData.amount}
                      onChange={(val: string) => handleAmountChange(val)}
                      placeholder="Amount"
                    />
                    <div>
                      <Label className="text-gray-700 dark:text-gray-300">Date *</Label>
                      <Input
                        type="date"
                        value={formData.advance_date}
                        onChange={(e) => setFormData({ ...formData, advance_date: e.target.value })}
                        className="rounded-xl bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-700 dark:text-gray-300">Total Installments *</Label>
                      <Select value={formData.total_installments} onValueChange={(v) => handleInstallmentsChange(v)}>
                        <SelectTrigger className="rounded-xl bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                          <SelectValue placeholder="Number of installments" />
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                          {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((num) => (
                            <SelectItem key={num} value={num.toString()} className="text-gray-900 dark:text-white">
                              {num} months
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <NumberInputField
                      label="Installment Amount (Auto-calculated)"
                      value={formData.installment_amount}
                      onChange={() => {}}
                      placeholder="Installment amount"
                      disabled={true}
                    />
                    <div>
                      <Label className="text-gray-700 dark:text-gray-300">Reason</Label>
                      <Input
                        value={formData.reason}
                        onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                        placeholder="Reason for advance"
                        className="rounded-xl bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
                        Cancel
                      </Button>
                      <Button onClick={handleSubmit} className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
                        {editingAdvance ? "Update" : "Create"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </motion.div>

        {/* Statistics Cards - Modern & Vibrant */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

        {/* Filters */}
        <Card className="border-0 shadow-md rounded-2xl bg-white dark:bg-gray-800">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
                <Input
                  placeholder="Search by staff name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 rounded-xl bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[150px] rounded-xl bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                  <SelectItem value="all" className="text-gray-900 dark:text-white">All</SelectItem>
                  <SelectItem value="active" className="text-gray-900 dark:text-white">Active</SelectItem>
                  <SelectItem value="completed" className="text-gray-900 dark:text-white">Completed</SelectItem>
                  <SelectItem value="pending" className="text-gray-900 dark:text-white">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Advances Table - Modern Header */}
        <Card className="border-0 shadow-lg rounded-2xl overflow-hidden bg-white dark:bg-gray-800">
          <div className="bg-gradient-to-r from-emerald-500 to-teal-500 dark:from-emerald-600 dark:to-teal-600 p-4">
            <CardHeader className="p-0">
              <CardTitle className="text-white text-lg font-semibold">Advance & Loan List</CardTitle>
              <CardDescription className="text-white/70 text-sm">List of all advances and loans</CardDescription>
            </CardHeader>
          </div>
          <CardContent className="p-0 sm:p-6 overflow-x-auto">
            {loading ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading...</div>
            ) : filteredAdvances.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-gray-500 dark:text-gray-400">No advance records found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gradient-to-r from-emerald-500 to-teal-500 dark:from-emerald-600 dark:to-teal-600">
                      <TableHead className="text-white text-xs sm:text-sm font-semibold">Staff</TableHead>
                      <TableHead className="text-white text-xs sm:text-sm font-semibold">Amount</TableHead>
                      <TableHead className="text-white text-xs sm:text-sm font-semibold hidden md:table-cell">Date</TableHead>
                      <TableHead className="text-white text-xs sm:text-sm font-semibold">Installments</TableHead>
                      <TableHead className="text-white text-xs sm:text-sm font-semibold">Status</TableHead>
                      <TableHead className="text-center text-white text-xs sm:text-sm font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAdvances.map((advance, idx) => {
                      const statusInfo = getStatusBadge(advance.status);
                      const progress = (advance.paid_installments / advance.total_installments) * 100;
                      
                      return (
                        <motion.tr
                          key={advance.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3, delay: idx * 0.05 }}
                          className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-100 dark:border-gray-700"
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={advance.staff_photo_url} />
                                <AvatarFallback className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs">
                                  {advance.staff_name?.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium text-sm text-gray-900 dark:text-white">{advance.staff_name}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{advance.staff_employee_id}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold text-sm text-gray-900 dark:text-white">{formatCurrency(advance.amount)}</TableCell>
                          <TableCell className="text-sm text-gray-700 dark:text-gray-300 hidden md:table-cell">{new Date(advance.advance_date).toLocaleDateString("en-CA")}</TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <span className="text-xs text-gray-700 dark:text-gray-300">{advance.paid_installments}/{advance.total_installments}</span>
                              <div className="w-20 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full" style={{ width: `${progress}%` }} />
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={`rounded-xl ${statusInfo.color}`}>{statusInfo.label}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewDetails(advance)}
                                className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                                title="View Details"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {advance.status === 'active' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setEditingAdvance(advance);
                                    setFormData({
                                      staff_id: advance.staff_id,
                                      amount: advance.amount.toString(),
                                      advance_date: advance.advance_date,
                                      reason: advance.reason || "",
                                      total_installments: advance.total_installments.toString(),
                                      installment_amount: advance.installment_amount.toString(),
                                    });
                                    setDialogOpen(true);
                                  }}
                                  className="text-amber-500 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
                                  title="Edit"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(advance.id, advance.staff_name)}
                                className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </motion.tr>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* View Details Dialog - Solid Background */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="rounded-2xl max-w-2xl max-h-[85vh] overflow-y-auto bg-white dark:bg-gray-900 border-0 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white">Advance Details</DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-400">
              Complete advance details and installment information
            </DialogDescription>
          </DialogHeader>
          {selectedAdvance && (
            <div className="space-y-5">
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={selectedAdvance.staff_photo_url} />
                    <AvatarFallback className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white">
                      {selectedAdvance.staff_name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white">{selectedAdvance.staff_name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">ID: {selectedAdvance.staff_employee_id}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Advance: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(selectedAdvance.amount)}</span></p>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Progress</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{selectedAdvance.paid_installments}/{selectedAdvance.total_installments} Installments</span>
                </div>
                <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                    style={{ width: `${(selectedAdvance.paid_installments / selectedAdvance.total_installments) * 100}%` }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Installment Amount</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(selectedAdvance.installment_amount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Remaining</p>
                    <p className="font-semibold text-orange-600 dark:text-orange-400">
                      {formatCurrency(selectedAdvance.amount - (selectedAdvance.installment_amount * selectedAdvance.paid_installments))}
                    </p>
                  </div>
                </div>
              </div>
              
              {(selectedAdvance as any).installments && (selectedAdvance as any).installments.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-800 dark:text-white mb-3">Installment List</h4>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gradient-to-r from-emerald-500 to-teal-500 dark:from-emerald-600 dark:to-teal-600">
                          <TableHead className="text-white font-semibold">Month/Year</TableHead>
                          <TableHead className="text-white font-semibold text-right">Amount</TableHead>
                          <TableHead className="text-white font-semibold text-center">Status</TableHead>
                          <TableHead className="text-white font-semibold text-center">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(selectedAdvance as any).installments.map((inst: Installment) => (
                          <TableRow key={inst.id} className="border-b border-gray-100 dark:border-gray-700">
                            <TableCell className="font-medium text-gray-900 dark:text-white">{inst.month} {inst.year}</TableCell>
                            <TableCell className="text-gray-700 dark:text-gray-300 text-right">{formatCurrency(inst.amount)}</TableCell>
                            <TableCell className="text-center">
                              <Badge className={`rounded-xl ${inst.status === 'paid' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>
                                {inst.status === 'paid' ? 'Paid' : 'Pending'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              {inst.status === 'pending' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handlePayInstallment(inst.id, selectedAdvance.id)}
                                  className="text-emerald-500 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" /> Pay
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
              
              {selectedAdvance.reason && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Reason</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{selectedAdvance.reason}</p>
                </div>
              )}
              
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setViewDialogOpen(false)} className="rounded-xl border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
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
