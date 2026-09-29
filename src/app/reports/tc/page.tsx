"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { 
  Printer, 
  ArrowLeft, 
  Loader2, 
  Search, 
  X, 
  Filter,
  ChevronDown,
  User,
  CheckCircle,
  AlertCircle,
  FileText,
  FileSignature,
  QrCode,
  RotateCcw,
  Users,
  Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ResponsiveLayout } from "@/components/layout/responsive-layout";

// ==============================
// SUPABASE CLIENT
// ==============================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ==============================
// TYPES & INTERFACES
// ==============================

export interface Student {
  id: string;
  student_id: string;
  admission_no: string;
  name: string;
  name_bn: string;
  father_name: string;
  mother_name: string;
  father_name_bn: string;
  mother_name_bn: string;
  dob: string;
  gender: string;
  blood_group: string;
  contact: string;
  fathers_contact: string;
  mothers_contact: string;
  email: string;
  village: string;
  post_office: string;
  police_station: string;
  district: string;
  permanent_village: string;
  permanent_post_office: string;
  permanent_police_station: string;
  permanent_district: string;
  class_id: string;
  section_id: string;
  class_roll: string;
  academic_year_id: string;
  admission_date: string;
  student_photo_url: string;
  status: string;
  birth_cert_no: string;
  nationality: string;
  religion: string;
  class_name?: string;
  section_name?: string;
  academic_year_name?: string;
}

export interface SchoolSettings {
  id: number;
  school_name: string;
  school_address: string;
  school_phone: string;
  school_email: string;
  school_logo: string;
  school_watermark: string;
  principal_name?: string;
  principal_designation?: string;
}

export interface Class {
  id: string;
  name: string;
  numeric_order: number;
}

export interface Section {
  id: string;
  name: string;
  class_id: string;
}

export interface TCData {
  id: string;
  tc_number: string;
  issue_date: string;
  reason_for_leaving: string;
  conduct: string;
  remarks: string;
  student: Student;
  school: SchoolSettings;
}

export interface FilterOptions {
  classId: string;
  sectionId: string;
  searchTerm: string;
  status: string;
}

// ==============================
// MAIN COMPONENT
// ==============================

export default function TransferCertificatePage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [tcData, setTcData] = useState<TCData | null>(null);
  
  const [filters, setFilters] = useState<FilterOptions>({
    classId: "all",
    sectionId: "all",
    searchTerm: "",
    status: "all",
  });
  
  const [tcDate, setTcDate] = useState(new Date().toISOString().split('T')[0]);
  const [leavingReason, setLeavingReason] = useState("Transfer");
  const [conduct, setConduct] = useState("Good");
  const [remarks, setRemarks] = useState("");
  const [tcNumber, setTcNumber] = useState("");
  
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  
  const printRef = useRef<HTMLDivElement>(null);

  // ==============================
  // DATA LOADING
  // ==============================

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [students, filters]);

  async function loadAllData() {
    try {
      setLoading(true);
      setError(null);

      await Promise.all([
        loadStudents(),
        loadClasses(),
        loadSections(),
        loadSchoolSettings(),
      ]);

      await generateTCNumber();

    } catch (err: any) {
      console.error("Error loading data:", err);
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  async function loadStudents() {
    try {
      const { data, error } = await supabase
        .from("students")
        .select(`
          *,
          class:class_id(name),
          section:section_id(name),
          academic_year:academic_year_id(name)
        `)
        .order("name", { ascending: true });

      if (error) throw error;
      
      const studentsWithNames = (data || []).map((s: any) => ({
        ...s,
        class_name: s.class?.name,
        section_name: s.section?.name,
        academic_year_name: s.academic_year?.name,
        student_id: s.student_id || '',
        admission_no: s.student_id || '',
        name: s.name || '',
        father_name: s.father_name || '',
        mother_name: s.mother_name || '',
        contact: s.contact || '',
        fathers_contact: s.fathers_contact || '',
        mothers_contact: s.mothers_contact || '',
        class_roll: s.class_roll || '',
        village: s.village || '',
        post_office: s.post_office || '',
        police_station: s.police_station || '',
        district: s.district || '',
        nationality: s.nationality || 'Bangladeshi',
        religion: s.religion || 'Islam/Hindo',
        status: s.status || 'active',
        dob: s.dob || '',
        admission_date: s.admission_date || '',
        class_id: s.class_id || '',
        section_id: s.section_id || '',
      }));
      
      setStudents(studentsWithNames);
      setFilteredStudents(studentsWithNames);
    } catch (err) {
      console.error("Error loading students:", err);
      setStudents([]);
      setFilteredStudents([]);
    }
  }

  async function loadClasses() {
    try {
      const { data, error } = await supabase
        .from("classes")
        .select("*")
        .order("numeric_order", { ascending: true });

      if (error) throw error;
      setClasses(data || []);
    } catch (err) {
      console.error("Error loading classes:", err);
      setClasses([]);
    }
  }

  async function loadSections() {
    try {
      const { data, error } = await supabase
        .from("sections")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      setSections(data || []);
    } catch (err) {
      console.error("Error loading sections:", err);
      setSections([]);
    }
  }

  async function loadSchoolSettings() {
    try {
      const { data, error } = await supabase
        .from("school_settings")
        .select("*")
        .single();

      if (error) throw error;
      setSchoolSettings(data);
    } catch (err) {
      console.error("Error loading school settings:", err);
      setSchoolSettings({
        id: 1,
        school_name: "Shapla Kindergarten & Pre-cadet",
        school_address: "Nowtala, Madhaiya Bazar, Chandina, Cumilla",
        school_phone: "01923253454",
        school_email: "shapla.kindergarten@gmail.com",
        school_logo: "",
        school_watermark: "",
        principal_name: "",
        principal_designation: "Principal",
      });
    }
  }

  // ==============================
  // 🆕 GENERATE TC NUMBER - Using fee_payments instead of fee_transactions
  // ==============================

  async function generateTCNumber() {
    try {
      const year = new Date().getFullYear();
      
      // 🔄 Changed: Use fee_payments instead of fee_transactions
      const { count, error } = await supabase
        .from("fee_payments")
        .select("id", { count: "exact", head: true })
        .gte("created_at", `${year}-01-01`)
        .lt("created_at", `${year + 1}-01-01`);

      if (error) {
        console.warn("Error counting fee_payments for TC number:", error);
        // 🔄 Fallback: Use student_fee_dues if fee_payments fails
        const { count: dueCount, error: dueError } = await supabase
          .from("student_fee_dues")
          .select("id", { count: "exact", head: true })
          .gte("created_at", `${year}-01-01`)
          .lt("created_at", `${year + 1}-01-01`);

        if (dueError) {
          console.warn("Error counting student_fee_dues for TC number:", dueError);
          setTcNumber(`TC-${year}-0001`);
          return;
        }
        
        const serial = (dueCount || 0) + 1;
        setTcNumber(`TC-${year}-${serial.toString().padStart(4, "0")}`);
        return;
      }

      const serial = (count || 0) + 1;
      setTcNumber(`TC-${year}-${serial.toString().padStart(4, "0")}`);
      
    } catch (err) {
      console.error("Error generating TC number:", err);
      setTcNumber(`TC-${new Date().getFullYear()}-0001`);
    }
  }

  // ==============================
  // FILTER FUNCTIONS
  // ==============================

  function applyFilters() {
    let filtered = [...students];

    if (filters.classId && filters.classId !== "all") {
      filtered = filtered.filter(s => s.class_id === filters.classId);
    }

    if (filters.sectionId && filters.sectionId !== "all") {
      filtered = filtered.filter(s => s.section_id === filters.sectionId);
    }

    if (filters.status && filters.status !== "all") {
      filtered = filtered.filter(s => s.status === filters.status);
    }

    if (filters.searchTerm.trim().length >= 2) {
      const term = filters.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(s => {
        const searchableFields = [
          s?.name || '',
          s?.student_id || '',
          s?.admission_no || '',
          s?.class_roll || '',
          s?.father_name || '',
          s?.mother_name || '',
          s?.contact || '',
          s?.fathers_contact || '',
          s?.mothers_contact || '',
        ];
        return searchableFields.some(field => 
          field.toLowerCase().includes(term)
        );
      });
    }

    setFilteredStudents(filtered);
  }

  function resetFilters() {
    setFilters({
      classId: "all",
      sectionId: "all",
      searchTerm: "",
      status: "all",
    });
    setFilteredStudents(students);
  }

  // ==============================
  // TC GENERATION
  // ==============================

  async function handleGenerateTC() {
    if (!selectedStudent) {
      setError("Please select a student first");
      return;
    }

    try {
      setGenerating(true);
      setError(null);

      const tcData: TCData = {
        id: `tc-${Date.now()}`,
        tc_number: tcNumber,
        issue_date: tcDate,
        reason_for_leaving: leavingReason,
        conduct: conduct,
        remarks: remarks || "All dues cleared",
        student: selectedStudent,
        school: schoolSettings!,
      };

      setTcData(tcData);
      setIsPreviewMode(true);

    } catch (err: any) {
      console.error("Error generating TC:", err);
      setError(err.message || "Failed to generate TC");
    } finally {
      setGenerating(false);
    }
  }

  // ==============================
  // HELPER FUNCTIONS
  // ==============================

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (printWindow) {
      const certContent = document.getElementById('tc-certificate')?.innerHTML;
      if (certContent) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Transfer Certificate</title>
              <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { 
                  font-family: 'Times New Roman', Georgia, serif;
                  background: white;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  min-height: 100vh;
                  padding: 20px;
                }
                #tc-certificate {
                  width: 210mm;
                  min-height: 297mm;
                  background: white;
                  padding: 8mm;
                  margin: 0 auto;
                }
                .certificate-wrapper {
                  display: flex;
                  flex-direction: column;
                  min-height: 277mm;
                }
                .certificate-container {
                  flex: 1;
                  display: flex;
                  flex-direction: column;
                  padding: 5mm 7mm;
                  position: relative;
                  border: 4px double #065f46;
                  min-height: 275mm;
                  background: white;
                }
                .watermark {
                  position: absolute;
                  inset: 0;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  pointer-events: none;
                  opacity: 0.05;
                  z-index: 0;
                }
                .watermark img { width: 70%; height: 70%; object-fit: contain; }
                .header {
                  text-align: center;
                  border-bottom: 2px solid #065f46;
                  padding-bottom: 3mm;
                  margin-bottom: 2.5mm;
                  position: relative;
                  z-index: 1;
                }
                .logo { display: block; margin: 0 auto 1.5mm; height: 16mm; width: auto; }
                .school-name { font-size: 22px; font-weight: 800; color: #065f46; text-transform: uppercase; letter-spacing: 0.05em; }
                .school-address { font-size: 11px; color: #4b5563; margin-top: 0.5mm; }
                .school-contact { font-size: 10px; color: #6b7280; margin-top: 0.5mm; }
                .title { text-align: center; margin-bottom: 3.5mm; position: relative; z-index: 1; }
                .title span {
                  display: inline-block;
                  padding: 1mm 6mm;
                  background: #065f46;
                  color: white;
                  font-size: 16px;
                  font-weight: 700;
                  letter-spacing: 0.1em;
                  text-transform: uppercase;
                  border-radius: 4px;
                }
                .meta {
                  display: flex;
                  justify-content: space-between;
                  font-size: 11px;
                  font-weight: 600;
                  color: #374151;
                  margin-bottom: 3mm;
                  padding: 0 1mm;
                  position: relative;
                  z-index: 1;
                }
                .meta > div { display: flex; align-items: center; gap: 1.5mm; }
                .meta-value { font-family: monospace; border-bottom: 1px dashed #9ca3af; padding: 0 1.5mm; color: black; }
                .body {
                  flex: 1;
                  position: relative;
                  z-index: 1;
                  display: flex;
                  flex-direction: column;
                }
                .body-text {
                  font-size: 12px;
                  line-height: 2;
                  color: #1f2937;
                  text-align: justify;
                  margin-bottom: 2.5mm;
                }
                .body-text.italic { font-style: italic; }
                .body-text.text-center { text-align: center; }
                .highlight {
                  font-weight: 600;
                  color: black;
                  border-bottom: 1px dashed #9ca3af;
                  padding: 0 0.5mm;
                }
                .details-grid {
                  display: grid;
                  grid-template-columns: 1fr 1fr;
                  gap: 0.5mm 3mm;
                  padding: 1.5mm 0;
                  margin: 1mm 0 1.5mm 0;
                  border-top: 1px dashed #d1d5db;
                  border-bottom: 1px dashed #d1d5db;
                }
                .detail {
                  display: flex;
                  justify-content: space-between;
                  padding: 0.3mm 0;
                  border-bottom: 1px solid #f3f4f6;
                }
                .detail.full { grid-column: 1 / -1; }
                .label { font-size: 10px; font-weight: 500; color: #4b5563; }
                .value { font-size: 10px; font-weight: 600; color: black; }
                .signatures {
                  display: flex;
                  justify-content: space-between;
                  padding-top: 2.5mm;
                  border-top: 1px solid #d1d5db;
                  margin-top: 2.5mm;
                  position: relative;
                  z-index: 1;
                }
                .signature { text-align: center; flex: 1; min-width: 70px; }
                .line {
                  width: 100%;
                  max-width: 110px;
                  height: 10mm;
                  border-bottom: 2px solid #9ca3af;
                  margin: 0 auto 0.3mm;
                }
                .signature span {
                  font-size: 8px;
                  font-weight: 600;
                  color: #4b5563;
                  text-transform: uppercase;
                  letter-spacing: 0.05em;
                }
                .footer {
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  padding-top: 1.5mm;
                  border-top: 1px solid #e5e7eb;
                  margin-top: auto;
                  font-size: 8px;
                  color: #9ca3af;
                  position: relative;
                  z-index: 1;
                }
                .footer-right { display: flex; align-items: center; gap: 2mm; }
                .qr { display: flex; align-items: center; gap: 0.5mm; }
                @page {
                  size: A4 portrait;
                  margin: 0;
                }
                * {
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
                  color-adjust: exact;
                }
              </style>
            </head>
            <body>
              ${certContent}
              <script>
                window.onload = function() {
                  window.print();
                  setTimeout(function() {
                    window.close();
                  }, 1000);
                };
              <\/script>
            </body>
          </html>
        `);
        printWindow.document.close();
      }
    } else {
      window.print();
    }
  };

  const handleReset = () => {
    setSelectedStudent(null);
    setTcData(null);
    setIsPreviewMode(false);
    resetFilters();
    setError(null);
    generateTCNumber();
  };

  const handleStudentSelect = (student: Student) => {
    setSelectedStudent(student);
    setError(null);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "N/A";
      return date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return "N/A";
    }
  };

  const getCurrentDate = () => {
    const date = new Date();
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  // ==============================
  // RENDER
  // ==============================

  if (loading) {
    return (
      <ResponsiveLayout>
        <div className="flex h-[calc(100vh-200px)] items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-emerald-600 mx-auto" />
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Loading Transfer Certificate...</p>
          </div>
        </div>
      </ResponsiveLayout>
    );
  }

  return (
    <ResponsiveLayout>
      <div className="space-y-6 print:hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <a href="/reports">
                <ArrowLeft className="h-5 w-5" />
              </a>
            </Button>
            <div>
              <h1 className="text-2xl font-bold font-heading dark:text-white">Transfer Certificate</h1>
              <p className="text-text-muted dark:text-gray-400">Generate and manage student transfer certificates</p>
            </div>
          </div>
          {tcData && isPreviewMode && (
            <div className="flex gap-3">
              <Button onClick={handlePrint} className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-800">
                <Printer className="h-4 w-4 mr-2" />
                Print Certificate
              </Button>
              <Button variant="outline" onClick={handleReset} className="dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800">
                <RotateCcw className="h-4 w-4 mr-2" />
                New TC
              </Button>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg flex items-start gap-2">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* ============================================================
            TWO-COLUMN LAYOUT - RESPONSIVE
            ============================================================ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* ===== LEFT COLUMN ===== */}
          <div className="space-y-6">
            <Card className="dark:bg-gray-800 dark:border-gray-700">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 dark:text-white">
                  <Filter className="h-5 w-5 dark:text-gray-400" />
                  Search & Filter Students
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className="dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  {showFilters ? "Hide Filters" : "Show Filters"}
                  <ChevronDown className={`ml-2 h-4 w-4 transition-transform ${showFilters ? "rotate-180" : ""}`} />
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Search Input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
                  <Input
                    type="text"
                    placeholder="Search by Name, ID, Admission, Roll, Father, Mother, Contact..."
                    value={filters.searchTerm}
                    onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
                    className="pl-9 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder:text-gray-400"
                  />
                  {filters.searchTerm && (
                    <button
                      onClick={() => setFilters({ ...filters, searchTerm: "" })}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                    >
                      <X className="h-4 w-4 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300" />
                    </button>
                  )}
                </div>

                {/* Filters */}
                {showFilters && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t dark:border-gray-700">
                    <div className="space-y-2">
                      <Label className="dark:text-gray-300">Class</Label>
                      <Select
                        value={filters.classId}
                        onValueChange={(value) => {
                          setFilters({ ...filters, classId: value, sectionId: "all" });
                        }}
                      >
                        <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                          <SelectValue placeholder="All Classes" />
                        </SelectTrigger>
                        <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                          <SelectItem value="all" className="dark:text-white dark:hover:bg-gray-700">All Classes</SelectItem>
                          {classes.map((cls) => (
                            <SelectItem key={cls.id} value={cls.id} className="dark:text-white dark:hover:bg-gray-700">
                              {cls.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="dark:text-gray-300">Section</Label>
                      <Select
                        value={filters.sectionId}
                        onValueChange={(value) => setFilters({ ...filters, sectionId: value })}
                      >
                        <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                          <SelectValue placeholder="All Sections" />
                        </SelectTrigger>
                        <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                          <SelectItem value="all" className="dark:text-white dark:hover:bg-gray-700">All Sections</SelectItem>
                          {sections
                            .filter(sec => !filters.classId || filters.classId === "all" || sec.class_id === filters.classId)
                            .map((sec) => (
                              <SelectItem key={sec.id} value={sec.id} className="dark:text-white dark:hover:bg-gray-700">
                                {sec.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="dark:text-gray-300">Status</Label>
                      <Select
                        value={filters.status}
                        onValueChange={(value) => setFilters({ ...filters, status: value })}
                      >
                        <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                          <SelectValue placeholder="All Status" />
                        </SelectTrigger>
                        <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                          <SelectItem value="all" className="dark:text-white dark:hover:bg-gray-700">All Status</SelectItem>
                          <SelectItem value="active" className="dark:text-white dark:hover:bg-gray-700">Active</SelectItem>
                          <SelectItem value="inactive" className="dark:text-white dark:hover:bg-gray-700">Inactive</SelectItem>
                          <SelectItem value="graduated" className="dark:text-white dark:hover:bg-gray-700">Graduated</SelectItem>
                          <SelectItem value="transferred" className="dark:text-white dark:hover:bg-gray-700">Transferred</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-end gap-2">
                      <Button variant="outline" onClick={resetFilters} className="flex-1 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Reset
                      </Button>
                      <Button onClick={() => setShowFilters(false)} className="flex-1 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-800">
                        Apply
                      </Button>
                    </div>
                  </div>
                )}

                {/* Found Students Count */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Found {filteredStudents.length} students</span>
                  {selectedStudent && (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                      Selected: {selectedStudent.name}
                    </span>
                  )}
                </div>

                {/* Student List */}
                {filteredStudents.length > 0 ? (
                  <div className="border rounded-lg max-h-[400px] overflow-y-auto dark:border-gray-700 dark:bg-gray-800">
                    {filteredStudents.map((student) => (
                      <div
                        key={student.id}
                        onClick={() => handleStudentSelect(student)}
                        className={`px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b last:border-b-0 dark:border-gray-700 flex items-start gap-3 transition-colors ${
                          selectedStudent?.id === student.id ? "bg-emerald-50 dark:bg-emerald-900/30 border-l-4 border-emerald-500" : ""
                        }`}
                      >
                        <div className="flex-shrink-0">
                          {student.student_photo_url ? (
                            <img src={student.student_photo_url} alt={student.name} className="w-10 h-10 rounded-full object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                              <User className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-gray-900 dark:text-white text-sm">{student.name || "N/A"}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              student.status === 'active' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                              student.status === 'inactive' ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300' :
                              'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                            }`}>
                              {student.status || 'N/A'}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            <span>ID: {student.student_id || 'N/A'}</span>
                            <span>Roll: {student.class_roll || 'N/A'}</span>
                            <span>Class: {student.class_name || 'N/A'}</span>
                            <span>Section: {student.section_name || 'N/A'}</span>
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                            <span>Father: {student.father_name || 'N/A'}</span>
                            <span>Contact: {student.contact || 'N/A'}</span>
                          </div>
                        </div>
                        {selectedStudent?.id === student.id && (
                          <CheckCircle className="h-5 w-5 text-emerald-500 dark:text-emerald-400 flex-shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <Users className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                    <p>No students found</p>
                    <p className="text-sm">Try adjusting your filters</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* TC Details Card */}
            {selectedStudent && !isPreviewMode && (
              <Card className="dark:bg-gray-800 dark:border-gray-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base dark:text-white">
                    <FileSignature className="h-5 w-5 dark:text-gray-400" />
                    Certificate Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs dark:text-gray-300">TC Number</Label>
                      <Input value={tcNumber} disabled className="bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white font-mono h-9 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs dark:text-gray-300">Issue Date</Label>
                      <Input type="date" value={tcDate} onChange={(e) => setTcDate(e.target.value)} className="dark:bg-gray-700 dark:border-gray-600 dark:text-white h-9" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs dark:text-gray-300">Reason for Leaving</Label>
                      <Select value={leavingReason} onValueChange={setLeavingReason}>
                        <SelectTrigger className="h-9 dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                          <SelectItem value="Transfer" className="dark:text-white dark:hover:bg-gray-700">Transfer</SelectItem>
                          <SelectItem value="Migration" className="dark:text-white dark:hover:bg-gray-700">Migration</SelectItem>
                          <SelectItem value="Withdrawal" className="dark:text-white dark:hover:bg-gray-700">Withdrawal</SelectItem>
                          <SelectItem value="Passed Out" className="dark:text-white dark:hover:bg-gray-700">Passed Out</SelectItem>
                          <SelectItem value="Completed" className="dark:text-white dark:hover:bg-gray-700">Completed</SelectItem>
                          <SelectItem value="Other" className="dark:text-white dark:hover:bg-gray-700">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs dark:text-gray-300">Conduct</Label>
                      <Select value={conduct} onValueChange={setConduct}>
                        <SelectTrigger className="h-9 dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                          <SelectItem value="Excellent" className="dark:text-white dark:hover:bg-gray-700">Excellent</SelectItem>
                          <SelectItem value="Very Good" className="dark:text-white dark:hover:bg-gray-700">Very Good</SelectItem>
                          <SelectItem value="Good" className="dark:text-white dark:hover:bg-gray-700">Good</SelectItem>
                          <SelectItem value="Satisfactory" className="dark:text-white dark:hover:bg-gray-700">Satisfactory</SelectItem>
                          <SelectItem value="Needs Improvement" className="dark:text-white dark:hover:bg-gray-700">Needs Improvement</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <Label className="text-xs dark:text-gray-300">Remarks</Label>
                      <Input placeholder="Additional remarks (optional)" value={remarks} onChange={(e) => setRemarks(e.target.value)} className="dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder:text-gray-400 h-9" />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2 border-t dark:border-gray-700">
                    <Button onClick={handleGenerateTC} disabled={generating} className="flex-1 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-800 h-9 text-sm">
                      {generating ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...</>
                      ) : (
                        <><FileText className="h-4 w-4 mr-2" /> Generate Certificate</>
                      )}
                    </Button>
                    <Button variant="outline" onClick={() => setSelectedStudent(null)} disabled={generating} className="h-9 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* ===== RIGHT COLUMN - Preview ===== */}
          <div className="lg:sticky lg:top-6 self-start">
            {tcData && isPreviewMode ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="p-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="font-medium text-sm dark:text-white">Certificate Preview</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">- {tcData.student.name}</span>
                  </div>
                </div>
                <div className="p-4 max-h-[600px] overflow-y-auto dark:bg-gray-800">
                  <div id="tc-certificate">
                    <div className="certificate-wrapper">
                      <div className="certificate-container">
                        
                        {/* Watermark */}
                        {schoolSettings?.school_watermark && (
                          <div className="watermark">
                            <img src={schoolSettings.school_watermark} alt="Watermark" />
                          </div>
                        )}

                        {/* Header */}
                        <div className="header">
                          {schoolSettings?.school_logo && (
                            <img src={schoolSettings.school_logo} alt={schoolSettings.school_name} className="logo" />
                          )}
                          <h1 className="school-name">{schoolSettings?.school_name || "School Name"}</h1>
                          <p className="school-address">{schoolSettings?.school_address || "School Address"}</p>
                          <div className="school-contact">
                            <span>📞 {schoolSettings?.school_phone || "N/A"}</span>
                            <span className="mx-2">|</span>
                            <span>✉ {schoolSettings?.school_email || "N/A"}</span>
                          </div>
                        </div>

                        {/* Title */}
                        <div className="title">
                          <span>Transfer Certificate</span>
                        </div>

                        {/* Meta */}
                        <div className="meta">
                          <div><span>T.C. No:</span> <span className="meta-value">{tcData.tc_number}</span></div>
                          <div><span>Date of Issue:</span> <span className="meta-value">{formatDate(tcData.issue_date)}</span></div>
                        </div>

                        {/* Body */}
                        <div className="body">
                          <p className="body-text">
                            This is to certify that Master/Miss{" "}
                            <span className="highlight">{tcData.student.name || "N/A"}</span>
                            , son/daughter of Mr.{" "}
                            <span className="highlight">{tcData.student.father_name || "N/A"}</span>{" "}
                            and Mrs.{" "}
                            <span className="highlight">{tcData.student.mother_name || "N/A"}</span>
                            , resident of{" "}
                            <span className="highlight">
                              {tcData.student.village || "N/A"}, {tcData.student.post_office || ""}, {tcData.student.police_station || ""}
                            </span>
                            , was a regular student of this institution studying in{" "}
                            <span className="highlight">
                              Class {tcData.student.class_name || "N/A"}
                            </span>
                            {tcData.student.section_name && `, Section ${tcData.student.section_name}`}.
                          </p>

                          <p className="body-text">
                            According to the Admission Register, his/her Date of Birth is{" "}
                            <span className="highlight">{formatDate(tcData.student.dob)}</span>
                            . He/She was admitted on{" "}
                            <span className="highlight">{formatDate(tcData.student.admission_date)}</span>{" "}
                            with Admission No.{" "}
                            <span className="highlight">{tcData.student.student_id || "N/A"}</span>.
                          </p>

                          <p className="body-text">
                            He/She has cleared all institutional dues and is hereby granted this Transfer Certificate upon leaving the institution. To the best of my knowledge, the student bears{" "}
                            <span className="highlight">{tcData.conduct}</span> moral character.
                          </p>

                          <p className="body-text italic">We wish him/her every success in life.</p>

                          {/* Details Grid */}
                          <div className="details-grid">
                            <div className="detail"><span className="label">Reason for Leaving:</span> <span className="value">{tcData.reason_for_leaving}</span></div>
                            <div className="detail"><span className="label">Conduct:</span> <span className="value">{tcData.conduct}</span></div>
                            <div className="detail"><span className="label">Nationality:</span> <span className="value">{tcData.student.nationality || "Bangladeshi"}</span></div>
                            <div className="detail"><span className="label">Religion:</span> <span className="value">{tcData.student.religion || "Islam/Hindo"}</span></div>
                            <div className="detail full"><span className="label">Remarks:</span> <span className="value">{tcData.remarks}</span></div>
                          </div>

                          <p className="body-text text-center italic text-gray-500">
                            Certified that all academic records and dues have been successfully settled and cleared.
                          </p>
                        </div>

                        {/* Signatures */}
                        <div className="signatures">
                          <div className="signature"><div className="line"></div><span>Class Teacher</span></div>
                          <div className="signature"><div className="line"></div><span>Prepared By</span></div>
                          <div className="signature"><div className="line"></div><span>{schoolSettings?.principal_designation || "Principal"}</span></div>
                        </div>

                        {/* Footer */}
                        <div className="footer">
                          <div>
                            <p>Generated by {schoolSettings?.school_name || "Kindergarten ERP"}</p>
                            <p>Printed on {getCurrentDate()}</p>
                          </div>
                          <div className="footer-right">
                            <span>TC: {tcData.tc_number}</span>
                            <div className="qr"><QrCode className="h-4 w-4" /><span>Verify</span></div>
                          </div>
                        </div>

                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <Card className="h-[600px] flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-800 border-dashed border-2 dark:border-gray-700">
                <div className="text-center p-8">
                  <FileSignature className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-600 dark:text-gray-400">No Certificate Generated</h3>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-2 max-w-xs mx-auto">
                    Select a student from the left panel, fill in the details, and click "Generate Certificate" to preview here.
                  </p>
                  {selectedStudent && (
                    <Button onClick={handleGenerateTC} className="mt-4 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-800">
                      <FileText className="h-4 w-4 mr-2" />
                      Generate Certificate for {selectedStudent.name}
                    </Button>
                  )}
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================
          PRINT & DARK MODE STYLES
          ============================================================ */}
      <style jsx global>{`
        /* ===== SCREEN STYLES ===== */
        #tc-certificate {
          max-width: 100%;
          margin: 0 auto;
          background: white;
        }

        .certificate-wrapper {
          display: flex;
          flex-direction: column;
          min-height: 277mm;
        }

        .certificate-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 5mm 7mm;
          position: relative;
          border: 4px double #065f46;
          min-height: 275mm;
          background: white;
        }

        /* Watermark */
        .watermark {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
          opacity: 0.05;
          z-index: 0;
        }
        .watermark img { width: 70%; height: 70%; object-fit: contain; }

        /* Header */
        .header {
          text-align: center;
          border-bottom: 2px solid #065f46;
          padding-bottom: 3mm;
          margin-bottom: 2.5mm;
          position: relative;
          z-index: 1;
        }
        .logo { display: block; margin: 0 auto 1.5mm; height: 16mm; width: auto; }
        .school-name { font-size: 20px; font-weight: 800; color: #065f46; text-transform: uppercase; letter-spacing: 0.05em; }
        .school-address { font-size: 9px; color: #4b5563; margin-top: 0.5mm; }
        .school-contact { font-size: 8px; color: #6b7280; margin-top: 0.5mm; }

        /* Title */
        .title { text-align: center; margin-bottom: 2.5mm; position: relative; z-index: 1; }
        .title span {
          display: inline-block;
          padding: 0.8mm 5mm;
          background: #065f46;
          color: white;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          border-radius: 3px;
        }

        /* Meta */
        .meta {
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          font-weight: 600;
          color: #374151;
          margin-bottom: 3mm;
          padding: 0 1mm;
          position: relative;
          z-index: 1;
        }
        .meta > div { display: flex; align-items: center; gap: 1.5mm; }
        .meta-value { font-family: monospace; border-bottom: 1px dashed #9ca3af; padding: 0 1.5mm; color: black; }

        /* Body */
        .body {
          flex: 1;
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
        }

        .body-text {
          font-size: 11px;
          line-height: 1.8;
          color: #1f2937;
          text-align: justify;
          margin-bottom: 2mm;
        }
        .body-text.italic { font-style: italic; }
        .body-text.text-center { text-align: center; }
        
        .highlight {
          font-weight: 600;
          color: black;
          border-bottom: 1px dashed #9ca3af;
          padding: 0 0.5mm;
        }

        /* Details Grid */
        .details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.5mm 3mm;
          padding: 1.5mm 0;
          margin: 1mm 0 1.5mm 0;
          border-top: 1px dashed #d1d5db;
          border-bottom: 1px dashed #d1d5db;
        }
        .detail {
          display: flex;
          justify-content: space-between;
          padding: 0.3mm 0;
          border-bottom: 1px solid #f3f4f6;
        }
        .detail.full { grid-column: 1 / -1; }
        .label { font-size: 9px; font-weight: 500; color: #4b5563; }
        .value { font-size: 9px; font-weight: 600; color: black; }

        /* Signatures */
        .signatures {
          display: flex;
          justify-content: space-between;
          padding-top: 2.5mm;
          border-top: 1px solid #d1d5db;
          margin-top: 2.5mm;
          position: relative;
          z-index: 1;
        }
        .signature { text-align: center; flex: 1; min-width: 70px; }
        .line {
          width: 100%;
          max-width: 110px;
          height: 8mm;
          border-bottom: 2px solid #9ca3af;
          margin: 0 auto 0.3mm;
        }
        .signature span {
          font-size: 7px;
          font-weight: 600;
          color: #4b5563;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        /* Footer */
        .footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 1.5mm;
          border-top: 1px solid #e5e7eb;
          margin-top: auto;
          font-size: 7px;
          color: #9ca3af;
          position: relative;
          z-index: 1;
        }
        .footer-right { display: flex; align-items: center; gap: 2mm; }
        .qr { display: flex; align-items: center; gap: 0.5mm; }

        /* ===== PRINT STYLES ===== */
        @media print {
          body * { visibility: hidden !important; }
          #tc-certificate, #tc-certificate * { visibility: visible !important; }

          #tc-certificate {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 210mm !important;
            min-height: 297mm !important;
            background: white !important;
            z-index: 9999 !important;
            padding: 8mm !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
          }

          .certificate-wrapper {
            min-height: 277mm !important;
          }

          .certificate-container {
            padding: 5mm 7mm !important;
            border: 4px double #065f46 !important;
          }

          .print\\:hidden { display: none !important; }

          @page {
            size: A4 portrait !important;
            margin: 0 !important;
          }

          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
        }

        /* ===== DARK MODE OVERRIDES ===== */
        .dark #tc-certificate {
          background: transparent !important;
        }

        .dark .certificate-container {
          background: white !important;
          border-color: #065f46 !important;
        }

        .dark .school-name {
          color: #065f46 !important;
        }

        .dark .school-address {
          color: #4b5563 !important;
        }

        .dark .school-contact {
          color: #6b7280 !important;
        }

        .dark .meta {
          color: #374151 !important;
        }

        .dark .meta-value {
          color: black !important;
        }

        .dark .body-text {
          color: #1f2937 !important;
        }

        .dark .highlight {
          color: black !important;
        }

        .dark .label {
          color: #4b5563 !important;
        }

        .dark .value {
          color: black !important;
        }

        .dark .signature span {
          color: #4b5563 !important;
        }

        .dark .footer {
          color: #9ca3af !important;
        }

        .dark .details-grid {
          border-color: #d1d5db !important;
        }

        .dark .detail {
          border-color: #f3f4f6 !important;
        }
      `}</style>
    </ResponsiveLayout>
  );
}