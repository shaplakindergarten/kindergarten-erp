// src/app/staff/salary/staff-salary/page.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, Plus, Edit, Trash2, Eye, History, 
  DollarSign, Search, Filter, RefreshCw,
  Users, CheckCircle, AlertCircle
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
import { useToastStore } from "@/store/useStore";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { motion } from "framer-motion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { salaryService } from "@/lib/salary/salaryService";
import { formatCurrency } from "@/lib/salary/salaryUtils";
import { getUserId } from "@/lib/auth";

interface StaffSalaryView {
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

export default function StaffSalaryPage() {
  const router = useRouter();
  const [staffSalaries, setStaffSalaries] = useState<StaffSalaryView[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [bulkSetupDialogOpen, setBulkSetupDialogOpen] = useState(false);
  const [editingSalary, setEditingSalary] = useState<any>(null);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  const [staffHistory, setStaffHistory] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<any>(null);
  const [selectedCategoryForBulk, setSelectedCategoryForBulk] = useState("all");
  
  const [formData, setFormData] = useState({
    staff_id: "",
    salary_category_id: "",
    basic: "0",
    hra: "0",
    da: "0",
    allowances: "0",
    personal_allowance: "0",
    special_allowance: "0",
    other_deductions: "0",
    effective_from: new Date().toISOString().split("T")[0],
  });

  const addToast = useToastStore((state) => state.addToast);

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      console.log('📊 Loading salary data...');
      
      const salaries = await salaryService.getAllStaffSalaries({
        category: filterCategory !== 'all' ? filterCategory : undefined,
        status: filterStatus !== 'all' ? filterStatus : undefined,
        search: searchTerm || undefined,
      });
      
      console.log('✅ Staff salaries loaded:', salaries?.length || 0);
      setStaffSalaries(salaries || []);
      
      const categoriesData = await salaryService.getSalaryCategories();
      console.log('✅ Categories loaded:', categoriesData?.length || 0);
      setCategories(categoriesData || []);
      
      if (salaries?.length === 0) {
        addToast({
          type: 'warning',
          title: 'No Data',
          message: 'No staff salary records found. Please setup salaries first.'
        });
      }
      
    } catch (err) {
      console.error('❌ Failed to load data:', err);
      addToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to load salary data. Please refresh the page.'
      });
    } finally {
      setLoading(false);
    }
  }

  const uniqueCategories = useMemo(() => {
    const cats = staffSalaries.map(s => s.category_name).filter(Boolean);
    return [...new Set(cats)];
  }, [staffSalaries]);

  const uniqueStatuses = useMemo(() => {
    const statuses = staffSalaries.map(s => s.status).filter(Boolean);
    return [...new Set(statuses)];
  }, [staffSalaries]);

  const displayData = useMemo(() => {
    return staffSalaries.filter(item => {
      if (filterCategory !== "all" && item.category_name !== filterCategory) return false;
      if (filterStatus !== "all" && item.status !== filterStatus) return false;
      if (searchTerm && !item.staff_name?.toLowerCase().includes(searchTerm.toLowerCase()) && 
          !item.employee_id?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [staffSalaries, filterCategory, filterStatus, searchTerm]);

  const staffWithSalary = staffSalaries.filter(s => s.salary_id);
  const staffWithoutSalary = staffSalaries.filter(s => !s.salary_id);

  const handleSubmit = async () => {
    try {
      const userId = await getUserId();
      
      await salaryService.upsertSalary(
        formData.staff_id,
        {
          basic: parseFloat(formData.basic) || 0,
          hra: parseFloat(formData.hra) || 0,
          da: parseFloat(formData.da) || 0,
          allowances: parseFloat(formData.allowances) || 0,
          personal_allowance: parseFloat(formData.personal_allowance) || 0,
          special_allowance: parseFloat(formData.special_allowance) || 0,
          other_deductions: parseFloat(formData.other_deductions) || 0,
        },
        formData.effective_from,
        userId ?? undefined,
        editingSalary ? 'Salary updated' : 'Initial setup'
      );

      addToast({ 
        type: "success", 
        title: "Success", 
        message: editingSalary ? "Salary updated successfully" : "Salary created successfully" 
      });
      
      setDialogOpen(false);
      setEditingSalary(null);
      resetForm();
      await loadData();
    } catch (err) {
      console.error(err);
      addToast({ type: "error", title: "Error", message: "Failed to save salary" });
    }
  };

  const handleBulkSetup = async () => {
    setIsBulkProcessing(true);
    setBulkProgress(null);
    
    try {
      const userId = await getUserId();
      const result = await salaryService.bulkSetupSalaries(
        selectedCategoryForBulk === "all" ? undefined : selectedCategoryForBulk,
        undefined,
        userId ?? undefined
      );
      
      setBulkProgress(result);
      
      addToast({
        type: result.total_failed === 0 ? "success" : "warning",
        title: "Bulk Setup Complete",
        message: `${result.total_created} created, ${result.total_skipped} skipped, ${result.total_failed} failed`
      });
      
      setBulkSetupDialogOpen(false);
      await loadData();
    } catch (err) {
      console.error(err);
      addToast({ type: "error", title: "Error", message: "Failed to complete bulk setup" });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleViewHistory = async (staffId: string, staffName: string) => {
    try {
      const history = await salaryService.getSalaryHistory(staffId);
      setStaffHistory(history || []);
      setSelectedStaff({ id: staffId, name: staffName });
      setHistoryDialogOpen(true);
    } catch (err) {
      addToast({ type: "error", title: "Error", message: "Failed to load history" });
    }
  };

  const resetForm = () => {
    setFormData({
      staff_id: "",
      salary_category_id: "",
      basic: "0",
      hra: "0",
      da: "0",
      allowances: "0",
      personal_allowance: "0",
      special_allowance: "0",
      other_deductions: "0",
      effective_from: new Date().toISOString().split("T")[0],
    });
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-500 text-white';
      case 'on_leave': return 'bg-amber-500 text-white';
      case 'inactive': return 'bg-gray-500 text-white';
      default: return 'bg-blue-500 text-white';
    }
  };

  return (
    <ResponsiveLayout>
      <div className="space-y-6 p-4 sm:p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 dark:from-indigo-700 dark:via-purple-700 dark:to-pink-700 p-6 shadow-xl"
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
                  Staff Salary Structure
                </h1>
                <p className="text-white/80 text-sm drop-shadow">
                  Manage individual salary structure for each staff member
                  <span className="ml-2 text-amber-200">(Resigned staff excluded)</span>
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button 
                onClick={() => setBulkSetupDialogOpen(true)}
                className="rounded-xl bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm"
              >
                <Users className="h-4 w-4 mr-2" /> Bulk Setup
              </Button>
              
              {staffWithoutSalary.length > 0 && (
                <Button 
                  onClick={handleBulkSetup}
                  disabled={isBulkProcessing}
                  className="rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-white border-0 backdrop-blur-sm"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isBulkProcessing ? 'animate-spin' : ''}`} /> 
                  Setup Missing ({staffWithoutSalary.length})
                </Button>
              )}
              
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button 
                    onClick={() => {
                      resetForm();
                      setEditingSalary(null);
                    }} 
                    className="rounded-xl bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm"
                  >
                    <Plus className="h-4 w-4 mr-2" /> Add Individual
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-2xl max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900 border-0 shadow-2xl">
                  <DialogHeader>
                    <DialogTitle className="text-gray-900 dark:text-white">
                      {editingSalary ? "Edit Staff Salary" : "Setup Staff Salary"}
                    </DialogTitle>
                    <DialogDescription className="text-gray-600 dark:text-gray-400">
                      {editingSalary ? "Update staff salary information" : "Setup salary structure for staff member"}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-gray-700 dark:text-gray-300">Staff Member *</Label>
                      <Select 
                        value={formData.staff_id || undefined} 
                        onValueChange={(v) => setFormData({ ...formData, staff_id: v })}
                      >
                        <SelectTrigger className="rounded-xl bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                          <SelectValue placeholder="Select staff" />
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                          {staffSalaries.map((s) => (
                            <SelectItem key={s.staff_id} value={s.staff_id}>
                              {s.employee_id} - {s.staff_name} ({s.designation})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-gray-700 dark:text-gray-300">Salary Category</Label>
                      <Select 
                        value={formData.salary_category_id || undefined} 
                        onValueChange={(v) => {
                          const category = categories.find(c => c.id === v);
                          setFormData({
                            ...formData,
                            salary_category_id: v,
                            basic: category?.basic?.toString() || "0",
                            hra: category?.hra?.toString() || "0",
                            da: category?.da?.toString() || "0",
                            allowances: category?.allowances?.toString() || "0",
                            other_deductions: category?.deductions?.toString() || "0",
                          });
                        }}
                      >
                        <SelectTrigger className="rounded-xl bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                          {categories.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                      <h4 className="font-semibold text-gray-800 dark:text-white mb-3">Salary Components</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Basic Salary</Label>
                          <Input 
                            type="number"
                            value={formData.basic}
                            onChange={(e) => setFormData({ ...formData, basic: e.target.value })}
                            className="rounded-xl text-right"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">HRA</Label>
                          <Input 
                            type="number"
                            value={formData.hra}
                            onChange={(e) => setFormData({ ...formData, hra: e.target.value })}
                            className="rounded-xl text-right"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">DA</Label>
                          <Input 
                            type="number"
                            value={formData.da}
                            onChange={(e) => setFormData({ ...formData, da: e.target.value })}
                            className="rounded-xl text-right"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Other Allowances</Label>
                          <Input 
                            type="number"
                            value={formData.allowances}
                            onChange={(e) => setFormData({ ...formData, allowances: e.target.value })}
                            className="rounded-xl text-right"
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                      <h4 className="font-semibold text-gray-800 dark:text-white mb-3">Individual Adjustments</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Personal Allowance</Label>
                          <Input 
                            type="number"
                            value={formData.personal_allowance}
                            onChange={(e) => setFormData({ ...formData, personal_allowance: e.target.value })}
                            className="rounded-xl text-right"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Special Allowance</Label>
                          <Input 
                            type="number"
                            value={formData.special_allowance}
                            onChange={(e) => setFormData({ ...formData, special_allowance: e.target.value })}
                            className="rounded-xl text-right"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Other Deductions</Label>
                          <Input 
                            type="number"
                            value={formData.other_deductions}
                            onChange={(e) => setFormData({ ...formData, other_deductions: e.target.value })}
                            className="rounded-xl text-right"
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <Label className="text-gray-700 dark:text-gray-300">Effective From</Label>
                      <Input 
                        type="date" 
                        value={formData.effective_from} 
                        onChange={(e) => setFormData({ ...formData, effective_from: e.target.value })} 
                        className="rounded-xl bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                      />
                    </div>
                    
                    <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800">
                      <div className="flex justify-between items-center flex-wrap gap-2">
                        <span className="font-semibold text-gray-700 dark:text-gray-300">Total Monthly Salary:</span>
                        <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                          ৳{(
                            (parseFloat(formData.basic) || 0) +
                            (parseFloat(formData.hra) || 0) +
                            (parseFloat(formData.da) || 0) +
                            (parseFloat(formData.allowances) || 0) +
                            (parseFloat(formData.personal_allowance) || 0) +
                            (parseFloat(formData.special_allowance) || 0) -
                            (parseFloat(formData.other_deductions) || 0)
                          ).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleSubmit} className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700">
                        {editingSalary ? "Update Salary" : "Create Salary"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-0 shadow-lg rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/80">Total Staff</p>
                  <p className="text-3xl font-bold">{staffSalaries.length}</p>
                </div>
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                  <Users className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-lg rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/80">With Salary</p>
                  <p className="text-3xl font-bold">{staffWithSalary.length}</p>
                </div>
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                  <CheckCircle className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-lg rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/80">Without Salary</p>
                  <p className="text-3xl font-bold">{staffWithoutSalary.length}</p>
                </div>
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                  <AlertCircle className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-lg rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/80">Categories</p>
                  <p className="text-3xl font-bold">{uniqueCategories.length}</p>
                </div>
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                  <DollarSign className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bulk Setup Dialog */}
        <Dialog open={bulkSetupDialogOpen} onOpenChange={setBulkSetupDialogOpen}>
          <DialogContent className="rounded-2xl max-w-md bg-white dark:bg-gray-900 border-0 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-gray-900 dark:text-white">Bulk Salary Setup</DialogTitle>
              <DialogDescription className="text-gray-600 dark:text-gray-400">
                Automatically setup salary for all active staff members
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 p-4 rounded-xl">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-700 dark:text-gray-300">Total Staff:</span>
                  <span className="font-bold text-gray-900 dark:text-white">{staffSalaries.length}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-700 dark:text-gray-300">Already Setup:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{staffWithSalary.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700 dark:text-gray-300">Will be Created:</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">{staffWithoutSalary.length}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Base Category (Optional)</Label>
                <Select value={selectedCategoryForBulk} onValueChange={setSelectedCategoryForBulk}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Use staff's own category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Use staff's own category</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  If selected, this category will be used for all staff without existing salary
                </p>
              </div>

              {bulkProgress && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Result:</span>
                    <span className="font-medium text-gray-700">
                      Created: {bulkProgress.total_created}, 
                      Skipped: {bulkProgress.total_skipped}, 
                      Failed: {bulkProgress.total_failed}
                    </span>
                  </div>
                </div>
              )}

              <Alert className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
                <AlertDescription className="text-amber-700 dark:text-amber-400 text-sm">
                  This will only create salary for staff without existing salary structure.
                  Existing salaries will not be modified.
                </AlertDescription>
              </Alert>

              <div className="flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setBulkSetupDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleBulkSetup}
                  disabled={isBulkProcessing || staffWithoutSalary.length === 0}
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700"
                >
                  {isBulkProcessing ? 'Processing...' : `Setup ${staffWithoutSalary.length} Staff`}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Filters */}
        <Card className="border-0 shadow-lg rounded-2xl bg-white dark:bg-gray-800">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by staff name or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 rounded-xl"
                />
              </div>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[180px] rounded-xl">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {uniqueCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[160px] rounded-xl">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {uniqueStatuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Staff Salary Table */}
        <Card className="border-0 shadow-xl rounded-2xl overflow-hidden bg-white dark:bg-gray-800">
          <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 dark:from-indigo-600 dark:via-purple-600 dark:to-pink-600 p-4">
            <CardHeader className="p-0">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white text-lg font-semibold">Staff Salary List</CardTitle>
                  <CardDescription className="text-white/80 text-sm">
                    {displayData.length} staff members • {staffWithSalary.length} with salary
                  </CardDescription>
                </div>
                {staffWithoutSalary.length > 0 && (
                  <Badge className="bg-amber-400 text-amber-900 font-semibold px-3 py-1">
                    {staffWithoutSalary.length} Missing
                  </Badge>
                )}
              </div>
            </CardHeader>
          </div>
          <CardContent className="p-0 sm:p-6 overflow-x-auto">
            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading...</div>
            ) : displayData.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p>No staff records found</p>
                <p className="text-sm mt-2">Please add staff members or setup salaries</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 dark:from-indigo-600 dark:via-purple-600 dark:to-pink-600">
                      <TableHead className="text-white text-xs sm:text-sm font-semibold whitespace-nowrap">Staff</TableHead>
                      <TableHead className="text-white text-xs sm:text-sm font-semibold whitespace-nowrap hidden md:table-cell">Designation</TableHead>
                      <TableHead className="text-white text-xs sm:text-sm font-semibold whitespace-nowrap">Category</TableHead>
                      <TableHead className="text-white text-xs sm:text-sm font-semibold whitespace-nowrap">Status</TableHead>
                      <TableHead className="text-white text-xs sm:text-sm font-semibold whitespace-nowrap">Total Salary</TableHead>
                      <TableHead className="text-white text-xs sm:text-sm font-semibold whitespace-nowrap text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayData.map((item, idx) => (
                      <motion.tr
                        key={item.staff_id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: idx * 0.05 }}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-100 dark:border-gray-700"
                      >
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-[120px]">
                            <Avatar className="h-8 w-8 flex-shrink-0">
                              <AvatarImage src={item.photo_url} />
                              <AvatarFallback className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs">
                                {item.staff_name?.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{item.staff_name}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{item.employee_id}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">{item.designation || '-'}</TableCell>
                        <TableCell className="text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">{item.category_name || '-'}</TableCell>
                        <TableCell>
                          <Badge className={`${getStatusBadgeColor(item.status)} whitespace-nowrap`}>
                            {item.status === 'on_leave' ? 'On Leave' : 
                             item.status === 'inactive' ? 'Inactive' : 
                             item.status === 'active' ? 'Active' : 
                             item.status?.charAt(0).toUpperCase() + item.status?.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-bold text-emerald-600 dark:text-emerald-400 text-sm whitespace-nowrap">
                          {item.salary_id ? `৳${(item.total_salary || 0).toLocaleString()}` : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-0.5 flex-nowrap">
                            {item.salary_id && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedStaff(item);
                                    setViewDialogOpen(true);
                                  }}
                                  className="h-8 w-8 p-0 text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                                  title="View Details"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setEditingSalary(item);
                                    setFormData({
                                      staff_id: item.staff_id,
                                      salary_category_id: item.salary_category_id || "",
                                      basic: item.basic.toString(),
                                      hra: item.hra.toString(),
                                      da: item.da.toString(),
                                      allowances: item.allowances.toString(),
                                      personal_allowance: item.personal_allowance.toString(),
                                      special_allowance: item.special_allowance.toString(),
                                      other_deductions: item.other_deductions.toString(),
                                      effective_from: item.effective_from || new Date().toISOString().split("T")[0],
                                    });
                                    setDialogOpen(true);
                                  }}
                                  className="h-8 w-8 p-0 text-amber-500 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                                  title="Edit"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {!item.salary_id && item.salary_category_id && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                  try {
                                    const userId = await getUserId();
                                    const category = categories.find(c => c.id === item.salary_category_id);
                                    if (!category) {
                                      addToast({ type: "error", title: "Error", message: "Category not found" });
                                      return;
                                    }
                                    await salaryService.upsertSalary(
                                      item.staff_id,
                                      {
                                        basic: category.basic || 0,
                                        hra: category.hra || 0,
                                        da: category.da || 0,
                                        allowances: category.allowances || 0,
                                        personal_allowance: 0,
                                        special_allowance: 0,
                                        other_deductions: category.deductions || 0,
                                      },
                                      new Date().toISOString().split("T")[0],
                                      userId ?? undefined,
                                      'Quick setup'
                                    );
                                    addToast({ type: "success", title: "Success", message: "Salary setup completed" });
                                    await loadData();
                                  } catch (err) {
                                    addToast({ type: "error", title: "Error", message: "Failed to setup salary" });
                                  }
                                }}
                                className="h-8 w-8 p-0 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                                title="Quick Setup"
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewHistory(item.staff_id, item.staff_name)}
                              className="h-8 w-8 p-0 text-purple-500 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/30"
                              title="Payment History"
                            >
                              <History className="h-4 w-4" />
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

      {/* View Details Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="rounded-2xl max-w-2xl max-h-[85vh] overflow-y-auto bg-white dark:bg-gray-900 border-0 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white">Staff Salary Details</DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-400">
              Complete salary structure and balance sheet
            </DialogDescription>
          </DialogHeader>
          {selectedStaff && (
            <div className="space-y-5">
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 rounded-xl p-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16 border-2 border-white dark:border-gray-700 shadow-md">
                    <AvatarImage src={selectedStaff.photo_url} />
                    <AvatarFallback className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-lg">
                      {selectedStaff.staff_name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{selectedStaff.staff_name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">ID: {selectedStaff.employee_id}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{selectedStaff.designation}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="text-center p-3 bg-gradient-to-br from-blue-400 to-blue-500 text-white rounded-xl shadow-md">
                  <p className="text-xl font-bold">৳{selectedStaff.basic?.toLocaleString() || 0}</p>
                  <p className="text-xs text-white/80">Basic</p>
                </div>
                <div className="text-center p-3 bg-gradient-to-br from-emerald-400 to-emerald-500 text-white rounded-xl shadow-md">
                  <p className="text-xl font-bold">৳{selectedStaff.hra?.toLocaleString() || 0}</p>
                  <p className="text-xs text-white/80">HRA</p>
                </div>
                <div className="text-center p-3 bg-gradient-to-br from-amber-400 to-amber-500 text-white rounded-xl shadow-md">
                  <p className="text-xl font-bold">৳{selectedStaff.da?.toLocaleString() || 0}</p>
                  <p className="text-xs text-white/80">DA</p>
                </div>
                <div className="text-center p-3 bg-gradient-to-br from-purple-400 to-purple-500 text-white rounded-xl shadow-md">
                  <p className="text-xl font-bold">৳{selectedStaff.allowances?.toLocaleString() || 0}</p>
                  <p className="text-xs text-white/80">Allowances</p>
                </div>
                <div className="text-center p-3 bg-gradient-to-br from-pink-400 to-pink-500 text-white rounded-xl shadow-md">
                  <p className="text-xl font-bold">৳{selectedStaff.personal_allowance?.toLocaleString() || 0}</p>
                  <p className="text-xs text-white/80">Personal Allow.</p>
                </div>
                <div className="text-center p-3 bg-gradient-to-br from-orange-400 to-orange-500 text-white rounded-xl shadow-md">
                  <p className="text-xl font-bold">৳{selectedStaff.special_allowance?.toLocaleString() || 0}</p>
                  <p className="text-xs text-white/80">Special Allow.</p>
                </div>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h4 className="font-semibold text-gray-800 dark:text-white mb-3">Balance Sheet</h4>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                  <div className="flex justify-between">
                    <span className="text-gray-700 dark:text-gray-300">Total Monthly Salary:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 text-lg">
                      ৳{(selectedStaff.total_salary || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between mt-2 text-sm text-gray-500 dark:text-gray-400">
                    <span>Effective From:</span>
                    <span>{selectedStaff.effective_from || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between mt-1 text-sm text-gray-500 dark:text-gray-400">
                    <span>Version:</span>
                    <span>v{selectedStaff.version || 1}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="rounded-2xl max-w-2xl bg-white dark:bg-gray-900 border-0 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white">Salary History - {selectedStaff?.name}</DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-400">
              Complete salary version history
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {staffHistory.length === 0 ? (
              <div className="text-center py-8">
                <DollarSign className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500">No history records found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 dark:from-indigo-600 dark:via-purple-600 dark:to-pink-600">
                      <TableHead className="text-white font-semibold">Date</TableHead>
                      <TableHead className="text-white font-semibold">Old Total</TableHead>
                      <TableHead className="text-white font-semibold">New Total</TableHead>
                      <TableHead className="text-white font-semibold">Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {staffHistory.map((item) => (
                      <TableRow key={item.id} className="border-b border-gray-100 dark:border-gray-700">
                        <TableCell className="text-gray-700 dark:text-gray-300 text-sm">
                          {new Date(item.changed_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-red-600">
                          ৳{(item.old_total || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-emerald-600 font-semibold">
                          ৳{(item.new_total || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-gray-700 dark:text-gray-300 text-sm">
                          {item.change_reason || 'Updated'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setHistoryDialogOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </ResponsiveLayout>
  );
}
