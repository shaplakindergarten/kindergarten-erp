"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  User,
  Briefcase,
  Contact,
  Calendar,
  Mail,
  Phone,
  MapPin,
  Award,
  Edit,
  Printer,
  Banknote,
  FileText,
  Camera,
  X,
  Heart,
  GraduationCap,
  Clock,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ResponsiveLayout } from "@/components/layout/responsive-layout";
import { getStaffById, updateStaffPhoto, getSalaryCategories } from "@/lib/api/staff";
import { useToastStore } from "@/store/useStore";
import { createClient } from "@/lib/supabase/client";

// ✅ Singleton Supabase client
const supabase = createClient();

// ✅ Constants
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

interface StaffData {
  id: string;
  employee_id: string;
  name: string;
  name_bn: string;
  father_name: string;
  mother_name: string;
  nid_no: string;
  blood_group: string;
  designation: string;
  role: string;
  qualification: string;
  experience: number;
  dob: string;
  gender: string;
  address: string;
  village: string;
  post_office: string;
  police_station: string;
  district: string;
  contact: string;
  email: string;
  photo_url: string;
  salary_category_id: string;
  salary_category?: { 
    id: string; 
    name: string; 
    basic: number; 
    hra: number; 
    da: number; 
    allowances: number; 
    deductions: number 
  };
  status: string;
  joining_date: string;
  created_at: string;
}

function formatDateEnglish(dateString: string | undefined): string {
  if (!dateString) return "—";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-CA");
}

export default function StaffProfileByIdPage() {
  const router = useRouter();
  const params = useParams();
  const staffId = params.id as string;
  
  // ✅ AbortController ref for cancelling pending requests
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const [staff, setStaff] = useState<StaffData | null>(null);
  const [salaryCategories, setSalaryCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("personal");
  const addToast = useToastStore((state) => state.addToast);
  const printRef = useRef<HTMLDivElement>(null);

  // ✅ Memory leak fix - consistent cleanup
  const cleanupPhotoPreview = useCallback(() => {
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
    }
  }, [photoPreview]);

  // ✅ Cleanup on unmount and preview change
  useEffect(() => {
    return () => {
      cleanupPhotoPreview();
      // ✅ Cancel any pending requests on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [cleanupPhotoPreview]);

  // ✅ Async data loading with AbortController
  useEffect(() => {
    if (!staffId) {
      addToast({ type: "error", title: "Error", message: "Invalid staff ID" });
      router.push("/staff/list");
      return;
    }

    // ✅ Create new AbortController for this request
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

    async function loadStaff() {
      try {
        // ✅ Load salary categories and staff data in parallel with abort support
        const [categories, data] = await Promise.all([
          getSalaryCategories(),
          getStaffById(staffId)
        ]);
        
        // ✅ Check if request was aborted
        if (signal.aborted) return;

        setSalaryCategories(categories || []);

        if (data) {
          let salaryCategory = undefined;
          if (data.salary_category_id && categories) {
            const found = categories.find((c: any) => c.id === data.salary_category_id);
            if (found) {
              salaryCategory = {
                id: found.id,
                name: found.name,
                basic: found.basic || 0,
                hra: found.hra || 0,
                da: found.da || 0,
                allowances: found.allowances || 0,
                deductions: found.deductions || 0,
              };
            } else {
              // ✅ Fallback handling - log warning but don't fail
              console.warn(`Salary category not found for ID: ${data.salary_category_id}`);
            }
          }

          const mappedData: StaffData = {
            id: data.id,
            employee_id: data.employee_id,
            name: data.name,
            name_bn: data.name_bn || "",
            father_name: data.father_name || "",
            mother_name: data.mother_name || "",
            nid_no: data.nid_no || "",
            blood_group: data.blood_group || "",
            designation: data.designation,
            role: data.role,
            qualification: data.qualification || "",
            experience: data.experience || 0,
            dob: data.dob || "",
            gender: data.gender || "",
            address: data.address || "",
            village: data.village || "",
            post_office: data.post_office || "",
            police_station: data.police_station || "",
            district: data.district || "",
            contact: data.contact,
            email: data.email || "",
            photo_url: data.photo_url || "",
            salary_category_id: data.salary_category_id || "",
            salary_category: salaryCategory,
            status: data.status || "active",
            joining_date: data.joining_date,
            created_at: data.created_at,
          };

          if (!signal.aborted) {
            setStaff(mappedData);
          }
        } else {
          if (!signal.aborted) {
            addToast({ type: "error", title: "Not Found", message: "Staff member not found." });
            router.push("/staff/list");
          }
        }
      } catch (err: any) {
        // ✅ Ignore abort errors
        if (err?.name === 'AbortError' || err?.code === 'ERR_CANCELED') {
          console.log('Request cancelled');
          return;
        }
        console.error("Failed to load staff:", err);
        if (!signal.aborted) {
          addToast({ type: "error", title: "Error", message: "Failed to load staff profile." });
        }
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadStaff();

    // ✅ Cleanup function
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [staffId, router, addToast]); // ✅ Stable dependencies

  const handleEdit = useCallback(() => {
    if (staff) router.push(`/staff/${staff.id}/edit`);
  }, [staff, router]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // ✅ Photo dialog with proper cleanup
  const handlePhotoDialogChange = useCallback((open: boolean) => {
    setPhotoDialogOpen(open);
    if (!open) {
      cleanupPhotoPreview();
      setSelectedPhoto(null);
      setPhotoPreview(null);
    }
  }, [cleanupPhotoPreview]);

  // ✅ File upload with validation
  const handlePhotoSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // ✅ Validate file type
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        addToast({ 
          type: "error", 
          title: "Error", 
          message: "Please upload a valid image file (JPG, PNG, WEBP)" 
        });
        e.target.value = '';
        return;
      }
      
      // ✅ Validate file size
      if (file.size > MAX_FILE_SIZE) {
        addToast({ 
          type: "error", 
          title: "Error", 
          message: "Photo size must be less than 2MB" 
        });
        e.target.value = '';
        return;
      }
      
      // ✅ Cleanup previous preview
      cleanupPhotoPreview();
      
      setSelectedPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  }, [addToast, cleanupPhotoPreview]);

  const handlePhotoUpload = useCallback(async () => {
    if (!selectedPhoto || !staff) return;

    setUploading(true);
    try {
      const fileExt = selectedPhoto.name.split(".").pop();
      const fileName = `${staff.id}/photo_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("staff-documents")
        .upload(fileName, selectedPhoto, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("staff-documents")
        .getPublicUrl(fileName);

      const result = await updateStaffPhoto(staff.id, publicUrl);

      if (result.success) {
        setStaff(prev => prev ? { ...prev, photo_url: publicUrl } : null);
        addToast({ type: "success", title: "Success", message: "Photo updated successfully." });
        setPhotoDialogOpen(false);
        cleanupPhotoPreview();
        setSelectedPhoto(null);
        setPhotoPreview(null);
      } else {
        addToast({ type: "error", title: "Upload Failed", message: result.error || "Failed to update photo." });
      }
    } catch (err) {
      console.error("Failed to upload photo:", err);
      addToast({ type: "error", title: "Error", message: "An unexpected error occurred." });
    } finally {
      setUploading(false);
    }
  }, [selectedPhoto, staff, addToast, cleanupPhotoPreview]);

  // ✅ Memoized values for performance
  const getInitials = useCallback((name: string) => {
    return name?.split(" ").map(n => n[0]).join("").toUpperCase() || "?";
  }, []);

  const getStatusBadge = useCallback((status: string) => {
    switch (status) {
      case "active": return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Active</Badge>;
      case "on_leave": return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">On Leave</Badge>;
      case "resigned": return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">Resigned</Badge>;
      default: return <Badge variant="secondary" className="dark:bg-gray-700 dark:text-gray-300">{status}</Badge>;
    }
  }, []);

  const calculateTotalSalary = useCallback(() => {
    const cat = staff?.salary_category;
    if (!cat) return 0;
    return (cat.basic || 0) + (cat.hra || 0) + (cat.da || 0) + (cat.allowances || 0) - (cat.deductions || 0);
  }, [staff?.salary_category]);

  const formatRole = useCallback((role: string) => {
    return role?.replaceAll('_', ' ') || '—';
  }, []);

  // ✅ Memoized tabs
  const tabs = useMemo(() => [
    { id: "personal", label: "Personal Info", icon: User, color: "from-blue-500 to-indigo-500" },
    { id: "professional", label: "Professional", icon: Briefcase, color: "from-amber-500 to-orange-500" },
    { id: "salary", label: "Salary", icon: Banknote, color: "from-emerald-500 to-teal-500" },
    { id: "documents", label: "Documents", icon: FileText, color: "from-purple-500 to-pink-500" },
  ], []);

  if (loading) {
    return (
      <ResponsiveLayout>
        <div className="flex justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </ResponsiveLayout>
    );
  }

  if (!staff) return null;

  return (
    <ResponsiveLayout>
      {/* Print Content - A4 Portrait Modern Profile */}
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
              
              .print-profile, .print-profile * {
                visibility: visible !important;
                color: #1f2937 !important;
              }
              .print-profile {
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
              
              .print-profile .profile-header {
                display: flex;
                align-items: center;
                gap: 20px;
                background: linear-gradient(135deg, #4f46e5, #7c3aed, #ec4899) !important;
                padding: 16px 20px;
                border-radius: 12px;
                margin-bottom: 16px;
                color: white !important;
              }
              .print-profile .profile-header .avatar-print {
                width: 80px;
                height: 80px;
                border-radius: 50%;
                border: 3px solid white;
                object-fit: cover;
                flex-shrink: 0;
              }
              .print-profile .profile-header .header-text h1 {
                font-size: 20px;
                font-weight: bold;
                margin: 0;
                color: white !important;
              }
              .print-profile .profile-header .header-text p {
                font-size: 12px;
                margin: 2px 0;
                color: rgba(255,255,255,0.9) !important;
              }
              .print-profile .profile-header .header-text .badge-print {
                display: inline-block;
                padding: 2px 12px;
                border-radius: 12px;
                font-size: 10px;
                font-weight: 600;
                margin-right: 6px;
              }
              .print-profile .profile-header .header-text .badge-active {
                background: #dcfce7 !important;
                color: #166534 !important;
              }
              .print-profile .profile-header .header-text .badge-on_leave {
                background: #fef3c7 !important;
                color: #92400e !important;
              }
              .print-profile .profile-header .header-text .badge-resigned {
                background: #fee2e2 !important;
                color: #991b1b !important;
              }
              .print-profile .profile-header .header-text .badge-id {
                background: #e0e7ff !important;
                color: #4338ca !important;
              }
              .print-profile .section-card {
                background: white !important;
                border: 1px solid #e5e7eb !important;
                border-radius: 10px;
                margin-bottom: 12px;
                overflow: hidden;
              }
              .print-profile .section-card .section-header {
                padding: 8px 14px;
                font-size: 13px;
                font-weight: 700;
                color: white !important;
                display: flex;
                align-items: center;
                gap: 8px;
              }
              .print-profile .section-card .section-body {
                padding: 10px 14px;
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 6px 20px;
              }
              .print-profile .section-card .section-body .field {
                padding: 4px 0;
              }
              .print-profile .section-card .section-body .field .label {
                font-size: 9px;
                color: #6b7280 !important;
                text-transform: uppercase;
                letter-spacing: 0.3px;
                font-weight: 600;
              }
              .print-profile .section-card .section-body .field .value {
                font-size: 11px;
                font-weight: 500;
                color: #1f2937 !important;
              }
              .print-profile .section-card .section-body .field-full {
                grid-column: 1 / -1;
              }
              .print-profile .salary-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 8px;
                margin-bottom: 10px;
              }
              .print-profile .salary-grid .salary-item {
                background: #f9fafb !important;
                padding: 6px 10px;
                border-radius: 6px;
                text-align: center;
              }
              .print-profile .salary-grid .salary-item .s-label {
                font-size: 8px;
                color: #6b7280 !important;
                text-transform: uppercase;
              }
              .print-profile .salary-grid .salary-item .s-value {
                font-size: 13px;
                font-weight: 700;
                color: #1f2937 !important;
              }
              .print-profile .salary-total {
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-top: 2px solid #e5e7eb !important;
                padding-top: 8px;
                margin-top: 4px;
              }
              .print-profile .salary-total .total-label {
                font-size: 12px;
                font-weight: 600;
                color: #1f2937 !important;
              }
              .print-profile .salary-total .total-value {
                font-size: 18px;
                font-weight: 700;
                color: #059669 !important;
              }
              .print-profile .print-footer {
                text-align: center;
                border-top: 1px solid #e5e7eb !important;
                padding-top: 6px;
                margin-top: 10px;
                font-size: 8px;
                color: #6b7280 !important;
              }
              .print-profile .section-header-bg-1 { background: linear-gradient(135deg, #3b82f6, #6366f1) !important; }
              .print-profile .section-header-bg-2 { background: linear-gradient(135deg, #f59e0b, #f97316) !important; }
              .print-profile .section-header-bg-3 { background: linear-gradient(135deg, #10b981, #14b8a6) !important; }
              .print-profile .section-header-bg-4 { background: linear-gradient(135deg, #8b5cf6, #d946ef) !important; }
              .print-profile .doc-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 10px;
              }
              .print-profile .doc-grid .doc-item {
                border: 1px solid #e5e7eb !important;
                border-radius: 6px;
                padding: 8px 12px;
              }
              .print-profile .doc-grid .doc-item .doc-title {
                font-size: 10px;
                font-weight: 600;
                color: #1f2937 !important;
              }
              .print-profile .doc-grid .doc-item .doc-value {
                font-size: 10px;
                color: #6b7280 !important;
              }
              
              .dark .print-profile,
              .dark .print-profile * {
                color: #1f2937 !important;
              }
              .dark .print-profile .profile-header,
              .dark .print-profile .profile-header * {
                color: white !important;
              }
              .dark .print-profile .profile-header .header-text p {
                color: rgba(255,255,255,0.9) !important;
              }
            }
          `}
        </style>

        <div className="print-profile">
          <div className="profile-header">
            {staff.photo_url ? (
              <img src={staff.photo_url} alt={staff.name} className="avatar-print" />
            ) : (
              <div className="avatar-print" style={{ background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', color: '#6b7280' }}>
                {getInitials(staff.name)}
              </div>
            )}
            <div className="header-text">
              <h1>{staff.name}</h1>
              <p>{staff.designation} | {staff.employee_id}</p>
              <div>
                <span className={`badge-print badge-${staff.status}`}>
                  {staff.status === 'active' ? 'Active' : 
                   staff.status === 'on_leave' ? 'On Leave' : 
                   staff.status === 'resigned' ? 'Resigned' : staff.status}
                </span>
                <span className="badge-print badge-id">
                  ID: {staff.employee_id}
                </span>
              </div>
            </div>
          </div>

          <div className="section-card">
            <div className="section-header section-header-bg-1">
              <User className="h-4 w-4" /> Personal Information
            </div>
            <div className="section-body">
              <div className="field"><div className="label">Full Name</div><div className="value">{staff.name}</div></div>
              <div className="field"><div className="label">Name (Bangla)</div><div className="value">{staff.name_bn || '—'}</div></div>
              <div className="field"><div className="label">Gender</div><div className="value capitalize">{staff.gender}</div></div>
              <div className="field"><div className="label">Date of Birth</div><div className="value">{formatDateEnglish(staff.dob)}</div></div>
              <div className="field"><div className="label">Blood Group</div><div className="value">{staff.blood_group || '—'}</div></div>
              <div className="field"><div className="label">NID Number</div><div className="value">{staff.nid_no || '—'}</div></div>
              <div className="field"><div className="label">Father's Name</div><div className="value">{staff.father_name || '—'}</div></div>
              <div className="field"><div className="label">Mother's Name</div><div className="value">{staff.mother_name || '—'}</div></div>
              <div className="field"><div className="label">Contact</div><div className="value">{staff.contact}</div></div>
              <div className="field"><div className="label">Email</div><div className="value">{staff.email || '—'}</div></div>
              <div className="field field-full"><div className="label">Address</div><div className="value">{staff.address || '—'}</div></div>
            </div>
          </div>

          <div className="section-card">
            <div className="section-header section-header-bg-2">
              <Briefcase className="h-4 w-4" /> Professional Information
            </div>
            <div className="section-body">
              <div className="field"><div className="label">Designation</div><div className="value">{staff.designation}</div></div>
              <div className="field"><div className="label">Role</div><div className="value capitalize">{formatRole(staff.role)}</div></div>
              <div className="field"><div className="label">Qualification</div><div className="value">{staff.qualification || '—'}</div></div>
              <div className="field"><div className="label">Experience</div><div className="value">{staff.experience ? `${staff.experience} years` : '—'}</div></div>
              <div className="field"><div className="label">Joining Date</div><div className="value">{formatDateEnglish(staff.joining_date)}</div></div>
            </div>
          </div>

          <div className="section-card">
            <div className="section-header section-header-bg-3">
              <Banknote className="h-4 w-4" /> Salary Information
            </div>
            <div className="section-body" style={{ display: 'block' }}>
              <div className="salary-grid">
                <div className="salary-item">
                  <div className="s-label">Category</div>
                  <div className="s-value" style={{ fontSize: '11px' }}>{staff.salary_category?.name || '—'}</div>
                </div>
                <div className="salary-item">
                  <div className="s-label">Basic</div>
                  <div className="s-value" style={{ color: '#4f46e5' }}>৳{staff.salary_category?.basic?.toLocaleString() || 0}</div>
                </div>
                <div className="salary-item">
                  <div className="s-label">HRA</div>
                  <div className="s-value" style={{ color: '#059669' }}>৳{staff.salary_category?.hra?.toLocaleString() || 0}</div>
                </div>
                <div className="salary-item">
                  <div className="s-label">DA</div>
                  <div className="s-value" style={{ color: '#d97706' }}>৳{staff.salary_category?.da?.toLocaleString() || 0}</div>
                </div>
                <div className="salary-item">
                  <div className="s-label">Allowances</div>
                  <div className="s-value" style={{ color: '#2563eb' }}>৳{staff.salary_category?.allowances?.toLocaleString() || 0}</div>
                </div>
                <div className="salary-item" style={{ background: '#fef2f2' }}>
                  <div className="s-label" style={{ color: '#dc2626' }}>Deductions</div>
                  <div className="s-value" style={{ color: '#dc2626' }}>-৳{staff.salary_category?.deductions?.toLocaleString() || 0}</div>
                </div>
              </div>
              <div className="salary-total">
                <span className="total-label">Total Salary</span>
                <span className="total-value">৳{calculateTotalSalary().toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="section-card">
            <div className="section-header section-header-bg-4">
              <FileText className="h-4 w-4" /> Documents
            </div>
            <div className="section-body" style={{ display: 'block' }}>
              <div className="doc-grid">
                <div className="doc-item">
                  <div className="doc-title">📄 NID Card</div>
                  <div className="doc-value">{staff.nid_no || 'Not uploaded'}</div>
                </div>
                <div className="doc-item">
                  <div className="doc-title">🎓 Certificate</div>
                  <div className="doc-value">{staff.qualification || 'Not uploaded'}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="print-footer">
            <p>Generated from School Management System | {new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}</p>
          </div>
        </div>
      </div>

      {/* Screen Content */}
      <div className="space-y-6 print:hidden">
        {/* Header - Bright Colorful */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 sm:p-6 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 shadow-lg">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="hover:bg-white/20 text-white transition-all rounded-xl">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-white drop-shadow-md">Staff Profile</h1>
              <p className="text-white/80">Employee ID: {staff.employee_id}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePrint} className="bg-white/20 text-white border-white/30 hover:bg-white/30 hover:text-white transition-all rounded-xl">
              <Printer className="h-4 w-4 mr-2" />Print
            </Button>
            <Button variant="outline" onClick={handleEdit} className="bg-white/20 text-white border-white/30 hover:bg-white/30 hover:text-white transition-all rounded-xl">
              <Edit className="h-4 w-4 mr-2" />Edit
            </Button>
          </div>
        </div>

        {/* Profile Header - Bright Colorful */}
        <div className="relative rounded-2xl overflow-hidden shadow-xl">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2"></div>
          <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-white/5 rounded-full -translate-x-1/2 -translate-y-1/2"></div>
          
          <div className="relative z-10 p-6">
            <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
              <div className="relative group">
                <Avatar className="h-28 w-28 border-4 border-white shadow-xl transition-transform group-hover:scale-105 duration-300">
                  {staff.photo_url && <AvatarImage src={staff.photo_url} />}
                  <AvatarFallback className="text-2xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
                    {getInitials(staff.name)}
                  </AvatarFallback>
                </Avatar>
                <Dialog open={photoDialogOpen} onOpenChange={handlePhotoDialogChange}>
                  <DialogTrigger asChild>
                    <Button variant="secondary" size="icon" className="absolute bottom-0 right-0 h-8 w-8 rounded-full shadow-lg bg-white hover:bg-gray-100 transition-all">
                      <Camera className="h-4 w-4 text-gray-600" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Update Staff Photo</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div className="flex justify-center">
                        {photoPreview ? (
                          <div className="relative">
                            <img src={photoPreview} alt="Preview" className="h-40 w-40 object-cover rounded-full" />
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-500 text-white hover:bg-red-600" 
                              onClick={() => {
                                cleanupPhotoPreview();
                                setSelectedPhoto(null);
                                setPhotoPreview(null);
                              }}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="h-40 w-40 rounded-full bg-gray-100 flex items-center justify-center">
                            <Camera className="h-12 w-12 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="photo">Choose Photo</Label>
                        <Input id="photo" type="file" accept="image/*" onChange={handlePhotoSelect} className="mt-1 rounded-xl" />
                        <p className="text-xs text-text-muted mt-1">JPG, PNG, WEBP (max 2MB)</p>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => {
                          setPhotoDialogOpen(false);
                          cleanupPhotoPreview();
                          setSelectedPhoto(null);
                          setPhotoPreview(null);
                        }} className="rounded-xl">Cancel</Button>
                        <Button onClick={handlePhotoUpload} disabled={!selectedPhoto || uploading} className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600">
                          {uploading ? "Uploading..." : "Upload Photo"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="flex-1 text-center md:text-left">
                <h2 className="text-2xl md:text-3xl font-bold text-white drop-shadow-md">{staff.name}</h2>
                <p className="text-white/80 text-lg mt-1">{staff.designation}</p>
                <div className="flex flex-wrap gap-2 justify-center md:justify-start mt-3">
                  {getStatusBadge(staff.status)}
                  <Badge className="bg-white/20 text-white backdrop-blur-sm border-0">ID: {staff.employee_id}</Badge>
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2 text-center md:text-right">
                <p className="text-xs text-white/70">Joining Date</p>
                <p className="font-semibold text-white">{formatDateEnglish(staff.joining_date)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-3 mb-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`group relative flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all duration-300 overflow-hidden ${
                  isActive 
                    ? `bg-gradient-to-r ${tab.color} text-white shadow-lg transform scale-105` 
                    : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700"
                }`}
              >
                {!isActive && (
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-100 dark:via-gray-700 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-500"></span>
                )}
                <Icon className={`h-4 w-4 transition-transform duration-300 group-hover:scale-110 ${isActive ? "text-white" : "text-gray-500 dark:text-gray-400"}`} />
                <span>{tab.label}</span>
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-6 h-0.5 bg-white rounded-full animate-pulse"></span>
                )}
              </button>
            );
          })}
        </div>

        {/* Personal Info Tab */}
        {activeTab === "personal" && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-950/40 dark:to-indigo-950/40 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden border border-blue-200/50 dark:border-blue-800/30">
              <div className="border-b border-blue-200/50 dark:border-blue-800/30 bg-gradient-to-r from-blue-500 to-indigo-500 px-6 py-4">
                <h3 className="text-lg font-semibold flex items-center gap-2 text-white">
                  <User className="h-5 w-5" /> Personal Information
                </h3>
                <p className="text-sm text-blue-100">Complete personal details about the staff member</p>
              </div>
              <div className="p-6 bg-white/60 dark:bg-gray-800/30 backdrop-blur-sm">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white dark:bg-gray-800/80 rounded-xl p-3 shadow-md hover:shadow-lg transition-all border border-blue-100 dark:border-gray-700">
                    <span className="text-xs text-gray-500 dark:text-gray-300">Full Name (English)</span>
                    <p className="font-medium text-gray-800 dark:text-gray-100">{staff.name}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800/80 rounded-xl p-3 shadow-md hover:shadow-lg transition-all border border-blue-100 dark:border-gray-700">
                    <span className="text-xs text-gray-500 dark:text-gray-300">Name (Bangla)</span>
                    <p className="font-medium text-gray-800 dark:text-gray-100">{staff.name_bn || "—"}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800/80 rounded-xl p-3 shadow-md hover:shadow-lg transition-all border border-blue-100 dark:border-gray-700">
                    <span className="text-xs text-gray-500 dark:text-gray-300">Gender</span>
                    <p className="font-medium text-gray-800 dark:text-gray-100 capitalize">{staff.gender}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800/80 rounded-xl p-3 shadow-md hover:shadow-lg transition-all border border-blue-100 dark:border-gray-700">
                    <span className="text-xs text-gray-500 dark:text-gray-300">Date of Birth</span>
                    <p className="font-medium text-gray-800 dark:text-gray-100">{formatDateEnglish(staff.dob)}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800/80 rounded-xl p-3 shadow-md hover:shadow-lg transition-all border border-blue-100 dark:border-gray-700">
                    <span className="text-xs text-gray-500 dark:text-gray-300">Blood Group</span>
                    <p className="font-medium text-gray-800 dark:text-gray-100">{staff.blood_group || "—"}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800/80 rounded-xl p-3 shadow-md hover:shadow-lg transition-all border border-blue-100 dark:border-gray-700">
                    <span className="text-xs text-gray-500 dark:text-gray-300">NID Number</span>
                    <p className="font-medium text-gray-800 dark:text-gray-100">{staff.nid_no || "—"}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800/80 rounded-xl p-3 shadow-md hover:shadow-lg transition-all border border-blue-100 dark:border-gray-700">
                    <span className="text-xs text-gray-500 dark:text-gray-300">Father's Name</span>
                    <p className="font-medium text-gray-800 dark:text-gray-100">{staff.father_name || "—"}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800/80 rounded-xl p-3 shadow-md hover:shadow-lg transition-all border border-blue-100 dark:border-gray-700">
                    <span className="text-xs text-gray-500 dark:text-gray-300">Mother's Name</span>
                    <p className="font-medium text-gray-800 dark:text-gray-100">{staff.mother_name || "—"}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800/80 rounded-xl p-3 shadow-md hover:shadow-lg transition-all border border-blue-100 dark:border-gray-700">
                    <span className="text-xs text-gray-500 dark:text-gray-300">Contact Number</span>
                    <p className="font-medium text-gray-800 dark:text-gray-100">{staff.contact}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800/80 rounded-xl p-3 shadow-md hover:shadow-lg transition-all border border-blue-100 dark:border-gray-700">
                    <span className="text-xs text-gray-500 dark:text-gray-300">Email</span>
                    <p className="font-medium text-gray-800 dark:text-gray-100">{staff.email || "—"}</p>
                  </div>
                  <div className="col-span-full bg-white dark:bg-gray-800/80 rounded-xl p-3 shadow-md hover:shadow-lg transition-all border border-blue-100 dark:border-gray-700">
                    <span className="text-xs text-gray-500 dark:text-gray-300">Address</span>
                    <p className="font-medium text-gray-800 dark:text-gray-100">{staff.address || "—"}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Professional Info Tab */}
        {activeTab === "professional" && (
          <div className="bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-950/40 dark:to-orange-950/40 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden border border-amber-200/50 dark:border-amber-800/30">
            <div className="border-b border-amber-200/50 dark:border-amber-800/30 bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4">
              <h3 className="text-lg font-semibold flex items-center gap-2 text-white">
                <Briefcase className="h-5 w-5" /> Professional Information
              </h3>
              <p className="text-sm text-amber-100">Work and qualification details</p>
            </div>
            <div className="p-6 bg-white/60 dark:bg-gray-800/30 backdrop-blur-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800/80 rounded-xl p-3 shadow-md hover:shadow-lg transition-all border border-amber-100 dark:border-gray-700">
                  <span className="text-xs text-gray-500 dark:text-gray-300">Designation</span>
                  <p className="font-medium text-gray-800 dark:text-gray-100">{staff.designation}</p>
                </div>
                <div className="bg-white dark:bg-gray-800/80 rounded-xl p-3 shadow-md hover:shadow-lg transition-all border border-amber-100 dark:border-gray-700">
                  <span className="text-xs text-gray-500 dark:text-gray-300">Role</span>
                  <p className="font-medium text-gray-800 dark:text-gray-100 capitalize">{formatRole(staff.role)}</p>
                </div>
                <div className="bg-white dark:bg-gray-800/80 rounded-xl p-3 shadow-md hover:shadow-lg transition-all border border-amber-100 dark:border-gray-700">
                  <span className="text-xs text-gray-500 dark:text-gray-300">Qualification</span>
                  <p className="font-medium text-gray-800 dark:text-gray-100">{staff.qualification || "—"}</p>
                </div>
                <div className="bg-white dark:bg-gray-800/80 rounded-xl p-3 shadow-md hover:shadow-lg transition-all border border-amber-100 dark:border-gray-700">
                  <span className="text-xs text-gray-500 dark:text-gray-300">Experience</span>
                  <p className="font-medium text-gray-800 dark:text-gray-100">{staff.experience ? `${staff.experience} years` : "—"}</p>
                </div>
                <div className="bg-white dark:bg-gray-800/80 rounded-xl p-3 shadow-md hover:shadow-lg transition-all border border-amber-100 dark:border-gray-700">
                  <span className="text-xs text-gray-500 dark:text-gray-300">Joining Date</span>
                  <p className="font-medium text-gray-800 dark:text-gray-100">{formatDateEnglish(staff.joining_date)}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Salary Info Tab */}
        {activeTab === "salary" && (
          <div className="bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-950/40 dark:to-teal-950/40 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden border border-emerald-200/50 dark:border-emerald-800/30">
            <div className="border-b border-emerald-200/50 dark:border-emerald-800/30 bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-4">
              <h3 className="text-lg font-semibold flex items-center gap-2 text-white">
                <Banknote className="h-5 w-5" /> Salary Information
              </h3>
              <p className="text-sm text-emerald-100">Salary breakdown and details from database</p>
            </div>
            <div className="p-6 bg-white/60 dark:bg-gray-800/30 backdrop-blur-sm">
              <div className="bg-gradient-to-r from-gray-50 to-white dark:from-gray-800/50 dark:to-gray-800/30 rounded-xl p-6 border border-emerald-100 dark:border-gray-700">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-white dark:bg-gray-800/60 rounded-lg shadow-md hover:shadow-lg transition-all border border-emerald-100 dark:border-gray-700">
                    <span className="text-xs text-gray-500 dark:text-gray-300">Salary Category</span>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{staff.salary_category?.name || "—"}</p>
                  </div>
                  <div className="text-center p-3 bg-white dark:bg-gray-800/60 rounded-lg shadow-md hover:shadow-lg transition-all border border-emerald-100 dark:border-gray-700">
                    <span className="text-xs text-gray-500 dark:text-gray-300">Basic Salary</span>
                    <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400">৳{staff.salary_category?.basic?.toLocaleString() || 0}</p>
                  </div>
                  <div className="text-center p-3 bg-white dark:bg-gray-800/60 rounded-lg shadow-md hover:shadow-lg transition-all border border-emerald-100 dark:border-gray-700">
                    <span className="text-xs text-gray-500 dark:text-gray-300">House Rent (HRA)</span>
                    <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">৳{staff.salary_category?.hra?.toLocaleString() || 0}</p>
                  </div>
                  <div className="text-center p-3 bg-white dark:bg-gray-800/60 rounded-lg shadow-md hover:shadow-lg transition-all border border-emerald-100 dark:border-gray-700">
                    <span className="text-xs text-gray-500 dark:text-gray-300">Dearness Allowance (DA)</span>
                    <p className="text-xl font-bold text-amber-600 dark:text-amber-400">৳{staff.salary_category?.da?.toLocaleString() || 0}</p>
                  </div>
                  <div className="text-center p-3 bg-white dark:bg-gray-800/60 rounded-lg shadow-md hover:shadow-lg transition-all border border-emerald-100 dark:border-gray-700">
                    <span className="text-xs text-gray-500 dark:text-gray-300">Other Allowances</span>
                    <p className="text-xl font-bold text-blue-600 dark:text-blue-400">৳{staff.salary_category?.allowances?.toLocaleString() || 0}</p>
                  </div>
                  <div className="text-center p-3 bg-red-50 dark:bg-red-950/30 rounded-lg shadow-md hover:shadow-lg transition-all border border-red-200 dark:border-red-800/30">
                    <span className="text-xs text-red-500 dark:text-red-400">Deductions</span>
                    <p className="text-xl font-bold text-red-600 dark:text-red-400">-৳{staff.salary_category?.deductions?.toLocaleString() || 0}</p>
                  </div>
                </div>
                <div className="flex justify-between items-center mt-6 pt-4 border-t-2 border-emerald-200 dark:border-emerald-800/30">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">Total Monthly Salary</span>
                  <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">৳{calculateTotalSalary().toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Documents Tab */}
        {activeTab === "documents" && (
          <div className="bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-950/40 dark:to-pink-950/40 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden border border-purple-200/50 dark:border-purple-800/30">
            <div className="border-b border-purple-200/50 dark:border-purple-800/30 bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-4">
              <h3 className="text-lg font-semibold flex items-center gap-2 text-white">
                <FileText className="h-5 w-5" /> Documents
              </h3>
              <p className="text-sm text-purple-100">Uploaded documents and certificates</p>
            </div>
            <div className="p-6 bg-white/60 dark:bg-gray-800/30 backdrop-blur-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border-2 border-purple-200 dark:border-purple-800/30 rounded-xl p-4 hover:shadow-lg transition-all bg-white dark:bg-gray-800/80">
                  <h3 className="font-semibold flex items-center gap-2 dark:text-gray-200"><FileText className="h-4 w-4 text-indigo-500" />NID Card</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-300">{staff.nid_no || "Not uploaded"}</p>
                </div>
                <div className="border-2 border-purple-200 dark:border-purple-800/30 rounded-xl p-4 hover:shadow-lg transition-all bg-white dark:bg-gray-800/80">
                  <h3 className="font-semibold flex items-center gap-2 dark:text-gray-200"><Award className="h-4 w-4 text-amber-500" />Certificate</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-300">{staff.qualification || "Not uploaded"}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ResponsiveLayout>
  );
}