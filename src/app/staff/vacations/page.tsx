// src/app/staff/vacations/page.tsx
"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Plus,
  CheckCircle,
  XCircle,
  Clock,
  Download,
  Trash2,
  Edit,
  BarChart,
  FileText,
  Printer,
  Settings,
  Eye,
  Users,
  User,
  AlertCircle,
  Filter,
  Search,
  ChevronDown,
  MoreVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { getStaff, getActiveStaff } from "@/lib/api/staff";
import { useToastStore } from "@/store/useStore";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Leave {
  id: string;
  staff_employee_id: string;
  staff_name: string;
  type: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  staff_id?: string;
}

interface LeaveCategory {
  id: string;
  name: string;
  days_per_year: number;
}

interface LeaveBalance {
  staff_employee_id: string;
  staff_name: string;
  category_name: string;
  total_days: number;
  used_days: number;
  remaining_days: number;
}

interface SchoolSettings {
  school_name: string;
  school_address: string;
  school_phone: string;
  school_email: string;
  school_logo: string;
}

function formatDateEnglish(dateString: string): string {
  if (!dateString) return "—";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-CA");
}

function formatDateDisplay(dateString: string): string {
  if (!dateString) return "—";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function calculateLeaveDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

function getStatusBadge(status: string) {
  switch (status) {
    case "approved":
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-0">Approved</Badge>;
    case "rejected":
      return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-0">Rejected</Badge>;
    default:
      return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-0">Pending</Badge>;
  }
}

export default function VacationsPage() {
  const router = useRouter();
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [leaveCategories, setLeaveCategories] = useState<LeaveCategory[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editCategoryDialogOpen, setEditCategoryDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<LeaveCategory | null>(null);
  const [selectedLeave, setSelectedLeave] = useState<Leave | null>(null);
  const [selectedBalanceForDetails, setSelectedBalanceForDetails] = useState<LeaveBalance | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings>({
    school_name: "KinderERP - Kindergarten",
    school_address: "School Address Line 1, City, District",
    school_phone: "",
    school_email: "",
    school_logo: "",
  });
  const [formData, setFormData] = useState({
    staff_employee_id: "",
    type: "",
    start_date: "",
    end_date: "",
    reason: "",
  });
  const [editFormData, setEditFormData] = useState({
    id: "",
    staff_employee_id: "",
    type: "",
    start_date: "",
    end_date: "",
    reason: "",
    status: "",
  });
  const [categoryForm, setCategoryForm] = useState({ name: "", days_per_year: "" });
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterStaff, setFilterStaff] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("requests");
  const addToast = useToastStore((state) => state.addToast);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
    loadSchoolSettings();
  }, []);

  async function loadSchoolSettings() {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('school_settings')
        .select('*')
        .single();

      if (!error && data) {
        setSchoolSettings({
          school_name: data.school_name || "KinderERP - Kindergarten",
          school_address: data.school_address || "School Address Line 1, City, District",
          school_phone: data.school_phone || "",
          school_email: data.school_email || "",
          school_logo: data.school_logo || "",
        });
      }
    } catch (err) {
      console.error("Failed to load school settings:", err);
    }
  }

  // ✅ Expired leaves check ও staff status আপডেট
  async function checkAndUpdateExpiredLeaves() {
    try {
      const supabase = createClient();
      const today = new Date().toISOString().split('T')[0];
      
      const { data: expiredLeaves, error } = await supabase
        .from('leaves')
        .select('staff_id, end_date')
        .eq('status', 'approved')
        .lt('end_date', today);

      if (error) {
        console.error("Error fetching expired leaves:", error);
        return;
      }

      if (expiredLeaves && expiredLeaves.length > 0) {
        const staffIds = [...new Set(expiredLeaves.map(l => l.staff_id))];
        
        for (const staffId of staffIds) {
          await supabase
            .from('staff')
            .update({ 
              status: 'active',
              updated_at: new Date().toISOString()
            })
            .eq('id', staffId)
            .eq('status', 'on_leave');
        }
        
        console.log(`✅ ${staffIds.length} staff status updated to active (leaves expired)`);
      }
    } catch (err) {
      console.error("Failed to check expired leaves:", err);
    }
  }

  async function loadData() {
    setLoading(true);
    try {
      const supabase = createClient();
      
      await checkAndUpdateExpiredLeaves();
      
      const [staffData, leavesData, categoriesData] = await Promise.all([
        getStaff(),
        supabase.from("leaves").select("*").order("created_at", { ascending: false }),
        supabase.from("leave_categories").select("*").order("name"),
      ]);

      setStaff(staffData || []);
      setLeaveCategories(categoriesData.data || []);

      const mappedLeaves = (leavesData.data || []).map((l: any) => {
        const staffMember = staffData?.find((s: any) => s.id === l.staff_id);
        return {
          id: l.id,
          staff_id: l.staff_id,
          staff_employee_id: staffMember?.employee_id || "",
          staff_name: staffMember?.name || "",
          type: l.type,
          start_date: l.start_date,
          end_date: l.end_date,
          reason: l.reason,
          status: l.status,
          created_at: l.created_at,
        };
      });
      setLeaves(mappedLeaves);
      calculateLeaveBalances(mappedLeaves, staffData || [], categoriesData.data || []);

    } catch (err) {
      console.error("Failed to load data:", err);
      addToast({ type: "error", title: "Error", message: "Failed to load leave data" });
    } finally {
      setLoading(false);
    }
  }

  const calculateLeaveBalances = (leavesData: Leave[], staffData: any[], categories: LeaveCategory[]) => {
    const balances: LeaveBalance[] = [];

    for (const staffMember of staffData) {
      if (staffMember.status === 'resigned' || staffMember.status === 'terminated') continue;

      for (const category of categories) {
        const staffLeaves = leavesData.filter(
          (l) => l.staff_employee_id === staffMember.employee_id && l.type === category.name && l.status === "approved"
        );

        const usedDays = staffLeaves.reduce((total, leave) => {
          return total + calculateLeaveDays(leave.start_date, leave.end_date);
        }, 0);

        balances.push({
          staff_employee_id: staffMember.employee_id,
          staff_name: staffMember.name,
          category_name: category.name,
          total_days: category.days_per_year,
          used_days: usedDays,
          remaining_days: category.days_per_year - usedDays,
        });
      }
    }

    setLeaveBalances(balances);
  };

  const activeStaff = useMemo(() => {
    return staff.filter(s => s.status === 'active' || s.status === 'on_leave');
  }, [staff]);

  // ✅ আপডেটেড handleSubmit - একাধিক লিভ এবং ওভারল্যাপিং চেক সহ
  const handleSubmit = async () => {
    if (!formData.staff_employee_id || !formData.type || !formData.start_date) {
      addToast({ type: "error", title: "Error", message: "Please fill all required fields" });
      return;
    }

    const selectedStaff = staff.find(s => s.employee_id === formData.staff_employee_id);
    if (!selectedStaff) {
      addToast({ type: "error", title: "Error", message: "Staff not found" });
      return;
    }

    if (selectedStaff.status === 'resigned' || selectedStaff.status === 'terminated') {
      addToast({ type: "error", title: "Error", message: "Cannot apply leave for resigned/terminated staff!" });
      return;
    }

    const supabase = createClient();
    
    // ✅ চেক করুন: স্টাফের ইতিমধ্যে কোন pending বা approved লিভ আছে কিনা
    const { data: existingLeaves, error: checkError } = await supabase
      .from('leaves')
      .select('id, start_date, end_date, status')
      .eq('staff_id', selectedStaff.id)
      .in('status', ['pending', 'approved']);

    if (checkError) {
      console.error("Error checking existing leaves:", checkError);
      addToast({ type: "error", title: "Error", message: "Failed to check existing leaves" });
      return;
    }

    const newStartDate = new Date(formData.start_date);
    const newEndDate = new Date(formData.end_date || formData.start_date);

    // ✅ ওভারল্যাপিং চেক করুন
    if (existingLeaves && existingLeaves.length > 0) {
      const hasPendingOrApproved = existingLeaves.some(l => l.status === 'pending' || l.status === 'approved');
      
      if (hasPendingOrApproved) {
        const hasOverlap = existingLeaves.some(leave => {
          const existingStart = new Date(leave.start_date);
          const existingEnd = new Date(leave.end_date);
          
          return (
            (newStartDate >= existingStart && newStartDate <= existingEnd) ||
            (newEndDate >= existingStart && newEndDate <= existingEnd) ||
            (newStartDate <= existingStart && newEndDate >= existingEnd)
          );
        });

        if (hasOverlap) {
          addToast({ 
            type: "error", 
            title: "Error", 
            message: "এই সময়ের মধ্যে ইতিমধ্যে একটি লিভ আবেদন রয়েছে! তারিখগুলি ওভারল্যাপ করছে।" 
          });
          return;
        }
        
        const hasPending = existingLeaves.some(l => l.status === 'pending');
        if (hasPending) {
          addToast({ 
            type: "error", 
            title: "Error", 
            message: "আপনার একটি পেন্ডিং লিভ আবেদন রয়েছে! এটি অনুমোদিত হওয়ার পর নতুন আবেদন করতে পারবেন।" 
          });
          return;
        }
      }
    }

    // ✅ লিভ ব্যালেন্স চেক
    const balance = leaveBalances.find(b =>
      b.staff_employee_id === selectedStaff.employee_id &&
      b.category_name === formData.type
    );

    const requestedDays = calculateLeaveDays(formData.start_date, formData.end_date || formData.start_date);

    if (balance && balance.remaining_days < requestedDays) {
      addToast({
        type: "error",
        title: "Error",
        message: `Insufficient leave balance! Available: ${balance.remaining_days} days, Requested: ${requestedDays} days`
      });
      return;
    }

    try {
      const { error } = await supabase.from("leaves").insert({
        staff_id: selectedStaff.id,
        type: formData.type,
        start_date: formData.start_date,
        end_date: formData.end_date || formData.start_date,
        reason: formData.reason,
        status: "pending",
      });

      if (error) throw error;
      addToast({ type: "success", title: "Success", message: "Leave request submitted successfully" });
      setDialogOpen(false);
      setFormData({ staff_employee_id: "", type: "", start_date: "", end_date: "", reason: "" });
      loadData();
    } catch (err) {
      console.error("Failed to submit leave:", err);
      addToast({ type: "error", title: "Error", message: "Failed to submit leave request" });
    }
  };

  const handleEditLeave = (leave: Leave) => {
    setEditFormData({
      id: leave.id,
      staff_employee_id: leave.staff_employee_id,
      type: leave.type,
      start_date: leave.start_date,
      end_date: leave.end_date,
      reason: leave.reason,
      status: leave.status,
    });
    setEditDialogOpen(true);
  };

  const handleUpdateLeave = async () => {
    if (!editFormData.start_date) {
      addToast({ type: "error", title: "Error", message: "Please fill required fields" });
      return;
    }

    try {
      const selectedStaff = staff.find(s => s.employee_id === editFormData.staff_employee_id);
      if (!selectedStaff) {
        addToast({ type: "error", title: "Error", message: "Staff not found" });
        return;
      }

      if (selectedStaff.status === 'resigned' || selectedStaff.status === 'terminated') {
        addToast({ type: "error", title: "Error", message: "Cannot update leave for resigned/terminated staff!" });
        return;
      }

      const supabase = createClient();
      
      const { error } = await supabase
        .from("leaves")
        .update({
          type: editFormData.type,
          start_date: editFormData.start_date,
          end_date: editFormData.end_date || editFormData.start_date,
          reason: editFormData.reason,
          status: editFormData.status,
        })
        .eq("id", editFormData.id);

      if (error) throw error;
      
      if (editFormData.status === 'approved') {
        await supabase
          .from('staff')
          .update({ status: 'on_leave' })
          .eq('id', selectedStaff.id);
      } else if (editFormData.status === 'rejected' || editFormData.status === 'pending') {
        await supabase
          .from('staff')
          .update({ status: 'active' })
          .eq('id', selectedStaff.id)
          .eq('status', 'on_leave');
      }
      
      addToast({ type: "success", title: "Success", message: "Leave request updated successfully" });
      setEditDialogOpen(false);
      loadData();
    } catch (err) {
      console.error("Failed to update leave:", err);
      addToast({ type: "error", title: "Error", message: "Failed to update leave request" });
    }
  };

  const handleDeleteLeave = async (leaveId: string) => {
    if (!confirm("Are you sure you want to delete this leave request?")) return;

    try {
      const supabase = createClient();
      
      const { data: leave } = await supabase
        .from('leaves')
        .select('staff_id, status')
        .eq('id', leaveId)
        .single();

      const { error } = await supabase.from("leaves").delete().eq("id", leaveId);
      if (error) throw error;
      
      if (leave?.status === 'approved') {
        await supabase
          .from('staff')
          .update({ status: 'active' })
          .eq('id', leave.staff_id)
          .eq('status', 'on_leave');
      }
      
      addToast({ type: "success", title: "Success", message: "Leave request deleted successfully" });
      loadData();
    } catch (err) {
      console.error("Failed to delete leave:", err);
      addToast({ type: "error", title: "Error", message: "Failed to delete leave request" });
    }
  };

  const handleViewLeave = (leave: Leave) => {
    setSelectedLeave(leave);
    setViewDialogOpen(true);
  };

  const handleViewBalanceDetails = (balance: LeaveBalance) => {
    setSelectedBalanceForDetails(balance);
    setDetailsDialogOpen(true);
  };

  const handleCategorySubmit = async () => {
    if (!categoryForm.name || !categoryForm.days_per_year) {
      addToast({ type: "error", title: "Error", message: "Please fill all fields" });
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase.from("leave_categories").insert({
        name: categoryForm.name,
        days_per_year: parseInt(categoryForm.days_per_year),
      });

      if (error) throw error;
      addToast({ type: "success", title: "Success", message: "Leave category added successfully" });
      setCategoryDialogOpen(false);
      setCategoryForm({ name: "", days_per_year: "" });
      loadData();
    } catch (err) {
      console.error("Failed to add category:", err);
      addToast({ type: "error", title: "Error", message: "Failed to add leave category" });
    }
  };

  const handleUpdateCategory = async () => {
    if (!selectedCategory || !categoryForm.name || !categoryForm.days_per_year) {
      addToast({ type: "error", title: "Error", message: "Please fill all fields" });
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("leave_categories")
        .update({
          name: categoryForm.name,
          days_per_year: parseInt(categoryForm.days_per_year),
        })
        .eq("id", selectedCategory.id);

      if (error) throw error;
      addToast({ type: "success", title: "Success", message: "Leave category updated successfully" });
      setEditCategoryDialogOpen(false);
      setSelectedCategory(null);
      setCategoryForm({ name: "", days_per_year: "" });
      loadData();
    } catch (err) {
      console.error("Failed to update category:", err);
      addToast({ type: "error", title: "Error", message: "Failed to update leave category" });
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Are you sure you want to delete this category?")) return;

    try {
      const supabase = createClient();
      const { error } = await supabase.from("leave_categories").delete().eq("id", id);
      if (error) throw error;
      addToast({ type: "success", title: "Success", message: "Leave category deleted successfully" });
      loadData();
    } catch (err) {
      console.error("Failed to delete category:", err);
      addToast({ type: "error", title: "Error", message: "Failed to delete leave category" });
    }
  };

  // ✅ আপডেটেড handleStatusUpdate - staff status auto-update সহ
  const handleStatusUpdate = async (leaveId: string, status: "approved" | "rejected") => {
    try {
      const supabase = createClient();

      const { data: leave, error: leaveError } = await supabase
        .from('leaves')
        .select('*')
        .eq('id', leaveId)
        .single();

      if (leaveError) {
        console.error("Error fetching leave:", leaveError);
        addToast({ type: "error", title: "Error", message: "লিভের ডেটা পাওয়া যায়নি!" });
        return;
      }

      if (!leave) {
        addToast({ type: "error", title: "Error", message: "লিভ খুঁজে পাওয়া যায়নি!" });
        return;
      }

      const { data: staffMember, error: staffError } = await supabase
        .from('staff')
        .select('status')
        .eq('id', leave.staff_id)
        .single();

      if (staffError) {
        console.error("Error fetching staff:", staffError);
        addToast({ type: "error", title: "Error", message: "স্টাফের ডেটা পাওয়া যায়নি!" });
        return;
      }

      if (staffMember?.status === 'resigned' || staffMember?.status === 'terminated') {
        addToast({ type: "error", title: "Error", message: "রিজাইন বা টারমিনেটেড স্টাফের লিভ আপডেট করা যায় না!" });
        return;
      }

      const updateData: any = {
        status: status,
      };

      if (status === 'approved') {
        updateData.approved_at = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from("leaves")
        .update(updateData)
        .eq("id", leaveId);

      if (updateError) {
        console.error("Error updating leave:", updateError);
        addToast({ 
          type: "error", 
          title: "Error", 
          message: `লিভ আপডেট করতে ব্যর্থ: ${updateError.message}` 
        });
        return;
      }

      if (status === 'approved') {
        const { error: staffUpdateError } = await supabase
          .from('staff')
          .update({ status: 'on_leave' })
          .eq('id', leave.staff_id);

        if (staffUpdateError) {
          console.error("Error updating staff status:", staffUpdateError);
        }
      } else if (status === 'rejected') {
        const { error: staffUpdateError } = await supabase
          .from('staff')
          .update({ status: 'active' })
          .eq('id', leave.staff_id)
          .eq('status', 'on_leave');

        if (staffUpdateError) {
          console.error("Error updating staff status:", staffUpdateError);
        }
      }

      addToast({
        type: "success",
        title: "সফল!",
        message: `লিভ ${status === 'approved' ? 'অ্যাপ্রুভ' : 'রিজেক্ট'} করা হয়েছে এবং স্টাফের স্ট্যাটাস আপডেট করা হয়েছে`
      });
      
      await loadData();
      
    } catch (err) {
      console.error("Failed to update status:", err);
      addToast({ 
        type: "error", 
        title: "Error", 
        message: err instanceof Error ? err.message : "লিভ আপডেট করতে ব্যর্থ হয়েছে" 
      });
    }
  };

  const handleExport = () => {
    const headers = ["Employee ID", "Staff", "Leave Type", "Start Date", "End Date", "Days", "Status", "Reason"];
    const csvData = filteredLeaves.map(l => {
      const days = calculateLeaveDays(l.start_date, l.end_date);
      return [l.staff_employee_id, l.staff_name, l.type, l.start_date, l.end_date, days.toString(), l.status, l.reason];
    });
    const csvContent = [headers, ...csvData].map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leave_report_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    addToast({ type: "success", title: "Export Started", message: "Leave report exported successfully" });
  };

  const handlePrint = () => {
    window.print();
  };

  const filteredLeaves = leaves.filter(leave => {
    if (filterStatus !== "all" && leave.status !== filterStatus) return false;
    if (filterStaff !== "all" && leave.staff_employee_id !== filterStaff) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        leave.staff_name.toLowerCase().includes(term) ||
        leave.staff_employee_id.toLowerCase().includes(term) ||
        leave.type.toLowerCase().includes(term)
      );
    }
    return true;
  });

  const stats = {
    total: leaves.length,
    pending: leaves.filter(l => l.status === "pending").length,
    approved: leaves.filter(l => l.status === "approved").length,
    rejected: leaves.filter(l => l.status === "rejected").length,
  };

  const uniqueEmployeeIds = [...new Set(leaves.map(l => l.staff_employee_id))];

  const statsCards = [
    {
      key: 'total',
      label: 'Total Requests',
      value: stats.total,
      icon: FileText,
      bgGradient: 'from-indigo-500 to-purple-600',
      shadowColor: 'shadow-indigo-500/30',
      iconBg: 'bg-white/20',
      textColor: 'text-white',
      labelColor: 'text-indigo-100'
    },
    {
      key: 'pending',
      label: 'Pending',
      value: stats.pending,
      icon: Clock,
      bgGradient: 'from-amber-500 to-yellow-600',
      shadowColor: 'shadow-amber-500/30',
      iconBg: 'bg-white/20',
      textColor: 'text-white',
      labelColor: 'text-amber-100'
    },
    {
      key: 'approved',
      label: 'Approved',
      value: stats.approved,
      icon: CheckCircle,
      bgGradient: 'from-emerald-500 to-teal-600',
      shadowColor: 'shadow-emerald-500/30',
      iconBg: 'bg-white/20',
      textColor: 'text-white',
      labelColor: 'text-emerald-100'
    },
    {
      key: 'rejected',
      label: 'Rejected',
      value: stats.rejected,
      icon: XCircle,
      bgGradient: 'from-rose-500 to-red-600',
      shadowColor: 'shadow-rose-500/30',
      iconBg: 'bg-white/20',
      textColor: 'text-white',
      labelColor: 'text-rose-100'
    },
  ];

  return (
    <ResponsiveLayout>
      <div className="space-y-6 print:space-y-2 px-3 sm:px-4">
        {/* Print Content */}
        <div ref={printRef} className="hidden print:block">
          <style>
            {`
              @media print {
                * {
                  color-adjust: exact !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                  box-sizing: border-box !important;
                }
                html, body {
                  margin: 0 !important;
                  padding: 0 !important;
                  background: white !important;
                }
                .print-content, .print-content * {
                  visibility: visible !important;
                  color: #1f2937 !important;
                }
                .print-content {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
                  background: white !important;
                  padding: 10mm 12mm !important;
                  box-sizing: border-box !important;
                }
                body * {
                  visibility: hidden;
                }
@page {
                   size: A4 portrait;
                   margin: 8mm 10mm;
                 }
                 .print-content .print-table {
                  width: 100%;
                  border-collapse: collapse;
                  font-size: 10px;
                  font-family: Arial, sans-serif;
                }
                .print-content .print-table th {
                  background: linear-gradient(135deg, #4f46e5, #7c3aed) !important;
                  color: white !important;
                  font-weight: 700;
                  padding: 6px 8px;
                  border: 1px solid #d1d5db;
                  text-align: left;
                  font-size: 9px;
                  text-transform: uppercase;
                }
                .print-content .print-table td {
                  padding: 5px 8px;
                  border: 1px solid #d1d5db;
                  color: #1f2937 !important;
                  font-size: 9px;
                }
                .print-content .print-table tr:nth-child(even) td {
                  background-color: #f9fafb !important;
                }
                .print-content .print-footer {
                  text-align: center;
                  border-top: 1px solid #d1d5db;
                  padding-top: 6px;
                  margin-top: 12px;
                  font-size: 9px;
                  color: #6b7280 !important;
                }
                .print-content .status-badge {
                  display: inline-block;
                  padding: 2px 10px;
                  border-radius: 12px;
                  font-size: 9px;
                  font-weight: 500;
                }
                .print-content .status-approved { background: #dcfce7 !important; color: #166534 !important; }
                .print-content .status-pending { background: #fef3c7 !important; color: #92400e !important; }
                .print-content .status-rejected { background: #fee2e2 !important; color: #991b1b !important; }
              }
            `}
          </style>

<div className="print-content">
             <div style={{ display: 'flex', alignItems: 'center', gap: '20px', borderBottom: '2px solid #1f2937', paddingBottom: '10px', marginBottom: '15px' }}>
               <div style={{ flexShrink: 0 }}>
                 {schoolSettings.school_logo ? (
                   <img src={schoolSettings.school_logo} alt="School Logo" style={{ maxHeight: '50px', maxWidth: '70px', objectFit: 'contain' }} />
                 ) : (
                   <div style={{ width: '50px', height: '50px', backgroundColor: '#f3f4f6', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#9ca3af' }}>
                     Logo
                   </div>
                 )}
               </div>
               <div style={{ flex: 1, textAlign: 'center' }}>
                 <h1 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937', margin: 0 }}>{schoolSettings.school_name}</h1>
                 <p style={{ fontSize: '11px', color: '#4b5563', margin: '2px 0' }} className="address">{schoolSettings.school_address}</p>
                 <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', fontSize: '11px', color: '#4b5563', margin: '2px 0' }} className="contact-row">
                   <span>Phone: {schoolSettings.school_phone || '01923253454'}</span>
                   <span>Email: {schoolSettings.school_email || 'shapla.kindergarten@gmail.com'}</span>
                 </div>
                 <div style={{ fontSize: '14px', fontWeight: 'bold', marginTop: '6px', color: '#1f2937' }} className="report-title">Leave Management Report</div>
               </div>
             </div>

            <table className="print-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'center', width: '30px' }}>SL</th>
                  <th style={{ width: '80px' }}>Employee ID</th>
                  <th style={{ width: '100px' }}>Staff Name</th>
                  <th style={{ width: '80px' }}>Leave Type</th>
                  <th style={{ width: '70px' }}>Start Date</th>
                  <th style={{ width: '70px' }}>End Date</th>
                  <th style={{ width: '40px', textAlign: 'center' }}>Days</th>
                  <th style={{ width: '80px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeaves.map((leave, index) => {
                  const days = calculateLeaveDays(leave.start_date, leave.end_date);
                  return (
                    <tr key={leave.id}>
                      <td style={{ textAlign: 'center' }}>{index + 1}</td>
                      <td>{leave.staff_employee_id}</td>
                      <td>{leave.staff_name}</td>
                      <td>{leave.type}</td>
                      <td>{formatDateEnglish(leave.start_date)}</td>
                      <td>{formatDateEnglish(leave.end_date)}</td>
                      <td style={{ textAlign: 'center' }}>{days}</td>
                      <td>
                        <span className={`status-badge status-${leave.status}`}>
                          {leave.status === 'approved' ? 'Approved' :
                            leave.status === 'pending' ? 'Pending' : 'Rejected'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="print-footer">
              <p>Generated from {schoolSettings.school_name} | Page 1 of 1</p>
              <p style={{ fontSize: '8px', color: '#9ca3af !important', marginTop: '2px' }}>
                This is a system-generated report. For any discrepancies, please contact the administration.
              </p>
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 sm:p-6 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 shadow-lg">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="hover:bg-white/20 text-white transition-all rounded-xl">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-white drop-shadow-md">Leave Management</h1>
              <p className="text-white/80">Manage staff leaves, vacations, and balances</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button variant="outline" onClick={handlePrint} className="bg-white/20 text-white border-white/30 hover:bg-white/30 hover:text-white transition-all rounded-xl">
              <Printer className="h-4 w-4 mr-2" /> Print
            </Button>
            <Button variant="outline" onClick={handleExport} className="bg-white/20 text-white border-white/30 hover:bg-white/30 hover:text-white transition-all rounded-xl">
              <Download className="h-4 w-4 mr-2" /> Export
            </Button>
            <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="bg-white/20 text-white border-white/30 hover:bg-white/30 hover:text-white transition-all rounded-xl">
                  <Plus className="h-4 w-4 mr-2" /> Setup Category
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-2xl max-w-lg dark:bg-gray-900 dark:border-gray-700 bg-white">
                <DialogHeader><DialogTitle className="dark:text-gray-100">Add Leave Category</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div><Label className="dark:text-gray-300">Category Name</Label><Input placeholder="e.g., Sick Leave" value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} className="rounded-xl dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 bg-white" /></div>
                  <div><Label className="dark:text-gray-300">Days per Year</Label><Input type="number" placeholder="e.g., 10" value={categoryForm.days_per_year} onChange={(e) => setCategoryForm({ ...categoryForm, days_per_year: e.target.value })} className="rounded-xl dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 bg-white" /></div>
                  <Button onClick={handleCategorySubmit} className="rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:shadow-lg transition-all w-full text-white">Add Category</Button>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 hover:shadow-lg transition-all text-white">
                  <Plus className="h-4 w-4 mr-2" /> Request Leave
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-2xl max-w-lg dark:bg-gray-900 dark:border-gray-700 bg-white">
                <DialogHeader><DialogTitle className="dark:text-gray-100">New Leave Request</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label className="dark:text-gray-300">Staff Member (Employee ID) *</Label>
                    <Select onValueChange={(v) => setFormData({ ...formData, staff_employee_id: v })}>
                      <SelectTrigger className="rounded-xl dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 bg-white">
                        <SelectValue placeholder="Select staff" />
                      </SelectTrigger>
                      <SelectContent className="dark:bg-gray-800 dark:border-gray-700 bg-white">
                        {activeStaff.map((s) => (
                          <SelectItem key={s.id} value={s.employee_id} className="dark:text-gray-200 dark:hover:bg-gray-700">
                            {s.employee_id} - {s.name} ({s.designation})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Only active and on-leave staff can request leave
                    </p>
                  </div>
                  <div>
                    <Label className="dark:text-gray-300">Leave Type *</Label>
                    <Select onValueChange={(v) => setFormData({ ...formData, type: v })}>
                      <SelectTrigger className="rounded-xl dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 bg-white">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent className="dark:bg-gray-800 dark:border-gray-700 bg-white">
                        {leaveCategories.map((c) => (
                          <SelectItem key={c.id} value={c.name} className="dark:text-gray-200 dark:hover:bg-gray-700">
                            {c.name} ({c.days_per_year} days)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="dark:text-gray-300">Start Date</Label>
                      <Input
                        type="date"
                        value={formData.start_date}
                        onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                        className="rounded-xl dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 bg-white"
                      />
                    </div>
                    <div>
                      <Label className="dark:text-gray-300">End Date</Label>
                      <Input
                        type="date"
                        value={formData.end_date}
                        onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                        className="rounded-xl dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 bg-white"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="dark:text-gray-300">Reason</Label>
                    <Input
                      placeholder="Reason for leave"
                      value={formData.reason}
                      onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                      className="rounded-xl dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder:text-gray-400 bg-white"
                    />
                  </div>
                  {formData.staff_employee_id && formData.type && formData.start_date && (
                    <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-xl text-sm">
                      <p className="text-gray-600 dark:text-gray-400">
                        Requesting: <span className="font-semibold">{calculateLeaveDays(formData.start_date, formData.end_date || formData.start_date)} days</span>
                      </p>
                      {(() => {
                        const balance = leaveBalances.find(b =>
                          b.staff_employee_id === formData.staff_employee_id &&
                          b.category_name === formData.type
                        );
                        return balance ? (
                          <p className="text-gray-600 dark:text-gray-400">
                            Available: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{balance.remaining_days} days</span>
                          </p>
                        ) : null;
                      })()}
                    </div>
                  )}
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800">Cancel</Button>
                    <Button onClick={handleSubmit} className="rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:shadow-lg transition-all text-white">Submit Request</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:hidden">
          {statsCards.map((card) => {
            const Icon = card.icon;
            return (
              <Card
                key={card.key}
                className={`border-0 shadow-xl bg-gradient-to-br ${card.bgGradient} ${card.shadowColor} hover:shadow-2xl transition-all duration-300 hover:scale-105 hover:-translate-y-1 overflow-hidden relative`}
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-12 -mb-12"></div>

                <CardContent className="p-4 relative z-10">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${card.iconBg} backdrop-blur-sm shadow-lg`}>
                      <Icon className={`h-5 w-5 ${card.textColor}`} />
                    </div>
                    <div>
                      <p className={`text-2xl font-bold ${card.textColor}`}>
                        {card.value}
                      </p>
                      <p className={`text-sm ${card.labelColor} font-medium`}>{card.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-gray-100 dark:bg-gray-800/50 p-1 rounded-xl overflow-x-auto flex flex-nowrap">
            <TabsTrigger value="requests" className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all dark:text-gray-300 dark:data-[state=active]:text-white whitespace-nowrap">
              <FileText className="h-4 w-4 mr-2" /> Leave Requests
            </TabsTrigger>
            <TabsTrigger value="register" className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all dark:text-gray-300 dark:data-[state=active]:text-white whitespace-nowrap">
              <Calendar className="h-4 w-4 mr-2" /> Leave Register
            </TabsTrigger>
            <TabsTrigger value="balances" className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all dark:text-gray-300 dark:data-[state=active]:text-white whitespace-nowrap">
              <BarChart className="h-4 w-4 mr-2" /> Leave Balances
            </TabsTrigger>
            <TabsTrigger value="categories" className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all dark:text-gray-300 dark:data-[state=active]:text-white whitespace-nowrap">
              <Settings className="h-4 w-4 mr-2" /> Categories
            </TabsTrigger>
          </TabsList>

          {/* Leave Requests Tab */}
          <TabsContent value="requests">
            <Card className="border-0 shadow-xl rounded-2xl overflow-hidden dark:bg-gray-800/60 dark:backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-indigo-500 to-purple-500 dark:from-indigo-600 dark:to-purple-600">
                {/* ✅ ফিল্টার বাদ - শুধু টাইটেল */}
                <div>
                  <CardTitle className="text-white text-base sm:text-lg">Leave Requests</CardTitle>
                  <CardDescription className="text-indigo-100 text-xs sm:text-sm">Manage all leave requests from staff members</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 dark:bg-gray-800/30">
                {loading ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading...</div>
                ) : filteredLeaves.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                    <p>No leave requests found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="dark:border-gray-700 bg-gradient-to-r from-indigo-100 to-purple-100 dark:from-indigo-900/50 dark:to-purple-900/50">
                          <TableHead className="dark:text-gray-100 font-semibold text-indigo-800 dark:text-indigo-200">Employee ID</TableHead>
                          <TableHead className="dark:text-gray-100 font-semibold text-indigo-800 dark:text-indigo-200">Staff</TableHead>
                          <TableHead className="dark:text-gray-100 font-semibold text-indigo-800 dark:text-indigo-200">Type</TableHead>
                          <TableHead className="dark:text-gray-100 font-semibold text-indigo-800 dark:text-indigo-200">Start Date</TableHead>
                          <TableHead className="dark:text-gray-100 font-semibold text-indigo-800 dark:text-indigo-200">End Date</TableHead>
                          <TableHead className="dark:text-gray-100 font-semibold text-indigo-800 dark:text-indigo-200">Days</TableHead>
                          <TableHead className="dark:text-gray-100 font-semibold text-indigo-800 dark:text-indigo-200">Status</TableHead>
                          <TableHead className="text-center dark:text-gray-100 font-semibold text-indigo-800 dark:text-indigo-200" style={{ minWidth: '180px' }}>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredLeaves.map((leave) => {
                          const days = calculateLeaveDays(leave.start_date, leave.end_date);
                          return (
                            <TableRow key={leave.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:border-gray-700">
                              <TableCell className="font-mono text-xs dark:text-gray-400">{leave.staff_employee_id}</TableCell>
                              <TableCell className="font-medium dark:text-gray-200">{leave.staff_name}</TableCell>
                              <TableCell className="capitalize dark:text-gray-300">{leave.type}</TableCell>
                              <TableCell className="dark:text-gray-300">{formatDateDisplay(leave.start_date)}</TableCell>
                              <TableCell className="dark:text-gray-300">{leave.end_date ? formatDateDisplay(leave.end_date) : "-"}</TableCell>
                              <TableCell className="dark:text-gray-300">{days} day(s)</TableCell>
                              <TableCell>{getStatusBadge(leave.status)}</TableCell>
                              <TableCell>
                                <div className="flex items-center justify-start gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleViewLeave(leave)}
                                    className="text-blue-500 hover:text-blue-700 dark:hover:bg-gray-700 h-8 w-8"
                                    title="View Details"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  {leave.status !== 'rejected' && leave.status !== 'approved' && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleEditLeave(leave)}
                                      className="text-amber-500 hover:text-amber-700 dark:hover:bg-gray-700 h-8 w-8"
                                      title="Edit"
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  )}
                                  {leave.status === "pending" && (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleStatusUpdate(leave.id, "approved")}
                                        className="text-green-500 hover:text-green-700 dark:hover:bg-gray-700 h-8 w-8"
                                        title="Approve"
                                      >
                                        <CheckCircle className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleStatusUpdate(leave.id, "rejected")}
                                        className="text-red-500 hover:text-red-700 dark:hover:bg-gray-700 h-8 w-8"
                                        title="Reject"
                                      >
                                        <XCircle className="h-4 w-4" />
                                      </Button>
                                    </>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteLeave(leave.id)}
                                    className="text-red-500 hover:text-red-700 dark:hover:bg-gray-700 h-8 w-8"
                                    title="Delete"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Leave Register Tab - No Changes */}
          <TabsContent value="register">
            <Card className="border-0 shadow-xl rounded-2xl overflow-hidden dark:bg-gray-800/60 dark:backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-emerald-500 to-teal-500 dark:from-emerald-600 dark:to-teal-600">
                <div>
                  <CardTitle className="text-white">Leave Register</CardTitle>
                  <CardDescription className="text-emerald-100">Complete leave history of all staff</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 dark:bg-gray-800/30">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="dark:border-gray-700 bg-gradient-to-r from-emerald-100 to-teal-100 dark:from-emerald-900/50 dark:to-teal-900/50">
                        <TableHead className="dark:text-gray-100 font-semibold text-emerald-800 dark:text-emerald-200">Employee ID</TableHead>
                        <TableHead className="dark:text-gray-100 font-semibold text-emerald-800 dark:text-emerald-200">Staff</TableHead>
                        <TableHead className="dark:text-gray-100 font-semibold text-emerald-800 dark:text-emerald-200">Leave Type</TableHead>
                        <TableHead className="dark:text-gray-100 font-semibold text-emerald-800 dark:text-emerald-200">From</TableHead>
                        <TableHead className="dark:text-gray-100 font-semibold text-emerald-800 dark:text-emerald-200">To</TableHead>
                        <TableHead className="dark:text-gray-100 font-semibold text-emerald-800 dark:text-emerald-200">Days</TableHead>
                        <TableHead className="dark:text-gray-100 font-semibold text-emerald-800 dark:text-emerald-200">Reason</TableHead>
                        <TableHead className="dark:text-gray-100 font-semibold text-emerald-800 dark:text-emerald-200">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaves.map((leave) => {
                        const days = calculateLeaveDays(leave.start_date, leave.end_date);
                        return (
                          <TableRow key={leave.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:border-gray-700">
                            <TableCell className="font-mono text-xs dark:text-gray-400">{leave.staff_employee_id}</TableCell>
                            <TableCell className="font-medium dark:text-gray-200">{leave.staff_name}</TableCell>
                            <TableCell className="capitalize dark:text-gray-300">{leave.type}</TableCell>
                            <TableCell className="dark:text-gray-300">{formatDateDisplay(leave.start_date)}</TableCell>
                            <TableCell className="dark:text-gray-300">{formatDateDisplay(leave.end_date)}</TableCell>
                            <TableCell className="dark:text-gray-300">{days} day(s)</TableCell>
                            <TableCell className="max-w-xs truncate dark:text-gray-400">{leave.reason || "-"}</TableCell>
                            <TableCell>{getStatusBadge(leave.status)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Leave Balances Tab - No Changes */}
          <TabsContent value="balances">
            <Card className="border-0 shadow-xl rounded-2xl overflow-hidden dark:bg-gray-800/60 dark:backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-blue-500 to-cyan-500 dark:from-blue-600 dark:to-cyan-600">
                <CardTitle className="text-white">Leave Balances</CardTitle>
                <CardDescription className="text-blue-100">Staff-wise leave balance summary</CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 dark:bg-gray-800/30">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="dark:border-gray-700 bg-gradient-to-r from-blue-100 to-cyan-100 dark:from-blue-900/50 dark:to-cyan-900/50">
                        <TableHead className="dark:text-gray-100 font-semibold text-blue-800 dark:text-blue-200">Employee ID</TableHead>
                        <TableHead className="dark:text-gray-100 font-semibold text-blue-800 dark:text-blue-200">Staff Name</TableHead>
                        <TableHead className="dark:text-gray-100 font-semibold text-blue-800 dark:text-blue-200">Leave Type</TableHead>
                        <TableHead className="text-right dark:text-gray-100 font-semibold text-blue-800 dark:text-blue-200">Total Days</TableHead>
                        <TableHead className="text-right dark:text-gray-100 font-semibold text-blue-800 dark:text-blue-200">Used Days</TableHead>
                        <TableHead className="text-right dark:text-gray-100 font-semibold text-blue-800 dark:text-blue-200">Remaining</TableHead>
                        <TableHead className="dark:text-gray-100 font-semibold text-blue-800 dark:text-blue-200">Status</TableHead>
                        <TableHead className="text-center dark:text-gray-100 font-semibold text-blue-800 dark:text-blue-200">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaveBalances.map((balance, idx) => {
                        return (
                          <TableRow key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:border-gray-700">
                            <TableCell className="font-mono text-xs dark:text-gray-400">{balance.staff_employee_id}</TableCell>
                            <TableCell className="font-medium dark:text-gray-200">{balance.staff_name}</TableCell>
                            <TableCell className="dark:text-gray-300">{balance.category_name}</TableCell>
                            <TableCell className="text-right dark:text-gray-300">{balance.total_days}</TableCell>
                            <TableCell className="text-right dark:text-gray-300">{balance.used_days}</TableCell>
                            <TableCell className="text-right font-semibold">
                              <span className={balance.remaining_days < 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}>
                                {balance.remaining_days}
                              </span>
                            </TableCell>
                            <TableCell>
                              {balance.remaining_days <= 0 ? (
                                <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-0">Exhausted</Badge>
                              ) : balance.remaining_days <= 5 ? (
                                <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-0">Low Balance</Badge>
                              ) : (
                                <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-0">Available</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewBalanceDetails(balance)}
                                className="text-indigo-500 hover:text-indigo-700 dark:hover:bg-gray-700"
                              >
                                <Eye className="h-4 w-4 mr-1" /> View Details
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Categories Tab - No Changes */}
          <TabsContent value="categories">
            <Card className="border-0 shadow-xl rounded-2xl overflow-hidden dark:bg-gray-800/60 dark:backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-purple-500 to-pink-500 dark:from-purple-600 dark:to-pink-600">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <CardTitle className="text-white">Leave Categories</CardTitle>
                    <CardDescription className="text-purple-100">Setup leave types and allocated days</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    className="bg-white/20 text-white border-white/30 hover:bg-white/30 hover:text-white transition-all rounded-xl"
                    onClick={() => setCategoryDialogOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" /> Add Category
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 dark:bg-gray-800/30">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="dark:border-gray-700 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/50 dark:to-pink-900/50">
                        <TableHead className="dark:text-gray-100 font-semibold text-purple-800 dark:text-purple-200">Category Name</TableHead>
                        <TableHead className="text-right dark:text-gray-100 font-semibold text-purple-800 dark:text-purple-200">Days per Year</TableHead>
                        <TableHead className="text-center dark:text-gray-100 font-semibold text-purple-800 dark:text-purple-200">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaveCategories.map((cat) => (
                        <TableRow key={cat.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:border-gray-700">
                          <TableCell className="font-medium dark:text-gray-200">{cat.name}</TableCell>
                          <TableCell className="text-right dark:text-gray-300">{cat.days_per_year}</TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSelectedCategory(cat);
                                  setCategoryForm({ name: cat.name, days_per_year: cat.days_per_year.toString() });
                                  setEditCategoryDialogOpen(true);
                                }}
                                className="text-blue-500 dark:hover:bg-gray-700 h-8 w-8"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDeleteCategory(cat.id)} className="text-red-500 dark:hover:bg-gray-700 h-8 w-8">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Leave Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="rounded-2xl max-w-lg dark:bg-gray-900 dark:border-gray-700 bg-white">
          <DialogHeader><DialogTitle className="dark:text-gray-100">Edit Leave Request</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="dark:text-gray-300">Staff Member</Label>
              <Select value={editFormData.staff_employee_id} onValueChange={(v) => setEditFormData({ ...editFormData, staff_employee_id: v })}>
                <SelectTrigger className="rounded-xl dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 bg-white">
                  <SelectValue placeholder="Select staff" />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-800 dark:border-gray-700 bg-white">
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={s.employee_id} className="dark:text-gray-200 dark:hover:bg-gray-700">
                      {s.employee_id} - {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="dark:text-gray-300">Leave Type</Label>
              <Select value={editFormData.type} onValueChange={(v) => setEditFormData({ ...editFormData, type: v })}>
                <SelectTrigger className="rounded-xl dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 bg-white">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-800 dark:border-gray-700 bg-white">
                  {leaveCategories.map((c) => (
                    <SelectItem key={c.id} value={c.name} className="dark:text-gray-200 dark:hover:bg-gray-700">{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="dark:text-gray-300">Start Date</Label>
                <Input type="date" value={editFormData.start_date} onChange={(e) => setEditFormData({ ...editFormData, start_date: e.target.value })} className="rounded-xl dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 bg-white" />
              </div>
              <div>
                <Label className="dark:text-gray-300">End Date</Label>
                <Input type="date" value={editFormData.end_date} onChange={(e) => setEditFormData({ ...editFormData, end_date: e.target.value })} className="rounded-xl dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 bg-white" />
              </div>
            </div>
            <div>
              <Label className="dark:text-gray-300">Reason</Label>
              <Input value={editFormData.reason} onChange={(e) => setEditFormData({ ...editFormData, reason: e.target.value })} className="rounded-xl dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder:text-gray-400 bg-white" />
            </div>
            <div>
              <Label className="dark:text-gray-300">Status</Label>
              <Select value={editFormData.status} onValueChange={(v) => setEditFormData({ ...editFormData, status: v })}>
                <SelectTrigger className="rounded-xl dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 bg-white">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-800 dark:border-gray-700 bg-white">
                  <SelectItem value="pending" className="dark:text-gray-200 dark:hover:bg-gray-700">Pending</SelectItem>
                  <SelectItem value="approved" className="dark:text-gray-200 dark:hover:bg-gray-700">Approved</SelectItem>
                  <SelectItem value="rejected" className="dark:text-gray-200 dark:hover:bg-gray-700">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)} className="rounded-xl dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800">Cancel</Button>
              <Button onClick={handleUpdateLeave} className="rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:shadow-lg transition-all text-white">Update</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Leave Details Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="rounded-2xl max-w-lg dark:bg-gray-900 dark:border-gray-700 bg-white">
          <DialogHeader><DialogTitle className="dark:text-gray-100">Leave Request Details</DialogTitle></DialogHeader>
          {selectedLeave && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 p-4 bg-gray-50 dark:bg-gray-800/60 rounded-xl">
                <div className="flex flex-col">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Employee ID</span>
                  <span className="font-semibold text-sm mt-1 dark:text-gray-200">{selectedLeave.staff_employee_id}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Staff Name</span>
                  <span className="font-semibold text-sm mt-1 dark:text-gray-200">{selectedLeave.staff_name}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Leave Type</span>
                  <span className="font-semibold text-sm mt-1 capitalize dark:text-gray-200">{selectedLeave.type}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Status</span>
                  <div className="mt-1">{getStatusBadge(selectedLeave.status)}</div>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Start Date</span>
                  <span className="font-semibold text-sm mt-1 dark:text-gray-200">{formatDateDisplay(selectedLeave.start_date)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-gray-500 dark:text-gray-400">End Date</span>
                  <span className="font-semibold text-sm mt-1 dark:text-gray-200">{formatDateDisplay(selectedLeave.end_date)}</span>
                </div>
                <div className="col-span-2 flex flex-col">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Reason</span>
                  <span className="font-semibold text-sm mt-1 dark:text-gray-200">{selectedLeave.reason || "No reason provided"}</span>
                </div>
              </div>
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setViewDialogOpen(false)} className="rounded-xl dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800">Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Balance Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="rounded-2xl max-w-4xl max-h-[90vh] overflow-y-auto dark:bg-gray-900 dark:border-gray-700 bg-white">
          <DialogHeader>
            <DialogTitle className="dark:text-gray-100">Complete Leave Details</DialogTitle>
          </DialogHeader>
          {selectedBalanceForDetails && (() => {
            const staffInfo = staff.find(s => s.employee_id === selectedBalanceForDetails.staff_employee_id);
            const allStaffBalances = leaveBalances.filter(b => b.staff_employee_id === selectedBalanceForDetails.staff_employee_id);
            const completeLeaveHistory = leaves.filter(l => l.staff_employee_id === selectedBalanceForDetails.staff_employee_id);

            return (
              <div className="space-y-5">
                <div className="bg-gradient-to-r from-indigo-100 to-purple-100 dark:from-indigo-950/40 dark:to-purple-950/40 rounded-xl p-4 border border-indigo-200 dark:border-indigo-800/30">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16 border-2 border-white shadow-md">
                      {staffInfo?.photo_url && <AvatarImage src={staffInfo.photo_url} />}
                      <AvatarFallback className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-lg">
                        {selectedBalanceForDetails.staff_name?.split(" ").map((n: string) => n[0]).join("").toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">{selectedBalanceForDetails.staff_name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Employee ID: {selectedBalanceForDetails.staff_employee_id}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">Designation: {staffInfo?.designation || "—"}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <BarChart className="h-4 w-4" /> Leave Summary (All Categories)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {allStaffBalances.map((bal, i) => (
                      <div key={i} className="bg-gray-50 dark:bg-gray-800/60 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium text-gray-700 dark:text-gray-300">{bal.category_name}</span>
                          <Badge className={bal.remaining_days <= 0 ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-0" : bal.remaining_days <= 5 ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-0" : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-0"}>
                            {bal.remaining_days} days left
                          </Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-white dark:bg-gray-800 rounded-lg p-2">
                            <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{bal.total_days}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
                          </div>
                          <div className="bg-white dark:bg-gray-800 rounded-lg p-2">
                            <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{bal.used_days}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Used</p>
                          </div>
                          <div className="bg-white dark:bg-gray-800 rounded-lg p-2">
                            <p className="text-lg font-bold text-green-600 dark:text-green-400">{bal.remaining_days}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Remaining</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                    <Calendar className="h-4 w-4" /> Complete Leave History
                  </h4>
                  {completeLeaveHistory.length === 0 ? (
                    <div className="text-center py-6 bg-gray-50 dark:bg-gray-800/60 rounded-xl">
                      <p className="text-sm text-gray-500 dark:text-gray-400">No leave records found</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                      {completeLeaveHistory.map((leave, i) => (
                        <div key={i} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800/60 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors border border-gray-200 dark:border-gray-700">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm capitalize dark:text-gray-200">{leave.type}</span>
                              {getStatusBadge(leave.status)}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {formatDateDisplay(leave.start_date)} → {formatDateDisplay(leave.end_date)}
                            </p>
                            {leave.reason && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{leave.reason}</p>
                            )}
                          </div>
                          <div className="text-right ml-2">
                            <p className="text-xs font-medium whitespace-nowrap dark:text-gray-300">
                              {calculateLeaveDays(leave.start_date, leave.end_date)} days
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setDetailsDialogOpen(false)} className="rounded-xl dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800">
                    Close
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Edit Category Dialog */}
      <Dialog open={editCategoryDialogOpen} onOpenChange={setEditCategoryDialogOpen}>
        <DialogContent className="rounded-2xl max-w-lg dark:bg-gray-900 dark:border-gray-700 bg-white">
          <DialogHeader><DialogTitle className="dark:text-gray-100">Edit Leave Category</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label className="dark:text-gray-300">Category Name</Label><Input value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} className="rounded-xl dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 bg-white" /></div>
            <div><Label className="dark:text-gray-300">Days per Year</Label><Input type="number" value={categoryForm.days_per_year} onChange={(e) => setCategoryForm({ ...categoryForm, days_per_year: e.target.value })} className="rounded-xl dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 bg-white" /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditCategoryDialogOpen(false)} className="rounded-xl dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800">Cancel</Button>
              <Button onClick={handleUpdateCategory} className="rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:shadow-lg transition-all text-white">Update Category</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </ResponsiveLayout>
  );
}
