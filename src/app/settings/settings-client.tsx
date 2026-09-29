// src/app/settings/settings-client.tsx
"use client";

import { useState, useEffect } from "react";
import {
  Settings, Building, Calendar, Users, Shield,
  Upload, Save, Trash2, Edit, Plus, Loader2, UserCheck, Mail, Phone, CheckCircle2,
  RefreshCw, AlertCircle, UserPlus, Search as SearchIcon, Key, Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResponsiveLayout } from "@/components/layout/responsive-layout";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  getSchoolSettings,
  updateSchoolSettings,
  uploadLogo,
  getAcademicYears,
  createAcademicYear,
  updateAcademicYear,
  deleteAcademicYear,
  getRoles,
  createRole,
  updateRole,
  deleteRole,
  getUsers,
  createUser,
  deleteUser,
  processPendingAccounts,
} from "@/lib/api/settings";
import { toast } from "sonner";
import type { UserType, AcademicYearType, RoleType } from "@/types";

const permissionOptions = [
  { id: "view_students", label: "View Students" },
  { id: "manage_students", label: "Manage Students" },
  { id: "view_staff", label: "View Staff" },
  { id: "manage_staff", label: "Manage Staff" },
  { id: "view_fees", label: "View Fees" },
  { id: "manage_fees", label: "Manage Fees" },
  { id: "view_attendance", label: "View Attendance" },
  { id: "manage_attendance", label: "Manage Attendance" },
  { id: "view_exams", label: "View Exams" },
  { id: "manage_exams", label: "Manage Exams" },
  { id: "view_reports", label: "View Reports" },
  { id: "manage_settings", label: "Manage Settings" },
  { id: "manage_inventory", label: "Manage Inventory" },
  { id: "view_finance", label: "View Finance" },
  { id: "manage_finance", label: "Manage Finance" },
];

const MENU_KEYS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "students", label: "Student Management" },
  { key: "staff", label: "Teacher & Staff" },
  { key: "fees", label: "Fees Management" },
  { key: "attendance", label: "Attendance" },
  { key: "exams", label: "Examination" },
  { key: "inventory", label: "Inventory" },
  { key: "finance", label: "Finance" },
  { key: "notifications", label: "Notifications" },
  { key: "reports", label: "Reports" },
  { key: "settings", label: "Settings" },
  { key: "my-results", label: "আমার ফলাফল" },
  { key: "my-attendance", label: "আমার হাজিরা" },
  { key: "my-fees", label: "আমার ফি" },
];

const EDITABLE_ROLES = [
  { value: "teacher", label: "Teacher" },
  { value: "staff", label: "Staff" },
  { value: "accountant", label: "Accountant" },
  { value: "store", label: "Store Keeper" },
  { value: "student", label: "Student" },
];

const USER_ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "teacher", label: "Teacher" },
  { value: "staff", label: "Staff" },
  { value: "accountant", label: "Accountant" },
  { value: "store", label: "Store Keeper" },
  { value: "student", label: "Student" },
];

const ROLE_COLORS: Record<string, string> = {
  admin:
    "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-200 dark:border-red-800",
  teacher:
    "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  staff:
    "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-200 dark:border-purple-800",
  accountant:
    "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  store:
    "bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800",
  student:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  user:
    "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700",
};

export default function SettingsClient() {
  const [supabase] = useState(() => createClient());

  // ===================== STATE =====================
  const [currentUser, setCurrentUser] = useState<{
    name: string;
    email: string;
    phone: string;
    role: string;
  } | null>(null);

  const [schoolName, setSchoolName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const [academicYears, setAcademicYears] = useState<AcademicYearType[]>([]);
  const [academicYearModalOpen, setAcademicYearModalOpen] = useState(false);
  const [editingAcademicYear, setEditingAcademicYear] =
    useState<AcademicYearType | null>(null);
  const [academicYearForm, setAcademicYearForm] = useState({
    year_name: "",
    start_date: "",
    end_date: "",
    is_current: false,
  });

  const [users, setUsers] = useState<UserType[]>([]);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userForm, setUserForm] = useState({
    email: "",
    name: "",
    role_id: "",
    password: "",
  });

  const [bulkCreating, setBulkCreating] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState<string>("all");

  const [roles, setRoles] = useState<RoleType[]>([]);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleType | null>(null);
  const [roleForm, setRoleForm] = useState({
    name: "",
    permissions: [] as string[],
  });

  const [loading, setLoading] = useState(false);

  // ===================== LOAD DATA =====================
  useEffect(() => {
    loadData();

    const channel = supabase
      .channel("settings-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "school_settings" },
        () => loadSchoolSettings()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "academic_years" },
        () => loadAcademicYears()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => loadUsers()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "roles" },
        () => loadRoles()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const loadData = async () => {
    await Promise.all([
      loadCurrentUser(),
      loadSchoolSettings(),
      loadAcademicYears(),
      loadUsers(),
      loadRoles(),
    ]);
  };

  const loadCurrentUser = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, phone, role")
          .eq("id", user.id)
          .single();

        setCurrentUser({
          name:
            profile?.full_name ||
            user.user_metadata?.full_name ||
            "Super Administrator",
          email: user.email || "No Email Provided",
          phone:
            profile?.phone ||
            user.user_metadata?.phone ||
            "+880 1923253454",
          role: profile?.role || user.user_metadata?.role || "admin",
        });
      }
    } catch (err) {
      console.error("Error fetching current user profile:", err);
    }
  };

  const loadSchoolSettings = async () => {
    try {
      const data = await getSchoolSettings();
      if (data) {
        setSchoolName(data.school_name || data.name || "");
        setAddress(data.school_address || data.address || "");
        setPhone(data.school_phone || data.phone || "");
        setEmail(data.school_email || data.email || "");
        setLogoUrl(data.school_logo || data.logo_url || "");
        setHasChanges(false);
      }
    } catch (err) {
      console.error("Error loading school settings:", err);
    }
  };

  const saveSchoolSettings = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        school_name:
          schoolName.trim() || "Shapla Kindergarten & Pre-cadet",
        school_address:
          address.trim() ||
          "Nowtala, Madhaiya Bazar, Chandina, Cumilla",
        school_phone: phone.trim() || "01923253454",
        school_email:
          email.trim() || "shapla.kindergarten@gmail.com",
        school_logo: logoUrl || null,
      };

      const result = await updateSchoolSettings(payload);
      if (result) {
        toast.success("Settings updated successfully!");
        setHasChanges(false);
        await loadSchoolSettings();
      }
    } catch (err: any) {
      console.error("Error saving settings:", err);
      toast.error(err.message || "Failed to update settings");
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("File size must be less than 2MB");
      return;
    }

    const allowedTypes = ["image/png", "image/jpeg", "image/jpg"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Only PNG, JPG, JPEG files are allowed");
      return;
    }

    setUploading(true);
    try {
      const url = await uploadLogo(file);
      if (url) {
        setLogoUrl(url);
        setHasChanges(true);
        toast.success(
          "Logo uploaded! Click 'Save Settings' to apply."
        );
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to upload logo");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const loadAcademicYears = async () => {
    try {
      const data = await getAcademicYears();
      setAcademicYears(data || []);
    } catch (err) {
      console.error("Error loading academic years:", err);
    }
  };

  const handleAcademicYearSubmit = async () => {
    if (!academicYearForm.year_name.trim()) {
      toast.error("Please enter year name");
      return;
    }
    setLoading(true);
    try {
      if (editingAcademicYear) {
        await updateAcademicYear(
          editingAcademicYear.id,
          academicYearForm
        );
        toast.success("Academic year updated!");
      } else {
        await createAcademicYear(academicYearForm);
        toast.success("Academic year created!");
      }
      setAcademicYearModalOpen(false);
      resetAcademicYearForm();
      await loadAcademicYears();
    } catch (err: any) {
      toast.error(err.message || "Failed to save academic year");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAcademicYear = async (id: string) => {
    if (
      !confirm("Are you sure you want to delete this academic year?")
    )
      return;
    try {
      await deleteAcademicYear(id);
      toast.success("Academic year deleted!");
      await loadAcademicYears();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete academic year");
    }
  };

  const resetAcademicYearForm = () => {
    setEditingAcademicYear(null);
    setAcademicYearForm({
      year_name: "",
      start_date: "",
      end_date: "",
      is_current: false,
    });
  };

  const loadUsers = async () => {
    try {
      const data = await getUsers();
      setUsers(data || []);
    } catch (err) {
      console.error("Error loading users:", err);
    }
  };

  const handleUserSubmit = async () => {
    if (
      !userForm.name.trim() ||
      !userForm.email.trim() ||
      !userForm.role_id
    ) {
      toast.error("Please fill all required fields");
      return;
    }
    if (!userForm.password || userForm.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      await createUser({
        email: userForm.email.trim(),
        name: userForm.name.trim(),
        role_id: userForm.role_id,
        password: userForm.password,
      });
      toast.success("User created successfully!");
      setUserModalOpen(false);
      setUserForm({ email: "", name: "", role_id: "", password: "" });
      await loadUsers();
    } catch (err: any) {
      toast.error(err.message || "Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      await deleteUser(id);
      toast.success("User deleted!");
      await loadUsers();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete user");
    }
  };

  const handleProcessPending = async () => {
    setBulkCreating(true);
    try {
      const data = await processPendingAccounts({
        limit: 100,
        password: "KinderERP@2026",
      });

      if (data.processed === 0) {
        toast.info("No pending accounts to process");
      } else {
        toast.success(
          `✅ Processed: ${data.processed}, Created: ${data.created}, Skipped: ${data.skipped}, Failed: ${data.failed}`
        );
      }

      if (data.credentials && data.credentials.length > 0) {
        const csv = [
          "Type,Name,Email,Password",
          ...data.credentials.map(
            (c: any) =>
              `${c.type},${c.name},${c.email},${c.password}`
          ),
        ].join("\n");

        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `accounts-${new Date()
          .toISOString()
          .split("T")[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }

      await loadUsers();
    } catch (err: any) {
      toast.error(err.message || "Failed to process pending");
    } finally {
      setBulkCreating(false);
    }
  };

  const loadRoles = async () => {
    try {
      const data = await getRoles();
      setRoles(data || []);
    } catch (err) {
      console.error("Error loading roles:", err);
    }
  };

  const handleRoleSubmit = async () => {
    if (!roleForm.name.trim()) {
      toast.error("Please enter role name");
      return;
    }
    setLoading(true);
    try {
      if (editingRole) {
        await updateRole(editingRole.id, roleForm);
        toast.success("Role updated!");
      } else {
        await createRole(roleForm);
        toast.success("Role created!");
      }
      setRoleModalOpen(false);
      resetRoleForm();
      await loadRoles();
    } catch (err: any) {
      toast.error(err.message || "Failed to save role");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRole = async (id: string) => {
    if (!confirm("Are you sure you want to delete this role?")) return;
    try {
      await deleteRole(id);
      toast.success("Role deleted!");
      await loadRoles();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete role");
    }
  };

  const resetRoleForm = () => {
    setEditingRole(null);
    setRoleForm({ name: "", permissions: [] });
  };

  const togglePermission = (permId: string) => {
    setRoleForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permId)
        ? prev.permissions.filter((p) => p !== permId)
        : [...prev.permissions, permId],
    }));
  };

  const filteredUsers = users.filter((u) => {
    if (userRoleFilter !== "all") {
      const userRole = (
        u.role?.name ||
        u.role_id ||
        ""
      ).toLowerCase();
      if (userRole !== userRoleFilter) return false;
    }
    if (userSearchQuery.trim()) {
      const q = userSearchQuery.toLowerCase().trim();
      const name = (u.name || "").toLowerCase();
      const email = (u.email || "").toLowerCase();
      if (!name.includes(q) && !email.includes(q)) return false;
    }
    return true;
  });

  const roleCounts = users.reduce((acc: Record<string, number>, u) => {
    const r = (u.role?.name || u.role_id || "unknown").toLowerCase();
    acc[r] = (acc[r] || 0) + 1;
    return acc;
  }, {});

  // ===================== RENDER =====================
  return (
    <ResponsiveLayout>
      <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto text-slate-800 dark:text-slate-100">
        {/* Header */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-600/10 via-indigo-600/5 to-transparent border border-blue-200/50 dark:border-blue-900/40 backdrop-blur-md shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-600 text-white rounded-xl shadow-md">
              <Settings className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Settings & Configurations
              </h1>
              <p className="text-slate-500 dark:text-slate-400 mt-1 text-xs sm:text-sm">
                Manage your school identity, academic terms, user permissions,
                and profile setups.
              </p>
            </div>
          </div>
          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            size="sm"
            className="rounded-xl border-slate-200 dark:border-slate-700"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Data
          </Button>
        </div>

        <Tabs defaultValue="school" className="w-full">
          {/* ✅ Tab Navigation — 5 tabs */}
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60 gap-1">
            <TabsTrigger
              value="school"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white font-semibold transition-all rounded-lg gap-2 text-xs sm:text-sm py-2"
            >
              <Building className="h-4 w-4" /> School Profile
            </TabsTrigger>
            <TabsTrigger
              value="academic"
              className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white font-semibold transition-all rounded-lg gap-2 text-xs sm:text-sm py-2"
            >
              <Calendar className="h-4 w-4" /> Academic Years
            </TabsTrigger>
            <TabsTrigger
              value="users"
              className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white font-semibold transition-all rounded-lg gap-2 text-xs sm:text-sm py-2"
            >
              <Users className="h-4 w-4" /> Users & Auth
            </TabsTrigger>
            <TabsTrigger
              value="roles"
              className="data-[state=active]:bg-purple-600 data-[state=active]:text-white font-semibold transition-all rounded-lg gap-2 text-xs sm:text-sm py-2"
            >
              <Shield className="h-4 w-4" /> Role Permissions
            </TabsTrigger>
            {/* ✅ NEW: Credentials Tab */}
            <TabsTrigger
              value="credentials"
              className="data-[state=active]:bg-amber-600 data-[state=active]:text-white font-semibold transition-all rounded-lg gap-2 text-xs sm:text-sm py-2"
            >
              <Key className="h-4 w-4" /> Credentials
            </TabsTrigger>
          </TabsList>

          {/* ==================== SCHOOL TAB ==================== */}
          <TabsContent value="school" className="mt-6 space-y-6">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveSchoolSettings();
              }}
            >
              <Card className="shadow-sm border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl overflow-hidden">
                <CardHeader className="bg-slate-50/50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 p-5">
                  <CardTitle className="flex items-center gap-2 text-lg font-bold text-blue-600 dark:text-blue-400">
                    <Building className="h-5 w-5" />
                    School Profile Information
                  </CardTitle>
                  <CardDescription className="text-slate-500">
                    Primary identity settings for transcripts, reports, and
                    invoices
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 p-5 sm:p-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      School Name
                    </Label>
                    <Input
                      value={schoolName}
                      onChange={(e) => {
                        setSchoolName(e.target.value);
                        setHasChanges(true);
                      }}
                      className="rounded-xl border-slate-200 dark:border-slate-700 focus:ring-blue-500"
                      placeholder="Enter full school name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Address
                    </Label>
                    <Textarea
                      value={address}
                      onChange={(e) => {
                        setAddress(e.target.value);
                        setHasChanges(true);
                      }}
                      rows={3}
                      className="rounded-xl border-slate-200 dark:border-slate-700 resize-none focus:ring-blue-500"
                      placeholder="Enter school location address"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Phone Number
                      </Label>
                      <Input
                        value={phone}
                        onChange={(e) => {
                          setPhone(e.target.value);
                          setHasChanges(true);
                        }}
                        className="rounded-xl border-slate-200 dark:border-slate-700 focus:ring-blue-500"
                        placeholder="e.g. 01923253454"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Email Address
                      </Label>
                      <Input
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          setHasChanges(true);
                        }}
                        type="email"
                        className="rounded-xl border-slate-200 dark:border-slate-700 focus:ring-blue-500"
                        placeholder="school@example.com"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl overflow-hidden mt-6">
                <CardHeader className="bg-slate-50/50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 p-5">
                  <CardTitle className="flex items-center gap-2 text-lg font-bold text-blue-600 dark:text-blue-400">
                    <Upload className="h-5 w-5" />
                    School Logo
                  </CardTitle>
                  <CardDescription className="text-slate-500">
                    Upload high resolution logo image for marksheets and
                    student cards
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5 sm:p-6">
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    <div className="w-28 h-28 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center bg-slate-50 dark:bg-slate-800/50 overflow-hidden relative">
                      {logoUrl ? (
                        <img
                          src={logoUrl}
                          alt="Logo"
                          className="w-full h-full object-contain p-2 rounded-2xl"
                        />
                      ) : (
                        <Building className="h-10 w-10 text-slate-400" />
                      )}
                    </div>
                    <div className="flex flex-col items-center sm:items-start text-center sm:text-left gap-2">
                      <input
                        type="file"
                        id="logo-upload"
                        accept="image/png,image/jpeg,image/jpg"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          document
                            .getElementById("logo-upload")
                            ?.click()
                        }
                        disabled={uploading}
                        className="rounded-xl border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
                      >
                        {uploading ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin text-blue-600" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2 text-blue-600" />
                        )}
                        {uploading ? "Uploading..." : "Choose Logo"}
                      </Button>
                      <p className="text-xs text-slate-500">
                        Supports PNG, JPG up to 2MB (Recommended ratio 1:1)
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end mt-6">
                <Button
                  type="button"
                  onClick={saveSchoolSettings}
                  disabled={saving || !hasChanges}
                  className="bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all rounded-xl px-8 py-2.5 font-bold"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {saving ? "Saving..." : "Save Settings"}
                </Button>
              </div>
            </form>
          </TabsContent>

          {/* ==================== ACADEMIC YEARS TAB ==================== */}
          <TabsContent value="academic" className="mt-6">
            <Card className="shadow-sm border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl overflow-hidden">
              <CardHeader className="bg-slate-50/50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg font-bold text-indigo-600 dark:text-indigo-400">
                    <Calendar className="h-5 w-5" />
                    Academic Years & Sessions
                  </CardTitle>
                  <CardDescription className="text-slate-500">
                    Manage active academic years and term timelines
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  type="button"
                  onClick={() => {
                    resetAcademicYearForm();
                    setAcademicYearModalOpen(true);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm font-semibold"
                >
                  <Plus className="h-4 w-4 mr-1" /> Add New Session
                </Button>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                {academicYears.length === 0 ? (
                  <div className="text-center py-10 text-slate-500 font-medium">
                    No academic years found in system.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 uppercase text-[11px] font-bold">
                        <tr>
                          <th className="p-3.5 rounded-l-xl">
                            Session Name
                          </th>
                          <th className="p-3.5">Timeline</th>
                          <th className="p-3.5">Status</th>
                          <th className="p-3.5 text-right rounded-r-xl">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {academicYears.map((year) => (
                          <tr
                            key={year.id}
                            className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-all"
                          >
                            <td className="p-3.5 font-bold text-slate-900 dark:text-slate-100">
                              {year.year_name}
                            </td>
                            <td className="p-3.5 text-slate-600 dark:text-slate-400 text-xs sm:text-sm">
                              {year.start_date || "N/A"} to{" "}
                              {year.end_date || "N/A"}
                            </td>
                            <td className="p-3.5">
                              {year.is_current ? (
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                                  <CheckCircle2 className="h-3 w-3" />{" "}
                                  Current
                                </span>
                              ) : (
                                <span className="px-3 py-1 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500">
                                  Inactive
                                </span>
                              )}
                            </td>
                            <td className="p-3.5 text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 rounded-lg"
                                  onClick={() => {
                                    setEditingAcademicYear(year);
                                    setAcademicYearForm({
                                      year_name: year.year_name,
                                      start_date: year.start_date,
                                      end_date: year.end_date,
                                      is_current: year.is_current,
                                    });
                                    setAcademicYearModalOpen(true);
                                  }}
                                >
                                  <Edit className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 rounded-lg hover:bg-red-50 dark:hover:bg-red-950"
                                  onClick={() =>
                                    handleDeleteAcademicYear(year.id)
                                  }
                                >
                                  <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ==================== USERS TAB ==================== */}
          <TabsContent value="users" className="mt-6 space-y-6">
            <Card className="shadow-sm border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl overflow-hidden">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800 p-5">
                <CardTitle className="flex items-center gap-2 text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  <UserCheck className="h-5 w-5" /> Active User Profile
                </CardTitle>
                <CardDescription className="text-slate-500">
                  Overview of your current logged in administrative
                  credentials
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                  <div className="w-20 h-20 rounded-full bg-emerald-600 flex items-center justify-center text-white font-black text-2xl shadow-md ring-4 ring-emerald-100 dark:ring-emerald-950 uppercase">
                    {currentUser?.name
                      ? currentUser.name.slice(0, 3)
                      : "ADM"}
                  </div>
                  <div className="flex-1 space-y-3 text-center sm:text-left">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                          {currentUser?.name || "Super Administrator"}
                        </h3>
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                          {currentUser?.role || "Administrator"} •{" "}
                          {schoolName || "School"} Admin Portal
                        </p>
                      </div>
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 self-center sm:self-auto">
                        <CheckCircle2 className="h-3 w-3 inline mr-1" />
                        Authenticated
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs text-slate-600 dark:text-slate-400">
                      <div className="flex items-center justify-center sm:justify-start gap-2 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60 truncate">
                        <Mail className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span className="truncate">
                          {currentUser?.email || "N/A"}
                        </span>
                      </div>
                      <div className="flex items-center justify-center sm:justify-start gap-2 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                        <Phone className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        {currentUser?.phone || "N/A"}
                      </div>
                      <div className="flex items-center justify-center sm:justify-start gap-2 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                        <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        {currentUser?.role || "N/A"}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl overflow-hidden">
              <CardHeader className="bg-slate-50/50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    <Users className="h-5 w-5" />
                    Registered System Users
                  </CardTitle>
                  <CardDescription className="text-slate-500">
                    Create users, grant signup access, and manage user
                    roles
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    size="sm"
                    type="button"
                    onClick={handleProcessPending}
                    disabled={bulkCreating}
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm font-semibold"
                  >
                    {bulkCreating ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-1" />
                    )}
                    {bulkCreating
                      ? "Processing..."
                      : "Process Pending Accounts"}
                  </Button>
                  <Button
                    size="sm"
                    type="button"
                    onClick={() => setUserModalOpen(true)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm font-semibold"
                  >
                    <Plus className="h-4 w-4 mr-1" /> Add User
                  </Button>
                </div>
              </CardHeader>

              <div className="px-5 pb-4 pt-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center border-b border-slate-100 dark:border-slate-800">
                <div className="relative flex-1 max-w-md">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search by name or email..."
                    value={userSearchQuery}
                    onChange={(e) =>
                      setUserSearchQuery(e.target.value)
                    }
                    className="pl-9 rounded-xl border-slate-200 dark:border-slate-700"
                  />
                </div>
                <select
                  value={userRoleFilter}
                  onChange={(e) =>
                    setUserRoleFilter(e.target.value)
                  }
                  className="px-3 py-2 text-sm rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none text-slate-800 dark:text-slate-200 min-w-[160px]"
                >
                  <option value="all">
                    All Roles ({users.length})
                  </option>
                  <option value="admin">
                    Admin ({roleCounts.admin || 0})
                  </option>
                  <option value="teacher">
                    Teacher ({roleCounts.teacher || 0})
                  </option>
                  <option value="staff">
                    Staff ({roleCounts.staff || 0})
                  </option>
                  <option value="accountant">
                    Accountant ({roleCounts.accountant || 0})
                  </option>
                  <option value="store">
                    Store ({roleCounts.store || 0})
                  </option>
                  <option value="student">
                    Student ({roleCounts.student || 0})
                  </option>
                </select>
              </div>

              <CardContent className="p-4 sm:p-6">
                {users.length === 0 ? (
                  <div className="text-center py-10 text-slate-500 font-medium">
                    No users found in database.
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="text-center py-10 text-slate-500 font-medium">
                    No users match your filters. Try a different
                    search or role.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 uppercase text-[11px] font-bold">
                        <tr>
                          <th className="p-3.5 rounded-l-xl">Name</th>
                          <th className="p-3.5">Email</th>
                          <th className="p-3.5">Role</th>
                          <th className="p-3.5 text-right rounded-r-xl">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredUsers.map((user) => {
                          const role = (
                            user.role?.name ||
                            user.role_id ||
                            "user"
                          ).toLowerCase();
                          const colorClass =
                            ROLE_COLORS[role] ||
                            ROLE_COLORS.user;
                          return (
                            <tr
                              key={user.id}
                              className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-all"
                            >
                              <td className="p-3.5 font-bold text-slate-900 dark:text-slate-100">
                                {user.name}
                              </td>
                              <td className="p-3.5 text-slate-600 dark:text-slate-400 text-xs sm:text-sm">
                                {user.email}
                              </td>
                              <td className="p-3.5">
                                <span
                                  className={`px-3 py-1 rounded-full text-xs font-semibold border ${colorClass}`}
                                >
                                  {role}
                                </span>
                              </td>
                              <td className="p-3.5 text-right">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 rounded-lg hover:bg-red-50 dark:hover:bg-red-950"
                                  onClick={() =>
                                    handleDeleteUser(user.id)
                                  }
                                >
                                  <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ==================== ROLES TAB ==================== */}
          <TabsContent value="roles" className="mt-6 space-y-6">
            <Card className="shadow-sm border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl overflow-hidden">
              <CardHeader className="bg-slate-50/50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 p-5">
                <CardTitle className="flex items-center gap-2 text-lg font-bold text-purple-600 dark:text-purple-400">
                  <Shield className="h-5 w-5" />
                  Menu Access Control
                </CardTitle>
                <CardDescription className="text-slate-500">
                  Configure which menu items each role can view or
                  manage
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 sm:p-6">
                <RolePermissionsEditor
                  supabase={supabase}
                  currentUser={currentUser}
                />
              </CardContent>
            </Card>

            <Card className="shadow-sm border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl overflow-hidden">
              <CardHeader className="bg-slate-50/50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg font-bold text-purple-600 dark:text-purple-400">
                    <Shield className="h-5 w-5" />
                    System Roles
                  </CardTitle>
                  <CardDescription className="text-slate-500">
                    Define access control rules and assign security
                    roles
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  type="button"
                  onClick={() => {
                    resetRoleForm();
                    setRoleModalOpen(true);
                  }}
                  className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-sm font-semibold"
                >
                  <Plus className="h-4 w-4 mr-1" /> Add New Role
                </Button>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                {roles.length === 0 ? (
                  <div className="text-center py-10 text-slate-500 font-medium">
                    No system roles created yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 uppercase text-[11px] font-bold">
                        <tr>
                          <th className="p-3.5 rounded-l-xl">
                            Role Title
                          </th>
                          <th className="p-3.5">Permissions</th>
                          <th className="p-3.5 text-right rounded-r-xl">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {roles.map((role) => (
                          <tr
                            key={role.id}
                            className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-all"
                          >
                            <td className="p-3.5 font-bold text-slate-900 dark:text-slate-100">
                              {role.name}
                            </td>
                            <td className="p-3.5">
                              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                {role.permissions?.length || 0}{" "}
                                Permissions
                              </span>
                            </td>
                            <td className="p-3.5 text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 rounded-lg"
                                  onClick={() => {
                                    setEditingRole(role);
                                    setRoleForm({
                                      name: role.name,
                                      permissions:
                                        role.permissions || [],
                                    });
                                    setRoleModalOpen(true);
                                  }}
                                >
                                  <Edit className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 rounded-lg hover:bg-red-50 dark:hover:bg-red-950"
                                  onClick={() =>
                                    handleDeleteRole(role.id)
                                  }
                                >
                                  <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ==================== CREDENTIALS TAB ==================== */}
          <TabsContent value="credentials" className="mt-6">
            <CredentialsTab />
          </TabsContent>
        </Tabs>
      </div>

      {/* ==================== MODALS ==================== */}

      {/* Academic Year Modal */}
      <Dialog
        open={academicYearModalOpen}
        onOpenChange={setAcademicYearModalOpen}
      >
        <DialogContent className="rounded-2xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-indigo-600 dark:text-indigo-400 font-bold">
              {editingAcademicYear
                ? "Edit Academic Year"
                : "Add Academic Year"}
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              Configure academic session start and end dates
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Session Name
              </Label>
              <Input
                placeholder="Year Name (e.g., 2025-2026)"
                value={academicYearForm.year_name}
                onChange={(e) =>
                  setAcademicYearForm({
                    ...academicYearForm,
                    year_name: e.target.value,
                  })
                }
                className="border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Start Date
                </Label>
                <Input
                  type="date"
                  value={academicYearForm.start_date}
                  onChange={(e) =>
                    setAcademicYearForm({
                      ...academicYearForm,
                      start_date: e.target.value,
                    })
                  }
                  className="border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  End Date
                </Label>
                <Input
                  type="date"
                  value={academicYearForm.end_date}
                  onChange={(e) =>
                    setAcademicYearForm({
                      ...academicYearForm,
                      end_date: e.target.value,
                    })
                  }
                  className="border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <input
                type="checkbox"
                checked={academicYearForm.is_current}
                onChange={(e) =>
                  setAcademicYearForm({
                    ...academicYearForm,
                    is_current: e.target.checked,
                  })
                }
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Set as current active session
              </span>
            </label>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAcademicYearModalOpen(false)}
              className="rounded-xl border-slate-200 dark:border-slate-700"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleAcademicYearSubmit}
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold"
            >
              {loading && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingAcademicYear ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Modal */}
      <Dialog open={userModalOpen} onOpenChange={setUserModalOpen}>
        <DialogContent className="rounded-2xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-emerald-600 dark:text-emerald-400 font-bold">
              Register New User
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              Create login credentials for school staff or
              administrators
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Full Name
              </Label>
              <Input
                placeholder="John Doe"
                value={userForm.name}
                onChange={(e) =>
                  setUserForm({
                    ...userForm,
                    name: e.target.value,
                  })
                }
                className="border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Email Address
              </Label>
              <Input
                type="email"
                placeholder="user@school.com"
                value={userForm.email}
                onChange={(e) =>
                  setUserForm({
                    ...userForm,
                    email: e.target.value,
                  })
                }
                className="border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Password
              </Label>
              <Input
                type="password"
                placeholder="••••••••"
                value={userForm.password}
                onChange={(e) =>
                  setUserForm({
                    ...userForm,
                    password: e.target.value,
                  })
                }
                className="border-slate-200 dark:border-slate-700 rounded-xl"
              />
              <p className="text-[10px] text-slate-500">
                Must be at least 6 characters
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Role
              </Label>
              <select
                value={userForm.role_id}
                onChange={(e) =>
                  setUserForm({
                    ...userForm,
                    role_id: e.target.value,
                  })
                }
                className="w-full p-2.5 text-sm rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none text-slate-800 dark:text-slate-200"
              >
                <option value="">Select Role</option>
                {USER_ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setUserModalOpen(false)}
              className="rounded-xl border-slate-200 dark:border-slate-700"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleUserSubmit}
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold"
            >
              {loading && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Modal */}
      <Dialog open={roleModalOpen} onOpenChange={setRoleModalOpen}>
        <DialogContent className="max-w-md rounded-2xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-purple-600 dark:text-purple-400 font-bold">
              {editingRole ? "Edit Role" : "Add Role"}
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              Assign system module permissions to this role
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Role Title
              </Label>
              <Input
                placeholder="Role Name (e.g., Accountant, Teacher)"
                value={roleForm.name}
                onChange={(e) =>
                  setRoleForm({
                    ...roleForm,
                    name: e.target.value,
                  })
                }
                className="border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>
            <div>
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Module Permissions
              </Label>
              <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto p-3 border rounded-xl mt-1.5 bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                {permissionOptions.map((perm) => (
                  <label
                    key={perm.id}
                    className="flex items-center gap-2 text-xs cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 p-1.5 rounded-lg text-slate-700 dark:text-slate-300 transition-all"
                  >
                    <input
                      type="checkbox"
                      checked={roleForm.permissions.includes(
                        perm.id
                      )}
                      onChange={() => togglePermission(perm.id)}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                    />
                    {perm.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRoleModalOpen(false)}
              className="rounded-xl border-slate-200 dark:border-slate-700"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleRoleSubmit}
              disabled={loading}
              className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-semibold"
            >
              {loading && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingRole ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ResponsiveLayout>
  );
}

// ═══════════════════════════════════════════════════════════
// ✅ NEW: Credentials Tab Component
// ═══════════════════════════════════════════════════════════
function CredentialsTab() {
  const [credentials, setCredentials] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const fetchCredentials = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (roleFilter !== "all") params.set("role", roleFilter);

      const res = await fetch(`/api/admin/credentials?${params}`);
      const data = await res.json();
      setCredentials(data.credentials || []);
    } catch (err) {
      console.error("Failed to fetch credentials:", err);
      setCredentials([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCredentials();
  }, [search, roleFilter]);

  const handleDownload = (format: "csv" | "txt") => {
    if (credentials.length === 0) {
      toast.error("No credentials to download");
      return;
    }

    const content =
      format === "csv"
        ? [
            "Name,Email,Password,Role,Entity Type",
            ...credentials.map(
              (c) =>
                `"${c.full_name || ""}","${c.email}","${c.password}","${c.role}","${c.entity_type || ""}"`
            ),
          ].join("\n")
        : credentials
            .map(
              (c) =>
                `Name: ${c.full_name}\nEmail: ${c.email}\nPassword: ${c.password}\nRole: ${c.role}\nType: ${c.entity_type}\n---`
            )
            .join("\n\n");

    const blob = new Blob([content], {
      type: format === "csv" ? "text/csv" : "text/plain",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `credentials-${new Date().toISOString().split("T")[0]}.${format}`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success(`${format.toUpperCase()} downloaded!`);
  };

  const handleDownloadAll = () => {
    handleDownload("csv");
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-amber-600 dark:text-amber-400 flex items-center gap-2">
            <Key className="h-5 w-5" />
            Account Credentials
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Student ও Staff-দের login credentials (এখন {credentials.length}টি)
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fetchCredentials}
            disabled={loading}
            className="rounded-xl border-slate-200 dark:border-slate-700"
          >
            <RefreshCw
              className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleDownloadAll}
            disabled={credentials.length === 0}
            className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-semibold"
          >
            <Download className="h-4 w-4 mr-1" />
            CSV Download
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => handleDownload("txt")}
            disabled={credentials.length === 0}
            className="rounded-xl border-slate-200 dark:border-slate-700"
          >
            <Download className="h-4 w-4 mr-1" />
            TXT
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-xl border-slate-200 dark:border-slate-700"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="h-10 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm min-w-[180px]"
        >
          <option value="all">All Roles</option>
          <option value="admin">Admin</option>
          <option value="admin_staff">Admin Staff</option>
          <option value="teacher">Teacher</option>
          <option value="staff">Staff</option>
          <option value="accountant">Accountant</option>
          <option value="store">Store</option>
          <option value="student">Student</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
          <span className="ml-2 text-sm text-slate-500">Loading...</span>
        </div>
      ) : credentials.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-2xl bg-slate-50/50 dark:bg-slate-900/50">
          <Key className="h-10 w-10 mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-500 font-medium">
            No credentials found
          </p>
          <p className="text-xs text-slate-400 mt-1">
            "Process Pending Accounts" click করে credentials তৈরি করুন
          </p>
        </div>
      ) : (
        <div className="border rounded-2xl overflow-hidden bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 uppercase text-[11px] font-bold">
                <tr>
                  <th className="p-3.5">Name</th>
                  <th className="p-3.5">Email</th>
                  <th className="p-3.5">Password</th>
                  <th className="p-3.5">Role</th>
                  <th className="p-3.5">Type</th>
                  <th className="p-3.5 text-right">Downloaded</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {credentials.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-all"
                  >
                    <td className="p-3.5 font-bold text-slate-900 dark:text-slate-100">
                      {c.full_name}
                    </td>
                    <td className="p-3.5 text-slate-600 dark:text-slate-400 font-mono text-xs">
                      {c.email}
                    </td>
                    <td className="p-3.5 text-slate-600 dark:text-slate-400 font-mono text-xs">
                      {c.password}
                    </td>
                    <td className="p-3.5">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800 uppercase">
                        {c.role}
                      </span>
                    </td>
                    <td className="p-3.5 text-xs text-slate-500 uppercase">
                      {c.entity_type}
                    </td>
                    <td className="p-3.5 text-right text-xs text-slate-500">
                      {c.is_downloaded
                        ? `✅ ${c.download_count || 0}x`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3 border-t bg-slate-50/50 dark:bg-slate-800/30 text-xs text-slate-500 flex justify-between">
            <span>
              Total: <b>{credentials.length}</b> credentials
            </span>
            <span>Password: KinderERP@2026</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Role Permissions Editor Component
// ═══════════════════════════════════════════════════════════
function RolePermissionsEditor({
  supabase,
  currentUser,
}: {
  supabase: ReturnType<typeof createClient>;
  currentUser: {
    name: string;
    email: string;
    phone: string;
    role: string;
  } | null;
}) {
  const [selectedRole, setSelectedRole] = useState("teacher");
  const [permissions, setPermissions] = useState<
    Record<string, { can_view: boolean; can_manage: boolean }>
  >({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasAdminAccess, setHasAdminAccess] = useState<
    boolean | null
  >(null);

  useEffect(() => {
    const verifyAccess = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          console.error("[RolePermissionsEditor] Not authenticated");
          setHasAdminAccess(false);
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        const isAdmin = profile?.role === "admin";
        setHasAdminAccess(isAdmin);
      } catch (err) {
        console.error(
          "[RolePermissionsEditor] Access check failed:",
          err
        );
        setHasAdminAccess(false);
      }
    };
    verifyAccess();
  }, [supabase]);

  useEffect(() => {
    if (hasAdminAccess !== true) return;

    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("role_menu_permissions")
          .select("menu_key, can_view, can_manage")
          .eq("role", selectedRole);

        if (error) {
          console.error("[RolePermissionsEditor] Load error:", {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
          });
          toast.error(
            `Load failed: ${error.message || "Unknown error"}`
          );
          setLoading(false);
          return;
        }

        const map: Record<
          string,
          { can_view: boolean; can_manage: boolean }
        > = {};
        MENU_KEYS.forEach(({ key }) => {
          map[key] = { can_view: false, can_manage: false };
        });
        data?.forEach((row: any) => {
          map[row.menu_key] = {
            can_view: row.can_view,
            can_manage: row.can_manage,
          };
        });
        setPermissions(map);
      } catch (err) {
        console.error("[RolePermissionsEditor] Error:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [selectedRole, supabase, hasAdminAccess]);

  const toggleView = (menuKey: string) => {
    setPermissions((prev) => {
      const current = prev[menuKey] || {
        can_view: false,
        can_manage: false,
      };
      return {
        ...prev,
        [menuKey]: {
          can_view: !current.can_view,
          can_manage: current.can_view
            ? false
            : current.can_manage,
        },
      };
    });
  };

  const toggleManage = (menuKey: string) => {
    setPermissions((prev) => {
      const current = prev[menuKey] || {
        can_view: false,
        can_manage: false,
      };
      return {
        ...prev,
        [menuKey]: {
          can_view: true,
          can_manage: !current.can_manage,
        },
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const upserts = Object.entries(permissions).map(
        ([menu_key, p]) => ({
          role: selectedRole,
          menu_key,
          can_view: p.can_view,
          can_manage: p.can_manage,
          updated_at: new Date().toISOString(),
        })
      );

      const { error } = await supabase
        .from("role_menu_permissions")
        .upsert(upserts, { onConflict: "role,menu_key" });

      if (error) {
        console.error("[RolePermissionsEditor] Save error:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        throw error;
      }
      toast.success(
        `${selectedRole} role-এর permissions সেভ হয়েছে!`
      );
    } catch (err: any) {
      console.error("[RolePermissionsEditor] Save error:", err);
      toast.error(err?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (hasAdminAccess === false) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800 dark:text-amber-300">
            <p className="font-semibold">Admin access required</p>
            <p className="mt-1 text-xs">
              Role permissions পরিবর্তন করতে admin role দরকার।
              আপনার current role: {currentUser?.role || "unknown"}।
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (hasAdminAccess === null) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {EDITABLE_ROLES.map((r) => (
          <button
            key={r.value}
            onClick={() => setSelectedRole(r.value)}
            className={
              "px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition " +
              (selectedRole === r.value
                ? "bg-purple-600 text-white shadow-md"
                : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700")
            }
          >
            {r.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
        </div>
      ) : (
        <div className="space-y-2">
          {MENU_KEYS.map(({ key, label }) => {
            const p = permissions[key] || {
              can_view: false,
              can_manage: false,
            };
            return (
              <div
                key={key}
                className="flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                    {label}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    {p.can_manage
                      ? "✅ Full access"
                      : p.can_view
                      ? "👁️ View only"
                      : "🚫 No access"}
                  </p>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                  <label className="flex items-center gap-1 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={p.can_view}
                      onChange={() => toggleView(key)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-[10px] sm:text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      👁️ View
                    </span>
                  </label>

                  <label className="flex items-center gap-1 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={p.can_manage}
                      onChange={() => toggleManage(key)}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-[10px] sm:text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      ✅ Manage
                    </span>
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saving ? "সেভ হচ্ছে..." : "সেভ করুন"}
        </button>
      </div>
    </div>
  );
}