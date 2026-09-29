// src/app/exams/marks/entry/page.tsx
'use client';

import { useState, useEffect, useCallback, useMemo, useRef, memo, useDeferredValue } from 'react';
import { ResponsiveLayout } from "@/components/layout/responsive-layout";
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Save, 
  Loader2, 
  RefreshCw,
  AlertCircle,
  Users,
  BookOpen,
  Lock,
  Search,
  ArrowLeft,
  Keyboard,
  Zap,
  UserX,
  Eye,
  EyeOff
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
  subject_id: string;
  name: string;
  code: string;
  full_marks: number;
  pass_marks: number;
  sort_order: number;
}

interface Student {
   id: string
   name: string
   name_bn: string
   class_roll: string
   student_id: string
   father_name: string
   father_name_bn: string
   photo_url?: string
 }

interface MarkData {
  student_id: string;
  subject_id: string;
  marks_obtained: number;
  is_absent: boolean;
}

// Flat structure for better performance
interface FlatMarkState {
  [key: string]: {
    marks: number;
    absent: boolean;
    isDirty: boolean;
  };
}

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

// Subject order definition
const SUBJECT_ORDER: { [key: string]: number } = {
  'Bangla': 1, 'Bengali': 1, 'English': 2, 'Mathematics': 3, 'Math': 3,
  'Religion': 4, 'Religion and ICT': 5, 'Science': 6, 'Bangladesh and Global Studies': 7,
  'BGS': 7, 'Drawing': 8, 'Arts': 8, 'Optional': 9, 'ঐচ্ছিক': 9
};

const getSubjectSortOrder = (subjectName: string): number => {
  const lowerName = subjectName.toLowerCase();
  for (const [key, order] of Object.entries(SUBJECT_ORDER)) {
    if (lowerName.includes(key.toLowerCase())) return order;
  }
  return 99;
};

// Memoized Subject Cell Component with custom comparison
const SubjectCell = memo(function SubjectCell({ 
  studentId,
  subject,
  value,
  isAbsent,
  isLocked,
  onMarkChange,
  onAbsentToggle,
  onFocus,
  onKeyDown,
  inputRef
}: any) {
  const inputRefLocal = useRef<HTMLInputElement>(null);
  const isComposingRef = useRef(false);
  const currentValueRef = useRef<string>('');

  const commitValue = useCallback(() => {
    const rawValue = currentValueRef.current;
    if (rawValue === '') {
      onMarkChange(studentId, subject.id, 0);
      return;
    }
    const numValue = parseInt(rawValue, 10);
    if (!isNaN(numValue)) {
      const clampedValue = Math.min(Math.max(numValue, 0), Number(subject.full_marks));
      onMarkChange(studentId, subject.id, clampedValue);
    }
  }, [onMarkChange, studentId, subject.id, subject.full_marks]);

  const handleBlur = useCallback(() => {
    if (isComposingRef.current) return;
    commitValue();
  }, [commitValue]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitValue();
      onKeyDown(e, subject.id);
    } else if (e.key === 'Tab') {
      commitValue();
      onKeyDown(e, subject.id);
    }
  }, [commitValue, onKeyDown, subject.id]);

  const handleFocus = useCallback(() => {
    currentValueRef.current = value === 0 || value === null || value === undefined ? '' : String(value);
    if (inputRefLocal.current) {
      inputRefLocal.current.value = currentValueRef.current;
    }
    onFocus(studentId, subject.id);
  }, [value, onFocus, studentId, subject.id]);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (isComposingRef.current) return;
    currentValueRef.current = e.target.value;
  }, []);

  const handleCompositionStart = useCallback(() => {
    isComposingRef.current = true;
  }, []);

  const handleCompositionEnd = useCallback(() => {
    isComposingRef.current = false;
  }, []);

  return (
    <td className="px-2 py-2 text-center">
      <div className="flex flex-col items-center gap-1">
        <Input
          ref={(el: HTMLInputElement | null) => {
            inputRefLocal.current = el;
            if (typeof inputRef === 'function') inputRef(el);
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          defaultValue={value === 0 || value === null || value === undefined ? '' : String(value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          onFocus={handleFocus}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          disabled={isLocked || isAbsent}
          className={`w-20 text-center text-sm rounded-lg border-gray-300 dark:border-gray-600 ${
            isAbsent ? 'bg-gray-100 dark:bg-gray-800 text-gray-400' : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
          }`}
          placeholder="0"
        />
        <button
          type="button"
          disabled={isLocked}
          onClick={() => onAbsentToggle(studentId, subject.id, !isAbsent)}
          className={`text-[9px] font-bold px-1.5 py-0.5 rounded transition-all uppercase ${
            isAbsent 
              ? 'bg-rose-600 text-white' 
              : 'bg-gray-100 text-gray-400 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-500 dark:hover:bg-gray-700'
          }`}
        >
          {isAbsent ? 'Present?' : 'Absent'}
        </button>
      </div>
    </td>
  );
}, (prev, next) => {
  // Custom comparison for performance
  return (
    prev.value === next.value &&
    prev.isAbsent === next.isAbsent &&
    prev.isLocked === next.isLocked &&
    prev.subject.full_marks === next.subject.full_marks
  );
});

// Optimized Student Row with stable callbacks
const StudentRow = memo(function StudentRow({ 
  student, 
  subjects, 
  getMarkValue,
  getAbsentStatus,
  onMarkChange, 
  onAbsentToggle,
  onBulkAbsentToggle,
  isLocked,
  onNextRow,
  onPrevRow,
  currentFocusStudentId,
  currentFocusSubjectId,
  onCellFocus,
  rowRef
}: any) {
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Stable keydown handler
  const handleKeyDown = useCallback((e: React.KeyboardEvent, subjectId: string, subjectIndex: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (subjectIndex === subjects.length - 1) {
        onNextRow();
      } else {
        const nextSubject = subjects[subjectIndex + 1];
        inputRefs.current[`${student.id}_${nextSubject.id}`]?.focus();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      onPrevRow();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      onNextRow();
    }
  }, [subjects.length, student.id, onNextRow, onPrevRow]);

  const handleCellFocus = useCallback((studentId: string, subjectId: string) => {
    onCellFocus(studentId, subjectId);
  }, [onCellFocus]);

  // Focus management
  useEffect(() => {
    if (currentFocusStudentId === student.id && currentFocusSubjectId) {
      inputRefs.current[`${student.id}_${currentFocusSubjectId}`]?.focus();
    }
  }, [currentFocusStudentId, currentFocusSubjectId, student.id]);

const absentCount = subjects.filter((sub: Subject) => getAbsentStatus(student.id, sub.id)).length;
  const isAllAbsent = subjects.length > 0 && absentCount === subjects.length;
  const hasPartialAbsent = absentCount > 0 && absentCount < subjects.length;
  const getInitials = (name: string) => name.charAt(0).toUpperCase();

  return (
    <tr ref={rowRef} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
      <td className="px-3 py-2 font-medium text-gray-900 dark:text-white text-sm sticky left-0 bg-white dark:bg-gray-900 z-10">
        {student.class_roll}
      </td>
      <td className="px-3 py-2 border-r bg-white dark:bg-gray-900 sticky left-[70px] z-10 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)]">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 border border-gray-200 dark:border-gray-700">
            <AvatarImage src={student.photo_url} alt={student.name} />
            <AvatarFallback className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs">
              {getInitials(student.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{student.name}</div>
            <div className="text-[11px] text-gray-400 dark:text-gray-500 truncate font-mono">{student.class_roll}</div>
          </div>
        </div>
      </td>
      {hasPartialAbsent && !isAllAbsent && (
        <td className="px-2 py-2 text-center">
          <Badge className="mt-1 text-[10px] bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400">
            <UserX className="h-2 w-2 mr-1" />
            {absentCount}/{subjects.length} absent
          </Badge>
        </td>
      )}
      {isAllAbsent && (
        <td className="px-2 py-2 text-center">
          <Badge className="mt-1 text-[10px] bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400">
            <UserX className="h-2 w-2 mr-1" />
            Full Absent
          </Badge>
        </td>
      )}
      {subjects.map((subject: Subject, idx: number) => (
        <SubjectCell
          key={subject.id}
          studentId={student.id}
          subject={subject}
          value={getMarkValue(student.id, subject.id)}
          isAbsent={getAbsentStatus(student.id, subject.id)}
          isLocked={isLocked}
          onMarkChange={onMarkChange}
          onAbsentToggle={onAbsentToggle}
          onFocus={handleCellFocus}
          onKeyDown={(e: React.KeyboardEvent, subjectId: string) => handleKeyDown(e, subjectId, idx)}
          inputRef={(el: HTMLInputElement | null) => {
            inputRefs.current[`${student.id}_${subject.id}`] = el;
          }}
        />
      ))}
      <td className="px-2 py-2 text-center">
        <button
          type="button"
          disabled={isLocked}
          onClick={() => onBulkAbsentToggle(student.id, !isAllAbsent)}
          className={`text-[10px] font-bold px-2 py-1.5 rounded transition-all whitespace-nowrap ${
            isAllAbsent
              ? 'bg-rose-600 text-white hover:bg-rose-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
          }`}
        >
          {isAllAbsent ? 'All Absent' : 'Mark All Absent'}
        </button>
      </td>
    </tr>
  );
});

export default function MarksEntryPage() {
  const [loading, setLoading] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  
  // Selection state
  const [terms, setTerms] = useState<ExamTerm[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  
  const [selectedTerm, setSelectedTerm] = useState<string>("");
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedSection, setSelectedSection] = useState<string>("");
  
  // Filter states
  const [showOnlyAbsent, setShowOnlyAbsent] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("all");
  
  // Flat state structure
  const [marksState, setMarksState] = useState<FlatMarkState>({});
  const [editedState, setEditedState] = useState<FlatMarkState>({});
  
  // Refs for row navigation
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  
  // State refs for avoiding stale closures
  const marksStateRef = useRef(marksState);
  const editedStateRef = useRef(editedState);
  const pendingSaveRef = useRef<Record<string, { marks: number; absent: boolean }>>({});
  const isSavingRef = useRef(false);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const [isLocked, setIsLocked] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentFocus, setCurrentFocus] = useState<{ studentId: string; subjectId: string } | null>(null);
  
  // Debounced search for performance
  const debouncedSearch = useDebounce(searchQuery, 300);
  const deferredFilter = useDeferredValue(showOnlyAbsent);
  
  // Keyboard navigation
  const [currentStudentIndex, setCurrentStudentIndex] = useState(0);
  const [currentSubjectIndex, setCurrentSubjectIndex] = useState(0);

  // Update refs when state changes
  useEffect(() => { marksStateRef.current = marksState; }, [marksState]);
  useEffect(() => { editedStateRef.current = editedState; }, [editedState]);

  const getKey = (studentId: string, subjectId: string) => `${studentId}_${subjectId}`;
  
  const getMarkValue = useCallback((studentId: string, subjectId: string): number => {
    const key = getKey(studentId, subjectId);
    return editedStateRef.current[key]?.marks ?? marksStateRef.current[key]?.marks ?? 0;
  }, []);
  
  const getAbsentStatus = useCallback((studentId: string, subjectId: string): boolean => {
    const key = getKey(studentId, subjectId);
    return editedStateRef.current[key]?.absent ?? marksStateRef.current[key]?.absent ?? false;
  }, []);

  // Fetch terms
  const fetchTerms = useCallback(async () => {
    const { data } = await supabase.from('exam_terms').select('id, name').order('created_at');
    if (data) setTerms(data);
    if (data && data.length > 0 && !selectedTerm) setSelectedTerm(data[0].id);
  }, [selectedTerm]);

  const fetchClasses = useCallback(async () => {
    const { data } = await supabase.from('classes').select('id, name').order('numeric_order');
    if (data) setClasses(data);
    if (data && data.length > 0 && !selectedClass) setSelectedClass(data[0].id);
  }, [selectedClass]);

  const fetchSections = useCallback(async (classId: string) => {
    if (!classId) return;
    const { data } = await supabase.from('sections').select('id, name').eq('class_id', classId);
    if (data) setSections(data);
    if (data && data.length > 0 && !selectedSection) setSelectedSection(data[0].id);
  }, [selectedSection]);

  const fetchAllData = useCallback(async () => {
    if (!selectedTerm || !selectedClass || !selectedSection) return;
    setLoading(true);
    try {
      const { data: subjectsData } = await supabase
        .from('exam_subjects')
        .select(`id, subject_id, full_marks, pass_marks, subject:subject_id(id, name, code)`)
        .eq('term_id', selectedTerm)
        .eq('class_id', selectedClass);
      
      if (!subjectsData?.length) { setSubjects([]); setLoading(false); return; }
      
      const formattedSubjects: Subject[] = subjectsData.map((s: any) => ({
        id: s.id, subject_id: s.subject_id, name: s.subject?.name || 'Unknown',
        code: s.subject?.code || '', full_marks: Number(s.full_marks), pass_marks: Number(s.pass_marks),
        sort_order: getSubjectSortOrder(s.subject?.name || ''),
      })).sort((a, b) => a.sort_order - b.sort_order);
      setSubjects(formattedSubjects);
      
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('id, name, name_bn, class_roll, student_id, father_name, father_name_bn, student_photo_url')
        .eq('status', 'active').eq('class_id', selectedClass).eq('section_id', selectedSection).order('class_roll');
      
      if (studentsError) {
        console.error('Students fetch error:', studentsError);
        toast.error('Failed to load students');
        setLoading(false);
        return;
      }
      
      if (!studentsData?.length) { setStudents([]); setLoading(false); return; }
      const mappedStudents = (studentsData || []).map((s: any) => ({
        ...s,
        photo_url: s.student_photo_url
      }));
      setStudents(mappedStudents);
      
      const subjectIds = subjectsData.map((s: any) => s.id);
      if (!subjectIds.length) { setLoading(false); return; }
      
      const { data: marksData } = await supabase
        .from('student_marks_new')
        .select('student_id, exam_subject_id, marks_obtained, is_absent, entry_status')
        .eq('term_id', selectedTerm).in('exam_subject_id', subjectIds);
      
      setIsLocked(marksData?.some((m: any) => m.entry_status === 'locked') || false);
      
      const newMarksState: FlatMarkState = {};
      marksData?.forEach((m: any) => {
        newMarksState[getKey(m.student_id, m.exam_subject_id)] = {
          marks: m.marks_obtained || 0, absent: m.is_absent || false, isDirty: false
        };
      });
      setMarksState(newMarksState);
      setEditedState({});
      pendingSaveRef.current = {};
    } catch (error) {
      console.error(error);
      toast.error('Failed to load data');
    } finally { setLoading(false); }
  }, [selectedTerm, selectedClass, selectedSection]);

  // Safe auto-save with queue pattern
  const requestSave = useCallback(async () => {
    if (isSavingRef.current) return;
    
    const snapshot = { ...pendingSaveRef.current };
    if (Object.keys(snapshot).length === 0) return;
    
    // Clear pending early to avoid duplicate saves
    pendingSaveRef.current = {};
    isSavingRef.current = true;
    setAutoSaving(true);
    
    const marksToSave: MarkData[] = [];
    for (const key of Object.keys(snapshot)) {
      const [studentId, subjectId] = key.split('_');
      const data = snapshot[key];
      marksToSave.push({ student_id: studentId, subject_id: subjectId, marks_obtained: data.marks, is_absent: data.absent });
    }
    
    const { error } = await supabase
      .from('student_marks_new')
      .upsert(marksToSave.map(m => ({
        student_id: m.student_id, term_id: selectedTerm, exam_subject_id: m.subject_id,
        marks_obtained: m.marks_obtained, is_absent: m.is_absent, entry_status: 'draft'
      })), { onConflict: 'student_id, term_id, exam_subject_id' });
    
    if (error) {
      console.error('Auto-save error:', error);
      toast.error('Auto-save failed');
      // Restore pending changes on error
      pendingSaveRef.current = { ...snapshot, ...pendingSaveRef.current };
    } else {
      // Merge saved changes into marksState
      setMarksState(prev => {
        const newState = { ...prev };
        for (const key of Object.keys(snapshot)) {
          newState[key] = { ...snapshot[key], isDirty: false };
        }
        return newState;
      });
      setEditedState(prev => {
        const newState = { ...prev };
        for (const key of Object.keys(snapshot)) delete newState[key];
        return newState;
      });
    }
    
    setAutoSaving(false);
    isSavingRef.current = false;
  }, [selectedTerm]);

  const autoSave = useCallback(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      requestSave();
    }, 1200);
  }, [requestSave]);

  const trackChange = useCallback((key: string, marks: number, absent: boolean) => {
    setEditedState(prev => ({ ...prev, [key]: { marks, absent, isDirty: true } }));
    pendingSaveRef.current[key] = { marks, absent };
    autoSave();
  }, [autoSave]);

  // Batch update for bulk absent
  const handleBulkAbsentToggle = useCallback((studentId: string, checked: boolean) => {
    const updates: Record<string, { marks: number; absent: boolean; isDirty: boolean }> = {};
    subjects.forEach(subject => {
      const key = getKey(studentId, subject.id);
      const existingMarks = marksStateRef.current[key]?.marks || 0;
      updates[key] = { marks: checked ? 0 : existingMarks, absent: checked, isDirty: true };
    });
    setEditedState(prev => ({ ...prev, ...updates }));
    Object.entries(updates).forEach(([key, data]) => {
      pendingSaveRef.current[key] = { marks: data.marks, absent: data.absent };
    });
    autoSave();
  }, [subjects, autoSave]);

  const handleMarkChange = useCallback((studentId: string, subjectId: string, value: number) => {
    const subject = subjects.find(s => s.id === subjectId);
    if (!subject) return;
    const validValue = Math.min(Math.max(value || 0, 0), subject.full_marks);
    const key = getKey(studentId, subjectId);
    const currentAbsent = editedStateRef.current[key]?.absent ?? marksStateRef.current[key]?.absent ?? false;
    trackChange(key, validValue, currentAbsent);
  }, [subjects, trackChange]);

  const handleAbsentToggle = useCallback((studentId: string, subjectId: string, checked: boolean) => {
    const key = getKey(studentId, subjectId);
    const existingMarks = marksStateRef.current[key]?.marks || 0;
    trackChange(key, checked ? 0 : existingMarks, checked);
  }, [trackChange]);

  // Optimized absent student map - pure state, no refs
  const absentStudentMap = useMemo(() => {
    const map = new Set<string>();
    for (const student of students) {
      let hasAbsent = false;
      for (const sub of subjects) {
        const key = getKey(student.id, sub.id);
        if (marksState[key]?.absent || editedState[key]?.absent) {
          hasAbsent = true;
          break;
        }
      }
      if (hasAbsent) map.add(student.id);
    }
    return map;
  }, [students, subjects, marksState, editedState]);

  // Filtered students with stable references
const filteredStudents = useMemo(() => {
     let result = students;
     
     if (debouncedSearch) {
       const query = debouncedSearch.toLowerCase().trim();
 result = result.filter(s => 
          s.name.toLowerCase().includes(query) || 
          (s.name_bn && s.name_bn.toLowerCase().includes(query)) ||
          s.class_roll.toLowerCase().includes(query) ||
          (s.student_id && s.student_id.toLowerCase().includes(query))
        );
     }
     
     if (deferredFilter) {
       result = result.filter(s => absentStudentMap.has(s.id));
     }
     
     return result;
   }, [students, debouncedSearch, deferredFilter, absentStudentMap]);

  const visibleSubjects = useMemo(() => {
    if (selectedSubjectId === 'all') return subjects;
    return subjects.filter(s => s.id === selectedSubjectId);
  }, [subjects, selectedSubjectId]);

  // Safe navigation using row refs
  const handleNextRow = useCallback(() => {
    if (currentStudentIndex < filteredStudents.length - 1) {
      const nextIndex = currentStudentIndex + 1;
      const nextStudent = filteredStudents[nextIndex];
      setCurrentStudentIndex(nextIndex);
      if (visibleSubjects.length > 0) {
        setCurrentFocus({
          studentId: nextStudent.id,
          subjectId: visibleSubjects[currentSubjectIndex]?.id,
        });
      }
      rowRefs.current[nextStudent.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentStudentIndex, filteredStudents, visibleSubjects, currentSubjectIndex]);

  const handlePrevRow = useCallback(() => {
    if (currentStudentIndex > 0) {
      const prevIndex = currentStudentIndex - 1;
      const prevStudent = filteredStudents[prevIndex];
      setCurrentStudentIndex(prevIndex);
      if (visibleSubjects.length > 0) {
        setCurrentFocus({
          studentId: prevStudent.id,
          subjectId: visibleSubjects[currentSubjectIndex]?.id,
        });
      }
      rowRefs.current[prevStudent.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentStudentIndex, filteredStudents, visibleSubjects, currentSubjectIndex]);

  const handleManualSave = async () => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    await requestSave();
    toast.success('All marks saved successfully');
  };

  useEffect(() => { fetchTerms(); fetchClasses(); }, []);
  useEffect(() => { if (selectedClass) fetchSections(selectedClass); }, [selectedClass]);
  useEffect(() => { if (selectedTerm && selectedClass && selectedSection) fetchAllData(); }, [selectedTerm, selectedClass, selectedSection]);
  useEffect(() => { return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); }; }, []);

  const needsSelection = !selectedTerm || !selectedClass || !selectedSection;

  return (
    <ResponsiveLayout>
      <div className="space-y-4 p-4">
        {/* Header */}
        <div className="rounded-2xl bg-gradient-to-r from-emerald-700 via-teal-700 to-cyan-800 py-3 px-5 shadow-xl">
          <div className="flex flex-row gap-4 justify-between items-center">
            <div className="flex items-center gap-4">
              <Link href="/exams/dashboard">
                <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/20 -ml-2 h-8 text-xs">
                  <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-white" />
                <h1 className="text-xl font-bold text-white">Fast Marks Entry</h1>
                <Badge className={`${isLocked ? 'bg-red-500' : 'bg-green-500'} text-white text-[10px] px-2 py-0.5`}>
                  {isLocked ? 'Locked' : 'Live Mode'}
                </Badge>
                {autoSaving && (
                  <Badge className="bg-yellow-500 text-white text-[10px] px-2 py-0.5">
                    <Loader2 className="h-2.5 w-2.5 animate-spin mr-1" /> Saving...
                  </Badge>
                )}
              </div>
              <p className="text-emerald-100 text-[11px] hidden lg:block">Tab/Enter → Next | ↑↓ → Rows</p>
            </div>
            <Button onClick={handleManualSave} disabled={isLocked || needsSelection} className="bg-white/20 hover:bg-white/30 text-white border-0 h-8 text-xs px-3" size="sm">
              <Save className="mr-1.5 h-3.5 w-3.5" /> Save All
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="border-0 shadow-lg rounded-2xl bg-white dark:bg-gray-900">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
              <div>
                <Label className="text-[11px] font-semibold text-gray-600 dark:text-gray-400">Exam Term</Label>
                <Select value={selectedTerm} onValueChange={setSelectedTerm}>
                  <SelectTrigger className="h-9 text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">
                    <SelectValue placeholder="Select Term" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px] overflow-y-auto bg-white dark:bg-gray-800">
                    {terms.map((term) => <SelectItem key={term.id} value={term.id} className="text-gray-900 dark:text-gray-100 text-sm">{term.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] font-semibold text-gray-600 dark:text-gray-400">Class</Label>
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger className="h-9 text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">
                    <SelectValue placeholder="Select Class" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px] overflow-y-auto bg-white dark:bg-gray-800">
                    {classes.map((cls) => <SelectItem key={cls.id} value={cls.id} className="text-gray-900 dark:text-gray-100 text-sm">{cls.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] font-semibold text-gray-600 dark:text-gray-400">Section</Label>
                <Select value={selectedSection} onValueChange={setSelectedSection}>
                  <SelectTrigger className="h-9 text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">
                    <SelectValue placeholder="Select Section" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px] overflow-y-auto bg-white dark:bg-gray-800">
                    {sections.map((section) => <SelectItem key={section.id} value={section.id} className="text-gray-900 dark:text-gray-100 text-sm">{section.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] font-semibold text-gray-600 dark:text-gray-400">Search</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <Input placeholder="Name / Roll..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-8 h-9 text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100" />
                </div>
              </div>
              <div>
                <Label className="text-[11px] font-semibold text-gray-600 dark:text-gray-400">Subject</Label>
                <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId}>
                  <SelectTrigger className="h-9 text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">
                    <SelectValue placeholder="All Subjects" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px] overflow-y-auto bg-white dark:bg-gray-800">
                    <SelectItem value="all" className="text-gray-900 dark:text-gray-100 text-sm">📚 All Subjects</SelectItem>
                    {subjects.map((subject) => <SelectItem key={subject.id} value={subject.id} className="text-gray-900 dark:text-gray-100 text-sm">{subject.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2">
                <Button onClick={() => setShowOnlyAbsent(!showOnlyAbsent)} variant={showOnlyAbsent ? "default" : "outline"} className={`h-9 text-sm flex-1 ${showOnlyAbsent ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'}`}>
                  {showOnlyAbsent ? <Eye className="h-3.5 w-3.5 mr-1.5" /> : <EyeOff className="h-3.5 w-3.5 mr-1.5" />}
                  {showOnlyAbsent ? "Show All" : "Absent Only"}
                </Button>
                <Button onClick={fetchAllData} disabled={loading || needsSelection} variant="outline" className="h-9 text-sm px-3 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loading State */}
        {loading && <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-emerald-600 dark:text-emerald-400" /></div>}

        {/* No Selection */}
        {!loading && needsSelection && (
          <Card className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-12 w-12 text-gray-400 dark:text-gray-500 mb-3" />
              <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-1">Select Filters</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Choose term, class and section to start marks entry</p>
            </CardContent>
          </Card>
        )}

        {/* No Subjects */}
        {!loading && !needsSelection && subjects.length === 0 && (
          <Card className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-12 w-12 text-gray-400 dark:text-gray-500 mb-3" />
              <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-1">No Subjects Assigned</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Please assign subjects to this exam term first</p>
            </CardContent>
          </Card>
        )}

        {/* Marks Entry Grid */}
        {!loading && !needsSelection && visibleSubjects.length > 0 && filteredStudents.length > 0 && !isLocked && (
          <Card className="rounded-xl overflow-hidden shadow-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
            <div className="overflow-x-auto max-h-[65vh] overflow-y-auto">
              <table className="w-full min-w-[800px] text-sm">
                <thead className="bg-gradient-to-r from-blue-500 to-indigo-600 sticky top-0 z-20">
                  <tr>
                    <th className="px-3 py-2.5 text-left text-white font-semibold text-xs sticky left-0 bg-blue-600 z-20 w-[65px]">Roll</th>
                    <th className="px-3 py-2.5 text-left text-white font-semibold text-xs sticky left-[65px] bg-blue-600 z-20 w-[210px] shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)]">Student</th>
                    {visibleSubjects.map((subject) => (
                      <th key={subject.id} className="px-2 py-2.5 text-center text-white font-semibold text-xs min-w-[90px]">
                        <div className="flex flex-col items-center">
                          <span className="text-xs font-medium">{subject.name}</span>
                          <span className="text-[9px] text-white/70">({subject.full_marks})</span>
                        </div>
                      </th>
                    ))}
                    <th className="px-2 py-2.5 text-center text-white font-semibold text-xs w-[95px] sticky right-0 bg-indigo-600 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.1)]">Bulk</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student) => (
                    <StudentRow
                      key={student.id}
                      student={student}
                      subjects={visibleSubjects}
                      getMarkValue={getMarkValue}
                      getAbsentStatus={getAbsentStatus}
                      onMarkChange={handleMarkChange}
                      onAbsentToggle={handleAbsentToggle}
                      onBulkAbsentToggle={handleBulkAbsentToggle}
                      isLocked={isLocked}
                      onNextRow={handleNextRow}
                      onPrevRow={handlePrevRow}
                      currentFocusStudentId={currentFocus?.studentId}
                      currentFocusSubjectId={currentFocus?.subjectId}
                      onCellFocus={(studentId: string, subjectId: string) => setCurrentFocus({ studentId, subjectId })}
                      rowRef={(el: HTMLTableRowElement | null) => { rowRefs.current[student.id] = el; }}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* No Students Message */}
        {!loading && !needsSelection && filteredStudents.length === 0 && !showOnlyAbsent && (
          <Card className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-12 w-12 text-gray-400 dark:text-gray-500 mb-3" />
              <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-1">No Students Found</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">No students in this section</p>
            </CardContent>
          </Card>
        )}

        {/* No Absent Students Message */}
        {!loading && !needsSelection && filteredStudents.length === 0 && showOnlyAbsent && (
          <Card className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <UserX className="h-12 w-12 text-gray-400 dark:text-gray-500 mb-3" />
              <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-1">No Absent Students</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">All students are present in all subjects</p>
              <Button onClick={() => setShowOnlyAbsent(false)} variant="outline" className="mt-3 h-8 text-sm">Show All Students</Button>
            </CardContent>
          </Card>
        )}

        {/* Locked Message */}
        {!loading && !needsSelection && isLocked && (
          <Card className="rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
            <CardContent className="p-2.5">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-400 text-xs">
                <Lock className="h-4 w-4" /> Marks are locked. Contact administrator to edit.
              </div>
            </CardContent>
          </Card>
        )}

        {/* Keyboard Shortcuts */}
        <div className="flex justify-center gap-4 text-[10px] text-gray-500 dark:text-gray-500 py-2 flex-wrap">
          <span className="flex items-center gap-1"><Keyboard className="h-3 w-3" /> Tab/Enter → Next</span>
          <span>↑↓ → Navigate Rows</span>
          <span className="flex items-center gap-1"><Zap className="h-3 w-3 text-green-500" /> Auto-save 1.2s</span>
          <span>🔢 Type numbers (Bangla keyboard supported)</span>
          <span>🎯 Absent filter shows partial/full absent</span>
        </div>
      </div>
    </ResponsiveLayout>
  );
}
