// src/app/exams/reports/transcript/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { ResponsiveLayout } from "@/components/layout/responsive-layout";
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
  ScrollText,
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { getSchoolPrintHeader } from '@/components/print/SchoolPrintHeader';

const supabase = createClient();

// ============================================
// TYPES
// ============================================

interface ExamTerm {
  id: string;
  name: string;
  term_code: string;
  result_status?: string;
  start_date?: string;
  end_date?: string;
  weightage_percentage?: number;
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
   student_photo_url: string | null;
   admission_no?: string | null;
   photo_url?: string | null;
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

 interface TermResult {
   term_id: string;
   term_name: string;
   term_code: string;
   gpa: number;
   letter_grade: string;
   total_marks: number;
   total_full_marks: number;
   percentage: number;
   rank: number;
   pass_fail_status: string;
   subjects: SubjectMark[];
 }

interface TranscriptData {
   id: string;
   class_roll: string;
   student_name: string;
   father_name: string;
   mother_name: string;
   student_id: string;
   student_photo_url: string | null;
   class_name: string;
   section_name: string;
   academic_year: string;
   terms: TermResult[];
   cumulative_gpa: number;
   cumulative_grade: string;
   total_terms: number;
  passed_terms: number;
  failed_terms: number;
  total_marks_obtained: number;
  total_full_marks: number;
  overall_percentage: number;
  best_term: string;
  best_term_gpa: number;
  attendance_summary: {
    working_days: number;
    present_days: number;
    absent_days: number;
    percentage: number;
  };
  class_rank: number;
  section_rank: number;
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
// HELPER FUNCTIONS
// ============================================

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

const getRankSuffix = (rank: number): string => {
  if (rank === 1) return 'st';
  if (rank === 2) return 'nd';
  if (rank === 3) return 'rd';
  return 'th';
};

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
    school_name: data.school_name || 'সসসসসস আলী মেমেরীয়াল একাডেমী',
    school_address: data.school_address || 'নাওতলা, মাধাইয়া, চান্দিনা, কুমিল্লা',
    school_phone: data.school_phone || '০১৯২৩২৫৩৪৫৪',
    school_email: data.school_email || 'shapla.kindergarten@gmail.com',
    signature_principal: 'Principal',
    signature_teacher: 'Class Teacher'
  };
}

async function fetchTermsAndClasses() {
  const [termsRes, classesRes] = await Promise.all([
    supabase
      .from('exam_terms')
      .select('id, name, term_code, result_status, start_date, end_date, weightage_percentage')
      .eq('result_status', 'published')
      .order('created_at'),
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

async function fetchStudentAttendance(studentId: string): Promise<{ working_days: number; present_days: number; absent_days: number; percentage: number }> {
  try {
    const { data: attendanceData, error } = await supabase
      .from('student_attendance')
      .select('status')
      .eq('student_id', studentId);

    if (error || !attendanceData) {
      return { working_days: 0, present_days: 0, absent_days: 0, percentage: 0 };
    }

    const workingDays = attendanceData.length;
    const presentDays = attendanceData.filter(a => 
      a.status === 'present' || a.status === 'Present'
    ).length;
    const absentDays = attendanceData.filter(a => 
      a.status === 'absent' || a.status === 'Absent' || a.status === 'leave'
    ).length;
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

async function fetchTermData(
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
  
  return data || [];
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function TranscriptPage() {
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [printingAll, setPrintingAll] = useState(false);
  
  const [terms, setTerms] = useState<ExamTerm[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedTerm, setSelectedTerm] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  
  const [transcriptData, setTranscriptData] = useState<TranscriptData | null>(null);
  const [allStudentData, setAllStudentData] = useState<TranscriptData[]>([]);
  const [isPublished, setIsPublished] = useState(false);
  
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null);
  const [academicYearId, setAcademicYearId] = useState<string | null>(null);
  
  const [behaviorComments, setBehaviorComments] = useState<string>('excellent');
  const [customComment, setCustomComment] = useState<string>('');
  const [coCurricular, setCoCurricular] = useState({
    sports: false,
    cultural: false,
    scout: false,
    scholarship: false,
    others: false
  });
  
  const className = classes.find(c => c.id === selectedClass)?.name || '';
  const sectionName = sections.find(s => s.id === selectedSection)?.name || '';
  
  // Grade scale (for print only)
  const gradeScale = [
    { range: '80-100', gpa: '5', grade: 'A+', remarks: 'Excellent' },
    { range: '70-79', gpa: '4', grade: 'A', remarks: 'Very Good' },
    { range: '60-69', gpa: '3.50', grade: 'A-', remarks: 'Good' },
    { range: '50-59', gpa: '3', grade: 'B', remarks: 'Satisfactory' },
    { range: '40-49', gpa: '2', grade: 'C', remarks: 'Average' },
    { range: '33-39', gpa: '1', grade: 'D', remarks: 'Pass' },
    { range: '0-32', gpa: '0', grade: 'F', remarks: 'Fail' }
  ];

  // ============================================
  // LOAD SETTINGS
  // ============================================
  
  const loadSettings = useCallback(async () => {
    try {
      const yearId = await fetchAcademicYearId();
      setAcademicYearId(yearId);
      const school = await fetchSchoolInfo();
      if (school) setSchoolInfo(school);
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

  // Load transcript data
  useEffect(() => {
    const loadTranscript = async () => {
      if (!selectedTerm || !selectedClass || !selectedSection) {
        setTranscriptData(null);
        setAllStudentData([]);
        return;
      }
      
      setLoading(true);
      
      try {
        const term = terms.find(t => t.id === selectedTerm);
        const isPublished_ = term?.result_status === 'published';
        setIsPublished(isPublished_);
        
        if (!isPublished_) {
          setTranscriptData(null);
          setAllStudentData([]);
          setLoading(false);
          toast.warning('Selected term is not published yet');
          return;
        }
        
        const publishedTerms = terms.filter(t => t.result_status === 'published');
        
        if (publishedTerms.length === 0) {
          setTranscriptData(null);
          setAllStudentData([]);
          setLoading(false);
          toast.warning('No published terms found');
          return;
        }
        
        const termResults: Map<string, TabulationResult[]> = new Map();
        
        for (const term of publishedTerms) {
          const data = await fetchTermData(term.id, selectedClass, selectedSection);
          termResults.set(term.id, data);
        }
        
        const students = termResults.get(publishedTerms[0].id) || [];
        const transcripts: TranscriptData[] = [];
        
        for (const student of students) {
          const studentTerms: TermResult[] = [];
          let totalGpa = 0;
          let totalMarks = 0;
          let totalFullMarks = 0;
          let totalPercentage = 0;
          let passedTerms = 0;
          let failedTerms = 0;
          let bestGpa = 0;
          let bestTermName = '';
          
          for (const term of publishedTerms) {
            const termData = termResults.get(term.id) || [];
            const studentData = termData.find(s => s.student_id === student.student_id);
            
            if (studentData) {
              const termResult: TermResult = {
                term_id: term.id,
                term_name: term.name,
                term_code: term.term_code || '',
                gpa: safeNumber(studentData.gpa),
                letter_grade: studentData.letter_grade || 'F',
                total_marks: safeNumber(studentData.total_marks_obtained),
                total_full_marks: safeNumber(studentData.total_full_marks),
                percentage: safeNumber(studentData.percentage),
                rank: studentData.class_rank || 0,
                pass_fail_status: studentData.pass_fail_status || 'Failed',
                subjects: studentData.subjects || []
              };
              
              studentTerms.push(termResult);
              
              if (studentData.pass_fail_status === 'Passed') {
                passedTerms++;
              } else {
                failedTerms++;
              }
              
              totalGpa += safeNumber(studentData.gpa);
              totalMarks += safeNumber(studentData.total_marks_obtained);
              totalFullMarks += safeNumber(studentData.total_full_marks);
              totalPercentage += safeNumber(studentData.percentage);
              
              if (safeNumber(studentData.gpa) > bestGpa) {
                bestGpa = safeNumber(studentData.gpa);
                bestTermName = term.name;
              }
            }
          }
          
          const termCount = studentTerms.length;
          const cumulativeGpa = termCount > 0 ? totalGpa / termCount : 0;
          const overallPercentage = termCount > 0 ? totalPercentage / termCount : 0;
          
          const attendance = await fetchStudentAttendance(student.student_id);
          
          const cumulativeGrade = cumulativeGpa >= 5.00 ? 'A+' :
                                 cumulativeGpa >= 4.00 ? 'A' :
                                 cumulativeGpa >= 3.50 ? 'A-' :
                                 cumulativeGpa >= 3.00 ? 'B' :
                                 cumulativeGpa >= 2.00 ? 'C' :
                                 cumulativeGpa >= 1.00 ? 'D' : 'F';
          
transcripts.push({
              id: student.student_id,
              class_roll: student.class_roll || '',
              student_name: student.student_name || '',
             father_name: student.father_name || '',
             mother_name: student.mother_name || '',
             student_id: student.admission_no || '',
             student_photo_url: student.photo_url || null,
             class_name: className,
             section_name: sectionName,
             academic_year: new Date().getFullYear().toString(),
             terms: studentTerms,
             cumulative_gpa: cumulativeGpa,
             cumulative_grade: cumulativeGrade,
             total_terms: termCount,
             passed_terms: passedTerms,
             failed_terms: failedTerms,
             total_marks_obtained: totalMarks,
             total_full_marks: totalFullMarks,
             overall_percentage: overallPercentage,
             best_term: bestTermName,
             best_term_gpa: bestGpa,
             attendance_summary: attendance,
             class_rank: student.class_rank || 0,
             section_rank: student.section_rank || 0
           });
        }
        
        setAllStudentData(transcripts);
        
        if (transcripts.length > 0 && !selectedStudentId) {
          setSelectedStudentId(transcripts[0].student_id);
          setTranscriptData(transcripts[0]);
        } else if (selectedStudentId) {
          const found = transcripts.find(s => s.student_id === selectedStudentId);
          setTranscriptData(found || null);
        }
        
      } catch (error) {
        console.error('Error loading transcript data:', error);
        toast.error('Failed to load transcript data');
        setTranscriptData(null);
        setAllStudentData([]);
      } finally {
        setLoading(false);
      }
    };
    
    loadTranscript();
  }, [selectedTerm, selectedClass, selectedSection, terms]);

  useEffect(() => {
    if (selectedStudentId && allStudentData.length > 0) {
      const found = allStudentData.find(s => s.student_id === selectedStudentId);
      setTranscriptData(found || null);
    }
  }, [selectedStudentId, allStudentData]);

  // ============================================
  // COMPUTED VALUES
  // ============================================
  
  const behaviorCommentOptions = [
    { value: 'excellent', label: 'Excellent behavior and leadership qualities.' },
    { value: 'cooperative', label: 'Very cooperative and helpful to classmates.' },
    { value: 'regular', label: 'Regular in homework and class participation.' },
    { value: 'hardworking', label: 'A hardworking and sincere student.' },
    { value: 'disciplined', label: 'Disciplined and well-mannered student.' },
    { value: 'active', label: 'Active participation in all class activities.' },
    { value: 'improved', label: 'Shows remarkable improvement in performance.' }
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

  // ============================================
  // PRINT FUNCTIONS
  // ============================================
  
  const generateTranscriptHTML = (data: TranscriptData): string => {
    // Grade scale rows for print
    const gradeScaleRows = gradeScale.map(g => `
      <tr>
        <td class="border border-black p-0.5 text-center" style="font-size:11px; height:19px;">${g.range}</td>
        <td class="border border-black p-0.5 text-center" style="font-size:11px;">${g.gpa}</td>
        <td class="border border-black p-0.5 text-center font-bold" style="font-size:11px;">${g.grade}</td>
        <td class="border border-black p-0.5 text-left pl-2" style="font-size:11px;">${g.remarks}</td>
      </tr>
    `).join('');

    // Get all unique subject names across all terms
    const allSubjects = data.terms.length > 0 
      ? data.terms[0].subjects.map(s => s.subject_name)
      : [];

    // Subject rows with proper borders and alternating colors
    const subjectRows = allSubjects.map((subjectName, idx) => {
      // Find the subject data from first term
      const firstTermSubject = data.terms[0].subjects.find(s => s.subject_name === subjectName);
      
      // Calculate average marks for this subject across all terms
      const avgMarks = data.terms.reduce((sum, term) => {
        const sub = term.subjects.find(s => s.subject_name === subjectName);
        return sum + safeNumber(sub?.marks_obtained || 0);
      }, 0) / data.terms.length;

      // Find highest marks for this subject
      const highestMarks = data.terms.reduce((max, term) => {
        const sub = term.subjects.find(s => s.subject_name === subjectName);
        return Math.max(max, safeNumber(sub?.marks_obtained || 0));
      }, 0);
      
      const rowColor = idx % 2 === 0 ? '#ffffff' : '#f9fafb';

      return `
        <tr style="background-color: ${rowColor};">
          <td class="border border-black p-1 text-center" style="font-size:10px;">${idx + 1}</td>
          <td class="border border-black p-1 text-left font-medium" style="font-size:10px;">${subjectName}</td>
          <td class="border border-black p-1 text-center font-semibold" style="font-size:10px;">${safeNumber(firstTermSubject?.full_marks || 0)}</td>
          ${data.terms.map((term, tIdx) => {
            const sub = term.subjects.find(s => s.subject_name === subjectName);
            const marks = safeNumber(sub?.marks_obtained || 0);
            const isBestMark = marks === highestMarks && marks > 0;
            const isFailed = marks < (sub?.pass_marks || 33);
            return `
              <td class="border border-black p-1 text-center ${isBestMark ? 'font-bold text-green-700' : ''} ${isFailed && marks > 0 ? 'text-red-600' : ''}" style="font-size:10px;">
                ${marks > 0 ? marks : '-'}
              </td>
            `;
          }).join('')}
          <td class="border border-black p-1 text-center font-bold text-teal-700" style="font-size:10px;">${safeToFixed(avgMarks)}</td>
          <td class="border border-black p-1 text-center text-gray-600" style="font-size:10px;">${highestMarks > 0 ? highestMarks : '-'}</td>
        </tr>
      `;
    }).join('');

    // Calculate total marks per term
    const termTotals = data.terms.map(term => {
      return term.subjects.reduce((sum, s) => sum + safeNumber(s.marks_obtained), 0);
    });

    // Calculate total full marks
    const totalFullMarks = data.terms.length > 0 
      ? data.terms[0].subjects.reduce((sum, s) => sum + safeNumber(s.full_marks), 0) 
      : 0;

    // Calculate overall average
    const totalAvgMarks = data.total_marks_obtained / data.total_terms;
    
    // Calculate overall GPA and Grade
    let totalGpa = 0, totalGrade = 'F';
    if (totalAvgMarks >= 80) { totalGpa = 5; totalGrade = 'A+'; }
    else if (totalAvgMarks >= 70) { totalGpa = 4; totalGrade = 'A'; }
    else if (totalAvgMarks >= 60) { totalGpa = 3.5; totalGrade = 'A-'; }
    else if (totalAvgMarks >= 50) { totalGpa = 3; totalGrade = 'B'; }
    else if (totalAvgMarks >= 40) { totalGpa = 2; totalGrade = 'C'; }
    else if (totalAvgMarks >= 33) { totalGpa = 1; totalGrade = 'D'; }
    else { totalGpa = 0; totalGrade = 'F'; }

    const classRankText = data.class_rank ? `${data.class_rank}${getRankSuffix(data.class_rank)}` : 'N/A';

    const schoolHeader = schoolInfo ? getSchoolPrintHeader(
      { school_logo: schoolInfo.school_logo ?? undefined, school_name: schoolInfo.school_name, school_address: schoolInfo.school_address, school_phone: schoolInfo.school_phone, school_email: schoolInfo.school_email ?? undefined },
      'ACADEMIC TRANSCRIPT',
      true,
      data.student_photo_url
    ) : '';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Academic Transcript - ${data.student_name}</title>
          <meta charset="UTF-8">
          <style>
            @page { 
              size: A4 landscape; 
              margin: 10mm 8mm; 
            }
            * { 
              margin: 0; 
              padding: 0; 
              box-sizing: border-box; 
            }
            body { 
              font-family: Arial, 'Times New Roman', sans-serif; 
              background: white; 
              color: #000;
              padding: 0;
              font-size: 10.5px;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .print-container { 
              width: 100%; 
              padding: 5px 8px; 
            }
            .border-black { border-color: #000; }
            .border-gray-400 { border-color: #9ca3af; }
            .bg-gray-100 { background-color: #f3f4f6; }
            .bg-gray-50 { background-color: #f9fafb; }
            .bg-yellow-50 { background-color: #fefce8; }
            .bg-yellow-100 { background-color: #fef9c3; }
            .text-teal-800 { color: #115e59; }
            .text-teal-700 { color: #0d9488; }
            .text-gray-600 { color: #4b5563; }
            .text-green-700 { color: #15803d; }
            .text-red-600 { color: #dc2626; }
            .font-bold { font-weight: bold; }
            .font-semibold { font-weight: 600; }
            .text-center { text-align: center; }
            .text-left { text-align: left; }
            .text-right { text-align: right; }
            .text-xs { font-size: 8px; }
            .text-sm { font-size: 10px; }
            .text-base { font-size: 12px; }
            .text-lg { font-size: 16px; }
            .text-xl { font-size: 18px; }
            .text-2xl { font-size: 22px; }
            .tracking-wider { letter-spacing: 0.5px; }
            .uppercase { text-transform: uppercase; }
            table { border-collapse: collapse; }
            td, th { border: 1px solid #000; }
          </style>
        </head>
<body>
          <div class="print-container">
            ${schoolHeader}
             
             <!-- PROFILE SECTION: Student Info Left, Grade Scale Right -->
            <div class="profile-section-container">
              <div class="student-info-wrapper">
                <div class="student-photo-box">
                  ${data.student_photo_url ? 
                    `<img src="${data.student_photo_url}" alt="${data.student_name}" />` :
                    `<span class="text-xs text-gray-500">Student<br>Photo</span>`
                  }
                </div>
                <table class="student-info-table">
                  <tbody>
                    <tr>
                      <td class="label-cell" style="width: 15%;">Name</td>
                      <td class="value-cell" colspan="3">${data.student_name}</td>
                    </tr>
                    <tr>
                      <td class="label-cell">Father</td>
                      <td class="value-cell" colspan="3">${data.father_name || '-'}</td>
                    </tr>
                    <tr>
                      <td class="label-cell">Mother</td>
                      <td class="value-cell" colspan="3">${data.mother_name || '-'}</td>
                    </tr>
                    <tr>
<td class="label-cell" style="width: 15%;">Roll</td>
                       <td class="value-cell" style="width: 25%;">${data.class_roll || '-'}</td>
<td class="label-cell" style="width: 28%;">Admission ID</td>
                       <td class="value-cell" style="width: 32%;">${data.student_id || '-'}</td>
                    </tr>
                    <tr>
                      <td class="label-cell">Class</td>
                      <td class="value-cell">${data.class_name}</td>
                      <td class="label-cell">Academic Year</td>
                      <td class="value-cell">${data.academic_year}</td>
                    </tr>
                    <tr>
                      <td class="label-cell">Section</td>
                      <td class="value-cell">${data.section_name}</td>
                      <td class="label-cell">Shift</td>
                      <td class="value-cell">-</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div class="grade-scale-wrapper">
                <table class="grade-scale-table text-center">
                  <thead>
                    <tr>
                      <th>Marks</th>
                      <th>GPA</th>
                      <th>Grade</th>
                      <th>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${gradeScaleRows}
                  </tbody>
                </table>
              </div>
            </div>

            <!-- ACADEMIC TRANSCRIPT Title -->
            <div class="text-center mb-3">
              <h2 style="font-size: 18px; font-weight: bold; text-decoration: underline; letter-spacing: 0.5px; display: inline-block;">ACADEMIC TRANSCRIPT</h2>
            </div>

            <!-- MAIN TRANSCRIPT TABLE -->
            <div class="overflow-x-auto mb-4">
              <table class="w-full text-center border-collapse border-2 border-black" style="font-size:9.5px;">
                <thead>
                  <tr class="bg-gray-100">
                    <th rowspan="2" class="border border-black p-0.5 w-8" style="font-size:9px;">SL</th>
                    <th rowspan="2" class="border border-black p-0.5 text-left" style="font-size:9px; min-width:120px;">Subjects</th>
                    <th rowspan="2" class="border border-black p-0.5" style="font-size:9px; min-width:55px;">Full Marks</th>
                    ${data.terms.map((term, idx) => `
                      <th colspan="1" class="border border-black p-0.5 ${term.gpa === data.best_term_gpa && term.gpa > 0 ? 'bg-yellow-50' : ''}" style="font-size:8.5px; min-width:45px;">
                        ${term.term_name}
                      </th>
                    `).join('')}
                    <th rowspan="2" class="border border-black p-0.5" style="font-size:9px; min-width:55px;">Average<br>Marks</th>
                    <th rowspan="2" class="border border-black p-0.5" style="font-size:9px; min-width:55px;">Highest<br>Avg</th>
                  </tr>
                  <tr class="bg-gray-50">
                    ${data.terms.map(term => `
                      <th class="border border-black p-0.5 ${term.gpa === data.best_term_gpa && term.gpa > 0 ? 'bg-yellow-50' : ''}" style="font-size:8.5px;">
                        ${safeToFixed(term.gpa)}
                      </th>
                    `).join('')}
                  </tr>
                </thead>
                <tbody>
                  ${subjectRows}
                  
                  <!-- TOTAL ROW -->
                  <tr class="border-t-2 border-black font-bold bg-gray-100">
                    <td colspan="2" class="border border-black p-0.5 text-right pr-2" style="font-size:9.5px;">Total</td>
                    <td class="border border-black p-0.5 text-center" style="font-size:9.5px;">${totalFullMarks}</td>
                    ${termTotals.map(total => `
                      <td class="border border-black p-0.5 text-center font-bold" style="font-size:9.5px;">${total}</td>
                    `).join('')}
                    <td class="border border-black p-0.5 text-center font-bold text-teal-800" style="font-size:9.5px;">${safeToFixed(totalAvgMarks)}</td>
                    <td class="border border-black p-0.5 text-center" style="font-size:9.5px;">-</td>
                  </tr>
                  
                  <!-- GPA ROW -->
                  <tr class="font-bold bg-gray-50">
                    <td colspan="2" class="border border-black p-0.5 text-right pr-2" style="font-size:9.5px;">GPA</td>
                    <td class="border border-black p-0.5 text-center" style="font-size:9.5px;">${safeToFixed(totalGpa)}</td>
                    ${data.terms.map(term => `
                      <td class="border border-black p-0.5 text-center font-bold" style="font-size:9.5px;">${safeToFixed(term.gpa)}</td>
                    `).join('')}
                    <td class="border border-black p-0.5 text-center font-bold text-teal-800" style="font-size:9.5px;">${safeToFixed(data.cumulative_gpa)}</td>
                    <td class="border border-black p-0.5 text-center" style="font-size:9.5px;">-</td>
                  </tr>
                  
                  <!-- GRADE ROW -->
                  <tr class="font-bold bg-gray-100">
                    <td colspan="2" class="border border-black p-0.5 text-right pr-2" style="font-size:9.5px;">Grade</td>
                    <td class="border border-black p-0.5 text-center" style="font-size:9.5px;">${totalGrade}</td>
                    ${data.terms.map(term => `
                      <td class="border border-black p-0.5 text-center font-bold" style="font-size:9.5px;">${term.letter_grade}</td>
                    `).join('')}
                    <td class="border border-black p-0.5 text-center font-bold text-teal-800" style="font-size:9.5px;">${data.cumulative_grade}</td>
                    <td class="border border-black p-0.5 text-center" style="font-size:9.5px;">-</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- ===== BOTTOM SECTION ===== -->
            <div class="grid grid-cols-3 gap-3 mb-6">
              <!-- Overall Result -->
              <div class="border-2 border-black p-2">
                <h3 class="font-bold text-center bg-gray-100 py-0.5 mb-1 border-b-2 border-black" style="font-size:11px;">Overall Result</h3>
                <table class="w-full border-collapse" style="font-size:11px;">
                  <thead>
                    <tr class="border-b border-black">
                      <th class="pb-0.5 text-center font-bold" style="width:50%;">GPA</th>
                      <th class="pb-0.5 text-center font-bold" style="width:50%;">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td class="pt-1 text-center font-bold text-teal-800" style="font-size:18px;">${safeToFixed(data.cumulative_gpa)}</td>
                      <td class="pt-1 text-center font-bold text-teal-800" style="font-size:18px;">${data.cumulative_grade}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Attendance -->
              <div class="border-2 border-black p-2">
                <h3 class="font-bold text-center bg-gray-100 py-0.5 mb-1 border-b-2 border-black" style="font-size:11px;">Attendance</h3>
                <table class="w-full border-collapse" style="font-size:10px;">
                  <thead>
                    <tr class="border-b border-black">
                      <th class="pb-0.5 text-center font-bold">Working Days</th>
                      <th class="pb-0.5 text-center font-bold">Present Days</th>
                      <th class="pb-0.5 text-center font-bold">Absent Days</th>
                      <th class="pb-0.5 text-center font-bold">Percentage</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td class="pt-1 text-center font-bold">${data.attendance_summary?.working_days || 0} Days</td>
                      <td class="pt-1 text-center font-bold text-green-700">${data.attendance_summary?.present_days || 0} Days</td>
                      <td class="pt-1 text-center font-bold text-red-600">${data.attendance_summary?.absent_days || 0} Days</td>
                      <td class="pt-1 text-center font-bold text-blue-700">${safeToFixed(data.attendance_summary?.percentage)}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Behavior & Co-Curricular -->
              <div class="border-2 border-black p-2">
                <h3 class="font-bold text-center bg-gray-100 py-0.5 mb-1 border-b-2 border-black" style="font-size:11px;">Behavior & Co-Curricular Activities</h3>
                <table class="w-full border-collapse" style="font-size:10px;">
                  <thead>
                    <tr class="border-b border-black">
                      <th class="pb-0.5 text-center font-bold" style="width:50%;">Behavior</th>
                      <th class="pb-0.5 text-center font-bold" style="width:50%;">Co-Curricular</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td class="pt-1 text-center font-medium text-gray-800">${getFinalCommentText()}</td>
                      <td class="pt-1 text-center font-medium text-gray-800">${getCoCurricularText()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- SIGNATURES -->
            <div class="flex flex-row justify-between items-end pt-8 mt-4">
              <div class="text-center w-36">
                <div class="border-t border-black pt-1 font-semibold text-xs text-gray-800">Class Teacher</div>
              </div>
              <div class="text-center w-36">
                <div class="border-t border-black pt-1 font-semibold text-xs text-gray-800">Exam Controller</div>
              </div>
              <div class="text-center w-36">
                <div class="border-t border-black pt-1 font-bold text-teal-900 text-xs">Headmaster / Principal</div>
              </div>
            </div>
          </div>
          
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() {
                window.close();
              };
            };
          <\/script>
        </body>
      </html>
    `;
  };

  const handlePrintSingle = () => {
    if (!transcriptData) {
      toast.error('No transcript data available');
      return;
    }
    
    setPrinting(true);
    const printHTML = generateTranscriptHTML(transcriptData);
    const printWindow = window.open('', '_blank', 'width=1200,height=800,toolbar=yes,scrollbars=yes');
    
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
    if (allStudentData.length === 0) {
      toast.error('No students to print');
      return;
    }
    
    setPrintingAll(true);
    try {
      let allHTML = '';
      for (const data of allStudentData) {
        allHTML += generateTranscriptHTML(data);
        allHTML += '<div style="page-break-after: always;"></div>';
      }
      
      const fullHTML = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>All Transcripts - ${className} ${sectionName}</title>
            <meta charset="UTF-8">
            <style>
              @page { size: A4 landscape; margin: 10mm 8mm; }
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { font-family: Arial, 'Times New Roman', sans-serif; background: white; color: #000; padding: 0; font-size: 10.5px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .print-container { width: 100%; padding: 5px 8px; }
              table { border-collapse: collapse; }
              td, th { border: 1px solid #000; }
              img { height: 70px; width: auto; object-fit: contain; }
            </style>
          </head>
          <body>
            ${allHTML}
            <script>
              window.onload = function() {
                window.print();
                window.onafterprint = function() {
                  window.close();
                };
              };
            <\/script>
          </body>
        </html>
      `;
      
      const printWindow = window.open('', '_blank', 'width=1200,height=800,toolbar=yes,scrollbars=yes');
      if (printWindow) {
        printWindow.document.write(fullHTML);
        printWindow.document.close();
        printWindow.focus();
        setPrintingAll(false);
      } else {
        setPrintingAll(false);
        toast.error('Please allow popups for this site');
      }
    } catch (error) {
      console.error('Print error:', error);
      toast.error('Failed to generate print preview');
      setPrintingAll(false);
    }
  };
  
  // ============================================
  // RENDER
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
  const canViewTranscript = hasSelections && isPublished && transcriptData;
  const publishedTerms = terms.filter(t => t.result_status === 'published');
  
  return (
    <ResponsiveLayout>
      <div className="space-y-4 max-w-7xl mx-auto px-2 sm:px-4">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-700 rounded-xl p-4 sm:p-5 shadow-lg">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 sm:h-11 sm:w-11 bg-white/20 rounded-xl flex items-center justify-center">
                <ScrollText className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-white">Academic Transcript</h1>
                <p className="text-white/80 text-xs sm:text-sm">Complete academic record with term-wise performance</p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {canViewTranscript && (
                <Button onClick={handlePrintSingle} disabled={printing} size="sm" className="bg-white/20 hover:bg-white/30 text-white border-0">
                  {printing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Printer className="mr-1.5 h-3.5 w-3.5" />}
                  Print
                </Button>
              )}
              {allStudentData.length > 0 && hasSelections && isPublished && (
                <Button onClick={handlePrintAll} disabled={printingAll} size="sm" className="bg-green-600 hover:bg-green-700 text-white">
                  {printingAll ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <FileText className="mr-1.5 h-3.5 w-3.5" />}
                  Print All ({allStudentData.length})
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
              Published Terms: ${publishedTerms.length} | Layout: Landscape A4
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
              <Label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Select Term</Label>
              <Select value={selectedTerm} onValueChange={setSelectedTerm}>
                <SelectTrigger className="h-9 text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                  <SelectValue placeholder="Select term" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg z-50 max-h-[280px] overflow-y-auto">
                  {terms.map((term) => (
                    <SelectItem key={term.id} value={term.id} className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 py-2.5 px-3">
                      {term.name} {term.result_status === 'published' ? '✅' : '🔒'}
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
                disabled={!hasSelections || !isPublished || allStudentData.length === 0}
              >
                <SelectTrigger className="h-9 text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                  <SelectValue placeholder="Select student" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg z-50 max-h-[280px] overflow-y-auto">
                  {allStudentData.map((student) => (
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
            <span className="ml-2 text-sm text-gray-500">Loading transcript data...</span>
          </div>
        )}
        
        {/* No Selection */}
        {!loading && !hasSelections && (
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-8 text-center border border-gray-200">
            <School className="h-12 w-12 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Select Term, Class and Section to generate transcript</p>
          </div>
        )}
        
        {/* Not Published Warning */}
        {!loading && hasSelections && !isPublished && (
          <div className="bg-yellow-50 dark:bg-yellow-950/20 rounded-xl p-8 text-center border border-yellow-200">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-2" />
            <p className="text-sm text-yellow-700">Selected term is not published yet</p>
          </div>
        )}
        
        {/* Full Transcript View (Screen) */}
        {canViewTranscript && transcriptData && (
          <div className="space-y-4">
            {/* Student Header Card */}
            <Card className="border-0 shadow-lg bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20">
              <CardContent className="p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-5">
                  <div className="flex-shrink-0 self-center sm:self-auto">
                    <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-xl overflow-hidden border-2 border-indigo-300 bg-white flex items-center justify-center">
                      {transcriptData.student_photo_url ? (
                        <img src={transcriptData.student_photo_url} alt={transcriptData.student_name} className="w-full h-full object-cover" />
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
                        <p className="font-semibold text-gray-800 text-sm sm:text-base break-words">{transcriptData.student_name}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Roll No</p>
                        <p className="font-semibold text-gray-800 text-sm sm:text-base">{transcriptData.class_roll || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Class & Section</p>
                        <p className="font-semibold text-gray-800 text-sm sm:text-base">{transcriptData.class_name} - {transcriptData.section_name}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Cumulative GPA</p>
                        <p className="font-semibold text-indigo-600 text-lg">{safeToFixed(transcriptData.cumulative_gpa)}</p>
                      </div>
                      {transcriptData.father_name && (
                        <div>
                          <p className="text-xs text-gray-500">Father's Name</p>
                          <p className="text-sm text-gray-700">{transcriptData.father_name}</p>
                        </div>
                      )}
                      {transcriptData.mother_name && (
                        <div>
                          <p className="text-xs text-gray-500">Mother's Name</p>
                          <p className="text-sm text-gray-700">{transcriptData.mother_name}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-gray-500">Admission No</p>
                        <p className="text-sm text-gray-700">{transcriptData.student_id || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Academic Year</p>
                        <p className="text-sm text-gray-700">{transcriptData.academic_year}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Main Transcript Table (Screen) - REMOVED STAR ICONS */}
            <Card className="border-0 shadow-lg overflow-x-auto">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-t-xl py-3 sm:py-4">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                  <CardTitle className="text-base sm:text-lg">Subject-wise Marks Across All Terms</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full min-w-[800px] text-center text-sm border-collapse border border-gray-300 dark:border-gray-600">
                  <thead className="bg-gray-100 dark:bg-gray-800">
                    <tr>
                      <th rowSpan={2} className="border border-gray-300 dark:border-gray-600 p-1 sm:p-2 text-xs font-semibold">SL</th>
                      <th rowSpan={2} className="border border-gray-300 dark:border-gray-600 p-1 sm:p-2 text-left text-xs font-semibold min-w-[120px]">Subjects</th>
                      <th rowSpan={2} className="border border-gray-300 dark:border-gray-600 p-1 sm:p-2 text-xs font-semibold">Full Marks</th>
                      {transcriptData.terms.map((term, idx) => (
                        <th key={idx} colSpan={1} className={`border border-gray-300 dark:border-gray-600 p-1 sm:p-2 text-[10px] font-semibold ${term.gpa === transcriptData.best_term_gpa && term.gpa > 0 ? 'bg-yellow-50 dark:bg-yellow-950/30' : ''}`}>
                          {term.term_name}
                          {term.gpa === transcriptData.best_term_gpa && term.gpa > 0 && (
                            <span className="ml-1 text-yellow-600">🏆</span>
                          )}
                        </th>
                      ))}
                      <th rowSpan={2} className="border border-gray-300 dark:border-gray-600 p-1 sm:p-2 text-xs font-semibold min-w-[70px]">Average Marks</th>
                      <th rowSpan={2} className="border border-gray-300 dark:border-gray-600 p-1 sm:p-2 text-xs font-semibold min-w-[70px]">Highest Avg</th>
                    </tr>
                    <tr className="bg-gray-50 dark:bg-gray-800/50">
                      {transcriptData.terms.map((term, idx) => (
                        <th key={idx} className={`border border-gray-300 dark:border-gray-600 p-1 sm:p-2 text-[10px] font-semibold ${term.gpa === transcriptData.best_term_gpa && term.gpa > 0 ? 'bg-yellow-50 dark:bg-yellow-950/30' : ''}`}>
                          {safeToFixed(term.gpa)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {transcriptData.terms.length > 0 && transcriptData.terms[0].subjects ? (
                      transcriptData.terms[0].subjects.map((subject, idx) => {
                        const avgMarks = transcriptData.terms.reduce((sum, term) => {
                          const sub = term.subjects.find(s => s.subject_name === subject.subject_name);
                          return sum + safeNumber(sub?.marks_obtained || 0);
                        }, 0) / transcriptData.terms.length;

                        const highestMarks = transcriptData.terms.reduce((max, term) => {
                          const sub = term.subjects.find(s => s.subject_name === subject.subject_name);
                          return Math.max(max, safeNumber(sub?.marks_obtained || 0));
                        }, 0);

                        return (
                          <tr key={idx} className={`border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 ${idx % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800/50'}`}>
                            <td className="border border-gray-300 dark:border-gray-600 p-1 sm:p-2 text-center">{idx + 1}</td>
                            <td className="border border-gray-300 dark:border-gray-600 p-1 sm:p-2 text-left font-medium">{subject.subject_name}</td>
                            <td className="border border-gray-300 dark:border-gray-600 p-1 sm:p-2 text-center font-semibold">
                              {safeNumber(subject.full_marks)}
                            </td>
                            {transcriptData.terms.map((term, tIdx) => {
                              const sub = term.subjects.find(s => s.subject_name === subject.subject_name);
                              const marks = safeNumber(sub?.marks_obtained || 0);
                              const isBest = marks === highestMarks && marks > 0;
                              return (
                                <td key={tIdx} className={`border border-gray-300 dark:border-gray-600 p-1 sm:p-2 text-center ${isBest ? 'font-bold text-green-600' : ''}`}>
                                  {marks > 0 ? marks : '-'}
                                </td>
                              );
                            })}
                            <td className="border border-gray-300 dark:border-gray-600 p-1 sm:p-2 text-center font-bold text-teal-700">{safeToFixed(avgMarks)}</td>
                            <td className="border border-gray-300 dark:border-gray-600 p-1 sm:p-2 text-center text-gray-600">{highestMarks > 0 ? highestMarks : '-'}</td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={3 + transcriptData.terms.length + 2} className="p-4 text-center text-gray-500">No subjects found</td>
                      </tr>
                    )}
                    
                    {/* Total Row */}
                    {(() => {
                      const totalAvg = transcriptData.total_marks_obtained / transcriptData.total_terms;
                      let totalGpa = 0, totalGrade = 'F';
                      if (totalAvg >= 80) { totalGpa = 5; totalGrade = 'A+'; }
                      else if (totalAvg >= 70) { totalGpa = 4; totalGrade = 'A'; }
                      else if (totalAvg >= 60) { totalGpa = 3.5; totalGrade = 'A-'; }
                      else if (totalAvg >= 50) { totalGpa = 3; totalGrade = 'B'; }
                      else if (totalAvg >= 40) { totalGpa = 2; totalGrade = 'C'; }
                      else if (totalAvg >= 33) { totalGpa = 1; totalGrade = 'D'; }
                      else { totalGpa = 0; totalGrade = 'F'; }
                      return (
                        <tr className="border-t-2 border-black font-bold bg-gray-100 dark:bg-gray-800">
                          <td colSpan={2} className="border border-gray-300 dark:border-gray-600 p-1 sm:p-2 text-right pr-2">Total</td>
                          <td className="border border-gray-300 dark:border-gray-600 p-1 sm:p-2 text-center">
                            {transcriptData.terms.length > 0 ? transcriptData.terms[0].subjects.reduce((sum, s) => sum + safeNumber(s.full_marks), 0) : 0}
                          </td>
                          {transcriptData.terms.map((term, idx) => {
                            const total = term.subjects.reduce((sum, s) => sum + safeNumber(s.marks_obtained), 0);
                            return (
                              <td key={idx} className="border border-gray-300 dark:border-gray-600 p-1 sm:p-2 text-center font-bold">
                                {total}
                              </td>
                            );
                          })}
                          <td className="border border-gray-300 dark:border-gray-600 p-1 sm:p-2 text-center font-bold text-teal-800">
                            {safeToFixed(transcriptData.total_marks_obtained / transcriptData.total_terms)}
                          </td>
                          <td className="border border-gray-300 dark:border-gray-600 p-1 sm:p-2 text-center">-</td>
                        </tr>
                      );
                    })()}

                    {/* GPA Row */}
                    <tr className="font-bold bg-gray-50 dark:bg-gray-800/50">
                      <td colSpan={2} className="border border-gray-300 dark:border-gray-600 p-1 sm:p-2 text-right pr-2">GPA</td>
                      <td className="border border-gray-300 dark:border-gray-600 p-1 sm:p-2 text-center">
                        {(() => {
                          const totalAvg = transcriptData.total_marks_obtained / transcriptData.total_terms;
                          let g = 0;
                          if (totalAvg >= 80) g = 5;
                          else if (totalAvg >= 70) g = 4;
                          else if (totalAvg >= 60) g = 3.5;
                          else if (totalAvg >= 50) g = 3;
                          else if (totalAvg >= 40) g = 2;
                          else if (totalAvg >= 33) g = 1;
                          return safeToFixed(g);
                        })()}
                      </td>
                      {transcriptData.terms.map((term, idx) => (
                        <td key={idx} className="border border-gray-300 dark:border-gray-600 p-1 sm:p-2 text-center font-bold">
                          {safeToFixed(term.gpa)}
                        </td>
                      ))}
                      <td className="border border-gray-300 dark:border-gray-600 p-1 sm:p-2 text-center font-bold text-teal-800">
                        {safeToFixed(transcriptData.cumulative_gpa)}
                      </td>
                      <td className="border border-gray-300 dark:border-gray-600 p-1 sm:p-2 text-center">-</td>
                    </tr>

                    {/* Grade Row */}
                    <tr className="font-bold bg-gray-100 dark:bg-gray-800">
                      <td colSpan={2} className="border border-gray-300 dark:border-gray-600 p-1 sm:p-2 text-right pr-2">Grade</td>
                      <td className="border border-gray-300 dark:border-gray-600 p-1 sm:p-2 text-center">
                        {(() => {
                          const totalAvg = transcriptData.total_marks_obtained / transcriptData.total_terms;
                          if (totalAvg >= 80) return 'A+';
                          else if (totalAvg >= 70) return 'A';
                          else if (totalAvg >= 60) return 'A-';
                          else if (totalAvg >= 50) return 'B';
                          else if (totalAvg >= 40) return 'C';
                          else if (totalAvg >= 33) return 'D';
                          else return 'F';
                        })()}
                      </td>
                      {transcriptData.terms.map((term, idx) => (
                        <td key={idx} className="border border-gray-300 dark:border-gray-600 p-1 sm:p-2 text-center font-bold">
                          {term.letter_grade}
                        </td>
                      ))}
                      <td className="border border-gray-300 dark:border-gray-600 p-1 sm:p-2 text-center font-bold text-teal-800">
                        {transcriptData.cumulative_grade}
                      </td>
                      <td className="border border-gray-300 dark:border-gray-600 p-1 sm:p-2 text-center">-</td>
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-2 sm:p-3 text-center border border-blue-200 dark:border-blue-800">
                <div className="text-lg sm:text-xl font-bold text-blue-600">{transcriptData.total_terms}</div>
                <p className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400">Total Terms</p>
              </div>
              <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-2 sm:p-3 text-center border border-green-200 dark:border-green-800">
                <div className="text-lg sm:text-xl font-bold text-green-600">{transcriptData.passed_terms}</div>
                <p className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400">Passed</p>
              </div>
              <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-2 sm:p-3 text-center border border-red-200 dark:border-red-800">
                <div className="text-lg sm:text-xl font-bold text-red-600">{transcriptData.failed_terms}</div>
                <p className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400">Failed</p>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-950/30 rounded-lg p-2 sm:p-3 text-center border border-yellow-200 dark:border-yellow-800">
                <div className="text-lg sm:text-xl font-bold text-yellow-600">{safeToFixed(transcriptData.best_term_gpa)}</div>
                <p className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400">Best GPA</p>
              </div>
              <div className="bg-purple-50 dark:bg-purple-950/30 rounded-lg p-2 sm:p-3 text-center border border-purple-200 dark:border-purple-800">
                <div className="text-sm sm:text-base font-bold text-purple-600 truncate max-w-[80px]">{transcriptData.best_term || 'N/A'}</div>
                <p className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400">Best Term</p>
              </div>
              <div className="bg-indigo-50 dark:bg-indigo-950/30 rounded-lg p-2 sm:p-3 text-center border border-indigo-200 dark:border-indigo-800">
                <div className="text-lg sm:text-xl font-bold text-indigo-600">{safeToFixed(transcriptData.cumulative_gpa)}</div>
                <p className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400">Cumulative GPA</p>
              </div>
            </div>

            {/* Overall Result, Attendance, Behavior */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-amber-500" />
                    <CardTitle className="text-sm">Overall Result</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-xs text-gray-500">GPA</p>
                      <p className="text-xl font-bold text-indigo-600">{safeToFixed(transcriptData.cumulative_gpa)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Grade</p>
                      <p className={`text-xl font-bold ${getGradeColor(transcriptData.cumulative_grade)}`}>
                        {transcriptData.cumulative_grade}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Rank</p>
                      <p className="text-xl font-bold text-amber-600">
                        {transcriptData.class_rank ? `${transcriptData.class_rank}${getRankSuffix(transcriptData.class_rank)}` : 'N/A'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-blue-500" />
                    <CardTitle className="text-sm">Attendance Summary</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="text-center">
                      <p className="text-xs text-gray-500">Working</p>
                      <p className="text-lg font-bold text-blue-600">{transcriptData.attendance_summary.working_days}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500">Present</p>
                      <p className="text-lg font-bold text-green-600">{transcriptData.attendance_summary.present_days}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500">Absent</p>
                      <p className="text-lg font-bold text-red-600">{transcriptData.attendance_summary.absent_days}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500">Percentage</p>
                      <p className="text-lg font-bold text-purple-600">{safeToFixed(transcriptData.attendance_summary.percentage)}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Heart className="h-4 w-4 text-pink-500" />
                    <CardTitle className="text-sm">Behavior & Co-Curricular</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>
                    <p className="text-xs text-gray-500">Behavior</p>
                    <p className="text-sm font-medium">{getFinalCommentText()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Activities</p>
                    <p className="text-sm font-medium">{getCoCurricularText()}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Behavior Comments Editor - FIXED CHECKBOX COLOR */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-yellow-500" />
                  <CardTitle className="text-sm">Edit Behavior & Co-Curricular</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Behavior Comments</Label>
                    <Select value={behaviorComments} onValueChange={setBehaviorComments}>
                      <SelectTrigger className="w-full h-9 text-sm">
                        <SelectValue placeholder="Select a comment..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {behaviorCommentOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
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
                        className="mt-2" 
                        rows={2} 
                      />
                    )}
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Co-Curricular Activities</Label>
                    <div className="grid grid-cols-2 gap-2">
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
                            onCheckedChange={(checked) => {
                              setCoCurricular(prev => ({ ...prev, [item.key]: !!checked }));
                            }}
                            className="h-4 w-4 rounded border-gray-300 text-teal-600 data-[state=checked]:bg-teal-600 data-[state=checked]:border-teal-600 focus:ring-teal-500"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">{item.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        
        {/* No Data */}
        {!loading && hasSelections && isPublished && allStudentData.length === 0 && (
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-8 text-center border border-gray-200">
            <School className="h-12 w-12 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No transcript data found for this selection</p>
          </div>
        )}
        
        {/* No Student Selected */}
        {!loading && hasSelections && isPublished && allStudentData.length > 0 && !selectedStudentId && (
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-8 text-center border border-gray-200">
            <Users className="h-12 w-12 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Select a student from the list above to view transcript</p>
          </div>
        )}
      </div>
    </ResponsiveLayout>
  );
}
