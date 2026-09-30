// src/app/exams/marks/verify/page.tsx

'use client';

import { useState, useEffect, useCallback, useRef, useMemo, useReducer, useTransition } from 'react';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { 
  Loader2, 
  RefreshCw, 
  AlertCircle,
  ShieldCheck,
  Users,
  BookOpen,
  CheckCircle,
  Clock,
  XCircle,
  ArrowLeft,
  School,
  Eye,
  MessageSquare,
  Layers
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

const supabase = createClient();

// Types
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

interface Student {
   id: string;
   name: string;
   class_roll: string;
 }

interface StudentMark {
  id: string;
  student_id: string;
  student?: Student;
  marks_obtained: number;
  is_absent: boolean;
  entry_status: string;
  remarks?: string;
}

interface SubjectSummary {
  exam_subject_id: string;
  subject_name: string;
  full_marks: number;
  submitted_count: number;
  verified_count: number;
  can_verify: boolean;
}

interface SummaryState {
  term_name: string;
  class_name: string;
  section_name: string;
  total_students: number;
  subjects: SubjectSummary[];
}

type DataState = 'idle' | 'loading' | 'loaded' | 'no_subjects' | 'no_students' | 'no_submitted' | 'error';

// Reducer for state management
interface AppState {
  loading: boolean;
  submitting: boolean;
  refreshing: boolean;
  dataState: DataState;
  selectedTerm: string | undefined;
  selectedClass: string | undefined;
  selectedSection: string | undefined;
  selectedSubjectIds: string[];
  activeSubjectId: string | null;
  summary: SummaryState | null;
  studentsMarks: StudentMark[];
  verifyDialogOpen: boolean;
  selectedMark: StudentMark | null;
  verifyAction: 'approve' | 'reject';
  verifyRemarks: string;
  verifyingProgress: { current: number; total: number };
}

type AppAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_SUBMITTING'; payload: boolean }
  | { type: 'SET_REFRESHING'; payload: boolean }
  | { type: 'SET_DATA_STATE'; payload: DataState }
  | { type: 'SET_SELECTED_TERM'; payload: string | undefined }
  | { type: 'SET_SELECTED_CLASS'; payload: string | undefined }
  | { type: 'SET_SELECTED_SECTION'; payload: string | undefined }
  | { type: 'SET_SELECTED_SUBJECT_IDS'; payload: string[] }
  | { type: 'TOGGLE_SUBJECT_SELECTION'; payload: string }
  | { type: 'TOGGLE_SELECT_ALL'; payload: string[] }
  | { type: 'SET_ACTIVE_SUBJECT_ID'; payload: string | null }
  | { type: 'SET_SUMMARY'; payload: SummaryState | null }
  | { type: 'SET_STUDENTS_MARKS'; payload: StudentMark[] }
  | { type: 'UPDATE_MARK_STATUS'; payload: { markId: string; status: string; remarks?: string } }
  | { type: 'SET_VERIFY_DIALOG'; payload: { open: boolean; mark?: StudentMark | null; action?: 'approve' | 'reject' } }
  | { type: 'SET_VERIFY_REMARKS'; payload: string }
  | { type: 'SET_VERIFYING_PROGRESS'; payload: { current: number; total: number } }
  | { type: 'RESET_SUMMARY' };

const initialState: AppState = {
  loading: false,
  submitting: false,
  refreshing: false,
  dataState: 'idle',
  selectedTerm: undefined,
  selectedClass: undefined,
  selectedSection: undefined,
  selectedSubjectIds: [],
  activeSubjectId: null,
  summary: null,
  studentsMarks: [],
  verifyDialogOpen: false,
  selectedMark: null,
  verifyAction: 'approve',
  verifyRemarks: '',
  verifyingProgress: { current: 0, total: 0 },
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_SUBMITTING':
      return { ...state, submitting: action.payload };
    case 'SET_REFRESHING':
      return { ...state, refreshing: action.payload };
    case 'SET_DATA_STATE':
      return { ...state, dataState: action.payload };
    case 'SET_SELECTED_TERM':
      return { ...state, selectedTerm: action.payload };
    case 'SET_SELECTED_CLASS':
      return { ...state, selectedClass: action.payload };
    case 'SET_SELECTED_SECTION':
      return { ...state, selectedSection: action.payload };
    case 'SET_SELECTED_SUBJECT_IDS':
      return { ...state, selectedSubjectIds: action.payload };
    case 'TOGGLE_SUBJECT_SELECTION':
      return {
        ...state,
        selectedSubjectIds: state.selectedSubjectIds.includes(action.payload)
          ? state.selectedSubjectIds.filter(id => id !== action.payload)
          : [...state.selectedSubjectIds, action.payload],
      };
    case 'TOGGLE_SELECT_ALL':
      return { ...state, selectedSubjectIds: action.payload };
    case 'SET_ACTIVE_SUBJECT_ID':
      return { ...state, activeSubjectId: action.payload };
    case 'SET_SUMMARY':
      return { ...state, summary: action.payload };
    case 'SET_STUDENTS_MARKS':
      return { ...state, studentsMarks: action.payload };
    case 'UPDATE_MARK_STATUS':
      return {
        ...state,
        studentsMarks: state.studentsMarks.map(mark =>
          mark.id === action.payload.markId
            ? { ...mark, entry_status: action.payload.status, remarks: action.payload.remarks || mark.remarks }
            : mark
        ),
      };
    case 'SET_VERIFY_DIALOG':
      return {
        ...state,
        verifyDialogOpen: action.payload.open,
        selectedMark: action.payload.mark || null,
        verifyAction: action.payload.action || 'approve',
        verifyRemarks: '',
      };
    case 'SET_VERIFY_REMARKS':
      return { ...state, verifyRemarks: action.payload };
    case 'SET_VERIFYING_PROGRESS':
      return { ...state, verifyingProgress: action.payload };
    case 'RESET_SUMMARY':
      return {
        ...state,
        summary: null,
        studentsMarks: [],
        dataState: 'idle',
        selectedSubjectIds: [],
        activeSubjectId: null,
      };
    default:
      return state;
  }
}

// Helper functions
const chunkArray = <T,>(arr: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

export default function MarksVerifyPage() {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [, startTransition] = useTransition();
  
  // Selection state for dropdowns
  const [terms, setTerms] = useState<ExamTerm[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [sectionsLoaded, setSectionsLoaded] = useState(false);
  const [subjects, setSubjects] = useState<ExamSubject[]>([]);
  
  // Refs for maps and abort controllers
  const termsMapRef = useRef<Map<string, ExamTerm>>(new Map());
  const classesMapRef = useRef<Map<string, ClassItem>>(new Map());
  const sectionsMapRef = useRef<Map<string, Section>>(new Map());
  const subjectsMapRef = useRef<Map<string, ExamSubject>>(new Map());
  const abortControllerRef = useRef<AbortController | null>(null);
  const marksAbortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  const isFetchingRef = useRef(false);

  // Helper functions
  const checkAbort = useCallback((controller: AbortController | null): boolean => {
    return !controller || controller.signal.aborted;
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
      const map = new Map<string, Section>();
      data.forEach(s => map.set(s.id, s));
      sectionsMapRef.current = map;
    } else if (isMountedRef.current) {
      setSections([]);
      sectionsMapRef.current = new Map();
    }
    
    setSectionsLoaded(true);
  }, []);

  // Fetch subjects
  const fetchSubjects = useCallback(async () => {
    if (!state.selectedTerm || !state.selectedClass) {
      setSubjects([]);
      return;
    }
    
    const { data, error } = await supabase
      .from('exam_subjects')
      .select(`
        id,
        subject_id,
        full_marks,
        pass_marks,
        subject:subject_id (id, name, code)
      `)
      .eq('term_id', state.selectedTerm)
      .eq('class_id', state.selectedClass);
    
    if (error) {
      console.error('Error fetching subjects:', error);
      return;
    }
    
    if (data && data.length > 0 && isMountedRef.current) {
      const typedData = data as unknown as ExamSubject[];
      setSubjects(typedData);
      const map = new Map<string, ExamSubject>();
      typedData.forEach(s => map.set(s.id, s));
      subjectsMapRef.current = map;
    }
  }, [state.selectedTerm, state.selectedClass]);

  // Get student IDs
  const getSectionStudentIds = useCallback(async (classId: string, sectionId: string): Promise<string[]> => {
    if (!classId || !sectionId) return [];
    
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

  // Fetch main data
  const fetchData = useCallback(async () => {
    const termId = state.selectedTerm;
    const classId = state.selectedClass;
    const sectionId = state.selectedSection;
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    if (!termId || !classId || !sectionId) {
      dispatch({ type: 'RESET_SUMMARY' });
      return;
    }
    
    if (isFetchingRef.current) return;
    
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    isFetchingRef.current = true;
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_DATA_STATE', payload: 'loading' });
    
    try {
      if (checkAbort(controller)) return;
      
      const term = termsMapRef.current.get(termId);
      const classInfo = classesMapRef.current.get(classId);
      const sectionInfo = sectionsMapRef.current.get(sectionId);
      
      if (checkAbort(controller)) return;
      
      const studentIds = await getSectionStudentIds(classId, sectionId);
      const totalStudents = studentIds.length;
      
      if (checkAbort(controller)) return;
      
      if (totalStudents === 0) {
        dispatch({ type: 'RESET_SUMMARY' });
        dispatch({ type: 'SET_DATA_STATE', payload: 'no_students' });
        return;
      }
      
      if (checkAbort(controller)) return;
      
      const { data: examSubjectsData, error: subjectsError } = await supabase
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
      
      const examSubjects = (examSubjectsData ?? []) as unknown as ExamSubject[];
      
      if (!examSubjects || examSubjects.length === 0) {
        dispatch({ type: 'RESET_SUMMARY' });
        dispatch({ type: 'SET_DATA_STATE', payload: 'no_subjects' });
        return;
      }
      
      if (checkAbort(controller)) return;
      
      const examSubjectIds = examSubjects.map(s => s.id);
      
      let marksQuery = supabase
        .from('student_marks_new')
        .select('entry_status, exam_subject_id, student_id')
        .eq('term_id', termId)
        .in('exam_subject_id', examSubjectIds);
      
      if (studentIds.length > 0) {
        marksQuery = marksQuery.in('student_id', studentIds);
      }
      
      const { data: allMarksData = [], error: marksError } = await marksQuery;
      if (marksError) throw marksError;
      if (checkAbort(controller)) return;
      
      const marksMap = new Map<string, any[]>();
      (allMarksData || []).forEach((m: any) => {
        if (!marksMap.has(m.exam_subject_id)) {
          marksMap.set(m.exam_subject_id, []);
        }
        marksMap.get(m.exam_subject_id)!.push(m);
      });
      
      const subjectsStatus: SubjectSummary[] = examSubjects.map(examSubject => {
        const subjectMarks = marksMap.get(examSubject.id) || [];
        const submittedCount = subjectMarks.filter((m: any) => m.entry_status === 'submitted').length;
        const verifiedCount = subjectMarks.filter((m: any) => m.entry_status === 'verified').length;
        
        return {
          exam_subject_id: examSubject.id,
          subject_name: (examSubject.subject as any)?.[0]?.name || 'Unknown',
          full_marks: examSubject.full_marks,
          submitted_count: submittedCount,
          verified_count: verifiedCount,
          can_verify: submittedCount > 0,
        };
      });
      
      if (checkAbort(controller)) return;
      
      const summaryData: SummaryState = {
        term_name: term?.name || '',
        class_name: classInfo?.name || '',
        section_name: sectionInfo?.name || '',
        total_students: totalStudents,
        subjects: subjectsStatus,
      };
      
      dispatch({ type: 'SET_SUMMARY', payload: summaryData });
      
      const verifiableSubjectIds = subjectsStatus.filter(s => s.can_verify).map(s => s.exam_subject_id);
      dispatch({ type: 'SET_SELECTED_SUBJECT_IDS', payload: verifiableSubjectIds });
      dispatch({ type: 'SET_DATA_STATE', payload: 'loaded' });
      
    } catch (error: any) {
      if (error.name === 'AbortError' || checkAbort(controller)) return;
      console.error('Error fetching data:', error);
      if (isMountedRef.current && !checkAbort(controller)) {
        dispatch({ type: 'SET_DATA_STATE', payload: 'error' });
        toast.error('Failed to load verification data');
      }
    } finally {
      if (abortControllerRef.current === controller && isMountedRef.current) {
        abortControllerRef.current = null;
      }
      isFetchingRef.current = false;
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.selectedTerm, state.selectedClass, state.selectedSection, getSectionStudentIds, checkAbort]);

  // Fetch detailed marks for a subject with abort control
  const fetchSubjectMarks = useCallback(async (subjectId: string) => {
    const classId = state.selectedClass;
    const sectionId = state.selectedSection;
    const termId = state.selectedTerm;
    
    if (!subjectId || !classId || !sectionId || !termId) return;
    
    if (marksAbortControllerRef.current) {
      marksAbortControllerRef.current.abort();
    }
    
    const controller = new AbortController();
    marksAbortControllerRef.current = controller;
    
    dispatch({ type: 'SET_LOADING', payload: true });
    
    try {
      if (checkAbort(controller)) return;
      
      const studentIds = await getSectionStudentIds(classId, sectionId);
      if (studentIds.length === 0) {
        dispatch({ type: 'SET_STUDENTS_MARKS', payload: [] });
        return;
      }
      
      if (checkAbort(controller)) return;
      
const { data: studentsData, error: studentsError } = await supabase
         .from('students')
         .select('id, name, class_roll')
         .eq('status', 'active')
         .eq('class_id', classId)
         .eq('section_id', sectionId)
         .order('class_roll');
      
      if (studentsError) throw studentsError;
      if (checkAbort(controller)) return;
      
      const { data: marksData = [], error: marksError } = await supabase
        .from('student_marks_new')
        .select('id, student_id, marks_obtained, is_absent, entry_status, remarks')
        .eq('term_id', termId)
        .eq('exam_subject_id', subjectId)
        .in('student_id', studentIds);
      
      if (marksError) throw marksError;
      if (checkAbort(controller)) return;
      
      const mergedMarks: StudentMark[] = studentsData.map(student => {
        const mark = (marksData || []).find(m => m.student_id === student.id);
        return {
          id: mark?.id || `temp-${student.id}`,
          student_id: student.id,
          student,
          marks_obtained: mark?.marks_obtained || 0,
          is_absent: mark?.is_absent || false,
          entry_status: mark?.entry_status || 'draft',
          remarks: mark?.remarks || '',
        };
      });
      
      if (checkAbort(controller)) return;
      
      dispatch({ type: 'SET_STUDENTS_MARKS', payload: mergedMarks });
      dispatch({ type: 'SET_ACTIVE_SUBJECT_ID', payload: subjectId });
      
    } catch (error: any) {
      if (error.name === 'AbortError' || checkAbort(controller)) return;
      console.error('Error fetching subject marks:', error);
      toast.error('Failed to load student marks');
    } finally {
      if (marksAbortControllerRef.current === controller && isMountedRef.current) {
        marksAbortControllerRef.current = null;
      }
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.selectedClass, state.selectedSection, state.selectedTerm, getSectionStudentIds, checkAbort]);

  // Bulk verify with parallel processing
  const handleBulkVerify = useCallback(async () => {
    const selectedSubjectIds = state.selectedSubjectIds;
    const classId = state.selectedClass;
    const sectionId = state.selectedSection;
    const termId = state.selectedTerm;
    
    if (!classId || !sectionId || !termId) return;
    
    if (selectedSubjectIds.length === 0) {
      toast.info('Please select at least one subject to verify');
      return;
    }
    
    dispatch({ type: 'SET_SUBMITTING', payload: true });
    dispatch({ type: 'SET_VERIFYING_PROGRESS', payload: { current: 0, total: selectedSubjectIds.length } });
    
    let successCount = 0;
    let failCount = 0;
    
    try {
      const studentIds = await getSectionStudentIds(classId, sectionId);
      
      if (studentIds.length === 0) {
        toast.error('No students found in this section');
        dispatch({ type: 'SET_SUBMITTING', payload: false });
        return;
      }
      
      const studentChunks = chunkArray(studentIds, 500);
      
      // Process subjects in parallel for better performance
      const results = await Promise.allSettled(
        selectedSubjectIds.map(async (subjectId, index) => {
          dispatch({ type: 'SET_VERIFYING_PROGRESS', payload: { current: index + 1, total: selectedSubjectIds.length } });
          
          const chunkResults = await Promise.all(
            studentChunks.map(chunk =>
              supabase
                .from('student_marks_new')
                .update({ entry_status: 'verified' })
                .eq('term_id', termId)
                .eq('exam_subject_id', subjectId)
                .eq('entry_status', 'submitted')
                .in('student_id', chunk)
            )
          );
          
          const hasError = chunkResults.some(result => result.error);
          return { subjectId, success: !hasError };
        })
      );
      
      results.forEach(result => {
        if (result.status === 'fulfilled' && result.value.success) {
          successCount++;
        } else {
          failCount++;
        }
      });
      
      if (successCount > 0) {
        toast.success(`${successCount} subject(s) verified successfully${failCount > 0 ? `, ${failCount} failed` : ''}`);
      }
      if (failCount > 0) {
        toast.error(`${failCount} subject(s) failed to verify`);
      }
      
      await fetchData();
      dispatch({ type: 'SET_STUDENTS_MARKS', payload: [] });
      dispatch({ type: 'SET_ACTIVE_SUBJECT_ID', payload: null });
      
    } catch (err) {
      console.error('Error bulk verifying:', err);
      toast.error('Failed to verify marks');
    } finally {
      dispatch({ type: 'SET_SUBMITTING', payload: false });
      dispatch({ type: 'SET_VERIFYING_PROGRESS', payload: { current: 0, total: 0 } });
    }
  }, [state.selectedSubjectIds, state.selectedClass, state.selectedSection, state.selectedTerm, getSectionStudentIds, fetchData]);

  // Verify single mark
  const handleVerifySingle = useCallback(async () => {
    const selectedMark = state.selectedMark;
    if (!selectedMark || !selectedMark.id) {
      toast.error('Invalid mark selected');
      dispatch({ type: 'SET_VERIFY_DIALOG', payload: { open: false } });
      return;
    }
    
    dispatch({ type: 'SET_SUBMITTING', payload: true });
    
    try {
      const updateData: any = {
        entry_status: state.verifyAction === 'approve' ? 'verified' : 'rejected',
      };
      
      if (state.verifyRemarks && state.verifyRemarks.trim()) {
        updateData.remarks = state.verifyRemarks.trim();
      }
      
      const { error } = await supabase
        .from('student_marks_new')
        .update(updateData)
        .eq('id', selectedMark.id);
      
      if (error) throw error;
      
      toast.success(`Mark ${state.verifyAction === 'approve' ? 'verified' : 'rejected'} successfully`);
      
      // Update local state immediately for optimistic UI
      dispatch({
        type: 'UPDATE_MARK_STATUS',
        payload: {
          markId: selectedMark.id,
          status: state.verifyAction === 'approve' ? 'verified' : 'rejected',
          remarks: state.verifyRemarks,
        },
      });
      
      dispatch({ type: 'SET_VERIFY_DIALOG', payload: { open: false } });
      
      // Refresh summary data
      await fetchData();
      
    } catch (err) {
      console.error('Error verifying mark:', err);
      toast.error('Failed to verify mark');
    } finally {
      dispatch({ type: 'SET_SUBMITTING', payload: false });
    }
  }, [state.selectedMark, state.verifyAction, state.verifyRemarks, fetchData]);

  const handleRefresh = useCallback(async () => {
    dispatch({ type: 'SET_REFRESHING', payload: true });
    await fetchData();
    dispatch({ type: 'SET_STUDENTS_MARKS', payload: [] });
    dispatch({ type: 'SET_ACTIVE_SUBJECT_ID', payload: null });
    dispatch({ type: 'SET_REFRESHING', payload: false });
    toast.success('Data refreshed');
  }, [fetchData]);

  const toggleSelectAll = useCallback(() => {
    if (!state.summary) return;
    const verifiableSubjectIds = state.summary.subjects.filter(s => s.can_verify).map(s => s.exam_subject_id);
    const allSelected = state.selectedSubjectIds.length === verifiableSubjectIds.length && verifiableSubjectIds.length > 0;
    dispatch({ type: 'SET_SELECTED_SUBJECT_IDS', payload: allSelected ? [] : verifiableSubjectIds });
  }, [state.summary, state.selectedSubjectIds]);

  const toggleSubject = useCallback((subjectId: string) => {
    dispatch({ type: 'TOGGLE_SUBJECT_SELECTION', payload: subjectId });
  }, []);

  const openVerifyDialog = useCallback((mark: StudentMark, action: 'approve' | 'reject') => {
    dispatch({ type: 'SET_VERIFY_DIALOG', payload: { open: true, mark, action } });
  }, []);

  const handleSubjectClick = useCallback(async (subjectId: string) => {
    await fetchSubjectMarks(subjectId);
    const subjectName = state.summary?.subjects.find(s => s.exam_subject_id === subjectId)?.subject_name || 'Subject';
    toast.info(`Loading marks for ${subjectName}`);
  }, [fetchSubjectMarks, state.summary]);

  const handleSectionChange = useCallback((sectionId: string) => {
    dispatch({ type: 'SET_SELECTED_SECTION', payload: sectionId });
    dispatch({ type: 'RESET_SUMMARY' });
    dispatch({ type: 'SET_STUDENTS_MARKS', payload: [] });
    dispatch({ type: 'SET_ACTIVE_SUBJECT_ID', payload: null });
  }, []);

  // Cleanup
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) abortControllerRef.current.abort();
      if (marksAbortControllerRef.current) marksAbortControllerRef.current.abort();
    };
  }, []);

  // Load initial data
  useEffect(() => {
    fetchTerms();
    fetchClasses();
  }, [fetchTerms, fetchClasses]);

  // Update ref maps
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

  useEffect(() => {
    const map = new Map<string, ExamSubject>();
    subjects.forEach(s => map.set(s.id, s));
    subjectsMapRef.current = map;
  }, [subjects]);

  // Fetch sections when class changes
  useEffect(() => {
    startTransition(() => {
      dispatch({ type: 'SET_SELECTED_SECTION', payload: undefined });
      dispatch({ type: 'RESET_SUMMARY' });
    });
    
    if (state.selectedClass) {
      fetchSections(state.selectedClass);
    } else {
      setSections([]);
      setSectionsLoaded(true);
    }
  }, [state.selectedClass, fetchSections]);

  // Reset when term changes
  useEffect(() => {
    startTransition(() => {
      dispatch({ type: 'SET_SELECTED_CLASS', payload: undefined });
      dispatch({ type: 'SET_SELECTED_SECTION', payload: undefined });
      dispatch({ type: 'RESET_SUMMARY' });
      setSections([]);
      setSectionsLoaded(false);
      setSubjects([]);
    });
  }, [state.selectedTerm]);

  // Fetch subjects when term/class changes
  useEffect(() => {
    if (state.selectedTerm && state.selectedClass) {
      fetchSubjects();
    }
  }, [state.selectedTerm, state.selectedClass, fetchSubjects]);

  // Fetch data when all selections ready
  useEffect(() => {
    if (state.selectedTerm && state.selectedClass && state.selectedSection) {
      fetchData();
    } else {
      dispatch({ type: 'RESET_SUMMARY' });
    }
  }, [state.selectedTerm, state.selectedClass, state.selectedSection, fetchData]);

  const needsSelection = !state.selectedTerm || !state.selectedClass || !state.selectedSection;
  const verifiableCount = state.summary?.subjects.filter(s => s.can_verify).length || 0;
  const allVerifiableSelected = verifiableCount > 0 && state.selectedSubjectIds.length === verifiableCount;

  return (
    <ResponsiveLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="rounded-3xl bg-gradient-to-r from-amber-700 via-orange-700 to-yellow-800 p-6 shadow-2xl">
          <div className="flex flex-col lg:flex-row gap-4 justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Link href="/exams/dashboard">
                  <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/20 -ml-2">
                    <ArrowLeft className="h-4 w-4 mr-1" /> Back
                  </Button>
                </Link>
              </div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <ShieldCheck className="h-8 w-8" />
                Verify Marks
                <Badge className="bg-blue-400 text-black ml-2">Bulk Verification</Badge>
              </h1>
              <p className="text-amber-100 mt-2">Verify multiple subjects at once</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button 
                onClick={handleRefresh} 
                disabled={state.refreshing || needsSelection}
                variant="outline" 
                className="bg-white/20 hover:bg-white/30 text-white border-0"
              >
                {state.refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
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
                  <School className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  Exam Term
                </Label>
                <Select value={state.selectedTerm ?? ""} onValueChange={(val) => dispatch({ type: 'SET_SELECTED_TERM', payload: val || undefined })}>
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
                <Select value={state.selectedClass ?? ""} onValueChange={(val) => dispatch({ type: 'SET_SELECTED_CLASS', payload: val || undefined })}>
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
                  value={state.selectedSection ?? ""} 
                  onValueChange={handleSectionChange}
                  disabled={!state.selectedClass || sections.length === 0}
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
        {state.loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-amber-600 dark:text-amber-400 mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading verification data...</p>
          </div>
        )}

        {/* No Selection */}
        {!state.loading && needsSelection && (
          <Card className="rounded-3xl border-0 shadow-lg bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-20 w-20 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
                <AlertCircle className="h-10 w-10 text-amber-600 dark:text-amber-400" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Please Select All Filters</h2>
              <p className="text-gray-500 dark:text-gray-400 max-w-md">
                Please select exam term, class and section to verify marks.
              </p>
            </CardContent>
          </Card>
        )}

        {/* No Students State */}
        {!state.loading && !needsSelection && state.dataState === 'no_students' && (
          <Card className="rounded-3xl border-0 shadow-lg bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-20 w-20 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
                <Users className="h-10 w-10 text-amber-600 dark:text-amber-400" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Students Found</h2>
              <p className="text-gray-500 dark:text-gray-400 max-w-md">
                No students found in this section. Please check student enrollment.
              </p>
            </CardContent>
          </Card>
        )}

        {/* No Subjects State */}
        {!state.loading && !needsSelection && state.dataState === 'no_subjects' && (
          <Card className="rounded-3xl border-0 shadow-lg bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-20 w-20 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
                <BookOpen className="h-10 w-10 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Subjects Assigned</h2>
              <p className="text-gray-500 dark:text-gray-400 max-w-md">
                No subjects assigned for this exam term and class. Please go to Subject Assignment page.
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

        {/* No Submitted Marks State */}
        {!state.loading && !needsSelection && state.summary && state.summary.subjects.filter(s => s.can_verify).length === 0 && (
          <Card className="rounded-3xl border-0 shadow-lg bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-950/30 dark:to-amber-950/30">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-20 w-20 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center mb-4">
                <Clock className="h-10 w-10 text-yellow-600 dark:text-yellow-400" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Submitted Marks</h2>
              <p className="text-gray-500 dark:text-gray-400 max-w-md">
                No marks have been submitted for verification yet.
                Please check Submit Marks page first.
              </p>
              <Link href="/exams/marks/submit">
                <Button className="mt-4 bg-indigo-600 hover:bg-indigo-700">
                  Go to Submit Marks
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Error State */}
        {!state.loading && !needsSelection && state.dataState === 'error' && (
          <Card className="rounded-3xl border-0 shadow-lg bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-20 w-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
                <AlertCircle className="h-10 w-10 text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Failed to Load Data</h2>
              <p className="text-gray-500 dark:text-gray-400 max-w-md">
                There was an error loading the verification data. Please try again.
              </p>
              <Button onClick={handleRefresh} className="mt-4">
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Bulk Verification UI */}
        {!state.loading && !needsSelection && state.dataState === 'loaded' && state.summary && (
          <>
            {/* Info Card */}
            <Card className="rounded-3xl border-0 shadow-lg bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30">
              <CardContent className="p-5">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <School className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      {state.summary.term_name} | {state.summary.class_name} | {state.summary.section_name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Total Students: {state.summary.total_students} | 
                      Subjects with submitted marks: {verifiableCount}
                    </p>
                    {state.submitting && (
                      <div className="mt-2 flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
                        <span className="text-sm text-amber-600">
                          Verifying: {state.verifyingProgress.current} / {state.verifyingProgress.total} subjects
                        </span>
                      </div>
                    )}
                  </div>
                  <Button
                    onClick={handleBulkVerify}
                    disabled={!verifiableCount || state.submitting || state.selectedSubjectIds.length === 0}
                    className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-lg"
                  >
                    {state.submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                    Verify Selected ({state.selectedSubjectIds.length}) Subjects
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Subjects Table for Bulk Selection */}
            <Card className="rounded-3xl border-0 shadow-lg overflow-hidden bg-white dark:bg-gray-900">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-gradient-to-r from-amber-500 to-orange-600">
                    <TableRow>
                      <TableHead className="text-white w-12">
                        <Checkbox
                          checked={allVerifiableSelected}
                          onCheckedChange={toggleSelectAll}
                          className="border-white/50 data-[state=checked]:bg-white data-[state=checked]:text-indigo-600"
                        />
                      </TableHead>
                      <TableHead className="text-white">Subject Name</TableHead>
                      <TableHead className="text-white text-center">Full Marks</TableHead>
                      <TableHead className="text-white text-center">Submitted</TableHead>
                      <TableHead className="text-white text-center">Verified</TableHead>
                      <TableHead className="text-white text-center">Status</TableHead>
                      <TableHead className="text-white text-center">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {state.summary.subjects.map((subject) => {
                      const isSelectable = subject.can_verify;
                      const isSelected = state.selectedSubjectIds.includes(subject.exam_subject_id);
                      
                      return (
                        <TableRow 
                          key={subject.exam_subject_id} 
                          className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
                          onClick={() => handleSubjectClick(subject.exam_subject_id)}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
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
                            <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                              {subject.submitted_count}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                              {subject.verified_count}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {subject.submitted_count === 0 ? (
                              <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">No Submission</Badge>
                            ) : subject.submitted_count === subject.verified_count ? (
                              <Badge className="bg-green-500 text-white">Fully Verified</Badge>
                            ) : (
                              <Badge className="bg-yellow-500 text-white">Pending Verification</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            {subject.submitted_count > 0 && subject.submitted_count !== subject.verified_count && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs text-blue-600"
                                onClick={() => handleSubjectClick(subject.exam_subject_id)}
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                View Details
                              </Button>
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
                      <div className="h-3 w-3 rounded-full bg-purple-500"></div>
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        Total Submitted: {state.summary.subjects.reduce((sum, s) => sum + s.submitted_count, 0)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-green-500"></div>
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        Total Verified: {state.summary.subjects.reduce((sum, s) => sum + s.verified_count, 0)}
                      </span>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    <Layers className="h-4 w-4 inline mr-1" />
                    Pending: {state.summary.subjects.reduce((sum, s) => sum + (s.submitted_count - s.verified_count), 0)}
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Detailed Marks Table */}
        {!state.loading && state.studentsMarks.length > 0 && (
          <>
            <Card className="rounded-3xl border-0 shadow-lg overflow-hidden bg-white dark:bg-gray-900">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-gradient-to-r from-amber-500 to-orange-600">
                    <TableRow>
                      <TableHead className="text-white">Roll No</TableHead>
                      <TableHead className="text-white">Student Name</TableHead>
                      <TableHead className="text-white text-center">Marks Obtained</TableHead>
                      <TableHead className="text-white text-center">Status</TableHead>
                      <TableHead className="text-white text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {state.studentsMarks.map((mark) => {
                      const student = mark.student;
                      const isSubmitted = mark.entry_status === 'submitted';
                      const isVerified = mark.entry_status === 'verified';
                      const isRejected = mark.entry_status === 'rejected';
                      
                      return (
                        <TableRow key={`${mark.student_id}-${mark.id}`} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
<TableCell className="font-medium text-gray-900 dark:text-white">
                             {student?.class_roll}
                           </TableCell>
                          <TableCell className="text-gray-700 dark:text-gray-300">
                            {student?.name}
                          </TableCell>
                          <TableCell className="text-center">
                            {mark.is_absent ? (
                              <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">ABSENT</Badge>
                            ) : (
                              <span className="font-semibold text-gray-900 dark:text-white">{mark.marks_obtained}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {isVerified ? (
                              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                <CheckCircle className="h-3 w-3 mr-1 inline" /> Verified
                              </Badge>
                            ) : isRejected ? (
                              <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                <XCircle className="h-3 w-3 mr-1 inline" /> Rejected
                              </Badge>
                            ) : isSubmitted ? (
                              <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                                Pending Verification
                              </Badge>
                            ) : (
                              <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                                Draft
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {isSubmitted && (
                              <div className="flex items-center justify-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-xs border-green-300 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400"
                                  onClick={() => openVerifyDialog(mark, "approve")}
                                >
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Verify
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-xs border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400"
                                  onClick={() => openVerifyDialog(mark, "reject")}
                                >
                                  <XCircle className="h-3 w-3 mr-1" />
                                  Reject
                                </Button>
                              </div>
                            )}
                            {mark.remarks && (
                              <div className="mt-1">
                                <Badge variant="outline" className="text-xs">
                                  <MessageSquare className="h-2 w-2 mr-1" />
                                  {mark.remarks.substring(0, 20)}
                                </Badge>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>

            {/* Note */}
            <Card className="rounded-3xl border-0 shadow-lg bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30">
              <CardContent className="p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  💡 Click on any subject row to view detailed marks. You can also verify individual marks using the Verify/Reject buttons above.
                </p>
              </CardContent>
            </Card>
          </>
        )}

        {/* Verify Dialog */}
        <Dialog open={state.verifyDialogOpen} onOpenChange={(open) => !open && dispatch({ type: 'SET_VERIFY_DIALOG', payload: { open: false } })}>
          <DialogContent className="sm:max-w-md bg-white dark:bg-gray-900">
            <DialogHeader>
              <DialogTitle className="text-gray-900 dark:text-white">
                {state.verifyAction === 'approve' ? 'Verify Mark' : 'Reject Mark'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {state.selectedMark && (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Student: <span className="font-semibold text-gray-900 dark:text-white">{state.selectedMark.student?.name}</span>
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Marks: <span className="font-semibold text-gray-900 dark:text-white">{state.selectedMark.marks_obtained}</span>
                  </p>
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300">Remarks (Optional)</Label>
                    <Textarea
                      value={state.verifyRemarks}
                      onChange={(e) => dispatch({ type: 'SET_VERIFY_REMARKS', payload: e.target.value })}
                      placeholder={state.verifyAction === 'approve' ? "Add verification notes..." : "Reason for rejection..."}
                      className="mt-1"
                      rows={3}
                    />
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => dispatch({ type: 'SET_VERIFY_DIALOG', payload: { open: false } })}>Cancel</Button>
              <Button
                onClick={handleVerifySingle}
                disabled={state.submitting}
                className={state.verifyAction === 'approve' 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'bg-red-600 hover:bg-red-700'
                }
              >
                {state.submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (
                  state.verifyAction === 'approve' ? <CheckCircle className="mr-2 h-4 w-4" /> : <XCircle className="mr-2 h-4 w-4" />
                )}
                {state.verifyAction === 'approve' ? 'Verify' : 'Reject'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ResponsiveLayout>
  );
}
