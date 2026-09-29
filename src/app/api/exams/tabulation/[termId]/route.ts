// src/app/api/exams/tabulation/[termId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ termId: string }> }
) {
  const { termId } = await params;
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const class_id = searchParams.get('class_id');
    const section_id = searchParams.get('section_id');

    let query = supabase
      .from('compiled_results')
      .select(`
        *,
        student:student_id (
          id, name, student_id, class_roll, father_name,
          class:class_id (id, name),
          section:section_id (id, name)
        )
      `)
      .eq('term_id', termId)
      .order('gpa', { ascending: false })
      .order('total_marks_obtained', { ascending: false });

    if (class_id) query = query.eq('class_id', class_id);
    if (section_id) query = query.eq('section_id', section_id);

    const { data, error } = await query;

    if (error) throw error;

    // Calculate rank dynamically
    const rows = Array.isArray(data) ? data : [];
    const results = [];
    for (let i = 0; i < rows.length; i++) {
      const item = rows[i];
      if (typeof item === 'object' && item !== null) {
        results.push({ ...item, rank: i + 1 });
      } else {
        results.push({ rank: i + 1 });
      }
    }

    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}