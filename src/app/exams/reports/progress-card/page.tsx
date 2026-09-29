'use client';

import { useState, useEffect, useCallback } from 'react';
import { ResponsiveLayout } from "@/components/layout/responsive-layout";
import { getSchoolPrintHeader } from '@/components/print/SchoolPrintHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Loader2,
  Printer,
  School,
  Filter,
  GraduationCap,
  AlertTriangle,
  Eye,
  User,
  BookOpen,
  Award,
  Trophy,
  Star,
  Users,
  Heart,
  Sparkles,
  FileText,
  CalendarCheck,
  CalendarX,
  CalendarDays,
  Percent,
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

// ============================================
// TYPES
// ============================================

interface ExamTerm {
  id: string;
  name: string;
  result_status?: string;
  start_date?: string;
  end_date?: string;
}

interface ClassItem {
  id: string;
  name: string;
}

interface Section {
  id: string;
  name: string;
  class_id: string;
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
  id: string;
  class_roll: string;
  student_name: string;
  father_name: string;
  mother_name: string;
  student_id: string;
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
  working_days?: number;
  present_days?: number;
  absent_days?: number;
  attendance_percentage?: number;
}

interface PrintSettings {
  paper_size: 'A4' | 'Letter' | 'Legal';
  orientation: 'portrait' | 'landscape';
  font_size: 'small' | 'normal' | 'large';
  show_photo: boolean;
  show_signature: boolean;
  show_seal: boolean;
  show_grade_distribution: boolean;
  show_attendance_summary: boolean;
  show_rank: boolean;
  show_address: boolean;
  show_parent_contact: boolean;
  show_dob: boolean;
  show_admission_date: boolean;
  show_father_name: boolean;
  show_mother_name: boolean;
}

interface SchoolInfo {
  school_logo: string | null;
  school_name: string;
  school_address: string;
  school_phone: string;
  school_email: string;
  signature_principal: string;
  signature_teacher: string;
}

// ============================================
// DEFAULT SETTINGS
// ============================================

const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  paper_size: 'A4',
  orientation: 'portrait',
  font_size: 'normal',
  show_photo: true,
  show_signature: true,
  show_seal: true,
  show_grade_distribution: true,
  show_attendance_summary: true,
  show_rank: true,
  show_address: false,
  show_parent_contact: true,
  show_dob: true,
  show_admission_date: false,
  show_father_name: true,
  show_mother_name: true
};

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

const getRankSuffix = (rank: number): string => {
  if (rank === 1) return 'st';
  if (rank === 2) return 'nd';
  if (rank === 3) return 'rd';
  return 'th';
};

const safeToFixed = (value: any, digits: number = 2): string => {
  if (value === undefined || value === null || isNaN(value)) {
    return '0.00';
  }
  return Number(value).toFixed(digits);
};

const safeNumber = (value: any): number => {
  if (value === undefined || value === null || isNaN(value)) {
    return 0;
  }
  return Number(value);
};

// ============================================
// DATA FETCHING FUNCTIONS
// ============================================

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

async function fetchSchoolInfo(): Promise<SchoolInfo | null> {
  const { data } = await supabase
    .from('school_settings')
    .select('school_name, school_address, school_phone, school_email, school_logo')
    .single();
  
  if (!data) return null;
  
  return {
    school_logo: data.school_logo,
    school_name: data.school_name || 'School Name',
    school_address: data.school_address || 'School Address',
    school_phone: data.school_phone || '',
    school_email: data.school_email || '',
    signature_principal: 'Principal',
    signature_teacher: 'Class Teacher'
  };
}

async function fetchPrintSettings(academicYearId: string): Promise<PrintSettings | null> {
  const { data, error } = await supabase
    .from('exam_settings_new')
    .select('setting_value')
    .eq('setting_key', 'print_settings')
    .eq('academic_year_id', academicYearId)
    .maybeSingle();

  if (error || !data?.setting_value) return null;
  
  const settings = data.setting_value;
  if (settings.progress_card) {
    return { ...DEFAULT_PRINT_SETTINGS, ...settings.progress_card };
  }
  return DEFAULT_PRINT_SETTINGS;
}

async function fetchTermsAndClasses() {
  const [termsRes, classesRes] = await Promise.all([
    supabase.from('exam_terms').select('id, name, result_status, start_date, end_date').order('created_at'),
    supabase.from('classes').select('id, name').order('numeric_order')
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

async function fetchStudentAttendance(
  studentId: string,
  termId: string,
  classId: string,
  sectionId: string | null
): Promise<{ working_days: number; present_days: number; absent_days: number; percentage: number }> {
  try {
    let studentUUID = studentId;

    if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(studentId)) {
      const { data: studentRecord } = await supabase
        .from('students')
        .select('id')
        .or(`student_id.eq.${studentId},admission_no.eq.${studentId}`)
        .maybeSingle();

      if (studentRecord) {
        studentUUID = studentRecord.id;
      }
    }

    const { data: termData } = await supabase
      .from('exam_terms')
      .select('start_date, end_date, academic_years(start_date, end_date)')
      .eq('id', termId)
      .maybeSingle();

    let startDate: string | null = termData?.start_date || null;
    let endDate: string | null = termData?.end_date || null;

    if (!startDate || !endDate) {
      const yearObj: any = Array.isArray(termData?.academic_years)
        ? termData?.academic_years[0]
        : termData?.academic_years;
      if (yearObj) {
        startDate = startDate || yearObj.start_date || null;
        endDate = endDate || yearObj.end_date || null;
      }
    }

    let query = supabase
      .from('student_attendance')
      .select('status, date')
      .eq('student_id', studentUUID);

    if (startDate) {
      query = query.gte('date', startDate);
    }
    if (endDate) {
      query = query.lte('date', endDate);
    }

    const { data: attendanceData, error } = await query;

    if (error || !attendanceData) {
      return { working_days: 0, present_days: 0, absent_days: 0, percentage: 0 };
    }

    const nonHolidayRecords = attendanceData.filter(a => {
      const s = (a.status || '').toLowerCase().trim();
      return s !== 'holiday';
    });

    const workingDays = nonHolidayRecords.length;
    const presentDays = nonHolidayRecords.filter(a => {
      const s = (a.status || '').toLowerCase().trim();
      return s === 'present' || s === 'late';
    }).length;
    const absentDays = nonHolidayRecords.filter(a => {
      const s = (a.status || '').toLowerCase().trim();
      return s === 'absent';
    }).length;

    const percentage = workingDays > 0 ? (presentDays / workingDays) * 100 : 0;

    return {
      working_days: workingDays,
      present_days: presentDays,
      absent_days: absentDays,
      percentage: Math.round(percentage * 100) / 100
    };
  } catch (error) {
    return { working_days: 0, present_days: 0, absent_days: 0, percentage: 0 };
  }
}

async function fetchProgressCardData(
  termId: string, 
  classId: string, 
  sectionId: string | null
): Promise<TabulationResult[]> {
  const { data, error } = await supabase
    .rpc('get_tabulation_sheet', {
      p_term_id: termId,
      p_class_id: classId,
      p_section_id: sectionId
    });
  
  if (error) {
    console.error('RPC Error:', error);
    throw error;
  }
  
  return (data || []).map((item: any) => ({
    id: item.student_id,
    class_roll: item.class_roll || '',
    student_name: item.student_name || '',
    father_name: item.father_name || '',
    mother_name: item.mother_name || '',
    student_id: item.admission_no || '',
    photo_url: item.photo_url || null,
    subjects: item.subjects || [],
    total_marks_obtained: item.total_marks_obtained || 0,
    total_full_marks: item.total_full_marks || 0,
    percentage: item.percentage || 0,
    gpa: item.gpa || 0,
    letter_grade: item.letter_grade || '',
    section_rank: item.section_rank || null,
    class_rank: item.class_rank || null,
    pass_fail_status: item.pass_fail_status || 'pending',
    failed_subjects: item.failed_subjects || [],
    working_days: item.working_days,
    present_days: item.present_days,
    absent_days: item.absent_days,
    attendance_percentage: item.attendance_percentage
  }));
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function ProgressCardPage() {
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [printing, setPrinting] = useState(false);
  
  const [terms, setTerms] = useState<ExamTerm[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedTerm, setSelectedTerm] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  
  const [tabulationData, setTabulationData] = useState<TabulationResult[]>([]);
  const [isPublished, setIsPublished] = useState(false);
  
  const [printSettings, setPrintSettings] = useState<PrintSettings>(DEFAULT_PRINT_SETTINGS);
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null);
  const [academicYearId, setAcademicYearId] = useState<string | null>(null);
  
  const [behaviorComments, setBehaviorComments] = useState<string>('none');
  const [customComment, setCustomComment] = useState<string>('');
  const [coCurricular, setCoCurricular] = useState({
    sports: false,
    cultural: false,
    scout: false,
    scholarship: false,
    others: false
  });
  
  const [currentStudentWithAttendance, setCurrentStudentWithAttendance] = useState<TabulationResult | null>(null);
  
  const className = classes.find(c => c.id === selectedClass)?.name || '';
  const sectionName = sections.find(s => s.id === selectedSection)?.name || '';
  
  // ============================================
  // LOAD SETTINGS
  // ============================================
  
  const loadSettings = useCallback(async () => {
    try {
      const yearId = await fetchAcademicYearId();
      setAcademicYearId(yearId);
      
      const [school, settings] = await Promise.all([
        fetchSchoolInfo(),
        yearId ? fetchPrintSettings(yearId) : Promise.resolve(null)
      ]);
      
      if (school) setSchoolInfo(school);
      if (settings) setPrintSettings(settings);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }, []);

  // ============================================
  // LOAD INITIAL DATA
  // ============================================
  
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        await loadSettings();
        const { terms: termsData, classes: classesData } = await fetchTermsAndClasses();
        setTerms(termsData);
        setClasses(classesData);
      } catch (error) {
        console.error('Error loading initial data:', error);
      } finally {
        setInitialLoad(false);
      }
    };
    
    loadInitialData();
  }, [loadSettings]);

  useEffect(() => {
    const loadSections = async () => {
      if (!selectedClass) {
        setSections([]);
        return;
      }
      const sectionsData = await fetchSections(selectedClass);
      setSections(sectionsData);
    };
    loadSections();
  }, [selectedClass]);

  useEffect(() => {
    const loadData = async () => {
      if (!selectedTerm || !selectedClass || !selectedSection) {
        setTabulationData([]);
        setSelectedStudentId('');
        setCurrentStudentWithAttendance(null);
        return;
      }
      
      setLoading(true);
      
      try {
        const term = terms.find(t => t.id === selectedTerm);
        const isResultPublished = term?.result_status === 'published';
        setIsPublished(isResultPublished);
        
        if (!isResultPublished) {
          setTabulationData([]);
          setSelectedStudentId('');
          setCurrentStudentWithAttendance(null);
          setLoading(false);
          return;
        }
        
        const data = await fetchProgressCardData(selectedTerm, selectedClass, selectedSection);
        setTabulationData(data);
        
        if (data.length > 0 && !selectedStudentId) {
          setSelectedStudentId(data[0].student_id);
        }
        
      } catch (error) {
        console.error('Error loading tabulation data:', error);
        toast.error('Failed to load data');
        setTabulationData([]);
        setCurrentStudentWithAttendance(null);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [selectedTerm, selectedClass, selectedSection, terms]);
  
  useEffect(() => {
    const loadAttendance = async () => {
      if (!selectedStudentId || !selectedTerm || !selectedClass || !selectedSection) {
        setCurrentStudentWithAttendance(null);
        return;
      }

      const student = tabulationData.find(s => s.student_id === selectedStudentId);
      if (!student) {
        setCurrentStudentWithAttendance(null);
        return;
      }

      try {
        const attendanceData = await fetchStudentAttendance(
          student.id || selectedStudentId,
          selectedTerm,
          selectedClass,
          selectedSection
        );

        setCurrentStudentWithAttendance({
          ...student,
          working_days: attendanceData.working_days,
          present_days: attendanceData.present_days,
          absent_days: attendanceData.absent_days,
          attendance_percentage: attendanceData.percentage
        });
      } catch (error) {
        setCurrentStudentWithAttendance({
          ...student,
          working_days: 0,
          present_days: 0,
          absent_days: 0,
          attendance_percentage: 0
        });
      }
    };

    loadAttendance();
  }, [selectedStudentId, selectedTerm, selectedClass, selectedSection, tabulationData]);
  
  // ============================================
  // COMPUTED VALUES
  // ============================================
  
  const classRankText = currentStudentWithAttendance?.class_rank 
    ? `${currentStudentWithAttendance.class_rank}${getRankSuffix(currentStudentWithAttendance.class_rank)}`
    : 'N/A';
  
  const sectionRankText = currentStudentWithAttendance?.section_rank 
    ? `${currentStudentWithAttendance.section_rank}${getRankSuffix(currentStudentWithAttendance.section_rank)}`
    : 'N/A';
  
  const behaviorCommentOptions = [
    { value: 'excellent', label: 'Excellent behavior and leadership qualities.' },
    { value: 'cooperative', label: 'Very cooperative and helpful to classmates.' },
    { value: 'regular', label: 'Regular in homework and class participation.' },
    { value: 'needs_improvement', label: 'Needs improvement in attention and focus.' },
    { value: 'disciplined', label: 'Disciplined and well-mannered student.' },
    { value: 'active', label: 'Active participation in all class activities.' },
    { value: 'improved', label: 'Shows great improvement in academic performance.' }
  ];
  
  const getFinalCommentText = (): string => {
    if (behaviorComments === 'custom') {
      return customComment || 'Good behavior and satisfactory performance.';
    }
    const selected = behaviorCommentOptions.find(opt => opt.value === behaviorComments);
    return selected?.label || 'Good behavior and satisfactory performance.';
  };
  
  const getCoCurricularText = (): string => {
    const items = [];
    if (coCurricular.sports) items.push('Sports');
    if (coCurricular.cultural) items.push('Cultural Function');
    if (coCurricular.scout) items.push('Scout/Cadet');
    if (coCurricular.scholarship) items.push('Scholarship');
    if (coCurricular.others) items.push('Others');
    return items.length > 0 ? items.join(', ') : 'None';
  };
  
  const gradeScale = [
    { range: '80-100', gpa: '5', grade: 'A+', remark: 'Excellent' },
    { range: '70-79', gpa: '4', grade: 'A', remark: 'Very Good' },
    { range: '60-69', gpa: '3.50', grade: 'A-', remark: 'Good' },
    { range: '50-59', gpa: '3', grade: 'B', remark: 'Satisfactory' },
    { range: '40-49', gpa: '2', grade: 'C', remark: 'Average' },
    { range: '33-39', gpa: '1', grade: 'D', remark: 'Pass' },
    { range: '0-32', gpa: '0', grade: 'F', remark: 'Fail' }
  ];
  
  // ============================================
  // PRINT FUNCTIONS
  // ============================================
  
  const buildStudentCardHTML = (student: TabulationResult, attendanceData: { working_days: number; present_days: number; absent_days: number; percentage: number }, termName: string, pageBreak: boolean = false): string => {
    const commentText = getFinalCommentText();
    const coCurricularText = getCoCurricularText();
    const classRankTextStudent = student.class_rank ? `${student.class_rank}${getRankSuffix(student.class_rank)}` : 'N/A';
    const sectionRankTextStudent = student.section_rank ? `${student.section_rank}${getRankSuffix(student.section_rank)}` : 'N/A';

    const gradeScaleRows = gradeScale.map(g => `
      <tr>
        <td style="border:1px solid #000; padding:2px; text-align:center;">${g.range}</td>
        <td style="border:1px solid #000; padding:2px; text-align:center;">${g.gpa}</td>
        <td style="border:1px solid #000; padding:2px; text-align:center; font-weight:bold;">${g.grade}</td>
        <td style="border:1px solid #000; padding:2px; text-align:center;">${g.remark}</td>
      </tr>
    `).join('');

    const tableRows = (student.subjects || []).map((mark: SubjectMark, idx: number) => {
      const displayGpa = mark.is_absent ? '0.00' : safeToFixed(mark.grade_point);
      
      return `
        <tr>
          <td style="border:1px solid #000; padding:4px; text-align:center;">${idx + 1}.</td>
          <td style="border:1px solid #000; padding:4px; text-align:left; padding-left:5px;">${mark.subject_name || 'Unknown'}</td>
          <td style="border:1px solid #000; padding:4px; text-align:center;">${safeNumber(mark.full_marks)}</td>
          <td style="border:1px solid #000; padding:4px; text-align:center;">${mark.is_absent ? 'ABSENT' : safeNumber(mark.marks_obtained)}</td>
          <td style="border:1px solid #000; padding:4px; text-align:center; font-weight:bold;">${displayGpa}</td>
          <td style="border:1px solid #000; padding:4px; text-align:center;">
            <span style="display:inline-block;padding:1px 5px;font-weight:bold;">${mark.is_absent ? 'ABS' : (mark.grade || 'F')}</span>
          </td>
          <td style="border:1px solid #000; padding:4px; text-align:center; font-weight:bold; color:#2563eb;">
            ${mark.highest_marks !== undefined && mark.highest_marks !== null ? safeNumber(mark.highest_marks) : '-'}
          </td>
        </tr>
      `;
    }).join('');

    return `
      <div class="print-container" style="${pageBreak ? 'page-break-before: always;' : ''}">
        ${getSchoolPrintHeader(schoolInfo, "PROGRESS CARD - " + termName)}
                
        <div class="top-layout-container">
          <div class="student-photo-box">
            ${printSettings.show_photo && student.photo_url ? `
              <img src="${student.photo_url}" alt="${student.student_name}" />
            ` : `
              <div class="no-photo-text">PHOTO<br>NOT AVAILABLE</div>
            `}
          </div>
          
          <div class="student-table-box">
            <table class="student-table">
              <tr><td class="info-label" style="width:22%;">Student's Name</td><td colspan="3" style="font-weight:bold; text-transform:uppercase;">${student.student_name}</td></tr>
              <tr><td class="info-label">Father's Name</td><td colspan="3">${student.father_name || '-'}</td></tr>
              <tr><td class="info-label">Mother's Name</td><td colspan="3">${student.mother_name || '-'}</td></tr>
              <tr><td class="info-label">Roll No</td><td style="width:28%; font-weight:bold;">${student.class_roll || '-'}</td><td class="info-label" style="width:25%;">Admission No</td><td style="width:25%;">${student.student_id || '-'}</td></tr>
              <tr><td class="info-label">Class</td><td style="font-weight:bold;">${className}</td><td class="info-label">Section</td><td style="font-weight:bold;">${sectionName}</td></tr>
              <tr><td class="info-label">Academic Year</td><td colspan="3">${new Date().getFullYear()}</td></tr>
            </table>
          </div>
          
          <div class="grade-scale-box">
            <table class="grade-table">
              <thead><tr><th>Marks Range</th><th>Grade Point</th><th>Grade</th><th>Remarks</th></tr></thead>
              <tbody>${gradeScaleRows}</tbody>
            </table>
          </div>
        </div>
        
        <table class="main-marks-table">
          <thead>
            <tr>
              <th style="width:4%;">SL</th>
              <th style="width:38%; text-align:left; padding-left:6px;">Subjects</th>
              <th style="width:10%;">Full Marks</th>
              <th style="width:12%;">Obtained Marks</th>
              <th style="width:9%;">GPA</th>
              <th style="width:9%;">Grade</th>
              <th style="width:10%;">Highest (in Class)</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
        
        <div class="section-header">OVERALL RESULT</div>
        <table class="overall-table">
          <thead>
            <tr>
              <th>Total Full Marks</th>
              <th>Total Obtained Marks</th>
              <th>Percentage</th>
              <th>GPA</th>
              <th>Grade</th>
              ${printSettings.show_rank ? '<th>Section Position</th><th>Class Position</th>' : ''}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="font-weight:bold;">${safeNumber(student.total_full_marks)}</td>
              <td style="font-weight:bold;">${safeNumber(student.total_marks_obtained)}</td>
              <td>${safeToFixed(student.percentage)}%</td>
              <td style="font-weight:bold;">${safeToFixed(student.gpa)}</td>
              <td><span style="display:inline-block;padding:1px 5px;font-weight:bold;">${student.letter_grade || 'F'}</span></td>
              ${printSettings.show_rank ? `<td>${sectionRankTextStudent}</td><td>${classRankTextStudent}</td>` : ''}
            </tr>
          </tbody>
        </table>
        
        <div class="bottom-flex-container">
          <div class="bottom-column">
            <div class="section-header" style="margin-top:0;">Behaviour & Remarks</div>
            <div style="border:1px solid #000; padding:8px; font-size:10px; min-height:50px; line-height:1.4;">
              ${commentText}
            </div>
          </div>
          <div class="bottom-column">
            <div class="section-header" style="margin-top:0;">Co-Curricular Activities</div>
            <div style="border:1px solid #000; padding:8px; font-size:10px; min-height:50px;">
              ${coCurricularText}
            </div>
          </div>
        </div>
        
        <div style="margin-top: 15px;">
          <div class="section-header">ATTENDANCE RECORD</div>
          <table class="attendance-table">
            <thead>
              <tr>
                <th>Working Days</th>
                <th>Present Days</th>
                <th>Absent Days</th>
                <th>Attendance Percentage</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="font-weight:bold;">${safeNumber(attendanceData.working_days)}</td>
                <td style="font-weight:bold; color:#16a34a;">${safeNumber(attendanceData.present_days)}</td>
                <td style="font-weight:bold; color:#dc2626;">${safeNumber(attendanceData.absent_days)}</td>
                <td style="font-weight:bold;">${safeToFixed(attendanceData.percentage)}%</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <div class="signatures-container">
          <div class="signature-block">____________________<br>Class Teacher</div>
          <div class="signature-block">____________________<br>Principal</div>
          <div class="signature-block">____________________<br>Parent/Guardian</div>
        </div>
        
        <div class="thick-divider">
          <div class="footer-brand">Generated by ${schoolInfo?.school_name || 'Kindergarten ERP'}</div>
        </div>
      </div>
    `;
  };

  const generateSinglePrintHTML = (student: TabulationResult): string => {
    const fontSize = printSettings.font_size;
    let fontSizeStyle = '';
    switch (fontSize) {
      case 'small': fontSizeStyle = '9px'; break;
      case 'normal': fontSizeStyle = '10px'; break;
      case 'large': fontSizeStyle = '11px'; break;
    }
    
    const termName = terms.find(t => t.id === selectedTerm)?.name || '';
    const attendanceData = {
      working_days: student.working_days || 0,
      present_days: student.present_days || 0,
      absent_days: student.absent_days || 0,
      percentage: student.attendance_percentage || 0,
    };
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Progress Report - ${student.student_name}</title>
          <meta charset="UTF-8">
          <style>
            @page { 
              size: ${printSettings.orientation === 'landscape' ? 'landscape' : 'portrait'}; 
              margin: 10mm;
            }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: Arial, sans-serif; 
              background: white; 
              color: #000;
              padding: 0;
              font-size: ${fontSizeStyle};
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .print-container { width: 100%; }
            .report-title { font-size: 14px; font-weight: bold; margin-top: 5px; text-decoration: underline; }
            .exam-title { font-size: 11px; font-weight: bold; margin-top: 2px; text-transform: uppercase; }
            .top-layout-container {
              display: flex;
              justify-content: space-between;
              gap: 12px;
              margin-top: 10px;
              margin-bottom: 12px;
              align-items: stretch;
            }
            .student-photo-box {
              flex: 0.3;
              border: 1px solid #000;
              display: flex;
              align-items: center;
              justify-content: center;
              background-color: #fafafa;
              min-width: 95px;
              max-width: 105px;
              min-height: 120px;
            }
            .student-photo-box img {
              width: 100%;
              height: auto;
              object-fit: cover;
              max-height: 115px;
            }
            .no-photo-text {
              font-size: 9px;
              color: #777;
              text-align: center;
              font-weight: bold;
            }
            .student-table-box { flex: 1.1; }
            .student-table { width: 100%; border-collapse: collapse; height: 100%; }
            .student-table td { 
              border: 1px solid #000; 
              padding: 4px 6px; 
              font-size: 10px; 
              vertical-align: middle; 
              white-space: nowrap;
            }
            .info-label { font-weight: bold; background-color: #fcfcfc; }
            .grade-scale-box { flex: 0.7; }
            .grade-table { width: 100%; border-collapse: collapse; font-size: 9px; height: 100%; }
            .grade-table th { border: 1px solid #000; padding: 3px; background-color: #f2f2f2; font-weight: bold; text-align: center; }
            .grade-table td { border: 1px solid #000; padding: 3px; text-align: center; }
            .main-marks-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            .main-marks-table th { border: 1px solid #000; padding: 5px; text-align: center; font-weight: bold; font-size: 10px; background-color: #f2f2f2; }
            .main-marks-table td { border: 1px solid #000; padding: 4px; text-align: center; font-size: 9px; }
            .section-header { font-size: 11px; font-weight: bold; margin-top: 12px; margin-bottom: 4px; text-transform: uppercase; }
            .overall-table { width: 100%; border-collapse: collapse; }
            .overall-table th { border: 1px solid #000; padding: 5px; background-color: #f2f2f2; font-size: 10px; font-weight: bold; text-align: center; }
            .overall-table td { border: 1px solid #000; padding: 5px; text-align: center; font-size: 10px; }
            .bottom-flex-container {
              display: flex;
              justify-content: space-between;
              gap: 15px;
              margin-top: 10px;
            }
            .bottom-column { flex: 1; }
            .attendance-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            .attendance-table th { border: 1px solid #000; padding: 5px; background-color: #f2f2f2; font-size: 10px; text-align: center; font-weight: bold; }
            .attendance-table td { border: 1px solid #000; padding: 5px; text-align: center; font-size: 10px; }
            .signatures-container { display: flex; justify-content: space-between; margin-top: 50px; padding: 0 5px; }
            .signature-block { text-align: center; width: 140px; padding-top: 4px; font-size: 10px; font-weight: bold; }
            .thick-divider { border-top: 2px solid #000; margin-top: 22px; padding-top: 4px; }
            .footer-brand { text-align: center; font-size: 9px; font-weight: normal; color: #000; }
          </style>
        </head>
        <body>
          ${buildStudentCardHTML(student, attendanceData, termName, false)}
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
  };

  const generateAllPrintHTML = async (): Promise<string> => {
    if (tabulationData.length === 0) return '';
    
    const fontSize = printSettings.font_size;
    let fontSizeStyle = '';
    switch (fontSize) {
      case 'small': fontSizeStyle = '9px'; break;
      case 'normal': fontSizeStyle = '10px'; break;
      case 'large': fontSizeStyle = '11px'; break;
    }
    
    const termName = terms.find(t => t.id === selectedTerm)?.name || '';
    
    let allStudentsHTML = '';
    
    for (let i = 0; i < tabulationData.length; i++) {
      const student = tabulationData[i];
      
      let attendanceData = { working_days: 0, present_days: 0, absent_days: 0, percentage: 0 };
      try {
        const att = await fetchStudentAttendance(
          student.id || student.student_id,
          selectedTerm,
          selectedClass,
          selectedSection
        );
        attendanceData = att;
      } catch (error) {
        // Keep default values
      }
      
      allStudentsHTML += buildStudentCardHTML(student, attendanceData, termName, i > 0);
    }
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Progress Cards - ${className} ${sectionName} - ${termName}</title>
          <meta charset="UTF-8">
          <style>
            @page { 
              size: ${printSettings.orientation === 'landscape' ? 'landscape' : 'portrait'}; 
              margin: 10mm;
            }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: Arial, sans-serif; 
              background: white; 
              color: #000;
              padding: 0;
              font-size: ${fontSizeStyle};
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .print-container { width: 100%; }
            .report-title { font-size: 14px; font-weight: bold; margin-top: 5px; text-decoration: underline; }
            .exam-title { font-size: 11px; font-weight: bold; margin-top: 2px; text-transform: uppercase; }
            .top-layout-container {
              display: flex;
              justify-content: space-between;
              gap: 12px;
              margin-top: 10px;
              margin-bottom: 12px;
              align-items: stretch;
            }
            .student-photo-box {
              flex: 0.3;
              border: 1px solid #000;
              display: flex;
              align-items: center;
              justify-content: center;
              background-color: #fafafa;
              min-width: 95px;
              max-width: 105px;
              min-height: 120px;
            }
            .student-photo-box img {
              width: 100%;
              height: auto;
              object-fit: cover;
              max-height: 115px;
            }
            .no-photo-text {
              font-size: 9px;
              color: #777;
              text-align: center;
              font-weight: bold;
            }
            .student-table-box { flex: 1.1; }
            .student-table { width: 100%; border-collapse: collapse; height: 100%; }
            .student-table td { 
              border: 1px solid #000; 
              padding: 4px 6px; 
              font-size: 10px; 
              vertical-align: middle; 
              white-space: nowrap;
            }
            .info-label { font-weight: bold; background-color: #fcfcfc; }
            .grade-scale-box { flex: 0.7; }
            .grade-table { width: 100%; border-collapse: collapse; font-size: 9px; height: 100%; }
            .grade-table th { border: 1px solid #000; padding: 3px; background-color: #f2f2f2; font-weight: bold; text-align: center; }
            .grade-table td { border: 1px solid #000; padding: 3px; text-align: center; }
            .main-marks-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            .main-marks-table th { border: 1px solid #000; padding: 5px; text-align: center; font-weight: bold; font-size: 10px; background-color: #f2f2f2; }
            .main-marks-table td { border: 1px solid #000; padding: 4px; text-align: center; font-size: 9px; }
            .section-header { font-size: 11px; font-weight: bold; margin-top: 12px; margin-bottom: 4px; text-transform: uppercase; }
            .overall-table { width: 100%; border-collapse: collapse; }
            .overall-table th { border: 1px solid #000; padding: 5px; background-color: #f2f2f2; font-size: 10px; font-weight: bold; text-align: center; }
            .overall-table td { border: 1px solid #000; padding: 5px; text-align: center; font-size: 10px; }
            .bottom-flex-container {
              display: flex;
              justify-content: space-between;
              gap: 15px;
              margin-top: 10px;
            }
            .bottom-column { flex: 1; }
            .attendance-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            .attendance-table th { border: 1px solid #000; padding: 5px; background-color: #f2f2f2; font-size: 10px; text-align: center; font-weight: bold; }
            .attendance-table td { border: 1px solid #000; padding: 5px; text-align: center; font-size: 10px; }
            .signatures-container { display: flex; justify-content: space-between; margin-top: 50px; padding: 0 5px; }
            .signature-block { text-align: center; width: 140px; padding-top: 4px; font-size: 10px; font-weight: bold; }
            .thick-divider { border-top: 2px solid #000; margin-top: 22px; padding-top: 4px; }
            .footer-brand { text-align: center; font-size: 9px; font-weight: normal; color: #000; }
          </style>
        </head>
        <body>
          ${allStudentsHTML}
          
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
  };

  const handlePrintSingle = () => {
    if (!currentStudentWithAttendance) {
      toast.error('No student selected');
      return;
    }
    
    setPrinting(true);
    const printHTML = generateSinglePrintHTML(currentStudentWithAttendance);
    const printWindow = window.open('', '_blank', 'width=1000,height=800,toolbar=yes,scrollbars=yes');
    
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

  const handlePrintAll = async () => {
    if (tabulationData.length === 0) {
      toast.error('No students to print');
      return;
    }
    
    setPrinting(true);
    try {
      const printHTML = await generateAllPrintHTML();
      const printWindow = window.open('', '_blank', 'width=1000,height=800,toolbar=yes,scrollbars=yes');
      
      if (printWindow) {
        printWindow.document.write(printHTML);
        printWindow.document.close();
        printWindow.focus();
        setPrinting(false);
      } else {
        setPrinting(false);
        toast.error('Please allow popups for this site');
      }
    } catch (error) {
      console.error('Print error:', error);
      toast.error('Failed to generate print preview');
      setPrinting(false);
    }
  };
  
  // ============================================
  // RENDER HELPERS
  // ============================================
  
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
              Please publish the results before viewing progress cards.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
  
  // ============================================
  // MAIN RENDER
  // ============================================
  
  if (initialLoad) {
    return (
      <ResponsiveLayout>
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
        </div>
      </ResponsiveLayout>
    );
  }
  
  const hasSelections = selectedTerm && selectedClass && selectedSection;
  const canViewCard = hasSelections && isPublished && currentStudentWithAttendance;
  
  return (
    <ResponsiveLayout>
      <div className="space-y-4 max-w-7xl mx-auto px-2 sm:px-4">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-700 rounded-xl p-4 sm:p-5 shadow-lg">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 sm:h-11 sm:w-11 bg-white/20 rounded-xl flex items-center justify-center">
                <GraduationCap className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-white">Progress Card</h1>
                <p className="text-white/80 text-xs sm:text-sm">Student academic progress report</p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {canViewCard && (
                <Button onClick={handlePrintSingle} disabled={printing} size="sm" className="bg-white/20 hover:bg-white/30 text-white border-0">
                  {printing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Printer className="mr-1.5 h-3.5 w-3.5" />}
                  Print
                </Button>
              )}
              {tabulationData.length > 0 && hasSelections && isPublished && (
                <Button onClick={handlePrintAll} disabled={printing} size="sm" className="bg-green-600 hover:bg-green-700 text-white">
                  <FileText className="mr-1.5 h-3.5 w-3.5" />
                  Print All ({tabulationData.length})
                </Button>
              )}
            </div>
          </div>
        </div>
        
        {/* Current Settings Info */}
        <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-2 px-3 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2">
            <Eye className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            <span className="text-xs text-blue-700 dark:text-blue-300">
              Print layout: {printSettings.orientation}, {printSettings.paper_size}, Font: {printSettings.font_size}
            </span>
          </div>
        </div>
        
        {/* Filters */}
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-3 sm:p-4">
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
                <SelectContent className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg z-50 max-h-[280px] overflow-y-auto">
                  {terms.map((term) => (
                    <SelectItem key={term.id} value={term.id} className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 py-2.5 px-3">
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
                <SelectContent className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg z-50 max-h-[280px] overflow-y-auto">
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id} className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 py-2.5 px-3">
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
                <SelectContent className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg z-50 max-h-[280px] overflow-y-auto">
                  {sections.map((section) => (
                    <SelectItem key={section.id} value={section.id} className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 py-2.5 px-3">
                      {section.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Student</Label>
              <Select 
                value={selectedStudentId} 
                onValueChange={setSelectedStudentId}
                disabled={!hasSelections || !isPublished || tabulationData.length === 0}
              >
                <SelectTrigger className="h-9 text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                  <SelectValue placeholder="Select student" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg z-50 max-h-[280px] overflow-y-auto">
                  {tabulationData.map((student) => (
                    <SelectItem key={student.student_id} value={student.student_id} className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 py-2.5 px-3">
                      {student.class_roll} - {student.student_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        
        {/* Loading */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
            <span className="ml-2 text-sm text-gray-500">Loading progress card...</span>
          </div>
        )}
        
        {/* No Selection */}
        {!loading && !hasSelections && (
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-8 text-center border border-gray-200">
            <School className="h-12 w-12 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Select Term, Class, Section and Student to view progress card</p>
          </div>
        )}
        
        {/* Not Published Warning */}
        {!loading && hasSelections && !isPublished && renderNotPublishedWarning()}
        
        {/* Progress Card Content */}
        {canViewCard && currentStudentWithAttendance && (
          <div className="space-y-4">
            {/* Student Header Card */}
            <Card className="border-0 shadow-lg bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20">
              <CardContent className="p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-5">
                  <div className="flex-shrink-0 self-center sm:self-auto">
                    <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-xl overflow-hidden border-2 border-indigo-300 bg-white flex items-center justify-center">
                      {printSettings.show_photo && currentStudentWithAttendance.photo_url ? (
                        <img src={currentStudentWithAttendance.photo_url} alt={currentStudentWithAttendance.student_name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-xl bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center">
                          <User className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div>
                        <p className="text-xs text-gray-500">Student Name</p>
                        <p className="font-semibold text-gray-800 text-sm sm:text-base break-words">{currentStudentWithAttendance.student_name}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Roll No</p>
                        <p className="font-semibold text-gray-800 text-sm sm:text-base">{currentStudentWithAttendance.class_roll || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Class & Section</p>
                        <p className="font-semibold text-gray-800 text-sm sm:text-base">{className} - {sectionName}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Term</p>
                        <p className="font-semibold text-gray-800 text-sm sm:text-base">{terms.find(t => t.id === selectedTerm)?.name}</p>
                      </div>
                      {printSettings.show_father_name && (
                        <div>
                          <p className="text-xs text-gray-500">Father's Name</p>
                          <p className="text-sm text-gray-700">{currentStudentWithAttendance.father_name || '-'}</p>
                        </div>
                      )}
                      {printSettings.show_mother_name && (
                        <div>
                          <p className="text-xs text-gray-500">Mother's Name</p>
                          <p className="text-sm text-gray-700">{currentStudentWithAttendance.mother_name || '-'}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Marks Table */}
            <Card className="border-0 shadow-lg overflow-x-auto">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-t-xl py-3 sm:py-4">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                  <CardTitle className="text-base sm:text-lg">Subject-wise Marks</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full min-w-[750px]">
                  <thead className="bg-gray-100 dark:bg-gray-800">
                    <tr>
                      <th className="p-2 sm:p-3 text-center text-xs sm:text-sm font-semibold">SL</th>
                      <th className="p-2 sm:p-3 text-left text-xs sm:text-sm font-semibold">Subjects</th>
                      <th className="p-2 sm:p-3 text-center text-xs sm:text-sm font-semibold">Full Marks</th>
                      <th className="p-2 sm:p-3 text-center text-xs sm:text-sm font-semibold">Obtained Marks</th>
                      <th className="p-2 sm:p-3 text-center text-xs sm:text-sm font-semibold">GPA</th>
                      <th className="p-2 sm:p-3 text-center text-xs sm:text-sm font-semibold">Grade</th>
                      <th className="p-2 sm:p-3 text-center text-xs sm:text-sm font-semibold">Highest</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(currentStudentWithAttendance.subjects || []).map((mark: SubjectMark, idx: number) => {
                      const displayGpa = mark.is_absent ? '0.00' : safeToFixed(mark.grade_point);
                      
                      return (
                        <tr key={idx} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="p-2 sm:p-3 text-center text-sm">{idx + 1}</td>
                          <td className="p-2 sm:p-3 text-left font-medium text-sm">{mark.subject_name || 'Unknown'}</td>
                          <td className="p-2 sm:p-3 text-center text-sm">{safeNumber(mark.full_marks)}</td>
                          <td className="p-2 sm:p-3 text-center">
                            {mark.is_absent ? (
                              <Badge variant="outline" className="bg-red-100 text-red-600 text-xs">ABSENT</Badge>
                            ) : (
                              <span className="font-medium text-sm">{safeNumber(mark.marks_obtained)}</span>
                            )}
                          </td>
                          <td className="p-2 sm:p-3 text-center font-semibold text-sm">{displayGpa}</td>
                          <td className="p-2 sm:p-3 text-center">
                            <Badge className={`${getGradeColor(mark.grade || 'F')} bg-opacity-10 text-sm`}>
                              {mark.is_absent ? 'ABS' : (mark.grade || 'F')}
                            </Badge>
                          </td>
                          <td className="p-2 sm:p-3 text-center font-semibold text-blue-600">
                            {mark.highest_marks !== undefined && mark.highest_marks !== null ? safeNumber(mark.highest_marks) : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
            
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-2 sm:p-3 text-white">
                <div className="flex items-center justify-between">
                  <Award className="h-3 w-3 sm:h-4 sm:w-4 opacity-80" />
                  <span className="text-lg sm:text-xl font-bold">{safeNumber(currentStudentWithAttendance.total_marks_obtained)}</span>
                </div>
                <p className="text-[10px] sm:text-xs opacity-90 mt-1">Total Marks</p>
                <p className="text-[8px] sm:text-[10px] opacity-75">out of {safeNumber(currentStudentWithAttendance.total_full_marks)}</p>
              </div>
              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-2 sm:p-3 text-white">
                <div className="flex items-center justify-between">
                  <Trophy className="h-3 w-3 sm:h-4 sm:w-4 opacity-80" />
                  <span className="text-lg sm:text-xl font-bold">{safeToFixed(currentStudentWithAttendance.percentage)}%</span>
                </div>
                <p className="text-[10px] sm:text-xs opacity-90 mt-1">Percentage</p>
              </div>
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-2 sm:p-3 text-white">
                <div className="flex items-center justify-between">
                  <Star className="h-3 w-3 sm:h-4 sm:w-4 opacity-80" />
                  <span className="text-lg sm:text-xl font-bold">{safeToFixed(currentStudentWithAttendance.gpa)}</span>
                </div>
                <p className="text-[10px] sm:text-xs opacity-90 mt-1">GPA</p>
              </div>
              <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg p-2 sm:p-3 text-white">
                <div className="flex items-center justify-between">
                  <GraduationCap className="h-3 w-3 sm:h-4 sm:w-4 opacity-80" />
                  <span className="text-lg sm:text-xl font-bold">{currentStudentWithAttendance.letter_grade || 'F'}</span>
                </div>
                <p className="text-[10px] sm:text-xs opacity-90 mt-1">Grade</p>
              </div>
            </div>
            
            {/* Rank Cards */}
            {printSettings.show_rank && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <Card>
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-amber-500" />
                      <span className="font-semibold text-sm">Class Position:</span>
                      <span className="text-xl font-bold text-indigo-600">{classRankText}</span>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-amber-500" />
                      <span className="font-semibold text-sm">Section Position:</span>
                      <span className="text-xl font-bold text-indigo-600">{sectionRankText}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
            
            {/* Behavior Comments */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Heart className="h-4 w-4 text-pink-500" />
                  <CardTitle className="text-base">Behavior & Comments</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <Select value={behaviorComments} onValueChange={setBehaviorComments}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a comment..." />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-gray-800 border shadow-lg max-h-[280px] overflow-y-auto">
                    <SelectItem value="none">None</SelectItem>
                    {behaviorCommentOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="py-2.5 px-3">
                        {opt.label}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">Custom Comment</SelectItem>
                  </SelectContent>
                </Select>
                {behaviorComments === 'custom' && (
                  <Textarea 
                    placeholder="Write custom comments..." 
                    value={customComment} 
                    onChange={(e) => setCustomComment(e.target.value)} 
                    className="mt-3" 
                    rows={3} 
                  />
                )}
              </CardContent>
            </Card>
            
            {/* Co-Curricular Activities */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-yellow-500" />
                  <CardTitle className="text-base">Co-Curricular Activities</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {[
                    { key: 'sports', label: 'Sports' },
                    { key: 'cultural', label: 'Cultural' },
                    { key: 'scout', label: 'Scout/Cadet' },
                    { key: 'scholarship', label: 'Scholarship' },
                    { key: 'others', label: 'Others' }
                  ].map((item) => (
                    <label key={item.key} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox 
                        checked={coCurricular[item.key as keyof typeof coCurricular]} 
                        onCheckedChange={(c) => setCoCurricular(prev => ({ ...prev, [item.key]: !!c }))}
                        className="h-4 w-4 border-gray-400 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">{item.label}</span>
                    </label>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            {/* Attendance Section */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-blue-500" />
                  <CardTitle className="text-base">Attendance Record</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 text-center">
                    <div className="flex items-center justify-center gap-1 text-blue-600 dark:text-blue-400">
                      <CalendarDays className="h-4 w-4" />
                      <span className="text-xl font-bold">{safeNumber(currentStudentWithAttendance.working_days)}</span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Working Days</p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3 text-center">
                    <div className="flex items-center justify-center gap-1 text-green-600 dark:text-green-400">
                      <CalendarCheck className="h-4 w-4" />
                      <span className="text-xl font-bold">{safeNumber(currentStudentWithAttendance.present_days)}</span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Present Days</p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-3 text-center">
                    <div className="flex items-center justify-center gap-1 text-red-600 dark:text-red-400">
                      <CalendarX className="h-4 w-4" />
                      <span className="text-xl font-bold">{safeNumber(currentStudentWithAttendance.absent_days)}</span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Absent Days</p>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-950/30 rounded-lg p-3 text-center">
                    <div className="flex items-center justify-center gap-1 text-purple-600 dark:text-purple-400">
                      <Percent className="h-4 w-4" />
                      <span className="text-xl font-bold">{safeToFixed(currentStudentWithAttendance.attendance_percentage)}%</span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Attendance</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Signatures */}
            {printSettings.show_signature && (
              <Card>
                <CardContent className="p-3 sm:p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="border-t border-gray-300 pt-2 mt-6">
                        <p className="text-sm font-medium">____________________</p>
                        <p className="text-xs text-gray-500">Class Teacher</p>
                      </div>
                    </div>
                    <div>
                      <div className="border-t border-gray-300 pt-2 mt-6">
                        <p className="text-sm font-medium">____________________</p>
                        <p className="text-xs text-gray-500">Principal</p>
                      </div>
                    </div>
                    <div>
                      <div className="border-t border-gray-300 pt-2 mt-6">
                        <p className="text-sm font-medium">____________________</p>
                        <p className="text-xs text-gray-500">Parent/Guardian</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
        
        {/* No Data */}
        {!loading && hasSelections && isPublished && tabulationData.length === 0 && (
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-8 text-center border border-gray-200">
            <School className="h-12 w-12 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No result data found for this selection</p>
          </div>
        )}
        
        {/* No Student Selected */}
        {!loading && hasSelections && isPublished && tabulationData.length > 0 && !selectedStudentId && (
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-8 text-center border border-gray-200">
            <Users className="h-12 w-12 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Select a student from the list above to view progress card</p>
          </div>
        )}
      </div>
    </ResponsiveLayout>
  );
}
