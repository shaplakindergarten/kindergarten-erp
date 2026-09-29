// src/app/students/list/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { KeyRound, UserPlus as UserPlusIcon } from "lucide-react";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

import {
  Loader2,
  Search,
  Eye,
  Pencil,
  Trash2,
  UserPlus,
  Download,
  RefreshCw,
  Users,
  UserCheck,
  UserX,
  Calendar,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

import { ResponsiveLayout } from "@/components/layout/responsive-layout";
import { useToastStore } from "@/store/useStore";
import { useDebounce } from "@/hooks/useDebounce";

import {
  getStudents,
  bulkDeleteStudents,
  bulkUpdateStatus,
  exportStudentsCSV,
  subscribeToStudents,
  unsubscribeFromStudents,
  getStudentStats,
  deleteStudent,
  Student,
  StudentFilters,
} from "@/lib/api/students.service";

// Filter Schema
const filterSchema = z.object({
  search: z.string().optional(),
  class_id: z.string().optional(),
  section_id: z.string().optional(),
  status: z.string().optional(),
  sort_by: z.string().default("created_at"),
  sort_order: z.enum(["asc", "desc"]).default("desc"),
});

type FilterFormData = z.infer<typeof filterSchema>;

// Class options with UUIDs from your database
const CLASS_OPTIONS = [
  { id: "all", name: "All Classes" },
  { id: "dbde079b-004c-44f1-9c5d-d4b25270d839", name: "Play" },
  { id: "6c4aa335-2e09-4864-bcb8-b1d8dbeabb11", name: "Nursery" },
  { id: "b63c9bd0-23b2-4974-ae5c-4583c4ae8dfd", name: "KG" },
  { id: "b43a7640-011d-434c-8c06-10205cc95dde", name: "I (One)" },
  { id: "8dc67e5d-80d0-40a1-aaf0-b2e187023317", name: "II (Two)" },
  { id: "266e1485-d469-4319-a7b0-1ea20237ef9f", name: "III (Three)" },
  { id: "f57f7636-f6d0-48f2-9f77-1354a4744eb3", name: "IV (Four)" },
  { id: "f0ad3f13-36e7-45f3-9d76-692033ebb28b", name: "V (Five)" },
];

const STATUS_OPTIONS = [
  { id: "all", name: "All Status" },
  { id: "active", name: "Active" },
  { id: "inactive", name: "Inactive" },
  { id: "transferred", name: "Transferred" },
  { id: "graduated", name: "Graduated" },
];

export default function StudentsListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const addToast = useToastStore((s) => s.addToast);

  // State
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(9);
  const [stats, setStats] = useState({ 
    total: 0, 
    active: 0, 
    newThisMonth: 0, 
    inactive: 0, 
    transferred: 0 
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<string | null>(null);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkStatusDialogOpen, setBulkStatusDialogOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState("active");
  const [isExporting, setIsExporting] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [isCreatingAccounts, setIsCreatingAccounts] = useState(false);

  // Form
  const { register, handleSubmit, watch, setValue } = useForm<FilterFormData>({
    resolver: zodResolver(filterSchema),
    defaultValues: {
      search: searchParams.get("search") || "",
      class_id: searchParams.get("class_id") || "all",
      section_id: searchParams.get("section_id") || "all",
      status: searchParams.get("status") || "all",
      sort_by: searchParams.get("sort_by") || "created_at",
      sort_order: (searchParams.get("sort_order") as "asc" | "desc") || "desc",
    },
  });

  const search = watch("search");
  const classFilter = watch("class_id");
  const sectionFilter = watch("section_id");
  const statusFilter = watch("status");
  const sortBy = watch("sort_by");
  const sortOrder = watch("sort_order");

  const debouncedSearch = useDebounce(search, 500);

  // Load Students
  const loadStudents = useCallback(
    async (currentPage: number = page) => {
      setLoading(true);
      try {
        const filters: StudentFilters = {
          search: debouncedSearch || undefined,
          class_id: classFilter === "all" ? undefined : classFilter,
          section_id: sectionFilter === "all" ? undefined : sectionFilter,
          status: statusFilter === "all" ? undefined : statusFilter,
          page: currentPage,
          limit,
          sort_by: sortBy,
          sort_order: sortOrder as "asc" | "desc",
        };

        const response = await getStudents(filters);
        setStudents(response.data);
        setTotal(response.total);
        setTotalPages(response.totalPages);
      } catch (error) {
        console.error('Error loading students:', error);
        addToast({ type: "error", title: "Failed to load students" });
      } finally {
        setLoading(false);
      }
    },
    [debouncedSearch, classFilter, sectionFilter, statusFilter, sortBy, sortOrder, limit, addToast, page]
  );

  // Load stats
  const loadStats = useCallback(async () => {
    try {
      const data = await getStudentStats();
      setStats(data);
    } catch (error) {
      console.error("Failed to load stats:", error);
    }
  }, []);

  // Effects
  useEffect(() => {
    loadStudents(1);
    loadStats();

    const setupSubscription = async () => {
      await subscribeToStudents(
        () => {
          addToast({ type: "info", title: "New student added" });
          loadStudents(page);
          loadStats();
        },
        () => {
          addToast({ type: "info", title: "Student updated" });
          loadStudents(page);
          loadStats();
        },
        () => {
          addToast({ type: "info", title: "Student deleted" });
          loadStudents(page);
          loadStats();
        }
      );
    };

    setupSubscription();

    return () => {
      unsubscribeFromStudents();
    };
  }, []);

  useEffect(() => {
    loadStudents(1);
  }, [debouncedSearch, classFilter, sectionFilter, statusFilter, sortBy, sortOrder]);

  // Selection Handlers
  const toggleSelectAll = () => {
    if (selectedIds.length === students.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(students.map((s) => s.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const clearSelection = () => setSelectedIds([]);

  // Bulk Operations
  const handleBulkDelete = async () => {
    setIsBulkUpdating(true);
    try {
      const result = await bulkDeleteStudents(selectedIds);
      if (result.success) {
        addToast({ type: "success", title: result.message });
        setSelectedIds([]);
        loadStudents(page);
        loadStats();
      } else {
        addToast({ type: "error", title: result.message });
      }
    } catch (error) {
      addToast({ type: "error", title: "Bulk delete failed" });
    } finally {
      setIsBulkUpdating(false);
      setBulkDeleteDialogOpen(false);
    }
  };

  const handleBulkStatusUpdate = async () => {
    setIsBulkUpdating(true);
    try {
      const result = await bulkUpdateStatus(selectedIds, bulkStatus);
      if (result.success) {
        addToast({ type: "success", title: result.message });
        setSelectedIds([]);
        loadStudents(page);
        loadStats();
      } else {
        addToast({ type: "error", title: result.message });
      }
    } catch (error) {
      addToast({ type: "error", title: "Bulk update failed" });
    } finally {
      setIsBulkUpdating(false);
      setBulkStatusDialogOpen(false);
    }
  };

  // Delete Single
  const handleDeleteSingle = async () => {
    if (!studentToDelete) return;

    try {
      const result = await deleteStudent(studentToDelete);
      if (result.success) {
        addToast({ type: "success", title: "Student deleted successfully" });
        setStudentToDelete(null);
        loadStudents(page);
        loadStats();
      } else {
        addToast({ type: "error", title: result.error || "Delete failed" });
      }
    } catch (error) {
      addToast({ type: "error", title: "Delete failed" });
    }
    setDeleteDialogOpen(false);
  };

  // Export
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const filters: StudentFilters = {
        search: debouncedSearch || undefined,
        class_id: classFilter === "all" ? undefined : classFilter,
        section_id: sectionFilter === "all" ? undefined : sectionFilter,
        status: statusFilter === "all" ? undefined : statusFilter,
      };

      const result = await exportStudentsCSV(filters);
      if (result.success && result.data) {
        const blob = new Blob([result.data], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `students_export_${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        addToast({ type: "success", title: "Export successful" });
      } else {
        addToast({ type: "error", title: result.error || "Export failed" });
      }
    } catch (error) {
      addToast({ type: "error", title: "Export failed" });
    } finally {
      setIsExporting(false);
    }
  };

  // Sorting
  const toggleSort = (column: string) => {
    if (sortBy === column) {
      setValue("sort_order", sortOrder === "asc" ? "desc" : "asc");
    } else {
      setValue("sort_by", column);
      setValue("sort_order", "asc");
    }
  };

  const getSortIcon = (column: string) => {
    if (sortBy !== column) return <ChevronDown className="h-3 w-3 opacity-30" />;
    return sortOrder === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  };

  // Pagination
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    loadStudents(newPage);
  };

  const renderPaginationItems = () => {
    const items = [];
    const maxVisible = 5;
    let startPage = Math.max(1, page - Math.floor(maxVisible / 2));
    const endPage = Math.min(totalPages, startPage + maxVisible - 1);

    if (endPage - startPage + 1 < maxVisible) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    if (startPage > 1) {
      items.push(
        <PaginationItem key="first">
          <PaginationLink onClick={() => handlePageChange(1)} className="text-gray-700 dark:text-gray-300 h-8 w-8 min-w-[32px] justify-center flex items-center">1</PaginationLink>
        </PaginationItem>
      );
      if (startPage > 2) {
        items.push(
          <PaginationItem key="ellipsis-start">
            <PaginationEllipsis />
          </PaginationItem>
        );
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      items.push(
        <PaginationItem key={i}>
          <PaginationLink
            isActive={i === page}
            onClick={() => handlePageChange(i)}
            className={i === page ? "bg-blue-600 text-white hover:bg-blue-700 h-8 w-8 min-w-[32px] justify-center flex items-center" : "text-gray-700 dark:text-gray-300 h-8 w-8 min-w-[32px] justify-center flex items-center"}
          >
            {i}
          </PaginationLink>
        </PaginationItem>
      );
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        items.push(
          <PaginationItem key="ellipsis-end">
            <PaginationEllipsis />
          </PaginationItem>
        );
      }
      items.push(
        <PaginationItem key="last">
          <PaginationLink onClick={() => handlePageChange(totalPages)} className="text-gray-700 dark:text-gray-300 h-8 w-8 min-w-[32px] justify-center flex items-center">
            {totalPages}
          </PaginationLink>
        </PaginationItem>
      );
    }

    return items;
  };

  return (
    <ResponsiveLayout>
      <div className="h-screen flex flex-col bg-white dark:bg-gray-900 overflow-hidden">

        {/* Header - Gradient Background with Horizontal Filters */}
        <div className="flex-shrink-0 p-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 rounded-b-lg shadow-lg">
          <div className="flex flex-col lg:flex-row items-start lg:items-center gap-3">
            {/* Title Section */}
            <div className="flex items-center gap-4 w-full lg:w-auto">
              <div>
                <h1 className="text-xl font-bold text-white">Students</h1>
                <p className="text-xs text-white/80">Manage all students</p>
              </div>
              <div className="flex gap-2 ml-auto lg:ml-0">
                <Button 
                  variant="secondary" 
                  size="sm"
                  onClick={handleExport} 
                  disabled={isExporting} 
                  className="bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 border border-white/30 h-8 px-3"
                >
                  {isExporting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Download className="h-3 w-3 mr-1" />}
                  <span className="hidden sm:inline">Export</span>
                </Button>
                <Button 
                  size="sm"
                  onClick={() => router.push("/students/new")}
                  className="bg-white text-indigo-600 hover:bg-indigo-50 shadow-lg h-8 px-3"
                >
                  <UserPlus className="h-3 w-3 mr-1" />
                  <span className="hidden sm:inline">Add</span>
                </Button>
              </div>
            </div>

            {/* Filters - Horizontal */}
            <div className="w-full lg:flex-1">
              <form onSubmit={handleSubmit(() => loadStudents(1))} className="flex flex-wrap items-center gap-2">
                {/* Search Box */}
                <div className="flex-1 min-w-[150px]">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                    <Input
                      {...register("search")}
                      placeholder="Search name, ID, roll..."
                      className="w-full pl-8 h-8 bg-white/20 backdrop-blur-sm text-white placeholder:text-white/60 border-white/30 focus:border-white/50 focus:ring-white/30 text-sm"
                      autoComplete="off"
                      value={search}
                      onChange={(e) => setValue("search", e.target.value)}
                    />
                  </div>
                </div>

                {/* Class Filter */}
                <div className="w-[120px]">
                  <Select 
                    value={classFilter} 
                    onValueChange={(v) => setValue("class_id", v)}
                  >
                    <SelectTrigger className="w-full h-8 bg-white/20 backdrop-blur-sm text-white border-white/30 focus:ring-white/30 text-sm">
                      <SelectValue placeholder="Class" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                      {CLASS_OPTIONS.map((cls) => (
                        <SelectItem 
                          key={cls.id} 
                          value={cls.id}
                          className="text-gray-900 dark:text-white"
                        >
                          {cls.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Status Filter */}
                <div className="w-[120px]">
                  <Select 
                    value={statusFilter} 
                    onValueChange={(v) => setValue("status", v)}
                  >
                    <SelectTrigger className="w-full h-8 bg-white/20 backdrop-blur-sm text-white border-white/30 focus:ring-white/30 text-sm">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                      {STATUS_OPTIONS.map((status) => (
                        <SelectItem 
                          key={status.id} 
                          value={status.id}
                          className="text-gray-900 dark:text-white"
                        >
                          {status.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button type="submit" size="sm" className="h-8 bg-white/30 hover:bg-white/40 text-white border border-white/30 px-3">
                  <Search className="h-3.5 w-3.5 mr-1" />
                  Search
                </Button>

                <Button type="button" size="sm" variant="outline" onClick={() => {
                  setValue("search", "");
                  setValue("class_id", "all");
                  setValue("section_id", "all");
                  setValue("status", "all");
                  setValue("sort_by", "created_at");
                  setValue("sort_order", "desc");
                  loadStudents(1);
                }} className="h-8 bg-white/20 backdrop-blur-sm text-white border-white/30 hover:bg-white/30 hover:text-white px-3">
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  Reset
                </Button>
              </form>
            </div>
          </div>
        </div>

        {/* Stats Cards - Compact & Mobile 2 Columns */}
        <div className="flex-shrink-0 grid grid-cols-2 sm:grid-cols-5 gap-2 p-3">
          <Card className="bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800">
            <CardContent className="p-2 flex items-center gap-2">
              <div className="bg-blue-500 p-1.5 rounded flex-shrink-0">
                <Users className="h-3.5 w-3.5 text-white" />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900 dark:text-white leading-none">{stats.total}</p>
                <p className="text-[10px] text-gray-600 dark:text-gray-400">Total</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800">
            <CardContent className="p-2 flex items-center gap-2">
              <div className="bg-green-500 p-1.5 rounded flex-shrink-0">
                <UserCheck className="h-3.5 w-3.5 text-white" />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900 dark:text-white leading-none">{stats.active}</p>
                <p className="text-[10px] text-gray-600 dark:text-gray-400">Active</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800">
            <CardContent className="p-2 flex items-center gap-2">
              <div className="bg-red-500 p-1.5 rounded flex-shrink-0">
                <UserX className="h-3.5 w-3.5 text-white" />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900 dark:text-white leading-none">{stats.inactive}</p>
                <p className="text-[10px] text-gray-600 dark:text-gray-400">Inactive</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800">
            <CardContent className="p-2 flex items-center gap-2">
              <div className="bg-orange-500 p-1.5 rounded flex-shrink-0">
                <UserX className="h-3.5 w-3.5 text-white" />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900 dark:text-white leading-none">{stats.transferred}</p>
                <p className="text-[10px] text-gray-600 dark:text-gray-400">Transferred</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800 col-span-2 sm:col-span-1">
            <CardContent className="p-2 flex items-center gap-2">
              <div className="bg-purple-500 p-1.5 rounded flex-shrink-0">
                <Calendar className="h-3.5 w-3.5 text-white" />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900 dark:text-white leading-none">{stats.newThisMonth}</p>
                <p className="text-[10px] text-gray-600 dark:text-gray-400">New This Month</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bulk Actions Bar */}
        {selectedIds.length > 0 && (
          <div className="flex-shrink-0 px-3 pb-2">
            <Card className="border-blue-500 bg-blue-50 dark:bg-blue-900/20">
              <CardContent className="p-2 flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {selectedIds.length} selected
                </span>
                <div className="flex-1" />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setBulkStatusDialogOpen(true)}
                  className="h-7 text-xs border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
                >
                  Update Status
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setBulkDeleteDialogOpen(true)}
                  className="h-7 text-xs"
                >
                  Delete Selected
                </Button>
                <Button size="sm" variant="ghost" onClick={clearSelection} className="h-7 text-xs text-gray-700 dark:text-gray-300">
                  Clear
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Table Container - flex-1 with overflow-hidden */}
        <div className="flex-1 overflow-hidden px-3 pb-3 min-h-0">
          <Card className="h-full bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 flex flex-col">
            <CardContent className="flex-1 p-0 overflow-hidden">
              <div className="h-full overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-700/50">
                    <TableRow>
                      <TableHead className="text-gray-700 dark:text-gray-300 py-2 px-3 text-xs">
                        <Checkbox
                          checked={selectedIds.length === students.length && students.length > 0}
                          onCheckedChange={toggleSelectAll}
                          className="data-[state=checked]:bg-blue-600"
                        />
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:text-blue-600 text-gray-700 dark:text-gray-300 py-2 px-3 text-xs"
                        onClick={() => toggleSort("student_id")}
                      >
                        <div className="flex items-center gap-0.5">
                          ID
                          {getSortIcon("student_id")}
                        </div>
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:text-blue-600 text-gray-700 dark:text-gray-300 py-2 px-3 text-xs"
                        onClick={() => toggleSort("name")}
                      >
                        <div className="flex items-center gap-0.5">
                          Name
                          {getSortIcon("name")}
                        </div>
                      </TableHead>
                      <TableHead className="text-gray-700 dark:text-gray-300 py-2 px-3 text-xs">Father</TableHead>
                      <TableHead className="text-gray-700 dark:text-gray-300 py-2 px-3 text-xs">Class</TableHead>
                      <TableHead className="text-gray-700 dark:text-gray-300 py-2 px-3 text-xs">Section</TableHead>
                      <TableHead
                        className="cursor-pointer hover:text-blue-600 text-gray-700 dark:text-gray-300 py-2 px-3 text-xs"
                        onClick={() => toggleSort("class_roll")}
                      >
                        <div className="flex items-center gap-0.5">
                          Roll
                          {getSortIcon("class_roll")}
                        </div>
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:text-blue-600 text-gray-700 dark:text-gray-300 py-2 px-3 text-xs"
                        onClick={() => toggleSort("status")}
                      >
                        <div className="flex items-center gap-0.5">
                          Status
                          {getSortIcon("status")}
                        </div>
                      </TableHead>
                      <TableHead className="text-right text-gray-700 dark:text-gray-300 py-2 px-3 text-xs">Actions</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8">
                          <Loader2 className="animate-spin mx-auto h-6 w-6 text-gray-600 dark:text-gray-400" />
                        </TableCell>
                      </TableRow>
                    ) : students.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
                          No students found
                        </TableCell>
                      </TableRow>
                    ) : (
                      students.map((s) => (
                        <TableRow key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <TableCell className="py-1.5 px-3">
                            <Checkbox
                              checked={selectedIds.includes(s.id)}
                              onCheckedChange={() => toggleSelect(s.id)}
                              className="data-[state=checked]:bg-blue-600"
                            />
                          </TableCell>
                          <TableCell className="font-mono text-xs text-gray-700 dark:text-gray-300 py-1.5 px-3">
                            {s.student_id || "-"}
                          </TableCell>
                          <TableCell className="font-medium text-gray-900 dark:text-white py-1.5 px-3">
                            <div className="flex items-center gap-1.5">
                              {s.student_photo_url && (
                                <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-600 flex-shrink-0">
                                  <img
                                    src={s.student_photo_url}
                                    alt={s.name}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              )}
                              <span className="text-sm truncate max-w-[100px]">{s.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-gray-700 dark:text-gray-300 py-1.5 px-3 text-sm truncate max-w-[80px]">{s.father_name}</TableCell>
                          <TableCell className="text-gray-700 dark:text-gray-300 py-1.5 px-3 text-sm">{s.class?.name || "-"}</TableCell>
                          <TableCell className="text-gray-700 dark:text-gray-300 py-1.5 px-3 text-sm">{s.section?.name || "-"}</TableCell>
                          <TableCell className="text-gray-700 dark:text-gray-300 py-1.5 px-3 font-mono text-sm">{s.class_roll || "-"}</TableCell>
                          <TableCell className="py-1.5 px-3">
                            <Badge
                              variant="outline"
                              className={`text-xs px-2 py-0 font-medium ${
                                s.status === "active"
                                  ? "bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-800 dark:text-green-200"
                                  : s.status === "inactive"
                                  ? "bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200"
                                  : "bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-800 dark:text-red-200"
                              }`}
                            >
                              {s.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-1.5 px-3 text-right">
                            <div className="flex justify-end gap-0.5">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => router.push(`/students/${s.id}`)}
                                      className="h-7 w-7 text-gray-600 dark:text-gray-400 hover:text-blue-600"
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>View</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>

                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => router.push(`/students/${s.id}/edit`)}
                                      className="h-7 w-7 text-gray-600 dark:text-gray-400 hover:text-blue-600"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Edit</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>

                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => {
                                        setStudentToDelete(s.id);
                                        setDeleteDialogOpen(true);
                                      }}
                                      className="h-7 w-7 text-gray-600 dark:text-gray-400 hover:text-red-600"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Delete</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Fixed Footer Pagination - Fixed Previous & Next Button Layout */}
        <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 z-20">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap shrink-0">
              Showing {total > 0 ? (page - 1) * limit + 1 : 0} - {Math.min(page * limit, total)} of {total}
            </p>
            <Pagination className="w-auto mx-0">
              <PaginationContent className="flex items-center gap-1">
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => page > 1 && handlePageChange(page - 1)}
                    className={`h-8 px-3 w-auto gap-1 text-xs whitespace-nowrap ${
                      page <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                  />
                </PaginationItem>
                {renderPaginationItems()}
                <PaginationItem>
                  <PaginationNext
                    onClick={() => page < totalPages && handlePageChange(page + 1)}
                    className={`h-8 px-3 w-auto gap-1 text-xs whitespace-nowrap ${
                      page >= totalPages || totalPages === 0 ? "pointer-events-none opacity-50" : "cursor-pointer text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </div>
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900 dark:text-white">Are you sure?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600 dark:text-gray-400">
              This will permanently delete this student and all associated data.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSingle} className="bg-red-600 hover:bg-red-700 text-white">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Dialog */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900 dark:text-white">Delete {selectedIds.length} students?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600 dark:text-gray-400">
              This will permanently delete all selected students and their data.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-red-600 hover:bg-red-700 text-white" disabled={isBulkUpdating}>
              {isBulkUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Status Dialog */}
      <AlertDialog open={bulkStatusDialogOpen} onOpenChange={setBulkStatusDialogOpen}>
        <AlertDialogContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900 dark:text-white">Update Status for {selectedIds.length} students</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600 dark:text-gray-400">
              Select the new status for all selected students.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Select value={bulkStatus} onValueChange={setBulkStatus}>
              <SelectTrigger className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700">
                <SelectItem value="active" className="text-gray-900 dark:text-white">Active</SelectItem>
                <SelectItem value="inactive" className="text-gray-900 dark:text-white">Inactive</SelectItem>
                <SelectItem value="transferred" className="text-gray-900 dark:text-white">Transferred</SelectItem>
                <SelectItem value="graduated" className="text-gray-900 dark:text-white">Graduated</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkStatusUpdate} disabled={isBulkUpdating} className="bg-blue-600 hover:bg-blue-700 text-white">
              {isBulkUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Update
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ResponsiveLayout>
  );
}