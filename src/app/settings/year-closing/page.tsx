// src/app/settings/year-closing/page.tsx
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  CheckCircle,
  Loader2,
  RefreshCw,
  Users,
  Wallet,
  Package,
  Banknote,
  AlertCircle,
  PlayCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { formatCurrency } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { getAllActiveYears, type AcademicYearRecord } from "@/lib/api/academic-year-context";
import { toast } from "sonner";

interface PreviewStudent {
  student_id: string;
  student_name: string;
  class_id: string | null;
  class_name: string;
  section_id: string | null;
  class_roll: string | null;
  admission_no: string | null;
  total_due: number;
}

interface PreviewData {
  total_active_students: number;
  total_students_with_due: number;
  total_due_amount: number;
  students: PreviewStudent[];
}

export default function YearClosingPage() {
  const supabase = createClient();

  const [activeYears, setActiveYears] = useState<AcademicYearRecord[]>([]);
  const [sourceYearId, setSourceYearId] = useState<string>("");
  const [targetYearId, setTargetYearId] = useState<string>("");
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [executing, setExecuting] = useState(false);
   const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
   const [showConfirmDialog, setShowConfirmDialog] = useState(false);
   const [activeTab, setActiveTab] = useState<string>("students");

   const [filterClass, setFilterClass] = useState<string>("all");
   const [filterSection, setFilterSection] = useState<string>("all");
   const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
   const [sections, setSections] = useState<{ id: string; name: string; class_id: string }[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [staffPreview, setStaffPreview] = useState<any>(null);
  const [loadingStaffPreview, setLoadingStaffPreview] = useState(false);
  const [inventoryPreview, setInventoryPreview] = useState<any>(null);
  const [loadingInventoryPreview, setLoadingInventoryPreview] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [inventoryExecuting, setInventoryExecuting] = useState(false);
  const [showInventoryConfirm, setShowInventoryConfirm] = useState(false);
  const [financePreview, setFinancePreview] = useState<any>(null);
  const [loadingFinancePreview, setLoadingFinancePreview] = useState(false);
  const [selectedFinanceAccountIds, setSelectedFinanceAccountIds] = useState<string[]>([]);
  const [financeExecuting, setFinanceExecuting] = useState(false);
  const [showFinanceConfirm, setShowFinanceConfirm] = useState(false);
  const [financialYears, setFinancialYears] = useState<{ id: string; year_name: string }[]>([]);
  const [financeSourceYearId, setFinanceSourceYearId] = useState<string>("");
  const [financeTargetYearId, setFinanceTargetYearId] = useState<string>("");

  useEffect(() => {
    const loadYears = async () => {
      try {
        const years = await getAllActiveYears(supabase);
        setActiveYears(years);

        const currentYear = years.find((y) => y.is_current);
        if (currentYear) {
          setSourceYearId(currentYear.id);

          const sorted = [...years].sort(
            (a, b) =>
              new Date(a.start_date || "").getTime() -
              new Date(b.start_date || "").getTime()
          );
          const idx = sorted.findIndex((y) => y.id === currentYear.id);
          if (idx >= 0 && idx + 1 < sorted.length) {
            setTargetYearId(sorted[idx + 1].id);
          }
        }
      } catch (err) {
        console.error("Failed to load academic years:", err);
        toast.error("Failed to load academic years");
      }
    };
    loadYears();
   }, [supabase]);

   useEffect(() => {
     const loadClassesAndSections = async () => {
       try {
         const [classesRes, sectionsRes] = await Promise.all([
           supabase.from("classes").select("id, name").order("name"),
           supabase.from("sections").select("id, name, class_id").order("name"),
         ]);
         if (classesRes.data) setClasses(classesRes.data);
         if (sectionsRes.data) setSections(sectionsRes.data);
       } catch (err) {
         console.error("Failed to load classes/sections:", err);
         toast.error("Failed to load classes/sections");
       }
     };
     loadClassesAndSections();
   }, [supabase]);

    useEffect(() => {
      setCurrentPage(1);
    }, [filterClass, filterSection]);

    useEffect(() => {
      const loadFinancialYears = async () => {
        try {
          const { data, error } = await supabase
            .from("financial_years")
            .select("id, year_name")
            .order("year_name", { ascending: false });
          if (error) {
            toast.error(error.message);
          } else if (data && data.length > 0) {
            setFinancialYears(data);
            setFinanceSourceYearId(data[0].id);
            if (data.length > 1) {
              setFinanceTargetYearId(data[1].id);
            }
          }
        } catch (err) {
          console.error("Failed to load financial years:", err);
          toast.error("Failed to load financial years");
        }
      };
      loadFinancialYears();
    }, [supabase]);

  const loadPreview = useCallback(async () => {
    if (!sourceYearId || !targetYearId) {
      toast.warning("Please select both source and target years");
      return;
    }

    setLoadingPreview(true);
    try {
      const { data, error } = await supabase.rpc("preview_promotion_and_dues", {
        p_source_year_id: sourceYearId,
        p_target_year_id: targetYearId,
      });

      if (error) {
        toast.error(error.message);
        setPreviewData(null);
      } else {
        setPreviewData(data as PreviewData);
        setSelectedStudentIds(
          data.students?.map((s: PreviewStudent) => s.student_id) ?? []
        );
      }
    } catch (err) {
      console.error("Preview error:", err);
      toast.error("Failed to load preview data");
    } finally {
      setLoadingPreview(false);
    }
  }, [supabase, sourceYearId, targetYearId]);

  const executeRollover = useCallback(async () => {
    if (selectedStudentIds.length === 0) {
      toast.error("No students selected");
      return;
    }

    setExecuting(true);
    try {
      const { data, error } = await supabase.rpc("execute_promotion_and_rollover", {
        p_source_year_id: sourceYearId,
        p_target_year_id: targetYearId,
        p_student_ids: selectedStudentIds,
        p_promoted_class_ids: {},
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success(`Rollover complete. Created ${data.created_count} invoices.`);
        setPreviewData(null);
        setSelectedStudentIds([]);
        setShowConfirmDialog(false);
      }
    } catch (err) {
      console.error("Execute error:", err);
      toast.error("Failed to execute rollover");
    } finally {
      setExecuting(false);
    }
   }, [supabase, sourceYearId, targetYearId, selectedStudentIds]);

   const filteredStudents = useMemo(() => {
     if (!previewData?.students) return [];
     return previewData.students.filter(
       (s) =>
         (filterClass === "all" || s.class_id === filterClass) &&
         (filterSection === "all" || s.section_id === filterSection)
     );
   }, [previewData, filterClass, filterSection]);

   const paginatedStudents = useMemo(() => {
     const start = (currentPage - 1) * pageSize;
     return filteredStudents.slice(start, start + pageSize);
   }, [filteredStudents, currentPage, pageSize]);

   const totalPages = useMemo(() => {
     return Math.ceil(filteredStudents.length / pageSize);
   }, [filteredStudents, pageSize]);

   const selectAll = () => {
     setSelectedStudentIds(filteredStudents.map((s) => s.student_id));
   };

   const deselectAll = () => {
     setSelectedStudentIds(
       selectedStudentIds.filter((id) => !filteredStudents.some((s) => s.student_id === id))
     );
   };

  const toggleStudent = (id: string) => {
    if (selectedStudentIds.includes(id)) {
      setSelectedStudentIds(selectedStudentIds.filter((s) => s !== id));
    } else {
   setSelectedStudentIds([...selectedStudentIds, id]);
     }
   };

   const loadStaffPreview = useCallback(async () => {
     setLoadingStaffPreview(true);
     try {
       const { data, error } = await supabase.rpc("preview_staff_salary_rollover");
       if (error) {
         toast.error(error.message);
       } else {
         setStaffPreview(data);
       }
     } catch (err) {
       console.error("Staff preview error:", err);
       toast.error("Failed to load staff preview data");
     } finally {
       setLoadingStaffPreview(false);
     }
   }, [supabase]);

   useEffect(() => {
     if (activeTab === "staff" && !staffPreview) {
       loadStaffPreview();
     }
   }, [activeTab, staffPreview, loadStaffPreview]);

   const loadInventoryPreview = useCallback(async () => {
     if (!sourceYearId || !targetYearId) {
       toast.warning("Please select both source and target years");
       return;
     }
     setLoadingInventoryPreview(true);
     try {
       const { data, error } = await supabase.rpc("preview_inventory_rollover", {
         p_source_year_id: sourceYearId,
         p_target_year_id: targetYearId,
       });
       if (error) {
         toast.error(error.message);
         return;
       }
       setInventoryPreview(data);
       setSelectedItemIds(
         data.items
           ?.filter((i: any) => i.current_stock > 0 && !i.has_opening_movement)
           .map((i: any) => i.item_id) ?? []
       );
     } catch (err) {
       console.error("Inventory preview error:", err);
       toast.error("Failed to load inventory preview data");
     } finally {
       setLoadingInventoryPreview(false);
     }
   }, [supabase, sourceYearId, targetYearId]);

   const executeInventoryRollover = useCallback(async () => {
     if (selectedItemIds.length === 0) {
       toast.error("No items selected");
       return;
     }
     setInventoryExecuting(true);
     try {
       const { data, error } = await supabase.rpc("execute_inventory_rollover", {
         p_source_year_id: sourceYearId,
         p_target_year_id: targetYearId,
         p_item_ids: selectedItemIds,
       });
       if (error) {
         toast.error(error.message);
       } else {
         toast.success(`Created ${data.created} opening stock movements.`);
         await loadInventoryPreview();
         setShowInventoryConfirm(false);
       }
     } catch (err) {
       console.error("Inventory execute error:", err);
       toast.error("Failed to execute inventory rollover");
     } finally {
       setInventoryExecuting(false);
     }
   }, [supabase, sourceYearId, targetYearId, selectedItemIds, loadInventoryPreview]);

   const toggleItem = (id: string) => {
     if (selectedItemIds.includes(id)) {
       setSelectedItemIds(selectedItemIds.filter((i) => i !== id));
     } else {
       setSelectedItemIds([...selectedItemIds, id]);
     }
   };

   const selectAllItems = () => {
     if (inventoryPreview?.items) {
       setSelectedItemIds(
         inventoryPreview.items
           .filter((i: any) => i.current_stock > 0 && !i.has_opening_movement)
           .map((i: any) => i.item_id)
       );
     }
   };

   const deselectAllItems = () => {
    setSelectedItemIds([]);
    };

    const loadFinancePreview = useCallback(async () => {
      if (!financeSourceYearId || !financeTargetYearId) return;
      setLoadingFinancePreview(true);
      try {
        const { data, error } = await supabase.rpc("preview_finance_rollover", {
          p_source_year_id: financeSourceYearId,
          p_target_year_id: financeTargetYearId,
        });
        if (error) {
          toast.error(error.message);
          return;
        }
        setFinancePreview(data);
        setSelectedFinanceAccountIds(
          data.accounts
            ?.filter(
              (i: any) =>
                i.current_balance !== 0 &&
                i.is_balance_sheet === true &&
                !i.has_opening_voucher
            )
            .map((i: any) => i.account_id) ?? []
        );
      } catch (err) {
        console.error("Finance preview error:", err);
        toast.error("Failed to load finance preview data");
      } finally {
        setLoadingFinancePreview(false);
      }
    }, [
      supabase,
      financeSourceYearId,
      financeTargetYearId,
    ]);

    const executeFinanceRollover = useCallback(async () => {
      if (selectedFinanceAccountIds.length === 0) {
        toast.error("No accounts selected");
        return;
      }
      setFinanceExecuting(true);
      try {
        const { data, error } = await supabase.rpc("execute_finance_rollover", {
          p_source_year_id: financeSourceYearId,
          p_target_year_id: financeTargetYearId,
          p_account_ids: selectedFinanceAccountIds,
        });
        if (error) {
          toast.error(error.message);
        } else {
          toast.success(`Created ${data.created} opening vouchers.`);
          await loadFinancePreview();
          setShowFinanceConfirm(false);
        }
      } catch (err) {
        console.error("Finance execute error:", err);
        toast.error("Failed to execute finance rollover");
      } finally {
        setFinanceExecuting(false);
      }
    }, [
      supabase,
      financeSourceYearId,
      financeTargetYearId,
      selectedFinanceAccountIds,
      loadFinancePreview,
    ]);

    const toggleAccount = (id: string) => {
      if (selectedFinanceAccountIds.includes(id)) {
        setSelectedFinanceAccountIds(
          selectedFinanceAccountIds.filter((i) => i !== id)
        );
      } else {
        setSelectedFinanceAccountIds([...selectedFinanceAccountIds, id]);
      }
    };

    const selectAllAccounts = () => {
      if (financePreview?.accounts) {
        setSelectedFinanceAccountIds(
          financePreview.accounts
            .filter(
              (i: any) =>
                i.current_balance !== 0 &&
                i.is_balance_sheet === true &&
                !i.has_opening_voucher
            )
            .map((i: any) => i.account_id)
        );
      }
    };

    const deselectAllAccounts = () => {
      setSelectedFinanceAccountIds([]);
    };

  return (
    <ResponsiveLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="rounded-3xl bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-800 p-6 shadow-2xl">
          <div className="flex flex-col lg:flex-row gap-4 justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Link href="/settings">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white/80 hover:text-white hover:bg-white/20 -ml-2"
                  >
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Settings
                  </Button>
                </Link>
              </div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <Calendar className="h-8 w-8" />
                Year Closing & Rollover
                <Badge className="bg-pink-400 text-black ml-2">Admin</Badge>
              </h1>
              <p className="text-indigo-100 mt-2">
                Migrate students, fees, staff salary, inventory and finance data
                to the next academic year
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={loadPreview}
                disabled={loadingPreview || !sourceYearId || !targetYearId}
                variant="outline"
                className="bg-white/20 hover:bg-white/30 text-white border-0"
              >
                {loadingPreview ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Refresh Preview
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-4 gap-2 bg-gray-100 dark:bg-gray-800/70 p-1.5 rounded-xl">
            <TabsTrigger
              value="students"
              className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-900 data-[state=active]:shadow data-[state=active]:text-indigo-700 dark:data-[state=active]:text-indigo-300"
            >
              <Users className="h-4 w-4 mr-2" />
              Students & Fees
            </TabsTrigger>
            <TabsTrigger
              value="staff"
              className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-900 data-[state=active]:shadow data-[state=active]:text-purple-700 dark:data-[state=active]:text-purple-300"
            >
              <Wallet className="h-4 w-4 mr-2" />
              Staff Salary
            </TabsTrigger>
            <TabsTrigger
              value="inventory"
              className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-900 data-[state=active]:shadow data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-300"
            >
              <Package className="h-4 w-4 mr-2" />
              Inventory
            </TabsTrigger>
            <TabsTrigger
              value="finance"
              className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-900 data-[state=active]:shadow data-[state=active]:text-amber-700 dark:data-[state=active]:text-amber-300"
            >
              <Banknote className="h-4 w-4 mr-2" />
              Finance
            </TabsTrigger>
          </TabsList>

          {/* ====== Students & Fees Tab ====== */}
          <TabsContent value="students" className="mt-6">
            {/* Step 1: Select Years */}
            <Card className="border-0 shadow-lg rounded-3xl bg-white dark:bg-gray-900">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  Step 1: Select Academic Years
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Source Year
                    </label>
                    <Select
                      value={sourceYearId}
                      onValueChange={setSourceYearId}
                    >
                      <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">
                        <SelectValue placeholder="Select source year" />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg">
                        {activeYears.map((year) => (
                          <SelectItem
                            key={year.id}
                            value={year.id}
                            className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                          >
                            {year.year_name} {year.is_current && "(Current)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Target Year
                    </label>
                    <Select
                      value={targetYearId}
                      onValueChange={setTargetYearId}
                    >
                      <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">
                        <SelectValue placeholder="Select target year" />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg">
                        {activeYears
                          .filter((y) => y.id !== sourceYearId)
                          .map((year) => (
                            <SelectItem
                              key={year.id}
                              value={year.id}
                              className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                            >
                              {year.year_name} {year.is_current && "(Current)"}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={loadPreview}
                    disabled={loadingPreview || !sourceYearId || !targetYearId}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    {loadingPreview ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    {loadingPreview ? "Loading..." : "Load Preview"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Step 2: Review & Select Students */}
            {previewData && (
              <>
                <Card className="border-0 shadow-lg rounded-3xl bg-white dark:bg-gray-900 mt-6">
                  <CardHeader>
                    <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
                      <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      Step 2: Review & Select Students
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Total Active Students
                        </p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                          {previewData.total_active_students}
                        </p>
                      </div>
                      <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Students with Due
                        </p>
                        <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                          {previewData.total_students_with_due}
                        </p>
                      </div>
                      <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Total Due Amount
                        </p>
                        <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                          {formatCurrency(previewData.total_due_amount)}
                        </p>
                      </div>
                    </div>

                     <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                       <p className="text-xs text-blue-800 dark:text-blue-300">
                         All active students will be promoted to the next year.
                         Uncheck any student who is leaving (TC, dropout).
                         Students with dues will have their balance carried
                         forward.
                       </p>
                     </div>

                     <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
                       <div className="flex gap-4 items-end">
                         <div className="flex flex-col">
                           <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                             Class
                           </label>
                           <Select value={filterClass} onValueChange={setFilterClass}>
                             <SelectTrigger className="w-48 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">
                               <SelectValue placeholder="All Classes" />
                             </SelectTrigger>
                             <SelectContent className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg">
                               <SelectItem value="all" className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer">
                                 All Classes
                               </SelectItem>
                               {classes.map((cls) => (
                                 <SelectItem key={cls.id} value={cls.id} className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer">
                                   {cls.name}
                                 </SelectItem>
                               ))}
                             </SelectContent>
                           </Select>
                         </div>
                         <div className="flex flex-col">
                           <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                             Section
                           </label>
                           <Select
                             value={filterSection}
                             onValueChange={setFilterSection}
                             disabled={filterClass === "all"}
                           >
                             <SelectTrigger className="w-48 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100" disabled={filterClass === "all"}>
                               <SelectValue placeholder="All Sections" />
                             </SelectTrigger>
                             <SelectContent className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg">
                               <SelectItem value="all" className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer">
                                 All Sections
                               </SelectItem>
                               {sections
                                 .filter((s) => s.class_id === filterClass)
                                 .map((s) => (
                                   <SelectItem key={s.id} value={s.id} className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer">
                                     {s.name}
                                   </SelectItem>
                                 ))}
                             </SelectContent>
                           </Select>
                         </div>
                       </div>
                       <div className="text-sm text-gray-600 dark:text-gray-400">
                         Showing {filteredStudents.length > 0
                           ? `${(currentPage - 1) * pageSize + 1}-${Math.min(currentPage * pageSize, filteredStudents.length)}`
                           : "0"}{" "}
                         of {filteredStudents.length} students
                       </div>
                     </div>

                     <div className="flex items-center justify-between">
                       <div className="flex items-center gap-4">
                         <div className="flex gap-2">
                           <Button
                             onClick={selectAll}
                             variant="outline"
                             size="sm"
                             className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                           >
                             <CheckCircle className="h-4 w-4 mr-1" />
                             Select All
                           </Button>
                           <Button
                             onClick={deselectAll}
                             variant="outline"
                             size="sm"
                             className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                           >
                             Deselect All
                           </Button>
                         </div>
<p className="text-xs text-gray-500 dark:text-gray-400">
                          Select All applies to filtered students ({filteredStudents.length} {filteredStudents.length === 1 ? "student" : "students"}).
                        </p>
                       </div>
                       <div className="flex items-center gap-2">
                         <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}>
                           <SelectTrigger className="w-16 h-8 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">
                             <SelectValue />
                           </SelectTrigger>
                           <SelectContent className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg">
                             <SelectItem value="10">10</SelectItem>
                             <SelectItem value="20">20</SelectItem>
                             <SelectItem value="50">50</SelectItem>
                             <SelectItem value="100">100</SelectItem>
                           </SelectContent>
                         </Select>
                       </div>
                     </div>

                     <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                       <Table>
                         <TableHeader className="bg-gray-50 dark:bg-gray-800/50">
                           <TableRow className="border-gray-200 dark:border-gray-700">
                             <TableHead className="w-10 text-gray-700 dark:text-gray-300">
                                <Checkbox
                                  checked={
                                    paginatedStudents.length > 0 &&
                                    paginatedStudents.every((s) =>
                                      selectedStudentIds.includes(s.student_id)
                                    )
                                  }
                                  onCheckedChange={(checked) => {
                                   if (checked) {
                                     setSelectedStudentIds([
                                       ...new Set([
                                         ...selectedStudentIds,
                                         ...paginatedStudents.map((s) => s.student_id),
                                       ]),
                                     ]);
                                   } else {
                                     setSelectedStudentIds(
                                       selectedStudentIds.filter(
                                         (id) =>
                                           !paginatedStudents.some(
                                             (s) => s.student_id === id
                                           )
                                       )
                                     );
                                   }
                                 }}
                               />
                             </TableHead>
                             <TableHead className="text-gray-700 dark:text-gray-300">
                               Student ID
                             </TableHead>
                             <TableHead className="text-gray-700 dark:text-gray-300">
                               Name
                             </TableHead>
                             <TableHead className="text-gray-700 dark:text-gray-300">
                               Class
                             </TableHead>
                             <TableHead className="text-gray-700 dark:text-gray-300">
                               Roll
                             </TableHead>
                             <TableHead className="text-right text-gray-700 dark:text-gray-300">
                               Total Due
                             </TableHead>
                           </TableRow>
                         </TableHeader>
                         <TableBody>
                             {paginatedStudents.length > 0 ? (
                               paginatedStudents.map((student) => (
                                <TableRow
                                  key={student.student_id}
                                  className="border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                >
                                  <TableCell>
                                    <Checkbox
                                      checked={selectedStudentIds.includes(
                                        student.student_id
                                      )}
                                      onCheckedChange={() =>
                                        toggleStudent(student.student_id)
                                      }
                                    />
                                  </TableCell>
                                  <TableCell className="text-gray-600 dark:text-gray-300 font-mono text-sm">
                                    {student.admission_no || "—"}
                                  </TableCell>
                                  <TableCell className="font-medium text-gray-900 dark:text-white">
                                    <Link
                                      href={`/students/${student.student_id}`}
                                      className="hover:text-indigo-600 dark:hover:text-indigo-400"
                                    >
                                      {student.student_name}
                                    </Link>
                                  </TableCell>
                                  <TableCell className="text-gray-600 dark:text-gray-300">
                                    {student.class_name}
                                  </TableCell>
                                  <TableCell className="text-gray-600 dark:text-gray-300">
                                    {student.class_roll || "—"}
                                  </TableCell>
                                  <TableCell className="text-right text-gray-900 dark:text-gray-100">
                                    {student.total_due > 0
                                      ? formatCurrency(student.total_due)
                                      : "৳ 0"}
                                  </TableCell>
                                </TableRow>
                              ))
                             ) : (
                               <TableRow>
                                 <TableCell colSpan={6} className="text-center py-8 text-gray-500 dark:text-gray-400">
                                   No students match the selected filters.
                                 </TableCell>
                               </TableRow>
                             )}
                         </TableBody>
                       </Table>
                     </div>

                     {totalPages > 1 && (
                       <div className="flex items-center justify-center gap-4 mt-4 text-sm">
                         <Button
                           onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                           disabled={currentPage <= 1 || totalPages <= 1}
                           variant="outline"
                           size="sm"
                           className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                         >
                           Previous
                         </Button>
                         <span className="text-gray-600 dark:text-gray-400">
                           Page {currentPage} of {totalPages}
                         </span>
                         <Button
                           onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                           disabled={currentPage >= totalPages || totalPages <= 1}
                           variant="outline"
                           size="sm"
                           className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                         >
                           Next
                         </Button>
                       </div>
                     )}
                  </CardContent>
                </Card>

                {/* Step 3: Execute */}
                <Card className="border-0 shadow-lg rounded-3xl bg-white dark:bg-gray-900 mt-6">
                  <CardHeader>
                    <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
                      <PlayCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                      Step 3: Execute Rollover
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      {selectedStudentIds.length} of {previewData.total_active_students} student(s) selected for promotion.
                      {previewData.total_students_with_due > 0 && (
                        <>
                          {" "}
                          <span className="font-medium text-red-600 dark:text-red-400">
                            {previewData.total_students_with_due} student(s) have
                          </span>{" "}
                          dues totaling{" "}
                          <span className="font-bold text-red-600 dark:text-red-400">
                            {formatCurrency(previewData.total_due_amount)}
                          </span>
                          .
                        </>
                      )}
                    </p>
                    <Button
                      onClick={() => setShowConfirmDialog(true)}
                      disabled={
                        selectedStudentIds.length === 0 || executing
                      }
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      {executing ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <PlayCircle className="mr-2 h-4 w-4" />
                      )}
                      {executing ? "Executing..." : "Confirm & Execute Rollover"}
                    </Button>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Staff Salary Tab */}
          <TabsContent value="staff" className="mt-6">
            <Card className="border-0 shadow-lg rounded-3xl bg-white dark:bg-gray-900">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  Staff Salary Rollover
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 w-full">
                    <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Total Active Staff
                      </p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {staffPreview?.total_active_staff ?? 0}
                      </p>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Staff with Structure
                      </p>
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {staffPreview?.staff_with_structure ?? 0}
                      </p>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Staff without Structure
                      </p>
                      <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                        {staffPreview?.staff_without_structure ?? 0}
                      </p>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Total Monthly Salary
                      </p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {formatCurrency(staffPreview?.total_monthly_salary ?? 0)}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={loadStaffPreview}
                    disabled={loadingStaffPreview}
                    variant="outline"
                    size="sm"
                    className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 shrink-0"
                  >
                    {loadingStaffPreview ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    Refresh Preview
                  </Button>
                </div>

                <Card className="border-0 shadow rounded-xl bg-white dark:bg-gray-900">
                  <CardHeader>
                    <CardTitle className="text-gray-900 dark:text-white text-lg">
                      Staff List
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                      <Table>
                        <TableHeader className="bg-gray-50 dark:bg-gray-800/50">
                          <TableRow className="border-gray-200 dark:border-gray-700">
                            <TableHead className="text-gray-700 dark:text-gray-300">
                              Name
                            </TableHead>
                            <TableHead className="text-gray-700 dark:text-gray-300">
                              Designation
                            </TableHead>
                            <TableHead className="text-gray-700 dark:text-gray-300">
                              Basic
                            </TableHead>
                            <TableHead className="text-gray-700 dark:text-gray-300">
                              Total Salary
                            </TableHead>
                            <TableHead className="text-gray-700 dark:text-gray-300">
                              Effective From
                            </TableHead>
                            <TableHead className="text-gray-700 dark:text-gray-300">
                              Has Structure
                            </TableHead>
                            <TableHead className="w-32 text-center text-gray-700 dark:text-gray-300">
                              Action
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {staffPreview?.staff_list?.length > 0 ? (
                            staffPreview.staff_list.map((s: any) => (
                              <TableRow
                                key={s.staff_id}
                                className="border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                              >
                                <TableCell className="font-medium text-gray-900 dark:text-white">
                                  {s.name}
                                </TableCell>
                                <TableCell className="text-gray-600 dark:text-gray-300">
                                  {s.designation || "—"}
                                </TableCell>
                                <TableCell className="text-gray-600 dark:text-gray-300 font-mono">
                                  {s.basic ? formatCurrency(s.basic) : "—"}
                                </TableCell>
                                <TableCell className="text-gray-600 dark:text-gray-300 font-mono">
                                  {s.total_salary ? formatCurrency(s.total_salary) : "—"}
                                </TableCell>
                                <TableCell className="text-gray-600 dark:text-gray-300">
                                  {s.effective_from || "—"}
                                </TableCell>
                                <TableCell>
                                  {s.has_structure ? (
                                    <Badge
                                      variant="outline"
                                      className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800"
                                    >
                                      Yes
                                    </Badge>
                                  ) : (
                                    <Badge
                                      variant="outline"
                                      className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800"
                                    >
                                      No Structure
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-center">
                                  {!s.has_structure && (
                                    <Link href="/staff/salary">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                                      >
                                        Create Structure
                                      </Button>
                                    </Link>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell
                                colSpan={7}
                                className="text-center py-8 text-gray-500 dark:text-gray-400"
                              >
                                {loadingStaffPreview
                                  ? "Loading staff data..."
                                  : "No staff data available."}
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-xl p-4">
                  <p className="text-xs text-purple-800 dark:text-purple-300">
                    Staff salary structures persist across years automatically.
                    No carry-forward is required. If you need to update a
                    staff member's salary for the new year, create a new
                    salary structure in the Staff Salary module.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Inventory Tab */}
          <TabsContent value="inventory" className="mt-6">
            <div className="space-y-6">
              {/* Step 1: Select Years */}
              <Card className="border-0 shadow-lg rounded-3xl bg-white dark:bg-gray-900">
                <CardHeader>
                  <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
                    <Package className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    Step 1: Select Academic Years
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Source Year
                      </Label>
                      <Select
                        value={sourceYearId}
                        onValueChange={setSourceYearId}
                      >
                        <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">
                          <SelectValue placeholder="Select source year" />
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg">
                          {activeYears.map((year) => (
                            <SelectItem
                              key={year.id}
                              value={year.id}
                              className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                            >
                              {year.year_name} {year.is_current && "(Current)"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Target Year
                      </Label>
                      <Select
                        value={targetYearId}
                        onValueChange={setTargetYearId}
                      >
                        <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">
                          <SelectValue placeholder="Select target year" />
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg">
                          {activeYears
                            .filter((y) => y.id !== sourceYearId)
                            .map((year) => (
                              <SelectItem
                                key={year.id}
                                value={year.id}
                                className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                              >
                                {year.year_name} {year.is_current && "(Current)"}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      onClick={loadInventoryPreview}
                      disabled={loadingInventoryPreview || !sourceYearId || !targetYearId}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      {loadingInventoryPreview ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                      )}
                      {loadingInventoryPreview ? "Loading..." : "Load Preview"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Step 2: Review Items */}
              {inventoryPreview && (
                <Card className="border-0 shadow-lg rounded-3xl bg-white dark:bg-gray-900">
                  <CardHeader>
                    <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
                      <Package className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      Step 2: Review Items
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Total Items
                        </p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                          {inventoryPreview.total_items}
                        </p>
                      </div>
                      <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Items with Stock
                        </p>
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          {inventoryPreview.items_with_stock}
                        </p>
                      </div>
                      <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Total Stock Value
                        </p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                          {formatCurrency(inventoryPreview.total_stock_value)}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={selectAllItems}
                        variant="outline"
                        size="sm"
                        className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Select All
                      </Button>
                      <Button
                        onClick={deselectAllItems}
                        variant="outline"
                        size="sm"
                        className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                      >
                        Deselect All
                      </Button>
                    </div>

                    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                      <Table>
                        <TableHeader className="bg-gray-50 dark:bg-gray-800/50">
                          <TableRow className="border-gray-200 dark:border-gray-700">
                            <TableHead className="w-10 text-gray-700 dark:text-gray-300">
                              <Checkbox
                                checked={
                                  inventoryPreview.items
                                    .filter(
                                      (i: any) =>
                                        i.current_stock > 0 &&
                                        !i.has_opening_movement
                                    )
                                    .every((i: any) =>
                                      selectedItemIds.includes(i.item_id)
                                    )
                                }
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    selectAllItems();
                                  } else {
                                    deselectAllItems();
                                  }
                                }}
                              />
                            </TableHead>
                            <TableHead className="text-gray-700 dark:text-gray-300">
                              Item Code
                            </TableHead>
                            <TableHead className="text-gray-700 dark:text-gray-300">
                              Name
                            </TableHead>
                            <TableHead className="text-right text-gray-700 dark:text-gray-300">
                              Current Stock
                            </TableHead>
                            <TableHead className="text-gray-700 dark:text-gray-300">
                              Unit
                            </TableHead>
                            <TableHead className="text-right text-gray-700 dark:text-gray-300">
                              Stock Value
                            </TableHead>
                            <TableHead className="text-gray-700 dark:text-gray-300">
                              Status
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {inventoryPreview.items.length > 0 ? (
                            inventoryPreview.items.map((item: any) => (
                              <TableRow
                                key={item.item_id}
                                className="border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                              >
                                <TableCell>
                                  <Checkbox
                                    checked={selectedItemIds.includes(
                                      item.item_id
                                    )}
                                    onCheckedChange={() =>
                                      toggleItem(item.item_id)
                                    }
                                    disabled={
                                      item.has_opening_movement ||
                                      item.current_stock <= 0
                                    }
                                  />
                                </TableCell>
                                <TableCell className="text-gray-600 dark:text-gray-300 font-mono text-sm">
                                  {item.item_code || "—"}
                                </TableCell>
                                <TableCell className="font-medium text-gray-900 dark:text-white">
                                  {item.name}
                                </TableCell>
                                <TableCell className="text-right text-gray-600 dark:text-gray-300">
                                  {item.current_stock}
                                </TableCell>
                                <TableCell className="text-gray-600 dark:text-gray-300">
                                  {item.unit || "—"}
                                </TableCell>
                                <TableCell className="text-right text-gray-600 dark:text-gray-300">
                                  {item.stock_value
                                    ? formatCurrency(item.stock_value)
                                    : "৳ 0"}
                                </TableCell>
                                <TableCell>
                                  {item.has_opening_movement ? (
                                    <Badge
                                      variant="secondary"
                                      className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
                                    >
                                      Exists
                                    </Badge>
                                  ) : item.current_stock <= 0 ? (
                                    <Badge
                                      variant="outline"
                                      className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                                    >
                                      No Stock
                                    </Badge>
                                  ) : (
                                    <Badge
                                      variant="default"
                                      className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800"
                                    >
                                      Ready
                                    </Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell
                                colSpan={7}
                                className="text-center py-8 text-gray-500 dark:text-gray-400"
                              >
                                No items found.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Step 3: Execute */}
              {inventoryPreview && (
                <Card className="border-0 shadow-lg rounded-3xl bg-white dark:bg-gray-900">
                  <CardHeader>
                    <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
                      <PlayCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                      Step 3: Execute
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button
                      onClick={() => setShowInventoryConfirm(true)}
                      disabled={
                        selectedItemIds.length === 0 || inventoryExecuting
                      }
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      {inventoryExecuting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <PlayCircle className="mr-2 h-4 w-4" />
                      )}
                      Create Opening Stock Movements (
                      {selectedItemIds.length} item
                      {selectedItemIds.length !== 1 ? "s" : ""})
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Confirm Dialog */}
              <Dialog
                open={showInventoryConfirm}
                onOpenChange={setShowInventoryConfirm}
              >
                <DialogContent className="sm:max-w-md bg-white dark:bg-gray-900">
                  <DialogHeader>
                    <DialogTitle className="text-gray-900 dark:text-white">
                      Confirm Inventory Rollover
                    </DialogTitle>
                    <DialogDescription className="text-gray-500 dark:text-gray-400">
                      This will create opening stock movements for{" "}
                      {selectedItemIds.length} item
                      {selectedItemIds.length !== 1 ? "s" : ""} in the target
                      year. This action cannot be easily undone.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setShowInventoryConfirm(false)}
                      disabled={inventoryExecuting}
                      className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={executeInventoryRollover}
                      disabled={inventoryExecuting}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      {inventoryExecuting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <PlayCircle className="mr-2 h-4 w-4" />
                      )}
                      {inventoryExecuting ? "Processing..." : "Confirm & Execute"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </TabsContent>

          {/* Finance Tab */}
          <TabsContent value="finance" className="mt-6">
            <div className="space-y-6">
              {/* Step 1: Select Years */}
              <Card className="border-0 shadow-lg rounded-3xl bg-white dark:bg-gray-900">
                <CardHeader>
                  <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
                    <Banknote className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    Step 1: Select Financial Years
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Source Year
                      </Label>
                      <Select
                        value={financeSourceYearId}
                        onValueChange={setFinanceSourceYearId}
                      >
                        <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">
                          <SelectValue placeholder="Select source year" />
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg">
                          {financialYears.map((year) => (
                            <SelectItem
                              key={year.id}
                              value={year.id}
                              className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                            >
                              {year.year_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Target Year
                      </Label>
                      <Select
                        value={financeTargetYearId}
                        onValueChange={setFinanceTargetYearId}
                      >
                        <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">
                          <SelectValue placeholder="Select target year" />
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg">
                          {financialYears
                            .filter((y) => y.id !== financeSourceYearId)
                            .map((year) => (
                              <SelectItem
                                key={year.id}
                                value={year.id}
                                className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                              >
                                {year.year_name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      onClick={loadFinancePreview}
                      disabled={
                        loadingFinancePreview ||
                        !financeSourceYearId ||
                        !financeTargetYearId
                      }
                      className="bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      {loadingFinancePreview ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                      )}
                      {loadingFinancePreview ? "Loading..." : "Load Preview"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Step 2: Review Accounts */}
              {financePreview && (
                <Card className="border-0 shadow-lg rounded-3xl bg-white dark:bg-gray-900">
                  <CardHeader>
                    <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
                      <Banknote className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      Step 2: Review Accounts
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Total Accounts
                        </p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                          {financePreview.total_accounts}
                        </p>
                      </div>
                      <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Total Balance
                        </p>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {formatCurrency(financePreview.total_balance)}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={selectAllAccounts}
                        variant="outline"
                        size="sm"
                        className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Select All Balance Sheet Accounts
                      </Button>
                      <Button
                        onClick={deselectAllAccounts}
                        variant="outline"
                        size="sm"
                        className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                      >
                        Deselect All
                      </Button>
                    </div>

                    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                      <Table>
                        <TableHeader className="bg-gray-50 dark:bg-gray-800/50">
                          <TableRow className="border-gray-200 dark:border-gray-700">
                            <TableHead className="w-10 text-gray-700 dark:text-gray-300">
                              <Checkbox
                                checked={
                                  financePreview.accounts
                                    .filter(
                                      (i: any) =>
                                        i.current_balance !== 0 &&
                                        i.is_balance_sheet === true &&
                                        !i.has_opening_voucher
                                    )
                                    .every((i: any) =>
                                      selectedFinanceAccountIds.includes(i.account_id)
                                    )
                                }
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    selectAllAccounts();
                                  } else {
                                    deselectAllAccounts();
                                  }
                                }}
                              />
                            </TableHead>
                            <TableHead className="text-gray-700 dark:text-gray-300">
                              Account Name
                            </TableHead>
                            <TableHead className="text-gray-700 dark:text-gray-300">
                              Category
                            </TableHead>
                            <TableHead className="text-right text-gray-700 dark:text-gray-300">
                              Balance
                            </TableHead>
                            <TableHead className="text-gray-700 dark:text-gray-300">
                              Status
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {financePreview.accounts.length > 0 ? (
                            financePreview.accounts.map((acc: any) => (
                              <TableRow
                                key={acc.account_id}
                                className="border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                              >
                                <TableCell>
                                  <Checkbox
                                    checked={selectedFinanceAccountIds.includes(
                                      acc.account_id
                                    )}
                                    onCheckedChange={() =>
                                      toggleAccount(acc.account_id)
                                    }
                                    disabled={
                                      !acc.is_balance_sheet ||
                                      acc.current_balance === 0 ||
                                      acc.has_opening_voucher
                                    }
                                  />
                                </TableCell>
                                <TableCell className="font-medium text-gray-900 dark:text-white">
                                  {acc.account_name}
                                </TableCell>
                                <TableCell className="text-gray-600 dark:text-gray-300">
                                  {acc.account_category || "—"}
                                </TableCell>
                                <TableCell className="text-right text-gray-600 dark:text-gray-300 font-mono">
                                  {formatCurrency(acc.current_balance)}
                                </TableCell>
                                <TableCell>
                                  {acc.has_opening_voucher ? (
                                    <Badge
                                      variant="secondary"
                                      className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
                                    >
                                      Exists
                                    </Badge>
                                  ) : !acc.is_balance_sheet ? (
                                    <Badge
                                      variant="outline"
                                      className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                                    >
                                      P&amp;L (Skip)
                                    </Badge>
                                  ) : acc.current_balance === 0 ? (
                                    <Badge
                                      variant="outline"
                                      className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                                    >
                                      No Balance
                                    </Badge>
                                  ) : (
                                    <Badge
                                      variant="default"
                                      className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800"
                                    >
                                      Ready
                                    </Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell
                                colSpan={5}
                                className="text-center py-8 text-gray-500 dark:text-gray-400"
                              >
                                No accounts found.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Step 3: Execute */}
              {financePreview && (
                <Card className="border-0 shadow-lg rounded-3xl bg-white dark:bg-gray-900">
                  <CardHeader>
                    <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
                      <PlayCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                      Step 3: Execute
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button
                      onClick={() => setShowFinanceConfirm(true)}
                      disabled={
                        selectedFinanceAccountIds.length === 0 ||
                        financeExecuting
                      }
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      {financeExecuting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <PlayCircle className="mr-2 h-4 w-4" />
                      )}
                      Create Opening Vouchers (
                      {selectedFinanceAccountIds.length} account
                      {selectedFinanceAccountIds.length !== 1 ? "s" : ""})
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Confirm Dialog */}
              <Dialog
                open={showFinanceConfirm}
                onOpenChange={setShowFinanceConfirm}
              >
                <DialogContent className="sm:max-w-md bg-white dark:bg-gray-900">
                  <DialogHeader>
                    <DialogTitle className="text-gray-900 dark:text-white">
                      Confirm Finance Rollover
                    </DialogTitle>
                    <DialogDescription className="text-gray-500 dark:text-gray-400">
                      This will create opening balance vouchers for{" "}
                      {selectedFinanceAccountIds.length} account
                      {selectedFinanceAccountIds.length !== 1 ? "s" : ""} in the target year. This action cannot be undone.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setShowFinanceConfirm(false)}
                      disabled={financeExecuting}
                      className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={executeFinanceRollover}
                      disabled={financeExecuting}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      {financeExecuting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <PlayCircle className="mr-2 h-4 w-4" />
                      )}
                      {financeExecuting ? "Processing..." : "Confirm &amp; Execute"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white">
              Confirm Year Closing
            </DialogTitle>
             <DialogDescription className="text-gray-500 dark:text-gray-400">
               You are about to promote {selectedStudentIds.length} student(s) to
               the next academic year. Among the selected students,{" "}
               {selectedStudentIds.filter((id) =>
                 previewData?.students
                   ?.filter((s) => s.total_due > 0)
                   .map((s) => s.student_id)
                   .includes(id)
               ).length || 0}{" "}
               student(s) have outstanding dues totaling{" "}
               {formatCurrency(
                 previewData?.students
                   ?.filter((s) => s.total_due > 0)
                   .reduce((sum, s) => sum + s.total_due, 0) || 0
               )}
               which will be carried forward. This action cannot be undone.
             </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              disabled={executing}
              className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
            >
              Cancel
            </Button>
            <Button
              onClick={executeRollover}
              disabled={executing}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {executing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <PlayCircle className="mr-2 h-4 w-4" />
              )}
              {executing ? "Executing..." : "Execute Rollover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ResponsiveLayout>
  );
}
