// src/app/staff/salary/payment/page.tsx
"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, DollarSign, Plus, Edit, Trash2, Eye, 
  Search, Filter, Download, Printer, CheckCircle, 
  XCircle, AlertCircle, TrendingUp, TrendingDown, 
  Calendar, CreditCard, History, UserCheck, Users,
  RefreshCw, Loader2
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
import { getStaff } from "@/lib/api/staff";
import { useToastStore } from "@/store/useStore";
import { createClient } from "@/lib/supabase/client";
import { useSalaryData } from "@/hooks/useSalaryData";
import { formatCurrency, months, getCurrentMonth, getCurrentYear, getStatusBadge } from "@/lib/salary/salaryUtils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { motion, AnimatePresence } from "framer-motion";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SalaryPayment {
  id: string;
  staff_id: string;
  staff_name: string;
  staff_employee_id: string;
  staff_photo_url?: string;
  amount: number;
  month: string;
  year: number;
  payment_date: string;
  payment_method: string;
  status: string;
  balance_after?: number;
}

// বাংলা সংখ্যা কনভার্ট করার ফাংশন
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

// কাস্টম নাম্বার ইনপুট হুক
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

// নাম্বার ইনপুট ফিল্ড কম্পোনেন্ট
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

export default function SalaryPaymentPage() {
  const router = useRouter();
  const [staff, setStaff] = useState<any[]>([]);
  const [payments, setPayments] = useState<SalaryPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<SalaryPayment | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMonth, setFilterMonth] = useState(getCurrentMonth());
  const [filterYear, setFilterYear] = useState(getCurrentYear().toString());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ total: 0, completed: 0, failed: 0, errors: [] as string[] });
  
  const [paymentForm, setPaymentForm] = useState({
    staff_id: "",
    amount: "0",
    month: getCurrentMonth(),
    year: getCurrentYear().toString(),
    payment_method: "cash",
  });

  const [editForm, setEditForm] = useState({
    id: "",
    amount: "0",
    month: "",
    year: "",
    payment_method: "",
  });

  const [bulkForm, setBulkForm] = useState({
    month: getCurrentMonth(),
    year: getCurrentYear().toString(),
    payment_method: "cash",
    selected_staff: [] as string[],
    select_all: false,
  });

  const addToast = useToastStore((state) => state.addToast);
  const { getStaffBalanceSheet, recordPayment, checkPaymentExists } = useSalaryData();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const supabase = createClient();
      const [staffData, paymentsData] = await Promise.all([
        getStaff(),
        supabase
          .from("salary_payments")
          .select("*, staff:staff_id(name, employee_id, photo_url)")
          .order("payment_date", { ascending: false }),
      ]);
      
      setStaff(staffData || []);
      
      const mappedPayments = (paymentsData.data || []).map((p: any) => ({
        id: p.id,
        staff_id: p.staff_id,
        staff_name: p.staff?.name || "",
        staff_employee_id: p.staff?.employee_id || "",
        staff_photo_url: p.staff?.photo_url || "",
        amount: p.amount,
        month: p.month,
        year: p.year,
        payment_date: p.payment_date,
        payment_method: p.payment_method,
        status: p.status,
      }));
      setPayments(mappedPayments);
      
    } catch (err) {
      console.error("Failed to load data:", err);
      addToast({ type: "error", title: "Error", message: "Failed to load payment data" });
    } finally {
      setLoading(false);
    }
  }

  const getStaffSalary = (staffId: string) => {
    const staffMember = staff.find(s => s.id === staffId);
    if (staffMember?.salary_category) {
      const cat = staffMember.salary_category;
      return (cat.basic || 0) + (cat.hra || 0) + (cat.da || 0) + (cat.allowances || 0) - (cat.deductions || 0);
    }
    return 0;
  };

  // Get staff who haven't been paid for the selected month
  const getUnpaidStaff = (month: string, year: number) => {
    const paidStaffIds = payments
      .filter(p => p.month === month && p.year === year)
      .map(p => p.staff_id);

    // Convert month name to index (0-11)
    const monthIndex = months.indexOf(month); // months array has Jan-Dec
    if (monthIndex === -1) return [];
    const monthNum = monthIndex + 1;

    // Compute month start & end
    const monthStart = new Date(year, monthNum - 1, 1);
    const monthEnd = new Date(year, monthNum, 0); // Last day of month

    return staff.filter(s => {
      // Skip resigned
      if (s.status === 'resigned') return false;

      // Skip already paid
      if (paidStaffIds.includes(s.id)) return false;

      // Skip if no salary category
      if (!s.salary_category_id) return false;

      // ✅ NEW: Skip if joining_date not set
      if (!s.joining_date) return false;

      // ✅ NEW: Skip if month is entirely before joining_date
      const joining = new Date(s.joining_date);
      if (monthEnd < joining) return false;

      // ✅ NEW: Skip if month is entirely after resign_date
      if (s.resign_date) {
        const resign = new Date(s.resign_date);
        if (monthStart > resign) return false;
      }

      return true;
    });
  };

  // STRICT payment existence check
  const checkPaymentExistsStrict = async (staffId: string, month: string, year: number): Promise<boolean> => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("salary_payments")
        .select("id, staff_id, month, year")
        .eq("staff_id", staffId)
        .eq("month", month)
        .eq("year", year)
        .maybeSingle();

      if (error) {
        console.error("Check payment error:", error);
        return false;
      }

      return !!data;
    } catch (err) {
      console.error("Check payment error:", err);
      return false;
    }
  };

  // Available staff for individual payment (exclude already paid)
  const availableStaffForPayment = useMemo(() => {
    const month = paymentForm.month;
    const year = parseInt(paymentForm.year);
    const paidStaffIds = payments
      .filter(p => p.month === month && p.year === year)
      .map(p => p.staff_id);

    const monthIndex = months.indexOf(month);
    if (monthIndex === -1) return [];
    const monthNum = monthIndex + 1;

    const monthStart = new Date(year, monthNum - 1, 1);
    const monthEnd = new Date(year, monthNum, 0);

    return staff.filter(s => {
      if (s.status === 'resigned') return false;
      if (paidStaffIds.includes(s.id)) return false;
      if (!s.salary_category_id) return false;
      if (!s.joining_date) return false;

      const joining = new Date(s.joining_date);
      if (monthEnd < joining) return false;

      if (s.resign_date) {
        const resign = new Date(s.resign_date);
        if (monthStart > resign) return false;
      }

      return true;
    });
  }, [staff, payments, paymentForm.month, paymentForm.year]);

  // When month/year changes, reset selected staff if not available
  useEffect(() => {
    if (paymentForm.staff_id) {
      const stillAvailable = availableStaffForPayment.some(s => s.id === paymentForm.staff_id);
      if (!stillAvailable) {
        setPaymentForm(prev => ({ ...prev, staff_id: "" }));
      }
    }
  }, [availableStaffForPayment, paymentForm.staff_id]);

  // ============================================
  // handlePaymentSubmit — DB trigger auto-creates finance entries
  // ============================================
  const handlePaymentSubmit = async () => {
    if (!paymentForm.staff_id || !paymentForm.amount || !paymentForm.month) {
      addToast({ type: "error", title: "Error", message: "Please fill all required fields" });
      return;
    }

    const year = parseInt(paymentForm.year);
    const amount = parseFloat(paymentForm.amount);
    
    // STRICT CHECK: Payment exists?
    const exists = await checkPaymentExistsStrict(paymentForm.staff_id, paymentForm.month, year);
    if (exists) {
      addToast({ 
        type: "error", 
        title: "❌ Payment Already Exists", 
        message: `Salary for ${paymentForm.month} ${year} has already been paid! You cannot make duplicate payment.` 
      });
      return;
    }

    // DB trigger (trg_sync_salary_payment) auto-creates:
    //   - finance_transactions (expense, source_type='salary_payment')
    //   - voucher + 2 journal entries (double-entry)
    const success = await recordPayment(
      paymentForm.staff_id,
      amount,
      paymentForm.month,
      year,
      paymentForm.payment_method
    );

    if (success) {
      addToast({ 
        type: "success", 
        title: "✅ Success", 
        message: `Payment recorded for ${paymentForm.month} ${year}. Finance entry auto-created.` 
      });
      setPaymentDialogOpen(false);
      setPaymentForm({
        staff_id: "",
        amount: "0",
        month: getCurrentMonth(),
        year: getCurrentYear().toString(),
        payment_method: "cash",
      });
      await loadData();
    } else {
      addToast({ 
        type: "error", 
        title: "❌ Failed", 
        message: "Could not record payment. Please try again." 
      });
    }
  };

  // ============================================
  // handleBulkPayment — DB trigger auto-creates finance entries for each
  // ============================================
  const handleBulkPayment = async () => {
    const month = bulkForm.month;
    const year = parseInt(bulkForm.year);
    const method = bulkForm.payment_method;
    
    let selectedStaff = bulkForm.selected_staff;
    
    if (bulkForm.select_all) {
      const unpaid = getUnpaidStaff(month, year);
      selectedStaff = unpaid.map(s => s.id);
    }
    
    if (selectedStaff.length === 0) {
      addToast({ type: "error", title: "Error", message: "No staff selected or all already paid" });
      return;
    }

    setIsBulkProcessing(true);
    setBulkProgress({ total: selectedStaff.length, completed: 0, failed: 0, errors: [] });

    let completed = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const staffId of selectedStaff) {
      try {
        const staffMember = staff.find(s => s.id === staffId);
        const salary = getStaffSalary(staffId);
        
        if (salary === 0) {
          failed++;
          errors.push(`${staffMember?.name || 'Unknown'} - No salary structure found`);
          setBulkProgress(prev => ({ ...prev, completed: completed + failed, failed, errors }));
          continue;
        }

        const exists = await checkPaymentExistsStrict(staffId, month, year);
        if (exists) {
          failed++;
          errors.push(`${staffMember?.name || 'Unknown'} - Already paid for ${month} ${year}`);
          setBulkProgress(prev => ({ ...prev, completed: completed + failed, failed, errors }));
          continue;
        }

        // DB trigger auto-creates finance entry (voucher + journal + transaction)
        const success = await recordPayment(staffId, salary, month, year, method);

        if (success) {
          completed++;
        } else {
          failed++;
          errors.push(`${staffMember?.name || 'Unknown'} - Failed to record payment`);
        }
        
        setBulkProgress(prev => ({ ...prev, completed: completed + failed, failed, errors }));
        
      } catch (err) {
        failed++;
        const staffMember = staff.find(s => s.id === staffId);
        errors.push(`${staffMember?.name || 'Unknown'} - ${err}`);
        setBulkProgress(prev => ({ ...prev, completed: completed + failed, failed, errors }));
      }
    }

    setIsBulkProcessing(false);
    
    addToast({
      type: failed === 0 ? "success" : "warning",
      title: "Bulk Payment Complete",
      message: `${completed} payments successful, ${failed} failed (finance entries auto-created)`
    });
    
    setBulkDialogOpen(false);
    setBulkForm({
      month: getCurrentMonth(),
      year: getCurrentYear().toString(),
      payment_method: "cash",
      selected_staff: [],
      select_all: false,
    });
    await loadData();
  };

  const handleUpdatePayment = async () => {
    if (!editForm.amount || !editForm.month) {
      addToast({ type: "error", title: "Error", message: "Please fill all required fields" });
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("salary_payments")
        .update({
          amount: parseFloat(editForm.amount),
          month: editForm.month,
          year: parseInt(editForm.year),
          payment_method: editForm.payment_method,
        })
        .eq("id", editForm.id);

      if (error) throw error;
      
      addToast({ type: "success", title: "Success", message: "Payment updated successfully" });
      setEditDialogOpen(false);
      await loadData();
    } catch (err) {
      console.error(err);
      addToast({ type: "error", title: "Error", message: "Failed to update payment" });
    }
  };

  const handleDeletePayment = async (id: string, staffName: string, month: string, year: number) => {
    if (!confirm(`Are you sure you want to delete salary payment for "${staffName}" (${month} ${year})?`)) return;
    
    try {
      const supabase = createClient();
      const { error } = await supabase.from("salary_payments").delete().eq("id", id);
      if (error) throw error;
      addToast({ type: "success", title: "Success", message: "Payment deleted successfully" });
      await loadData();
    } catch (err) {
      console.error(err);
      addToast({ type: "error", title: "Error", message: "Failed to delete payment" });
    }
  };

  const handleViewPayment = (payment: SalaryPayment) => {
    setSelectedPayment(payment);
    setViewDialogOpen(true);
  };

  const handleEditPayment = (payment: SalaryPayment) => {
    setEditForm({
      id: payment.id,
      amount: payment.amount.toString(),
      month: payment.month,
      year: payment.year.toString(),
      payment_method: payment.payment_method,
    });
    setEditDialogOpen(true);
  };

  const toggleStaffSelection = (staffId: string) => {
    setBulkForm(prev => ({
      ...prev,
      selected_staff: prev.selected_staff.includes(staffId)
        ? prev.selected_staff.filter(id => id !== staffId)
        : [...prev.selected_staff, staffId]
    }));
  };

  const toggleAllStaff = () => {
    const unpaid = getUnpaidStaff(bulkForm.month, parseInt(bulkForm.year));
    if (bulkForm.select_all) {
      setBulkForm(prev => ({ ...prev, select_all: false, selected_staff: [] }));
    } else {
      setBulkForm(prev => ({ 
        ...prev, 
        select_all: true, 
        selected_staff: unpaid.map(s => s.id) 
      }));
    }
  };

  const filteredPayments = payments.filter(payment => {
    if (searchTerm && !payment.staff_name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (filterMonth !== "all" && payment.month !== filterMonth) return false;
    if (filterYear !== "all" && payment.year.toString() !== filterYear) return false;
    return true;
  });

  const totalPaid = filteredPayments.reduce((sum, p) => sum + p.amount, 0);
  const uniqueYears = [...new Set(payments.map(p => p.year))].sort((a, b) => b - a);
  const unpaidStaff = getUnpaidStaff(bulkForm.month, parseInt(bulkForm.year));

  const stats = [
    { 
      title: "Total Paid", 
      value: formatCurrency(totalPaid), 
      icon: DollarSign,
      bgGradient: "from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/30",
      iconBg: "bg-emerald-500 dark:bg-emerald-600",
      textColor: "text-gray-900 dark:text-white"
    },
    { 
      title: "Total Payments", 
      value: filteredPayments.length, 
      icon: UserCheck,
      bgGradient: "from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/30",
      iconBg: "bg-blue-500 dark:bg-blue-600",
      textColor: "text-gray-900 dark:text-white"
    },
    { 
      title: "Filter Month", 
      value: filterMonth + (filterYear !== "all" ? " " + filterYear : ""), 
      icon: Calendar,
      bgGradient: "from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/30",
      iconBg: "bg-purple-500 dark:bg-purple-600",
      textColor: "text-gray-900 dark:text-white"
    },
  ];

  return (
    <ResponsiveLayout>
      <div className="space-y-6 p-4 sm:p-6">
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
                  Salary Payment
                </h1>
                <p className="text-white/80 text-sm drop-shadow">Manage staff salary payments and history tracking</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button 
                onClick={() => {
                  setBulkForm({
                    month: getCurrentMonth(),
                    year: getCurrentYear().toString(),
                    payment_method: "cash",
                    selected_staff: [],
                    select_all: false,
                  });
                  setBulkDialogOpen(true);
                }}
                className="rounded-xl bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm"
              >
                <Users className="h-4 w-4 mr-2" /> Bulk Payment
              </Button>

              <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
                <DialogTrigger asChild>
                  <Button 
                    className="rounded-xl bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm"
                  >
                    <Plus className="h-4 w-4 mr-2" /> Make Payment
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-2xl max-w-md bg-white dark:bg-gray-900 border-0 shadow-2xl">
                  <DialogHeader>
                    <DialogTitle className="text-gray-900 dark:text-white">Record Salary Payment</DialogTitle>
                    <DialogDescription className="text-gray-600 dark:text-gray-400">
                      Enter staff salary payment details
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-gray-700 dark:text-gray-300">Staff Member *</Label>
                        {availableStaffForPayment.length === 0 ? (
                          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-700 dark:text-amber-400 text-sm flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="font-medium">No staff available for {paymentForm.month} {paymentForm.year}</p>
                              <p className="text-xs mt-1 opacity-80">
                                All eligible staff have been paid, or their joining date is after this month.
                              </p>
                            </div>
                          </div>
                        ) : (
                        <Select 
                          value={paymentForm.staff_id || ""} 
                          onValueChange={(v) => {
                            const salary = getStaffSalary(v);
                            setPaymentForm({ ...paymentForm, staff_id: v, amount: salary.toString() });
                          }}
                        >
                          <SelectTrigger className="rounded-xl bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                            <SelectValue placeholder="Select staff member" />
                          </SelectTrigger>
                          <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                            {availableStaffForPayment.map((s) => (
                              <SelectItem key={s.id} value={s.id} className="text-gray-900 dark:text-white">
                                {s.employee_id} - {s.name} ({s.designation})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {availableStaffForPayment.length > 0 && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Showing only staff who haven't been paid for {paymentForm.month} {paymentForm.year}
                        </p>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-gray-700 dark:text-gray-300">Month</Label>
                        <Select value={paymentForm.month} onValueChange={(v) => setPaymentForm({ ...paymentForm, month: v })}>
                          <SelectTrigger className="rounded-xl bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                            <SelectValue placeholder="Select month" />
                          </SelectTrigger>
                          <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                            {months.map((m) => (
                              <SelectItem key={m} value={m} className="text-gray-900 dark:text-white">{m}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <NumberInputField
                        label="Year"
                        value={paymentForm.year}
                        onChange={(val: string) => setPaymentForm({ ...paymentForm, year: val })}
                        placeholder="Year"
                      />
                    </div>
                    <NumberInputField
                      label="Amount *"
                      value={paymentForm.amount}
                      onChange={(val: string) => setPaymentForm({ ...paymentForm, amount: val })}
                      placeholder="Salary amount"
                    />
                    <div>
                      <Label className="text-gray-700 dark:text-gray-300">Payment Method</Label>
                      <Select value={paymentForm.payment_method} onValueChange={(v) => setPaymentForm({ ...paymentForm, payment_method: v })}>
                        <SelectTrigger className="rounded-xl bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                          <SelectValue placeholder="Select method" />
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                          <SelectItem value="cash" className="text-gray-900 dark:text-white">Cash</SelectItem>
                          <SelectItem value="bank" className="text-gray-900 dark:text-white">Bank Transfer</SelectItem>
                          <SelectItem value="mobile" className="text-gray-900 dark:text-white">Mobile Banking</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setPaymentDialogOpen(false)} className="rounded-xl border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
                        Cancel
                      </Button>
                      <Button 
                        onClick={handlePaymentSubmit} 
                        disabled={availableStaffForPayment.length === 0}
                        className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Record Payment
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
              <Select value={filterMonth} onValueChange={setFilterMonth}>
                <SelectTrigger className="w-[150px] rounded-xl bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                  <SelectItem value="all" className="text-gray-900 dark:text-white">All Months</SelectItem>
                  {months.map((m) => (
                    <SelectItem key={m} value={m} className="text-gray-900 dark:text-white">{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterYear} onValueChange={setFilterYear}>
                <SelectTrigger className="w-[120px] rounded-xl bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                  <SelectItem value="all" className="text-gray-900 dark:text-white">All Years</SelectItem>
                  {uniqueYears.map((y) => (
                    <SelectItem key={y} value={y.toString()} className="text-gray-900 dark:text-white">{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Payments Table */}
        <Card className="border-0 shadow-lg rounded-2xl overflow-hidden bg-white dark:bg-gray-800">
          <div className="bg-gradient-to-r from-emerald-500 to-teal-500 dark:from-emerald-600 dark:to-teal-600 p-4">
            <CardHeader className="p-0">
              <CardTitle className="text-white text-lg font-semibold">Payment History</CardTitle>
              <CardDescription className="text-white/70 text-sm">Complete salary payment history</CardDescription>
            </CardHeader>
          </div>
          <CardContent className="p-0 sm:p-6 overflow-x-auto">
            {loading ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading...</div>
            ) : filteredPayments.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-gray-500 dark:text-gray-400">No payment records found</p>
                <Button onClick={() => setPaymentDialogOpen(true)} variant="outline" className="mt-3 rounded-xl border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
                  <Plus className="h-4 w-4 mr-2" /> Make First Payment
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gradient-to-r from-emerald-500 to-teal-500 dark:from-emerald-600 dark:to-teal-600">
                      <TableHead className="text-white text-xs sm:text-sm font-semibold whitespace-nowrap">Staff</TableHead>
                      <TableHead className="text-white text-xs sm:text-sm font-semibold whitespace-nowrap">Month/Year</TableHead>
                      <TableHead className="text-white text-xs sm:text-sm font-semibold whitespace-nowrap">Amount</TableHead>
                      <TableHead className="text-white text-xs sm:text-sm font-semibold whitespace-nowrap hidden md:table-cell">Date</TableHead>
                      <TableHead className="text-white text-xs sm:text-sm font-semibold whitespace-nowrap hidden lg:table-cell">Method</TableHead>
                      <TableHead className="text-white text-xs sm:text-sm font-semibold whitespace-nowrap">Status</TableHead>
                      <TableHead className="text-center text-white text-xs sm:text-sm font-semibold whitespace-nowrap">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPayments.map((payment, idx) => (
                      <motion.tr
                        key={payment.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: idx * 0.03 }}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-100 dark:border-gray-700"
                      >
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-[120px]">
                            <Avatar className="h-8 w-8 flex-shrink-0">
                              <AvatarImage src={payment.staff_photo_url} />
                              <AvatarFallback className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs">
                                {payment.staff_name?.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{payment.staff_name}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{payment.staff_employee_id}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">{payment.month} {payment.year}</TableCell>
                        <TableCell className="font-semibold text-emerald-600 dark:text-emerald-400 text-sm whitespace-nowrap">{formatCurrency(payment.amount)}</TableCell>
                        <TableCell className="text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap hidden md:table-cell">{new Date(payment.payment_date).toLocaleDateString("en-CA")}</TableCell>
                        <TableCell className="text-sm capitalize text-gray-700 dark:text-gray-300 whitespace-nowrap hidden lg:table-cell">{payment.payment_method}</TableCell>
                        <TableCell>
                          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-xl whitespace-nowrap">
                            <CheckCircle className="h-3 w-3 mr-1" /> Paid
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-0.5 flex-nowrap">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewPayment(payment)}
                              className="h-8 w-8 p-0 text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                              title="View"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditPayment(payment)}
                              className="h-8 w-8 p-0 text-amber-500 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                              title="Edit"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeletePayment(payment.id, payment.staff_name, payment.month, payment.year)}
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
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

      {/* Bulk Payment Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="rounded-2xl max-w-2xl max-h-[85vh] overflow-y-auto bg-white dark:bg-gray-900 border-0 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white">Bulk Salary Payment</DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-400">
              Make salary payments for multiple staff members at once
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-700 dark:text-gray-300">Month *</Label>
                <Select 
                  value={bulkForm.month} 
                  onValueChange={(v) => {
                    setBulkForm(prev => ({ ...prev, month: v, selected_staff: [] }));
                  }}
                >
                  <SelectTrigger className="rounded-xl bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                    {months.map((m) => (
                      <SelectItem key={m} value={m} className="text-gray-900 dark:text-white">{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <NumberInputField
                label="Year *"
                value={bulkForm.year}
                onChange={(val: string) => setBulkForm(prev => ({ ...prev, year: val, selected_staff: [] }))}
                placeholder="Year"
              />
            </div>

            <div>
              <Label className="text-gray-700 dark:text-gray-300">Payment Method</Label>
              <Select value={bulkForm.payment_method} onValueChange={(v) => setBulkForm(prev => ({ ...prev, payment_method: v }))}>
                <SelectTrigger className="rounded-xl bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                  <SelectItem value="cash" className="text-gray-900 dark:text-white">Cash</SelectItem>
                  <SelectItem value="bank" className="text-gray-900 dark:text-white">Bank Transfer</SelectItem>
                  <SelectItem value="mobile" className="text-gray-900 dark:text-white">Mobile Banking</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-gray-700 dark:text-gray-300 font-semibold">
                  Unpaid Staff for {bulkForm.month} {bulkForm.year}
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    ({unpaidStaff.length} staff)
                  </span>
                </Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleAllStaff}
                  className="text-xs rounded-xl"
                >
                  {bulkForm.select_all ? 'Deselect All' : 'Select All'}
                </Button>
              </div>

              {unpaidStaff.length === 0 ? (
                <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                  <p>All staff have been paid for {bulkForm.month} {bulkForm.year}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[200px] overflow-y-auto">
                  {unpaidStaff.map((s) => (
                    <div
                      key={s.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        bulkForm.selected_staff.includes(s.id)
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                      onClick={() => toggleStaffSelection(s.id)}
                    >
                      <div className="flex-shrink-0">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs">
                            {s.name?.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{s.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{s.employee_id}</p>
                      </div>
                      <div className="flex-shrink-0">
                        {bulkForm.selected_staff.includes(s.id) ? (
                          <CheckCircle className="h-5 w-5 text-emerald-500" />
                        ) : (
                          <div className="h-5 w-5 rounded-full border-2 border-gray-300 dark:border-gray-600" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {isBulkProcessing && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Progress:</span>
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {bulkProgress.completed} / {bulkProgress.total}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                  <div 
                    className="bg-gradient-to-r from-emerald-600 to-teal-600 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${(bulkProgress.completed / bulkProgress.total) * 100}%` }}
                  />
                </div>
                {bulkProgress.errors.length > 0 && (
                  <div className="max-h-20 overflow-y-auto text-xs text-red-600 dark:text-red-400">
                    {bulkProgress.errors.map((err, i) => (
                      <p key={i}>• {err}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            <Alert className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
              <AlertDescription className="text-amber-700 dark:text-amber-400 text-sm">
                ⚠️ This will make salary payments for selected staff for {bulkForm.month} {bulkForm.year}.
                Staff who have already been paid will be skipped automatically.
                Finance vouchers + journal entries will be created automatically.
              </AlertDescription>
            </Alert>

            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => setBulkDialogOpen(false)}
                disabled={isBulkProcessing}
                className="rounded-xl border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleBulkPayment}
                disabled={isBulkProcessing || bulkForm.selected_staff.length === 0}
                className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700"
              >
                {isBulkProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <DollarSign className="h-4 w-4 mr-2" />
                    Pay {bulkForm.selected_staff.length} Staff
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Payment Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="rounded-2xl max-w-md bg-white dark:bg-gray-900 border-0 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white">Payment Details</DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-400">Complete payment information</DialogDescription>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12 border-2 border-white dark:border-gray-700">
                    <AvatarImage src={selectedPayment.staff_photo_url} />
                    <AvatarFallback className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white">
                      {selectedPayment.staff_name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white">{selectedPayment.staff_name}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">ID: {selectedPayment.staff_employee_id}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-600 dark:text-gray-400">Month/Year:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{selectedPayment.month} {selectedPayment.year}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-600 dark:text-gray-400">Amount:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 text-xl">{formatCurrency(selectedPayment.amount)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-600 dark:text-gray-400">Payment Date:</span>
                  <span className="text-gray-900 dark:text-white">{new Date(selectedPayment.payment_date).toLocaleDateString("en-CA")}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-600 dark:text-gray-400">Payment Method:</span>
                  <span className="capitalize px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-900 dark:text-white">{selectedPayment.payment_method}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-600 dark:text-gray-400">Status:</span>
                  <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">Paid</Badge>
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

      {/* Edit Payment Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="rounded-2xl max-w-md bg-white dark:bg-gray-900 border-0 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white">Edit Payment</DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-400">Update payment information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-700 dark:text-gray-300">Month</Label>
                <Select value={editForm.month} onValueChange={(v) => setEditForm({ ...editForm, month: v })}>
                  <SelectTrigger className="rounded-xl bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                    {months.map((m) => (
                      <SelectItem key={m} value={m} className="text-gray-900 dark:text-white">{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <NumberInputField
                label="Year"
                value={editForm.year}
                onChange={(val: string) => setEditForm({ ...editForm, year: val })}
                placeholder="Year"
              />
            </div>
            <NumberInputField
              label="Amount"
              value={editForm.amount}
              onChange={(val: string) => setEditForm({ ...editForm, amount: val })}
              placeholder="Amount"
            />
            <div>
              <Label className="text-gray-700 dark:text-gray-300">Payment Method</Label>
              <Select value={editForm.payment_method} onValueChange={(v) => setEditForm({ ...editForm, payment_method: v })}>
                <SelectTrigger className="rounded-xl bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                  <SelectValue placeholder="Method" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                  <SelectItem value="cash" className="text-gray-900 dark:text-white">Cash</SelectItem>
                  <SelectItem value="bank" className="text-gray-900 dark:text-white">Bank Transfer</SelectItem>
                  <SelectItem value="mobile" className="text-gray-900 dark:text-white">Mobile Banking</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)} className="rounded-xl border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
                Cancel
              </Button>
              <Button onClick={handleUpdatePayment} className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
                Update Payment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </ResponsiveLayout>
  );
}