"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Save, User, Briefcase, Contact, Banknote, MapPin, Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { ResponsiveLayout } from "@/components/layout/responsive-layout";
import { getStaffById, updateStaff, getSalaryCategories, updateStaffPhoto } from "@/lib/api/staff";
import { useToastStore } from "@/store/useStore";
import { createClient } from "@/lib/supabase/client";

// ✅ Singleton Supabase client
const supabase = createClient();

// ✅ Constants
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

const staffEditSchema = z.object({
  name: z.string().min(2, "Name is required"),
  name_bn: z.string().optional(),
  father_name: z.string().optional(),
  mother_name: z.string().optional(),
  nid_no: z.string().optional(),
  designation: z.string().min(1, "Designation is required"),
  role: z.string().min(1, "Role is required"),
  qualification: z.string().optional(),
  experience: z.string().optional(),
  dob: z.string().optional(),
  gender: z.string().min(1, "Gender is required"),
   joining_date: z.string().min(1, "Joining Date is required"),
  address: z.string().optional(),
  village: z.string().optional(),
  post_office: z.string().optional(),
  police_station: z.string().optional(),
  district: z.string().optional(),
  contact: z.string().min(11, "Valid contact is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  salary_category_id: z.string().optional(),
  status: z.string().optional(),
});

type StaffEditFormData = z.infer<typeof staffEditSchema>;

const qualificationOptions = [
  "M.A in Education", "B.A in Education", "M.Sc", "B.Sc",
  "HSC", "SSC", "Diploma in Education", "Bachelor of Education (B.Ed)",
];

const genderOptions = ["Male", "Female", "Other"];
const roleOptions = ["teacher", "admin_staff", "support_staff"];
const statusOptions = ["active", "on_leave", "resigned", "terminated"];

// ✅ Get matched salary category with precise logic
const getMatchedSalaryCategory = (designation: string, categories: any[]) => {
  if (!designation || !categories.length) return null;
  
  // First try exact match
  let matched = categories.find(cat => 
    cat.name.toLowerCase() === designation.toLowerCase()
  );
  
  // Then try starts with
  if (!matched) {
    matched = categories.find(cat => 
      cat.name.toLowerCase().startsWith(designation.toLowerCase())
    );
  }
  
  // Then try includes with word boundary
  if (!matched) {
    matched = categories.find(cat => {
      const words = designation.toLowerCase().split(' ');
      return words.some(word => 
        cat.name.toLowerCase().includes(word) && word.length > 2
      );
    });
  }
  
  return matched;
};

const TabCard = ({ children, color }: { children: React.ReactNode; color: string }) => (
  <div className={`bg-gradient-to-br ${color} rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden border border-white/20 dark:border-gray-700/30`}>
    {children}
  </div>
);

export default function EditStaffPage() {
  const router = useRouter();
  const params = useParams();
  const staffId = params.id as string;
  
  // ✅ Mounted ref for preventing state update after unmount
  const isMounted = useRef(true);
  
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [salaryCategories, setSalaryCategories] = useState<{ id: string; name: string; basic: number }[]>([]);
  const [designationOptions, setDesignationOptions] = useState<string[]>([]);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");
  const addToast = useToastStore((state) => state.addToast);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<StaffEditFormData>({
    resolver: zodResolver(staffEditSchema),
  });

  // ✅ Optimized watch usage
  const watchedValues = useMemo(() => ({
    status: watch("status"),
    designation: watch("designation"),
    salary_category_id: watch("salary_category_id"),
    name: watch("name"),
  }), [watch]);

  const currentStatus = watchedValues.status;
  const selectedSalaryCategoryId = watchedValues.salary_category_id;

  // ✅ Cleanup photo preview on unmount
  useEffect(() => {
    return () => {
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  // ✅ Unmount safe
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // ✅ Clean useEffect with proper dependencies
  useEffect(() => {
    async function loadData() {
      try {
        const [staffData, categoriesData] = await Promise.all([
          getStaffById(staffId),
          getSalaryCategories().catch(() => []),
        ]);

        // ✅ Only update state if component is still mounted
        if (!isMounted.current) return;

        setSalaryCategories(categoriesData || []);
        
        const derivedDesignations = (categoriesData || []).map((cat: any) => {
          let designationName = cat.name;
          designationName = designationName.replace(/ Grade \d+$/, "");
          return designationName;
        });
        
        const uniqueDesignations = [...new Set(derivedDesignations)];
        setDesignationOptions(uniqueDesignations);

        if (staffData) {
          setValue("name", staffData.name || "");
          setValue("name_bn", staffData.name_bn || "");
          setValue("father_name", staffData.father_name || "");
          setValue("mother_name", staffData.mother_name || "");
          setValue("nid_no", staffData.nid_no || "");
          setValue("designation", staffData.designation || "");
          setValue("role", staffData.role || "");
          setValue("qualification", staffData.qualification || "");
          setValue("experience", staffData.experience?.toString() || "");
          setValue("dob", staffData.dob || "");
          setValue("gender", staffData.gender || "");
          setValue("joining_date", staffData.joining_date || "");
          setValue("address", staffData.address || "");
          setValue("village", staffData.village || "");
          setValue("post_office", staffData.post_office || "");
          setValue("police_station", staffData.police_station || "");
          setValue("district", staffData.district || "");
          setValue("contact", staffData.contact || "");
          setValue("email", staffData.email || "");
          setValue("salary_category_id", staffData.salary_category_id || "");
          setValue("status", staffData.status || "active");
          
          setPhotoPreview(staffData.photo_url || null);
        } else {
          if (isMounted.current) {
            addToast({ type: "error", title: "Not Found", message: "Staff member not found." });
            router.push("/staff/list");
          }
        }
      } catch (err) {
        if (!isMounted.current) return;
        console.error("Failed to load data:", err);
        addToast({ type: "error", title: "Error", message: "Failed to load staff data." });
      } finally {
        if (isMounted.current) {
          setLoadingData(false);
        }
      }
    }
    loadData();
  }, [staffId]);

  // ✅ Auto-select salary category with improved logic - FIXED
  useEffect(() => {
    const selectedDesignation = watchedValues.designation;
    if (selectedDesignation && salaryCategories.length > 0 && !watchedValues.salary_category_id) {
      const matched = getMatchedSalaryCategory(selectedDesignation, salaryCategories);
      if (matched) {
        setValue("salary_category_id", matched.id);
      }
    }
  }, [watchedValues.designation, salaryCategories, watchedValues.salary_category_id, setValue]);

  // ✅ File upload with safety checks
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file type
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        addToast({ 
          type: "error", 
          title: "Error", 
          message: "Please upload a valid image file (JPG, PNG, WEBP)" 
        });
        e.target.value = '';
        return;
      }
      
      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        addToast({ 
          type: "error", 
          title: "Error", 
          message: "Photo size must be less than 2MB" 
        });
        e.target.value = '';
        return;
      }
      
      // Cleanup previous preview
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview);
      }
      
      setSelectedPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handlePhotoUpload = async () => {
    if (!selectedPhoto || !staffId) return;

    setUploading(true);
    try {
      const fileExt = selectedPhoto.name.split(".").pop();
      const fileName = `${staffId}/photo_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("staff-documents")
        .upload(fileName, selectedPhoto, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("staff-documents")
        .getPublicUrl(fileName);

      const result = await updateStaffPhoto(staffId, publicUrl);

      if (result.success) {
        setPhotoPreview(publicUrl);
        addToast({ type: "success", title: "Success", message: "Photo updated successfully." });
        setPhotoDialogOpen(false);
        // Cleanup
        if (photoPreview) {
          URL.revokeObjectURL(photoPreview);
        }
        setSelectedPhoto(null);
      } else {
        addToast({ type: "error", title: "Upload Failed", message: result.error || "Failed to update photo." });
      }
    } catch (err) {
      console.error("Failed to upload photo:", err);
      addToast({ type: "error", title: "Error", message: "An unexpected error occurred." });
    } finally {
      setUploading(false);
    }
  };

  // ✅ Fixed onSubmit - removed resign_date and resign_reason
  const onSubmit = async (data: StaffEditFormData) => {
    setLoading(true);
    try {
      await updateStaff(staffId, {
        name: data.name,
        name_bn: data.name_bn || "",
        father_name: data.father_name,
        mother_name: data.mother_name,
        nid_no: data.nid_no,
        designation: data.designation,
        role: data.role as any,
        qualification: data.qualification,
        experience: data.experience ? parseInt(data.experience) : undefined,
        dob: data.dob,
        gender: data.gender as any,
        joining_date: data.joining_date,
        address: data.address,
        village: data.village,
        post_office: data.post_office,
        police_station: data.police_station,
        district: data.district,
        contact: data.contact,
        email: data.email,
        salary_category_id: data.salary_category_id,
        status: data.status as any,
      });

      addToast({ type: "success", title: "Success", message: "Staff information updated successfully." });
      router.push("/staff/list");
    } catch (err) {
      console.error("Failed to update staff:", err);
      addToast({ type: "error", title: "Update Failed", message: "Failed to update staff information." });
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string) => name?.split(" ").map(n => n[0]).join("").toUpperCase() || "?";

  const tabs = [
    { id: "basic", label: "Basic Info", icon: User, color: "from-blue-500 to-indigo-500" },
    { id: "family", label: "Family", icon: Contact, color: "from-emerald-500 to-teal-500" },
    { id: "address", label: "Address", icon: MapPin, color: "from-cyan-500 to-blue-500" },
    { id: "professional", label: "Professional", icon: Briefcase, color: "from-amber-500 to-orange-500" },
    { id: "salary", label: "Salary", icon: Banknote, color: "from-purple-500 to-pink-500" },
  ];

  if (loadingData) {
    return (
      <ResponsiveLayout>
        <div className="flex justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </ResponsiveLayout>
    );
  }

  return (
    <ResponsiveLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 sm:p-6 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 shadow-lg">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="hover:bg-white/20 text-white transition-all rounded-xl">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-white drop-shadow-md">Edit Staff</h1>
              <p className="text-white/80">Update staff information</p>
            </div>
          </div>
        </div>

        {/* Profile Photo Card - Solid Background */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md p-6 transition-all hover:shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-6 flex-wrap">
            <Avatar className="h-24 w-24 border-4 border-indigo-200 dark:border-indigo-800 shadow-lg transition-transform hover:scale-105 duration-300">
              {photoPreview && <AvatarImage src={photoPreview} />}
              <AvatarFallback className="text-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
                {getInitials(watchedValues.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <Dialog open={photoDialogOpen} onOpenChange={setPhotoDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" type="button" className="hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all rounded-xl dark:border-gray-600 dark:text-gray-300">
                    <Camera className="h-4 w-4 mr-2" /> Change Photo
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                  <DialogHeader>
                    <DialogTitle className="dark:text-gray-100">Update Staff Photo</DialogTitle>
                    <DialogDescription className="dark:text-gray-400">Choose a new photo for the staff member</DialogDescription>
                  </DialogHeader>
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
                              if (photoPreview) {
                                URL.revokeObjectURL(photoPreview);
                              }
                              setSelectedPhoto(null);
                              setPhotoPreview(null);
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="h-40 w-40 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                          <Camera className="h-12 w-12 text-gray-400 dark:text-gray-500" />
                        </div>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="photo" className="dark:text-gray-300">Choose Photo</Label>
                      <Input id="photo" type="file" accept="image/*" onChange={handlePhotoSelect} className="mt-1 rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 dark:text-gray-100" />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">JPG, PNG, WEBP (max 2MB)</p>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setPhotoDialogOpen(false)} className="rounded-xl border border-gray-300 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800">Cancel</Button>
                      <Button 
                        onClick={handlePhotoUpload} 
                        disabled={!selectedPhoto || uploading} 
                        className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:shadow-lg transition-all text-white"
                      >
                        {uploading ? "Uploading..." : "Upload Photo"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">JPG, PNG, WEBP (max 2MB)</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
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
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all duration-300 ${
                    isActive 
                      ? `bg-gradient-to-r ${tab.color} text-white shadow-lg transform scale-105` 
                      : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Basic Info Tab - Solid Background */}
          {activeTab === "basic" && (
            <TabCard color="from-blue-100 to-indigo-100 dark:from-blue-950/40 dark:to-indigo-950/40">
              <CardHeader className="border-b border-blue-200/50 dark:border-blue-800/30 bg-gradient-to-r from-blue-500 to-indigo-500">
                <CardTitle className="flex items-center gap-2 text-white">
                  <User className="h-5 w-5" /> Basic Information
                </CardTitle>
                <CardDescription className="text-blue-100">Personal details of the staff member</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4 bg-white dark:bg-gray-800">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label className="dark:text-gray-300">Full Name (English) *</Label>
                    <Input {...register("name")} className={errors.name ? "border-red-500 rounded-xl bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 dark:text-gray-100" : "rounded-xl bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 dark:text-gray-100"} />
                    {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
                  </div>
                  <div>
                    <Label className="dark:text-gray-300">Full Name (Bangla)</Label>
                    <Input {...register("name_bn")} className="rounded-xl bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 dark:text-gray-100" />
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label className="dark:text-gray-300">Gender *</Label>
                    <Select onValueChange={(v) => setValue("gender", v)} value={watch("gender")}>
                      <SelectTrigger className="rounded-xl bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 dark:text-gray-100">
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                        {genderOptions.map(g => <SelectItem key={g} value={g.toLowerCase()} className="dark:text-gray-200 dark:hover:bg-gray-700">{g}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="dark:text-gray-300">Date of Birth</Label>
                    <Input type="date" {...register("dob")} className="rounded-xl bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 dark:text-gray-100" />
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label className="dark:text-gray-300">NID Number</Label>
                    <Input {...register("nid_no")} className="rounded-xl bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 dark:text-gray-100" />
                  </div>
                   <div>
                     <Label className="dark:text-gray-300">Joining Date <span className="text-red-500">*</span></Label>
                     <Input 
                       type="date" 
                       {...register("joining_date")} 
                       className={errors.joining_date ? "border-red-500 rounded-xl bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 dark:text-gray-100" : "rounded-xl bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 dark:text-gray-100"}
                       required
                     />
                     {errors.joining_date && <p className="text-red-500 text-xs mt-1">{errors.joining_date.message}</p>}
                   </div>
                </div>
                <div>
                  <Label className="dark:text-gray-300">Contact Number *</Label>
                  <Input {...register("contact")} className={errors.contact ? "border-red-500 rounded-xl bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 dark:text-gray-100" : "rounded-xl bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 dark:text-gray-100"} />
                  {errors.contact && <p className="text-red-500 text-xs mt-1">{errors.contact.message}</p>}
                </div>
              </CardContent>
            </TabCard>
          )}

          {/* Family Info Tab - Solid Background */}
          {activeTab === "family" && (
            <TabCard color="from-emerald-100 to-teal-100 dark:from-emerald-950/40 dark:to-teal-950/40">
              <CardHeader className="border-b border-emerald-200/50 dark:border-emerald-800/30 bg-gradient-to-r from-emerald-500 to-teal-500">
                <CardTitle className="flex items-center gap-2 text-white">
                  <Contact className="h-5 w-5" /> Family Information
                </CardTitle>
                <CardDescription className="text-emerald-100">Parent and guardian details</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4 bg-white dark:bg-gray-800">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label className="dark:text-gray-300">Father's Name</Label>
                    <Input {...register("father_name")} className="rounded-xl bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 dark:text-gray-100" />
                  </div>
                  <div>
                    <Label className="dark:text-gray-300">Mother's Name</Label>
                    <Input {...register("mother_name")} className="rounded-xl bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 dark:text-gray-100" />
                  </div>
                </div>
                <div>
                  <Label className="dark:text-gray-300">Email Address</Label>
                  <Input type="email" {...register("email")} className={errors.email ? "border-red-500 rounded-xl bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 dark:text-gray-100" : "rounded-xl bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 dark:text-gray-100"} />
                  {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
                </div>
              </CardContent>
            </TabCard>
          )}

          {/* Address Tab - Solid Background */}
          {activeTab === "address" && (
            <TabCard color="from-cyan-100 to-blue-100 dark:from-cyan-950/40 dark:to-blue-950/40">
              <CardHeader className="border-b border-cyan-200/50 dark:border-cyan-800/30 bg-gradient-to-r from-cyan-500 to-blue-500">
                <CardTitle className="flex items-center gap-2 text-white">
                  <MapPin className="h-5 w-5" /> Address Information
                </CardTitle>
                <CardDescription className="text-cyan-100">Present address of the staff member</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4 bg-white dark:bg-gray-800">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label className="dark:text-gray-300">District</Label>
                    <Input {...register("district")} className="rounded-xl bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 dark:text-gray-100" />
                  </div>
                  <div>
                    <Label className="dark:text-gray-300">Police Station</Label>
                    <Input {...register("police_station")} className="rounded-xl bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 dark:text-gray-100" />
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label className="dark:text-gray-300">Post Office</Label>
                    <Input {...register("post_office")} className="rounded-xl bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 dark:text-gray-100" />
                  </div>
                  <div>
                    <Label className="dark:text-gray-300">Village</Label>
                    <Input {...register("village")} className="rounded-xl bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 dark:text-gray-100" />
                  </div>
                </div>
                <div>
                  <Label className="dark:text-gray-300">Present Address</Label>
                  <Textarea {...register("address")} className="rounded-xl bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 dark:text-gray-100 dark:placeholder:text-gray-400" />
                </div>
              </CardContent>
            </TabCard>
          )}

          {/* Professional Tab - Solid Background */}
          {activeTab === "professional" && (
            <TabCard color="from-amber-100 to-orange-100 dark:from-amber-950/40 dark:to-orange-950/40">
              <CardHeader className="border-b border-amber-200/50 dark:border-amber-800/30 bg-gradient-to-r from-amber-500 to-orange-500">
                <CardTitle className="flex items-center gap-2 text-white">
                  <Briefcase className="h-5 w-5" /> Professional Information
                </CardTitle>
                <CardDescription className="text-amber-100">Work and qualification details</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4 bg-white dark:bg-gray-800">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label className="dark:text-gray-300">Designation *</Label>
                    <Select onValueChange={(v) => setValue("designation", v)} value={watch("designation")}>
                      <SelectTrigger className="rounded-xl bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 dark:text-gray-100">
                        <SelectValue placeholder="Select designation" />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                        {designationOptions.map(d => <SelectItem key={d} value={d} className="dark:text-gray-200 dark:hover:bg-gray-700">{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="dark:text-gray-300">Role *</Label>
                    <Select onValueChange={(v) => setValue("role", v)} value={watch("role")}>
                      <SelectTrigger className="rounded-xl bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 dark:text-gray-100">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                        {roleOptions.map(r => <SelectItem key={r} value={r} className="dark:text-gray-200 dark:hover:bg-gray-700">{r.replace("_", " ")}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label className="dark:text-gray-300">Qualification</Label>
                    <Select onValueChange={(v) => setValue("qualification", v)} value={watch("qualification")}>
                      <SelectTrigger className="rounded-xl bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 dark:text-gray-100">
                        <SelectValue placeholder="Select qualification" />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                        {qualificationOptions.map(q => <SelectItem key={q} value={q} className="dark:text-gray-200 dark:hover:bg-gray-700">{q}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="dark:text-gray-300">Experience (Years)</Label>
                    <Input type="number" {...register("experience")} className="rounded-xl bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 dark:text-gray-100" />
                  </div>
                </div>
              </CardContent>
            </TabCard>
          )}

          {/* Salary Tab - Solid Background */}
          {activeTab === "salary" && (
            <TabCard color="from-purple-100 to-pink-100 dark:from-purple-950/40 dark:to-pink-950/40">
              <CardHeader className="border-b border-purple-200/50 dark:border-purple-800/30 bg-gradient-to-r from-purple-500 to-pink-500">
                <CardTitle className="flex items-center gap-2 text-white">
                  <Banknote className="h-5 w-5" /> Salary & Status
                </CardTitle>
                <CardDescription className="text-purple-100">Salary category and employment status</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4 bg-white dark:bg-gray-800">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label className="dark:text-gray-300">Salary Category</Label>
                    <Select onValueChange={(v) => setValue("salary_category_id", v)} value={watch("salary_category_id")}>
                      <SelectTrigger className="rounded-xl bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 dark:text-gray-100">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                        {salaryCategories.map(cat => (
                          <SelectItem key={cat.id} value={cat.id} className="dark:text-gray-200 dark:hover:bg-gray-700">
                            {cat.name} - ৳{cat.basic?.toLocaleString()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="dark:text-gray-300">Status</Label>
                    <Select onValueChange={(v) => setValue("status", v)} value={currentStatus}>
                      <SelectTrigger className="rounded-xl bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 dark:text-gray-100">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                        {statusOptions.map(s => <SelectItem key={s} value={s} className="dark:text-gray-200 dark:hover:bg-gray-700">{s.replace("_", " ")}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {currentStatus === "resigned" && (
                  <div className="text-sm text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30 p-3 rounded-xl animate-pulse border border-orange-200 dark:border-orange-800/30">
                    ⚠️ This staff member is marked as resigned. Records are preserved.
                  </div>
                )}
              </CardContent>
            </TabCard>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-4 mt-8">
            <Button variant="outline" type="button" onClick={() => router.back()} className="rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 transition-all">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-xl shadow-md hover:shadow-lg transition-all text-white">
              <Save className="h-4 w-4 mr-2" />
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </ResponsiveLayout>
  );
}