// src/app/api/exams/subjects/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const term_id = searchParams.get('term_id');
    const class_id = searchParams.get('class_id');
    
    let query = supabase
      .from('exam_subjects')
      .select(`
        *,
        subject:subject_id (id, name, code, subject_type),
        class:class_id (id, name),
        section:section_id (id, name)
      `)
      .order('order_index');
    
    if (term_id) query = query.eq('term_id', term_id);
    if (class_id) query = query.eq('class_id', class_id);
    
    const { data, error } = await query;
    
    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    
    const { data, error } = await supabase
      .from('exam_subjects')
      .insert({
        term_id: body.term_id,
        class_id: body.class_id,
        section_id: body.section_id,
        subject_id: body.subject_id,
        subject_type: body.subject_type || 'compulsory',
        full_marks: body.full_marks,
        pass_marks: body.pass_marks,
        order_index: body.order_index || 0
      })
      .select()
      .single();
    
    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}