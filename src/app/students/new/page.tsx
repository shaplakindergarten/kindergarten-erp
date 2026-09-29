// src/app/students/new/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  Upload,
  User,
  GraduationCap,
  Contact,
  FileText,
  MapPin,
  CheckCircle,
  Loader2,
  X,
  AlertCircle,
  Printer,
  Home,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogOverlay,
} from "@/components/ui/dialog";
import { ResponsiveLayout } from "@/components/layout/responsive-layout";
import { submitAdmission } from "@/app/students/actions";
import { studentService } from "@/lib/api/students.service";
import { useToastStore } from "@/store/useStore";
import { createClient } from "@/lib/supabase/client";
import { getSchoolPrintHeader } from "@/components/print/SchoolPrintHeader";

const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const genders = ["Male", "Female", "Other"];

interface ClassData {
  id: string;
  name: string;
  numeric_order: number;
  sections: { id: string; name: string }[];
}

interface AcademicYearData {
  id: string;
  name: string;
  year_name: string;
}

interface AddressData {
  id: string;
  name: string;
}

interface SchoolSettings {
  school_name?: string;
  school_address?: string;
  school_phone?: string;
  school_email?: string;
  school_logo?: string;
  school_code?: string;
  emis?: string;
}

// ✅ Zod Schema - fee_structure_id যোগ করা হলো
const studentSchema = z.object({
  name: z.string().min(2, "Name is required"),
  name_bn: z.string().optional(),
  father_name: z.string().min(2, "Father's name is required"),
  father_name_bn: z.string().optional(),
  mother_name: z.string().min(2, "Mother's name is required"),
  mother_name_bn: z.string().optional(),
  dob: z.string().min(1, "Date of birth is required"),
  birth_cert_no: z.string().optional(),
  blood_group: z.string().optional(),
  particular_disease: z.string().optional(),
  gender: z.string().min(1, "Gender is required"),
  contact: z.string().min(11, "Valid contact number is required"),
  village: z.string().optional(),
  post_office: z.string().optional(),
  police_station: z.string().optional(),
  district: z.string().optional(),
  permanent_village: z.string().optional(),
  permanent_post_office: z.string().optional(),
  permanent_police_station: z.string().optional(),
  permanent_district: z.string().optional(),
  class_roll: z.string().optional(),
  class_id: z.string().min(1, "Class is required"),
  section_id: z.string().min(1, "Section is required"),
  academic_year_id: z.string().uuid("Invalid academic year").optional(),
  admission_date: z.string().optional(),
  fathers_contact: z.string().optional(),
  mothers_contact: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  whatsapp: z.string().optional(),
  father_nid_no: z.string().optional(),
  mother_nid_no: z.string().optional(),
  fee_structure_id: z.string().uuid("Invalid fee structure").optional(), // ✅ নতুন ফিল্ড
});

type StudentFormData = z.infer<typeof studentSchema>;

export default function NewAdmissionPage() {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState(0);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [sections, setSections] = useState<{ id: string; name: string }[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYearData[]>([]);
  const [districts, setDistricts] = useState<AddressData[]>([]);
  const [policeStations, setPoliceStations] = useState<AddressData[]>([]);
  const [postOffices, setPostOffices] = useState<AddressData[]>([]);
  const [villages, setVillages] = useState<AddressData[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingFeeStructure, setLoadingFeeStructure] = useState(false); // ✅ নতুন স্টেট
  const [previewStudentId, setPreviewStudentId] = useState<string>("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [admittedStudentId, setAdmittedStudentId] = useState<string>("");
  const [admittedStudentName, setAdmittedStudentName] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [admissionData, setAdmissionData] = useState<StudentFormData | null>(null);
  const [selectedFeeStructureId, setSelectedFeeStructureId] = useState<string>(""); // ✅ নতুন স্টেট
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings>({
    school_name: "Shapla Kindergarten & Pre-cadet",
    school_address: "Nowtala, Madhaiya, Chandina, Cumilla",
    school_phone: "01777584352",
    school_email: "cma@gmail.com",
    school_logo: "",
    school_code: "416614",
    emis: "06406103018",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const addToast = useToastStore((state) => state.addToast);

  const {
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    trigger,
    formState: { errors, isValid },
  } = useForm<StudentFormData>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      gender: "male",
      class_id: "",
      section_id: "",
      academic_year_id: "",
      admission_date: new Date().toISOString().split("T")[0],
      contact: "",
      fathers_contact: "",
      mothers_contact: "",
      whatsapp: "",
      class_roll: "",
      birth_cert_no: "",
      father_nid_no: "",
      mother_nid_no: "",
      village: "",
      post_office: "",
      police_station: "",
      district: "",
      permanent_village: "",
      permanent_post_office: "",
      permanent_police_station: "",
      permanent_district: "",
      particular_disease: "",
      name: "",
      name_bn: "",
      father_name: "",
      father_name_bn: "",
      mother_name: "",
      mother_name_bn: "",
      dob: "",
      blood_group: "",
      fee_structure_id: "", // ✅ নতুন ডিফল্ট
    },
    mode: "onChange",
  });

  const selectedClassId = watch("class_id");
  const selectedAcademicYearId = watch("academic_year_id");

  // Load school settings from database
  useEffect(() => {
    async function loadSchoolSettings() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('school_settings')
          .select('school_name, school_address, school_phone, school_email, school_logo')
          .limit(1)
          .single();
        
        if (data && !error) {
          setSchoolSettings({
            school_name: data.school_name || "Shapla Kindergarten & Pre-cadet",
            school_address: data.school_address || "Nowtala, Madhaiya, Chandina, Cumilla",
            school_phone: data.school_phone || "01777584352",
            school_email: data.school_email || "cma@gmail.com",
            school_logo: data.school_logo || "",
            school_code: "416614",
            emis: "06406103018",
          });
        }
      } catch (err) {
        console.error("Failed to load school settings:", err);
      }
    }
    loadSchoolSettings();
  }, []);

  // Load classes and other data
  useEffect(() => {
    async function loadData() {
      try {
        const supabase = createClient();
        
        const [classesData, yearsData, districtsData, policeData, postData, villageData] = await Promise.all([
          supabase.from('classes').select('id, name, numeric_order, sections (id, name)').order('numeric_order'),
          supabase.from('academic_years').select('id, name, year_name').order('year_name', { ascending: false }),
          supabase.from('address_districts').select('id, name').order('name'),
          supabase.from('address_police_stations').select('id, name').order('name'),
          supabase.from('address_post_offices').select('id, name').order('name'),
          supabase.from('address_villages').select('id, name').order('name'),
        ]);
        
        console.log('Classes loaded:', classesData.data);
        console.log('Academic Years loaded:', yearsData.data);
        
        setClasses(classesData.data || []);
        setAcademicYears(yearsData.data || []);
        
        // Set default academic year ID
        if (yearsData.data && yearsData.data.length > 0) {
          const currentYear = yearsData.data.find((y: any) => y.year_name?.includes(new Date().getFullYear().toString()));
          if (currentYear) {
            setValue('academic_year_id', currentYear.id);
            console.log('✅ Default Academic Year ID set:', currentYear.id);
          } else {
            setValue('academic_year_id', yearsData.data[0].id);
            console.log('✅ Default Academic Year ID set (first):', yearsData.data[0].id);
          }
        }
        
        if (districtsData.data) setDistricts(districtsData.data);
        if (policeData.data) setPoliceStations(policeData.data);
        if (postData.data) setPostOffices(postData.data);
        if (villageData.data) setVillages(villageData.data);
        
      } catch (err) {
        console.error("Failed to load data:", err);
        addToast({
          type: "error",
          title: "Error Loading Data",
          message: "Failed to load classes. Please refresh the page.",
        });
      } finally {
        setLoadingClasses(false);
      }
    }
    loadData();
  }, [addToast, setValue]);

  // ✅ NEW: Load fee structure when class or academic year changes
  useEffect(() => {
    async function loadFeeStructure() {
      if (selectedClassId && selectedAcademicYearId) {
        setLoadingFeeStructure(true);
        try {
          const supabase = createClient();
          const { data, error } = await supabase
            .from('fee_structures')
            .select('id, name, total_amount')
            .eq('class_id', selectedClassId)
            .eq('academic_year_id', selectedAcademicYearId)
            .eq('is_active', true)
            .maybeSingle();
          
          if (data) {
            setSelectedFeeStructureId(data.id);
            setValue('fee_structure_id', data.id); // ✅ ফর্মেও সেট করা
            console.log('✅ Fee Structure found:', data);
          } else {
            setSelectedFeeStructureId("");
            setValue('fee_structure_id', "");
            console.warn('⚠️ No fee structure found for this class and academic year');
          }
        } catch (err) {
          console.error('Error loading fee structure:', err);
          setSelectedFeeStructureId("");
          setValue('fee_structure_id', "");
        } finally {
          setLoadingFeeStructure(false);
        }
      } else {
        setSelectedFeeStructureId("");
        setValue('fee_structure_id', "");
      }
    }
    loadFeeStructure();
  }, [selectedClassId, selectedAcademicYearId, setValue]);

  // Generate preview student ID when class is selected
  useEffect(() => {
    async function generatePreviewId() {
      if (selectedClassId && selectedAcademicYearId) {
        const cls = classes.find((c) => c.id === selectedClassId);
        if (cls) {
          try {
            const supabase = createClient();
            const year = new Date().getFullYear();
            const classInitial = cls.name.charAt(0).toUpperCase();
            const prefix = `${year}-${classInitial}-`;
            
            const { data: existingStudents } = await supabase
              .from('students')
              .select('student_id')
              .like('student_id', `${prefix}%`)
              .order('student_id', { ascending: false })
              .limit(1);
            
            let serial = 1;
            if (existingStudents && existingStudents.length > 0) {
              const lastId = existingStudents[0].student_id;
              const lastSerial = parseInt(lastId.split('-').pop() || '0', 10);
              serial = lastSerial + 1;
            }
            
            setPreviewStudentId(`${prefix}${serial.toString().padStart(3, '0')}`);
          } catch (err) {
            console.error("Failed to generate preview ID:", err);
            const year = new Date().getFullYear();
            const classInitial = cls.name.charAt(0).toUpperCase();
            const timestamp = Date.now().toString().slice(-4);
            setPreviewStudentId(`${year}-${classInitial}-${timestamp}`);
          }
        }
      } else {
        setPreviewStudentId("");
      }
    }
    generatePreviewId();
  }, [selectedClassId, selectedAcademicYearId, classes]);

  useEffect(() => {
    if (selectedClassId) {
      const cls = classes.find((c) => c.id === selectedClassId);
      setSections(cls?.sections || []);
      setValue("section_id", "");
    } else {
      setSections([]);
    }
  }, [selectedClassId, classes, setValue]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setPhotoError(null);
    
    if (file) {
      const validTypes = ["image/jpeg", "image/png", "image/jpg"];
      if (!validTypes.includes(file.type)) {
        setPhotoError("Only JPG, PNG files are allowed");
        setPhotoFile(null);
        setPhotoPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      
      if (file.size > 2 * 1024 * 1024) {
        setPhotoError("Photo size must be less than 2MB. Please compress the image.");
        setPhotoFile(null);
        setPhotoPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
      addToast({
        type: "success",
        title: "Photo Selected",
        message: `${file.name} (${(file.size / 1024).toFixed(1)} KB)`,
      });
    }
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    setPhotoError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const resetForm = () => {
    reset({
      gender: "male",
      class_id: "",
      section_id: "",
      academic_year_id: academicYears.length > 0 ? academicYears[0].id : "",
      admission_date: new Date().toISOString().split("T")[0],
      contact: "",
      fathers_contact: "",
      mothers_contact: "",
      whatsapp: "",
      class_roll: "",
      birth_cert_no: "",
      father_nid_no: "",
      mother_nid_no: "",
      village: "",
      post_office: "",
      police_station: "",
      district: "",
      permanent_village: "",
      permanent_post_office: "",
      permanent_police_station: "",
      permanent_district: "",
      particular_disease: "",
      name: "",
      name_bn: "",
      father_name: "",
      father_name_bn: "",
      mother_name: "",
      mother_name_bn: "",
      dob: "",
      blood_group: "",
      fee_structure_id: "",
    });
    setPhotoFile(null);
    setPhotoPreview(null);
    setPhotoError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setActiveSection(0);
    setPreviewStudentId("");
    setAdmissionData(null);
    setSelectedFeeStructureId("");
  };

  const handleFormSubmit = async () => {
    if (isSubmitting) return;
    if (activeSection !== 4) {
      console.log("⛔ Submit blocked: Not on final section");
      return;
    }
    
    const isFormValid = await trigger();
    
    if (!isFormValid) {
      const firstError = Object.keys(errors)[0];
      if (firstError) {
        const element = document.getElementById(firstError);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.focus();
          element.classList.add('border-red-500', 'ring-2', 'ring-red-500');
          setTimeout(() => {
            element.classList.remove('border-red-500', 'ring-2', 'ring-red-500');
          }, 3000);
        }
      }
      return;
    }
    
    const formData = watch();
    setAdmissionData(formData);
    handleSubmit(onSubmit, onInvalidSubmit)();
  };

  // ✅ Updated onSubmit with fee_structure_id
  const onSubmit = async (data: StudentFormData) => {
    if (isSubmitting) return;
    
    console.log("🚀 Submitting admission data:", data);
    
    setIsSubmitting(true);
    setLoading(true);
    
    try {
      // ✅ Payload with fee_structure_id
      const payload = {
        ...data,
        fee_structure_id: selectedFeeStructureId,
      };
      
      const result = await submitAdmission(payload);

      console.log("✅ Result:", result);

      if (result.success && result.studentId) {
        if (photoFile) {
          console.log("📸 Uploading photo directly to Supabase Storage...");
          const photoResult = await studentService.uploadPhoto(result.studentIdUuid, photoFile);

          if (!photoResult.success) {
            console.error("❌ Photo upload failed:", photoResult.error);
            addToast({
              type: "warning",
              title: "Admission Success, Photo Failed",
              message: "Student admitted but photo could not be uploaded.",
            });
          } else {
            console.log("✅ Photo uploaded successfully:", photoResult.url);
          }
        }

        // ✅ Show warning if fee assignment failed
        if (result.warning) {
          addToast({
            type: "warning",
            title: "Admission Success with Warning",
            message: result.warning,
          });
        }

        setAdmittedStudentId(result.studentId);
        setAdmittedStudentName(data.name);
        setAdmissionData(data);
        
        setTimeout(() => {
          setShowSuccessDialog(true);
        }, 100);
        
        addToast({
          type: "success",
          title: "Admission Successful",
          message: `Student ${data.name} admitted successfully! ID: ${result.studentId}`,
        });
      } else {
        console.error("❌ Submission failed:", result.error);
        addToast({
          type: "error",
          title: "Admission Failed",
          message: result.error || "Failed to submit admission",
        });
      }
    } catch (err) {
      console.error("❌ Error:", err);
      addToast({
        type: "error",
        title: "Error",
        message: err instanceof Error ? err.message : "An unexpected error occurred",
      });
    } finally {
      setLoading(false);
      setIsSubmitting(false);
    }
  };

  const onInvalidSubmit = (errors: any) => {
    console.log("❌ INVALID SUBMIT", errors);
    const firstError = Object.keys(errors)[0];
    if (firstError) {
      const element = document.getElementById(firstError);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.focus();
        element.classList.add('border-red-500', 'ring-2', 'ring-red-500');
        setTimeout(() => {
          element.classList.remove('border-red-500', 'ring-2', 'ring-red-500');
        }, 3000);
      }
    }
  };

  // ============================================
  // PRINT FUNCTION
  // ============================================
  
  const generatePrintHTML = (): string => {
    const data = admissionData;
    if (!data) return '<html><body><p>No data to print</p></body></html>';

    const className = classes.find(c => c.id === data.class_id)?.name || '';
    const sectionName = sections.find(s => s.id === data.section_id)?.name || '';
    const academicYearName = academicYears.find(ay => ay.id === data.academic_year_id)?.name || data.academic_year_id || '';

    const calculateAge = (dob: string) => {
      if (!dob) return '';
      const birth = new Date(dob);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      return `${age}`;
    };

    const age = calculateAge(data.dob);

    const header = getSchoolPrintHeader(schoolSettings, "Admission Form", true, photoPreview);

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Admission Form - ${data.name}</title>
          <meta charset="UTF-8">
<style>
             @page { 
               size: A4 portrait; 
               margin: 10mm 12mm;
             }
             * { margin: 0; padding: 0; box-sizing: border-box; }
             body { 
               font-family: Arial, 'Noto Sans Bengali', sans-serif; 
               background: white; 
               color: #000;
               padding: 0;
               font-size: 11px;
               -webkit-print-color-adjust: exact;
               print-color-adjust: exact;
             }
             .print-container { 
               width: 100%; 
               padding: 0;
               max-width: 100%;
             }
             .section {
               margin-top: 6px; 
             }
             .section-title { 
               font-size: 11px; 
               font-weight: bold; 
               background: #1a3e60; 
               color: #fff;
               padding: 3px 10px; 
               margin-bottom: 4px; 
               border-radius: 2px;
             }
             .info-grid {
               display: grid;
               grid-template-columns: 1fr 1fr;
               gap: 6px;
               margin: 4px 0;
             }
            .info-grid .col {
              border: 1px solid #ccc;
              padding: 5px 8px;
              border-radius: 2px;
              background: #fafafa;
            }
            .info-grid .col h4 {
              font-size: 9px;
              color: #1a3e60;
              border-bottom: 1px solid #ddd;
              padding-bottom: 2px;
              margin-bottom: 3px;
            }
            .info-grid .col p {
              font-size: 9.5px;
              margin: 2px 0;
              line-height: 1.4;
            }
            .info-grid .col .lbl {
              font-weight: bold;
              display: inline-block;
              width: 80px;
              font-size: 8.5px;
            }
            .age-info {
              background: #fafafa;
              padding: 5px 12px;
              border: 1px solid #d0d0d0;
              margin: 4px 0;
              font-size: 9.5px;
              border-radius: 3px;
              text-align: center;
            }
            .age-info .highlight {
              font-weight: bold;
              color: #1a3e60;
            }
            .age-info .bullet {
              margin: 0 4px;
              color: #888;
            }
            .age-info .selected {
              font-weight: bold;
              color: #1a3e60;
              background: #e8f0fe;
              padding: 0 6px;
              border-radius: 2px;
            }
            .age-info .unselected {
              color: #888;
            }
            .conditions {
              background: #f4f8fc;
              padding: 6px 12px;
              border-left: 3px solid #1a3e60;
              margin: 6px 0;
              font-size: 9px;
              line-height: 1.6;
            }
            .conditions p {
              margin-bottom: 0.5px;
            }
            .signature-area {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin: 8px 0;
              border-top: 1px solid #ccc;
              padding-top: 8px;
            }
            .signature-area .sig {
              font-size: 11px;
              font-weight: 500;
            }
            .signature-area .sig span {
              display: inline-block;
              border-bottom: 1px solid #333;
              min-width: 130px;
              margin-left: 5px;
              padding: 0 5px;
            }
            .footer { 
              text-align: center; 
              font-size: 8px; 
              color: #666; 
              border-top: 1px solid #ccc; 
              padding-top: 5px; 
              margin-top: 10px; 
            }
            @media print {
              body { background: white; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="print-container">
            ${header}

             <!-- STUDENT INFORMATION -->
            <div class="section">
              <div class="section-title">📘 Student Information</div>
              <div class="info-grid">
                <div class="col">
                  <h4>Personal Details</h4>
                  <p><span class="lbl">Name (English):</span> ${data.name || '-'}</p>
                  <p><span class="lbl">Name (Bangla):</span> ${data.name_bn || '-'}</p>
                  <p><span class="lbl">Date of Birth:</span> ${data.dob || '-'}</p>
                  <p><span class="lbl">Age:</span> ${age || '-'} years</p>
                  <p><span class="lbl">Gender:</span> ${data.gender || '-'}</p>
                  <p><span class="lbl">Blood Group:</span> ${data.blood_group || '-'}</p>
                </div>
                <div class="col">
                  <h4>Parent Information</h4>
                  <p><span class="lbl">Father's Name:</span> ${data.father_name || '-'}</p>
                  <p><span class="lbl">Father (Bangla):</span> ${data.father_name_bn || '-'}</p>
                  <p><span class="lbl">Mother's Name:</span> ${data.mother_name || '-'}</p>
                  <p><span class="lbl">Mother (Bangla):</span> ${data.mother_name_bn || '-'}</p>
                  <p><span class="lbl">Guardian Contact:</span> ${data.contact || '-'}</p>
                  <p><span class="lbl">Particular Disease:</span> ${data.particular_disease || 'None'}</p>
                </div>
              </div>
            </div>

            <!-- ADDRESS -->
            <div class="section">
              <div class="section-title">🏠 Address Information</div>
              <div class="info-grid">
                <div class="col">
                  <h4>Present Address</h4>
                  <p><span class="lbl">District:</span> ${data.district || '-'}</p>
                  <p><span class="lbl">Police Station:</span> ${data.police_station || '-'}</p>
                  <p><span class="lbl">Post Office:</span> ${data.post_office || '-'}</p>
                  <p><span class="lbl">Village:</span> ${data.village || '-'}</p>
                </div>
                <div class="col">
                  <h4>Permanent Address</h4>
                  <p><span class="lbl">District:</span> ${data.permanent_district || '-'}</p>
                  <p><span class="lbl">Police Station:</span> ${data.permanent_police_station || '-'}</p>
                  <p><span class="lbl">Post Office:</span> ${data.permanent_post_office || '-'}</p>
                  <p><span class="lbl">Village:</span> ${data.permanent_village || '-'}</p>
                </div>
              </div>
            </div>

            <!-- ACADEMIC INFO -->
            <div class="section">
              <div class="section-title">🎓 Academic Information</div>
              <div class="info-grid">
                <div class="col">
                  <h4>Class & Section</h4>
                  <p><span class="lbl">Class:</span> ${className || '-'}</p>
                  <p><span class="lbl">Section:</span> ${sectionName || '-'}</p>
                  <p><span class="lbl">Class Roll:</span> ${data.class_roll || 'Auto-generated'}</p>
                  <p><span class="lbl">Academic Year:</span> ${academicYearName || '-'}</p>
                  <p><span class="lbl">Admission Date:</span> ${data.admission_date || '-'}</p>
                </div>
                <div class="col">
                  <h4>Contact Information</h4>
                  <p><span class="lbl">Father's Contact:</span> ${data.fathers_contact || '-'}</p>
                  <p><span class="lbl">Mother's Contact:</span> ${data.mothers_contact || '-'}</p>
                  <p><span class="lbl">Email:</span> ${data.email || '-'}</p>
                  <p><span class="lbl">WhatsApp:</span> ${data.whatsapp || '-'}</p>
                  <p><span class="lbl">Birth Certificate:</span> ${data.birth_cert_no || '-'}</p>
                </div>
              </div>
            </div>

            <!-- AGE / CLASS INFORMATION - Static notice only -->
            <div class="section">
              <div class="section-title">📋 Age Based Class Selection (Notice)</div>
              <div class="age-info">
                <span class="selected">ভর্তির বয়সঃ</span>
                <span class="bullet">◼</span>
                <span class="selected">প্লে (৩-৫ বছর)</span>
                <span class="bullet">◼</span>
                <span class="unselected">নার্সারী (৪-৫ বছর)</span>
                <span class="bullet">◼</span>
                <span class="unselected">কে.জি (৫-৬ বছর)</span>
                <span class="bullet">◼</span>
                <span class="unselected">প্রথম শ্রেণী (৬ বছর)</span>
                <span class="bullet">◼</span>
                <span class="unselected">দ্বিতীয় শ্রেণী (৭ বছর)</span>
                <span class="bullet">◼</span>
                <span class="unselected">তৃতীয় শ্রেণী (৮ বছর)</span>
                <span class="bullet">◼</span>
                <span class="unselected">চতুর্থ শ্রেণী (৯ বছর)</span>
                <span class="bullet">◼</span>
                <span class="unselected">পঞ্চম শ্রেণী (১০ বছর)</span>
              </div>
            </div>

            <!-- CONDITIONS -->
            <div class="conditions">
              <p><strong>📋 শর্তাবলী / Conditions:</strong></p>
              <p>■ শিক্ষার্থীকে নিয়মিত নির্ধারিত স্কুল ইউনিফর্মে পাঠাব।</p>
              <p>■ বিদ্যালয়ের সকল নিয়ম-শৃঙ্খলা মেনে চলব।</p>
              <p>■ জাতীয় ও স্কুলের সকল অনুষ্ঠানে উপস্থিতি নিশ্চিত করব।</p>
              <p>■ মাসিক বেতন ও অন্যান্য ফি যথাসময়ে পরিশোধ করব।</p>
              <p>■ স্কুলের বাইরে যেকোন দুর্ঘটনার জন্য স্কুল কর্তৃপক্ষ দায়ী থাকবে না।</p>
              <p>■ যেকোনো সমস্যায় সরাসরি স্কুল কর্তৃপক্ষের সাথে যোগাযোগ করব ।</p>
              <p style="margin-top:3px; font-style:italic; color:#444; font-size:8.5px;">
                আমি সকল শর্ত মেনে চলার অঙ্গীকার করে আমার সন্তানকে ভর্তির আবেদন করছি।
              </p>
            </div>

            <!-- SIGNATURE -->
            <div class="signature-area">
              <div class="sig">Guardian Signature: <span>${data.father_name || '___________'}</span></div>
              <div class="sig">Date: <span>${data.admission_date || new Date().toLocaleDateString()}</span></div>
            </div>

<!-- Footer -->
            <div class="footer">
              Generated on ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })} 
              • Powered by ${schoolSettings.school_name || "Shapla Kindergarten & Pre-cadet"}
            </div>
          </div>
          
          <script>
            let printStarted = false;
            
            window.onload = function() {
              if (!printStarted) {
                printStarted = true;
                setTimeout(function() {
                  window.print();
                }, 500);
              }
            };
            
            window.onafterprint = function() {
              window.close();
            };
          <\/script>
        </body>
      </html>
    `;
  };

  const handlePrint = () => {
    setPrinting(true);
    const printHTML = generatePrintHTML();
    const printWindow = window.open('', '_blank', 'width=800,height=1100,toolbar=yes,scrollbars=yes,menubar=yes');
    
    if (printWindow) {
      printWindow.document.write(printHTML);
      printWindow.document.close();
      printWindow.focus();
      
      const checkPrintClosed = setInterval(() => {
        if (printWindow.closed) {
          clearInterval(checkPrintClosed);
          setPrinting(false);
          setShowSuccessDialog(false);
          resetForm();
          addToast({
            type: "info",
            title: "Ready for New Admission",
            message: "Print completed. Form has been reset for new admission.",
          });
        }
      }, 500);

      setTimeout(() => {
        clearInterval(checkPrintClosed);
        if (!printWindow.closed) {
          printWindow.close();
        }
        setPrinting(false);
        setShowSuccessDialog(false);
        resetForm();
      }, 60000);
      
    } else {
      setPrinting(false);
      addToast({
        type: "error",
        title: "Print Failed",
        message: "Please allow popups for this site",
      });
    }
  };

  const handleNewAdmission = () => {
    setShowSuccessDialog(false);
    resetForm();
  };

  const handleViewStudent = async () => {
    setShowSuccessDialog(false);
    
    if (!admittedStudentId) {
      addToast({
        type: "error",
        title: "Error",
        message: "Student ID not found. Please try again.",
      });
      router.push("/students/list");
      return;
    }

    addToast({
      type: "info",
      title: "Loading Student",
      message: `Fetching student profile for ID: ${admittedStudentId}...`,
    });

    try {
      console.log(`🔍 Attempting to fetch student with ID: ${admittedStudentId}`);
      
      const supabase = createClient();
      
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('id, student_id, name')
        .eq('student_id', admittedStudentId)
        .maybeSingle();
      
      if (studentError) {
        console.error('❌ Error fetching student:', studentError);
        addToast({
          type: "error",
          title: "Error",
          message: "Failed to fetch student profile",
        });
        router.push("/students/list");
        return;
      }
      
      if (!studentData) {
        console.error('❌ Student not found:', admittedStudentId);
        addToast({
          type: "warning",
          title: "Student Not Found",
          message: `Student with ID ${admittedStudentId} not found.`,
        });
        router.push("/students/list");
        return;
      }
      
      console.log('✅ Student found:', studentData);
      
      const uuid = studentData.id;
      console.log(`✅ Redirecting to /students/${uuid}`);
      
      addToast({
        type: "success",
        title: "Student Found",
        message: `Redirecting to ${studentData.name}'s profile`,
      });
      
      router.push(`/students/${uuid}`);
      
    } catch (error) {
      console.error("❌ Error in handleViewStudent:", error);
      addToast({
        type: "error",
        title: "Error",
        message: error instanceof Error ? error.message : "Failed to load student profile. Please try again.",
      });
      setTimeout(() => {
        router.push("/students/list");
      }, 2000);
    }
  };

  const handleGoToList = () => {
    setShowSuccessDialog(false);
    router.push("/students/list");
  };

  const sectionsList = [
    { title: "Basic Information", icon: User },
    { title: "Address", icon: MapPin },
    { title: "Academic Info", icon: GraduationCap },
    { title: "Contact", icon: Contact },
    { title: "Documents", icon: FileText },
  ];

  const watchAllFields = watch();
  const isFormComplete = () => {
    const required = ['name', 'father_name', 'mother_name', 'dob', 'gender', 'contact', 'class_id', 'section_id'];
    for (const field of required) {
      if (!watchAllFields[field as keyof StudentFormData]) {
        return false;
      }
    }
    return true;
  };

  const goToPreviousSection = () => {
    if (activeSection > 0) {
      setActiveSection(activeSection - 1);
    }
  };

  const goToNextSection = () => {
    if (activeSection < 4) {
      setActiveSection(activeSection + 1);
    }
  };

  return (
    <ResponsiveLayout>
      <div className="min-h-screen bg-background text-foreground">
        {/* Banner Section */}
        <div className="relative mb-8 p-6 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 text-white overflow-hidden shadow-lg">
          <div className="absolute inset-0 bg-black/10 backdrop-blur-[2px]"></div>
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" asChild className="text-white hover:bg-white/20">
                <Link href="/students/list">
                  <ArrowLeft className="h-5 w-5" />
                </Link>
              </Button>
              <div>
                <h1 className="text-2xl font-bold font-heading">New Admission</h1>
                <p className="text-white/80">Complete the enrollment process</p>
              </div>
            </div>
            {previewStudentId && selectedClassId && (
              <div className="bg-white/20 backdrop-blur-md rounded-xl px-6 py-3 border border-white/20">
                <p className="text-xs text-white/70 uppercase tracking-wider">Student ID Preview</p>
                <p className="text-xl font-mono font-bold">{previewStudentId}</p>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
          {sectionsList.map((section, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setActiveSection(index)}
              className={`flex flex-col items-center p-3 rounded-xl border transition-all duration-200 ${
                activeSection === index
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-600/20"
                  : "bg-card hover:bg-accent border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <section.icon className={`h-5 w-5 mb-1 ${
                activeSection === index ? "text-white" : "text-indigo-500"
              }`} />
              <span className="text-xs font-semibold uppercase tracking-wide">{section.title}</span>
            </button>
          ))}
        </div>

        {/* Form */}
        <form 
          ref={formRef}
          onSubmit={handleSubmit(onSubmit, onInvalidSubmit)} 
          className="space-y-6"
          id="admission-form"
          noValidate
        >
          {/* Section 0: Basic Information */}
          {activeSection === 0 && (
            <Card className="border-border shadow-sm">
              <CardHeader className="bg-muted/50 border-b">
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-indigo-500" /> 
                  Basic Information
                </CardTitle>
                <CardDescription>Personal details of the student</CardDescription>
              </CardHeader>
              <CardContent className="p-6 grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name" className={errors.name ? "text-red-500" : ""}>
                    Full Name (English) *
                  </Label>
                  <Controller
                    name="name"
                    control={control}
                    render={({ field }) => (
                      <Input 
                        id="name"
                        value={field.value || ""}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        placeholder="Enter full name"
                        className={`w-full ${errors.name ? "border-red-500 ring-2 ring-red-500" : ""}`}
                      />
                    )}
                  />
                  {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name_bn">Full Name (Bangla)</Label>
                  <Controller
                    name="name_bn"
                    control={control}
                    render={({ field }) => (
                      <Input 
                        id="name_bn"
                        value={field.value || ""}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        placeholder="বাংলায় নাম"
                        className="w-full"
                      />
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="father_name" className={errors.father_name ? "text-red-500" : ""}>
                    Father's Name (English) *
                  </Label>
                  <Controller
                    name="father_name"
                    control={control}
                    render={({ field }) => (
                      <Input 
                        id="father_name"
                        value={field.value || ""}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        placeholder="Enter father's name"
                        className={`w-full ${errors.father_name ? "border-red-500 ring-2 ring-red-500" : ""}`}
                      />
                    )}
                  />
                  {errors.father_name && <p className="text-xs text-red-500">{errors.father_name.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="father_name_bn">Father's Name (Bangla)</Label>
                  <Controller
                    name="father_name_bn"
                    control={control}
                    render={({ field }) => (
                      <Input 
                        id="father_name_bn"
                        value={field.value || ""}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        placeholder="বাবার নাম বাংলায়"
                        className="w-full"
                      />
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mother_name" className={errors.mother_name ? "text-red-500" : ""}>
                    Mother's Name (English) *
                  </Label>
                  <Controller
                    name="mother_name"
                    control={control}
                    render={({ field }) => (
                      <Input 
                        id="mother_name"
                        value={field.value || ""}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        placeholder="Enter mother's name"
                        className={`w-full ${errors.mother_name ? "border-red-500 ring-2 ring-red-500" : ""}`}
                      />
                    )}
                  />
                  {errors.mother_name && <p className="text-xs text-red-500">{errors.mother_name.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mother_name_bn">Mother's Name (Bangla)</Label>
                  <Controller
                    name="mother_name_bn"
                    control={control}
                    render={({ field }) => (
                      <Input 
                        id="mother_name_bn"
                        value={field.value || ""}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        placeholder="মায়ের নাম বাংলায়"
                        className="w-full"
                      />
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dob" className={errors.dob ? "text-red-500" : ""}>
                    Date of Birth *
                  </Label>
                  <Controller
                    name="dob"
                    control={control}
                    render={({ field }) => (
                      <Input 
                        id="dob"
                        type="date" 
                        value={field.value || ""}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        className={`w-full ${errors.dob ? "border-red-500 ring-2 ring-red-500" : ""}`}
                      />
                    )}
                  />
                  {errors.dob && <p className="text-xs text-red-500">{errors.dob.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gender" className={errors.gender ? "text-red-500" : ""}>
                    Gender *
                  </Label>
                  <Controller
                    name="gender"
                    control={control}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value || "male"}>
                        <SelectTrigger id="gender" className={`w-full ${errors.gender ? "border-red-500 ring-2 ring-red-500" : ""}`}>
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[200px] overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                          {genders.map(g => (
                            <SelectItem key={g} value={g.toLowerCase()}>{g}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.gender && <p className="text-xs text-red-500">{errors.gender.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="blood_group">Blood Group</Label>
                  <Controller
                    name="blood_group"
                    control={control}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <SelectTrigger id="blood_group" className="w-full">
                          <SelectValue placeholder="Select blood group" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[200px] overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                          {bloodGroups.map(bg => (
                            <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="particular_disease">Particular Disease</Label>
                  <Controller
                    name="particular_disease"
                    control={control}
                    render={({ field }) => (
                      <Input 
                        id="particular_disease"
                        value={field.value || ""}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        placeholder="Any chronic disease or allergy"
                        className="w-full"
                      />
                    )}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="contact" className={errors.contact ? "text-red-500" : ""}>
                    Contact Number *
                  </Label>
                  <Controller
                    name="contact"
                    control={control}
                    render={({ field }) => (
                      <Input 
                        id="contact"
                        type="tel"
                        value={field.value || ""}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        placeholder="01XXXXXXXXX"
                        className={`w-full ${errors.contact ? "border-red-500 ring-2 ring-red-500" : ""}`}
                      />
                    )}
                  />
                  {errors.contact && <p className="text-xs text-red-500">{errors.contact.message}</p>}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Section 1: Address */}
          {activeSection === 1 && (
            <Card className="border-border shadow-sm">
              <CardHeader className="bg-muted/50 border-b">
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-emerald-500" /> 
                  Address Information
                </CardTitle>
                <CardDescription>Student's address details</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {/* Present Address */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <Home className="h-4 w-4 text-emerald-500" />
                    Present Address
                  </h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="district">District</Label>
                      <Controller
                        name="district"
                        control={control}
                        render={({ field }) => (
                          <Input 
                            id="district"
                            value={field.value || ""}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            placeholder="Type or select district" 
                            list="districts"
                            className="w-full"
                          />
                        )}
                      />
                      <datalist id="districts">
                        {districts.map(d => <option key={d.id} value={d.name} />)}
                      </datalist>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="police_station">Police Station</Label>
                      <Controller
                        name="police_station"
                        control={control}
                        render={({ field }) => (
                          <Input 
                            id="police_station"
                            value={field.value || ""}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            placeholder="Type or select police station" 
                            list="police"
                            className="w-full"
                          />
                        )}
                      />
                      <datalist id="police">
                        {policeStations.map(ps => <option key={ps.id} value={ps.name} />)}
                      </datalist>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="post_office">Post Office</Label>
                      <Controller
                        name="post_office"
                        control={control}
                        render={({ field }) => (
                          <Input 
                            id="post_office"
                            value={field.value || ""}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            placeholder="Type or select post office" 
                            list="post"
                            className="w-full"
                          />
                        )}
                      />
                      <datalist id="post">
                        {postOffices.map(po => <option key={po.id} value={po.name} />)}
                      </datalist>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="village">Village</Label>
                      <Controller
                        name="village"
                        control={control}
                        render={({ field }) => (
                          <Input 
                            id="village"
                            value={field.value || ""}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            placeholder="Type or select village" 
                            list="villages"
                            className="w-full"
                          />
                        )}
                      />
                      <datalist id="villages">
                        {villages.map(v => <option key={v.id} value={v.name} />)}
                      </datalist>
                    </div>
                  </div>
                </div>

                {/* Permanent Address */}
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-blue-500" />
                    Permanent Address
                  </h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="permanent_district">District</Label>
                      <Controller
                        name="permanent_district"
                        control={control}
                        render={({ field }) => (
                          <Input 
                            id="permanent_district"
                            value={field.value || ""}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            placeholder="Type or select district" 
                            list="districts"
                            className="w-full"
                          />
                        )}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="permanent_police_station">Police Station</Label>
                      <Controller
                        name="permanent_police_station"
                        control={control}
                        render={({ field }) => (
                          <Input 
                            id="permanent_police_station"
                            value={field.value || ""}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            placeholder="Type or select police station" 
                            list="police"
                            className="w-full"
                          />
                        )}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="permanent_post_office">Post Office</Label>
                      <Controller
                        name="permanent_post_office"
                        control={control}
                        render={({ field }) => (
                          <Input 
                            id="permanent_post_office"
                            value={field.value || ""}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            placeholder="Type or select post office" 
                            list="post"
                            className="w-full"
                          />
                        )}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="permanent_village">Village</Label>
                      <Controller
                        name="permanent_village"
                        control={control}
                        render={({ field }) => (
                          <Input 
                            id="permanent_village"
                            value={field.value || ""}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            placeholder="Type or select village" 
                            list="villages"
                            className="w-full"
                          />
                        )}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Section 2: Academic Info */}
          {activeSection === 2 && (
            <Card className="border-border shadow-sm">
              <CardHeader className="bg-muted/50 border-b">
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-amber-500" /> 
                  Academic Information
                </CardTitle>
                <CardDescription>Assign class and section</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="class_id" className={errors.class_id ? "text-red-500" : ""}>
                      Class *
                    </Label>
                    <Controller
                      name="class_id"
                      control={control}
                      render={({ field }) => (
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value || ""} 
                          disabled={loadingClasses}
                        >
                          <SelectTrigger 
                            id="class_id" 
                            className={`w-full ${errors.class_id ? "border-red-500 ring-2 ring-red-500" : ""}`}
                          >
                            <SelectValue 
                              placeholder={loadingClasses ? "Loading classes..." : "Select class"} 
                            />
                          </SelectTrigger>
                          <SelectContent className="max-h-[200px] overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                            {classes.map(c => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.class_id && <p className="text-xs text-red-500">{errors.class_id.message}</p>}
                    {!loadingClasses && classes.length === 0 && (
                      <p className="text-xs text-amber-600">
                        ⚠️ No classes available. Please add classes in settings.
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="section_id" className={errors.section_id ? "text-red-500" : ""}>
                      Section *
                    </Label>
                    <Controller
                      name="section_id"
                      control={control}
                      render={({ field }) => (
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value || ""} 
                          disabled={!selectedClassId || sections.length === 0}
                        >
                          <SelectTrigger 
                            id="section_id" 
                            className={`w-full ${errors.section_id ? "border-red-500 ring-2 ring-red-500" : ""}`}
                          >
                            <SelectValue 
                              placeholder={
                                !selectedClassId 
                                  ? "Select class first" 
                                  : sections.length === 0 
                                    ? "No sections available" 
                                    : "Select section"
                              } 
                            />
                          </SelectTrigger>
                          <SelectContent className="max-h-[200px] overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                            {sections.map(s => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.section_id && <p className="text-xs text-red-500">{errors.section_id.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="class_roll">Class Roll</Label>
                    <Controller
                      name="class_roll"
                      control={control}
                      render={({ field }) => (
                        <Input 
                          id="class_roll"
                          value={field.value || ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          placeholder="Auto-generated roll"
                          className="w-full"
                        />
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="academic_year_id" className={errors.academic_year_id ? "text-red-500" : ""}>
                      Academic Year
                    </Label>
                    <Controller
                      name="academic_year_id"
                      control={control}
                      render={({ field }) => (
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value || ""}
                        >
                          <SelectTrigger 
                            id="academic_year_id" 
                            className={`w-full ${errors.academic_year_id ? "border-red-500 ring-2 ring-red-500" : ""}`}
                          >
                            <SelectValue placeholder="Select academic year" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[200px] overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                            {academicYears.map(ay => (
                              <SelectItem key={ay.id} value={ay.id}>
                                {ay.name || ay.year_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.academic_year_id && <p className="text-xs text-red-500">{errors.academic_year_id.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admission_date">Admission Date</Label>
                    <Controller
                      name="admission_date"
                      control={control}
                      render={({ field }) => (
                        <Input 
                          id="admission_date"
                          type="date" 
                          value={field.value || ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          className="w-full"
                        />
                      )}
                    />
                  </div>
                </div>

                {/* ✅ NEW: Fee Structure Status Display */}
                {selectedClassId && selectedAcademicYearId && (
                  <div className="mt-4">
                    {loadingFeeStructure ? (
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 flex items-center gap-2">
                        <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                        <p className="text-sm text-blue-700 dark:text-blue-300">Loading fee structure...</p>
                      </div>
                    ) : selectedFeeStructureId ? (
                      <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <p className="text-sm text-green-700 dark:text-green-300">
                          ✅ Fee Structure: <span className="font-semibold">Auto-assigned for this class</span>
                        </p>
                      </div>
                    ) : (
                      <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-amber-500" />
                        <p className="text-sm text-amber-700 dark:text-amber-300">
                          ⚠️ No fee structure found for this class. Please add fee structure in settings.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Section 3: Contact Information */}
          {activeSection === 3 && (
            <Card className="border-border shadow-sm">
              <CardHeader className="bg-muted/50 border-b">
                <CardTitle className="flex items-center gap-2">
                  <Contact className="h-5 w-5 text-sky-500" /> 
                  Contact Information
                </CardTitle>
                <CardDescription>Parent/Guardian contact details</CardDescription>
              </CardHeader>
              <CardContent className="p-6 grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fathers_contact">Father's Contact</Label>
                  <Controller
                    name="fathers_contact"
                    control={control}
                    render={({ field }) => (
                      <Input 
                        id="fathers_contact"
                        type="tel"
                        value={field.value || ""}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        placeholder="01XXXXXXXXX"
                        className="w-full"
                      />
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mothers_contact">Mother's Contact</Label>
                  <Controller
                    name="mothers_contact"
                    control={control}
                    render={({ field }) => (
                      <Input 
                        id="mothers_contact"
                        type="tel"
                        value={field.value || ""}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        placeholder="01XXXXXXXXX"
                        className="w-full"
                      />
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Controller
                    name="email"
                    control={control}
                    render={({ field }) => (
                      <Input 
                        id="email"
                        type="email" 
                        value={field.value || ""}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        placeholder="parent@email.com"
                        className={`w-full ${errors.email ? "border-red-500 ring-2 ring-red-500" : ""}`}
                      />
                    )}
                  />
                  {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whatsapp">WhatsApp Number</Label>
                  <Controller
                    name="whatsapp"
                    control={control}
                    render={({ field }) => (
                      <Input 
                        id="whatsapp"
                        type="tel"
                        value={field.value || ""}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        placeholder="01XXXXXXXXX"
                        className="w-full"
                      />
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Section 4: Documents */}
          {activeSection === 4 && (
            <Card className="border-border shadow-sm">
              <CardHeader className="bg-muted/50 border-b">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-violet-500" /> 
                  Documents & Certificates
                </CardTitle>
                <CardDescription>Enter certificate numbers and upload photo</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="birth_cert_no">Birth Certificate Number</Label>
                    <Controller
                      name="birth_cert_no"
                      control={control}
                      render={({ field }) => (
                        <Input 
                          id="birth_cert_no"
                          value={field.value || ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          placeholder="Enter birth certificate number"
                          className="w-full"
                        />
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="father_nid_no">Father's NID</Label>
                    <Controller
                      name="father_nid_no"
                      control={control}
                      render={({ field }) => (
                        <Input 
                          id="father_nid_no"
                          value={field.value || ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          placeholder="Enter father's NID reference"
                          className="w-full"
                        />
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mother_nid_no">Mother's NID</Label>
                    <Controller
                      name="mother_nid_no"
                      control={control}
                      render={({ field }) => (
                        <Input 
                          id="mother_nid_no"
                          value={field.value || ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          placeholder="Enter mother's NID reference"
                          className="w-full"
                        />
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Student Photo (JPG, PNG max 2MB)</Label>
                  <div className={`border-2 border-dashed rounded-xl p-8 text-center hover:bg-accent/50 transition-colors cursor-pointer group ${
                    photoError ? "border-red-500 bg-red-50" : "border-border"
                  }`}>
                    <input
                      type="file"
                      id="student_photo"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/jpeg,image/png,image/jpg"
                      onChange={handlePhotoChange}
                    />
                    <label htmlFor="student_photo" className="cursor-pointer block">
                      <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground group-hover:text-primary transition-colors" />
                      <p className="text-sm font-medium">Click to upload student photo</p>
                      <p className="text-xs text-muted-foreground mt-1">JPG, PNG (max 2MB)</p>
                    </label>
                  </div>
                  
                  {photoPreview && (
                    <div className="mt-3 p-3 border rounded-lg bg-gray-50 flex items-center gap-4">
                      <div className="relative">
                        <img 
                          src={photoPreview} 
                          alt="Student Photo Preview" 
                          className="h-16 w-16 object-cover rounded-full border-2 border-indigo-200"
                        />
                        <button
                          type="button"
                          onClick={removePhoto}
                          className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700">{photoFile?.name}</p>
                        <p className="text-xs text-gray-500">{photoFile ? (photoFile.size / 1024).toFixed(1) : 0} KB</p>
                      </div>
                    </div>
                  )}
                  
                  {photoError && (
                    <div className="mt-2 p-3 border border-red-200 bg-red-50 rounded-lg flex items-start gap-2">
                      <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-red-700">Photo Upload Error</p>
                        <p className="text-xs text-red-600">{photoError}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between gap-4 pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              disabled={activeSection === 0}
              onClick={goToPreviousSection}
            >
              Previous
            </Button>
            
            <div className="flex gap-3">
              <Button type="button" variant="ghost" asChild>
                <Link href="/students/list">Cancel</Link>
              </Button>
              {activeSection < 4 ? (
                <Button 
                  type="button" 
                  onClick={goToNextSection}
                >
                  Next Section
                </Button>
              ) : (
                <Button 
                  type="button"
                  onClick={handleFormSubmit}
                  disabled={loading || isSubmitting || !isFormComplete()} 
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Complete Admission"
                  )}
                </Button>
              )}
            </div>
          </div>
        </form>

        {/* Success Dialog */}
        <Dialog 
          open={showSuccessDialog} 
          onOpenChange={(open) => {
            console.log("Dialog open changed:", open);
            setShowSuccessDialog(open);
          }}
        >
          <DialogOverlay className="fixed inset-0 bg-black/80" />
          <DialogContent className="sm:max-w-lg md:max-w-xl lg:max-w-2xl bg-white dark:bg-gray-900 opacity-100 shadow-2xl border border-gray-200 dark:border-gray-700 p-6 max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-center mb-4">
                <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="h-12 w-12 text-green-600" />
                </div>
              </div>
              <DialogTitle className="text-center text-3xl font-bold text-green-600">
                Admission Successful! 🎉
              </DialogTitle>
              <DialogDescription className="text-center text-lg mt-2">
                Student <span className="font-semibold text-gray-900 dark:text-white">{admittedStudentName}</span> has been successfully admitted.
                {admittedStudentId && (
                  <span className="block mt-2 text-base text-gray-500">
                    Student ID: <span className="font-mono font-semibold text-indigo-600 text-xl">{admittedStudentId}</span>
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex flex-wrap justify-center gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                onClick={handlePrint}
                disabled={printing}
                variant="outline"
                className="min-w-[120px] border-gray-300 dark:border-gray-600"
              >
                {printing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Printer className="h-4 w-4 mr-2" />
                )}
                Print Form
              </Button>
              <Button
                onClick={handleNewAdmission}
                className="min-w-[120px] bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
              >
                <User className="h-4 w-4 mr-2" />
                New Admission
              </Button>
              <Button
                onClick={handleViewStudent}
                variant="outline"
                className="min-w-[120px]"
              >
                <GraduationCap className="h-4 w-4 mr-2" />
                View Profile
              </Button>
              <Button
                onClick={handleGoToList}
                variant="ghost"
                className="min-w-[120px]"
              >
                Go to List
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ResponsiveLayout>
  );
}