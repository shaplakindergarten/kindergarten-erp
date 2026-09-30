// src/app/exams/reports/merit-list/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { ResponsiveLayout } from "@/components/layout/responsive-layout";
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Loader2, 
  RefreshCw, 
  AlertCircle,
  Printer,
  ArrowLeft,
  School,
  Award,
  XCircle,
  Trophy,
  Medal,
  Star
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

interface MeritStudent {
   section_rank: number;
   student_id: string;
   name: string;
   class_roll: string;
   father_name: string;
   class_name: string;
   section_name: string;
   gpa: number;
   grade: string;
   total_marks: number;
   full_marks: number;
   is_failed_section?: boolean;
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

const safeNumber = (value: any): number => {
  if (value === undefined || value === null || isNaN(value)) {
    return 0;
  }
  return Number(value);
};

const getRankBadge = (rank: number): string => {
  if (rank === 1) return '1st';
  if (rank === 2) return '2nd';
  return '3rd';
};

const getRankIcon = (rank: number) => {
  if (rank === 1) return <Trophy className="h-4 w-4 text-yellow-500" />;
  if (rank === 2) return <Medal className="h-4 w-4 text-gray-400" />;
  return <Medal className="h-4 w-4 text-amber-600" />;
};

const getRankColor = (rank: number): string => {
  if (rank === 1) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
  if (rank === 2) return 'bg-gray-100 text-gray-700 border-gray-300';
  return 'bg-amber-100 text-amber-800 border-amber-300';
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
    .select('id, name, term_code')
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

export default function MeritListPage() {
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [printing, setPrinting] = useState(false);
  
  const [terms, setTerms] = useState<ExamTerm[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  
  const [selectedTerm, setSelectedTerm] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedSection, setSelectedSection] = useState<string>('all');
  
  const [meritList, setMeritList] = useState<MeritStudent[]>([]);
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null);
  
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
  // GENERATE MERIT LIST
  // ============================================
  
  const generateMeritList = useCallback(async () => {
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
          has_failed_compulsory,
students (
             id,
             name,
             class_roll,
             father_name,
             classes ( id, name ),
             sections ( id, name )
           )
        `)
        .eq('term_id', selectedTerm)
        .eq('is_published', true);
      
      if (error) throw error;

      if (!results || results.length === 0) {
        setMeritList([]);
        setLoading(false);
        toast.info('No results found for this term');
        return;
      }

      const groupedBySection: { [key: string]: { meta: any, students: any[] } } = {};

      results.forEach((item: any) => {
        if (!item.students || !item.students.classes || !item.students.sections) return;
        
        const classId = item.students.classes.id;
        const sectionId = item.students.sections.id;
        const groupKey = `${classId}_${sectionId}`;

        if (!groupedBySection[groupKey]) {
          groupedBySection[groupKey] = {
            meta: {
              class_id: classId,
              section_id: sectionId,
              class_name: item.students.classes.name,
              section_name: item.students.sections.name
            },
            students: []
          };
        }
        groupedBySection[groupKey].students.push(item);
      });

      let filteredGroups = groupedBySection;
      
      if (selectedClass && selectedClass !== 'all') {
        filteredGroups = Object.keys(groupedBySection)
          .filter(key => {
            const group = groupedBySection[key];
            return group.meta.class_id === selectedClass;
          })
          .reduce((obj: any, key) => {
            obj[key] = groupedBySection[key];
            return obj;
          }, {});
      }
      
      if (selectedSection && selectedSection !== 'all') {
        filteredGroups = Object.keys(filteredGroups)
          .filter(key => {
            const group = filteredGroups[key];
            return group.meta.section_id === selectedSection;
          })
          .reduce((obj: any, key) => {
            obj[key] = filteredGroups[key];
            return obj;
          }, {});
      }

      const finalMeritList: MeritStudent[] = [];

      Object.keys(filteredGroups).forEach((key) => {
        const sectionGroup = filteredGroups[key];
        
        const passedStudents = sectionGroup.students.filter((item: any) => {
          const hasFailedCompulsory = item.has_failed_compulsory === true;
          const gpa = safeNumber(item.gpa);
          return !hasFailedCompulsory && gpa > 0;
        });

        if (passedStudents.length > 0) {
          passedStudents.sort((a: any, b: any) => {
            const gpaA = safeNumber(a.gpa);
            const gpaB = safeNumber(b.gpa);
            if (gpaB !== gpaA) return gpaB - gpaA;
            return (safeNumber(b.total_marks_obtained) || 0) - (safeNumber(a.total_marks_obtained) || 0);
          });

          passedStudents.slice(0, 3).forEach((item: any, index: number) => {
            finalMeritList.push({
section_rank: index + 1,
               student_id: item.student_id,
               name: item.students.name || 'N/A',
               class_roll: item.students.class_roll || '-',
               father_name: item.students.father_name || '-',
               class_name: sectionGroup.meta.class_name,
               section_name: sectionGroup.meta.section_name,
               gpa: safeNumber(item.gpa),
               grade: item.letter_grade || 'F',
               total_marks: safeNumber(item.total_marks_obtained),
               full_marks: safeNumber(item.total_full_marks),
             });
          });
        } else {
finalMeritList.push({
             section_rank: 0,
             student_id: 'empty',
             name: 'No students passed in this section',
             class_roll: '-',
             father_name: '-',
             class_name: sectionGroup.meta.class_name,
             section_name: sectionGroup.meta.section_name,
             gpa: 0,
             grade: '-',
             total_marks: 0,
             full_marks: 0,
             is_failed_section: true
           });
        }
      });

      finalMeritList.sort((a, b) => {
        if (a.class_name !== b.class_name) return a.class_name.localeCompare(b.class_name);
        if (a.section_name !== b.section_name) return a.section_name.localeCompare(b.section_name);
        return a.section_rank - b.section_rank;
      });

      setMeritList(finalMeritList);
      
      if (finalMeritList.length === 0) {
        toast.info('No merit data found for this selection');
      }
      
    } catch (err) {
      console.error('Error generating merit list:', err);
      toast.error('Failed to generate merit list');
    } finally {
      setLoading(false);
    }
  }, [selectedTerm, selectedClass, selectedSection]);

  useEffect(() => {
    if (selectedTerm) {
      generateMeritList();
    }
  }, [selectedTerm, selectedClass, selectedSection, generateMeritList]);

  // ============================================
  // PRINT FUNCTIONS - Portrait A4 with New Window
  // ============================================
  
  const generatePrintHTML = (): string => {
    const students = meritList;
    
    if (students.length === 0) {
      return '<html><body><p>No data to print</p></body></html>';
    }

    const tableRows = students.map((student, index) => {
      const rankDisplay = student.is_failed_section 
        ? '-' 
        : student.section_rank === 1 ? '1st' : student.section_rank === 2 ? '2nd' : '3rd';
      
      const rowBg = student.is_failed_section 
        ? 'background:#fef2f2;' 
        : index % 2 === 0 ? 'background:#ffffff;' : 'background:#f9fafb;';

      return `
        <tr style="border-bottom:1px solid #ddd; ${rowBg}">
          <td style="padding:5px 3px; text-align:center; font-size:10px; font-weight:bold;">
            ${rankDisplay}
          </td>
          <td style="padding:5px 3px; text-align:left; font-size:10px; font-weight:bold;">${student.class_name}</td>
          <td style="padding:5px 3px; text-align:left; font-size:10px;">${student.section_name}</td>
          <td style="padding:5px 3px; text-align:center; font-size:10px;">${student.class_roll}</td>
          <td style="padding:5px 3px; text-align:left; font-size:10px;">
            <strong>${student.is_failed_section ? 'No student passed' : student.name}</strong>
            ${!student.is_failed_section && student.father_name ? `<br/><span style="font-size:8px; color:#666;">Father: ${student.father_name}</span>` : ''}
          </td>
          <td style="padding:5px 3px; text-align:center; font-size:10px;">
            ${student.is_failed_section ? '-' : `${student.total_marks} / ${student.full_marks}`}
          </td>
          <td style="padding:5px 3px; text-align:center; font-size:10px; font-weight:bold; color:#4f46e5;">
            ${student.is_failed_section ? '-' : student.gpa.toFixed(2)}
          </td>
          <td style="padding:5px 3px; text-align:center; font-size:10px; font-weight:bold;">
            ${student.is_failed_section ? '-' : student.grade}
          </td>
        </tr>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Merit List - ${selectedTermName}</title>
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
              background: #e0e7ff; 
              padding: 3px 12px; 
              border-radius: 4px; 
              border: 1px solid #a5b4fc; 
              margin-top: 8px; 
            }
            .report-title-box h2 { 
              font-size: 12px; 
              font-weight: bold; 
              color: #3730a3; 
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
              background: #eef2ff; 
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
            
            @media print {
              body { background: white; }
              .no-print { display: none; }
              .page-break { page-break-after: always; }
            }
</style>
        </head>
        <body>
          <div class="print-container">
            ${getSchoolPrintHeader({ ...schoolInfo, school_logo: schoolInfo?.school_logo ?? undefined, school_email: schoolInfo?.school_email ?? undefined }, `Merit List — ${selectedTermName}`)}
            
            <!-- Table -->
            <table>
              <thead>
                <tr>
                  <th style="width:8%;">Rank</th>
                  <th style="width:14%;">Class</th>
                  <th style="width:14%;">Section</th>
                  <th style="width:8%;">Roll</th>
                  <th style="width:22%;">Student Name</th>
                  <th style="width:12%;">Total Marks</th>
                  <th style="width:10%;">GPA</th>
                  <th style="width:12%;">Grade</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>

            <!-- Summary -->
            <div class="summary">
              <p>
                Total Sections: ${meritList.filter(s => !s.is_failed_section).length} | 
                Total Students: ${meritList.filter(s => !s.is_failed_section).length}
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
    if (meritList.length === 0) {
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
  // RENDER
  // ============================================
  
  if (initialLoad) {
    return (
      <ResponsiveLayout>
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          <span className="ml-3 text-sm text-gray-500">Loading merit list data...</span>
        </div>
      </ResponsiveLayout>
    );
  }

  const hasResults = meritList.length > 0;
  const classFilterValue = selectedClass || 'all';
  const sectionFilterValue = selectedSection || 'all';

  return (
    <ResponsiveLayout>
      <div className="space-y-6">
        {/* Header Panel */}
        <div className="rounded-2xl bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-700 p-6 shadow-xl text-white">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm text-white/70 mb-1">
                <Link href="/exams/dashboard" className="flex items-center gap-1 hover:text-white transition">
                  <ArrowLeft className="h-4 w-4" /> Dashboard
                </Link>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
                <Award className="h-7 w-7 text-yellow-400" />
                Merit List
              </h1>
              <p className="text-sm text-white/80 mt-1">
                Top 3 students from each section based on academic performance
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
                onClick={generateMeritList} 
                variant="outline" 
                className="border-white/30 text-white hover:bg-white/10"
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card className="border-none shadow bg-white dark:bg-gray-950 rounded-xl">
          <CardContent className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            </div>
          </CardContent>
        </Card>

        {/* Loading State */}
        {loading && (
          <div className="bg-white dark:bg-gray-900 rounded-xl p-12 text-center shadow-sm">
            <Loader2 className="h-10 w-10 animate-spin text-indigo-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Generating merit list...</p>
          </div>
        )}

        {/* No Results */}
        {!loading && !hasResults && (
          <div className="bg-white dark:bg-gray-900 rounded-xl p-12 text-center shadow-sm border border-dashed border-gray-200 dark:border-gray-800">
            <School className="h-14 w-14 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-gray-700 dark:text-gray-300 mb-1">No Merit Data Available</h3>
            <p className="text-sm text-gray-400">
              {selectedTerm ? 'No results found for this selection. Try changing filters.' : 'Please select a term to view the merit list.'}
            </p>
          </div>
        )}

        {/* Merit List Table */}
        {!loading && hasResults && (
          <Card className="border-none shadow rounded-xl overflow-hidden bg-white dark:bg-gray-950">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
                    <th className="p-3 text-center font-bold w-28">Rank</th>
                    <th className="p-3 font-bold">Class</th>
                    <th className="p-3 font-bold">Section</th>
                    <th className="p-3 text-center font-bold w-20">Roll</th>
                    <th className="p-3 font-bold">Student Name</th>
                    <th className="p-3 text-center font-bold">Total Marks</th>
                    <th className="p-3 text-center font-bold">GPA</th>
                    <th className="p-3 text-center font-bold">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {meritList.map((student, index) => (
                    <tr 
                      key={`${student.class_name}_${student.section_name}_${student.section_rank}`}
                      className={`border-b border-slate-100 dark:border-gray-900 ${
                        student.is_failed_section 
                          ? 'bg-red-50/40 dark:bg-red-950/10 italic text-red-500' 
                          : index % 2 === 0 ? 'bg-white dark:bg-gray-950' : 'bg-slate-50/50 dark:bg-gray-900/50'
                      }`}
                    >
                      <td className="p-3 text-center font-bold">
                        {student.is_failed_section ? (
                          <span className="text-gray-400">-</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border bg-yellow-100 text-yellow-800 border-yellow-300">
                            {getRankIcon(student.section_rank)}
                            {getRankBadge(student.section_rank)}
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-bold text-gray-900 dark:text-gray-100">
                        {student.class_name}
                      </td>
                      <td className="p-3 text-slate-700 dark:text-slate-300">
                        {student.section_name}
                      </td>
                      <td className="p-3 text-center">{student.class_roll}</td>
                      <td className="p-3 font-semibold">
                        {student.is_failed_section ? (
                          <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-normal">
                            <XCircle className="h-3.5 w-3.5" /> 
                            No student passed in this section
                          </span>
                        ) : (
                          <span>
                            {student.name}
                            <span className="block text-[10px] text-gray-400 font-normal">
                              Father: {student.father_name}
                            </span>
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {student.is_failed_section ? '-' : `${student.total_marks} / ${student.full_marks}`}
                      </td>
                      <td className="p-3 text-center font-extrabold text-indigo-600">
                        {student.is_failed_section ? '-' : student.gpa.toFixed(2)}
                      </td>
                      <td className="p-3 text-center font-bold">
                        {student.is_failed_section ? '-' : student.grade}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Footer */}
            <div className="p-4 text-center text-xs text-gray-400 border-t border-gray-100 dark:border-gray-800">
              Showing top 3 students from each section • Generated on {new Date().toLocaleDateString()}
            </div>
          </Card>
        )}
      </div>
    </ResponsiveLayout>
  );
}
