"use client";

import { useState, useEffect, useRef, Fragment } from "react";
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
  RotateCcw,
  Users,
  Eye,
  Calendar,
  BookOpen,
  School,
  UserCheck,
  FileSpreadsheet,
  RefreshCw
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

export interface ExamTerm {
  id: string;
  name: string;
  term_code: string;
  start_date: string;
  end_date: string;
  status: string;
  academic_year_id: string;
  weightage_percentage: number;
  result_status: string;
}

export interface ExamSubject {
  id: string;
  term_id: string;
  class_id: string;
  section_id: string;
  subject_id: string;
  subject_type: string;
  full_marks: number;
  pass_marks: number;
  order_index: number;
  subject?: {
    id: string;
    name: string;
    code: string;
  };
}

export interface Student {
  id: string;
  student_id: string;
  admission_no: string;
  name: string;
  name_bn: string;
  father_name: string;
  mother_name: string;
  contact: string;
  fathers_contact: string;
  mothers_contact: string;
  email: string;
  class_id: string;
  section_id: string;
  class_roll: string;
  admission_date: string;
  student_photo_url: string;
  status: string;
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

export interface AcademicYear {
  id: string;
  name: string;
  year_name: string;
  is_current: boolean;
}

export interface AdmitCardData {
  id: string;
  student: Student;
  exam: ExamTerm;
  subjects: ExamSubject[];
  school: SchoolSettings;
  issue_date: string;
  class_name: string;
  section_name: string;
  academic_year_name: string;
}

export interface FilterOptions {
  examId: string;
  classId: string;
  sectionId: string;
  searchTerm: string;
  status: string;
}

// ==============================
// MAIN COMPONENT
// ==============================

export default function AdmitCardPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [exams, setExams] = useState<ExamTerm[]>([]);
  const [examSubjects, setExamSubjects] = useState<ExamSubject[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedExam, setSelectedExam] = useState<ExamTerm | null>(null);
  const [admitCardData, setAdmitCardData] = useState<AdmitCardData | null>(null);
  const [bulkAdmitCards, setBulkAdmitCards] = useState<AdmitCardData[]>([]);
  
  const [filters, setFilters] = useState<FilterOptions>({
    examId: "",
    classId: "all",
    sectionId: "all",
    searchTerm: "",
    status: "all",
  });
  
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [printMode, setPrintMode] = useState<"single" | "bulk">("single");
  const [bulkClassId, setBulkClassId] = useState<string>("");
  const [bulkSectionId, setBulkSectionId] = useState<string>("all");
  const [bulkStudents, setBulkStudents] = useState<Student[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isBulkMode, setIsBulkMode] = useState(false);
  
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

  useEffect(() => {
    if (bulkClassId) {
      const studentsInClass = students.filter(s => s.class_id === bulkClassId);
      if (bulkSectionId && bulkSectionId !== "all") {
        setBulkStudents(studentsInClass.filter(s => s.section_id === bulkSectionId));
      } else {
        setBulkStudents(studentsInClass);
      }
    } else {
      setBulkStudents([]);
    }
  }, [bulkClassId, bulkSectionId, students]);

  async function loadAllData() {
    try {
      setLoading(true);
      setError(null);

      await Promise.all([
        loadStudents(),
        loadExamTerms(),
        loadClasses(),
        loadSections(),
        loadAcademicYears(),
        loadSchoolSettings(),
      ]);

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
          academic_year:academic_year_id(name, year_name)
        `)
        .order("name", { ascending: true });

      if (error) throw error;
      
      const studentsWithNames = (data || []).map((s: any) => ({
        ...s,
        class_name: s.class?.name,
        section_name: s.section?.name,
        academic_year_name: s.academic_year?.name || s.academic_year?.year_name,
        student_id: s.student_id || '',
        admission_no: s.student_id || '',
        name: s.name || '',
        father_name: s.father_name || '',
        mother_name: s.mother_name || '',
        contact: s.contact || '',
        fathers_contact: s.fathers_contact || '',
        mothers_contact: s.mothers_contact || '',
        class_roll: s.class_roll || '',
        status: s.status || 'active',
      }));
      
      setStudents(studentsWithNames);
      setFilteredStudents(studentsWithNames);
    } catch (err) {
      console.error("Error loading students:", err);
      setStudents([]);
      setFilteredStudents([]);
    }
  }

  async function loadExamTerms() {
    try {
      const { data, error } = await supabase
        .from("exam_terms")
        .select("*")
        .order("start_date", { ascending: false });

      if (error) throw error;
      setExams(data || []);
    } catch (err) {
      console.error("Error loading exams:", err);
      setExams([]);
    }
  }

  async function loadExamSubjects(examId: string, classId: string) {
    try {
      const { data, error } = await supabase
        .from("exam_subjects")
        .select(`
          *,
          subject:subject_id(id, name, code)
        `)
        .eq("term_id", examId)
        .eq("class_id", classId)
        .order("order_index", { ascending: true });

      if (error) throw error;
      setExamSubjects(data || []);
      return data || [];
    } catch (err) {
      console.error("Error loading exam subjects:", err);
      setExamSubjects([]);
      return [];
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

  async function loadAcademicYears() {
    try {
      const { data, error } = await supabase
        .from("academic_years")
        .select("*")
        .order("year_name", { ascending: false });

      if (error) throw error;
      setAcademicYears(data || []);
    } catch (err) {
      console.error("Error loading academic years:", err);
      setAcademicYears([]);
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
      examId: "",
      classId: "all",
      sectionId: "all",
      searchTerm: "",
      status: "all",
    });
    setFilteredStudents(students);
  }

  // ==============================
  // ADMIT CARD GENERATION
  // ==============================

  async function handleGenerateAdmitCard() {
    if (!selectedStudent) {
      setError("Please select a student first");
      return;
    }

    if (!selectedExam) {
      setError("Please select an exam first");
      return;
    }

    try {
      setGenerating(true);
      setError(null);

      const subjects = await loadExamSubjects(selectedExam.id, selectedStudent.class_id);

      if (!subjects || subjects.length === 0) {
        setError("No subjects found for this exam and class");
        setGenerating(false);
        return;
      }

      let academicYearName = selectedStudent.academic_year_name || "";
      if (!academicYearName) {
        const yearData = academicYears.find(y => y.id === (selectedStudent as any).academic_year_id);
        academicYearName = yearData?.name || yearData?.year_name || "N/A";
      }

      const admitCardData: AdmitCardData = {
        id: `admit-${Date.now()}`,
        student: selectedStudent,
        exam: selectedExam,
        subjects: subjects,
        school: schoolSettings!,
        issue_date: issueDate,
        class_name: selectedStudent.class_name || "N/A",
        section_name: selectedStudent.section_name || "N/A",
        academic_year_name: academicYearName,
      };

      setAdmitCardData(admitCardData);
      setIsPreviewMode(true);
      setIsBulkMode(false);

    } catch (err: any) {
      console.error("Error generating admit card:", err);
      setError(err.message || "Failed to generate admit card");
    } finally {
      setGenerating(false);
    }
  }

  async function handleGenerateBulkAdmitCards() {
    if (!selectedExam) {
      setError("Please select an exam first");
      return;
    }

    if (!bulkClassId) {
      setError("Please select a class for bulk printing");
      return;
    }

    if (bulkStudents.length === 0) {
      setError("No students found in this class/section");
      return;
    }

    try {
      setGenerating(true);
      setError(null);

      const subjects = await loadExamSubjects(selectedExam.id, bulkClassId);

      if (!subjects || subjects.length === 0) {
        setError("No subjects found for this exam and class");
        setGenerating(false);
        return;
      }

      const cards: AdmitCardData[] = [];
      
      for (const student of bulkStudents) {
        let academicYearName = student.academic_year_name || "";
        if (!academicYearName) {
          const yearData = academicYears.find(y => y.id === (student as any).academic_year_id);
          academicYearName = yearData?.name || yearData?.year_name || "N/A";
        }

        cards.push({
          id: `admit-${Date.now()}-${student.id}`,
          student: student,
          exam: selectedExam,
          subjects: subjects,
          school: schoolSettings!,
          issue_date: issueDate,
          class_name: student.class_name || "N/A",
          section_name: student.section_name || "N/A",
          academic_year_name: academicYearName,
        });
      }

      setBulkAdmitCards(cards);
      setIsPreviewMode(true);
      setIsBulkMode(true);

    } catch (err: any) {
      console.error("Error generating bulk admit cards:", err);
      setError(err.message || "Failed to generate bulk admit cards");
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
      const certContent = document.getElementById('admit-card-certificate')?.innerHTML;
      if (certContent) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Admit Card${isBulkMode ? 's' : ''}</title>
              <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { 
                  font-family: 'Times New Roman', Georgia, serif;
                  background: white;
                  padding: 0;
                  margin: 0;
                }
                .page-container {
                  width: 210mm;
                  min-height: 297mm;
                  padding: 5mm;
                  margin: 0 auto;
                  background: white;
                }
                .admit-card-wrapper {
                  display: grid;
                  grid-template-columns: 1fr;
                  gap: 4mm;
                  min-height: 140mm;
                }
                .admit-card-single {
                  border: 3px double #065f46;
                  padding: 3mm 4mm;
                  background: white;
                  display: flex;
                  flex-direction: column;
                  min-height: 130mm;
                  page-break-inside: avoid;
                  break-inside: avoid;
                }
                .admit-card-single .header {
                  text-align: center;
                  border-bottom: 1.5px solid #065f46;
                  padding-bottom: 1.5mm;
                  margin-bottom: 1.5mm;
                }
                .admit-card-single .header .logo { height: 10mm; width: auto; display: block; margin: 0 auto 0.5mm; }
                .admit-card-single .header .school-name { font-size: 12px; font-weight: 800; color: #065f46; text-transform: uppercase; }
                .admit-card-single .header .school-address { font-size: 7px; color: #4b5563; }
                .admit-card-single .header .school-contact { font-size: 6px; color: #6b7280; }
                .admit-card-single .title { text-align: center; margin-bottom: 1.5mm; }
                .admit-card-single .title span { display: inline-block; padding: 0.3mm 3mm; background: #065f46; color: white; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; border-radius: 2px; }
                .admit-card-single .exam-info { display: flex; justify-content: space-between; font-size: 7px; font-weight: 600; color: #374151; margin-bottom: 1mm; }
                .admit-card-single .exam-info .exam-info-value { font-family: monospace; border-bottom: 1px dashed #9ca3af; padding: 0 0.5mm; color: black; }
                .admit-card-single .student-info { display: grid; grid-template-columns: 1fr 1fr; gap: 0.3mm 1mm; padding: 0.5mm 0; margin-bottom: 1mm; border-bottom: 1px dashed #d1d5db; }
                .admit-card-single .student-info .info-item { display: flex; align-items: center; gap: 0.3mm; font-size: 7px; }
                .admit-card-single .student-info .info-label { font-weight: 500; color: #4b5563; min-width: 50px; }
                .admit-card-single .student-info .info-value { font-weight: 600; color: black; border-bottom: 1px dashed #9ca3af; padding: 0 0.3mm; }
                .admit-card-single .subjects-table { width: 100%; border-collapse: collapse; font-size: 6.5px; margin: 0.5mm 0; }
                .admit-card-single .subjects-table th { background: #065f46; color: white; padding: 0.3mm 0.5mm; text-align: left; }
                .admit-card-single .subjects-table td { padding: 0.3mm 0.5mm; border-bottom: 0.5px solid #e5e7eb; }
                .admit-card-single .subjects-table tr:nth-child(even) td { background: #f9fafb; }
                .admit-card-single .instructions { font-size: 5.5px; color: #6b7280; margin-top: 0.5mm; padding: 0.5mm 1mm; background: #f9fafb; border-radius: 1px; border-left: 2px solid #065f46; }
                .admit-card-single .instructions ul { padding-left: 3mm; list-style-type: disc; }
                .admit-card-single .signatures { display: flex; justify-content: space-between; padding-top: 1mm; border-top: 1px solid #d1d5db; margin-top: auto; }
                .admit-card-single .signatures .signature { text-align: center; flex: 1; }
                .admit-card-single .signatures .line { width: 80%; max-width: 60px; height: 4mm; border-bottom: 1.5px solid #9ca3af; margin: 0 auto 0.2mm; }
                .admit-card-single .signatures .signature span { font-size: 5px; font-weight: 600; color: #4b5563; text-transform: uppercase; }
                .admit-card-single .footer { display: flex; justify-content: space-between; align-items: center; padding-top: 0.5mm; border-top: 0.5px solid #e5e7eb; margin-top: 0.5mm; font-size: 5px; color: #9ca3af; }
                .page-break { page-break-after: always; break-after: page; }
                @page { 
                  size: A4 portrait; 
                  margin: 0; 
                }
                * { -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; }
                @media print {
                  body { padding: 0; margin: 0; }
                  .no-print { display: none !important; }
                }
              </style>
            </head>
            <body>
              <div class="page-container">
                ${certContent}
              </div>
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
    setSelectedExam(null);
    setAdmitCardData(null);
    setBulkAdmitCards([]);
    setExamSubjects([]);
    setBulkClassId("");
    setBulkSectionId("all");
    setBulkStudents([]);
    setIsPreviewMode(false);
    setIsBulkMode(false);
    setError(null);
    resetFilters();
    setSelectedExam(null);
    setSelectedStudent(null);
    setIsPreviewMode(false);
    setIsBulkMode(false);
    setError(null);
  };

  const handleResetBulk = () => {
    setBulkClassId("");
    setBulkSectionId("all");
    setBulkStudents([]);
    setBulkAdmitCards([]);
    setIsPreviewMode(false);
    setIsBulkMode(false);
    setError(null);
    setSelectedStudent(null);
  };

  const handleStudentSelect = (student: Student) => {
    setSelectedStudent(student);
    setError(null);
  };

  const handleExamSelect = (examId: string) => {
    const exam = exams.find((e) => e.id === examId);
    setSelectedExam(exam || null);
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

  const getDayName = (dateString: string) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "N/A";
      return date.toLocaleDateString("en-US", { weekday: 'long' });
    } catch {
      return "N/A";
    }
  };

  const renderAdmitCard = (data: AdmitCardData, index?: number) => {
    return (
      <div key={data.id} className="admit-card-single">
        {/* Header */}
        <div className="header">
          {data.school?.school_logo && (
            <img src={data.school.school_logo} alt={data.school.school_name} className="logo" />
          )}
          <div className="school-name">{data.school?.school_name || "School Name"}</div>
          <div className="school-address">{data.school?.school_address || "School Address"}</div>
          <div className="school-contact">
            📞 {data.school?.school_phone || "N/A"} | ✉ {data.school?.school_email || "N/A"}
          </div>
        </div>

        {/* Title */}
        <div className="title">
          <span>Admit Card</span>
        </div>

        {/* Exam Info */}
        <div className="exam-info">
          <div>Exam: <span className="exam-info-value">{data.exam.name}</span></div>
          <div>Date: <span className="exam-info-value">{formatDate(data.exam.start_date)} - {formatDate(data.exam.end_date)}</span></div>
        </div>

        {/* Student Info */}
        <div className="student-info">
          <div className="info-item"><span className="info-label">Name:</span><span className="info-value">{data.student.name}</span></div>
          <div className="info-item"><span className="info-label">Class:</span><span className="info-value">{data.class_name}</span></div>
          <div className="info-item"><span className="info-label">Section:</span><span className="info-value">{data.section_name}</span></div>
          <div className="info-item"><span className="info-label">Roll:</span><span className="info-value">{data.student.class_roll || "N/A"}</span></div>
          <div className="info-item"><span className="info-label">Admission:</span><span className="info-value">{data.student.student_id || "N/A"}</span></div>
          <div className="info-item"><span className="info-label">Issue Date:</span><span className="info-value">{formatDate(data.issue_date)}</span></div>
        </div>

        {/* Subjects Table */}
        <table className="subjects-table">
          <thead>
            <tr>
              <th>SL</th>
              <th>Subject</th>
              <th>Code</th>
              <th>Type</th>
              <th>FM</th>
              <th>PM</th>
              <th>Date</th>
              <th>Day</th>
            </tr>
          </thead>
          <tbody>
            {data.subjects.map((subject, idx) => {
              const examStart = new Date(data.exam.start_date);
              const examEnd = new Date(data.exam.end_date);
              const totalDays = Math.ceil((examEnd.getTime() - examStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
              const dayOffset = idx % Math.max(totalDays, 1);
              const examDate = new Date(examStart);
              examDate.setDate(examDate.getDate() + dayOffset);
              
              return (
                <tr key={subject.id}>
                  <td>{idx + 1}</td>
                  <td>{subject.subject?.name || "N/A"}</td>
                  <td>{subject.subject?.code || "N/A"}</td>
                  <td>{subject.subject_type || "N/A"}</td>
                  <td>{subject.full_marks || 0}</td>
                  <td>{subject.pass_marks || 0}</td>
                  <td>{formatDate(examDate.toISOString())}</td>
                  <td>{getDayName(examDate.toISOString())}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Instructions */}
        <div className="instructions">
          <strong>📌 Instructions:</strong>
          <ul>
            <li>Carry this card to the exam hall</li>
            <li>Arrive 30 mins before exam</li>
            <li>Bring own stationery</li>
            <li>No electronic devices</li>
          </ul>
        </div>

        {/* Signatures */}
        <div className="signatures">
          <div className="signature"><div className="line"></div><span>Class Teacher</span></div>
          <div className="signature"><div className="line"></div><span>Prepared By</span></div>
          <div className="signature"><div className="line"></div><span>{data.school?.principal_designation || "Principal"}</span></div>
        </div>

        {/* Footer */}
        <div className="footer">
          <div>Generated by {data.school?.school_name || "ERP"}</div>
          <div>ID: {data.id.slice(-6)}</div>
        </div>
      </div>
    );
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
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Loading Admit Card...</p>
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
              <h1 className="text-2xl font-bold font-heading dark:text-white">Admit Card</h1>
              <p className="text-text-muted dark:text-gray-400">Generate exam admit cards for students</p>
            </div>
          </div>
          {isPreviewMode && (
            <div className="flex gap-3">
              <Button onClick={handlePrint} className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-800">
                <Printer className="h-4 w-4 mr-2" />
                {isBulkMode ? `Print ${bulkAdmitCards.length} Cards` : 'Print Admit Card'}
              </Button>
              <Button variant="outline" onClick={isBulkMode ? handleResetBulk : handleReset} className="dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800">
                {isBulkMode ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    New Class
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    New
                  </>
                )}
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

        {/* Mode Selection */}
        {!isPreviewMode && (
          <div className="flex flex-wrap gap-4">
            <div className="flex gap-2">
              <Button
                variant={printMode === "single" ? "default" : "outline"}
                onClick={() => setPrintMode("single")}
                className={printMode === "single" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
              >
                <User className="h-4 w-4 mr-2" />
                Single Student
              </Button>
              <Button
                variant={printMode === "bulk" ? "default" : "outline"}
                onClick={() => setPrintMode("bulk")}
                className={printMode === "bulk" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
              >
                <Users className="h-4 w-4 mr-2" />
                Bulk Print
              </Button>
            </div>
            <div className="text-xs text-gray-400 ml-auto flex items-center">
              <span className="inline-block px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
                📄 A4 Portrait - 2 Cards per page
              </span>
            </div>
          </div>
        )}

        {/* ============================================================
            TWO-COLUMN LAYOUT
            ============================================================ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* ===== LEFT COLUMN ===== */}
          <div className="space-y-6">
            {/* Exam Selection */}
            <Card className="dark:bg-gray-800 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 dark:text-white">
                  <BookOpen className="h-5 w-5 dark:text-gray-400" />
                  Select Exam
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="dark:text-gray-300">Exam</Label>
                  <Select 
                    value={selectedExam?.id || "none"} 
                    onValueChange={handleExamSelect}
                  >
                    <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                      <SelectValue placeholder="Select an exam" />
                    </SelectTrigger>
                    <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                      <SelectItem value="none" className="dark:text-white dark:hover:bg-gray-700">
                        -- Select Exam --
                      </SelectItem>
                      {exams.map((exam) => (
                        <SelectItem key={exam.id} value={exam.id} className="dark:text-white dark:hover:bg-gray-700">
                          {exam.name} ({formatDate(exam.start_date)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedExam && (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                    <p className="text-sm font-medium text-emerald-800 dark:text-emerald-400">
                      {selectedExam.name}
                    </p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-500">
                      {formatDate(selectedExam.start_date)} - {formatDate(selectedExam.end_date)}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Bulk Print Mode */}
            {printMode === "bulk" && !isPreviewMode && (
              <Card className="dark:bg-gray-800 dark:border-gray-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 dark:text-white">
                    <Users className="h-5 w-5 dark:text-gray-400" />
                    Bulk Print Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="dark:text-gray-300">Class *</Label>
                    <Select 
                      value={bulkClassId || "none"} 
                      onValueChange={(value) => setBulkClassId(value === "none" ? "" : value)}
                    >
                      <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                        <SelectValue placeholder="Select Class" />
                      </SelectTrigger>
                      <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                        <SelectItem value="none" className="dark:text-white dark:hover:bg-gray-700">
                          -- Select Class --
                        </SelectItem>
                        {classes.map((cls) => (
                          <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="dark:text-gray-300">Section (Optional)</Label>
                    <Select 
                      value={bulkSectionId || "all"} 
                      onValueChange={(value) => setBulkSectionId(value)}
                    >
                      <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                        <SelectValue placeholder="All Sections" />
                      </SelectTrigger>
                      <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                        <SelectItem value="all">All Sections</SelectItem>
                        {sections
                          .filter(sec => sec.class_id === bulkClassId)
                          .map((sec) => (
                            <SelectItem key={sec.id} value={sec.id}>{sec.name}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {bulkClassId && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <p className="text-sm font-medium text-blue-800 dark:text-blue-400">
                        {bulkStudents.length} students found
                      </p>
                      <p className="text-xs text-blue-600 dark:text-blue-500">
                        {bulkSectionId && bulkSectionId !== "all" 
                          ? `Section: ${sections.find(s => s.id === bulkSectionId)?.name || "N/A"}`
                          : "All sections"}
                      </p>
                    </div>
                  )}

                  <div className="space-y-1">
                    <Label className="text-xs dark:text-gray-300">Issue Date</Label>
                    <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="dark:bg-gray-700 dark:border-gray-600 dark:text-white h-9" />
                  </div>

                  <Button 
                    onClick={handleGenerateBulkAdmitCards} 
                    disabled={generating || !bulkClassId || bulkStudents.length === 0 || !selectedExam}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-800"
                  >
                    {generating ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...</>
                    ) : (
                      <><FileSpreadsheet className="h-4 w-4 mr-2" /> Generate {bulkStudents.length} Admit Cards</>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Single Student Mode */}
            {printMode === "single" && !isPreviewMode && (
              <Card className="dark:bg-gray-800 dark:border-gray-700">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2 dark:text-white">
                    <User className="h-5 w-5 dark:text-gray-400" />
                    Select Student
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowFilters(!showFilters)}
                    className="dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    {showFilters ? "Hide" : "Filters"}
                    <ChevronDown className={`ml-2 h-4 w-4 transition-transform ${showFilters ? "rotate-180" : ""}`} />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
                    <Input
                      type="text"
                      placeholder="Search by Name, ID, Roll, Father..."
                      value={filters.searchTerm}
                      onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
                      className="pl-9 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder:text-gray-400"
                    />
                  </div>

                  {showFilters && (
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t dark:border-gray-700">
                      <div className="space-y-2">
                        <Label className="dark:text-gray-300">Class</Label>
                        <Select
                          value={filters.classId}
                          onValueChange={(value) => setFilters({ ...filters, classId: value, sectionId: "all" })}
                        >
                          <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                            <SelectValue placeholder="All" />
                          </SelectTrigger>
                          <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                            <SelectItem value="all">All Classes</SelectItem>
                            {classes.map((cls) => (
                              <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
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
                            <SelectValue placeholder="All" />
                          </SelectTrigger>
                          <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                            <SelectItem value="all">All Sections</SelectItem>
                            {sections
                              .filter(sec => !filters.classId || filters.classId === "all" || sec.class_id === filters.classId)
                              .map((sec) => (
                                <SelectItem key={sec.id} value={sec.id}>{sec.name}</SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Found {filteredStudents.length} students
                  </div>

                  {filteredStudents.length > 0 ? (
                    <div className="border rounded-lg max-h-[300px] overflow-y-auto dark:border-gray-700">
                      {filteredStudents.map((student) => (
                        <div
                          key={student.id}
                          onClick={() => handleStudentSelect(student)}
                          className={`px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b last:border-b-0 dark:border-gray-700 flex items-center gap-3 transition-colors ${
                            selectedStudent?.id === student.id ? "bg-emerald-50 dark:bg-emerald-900/30 border-l-4 border-emerald-500" : ""
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm dark:text-white">{student.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              ID: {student.student_id} | Class: {student.class_name} | Roll: {student.class_roll}
                            </p>
                          </div>
                          {selectedStudent?.id === student.id && (
                            <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <Users className="h-8 w-8 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                      <p>No students found</p>
                    </div>
                  )}

                  {selectedStudent && (
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                      <p className="text-sm font-medium text-emerald-800 dark:text-emerald-400">
                        Selected: {selectedStudent.name}
                      </p>
                      <p className="text-xs text-emerald-600 dark:text-emerald-500">
                        Class: {selectedStudent.class_name} | Section: {selectedStudent.section_name} | Roll: {selectedStudent.class_roll}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Generate Single Button */}
            {printMode === "single" && selectedStudent && selectedExam && !isPreviewMode && (
              <Card className="dark:bg-gray-800 dark:border-gray-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base dark:text-white">
                    <Calendar className="h-5 w-5 dark:text-gray-400" />
                    Generate Admit Card
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs dark:text-gray-300">Issue Date</Label>
                    <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="dark:bg-gray-700 dark:border-gray-600 dark:text-white h-9" />
                  </div>
                  <Button 
                    onClick={handleGenerateAdmitCard} 
                    disabled={generating}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-800"
                  >
                    {generating ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...</>
                    ) : (
                      <><FileText className="h-4 w-4 mr-2" /> Generate Admit Card</>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* ===== RIGHT COLUMN - Preview ===== */}
          <div className="lg:sticky lg:top-6 self-start">
            {isPreviewMode ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="p-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="font-medium text-sm dark:text-white">
                      {isBulkMode ? `Bulk Preview (${bulkAdmitCards.length} cards)` : 'Preview'}
                    </span>
                    <span className="text-xs text-gray-400">(A4 Portrait - 2 per page)</span>
                  </div>
                  {isBulkMode && bulkAdmitCards.length > 0 && (
                    <Button 
                      onClick={handlePrint} 
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-800"
                    >
                      <Printer className="h-4 w-4 mr-2" />
                      Print All ({bulkAdmitCards.length})
                    </Button>
                  )}
                  {!isBulkMode && admitCardData && (
                    <Button 
                      onClick={handlePrint} 
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-800"
                    >
                      <Printer className="h-4 w-4 mr-2" />
                      Print
                    </Button>
                  )}
                </div>
                <div className="p-4 max-h-[600px] overflow-y-auto dark:bg-gray-800">
                  <div id="admit-card-certificate">
                    {isBulkMode ? (
                      <div className="page-container">
                        <div className="admit-card-wrapper">
                          {bulkAdmitCards.map((card, index) => (
                            <Fragment key={card.id}>
                              {renderAdmitCard(card, index)}
                              {(index + 1) % 2 === 0 && index < bulkAdmitCards.length - 1 && (
                                <div className="page-break"></div>
                              )}
                            </Fragment>
                          ))}
                        </div>
                      </div>
                    ) : (
                      admitCardData && (
                        <div className="page-container">
                          <div className="admit-card-wrapper">
                            {renderAdmitCard(admitCardData)}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <Card className="h-[600px] flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-800 border-dashed border-2 dark:border-gray-700">
                <div className="text-center p-8">
                  <School className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-600 dark:text-gray-400">
                    {printMode === "bulk" ? "Bulk Admit Card Generation" : "No Admit Card Generated"}
                  </h3>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-2 max-w-xs mx-auto">
                    {printMode === "bulk" 
                      ? "Select a class and section, then click 'Generate Admit Cards'"
                      : "Select an exam and a student, then click 'Generate Admit Card'"}
                  </p>
                  <div className="mt-4 text-xs text-gray-400">
                    <span className="inline-block px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
                      📄 A4 Portrait - 2 Cards per page
                    </span>
                  </div>
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
        #admit-card-certificate {
          max-width: 100%;
          margin: 0 auto;
          background: white;
        }

        .page-container {
          width: 210mm;
          min-height: 297mm;
          padding: 5mm;
          margin: 0 auto;
          background: white;
        }

        .admit-card-wrapper {
          display: grid;
          grid-template-columns: 1fr;
          gap: 4mm;
          min-height: 140mm;
        }

        .admit-card-single {
          border: 3px double #065f46;
          padding: 3mm 4mm;
          background: white;
          display: flex;
          flex-direction: column;
          min-height: 130mm;
          page-break-inside: avoid;
          break-inside: avoid;
        }

        .page-break {
          page-break-after: always;
          break-after: page;
        }

        /* ===== ADMIT CARD INNER STYLES ===== */
        .admit-card-single .header {
          text-align: center;
          border-bottom: 1.5px solid #065f46;
          padding-bottom: 1.5mm;
          margin-bottom: 1.5mm;
        }
        .admit-card-single .header .logo { height: 10mm; width: auto; display: block; margin: 0 auto 0.5mm; }
        .admit-card-single .header .school-name { font-size: 12px; font-weight: 800; color: #065f46; text-transform: uppercase; }
        .admit-card-single .header .school-address { font-size: 7px; color: #4b5563; }
        .admit-card-single .header .school-contact { font-size: 6px; color: #6b7280; }
        .admit-card-single .title { text-align: center; margin-bottom: 1.5mm; }
        .admit-card-single .title span { display: inline-block; padding: 0.3mm 3mm; background: #065f46; color: white; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; border-radius: 2px; }
        .admit-card-single .exam-info { display: flex; justify-content: space-between; font-size: 7px; font-weight: 600; color: #374151; margin-bottom: 1mm; }
        .admit-card-single .exam-info .exam-info-value { font-family: monospace; border-bottom: 1px dashed #9ca3af; padding: 0 0.5mm; color: black; }
        .admit-card-single .student-info { display: grid; grid-template-columns: 1fr 1fr; gap: 0.3mm 1mm; padding: 0.5mm 0; margin-bottom: 1mm; border-bottom: 1px dashed #d1d5db; }
        .admit-card-single .student-info .info-item { display: flex; align-items: center; gap: 0.3mm; font-size: 7px; }
        .admit-card-single .student-info .info-label { font-weight: 500; color: #4b5563; min-width: 50px; }
        .admit-card-single .student-info .info-value { font-weight: 600; color: black; border-bottom: 1px dashed #9ca3af; padding: 0 0.3mm; }
        .admit-card-single .subjects-table { width: 100%; border-collapse: collapse; font-size: 6.5px; margin: 0.5mm 0; }
        .admit-card-single .subjects-table th { background: #065f46; color: white; padding: 0.3mm 0.5mm; text-align: left; }
        .admit-card-single .subjects-table td { padding: 0.3mm 0.5mm; border-bottom: 0.5px solid #e5e7eb; }
        .admit-card-single .subjects-table tr:nth-child(even) td { background: #f9fafb; }
        .admit-card-single .instructions { font-size: 5.5px; color: #6b7280; margin-top: 0.5mm; padding: 0.5mm 1mm; background: #f9fafb; border-radius: 1px; border-left: 2px solid #065f46; }
        .admit-card-single .instructions ul { padding-left: 3mm; list-style-type: disc; }
        .admit-card-single .signatures { display: flex; justify-content: space-between; padding-top: 1mm; border-top: 1px solid #d1d5db; margin-top: auto; }
        .admit-card-single .signatures .signature { text-align: center; flex: 1; }
        .admit-card-single .signatures .line { width: 80%; max-width: 60px; height: 4mm; border-bottom: 1.5px solid #9ca3af; margin: 0 auto 0.2mm; }
        .admit-card-single .signatures .signature span { font-size: 5px; font-weight: 600; color: #4b5563; text-transform: uppercase; }
        .admit-card-single .footer { display: flex; justify-content: space-between; align-items: center; padding-top: 0.5mm; border-top: 0.5px solid #e5e7eb; margin-top: 0.5mm; font-size: 5px; color: #9ca3af; }

        /* ===== PRINT STYLES ===== */
        @media print {
          body { padding: 0; margin: 0; background: white; }
          .no-print { display: none !important; }
          #admit-card-certificate {
            position: relative !important;
            width: 100% !important;
            min-height: auto !important;
            background: white !important;
            padding: 0 !important;
            box-shadow: none !important;
          }
          .page-container {
            width: 100% !important;
            min-height: auto !important;
            padding: 3mm !important;
          }
          .admit-card-wrapper {
            grid-template-columns: 1fr !important;
            gap: 3mm !important;
          }
          .admit-card-single {
            border: 2px double #065f46 !important;
            padding: 2mm 3mm !important;
            min-height: 120mm !important;
          }
          .admit-card-single .header .school-name { font-size: 11px !important; }
          .admit-card-single .title span { font-size: 9px !important; }
          .admit-card-single .student-info .info-item { font-size: 6.5px !important; }
          .admit-card-single .subjects-table { font-size: 6px !important; }
          .admit-card-single .exam-info { font-size: 6.5px !important; }
          .admit-card-single .signatures .signature span { font-size: 4.5px !important; }
          .admit-card-single .footer { font-size: 4.5px !important; }
          .admit-card-single .instructions { font-size: 5px !important; }
          .page-break { page-break-after: always !important; break-after: page !important; }
          @page { 
            size: A4 portrait; 
            margin: 0; 
          }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
        }

        /* ===== DARK MODE OVERRIDES ===== */
        .dark #admit-card-certificate {
          background: transparent !important;
        }
        .dark .admit-card-single {
          background: white !important;
          border-color: #065f46 !important;
        }
        .dark .admit-card-single .header .school-name { color: #065f46 !important; }
        .dark .admit-card-single .header .school-address { color: #4b5563 !important; }
        .dark .admit-card-single .header .school-contact { color: #6b7280 !important; }
        .dark .admit-card-single .exam-info { color: #374151 !important; }
        .dark .admit-card-single .exam-info .exam-info-value { color: black !important; }
        .dark .admit-card-single .student-info .info-label { color: #4b5563 !important; }
        .dark .admit-card-single .student-info .info-value { color: black !important; }
        .dark .admit-card-single .signatures .signature span { color: #4b5563 !important; }
        .dark .admit-card-single .footer { color: #9ca3af !important; }
        .dark .admit-card-single .instructions { background: #f9fafb !important; color: #6b7280 !important; }
      `}</style>
    </ResponsiveLayout>
  );
}
