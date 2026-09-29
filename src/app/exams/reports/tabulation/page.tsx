'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ResponsiveLayout } from "@/components/layout/responsive-layout";
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Loader2,
  Search,
  RefreshCw,
  FileSpreadsheet,
  Printer,
  ChevronLeft,
  ChevronRight,
  School,
  Users,
  Trophy,
  Award,
  Filter,
  UserCheck,
  UserX,
  GraduationCap,
  AlertTriangle,
  Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import * as XLSX from 'xlsx';
import { getSchoolPrintHeader } from '@/components/print/SchoolPrintHeader';

// ============================================
// TYPES SECTION
// ============================================

interface ExamTerm {
  id: string;
  name: string;
  result_status?: string;
}

interface ClassItem {
  id: string;
  name: string;
  numeric_order?: number;
}

interface Section {
  id: string;
  name: string;
  class_id: string;
}

interface Subject {
  id: string;
  name: string;
  full_marks: number;
  pass_marks: number;
}

interface SubjectMark {
  subject_name: string;
  subject_type: string;
  full_marks: number;
  marks_obtained: number;
  pass_marks: number;
  percentage: number;
  is_absent: boolean;
  is_passed: boolean;
  grade: string;
  grade_point: number;
  highest_marks: number;
}

interface TabulationResult {
   student_id: string;
   class_roll: string;
   student_name: string;
   father_name: string;
   mother_name: string;
   admission_no: string;
   photo_url: string | null;
   subjects: SubjectMark[];
   total_marks_obtained: number;
   total_full_marks: number;
   percentage: number;
   gpa: number;
   letter_grade: string;
   section_rank: number;
   class_rank: number;
   pass_fail_status: string;
   failed_subjects: any[];
 }

interface TabulationPrintSettings {
  show_serial: boolean;
  show_photo: boolean;
  show_roll: boolean;
  show_admission_no: boolean;
  show_father_name: boolean;
  show_mother_name: boolean;
  show_total_marks: boolean;
  show_percentage: boolean;
  show_class_rank: boolean;
  show_section_rank: boolean;
  show_remarks: boolean;
  paper_size: 'A4' | 'Letter' | 'Legal';
  orientation: 'portrait' | 'landscape';
  font_size: 'small' | 'normal' | 'large';
}

interface SchoolInfo {
  school_logo: string | null;
  school_name: string;
  school_address: string;
  school_phone: string;
  school_email: string;
  footer_text: string;
  signature_principal: string;
  signature_teacher: string;
  show_signature: boolean;
  show_grade_distribution: boolean;
}

interface GradeDistribution {
  grade: string;
  count: number;
}

// ============================================
// CONSTANTS SECTION
// ============================================

const DEFAULT_TABULATION_SETTINGS: TabulationPrintSettings = {
  show_serial: true,
  show_photo: true,
  show_roll: true,
  show_admission_no: true,
  show_father_name: true,
  show_mother_name: true,
  show_total_marks: true,
  show_percentage: true,
  show_class_rank: true,
  show_section_rank: true,
  show_remarks: false,
  paper_size: 'A4',
  orientation: 'landscape',
  font_size: 'normal'
};

const GRADE_ORDER = ['A+', 'A', 'A-', 'B', 'C', 'D', 'F'] as const;

// ============================================
// HELPER FUNCTIONS
// ============================================

const getGradeColor = (grade: string): string => {
  const colorMap: Record<string, string> = {
    'A+': 'text-green-600 dark:text-green-400',
    'A': 'text-emerald-600 dark:text-emerald-400',
    'A-': 'text-teal-600 dark:text-teal-400',
    'B': 'text-blue-600 dark:text-blue-400',
    'C': 'text-cyan-600 dark:text-cyan-400',
    'D': 'text-yellow-600 dark:text-yellow-400',
    'F': 'text-red-600 dark:text-red-400',
  };
  return colorMap[grade] || 'text-gray-600 dark:text-gray-400';
};

const getStatusBadge = (status: string) => {
  const statusMap: Record<string, { className: string; label: string }> = {
    'Passed': { className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', label: 'Passed' },
    'Failed': { className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', label: 'Failed' },
    'Failed (Absent)': { className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', label: 'Failed (Absent)' },
  };
  
  const config = statusMap[status];
  if (config) {
    return <Badge className={config.className}>{config.label}</Badge>;
  }
  return <Badge variant="outline">{status}</Badge>;
};

const getSubjectMarkFromSubjects = (subjects: any[], subjectName: string): string => {
  if (!subjects || !Array.isArray(subjects)) return '-';
  const subject = subjects.find(s => s.subject_name === subjectName);
  return subject?.marks_obtained !== undefined ? subject.marks_obtained.toString() : '-';
};

// ============================================
// DATA LAYER
// ============================================

const supabase = createClient();

async function fetchAcademicYearId(): Promise<string | null> {
  const { data: currentYear } = await supabase
    .from('academic_years')
    .select('id')
    .eq('is_current', true)
    .maybeSingle();

  if (currentYear) return currentYear.id;

  const { data: activeYear } = await supabase
    .from('academic_years')
    .select('id')
    .eq('is_active', true)
    .maybeSingle();

  if (activeYear) return activeYear.id;

  const { data: anyYear } = await supabase
    .from('academic_years')
    .select('id')
    .limit(1)
    .maybeSingle();

  return anyYear?.id || null;
}

async function fetchPrintSettings(academicYearId: string): Promise<TabulationPrintSettings | null> {
  const { data, error } = await supabase
    .from('exam_settings_new')
    .select('setting_value')
    .eq('setting_key', 'print_settings')
    .eq('academic_year_id', academicYearId)
    .maybeSingle();

  if (error || !data?.setting_value) return null;
  
  const settings = data.setting_value;
  return settings.tabulation ? { ...DEFAULT_TABULATION_SETTINGS, ...settings.tabulation } : null;
}

async function fetchSchoolInfo(): Promise<SchoolInfo | null> {
  const { data } = await supabase
    .from('school_settings')
    .select('school_name, school_address, school_phone, school_email, school_logo')
    .single();
  
  if (!data) return null;
  
  return {
    school_logo: data.school_logo,
    school_name: data.school_name || 'শাপলা আলী মেমেরীয়াল একাডেমী',
    school_address: data.school_address || 'নাওতলা, মাধাইয়া, চান্দিনা, কুমিল্লা',
    school_phone: data.school_phone || '০১৯২৩২৫৩৪৫৪',
    school_email: data.school_email || 'shapla.kindergarten@gmail.com',
    footer_text: 'Generated by Kindergarten ERP',
    signature_principal: 'Principal',
    signature_teacher: 'Class Teacher',
    show_signature: true,
    show_grade_distribution: false,
  };
}

async function fetchTermsAndClasses() {
  const [termsRes, classesRes] = await Promise.all([
    supabase.from('exam_terms').select('id, name, result_status').order('created_at'),
    supabase.from('classes').select('id, name, numeric_order').order('numeric_order')
  ]);
  
  return {
    terms: termsRes.data as ExamTerm[] || [],
    classes: classesRes.data as ClassItem[] || []
  };
}

async function fetchSections(classId: string): Promise<Section[]> {
  if (!classId) return [];
  const { data } = await supabase
    .from('sections')
    .select('id, name, class_id')
    .eq('class_id', classId);
  return data as Section[] || [];
}

async function checkResultPublished(termId: string): Promise<boolean> {
  const { data } = await supabase
    .from('exam_terms')
    .select('result_status')
    .eq('id', termId)
    .single();
  return data?.result_status === 'published';
}

async function fetchTabulationData(
  termId: string, 
  classId: string, 
  sectionId: string | null
): Promise<TabulationResult[]> {
  try {
    console.log('Fetching tabulation data with:', { termId, classId, sectionId });
    
    const { data, error } = await supabase
      .rpc('get_tabulation_sheet', {
        p_term_id: termId,
        p_class_id: classId,
        p_section_id: sectionId
      });
    
    if (error) {
      console.error('RPC Error Details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        name: error.name
      });
      throw error;
    }
    
    console.log('Tabulation data received:', data?.length || 0, 'records');
    return data || [];
  } catch (error: any) {
    console.error('Full RPC Error:', {
      code: error?.code,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      name: error?.name
    });
    throw error;
  }
}

async function fetchSubjectsForTerm(termId: string, classId: string): Promise<Subject[]> {
  const { data } = await supabase
    .from('exam_subjects')
    .select(`
      id,
      full_marks,
      pass_marks,
      subject_id,
      subjects!inner (name)
    `)
    .eq('term_id', termId)
    .eq('class_id', classId);
  
  return (data || []).map((s: any) => ({
    id: s.id,
    name: s.subjects?.name || 'Unknown',
    full_marks: s.full_marks,
    pass_marks: s.pass_marks
  }));
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function TabulationSheetPage() {
  // ===== State =====
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [printing, setPrinting] = useState(false);
  
  const [terms, setTerms] = useState<ExamTerm[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedTerm, setSelectedTerm] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<string>('');
  
  const [tabulationData, setTabulationData] = useState<TabulationResult[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isPublished, setIsPublished] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [printSettings, setPrintSettings] = useState<TabulationPrintSettings>(DEFAULT_TABULATION_SETTINGS);
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // ===== Derived State (Memoized) =====
  
const filteredData = useMemo(() => {
     if (searchQuery.trim() === '') return tabulationData;
     
     const query = searchQuery.toLowerCase();
     return tabulationData.filter(s => 
       s.student_name.toLowerCase().includes(query) ||
       (s.class_roll && s.class_roll.toLowerCase().includes(query)) ||
       (s.father_name && s.father_name.toLowerCase().includes(query)) ||
       (s.admission_no && s.admission_no.toLowerCase().includes(query))
     );
   }, [tabulationData, searchQuery]);
  
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage]);
  
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const needsSelection = !selectedTerm || !selectedClass || !selectedSection;
  
  const totalStudents = filteredData.length;
  
  const passedCount = useMemo(() => 
    filteredData.filter(s => s.pass_fail_status === 'Passed').length,
    [filteredData]
  );
  
  const failedCount = useMemo(() => 
    filteredData.filter(s => s.pass_fail_status === 'Failed' || s.pass_fail_status === 'Failed (Absent)').length,
    [filteredData]
  );
  
  const aPlusCount = useMemo(() => 
    filteredData.filter(s => s.letter_grade === 'A+').length,
    [filteredData]
  );
  
  const gradeDistribution: GradeDistribution[] = useMemo(() => {
    return GRADE_ORDER.map(grade => ({
      grade,
      count: filteredData.filter(s => s.letter_grade === grade).length
    }));
  }, [filteredData]);
  
  const top3Students = useMemo(() => 
    [...filteredData]
      .filter(s => s.class_rank !== null && s.class_rank !== 0)
      .sort((a, b) => (a.class_rank || 999) - (b.class_rank || 999))
      .slice(0, 3),
    [filteredData]
  );

  // ===== Data Loading Functions =====
  
  const loadInitialData = useCallback(async () => {
    try {
      const [academicYearId, school, { terms: termsData, classes: classesData }] = await Promise.all([
        fetchAcademicYearId(),
        fetchSchoolInfo(),
        fetchTermsAndClasses()
      ]);
      
      setTerms(termsData);
      setClasses(classesData);
      
      if (school) setSchoolInfo(school);
      
      if (academicYearId) {
        const settings = await fetchPrintSettings(academicYearId);
        if (settings) setPrintSettings(settings);
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
      toast.error('Failed to load initial data');
    } finally {
      setInitialLoad(false);
    }
  }, []);
  
  const loadTabulationData = useCallback(async () => {
    if (!selectedTerm || !selectedClass || !selectedSection) return;
    
    setLoading(true);
    
    try {
      const published = await checkResultPublished(selectedTerm);
      setIsPublished(published);
      
      if (!published) {
        setTabulationData([]);
        setSubjects([]);
        toast.warning('Result not published yet');
        return;
      }
      
      const [subjectList, tabulationResults] = await Promise.all([
        fetchSubjectsForTerm(selectedTerm, selectedClass),
        fetchTabulationData(selectedTerm, selectedClass, selectedSection)
      ]);
      
      setSubjects(subjectList);
      setTabulationData(tabulationResults);
      setCurrentPage(1);
      
      if (tabulationResults.length === 0) {
        toast.info('No tabulation data found');
      } else {
        toast.success(`Loaded ${tabulationResults.length} students`);
      }
      
    } catch (error: any) {
      console.error('Error loading tabulation data:', {
        code: error?.code,
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        name: error?.name
      });
      toast.error(error?.message || 'Failed to load tabulation data');
      setTabulationData([]);
    } finally {
      setLoading(false);
    }
  }, [selectedTerm, selectedClass, selectedSection]);
  
  const loadSectionsForClass = useCallback(async () => {
    if (!selectedClass) {
      setSections([]);
      return;
    }
    const sectionsData = await fetchSections(selectedClass);
    setSections(sectionsData);
  }, [selectedClass]);
  
  // ===== Effects =====
  
  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);
  
  useEffect(() => {
    loadSectionsForClass();
  }, [loadSectionsForClass]);
  
  useEffect(() => {
    if (selectedTerm && selectedClass && selectedSection) {
      loadTabulationData();
    } else {
      setTabulationData([]);
      setSubjects([]);
      setIsPublished(false);
    }
  }, [selectedTerm, selectedClass, selectedSection, loadTabulationData]);
  
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);
  
  // ===== Handlers =====
  
  const handleRefresh = () => {
    if (selectedTerm && selectedClass && selectedSection) {
      loadTabulationData();
    }
  };
  
  // ===== Export Logic =====
  
  const buildExportRows = useCallback(() => {
    const settings = printSettings;
    return filteredData.map((student, index) => {
      const row: any = {};
      
      if (settings.show_serial) row['SL'] = index + 1;
      if (settings.show_roll) row['Roll'] = student.class_roll;
      if (settings.show_admission_no) row['Admission No'] = student.admission_no;
      row['Student Name'] = student.student_name;
      if (settings.show_father_name) row["Father's Name"] = student.father_name;
      if (settings.show_mother_name) row["Mother's Name"] = student.mother_name;
      
      if (student.subjects && Array.isArray(student.subjects)) {
        student.subjects.forEach((subject: any) => {
          row[subject.subject_name] = subject.marks_obtained;
        });
      }
      
      if (settings.show_total_marks) row['Total Marks'] = student.total_marks_obtained;
      if (settings.show_percentage) row['Percentage'] = student.percentage.toFixed(2);
      row['GPA'] = student.gpa.toFixed(2);
      row['Grade'] = student.letter_grade;
      row['Result Status'] = student.pass_fail_status;
      if (settings.show_class_rank) row['Class Rank'] = student.class_rank || '-';
      if (settings.show_section_rank) row['Section Rank'] = student.section_rank || '-';
      if (settings.show_remarks) row['Remarks'] = '';
      
      return row;
    });
  }, [filteredData, printSettings]);
  
  const exportToExcel = () => {
    setExporting(true);
    try {
      const exportData = buildExportRows();
      const ws = XLSX.utils.json_to_sheet(exportData);
      
      const maxWidth = 20;
      ws['!cols'] = Object.keys(exportData[0] || {}).map(() => ({ wch: maxWidth }));
      
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Tabulation Sheet');
      
      const termName = terms.find(t => t.id === selectedTerm)?.name || '';
      const className = classes.find(c => c.id === selectedClass)?.name || '';
      const sectionName = sections.find(s => s.id === selectedSection)?.name || '';
      
      XLSX.writeFile(wb, `Tabulation_${termName}_${className}_${sectionName}.xlsx`);
      toast.success('Exported to Excel successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export');
    } finally {
      setExporting(false);
    }
  };
  
  // ===== Print Logic - সম্পূর্ণ সংশোধিত =====

  const buildPrintHTML = useCallback(() => {
    const settings = printSettings;
    const orientation = settings.orientation;
    const fontSize = settings.font_size;
    
    let fontSizeStyle = '';
    switch (fontSize) {
      case 'small': fontSizeStyle = '8px'; break;
      case 'normal': fontSizeStyle = '10px'; break;
      case 'large': fontSizeStyle = '12px'; break;
    }
    
    const termName = terms.find(t => t.id === selectedTerm)?.name || '';
    const className = classes.find(c => c.id === selectedClass)?.name || '';
    const sectionName = sections.find(s => s.id === selectedSection)?.name || '';
    
    // স্কুল হেডার
    const schoolHeader = schoolInfo ? getSchoolPrintHeader(
      { 
        school_logo: schoolInfo.school_logo, 
        school_name: schoolInfo.school_name, 
        school_address: schoolInfo.school_address, 
        school_phone: schoolInfo.school_phone, 
        school_email: schoolInfo.school_email 
      },
      "TABULATION SHEET - " + termName
    ) : '';
    
    const renderTableRows = () => {
      return filteredData.map((student, idx) => {
        const subjectCells = subjects.map(s => 
          `<td style="border:1px solid #000;padding:3px;text-align:center;font-size:${fontSizeStyle}">${getSubjectMarkFromSubjects(student.subjects, s.name)}</td>`
        ).join('');
        
        return `
          <tr>
            ${settings.show_serial ? `<td style="border:1px solid #000;padding:3px;text-align:center;font-size:${fontSizeStyle}">${idx + 1}</td>` : ''}
            ${settings.show_roll ? `<td style="border:1px solid #000;padding:3px;text-align:center;font-size:${fontSizeStyle}">${student.class_roll || '-'}</td>` : ''}
            ${settings.show_admission_no ? `<td style="border:1px solid #000;padding:3px;text-align:center;font-size:${fontSizeStyle}">${student.admission_no || '-'}</td>` : ''}
            <td style="border:1px solid #000;padding:3px;text-align:left;font-size:${fontSizeStyle};font-weight:bold;">${student.student_name}</td>
            ${settings.show_father_name ? `<td style="border:1px solid #000;padding:3px;text-align:left;font-size:${fontSizeStyle}">${student.father_name || '-'}</td>` : ''}
            ${settings.show_mother_name ? `<td style="border:1px solid #000;padding:3px;text-align:left;font-size:${fontSizeStyle}">${student.mother_name || '-'}</td>` : ''}
            ${subjectCells}
            ${settings.show_total_marks ? `<td style="border:1px solid #000;padding:3px;text-align:center;font-size:${fontSizeStyle};font-weight:bold;">${student.total_marks_obtained}</td>` : ''}
            ${settings.show_percentage ? `<td style="border:1px solid #000;padding:3px;text-align:center;font-size:${fontSizeStyle}">${student.percentage.toFixed(1)}%</td>` : ''}
            <td style="border:1px solid #000;padding:3px;text-align:center;font-size:${fontSizeStyle};font-weight:bold;">${student.gpa.toFixed(2)}</td>
            <td style="border:1px solid #000;padding:3px;text-align:center;font-size:${fontSizeStyle};font-weight:bold;color:${getGradeColor(student.letter_grade)}">${student.letter_grade}</td>
            <td style="border:1px solid #000;padding:3px;text-align:center;font-size:${fontSizeStyle};font-weight:bold;color:${student.pass_fail_status === 'Passed' ? 'green' : 'red'}">${student.pass_fail_status}</td>
            ${settings.show_class_rank ? `<td style="border:1px solid #000;padding:3px;text-align:center;font-size:${fontSizeStyle}">${student.class_rank || '-'}</td>` : ''}
            ${settings.show_section_rank ? `<td style="border:1px solid #000;padding:3px;text-align:center;font-size:${fontSizeStyle}">${student.section_rank || '-'}</td>` : ''}
            ${settings.show_remarks ? `<td style="border:1px solid #000;padding:3px;text-align:center;font-size:${fontSizeStyle}">-</td>` : ''}
          </tr>
        `;
      }).join('');
    };
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Tabulation Sheet - ${termName}</title>
          <style>
            @page { 
              size: ${orientation === 'landscape' ? 'landscape' : 'portrait'}; 
              margin: 8mm;
            }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: 'Times New Roman', Arial, sans-serif; 
              background: white; 
              padding: 5px; 
              font-size: ${fontSizeStyle};
            }
            .print-container { width: 100%; }
            
            /* Class Info - Class: Play | Section: A */
            .class-info { 
              font-size: 12px; 
              font-weight: bold; 
              text-align: center; 
              margin: 5px 0 8px 0;
              padding: 4px;
              border-bottom: 1px solid #ccc;
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              font-size: ${fontSizeStyle}; 
              margin-top: 8px;
            }
            th, td { 
              border: 1px solid #000; 
              padding: 3px; 
              text-align: center; 
            }
            th { 
              background-color: #e0e0e0; 
              font-weight: bold; 
              font-size: ${fontSizeStyle};
            }
            
            /* স্বাক্ষর সেকশন - ১টি করে দাগ */
            .signatures-container {
              display: flex;
              justify-content: space-between;
              margin-top: 50px;
              padding: 0 20px;
            }
            .signature-block {
              text-align: center;
              width: 180px;
              font-size: 11px;
              font-weight: bold;
            }
            .signature-line {
              border-top: 1px solid #000;
              padding-top: 8px;
              margin-top: 30px;
              width: 100%;
            }
            .signature-label {
              margin-top: 6px;
              font-size: 10px;
              font-weight: normal;
            }
            
            .footer {
              margin-top: 20px;
              font-size: 9px;
              text-align: center;
              border-top: 2px solid #000;
              padding-top: 8px;
            }
          </style>
        </head>
        <body>
          <div class="print-container">
            ${schoolHeader}
            
            <!-- Class: Play | Section: A -->
            <div class="class-info">
              Class: ${className} &nbsp;|&nbsp; Section: ${sectionName}
            </div>
            
            <table>
              <thead>
                <tr>
                  ${settings.show_serial ? '<th>SL</th>' : ''}
                  ${settings.show_roll ? '<th>Roll</th>' : ''}
                  ${settings.show_admission_no ? '<th>Adm No</th>' : ''}
                  <th style="text-align:left;padding-left:4px;">Student Name</th>
                  ${settings.show_father_name ? '<th style="text-align:left;padding-left:4px;">Father\'s Name</th>' : ''}
                  ${settings.show_mother_name ? '<th style="text-align:left;padding-left:4px;">Mother\'s Name</th>' : ''}
                  ${subjects.map(s => `<th>${s.name}</th>`).join('')}
                  ${settings.show_total_marks ? '<th>Total</th>' : ''}
                  ${settings.show_percentage ? '<th>%</th>' : ''}
                  <th>GPA</th>
                  <th>Grade</th>
                  <th>Status</th>
                  ${settings.show_class_rank ? '<th>Class Rank</th>' : ''}
                  ${settings.show_section_rank ? '<th>Section Rank</th>' : ''}
                  ${settings.show_remarks ? '<th>Remarks</th>' : ''}
                </tr>
              </thead>
              <tbody>
                ${renderTableRows()}
              </tbody>
            </table>
            
            <!-- স্বাক্ষর - ১টি করে দাগ -->
            <div class="signatures-container">
              <div class="signature-block">
                <div class="signature-line"></div>
                <div class="signature-label">Class Teacher</div>
              </div>
              <div class="signature-block">
                <div class="signature-line"></div>
                <div class="signature-label">Principal</div>
              </div>
              <div class="signature-block">
                <div class="signature-line"></div>
                <div class="signature-label">Guardian's Signature</div>
              </div>
            </div>
            
            <!-- Footer - স্কুলের নাম সহ -->
            <div class="footer">
              Generated by ${schoolInfo?.school_name || 'Kindergarten ERP'}
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
            window.onafterprint = function() {
              window.close();
            };
          <\/script>
        </body>
      </html>
    `;
  }, [printSettings, schoolInfo, filteredData, subjects, terms, classes, sections, selectedTerm, selectedClass, selectedSection]);
  
  const handlePrint = () => {
    if (filteredData.length === 0) {
      toast.error('No data to print');
      return;
    }
    
    setPrinting(true);
    
    const printHTML = buildPrintHTML();
    const printWindow = window.open('', '_blank', 'width=1200,height=800,toolbar=yes,scrollbars=yes,menubar=yes');
    
    if (printWindow) {
      printWindow.document.write(printHTML);
      printWindow.document.close();
      printWindow.focus();
      setPrinting(false);
    } else {
      setPrinting(false);
      toast.error('Please allow popups for this site');
    }
  };
  
  // ===== Render Helpers =====
  
  const renderNotPublishedWarning = () => (
    <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20">
      <CardContent className="p-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-14 w-14 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
            <AlertTriangle className="h-7 w-7 text-yellow-600 dark:text-yellow-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-300">Result Not Published Yet</h3>
            <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
              Please publish the results from the Publish page before viewing the tabulation sheet.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
  
  // ===== Initial Loading =====
  
  if (initialLoad) {
    return (
      <ResponsiveLayout>
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
        </div>
      </ResponsiveLayout>
    );
  }
  
  // ===== Main Render =====
  
  return (
    <ResponsiveLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-700 rounded-xl p-4 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-white/20 rounded-lg flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Tabulation Sheet</h1>
              <p className="text-white/80 text-xs">Subject-wise marks summary with grade & rank</p>
            </div>
          </div>
          {!needsSelection && isPublished && filteredData.length > 0 && (
            <div className="flex gap-2">
              <Button onClick={exportToExcel} disabled={exporting} size="sm" variant="secondary" className="h-8 bg-white/20 hover:bg-white/30 text-white border-0">
                <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />
                Excel
              </Button>
              <Button onClick={handlePrint} disabled={printing} size="sm" variant="secondary" className="h-8 bg-white/20 hover:bg-white/30 text-white border-0">
                {printing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Printer className="mr-1.5 h-3.5 w-3.5" />}
                Print
              </Button>
            </div>
          )}
        </div>
        
        {/* Current Settings Info */}
        <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-2 px-3 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2">
            <Eye className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            <span className="text-xs text-blue-700 dark:text-blue-300">
              Current print layout: {printSettings.orientation}, {printSettings.paper_size}, Font: {printSettings.font_size}
            </span>
          </div>
        </div>
        
        {/* Filters */}
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
            <Filter className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            <span className="font-medium text-gray-700 dark:text-gray-300 text-sm">Filter Options</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Exam Term</Label>
              <Select value={selectedTerm} onValueChange={setSelectedTerm}>
                <SelectTrigger className="h-9 text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                  <SelectValue placeholder="Select term" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 max-h-[250px] overflow-y-auto">
                  {terms.map((term) => (
                    <SelectItem key={term.id} value={term.id} className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700">
                      {term.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Class</Label>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger className="h-9 text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 max-h-[250px] overflow-y-auto">
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id} className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700">
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Section</Label>
              <Select 
                value={selectedSection} 
                onValueChange={setSelectedSection}
                disabled={!selectedClass}
              >
                <SelectTrigger className="h-9 text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                  <SelectValue placeholder={sections.length === 0 ? "No sections" : "Select section"} />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 max-h-[250px] overflow-y-auto">
                  {sections.map((section) => (
                    <SelectItem key={section.id} value={section.id} className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700">
                      {section.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button
                onClick={handleRefresh}
                disabled={loading || needsSelection}
                className="flex-1 h-9 bg-indigo-600 hover:bg-indigo-700 text-white text-sm"
              >
                <RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                Show Result
              </Button>
            </div>
          </div>
        </div>
        
        {/* Loading */}
        {loading && needsSelection === false && (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
            <span className="ml-2 text-sm text-gray-500">Loading tabulation data...</span>
          </div>
        )}
        
        {/* No Selection */}
        {!loading && needsSelection && (
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-8 text-center border border-gray-200">
            <School className="h-12 w-12 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Select Term, Class and Section to view tabulation sheet</p>
          </div>
        )}
        
        {/* Not Published Warning */}
        {!loading && !needsSelection && !isPublished && renderNotPublishedWarning()}
        
        {/* Main Content */}
        {!loading && !needsSelection && isPublished && filteredData.length > 0 && (
          <>
            {/* UI Stats Cards - শুধুমাত্র UI তে দেখাবে, প্রিন্টে নয় */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-2 text-white shadow">
                <div className="flex items-center justify-between">
                  <Users className="h-4 w-4 opacity-80" />
                  <span className="text-lg font-bold">{totalStudents}</span>
                </div>
                <p className="text-[10px] opacity-90">Total Students</p>
              </div>
              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-2 text-white shadow">
                <div className="flex items-center justify-between">
                  <UserCheck className="h-4 w-4 opacity-80" />
                  <span className="text-lg font-bold">{passedCount}</span>
                </div>
                <p className="text-[10px] opacity-90">Passed</p>
              </div>
              <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg p-2 text-white shadow">
                <div className="flex items-center justify-between">
                  <UserX className="h-4 w-4 opacity-80" />
                  <span className="text-lg font-bold">{failedCount}</span>
                </div>
                <p className="text-[10px] opacity-90">Failed</p>
              </div>
              <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg p-2 text-white shadow">
                <div className="flex items-center justify-between">
                  <Award className="h-4 w-4 opacity-80" />
                  <span className="text-lg font-bold">{aPlusCount}</span>
                </div>
                <p className="text-[10px] opacity-90">A+ Achievers</p>
              </div>
            </div>
            
            {/* Search */}
            <div className="relative max-w-xs">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <Input 
                placeholder="Search by name, roll, father's name..." 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                className="pl-8 h-9 text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600" 
              />
            </div>
            
            {/* Main Table */}
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-100 dark:bg-gray-800">
                    {printSettings.show_serial && <TableHead className="w-12 text-center text-xs">SL</TableHead>}
                    {printSettings.show_photo && <TableHead className="w-14 text-center text-xs">Photo</TableHead>}
                    {printSettings.show_roll && <TableHead className="w-20 text-xs">Roll</TableHead>}
                    {printSettings.show_admission_no && <TableHead className="w-24 text-xs">Admission No</TableHead>}
                    <TableHead className="text-xs min-w-[120px]">Student Name</TableHead>
                    {printSettings.show_father_name && <TableHead className="text-xs min-w-[100px]">Father's Name</TableHead>}
                    {printSettings.show_mother_name && <TableHead className="text-xs min-w-[100px]">Mother's Name</TableHead>}
                    {subjects.map(s => (<TableHead key={s.id} className="text-center min-w-[60px] text-xs">{s.name}</TableHead>))}
                    {printSettings.show_total_marks && <TableHead className="text-center text-xs">Total</TableHead>}
                    {printSettings.show_percentage && <TableHead className="text-center text-xs">%</TableHead>}
                    <TableHead className="text-center text-xs">GPA</TableHead>
                    <TableHead className="text-center text-xs">Grade</TableHead>
                    <TableHead className="text-center text-xs">Status</TableHead>
                    {printSettings.show_class_rank && <TableHead className="text-center text-xs">Class Rank</TableHead>}
                    {printSettings.show_section_rank && <TableHead className="text-center text-xs">Section Rank</TableHead>}
                    {printSettings.show_remarks && <TableHead className="text-center text-xs">Remarks</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.map((student, idx) => (
                    <TableRow key={student.student_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      {printSettings.show_serial && <TableCell className="text-center text-sm">{(currentPage - 1) * itemsPerPage + idx + 1}</TableCell>}
                      {printSettings.show_photo && (
                        <TableCell className="text-center">
                          <Avatar className="h-7 w-7 mx-auto">
                            <AvatarImage src={student.photo_url || undefined} />
                            <AvatarFallback className="text-xs bg-gray-200 dark:bg-gray-700">{student.student_name?.charAt(0) || '?'}</AvatarFallback>
                          </Avatar>
                        </TableCell>
                      )}
                      {printSettings.show_roll && <TableCell className="font-mono text-sm dark:text-gray-300">{student.class_roll || '-'}</TableCell>}
                      {printSettings.show_admission_no && <TableCell className="text-sm dark:text-gray-300">{student.admission_no || '-'}</TableCell>}
                      <TableCell className="text-sm font-medium dark:text-gray-200">{student.student_name}</TableCell>
                      {printSettings.show_father_name && <TableCell className="text-sm dark:text-gray-300">{student.father_name || '-'}</TableCell>}
                      {printSettings.show_mother_name && <TableCell className="text-sm dark:text-gray-300">{student.mother_name || '-'}</TableCell>}
                      {subjects.map(s => (
                        <TableCell key={s.id} className="text-center text-sm dark:text-gray-300">
                          {getSubjectMarkFromSubjects(student.subjects, s.name)}
                        </TableCell>
                      ))}
                      {printSettings.show_total_marks && <TableCell className="text-center font-bold text-sm dark:text-gray-200">{student.total_marks_obtained}</TableCell>}
                      {printSettings.show_percentage && <TableCell className="text-center text-sm dark:text-gray-300">{student.percentage.toFixed(1)}%</TableCell>}
                      <TableCell className="text-center font-semibold text-sm dark:text-gray-200">{student.gpa.toFixed(2)}</TableCell>
                      <TableCell className={`text-center text-sm font-semibold ${getGradeColor(student.letter_grade)}`}>{student.letter_grade}</TableCell>
                      <TableCell className="text-center text-sm">{getStatusBadge(student.pass_fail_status)}</TableCell>
                      {printSettings.show_class_rank && <TableCell className="text-center text-sm"><span className="text-blue-600 dark:text-blue-400 font-medium">{student.class_rank || '-'}</span></TableCell>}
                      {printSettings.show_section_rank && <TableCell className="text-center text-sm"><span className="text-purple-600 dark:text-purple-400 font-medium">{student.section_rank || '-'}</span></TableCell>}
                      {printSettings.show_remarks && <TableCell className="text-center text-sm">-</TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex flex-wrap justify-between items-center gap-2 mt-3 bg-white dark:bg-gray-900 rounded-lg p-2 shadow-sm border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length}
                </p>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="h-7 w-7 p-0">
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <span className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 rounded-md dark:text-gray-300">
                    {currentPage} / {totalPages}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="h-7 w-7 p-0">
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
        
        {/* No Data */}
        {!loading && !needsSelection && isPublished && filteredData.length === 0 && (
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-8 text-center border border-gray-200 dark:border-gray-700">
            <Users className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No tabulation data found for this selection</p>
            <p className="text-xs text-gray-400 mt-1">Make sure results are published and marks are locked</p>
          </div>
        )}
      </div>
    </ResponsiveLayout>
  );
}
