// src/app/api/exams/marks/lock/route.ts
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

    // Only update VERIFIED marks to LOCKED (backend validation)
    const { error, count } = await supabase
      .from('student_marks_new')
      .update({ 
        entry_status: MARK_STATUS.LOCKED,
        locked_by: user.id,
        locked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('term_id', term_id)
      .eq('exam_subject_id', examSubject.id)
      .eq('entry_status', MARK_STATUS.VERIFIED);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: `${count || 0} marks locked successfully`,
      locked_count: count || 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}