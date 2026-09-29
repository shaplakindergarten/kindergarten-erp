// src/app/api/exams/results/generate/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) throw authError;

    // ✅ User check
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { term_id } = body;

    if (!term_id) {
      return NextResponse.json({ success: false, error: 'term_id is required' }, { status: 400 });
    }

    // Call RPC function to generate results
    const { data, error } = await supabase.rpc('generate_term_result', { 
      p_term_id: term_id 
    });
    
    if (error) throw error;

    // ✅ Update term result_status with updated_at
    const { error: updateError } = await supabase
      .from('exam_terms')
      .update({ 
        result_status: 'generated', 
        updated_at: new Date().toISOString() 
      })
      .eq('id', term_id);
    
    if (updateError) throw updateError;

    // ✅ Safe RPC return value handling
    const resultData = Array.isArray(data) ? (data[0] || {}) : (data || {});

    return NextResponse.json({
      success: true,
      data: {
        processed_students: resultData?.processed_students || 0,
        passed_count: resultData?.passed_count || 0,
        failed_count: resultData?.failed_count || 0
      },
      message: 'Results generated successfully'
    });
  } catch (error) {
    // ✅ Error safe handling
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}