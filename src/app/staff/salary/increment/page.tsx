// src/app/staff/salary/increment/page.tsx
"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, Plus, Edit, Trash2, Eye, TrendingUp, 
  Calendar, DollarSign, Users, Search, Filter, 
  Download, Printer, AlertCircle, CheckCircle, Award
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
import { formatCurrency } from "@/lib/salary/salaryUtils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { motion } from "framer-motion";
import * as XLSX from "xlsx";

interface IncrementRecord {
  id: string;
  staff_id: string;
  staff_name: string;
  staff_employee_id: string;
  staff_photo_url?: string;
  old_salary: number;
  new_salary: number;
  increment_percentage: number;
  increment_amount: number;
  effective_from: string;
  reason: string;
  created_by: string;
  created_by_name?: string;
  created_at: string;
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

export default function IncrementPage() {
  const router = useRouter();
  const [staff, setStaff] = useState<any[]>([]);
  const [increments, setIncrements] = useState<IncrementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editingIncrement, setEditingIncrement] = useState<IncrementRecord | null>(null);
  const [selectedIncrement, setSelectedIncrement] = useState<IncrementRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterYear, setFilterYear] = useState("all");
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  
  const [formData, setFormData] = useState({
    staff_id: "",
    old_salary: "",
    new_salary: "",
    effective_from: new Date().toISOString().split("T")[0],
    reason: "",
  });

  const [currentSalary, setCurrentSalary] = useState(0);
  const [incrementAmount, setIncrementAmount] = useState(0);
  const [incrementPercentage, setIncrementPercentage] = useState(0);

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
      
      // First, check what columns exist in salary_increments table
      const { data: columnCheck, error: columnError } = await supabase
        .from("salary_increments")
        .select("*")
        .limit(1);
      
      let oldSalaryColumn = 'old_salary';
      let newSalaryColumn = 'new_salary';
      
      // If there's data, check the actual column names
      if (columnCheck && columnCheck.length > 0) {
        const firstRow = columnCheck[0];
        // Check for possible column names
        if ('old_salary' in firstRow) oldSalaryColumn = 'old_salary';
        else if ('oldSalary' in firstRow) oldSalaryColumn = 'oldSalary';
        else if ('current_salary' in firstRow) oldSalaryColumn = 'current_salary';
        else if ('previous_salary' in firstRow) oldSalaryColumn = 'previous_salary';
        
        if ('new_salary' in firstRow) newSalaryColumn = 'new_salary';
        else if ('newSalary' in firstRow) newSalaryColumn = 'newSalary';
        else if ('updated_salary' in firstRow) newSalaryColumn = 'updated_salary';
      }
      
      // Now fetch data with the correct column names
      const [staffData, incrementsData] = await Promise.all([
        getStaff(),
        supabase
          .from("salary_increments")
          .select("*, staff:staff_id(name, employee_id, photo_url), created_by_staff:created_by(name)")
          .order("effective_from", { ascending: false }),
      ]);
      
      setStaff(staffData || []);
      
      // Map the data with correct column names
      const mappedIncrements = (incrementsData.data || []).map((inc: any) => {
        const staffMember = staffData?.find((s: any) => s.id === inc.staff_id);
        
        // Get old salary from the correct column
        const oldSalary = inc[oldSalaryColumn] || 0;
        const newSalary = inc[newSalaryColumn] || 0;
        const incrementAmt = newSalary - oldSalary;
        const incrementPct = oldSalary > 0 ? (incrementAmt / oldSalary) * 100 : 0;
        
        return {
          id: inc.id,
          staff_id: inc.staff_id,
          staff_name: staffMember?.name || "",
          staff_employee_id: staffMember?.employee_id || "",
          staff_photo_url: staffMember?.photo_url || "",
          old_salary: oldSalary,
          new_salary: newSalary,
          increment_percentage: parseFloat(incrementPct.toFixed(2)),
          increment_amount: incrementAmt,
          effective_from: inc.effective_from,
          reason: inc.reason || inc.remarks || "",
          created_by: inc.created_by,
          created_by_name: inc.created_by_staff?.name,
          created_at: inc.created_at,
        };
      });
      
      setIncrements(mappedIncrements);
      
    } catch (err) {
      console.error("Failed to load data:", err);
      addToast({ type: "error", title: "Error", message: "Failed to load increment data" });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  const getCurrentStaffSalary = (staffId: string, staffData?: any[]): number => {
    const staffList = staffData || staff;
    const staffMember = staffList.find((s: any) => s.id === staffId);
    if (staffMember?.salary_category) {
      const cat = staffMember.salary_category;
      return (cat.basic || 0) + (cat.hra || 0) + (cat.da || 0) + (cat.allowances || 0) - (cat.deductions || 0);
    }
    return 0;
  };

  useEffect(() => {
    loadData();
    loadSchoolSettings();
  }, [loadData, loadSchoolSettings]);

  // ============================================================
  // HANDLERS
  // ============================================================

  const handleStaffChange = (staffId: string) => {
    const salary = getCurrentStaffSalary(staffId);
    setCurrentSalary(salary);
    setFormData({ 
      ...formData, 
      staff_id: staffId, 
      old_salary: salary.toString(),
      new_salary: salary.toString() 
    });
    setIncrementAmount(0);
    setIncrementPercentage(0);
  };

  const handleNewSalaryChange = (newSalary: string) => {
    const newSal = parseFloat(newSalary) || 0;
    const incrementAmt = newSal - currentSalary;
    const incrementPct = currentSalary > 0 ? (incrementAmt / currentSalary) * 100 : 0;
    
    setFormData({ ...formData, new_salary: newSalary });
    setIncrementAmount(incrementAmt);
    setIncrementPercentage(parseFloat(incrementPct.toFixed(2)));
  };

  const handleSubmit = async () => {
    if (!formData.staff_id || !formData.new_salary || parseFloat(formData.new_salary) <= 0) {
      addToast({ type: "error", title: "Error", message: "Please fill all required fields" });
      return;
    }

    if (parseFloat(formData.new_salary) <= currentSalary) {
      addToast({ type: "error", title: "Error", message: "New salary must be greater than current salary" });
      return;
    }

    try {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      
      const incrementData = {
        staff_id: formData.staff_id,
        old_salary: currentSalary,
        new_salary: parseFloat(formData.new_salary),
        increment_percentage: incrementPercentage,
        effective_from: formData.effective_from,
        reason: formData.reason,
        created_by: userData.user?.id,
      };

      if (editingIncrement) {
        await supabase.from("salary_increments").update(incrementData).eq("id", editingIncrement.id);
        addToast({ type: "success", title: "Success", message: "Increment updated successfully" });
      } else {
        await supabase.from("salary_increments").insert(incrementData);
        addToast({ type: "success", title: "Success", message: "Increment recorded successfully" });
      }

      setDialogOpen(false);
      setEditingIncrement(null);
      setFormData({
        staff_id: "",
        old_salary: "",
        new_salary: "",
        effective_from: new Date().toISOString().split("T")[0],
        reason: "",
      });
      setCurrentSalary(0);
      setIncrementAmount(0);
      setIncrementPercentage(0);
      await loadData();
    } catch (err) {
      console.error(err);
      addToast({ type: "error", title: "Error", message: "Failed to save increment record" });
    }
  };

  const handleDelete = async (id: string, staffName: string) => {
    if (!confirm(`Are you sure you want to delete increment record for "${staffName}"?`)) return;
    
    try {
      const supabase = createClient();
      await supabase.from("salary_increments").delete().eq("id", id);
      addToast({ type: "success", title: "Success", message: "Increment record deleted successfully" });
      await loadData();
    } catch (err) {
      console.error(err);
      addToast({ type: "error", title: "Error", message: "Failed to delete increment record" });
    }
  };

  const handleViewDetails = (increment: IncrementRecord) => {
    setSelectedIncrement(increment);
    setViewDialogOpen(true);
  };

  // ============================================================
  // FILTERED DATA & STATISTICS
  // ============================================================

  const filteredIncrements = useMemo(() => {
    return increments.filter(inc => {
      if (searchTerm && !inc.staff_name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (filterYear !== "all" && !inc.effective_from.includes(filterYear)) return false;
      return true;
    });
  }, [increments, searchTerm, filterYear]);

  const statistics = useMemo(() => ({
    totalIncrements: increments.length,
    totalAmount: increments.reduce((sum, inc) => sum + inc.increment_amount, 0),
    avgPercentage: increments.length > 0 
      ? increments.reduce((sum, inc) => sum + inc.increment_percentage, 0) / increments.length 
      : 0,
    maxIncrement: increments.length > 0 
      ? Math.max(...increments.map(inc => inc.increment_amount)) 
      : 0,
  }), [increments]);

  const stats = useMemo(() => [
    { 
      title: "Total Increments", 
      value: statistics.totalIncrements, 
      icon: TrendingUp,
      bgGradient: "from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/30",
      iconBg: "bg-blue-500 dark:bg-blue-600",
      textColor: "text-gray-900 dark:text-white"
    },
    { 
      title: "Total Increase", 
      value: formatCurrency(statistics.totalAmount), 
      icon: DollarSign,
      bgGradient: "from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/30",
      iconBg: "bg-emerald-500 dark:bg-emerald-600",
      textColor: "text-gray-900 dark:text-white"
    },
    { 
      title: "Average Increase", 
      value: `${statistics.avgPercentage.toFixed(1)}%`, 
      icon: TrendingUp,
      bgGradient: "from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/30",
      iconBg: "bg-amber-500 dark:bg-amber-600",
      textColor: "text-gray-900 dark:text-white"
    },
    { 
      title: "Highest Increase", 
      value: formatCurrency(statistics.maxIncrement), 
      icon: Award,
      bgGradient: "from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/30",
      iconBg: "bg-purple-500 dark:bg-purple-600",
      textColor: "text-gray-900 dark:text-white"
    },
  ], [statistics]);

  const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - 2 + i).toString());

  // ============================================================
  // EXPORT FUNCTIONS
  // ============================================================

  const handleExportExcel = () => {
    const exportData = filteredIncrements.map(item => ({
      "Staff ID": item.staff_employee_id,
      "Staff Name": item.staff_name,
      "Old Salary": item.old_salary,
      "New Salary": item.new_salary,
      "Increment Amount": item.increment_amount,
      "Increment %": item.increment_percentage,
      "Effective From": item.effective_from,
      "Reason": item.reason || "-",
      "Created At": new Date(item.created_at).toLocaleDateString(),
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Increment History");
    XLSX.writeFile(wb, `increment_history_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  // ============================================================
  // PRINT FUNCTION
  // ============================================================

  const handlePrint = useCallback(() => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.print();
      return;
    }

    let tableRows = '';
    filteredIncrements.forEach((item, index) => {
      tableRows += `
        <tr>
          <td style="padding:6px; border:1px solid #ddd; text-align:center; font-size:10px;">${index + 1}</td>
          <td style="padding:6px; border:1px solid #ddd; text-align:left; font-size:10px;">${item.staff_employee_id}</td>
          <td style="padding:6px; border:1px solid #ddd; text-align:left; font-size:10px;">${item.staff_name}</td>
          <td style="padding:6px; border:1px solid #ddd; text-align:right; font-size:10px;">BDT ${item.old_salary.toLocaleString()}</td>
          <td style="padding:6px; border:1px solid #ddd; text-align:right; font-size:10px; color:#22c55e;">BDT ${item.new_salary.toLocaleString()}</td>
          <td style="padding:6px; border:1px solid #ddd; text-align:right; font-size:10px; color:#22c55e;">+BDT ${item.increment_amount.toLocaleString()}</td>
          <td style="padding:6px; border:1px solid #ddd; text-align:center; font-size:10px;">${item.increment_percentage}%</td>
          <td style="padding:6px; border:1px solid #ddd; text-align:center; font-size:10px;">${new Date(item.effective_from).toLocaleDateString()}</td>
        </tr>
      `;
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Salary Increment History</title>
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
            "Salary Increment History"
          )}
          
          <table>
            <thead>
              <tr>
                <th style="width:5%;">SL</th>
                <th style="width:12%;">ID</th>
                <th style="width:16%;">Staff Name</th>
                <th style="width:14%; text-align:right;">Old Salary</th>
                <th style="width:14%; text-align:right;">New Salary</th>
                <th style="width:14%; text-align:right;">Increase</th>
                <th style="width:10%;">Increase %</th>
                <th style="width:15%;">Effective From</th>
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
  }, [filteredIncrements, schoolSettings]);

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
          className="relative overflow-hidden rounded-2xl bg-linear-to-r from-emerald-600 via-teal-600 to-cyan-600 dark:from-emerald-700 dark:via-teal-700 dark:to-cyan-700 p-6 shadow-xl"
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
                  Salary Increment History
                </h1>
                <p className="text-white/80 text-sm drop-shadow">Track staff salary increment history</p>
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
                    onClick={() => setEditingIncrement(null)} 
                    className="rounded-xl bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm"
                  >
                    <Plus className="h-4 w-4 mr-2" /> New Increment
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-2xl max-w-md bg-white dark:bg-gray-900 border-0 shadow-2xl">
                  <DialogHeader>
                    <DialogTitle className="text-gray-900 dark:text-white">
                      {editingIncrement ? "Edit Increment" : "Record Salary Increment"}
                    </DialogTitle>
                    <DialogDescription className="text-gray-600 dark:text-gray-400">
                      Enter staff salary increment details
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-gray-700 dark:text-gray-300">Staff Member *</Label>
                      <Select 
                        value={formData.staff_id} 
                        onValueChange={(v) => handleStaffChange(v)}
                      >
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
                    
                    {formData.staff_id && (
                      <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-xl">
                        <div className="flex justify-between mb-2">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Current Salary:</span>
                          <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(currentSalary)}</span>
                        </div>
                        <NumberInputField
                          label="New Salary *"
                          value={formData.new_salary}
                          onChange={(val: string) => handleNewSalaryChange(val)}
                          placeholder="New salary"
                        />
                        {incrementAmount > 0 && (
                          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600 dark:text-gray-400">Increment Amount:</span>
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{formatCurrency(incrementAmount)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600 dark:text-gray-400">Increment Percentage:</span>
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{incrementPercentage}%</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div>
                      <Label className="text-gray-700 dark:text-gray-300">Effective From *</Label>
                      <Input
                        type="date"
                        value={formData.effective_from}
                        onChange={(e) => setFormData({ ...formData, effective_from: e.target.value })}
                        className="rounded-xl bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                      />
                    </div>
                    
                    <div>
                      <Label className="text-gray-700 dark:text-gray-300">Reason</Label>
                      <Input
                        value={formData.reason}
                        onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                        placeholder="e.g., Annual review, Promotion"
                        className="rounded-xl bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                      />
                    </div>
                    
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
                        Cancel
                      </Button>
                      <Button onClick={handleSubmit} className="rounded-xl bg-linear-to-r from-emerald-600 to-teal-600 text-white">
                        {editingIncrement ? "Update" : "Record"}
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
                <div className={`bg-linear-to-br ${stat.bgGradient} p-5`}>
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
              <Select value={filterYear} onValueChange={setFilterYear}>
                <SelectTrigger className="w-37.5 rounded-xl bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                  <SelectItem value="all" className="text-gray-900 dark:text-white">All Years</SelectItem>
                  {years.map((y) => (
                    <SelectItem key={y} value={y} className="text-gray-900 dark:text-white">{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Increments Table - Modern Header */}
        <Card className="border-0 shadow-lg rounded-2xl overflow-hidden bg-white dark:bg-gray-800">
          <div className="bg-linear-to-r from-emerald-500 to-teal-500 dark:from-emerald-600 dark:to-teal-600 p-4">
            <CardHeader className="p-0">
              <CardTitle className="text-white text-lg font-semibold">Increment History</CardTitle>
              <CardDescription className="text-white/70 text-sm">Complete salary increment records</CardDescription>
            </CardHeader>
          </div>
          <CardContent className="p-0 sm:p-6 overflow-x-auto">
            {loading ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading...</div>
            ) : filteredIncrements.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-gray-500 dark:text-gray-400">No increment records found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-linear-to-r from-emerald-500 to-teal-500 dark:from-emerald-600 dark:to-teal-600">
                      <TableHead className="text-white text-xs sm:text-sm font-semibold">Staff</TableHead>
                      <TableHead className="text-white text-xs sm:text-sm font-semibold">Old Salary</TableHead>
                      <TableHead className="text-white text-xs sm:text-sm font-semibold">New Salary</TableHead>
                      <TableHead className="text-white text-xs sm:text-sm font-semibold">Increase</TableHead>
                      <TableHead className="text-white text-xs sm:text-sm font-semibold hidden md:table-cell">Effective From</TableHead>
                      <TableHead className="text-white text-xs sm:text-sm font-semibold hidden lg:table-cell">Reason</TableHead>
                      <TableHead className="text-center text-white text-xs sm:text-sm font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredIncrements.map((inc, idx) => (
                      <motion.tr
                        key={inc.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: idx * 0.05 }}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-100 dark:border-gray-700"
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={inc.staff_photo_url} />
                              <AvatarFallback className="bg-linear-to-r from-emerald-500 to-teal-500 text-white text-xs">
                                {inc.staff_name?.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-sm text-gray-900 dark:text-white">{inc.staff_name}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{inc.staff_employee_id}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-gray-700 dark:text-gray-300">{formatCurrency(inc.old_salary)}</TableCell>
                        <TableCell className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(inc.new_salary)}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm text-emerald-600 dark:text-emerald-400">+{formatCurrency(inc.increment_amount)}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">({inc.increment_percentage}%)</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-gray-700 dark:text-gray-300 hidden md:table-cell">{new Date(inc.effective_from).toLocaleDateString("en-CA")}</TableCell>
                        <TableCell className="text-sm text-gray-700 dark:text-gray-300 hidden lg:table-cell max-w-37.5 truncate">{inc.reason || "-"}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDetails(inc)}
                              className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                              title="View Details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(inc.id, inc.staff_name)}
                              className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
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

      {/* View Details Dialog - Solid Background */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="rounded-2xl max-w-md bg-white dark:bg-gray-900 border-0 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white">Increment Details</DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-400">
              Complete salary increment information
            </DialogDescription>
          </DialogHeader>
          {selectedIncrement && (
            <div className="space-y-4">
              <div className="bg-linear-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={selectedIncrement.staff_photo_url} />
                    <AvatarFallback className="bg-linear-to-r from-emerald-500 to-teal-500 text-white">
                      {selectedIncrement.staff_name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white">{selectedIncrement.staff_name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">ID: {selectedIncrement.staff_employee_id}</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-500 dark:text-gray-400">Old Salary:</span>
                  <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(selectedIncrement.old_salary)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-500 dark:text-gray-400">New Salary:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(selectedIncrement.new_salary)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-500 dark:text-gray-400">Increment Amount:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">+{formatCurrency(selectedIncrement.increment_amount)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-500 dark:text-gray-400">Increment Percentage:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{selectedIncrement.increment_percentage}%</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-500 dark:text-gray-400">Effective From:</span>
                  <span className="text-gray-900 dark:text-white">{new Date(selectedIncrement.effective_from).toLocaleDateString("en-CA")}</span>
                </div>
                {selectedIncrement.reason && (
                  <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                    <span className="text-gray-500 dark:text-gray-400">Reason:</span>
                    <span className="text-gray-900 dark:text-white">{selectedIncrement.reason}</span>
                  </div>
                )}
                <div className="flex justify-between py-2">
                  <span className="text-gray-500 dark:text-gray-400">Record Date:</span>
                  <span className="text-sm text-gray-700 dark:text-gray-300">{new Date(selectedIncrement.created_at).toLocaleDateString("en-CA")}</span>
                </div>
              </div>
              
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
