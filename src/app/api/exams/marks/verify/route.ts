// src/app/api/exams/marks/verify/route.ts
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
    const { marks_ids } = body;

    if (!marks_ids || marks_ids.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'No marks selected for verification' 
      }, { status: 400 });
    }

    // Only update SUBMITTED marks to VERIFIED (backend validation)
    const { error, count } = await supabase
      .from('student_marks_new')
      .update({ 
        entry_status: MARK_STATUS.VERIFIED,
        verified_by: user.id,
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .in('id', marks_ids)
      .eq('entry_status', MARK_STATUS.SUBMITTED);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: `${count || 0} marks verified successfully`,
      verified_count: count || 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}