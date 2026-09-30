// src/app/exams/results/dashboard/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { ResponsiveLayout } from "@/components/layout/responsive-layout";
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  TrendingUp,
  Users,
  School,
  CheckCircle,
  XCircle,
  Award,
  FileText,
  ArrowLeft,
  Calendar,
  Eye,
  Bell,
  Download,
  Printer
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { getSchoolPrintHeader } from '@/components/print/SchoolPrintHeader';

const supabase = createClient();

interface ExamTerm {
  id: string;
  name: string;
  term_code: string;
  result_status: string;
  status: string;
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

interface ResultStats {
  total_students: number;
  passed_count: number;
  failed_count: number;
  pass_percentage: number;
  fail_percentage: number;
  highest_gpa: number;
  lowest_gpa: number;
  average_gpa: number;
  published_at: string | null;
}

interface RecentResult {
   id: string;
   student_id: string;
   student_name: string;
   class_roll: string;
   gpa: number;
   grade: string;
   percentage: number;
   published_at: string;
   has_failed_compulsory: boolean;
   pass_fail_status: string;
   class_name: string;
   section_name: string;
 }

interface SchoolInfo {
  school_logo: string | null;
  school_name: string;
  school_address: string;
  school_phone: string;
  school_email: string;
}

// ============================================
// GRADING HELPER FUNCTIONS
// ============================================

const getPassFailStatus = (hasFailedCompulsory: boolean, letterGrade: string): string => {
  if (hasFailedCompulsory || letterGrade === 'F') {
    return 'Failed';
  }
  return 'Passed';
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function ResultDashboardPage() {
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);
  
  const [terms, setTerms] = useState<ExamTerm[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  
  const [selectedTerm, setSelectedTerm] = useState<string>("");
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedSection, setSelectedSection] = useState<string>("all");
  
  const [stats, setStats] = useState<ResultStats>({
    total_students: 0,
    passed_count: 0,
    failed_count: 0,
    pass_percentage: 0,
    fail_percentage: 0,
    highest_gpa: 0,
    lowest_gpa: 0,
    average_gpa: 0,
    published_at: null,
  });
  
  const [recentResults, setRecentResults] = useState<RecentResult[]>([]);
  const [topStudents, setTopStudents] = useState<RecentResult[]>([]);
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null);

  const fetchSchoolInfo = useCallback(async () => {
    const { data, error } = await supabase
      .from('school_settings')
      .select('school_name, school_address, school_phone, school_email, school_logo')
      .single();
    
    if (error) {
      console.error('Error fetching school info:', error);
      return;
    }
    if (data) {
      setSchoolInfo({
        school_logo: data.school_logo,
        school_name: data.school_name || 'Cherag Ali Memorial Academy',
        school_address: data.school_address || 'Naotola, Madhaiya Bazar, Chandina, Comilla',
        school_phone: data.school_phone || '01923253454',
        school_email: data.school_email || 'shapla.kindergarten@gmail.com'
      });
    }
  }, []);

  const fetchTerms = useCallback(async () => {
    const { data, error } = await supabase
      .from('exam_terms')
      .select('id, name, term_code, result_status, status')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching terms:', error);
      return;
    }
    if (data) {
      setTerms(data);
      if (data.length > 0 && !selectedTerm) {
        setSelectedTerm(data[0].id);
      }
    }
  }, [selectedTerm]);

  const fetchClasses = useCallback(async () => {
    const { data, error } = await supabase
      .from('classes')
      .select('id, name')
      .order('numeric_order');
    
    if (error) {
      console.error('Error fetching classes:', error);
      return;
    }
    if (data) setClasses(data);
  }, []);

  const fetchSections = useCallback(async (classId: string) => {
    if (!classId) {
      setSections([]);
      return;
    }
    const { data, error } = await supabase
      .from('sections')
      .select('id, name, class_id')
      .eq('class_id', classId)
      .order('name');
    
    if (error) {
      console.error('Error fetching sections:', error);
      return;
    }
    if (data) setSections(data);
  }, []);

  const fetchResultStats = useCallback(async () => {
    if (!selectedTerm || !selectedClass) return;
    
    setLoading(true);
    
    try {
      // Build query
      let query = supabase
        .from('compiled_results')
        .select(`
          id,
          student_id,
          gpa,
          letter_grade,
          percentage,
          has_failed_compulsory,
          failed_subjects,
          published_at,
students:student_id (
             id,
             name,
             class_roll,
             father_name,
             class_id,
             section_id,
             classes:class_id (
               id,
               name
             ),
             sections:section_id (
               id,
               name
             )
           )
        `)
        .eq('term_id', selectedTerm)
        .eq('is_published', true);
      
      // Filter by class
      if (selectedClass && selectedClass !== 'all') {
        query = query.eq('students.class_id', selectedClass);
      }
      
      // Filter by section
      if (selectedSection && selectedSection !== 'all') {
        query = query.eq('students.section_id', selectedSection);
      }
      
      const { data: results, error } = await query;
      
      if (error) {
        console.error('Supabase error:', error);
        toast.error('Failed to fetch results: ' + error.message);
        setLoading(false);
        return;
      }
      
      // Extract student data properly
      const resultsWithStudents = results?.filter((r: any) => r.students) || [];
      
      // Get total students count for this class/section
      let totalQuery = supabase
        .from('students')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active');
      
      if (selectedClass && selectedClass !== 'all') {
        totalQuery = totalQuery.eq('class_id', selectedClass);
      }
      if (selectedSection && selectedSection !== 'all') {
        totalQuery = totalQuery.eq('section_id', selectedSection);
      }
      
      const { count: totalStudents, error: countError } = await totalQuery;
      
      if (countError) {
        console.error('Error counting students:', countError);
      }
      
      if (resultsWithStudents.length > 0) {
        // Process results with corrected grade logic
        const processedResults = resultsWithStudents.map((r: any) => {
          const hasFailed = r.has_failed_compulsory === true;
          const gradeFromDB = r.letter_grade || 'F';
          const gpaFromDB = r.gpa || 0;
          
          // FIX: If failed, grade = 'F' and GPA = 0
          const displayGrade = hasFailed ? 'F' : gradeFromDB;
          const displayGpa = hasFailed ? 0 : gpaFromDB;
          
          const passFailStatus = getPassFailStatus(hasFailed, displayGrade);
          
          // Get class and section names from nested joins
          const classData = r.students?.classes;
          const sectionData = r.students?.sections;
          
          return {
            ...r,
            has_failed_compulsory: hasFailed,
            pass_fail_status: passFailStatus,
            display_grade: displayGrade,
            display_gpa: displayGpa,
            class_name: classData?.name || 'N/A',
            section_name: sectionData?.name || 'N/A',
          };
        });
        
        // Filter by class and section again (safety check)
        let filteredResults = processedResults;
        
        if (selectedClass && selectedClass !== 'all') {
          filteredResults = filteredResults.filter((r: any) => 
            r.students?.class_id === selectedClass
          );
        }
        
        if (selectedSection && selectedSection !== 'all') {
          filteredResults = filteredResults.filter((r: any) => 
            r.students?.section_id === selectedSection
          );
        }
        
        const passed = filteredResults.filter((r: any) => r.pass_fail_status === 'Passed').length;
        const failed = filteredResults.filter((r: any) => r.pass_fail_status === 'Failed').length;
        
        const gpas = filteredResults
          .map((r: any) => r.display_gpa)
          .filter((g: number) => g > 0);
        
        const total = totalStudents || filteredResults.length;
        
        setStats({
          total_students: total,
          passed_count: passed,
          failed_count: failed,
          pass_percentage: total > 0 ? (passed / total) * 100 : 0,
          fail_percentage: total > 0 ? (failed / total) * 100 : 0,
          highest_gpa: gpas.length > 0 ? Math.max(...gpas) : 0,
          lowest_gpa: gpas.length > 0 ? Math.min(...gpas) : 0,
          average_gpa: gpas.length > 0 ? gpas.reduce((a, b) => a + b, 0) / gpas.length : 0,
          published_at: filteredResults[0]?.published_at || null,
        });
        
        // Get recent results
const recent = filteredResults.slice(0, 10).map((r: any) => ({
           id: r.id,
           student_id: r.student_id,
           student_name: r.students?.name || 'Unknown',
           class_roll: r.students?.class_roll || '-',
           gpa: r.display_gpa,
           grade: r.display_grade,
           percentage: r.percentage || 0,
           published_at: r.published_at,
           has_failed_compulsory: r.has_failed_compulsory,
           pass_fail_status: r.pass_fail_status,
           class_name: r.class_name,
           section_name: r.section_name,
         }));
        setRecentResults(recent);
        
        // Get top 5 students (only passed)
const top = [...filteredResults]
           .filter((r: any) => r.pass_fail_status === 'Passed')
           .sort((a: any, b: any) => (b.display_gpa || 0) - (a.display_gpa || 0))
           .slice(0, 5)
           .map((r: any) => ({
             id: r.id,
             student_id: r.student_id,
             student_name: r.students?.name || 'Unknown',
             class_roll: r.students?.class_roll || '-',
             gpa: r.display_gpa,
             grade: r.display_grade,
             percentage: r.percentage || 0,
             published_at: r.published_at,
             has_failed_compulsory: r.has_failed_compulsory,
             pass_fail_status: r.pass_fail_status,
             class_name: r.class_name,
             section_name: r.section_name,
           }));
        setTopStudents(top);
      } else {
        setStats({
          total_students: totalStudents || 0,
          passed_count: 0,
          failed_count: 0,
          pass_percentage: 0,
          fail_percentage: 0,
          highest_gpa: 0,
          lowest_gpa: 0,
          average_gpa: 0,
          published_at: null,
        });
        setRecentResults([]);
        setTopStudents([]);
      }
      
    } catch (err) {
      console.error('Error fetching result stats:', err);
      toast.error('Failed to load result statistics');
    } finally {
      setLoading(false);
    }
  }, [selectedTerm, selectedClass, selectedSection]);

  // ============================================
  // PRINT FUNCTIONS - HTML based
  // ============================================
  
  const generatePrintHTML = (): string => {
    const termName = terms.find(t => t.id === selectedTerm)?.name || 'N/A';

    // Top students table rows
    const topRows = topStudents.map((student, idx) => {
      const rank = idx === 0 ? '1st' : idx === 1 ? '2nd' : idx === 2 ? '3rd' : `${idx + 1}th`;
      return `
        <tr>
          <td style="padding:6px 4px; text-align:center; font-weight:bold;">${rank}</td>
          <td style="padding:6px 4px; text-align:left;">${student.student_name}</td>
          <td style="padding:6px 4px; text-align:left;">${student.class_name}</td>
          <td style="padding:6px 4px; text-align:left;">${student.section_name}</td>
          <td style="padding:6px 4px; text-align:center; font-weight:bold; color:#b45309;">${student.gpa.toFixed(2)}</td>
          <td style="padding:6px 4px; text-align:center; font-weight:bold;">${student.grade}</td>
          <td style="padding:6px 4px; text-align:center;">${student.percentage.toFixed(2)}%</td>
        </tr>
      `;
    }).join('');

    // Recent results table rows
    const recentRows = recentResults.map((result) => {
      const statusColor = result.pass_fail_status === 'Failed' ? '#dc2626' : '#16a34a';
      return `
        <tr>
          <td style="padding:6px 4px; text-align:left;">${result.student_name}</td>
          <td style="padding:6px 4px; text-align:left;">${result.class_name}</td>
          <td style="padding:6px 4px; text-align:left;">${result.section_name}</td>
          <td style="padding:6px 4px; text-align:center;">${result.class_roll}</td>
          <td style="padding:6px 4px; text-align:center; font-weight:bold; color:#2563eb;">${result.gpa.toFixed(2)}</td>
          <td style="padding:6px 4px; text-align:center; font-weight:bold;">${result.grade}</td>
          <td style="padding:6px 4px; text-align:center;">
            <span style="background:${statusColor}; color:white; padding:2px 8px; border-radius:4px; font-size:10px; font-weight:bold;">
              ${result.pass_fail_status}
            </span>
          </td>
        </tr>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Result Dashboard Report</title>
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
              background: #d1fae5; 
              padding: 3px 12px; 
              border-radius: 4px; 
              border: 1px solid #6ee7b7; 
              margin-top: 8px; 
            }
            .report-title-box h2 { 
              font-size: 12px; 
              font-weight: bold; 
              color: #065f46; 
              text-transform: uppercase; 
              margin: 0; 
            }
            .stats-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 8px;
              margin-bottom: 15px;
            }
            .stat-card {
              border: 1px solid #000;
              border-radius: 4px;
              padding: 8px 10px;
              text-align: center;
            }
            .stat-card .label {
              font-size: 9px;
              color: #666;
            }
            .stat-card .value {
              font-size: 18px;
              font-weight: bold;
              margin-top: 2px;
            }
            .stat-card .sub {
              font-size: 9px;
              color: #666;
            }
            .stat-card.blue { background: #dbeafe; }
            .stat-card.green { background: #d1fae5; }
            .stat-card.red { background: #fee2e2; }
            .stat-card.purple { background: #ede9fe; }
            .stat-card.yellow { background: #fef3c7; }
            .stat-card.gray { background: #e5e7eb; }
            
            .section-title {
              font-size: 13px;
              font-weight: bold;
              padding: 8px 12px;
              border-bottom: 1px solid #000;
              margin-bottom: 8px;
            }
            .section-title .icon { margin-right: 6px; }
            
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
              font-size: 9px;
            }
            td { 
              border: 1px solid #000; 
              padding: 4px 3px; 
              text-align: center; 
              font-size: 9px;
            }
            .text-left { text-align: left; }
            .text-center { text-align: center; }
            .font-bold { font-weight: bold; }
            
            .footer { 
              text-align: center; 
              font-size: 9px; 
              color: #666; 
              border-top: 1px solid #ccc; 
              padding-top: 8px; 
              margin-top: 12px; 
            }
            
            .badge-pass { background: #16a34a; color: white; padding: 2px 8px; border-radius: 4px; font-size: 9px; font-weight: bold; }
            .badge-fail { background: #dc2626; color: white; padding: 2px 8px; border-radius: 4px; font-size: 9px; font-weight: bold; }
            
            @media print {
              body { background: white; }
              .page-break { page-break-after: always; }
            }
</style>
        </head>
        <body>
          <div class="print-container">
            ${getSchoolPrintHeader({ ...schoolInfo, school_logo: schoolInfo?.school_logo ?? undefined, school_email: schoolInfo?.school_email ?? undefined }, `Result Dashboard Report — ${termName}`)}

            <!-- Statistics -->
            <div class="stats-grid">
              <div class="stat-card blue">
                <div class="label">Total Students</div>
                <div class="value">${stats.total_students}</div>
              </div>
              <div class="stat-card green">
                <div class="label">Passed</div>
                <div class="value">${stats.passed_count}</div>
                <div class="sub">${stats.pass_percentage.toFixed(1)}%</div>
              </div>
              <div class="stat-card red">
                <div class="label">Failed</div>
                <div class="value">${stats.failed_count}</div>
                <div class="sub">${stats.fail_percentage.toFixed(1)}%</div>
              </div>
              <div class="stat-card purple">
                <div class="label">Avg. GPA</div>
                <div class="value">${stats.average_gpa.toFixed(2)}</div>
              </div>
            </div>

            <!-- GPA Range -->
            <div class="stats-grid" style="grid-template-columns: repeat(2, 1fr);">
              <div class="stat-card yellow">
                <div class="label">Highest GPA</div>
                <div class="value">${stats.highest_gpa.toFixed(2)}</div>
              </div>
              <div class="stat-card gray">
                <div class="label">Lowest GPA</div>
                <div class="value">${stats.lowest_gpa.toFixed(2)}</div>
              </div>
            </div>

            <!-- Top Students -->
            ${topStudents.length > 0 ? `
            <div style="margin-top:15px;">
              <div class="section-title">🏆 Top 5 Students</div>
              <table>
                <thead>
                  <tr>
                    <th style="width:8%;">Rank</th>
                    <th style="width:22%;">Student Name</th>
                    <th style="width:15%;">Class</th>
                    <th style="width:15%;">Section</th>
                    <th style="width:10%;">GPA</th>
                    <th style="width:10%;">Grade</th>
                    <th style="width:20%;">Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  ${topRows}
                </tbody>
              </table>
            </div>
            ` : ''}

            <!-- Recent Results -->
            ${recentResults.length > 0 ? `
            <div style="margin-top:15px;">
              <div class="section-title">📋 Recent Results</div>
              <table>
                <thead>
                  <tr>
                    <th style="width:18%;">Student Name</th>
                    <th style="width:12%;">Class</th>
                    <th style="width:12%;">Section</th>
                    <th style="width:8%;">Roll</th>
                    <th style="width:10%;">GPA</th>
                    <th style="width:10%;">Grade</th>
                    <th style="width:15%;">Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${recentRows}
                </tbody>
              </table>
            </div>
            ` : ''}

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
    if (!isPublished) {
      toast.warning('No published results to print');
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

  useEffect(() => {
    fetchSchoolInfo();
    fetchTerms();
    fetchClasses();
  }, []);

  useEffect(() => {
    if (selectedClass) {
      fetchSections(selectedClass);
    } else {
      setSections([]);
    }
  }, [selectedClass, fetchSections]);

  useEffect(() => {
    if (selectedTerm && selectedClass) {
      fetchResultStats();
    }
  }, [selectedTerm, selectedClass, selectedSection, fetchResultStats]);

  const needsSelection = !selectedTerm || !selectedClass;
  const isPublished = stats.published_at !== null && stats.total_students > 0;

  const sectionFilterValue = selectedSection || 'all';

  return (
    <ResponsiveLayout>
      <div className="space-y-6">
        
        {/* Header */}
        <div className="rounded-3xl bg-gradient-to-r from-emerald-700 via-teal-700 to-cyan-800 p-6 shadow-2xl">
          <div className="flex flex-col lg:flex-row gap-4 justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Link href="/exams/dashboard">
                  <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/20 -ml-2">
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Dashboard
                  </Button>
                </Link>
              </div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <Eye className="h-8 w-8" />
                Result Dashboard
                <Badge className="bg-teal-400 text-black ml-2">Analytics</Badge>
              </h1>
              <p className="text-emerald-100 mt-2">View published exam results statistics</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button 
                onClick={handlePrint}
                disabled={printing || !isPublished}
                variant="outline"
                className="bg-white/20 hover:bg-white/30 text-white border-0"
              >
                {printing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                Print Report
              </Button>
              <Button 
                onClick={fetchResultStats} 
                disabled={loading || needsSelection}
                variant="outline" 
                className="bg-white/20 hover:bg-white/30 text-white border-0"
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card className="border-0 shadow-lg rounded-3xl bg-gradient-to-r from-slate-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Exam Term</Label>
                <Select value={selectedTerm} onValueChange={setSelectedTerm}>
                  <SelectTrigger className="bg-white dark:bg-gray-800">
                    <SelectValue placeholder="Select term" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px] overflow-y-auto bg-white dark:bg-gray-800">
                    {terms.map((term) => (
                      <SelectItem key={term.id} value={term.id}>
                        {term.name} {term.result_status === 'published' && '(Published)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Class</Label>
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger className="bg-white dark:bg-gray-800">
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px] overflow-y-auto bg-white dark:bg-gray-800">
                    <SelectItem value="all">All Classes</SelectItem>
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Section</Label>
                <Select 
                  value={sectionFilterValue} 
                  onValueChange={setSelectedSection}
                  disabled={!selectedClass || selectedClass === 'all'}
                >
                  <SelectTrigger className="bg-white dark:bg-gray-800">
                    <SelectValue placeholder={sections.length === 0 ? "No sections" : "All Sections"} />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px] overflow-y-auto bg-white dark:bg-gray-800">
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
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-teal-600 dark:text-teal-400 mb-3" />
            <p className="text-sm text-gray-500">Loading result statistics...</p>
          </div>
        )}

        {/* No Selection */}
        {!loading && needsSelection && (
          <Card className="rounded-3xl border-0 shadow-lg bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <AlertCircle className="h-10 w-10 text-amber-600 mb-4" />
              <p className="text-gray-500">Please select exam term and class to view result dashboard.</p>
            </CardContent>
          </Card>
        )}

        {/* No Published Results */}
        {!loading && !needsSelection && !isPublished && (
          <Card className="rounded-3xl border-0 shadow-lg bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-950/30 dark:to-amber-950/30">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Bell className="h-12 w-12 text-yellow-600 mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Published Results</h2>
              <p className="text-gray-500 max-w-md">
                Results for this exam term and class have not been published yet.
                Please go to Publish Result page to publish.
              </p>
              <Link href="/exams/results/publish">
                <Button className="mt-4 bg-gradient-to-r from-yellow-500 to-amber-500 text-white">
                  <Bell className="mr-2 h-4 w-4" />
                  Publish Results
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Statistics Cards */}
        {!loading && !needsSelection && isPublished && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="rounded-2xl border-0 shadow-md bg-gradient-to-br from-blue-500 to-blue-600">
                <CardContent className="p-5">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm text-white/80">Total Students</p>
                      <p className="text-3xl font-bold text-white">{stats.total_students}</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                      <Users className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-0 shadow-md bg-gradient-to-br from-green-500 to-emerald-600">
                <CardContent className="p-5">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm text-white/80">Passed</p>
                      <p className="text-3xl font-bold text-white">{stats.passed_count}</p>
                      <p className="text-xs text-white/70">{stats.pass_percentage.toFixed(1)}%</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                      <CheckCircle className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-0 shadow-md bg-gradient-to-br from-red-500 to-red-600">
                <CardContent className="p-5">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm text-white/80">Failed</p>
                      <p className="text-3xl font-bold text-white">{stats.failed_count}</p>
                      <p className="text-xs text-white/70">{stats.fail_percentage.toFixed(1)}%</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                      <XCircle className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-0 shadow-md bg-gradient-to-br from-purple-500 to-indigo-600">
                <CardContent className="p-5">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm text-white/80">Avg. GPA</p>
                      <p className="text-3xl font-bold text-white">{stats.average_gpa.toFixed(2)}</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                      <TrendingUp className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* GPA Range Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="rounded-2xl border-0 shadow-md bg-gradient-to-br from-yellow-500 to-amber-600">
                <CardContent className="p-5">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm text-white/80">Highest GPA</p>
                      <p className="text-3xl font-bold text-white">{stats.highest_gpa.toFixed(2)}</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                      <Award className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-0 shadow-md bg-gradient-to-br from-gray-500 to-gray-600">
                <CardContent className="p-5">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm text-white/80">Lowest GPA</p>
                      <p className="text-3xl font-bold text-white">{stats.lowest_gpa.toFixed(2)}</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                      <FileText className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Top Students */}
            {topStudents.length > 0 && (
              <Card className="border-0 shadow-lg rounded-3xl overflow-hidden bg-white dark:bg-gray-900">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Award className="h-5 w-5 text-yellow-600" />
                    Top 5 Students
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gradient-to-r from-amber-500 to-yellow-600">
                      <tr>
                        <th className="px-4 py-3 text-left text-white">Rank</th>
                        <th className="px-4 py-3 text-left text-white">Student Name</th>
                        <th className="px-4 py-3 text-left text-white">Class</th>
                        <th className="px-4 py-3 text-left text-white">Section</th>
                        <th className="px-4 py-3 text-center text-white">GPA</th>
                        <th className="px-4 py-3 text-center text-white">Grade</th>
                        <th className="px-4 py-3 text-center text-white">Percentage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topStudents.map((student, idx) => (
                        <tr key={student.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="px-4 py-3">
                            {idx === 0 ? (
                              <Badge className="bg-gradient-to-r from-yellow-500 to-amber-500 text-white">1st</Badge>
                            ) : idx === 1 ? (
                              <Badge className="bg-gradient-to-r from-gray-400 to-gray-500 text-white">2nd</Badge>
                            ) : idx === 2 ? (
                              <Badge className="bg-gradient-to-r from-amber-600 to-orange-600 text-white">3rd</Badge>
                            ) : (
                              <Badge variant="outline">{idx + 1}th</Badge>
                            )}
                          </td>
                          <td className="font-medium">{student.student_name}</td>
                          <td>{student.class_name}</td>
                          <td>{student.section_name}</td>
                          <td className="text-center font-semibold text-amber-600">{student.gpa.toFixed(2)}</td>
                          <td className="text-center">
                            <Badge variant="outline" className="border-amber-200 bg-amber-50">
                              {student.grade}
                            </Badge>
                          </td>
                          <td className="text-center">{student.percentage.toFixed(2)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* Recent Results */}
            {recentResults.length > 0 && (
              <Card className="border-0 shadow-lg rounded-3xl overflow-hidden bg-white dark:bg-gray-900">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-blue-600" />
                    Recent Results
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gradient-to-r from-blue-500 to-cyan-600">
                      <tr>
                        <th className="px-4 py-3 text-left text-white">Student Name</th>
                        <th className="px-4 py-3 text-left text-white">Class</th>
                        <th className="px-4 py-3 text-left text-white">Section</th>
                        <th className="px-4 py-3 text-left text-white">Roll</th>
                        <th className="px-4 py-3 text-center text-white">GPA</th>
                        <th className="px-4 py-3 text-center text-white">Grade</th>
                        <th className="px-4 py-3 text-center text-white">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentResults.map((result) => (
                        <tr key={result.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="font-medium">{result.student_name}</td>
                          <td>{result.class_name}</td>
                          <td>{result.section_name}</td>
                          <td>{result.class_roll}</td>
                          <td className="text-center font-semibold text-blue-600">{result.gpa.toFixed(2)}</td>
                          <td className="text-center">
                            <Badge variant="outline" className={
                              result.grade === 'F' ? 'border-red-200 bg-red-50 text-red-600 font-bold' :
                              result.grade === 'A+' ? 'border-green-200 bg-green-50 text-green-600' :
                              'border-blue-200 bg-blue-50 text-blue-600'
                            }>
                              {result.grade}
                            </Badge>
                          </td>
                          <td className="text-center">
                            {result.pass_fail_status === 'Failed' ? (
                              <Badge variant="error" className="bg-red-500">Failed</Badge>
                            ) : (
                              <Badge className="bg-green-500 text-white">Passed</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </ResponsiveLayout>
  );
}
