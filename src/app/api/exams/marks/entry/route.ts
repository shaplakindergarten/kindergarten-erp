// src/app/api/exams/marks/entry/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

type StudentWithClass = {
  id: string
  name: string
  student_id: string
  class_roll: string
  father_name: string
  section_id: string
  class?: { id: string; name: string } | null
}

type ExistingMark = {
  student_id: string
  marks_obtained?: number | null
  is_absent?: boolean
  id?: string
  entry_status?: string
}

// GET: Marks entry sheet
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const term_id = searchParams.get('term_id');
    const class_id = searchParams.get('class_id');
    const subject_id = searchParams.get('subject_id');
    
    if (!term_id || !class_id || !subject_id) {
      return NextResponse.json({ success: false, error: 'Missing required params' }, { status: 400 });
    }
    
    // Get exam subject info
    const { data: examSubject, error: subjectError } = await supabase
      .from('exam_subjects')
      .select(`
        *,
        subject:subject_id (id, name, code)
      `)
      .eq('term_id', term_id)
      .eq('class_id', class_id)
      .eq('subject_id', subject_id)
      .single();
    
    if (subjectError) throw subjectError;
    
    // Get students
    const { data: studentsData, error: studentsError } = await supabase
      .from('students')
      .select('id, name, student_id, class_roll, father_name, section_id, class:class_id (id, name)')
      .eq('class_id', class_id)
      .eq('status', 'active')
      .order('class_roll');

    if (studentsError) throw studentsError;

    const students = studentsData as StudentWithClass[] | null;
    const studentList: StudentWithClass[] = students ?? [];

    // Get existing marks
    const { data, error: marksError } = await supabase
      .from('student_marks_new')
      .select('student_id, marks_obtained, is_absent, id, entry_status')
      .eq('term_id', term_id)
      .eq('exam_subject_id', examSubject.id);

    if (marksError) throw marksError;

    const existingMarks = data as ExistingMark[] | null;

    // Combine data
    const marksMap = new Map<string, ExistingMark>();
    existingMarks?.forEach((m) => {
      if (m?.student_id) {
        marksMap.set(m.student_id, m);
      }
    });

    const studentsWithMarks = studentList.map((student) => ({
      student_id: student.id,
      student_name: student.name,
      class_roll: student.class_roll,
      father_name: student.father_name,
      marks_obtained: marksMap.get(student.id)?.marks_obtained ?? null,
      is_absent: marksMap.get(student.id)?.is_absent ?? false,
      marks_id: marksMap.get(student.id)?.id ?? null,
      entry_status: marksMap.get(student.id)?.entry_status ?? 'draft',
    }));

    const className = students?.[0]?.class?.name || '';
    
    return NextResponse.json({
      success: true,
      data: {
        exam_subject: examSubject,
        class: { id: class_id, name: className },
        students: studentsWithMarks
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST: Save marks (draft)
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { data, error: authError } = await supabase.auth.getUser();

    if (authError) throw authError;

    const user = data.user;
    
    const { term_id, exam_subject_id, marks } = body;
    
    // Upsert marks
    for (const mark of marks) {
      const { error } = await supabase
        .from('student_marks_new')
        .upsert({
          student_id: mark.student_id,
          term_id: term_id,
          exam_subject_id: exam_subject_id,
          marks_obtained: mark.marks_obtained,
          is_absent: mark.is_absent || false,
          entry_status: 'draft',
          entered_by: user?.id,
          entered_at: new Date().toISOString()
        }, {
          onConflict: 'student_id, term_id, exam_subject_id'
        });
      
      if (error) throw error;
    }
    
    return NextResponse.json({ success: true, message: 'Marks saved successfully' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}