// src/app/staff/salary/promotion/page.tsx
"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, Plus, Edit, Trash2, Eye, 
  Calendar, DollarSign, Users, X, Check,
  AlertCircle, Award, Briefcase, Search, TrendingUp
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
import { getStaff, getSalaryCategories } from "@/lib/api/staff";
import { useToastStore } from "@/store/useStore";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/salary/salaryUtils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { motion } from "framer-motion";

// ============================================================
// TYPES
// ============================================================

interface PromotionRecord {
  id: string;
  staff_id: string;
  staff_name: string;
  staff_employee_id: string;
  staff_photo_url?: string;
  old_designation: string;
  new_designation: string;
  old_salary_category_id: string;
  new_salary_category_id: string;
  old_category_name: string;
  new_category_name: string;
  old_salary: number;
  new_salary: number;
  increment_amount: number;
  increment_percentage: number;
  effective_from: string;
  reason: string;
  created_at: string;
}

interface SchoolSettings {
  id: number;
  school_name: string;
  school_address: string;
  school_phone: string;
  school_email: string;
  school_logo: string;
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
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-right font-mono disabled:opacity-60 disabled:cursor-not-allowed"
        autoComplete="off"
        dir="ltr"
      />
    </div>
  );
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

const calculateSalaryFromCategory = (category: any): number => {
  if (!category) return 0;
  return (category.basic || 0) + (category.hra || 0) + (category.da || 0) + 
         (category.allowances || 0) - (category.deductions || 0);
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function PromotionPage() {
  const router = useRouter();
  const [staff, setStaff] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [promotions, setPromotions] = useState<PromotionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<PromotionRecord | null>(null);
  const [selectedPromotion, setSelectedPromotion] = useState<PromotionRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  
  // Form state
  const [formData, setFormData] = useState({
    staff_id: "",
    new_designation: "",
    new_salary_category_id: "",
    effective_from: new Date().toISOString().split("T")[0],
    reason: "",
  });

  // Derived states
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);

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
      });
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const [staffData, categoriesData, promotionsData] = await Promise.all([
        getStaff(),
        getSalaryCategories(),
        supabase
          .from("salary_promotions")
          .select("*, staff:staff_id(name, employee_id, photo_url, designation), old_category:old_salary_category_id(name), new_category:new_salary_category_id(name)")
          .order("effective_from", { ascending: false }),
      ]);
      
      setStaff(staffData || []);
      setCategories(categoriesData || []);
      
      const mappedPromotions = (promotionsData.data || []).map((prom: any) => {
        const staffMember = staffData?.find((s: any) => s.id === prom.staff_id);
        const oldCategory = categoriesData?.find((c: any) => c.id === prom.old_salary_category_id);
        const newCategory = categoriesData?.find((c: any) => c.id === prom.new_salary_category_id);
        
        const oldSalary = calculateSalaryFromCategory(oldCategory);
        const newSalary = calculateSalaryFromCategory(newCategory);
        const incrementAmt = newSalary - oldSalary;
        const incrementPct = oldSalary > 0 ? (incrementAmt / oldSalary) * 100 : 0;
        
        return {
          id: prom.id,
          staff_id: prom.staff_id,
          staff_name: staffMember?.name || "",
          staff_employee_id: staffMember?.employee_id || "",
          staff_photo_url: staffMember?.photo_url || "",
          old_designation: prom.old_designation || staffMember?.designation || "",
          new_designation: prom.new_designation,
          old_salary_category_id: prom.old_salary_category_id,
          new_salary_category_id: prom.new_salary_category_id,
          old_category_name: oldCategory?.name || "",
          new_category_name: newCategory?.name || "",
          old_salary: oldSalary,
          new_salary: newSalary,
          increment_amount: incrementAmt,
          increment_percentage: parseFloat(incrementPct.toFixed(2)),
          effective_from: prom.effective_from,
          reason: prom.reason || "",
          created_at: prom.created_at,
        };
      });
      
      setPromotions(mappedPromotions);
      
    } catch (err) {
      console.error("Failed to load data:", err);
      addToast({ type: "error", title: "Error", message: "Failed to load data" });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadData();
    loadSchoolSettings();
  }, [loadData, loadSchoolSettings]);

  // ============================================================
  // HANDLERS
  // ============================================================

  const handleStaffChange = (staffId: string) => {
    const staffMember = staff.find(s => s.id === staffId);
    setSelectedStaff(staffMember);
    setFormData({
      ...formData,
      staff_id: staffId,
      new_designation: staffMember?.designation || "",
    });
    setSelectedCategory(null);
  };

  const handleCategoryChange = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    setSelectedCategory(category);
    
    const designationFromCategory = category?.name?.replace(/ Grade| Level|\d+/g, '').trim() || "";
    
    setFormData({ 
      ...formData, 
      new_salary_category_id: categoryId,
      new_designation: designationFromCategory || formData.new_designation
    });
  };

  const handleDesignationChange = (value: string) => {
    setFormData({ ...formData, new_designation: value });
  };

  const currentSalary = useMemo(() => {
    if (!selectedStaff) return 0;
    const category = selectedStaff.salary_category;
    return calculateSalaryFromCategory(category);
  }, [selectedStaff]);

  const newSalary = useMemo(() => {
    return calculateSalaryFromCategory(selectedCategory);
  }, [selectedCategory]);

  const incrementAmount = useMemo(() => {
    return newSalary - currentSalary;
  }, [newSalary, currentSalary]);

  const incrementPercentage = useMemo(() => {
    if (currentSalary <= 0) return 0;
    return parseFloat(((incrementAmount / currentSalary) * 100).toFixed(2));
  }, [incrementAmount, currentSalary]);

  const handleSubmit = async () => {
    if (!formData.staff_id || !formData.new_designation || !formData.new_salary_category_id) {
      addToast({ type: "error", title: "Error", message: "Please fill all required fields" });
      return;
    }

    try {
      const supabase = createClient();
      
      const promotionData = {
        staff_id: formData.staff_id,
        old_designation: selectedStaff?.designation,
        new_designation: formData.new_designation,
        old_salary_category_id: selectedStaff?.salary_category_id,
        new_salary_category_id: formData.new_salary_category_id,
        effective_from: formData.effective_from,
        reason: formData.reason,
      };

      if (editingPromotion) {
        await supabase.from("salary_promotions").update(promotionData).eq("id", editingPromotion.id);
        addToast({ type: "success", title: "Success", message: "Promotion updated successfully" });
      } else {
        await supabase.from("salary_promotions").insert(promotionData);
        
        await supabase
          .from("staff")
          .update({
            designation: formData.new_designation,
            salary_category_id: formData.new_salary_category_id,
          })
          .eq("id", formData.staff_id);
        
        addToast({ type: "success", title: "Success", message: "Promotion recorded successfully" });
      }

      setDialogOpen(false);
      setEditingPromotion(null);
      setFormData({
        staff_id: "",
        new_designation: "",
        new_salary_category_id: "",
        effective_from: new Date().toISOString().split("T")[0],
        reason: "",
      });
      setSelectedStaff(null);
      setSelectedCategory(null);
      await loadData();
    } catch (err) {
      console.error(err);
      addToast({ type: "error", title: "Error", message: "Failed to save promotion" });
    }
  };

  const handleDelete = async (id: string, staffName: string) => {
    if (!confirm(`Delete promotion for "${staffName}"?`)) return;
    
    try {
      const supabase = createClient();
      await supabase.from("salary_promotions").delete().eq("id", id);
      addToast({ type: "success", title: "Success", message: "Promotion deleted" });
      await loadData();
    } catch (err) {
      console.error(err);
      addToast({ type: "error", title: "Error", message: "Failed to delete" });
    }
  };

  const handleViewDetails = (promotion: PromotionRecord) => {
    setSelectedPromotion(promotion);
    setViewDialogOpen(true);
  };

  // ============================================================
  // FILTERED DATA & STATISTICS
  // ============================================================

  const filteredPromotions = useMemo(() => {
    return promotions.filter(prom => 
      prom.staff_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prom.staff_employee_id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [promotions, searchTerm]);

  const statistics = useMemo(() => ({
    totalPromotions: promotions.length,
    totalIncrement: promotions.reduce((sum, p) => sum + p.increment_amount, 0),
    avgPercentage: promotions.length > 0 
      ? promotions.reduce((sum, p) => sum + p.increment_percentage, 0) / promotions.length 
      : 0,
  }), [promotions]);

  if (settingsLoading) {
    return (
      <ResponsiveLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
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
                  Promotion Management
                </h1>
                <p className="text-white/80 text-sm drop-shadow">Record and track staff promotions</p>
              </div>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  onClick={() => setEditingPromotion(null)} 
                  className="rounded-xl bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm"
                >
                  <Plus className="h-4 w-4 mr-2" /> New Promotion
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-2xl max-w-md bg-white dark:bg-gray-900 border-0 shadow-2xl fixed-dialog max-h-[90vh] overflow-y-auto">
                <DialogHeader className="sticky top-0 bg-white dark:bg-gray-900 z-10 pt-2 pb-4 border-b border-gray-200 dark:border-gray-700">
                  <DialogTitle className="text-gray-900 dark:text-white">
                    {editingPromotion ? "Edit Promotion" : "Record Promotion"}
                  </DialogTitle>
                  <DialogDescription className="text-gray-600 dark:text-gray-400">
                    Enter staff promotion details
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300">Staff Member *</Label>
                    <Select 
                      value={formData.staff_id} 
                      onValueChange={handleStaffChange}
                    >
                      <SelectTrigger className="rounded-xl bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                        <SelectValue placeholder="Select staff" />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                        {staff.map((s) => (
                          <SelectItem key={s.id} value={s.id} className="text-gray-900 dark:text-white">
                            {s.employee_id} - {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {selectedStaff && (
                    <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-xl text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Current Designation:</span>
                        <span className="font-medium text-gray-900 dark:text-white">{selectedStaff.designation}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Current Salary:</span>
                        <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(currentSalary)}</span>
                      </div>
                    </div>
                  )}
                  
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300">New Designation *</Label>
                    <Input
                      value={formData.new_designation}
                      onChange={(e) => handleDesignationChange(e.target.value)}
                      placeholder="e.g., Senior Teacher"
                      className="rounded-xl bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                    />
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      Auto-filled from category, or type manually
                    </p>
                  </div>
                  
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300">New Salary Category *</Label>
                    <Select 
                      value={formData.new_salary_category_id} 
                      onValueChange={handleCategoryChange}
                    >
                      <SelectTrigger className="rounded-xl bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id} className="text-gray-900 dark:text-white">
                            {c.name} ({formatCurrency(calculateSalaryFromCategory(c))})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {selectedCategory && (
                    <div className="bg-emerald-50 dark:bg-emerald-950/30 p-3 rounded-xl text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">New Salary:</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(newSalary)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Increment:</span>
                        <span className="text-emerald-600 dark:text-emerald-400">+{formatCurrency(incrementAmount)} ({incrementPercentage}%)</span>
                      </div>
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
                      placeholder="Performance review, Experience, etc."
                      className="rounded-xl bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                    />
                  </div>
                  
                  <div className="flex justify-end gap-2 pt-2 sticky bottom-0 bg-white dark:bg-gray-900 py-3 border-t border-gray-200 dark:border-gray-700">
                    <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
                      Cancel
                    </Button>
                    <Button onClick={handleSubmit} className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700">
                      {editingPromotion ? "Update" : "Record"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </motion.div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="border-0 shadow-lg rounded-2xl overflow-hidden bg-white dark:bg-gray-800">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/30 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{statistics.totalPromotions}</p>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Promotions</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-blue-500 dark:bg-blue-600 shadow-lg">
                    <Award className="h-6 w-6 text-white" />
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
          
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="border-0 shadow-lg rounded-2xl overflow-hidden bg-white dark:bg-gray-800">
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/30 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(statistics.totalIncrement)}</p>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Salary Increase</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-emerald-500 dark:bg-emerald-600 shadow-lg">
                    <DollarSign className="h-6 w-6 text-white" />
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
          
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="border-0 shadow-lg rounded-2xl overflow-hidden bg-white dark:bg-gray-800">
              <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/30 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{statistics.avgPercentage.toFixed(1)}%</p>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Average Increase</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-amber-500 dark:bg-amber-600 shadow-lg">
                    <TrendingUp className="h-6 w-6 text-white" />
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
          <Input
            type="text"
            placeholder="Search by staff name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 rounded-xl bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
          />
        </div>

        {/* Table - Modern Header */}
        <Card className="border-0 shadow-lg rounded-2xl overflow-hidden bg-white dark:bg-gray-800">
          <div className="bg-gradient-to-r from-emerald-500 to-teal-500 dark:from-emerald-600 dark:to-teal-600 p-4">
            <CardHeader className="p-0">
              <CardTitle className="text-white text-lg font-semibold">Promotion History</CardTitle>
              <CardDescription className="text-white/70 text-sm">All promotion records</CardDescription>
            </CardHeader>
          </div>
          <CardContent className="p-0 sm:p-4 overflow-x-auto">
            {loading ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading...</div>
            ) : filteredPromotions.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-gray-500 dark:text-gray-400">No promotion records found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-gradient-to-r from-emerald-500 to-teal-500 dark:from-emerald-600 dark:to-teal-600">
                    <TableHead className="text-white text-xs sm:text-sm font-semibold">Staff</TableHead>
                    <TableHead className="text-white text-xs sm:text-sm font-semibold hidden md:table-cell">Old Designation</TableHead>
                    <TableHead className="text-white text-xs sm:text-sm font-semibold">New Designation</TableHead>
                    <TableHead className="text-white text-xs sm:text-sm font-semibold">Change</TableHead>
                    <TableHead className="text-white text-xs sm:text-sm font-semibold hidden lg:table-cell">Date</TableHead>
                    <TableHead className="text-center text-white text-xs sm:text-sm font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPromotions.map((prom) => (
                    <TableRow key={prom.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-100 dark:border-gray-700">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={prom.staff_photo_url} />
                            <AvatarFallback className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs">
                              {prom.staff_name?.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm text-gray-900 dark:text-white">{prom.staff_name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{prom.staff_employee_id}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-gray-700 dark:text-gray-300">{prom.old_designation}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{prom.new_designation}</span>
                          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs">Promoted</Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-emerald-600 dark:text-emerald-400">+{formatCurrency(prom.increment_amount)}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 block">({prom.increment_percentage}%)</span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-gray-700 dark:text-gray-300">
                        {new Date(prom.effective_from).toLocaleDateString("en-CA")}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(prom)}
                            className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(prom.id, prom.staff_name)}
                            className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* View Details Dialog - Fixed with Scrollbar */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="rounded-2xl max-w-sm bg-white dark:bg-gray-900 border-0 shadow-2xl fixed-dialog max-h-[80vh] overflow-y-auto">
          <DialogHeader className="sticky top-0 bg-white dark:bg-gray-900 z-10 pt-2 pb-3 border-b border-gray-200 dark:border-gray-700">
            <DialogTitle className="text-gray-900 dark:text-white">Promotion Details</DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-400">
              Complete promotion information
            </DialogDescription>
          </DialogHeader>
          {selectedPromotion && (
            <div className="space-y-3 pt-3">
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 rounded-xl p-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={selectedPromotion.staff_photo_url} />
                    <AvatarFallback className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white">
                      {selectedPromotion.staff_name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-bold text-gray-900 dark:text-white">{selectedPromotion.staff_name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">ID: {selectedPromotion.staff_employee_id}</p>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Old Designation</p>
                  <p className="font-medium text-gray-900 dark:text-white">{selectedPromotion.old_designation}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">New Designation</p>
                  <p className="font-medium text-emerald-600 dark:text-emerald-400">{selectedPromotion.new_designation}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Old Salary</p>
                  <p className="text-gray-900 dark:text-white">{formatCurrency(selectedPromotion.old_salary)}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">New Salary</p>
                  <p className="font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(selectedPromotion.new_salary)}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Increase</p>
                  <p className="text-emerald-600 dark:text-emerald-400">+{formatCurrency(selectedPromotion.increment_amount)}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Effective From</p>
                  <p className="text-gray-900 dark:text-white">{new Date(selectedPromotion.effective_from).toLocaleDateString("en-CA")}</p>
                </div>
              </div>
              
              {selectedPromotion.reason && (
                <div>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">Reason</p>
                  <p className="text-gray-900 dark:text-white">{selectedPromotion.reason}</p>
                </div>
              )}
              
              <div className="sticky bottom-0 bg-white dark:bg-gray-900 pt-3 border-t border-gray-200 dark:border-gray-700">
                <Button variant="outline" onClick={() => setViewDialogOpen(false)} className="w-full rounded-xl border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
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
