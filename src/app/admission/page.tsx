// src/app/admission/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft, Upload, User, GraduationCap, Contact, FileText, MapPin,
  CheckCircle, Loader2, X, AlertCircle, Printer, Home, Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogOverlay } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { submitPublicAdmission } from "./actions";
import { getSchoolPrintHeader } from "@/components/print/SchoolPrintHeader";

// ═══════════════════════════════════════════════════════════════════════
// HELPER: Normalize Bangla digits
// ═══════════════════════════════════════════════════════════════════════
function normalizeDigits(input: string): string {
  const banglaDigits: Record<string, string> = {
    "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4",
    "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9",
  };
  return input.replace(/[০-৯]/g, (d) => banglaDigits[d] || d);
}

// ═══════════════════════════════════════════════════════════════════════
// CLIENT-SIDE VALIDATION SCHEMA (Zod v4)
// ═══════════════════════════════════════════════════════════════════════
const admissionSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(255),
  name_bn: z.string().trim().max(255).optional(),
  father_name: z.string().trim().min(2, "Father's name is required").max(255),
  father_name_bn: z.string().trim().max(255).optional(),
  mother_name: z.string().trim().min(2, "Mother's name is required").max(255),
  mother_name_bn: z.string().trim().max(255).optional(),
  dob: z.string().min(1, "Date of birth is required").refine(
    (date) => new Date(date) <= new Date(),
    { message: "Date of birth cannot be in the future" }
  ),
  gender: z.enum(["male", "female", "other"]),
  blood_group: z.string().optional(),
  particular_disease: z.string().trim().max(500).optional(),
  birth_cert_no: z.string().trim().max(50).optional(),
  class_id: z.string().uuid("Class is required"),
  section_id: z.string().uuid("Section is required"),
  academic_year_id: z.string().uuid("Invalid academic year").optional(),
  village: z.string().trim().max(255).optional(),
  post_office: z.string().trim().max(255).optional(),
  police_station: z.string().trim().max(255).optional(),
  district: z.string().trim().max(100).optional(),
  permanent_village: z.string().trim().max(255).optional(),
  permanent_post_office: z.string().trim().max(255).optional(),
  permanent_police_station: z.string().trim().max(255).optional(),
  permanent_district: z.string().trim().max(100).optional(),
  contact: z.string().trim().min(11, "Contact must be at least 11 digits").max(20)
    .regex(/^[0-9+\-\s()]+$/, "Only numbers and +-() allowed"),
  fathers_contact: z.string().trim().max(20).optional()
    .refine((v) => !v || v.length === 0 || /^[0-9+\-\s()]+$/.test(v), "Only numbers and +-() allowed"),
  mothers_contact: z.string().trim().max(20).optional()
    .refine((v) => !v || v.length === 0 || /^[0-9+\-\s()]+$/.test(v), "Only numbers and +-() allowed"),
  email: z.string().trim().optional()
    .refine((v) => !v || v.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Invalid email"),
  whatsapp: z.string().trim().max(20).optional(),
  father_nid_no: z.string().trim().max(100).optional(),
  mother_nid_no: z.string().trim().max(100).optional(),
});

type FormData = z.infer<typeof admissionSchema>;

interface ClassData { id: string; name: string; numeric_order: number; sections: { id: string; name: string }[]; }
interface AcademicYearData { id: string; name: string; year_name: string; }
interface AddressData { id: string; name: string; }
interface SchoolSettings {
  school_name?: string; school_address?: string; school_phone?: string;
  school_email?: string; school_logo?: string; school_code?: string; emis?: string;
}

const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export default function PublicAdmissionPage() {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [sections, setSections] = useState<{ id: string; name: string }[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYearData[]>([]);
  const [districts, setDistricts] = useState<AddressData[]>([]);
  const [policeStations, setPoliceStations] = useState<AddressData[]>([]);
  const [postOffices, setPostOffices] = useState<AddressData[]>([]);
  const [villages, setVillages] = useState<AddressData[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [admittedStudentName, setAdmittedStudentName] = useState<string>("");
  const [admittedReferenceNo, setAdmittedReferenceNo] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [admissionData, setAdmissionData] = useState<FormData | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings>({
    school_name: "Shapla Kindergarten & Pre-cadet",
    school_address: "Nowtala, Madhaiya, Chandina, Cumilla",
    school_phone: "01777584352",
    school_email: "cma@gmail.com",
    school_logo: "",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const {
    handleSubmit, control, watch, setValue, reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(admissionSchema),
    defaultValues: {
      gender: "male", class_id: "", section_id: "", academic_year_id: "",
      contact: "", fathers_contact: "", mothers_contact: "", whatsapp: "",
      birth_cert_no: "", father_nid_no: "", mother_nid_no: "",
      village: "", post_office: "", police_station: "", district: "",
      permanent_village: "", permanent_post_office: "", permanent_police_station: "",
      permanent_district: "", particular_disease: "", name: "", name_bn: "",
      father_name: "", father_name_bn: "", mother_name: "", mother_name_bn: "",
      dob: "", blood_group: "",
    },
    mode: "onBlur",
  });

  const selectedClassId = watch("class_id");

  // Load school settings
  useEffect(() => {
    async function loadSchoolSettings() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("school_settings")
          .select("school_name, school_address, school_phone, school_email, school_logo")
          .limit(1)
          .single();
        if (data && !error) {
          setSchoolSettings({
            school_name: data.school_name || "Shapla Kindergarten & Pre-cadet",
            school_address: data.school_address || "Nowtala, Madhaiya, Chandina, Cumilla",
            school_phone: data.school_phone || "01777584352",
            school_email: data.school_email || "cma@gmail.com",
            school_logo: data.school_logo || "",
          });
        }
      } catch (err) {
        console.error("Failed to load school settings:", err);
      }
    }
    loadSchoolSettings();
  }, []);

  // Load data
  useEffect(() => {
    async function loadData() {
      try {
        const supabase = createClient();
        const [classesData, yearsData, districtsData, policeData, postData, villageData] = await Promise.all([
          supabase.from("classes").select("id, name, numeric_order, sections (id, name)").order("numeric_order"),
          supabase.from("academic_years").select("id, name, year_name").order("year_name", { ascending: false }),
          supabase.from("address_districts").select("id, name").order("name"),
          supabase.from("address_police_stations").select("id, name").order("name"),
          supabase.from("address_post_offices").select("id, name").order("name"),
          supabase.from("address_villages").select("id, name").order("name"),
        ]);
        setClasses(classesData.data || []);
        setAcademicYears(yearsData.data || []);
        if (yearsData.data && yearsData.data.length > 0) {
          const currentYear = yearsData.data.find((y: any) =>
            y.year_name?.includes(new Date().getFullYear().toString())
          );
          setValue("academic_year_id", currentYear ? currentYear.id : yearsData.data[0].id);
        }
        if (districtsData.data) setDistricts(districtsData.data);
        if (policeData.data) setPoliceStations(policeData.data);
        if (postData.data) setPostOffices(postData.data);
        if (villageData.data) setVillages(villageData.data);
      } catch (err) {
        console.error("Failed to load data:", err);
      } finally {
        setLoadingClasses(false);
      }
    }
    loadData();
  }, [setValue]);

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
        setPhotoFile(null); setPhotoPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        setPhotoError("Photo size must be less than 2MB");
        setPhotoFile(null); setPhotoPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const removePhoto = () => {
    setPhotoFile(null); setPhotoPreview(null); setPhotoError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const resetForm = () => {
    reset({
      gender: "male", class_id: "", section_id: "",
      academic_year_id: academicYears.length > 0 ? academicYears[0].id : "",
      contact: "", fathers_contact: "", mothers_contact: "", whatsapp: "",
      birth_cert_no: "", father_nid_no: "", mother_nid_no: "",
      village: "", post_office: "", police_station: "", district: "",
      permanent_village: "", permanent_post_office: "", permanent_police_station: "",
      permanent_district: "", particular_disease: "", name: "", name_bn: "",
      father_name: "", father_name_bn: "", mother_name: "", mother_name_bn: "",
      dob: "", blood_group: "",
    });
    setPhotoFile(null); setPhotoPreview(null); setPhotoError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setAdmissionData(null); setSubmitError(null); setFieldErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onSubmit = async (data: FormData) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setLoading(true);
    setSubmitError(null);
    setFieldErrors({});

    try {
      const cleanedData = Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, typeof v === "string" && v.trim() === "" ? undefined : v])
      );
      const result = await submitPublicAdmission(cleanedData, photoFile);
      if (result.success) {
        setAdmittedStudentName(data.name);
        setAdmittedReferenceNo(result.referenceNo);
        setAdmissionData(data);
        setTimeout(() => setShowSuccessDialog(true), 100);
      } else {
        setSubmitError(result.error);
        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors);
          const firstError = Object.keys(result.fieldErrors)[0];
          if (firstError) {
            const el = document.getElementById(firstError);
            if (el) {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
              el.focus();
            }
          }
        }
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "An unexpected error occurred");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setLoading(false);
      setIsSubmitting(false);
    }
  };

  const onInvalidSubmit = (errors: any) => {
    const firstError = Object.keys(errors)[0];
    if (firstError) {
      const element = document.getElementById(firstError);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        element.focus();
        element.classList.add("border-red-500", "ring-2", "ring-red-500");
        setTimeout(() => element.classList.remove("border-red-500", "ring-2", "ring-red-500"), 3000);
      }
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // PRINT FUNCTION
  // ═══════════════════════════════════════════════════════════════════
  const generatePrintHTML = (): string => {
    const data = admissionData;
    if (!data) return "<html><body><p>No data to print</p></body></html>";
    const className = classes.find((c) => c.id === data.class_id)?.name || "";
    const sectionName = sections.find((s) => s.id === data.section_id)?.name || "";
    const academicYearName = academicYears.find((ay) => ay.id === data.academic_year_id)?.name || "";
    const header = getSchoolPrintHeader(schoolSettings, "Admission Form", true, photoPreview);

    return `
      <!DOCTYPE html>
      <html><head><title>Admission Form - ${data.name}</title><meta charset="UTF-8">
      <style>
        @page { size: A4 portrait; margin: 10mm 12mm; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, 'Noto Sans Bengali', sans-serif; background: white; color: #000; font-size: 11px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .print-container { width: 100%; padding: 0; max-width: 100%; }
        .section { margin-top: 6px; }
        .section-title { font-size: 11px; font-weight: bold; background: #1a3e60; color: #fff; padding: 3px 10px; margin-bottom: 4px; border-radius: 2px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin: 4px 0; }
        .info-grid .col { border: 1px solid #ccc; padding: 5px 8px; border-radius: 2px; background: #fafafa; }
        .info-grid .col h4 { font-size: 9px; color: #1a3e60; border-bottom: 1px solid #ddd; padding-bottom: 2px; margin-bottom: 3px; }
        .info-grid .col p { font-size: 9.5px; margin: 2px 0; line-height: 1.4; }
        .info-grid .col .lbl { font-weight: bold; display: inline-block; width: 80px; font-size: 8.5px; }
        .conditions { background: #f4f8fc; padding: 6px 12px; border-left: 3px solid #1a3e60; margin: 6px 0; font-size: 9px; line-height: 1.6; }
        .signature-area { display: flex; justify-content: space-between; align-items: center; margin: 8px 0; border-top: 1px solid #ccc; padding-top: 8px; }
        .signature-area .sig { font-size: 11px; font-weight: 500; }
        .signature-area .sig span { display: inline-block; border-bottom: 1px solid #333; min-width: 130px; margin-left: 5px; padding: 0 5px; }
        .footer { text-align: center; font-size: 8px; color: #666; border-top: 1px solid #ccc; padding-top: 5px; margin-top: 10px; }
        @media print { body { background: white; } .no-print { display: none; } }
      </style></head><body>
      <div class="print-container">
        ${header}
        <div class="section"><div class="section-title">📘 Student Information</div>
          <div class="info-grid">
            <div class="col"><h4>Personal Details</h4>
              <p><span class="lbl">Name (English):</span> ${data.name || "-"}</p>
              <p><span class="lbl">Name (Bangla):</span> ${data.name_bn || "-"}</p>
              <p><span class="lbl">Date of Birth:</span> ${data.dob || "-"}</p>
              <p><span class="lbl">Gender:</span> ${data.gender || "-"}</p>
              <p><span class="lbl">Blood Group:</span> ${data.blood_group || "-"}</p>
            </div>
            <div class="col"><h4>Parent Information</h4>
              <p><span class="lbl">Father's Name:</span> ${data.father_name || "-"}</p>
              <p><span class="lbl">Mother's Name:</span> ${data.mother_name || "-"}</p>
              <p><span class="lbl">Guardian Contact:</span> ${data.contact || "-"}</p>
              <p><span class="lbl">Particular Disease:</span> ${data.particular_disease || "None"}</p>
            </div>
          </div>
        </div>
        <div class="section"><div class="section-title">🏠 Address Information</div>
          <div class="info-grid">
            <div class="col"><h4>Present Address</h4>
              <p><span class="lbl">District:</span> ${data.district || "-"}</p>
              <p><span class="lbl">Police Station:</span> ${data.police_station || "-"}</p>
              <p><span class="lbl">Post Office:</span> ${data.post_office || "-"}</p>
              <p><span class="lbl">Village:</span> ${data.village || "-"}</p>
            </div>
            <div class="col"><h4>Permanent Address</h4>
              <p><span class="lbl">District:</span> ${data.permanent_district || "-"}</p>
              <p><span class="lbl">Police Station:</span> ${data.permanent_police_station || "-"}</p>
              <p><span class="lbl">Post Office:</span> ${data.permanent_post_office || "-"}</p>
              <p><span class="lbl">Village:</span> ${data.permanent_village || "-"}</p>
            </div>
          </div>
        </div>
        <div class="section"><div class="section-title">🎓 Academic Information</div>
          <div class="info-grid">
            <div class="col"><h4>Class & Section</h4>
              <p><span class="lbl">Class:</span> ${className || "-"}</p>
              <p><span class="lbl">Section:</span> ${sectionName || "-"}</p>
              <p><span class="lbl">Academic Year:</span> ${academicYearName || "-"}</p>
            </div>
            <div class="col"><h4>Contact Information</h4>
              <p><span class="lbl">Father's Contact:</span> ${data.fathers_contact || "-"}</p>
              <p><span class="lbl">Mother's Contact:</span> ${data.mothers_contact || "-"}</p>
              <p><span class="lbl">Email:</span> ${data.email || "-"}</p>
              <p><span class="lbl">WhatsApp:</span> ${data.whatsapp || "-"}</p>
            </div>
          </div>
        </div>
        <div class="conditions">
          <p><strong>📋 শর্তাবলী / Conditions:</strong></p>
          <p>■ শিক্ষার্থীকে নিয়মিত নির্ধারিত স্কুল ইউনিফর্মে পাঠাব।</p>
          <p>■ বিদ্যালয়ের সকল নিয়ম-শৃঙ্খলা মেনে চলব।</p>
          <p>■ মাসিক বেতন ও অন্যান্য ফি যথাসময়ে পরিশোধ করব।</p>
          <p>■ স্কুলের বাইরে যেকোন দুর্ঘটনার জন্য স্কুল কর্তৃপক্ষ দায়ী থাকবে না।</p>
        </div>
        <div class="signature-area">
          <div class="sig">Guardian Signature: <span>${data.father_name || "___________"}</span></div>
          <div class="sig">Date: <span>${new Date().toLocaleDateString()}</span></div>
        </div>
        <div class="footer">
          Generated on ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })} • Powered by ${schoolSettings.school_name}
        </div>
      </div>
      <script>
        let printStarted = false;
        window.onload = function() { if (!printStarted) { printStarted = true; setTimeout(function() { window.print(); }, 500); } };
        window.onafterprint = function() { window.close(); };
      <\/script>
      </body></html>
    `;
  };

  const handlePrint = () => {
    setPrinting(true);
    const printHTML = generatePrintHTML();
    const printWindow = window.open("", "_blank", "width=800,height=1100,toolbar=yes,scrollbars=yes,menubar=yes");
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
        }
      }, 500);
      setTimeout(() => {
        clearInterval(checkPrintClosed);
        if (!printWindow.closed) printWindow.close();
        setPrinting(false);
        setShowSuccessDialog(false);
        resetForm();
      }, 60000);
    } else {
      setPrinting(false);
      alert("Please allow popups for this site");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-gradient-to-r from-[#0a4d8c] via-[#0d5ca8] to-[#0a4d8c] text-white shadow-lg">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-3 flex items-center justify-between gap-2">
          <Link href="/" className="flex items-center gap-1.5 text-xs sm:text-sm hover:text-emerald-300 transition">
            <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden xs:inline">হোমে ফিরে যান</span>
            <span className="xs:hidden">হোম</span>
          </Link>
          <Link href="/login" className="text-[10px] sm:text-xs bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold px-2.5 sm:px-3 py-1.5 rounded-md transition whitespace-nowrap">
            লগইন
          </Link>
        </div>
      </header>

      {/* ✅ Hero with Dynamic Logo from Supabase */}
      <div className="bg-gradient-to-br from-[#0a4d8c] to-[#0d5ca8] text-white py-6 sm:py-10 px-3 sm:px-4">
        <div className="max-w-5xl mx-auto text-center">
          {/* ✅ Dynamic Logo from school_settings */}
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white flex items-center justify-center mx-auto mb-3 sm:mb-4 shadow-lg overflow-hidden border-4 border-white/30">
            {schoolSettings.school_logo ? (
              <img
                src={schoolSettings.school_logo}
                alt="School Logo"
                className="w-full h-full object-cover"
              />
            ) : (
              <GraduationCap className="w-8 h-8 sm:w-10 sm:h-10 text-[#0a4d8c]" />
            )}
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-2">অনলাইন ভর্তি ফরম</h1>
          <p className="text-blue-100 text-xs sm:text-sm md:text-base">
            {schoolSettings.school_name || "শাপলা কিন্ডারগার্টেন এন্ড প্রি-ক্যাডেট"}-এ ভর্তির জন্য আবেদন করুন
          </p>
        </div>
      </div>

      {/* Form Content */}
      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-8 pb-24">
        {/* Error Banner */}
        {submitError && (
          <div className="mb-4 sm:mb-6 bg-red-50 dark:bg-red-950/30 border-l-4 border-red-500 rounded-lg p-3 sm:p-4 flex items-start gap-2 sm:gap-3">
            <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-red-900 dark:text-red-200 text-sm">সমস্যা হয়েছে</p>
              <p className="text-xs sm:text-sm text-red-700 dark:text-red-300 mt-0.5 break-words">{submitError}</p>
            </div>
            <button onClick={() => setSubmitError(null)} className="text-red-400 hover:text-red-600 transition shrink-0">
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        )}

        <form ref={formRef} onSubmit={handleSubmit(onSubmit, onInvalidSubmit)} className="space-y-5 sm:space-y-6" noValidate>

          {/* ═══════════════ SECTION 1: Basic Info ═══════════════ */}
          <Card className="border-border shadow-sm">
            <CardHeader className="bg-blue-50 dark:bg-blue-950/30 border-b p-4 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-[#0a4d8c] dark:text-blue-400 text-base sm:text-lg">
                <User className="h-4 w-4 sm:h-5 sm:w-5" /> শিক্ষার্থীর তথ্য
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">ছাত্র/ছাত্রীর ব্যক্তিগত তথ্য</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name" className={`text-xs sm:text-sm ${errors.name || fieldErrors.name ? "text-red-500" : ""}`}>
                  শিক্ষার্থীর নাম (English) *
                </Label>
                <Controller name="name" control={control} render={({ field }) => (
                  <Input id="name" {...field} value={field.value || ""} placeholder="Full name in English"
                    className={`w-full text-sm ${errors.name || fieldErrors.name ? "border-red-500" : ""}`} />
                )} />
                {(errors.name || fieldErrors.name) && <p className="text-xs text-red-500">{errors.name?.message || fieldErrors.name}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="name_bn" className="text-xs sm:text-sm">শিক্ষার্থীর নাম (বাংলা)</Label>
                <Controller name="name_bn" control={control} render={({ field }) => (
                  <Input id="name_bn" {...field} value={field.value || ""} placeholder="বাংলায় নাম" className="w-full text-sm" />
                )} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="father_name" className={`text-xs sm:text-sm ${errors.father_name || fieldErrors.father_name ? "text-red-500" : ""}`}>
                  পিতার নাম (English) *
                </Label>
                <Controller name="father_name" control={control} render={({ field }) => (
                  <Input id="father_name" {...field} value={field.value || ""} placeholder="Father's name"
                    className={`w-full text-sm ${errors.father_name || fieldErrors.father_name ? "border-red-500" : ""}`} />
                )} />
                {(errors.father_name || fieldErrors.father_name) && <p className="text-xs text-red-500">{errors.father_name?.message || fieldErrors.father_name}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="father_name_bn" className="text-xs sm:text-sm">পিতার নাম (বাংলা)</Label>
                <Controller name="father_name_bn" control={control} render={({ field }) => (
                  <Input id="father_name_bn" {...field} value={field.value || ""} placeholder="বাবার নাম বাংলায়" className="w-full text-sm" />
                )} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mother_name" className={`text-xs sm:text-sm ${errors.mother_name || fieldErrors.mother_name ? "text-red-500" : ""}`}>
                  মাতার নাম (English) *
                </Label>
                <Controller name="mother_name" control={control} render={({ field }) => (
                  <Input id="mother_name" {...field} value={field.value || ""} placeholder="Mother's name"
                    className={`w-full text-sm ${errors.mother_name || fieldErrors.mother_name ? "border-red-500" : ""}`} />
                )} />
                {(errors.mother_name || fieldErrors.mother_name) && <p className="text-xs text-red-500">{errors.mother_name?.message || fieldErrors.mother_name}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="mother_name_bn" className="text-xs sm:text-sm">মাতার নাম (বাংলা)</Label>
                <Controller name="mother_name_bn" control={control} render={({ field }) => (
                  <Input id="mother_name_bn" {...field} value={field.value || ""} placeholder="মায়ের নাম বাংলায়" className="w-full text-sm" />
                )} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dob" className={`text-xs sm:text-sm ${errors.dob || fieldErrors.dob ? "text-red-500" : ""}`}>
                  জন্ম তারিখ *
                </Label>
                <Controller name="dob" control={control} render={({ field }) => (
                  <Input id="dob" type="date" {...field} value={field.value || ""}
                    max={new Date().toISOString().split("T")[0]}
                    className={`w-full text-sm ${errors.dob || fieldErrors.dob ? "border-red-500" : ""}`} />
                )} />
                {(errors.dob || fieldErrors.dob) && <p className="text-xs text-red-500">{errors.dob?.message || fieldErrors.dob}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender" className={`text-xs sm:text-sm ${errors.gender ? "text-red-500" : ""}`}>লিঙ্গ *</Label>
                <Controller name="gender" control={control} render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value || "male"}>
                    <SelectTrigger id="gender" className={`w-full text-sm ${errors.gender ? "border-red-500" : ""}`}>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-gray-900">
                      <SelectItem value="male">পুরুষ (Male)</SelectItem>
                      <SelectItem value="female">মহিলা (Female)</SelectItem>
                      <SelectItem value="other">অন্যান্য (Other)</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
                {errors.gender && <p className="text-xs text-red-500">{errors.gender.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="blood_group" className="text-xs sm:text-sm">রক্তের গ্রুপ</Label>
                <Controller name="blood_group" control={control} render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <SelectTrigger id="blood_group" className="w-full text-sm">
                      <SelectValue placeholder="নির্বাচন করুন" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-gray-900">
                      {bloodGroups.map((bg) => <SelectItem key={bg} value={bg}>{bg}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="particular_disease" className="text-xs sm:text-sm">বিশেষ কোনো রোগ আছে কি?</Label>
                <Controller name="particular_disease" control={control} render={({ field }) => (
                  <Input id="particular_disease" {...field} value={field.value || ""} placeholder="থাকলে লিখুন, না থাকলে খালি রাখুন" className="w-full text-sm" />
                )} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="contact" className={`text-xs sm:text-sm ${errors.contact || fieldErrors.contact ? "text-red-500" : ""}`}>
                  মোবাইল নম্বর * (বাংলা বা ইংরেজি সংখ্যা)
                </Label>
                <Controller name="contact" control={control} render={({ field }) => (
                  <Input id="contact" type="tel" {...field} value={field.value || ""} placeholder="01XXXXXXXXX / ০১XXXXXXXXX"
                    className={`w-full text-sm ${errors.contact || fieldErrors.contact ? "border-red-500" : ""}`} />
                )} />
                {(errors.contact || fieldErrors.contact) && <p className="text-xs text-red-500">{errors.contact?.message || fieldErrors.contact}</p>}
              </div>
            </CardContent>
          </Card>

          {/* ═══════════════ SECTION 2: Academic ═══════════════ */}
          <Card className="border-border shadow-sm">
            <CardHeader className="bg-amber-50 dark:bg-amber-950/30 border-b p-4 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-base sm:text-lg">
                <GraduationCap className="h-4 w-4 sm:h-5 sm:w-5" /> একাডেমিক তথ্য
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">শ্রেণি ও শাখা নির্বাচন করুন</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="class_id" className={`text-xs sm:text-sm ${errors.class_id || fieldErrors.class_id ? "text-red-500" : ""}`}>শ্রেণি *</Label>
                <Controller name="class_id" control={control} render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value || ""} disabled={loadingClasses}>
                    <SelectTrigger id="class_id" className={`w-full text-sm ${errors.class_id || fieldErrors.class_id ? "border-red-500" : ""}`}>
                      <SelectValue placeholder={loadingClasses ? "লোড হচ্ছে..." : "শ্রেণি নির্বাচন করুন"} />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-gray-900">
                      {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )} />
                {(errors.class_id || fieldErrors.class_id) && <p className="text-xs text-red-500">{errors.class_id?.message || fieldErrors.class_id}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="section_id" className={`text-xs sm:text-sm ${errors.section_id || fieldErrors.section_id ? "text-red-500" : ""}`}>শাখা *</Label>
                <Controller name="section_id" control={control} render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value || ""} disabled={!selectedClassId || sections.length === 0}>
                    <SelectTrigger id="section_id" className={`w-full text-sm ${errors.section_id || fieldErrors.section_id ? "border-red-500" : ""}`}>
                      <SelectValue placeholder={!selectedClassId ? "আগে শ্রেণি নির্বাচন করুন" : sections.length === 0 ? "কোনো শাখা নেই" : "শাখা নির্বাচন করুন"} />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-gray-900">
                      {sections.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )} />
                {(errors.section_id || fieldErrors.section_id) && <p className="text-xs text-red-500">{errors.section_id?.message || fieldErrors.section_id}</p>}
              </div>
            </CardContent>
          </Card>

          {/* ═══════════════ SECTION 3: Present Address ═══════════════ */}
          <Card className="border-border shadow-sm">
            <CardHeader className="bg-emerald-50 dark:bg-emerald-950/30 border-b p-4 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-base sm:text-lg">
                <Home className="h-4 w-4 sm:h-5 sm:w-5" /> বর্তমান ঠিকানা
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">শিক্ষার্থীর বর্তমান ঠিকানা</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="district" className="text-xs sm:text-sm">জেলা</Label>
                <Controller name="district" control={control} render={({ field }) => (
                  <Input id="district" {...field} value={field.value || ""} placeholder="যেমন: কুমিল্লা" list="districts" className="w-full text-sm" />
                )} />
                <datalist id="districts">{districts.map((d) => <option key={d.id} value={d.name} />)}</datalist>
              </div>
              <div className="space-y-2">
                <Label htmlFor="police_station" className="text-xs sm:text-sm">থানা</Label>
                <Controller name="police_station" control={control} render={({ field }) => (
                  <Input id="police_station" {...field} value={field.value || ""} placeholder="যেমন: চান্দিনা" list="police" className="w-full text-sm" />
                )} />
                <datalist id="police">{policeStations.map((ps) => <option key={ps.id} value={ps.name} />)}</datalist>
              </div>
              <div className="space-y-2">
                <Label htmlFor="post_office" className="text-xs sm:text-sm">ডাকঘর</Label>
                <Controller name="post_office" control={control} render={({ field }) => (
                  <Input id="post_office" {...field} value={field.value || ""} placeholder="যেমন: মাধাইয়া" list="post" className="w-full text-sm" />
                )} />
                <datalist id="post">{postOffices.map((po) => <option key={po.id} value={po.name} />)}</datalist>
              </div>
              <div className="space-y-2">
                <Label htmlFor="village" className="text-xs sm:text-sm">গ্রাম</Label>
                <Controller name="village" control={control} render={({ field }) => (
                  <Input id="village" {...field} value={field.value || ""} placeholder="গ্রামের নাম" list="villages" className="w-full text-sm" />
                )} />
                <datalist id="villages">{villages.map((v) => <option key={v.id} value={v.name} />)}</datalist>
              </div>
            </CardContent>
          </Card>

          {/* ═══════════════ SECTION 4: Permanent Address ═══════════════ */}
          <Card className="border-border shadow-sm">
            <CardHeader className="bg-purple-50 dark:bg-purple-950/30 border-b p-4 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-400 text-base sm:text-lg">
                <MapPin className="h-4 w-4 sm:h-5 sm:w-5" /> স্থায়ী ঠিকানা
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">স্থায়ী ঠিকানা (বর্তমানের সমান হলে খালি রাখুন)</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="permanent_district" className="text-xs sm:text-sm">জেলা</Label>
                <Controller name="permanent_district" control={control} render={({ field }) => (
                  <Input id="permanent_district" {...field} value={field.value || ""} placeholder="যেমন: কুমিল্লা" list="districts" className="w-full text-sm" />
                )} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="permanent_police_station" className="text-xs sm:text-sm">থানা</Label>
                <Controller name="permanent_police_station" control={control} render={({ field }) => (
                  <Input id="permanent_police_station" {...field} value={field.value || ""} placeholder="থানার নাম" list="police" className="w-full text-sm" />
                )} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="permanent_post_office" className="text-xs sm:text-sm">ডাকঘর</Label>
                <Controller name="permanent_post_office" control={control} render={({ field }) => (
                  <Input id="permanent_post_office" {...field} value={field.value || ""} placeholder="ডাকঘরের নাম" list="post" className="w-full text-sm" />
                )} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="permanent_village" className="text-xs sm:text-sm">গ্রাম</Label>
                <Controller name="permanent_village" control={control} render={({ field }) => (
                  <Input id="permanent_village" {...field} value={field.value || ""} placeholder="গ্রামের নাম" list="villages" className="w-full text-sm" />
                )} />
              </div>
            </CardContent>
          </Card>

          {/* ═══════════════ SECTION 5: Contact ═══════════════ */}
          <Card className="border-border shadow-sm">
            <CardHeader className="bg-sky-50 dark:bg-sky-950/30 border-b p-4 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-sky-700 dark:text-sky-400 text-base sm:text-lg">
                <Contact className="h-4 w-4 sm:h-5 sm:w-5" /> যোগাযোগ তথ্য
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">অভিভাবকের সাথে যোগাযোগের নম্বর</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fathers_contact" className="text-xs sm:text-sm">পিতার মোবাইল</Label>
                <Controller name="fathers_contact" control={control} render={({ field }) => (
                  <Input id="fathers_contact" type="tel" {...field} value={field.value || ""} placeholder="01XXXXXXXXX / ০১XXXXXXXXX" className="w-full text-sm" />
                )} />
                {fieldErrors.fathers_contact && <p className="text-xs text-red-500">{fieldErrors.fathers_contact}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="mothers_contact" className="text-xs sm:text-sm">মাতার মোবাইল</Label>
                <Controller name="mothers_contact" control={control} render={({ field }) => (
                  <Input id="mothers_contact" type="tel" {...field} value={field.value || ""} placeholder="01XXXXXXXXX / ০১XXXXXXXXX" className="w-full text-sm" />
                )} />
                {fieldErrors.mothers_contact && <p className="text-xs text-red-500">{fieldErrors.mothers_contact}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs sm:text-sm">ইমেইল</Label>
                <Controller name="email" control={control} render={({ field }) => (
                  <Input id="email" type="email" {...field} value={field.value || ""} placeholder="parent@email.com"
                    className={`w-full text-sm ${errors.email || fieldErrors.email ? "border-red-500" : ""}`} />
                )} />
                {(errors.email || fieldErrors.email) && <p className="text-xs text-red-500">{errors.email?.message || fieldErrors.email}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="whatsapp" className="text-xs sm:text-sm">WhatsApp নম্বর</Label>
                <Controller name="whatsapp" control={control} render={({ field }) => (
                  <Input id="whatsapp" type="tel" {...field} value={field.value || ""} placeholder="01XXXXXXXXX / ০১XXXXXXXXX" className="w-full text-sm" />
                )} />
              </div>
            </CardContent>
          </Card>

          {/* ═══════════════ SECTION 6: Documents ═══════════════ */}
          <Card className="border-border shadow-sm">
            <CardHeader className="bg-violet-50 dark:bg-violet-950/30 border-b p-4 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-violet-700 dark:text-violet-400 text-base sm:text-lg">
                <FileText className="h-4 w-4 sm:h-5 sm:w-5" /> ডকুমেন্টস ও ছবি
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">জন্ম সনদ নম্বর ও শিক্ষার্থীর ছবি</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-6">
              <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="birth_cert_no" className="text-xs sm:text-sm">জন্ম সনদ নম্বর</Label>
                  <Controller name="birth_cert_no" control={control} render={({ field }) => (
                    <Input id="birth_cert_no" {...field} value={field.value || ""} placeholder="জন্ম সনদ নম্বর (বাংলা/ইংরেজি)"
                      className="w-full text-sm"
                      onChange={(e) => field.onChange(normalizeDigits(e.target.value))} />
                  )} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="father_nid_no" className="text-xs sm:text-sm">পিতার NID</Label>
                  <Controller name="father_nid_no" control={control} render={({ field }) => (
                    <Input id="father_nid_no" {...field} value={field.value || ""} placeholder="পিতার এনআইডি"
                      className="w-full text-sm"
                      onChange={(e) => field.onChange(normalizeDigits(e.target.value))} />
                  )} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mother_nid_no" className="text-xs sm:text-sm">মাতার NID</Label>
                  <Controller name="mother_nid_no" control={control} render={({ field }) => (
                    <Input id="mother_nid_no" {...field} value={field.value || ""} placeholder="মাতার এনআইডি"
                      className="w-full text-sm"
                      onChange={(e) => field.onChange(normalizeDigits(e.target.value))} />
                  )} />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs sm:text-sm">শিক্ষার্থীর ছবি (JPG, PNG সর্বোচ্চ 2MB)</Label>
                <div className={`border-2 border-dashed rounded-xl p-4 sm:p-8 text-center hover:bg-accent/50 transition-colors cursor-pointer group ${photoError ? "border-red-500 bg-red-50" : "border-border"}`}>
                  <input type="file" id="student_photo" ref={fileInputRef} className="hidden"
                    accept="image/jpeg,image/png,image/jpg" onChange={handlePhotoChange} />
                  <label htmlFor="student_photo" className="cursor-pointer block">
                    <Upload className="h-8 w-8 sm:h-10 sm:w-10 mx-auto mb-3 text-muted-foreground group-hover:text-primary transition-colors" />
                    <p className="text-sm font-medium">ছবি আপলোড করতে ক্লিক করুন</p>
                    <p className="text-xs text-muted-foreground mt-1">JPG, PNG (সর্বোচ্চ 2MB)</p>
                  </label>
                </div>
                {photoPreview && (
                  <div className="mt-3 p-3 border rounded-lg bg-gray-50 flex items-center gap-3 sm:gap-4">
                    <div className="relative shrink-0">
                      <img src={photoPreview} alt="Preview" className="h-14 w-14 sm:h-16 sm:w-16 object-cover rounded-full border-2 border-indigo-200" />
                      <button type="button" onClick={removePhoto} className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-700 truncate">{photoFile?.name}</p>
                      <p className="text-xs text-gray-500">{photoFile ? (photoFile.size / 1024).toFixed(1) : 0} KB</p>
                    </div>
                  </div>
                )}
                {photoError && (
                  <div className="mt-2 p-3 border border-red-200 bg-red-50 rounded-lg flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-red-700">ছবি আপলোড সমস্যা</p>
                      <p className="text-xs text-red-600">{photoError}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Submit Button - Sticky on Mobile */}
          <div className="sticky bottom-0 -mx-3 sm:-mx-4 px-3 sm:px-4 py-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-t border-slate-200 dark:border-slate-800 shadow-lg z-30 sm:static sm:mx-0 sm:px-0 sm:py-0 sm:bg-transparent sm:backdrop-blur-none sm:border-0 sm:shadow-none sm:pt-4 sm:border-t">
            <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
              <Link href="/" className="w-full sm:w-auto">
                <Button type="button" variant="outline" disabled={isSubmitting} className="w-full sm:w-auto text-sm">
                  বাতিল করুন
                </Button>
              </Link>
              <Button type="submit" disabled={loading || isSubmitting || loadingClasses}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold px-6 sm:px-8 min-w-[180px] w-full sm:w-auto text-sm">
                {isSubmitting ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> জমা হচ্ছে...</>) : (<><Send className="h-4 w-4 mr-2" /> আবেদন জমা দিন</>)}
              </Button>
            </div>
          </div>
        </form>
      </div>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={(open) => setShowSuccessDialog(open)}>
        <DialogOverlay className="fixed inset-0 bg-black/80" />
        <DialogContent className="sm:max-w-lg md:max-w-xl lg:max-w-2xl bg-white dark:bg-gray-900 opacity-100 shadow-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6 max-h-[90vh] overflow-y-auto mx-3 sm:mx-auto">
          <DialogHeader>
            <div className="flex items-center justify-center mb-4">
              <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-10 w-10 sm:h-12 sm:w-12 text-green-600" />
              </div>
            </div>
            <DialogTitle className="text-center text-2xl sm:text-3xl font-bold text-green-600">অভিনন্দন! 🎉</DialogTitle>
            <DialogDescription className="text-center text-sm sm:text-base mt-2">
              শিক্ষার্থী <span className="font-semibold text-gray-900 dark:text-white">{admittedStudentName}</span> এর ভর্তি আবেদন সফলভাবে জমা হয়েছে।
              <span className="block mt-2 text-sm sm:text-base text-gray-500">
                রেফারেন্স নম্বর: <span className="font-mono font-semibold text-indigo-600 text-base sm:text-xl break-all">{admittedReferenceNo}</span>
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row flex-wrap justify-center gap-2 sm:gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button onClick={handlePrint} disabled={printing} variant="outline" className="w-full sm:w-auto sm:min-w-[120px] border-gray-300 dark:border-gray-600 text-sm">
              {printing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Printer className="h-4 w-4 mr-2" />} প্রিন্ট করুন
            </Button>
            <Button onClick={() => { setShowSuccessDialog(false); resetForm(); }} className="w-full sm:w-auto sm:min-w-[120px] bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-sm">
              <User className="h-4 w-4 mr-2" /> নতুন আবেদন
            </Button>
            <Button onClick={() => router.push("/")} variant="ghost" className="w-full sm:w-auto sm:min-w-[120px] text-sm">হোমে যান</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}