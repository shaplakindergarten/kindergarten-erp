// src/app/exams/marks/lock/page.tsx

'use client';

import { useState, useEffect, useCallback, useRef, useMemo, useTransition, useReducer } from 'react';
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
  Lock,
  Users,
  BookOpen,
  CheckCircle,
  Clock,
  ShieldCheck,
  ArrowLeft,
  School,
  Zap,
  Eye,
  Layers,
  ChevronRight,
  ChevronDown,
  Wifi,
  WifiOff
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

interface Student {
   id: string;
   name: string;
   class_roll: string;
   class_id?: string;
   section_id?: string;
 }

interface StudentMark {
  id: string;
  student_id: string;
  student?: Student;
  marks_obtained: number;
  is_absent: boolean;
  entry_status: string;
  remarks?: string;
  updated_at?: string;
}

interface SubjectSummary {
  exam_subject_id: string;
  subject_name: string;
  full_marks: number;
  verified_count: number;
  locked_count: number;
  can_lock: boolean;
}

interface SummaryState {
  term_name: string;
  class_name: string;
  section_name: string;
  total_students: number;
  subjects: SubjectSummary[];
}

interface LockBatchResult {
  subjectId: string;
  success: boolean;
  lockedCount: number;
  error?: string;
}

type DataState = 'idle' | 'loading' | 'loaded' | 'no_subjects' | 'no_students' | 'no_verified' | 'error';

// Helper function to chunk array for batch processing
const chunkArray = <T,>(arr: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

// Optimized batch processor with concurrency control
const processBatchesWithConcurrency = async <T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number = 5
): Promise<R[]> => {
  const results: R[] = [];
  const chunks: T[][] = [];
  
  for (let i = 0; i < items.length; i += concurrency) {
    chunks.push(items.slice(i, i + concurrency));
  }
  
  for (const chunk of chunks) {
    const chunkResults = await Promise.all(chunk.map(processor));
    results.push(...chunkResults);
  }
  
  return results;
};

// Reducer for state management
interface AppState {
  loading: boolean;
  locking: boolean;
  refreshing: boolean;
  isRealtimeConnected: boolean;
  dataState: DataState;
  selectedTerm: string | undefined;
  selectedClass: string | undefined;
  selectedSection: string | undefined;
  selectedSubjectIds: string[];
  activeSubjectId: string | null;
  expandedSubjects: string[];
  summary: SummaryState | null;
  studentsMarks: StudentMark[];
  lockDialogOpen: boolean;
  selectedSubjectId: string | null;
  lockRemarks: string;
  lockingProgress: { current: number; total: number; currentSubject: string };
  lastSyncTime: Date | null;
}

type AppAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_LOCKING'; payload: boolean }
  | { type: 'SET_REFRESHING'; payload: boolean }
  | { type: 'SET_REALTIME_CONNECTED'; payload: boolean }
  | { type: 'SET_DATA_STATE'; payload: DataState }
  | { type: 'SET_SELECTED_TERM'; payload: string | undefined }
  | { type: 'SET_SELECTED_CLASS'; payload: string | undefined }
  | { type: 'SET_SELECTED_SECTION'; payload: string | undefined }
  | { type: 'SET_SELECTED_SUBJECT_IDS'; payload: string[] }
  | { type: 'TOGGLE_SUBJECT_SELECTION'; payload: string }
  | { type: 'TOGGLE_SELECT_ALL'; payload: string[] }
  | { type: 'SET_ACTIVE_SUBJECT_ID'; payload: string | null }
  | { type: 'TOGGLE_SUBJECT_EXPAND'; payload: string }
  | { type: 'SET_EXPANDED_SUBJECTS'; payload: string[] }
  | { type: 'SET_SUMMARY'; payload: SummaryState | null }
  | { type: 'SET_STUDENTS_MARKS'; payload: StudentMark[] }
  | { type: 'UPDATE_MARK_STATUS'; payload: { markId: string; status: string; remarks?: string; studentId?: string; subjectId?: string } }
  | { type: 'UPDATE_SUBJECT_LOCK_STATUS'; payload: { subjectId: string; lockedCount: number } }
  | { type: 'SET_LOCK_DIALOG'; payload: { open: boolean; subjectId?: string | null; remarks?: string } }
  | { type: 'SET_LOCK_REMARKS'; payload: string }
  | { type: 'SET_LOCKING_PROGRESS'; payload: { current: number; total: number; currentSubject: string } }
  | { type: 'SET_LAST_SYNC_TIME'; payload: Date | null }
  | { type: 'RESET_SUMMARY' };

const initialState: AppState = {
  loading: false,
  locking: false,
  refreshing: false,
  isRealtimeConnected: false,
  dataState: 'idle',
  selectedTerm: undefined,
  selectedClass: undefined,
  selectedSection: undefined,
  selectedSubjectIds: [],
  activeSubjectId: null,
  expandedSubjects: [],
  summary: null,
  studentsMarks: [],
  lockDialogOpen: false,
  selectedSubjectId: null,
  lockRemarks: '',
  lockingProgress: { current: 0, total: 0, currentSubject: '' },
  lastSyncTime: null,
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_LOCKING':
      return { ...state, locking: action.payload };
    case 'SET_REFRESHING':
      return { ...state, refreshing: action.payload };
    case 'SET_REALTIME_CONNECTED':
      return { ...state, isRealtimeConnected: action.payload };
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
    case 'TOGGLE_SUBJECT_EXPAND':
      return {
        ...state,
        expandedSubjects: state.expandedSubjects.includes(action.payload)
          ? state.expandedSubjects.filter(id => id !== action.payload)
          : [...state.expandedSubjects, action.payload],
      };
    case 'SET_EXPANDED_SUBJECTS':
      return { ...state, expandedSubjects: action.payload };
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
    case 'UPDATE_SUBJECT_LOCK_STATUS':
      return {
        ...state,
        summary: state.summary ? {
          ...state.summary,
          subjects: state.summary.subjects.map(subject =>
            subject.exam_subject_id === action.payload.subjectId
              ? { ...subject, locked_count: action.payload.lockedCount, can_lock: subject.verified_count > action.payload.lockedCount }
              : subject
          ),
        } : null,
      };
    case 'SET_LOCK_DIALOG':
      return {
        ...state,
        lockDialogOpen: action.payload.open,
        selectedSubjectId: action.payload.subjectId || null,
        lockRemarks: action.payload.remarks || '',
      };
    case 'SET_LOCK_REMARKS':
      return { ...state, lockRemarks: action.payload };
    case 'SET_LOCKING_PROGRESS':
      return { ...state, lockingProgress: action.payload };
    case 'SET_LAST_SYNC_TIME':
      return { ...state, lastSyncTime: action.payload };
    case 'RESET_SUMMARY':
      return {
        ...state,
        summary: null,
        studentsMarks: [],
        dataState: 'idle',
        selectedSubjectIds: [],
        activeSubjectId: null,
        expandedSubjects: [],
      };
    default:
      return state;
  }
}

// Custom hook for real-time subscription
function useLockRealtimeSubscription(
  termId: string | undefined,
  classId: string | undefined,
  sectionId: string | undefined,
  onMarkUpdate: (payload: any) => void
) {
  useEffect(() => {
    if (!termId || !classId || !sectionId) return;

    const channel = supabase
      .channel('lock-marks-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'student_marks_new',
          filter: `term_id=eq.${termId}`,
        },
        (payload) => {
          onMarkUpdate(payload);
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [termId, classId, sectionId, onMarkUpdate]);
}

export default function MarksLockPage() {
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
  const marksCacheRef = useRef<Map<string, { marks: StudentMark[]; timestamp: number }>>(new Map());
  const studentIdsCacheRef = useRef<Map<string, string[]>>(new Map());

  // Helper functions
  const checkAbort = useCallback((controller: AbortController | null): boolean => {
    return !controller || controller.signal.aborted;
  }, []);

  // Handle real-time mark updates
  const handleRealtimeMarkUpdate = useCallback((payload: any) => {
    const updatedMark = payload.new;
    const subjectId = updatedMark.exam_subject_id;
    
    // Update marks cache
    const cacheKey = `${state.selectedTerm}_${state.selectedClass}_${state.selectedSection}_${subjectId}`;
    const cachedData = marksCacheRef.current.get(cacheKey);
    if (cachedData) {
      const updatedMarks = cachedData.marks.map(mark =>
        mark.student_id === updatedMark.student_id
          ? { ...mark, entry_status: updatedMark.entry_status, updated_at: updatedMark.updated_at }
          : mark
      );
      marksCacheRef.current.set(cacheKey, { marks: updatedMarks, timestamp: Date.now() });
      
      if (state.activeSubjectId === subjectId) {
        dispatch({ type: 'SET_STUDENTS_MARKS', payload: updatedMarks });
      }
    }
    
    // Update subject summary
    if (updatedMark.entry_status === 'locked') {
      dispatch({ type: 'UPDATE_SUBJECT_LOCK_STATUS', payload: { subjectId, lockedCount: 1 } });
    }
    
    dispatch({ type: 'SET_LAST_SYNC_TIME', payload: new Date() });
  }, [state.selectedTerm, state.selectedClass, state.selectedSection, state.activeSubjectId]);

  // Setup real-time subscription
  useLockRealtimeSubscription(
    state.selectedTerm,
    state.selectedClass,
    state.selectedSection,
    handleRealtimeMarkUpdate
  );

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
      setSubjects(data);
      const map = new Map<string, ExamSubject>();
      data.forEach(s => map.set(s.id, s));
      subjectsMapRef.current = map;
    }
  }, [state.selectedTerm, state.selectedClass]);

  // Get student IDs (optimized with caching)
  const getSectionStudentIds = useCallback(async (classId: string, sectionId: string): Promise<string[]> => {
    if (!classId || !sectionId) return [];
    
    const cacheKey = `${classId}_${sectionId}`;
    if (studentIdsCacheRef.current.has(cacheKey)) {
      return studentIdsCacheRef.current.get(cacheKey)!;
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
    
    const studentIds = data?.map(s => s.id) || [];
    studentIdsCacheRef.current.set(cacheKey, studentIds);
    return studentIds;
  }, []);

  // Fetch students for a subject
  const fetchSubjectStudents = useCallback(async (subjectId: string, studentIds: string[]) => {
    if (studentIds.length === 0) return [];
    
const { data: studentsData, error: studentsError } = await supabase
       .from('students')
       .select('id, name, class_roll, class_id, section_id')
       .eq('status', 'active')
       .in('id', studentIds)
       .order('class_roll');
    
    if (studentsError) throw studentsError;
    return studentsData || [];
  }, []);

  // Fetch marks for a subject
  const fetchSubjectMarksData = useCallback(async (subjectId: string, studentIds: string[]) => {
    if (studentIds.length === 0) return [];
    
    const { data: marksData = [], error: marksError } = await supabase
      .from('student_marks_new')
      .select('id, student_id, marks_obtained, is_absent, entry_status, remarks, updated_at')
      .eq('exam_subject_id', subjectId)
      .in('student_id', studentIds);
    
    if (marksError) throw marksError;
    return marksData;
  }, []);

  // Fetch detailed marks for a subject with caching and TTL
  const fetchSubjectMarks = useCallback(async (subjectId: string, forceRefresh: boolean = false) => {
    const classId = state.selectedClass;
    const sectionId = state.selectedSection;
    const termId = state.selectedTerm;
    
    if (!subjectId || !classId || !sectionId || !termId) return;
    
    const cacheKey = `${termId}_${classId}_${sectionId}_${subjectId}`;
    const CACHE_TTL = 30000; // 30 seconds cache
    
    if (!forceRefresh && marksCacheRef.current.has(cacheKey)) {
      const cached = marksCacheRef.current.get(cacheKey)!;
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        dispatch({ type: 'SET_STUDENTS_MARKS', payload: cached.marks });
        dispatch({ type: 'SET_ACTIVE_SUBJECT_ID', payload: subjectId });
        return;
      }
    }
    
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
      
      const [studentsData, marksData] = await Promise.all([
        fetchSubjectStudents(subjectId, studentIds),
        fetchSubjectMarksData(subjectId, studentIds)
      ]);
      
      if (checkAbort(controller)) return;
      
      const mergedMarks: StudentMark[] = studentsData.map(student => {
        const mark = marksData.find(m => m.student_id === student.id);
        return {
          id: mark?.id || `temp-${student.id}`,
          student_id: student.id,
          student,
          marks_obtained: mark?.marks_obtained || 0,
          is_absent: mark?.is_absent || false,
          entry_status: mark?.entry_status || 'draft',
          remarks: mark?.remarks || '',
          updated_at: mark?.updated_at,
        };
      });
      
      if (checkAbort(controller)) return;
      
      marksCacheRef.current.set(cacheKey, { marks: mergedMarks, timestamp: Date.now() });
      
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
  }, [state.selectedClass, state.selectedSection, state.selectedTerm, getSectionStudentIds, fetchSubjectStudents, fetchSubjectMarksData, checkAbort]);

  // Optimized batch lock function with concurrency control
  const lockSubjectBatch = useCallback(async (
    subjectId: string,
    termId: string,
    studentIds: string[]
  ): Promise<LockBatchResult> => {
    const studentChunks = chunkArray(studentIds, 500);
    
    const chunkResults = await processBatchesWithConcurrency(
      studentChunks,
      async (chunk) => {
        const { error } = await supabase
          .from('student_marks_new')
          .update({ entry_status: 'locked' })
          .eq('term_id', termId)
          .eq('exam_subject_id', subjectId)
          .eq('entry_status', 'verified')
          .in('student_id', chunk);
        
        return { error, count: chunk.length };
      },
      3 // Process 3 chunks concurrently
    );
    
    const hasError = chunkResults.some(result => result.error);
    const lockedCount = chunkResults.reduce((sum, r) => sum + (r.error ? 0 : r.count), 0);
    
    return {
      subjectId,
      success: !hasError,
      lockedCount,
      error: hasError ? 'Some chunks failed' : undefined
    };
  }, []);

  // Fetch main data - DEFINED BEFORE handleBulkLock
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
      allMarksData.forEach((m: any) => {
        if (!marksMap.has(m.exam_subject_id)) {
          marksMap.set(m.exam_subject_id, []);
        }
        marksMap.get(m.exam_subject_id)!.push(m);
      });
      
      const subjectsStatus: SubjectSummary[] = examSubjects.map(examSubject => {
        const subjectMarks = marksMap.get(examSubject.id) || [];
        const verifiedCount = subjectMarks.filter((m: any) => m.entry_status === 'verified').length;
        const lockedCount = subjectMarks.filter((m: any) => m.entry_status === 'locked').length;
        
        return {
          exam_subject_id: examSubject.id,
          subject_name: examSubject.subject?.name || 'Unknown',
          full_marks: examSubject.full_marks,
          verified_count: verifiedCount,
          locked_count: lockedCount,
          can_lock: verifiedCount > 0 && lockedCount === 0,
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
      
      const lockableSubjectIds = subjectsStatus.filter(s => s.can_lock).map(s => s.exam_subject_id);
      dispatch({ type: 'SET_SELECTED_SUBJECT_IDS', payload: lockableSubjectIds });
      dispatch({ type: 'SET_DATA_STATE', payload: 'loaded' });
      dispatch({ type: 'SET_LAST_SYNC_TIME', payload: new Date() });
      
      // Clear marks cache when section changes
      marksCacheRef.current.clear();
      
    } catch (error: any) {
      if (error.name === 'AbortError' || checkAbort(controller)) return;
      console.error('Error fetching data:', error);
      if (isMountedRef.current && !checkAbort(controller)) {
        dispatch({ type: 'SET_DATA_STATE', payload: 'error' });
        toast.error('Failed to load lock data');
      }
    } finally {
      if (abortControllerRef.current === controller && isMountedRef.current) {
        abortControllerRef.current = null;
      }
      isFetchingRef.current = false;
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.selectedTerm, state.selectedClass, state.selectedSection, getSectionStudentIds, checkAbort]);

  // Bulk lock selected subjects with optimized batching - DEFINED AFTER fetchData
  const handleBulkLock = useCallback(async () => {
    const selectedSubjectIds = state.selectedSubjectIds;
    const classId = state.selectedClass;
    const sectionId = state.selectedSection;
    const termId = state.selectedTerm;
    
    if (!classId || !sectionId || !termId) return;
    
    if (selectedSubjectIds.length === 0) {
      toast.info('Please select at least one subject to lock');
      return;
    }
    
    dispatch({ type: 'SET_LOCKING', payload: true });
    dispatch({ type: 'SET_LOCKING_PROGRESS', payload: { current: 0, total: selectedSubjectIds.length, currentSubject: '' } });
    
    let successCount = 0;
    let failCount = 0;
    
    try {
      const studentIds = await getSectionStudentIds(classId, sectionId);
      
      if (studentIds.length === 0) {
        toast.error('No students found in this section');
        dispatch({ type: 'SET_LOCKING', payload: false });
        return;
      }
      
      // Process subjects with concurrency control
      const results = await processBatchesWithConcurrency(
        selectedSubjectIds,
        async (subjectId, index) => {
          const subjectName = subjectsMapRef.current.get(subjectId)?.subject?.name || 'Subject';
          dispatch({ type: 'SET_LOCKING_PROGRESS', payload: { 
            current: index + 1, 
            total: selectedSubjectIds.length,
            currentSubject: subjectName
          }});
          
          const result = await lockSubjectBatch(subjectId, termId, studentIds);
          
          // Update cache if subject is currently expanded
          if (result.success && state.expandedSubjects.includes(subjectId)) {
            const cacheKey = `${termId}_${classId}_${sectionId}_${subjectId}`;
            const cachedMarks = marksCacheRef.current.get(cacheKey);
            if (cachedMarks) {
              const updatedMarks = cachedMarks.marks.map(mark => ({
                ...mark,
                entry_status: mark.entry_status === 'verified' ? 'locked' : mark.entry_status
              }));
              marksCacheRef.current.set(cacheKey, { marks: updatedMarks, timestamp: Date.now() });
              if (state.activeSubjectId === subjectId) {
                dispatch({ type: 'SET_STUDENTS_MARKS', payload: updatedMarks });
              }
            }
          }
          
          // Update subject summary
          if (result.success) {
            dispatch({ type: 'UPDATE_SUBJECT_LOCK_STATUS', payload: { subjectId, lockedCount: result.lockedCount } });
          }
          
          return result;
        },
        3 // Process 3 subjects concurrently
      );
      
      results.forEach(result => {
        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }
      });
      
      if (successCount > 0) {
        toast.success(`${successCount} subject(s) locked successfully${failCount > 0 ? `, ${failCount} failed` : ''}`);
      }
      if (failCount > 0) {
        toast.error(`${failCount} subject(s) failed to lock`);
      }
      
      // Refresh data to ensure consistency
      await fetchData();
      dispatch({ type: 'SET_LAST_SYNC_TIME', payload: new Date() });
      
    } catch (err) {
      console.error('Error bulk locking:', err);
      toast.error('Failed to lock marks');
    } finally {
      dispatch({ type: 'SET_LOCKING', payload: false });
      dispatch({ type: 'SET_LOCKING_PROGRESS', payload: { current: 0, total: 0, currentSubject: '' } });
    }
  }, [state.selectedSubjectIds, state.selectedClass, state.selectedSection, state.selectedTerm, state.expandedSubjects, state.activeSubjectId, getSectionStudentIds, lockSubjectBatch, fetchData]);

  const handleRefresh = useCallback(async () => {
    dispatch({ type: 'SET_REFRESHING', payload: true });
    marksCacheRef.current.clear();
    studentIdsCacheRef.current.clear();
    await fetchData();
    dispatch({ type: 'SET_STUDENTS_MARKS', payload: [] });
    dispatch({ type: 'SET_ACTIVE_SUBJECT_ID', payload: null });
    dispatch({ type: 'SET_EXPANDED_SUBJECTS', payload: [] });
    dispatch({ type: 'SET_REFRESHING', payload: false });
    toast.success('Data refreshed');
  }, [fetchData]);

  const toggleSelectAll = useCallback(() => {
    if (!state.summary) return;
    const lockableSubjectIds = state.summary.subjects.filter(s => s.can_lock).map(s => s.exam_subject_id);
    const allSelected = state.selectedSubjectIds.length === lockableSubjectIds.length && lockableSubjectIds.length > 0;
    dispatch({ type: 'SET_SELECTED_SUBJECT_IDS', payload: allSelected ? [] : lockableSubjectIds });
  }, [state.summary, state.selectedSubjectIds]);

  const toggleSubject = useCallback((subjectId: string) => {
    dispatch({ type: 'TOGGLE_SUBJECT_SELECTION', payload: subjectId });
  }, []);

  const toggleSubjectExpand = useCallback(async (subjectId: string, subjectName: string, forceRefresh: boolean = false) => {
    const isExpanded = state.expandedSubjects.includes(subjectId);
    
    if (!isExpanded) {
      await fetchSubjectMarks(subjectId, forceRefresh);
      dispatch({ type: 'TOGGLE_SUBJECT_EXPAND', payload: subjectId });
    } else {
      dispatch({ type: 'TOGGLE_SUBJECT_EXPAND', payload: subjectId });
      if (state.activeSubjectId === subjectId) {
        dispatch({ type: 'SET_STUDENTS_MARKS', payload: [] });
        dispatch({ type: 'SET_ACTIVE_SUBJECT_ID', payload: null });
      }
    }
  }, [state.expandedSubjects, state.activeSubjectId, fetchSubjectMarks]);

  const handleSectionChange = useCallback((sectionId: string) => {
    dispatch({ type: 'SET_SELECTED_SECTION', payload: sectionId });
    dispatch({ type: 'RESET_SUMMARY' });
    dispatch({ type: 'SET_STUDENTS_MARKS', payload: [] });
    dispatch({ type: 'SET_ACTIVE_SUBJECT_ID', payload: null });
    dispatch({ type: 'SET_EXPANDED_SUBJECTS', payload: [] });
    marksCacheRef.current.clear();
    studentIdsCacheRef.current.clear();
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
    marksCacheRef.current.clear();
    studentIdsCacheRef.current.clear();
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
  const lockableCount = state.summary?.subjects.filter(s => s.can_lock).length || 0;
  const allLockableSelected = lockableCount > 0 && state.selectedSubjectIds.length === lockableCount;

  return (
    <ResponsiveLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="rounded-3xl bg-gradient-to-r from-red-700 via-rose-700 to-pink-800 p-6 shadow-2xl">
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
                <Lock className="h-8 w-8" />
                Lock Marks
                <Badge className="bg-red-400 text-black ml-2">Bulk Lock</Badge>
              </h1>
              <p className="text-red-100 mt-2">Lock verified marks - no further changes allowed</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Realtime Connection Status */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm">
                {state.isRealtimeConnected ? (
                  <>
                    <Wifi className="h-3.5 w-3.5 text-green-400 animate-pulse" />
                    <span className="text-xs text-white/80">Live Sync</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-3.5 w-3.5 text-yellow-400" />
                    <span className="text-xs text-white/80">Reconnecting...</span>
                  </>
                )}
                {state.lastSyncTime && (
                  <span className="text-[10px] text-white/60">
                    Last sync: {state.lastSyncTime.toLocaleTimeString()}
                  </span>
                )}
              </div>
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
                  <School className="h-4 w-4 text-red-600 dark:text-red-400" />
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
            <Loader2 className="h-8 w-8 animate-spin text-red-600 dark:text-red-400 mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading lock data...</p>
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
                Please select exam term, class and section to lock marks.
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

        {/* No Verified Marks State */}
        {!state.loading && !needsSelection && state.summary && state.summary.subjects.filter(s => s.can_lock).length === 0 && (
          <Card className="rounded-3xl border-0 shadow-lg bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-950/30 dark:to-amber-950/30">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-20 w-20 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center mb-4">
                <ShieldCheck className="h-10 w-10 text-yellow-600 dark:text-yellow-400" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Verified Marks</h2>
              <p className="text-gray-500 dark:text-gray-400 max-w-md">
                No verified marks found for locking. Please verify marks first.
              </p>
              <Link href="/exams/marks/verify">
                <Button className="mt-4 bg-indigo-600 hover:bg-indigo-700">
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Go to Verify Marks
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
                There was an error loading the lock data. Please try again.
              </p>
              <Button onClick={handleRefresh} className="mt-4">
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Bulk Lock UI with Expandable Subjects */}
        {!state.loading && !needsSelection && state.dataState === 'loaded' && state.summary && (
          <>
            {/* Info Card */}
            <Card className="rounded-3xl border-0 shadow-lg bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30">
              <CardContent className="p-5">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <School className="h-5 w-5 text-red-600 dark:text-red-400" />
                      {state.summary.term_name} | {state.summary.class_name} | {state.summary.section_name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Total Students: {state.summary.total_students} | 
                      Subjects ready to lock: {lockableCount}
                    </p>
                    {state.locking && (
                      <div className="mt-2 flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-red-600" />
                        <span className="text-sm text-red-600">
                          Locking: {state.lockingProgress.currentSubject} ({state.lockingProgress.current} / {state.lockingProgress.total})
                        </span>
                      </div>
                    )}
                    <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                      ⚠️ Locking marks is permanent. Click on any subject row to view student-wise marks.
                    </p>
                    {state.isRealtimeConnected && (
                      <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                        🔄 Real-time sync active - changes will appear instantly
                      </p>
                    )}
                  </div>
                  <Button
                    onClick={handleBulkLock}
                    disabled={!lockableCount || state.locking || state.selectedSubjectIds.length === 0}
                    className="bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white shadow-lg"
                  >
                    {state.locking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
                    Lock Selected ({state.selectedSubjectIds.length}) Subjects
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Expandable Subjects Table */}
            <div className="space-y-3">
              {state.summary.subjects.map((subject) => {
                const isSelectable = subject.can_lock;
                const isSelected = state.selectedSubjectIds.includes(subject.exam_subject_id);
                const isExpanded = state.expandedSubjects.includes(subject.exam_subject_id);
                const isFullyLocked = subject.verified_count === subject.locked_count && subject.verified_count > 0;
                const subjectMarks = isExpanded && state.activeSubjectId === subject.exam_subject_id ? state.studentsMarks : [];
                
                return (
                  <Card key={subject.exam_subject_id} className="rounded-3xl border-0 shadow-lg overflow-hidden bg-white dark:bg-gray-900">
                    {/* Subject Header Row */}
                    <div 
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                      onClick={() => toggleSubjectExpand(subject.exam_subject_id, subject.subject_name, false)}
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelectable && isSelected}
                            onCheckedChange={() => isSelectable && toggleSubject(subject.exam_subject_id)}
                            disabled={!isSelectable}
                            className="border-gray-300 dark:border-gray-600 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                          />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {subject.subject_name}
                            </span>
                            <span className="text-xs text-gray-500">({subject.full_marks} marks)</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-center">
                            <div className="text-xs text-gray-500">Verified</div>
                            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                              {subject.verified_count}
                            </Badge>
                          </div>
                          <div className="text-center">
                            <div className="text-xs text-gray-500">Locked</div>
                            <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                              {subject.locked_count}
                            </Badge>
                          </div>
                          <div className="text-center min-w-[100px]">
                            {isFullyLocked ? (
                              <Badge className="bg-red-500 text-white">Fully Locked</Badge>
                            ) : subject.verified_count === 0 ? (
                              <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">No Verified Marks</Badge>
                            ) : (
                              <Badge className="bg-green-500 text-white">Ready to Lock</Badge>
                            )}
                          </div>
                          <div className="text-gray-400">
                            {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Expandable Student Marks Table */}
                    {isExpanded && (
                      <div className="border-t border-gray-200 dark:border-gray-700">
                        {subjectMarks.length > 0 ? (
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader className="bg-gradient-to-r from-red-500 to-rose-600">
                                <TableRow>
                                  <TableHead className="text-white">Roll No</TableHead>
                                  <TableHead className="text-white">Student Name</TableHead>
                                  <TableHead className="text-white text-center">Marks Obtained</TableHead>
                                  <TableHead className="text-white text-center">Status</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {subjectMarks.map((mark) => {
                                  const student = mark.student;
                                  const isLocked = mark.entry_status === 'locked';
                                  const isVerified = mark.entry_status === 'verified';
                                  
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
                                        {isLocked ? (
                                          <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                            <Lock className="h-3 w-3 mr-1 inline" /> Locked
                                          </Badge>
                                        ) : isVerified ? (
                                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                            <CheckCircle className="h-3 w-3 mr-1 inline" /> Verified
                                          </Badge>
                                        ) : (
                                          <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                                            Draft
                                          </Badge>
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        ) : state.loading ? (
                          <div className="flex justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-red-600" />
                          </div>
                        ) : (
                          <div className="text-center py-8 text-gray-500">
                            No student data available
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>

            {/* Progress Summary */}
            <Card className="rounded-3xl border-0 shadow-lg bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30">
              <CardContent className="p-5">
                <div className="flex flex-wrap gap-6 justify-between items-center">
                  <div className="flex flex-wrap gap-4">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-green-500"></div>
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        Total Verified: {state.summary.subjects.reduce((sum, s) => sum + s.verified_count, 0)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-red-500"></div>
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        Total Locked: {state.summary.subjects.reduce((sum, s) => sum + s.locked_count, 0)}
                      </span>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    <Layers className="h-4 w-4 inline mr-1" />
                    Ready to Lock: {state.summary.subjects.reduce((sum, s) => sum + (s.verified_count - s.locked_count), 0)}
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
