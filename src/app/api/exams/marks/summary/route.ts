// src/app/api/exams/marks/summary/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { MarkStatus } from '@/types/marks-status';

type MarkEntryStatus = {
  entry_status: MarkStatus
};

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const term_id = searchParams.get('term_id');
    const class_id = searchParams.get('class_id');
    const subject_id = searchParams.get('subject_id');
    const section_id = searchParams.get('section_id');

    if (!term_id || !class_id || !subject_id) {
      return NextResponse.json({ 
        success: false, 
        error: 'term_id, class_id, subject_id are required' 
      }, { status: 400 });
    }

    // Get exam_subject_id
    let examSubjectQuery = supabase
      .from('exam_subjects')
      .select('id')
      .eq('term_id', term_id)
      .eq('class_id', class_id)
      .eq('subject_id', subject_id);

    if (section_id) {
      examSubjectQuery = examSubjectQuery.eq('section_id', section_id);
    }

    const { data: examSubject, error: examError } = await examSubjectQuery.single();

    if (examError || !examSubject) {
      return NextResponse.json({ 
        success: false, 
        error: 'Exam subject not found' 
      }, { status: 404 });
    }

    // Get all marks for this subject
    const { data, error } = await supabase
      .from('student_marks_new')
      .select('entry_status')
      .eq('term_id', term_id)
      .eq('exam_subject_id', examSubject.id);

    if (error) throw error;

    const marks = (data ?? []) as MarkEntryStatus[];

    // Count by status
    const draftCount = marks.filter((m) => m.entry_status === 'draft').length || 0;
    const submittedCount = marks?.filter((m: MarkEntryStatus) => m.entry_status === 'submitted').length || 0;
    const verifiedCount = marks?.filter((m: MarkEntryStatus) => m.entry_status === 'verified').length || 0;
    const lockedCount = marks?.filter((m: MarkEntryStatus) => m.entry_status === 'locked').length || 0;

    return NextResponse.json({
      success: true,
      data: {
        draft_count: draftCount,
        submitted_count: submittedCount,
        verified_count: verifiedCount,
        locked_count: lockedCount,
        total_count: marks?.length || 0,
        can_submit: draftCount > 0,
        can_verify: submittedCount > 0,
        can_lock: verifiedCount > 0,
        is_fully_locked: lockedCount === marks?.length && marks?.length > 0,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}