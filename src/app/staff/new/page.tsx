"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  User,
  Briefcase,
  Camera,
  ChevronRight,
  ChevronLeft,
  Save,
  Users,
  Home,
  GraduationCap,
  DollarSign,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Mail,
  Phone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ResponsiveLayout } from "@/components/layout/responsive-layout";
import { createStaff, getSalaryCategories } from "@/lib/api/staff";
import { useToastStore } from "@/store/useStore";
import { createClient } from "@/lib/supabase/client";

const staffSchema = z.object({
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
});

type StaffFormData = z.infer<typeof staffSchema>;

const sections = [
  {
    id: "basic",
    title: "Basic Details",
    subtitle: "Personal identification & contact info",
    icon: User,
    fields: ["name", "name_bn", "gender", "dob", "nid_no", "joining_date", "contact"],
    gradient: "from-blue-600 to-indigo-600",
  },
  {
    id: "family",
    title: "Family Profile",
    subtitle: "Parental and emergency contacts",
    icon: Users,
    fields: ["father_name", "mother_name", "email"],
    gradient: "from-emerald-600 to-teal-600",
  },
  {
    id: "address",
    title: "Residential Address",
    subtitle: "Permanent & present location details",
    icon: Home,
    fields: ["district", "police_station", "post_office", "village", "address"],
    gradient: "from-cyan-600 to-blue-600",
  },
  {
    id: "professional",
    title: "Career & Roles",
    subtitle: "Designation, role & qualifications",
    icon: GraduationCap,
    fields: ["designation", "role", "qualification", "experience"],
    gradient: "from-amber-500 to-orange-600",
  },
  {
    id: "salary",
    title: "Payroll & Salary",
    subtitle: "Salary structure and scale mapping",
    icon: DollarSign,
    fields: ["salary_category_id"],
    gradient: "from-purple-600 to-pink-600",
  },
];

const roleOptions = [
  { value: "admin", label: "Admin" },
  { value: "teacher", label: "Teacher" },
  { value: "staff", label: "Staff" },
  { value: "accountant", label: "Accountant" },
  { value: "store", label: "Store Keeper" },
];

const qualificationOptions = [
  "M.A in Education",
  "B.A in Education",
  "M.Sc",
  "B.Sc",
  "HSC",
  "SSC",
  "Diploma in Education",
  "Bachelor of Education (B.Ed)",
];

export default function NewStaffPage() {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState(0);
  const [salaryCategories, setSalaryCategories] = useState<any[]>([]);
  const [designationOptions, setDesignationOptions] = useState<{ name: string; salaryCategoryId: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [districts, setDistricts] = useState<any[]>([]);
  const [policeStations, setPoliceStations] = useState<any[]>([]);
  const [postOffices, setPostOffices] = useState<any[]>([]);
  const [villages, setVillages] = useState<any[]>([]);
  const addToast = useToastStore((state) => state.addToast);

  const sectionRefs = {
    basic: useRef<HTMLDivElement>(null),
    family: useRef<HTMLDivElement>(null),
    address: useRef<HTMLDivElement>(null),
    professional: useRef<HTMLDivElement>(null),
    salary: useRef<HTMLDivElement>(null),
  };

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<StaffFormData>({
    resolver: zodResolver(staffSchema),
    defaultValues: {
      gender: "",
      role: "",
      designation: "",
      experience: "",
    },
  });

  const selectedDesignation = watch("designation");
  const selectedSalaryCategoryId = watch("salary_category_id");
  const staffNameWatch = watch("name");
  const staffRoleWatch = watch("role");

  useEffect(() => {
    async function loadData() {
      try {
        const [categories, districtsData, policeData, postData, villageData] = await Promise.all([
          getSalaryCategories(),
          fetch("/api/address/districts").then(res => res.json()).catch(() => []),
          fetch("/api/address/police-stations").then(res => res.json()).catch(() => []),
          fetch("/api/address/post-offices").then(res => res.json()).catch(() => []),
          fetch("/api/address/villages").then(res => res.json()).catch(() => []),
        ]);

        setSalaryCategories(categories || []);

        const derivedDesignations = (categories || []).map((cat: any) => ({
          name: cat.name.replace(" Grade", ""),
          salary_category_id: cat.id,
        }));

        const uniqueDesignations = derivedDesignations.filter(
          (d, index, self) => self.findIndex(t => t.name === d.name) === index
        );

        setDesignationOptions(uniqueDesignations);
        setDistricts(districtsData || []);
        setPoliceStations(policeData || []);
        setPostOffices(postData || []);
        setVillages(villageData || []);
      } catch (err) {
        console.error("Failed to load data:", err);
      }
    }
    loadData();
  }, []);

  useEffect(() => {
    if (selectedDesignation && designationOptions.length > 0) {
      const matched = designationOptions.find(
        (d) => d.name.toLowerCase() === selectedDesignation.toLowerCase()
      );
      if (matched) {
        setValue("salary_category_id", matched.salary_category_id);
      }
    }
  }, [selectedDesignation, designationOptions, setValue]);

  const findSectionByField = (fieldName: string): number => {
    if (!fieldName) return 0;
    const index = sections.findIndex(section => {
      if (!section.fields || !Array.isArray(section.fields)) return false;
      return section.fields.includes(fieldName);
    });
    return index !== -1 ? index : 0;
  };

  const scrollToErrorSection = (errorsObj: any) => {
    if (!errorsObj) return;

    const errorFields = Object.keys(errorsObj);
    if (errorFields.length === 0) return;

    const firstErrorField = errorFields[0];
    const sectionIndex = findSectionByField(firstErrorField);

    setActiveSection(sectionIndex);

    setTimeout(() => {
      const sectionId = sections[sectionIndex]?.id;
      if (!sectionId) return;

      const sectionRef = sectionRefs[sectionId as keyof typeof sectionRefs];
      if (sectionRef?.current) {
        sectionRef.current.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }

      const errorElement = document.querySelector(`[name="${firstErrorField}"]`);
      if (errorElement) {
        errorElement.scrollIntoView({ behavior: "smooth", block: "center" });
        errorElement.classList.add("ring-2", "ring-red-500", "ring-offset-2");
        setTimeout(() => {
          errorElement.classList.remove("ring-2", "ring-red-500", "ring-offset-2");
        }, 2000);
      }
    }, 100);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        addToast({ type: "error", title: "Error", message: "Photo size must be less than 2MB" });
        return;
      }
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const uploadPhoto = async (staffId: string): Promise<string | null> => {
    if (!photoFile) return null;
    const supabase = createClient();
    const fileExt = photoFile.name.split(".").pop();
    const fileName = `${staffId}/photo_${Date.now()}.${fileExt}`;
    const { error } = await supabase.storage.from("staff-documents").upload(fileName, photoFile);
    if (error) {
      console.error("Upload error:", error);
      return null;
    }
    const { data: { publicUrl } } = supabase.storage.from("staff-documents").getPublicUrl(fileName);

    const { error: updateError } = await supabase
      .from('staff')
      .update({ photo_url: publicUrl })
      .eq('id', staffId);

    if (updateError) {
      console.error("Update error:", updateError);
      return null;
    }
    return publicUrl;
  };

  const onFormSubmit = async (data: StaffFormData) => {
    setIsSubmitting(true);
    try {
      let experienceNum: number | undefined;
      if (data.experience) {
        const cleanExp = data.experience
          .replace(/[০]/g, '0')
          .replace(/[১]/g, '1')
          .replace(/[২]/g, '2')
          .replace(/[৩]/g, '3')
          .replace(/[৪]/g, '4')
          .replace(/[৫]/g, '5')
          .replace(/[৬]/g, '6')
          .replace(/[৭]/g, '7')
          .replace(/[৮]/g, '8')
          .replace(/[৯]/g, '9')
          .replace(/[^0-9.]/g, '');

        const parsed = parseFloat(cleanExp);
        if (!isNaN(parsed)) {
          experienceNum = parsed;
        }
      }

      const result = await createStaff({
        name: data.name,
        name_bn: data.name_bn,
        father_name: data.father_name,
        mother_name: data.mother_name,
        nid_no: data.nid_no,
        designation: data.designation,
        role: data.role as any,
        qualification: data.qualification,
        experience: experienceNum,
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
      });

      if (result?.data?.id && photoFile) {
        await uploadPhoto(result.data.id);
      }

      addToast({ type: "success", title: "Success", message: `${data.name} has been added successfully.` });
      router.push("/staff/list");
    } catch (err: any) {
      console.error("Failed to create staff:", err);
      addToast({ type: "error", title: "Failed", message: err.message || "Failed to add staff member." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSubmit = async () => {
    await handleSubmit(
      onFormSubmit,
      (errors) => {
        scrollToErrorSection(errors);
        addToast({
          type: "error",
          title: "Validation Error",
          message: "Please check the highlighted fields."
        });
      }
    )();
  };

  const nextSection = () => {
    if (activeSection < sections.length - 1) setActiveSection(activeSection + 1);
  };

  const prevSection = () => {
    if (activeSection > 0) setActiveSection(activeSection - 1);
  };

  const getSelectedCategoryDetails = () => {
    return salaryCategories.find((c: any) => c.id === selectedSalaryCategoryId);
  };

  const fieldStyles = {
    input: "h-11 rounded-xl bg-gray-50/50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700/60 focus:bg-white dark:focus:bg-gray-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium",
    select: "h-11 rounded-xl bg-gray-50/50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700/60 focus:bg-white dark:focus:bg-gray-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium",
    textarea: "rounded-xl bg-gray-50/50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700/60 focus:bg-white dark:focus:bg-gray-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium",
    label: "text-xs uppercase tracking-wider font-semibold text-gray-500 dark:text-gray-400 mb-1.5 flex items-center gap-1",
  };

  return (
    <ResponsiveLayout>
      <div className="max-w-6xl mx-auto space-y-6 pb-16 px-3 sm:px-6">
        
        {/* Top Header Controls */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild className="rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300">
            <Link href="/staff/list" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Staff List</span>
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/50 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> Onboarding Console
            </span>
          </div>
        </div>

        {/* Compact Dynamic Profile Hero Banner (Resized Gradient Heights) */}
        <div className="relative rounded-3xl overflow-hidden border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl">
          {/* Blue (70% reduced prominence) to Purple (50% reduced prominence) visible gradient */}
          <div className="h-14 sm:h-16 bg-gradient-to-r from-green-600 via-emerald-600 to-fuchsia-600 relative overflow-hidden">
            <div className="absolute inset-0 bg-white/10 dark:bg-transparent bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] opacity-30"></div>
          </div>

          <div className="px-5 pb-5 pt-0 relative flex flex-col md:flex-row items-center md:items-end justify-between gap-4 -mt-8 sm:-mt-10">
            <div className="flex flex-col md:flex-row items-center md:items-end gap-4 text-center md:text-left">
              <div className="relative group">
                <Avatar className="h-18 w-18 sm:h-20 sm:w-20 rounded-2xl border-4 border-white dark:border-gray-900 shadow-xl bg-white dark:bg-gray-800 transition-transform duration-300 group-hover:scale-105">
                  {photoPreview && <AvatarImage src={photoPreview} className="object-cover" />}
                  <AvatarFallback className="rounded-2xl bg-slate-100 dark:bg-gray-800 text-gray-400">
                    <User className="h-8 w-8" />
                  </AvatarFallback>
                </Avatar>
                <label 
                  htmlFor="photo-upload" 
                  className="absolute -bottom-1 -right-1 p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg cursor-pointer transition-all duration-200 hover:scale-110 border-2 border-white dark:border-gray-900"
                >
                  <Camera className="h-3.5 w-3.5" />
                  <input id="photo-upload" type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                </label>
              </div>

              <div className="space-y-0.5 mb-1">
                <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white flex items-center justify-center md:justify-start gap-2">
                  {staffNameWatch || "New Staff Member"}
                </h1>
                <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center justify-center md:justify-start gap-1.5">
                  <Briefcase className="h-3.5 w-3.5 text-indigo-500" />
                  {selectedDesignation || "Designation Pending"} • {staffRoleWatch ? staffRoleWatch.toUpperCase().replace('_', ' ') : "Role Unassigned"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <Button 
                type="button" 
                onClick={onSubmit} 
                disabled={isSubmitting} 
                className="w-full md:w-auto h-10 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all duration-200 font-semibold text-sm flex items-center justify-center gap-2"
              >
                <Save className="h-4 w-4" />
                {isSubmitting ? "Saving Profile..." : "Save Staff Profile"}
              </Button>
            </div>
          </div>
        </div>

        {/* MOBILE STICKY NAVIGATION TABS (Visible only on Mobile screens) */}
        <div className="block lg:hidden sticky top-0 z-30 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 py-2.5 -mx-3 px-3 shadow-sm">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth">
            {sections.map((sec, idx) => {
              const Icon = sec.icon;
              const isActive = activeSection === idx;
              const isDone = activeSection > idx;

              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setActiveSection(idx)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                      : isDone
                      ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{sec.title}</span>
                  {isDone && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Master Navigation & Content Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Desktop Left Side Navigation Panel (Hidden on Mobile) */}
          <div className="hidden lg:block lg:col-span-4 sticky top-6 z-20">
            <Card className="border-0 shadow-xl rounded-3xl bg-white/80 dark:bg-gray-900/80 backdrop-blur-md overflow-hidden">
              <CardHeader className="border-b border-gray-100 dark:border-gray-800 pb-4">
                <CardTitle className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-indigo-500" />
                  Registration Steps
                </CardTitle>
                <CardDescription className="text-xs">Complete all sections for full onboarding</CardDescription>
              </CardHeader>
              <CardContent className="p-3 space-y-2">
                {sections.map((sec, idx) => {
                  const Icon = sec.icon;
                  const isActive = activeSection === idx;
                  const isDone = activeSection > idx;

                  return (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => setActiveSection(idx)}
                      className={`w-full flex items-center gap-3.5 p-3.5 rounded-2xl transition-all duration-200 text-left ${
                        isActive
                          ? "bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/50 dark:to-purple-950/50 text-indigo-600 dark:text-indigo-400 font-semibold shadow-sm border border-indigo-100 dark:border-indigo-900/50"
                          : "hover:bg-gray-50 dark:hover:bg-gray-800/50 text-gray-600 dark:text-gray-400"
                      }`}
                    >
                      <div className={`p-2.5 rounded-xl transition-colors ${
                        isActive
                          ? "bg-gradient-to-r " + sec.gradient + " text-white shadow-md"
                          : isDone 
                          ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400" 
                          : "bg-gray-100 dark:bg-gray-800 text-gray-400"
                      }`}>
                        {isDone ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">{sec.title}</div>
                        <div className="text-[11px] text-gray-400 dark:text-gray-500 font-normal truncate">{sec.subtitle}</div>
                      </div>
                      <ChevronRight className={`h-4 w-4 transition-transform ${isActive ? "translate-x-0.5 text-indigo-500" : "opacity-30"}`} />
                    </button>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* Right Form Display Panel */}
          <div className="lg:col-span-8">
            {sections.map((section, index) => {
              if (activeSection !== index) return null;
              const Icon = section.icon;

              return (
                <div key={section.id} ref={sectionRefs[section.id as keyof typeof sectionRefs]} className="space-y-6 animate-in fade-in-50 duration-300">
                  <Card className="border-0 shadow-xl rounded-3xl bg-white dark:bg-gray-900 overflow-hidden">
                    <CardHeader className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 p-5 sm:p-6">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl bg-gradient-to-r ${section.gradient} text-white shadow-md`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <CardTitle className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">{section.title}</CardTitle>
                          <CardDescription className="text-xs text-gray-500 dark:text-gray-400">{section.subtitle}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="p-5 sm:p-8 space-y-5">
                      {/* Section 1: Basic Information */}
                      {section.id === "basic" && (
                        <div className="space-y-5">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                              <Label className={fieldStyles.label}>Full Name (English) <span className="text-red-500">*</span></Label>
                              <Input 
                                {...register("name")} 
                                className={`${fieldStyles.input} ${errors.name ? "border-red-500 focus:ring-red-500/20" : ""}`}
                                placeholder="e.g. Abdullah Al Mamun"
                              />
                              {errors.name && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.name.message}</p>}
                            </div>
                            <div>
                              <Label className={fieldStyles.label}>Full Name (Bangla)</Label>
                              <Input {...register("name_bn")} className={fieldStyles.input} placeholder="যেমন: আবদুল্লাহ আল মামুন" />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                              <Label className={fieldStyles.label}>Gender <span className="text-red-500">*</span></Label>
                              <Select onValueChange={(v) => setValue("gender", v)}>
                                <SelectTrigger className={`${fieldStyles.select} ${errors.gender ? "border-red-500" : ""}`}>
                                  <SelectValue placeholder="Select Gender" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-gray-200 dark:border-gray-700">
                                  <SelectItem value="male">Male</SelectItem>
                                  <SelectItem value="female">Female</SelectItem>
                                  <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                              </Select>
                              {errors.gender && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.gender.message}</p>}
                            </div>
                            <div>
                              <Label className={fieldStyles.label}>Date of Birth</Label>
                              <Input type="date" {...register("dob")} className={fieldStyles.input} />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                              <Label className={fieldStyles.label}>National ID (NID)</Label>
                              <Input {...register("nid_no")} className={fieldStyles.input} placeholder="National identity number" />
                            </div>
                             <div>
                               <Label className={fieldStyles.label}>Joining Date <span className="text-red-500">*</span></Label>
                               <Input 
                                 type="date" 
                                 {...register("joining_date")} 
                                 className={`${fieldStyles.input} ${errors.joining_date ? "border-red-500 focus:ring-red-500/20" : ""}`}
                                 required
                               />
                               {errors.joining_date && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.joining_date.message}</p>}
                             </div>
                          </div>

                          <div>
                            <Label className={fieldStyles.label}>Contact Phone <span className="text-red-500">*</span></Label>
                            <div className="relative">
                              <Input 
                                {...register("contact")} 
                                className={`${fieldStyles.input} pl-10 ${errors.contact ? "border-red-500" : ""}`}
                                placeholder="01700000000"
                              />
                              <Phone className="h-4 w-4 absolute left-3.5 top-3.5 text-gray-400" />
                            </div>
                            {errors.contact && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.contact.message}</p>}
                          </div>
                        </div>
                      )}

                      {/* Section 2: Family Profile */}
                      {section.id === "family" && (
                        <div className="space-y-5">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                              <Label className={fieldStyles.label}>Father's Name</Label>
                              <Input {...register("father_name")} className={fieldStyles.input} placeholder="Father's full name" />
                            </div>
                            <div>
                              <Label className={fieldStyles.label}>Mother's Name</Label>
                              <Input {...register("mother_name")} className={fieldStyles.input} placeholder="Mother's full name" />
                            </div>
                          </div>
                          <div>
                            <Label className={fieldStyles.label}>Email Address</Label>
                            <div className="relative">
                              <Input 
                                type="email" 
                                {...register("email")} 
                                className={`${fieldStyles.input} pl-10 ${errors.email ? "border-red-500" : ""}`}
                                placeholder="staff@example.com"
                              />
                              <Mail className="h-4 w-4 absolute left-3.5 top-3.5 text-gray-400" />
                            </div>
                            {errors.email && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.email.message}</p>}
                          </div>
                        </div>
                      )}

                      {/* Section 3: Address Information */}
                      {section.id === "address" && (
                        <div className="space-y-5">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                              <Label className={fieldStyles.label}>District</Label>
                              <Input list="district-list" {...register("district")} className={fieldStyles.input} placeholder="Search or type district" />
                              <datalist id="district-list">
                                {districts.map((d: any) => <option key={d.id} value={d.name} />)}
                              </datalist>
                            </div>
                            <div>
                              <Label className={fieldStyles.label}>Police Station</Label>
                              <Input list="ps-list" {...register("police_station")} className={fieldStyles.input} placeholder="Search or type police station" />
                              <datalist id="ps-list">
                                {policeStations.map((p: any) => <option key={p.id} value={p.name} />)}
                              </datalist>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                              <Label className={fieldStyles.label}>Post Office</Label>
                              <Input list="po-list" {...register("post_office")} className={fieldStyles.input} placeholder="Search or type post office" />
                              <datalist id="po-list">
                                {postOffices.map((p: any) => <option key={p.id} value={p.name} />)}
                              </datalist>
                            </div>
                            <div>
                              <Label className={fieldStyles.label}>Village / Area</Label>
                              <Input list="village-list" {...register("village")} className={fieldStyles.input} placeholder="Search or type village" />
                              <datalist id="village-list">
                                {villages.map((v: any) => <option key={v.id} value={v.name} />)}
                              </datalist>
                            </div>
                          </div>

                          <div>
                            <Label className={fieldStyles.label}>Detailed Present Address</Label>
                            <Textarea 
                              {...register("address")} 
                              className={fieldStyles.textarea}
                              placeholder="House no, Holding no, Street address details..."
                              rows={3}
                            />
                          </div>
                        </div>
                      )}

                      {/* Section 4: Professional Info */}
                      {section.id === "professional" && (
                        <div className="space-y-5">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                              <Label className={fieldStyles.label}>Designation <span className="text-red-500">*</span></Label>
                              <Select onValueChange={(v) => setValue("designation", v)}>
                                <SelectTrigger className={`${fieldStyles.select} ${errors.designation ? "border-red-500" : ""}`}>
                                  <SelectValue placeholder="Choose Designation" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-gray-200 dark:border-gray-700">
                                  {designationOptions.map((d) => (
                                    <SelectItem key={d.name} value={d.name}>{d.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {errors.designation && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.designation.message}</p>}
                            </div>
                            <div>
                              <Label className={fieldStyles.label}>Role <span className="text-red-500">*</span></Label>
                              <Select onValueChange={(v) => setValue("role", v)}>
                                <SelectTrigger className={`${fieldStyles.select} ${errors.role ? "border-red-500" : ""}`}>
                                  <SelectValue placeholder="Choose Role" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-gray-200 dark:border-gray-700">
                                  {roleOptions.map((r) => (
                                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {errors.role && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.role.message}</p>}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                              <Label className={fieldStyles.label}>Highest Qualification</Label>
                              <Select onValueChange={(v) => setValue("qualification", v)}>
                                <SelectTrigger className={fieldStyles.select}>
                                  <SelectValue placeholder="Select Degree" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-gray-200 dark:border-gray-700">
                                  {qualificationOptions.map((q) => (
                                    <SelectItem key={q} value={q}>{q}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className={fieldStyles.label}>Experience (Years)</Label>
                              <Input 
                                type="text"
                                inputMode="numeric"
                                {...register("experience")} 
                                className={fieldStyles.input}
                                placeholder="e.g. 5 or ৫"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Section 5: Salary Information (Clean UI Breakdown) */}
                      {section.id === "salary" && (
                        <div className="space-y-6">
                          <div>
                            <Label className={fieldStyles.label}>Assigned Salary Scale</Label>
                            <Select 
                              value={selectedSalaryCategoryId || ""}
                              onValueChange={(v) => setValue("salary_category_id", v)}
                            >
                              <SelectTrigger className={fieldStyles.select}>
                                <SelectValue placeholder="Select Salary Scale" />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl border-gray-200 dark:border-gray-700">
                                {salaryCategories.map((cat: any) => (
                                  <SelectItem key={cat.id} value={cat.id}>
                                    {cat.name} — ৳{cat.basic?.toLocaleString() || 0} Base
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {selectedSalaryCategoryId && (
                            <div className="rounded-2xl p-5 border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-4">
                              <div className="flex justify-between items-center border-b border-indigo-100 dark:border-indigo-900/60 pb-3">
                                <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">Salary Breakdown</span>
                                <span className="text-[11px] px-2.5 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-medium">
                                  Auto Calculated
                                </span>
                              </div>
                              
                              {(() => {
                                const selected = getSelectedCategoryDetails();
                                if (!selected) return null;
                                const total = (selected.basic || 0) + (selected.hra || 0) + (selected.da || 0) + (selected.allowances || 0) - (selected.deductions || 0);
                                
                                return (
                                  <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                      <div className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700/60">
                                        <div className="text-xs text-gray-500 dark:text-gray-400">Basic Pay</div>
                                        <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">৳{selected.basic?.toLocaleString() || 0}</div>
                                      </div>
                                      <div className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700/60">
                                        <div className="text-xs text-gray-500 dark:text-gray-400">House Rent (HRA)</div>
                                        <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">৳{selected.hra?.toLocaleString() || 0}</div>
                                      </div>
                                      <div className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700/60">
                                        <div className="text-xs text-gray-500 dark:text-gray-400">Medical/DA</div>
                                        <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">৳{selected.da?.toLocaleString() || 0}</div>
                                      </div>
                                      <div className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700/60">
                                        <div className="text-xs text-gray-500 dark:text-gray-400">Allowances</div>
                                        <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">৳{selected.allowances?.toLocaleString() || 0}</div>
                                      </div>
                                    </div>

                                    <div className="pt-2 flex justify-between items-center border-t border-indigo-100 dark:border-indigo-900/60">
                                      <div>
                                        <div className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">Net Estimated Monthly Salary</div>
                                        <div className="text-xl font-bold text-indigo-700 dark:text-indigo-300">
                                          ৳{total.toLocaleString()}
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <span className="text-xs text-red-500 dark:text-red-400 font-medium">Deductions: -৳{selected.deductions?.toLocaleString() || 0}</span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Form Footer Action Controls */}
                  <div className="flex items-center justify-between pt-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={prevSection} 
                      disabled={activeSection === 0}
                      className="rounded-xl border-gray-200 dark:border-gray-800 h-10 px-4 text-sm"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" /> Back
                    </Button>

                    {activeSection < sections.length - 1 ? (
                      <Button 
                        type="button" 
                        onClick={nextSection} 
                        className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white h-10 px-5 text-sm shadow-md"
                      >
                        Continue <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    ) : (
                      <Button 
                        type="button" 
                        onClick={onSubmit} 
                        disabled={isSubmitting} 
                        className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white h-10 px-5 text-sm shadow-md"
                      >
                        <Save className="h-4 w-4 mr-1.5" />
                        {isSubmitting ? "Finalizing..." : "Complete Registration"}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </ResponsiveLayout>
  );
}