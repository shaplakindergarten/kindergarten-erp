// src/app/exams/reports/fail-list/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { ResponsiveLayout } from "@/components/layout/responsive-layout";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Printer,
  School,
  Filter,
  AlertTriangle,
  Eye,
  User,
  BookOpen,
  XCircle,
  Users,
  FileText,
  CalendarDays,
  ScrollText,
  Search,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
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
}

interface ClassItem {
  id: string;
  name: string;
}

interface SectionItem {
  id: string;
  name: string;
  class_id: string;
}

interface FailedSubject {
  subject_id: string;
  subject_name: string;
  subject_type: string;
  marks_obtained: number;
  pass_marks: number;
}

interface FailedStudent {
   id: string;
   class_roll: string;
   student_name: string;
   father_name: string;
   mother_name: string;
   student_id: string;
   class_name: string;
   section_name: string;
   gpa: number;
   letter_grade: string;
   total_marks: number;
   full_marks: number;
   percentage: number;
   failed_subjects: FailedSubject[];
   has_failed_compulsory: boolean;
   failed_subject_count: number;
 }

interface SchoolInfo {
  school_logo: string | null;
  school_name: string;
  school_address: string;
  school_phone: string;
  school_email: string;
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

async function fetchSchoolInfo(): Promise<SchoolInfo | null> {
  const { data } = await supabase
    .from('school_settings')
    .select('school_name, school_address, school_phone, school_email, school_logo')
    .single();
  
  if (!data) return null;
  
  return {
    school_logo: data.school_logo,
    school_name: data.school_name || 'Cherag Ali Memorial Academy',
    school_address: data.school_address || 'Naotola, Madhaiya Bazar, Chandina, Comilla',
    school_phone: data.school_phone || '01923253454',
    school_email: data.school_email || 'shapla.kindergarten@gmail.com'
  };
}

async function fetchTerms(): Promise<ExamTerm[]> {
  const { data, error } = await supabase
    .from('exam_terms')
    .select('id, name, term_code, result_status')
    .eq('result_status', 'published')
    .order('created_at', { ascending: true });
  
  if (error) {
    console.error('Error fetching terms:', error);
    return [];
  }
  return data || [];
}

async function fetchClasses(): Promise<ClassItem[]> {
  const { data, error } = await supabase
    .from('classes')
    .select('id, name')
    .order('numeric_order', { ascending: true });
  
  if (error) {
    console.error('Error fetching classes:', error);
    return [];
  }
  return data || [];
}

async function fetchSections(classId: string): Promise<SectionItem[]> {
  if (!classId) return [];
  const { data, error } = await supabase
    .from('sections')
    .select('id, name, class_id')
    .eq('class_id', classId)
    .order('name', { ascending: true });
  
  if (error) {
    console.error('Error fetching sections:', error);
    return [];
  }
  return data || [];
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function FailListPage() {
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [printing, setPrinting] = useState(false);
  
  const [terms, setTerms] = useState<ExamTerm[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  
  const [selectedTerm, setSelectedTerm] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedSection, setSelectedSection] = useState<string>('all');
  
  const [failedStudents, setFailedStudents] = useState<FailedStudent[]>([]);
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null);
  
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const selectedTermName = terms.find(t => t.id === selectedTerm)?.name || '';

  // ============================================
  // LOAD DATA
  // ============================================
  
  const loadInitialData = useCallback(async () => {
    try {
      const [school, termsData, classesData] = await Promise.all([
        fetchSchoolInfo(),
        fetchTerms(),
        fetchClasses()
      ]);
      
      setSchoolInfo(school);
      setTerms(termsData);
      setClasses(classesData);
      
      if (termsData.length > 0 && !selectedTerm) {
        setSelectedTerm(termsData[0].id);
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
      toast.error('Failed to load data');
    } finally {
      setInitialLoad(false);
    }
  }, [selectedTerm]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    const loadSections = async () => {
      if (!selectedClass || selectedClass === 'all') {
        setSections([]);
        return;
      }
      const sectionsData = await fetchSections(selectedClass);
      setSections(sectionsData);
    };
    loadSections();
  }, [selectedClass]);

  // ============================================
  // GENERATE FAIL LIST
  // ============================================
  
  const generateFailList = useCallback(async () => {
    if (!selectedTerm) {
      toast.warning('Please select a term');
      return;
    }
    
    setLoading(true);
    
    try {
const { data: results, error } = await supabase
        .from('compiled_results')
        .select(`
          id,
          student_id,
          gpa,
          letter_grade,
          total_marks_obtained,
          total_full_marks,
          percentage,
          has_failed_compulsory,
          failed_subjects,
      students (
             id,
             name,
             class_roll,
             student_id,
             father_name,
             mother_name,
             classes ( id, name ),
             sections ( id, name )
           )
        `)
        .eq('term_id', selectedTerm)
        .eq('is_published', true);
      
      if (error) throw error;

      if (!results || results.length === 0) {
        setFailedStudents([]);
        setLoading(false);
        toast.info('No results found for this term');
        return;
      }

      const failedResults = results.filter((item: any) => {
        const hasFailed = item.has_failed_compulsory === true;
        const failedSubjects = item.failed_subjects || [];
        const hasFailedSubjects = Array.isArray(failedSubjects) && failedSubjects.length > 0;
        return hasFailed || hasFailedSubjects;
      });

      if (failedResults.length === 0) {
        setFailedStudents([]);
        setLoading(false);
        toast.info('No failed students found for this term');
        return;
      }

      let filteredResults = failedResults;
      
      if (selectedClass && selectedClass !== 'all') {
        filteredResults = filteredResults.filter((item: any) => {
          return item.students?.classes?.id === selectedClass;
        });
      }
      
      if (selectedSection && selectedSection !== 'all') {
        filteredResults = filteredResults.filter((item: any) => {
          return item.students?.sections?.id === selectedSection;
        });
      }

const failedList: FailedStudent[] = filteredResults.map((item: any) => {
        const failedSubjects = item.failed_subjects || [];
        const student = item.students;
        const hasFailed = item.has_failed_compulsory === true;
        
        const finalGrade = hasFailed ? 'F' : (item.letter_grade || 'F');
        const finalGpa = hasFailed ? 0 : safeNumber(item.gpa);
        
        return {
            id: student?.id || '',
            class_roll: student?.class_roll || '-',
            student_name: student?.name || 'N/A',
            father_name: student?.father_name || '-',
            mother_name: student?.mother_name || '-',
            student_id: student?.student_id || '-',
            class_name: student?.classes?.name || 'N/A',
            section_name: student?.sections?.name || 'N/A',
            gpa: finalGpa,
            letter_grade: finalGrade,
            total_marks: safeNumber(item.total_marks_obtained),
            full_marks: safeNumber(item.total_full_marks),
            percentage: safeNumber(item.percentage),
            failed_subjects: failedSubjects.map((subj: any) => ({
              subject_id: subj.subject_id || '',
              subject_name: subj.subject_name || 'Unknown Subject',
              subject_type: subj.subject_type || 'compulsory',
              marks_obtained: safeNumber(subj.marks_obtained),
              pass_marks: safeNumber(subj.pass_marks)
            })),
            has_failed_compulsory: hasFailed,
            failed_subject_count: failedSubjects.length
          };
      });

      failedList.sort((a, b) => {
        if (a.class_name !== b.class_name) return a.class_name.localeCompare(b.class_name);
        if (a.section_name !== b.section_name) return a.section_name.localeCompare(b.section_name);
        return a.gpa - b.gpa;
      });

      setFailedStudents(failedList);
      
    } catch (err) {
      console.error('Error generating fail list:', err);
      toast.error('Failed to generate fail list');
    } finally {
      setLoading(false);
    }
  }, [selectedTerm, selectedClass, selectedSection]);

  useEffect(() => {
    if (selectedTerm) {
      generateFailList();
    }
  }, [selectedTerm, selectedClass, selectedSection, generateFailList]);

  // ============================================
  // PRINT FUNCTIONS - Portrait A4
  // ============================================
  
  const generatePrintHTML = (): string => {
    const students = filteredStudents;
    
    if (students.length === 0) {
      return '<html><body><p>No data to print</p></body></html>';
    }

    // Generate table rows
    const tableRows = students.map((student, index) => {
      const failedSubjectsHtml = student.failed_subjects.map(subj => 
        `<span style="display:inline-block; border:1px solid #000; padding:2px 6px; margin:2px; font-size:9px; border-radius:3px; background:#fee2e2;">
          ${subj.subject_name} (${subj.marks_obtained}/${subj.pass_marks})
        </span>`
      ).join(' ');

      return `
        <tr style="border-bottom: 1px solid #ddd;">
          <td style="padding: 5px 3px; text-align:center; font-size:10px;">${index + 1}</td>
          <td style="padding: 5px 3px; text-align:left; font-size:10px;">
            <strong>${student.student_name}</strong><br/>
            <span style="font-size:8px; color:#666;">Father: ${student.father_name}</span>
          </td>
          <td style="padding: 5px 3px; text-align:center; font-size:10px;">${student.class_roll}</td>
          <td style="padding: 5px 3px; text-align:left; font-size:10px;">${student.class_name}</td>
          <td style="padding: 5px 3px; text-align:left; font-size:10px;">${student.section_name}</td>
          <td style="padding: 5px 3px; text-align:center; font-size:10px; font-weight:bold; color:#b91c1c;">${safeToFixed(student.gpa)}</td>
          <td style="padding: 5px 3px; text-align:center; font-size:10px; font-weight:bold; color:#b91c1c;">${student.letter_grade}</td>
          <td style="padding: 5px 3px; text-align:center; font-size:10px;">${failedSubjectsHtml}</td>
        </tr>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Failed Students List - ${selectedTermName}</title>
          <meta charset="UTF-8">
          <style>
            @page { 
              size: A4 portrait; 
              margin: 12mm 10mm; 
            }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: Arial, sans-serif; 
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
            }
            .report-title-box { 
              display: inline-block; 
              background: #fee2e2; 
              padding: 3px 12px; 
              border-radius: 4px; 
              border: 1px solid #fca5a5; 
              margin-top: 8px; 
            }
            .report-title-box h2 { 
              font-size: 12px; 
              font-weight: bold; 
              color: #b91c1c; 
              text-transform: uppercase; 
              margin: 0; 
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-top: 8px; 
              font-size: 9.5px; 
            }
            th { 
              background-color: #f3f4f6; 
              border: 1px solid #000; 
              padding: 4px 3px; 
              font-weight: bold; 
              text-align: center; 
              font-size: 9.5px;
            }
            td { 
              border: 1px solid #000; 
              padding: 4px 3px; 
              text-align: center; 
              font-size: 9.5px;
            }
            .summary { 
              margin-top: 12px; 
              padding: 8px; 
              border: 1px solid #000; 
              border-radius: 4px; 
              background: #fef2f2; 
              text-align: center;
            }
            .summary p { 
              font-weight: bold; 
              font-size: 11px; 
            }
            .footer { 
              text-align: center; 
              font-size: 9px; 
              color: #666; 
              border-top: 1px solid #ccc; 
              padding-top: 8px; 
              margin-top: 12px; 
            }
            .text-left { text-align: left; }
            .text-center { text-align: center; }
            .font-bold { font-weight: bold; }
            .text-red { color: #b91c1c; }
            
            /* Print optimization */
            @media print {
              body { background: white; }
              .no-print { display: none; }
              .page-break { page-break-after: always; }
            }
</style>
        </head>
        <body>
          <div class="print-container">
            ${getSchoolPrintHeader({ ...schoolInfo, school_logo: schoolInfo?.school_logo ?? undefined, school_email: schoolInfo?.school_email ?? undefined }, `Failed Students List — ${selectedTermName}`)}
            
            <!-- Table -->
            <table>
              <thead>
                <tr>
                  <th style="width:5%;">SL</th>
                  <th style="width:20%;">Student Name</th>
                  <th style="width:7%;">Roll</th>
                  <th style="width:12%;">Class</th>
                  <th style="width:12%;">Section</th>
                  <th style="width:7%;">GPA</th>
                  <th style="width:7%;">Grade</th>
                  <th style="width:30%;">Failed Subjects</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>

            <!-- Summary -->
            <div class="summary">
              <p>
                Total Failed Students: ${students.length} | 
                Total Failed Subjects: ${students.reduce((sum, s) => sum + s.failed_subject_count, 0)}
              </p>
            </div>

            <!-- Footer -->
            <div class="footer">
              Generated on ${new Date().toLocaleDateString()} • Powered by ${schoolInfo?.school_name || 'Cherag Ali Memorial Academy'}
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

  const handlePrint = () => {
    if (filteredStudents.length === 0) {
      toast.warning('No data to print');
      return;
    }
    
    setPrinting(true);
    const printHTML = generatePrintHTML();
    const printWindow = window.open('', '_blank', 'width=800,height=1100,toolbar=yes,scrollbars=yes');
    
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

  // ============================================
  // FILTER FUNCTIONS
  // ============================================
  
const filteredStudents = failedStudents.filter(student => {
     if (!searchQuery) return true;
     const query = searchQuery.toLowerCase();
return (
        student.student_name.toLowerCase().includes(query) ||
        student.class_roll.toLowerCase().includes(query) ||
        student.father_name.toLowerCase().includes(query) ||
        student.class_name.toLowerCase().includes(query) ||
        student.section_name.toLowerCase().includes(query) ||
        student.student_id.toLowerCase().includes(query)
      );
   });

  // ============================================
  // RENDER
  // ============================================
  
  if (initialLoad) {
    return (
      <ResponsiveLayout>
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-red-600" />
          <span className="ml-3 text-sm text-gray-500">Loading fail list data...</span>
        </div>
      </ResponsiveLayout>
    );
  }

  const hasResults = failedStudents.length > 0;
  const totalFailed = failedStudents.length;
  const totalFailedSubjects = failedStudents.reduce((sum, s) => sum + s.failed_subject_count, 0);

  const classFilterValue = selectedClass || 'all';
  const sectionFilterValue = selectedSection || 'all';

  return (
    <ResponsiveLayout>
      <div className="space-y-6">
        {/* Header - Screen Only */}
        <div className="rounded-2xl bg-gradient-to-r from-red-700 via-rose-700 to-pink-700 p-6 shadow-xl text-white">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm text-white/70 mb-1">
                <Link href="/exams/dashboard" className="flex items-center gap-1 hover:text-white transition">
                  <span>←</span> Dashboard
                </Link>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
                <XCircle className="h-7 w-7 text-red-300" />
                Failed Students List
              </h1>
              <p className="text-sm text-white/80 mt-1">
                List of students who failed in compulsory subjects with subject-wise details
              </p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button 
                onClick={handlePrint} 
                disabled={!hasResults || printing} 
                className="bg-white/20 hover:bg-white/30 text-white border-0"
              >
                {printing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Printer className="mr-2 h-4 w-4" />
                )}
                Print
              </Button>
              <Button 
                onClick={generateFailList} 
                variant="outline" 
                className="border-white/30 text-white hover:bg-white/10"
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        {hasResults && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-red-200 dark:border-red-900/30 bg-red-50/50 dark:bg-red-950/20">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-red-600">{totalFailed}</div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Total Failed Students</p>
              </CardContent>
            </Card>
            <Card className="border-orange-200 dark:border-orange-900/30 bg-orange-50/50 dark:bg-orange-950/20">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-orange-600">{totalFailedSubjects}</div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Total Failed Subjects</p>
              </CardContent>
            </Card>
            <Card className="border-blue-200 dark:border-blue-900/30 bg-blue-50/50 dark:bg-blue-950/20">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">{classes.length}</div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Total Classes</p>
              </CardContent>
            </Card>
            <Card className="border-purple-200 dark:border-purple-900/30 bg-purple-50/50 dark:bg-purple-950/20">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-purple-600">{terms.length}</div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Published Terms</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card className="border-none shadow bg-white dark:bg-gray-950 rounded-xl">
          <CardContent className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-xs font-bold text-gray-600 dark:text-gray-400">Select Term</Label>
                <Select value={selectedTerm} onValueChange={setSelectedTerm}>
                  <SelectTrigger className="mt-1.5 bg-slate-50 dark:bg-gray-900">
                    <SelectValue placeholder="Select term" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-gray-900">
                    {terms.map((term) => (
                      <SelectItem key={term.id} value={term.id}>
                        {term.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-bold text-gray-600 dark:text-gray-400">Filter by Class</Label>
                <Select 
                  value={classFilterValue} 
                  onValueChange={(v) => {
                    setSelectedClass(v);
                    setSelectedSection('all');
                  }}
                >
                  <SelectTrigger className="mt-1.5 bg-slate-50 dark:bg-gray-900">
                    <SelectValue placeholder="All Classes" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-gray-900">
                    <SelectItem value="all">All Classes</SelectItem>
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-bold text-gray-600 dark:text-gray-400">Filter by Section</Label>
                <Select 
                  value={sectionFilterValue} 
                  onValueChange={setSelectedSection}
                  disabled={!selectedClass || selectedClass === 'all'}
                >
                  <SelectTrigger className="mt-1.5 bg-slate-50 dark:bg-gray-900">
                    <SelectValue placeholder={sections.length === 0 ? "No sections" : "All Sections"} />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-gray-900">
                    <SelectItem value="all">All Sections</SelectItem>
                    {sections.map((section) => (
                      <SelectItem key={section.id} value={section.id}>
                        {section.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-bold text-gray-600 dark:text-gray-400">Search Student</Label>
                <div className="relative mt-1.5">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by name, roll..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-10 pl-9 pr-3 rounded-md border border-gray-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loading State */}
        {loading && (
          <div className="bg-white dark:bg-gray-900 rounded-xl p-12 text-center shadow-sm">
            <Loader2 className="h-10 w-10 animate-spin text-red-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Loading failed students list...</p>
          </div>
        )}

        {/* No Results */}
        {!loading && !hasResults && (
          <div className="bg-white dark:bg-gray-900 rounded-xl p-12 text-center shadow-sm border border-dashed border-gray-200 dark:border-gray-800">
            <School className="h-14 w-14 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-gray-700 dark:text-gray-300 mb-1">No Failed Students</h3>
            <p className="text-sm text-gray-400">
              {selectedTerm ? 'All students passed in this selection. Congratulations! 🎉' : 'Please select a term to view failed students.'}
            </p>
          </div>
        )}

        {/* No Results After Filter */}
        {!loading && hasResults && filteredStudents.length === 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-xl p-12 text-center shadow-sm border border-dashed border-gray-200 dark:border-gray-800">
            <Search className="h-14 w-14 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-gray-700 dark:text-gray-300 mb-1">No Matching Students</h3>
            <p className="text-sm text-gray-400">No failed students match your search criteria.</p>
          </div>
        )}

        {/* Failed Students Table */}
        {!loading && hasResults && filteredStudents.length > 0 && (
          <Card className="border-none shadow rounded-xl overflow-hidden bg-white dark:bg-gray-950">
            <CardHeader className="bg-red-50/50 dark:bg-red-950/10 border-b border-red-100 dark:border-red-900/20 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <CardTitle className="text-base font-bold text-red-700 dark:text-red-400">
                    Failed Students ({filteredStudents.length})
                  </CardTitle>
                </div>
                <Badge variant="outline" className="border-red-200 text-red-600 bg-red-50 dark:bg-red-950/20">
                  {totalFailedSubjects} Failed Subjects
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-center border-collapse text-xs md:text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="p-2 md:p-3 font-bold text-left">SL</th>
                    <th className="p-2 md:p-3 font-bold text-left">Student Name</th>
                    <th className="p-2 md:p-3 font-bold text-center">Roll</th>
                    <th className="p-2 md:p-3 font-bold text-left">Class</th>
                    <th className="p-2 md:p-3 font-bold text-left">Section</th>
                    <th className="p-2 md:p-3 font-bold text-center">GPA</th>
                    <th className="p-2 md:p-3 font-bold text-center">Grade</th>
                    <th className="p-2 md:p-3 font-bold text-center">Failed Subjects</th>
                    <th className="p-2 md:p-3 font-bold text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student, index) => (
                    <tr 
                      key={student.student_id}
                      className={`border-b border-gray-100 dark:border-gray-800 ${
                        index % 2 === 0 ? 'bg-white dark:bg-gray-950' : 'bg-red-50/30 dark:bg-red-950/5'
                      }`}
                    >
                      <td className="p-2 md:p-3 text-left font-medium text-gray-500">{index + 1}</td>
                      <td className="p-2 md:p-3 text-left">
                        <div className="font-semibold text-gray-800 dark:text-gray-200">{student.student_name}</div>
                        <div className="text-[10px] text-gray-400">Father: {student.father_name}</div>
                      </td>
                      <td className="p-2 md:p-3 text-center font-medium">{student.class_roll}</td>
                      <td className="p-2 md:p-3 text-left">{student.class_name}</td>
                      <td className="p-2 md:p-3 text-left">{student.section_name}</td>
                      <td className="p-2 md:p-3 text-center font-bold text-red-600">
                        {safeToFixed(student.gpa)}
                      </td>
                      <td className="p-2 md:p-3 text-center font-bold">
                        <span className={student.letter_grade === 'F' ? 'text-red-600 font-bold' : getGradeColor(student.letter_grade)}>
                          {student.letter_grade}
                        </span>
                      </td>
                      <td className="p-2 md:p-3 text-center">
                        <div className="flex flex-wrap items-center justify-center gap-1">
                          {student.failed_subjects.map((subj, idx) => (
                            <Badge 
                              key={idx}
                              variant="error"
                              className="text-[10px] px-1.5 py-0.5"
                            >
                              {subj.subject_name}
                              <span className="ml-1 text-[8px] opacity-70">
                                ({subj.marks_obtained}/{subj.pass_marks})
                              </span>
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="p-2 md:p-3 text-center">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-7 text-xs border-red-200 text-red-600 hover:bg-red-50"
                          onClick={() => {
                            toast.info(`Viewing details for ${student.student_name}`);
                          }}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
            
            {/* Footer */}
            <div className="p-4 text-center text-xs text-gray-400 border-t border-gray-100 dark:border-gray-800">
              Showing {filteredStudents.length} failed students • Generated on {new Date().toLocaleDateString()}
            </div>
          </Card>
        )}
      </div>
    </ResponsiveLayout>
  );
}
