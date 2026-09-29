// src/app/api/exams/marks/submit/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { MARK_STATUS } from '@/types/marks-status';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) throw authError;
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { term_id, class_id, subject_id, section_id } = body;

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

    // Only update DRAFT marks to SUBMITTED (backend validation)
    const { error, count } = await supabase
      .from('student_marks_new')
      .update({ 
        entry_status: MARK_STATUS.SUBMITTED,
        updated_at: new Date().toISOString(),
      })
      .eq('term_id', term_id)
      .eq('exam_subject_id', examSubject.id)
      .eq('entry_status', MARK_STATUS.DRAFT);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: `${count || 0} marks submitted successfully`,
      submitted_count: count || 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}