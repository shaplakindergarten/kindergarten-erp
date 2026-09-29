// src/app/api/exams/results/publish/route.ts
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
    const { term_id, class_ids, section_ids, send_notification } = body;

    if (!term_id) {
      return NextResponse.json({ success: false, error: 'term_id is required' }, { status: 400 });
    }

    // ✅ Update compiled_results with filters
    let query = supabase
      .from('compiled_results')
      .update({
        is_published: true,
        published_at: new Date().toISOString()
      })
      .eq('term_id', term_id);

    if (class_ids?.length) query = query.in('class_id', class_ids);
    if (section_ids?.length) query = query.in('section_id', section_ids);

    const { error: updateError, count } = await query;
    if (updateError) throw updateError;

    // ✅ Log publish event with count
    const { error: logError } = await supabase
      .from('result_publish_log')
      .insert({
        term_id: term_id,
        published_by: user.id,
        published_at: new Date().toISOString(),
        notification_sent: send_notification || false,
        notes: `Published ${count || 0} results`
      });
    
    if (logError) throw logError;

    // ✅ Update term status with updated_at
    const { error: termError } = await supabase
      .from('exam_terms')
      .update({ 
        result_status: 'published', 
        updated_at: new Date().toISOString() 
      })
      .eq('id', term_id);
    
    if (termError) throw termError;

    return NextResponse.json({
      success: true,
      message: `Results published successfully (${count || 0} students)`,
      published_count: count || 0
    });
  } catch (error) {
    // ✅ Error safe handling
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}