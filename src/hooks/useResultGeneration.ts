'use client';
// hooks/useResultGeneration.ts
import { useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

const supabase = createClient();

export interface SubjectLockStatus {
  exam_subject_id: string;
  subject_name: string;
  full_marks: number;
  pass_marks: number;
  total_students: number;
  locked_count: number;
  is_fully_locked: boolean;
}

export interface GenerationSummary {
  term_name: string;
  class_name: string;
  section_name: string;
  total_students: number;
  total_subjects: number;
  locked_subjects_count: number;
  is_generated: boolean;
  subjects: SubjectLockStatus[];
}

export interface GenerationResult {
  success: boolean;
  message: string;
  students_processed: number;
  subjects_processed: number;
  errors: Array<{ student?: string; subject?: string; error: string }>;
}

export function useResultGeneration() {
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [summary, setSummary] = useState<GenerationSummary | null>(null);

  const fetchSummary = useCallback(async (
    termId: string,
    classId: string,
    sectionId: string
  ): Promise<GenerationSummary | null> => {
    if (!termId || !classId || !sectionId) return null;

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_generation_summary', {
        p_term_id: termId,
        p_class_id: classId,
        p_section_id: sectionId
      });

      if (error) throw error;
      
      const summaryData = data as GenerationSummary;
      setSummary(summaryData);
      return summaryData;
    } catch (error) {
      console.error('Error fetching summary:', error);
      toast.error('Failed to load generation summary');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const generateResults = useCallback(async (
    termId: string,
    classId: string,
    sectionId: string,
    subjectIds: string[]
  ): Promise<GenerationResult | null> => {
    if (!termId || !classId || !sectionId || subjectIds.length === 0) {
      toast.error('Please select subjects to generate');
      return null;
    }

    setGenerating(true);
    try {
      const { data, error } = await supabase.rpc('generate_section_results', {
        p_term_id: termId,
        p_class_id: classId,
        p_section_id: sectionId,
        p_subject_ids: subjectIds
      });

      if (error) throw error;

      const result = data as GenerationResult;
      
      if (result.success) {
        toast.success(result.message);
        await fetchSummary(termId, classId, sectionId);
      } else {
        toast.error(result.message);
        if (result.errors && result.errors.length > 0) {
          console.error('Generation errors:', result.errors);
        }
      }
      
      return result;
    } catch (error) {
      console.error('Error generating results:', error);
      toast.error('Failed to generate results');
      return null;
    } finally {
      setGenerating(false);
    }
  }, [fetchSummary]);

  const reset = useCallback(() => {
    setSummary(null);
    setLoading(false);
    setGenerating(false);
  }, []);

  return {
    loading,
    generating,
    summary,
    fetchSummary,
    generateResults,
    reset
  };
}