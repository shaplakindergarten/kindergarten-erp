// src/app/api/students/print-reports/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    
    const classId = searchParams.get('classId');
    const sectionId = searchParams.get('sectionId');
    const academicYearId = searchParams.get('academicYearId');
    const search = searchParams.get('search');
    const studentId = searchParams.get('studentId');

    let query = supabase
      .from('students')
      .select(`
        *,
        class:classes(id, name),
        section:sections(id, name),
        academic_year:academic_years(id, name)
      `)
      .eq('status', 'active');

    if (studentId) {
      query = query.eq('student_id', studentId);
    }

    if (classId && classId !== 'all') {
      query = query.eq('class_id', classId);
    }

    if (sectionId && sectionId !== 'all') {
      query = query.eq('section_id', sectionId);
    }

    if (academicYearId) {
      query = query.eq('academic_year_id', academicYearId);
    }

    if (search) {
      query = query.or(
        `name.ilike.%${search}%,` +
        `father_name.ilike.%${search}%,` +
        `student_id.ilike.%${search}%`
      );
    }

    const { data, error } = await query.order('name', { ascending: true });

    if (error) {
      console.error('Error fetching students:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return NextResponse.json({ success: false, error: message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data, total: data?.length || 0 });
  } catch (error) {
    console.error('Error in print-reports API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}