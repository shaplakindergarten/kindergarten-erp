// src/app/api/exams/marks/verified-list/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

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

    // Get exam_subject_id with subject details
    let examSubjectQuery = supabase
      .from('exam_subjects')
      .select('id, full_marks, pass_marks, subject:subject_id(id, name)')
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

    // Get ONLY verified marks (backend filtered)
    const { data: verifiedMarks, error } = await supabase
      .from('student_marks_new')
      .select(`
        id,
        marks_obtained,
        is_absent,
        entry_status,
        student_id,
student:student_id (
           id, 
           name, 
           class_roll, 
           admission_no, 
           father_name
         )
      `)
      .eq('term_id', term_id)
      .eq('exam_subject_id', examSubject.id)
      .eq('entry_status', 'verified');

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: {
        exam_subject: examSubject,
        verified_marks: verifiedMarks || [],
        count: verifiedMarks?.length || 0,
        can_lock: (verifiedMarks?.length || 0) > 0,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}