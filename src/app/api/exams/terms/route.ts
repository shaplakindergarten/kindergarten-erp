// src/app/api/exams/terms/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET: সব exam terms
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const academic_year_id = searchParams.get('academic_year_id');
    const status = searchParams.get('status');
    
    let query = supabase
      .from('exam_terms')
      .select(`
        *,
        academic_year:academic_year_id (id, year_name, is_current)
      `)
      .order('created_at', { ascending: false });
    
    if (academic_year_id) query = query.eq('academic_year_id', academic_year_id);
    if (status) query = query.eq('status', status);
    
    const { data, error } = await query;
    
    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST: নতুন exam term
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    
    const { data, error } = await supabase
      .from('exam_terms')
      .insert({
        academic_year_id: body.academic_year_id,
        name: body.name,
        term_code: body.term_code,
        weightage_percentage: body.weightage_percentage || 0,
        start_date: body.start_date,
        end_date: body.end_date,
        status: body.status || 'upcoming',
        result_status: 'draft'
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