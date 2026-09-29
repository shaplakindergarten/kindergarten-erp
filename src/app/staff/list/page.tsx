"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Eye,
  Edit,
  UserMinus,
  Users,
  Trash2,
  X,
  Download,
  Printer,
  Search,
  UserCheck,
  UserX,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getSchoolPrintHeader } from "@/components/print/SchoolPrintHeader";
import { ResponsiveLayout } from "@/components/layout/responsive-layout";
import { useToastStore } from "@/store/useStore";
import { createClient } from "@/lib/supabase/client";
import { getSalaryCategories, deleteStaff, resignStaff } from "@/lib/api/staff";

interface Staff {
  id: string;
  employee_id: string;
  name: string;
  name_bn: string;
  father_name: string;
  mother_name: string;
  nid_no: string;
  designation: string;
  role: "teacher" | "admin_staff" | "support_staff";
  qualification: string;
  experience: number;
  contact: string;
  email: string;
  status: "active" | "inactive" | "on_leave" | "resigned" | "terminated";
  joining_date: string;
  dob: string;
  address: string;
  photo_url: string;
  salary_category_id: string;
  resign_date?: string;
  resign_reason?: string;
  salary?: number;
}

interface SchoolSettings {
  school_name: string;
  school_address: string;
  school_phone: string;
  school_email: string;
  school_logo: string;
}

export default function StaffListPage() {
  const router = useRouter();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [salaryCategories, setSalaryCategories] = useState<any[]>([]);
  const [stats, setStats] = useState({ 
    total: 0, 
    active: 0, 
    onLeave: 0, 
    resigned: 0, 
    teachers: 0, 
    adminStaff: 0 
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("active");
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings>({
    school_name: "KinderERP - Kindergarten",
    school_address: "School Address Line 1, City, District",
    school_phone: "",
    school_email: "",
    school_logo: "",
  });
  
  // Filters
  const [searchName, setSearchName] = useState("");
  const [searchContact, setSearchContact] = useState("");
  const [searchDesignation, setSearchDesignation] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [resignDialogOpen, setResignDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [resignDate, setResignDate] = useState("");
  const [resignReason, setResignReason] = useState("");
  const addToast = useToastStore((state) => state.addToast);

  useEffect(() => {
    loadData();
    loadSchoolSettings();
    loadSalaryCategories();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchName, searchContact, searchDesignation, statusFilter, roleFilter, activeTab]);

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

  async function loadSalaryCategories() {
    try {
      const data = await getSalaryCategories();
      setSalaryCategories(data || []);
    } catch (err) {
      console.error("Failed to load salary categories:", err);
    }
  }

  async function loadData() {
    setLoading(true);
    try {
      const supabase = createClient();
      
      const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (staffError) {
        console.error("Error loading staff:", staffError);
        addToast({ type: "error", title: "Load Failed", message: "Failed to load staff list." });
        setLoading(false);
        return;
      }

      const mappedStaff = (staffData || []).map((s: any) => ({
        id: s.id,
        employee_id: s.employee_id,
        name: s.name,
        name_bn: s.name_bn || "",
        father_name: s.father_name || "",
        mother_name: s.mother_name || "",
        nid_no: s.nid_no || "",
        designation: s.designation,
        role: s.role,
        qualification: s.qualification || "",
        experience: s.experience || 0,
        contact: s.contact,
        email: s.email || "",
        status: s.status || "active",
        joining_date: s.joining_date,
        dob: s.dob || "",
        address: s.address || "",
        photo_url: s.photo_url || "",
        salary_category_id: s.salary_category_id || "",
        salary: s.salary,
        resign_date: s.resign_date,
        resign_reason: s.resign_reason,
      }));

      setStaff(mappedStaff);

      const activeStaff = mappedStaff.filter(s => s.status === 'active');
      const onLeaveStaff = mappedStaff.filter(s => s.status === 'on_leave');
      const resignedStaff = mappedStaff.filter(s => s.status === 'resigned' || s.status === 'terminated');
      const teachers = mappedStaff.filter(s => s.role === 'teacher');
      const adminStaff = mappedStaff.filter(s => s.role === 'admin_staff');

      setStats({
        total: mappedStaff.length,
        active: activeStaff.length,
        onLeave: onLeaveStaff.length,
        resigned: resignedStaff.length,
        teachers: teachers.length,
        adminStaff: adminStaff.length,
      });

    } catch (err) {
      console.error("❌ Failed to load staff:", err);
      addToast({ type: "error", title: "Load Failed", message: "Failed to load staff list." });
    } finally {
      setLoading(false);
    }
  }

  const activeStaffList = useMemo(() => {
    return staff.filter(s => s.status === 'active' || s.status === 'on_leave');
  }, [staff]);

  const resignedStaffList = useMemo(() => {
    return staff.filter(s => s.status === 'resigned' || s.status === 'terminated');
  }, [staff]);

  const filteredActiveStaff = useMemo(() => {
    return activeStaffList.filter(s => {
      return (
        (!searchName || s.name.toLowerCase().includes(searchName.toLowerCase())) &&
        (!searchContact || s.contact?.includes(searchContact)) &&
        (!searchDesignation || s.designation?.toLowerCase().includes(searchDesignation.toLowerCase())) &&
        (statusFilter === "all" || s.status === statusFilter) &&
        (roleFilter === "all" || s.role === roleFilter)
      );
    });
  }, [activeStaffList, searchName, searchContact, searchDesignation, statusFilter, roleFilter]);

  const filteredResignedStaff = useMemo(() => {
    return resignedStaffList.filter(s => {
      return (
        (!searchName || s.name.toLowerCase().includes(searchName.toLowerCase())) &&
        (!searchContact || s.contact?.includes(searchContact)) &&
        (!searchDesignation || s.designation?.toLowerCase().includes(searchDesignation.toLowerCase())) &&
        (roleFilter === "all" || s.role === roleFilter)
      );
    });
  }, [resignedStaffList, searchName, searchContact, searchDesignation, roleFilter]);

  const currentDisplayData = useMemo(() => {
    return activeTab === "active" ? filteredActiveStaff : filteredResignedStaff;
  }, [activeTab, filteredActiveStaff, filteredResignedStaff]);

  const totalPages = Math.ceil(currentDisplayData.length / pageSize) || 1;
  
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return currentDisplayData.slice(start, start + pageSize);
  }, [currentDisplayData, currentPage, pageSize]);

  const clearFilters = useCallback(() => {
    setSearchName("");
    setSearchContact("");
    setSearchDesignation("");
    setStatusFilter("all");
    setRoleFilter("all");
  }, []);

  const handleExport = useCallback(() => {
    const exportStaff = activeStaffList;
    const headers = ["ID", "Name", "Designation", "Role", "Contact", "Status", "Joining Date"];
    const csvData = exportStaff.map(s => [s.employee_id, s.name, s.designation, s.role, s.contact, s.status, s.joining_date]);
    const csvContent = [headers, ...csvData].map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `active_staff_export_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    addToast({ type: "success", title: "Export Started", message: "Active staff data exported successfully." });
  }, [activeStaffList, addToast]);

  const handleExportResigned = useCallback(() => {
    const exportStaff = resignedStaffList;
    const headers = ["ID", "Name", "Designation", "Role", "Contact", "Resign Date", "Resign Reason"];
    const csvData = exportStaff.map(s => [s.employee_id, s.name, s.designation, s.role, s.contact, s.resign_date || "-", s.resign_reason || "-"]);
    const csvContent = [headers, ...csvData].map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `resigned_staff_export_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    addToast({ type: "success", title: "Export Started", message: "Resigned staff data exported successfully." });
  }, [resignedStaffList, addToast]);

  const getInitials = useCallback((name: string) => {
    return name?.split(" ").map(n => n?.[0] ?? "").join("").toUpperCase() || "?";
  }, []);

  const handlePrint = useCallback(() => {
    const printWindow = window.open('', '_blank', 'width=1200,height=900');
    if (!printWindow) return;

    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    let tableRows = '';
    const staffToPrint = activeTab === 'active' ? filteredActiveStaff : filteredResignedStaff;
    const title = activeTab === 'active' ? 'Active Staff List' : 'Resigned Staff List';
    
    if (staffToPrint.length === 0) {
      tableRows = `
        <tr>
          <td colspan="12" style="text-align:center;padding:20px;color:#6b7280;font-size:12px;">
            No ${activeTab === 'active' ? 'active' : 'resigned'} staff found
          </td>
        </tr>
      `;
    } else {
      staffToPrint.forEach((item, index) => {
        tableRows += `
          <tr>
            <td style="text-align:center;padding:4px 5px;border:1px solid #d1d5db;font-size:8px;">${index + 1}</td>
            <td style="text-align:center;padding:4px 5px;border:1px solid #d1d5db;font-size:8px;">
              ${item.photo_url ? 
                `<img src="${item.photo_url}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;display:block;margin:0 auto;" />` : 
                `<div style="width:28px;height:28px;border-radius:50%;background:#e5e7eb;display:flex;align-items:center;justify-content:center;margin:0 auto;font-size:9px;color:#6b7280;">${getInitials(item.name)}</div>`
              }
            </td>
            <td style="padding:4px 5px;border:1px solid #d1d5db;font-size:8px;">${item.employee_id}</td>
            <td style="padding:4px 5px;border:1px solid #d1d5db;font-size:8px;">${item.name}</td>
            <td style="padding:4px 5px;border:1px solid #d1d5db;font-size:8px;">${item.designation || '-'}</td>
            <td style="padding:4px 5px;border:1px solid #d1d5db;font-size:8px;">${item.father_name || '-'}</td>
            <td style="padding:4px 5px;border:1px solid #d1d5db;font-size:8px;">${item.joining_date ? new Date(item.joining_date).toLocaleDateString('en-CA') : '-'}</td>
            <td style="padding:4px 5px;border:1px solid #d1d5db;font-size:8px;">${item.nid_no || '-'}</td>
            <td style="padding:4px 5px;border:1px solid #d1d5db;font-size:8px;">${item.dob ? new Date(item.dob).toLocaleDateString('en-CA') : '-'}</td>
            <td style="padding:4px 5px;border:1px solid #d1d5db;font-size:8px;">${item.address || '-'}</td>
            <td style="padding:4px 5px;border:1px solid #d1d5db;font-size:8px;">${item.qualification || '-'}</td>
            <td style="padding:4px 5px;border:1px solid #d1d5db;font-size:8px;">${item.contact || '-'}</td>
          </tr>
        `;
      });
    }

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title} - ${schoolSettings.school_name}</title>
          <style>
            @page { size: A4 landscape; margin: 6mm 8mm; }
            * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            body { font-family: 'Inter', Arial, sans-serif; margin: 0; padding: 0; background: white; }
            .print-container { max-width: 100%; padding: 2px; }
            table { width: 100%; border-collapse: collapse; font-size: 8px; }
            th { background: linear-gradient(135deg, #059669, #0d9488); color: white; font-weight: 700; padding: 4px 5px; border: 1px solid #d1d5db; text-align: left; font-size: 7px; text-transform: uppercase; }
            td { padding: 3px 5px; border: 1px solid #d1d5db; color: #1f2937; font-size: 8px; vertical-align: middle; }
            tr:nth-child(even) td { background-color: #f9fafb; }
            .footer { text-align: center; border-top: 1px solid #d1d5db; padding-top: 5px; margin-top: 6px; font-size: 7px; color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="print-container">
            ${getSchoolPrintHeader(
              { school_logo: schoolSettings?.school_logo, school_name: schoolSettings?.school_name, school_address: schoolSettings?.school_address, school_phone: schoolSettings?.school_phone, school_email: schoolSettings?.school_email },
              title
            )}
            <table>
              <thead>
                <tr>
                  <th style="text-align:center;width:20px;">SL</th>
                  <th style="text-align:center;width:35px;">Photo</th>
                  <th style="width:65px;">Employee ID</th>
                  <th style="width:90px;">Name</th>
                  <th style="width:75px;">Designation</th>
                  <th style="width:85px;">Father's Name</th>
                  <th style="width:65px;">Joining Date</th>
                  <th style="width:60px;">NID Number</th>
                  <th style="width:60px;">Date of Birth</th>
                  <th style="width:90px;">Present Address</th>
                  <th style="width:70px;">Qualification</th>
                  <th style="width:60px;">Contact</th>
                </tr>
              </thead>
              <tbody>${tableRows}</tbody>
            </table>
            <div class="footer">
              <p>Generated from ${schoolSettings.school_name} | Printed on: ${currentDate}</p>
            </div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  }, [activeTab, filteredActiveStaff, filteredResignedStaff, schoolSettings, getInitials]);

  const handleViewProfile = useCallback((staff: Staff) => {
    if (!staff.employee_id) {
      addToast({ type: "error", title: "Error", message: "Invalid employee ID" });
      return;
    }
    router.push(`/staff/employee/${staff.employee_id}`);
  }, [router, addToast]);

  const handleEdit = useCallback((staff: Staff) => {
    router.push(`/staff/${staff.id}/edit`);
  }, [router]);

  const handleDeleteClick = useCallback((staff: Staff) => {
    setSelectedStaff(staff);
    setDeleteDialogOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!selectedStaff) return;
    try {
      await deleteStaff(selectedStaff.id);
      addToast({ type: "success", title: "Deleted", message: `${selectedStaff.name} has been deleted permanently.` });
      loadData();
    } catch (err) {
      console.error("❌ Delete failed:", err);
      addToast({ type: "error", title: "Delete Failed", message: "Failed to delete staff member." });
    } finally {
      setDeleteDialogOpen(false);
      setSelectedStaff(null);
    }
  }, [selectedStaff, addToast]);

  const handleResignClick = useCallback((staff: Staff) => {
    setSelectedStaff(staff);
    setResignDate(new Date().toISOString().split('T')[0]);
    setResignReason("");
    setResignDialogOpen(true);
  }, []);

  const handleConfirmResign = useCallback(async () => {
    if (!selectedStaff) return;
    try {
      await resignStaff(selectedStaff.id, resignDate, resignReason);
      addToast({ type: "success", title: "Resigned", message: `${selectedStaff.name} has been marked as resigned.` });
      loadData();
    } catch (err) {
      console.error("❌ Resign failed:", err);
      addToast({ type: "error", title: "Failed", message: "Failed to mark staff as resigned." });
    } finally {
      setResignDialogOpen(false);
      setSelectedStaff(null);
      setResignDate("");
      setResignReason("");
    }
  }, [selectedStaff, resignDate, resignReason, addToast]);

  const getStatusBadge = useCallback((status: string) => {
    switch (status) {
      case "active": 
        return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-0 text-[11px] px-2 py-0.5">Active</Badge>;
      case "on_leave": 
        return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-0 text-[11px] px-2 py-0.5">On Leave</Badge>;
      case "resigned": 
        return <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border-0 text-[11px] px-2 py-0.5">Resigned</Badge>;
      case "terminated": 
        return <Badge className="bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300 border-0 text-[11px] px-2 py-0.5">Terminated</Badge>;
      default: 
        return <Badge variant="secondary" className="dark:bg-gray-700 dark:text-gray-300 border-0 text-[11px] px-2 py-0.5">{status}</Badge>;
    }
  }, []);

  if (loading) {
    return (
      <ResponsiveLayout>
        <div className="flex items-center justify-center h-full min-h-[80vh]">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500 mx-auto"></div>
        </div>
      </ResponsiveLayout>
    );
  }

  return (
    <ResponsiveLayout>
      {/* 🟢 No Page Scroll (Fixed Viewport Container) */}
      <div className="h-[calc(100vh-4rem)] flex flex-col justify-between overflow-hidden gap-2 p-1">
        
        {/* Top Header Bar & Actions */}
        <div className="flex-none bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 rounded-xl p-2.5 sm:p-3 text-white shadow-md flex flex-wrap items-center justify-between gap-2">
          
          {/* Header Title + Integrated Tabs (Active / Resigned) */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-emerald-200" />
              <h1 className="text-base sm:text-lg font-bold tracking-tight">Teacher & Staff List</h1>
            </div>

            {/* 🟢 1. Header Bar Tab Controls */}
            <div className="flex items-center bg-black/20 p-0.5 rounded-lg border border-white/10 backdrop-blur-md">
              <button
                type="button"
                onClick={() => setActiveTab("active")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  activeTab === "active"
                    ? "bg-white text-emerald-800 shadow-sm"
                    : "text-white/80 hover:text-white hover:bg-white/10"
                }`}
              >
                <UserCheck className="h-3.5 w-3.5" />
                Active ({activeStaffList.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("resigned")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  activeTab === "resigned"
                    ? "bg-rose-500 text-white shadow-sm"
                    : "text-white/80 hover:text-white hover:bg-white/10"
                }`}
              >
                <UserX className="h-3.5 w-3.5" />
                Resigned ({resignedStaffList.length})
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5">
            <Button 
              size="sm"
              variant="outline" 
              onClick={handlePrint}
              className="bg-white/10 text-white border-white/20 hover:bg-white/20 hover:text-white h-8 text-xs px-2.5 rounded-lg backdrop-blur-sm"
            >
              <Printer className="h-3.5 w-3.5 mr-1" />
              Print
            </Button>
            <Button 
              size="sm"
              asChild 
              className="bg-white text-emerald-700 hover:bg-emerald-50 h-8 text-xs px-2.5 rounded-lg shadow-sm font-semibold"
            >
              <Link href="/staff/new"><Plus className="h-3.5 w-3.5 mr-1" />Add Staff</Link>
            </Button>
          </div>
        </div>

        {/* Filters Panel */}
        <Card className="flex-none border-0 shadow-sm rounded-xl dark:bg-gray-800/80 dark:border-gray-700/50">
          <CardContent className="p-2 sm:p-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex-1 min-w-[140px] relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 dark:text-gray-400" />
                <Input 
                  placeholder="Search name..." 
                  value={searchName} 
                  onChange={(e) => setSearchName(e.target.value)}
                  className="pl-8 h-8 text-xs dark:bg-gray-900/60 dark:border-gray-700 dark:text-gray-100 dark:placeholder:text-gray-400 rounded-lg"
                />
              </div>
              
              <div className="w-[120px]">
                <Input 
                  placeholder="Contact..." 
                  value={searchContact} 
                  onChange={(e) => setSearchContact(e.target.value)}
                  className="h-8 text-xs dark:bg-gray-900/60 dark:border-gray-700 dark:text-gray-100 dark:placeholder:text-gray-400 rounded-lg"
                />
              </div>

              <div className="w-[130px]">
                <Input 
                  placeholder="Designation..." 
                  value={searchDesignation} 
                  onChange={(e) => setSearchDesignation(e.target.value)}
                  className="h-8 text-xs dark:bg-gray-900/60 dark:border-gray-700 dark:text-gray-100 dark:placeholder:text-gray-400 rounded-lg"
                />
              </div>

              <div className="w-[120px]">
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="h-8 text-xs dark:bg-gray-900/60 dark:border-gray-700 dark:text-gray-100 rounded-lg">
                    <SelectValue placeholder="All Roles" />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                    <SelectItem value="all" className="text-xs dark:text-gray-200">All Roles</SelectItem>
                    <SelectItem value="teacher" className="text-xs dark:text-gray-200">Teacher</SelectItem>
                    <SelectItem value="admin_staff" className="text-xs dark:text-gray-200">Admin Staff</SelectItem>
                    <SelectItem value="support_staff" className="text-xs dark:text-gray-200">Support Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {activeTab === "active" && (
                <div className="w-[120px]">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-8 text-xs dark:bg-gray-900/60 dark:border-gray-700 dark:text-gray-100 rounded-lg">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                      <SelectItem value="all" className="text-xs dark:text-gray-200">All Status</SelectItem>
                      <SelectItem value="active" className="text-xs dark:text-gray-200">Active</SelectItem>
                      <SelectItem value="on_leave" className="text-xs dark:text-gray-200">On Leave</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex gap-1.5 ml-auto">
                <Button 
                  size="sm"
                  variant="ghost" 
                  onClick={clearFilters} 
                  className="h-8 text-xs text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg px-2"
                  title="Reset Filters"
                >
                  <X className="h-3.5 w-3.5 mr-1" /> Reset
                </Button>
                <Button 
                  size="sm"
                  variant="outline" 
                  onClick={activeTab === "active" ? handleExport : handleExportResigned} 
                  className="h-8 text-xs dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg px-2.5"
                >
                  <Download className="h-3.5 w-3.5 mr-1" /> Export
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 🟢 2. Compact Table Container */}
        <div className="flex-1 min-h-0 bg-white dark:bg-gray-800/90 rounded-xl border border-gray-200 dark:border-gray-700/70 shadow-sm flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-emerald-600 dark:bg-emerald-800 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold text-white uppercase tracking-wider w-12">Photo</th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold text-white uppercase tracking-wider w-24">ID No</th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold text-white uppercase tracking-wider">Employee</th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold text-white uppercase tracking-wider">Designation</th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold text-white uppercase tracking-wider">Contact</th>
                  {activeTab === "active" ? (
                    <th className="px-3 py-2 text-left text-[11px] font-semibold text-white uppercase tracking-wider">Status</th>
                  ) : (
                    <>
                      <th className="px-3 py-2 text-left text-[11px] font-semibold text-white uppercase tracking-wider">Resign Date</th>
                      <th className="px-3 py-2 text-left text-[11px] font-semibold text-white uppercase tracking-wider">Reason</th>
                    </>
                  )}
                  <th className="px-3 py-2 text-center text-[11px] font-semibold text-white uppercase tracking-wider w-28">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan={activeTab === "active" ? 6 : 7} className="text-center py-10 text-gray-400 dark:text-gray-400 text-xs">
                      No staff records found.
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-700/40 transition-colors">
                      <td className="px-3 py-1.5">
                        <Avatar className="h-7 w-7 border border-gray-200 dark:border-gray-700">
                          {item.photo_url && <AvatarImage src={item.photo_url} />}
                          <AvatarFallback className="text-[10px] bg-emerald-600 text-white font-medium">
                            {getInitials(item.name)}
                          </AvatarFallback>
                        </Avatar>
                      </td>
                      <td className="px-3 py-1.5 text-xs font-mono font-medium text-gray-600 dark:text-emerald-400">
                        {item.employee_id}
                      </td>
                      <td className="px-3 py-1.5">
                        <p className="font-semibold text-xs text-gray-800 dark:text-gray-100 leading-tight">{item.name}</p>
                        {item.name_bn && (
                          <p className="text-[10px] text-gray-400 dark:text-gray-400 leading-tight">{item.name_bn}</p>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300">{item.designation}</td>
                      <td className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300">{item.contact}</td>
                      
                      {activeTab === "active" ? (
                        <td className="px-3 py-1.5">{getStatusBadge(item.status)}</td>
                      ) : (
                        <>
                          <td className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300">
                            {item.resign_date ? new Date(item.resign_date).toLocaleDateString('en-CA') : '-'}
                          </td>
                          <td className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 truncate max-w-[150px]">
                            {item.resign_reason || '-'}
                          </td>
                        </>
                      )}

                      {/* 🟢 Actions Column */}
                      <td className="px-3 py-1.5">
                        <div className="flex items-center justify-center gap-0.5">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-gray-600 dark:text-gray-300 hover:text-emerald-600 dark:hover:bg-gray-700" 
                            onClick={() => handleViewProfile(item)} 
                            title="View Profile"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {activeTab === "active" && (
                            <>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:bg-gray-700" 
                                onClick={() => handleEdit(item)} 
                                title="Edit Staff"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              {(item.status === "active" || item.status === "on_leave") && (
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7 text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:bg-gray-700" 
                                  onClick={() => handleResignClick(item)} 
                                  title="Release / Resign"
                                >
                                  <UserMinus className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </>
                          )}
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-rose-500 hover:text-rose-700 dark:hover:bg-gray-700" 
                            onClick={() => handleDeleteClick(item)} 
                            title="Delete Permanently"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 🟢 4. Fixed Bottom Footer Pagination Bar */}
        <div className="flex-none bg-white dark:bg-gray-800 rounded-xl p-2 border border-gray-200 dark:border-gray-700 shadow-sm flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-3">
            <span className="text-gray-500 dark:text-gray-400">
              Showing <span className="font-semibold text-gray-800 dark:text-gray-200">{currentDisplayData.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</span> to <span className="font-semibold text-gray-800 dark:text-gray-200">{Math.min(currentPage * pageSize, currentDisplayData.length)}</span> of <span className="font-semibold text-gray-800 dark:text-gray-200">{currentDisplayData.length}</span> staff
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400 dark:text-gray-500">| Per page:</span>
              <Select 
                value={pageSize.toString()} 
                onValueChange={(val) => {
                  setPageSize(Number(val));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-7 w-16 text-xs dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                  <SelectItem value="5" className="text-xs dark:text-gray-200">5</SelectItem>
                  <SelectItem value="10" className="text-xs dark:text-gray-200">10</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-gray-500 dark:text-gray-400 mr-2">
              Page <span className="font-semibold text-gray-800 dark:text-gray-200">{currentPage}</span> of <span className="font-semibold text-gray-800 dark:text-gray-200">{totalPages}</span>
            </span>
            
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              title="First Page"
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              title="Previous Page"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              title="Next Page"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              title="Last Page"
            >
              <ChevronsRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

      </div>

      {/* 🔴 Dialog Popups - Resign Modal */}
      <AlertDialog open={resignDialogOpen} onOpenChange={setResignDialogOpen}>
        <AlertDialogContent className="bg-white dark:bg-gray-900 border dark:border-gray-800 shadow-2xl rounded-2xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-gray-100 text-base font-semibold">Mark as Resigned</AlertDialogTitle>
            <AlertDialogDescription className="dark:text-gray-400 text-xs">
              This will mark <span className="font-semibold text-gray-800 dark:text-gray-200">{selectedStaff?.name}</span> as resigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="dark:text-gray-300 text-xs">Resignation Date *</Label>
              <Input 
                type="date" 
                value={resignDate} 
                onChange={(e) => setResignDate(e.target.value)}
                className="h-8 text-xs dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 rounded-lg"
              />
            </div>
            <div className="space-y-1">
              <Label className="dark:text-gray-300 text-xs">Reason</Label>
              <Input 
                placeholder="Enter reason" 
                value={resignReason} 
                onChange={(e) => setResignReason(e.target.value)}
                className="h-8 text-xs dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500 rounded-lg"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-xs dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmResign}
              className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-lg"
            >
              Confirm Resign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 🔴 Dialog Popups - Delete Modal */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-white dark:bg-gray-900 border dark:border-gray-800 shadow-2xl rounded-2xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-gray-100 text-base font-semibold">Delete Permanently?</AlertDialogTitle>
            <AlertDialogDescription className="dark:text-gray-400 text-xs">
              This will permanently delete <span className="font-semibold text-gray-800 dark:text-gray-200">{selectedStaff?.name}</span>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-xs dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
              className="h-8 text-xs bg-rose-600 hover:bg-rose-700 text-white rounded-lg"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ResponsiveLayout>
  );
}