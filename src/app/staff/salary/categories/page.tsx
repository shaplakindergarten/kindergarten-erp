// src/app/staff/salary/categories/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, Plus, Edit, Trash2, AlertCircle, 
  TrendingUp, TrendingDown, Briefcase, Home, Gift 
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ResponsiveLayout } from "@/components/layout/responsive-layout";
import { getSalaryCategories } from "@/lib/api/staff";
import { useToastStore } from "@/store/useStore";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/salary/salaryUtils";
import { motion } from "framer-motion";

interface SalaryCategory {
  id: string;
  name: string;
  basic: number;
  hra: number;
  da: number;
  allowances: number;
  deductions: number;
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
    
    // বাংলা সংখ্যা কনভার্ট
    let englishValue = convertBengaliToEnglish(rawValue);
    
    // শুধুমাত্র সংখ্যা এবং ডট অনুমোদন
    const cleaned = englishValue.replace(/[^0-9.]/g, '');
    
    // মাল্টিপল ডট চেক
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
    // কার্সর সিলেক্ট
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

  // বাহির থেকে value পরিবর্তন হলে আপডেট
  useEffect(() => {
    if (value !== internalValue) {
      setValue(value);
      setDisplayValue(value);
    }
  }, [value]);

  // অভ্যন্তরীণ পরিবর্তন হলে বাহিরে জানান
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

export default function SalaryCategoriesPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<SalaryCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<SalaryCategory | null>(null);
  const [formData, setFormData] = useState({
    name: "", basic: "0", hra: "0", da: "0", allowances: "0", deductions: "0",
  });

  const addToast = useToastStore((state) => state.addToast);

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    setLoading(true);
    try {
      const data = await getSalaryCategories();
      setCategories(data || []);
    } catch (err) {
      console.error("Failed to load categories:", err);
      addToast({ type: "error", title: "Error", message: "Failed to load categories" });
    } finally {
      setLoading(false);
    }
  }

  const handleSubmit = async () => {
    if (!formData.name) {
      addToast({ type: "error", title: "Error", message: "Category name is required" });
      return;
    }

    try {
      const supabase = createClient();
      const categoryData = {
        name: formData.name,
        basic: parseFloat(formData.basic) || 0,
        hra: parseFloat(formData.hra) || 0,
        da: parseFloat(formData.da) || 0,
        allowances: parseFloat(formData.allowances) || 0,
        deductions: parseFloat(formData.deductions) || 0,
      };

      if (editingCategory) {
        await supabase.from("salary_categories").update(categoryData).eq("id", editingCategory.id);
        addToast({ type: "success", title: "Success", message: "Category updated successfully" });
      } else {
        await supabase.from("salary_categories").insert(categoryData);
        addToast({ type: "success", title: "Success", message: "Category created successfully" });
      }

      setDialogOpen(false);
      setEditingCategory(null);
      setFormData({ name: "", basic: "0", hra: "0", da: "0", allowances: "0", deductions: "0" });
      await loadCategories();
    } catch (err) {
      console.error(err);
      addToast({ type: "error", title: "Error", message: "Failed to save category" });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete category "${name}"?`)) return;
    
    try {
      const supabase = createClient();
      const { error } = await supabase.from("salary_categories").delete().eq("id", id);
      if (error) throw error;
      addToast({ type: "success", title: "Success", message: "Category deleted successfully" });
      await loadCategories();
    } catch (err) {
      console.error(err);
      addToast({ type: "error", title: "Error", message: "Failed to delete category" });
    }
  };

  const calculateTotal = (cat: SalaryCategory) => {
    return cat.basic + cat.hra + cat.da + cat.allowances - cat.deductions;
  };

  // Statistics
  const totalCategories = categories.length;
  const averageSalary = categories.length > 0 
    ? categories.reduce((sum, cat) => sum + calculateTotal(cat), 0) / categories.length 
    : 0;
  const highestSalary = categories.length > 0 
    ? Math.max(...categories.map(cat => calculateTotal(cat))) 
    : 0;

  const stats = [
    { 
      title: "Total Categories", 
      value: totalCategories, 
      icon: Briefcase, 
      bgGradient: "from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/30",
      iconBg: "bg-blue-500 dark:bg-blue-600"
    },
    { 
      title: "Average Salary", 
      value: formatCurrency(averageSalary), 
      icon: TrendingUp, 
      bgGradient: "from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/30",
      iconBg: "bg-emerald-500 dark:bg-emerald-600"
    },
    { 
      title: "Highest Salary", 
      value: formatCurrency(highestSalary), 
      icon: TrendingUp, 
      bgGradient: "from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/30",
      iconBg: "bg-purple-500 dark:bg-purple-600"
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
          className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-purple-600 to-pink-600 dark:from-violet-700 dark:via-purple-700 dark:to-pink-700 p-6 shadow-xl"
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
                  Salary Categories
                </h1>
                <p className="text-white/80 text-sm drop-shadow">Define salary structures for different positions</p>
              </div>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  onClick={() => setEditingCategory(null)} 
                  className="rounded-xl bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm"
                >
                  <Plus className="h-4 w-4 mr-2" /> Add Category
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-2xl max-w-md bg-white dark:bg-gray-900 border-0 shadow-2xl">
                <DialogHeader>
                  <DialogTitle className="text-gray-900 dark:text-white">
                    {editingCategory ? "Edit Salary Category" : "Add Salary Category"}
                  </DialogTitle>
                  <DialogDescription className="text-gray-600 dark:text-gray-400">
                    {editingCategory ? "Update salary category details" : "Create a new salary category"}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300">Category Name</Label>
                    <Input 
                      value={formData.name} 
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                      placeholder="e.g., Teacher Grade 1" 
                      className="rounded-xl bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <NumberInputField
                      label="Basic"
                      value={formData.basic}
                      onChange={(val: string) => setFormData({ ...formData, basic: val })}
                      placeholder="Basic"
                    />
                    <NumberInputField
                      label="HRA"
                      value={formData.hra}
                      onChange={(val: string) => setFormData({ ...formData, hra: val })}
                      placeholder="HRA"
                    />
                    <NumberInputField
                      label="DA"
                      value={formData.da}
                      onChange={(val: string) => setFormData({ ...formData, da: val })}
                      placeholder="DA"
                    />
                    <NumberInputField
                      label="Allowances"
                      value={formData.allowances}
                      onChange={(val: string) => setFormData({ ...formData, allowances: val })}
                      placeholder="Allowances"
                    />
                    <NumberInputField
                      label="Deductions"
                      value={formData.deductions}
                      onChange={(val: string) => setFormData({ ...formData, deductions: val })}
                      placeholder="Deductions"
                    />
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-xl">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Salary:</span>
                      <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                        ৳{(
                          (parseFloat(formData.basic) || 0) +
                          (parseFloat(formData.hra) || 0) +
                          (parseFloat(formData.da) || 0) +
                          (parseFloat(formData.allowances) || 0) -
                          (parseFloat(formData.deductions) || 0)
                        ).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
                      Cancel
                    </Button>
                    <Button onClick={handleSubmit} className="rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                      {editingCategory ? "Update" : "Create"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
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
                      <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
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

        {/* Categories Table */}
        <Card className="border-0 shadow-lg rounded-2xl overflow-hidden bg-white dark:bg-gray-800">
          <div className="bg-gradient-to-r from-indigo-500 to-purple-500 dark:from-indigo-600 dark:to-purple-600 p-4">
            <CardHeader className="p-0">
              <CardTitle className="text-white text-lg font-semibold">Salary Categories List</CardTitle>
              <CardDescription className="text-white/70 text-sm">List of all salary categories</CardDescription>
            </CardHeader>
          </div>
          <CardContent className="p-0 sm:p-6 overflow-x-auto">
            {loading ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading...</div>
            ) : categories.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-gray-500 dark:text-gray-400">No categories found</p>
                <Button 
                  onClick={() => setDialogOpen(true)} 
                  variant="outline" 
                  className="mt-3 rounded-xl border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
                >
                  <Plus className="h-4 w-4 mr-2" /> Add First Category
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gradient-to-r from-indigo-500 to-purple-500 dark:from-indigo-600 dark:to-purple-600">
                      <TableHead className="text-white text-xs sm:text-sm font-semibold">Category</TableHead>
                      <TableHead className="text-white text-xs sm:text-sm font-semibold">Basic</TableHead>
                      <TableHead className="text-white text-xs sm:text-sm font-semibold hidden sm:table-cell">HRA</TableHead>
                      <TableHead className="text-white text-xs sm:text-sm font-semibold hidden md:table-cell">DA</TableHead>
                      <TableHead className="text-white text-xs sm:text-sm font-semibold hidden lg:table-cell">Allowances</TableHead>
                      <TableHead className="text-white text-xs sm:text-sm font-semibold hidden xl:table-cell">Deductions</TableHead>
                      <TableHead className="text-white text-xs sm:text-sm font-semibold">Total</TableHead>
                      <TableHead className="text-center text-white text-xs sm:text-sm font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.map((cat, idx) => {
                      const total = calculateTotal(cat);
                      return (
                        <motion.tr
                          key={cat.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3, delay: idx * 0.05 }}
                          className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-100 dark:border-gray-700"
                        >
                          <TableCell className="font-medium text-sm text-gray-900 dark:text-white">{cat.name}</TableCell>
                          <TableCell className="text-sm text-gray-700 dark:text-gray-300">৳{cat.basic.toLocaleString()}</TableCell>
                          <TableCell className="text-sm text-gray-700 dark:text-gray-300 hidden sm:table-cell">৳{cat.hra.toLocaleString()}</TableCell>
                          <TableCell className="text-sm text-gray-700 dark:text-gray-300 hidden md:table-cell">৳{cat.da.toLocaleString()}</TableCell>
                          <TableCell className="text-sm text-gray-700 dark:text-gray-300 hidden lg:table-cell">৳{cat.allowances.toLocaleString()}</TableCell>
                          <TableCell className="text-sm text-red-600 dark:text-red-400 hidden xl:table-cell">-৳{cat.deductions.toLocaleString()}</TableCell>
                          <TableCell className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">৳{total.toLocaleString()}</TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingCategory(cat);
                                  setFormData({
                                    name: cat.name,
                                    basic: cat.basic.toString(),
                                    hra: cat.hra.toString(),
                                    da: cat.da.toString(),
                                    allowances: cat.allowances.toString(),
                                    deductions: cat.deductions.toString(),
                                  });
                                  setDialogOpen(true);
                                }}
                                className="text-amber-500 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
                                title="Edit"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(cat.id, cat.name)}
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

        {/* Info Card */}
        <Card className="border-0 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
                <Gift className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-800 dark:text-white">About Salary Structure</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Define Basic, HRA, DA, Allowances, and Deductions for each category. 
                  This structure will be used as the base for staff salary calculation.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </ResponsiveLayout>
  );
}
