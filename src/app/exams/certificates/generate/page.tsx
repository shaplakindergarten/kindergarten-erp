'use client';

import { useState, useEffect, useCallback } from 'react';
import { ResponsiveLayout } from "@/components/layout/responsive-layout";
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Loader2, 
  RefreshCw, 
  AlertCircle,
  Printer,
  ArrowLeft,
  FileText,
  Eye,
  Sparkles,
  Search,
  CheckCircle2,
  User,
  GraduationCap,
  Filter,
  School,
  Building2,
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import Image from 'next/image';

const supabase = createClient();

interface ExamTerm {
  id: string;
  name: string;
  term_code: string;
}

interface ClassItem {
  id: string;
  name: string;
}

interface Section {
  id: string;
  name: string;
}

interface CertificateTemplate {
  id: string;
  name: string;
  template_type: string;
  header_html: string;
  body_html: string;
  footer_html: string;
  signature_settings: any;
  is_active: boolean;
}

interface Student {
  id: string;
  name: string;
  class_roll: string;
  father_name: string;
  mother_name: string;
  student_id: string;
  dob: string;
  gender: string;
  blood_group: string;
  address: string;
  gpa?: number;
  grade?: string;
  position?: number;
  has_passed?: boolean;
  reg_no?: string;
  passed_class?: string;
  class_name?: string;
  section_name?: string;
  exam_year?: string;
}

interface SchoolSettings {
  name: string;
  address: string;
  email: string;
  phone: string;
  logo_url: string;
}

export default function GenerateCertificatesPage() {
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  
  const [terms, setTerms] = useState<ExamTerm[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings>({
    name: 'Shapla Kindergarten & Pre-Cadet',
    address: 'Station Road, Tongi, Gazipur, Dhaka',
    email: 'shaplakindergarten@gmail.com',
    phone: '+880 1923-253454',
    logo_url: ''
  });
  
  const [selectedTerm, setSelectedTerm] = useState<string>("");
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedSection, setSelectedSection] = useState<string>("all");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewStudent, setPreviewStudent] = useState<Student | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // --- Data Fetching ---
  const fetchTerms = useCallback(async () => {
    const { data, error } = await supabase
      .from('exam_terms')
      .select('id, name, term_code')
      .order('created_at');
    
    if (error) {
      console.error('Error fetching terms:', error);
      toast.error('Failed to load terms');
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
      toast.error('Failed to load classes');
      return;
    }
    if (data) setClasses(data);
  }, []);

  const fetchSections = useCallback(async (classId: string) => {
    if (!classId) return;
    
    const { data, error } = await supabase
      .from('sections')
      .select('id, name')
      .eq('class_id', classId);
    
    if (error) {
      console.error('Error fetching sections:', error);
      return;
    }
    if (data) setSections(data);
  }, []);

  const fetchTemplates = useCallback(async () => {
    const { data, error } = await supabase
      .from('certificate_templates')
      .select('*')
      .eq('is_active', true)
      .order('created_at');
    
    if (error) {
      console.error('Error fetching templates:', error);
      toast.error('Failed to load templates');
      return;
    }
    if (data) {
      setTemplates(data);
      if (data.length > 0 && !selectedTemplate) {
        setSelectedTemplate(data[0].id);
      }
    }
  }, [selectedTemplate]);

  const fetchSchoolSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('school_settings')
        .select('school_name, school_address, school_email, school_phone, school_logo')
        .limit(1)
        .maybeSingle();
      
      if (!error && data) {
        setSchoolSettings({
          name: data.school_name || 'Shapla Kindergarten & Pre-Cadet',
          address: data.school_address || 'Station Road, Tongi, Gazipur, Dhaka',
          email: data.school_email || 'shaplakindergarten@gmail.com',
          phone: data.school_phone || '+880 1923-253454',
          logo_url: data.school_logo || ''
        });
      }
    } catch (err) {
      console.error('Error fetching school settings:', err);
    }
  }, []);

  const fetchStudentsWithResults = useCallback(async () => {
    if (!selectedTerm || !selectedClass) {
      console.log('Missing selection:', { selectedTerm, selectedClass });
      return;
    }
    
    setLoading(true);
    
    try {
      console.log('Fetching students for class:', selectedClass, 'section:', selectedSection);
      
      let studentQuery = supabase
        .from('students')
        .select(`
          id, 
          name, 
          class_roll, 
          father_name, 
          mother_name, 
          student_id,
          dob,
          gender,
          blood_group,
          address
        `)
        .eq('status', 'active')
        .eq('class_id', selectedClass);
       
      if (selectedSection && selectedSection !== 'all') {
        studentQuery = studentQuery.eq('section_id', selectedSection);
      }
       
      const { data: studentsData, error: studentsError } = await studentQuery.order('class_roll');
      
      if (studentsError) {
        console.error('Students fetch error:', studentsError);
        throw studentsError;
      }
      
      console.log('Students found:', studentsData?.length || 0);
      
      if (!studentsData || studentsData.length === 0) {
        setStudents([]);
        setLoading(false);
        toast.info('No students found in this class/section');
        return;
      }
      
      const studentIds = studentsData.map(s => s.id);
      
      const { data: resultsData, error: resultsError } = await supabase
        .from('compiled_results')
        .select('student_id, gpa, letter_grade, result_status, has_failed_compulsory, merit_position, class_rank')
        .eq('term_id', selectedTerm)
        .in('student_id', studentIds);
      
      if (resultsError) {
        console.error('Results fetch error:', resultsError);
      }
      
      console.log('Results found:', resultsData?.length || 0);
      
      const resultsMap = new Map();
      if (resultsData) {
        resultsData.forEach(r => {
          const hasPassed = r.result_status === 'published' || 
                           (r.result_status === 'generated' && !r.has_failed_compulsory);
          
          resultsMap.set(r.student_id, {
            gpa: r.gpa || 0,
            grade: r.letter_grade || 'N/A',
            has_passed: hasPassed,
            position: r.merit_position || r.class_rank || null,
          });
        });
      }
      
      const classObj = classes.find(c => c.id === selectedClass);
      const sectionObj = sections.find(s => s.id === selectedSection);
      
      let studentsWithResults = studentsData.map(s => {
        const result = resultsMap.get(s.id);
        return {
          id: s.id,
          name: s.name,
          class_roll: s.class_roll || '',
          father_name: s.father_name || '',
          mother_name: s.mother_name || '',
          student_id: s.student_id || '',
          dob: s.dob ? new Date(s.dob).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }) : 'N/A',
          gender: s.gender || 'N/A',
          blood_group: s.blood_group || 'N/A',
          address: s.address || 'N/A',
          reg_no: s.student_id || '',
          gpa: result?.gpa || 0,
          grade: result?.grade || 'N/A',
          has_passed: result?.has_passed || false,
          position: result?.position || null,
          class_name: classObj?.name || '',
          section_name: sectionObj?.name || '',
          passed_class: classObj?.name || '',
          exam_year: new Date().getFullYear().toString(),
        };
      });
      
      console.log('Merged students:', studentsWithResults.length);
      
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        studentsWithResults = studentsWithResults.filter(s => 
          s.name.toLowerCase().includes(query) ||
          s.class_roll?.toLowerCase().includes(query) ||
          s.father_name?.toLowerCase().includes(query) ||
          s.student_id?.toLowerCase().includes(query) ||
          s.address?.toLowerCase().includes(query)
        );
      }
      
      setStudents(studentsWithResults);
      setSelectedStudentIds([]);
      
      if (studentsWithResults.length === 0 && studentsData.length > 0) {
        toast.info('No students match the current filters');
      }
      
    } catch (err) {
      console.error('Error fetching students with results:', err);
      toast.error('Failed to load student data');
    } finally {
      setLoading(false);
    }
  }, [selectedTerm, selectedClass, selectedSection, searchQuery, classes, sections]);

  // --- Certificate Generation ---
  const generateCertificateHtml = (student: Student, template: CertificateTemplate) => {
    const term = terms.find(t => t.id === selectedTerm);
    
    const position = student.position || 0;
    let positionSuffix = 'th';
    if (position === 1) positionSuffix = 'st';
    else if (position === 2) positionSuffix = 'nd';
    else if (position === 3) positionSuffix = 'rd';
    
    // Replace all placeholders with actual data
    const replacements: Record<string, string> = {
      // School info
      school_name: schoolSettings.name,
      school_address: schoolSettings.address,
      school_email: schoolSettings.email,
      school_phone: schoolSettings.phone,
      
      // Student info
      student_name: student.name,
      father_name: student.father_name || 'N/A',
      mother_name: student.mother_name || 'N/A',
      student_id: student.student_id || '',
      roll_no: student.class_roll || 'N/A',
      class_name: student.class_name || '',
      section_name: student.section_name || '',
      dob: student.dob || 'N/A',
      gender: student.gender || 'N/A',
      religion: 'N/A', // Not in students table
      blood_group: student.blood_group || 'N/A',
      address: student.address || 'N/A',
      reg_no: student.reg_no || '',
      passed_class: student.passed_class || student.class_name || '',
      
      // Exam info
      exam_name: term?.name || '',
      exam_year: student.exam_year || new Date().getFullYear().toString(),
      
      // Results
      gpa: student.gpa?.toFixed(2) || 'N/A',
      grade: student.grade || 'N/A',
      position: position.toString(),
      position_suffix: positionSuffix,
      
      // Other
      serial_no: String(students.findIndex(s => s.id === student.id) + 1).padStart(4, '0'),
      date: new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }),
    };
    
    // Add logo to header if available
    let headerHtml = template.header_html || '';
    if (schoolSettings.logo_url) {
      headerHtml = headerHtml.replace(
        /<span style="font-size: 28px; font-weight: 900; color: #[a-fA-F0-9]+;">[^<]*<\/span>/,
        `<img src="${schoolSettings.logo_url}" alt="School Logo" style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover; border: 3px solid #1e3a8a;" />`
      );
    }
    
    // Build full HTML
    let html = `
      <div style="font-family: 'Times New Roman', Georgia, serif; max-width: 800px; margin: 0 auto; background: white; border-radius: 4px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.06);">
        ${headerHtml}
        ${template.body_html || ''}
        ${template.footer_html || ''}
      </div>
    `;
    
    // Replace all placeholders
    Object.entries(replacements).forEach(([key, value]) => {
      html = html.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });
    
    return html;
  };

  const handlePreview = (student: Student) => {
    const template = templates.find(t => t.id === selectedTemplate);
    if (!template) {
      toast.error('Please select a template');
      return;
    }
    setPreviewHtml(generateCertificateHtml(student, template));
    setPreviewStudent(student);
    setPreviewOpen(true);
  };

  const handleGenerateAndPrint = async () => {
    if (selectedStudentIds.length === 0) {
      toast.error('Please select at least one student');
      return;
    }
    
    const template = templates.find(t => t.id === selectedTemplate);
    if (!template) {
      toast.error('Please select a template');
      return;
    }
    
    setGenerating(true);
    
    try {
      const certificatesHtml = selectedStudentIds.map((studentId, index) => {
        const student = students.find(s => s.id === studentId);
        if (!student) return '';
        const html = generateCertificateHtml(student, template);
        return index < selectedStudentIds.length - 1 
          ? `${html}<div style="page-break-after: always; height: 20px;"></div>` 
          : html;
      }).join('');
      
      const printWindow = window.open('', '_blank', 'width=900,height=650,menubar=no,toolbar=no,location=no,status=no,scrollbars=yes');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Certificates - ${terms.find(t => t.id === selectedTerm)?.name || ''}</title>
            <style>
              @page { 
                size: A4 portrait; 
                margin: 8mm; 
              }
              @media print {
                body { margin: 0; padding: 0; }
                .page-break { page-break-after: always; height: 20px; }
              }
              body { 
                font-family: 'Times New Roman', Georgia, serif; 
                margin: 0; 
                padding: 10px;
                background: #f0f0f0;
              }
              .certificate-wrapper {
                max-width: 800px;
                margin: 0 auto 20px auto;
                background: white;
                border-radius: 4px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                overflow: hidden;
              }
              @media print {
                body { background: white; padding: 0; }
                .certificate-wrapper { 
                  box-shadow: none; 
                  border-radius: 0;
                  margin: 0 auto;
                  page-break-inside: avoid;
                }
              }
            </style>
          </head>
          <body>
            ${certificatesHtml}
            <script>
              window.onload = function() { 
                setTimeout(function() { 
                  window.print(); 
                  setTimeout(function() { 
                    window.close(); 
                  }, 800);
                }, 500);
              }
            <\/script>
          </body>
          </html>
        `);
        printWindow.document.close();
      }
      
      toast.success(`Generated ${selectedStudentIds.length} certificates`);
    } catch (err) {
      console.error('Error generating certificates:', err);
      toast.error('Failed to generate certificates');
    } finally {
      setGenerating(false);
    }
  };

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudentIds(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const toggleAllStudents = () => {
    if (selectedStudentIds.length === students.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(students.map(s => s.id));
    }
  };

  // --- Effects ---
  useEffect(() => {
    fetchTerms();
    fetchClasses();
    fetchTemplates();
    fetchSchoolSettings();
  }, []);

  useEffect(() => {
    if (selectedClass) {
      fetchSections(selectedClass);
      setSelectedSection('all');
    }
  }, [selectedClass]);

  useEffect(() => {
    if (selectedTerm && selectedClass) {
      fetchStudentsWithResults();
    }
  }, [selectedTerm, selectedClass, selectedSection, searchQuery]);

  const needsSelection = !selectedTerm || !selectedClass || !selectedTemplate;

  return (
    <ResponsiveLayout>
      <div className="space-y-6 max-w-7xl mx-auto pb-10 px-3 sm:px-4 lg:px-6">
        
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-700 via-teal-700 to-cyan-800 p-6 sm:p-8 shadow-2xl">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-400 rounded-full blur-3xl translate-x-20 -translate-y-20"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-400 rounded-full blur-3xl -translate-x-20 translate-y-20"></div>
          </div>
          <div className="relative z-10 flex flex-col sm:flex-row gap-4 justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <Link href="/exams/dashboard">
                  <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/20 -ml-2">
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Dashboard
                  </Button>
                </Link>
                <Link href="/exams/certificates/templates">
                  <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/20">
                    <FileText className="h-4 w-4 mr-1" />
                    Templates
                  </Button>
                </Link>
                <Link href="/exams/settings/print">
                  <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/20">
                    <Printer className="h-4 w-4 mr-1" />
                    Print Settings
                  </Button>
                </Link>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
                <Sparkles className="h-8 w-8 text-emerald-300" />
                Generate Certificates
                <Badge className="bg-emerald-400 text-black ml-2">Batch Print</Badge>
              </h1>
              <p className="text-emerald-100 mt-1 text-sm">Select students and generate professional certificates</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <Button 
                onClick={handleGenerateAndPrint}
                disabled={generating || selectedStudentIds.length === 0 || !selectedTemplate}
                className="bg-white/20 hover:bg-white/30 text-white border-0 shadow-lg shadow-white/10 w-full sm:w-auto"
              >
                {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                Print ({selectedStudentIds.length})
              </Button>
              <Button 
                onClick={fetchStudentsWithResults} 
                disabled={loading || !selectedTerm || !selectedClass}
                variant="outline" 
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 w-full sm:w-auto"
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* Filter Section */}
        <Card className="border-0 shadow-lg rounded-2xl bg-white dark:bg-gray-900">
          <CardContent className="p-4 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                  <GraduationCap className="h-4 w-4" /> Exam Term
                </Label>
                <Select value={selectedTerm} onValueChange={setSelectedTerm}>
                  <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                    <SelectValue placeholder="Select term" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px] overflow-y-auto">
                    {terms.map((term) => (
                      <SelectItem key={term.id} value={term.id}>{term.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                  <School className="h-4 w-4" /> Class
                </Label>
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px] overflow-y-auto">
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                  <Filter className="h-4 w-4" /> Section
                </Label>
                <Select value={selectedSection} onValueChange={setSelectedSection}>
                  <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                    <SelectValue placeholder="Select section" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px] overflow-y-auto">
                    <SelectItem value="all">All Sections</SelectItem>
                    {sections.map((section) => (
                      <SelectItem key={section.id} value={section.id}>{section.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                  <FileText className="h-4 w-4" /> Certificate Template
                </Label>
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                    <SelectValue placeholder="Select template" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px] overflow-y-auto">
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        <span className="flex items-center gap-2">
                          <span>
                            {template.template_type === 'testimonial' && '📜'}
                            {template.template_type === 'transfer_certificate' && '📄'}
                            {template.template_type === 'certificate' && '🏅'}
                          </span>
                          {template.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Search Bar */}
        <Card className="border-0 shadow-lg rounded-2xl bg-white dark:bg-gray-900">
          <CardContent className="p-4 sm:p-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
              <Input
                placeholder="Search by name, roll, father's name, admission no or address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
              />
            </div>
          </CardContent>
        </Card>

        {/* Students List */}
        <Card className="border-0 shadow-lg rounded-2xl overflow-hidden bg-white dark:bg-gray-900">
          <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div className="flex items-center gap-3">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <User className="h-5 w-5" />
                Students <Badge variant="secondary" className="ml-1 bg-gray-100 dark:bg-gray-800">{students.length}</Badge>
              </h3>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {selectedStudentIds.length} selected
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={toggleAllStudents} className="w-full sm:w-auto dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
              {selectedStudentIds.length === students.length && students.length > 0 ? 'Deselect All' : 'Select All'}
            </Button>
          </div>
          
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-600 dark:text-emerald-400" />
            </div>
          ) : students.length === 0 ? (
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-20 w-20 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                <AlertCircle className="h-10 w-10 text-gray-400 dark:text-gray-500" />
              </div>
              <p className="text-gray-500 dark:text-gray-400">No students found matching the criteria</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Try adjusting your filters</p>
            </CardContent>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-emerald-500 to-teal-600">
                  <tr>
                    <th className="px-3 sm:px-4 py-3 text-left text-white w-10 sm:w-12">
                      <Checkbox
                        checked={selectedStudentIds.length === students.length && students.length > 0}
                        onCheckedChange={toggleAllStudents}
                        className="border-white/50 data-[state=checked]:bg-white data-[state=checked]:text-emerald-600"
                      />
                    </th>
                    <th className="px-2 sm:px-4 py-3 text-left text-white text-xs sm:text-sm">Roll</th>
                    <th className="px-2 sm:px-4 py-3 text-left text-white text-xs sm:text-sm">Student Name</th>
                    <th className="px-2 sm:px-4 py-3 text-left text-white hidden md:table-cell text-xs sm:text-sm">Father's Name</th>
                    <th className="px-2 sm:px-4 py-3 text-center text-white text-xs sm:text-sm hidden sm:table-cell">GPA</th>
                    <th className="px-2 sm:px-4 py-3 text-center text-white text-xs sm:text-sm hidden lg:table-cell">Grade</th>
                    <th className="px-2 sm:px-4 py-3 text-center text-white text-xs sm:text-sm">Preview</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => (
                    <tr key={student.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-3 sm:px-4 py-2 sm:py-3">
                        <Checkbox
                          checked={selectedStudentIds.includes(student.id)}
                          onCheckedChange={() => toggleStudentSelection(student.id)}
                          className="border-gray-300 dark:border-gray-600"
                        />
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 font-medium text-sm text-gray-900 dark:text-white">
                        {student.class_roll || '-'}
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{student.name}</span>
                          {student.position && student.position <= 3 && (
                            <span className="text-base">
                              {student.position === 1 ? '🥇' : student.position === 2 ? '🥈' : '🥉'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-sm text-gray-500 dark:text-gray-400 hidden md:table-cell">
                        {student.father_name || '-'}
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-center hidden sm:table-cell">
                        <span className={`text-sm font-semibold ${(student.gpa || 0) >= 3.5 ? 'text-emerald-600 dark:text-emerald-400' : (student.gpa || 0) >= 2.5 ? 'text-amber-600 dark:text-amber-400' : 'text-red-500 dark:text-red-400'}`}>
                          {student.gpa?.toFixed(2) || 'N/A'}
                        </span>
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-center hidden lg:table-cell">
                        <Badge variant="outline" className={`text-xs ${student.grade === 'A+' || student.grade === 'A' ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : student.grade === 'B' || student.grade === 'C' ? 'border-amber-500 text-amber-600 dark:text-amber-400' : 'border-red-500 text-red-500 dark:text-red-400'}`}>
                          {student.grade || 'N/A'}
                        </Badge>
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePreview(student)}
                          disabled={!selectedTemplate}
                          className="hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950 dark:hover:text-emerald-400"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Preview Dialog */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="sm:max-w-3xl max-h-[95vh] overflow-y-auto bg-white dark:bg-gray-900 p-4 sm:p-6 w-[95vw] sm:w-full">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg text-gray-900 dark:text-white">
                <FileText className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                Certificate Preview - {previewStudent?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="py-4 bg-gray-50 dark:bg-gray-950 rounded-xl p-3 sm:p-4 overflow-x-auto border border-gray-200 dark:border-gray-800">
              <div className="scale-[0.8] sm:scale-90 lg:scale-100 origin-top" dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setPreviewOpen(false)} className="w-full sm:w-auto order-2 sm:order-1 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
                Close
              </Button>
              <Button 
                onClick={() => {
                  if (previewStudent) {
                    const template = templates.find(t => t.id === selectedTemplate);
                    if (template) {
                      const printWindow = window.open('', '_blank', 'width=900,height=650');
                      if (printWindow) {
                        const html = generateCertificateHtml(previewStudent, template);
                        printWindow.document.write(`
                          <!DOCTYPE html>
                          <html>
                          <head>
                            <title>Certificate - ${previewStudent.name}</title>
                            <style>
                              @page { size: A4 portrait; margin: 8mm; }
                              @media print { body { margin: 0; padding: 0; } }
                              body { font-family: 'Times New Roman', Georgia, serif; margin: 0; padding: 10px; background: white; }
                            </style>
                          </head>
                          <body>
                            ${html}
                            <script>
                              window.onload = function() { 
                                window.print(); 
                                setTimeout(function() { window.close(); }, 500);
                              }
                            <\/script>
                          </body>
                          </html>
                        `);
                        printWindow.document.close();
                      }
                    }
                  }
                }}
                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg shadow-emerald-600/25 gap-2 w-full sm:w-auto order-1 sm:order-2"
              >
                <Printer className="h-4 w-4" />
                Print Single
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </ResponsiveLayout>
  );
}
