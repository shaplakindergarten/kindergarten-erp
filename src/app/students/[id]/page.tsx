// src/app/students/[id]/page.tsx
"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams, useRouter }from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Loader2,
  Save,
  Camera,
  Upload,
  ArrowLeft,
  Pencil,
  Trash2,
  Check,
  X,
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  BookOpen,
  Heart,
  Shield,
  AlertCircle,
} from "lucide-react";

import { ResponsiveLayout } from "@/components/layout/responsive-layout";
import { useToastStore } from "@/store/useStore";
import {
  getStudentById,
  updateStudent,
  deleteStudent,
  uploadStudentPhoto,
  Student,
  getClasses,
} from "@/lib/api/students.service";
import { createClient } from "@/lib/supabase/client";

// ============================================================
// FORM SCHEMA
// ============================================================
const studentSchema = z.object({
  name: z.string().min(2, "Name is required"),
  name_bn: z.string().optional(),
  father_name: z.string().min(2, "Father's name is required"),
  father_name_bn: z.string().optional(),
  mother_name: z.string().min(2, "Mother's name is required"),
  mother_name_bn: z.string().optional(),
  dob: z.string().min(1, "Date of birth is required"),
  gender: z.string().min(1, "Gender is required"),
  contact: z.string().min(11, "Valid contact number is required"),
  fathers_contact: z.string().optional(),
  mothers_contact: z.string().optional(),
  email: z.string().email("Invalid email").or(z.literal("")).optional(),
  whatsapp: z.string().optional(),
  village: z.string().optional(),
  post_office: z.string().optional(),
  police_station: z.string().optional(),
  district: z.string().optional(),
  permanent_village: z.string().optional(),
  permanent_post_office: z.string().optional(),
  permanent_police_station: z.string().optional(),
  permanent_district: z.string().optional(),
  class_id: z.string().min(1, "Class is required"),
  section_id: z.string().min(1, "Section is required"),
  class_roll: z.string().optional(),
  academic_year_id: z.string().optional(),
  admission_date: z.string().optional(),
  birth_cert_no: z.string().optional(),
  blood_group: z.string().optional(),
  particular_disease: z.string().optional(),
  father_nid_no: z.string().optional(),
  mother_nid_no: z.string().optional(),
  status: z.enum(["active", "inactive", "transferred", "graduated"]),
});

type StudentFormData = z.infer<typeof studentSchema>;

// ============================================================
// SECTIONS CONFIG
// ============================================================
const SECTIONS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "family", label: "Family", icon: Heart },
  { id: "academic", label: "Academic", icon: BookOpen },
  { id: "address", label: "Address", icon: MapPin },
  { id: "documents", label: "Documents", icon: Shield },
];

// ============================================================
// STATUS COLORS
// ============================================================
const STATUS_COLORS = {
  active: "bg-green-500",
  inactive: "bg-gray-500",
  transferred: "bg-orange-500",
  graduated: "bg-blue-500",
};

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function StudentViewEditPage() {
  const { id } = useParams();
  const router = useRouter();
  const addToast = useToastStore((s) => s.addToast);

  // ============================================================
  // STATE
  // ============================================================
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [formReady, setFormReady] = useState(false);
  const [classesList, setClassesList] = useState<any[]>([]);
  const [sectionsList, setSectionsList] = useState<any[]>([]);

  const isMounted = useRef(true);

  // ============================================================
  // ✅ REACT HOOK FORM
  // ============================================================
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isDirty, dirtyFields },
  } = useForm<StudentFormData>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      name: "",
      name_bn: "",
      father_name: "",
      father_name_bn: "",
      mother_name: "",
      mother_name_bn: "",
      dob: "",
      gender: "male",
      contact: "",
      fathers_contact: "",
      mothers_contact: "",
      email: "",
      whatsapp: "",
      village: "",
      post_office: "",
      police_station: "",
      district: "",
      permanent_village: "",
      permanent_post_office: "",
      permanent_police_station: "",
      permanent_district: "",
      class_id: "",
      section_id: "",
      class_roll: "",
      academic_year_id: "",
      admission_date: "",
      birth_cert_no: "",
      blood_group: "",
      particular_disease: "",
      father_nid_no: "",
      mother_nid_no: "",
      status: "active",
    },
  });

  const formValues = watch();
  const dirtyFieldNames = useMemo(() => new Set(Object.keys(dirtyFields)), [dirtyFields]);
  const selectedClassId = watch("class_id");

  // ============================================================
  // LOAD CLASSES & SECTIONS
  // ============================================================
  useEffect(() => {
    async function loadClassesData() {
      try {
        const data = await getClasses();
        setClassesList(data || []);
      } catch (error) {
        console.error("Failed to load classes:", error);
      }
    }
    loadClassesData();
  }, []);

  // Update sections when class changes
  useEffect(() => {
    if (selectedClassId) {
      const cls = classesList.find(c => c.id === selectedClassId);
      setSectionsList(cls?.sections || []);
    } else {
      setSectionsList([]);
    }
  }, [selectedClassId, classesList]);

  // ============================================================
  // ✅ FIXED: LOAD STUDENT - Supports both UUID and student_id
  // ============================================================
  const loadStudent = useCallback(async () => {
    if (!isMounted.current) return;
    
    setLoading(true);
    setFormReady(false);
    
    try {
      const studentId = id as string;
      console.log(`🔍 Fetching student with ID: ${studentId}`);
      
      const supabase = createClient();
      
      // ✅ Check if it's a UUID or student_id format
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(studentId);
      const isStudentIdFormat = /^\d{4}-[A-Z]{1,2}-\d{3}$/.test(studentId);
      
      let data: any = null;
      let error: any = null;
      
      // ✅ If it's student_id format, try student_id first
      if (isStudentIdFormat && !isUUID) {
        console.log(`🔍 Using student_id field: ${studentId}`);
        const result = await supabase
          .from('students')
          .select(`
            *,
            class:classes(id, name),
            section:sections(id, name),
            academic_year:academic_years(id, name)
          `)
          .eq('student_id', studentId)
          .maybeSingle();
        
        data = result.data;
        error = result.error;
        
        if (!error && data) {
          console.log('✅ Found by student_id:', data);
        }
      }
      
      // ✅ If not found or it's UUID, try UUID
      if (!data) {
        console.log(`🔍 Using UUID field: ${studentId}`);
        const result = await supabase
          .from('students')
          .select(`
            *,
            class:classes(id, name),
            section:sections(id, name),
            academic_year:academic_years(id, name)
          `)
          .eq('id', studentId)
          .maybeSingle();
        
        data = result.data;
        error = result.error;
        
        if (!error && data) {
          console.log('✅ Found by UUID:', data);
        }
      }
      
      // ✅ If still not found, try both fields one more time
      if (!data) {
        console.log('🔄 Final attempt: trying both fields...');
        
        // Try student_id
        const { data: sData } = await supabase
          .from('students')
          .select(`
            *,
            class:classes(id, name),
            section:sections(id, name),
            academic_year:academic_years(id, name)
          `)
          .eq('student_id', studentId)
          .maybeSingle();
        
        if (sData) {
          data = sData;
          console.log('✅ Found by student_id (final):', sData);
        } else {
          // Try UUID
          const { data: uData } = await supabase
            .from('students')
            .select(`
              *,
              class:classes(id, name),
              section:sections(id, name),
              academic_year:academic_years(id, name)
            `)
            .eq('id', studentId)
            .maybeSingle();
          
          if (uData) {
            data = uData;
            console.log('✅ Found by UUID (final):', uData);
          }
        }
      }
      
      if (error) {
        console.error("❌ Error loading student:", error);
        addToast({ type: "error", title: error.message || "Failed to load student" });
        setLoading(false);
        return;
      }
      
      if (!data) {
        console.error("❌ No student data found");
        addToast({ type: "error", title: "Student not found" });
        setLoading(false);
        return;
      }

      const studentData = data as Student;
      
      if (!studentData || !studentData.id) {
        console.error("❌ Invalid student data:", studentData);
        addToast({ type: "error", title: "Invalid student data" });
        setLoading(false);
        return;
      }

      console.log("✅ Student Name:", studentData.name);
      console.log("✅ Student Class:", studentData.class?.name || studentData.class_id);

      setStudent(studentData);

      reset({
        name: studentData.name ?? "",
        name_bn: studentData.name_bn ?? "",
        father_name: studentData.father_name ?? "",
        father_name_bn: studentData.father_name_bn ?? "",
        mother_name: studentData.mother_name ?? "",
        mother_name_bn: studentData.mother_name_bn ?? "",
        dob: studentData.dob ?? "",
        gender: studentData.gender ?? "male",
        contact: studentData.contact ?? "",
        fathers_contact: studentData.fathers_contact ?? "",
        mothers_contact: studentData.mothers_contact ?? "",
        email: studentData.email ?? "",
        whatsapp: studentData.whatsapp ?? "",
        village: studentData.village ?? "",
        post_office: studentData.post_office ?? "",
        police_station: studentData.police_station ?? "",
        district: studentData.district ?? "",
        permanent_village: studentData.permanent_village ?? "",
        permanent_post_office: studentData.permanent_post_office ?? "",
        permanent_police_station: studentData.permanent_police_station ?? "",
        permanent_district: studentData.permanent_district ?? "",
        class_id: studentData.class_id ?? "",
        section_id: studentData.section_id ?? "",
        class_roll: studentData.class_roll ?? "",
        academic_year_id: studentData.academic_year_id ?? "",
        admission_date: studentData.admission_date ?? "",
        birth_cert_no: studentData.birth_cert_no ?? "",
        blood_group: studentData.blood_group ?? "",
        particular_disease: studentData.particular_disease ?? "",
        father_nid_no: studentData.father_nid_no ?? "",
        mother_nid_no: studentData.mother_nid_no ?? "",
        status: studentData.status ?? "active",
      });

      setFormReady(true);
      
    } catch (error) {
      console.error("❌ Error loading student:", error);
      if (isMounted.current) {
        addToast({ type: "error", title: "Failed to load student" });
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [id, reset, addToast]);

  useEffect(() => {
    isMounted.current = true;
    loadStudent();
    
    return () => {
      isMounted.current = false;
    };
  }, [loadStudent]);

  // ============================================================
  // PHOTO HANDLERS
  // ============================================================
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setPhotoDialogOpen(true);
  };

  const uploadPhoto = async () => {
    if (!photoFile || !student) return;

    setIsUploading(true);
    try {
      const result = await uploadStudentPhoto(student.id, photoFile);
      if (result.success && result.url) {
        setStudent({ ...student, student_photo_url: result.url });
        addToast({ type: "success", title: "Photo updated successfully" });
        setPhotoDialogOpen(false);
        setPhotoFile(null);
        setPhotoPreview(null);
      } else {
        addToast({ type: "error", title: result.error || "Upload failed" });
      }
    } catch (error) {
      addToast({ type: "error", title: "Upload failed" });
    } finally {
      setIsUploading(false);
    }
  };

  // ============================================================
  // SAVE STUDENT
  // ============================================================
  const onSave = useCallback(async (data: StudentFormData) => {
    if (!student) return;

    setSaving(true);
    try {
      const status = data.status || "active";
      const result = await updateStudent(student.id, {
        ...data,
        status,
        student_photo_url: student.student_photo_url,
      });

      if (result.success && result.data) {
        setStudent(result.data);
        addToast({ type: "success", title: "Student updated successfully" });
        setIsEditing(false);
        reset(data);
      } else {
        addToast({ type: "error", title: result.error || "Update failed" });
      }
    } catch (error) {
      addToast({ type: "error", title: "Update failed" });
    } finally {
      setSaving(false);
    }
  }, [student, addToast, reset]);

  // ============================================================
  // DELETE STUDENT
  // ============================================================
  const handleDelete = async () => {
    if (!student) return;

    setDeleting(true);
    try {
      const result = await deleteStudent(student.id);
      if (result.success) {
        addToast({ type: "success", title: "Student deleted successfully" });
        router.push("/students/list");
      } else {
        addToast({ type: "error", title: result.error || "Delete failed" });
      }
    } catch (error) {
      addToast({ type: "error", title: "Delete failed" });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  // ============================================================
  // TOGGLE EDIT
  // ============================================================
  const toggleEdit = useCallback(() => {
    if (isEditing) {
      if (isDirty) {
        setShowUnsavedWarning(true);
        return;
      }
      setIsEditing(false);
      return;
    }
    setIsEditing(true);
  }, [isEditing, isDirty]);

  // ============================================================
  // CANCEL EDIT
  // ============================================================
  const handleCancelEdit = useCallback(() => {
    if (isDirty) {
      setShowUnsavedWarning(true);
      return;
    }
    setIsEditing(false);
    if (student) {
      reset({
        name: student.name ?? "",
        name_bn: student.name_bn ?? "",
        father_name: student.father_name ?? "",
        father_name_bn: student.father_name_bn ?? "",
        mother_name: student.mother_name ?? "",
        mother_name_bn: student.mother_name_bn ?? "",
        dob: student.dob ?? "",
        gender: student.gender ?? "male",
        contact: student.contact ?? "",
        fathers_contact: student.fathers_contact ?? "",
        mothers_contact: student.mothers_contact ?? "",
        email: student.email ?? "",
        whatsapp: student.whatsapp ?? "",
        village: student.village ?? "",
        post_office: student.post_office ?? "",
        police_station: student.police_station ?? "",
        district: student.district ?? "",
        permanent_village: student.permanent_village ?? "",
        permanent_post_office: student.permanent_post_office ?? "",
        permanent_police_station: student.permanent_police_station ?? "",
        permanent_district: student.permanent_district ?? "",
        class_id: student.class_id ?? "",
        section_id: student.section_id ?? "",
        class_roll: student.class_roll ?? "",
        academic_year_id: student.academic_year_id ?? "",
        admission_date: student.admission_date ?? "",
        birth_cert_no: student.birth_cert_no ?? "",
        blood_group: student.blood_group ?? "",
        particular_disease: student.particular_disease ?? "",
        father_nid_no: student.father_nid_no ?? "",
        mother_nid_no: student.mother_nid_no ?? "",
        status: student.status ?? "active",
      });
    }
  }, [isDirty, student, reset]);

  // ============================================================
  // DISCARD CHANGES
  // ============================================================
  const handleDiscardChanges = useCallback(() => {
    setShowUnsavedWarning(false);
    setIsEditing(false);
    if (student) {
      reset({
        name: student.name ?? "",
        name_bn: student.name_bn ?? "",
        father_name: student.father_name ?? "",
        father_name_bn: student.father_name_bn ?? "",
        mother_name: student.mother_name ?? "",
        mother_name_bn: student.mother_name_bn ?? "",
        dob: student.dob ?? "",
        gender: student.gender ?? "male",
        contact: student.contact ?? "",
        fathers_contact: student.fathers_contact ?? "",
        mothers_contact: student.mothers_contact ?? "",
        email: student.email ?? "",
        whatsapp: student.whatsapp ?? "",
        village: student.village ?? "",
        post_office: student.post_office ?? "",
        police_station: student.police_station ?? "",
        district: student.district ?? "",
        permanent_village: student.permanent_village ?? "",
        permanent_post_office: student.permanent_post_office ?? "",
        permanent_police_station: student.permanent_police_station ?? "",
        permanent_district: student.permanent_district ?? "",
        class_id: student.class_id ?? "",
        section_id: student.section_id ?? "",
        class_roll: student.class_roll ?? "",
        academic_year_id: student.academic_year_id ?? "",
        admission_date: student.admission_date ?? "",
        birth_cert_no: student.birth_cert_no ?? "",
        blood_group: student.blood_group ?? "",
        particular_disease: student.particular_disease ?? "",
        father_nid_no: student.father_nid_no ?? "",
        mother_nid_no: student.mother_nid_no ?? "",
        status: student.status ?? "active",
      });
    }
  }, [student, reset]);

  // ============================================================
  // ✅ RENDER FIELD
  // ============================================================
  const renderField = (
    label: string,
    name: keyof StudentFormData,
    type: string = "text",
    placeholder?: string,
    options?: { value: string; label: string }[]
  ) => {
    const isChanged = dirtyFieldNames.has(name as string);
    const error = errors[name];
    const isFieldEditing = isEditing && formReady;

    return (
      <div className="space-y-1.5">
        <Label
          htmlFor={name}
          className={isChanged ? "text-yellow-600 dark:text-yellow-400" : "text-gray-700 dark:text-gray-300"}
        >
          {label}
          {isChanged && (
            <span className="ml-2 text-xs text-yellow-500">(changed)</span>
          )}
        </Label>
        
        <Controller
          name={name}
          control={control}
          render={({ field }) => {
            const value = field.value ?? "";
            
            if (options) {
              return (
                <select
                  {...field}
                  id={name}
                  disabled={!isFieldEditing}
                  value={value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  className={`w-full px-3 py-2 rounded-md border text-gray-900 dark:text-white bg-white dark:bg-gray-700 ${
                    error ? "border-red-500" : isFieldEditing ? "border-gray-300 dark:border-gray-600" : "border-gray-200 dark:border-gray-600"
                  } ${!isFieldEditing ? "cursor-default opacity-90" : "cursor-pointer"}`}
                >
                  <option value="">Select</option>
                  {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              );
            }
            
            return (
              <Input
                {...field}
                id={name}
                type={type}
                disabled={!isFieldEditing}
                value={value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                placeholder={placeholder || `Enter ${label.toLowerCase()}`}
                className={`text-gray-900 dark:text-white bg-white dark:bg-gray-700 ${
                  error ? "border-red-500" : ""
                } ${
                  isChanged && isFieldEditing ? "border-yellow-400 bg-yellow-50 dark:bg-yellow-950/20" : "border-gray-200 dark:border-gray-600"
                } ${!isFieldEditing ? "opacity-90" : ""}`}
              />
            );
          }}
        />
        
        {error && (
          <p className="text-xs text-red-500">{error.message}</p>
        )}
      </div>
    );
  };

  // ============================================================
  // DISPLAY HELPERS
  // ============================================================
  const getClassDisplay = useCallback(() => {
    if (!student) return "-";
    return student.class?.name || student.class_id || "-";
  }, [student]);

  const getSectionDisplay = useCallback(() => {
    if (!student) return "-";
    return student.section?.name || student.section_id || "-";
  }, [student]);

  const getAcademicYearDisplay = useCallback(() => {
    if (!student) return "-";
    return student.academic_year?.name || student.academic_year_id || "-";
  }, [student]);

  // ============================================================
  // LOADING STATE
  // ============================================================
  if (loading) {
    return (
      <ResponsiveLayout>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-24" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <Skeleton className="h-[200px]" />
            <div className="lg:col-span-3 space-y-4">
              <Skeleton className="h-[300px]" />
              <Skeleton className="h-[200px]" />
            </div>
          </div>
        </div>
      </ResponsiveLayout>
    );
  }

  // ============================================================
  // NOT FOUND STATE
  // ============================================================
  if (!student || !formReady) {
    return (
      <ResponsiveLayout>
        <div className="p-4 text-center py-20">
          <AlertCircle className="h-12 w-12 mx-auto text-gray-400" />
          <h2 className="text-xl font-bold mt-4 text-gray-900 dark:text-white">Student Not Found</h2>
          <p className="text-gray-500 dark:text-gray-400">The student you're looking for doesn't exist.</p>
          <Button className="mt-4 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => router.push("/students/list")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to List
          </Button>
        </div>
      </ResponsiveLayout>
    );
  }

  // ============================================================
  // MAIN RENDER
  // ============================================================
  return (
    <ResponsiveLayout>
      <div className="p-4 space-y-4 bg-white dark:bg-gray-900">

        {/* ============================================================
            STICKY HEADER - GRADIENT
        ============================================================ */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 rounded-lg shadow-lg pb-3 pt-3 px-4">
          <div className="flex flex-wrap items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => router.push("/students/list")} className="text-white hover:bg-white/20">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold text-white">{student.name}</h1>
                  <Badge className={`${STATUS_COLORS[student.status as keyof typeof STATUS_COLORS]} text-white`}>
                    {student.status}
                  </Badge>
                  {isEditing && (
                    <Badge variant="outline" className="border-yellow-300 text-yellow-100">
                      <Pencil className="h-3 w-3 mr-1" />
                      Editing
                    </Badge>
                  )}
                  {dirtyFieldNames.size > 0 && (
                    <Badge variant="outline" className="border-yellow-300 text-yellow-100">
                      {dirtyFieldNames.size} changes
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-white/80">
                  {student.student_id} • {getClassDisplay()} • {getSectionDisplay()}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 flex-wrap">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={isEditing ? "default" : "outline"}
                      onClick={toggleEdit}
                      className={isEditing ? "bg-white text-indigo-600 hover:bg-indigo-50" : "bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 border border-white/30"}
                    >
                      {isEditing ? (
                        <Check className="h-4 w-4 mr-2" />
                      ) : (
                        <Pencil className="h-4 w-4 mr-2" />
                      )}
                      {isEditing ? "Done" : "Edit"}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isEditing ? "Save changes and exit edit mode" : "Enter edit mode"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {isEditing && (
                <>
                  <Button
                    onClick={handleSubmit(onSave)}
                    disabled={saving}
                    variant="default"
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleCancelEdit}
                    disabled={saving}
                    className="bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 border border-white/30"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </>
              )}

              <Button
                variant="destructive"
                size="icon"
                onClick={() => setDeleteDialogOpen(true)}
                className="bg-red-600 hover:bg-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* ============================================================
            MAIN CONTENT
        ============================================================ */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">

          {/* Left Sidebar */}
          <div className="space-y-4">
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardContent className="p-4 text-center space-y-3">
                <div className="relative inline-block">
                  <Avatar className="h-28 w-28 mx-auto">
                    <AvatarImage src={student.student_photo_url || ""} />
                    <AvatarFallback className="text-2xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
                      {student.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {isEditing && (
                    <Button
                      size="icon"
                      variant="secondary"
                      className="absolute bottom-0 right-0 rounded-full h-8 w-8 bg-indigo-600 hover:bg-indigo-700 text-white"
                      onClick={() => document.getElementById("photo-upload")?.click()}
                    >
                      <Camera className="h-4 w-4" />
                    </Button>
                  )}
                  <input
                    id="photo-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoSelect}
                  />
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{student.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Student</p>
                </div>

                <Separator className="bg-gray-200 dark:bg-gray-700" />

                <div className="text-left space-y-2 text-sm text-gray-700 dark:text-gray-300">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    <span>{student.gender}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    <span>{student.dob}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    <span>{student.contact}</span>
                  </div>
                  {student.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                      <span className="truncate">{student.email}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Section Navigation */}
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardContent className="p-2">
                <div className="space-y-1">
                  {SECTIONS.map((section) => {
                    const Icon = section.icon;
                    return (
                      <Button
                        key={section.id}
                        variant={activeTab === section.id ? "secondary" : "ghost"}
                        className={`w-full justify-start text-gray-700 dark:text-gray-300 ${
                          activeTab === section.id ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400" : ""
                        }`}
                        onClick={() => setActiveTab(section.id)}
                      >
                        <Icon className="h-4 w-4 mr-2" />
                        {section.label}
                      </Button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Content */}
          <div className="lg:col-span-3 space-y-4">

            {/* Profile Tab */}
            {activeTab === "profile" && (
              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardHeader>
                  <CardTitle className="text-gray-900 dark:text-white">Profile Information</CardTitle>
                  <CardDescription className="text-gray-500 dark:text-gray-400">
                    Personal details of the student
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {renderField("Student Name", "name")}
                  {renderField("Name (Bengali)", "name_bn")}
                  {renderField("Father's Name", "father_name")}
                  {renderField("Father's Name (Bengali)", "father_name_bn")}
                  {renderField("Mother's Name", "mother_name")}
                  {renderField("Mother's Name (Bengali)", "mother_name_bn")}
                  {renderField("Date of Birth", "dob", "date")}
                  {renderField("Gender", "gender", "select", "", [
                    { value: "male", label: "Male" },
                    { value: "female", label: "Female" },
                    { value: "other", label: "Other" },
                  ])}
                  {renderField("Contact Number", "contact", "tel")}
                  {renderField("Email", "email", "email")}
                  {renderField("WhatsApp", "whatsapp", "tel")}
                  {renderField("Blood Group", "blood_group")}
                  {renderField("Particular Disease", "particular_disease")}
                  {renderField("Birth Certificate No", "birth_cert_no")}
                </CardContent>
              </Card>
            )}

            {/* Family Tab */}
            {activeTab === "family" && (
              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardHeader>
                  <CardTitle className="text-gray-900 dark:text-white">Family Information</CardTitle>
                  <CardDescription className="text-gray-500 dark:text-gray-400">
                    Parent and guardian details
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {renderField("Father's Contact", "fathers_contact", "tel")}
                  {renderField("Mother's Contact", "mothers_contact", "tel")}
                  {renderField("Father's NID", "father_nid_no")}
                  {renderField("Mother's NID", "mother_nid_no")}
                </CardContent>
              </Card>
            )}

            {/* ============================================================
                ✅ FIXED: Academic Tab - UUID এর বদলে নাম দেখানো
            ============================================================ */}
            {activeTab === "academic" && (
              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardHeader>
                  <CardTitle className="text-gray-900 dark:text-white">Academic Information</CardTitle>
                  <CardDescription className="text-gray-500 dark:text-gray-400">
                    Class, section and academic details
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* ✅ Class - Select with Name */}
                  <div className="space-y-1.5">
                    <Label className="text-gray-700 dark:text-gray-300">Class</Label>
                    {isEditing ? (
                      <Controller
                        name="class_id"
                        control={control}
                        render={({ field }) => (
                          <Select
                            value={field.value || ""}
                            onValueChange={(value) => {
                              field.onChange(value);
                              // Reset section when class changes
                              setValue("section_id", "");
                            }}
                            disabled={!isEditing}
                          >
                            <SelectTrigger className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600">
                              <SelectValue placeholder="Select class" />
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700">
                              {classesList.map((cls) => (
                                <SelectItem key={cls.id} value={cls.id} className="text-gray-900 dark:text-white">
                                  {cls.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    ) : (
                      <div className="px-3 py-2 rounded-md border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white">
                        {getClassDisplay()}
                      </div>
                    )}
                  </div>

                  {/* ✅ Section - Select with Name */}
                  <div className="space-y-1.5">
                    <Label className="text-gray-700 dark:text-gray-300">Section</Label>
                    {isEditing ? (
                      <Controller
                        name="section_id"
                        control={control}
                        render={({ field }) => (
                          <Select
                            value={field.value || ""}
                            onValueChange={field.onChange}
                            disabled={!isEditing || !selectedClassId}
                          >
                            <SelectTrigger className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600">
                              <SelectValue placeholder={selectedClassId ? "Select section" : "Select class first"} />
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700">
                              {sectionsList.map((sec) => (
                                <SelectItem key={sec.id} value={sec.id} className="text-gray-900 dark:text-white">
                                  {sec.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    ) : (
                      <div className="px-3 py-2 rounded-md border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white">
                        {getSectionDisplay()}
                      </div>
                    )}
                  </div>

                  {renderField("Class Roll", "class_roll")}

                  {/* ✅ Academic Year - Show Name instead of UUID */}
                  <div className="space-y-1.5">
                    <Label className="text-gray-700 dark:text-gray-300">Academic Year</Label>
                    {isEditing ? (
                      renderField("Academic Year ID", "academic_year_id")
                    ) : (
                      <div className="px-3 py-2 rounded-md border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white">
                        {getAcademicYearDisplay()}
                      </div>
                    )}
                  </div>

                  {renderField("Admission Date", "admission_date", "date")}
                  {renderField("Status", "status", "select", "", [
                    { value: "active", label: "Active" },
                    { value: "inactive", label: "Inactive" },
                    { value: "transferred", label: "Transferred" },
                    { value: "graduated", label: "Graduated" },
                  ])}
                </CardContent>
              </Card>
            )}

            {/* Address Tab */}
            {activeTab === "address" && (
              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardHeader>
                  <CardTitle className="text-gray-900 dark:text-white">Address Information</CardTitle>
                  <CardDescription className="text-gray-500 dark:text-gray-400">
                    Present and permanent address details
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div>
                      <h4 className="font-medium mb-3 text-gray-900 dark:text-white">Present Address</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {renderField("Village", "village")}
                        {renderField("Post Office", "post_office")}
                        {renderField("Police Station", "police_station")}
                        {renderField("District", "district")}
                      </div>
                    </div>
                    <Separator className="bg-gray-200 dark:bg-gray-700" />
                    <div>
                      <h4 className="font-medium mb-3 text-gray-900 dark:text-white">Permanent Address</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {renderField("Permanent Village", "permanent_village")}
                        {renderField("Permanent Post Office", "permanent_post_office")}
                        {renderField("Permanent Police Station", "permanent_police_station")}
                        {renderField("Permanent District", "permanent_district")}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Documents Tab */}
            {activeTab === "documents" && (
              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardHeader>
                  <CardTitle className="text-gray-900 dark:text-white">Documents</CardTitle>
                  <CardDescription className="text-gray-500 dark:text-gray-400">
                    Student documents and verification
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                      <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2 rounded">
                        <User className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white">Student Photo</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {student.student_photo_url ? "Uploaded" : "Not uploaded"}
                        </p>
                      </div>
                      {isEditing && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => document.getElementById("photo-upload")?.click()}
                          className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Update
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* ============================================================
            PHOTO DIALOG
        ============================================================ */}
        <Dialog open={photoDialogOpen} onOpenChange={setPhotoDialogOpen}>
          <DialogContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <DialogHeader>
              <DialogTitle className="text-gray-900 dark:text-white">Update Photo</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {photoPreview ? (
                <div className="flex justify-center">
                  <img
                    src={photoPreview}
                    alt="Preview"
                    className="h-48 w-48 rounded-full object-cover"
                  />
                </div>
              ) : (
                <div className="text-center py-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                  <Camera className="h-12 w-12 mx-auto text-gray-400" />
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    Select a photo to upload
                  </p>
                </div>
              )}
              <Input
                type="file"
                accept="image/*"
                onChange={handlePhotoSelect}
                className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
              />
              <Button
                onClick={uploadPhoto}
                disabled={isUploading || !photoFile}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Upload
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ============================================================
            UNSAVED WARNING
        ============================================================ */}
        <AlertDialog open={showUnsavedWarning} onOpenChange={setShowUnsavedWarning}>
          <AlertDialogContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-gray-900 dark:text-white">Unsaved Changes</AlertDialogTitle>
              <AlertDialogDescription className="text-gray-600 dark:text-gray-400">
                You have unsaved changes. Are you sure you want to leave?
                Your changes will be lost.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowUnsavedWarning(false)} className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
                Continue Editing
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDiscardChanges}
                variant="destructive"
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Discard Changes
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ============================================================
            DELETE DIALOG
        ============================================================ */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-gray-900 dark:text-white">Delete Student</AlertDialogTitle>
              <AlertDialogDescription className="text-gray-600 dark:text-gray-400">
                Are you sure you want to delete <strong className="text-gray-900 dark:text-white">{student.name}</strong>?
                This action cannot be undone and will remove all associated data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-700 text-white"
                disabled={deleting}
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Delete Student
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </div>
    </ResponsiveLayout>
  );
}