// src/app/exams/marks/submit/page.tsx

'use client';

import { useState, useEffect, useCallback, useRef, useMemo, useTransition } from 'react';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Loader2, 
  RefreshCw, 
  AlertCircle,
  Send,
  Users,
  BookOpen,
  ArrowLeft,
  School,
  Layers
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

const supabase = createClient();

interface ExamTerm {
  id: string;
  name: string;
}

interface ClassItem {
  id: string;
  name: string;
}

interface Section {
  id: string;
  name: string;
}

interface Subject {
  id: string;
  name: string;
  code: string;
}

interface ExamSubject {
  id: string;
  subject_id: string;
  full_marks: number;
  pass_marks: number;
  subject?: Subject;
}

interface SubjectStatus {
  exam_subject_id: string;
  subject_name: string;
  full_marks: number;
  draft_count: number;
  submitted_count: number;
  verified_count: number;
  locked_count: number;
  completed_count: number;
  total_students: number;
  can_submit: boolean;
}

interface SubmitSummary {
  term_name: string;
  class_name: string;
  section_name: string;
  total_students: number;
  subjects: SubjectStatus[];
}

// Types for marks data
interface MarkRecord {
  entry_status: string;
  exam_subject_id: string;
  student_id: string;
}

// Custom state type for better UX
type DataState = 'idle' | 'loading' | 'loaded' | 'no_subjects' | 'no_students' | 'error';

// Helper function to chunk array for batch processing
const chunkArray = <T,>(arr: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

// Helper function to check if request is aborted
const isAborted = (controller: AbortController | null): boolean => {
  return controller?.signal.aborted === true;
};

export default function MarksSubmitPage() {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [dataState, setDataState] = useState<DataState>('idle');
  const [, startTransition] = useTransition();
  
  // Selection state - using undefined instead of empty string to avoid Select item error
  const [terms, setTerms] = useState<ExamTerm[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [sectionsLoaded, setSectionsLoaded] = useState(false);
  
  const [selectedTerm, setSelectedTerm] = useState<string | undefined>(undefined);
  const [selectedClass, setSelectedClass] = useState<string | undefined>(undefined);
  const [selectedSection, setSelectedSection] = useState<string | undefined>(undefined);
  
  const [summary, setSummary] = useState<SubmitSummary | null>(null);
  
  // AbortController for canceling stale requests
  const abortControllerRef = useRef<AbortController | null>(null);
  const isFetchingRef = useRef(false);
  const isMountedRef = useRef(true);
  
  // Refs for maps to avoid dependency issues
  const termsMapRef = useRef<Map<string, ExamTerm>>(new Map());
  const classesMapRef = useRef<Map<string, ClassItem>>(new Map());
  const sectionsMapRef = useRef<Map<string, Section>>(new Map());

  // Reset summary helper
  const resetSummary = useCallback(() => {
    setSummary(null);
    setDataState('idle');
  }, []);

  // Fetch terms
  const fetchTerms = useCallback(async () => {
    const { data, error } = await supabase
      .from('exam_terms')
      .select('id, name')
      .order('created_at');
    
    if (error) {
      console.error('Error fetching terms:', error);
      return;
    }
    
    if (data && data.length > 0 && isMountedRef.current) {
      setTerms(data);
      // Update ref map
      const map = new Map<string, ExamTerm>();
      data.forEach(t => map.set(t.id, t));
      termsMapRef.current = map;
    }
  }, []);

  // Fetch classes
  const fetchClasses = useCallback(async () => {
    const { data, error } = await supabase
      .from('classes')
      .select('id, name')
      .order('numeric_order');
    
    if (error) {
      console.error('Error fetching classes:', error);
      return;
    }
    
    if (data && data.length > 0 && isMountedRef.current) {
      setClasses(data);
      // Update ref map
      const map = new Map<string, ClassItem>();
      data.forEach(c => map.set(c.id, c));
      classesMapRef.current = map;
    }
  }, []);

  // Fetch sections
  const fetchSections = useCallback(async (classId: string) => {
    if (!classId) return;
    
    setSectionsLoaded(false);
    
    const { data, error } = await supabase
      .from('sections')
      .select('id, name')
      .eq('class_id', classId);
    
    if (error) {
      console.error('Error fetching sections:', error);
      setSectionsLoaded(true);
      return;
    }
    
    if (data && data.length > 0 && isMountedRef.current) {
      setSections(data);
      // Update ref map
      const map = new Map<string, Section>();
      data.forEach(s => map.set(s.id, s));
      sectionsMapRef.current = map;
    } else if (isMountedRef.current) {
      setSections([]);
      sectionsMapRef.current = new Map();
    }
    
    setSectionsLoaded(true);
  }, []);

  // Get student IDs for selected section with batch support
  const getSectionStudentIds = useCallback(async (classId: string, sectionId: string): Promise<string[]> => {
    if (!classId || !sectionId) {
      return [];
    }
    
    const { data, error } = await supabase
      .from('students')
      .select('id')
      .eq('status', 'active')
      .eq('class_id', classId)
      .eq('section_id', sectionId);
    
    if (error) {
      console.error('Error fetching section students:', error);
      return [];
    }
    
    return data?.map(s => s.id) || [];
  }, []);

  // Check abort helper
  const checkAbort = useCallback((controller: AbortController | null): boolean => {
    if (!controller || controller.signal.aborted) {
      return true;
    }
    return false;
  }, []);

  // Memoized totals for performance
  const totals = useMemo(() => {
    if (!summary) return { draft: 0, submitted: 0, verified: 0, locked: 0 };
    return {
      draft: summary.subjects.reduce((sum, s) => sum + s.draft_count, 0),
      submitted: summary.subjects.reduce((sum, s) => sum + s.submitted_count, 0),
      verified: summary.subjects.reduce((sum, s) => sum + s.verified_count, 0),
      locked: summary.subjects.reduce((sum, s) => sum + s.locked_count, 0),
    };
  }, [summary]);

  // Fetch all subjects summary
  const fetchSummary = useCallback(async () => {
    const termId = selectedTerm;
    const classId = selectedClass;
    const sectionId = selectedSection;
    
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Guard: all selections must be present
    if (!termId || !classId || !sectionId) {
      if (isMountedRef.current) {
        resetSummary();
      }
      return;
    }
    
    // Prevent multiple simultaneous fetches
    if (isFetchingRef.current) {
      return;
    }
    
    // Create new AbortController for this request
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    isFetchingRef.current = true;
    if (isMountedRef.current) {
      setLoading(true);
      setDataState('loading');
    }
    
    try {
      // Check abort before proceeding
      if (checkAbort(controller)) return;
      
      // Get term, class, section info from refs (stable references)
      const term = termsMapRef.current.get(termId);
      const classInfo = classesMapRef.current.get(classId);
      const sectionInfo = sectionsMapRef.current.get(sectionId);
      
      // Check abort before next step
      if (checkAbort(controller)) return;
      
      // Get student IDs for this specific section
      const studentIds = await getSectionStudentIds(classId, sectionId);
      const totalStudents = studentIds.length;
      
      // Check abort before proceeding
      if (checkAbort(controller)) return;
      
      // CHECK: No students in this section
      if (totalStudents === 0) {
        if (isMountedRef.current) {
          resetSummary();
          setDataState('no_students');
        }
        return;
      }
      
      // Check abort before next step
      if (checkAbort(controller)) return;
      
      // Get all exam subjects for this term and class
      const { data: examSubjects, error: subjectsError } = await supabase
        .from('exam_subjects')
        .select(`
          id,
          subject_id,
          full_marks,
          pass_marks,
          subject:subject_id (id, name, code)
        `)
        .eq('term_id', termId)
        .eq('class_id', classId);
      
      if (subjectsError) throw subjectsError;
      if (checkAbort(controller)) return;
      
      // CHECK: No subjects assigned
      if (!examSubjects || examSubjects.length === 0) {
        if (isMountedRef.current) {
          resetSummary();
          setDataState('no_subjects');
        }
        return;
      }
      
      if (checkAbort(controller)) return;
      
      // Get all marks data for this section only
      const examSubjectIds = examSubjects.map((s: ExamSubject) => s.id);
      
      if (examSubjectIds.length === 0) {
        if (isMountedRef.current) {
          resetSummary();
          setDataState('no_subjects');
        }
        return;
      }
      
      let marksQuery = supabase
        .from('student_marks_new')
        .select('entry_status, exam_subject_id, student_id')
        .eq('term_id', termId)
        .in('exam_subject_id', examSubjectIds);
      
      // Filter by student IDs of this section only
      if (studentIds.length > 0) {
        marksQuery = marksQuery.in('student_id', studentIds);
      }
      
      const { data: allMarksData, error: marksError } = await marksQuery;
      if (marksError) throw marksError;
      if (checkAbort(controller)) return;
      
      // OPTIMIZED: Build marksMap for O(1) lookup - O(n) single pass
      const marksMap = new Map<string, MarkRecord[]>();
      (allMarksData as MarkRecord[] | null)?.forEach((m: MarkRecord) => {
        if (!marksMap.has(m.exam_subject_id)) {
          marksMap.set(m.exam_subject_id, []);
        }
        marksMap.get(m.exam_subject_id)!.push(m);
      });
      
      // Build status for each subject using Map for O(1) lookup
      const subjectsStatus: SubjectStatus[] = examSubjects.map((examSubject: ExamSubject) => {
        // O(1) lookup instead of O(n) filter
        const subjectMarks = marksMap.get(examSubject.id) || [];
        
        // Use reduce for single pass counting - O(n)
        const counters = subjectMarks.reduce((acc, m) => {
          acc[m.entry_status] = (acc[m.entry_status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        const draftCount = counters.draft || 0;
        const submittedCount = counters.submitted || 0;
        const verifiedCount = counters.verified || 0;
        const lockedCount = counters.locked || 0;
        // completed = submitted + verified + locked (no extra loop)
        const completedCount = submittedCount + verifiedCount + lockedCount;
        
        return {
          exam_subject_id: examSubject.id,
          subject_name: examSubject.subject?.name || 'Unknown',
          full_marks: examSubject.full_marks,
          draft_count: draftCount,
          submitted_count: submittedCount,
          verified_count: verifiedCount,
          locked_count: lockedCount,
          completed_count: completedCount,
          total_students: totalStudents,
          can_submit: draftCount > 0 && lockedCount === 0,
        };
      });
      
      // Final guard before setting state
      if (checkAbort(controller) || !isMountedRef.current) return;
      
      setSummary({
        term_name: term?.name || '',
        class_name: classInfo?.name || '',
        section_name: sectionInfo?.name || '',
        total_students: totalStudents,
        subjects: subjectsStatus,
      });
      
      setDataState('loaded');
      
      // Auto-select subjects with drafts
      const autoSelectIds = subjectsStatus
        .filter((s: SubjectStatus) => s.can_submit)
        .map((s: SubjectStatus) => s.exam_subject_id);
      setSelectedSubjectIds(autoSelectIds);
      
    } catch (error: unknown) {
      const err = error as Error;
      if (err.name === 'AbortError' || checkAbort(controller)) {
        return;
      }
      console.error('Error fetching summary:', err);
      if (isMountedRef.current && !checkAbort(controller)) {
        setDataState('error');
        toast.error('Failed to load submission summary');
      }
    } finally {
      if (abortControllerRef.current === controller && isMountedRef.current) {
        abortControllerRef.current = null;
      }
      isFetchingRef.current = false;
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [selectedTerm, selectedClass, selectedSection, getSectionStudentIds, checkAbort, resetSummary]);

  // Submit marks for selected subjects with batch support for large student lists
  const handleSubmit = async () => {
    if (selectedSubjectIds.length === 0) {
      toast.info('Please select at least one subject to submit');
      return;
    }
    
    setSubmitting(true);
    
    try {
      const studentIds = await getSectionStudentIds(selectedClass!, selectedSection!);
      
      if (studentIds.length === 0) {
        toast.error('No students found in this section');
        setSubmitting(false);
        return;
      }
      
      // Split student IDs into chunks of 500 for batch processing
      const studentChunks = chunkArray(studentIds, 500);
      let hasError = false;
      
      for (const chunk of studentChunks) {
        // Try to use RPC if available for atomic operation
        let rpcSuccess = false;
        try {
          const { error: rpcError } = await supabase.rpc('submit_term_marks_bulk', {
            p_term_id: selectedTerm,
            p_subject_ids: selectedSubjectIds,
            p_student_ids: chunk
          });
          
          if (!rpcError) {
            rpcSuccess = true;
          } else if (rpcError.message && !rpcError.message.includes('function not found')) {
            throw rpcError;
          }
        } catch (rpcErr) {
          console.log('RPC error, falling back to direct update');
        }
        
        if (!rpcSuccess) {
          // Fallback to direct update with batch
          const { error } = await supabase
            .from('student_marks_new')
            .update({ entry_status: 'submitted' })
            .eq('term_id', selectedTerm)
            .in('exam_subject_id', selectedSubjectIds)
            .eq('entry_status', 'draft')
            .in('student_id', chunk);
          
          if (error) {
            hasError = true;
            console.error('Batch update error:', error);
          }
        }
      }
      
      if (hasError) {
        toast.warning('Some batches failed to submit. Please check and try again.');
      } else {
        const sectionName = sectionsMapRef.current.get(selectedSection!)?.name || 'selected';
        toast.success(`${selectedSubjectIds.length} subject(s) submitted successfully for ${sectionName} section`);
      }
      
      // Refresh summary
      await fetchSummary();
      
    } catch (err) {
      console.error('Failed to submit subjects:', err);
      toast.error('Failed to submit marks');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchSummary();
    setRefreshing(false);
    toast.success('Data refreshed');
  };

  const toggleSelectAll = () => {
    if (!summary) return;
    const submittableSubjects = summary.subjects.filter(s => s.can_submit);
    if (selectedSubjectIds.length === submittableSubjects.length && selectedSubjectIds.length > 0) {
      setSelectedSubjectIds([]);
    } else {
      setSelectedSubjectIds(submittableSubjects.map(s => s.exam_subject_id));
    }
  };

  const toggleSubject = (subjectId: string) => {
    setSelectedSubjectIds(prev =>
      prev.includes(subjectId)
        ? prev.filter(id => id !== subjectId)
        : [...prev, subjectId]
    );
  };

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Load initial data
  useEffect(() => {
    fetchTerms();
    fetchClasses();
  }, [fetchTerms, fetchClasses]);

  // Update ref maps when state changes
  useEffect(() => {
    const map = new Map<string, ExamTerm>();
    terms.forEach(t => map.set(t.id, t));
    termsMapRef.current = map;
  }, [terms]);

  useEffect(() => {
    const map = new Map<string, ClassItem>();
    classes.forEach(c => map.set(c.id, c));
    classesMapRef.current = map;
  }, [classes]);

  useEffect(() => {
    const map = new Map<string, Section>();
    sections.forEach(s => map.set(s.id, s));
    sectionsMapRef.current = map;
  }, [sections]);

  // Fetch sections when class changes AND reset section with transition for better UX
  useEffect(() => {
    // Reset section when class changes
    startTransition(() => {
      setSelectedSection(undefined);
      resetSummary();
    });
    
    if (selectedClass) {
      fetchSections(selectedClass);
    } else {
      setSections([]);
      setSectionsLoaded(true);
    }
  }, [selectedClass, fetchSections, resetSummary]);

  // Reset when term changes with transition for better UX
  useEffect(() => {
    startTransition(() => {
      setSelectedClass(undefined);
      setSelectedSection(undefined);
      resetSummary();
      setSections([]);
      setSectionsLoaded(false);
    });
  }, [selectedTerm, resetSummary]);

  // Fetch summary when all selections are ready
  useEffect(() => {
    if (selectedTerm && selectedClass && selectedSection) {
      fetchSummary();
    } else {
      resetSummary();
    }
  }, [selectedTerm, selectedClass, selectedSection, fetchSummary, resetSummary]);

  const needsSelection = !selectedTerm || !selectedClass || !selectedSection;
  const hasSubmittableSubjects = summary?.subjects.some(s => s.can_submit) || false;
  const submittableCount = summary?.subjects.filter(s => s.can_submit).length || 0;

  // Handle section change
  const handleSectionChange = (sectionId: string) => {
    setSelectedSection(sectionId);
    resetSummary();
  };

  // Show message if no sections found (only after sections are loaded)
  if (selectedClass && sectionsLoaded && sections.length === 0 && !loading && !needsSelection && dataState !== 'no_students') {
    return (
      <ResponsiveLayout>
        <div className="space-y-6">
          <div className="rounded-3xl bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-800 p-6 shadow-2xl">
            <div className="flex flex-col lg:flex-row gap-4 justify-between">
              <div>
                <Link href="/exams/dashboard">
                  <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/20 -ml-2">
                    <ArrowLeft className="h-4 w-4 mr-1" /> Back
                  </Button>
                </Link>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3 mt-2">
                  <Send className="h-8 w-8" />
                  Submit Marks
                  <Badge className="bg-yellow-400 text-black ml-2">Bulk Submission</Badge>
                </h1>
              </div>
            </div>
          </div>
          <Card className="rounded-3xl">
            <CardContent className="py-16 text-center">
              <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-3" />
              <h2 className="text-xl font-semibold mb-2">No Sections Found</h2>
              <p className="text-gray-500">No sections found for the selected class. Please check class setup.</p>
            </CardContent>
          </Card>
        </div>
      </ResponsiveLayout>
    );
  }

  return (
    <ResponsiveLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="rounded-3xl bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-800 p-6 shadow-2xl">
          <div className="flex flex-col lg:flex-row gap-4 justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Link href="/exams/dashboard">
                  <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/20 -ml-2">
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Back
                  </Button>
                </Link>
              </div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <Send className="h-8 w-8" />
                Submit Marks
                <Badge className="bg-yellow-400 text-black ml-2">Bulk Submission</Badge>
              </h1>
              <p className="text-indigo-100 mt-2">Submit multiple subjects at once for verification</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button 
                onClick={handleRefresh} 
                disabled={refreshing || needsSelection}
                variant="outline" 
                className="bg-white/20 hover:bg-white/30 text-white border-0"
              >
                {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* Filters Section */}
        <Card className="border-0 shadow-lg rounded-3xl bg-gradient-to-r from-slate-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="mb-2 block text-gray-700 dark:text-gray-200 font-medium flex items-center gap-2">
                  <School className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  Exam Term
                </Label>
                <Select value={selectedTerm ?? ""} onValueChange={setSelectedTerm}>
                  <SelectTrigger className="w-full rounded-xl border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm">
                    <SelectValue placeholder="Select a term" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px] overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg">
                    {terms.map((term) => (
                      <SelectItem key={term.id} value={term.id} className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                        {term.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="mb-2 block text-gray-700 dark:text-gray-200 font-medium flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  Class
                </Label>
                <Select value={selectedClass ?? ""} onValueChange={setSelectedClass}>
                  <SelectTrigger className="w-full rounded-xl border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm">
                    <SelectValue placeholder="Select a class" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px] overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg">
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id} className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                        {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="mb-2 block text-gray-700 dark:text-gray-200 font-medium flex items-center gap-2">
                  <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  Section
                </Label>
                <Select 
                  value={selectedSection ?? ""} 
                  onValueChange={handleSectionChange}
                  disabled={!selectedClass || sections.length === 0}
                >
                  <SelectTrigger className="w-full rounded-xl border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 disabled:opacity-50 shadow-sm">
                    <SelectValue placeholder={sections.length === 0 ? "No sections found" : "Select a section"} />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px] overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg">
                    {sections.map((section) => (
                      <SelectItem key={section.id} value={section.id} className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
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
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600 dark:text-indigo-400 mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading subjects...</p>
          </div>
        )}

        {/* No Selection */}
        {!loading && needsSelection && (
          <Card className="rounded-3xl border-0 shadow-lg bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-20 w-20 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
                <AlertCircle className="h-10 w-10 text-amber-600 dark:text-amber-400" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Please Select All Filters</h2>
              <p className="text-gray-500 dark:text-gray-400 max-w-md">
                Please select exam term, class and section to see submission summary.
              </p>
            </CardContent>
          </Card>
        )}

        {/* No Students State */}
        {!loading && !needsSelection && dataState === 'no_students' && (
          <Card className="rounded-3xl border-0 shadow-lg bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-20 w-20 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
                <Users className="h-10 w-10 text-amber-600 dark:text-amber-400" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Students Found</h2>
              <p className="text-gray-500 dark:text-gray-400 max-w-md">
                No students found in {sectionsMapRef.current.get(selectedSection!)?.name || 'this'} section.
                Please check student enrollment.
              </p>
            </CardContent>
          </Card>
        )}

        {/* No Subjects State */}
        {!loading && !needsSelection && dataState === 'no_subjects' && (
          <Card className="rounded-3xl border-0 shadow-lg bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-20 w-20 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
                <BookOpen className="h-10 w-10 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Subjects Assigned</h2>
              <p className="text-gray-500 dark:text-gray-400 max-w-md">
                No subjects assigned for {termsMapRef.current.get(selectedTerm!)?.name} - {classesMapRef.current.get(selectedClass!)?.name}.
                Please go to Subject Assignment page.
              </p>
              <Link href="/exams/setup/subjects">
                <Button className="mt-4 bg-indigo-600 hover:bg-indigo-700">
                  <BookOpen className="mr-2 h-4 w-4" />
                  Go to Subject Assignment
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Error State */}
        {!loading && !needsSelection && dataState === 'error' && (
          <Card className="rounded-3xl border-0 shadow-lg bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-20 w-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
                <AlertCircle className="h-10 w-10 text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Failed to Load Data</h2>
              <p className="text-gray-500 dark:text-gray-400 max-w-md">
                There was an error loading the submission summary. Please try again.
              </p>
              <Button onClick={handleRefresh} className="mt-4">
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Summary Table */}
        {!loading && !needsSelection && dataState === 'loaded' && summary && summary.subjects.length > 0 && summary.total_students > 0 && (
          <>
            {/* Info Card */}
            <Card className="rounded-3xl border-0 shadow-lg bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30">
              <CardContent className="p-5">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <School className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                      {summary.term_name} | {summary.class_name} | {summary.section_name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Total Students: {summary.total_students} | 
                      Submittable Subjects: {submittableCount}
                    </p>
                    {sections.length > 1 && (
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                        💡 You have {sections.length} sections. Select different section from dropdown to submit their marks separately.
                      </p>
                    )}
                  </div>
                  <Button
                    onClick={handleSubmit}
                    disabled={!hasSubmittableSubjects || submitting || selectedSubjectIds.length === 0}
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg"
                  >
                    {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Submit Selected ({selectedSubjectIds.length}) Subjects
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Subjects Table */}
            <Card className="rounded-3xl border-0 shadow-lg overflow-hidden bg-white dark:bg-gray-900">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-gradient-to-r from-indigo-500 to-purple-600">
                    <TableRow>
                      <TableHead className="text-white w-12">
                        <Checkbox
                          checked={submittableCount > 0 && 
                                 selectedSubjectIds.length === submittableCount &&
                                 selectedSubjectIds.length > 0}
                          onCheckedChange={toggleSelectAll}
                          className="border-white/50 data-[state=checked]:bg-white data-[state=checked]:text-indigo-600"
                        />
                      </TableHead>
                      <TableHead className="text-white">Subject Name</TableHead>
                      <TableHead className="text-white text-center">Full Marks</TableHead>
                      <TableHead className="text-white text-center">Draft</TableHead>
                      <TableHead className="text-white text-center">Submitted</TableHead>
                      <TableHead className="text-white text-center">Verified</TableHead>
                      <TableHead className="text-white text-center">Locked</TableHead>
                      <TableHead className="text-white text-center">Completed</TableHead>
                      <TableHead className="text-white text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.subjects.map((subject) => {
                      const isSelectable = subject.can_submit;
                      const isSelected = selectedSubjectIds.includes(subject.exam_subject_id);
                      const completionPercent = subject.total_students > 0 
                        ? Math.round((subject.completed_count / subject.total_students) * 100) 
                        : 0;
                      
                      return (
                        <TableRow key={subject.exam_subject_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <TableCell>
                            <Checkbox
                              checked={isSelectable && isSelected}
                              onCheckedChange={() => isSelectable && toggleSubject(subject.exam_subject_id)}
                              disabled={!isSelectable}
                              className="border-gray-300 dark:border-gray-600 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                            />
                          </TableCell>
                          <TableCell className="font-medium text-gray-900 dark:text-white">
                            {subject.subject_name}
                          </TableCell>
                          <TableCell className="text-center text-gray-700 dark:text-gray-300">{subject.full_marks}</TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                              {subject.draft_count}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                              {subject.submitted_count}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                              {subject.verified_count}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                              {subject.locked_count}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                              {subject.completed_count}/{subject.total_students}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {subject.locked_count > 0 ? (
                              <Badge className="bg-red-500 text-white">Locked</Badge>
                            ) : subject.draft_count === 0 ? (
                              <Badge className="bg-green-500 text-white">All Submitted</Badge>
                            ) : (
                              <Badge className="bg-yellow-500 text-white">
                                {completionPercent}% Ready
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>

            {/* Progress Summary */}
            <Card className="rounded-3xl border-0 shadow-lg bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30">
              <CardContent className="p-5">
                <div className="flex flex-wrap gap-6 justify-between items-center">
                  <div className="flex flex-wrap gap-4">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        Draft: {totals.draft}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-blue-500"></div>
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        Submitted: {totals.submitted}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-green-500"></div>
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        Verified: {totals.verified}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-red-500"></div>
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        Locked: {totals.locked}
                      </span>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    <Layers className="h-4 w-4 inline mr-1" />
                    Total Records: {summary.subjects.reduce((sum, s) => sum + (s.total_students * 1), 0)}
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </ResponsiveLayout>
  );
}
