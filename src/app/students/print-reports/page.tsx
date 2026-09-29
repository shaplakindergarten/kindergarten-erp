// src/app/students/print-reports/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Printer,
  Users,
  FileText,
  Loader2,
  Search,
  User,
  Phone,
  UserCheck,
  AlertCircle,
  CheckCircle,
  X,
  Hash,
  CreditCard,
  Eye,
} from "lucide-react";
import { ResponsiveLayout } from "@/components/layout/responsive-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToastStore } from "@/store/useStore";
import { createClient } from "@/lib/supabase/client";
import { getClasses, getStudentsForPrint } from "@/lib/api/students.service";
import { getSchoolPrintHeader } from "@/components/print/SchoolPrintHeader";

interface ClassData {
  id: string;
  name: string;
  numeric_order: number;
  sections: { id: string; name: string }[];
}

interface StudentData {
  id: string;
  student_id: string;
  name: string;
  name_bn?: string;
  father_name: string;
  father_name_bn?: string;
  mother_name: string;
  mother_name_bn?: string;
  dob: string;
  birth_cert_no?: string;
  blood_group?: string;
  particular_disease?: string;
  gender: string;
  contact: string;
  fathers_contact?: string;
  mothers_contact?: string;
  email?: string;
  whatsapp?: string;
  village?: string;
  post_office?: string;
  police_station?: string;
  district?: string;
  permanent_village?: string;
  permanent_post_office?: string;
  permanent_police_station?: string;
  permanent_district?: string;
  class_roll?: string;
  class_id: string;
  section_id: string;
  academic_year_id?: string;
  admission_date?: string;
  photo_url?: string;
student_photo_url?: string;
   father_nid_no?: string;
   mother_nid_no?: string;
   status: string;
  created_at?: string;
  updated_at?: string;
  class?: { id: string; name: string };
  section?: { id: string; name: string };
  academic_year?: { id: string; name: string };
}

interface SchoolSettings {
  school_name: string;
  school_address: string;
  school_phone: string;
  school_email: string;
  school_logo: string;
}

export default function PrintReportsPage() {
  const router = useRouter();
  const addToast = useToastStore((state) => state.addToast);

  // State
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [students, setStudents] = useState<StudentData[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [academicYears, setAcademicYears] = useState<{ id: string; name: string; year_name: string }[]>([]);
  const [sections, setSections] = useState<{ id: string; name: string }[]>([]);
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings>({
    school_name: "চে আলী মডেল একাডেমী",
    school_address: "Nowtala, Madhaiya Bazar, Chandina, Cumilla",
    school_phone: "01923253454",
    school_email: "shapla.kindergarten@gmail.com",
    school_logo: "",
  });
  const [searchResults, setSearchResults] = useState<StudentData[]>([]);
  const [showResultsTable, setShowResultsTable] = useState(false);

  // Filters
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [selectedSectionId, setSelectedSectionId] = useState<string>("all");
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Admission Form Search
  const [admissionSearchValue, setAdmissionSearchValue] = useState<string>("");

  // Active tab
  const [activeTab, setActiveTab] = useState<string>("student-list");

  // ============================================================
  // LOAD DATA
  // ============================================================

  useEffect(() => {
    async function loadData() {
      try {
        const supabase = createClient();
        
        const { data: settingsData } = await supabase
          .from('school_settings')
          .select('school_name, school_address, school_phone, school_email, school_logo')
          .limit(1)
          .single();

        if (settingsData) {
          setSchoolSettings({
            school_name: settingsData.school_name || "চে আলী মডেল একাডেমী",
            school_address: settingsData.school_address || "Nowtala, Madhaiya Bazar, Chandina, Cumilla",
            school_phone: settingsData.school_phone || "01923253454",
            school_email: settingsData.school_email || "shapla.kindergarten@gmail.com",
            school_logo: settingsData.school_logo || "",
          });
        }

        const [classesData, yearsData] = await Promise.all([
          getClasses(),
          supabase.from('academic_years').select('id, name, year_name').order('start_date', { ascending: false }),
        ]);

        setClasses(classesData || []);
        setAcademicYears(yearsData.data || []);

        if (yearsData.data && yearsData.data.length > 0) {
          const currentYear = yearsData.data.find(y => y.year_name?.includes(new Date().getFullYear().toString()));
          setSelectedAcademicYearId(currentYear?.id || yearsData.data[0]?.id || "");
        }
      } catch (error) {
        console.error("Failed to load data:", error);
        addToast({ type: "error", title: "Failed to load data" });
      }
    }
    loadData();
  }, [addToast]);

  useEffect(() => {
    if (selectedClassId && selectedClassId !== 'all') {
      const cls = classes.find(c => c.id === selectedClassId);
      setSections(cls?.sections || []);
    } else {
      setSections([]);
    }
  }, [selectedClassId, classes]);

  // ============================================================
  // LOAD STUDENTS
  // ============================================================

  const loadStudents = async () => {
    setLoadingStudents(true);
    setShowResultsTable(false);
    try {
      const result = await getStudentsForPrint({
        classId: selectedClassId,
        sectionId: selectedSectionId,
        academicYearId: selectedAcademicYearId,
        search: searchTerm,
      });

      if (result.data.length === 0 && result.total === 0) {
        addToast({ type: "info", title: "No students found", message: "Try adjusting your filters" });
      }

      setStudents(result.data);
      setTotalStudents(result.total);
      setShowResultsTable(true);
    } catch (error) {
      console.error("Error loading students:", error);
      addToast({ type: "error", title: "Failed to load students" });
    } finally {
      setLoadingStudents(false);
    }
  };

  // ============================================================
  // SMART SEARCH - Global Search
  // ============================================================

  const handleSmartSearch = async () => {
    if (!admissionSearchValue || admissionSearchValue.trim() === '') {
      addToast({ type: "warning", title: "Please enter a search value" });
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      const searchValue = admissionSearchValue.trim();
      const result = await getStudentsForPrint({
        search: searchValue,
      });

      if (result.data.length === 0) {
        addToast({ 
          type: "info", 
          title: "No results", 
          message: `No student found matching "${searchValue}"` 
        });
      } else {
        addToast({ 
          type: "success", 
          title: `${result.data.length} student(s) found` 
        });
      }

      setSearchResults(result.data);
    } catch (error) {
      console.error("Error in smart search:", error);
      addToast({ type: "error", title: "Search failed" });
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // PRINT FUNCTIONS
  // ============================================================

  const getClassDisplay = (s: StudentData) => s.class?.name || s.class_id || '-';
  const getSectionDisplay = (s: StudentData) => s.section?.name || s.section_id || '-';
  const getAcademicYearDisplay = (s: StudentData) => s.academic_year?.name || s.academic_year_id || '-';

  const generateStudentListHTML = (studentsData: StudentData[], title: string) => {
    const schoolName = schoolSettings.school_name || "চে আলী মডেল একাডেমী";
    const schoolAddress = schoolSettings.school_address || "Nowtala, Madhaiya Bazar, Chandina, Cumilla";
    const schoolPhone = schoolSettings.school_phone || "01923253454";
    const schoolEmail = schoolSettings.school_email || "shapla.kindergarten@gmail.com";
    const schoolLogo = schoolSettings.school_logo || "";
    
    const currentDate = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });

    const classFilter = classes.find(c => c.id === selectedClassId);
    const sectionFilter = sections.find(s => s.id === selectedSectionId);

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <meta charset="UTF-8">
          <style>
            @page { 
              size: A4 landscape; 
              margin: 6mm 8mm;
            }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: Arial, 'Noto Sans Bengali', sans-serif; 
              background: white; 
              color: #000;
              padding: 0;
              font-size: 9px;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .container { 
              width: 100%; 
              padding: 0;
              max-width: 100%;
            }
            .filters {
              font-size: 8px;
              color: #555;
              margin-bottom: 6px;
              padding: 3px 6px;
              background: #f5f5f5;
              border-radius: 3px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 8px;
            }
            table th {
              background: #1a3e60;
              color: #fff;
              padding: 4px 4px;
              text-align: left;
              font-weight: bold;
              border: 1px solid #1a3e60;
              white-space: nowrap;
            }
            table td {
              padding: 3px 4px;
              border: 1px solid #ccc;
              color: #333;
              font-size: 8px;
            }
            table tr:nth-child(even) {
              background: #f9f9f9;
            }
            .photo-cell img {
              width: 25px;
              height: 25px;
              border-radius: 50%;
              object-fit: cover;
              border: 1px solid #ddd;
            }
            .photo-cell .no-photo {
              width: 25px;
              height: 25px;
              border-radius: 50%;
              background: #e5e7eb;
              display: inline-block;
              font-size: 8px;
              text-align: center;
              line-height: 25px;
              color: #999;
            }
            .footer { 
              text-align: center; 
              font-size: 7px; 
              color: #666; 
              border-top: 1px solid #ccc; 
              padding-top: 4px; 
              margin-top: 8px; 
            }
            .page-number {
              float: right;
              font-size: 7px;
              color: #999;
            }
            @media print {
              body { background: white; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            ${getSchoolPrintHeader(
              { school_logo: schoolLogo, school_name: schoolName, school_address: schoolAddress, school_phone: schoolPhone, school_email: schoolEmail },
              title
            )}

            <div class="filters">
              <strong>Date:</strong> ${currentDate}
              ${classFilter ? ` | <strong>Class:</strong> ${classFilter.name}` : ''}
              ${sectionFilter ? ` | <strong>Section:</strong> ${sectionFilter.name}` : ''}
              ${searchTerm ? ` | <strong>Search:</strong> "${searchTerm}"` : ''}
              <strong> | Total:</strong> ${studentsData.length} students
            </div>

            <table>
              <thead>
                <tr>
                  <th width="20">SL</th>
                  <th width="30">Photo</th>
                  <th width="70">Student ID</th>
                  <th width="55">Admission Date</th>
                  <th width="35">Roll</th>
                  <th width="100">Student Name</th>
                  <th width="90">Father's Name</th>
                  <th width="90">Mother's Name</th>
                  <th width="40">Class</th>
                  <th width="40">Section</th>
                  <th width="70">Village</th>
                  <th width="55">Contact</th>
                  <th width="55">Date of Birth</th>
                </tr>
              </thead>
              <tbody>
                ${studentsData.map((s, index) => `
                  <tr>
                    <td>${index + 1}</td>
                    <td class="photo-cell">
                      ${s.student_photo_url ? 
                        `<img src="${s.student_photo_url}" alt="Photo" />` :
                        `<span class="no-photo">📷</span>`
                      }
                    </td>
                    <td>${s.student_id || '-'}</td>
                    <td>${s.admission_date || '-'}</td>
                    <td>${s.class_roll || '-'}</td>
                    <td>${s.name || '-'}</td>
                    <td>${s.father_name || '-'}</td>
                    <td>${s.mother_name || '-'}</td>
                    <td>${getClassDisplay(s)}</td>
                    <td>${getSectionDisplay(s)}</td>
                    <td>${s.village || '-'}</td>
                    <td>${s.contact || '-'}</td>
                    <td>${s.dob || '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div class="footer">
              Generated on ${currentDate} • ${studentsData.length} students
              <span class="page-number">Page 1</span>
            </div>
          </div>
          
          <script>
            let printStarted = false;
            window.onload = function() {
              if (!printStarted) {
                printStarted = true;
                setTimeout(function() { window.print(); }, 500);
              }
            };
            window.onafterprint = function() { window.close(); };
          <\/script>
        </body>
      </html>
    `;
  };

  // ============================================================
  // A4 PERFECT ADMISSION PRINT
  // ============================================================

  const generateAdmissionFormHTML = (student: StudentData) => {
    const schoolName = schoolSettings.school_name || "চে আলী মডেল একাডেমী";
    const schoolAddress = schoolSettings.school_address || "Nowtala, Madhaiya Bazar, Chandina, Cumilla";
    const schoolPhone = schoolSettings.school_phone || "01923253454";
    const schoolEmail = schoolSettings.school_email || "shapla.kindergarten@gmail.com";
    const schoolLogo = schoolSettings.school_logo || "";
    const currentDate = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });

    const calculateAge = (dob: string) => {
      if (!dob) return '';
      const birth = new Date(dob);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      return age;
    };

    const age = calculateAge(student.dob);

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Admission Form - ${student.name}</title>
          <meta charset="UTF-8">
          <style>
            @page { 
              size: A4 portrait; 
              margin: 5mm;
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
              min-height: 100vh;
            }
            .section {
              margin-top: 5px; 
            }
            .section-title { 
              font-size: 12px; 
              font-weight: bold; 
              background: #1a3e60; 
              color: #fff;
              padding: 5px 10px; 
              margin-bottom: 3px; 
              border-radius: 3px;
            }
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 6px;
              margin: 3px 0;
            }
            .info-grid .col {
              border: 1px solid #ccc;
              padding: 5px 8px;
              border-radius: 3px;
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
              font-size: 10px;
              margin: 1.5px 0;
              line-height: 1.4;
            }
            .info-grid .col .lbl {
              font-weight: bold;
              display: inline-block;
              width: 80px;
              font-size: 9px;
            }
            .info-grid .col .value {
              font-size: 10px;
              font-weight: 500;
            }
            .age-info {
              background: #fafafa;
              padding: 4px 10px;
              border: 1px solid #d0d0d0;
              margin: 3px 0;
              font-size: 9px;
              border-radius: 3px;
              text-align: center;
            }
            .conditions {
              background: #f4f8fc;
              padding: 5px 10px;
              border-left: 3px solid #1a3e60;
              margin: 4px 0;
              font-size: 8.5px;
              line-height: 1.5;
            }
            .conditions p {
              margin-bottom: 0.5px;
            }
            .signature-area {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin: 6px 0;
              border-top: 1px solid #ccc;
              padding-top: 6px;
            }
            .signature-area .sig {
              font-size: 10px;
              font-weight: 500;
            }
            .signature-area .sig span {
              display: inline-block;
              border-bottom: 1.5px solid #333;
              min-width: 130px;
              margin-left: 5px;
              padding: 0 5px;
            }
            .footer { 
              text-align: center; 
              font-size: 7px; 
              color: #666; 
              border-top: 1px solid #ccc; 
              padding-top: 4px; 
              margin-top: 8px; 
            }
            @media print {
              body { background: white; }
              .print-container { min-height: 100vh; }
            }
          </style>
        </head>
        <body>
          <div class="print-container">
            ${getSchoolPrintHeader(
              { school_logo: schoolLogo, school_name: schoolName, school_address: schoolAddress, school_phone: schoolPhone, school_email: schoolEmail },
              "📋 ADMISSION FORM",
              true,
              student.student_photo_url
            )}

            <!-- STUDENT INFORMATION -->
            <div class="section">
              <div class="section-title">📘 Student Information</div>
              <div class="info-grid">
                <div class="col">
                  <h4>Personal Details</h4>
                  <p><span class="lbl">Student ID:</span> <span class="value">${student.student_id || '-'}</span></p>
                  <p><span class="lbl">Name (English):</span> <span class="value">${student.name || '-'}</span></p>
                  <p><span class="lbl">Name (Bangla):</span> <span class="value">${student.name_bn || '-'}</span></p>
                  <p><span class="lbl">Date of Birth:</span> <span class="value">${student.dob || '-'}</span></p>
                  <p><span class="lbl">Age:</span> <span class="value">${age || '-'} years</span></p>
                  <p><span class="lbl">Gender:</span> <span class="value">${student.gender || '-'}</span></p>
                  <p><span class="lbl">Blood Group:</span> <span class="value">${student.blood_group || '-'}</span></p>
                  <p><span class="lbl">Particular Disease:</span> <span class="value">${student.particular_disease || 'None'}</span></p>
                </div>
                <div class="col">
                  <h4>Parent Information</h4>
                  <p><span class="lbl">Father's Name:</span> <span class="value">${student.father_name || '-'}</span></p>
                  <p><span class="lbl">Father (Bangla):</span> <span class="value">${student.father_name_bn || '-'}</span></p>
                  <p><span class="lbl">Mother's Name:</span> <span class="value">${student.mother_name || '-'}</span></p>
                  <p><span class="lbl">Mother (Bangla):</span> <span class="value">${student.mother_name_bn || '-'}</span></p>
                  <p><span class="lbl">Guardian Contact:</span> <span class="value">${student.contact || '-'}</span></p>
                  <p><span class="lbl">Father's Contact:</span> <span class="value">${student.fathers_contact || '-'}</span></p>
                  <p><span class="lbl">Mother's Contact:</span> <span class="value">${student.mothers_contact || '-'}</span></p>
                  <p><span class="lbl">Email:</span> <span class="value">${student.email || '-'}</span></p>
                </div>
              </div>
            </div>

            <!-- ADDRESS -->
            <div class="section">
              <div class="section-title">🏠 Address Information</div>
              <div class="info-grid">
                <div class="col">
                  <h4>Present Address</h4>
                  <p><span class="lbl">District:</span> <span class="value">${student.district || '-'}</span></p>
                  <p><span class="lbl">Police Station:</span> <span class="value">${student.police_station || '-'}</span></p>
                  <p><span class="lbl">Post Office:</span> <span class="value">${student.post_office || '-'}</span></p>
                  <p><span class="lbl">Village:</span> <span class="value">${student.village || '-'}</span></p>
                </div>
                <div class="col">
                  <h4>Permanent Address</h4>
                  <p><span class="lbl">District:</span> <span class="value">${student.permanent_district || '-'}</span></p>
                  <p><span class="lbl">Police Station:</span> <span class="value">${student.permanent_police_station || '-'}</span></p>
                  <p><span class="lbl">Post Office:</span> <span class="value">${student.permanent_post_office || '-'}</span></p>
                  <p><span class="lbl">Village:</span> <span class="value">${student.permanent_village || '-'}</span></p>
                </div>
              </div>
            </div>

            <!-- ACADEMIC INFO -->
            <div class="section">
              <div class="section-title">🎓 Academic Information</div>
              <div class="info-grid">
                <div class="col">
                  <h4>Class & Section</h4>
                  <p><span class="lbl">Class:</span> <span class="value">${getClassDisplay(student)}</span></p>
                  <p><span class="lbl">Section:</span> <span class="value">${getSectionDisplay(student)}</span></p>
                  <p><span class="lbl">Class Roll:</span> <span class="value">${student.class_roll || 'Auto-generated'}</span></p>
                  <p><span class="lbl">Academic Year:</span> <span class="value">${getAcademicYearDisplay(student)}</span></p>
                  <p><span class="lbl">Admission Date:</span> <span class="value">${student.admission_date || '-'}</span></p>
                </div>
                <div class="col">
                  <h4>Additional Information</h4>
                  <p><span class="lbl">Birth Certificate:</span> <span class="value">${student.birth_cert_no || '-'}</span></p>
                  <p><span class="lbl">Father's NID:</span> <span class="value">${student.father_nid_no || '-'}</span></p>
                  <p><span class="lbl">Mother's NID:</span> <span class="value">${student.mother_nid_no || '-'}</span></p>
                  <p><span class="lbl">WhatsApp:</span> <span class="value">${student.whatsapp || '-'}</span></p>
                </div>
              </div>
            </div>

            <!-- AGE INFORMATION -->
            <div class="section">
              <div class="section-title">📋 Age Based Class Selection (Notice)</div>
              <div class="age-info">
                <span style="font-weight:bold; color:#1a3e60;">ভর্তির বয়সঃ</span>
                <span style="margin:0 3px; color:#888;">◼</span>
                <span style="font-weight:bold; color:#1a3e60; background:#e8f0fe; padding:0 6px; border-radius:2px;">প্লে (৩-৫ বছর)</span>
                <span style="margin:0 3px; color:#888;">◼</span>
                <span style="color:#888;">নার্সারী (৪-৫ বছর)</span>
                <span style="margin:0 3px; color:#888;">◼</span>
                <span style="color:#888;">কে.জি (৫-৬ বছর)</span>
                <span style="margin:0 3px; color:#888;">◼</span>
                <span style="color:#888;">প্রথম শ্রেণী (৬ বছর)</span>
                <span style="margin:0 3px; color:#888;">◼</span>
                <span style="color:#888;">দ্বিতীয় শ্রেণী (৭ বছর)</span>
                <span style="margin:0 3px; color:#888;">◼</span>
                <span style="color:#888;">তৃতীয় শ্রেণী (৮ বছর)</span>
                <span style="margin:0 3px; color:#888;">◼</span>
                <span style="color:#888;">চতুর্থ শ্রেণী (৯ বছর)</span>
                <span style="margin:0 3px; color:#888;">◼</span>
                <span style="color:#888;">পঞ্চম শ্রেণী (১০ বছর)</span>
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
              <p style="margin-top:2px; font-style:italic; color:#444; font-size:8.5px;">
                আমি সকল শর্ত মেনে চলার অঙ্গীকার করে আমার সন্তানকে ভর্তির আবেদন করছি।
              </p>
            </div>

            <!-- SIGNATURE -->
            <div class="signature-area">
              <div class="sig">Guardian Signature: <span>${student.father_name || '___________'}</span></div>
              <div class="sig">Date: <span>${new Date().toLocaleDateString()}</span></div>
            </div>

            <!-- Footer -->
            <div class="footer">
              Generated on ${currentDate} • Powered by ${schoolName}
            </div>
          </div>
          
          <script>
            let printStarted = false;
            window.onload = function() {
              if (!printStarted) {
                printStarted = true;
                setTimeout(function() { window.print(); }, 500);
              }
            };
            window.onafterprint = function() { window.close(); };
          <\/script>
        </body>
      </html>
    `;
  };

  // ============================================================
  // PROFESSIONAL BLANK FORM - A4 Auto Fit
  // ============================================================

  const generateBlankFormHTML = () => {
    const schoolName = schoolSettings.school_name || "চে আলী মডেল একাডেমী";
    const schoolAddress = schoolSettings.school_address || "Nowtala, Madhaiya Bazar, Chandina, Cumilla";
    const schoolPhone = schoolSettings.school_phone || "01923253454";
    const schoolEmail = schoolSettings.school_email || "shapla.kindergarten@gmail.com";
    const schoolLogo = schoolSettings.school_logo || "";
    const currentDate = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Blank Admission Form</title>
          <meta charset="UTF-8">
          <style>
            @page { 
              size: A4 portrait; 
              margin: 5mm;
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
              min-height: 100vh;
            }
            .section { 
              margin-top: 4px; 
            }
            .section-title { 
              font-size: 11px; 
              font-weight: bold; 
              background: #1a3e60; 
              color: #fff;
              padding: 4px 8px; 
              margin-bottom: 3px; 
              border-radius: 3px;
            }
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 6px;
              margin: 3px 0;
            }
            .info-grid .col {
              border: 1px solid #ccc;
              padding: 4px 8px;
              border-radius: 3px;
              background: #fafafa;
            }
            .info-grid .col h4 {
              font-size: 8px;
              color: #1a3e60;
              border-bottom: 1px solid #ddd;
              padding-bottom: 2px;
              margin-bottom: 2px;
            }
            .info-grid .col p {
              font-size: 9px;
              margin: 2px 0;
              line-height: 1.4;
            }
            .info-grid .col .lbl {
              font-weight: bold;
              display: inline-block;
              width: 80px;
              font-size: 8px;
            }
            .info-grid .col .blank-field {
              display: inline-block;
              border-bottom: 1.5px solid #333;
              min-width: 110px;
              height: 15px;
            }
            .info-grid .col .blank-field-short {
              display: inline-block;
              border-bottom: 1.5px solid #333;
              min-width: 70px;
              height: 15px;
            }
            .photo-box-section {
              display: flex;
              gap: 15px;
              margin: 4px 0;
              padding: 6px 10px;
              border: 1px solid #ccc;
              border-radius: 3px;
              background: #fafafa;
            }
            .photo-box {
              width: 90px;
              height: 110px;
              border: 2px dashed #555;
              border-radius: 4px;
              display: flex;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;
              font-size: 9px;
              color: #888;
              text-align: center;
              background: #f9f9f9;
            }
            .photo-box .text {
              line-height: 1.3;
            }
            .photo-box .text .small {
              font-size: 8px;
              color: #aaa;
            }
            .photo-fields {
              flex: 1;
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 4px 12px;
            }
            .photo-fields p {
              font-size: 9px;
              margin: 2px 0;
            }
            .photo-fields .lbl {
              font-weight: bold;
              display: inline-block;
              width: 75px;
              font-size: 8px;
            }
            .photo-fields .blank-field {
              display: inline-block;
              border-bottom: 1.5px solid #333;
              min-width: 90px;
              height: 15px;
            }
            .age-info {
              background: #fafafa;
              padding: 4px 10px;
              border: 1px solid #d0d0d0;
              margin: 3px 0;
              font-size: 8.5px;
              border-radius: 3px;
              text-align: center;
            }
            .conditions {
              background: #f4f8fc;
              padding: 4px 10px;
              border-left: 3px solid #1a3e60;
              margin: 4px 0;
              font-size: 8px;
              line-height: 1.5;
            }
            .conditions p {
              margin-bottom: 0.5px;
            }
            .declaration {
              margin: 5px 0;
              padding: 6px 10px;
              border: 1px solid #ccc;
              border-radius: 3px;
              background: #f9f9f9;
              font-size: 9px;
              text-align: center;
            }
            .declaration .text {
              margin-bottom: 3px;
            }
            .declaration .blank-field {
              display: inline-block;
              border-bottom: 1.5px solid #333;
              min-width: 150px;
              height: 15px;
            }
            .signature-area {
              display: grid;
              grid-template-columns: 1fr 1fr 1fr;
              gap: 12px;
              margin: 5px 0;
              border-top: 1px solid #ccc;
              padding-top: 6px;
            }
            .signature-area .sig {
              font-size: 9px;
              font-weight: 500;
              text-align: center;
            }
            .signature-area .sig .blank-field {
              display: block;
              border-bottom: 1.5px solid #333;
              height: 15px;
              margin-top: 3px;
            }
            .footer { 
              text-align: center; 
              font-size: 7px; 
              color: #666; 
              border-top: 1px solid #ccc; 
              padding-top: 4px; 
              margin-top: 6px; 
            }
            @media print {
              body { background: white; }
              .print-container { min-height: 100vh; }
            }
          </style>
        </head>
        <body>
          <div class="print-container">
            ${getSchoolPrintHeader(
              { school_logo: schoolLogo, school_name: schoolName, school_address: schoolAddress, school_phone: schoolPhone, school_email: schoolEmail },
              "📋 BLANK ADMISSION FORM"
            )}

            <!-- PHOTO BOX SECTION - Smaller -->
            <div class="photo-box-section">
              <div class="photo-box">
                <div class="text">
                  📷<br />
                  Passport Size<br />
                  <span class="small">(Attach Photo)</span>
                </div>
              </div>
              <div class="photo-fields">
                <p><span class="lbl">Student Name:</span> <span class="blank-field"></span></p>
                <p><span class="lbl">Name (Bangla):</span> <span class="blank-field"></span></p>
                <p><span class="lbl">Father's Name:</span> <span class="blank-field"></span></p>
                <p><span class="lbl">Mother's Name:</span> <span class="blank-field"></span></p>
                <p><span class="lbl">Date of Birth:</span> <span class="blank-field"></span></p>
                <p><span class="lbl">Gender:</span> <span class="blank-field-short"></span></p>
              </div>
            </div>

            <!-- ADDRESS SECTION -->
            <div class="section">
              <div class="section-title">🏠 Address Information</div>
              <div class="info-grid">
                <div class="col">
                  <h4>Present Address</h4>
                  <p><span class="lbl">Village:</span> <span class="blank-field"></span></p>
                  <p><span class="lbl">Post Office:</span> <span class="blank-field"></span></p>
                  <p><span class="lbl">Police Station:</span> <span class="blank-field"></span></p>
                  <p><span class="lbl">District:</span> <span class="blank-field"></span></p>
                </div>
                <div class="col">
                  <h4>Permanent Address</h4>
                  <p><span class="lbl">Village:</span> <span class="blank-field"></span></p>
                  <p><span class="lbl">Post Office:</span> <span class="blank-field"></span></p>
                  <p><span class="lbl">Police Station:</span> <span class="blank-field"></span></p>
                  <p><span class="lbl">District:</span> <span class="blank-field"></span></p>
                </div>
              </div>
            </div>

            <!-- ACADEMIC SECTION -->
            <div class="section">
              <div class="section-title">🎓 Academic Information</div>
              <div class="info-grid">
                <div class="col">
                  <h4>Class & Section</h4>
                  <p><span class="lbl">Class:</span> <span class="blank-field"></span></p>
                  <p><span class="lbl">Section:</span> <span class="blank-field"></span></p>
                  <p><span class="lbl">Class Roll:</span> <span class="blank-field"></span></p>
                  <p><span class="lbl">Admission Date:</span> <span class="blank-field"></span></p>
                </div>
                <div class="col">
                  <h4>Contact Information</h4>
                  <p><span class="lbl">Contact No:</span> <span class="blank-field"></span></p>
                  <p><span class="lbl">Father's Contact:</span> <span class="blank-field"></span></p>
                  <p><span class="lbl">Mother's Contact:</span> <span class="blank-field"></span></p>
                  <p><span class="lbl">Email:</span> <span class="blank-field"></span></p>
                </div>
              </div>
            </div>

            <!-- ADDITIONAL INFO -->
            <div class="section">
              <div class="section-title">📋 Additional Information</div>
              <div class="info-grid">
                <div class="col">
                  <p><span class="lbl">Blood Group:</span> <span class="blank-field"></span></p>
                  <p><span class="lbl">Birth Certificate No:</span> <span class="blank-field"></span></p>
                  <p><span class="lbl">Father's NID:</span> <span class="blank-field"></span></p>
                </div>
                <div class="col">
                  <p><span class="lbl">Mother's NID:</span> <span class="blank-field"></span></p>
                  <p><span class="lbl">WhatsApp:</span> <span class="blank-field"></span></p>
                  <p><span class="lbl">Particular Disease:</span> <span class="blank-field"></span></p>
                </div>
              </div>
            </div>

            <!-- AGE INFORMATION -->
            <div class="section">
              <div class="section-title">📋 Age Based Class Selection (Notice)</div>
              <div class="age-info">
                <span style="font-weight:bold; color:#1a3e60;">ভর্তির বয়সঃ</span>
                <span style="margin:0 3px; color:#888;">◼</span>
                <span style="font-weight:bold; color:#1a3e60; background:#e8f0fe; padding:0 6px; border-radius:2px;">প্লে (৩-৫ বছর)</span>
                <span style="margin:0 3px; color:#888;">◼</span>
                <span style="color:#888;">নার্সারী (৪-৫ বছর)</span>
                <span style="margin:0 3px; color:#888;">◼</span>
                <span style="color:#888;">কে.জি (৫-৬ বছর)</span>
                <span style="margin:0 3px; color:#888;">◼</span>
                <span style="color:#888;">প্রথম শ্রেণী (৬ বছর)</span>
                <span style="margin:0 3px; color:#888;">◼</span>
                <span style="color:#888;">দ্বিতীয় শ্রেণী (৭ বছর)</span>
                <span style="margin:0 3px; color:#888;">◼</span>
                <span style="color:#888;">তৃতীয় শ্রেণী (৮ বছর)</span>
                <span style="margin:0 3px; color:#888;">◼</span>
                <span style="color:#888;">চতুর্থ শ্রেণী (৯ বছর)</span>
                <span style="margin:0 3px; color:#888;">◼</span>
                <span style="color:#888;">পঞ্চম শ্রেণী (১০ বছর)</span>
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
            </div>

            <!-- DECLARATION -->
            <div class="declaration">
              <div class="text">
                <strong>Parent Declaration:</strong> I hereby declare that all information provided above is true and correct.
              </div>
              <div style="margin-top:4px;">
                <span class="lbl">Guardian Name:</span> <span class="blank-field"></span>
              </div>
            </div>

            <!-- SIGNATURES -->
            <div class="signature-area">
              <div class="sig">
                Guardian Signature
                <span class="blank-field"></span>
              </div>
              <div class="sig">
                Student Signature
                <span class="blank-field"></span>
              </div>
              <div class="sig">
                Office Assistant
                <span class="blank-field"></span>
              </div>
            </div>

            <div class="footer">
              Generated on ${currentDate} • Powered by ${schoolName}
            </div>
          </div>
          
          <script>
            let printStarted = false;
            window.onload = function() {
              if (!printStarted) {
                printStarted = true;
                setTimeout(function() { window.print(); }, 500);
              }
            };
            window.onafterprint = function() { window.close(); };
          <\/script>
        </body>
      </html>
    `;
  };

  // ============================================================
  // ✅ DIRECT PRINT ADMISSION FORM (No Preview)
  // ============================================================

  const printAdmissionFormDirect = (student: StudentData) => {
    const html = generateAdmissionFormHTML(student);
    const printWindow = window.open('', '_blank', 'width=900,height=1100,toolbar=yes,scrollbars=yes,menubar=yes');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
    }
  };

  // ============================================================
  // HANDLE PRINT
  // ============================================================

  const handlePrint = (type: 'list' | 'admission-form' | 'blank-form') => {
    if (type === 'list') {
      if (students.length === 0) {
        addToast({ type: "warning", title: "No students found to print" });
        return;
      }

      let title = "Student List";
      if (selectedClassId && selectedClassId !== 'all') {
        const cls = classes.find(c => c.id === selectedClassId);
        title += ` - ${cls?.name || ''}`;
      }
      if (selectedSectionId && selectedSectionId !== 'all') {
        const sec = sections.find(s => s.id === selectedSectionId);
        title += ` (${sec?.name || ''} Section)`;
      }

      const html = generateStudentListHTML(students, title);
      const printWindow = window.open('', '_blank', 'width=1200,height=900,toolbar=yes,scrollbars=yes,menubar=yes');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
      }
    }

    if (type === 'admission-form') {
      // ✅ Direct print - no preview
      if (searchResults.length === 0) {
        addToast({ type: "warning", title: "No student selected" });
        return;
      }
      
      // ✅ Print the first search result directly
      printAdmissionFormDirect(searchResults[0]);
      addToast({ type: "success", title: "Printing admission form..." });
    }

    if (type === 'blank-form') {
      const html = generateBlankFormHTML();
      const printWindow = window.open('', '_blank', 'width=900,height=1100,toolbar=yes,scrollbars=yes,menubar=yes');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
      }
    }
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <ResponsiveLayout>
      <div className="p-4 space-y-4 bg-white dark:bg-gray-900">
        {/* Header */}
        <div className="relative p-6 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 text-white overflow-hidden shadow-lg">
          <div className="absolute inset-0 bg-black/10 backdrop-blur-[2px]"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <Printer className="h-8 w-8" />
              <div>
                <h1 className="text-2xl font-bold">Print Reports</h1>
                <p className="text-white/80">Generate and print various student reports</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid grid-cols-3 gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
            <TabsTrigger value="student-list" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Student List
            </TabsTrigger>
            <TabsTrigger value="admission-form" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Admission Form
            </TabsTrigger>
            <TabsTrigger value="blank-form" className="flex items-center gap-2">
              <Printer className="h-4 w-4" />
              Blank Form
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Student List */}
          <TabsContent value="student-list">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-500" />
                  Print Student List
                </CardTitle>
                <CardDescription>
                  Generate and print student list with filters
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label>Class</Label>
                    <Select
                      value={selectedClassId}
                      onValueChange={(value) => {
                        setSelectedClassId(value);
                        setSelectedSectionId('all');
                      }}
                    >
                      <SelectTrigger className="bg-white border">
                        <SelectValue placeholder="All Classes" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border shadow-lg">
                        <SelectItem value="all">All Classes</SelectItem>
                        {classes.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Section</Label>
                    <Select
                      value={selectedSectionId}
                      onValueChange={setSelectedSectionId}
                      disabled={!selectedClassId || selectedClassId === 'all'}
                    >
                      <SelectTrigger className="bg-white border">
                        <SelectValue placeholder="All Sections" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border shadow-lg">
                        <SelectItem value="all">All Sections</SelectItem>
                        {sections.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Academic Year</Label>
                    <Select
                      value={selectedAcademicYearId}
                      onValueChange={setSelectedAcademicYearId}
                    >
                      <SelectTrigger className="bg-white border">
                        <SelectValue placeholder="Select Year" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border shadow-lg">
                        {academicYears.map((y) => (
                          <SelectItem key={y.id} value={y.id}>
                            {y.name || y.year_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Search</Label>
                    <Input
                      placeholder="Name / ID / Father"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && loadStudents()}
                      className="bg-white border"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={loadStudents}
                    disabled={loadingStudents}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {loadingStudents ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4 mr-2" />
                    )}
                    Load Students
                  </Button>

                  <Button
                    onClick={() => handlePrint('list')}
                    disabled={students.length === 0}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Print List ({students.length})
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedClassId('all');
                      setSelectedSectionId('all');
                      setSearchTerm('');
                      setStudents([]);
                      setTotalStudents(0);
                      setShowResultsTable(false);
                    }}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Clear Filters
                  </Button>
                </div>

                {/* Results Table */}
                {showResultsTable && (
                  <>
                    {students.length > 0 && (
                      <div className="mt-4 border rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader className="bg-gray-50 dark:bg-gray-800">
                              <TableRow>
                                <TableHead className="w-[40px]">SL</TableHead>
                                <TableHead className="w-[50px]">Photo</TableHead>
                                <TableHead className="w-[100px]">Student ID</TableHead>
                                <TableHead className="w-[90px]">Admission Date</TableHead>
                                <TableHead className="w-[60px]">Roll</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Father's Name</TableHead>
                                <TableHead>Mother's Name</TableHead>
                                <TableHead className="w-[70px]">Class</TableHead>
                                <TableHead className="w-[70px]">Section</TableHead>
                                <TableHead>Village</TableHead>
                                <TableHead className="w-[100px]">Contact</TableHead>
                                <TableHead className="w-[90px]">DOB</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {students.map((student, index) => (
                                <TableRow key={student.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                  <TableCell>{index + 1}</TableCell>
                                  <TableCell>
                                    {student.student_photo_url ? (
                                      <Avatar className="h-8 w-8">
                                        <AvatarImage src={student.student_photo_url} />
                                        <AvatarFallback>{student.name?.charAt(0) || 'S'}</AvatarFallback>
                                      </Avatar>
                                    ) : (
                                      <Avatar className="h-8 w-8 bg-gray-200">
                                        <AvatarFallback className="text-xs text-gray-500">📷</AvatarFallback>
                                      </Avatar>
                                    )}
                                  </TableCell>
                                  <TableCell className="font-medium">{student.student_id}</TableCell>
                                  <TableCell>{student.admission_date || '-'}</TableCell>
                                  <TableCell>{student.class_roll || '-'}</TableCell>
                                  <TableCell>{student.name}</TableCell>
                                  <TableCell>{student.father_name}</TableCell>
                                  <TableCell>{student.mother_name}</TableCell>
                                  <TableCell>{getClassDisplay(student)}</TableCell>
                                  <TableCell>{getSectionDisplay(student)}</TableCell>
                                  <TableCell>{student.village || '-'}</TableCell>
                                  <TableCell>{student.contact}</TableCell>
                                  <TableCell>{student.dob}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        <div className="p-2 text-sm text-gray-500 bg-gray-50 dark:bg-gray-800/50 border-t">
                          {totalStudents} student(s) found
                        </div>
                      </div>
                    )}

                    {!loadingStudents && students.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        <AlertCircle className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                        <p>No students found. Try adjusting your filters.</p>
                      </div>
                    )}
                  </>
                )}

                {loadingStudents && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 2: Admission Form - Direct Print (No Preview) */}
          <TabsContent value="admission-form">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-indigo-500" />
                  Print Admission Form
                </CardTitle>
                <CardDescription>
                  Search and directly print admission form (No Preview)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <Label>Smart Search</Label>
                    <Input
                      placeholder="Search by Student ID, Roll, Name, Father's Name or Contact..."
                      value={admissionSearchValue}
                      onChange={(e) => setAdmissionSearchValue(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSmartSearch()}
                      className="bg-white border text-base py-3"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      onClick={handleSmartSearch}
                      disabled={loading}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3"
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4 mr-2" />
                      )}
                      Search
                    </Button>
                  </div>
                </div>

                <div className="text-sm text-gray-500">
                  <p>Search by <strong>Student ID</strong>, <strong>Roll Number</strong>, <strong>Name</strong>, <strong>Father's Name</strong> or <strong>Contact Number</strong>.</p>
                </div>

                {/* Search Results Table with Print Button */}
                {searchResults.length > 0 && (
                  <div className="mt-4 border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader className="bg-gray-50 dark:bg-gray-800">
                        <TableRow>
                          <TableHead className="w-[100px]">Student ID</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Father's Name</TableHead>
                          <TableHead className="w-[80px]">Roll</TableHead>
                          <TableHead className="w-[120px]">Contact</TableHead>
                          <TableHead className="w-[130px] text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {searchResults.map((student) => (
                          <TableRow key={student.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                            <TableCell className="font-medium">{student.student_id}</TableCell>
                            <TableCell>{student.name}</TableCell>
                            <TableCell>{student.father_name}</TableCell>
                            <TableCell>{student.class_roll || '-'}</TableCell>
                            <TableCell>{student.contact}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                onClick={() => printAdmissionFormDirect(student)}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                              >
                                <Printer className="h-3 w-3 mr-1" />
                                Print
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="p-2 text-sm text-gray-500 bg-gray-50 dark:bg-gray-800/50 border-t flex justify-between items-center">
                      <span>{searchResults.length} student(s) found</span>
                      <Button
                        onClick={() => {
                          if (searchResults.length === 1) {
                            printAdmissionFormDirect(searchResults[0]);
                          } else {
                            addToast({ type: "warning", title: "Please select a specific student" });
                          }
                        }}
                        variant="outline"
                        size="sm"
                        className="border-indigo-300 text-indigo-600 hover:bg-indigo-50"
                      >
                        <Printer className="h-3 w-3 mr-1" />
                        Print All
                      </Button>
                    </div>
                  </div>
                )}

                {searchResults.length === 0 && admissionSearchValue && !loading && (
                  <div className="text-center py-8 text-gray-500">
                    <AlertCircle className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                    <p>No students found matching your search.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 3: Blank Form */}
          <TabsContent value="blank-form">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Printer className="h-5 w-5 text-purple-500" />
                  Print Blank Admission Form
                </CardTitle>
                <CardDescription>
                  Print empty admission forms for offline use
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-center bg-white">
                  <Printer className="h-16 w-16 mx-auto text-gray-400" />
                  <h3 className="text-xl font-medium mt-4 text-gray-900 dark:text-white">Blank Admission Form</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    Print empty admission forms with all fields for manual filling
                  </p>
                  <Button
                    onClick={() => handlePrint('blank-form')}
                    className="mt-6 bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 text-base"
                  >
                    <Printer className="h-5 w-5 mr-3" />
                    Print Blank Form
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ResponsiveLayout>
  );
}
