// src/app/api/admin/delete-user/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

// ═══════════════════════════════════════════════════════════════════
// DELETE: Remove user from auth.users (cascades to profiles)
// ═══════════════════════════════════════════════════════════════════
// 
// Security:
//   - Admin only
//   - Cannot delete self
//   - Auth user deletion cascades:
//     → profiles (ON DELETE CASCADE)
//     → students.user_id → SET NULL (from FK)
//     → staff.user_id → SET NULL (from FK)
// ═══════════════════════════════════════════════════════════════════

export async function DELETE(request: Request) {
  try {
    // ─── Step 1: Verify admin ───
    const supabaseAuth = await createServerClient()
    const { data: { user } } = await supabaseAuth.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { data: profile } = await supabaseAuth
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    // ─── Step 2: Parse target user id ───
    const { searchParams } = new URL(request.url)
    const targetId = searchParams.get('id')

    if (!targetId) {
      return NextResponse.json(
        { error: 'Missing user id parameter' },
        { status: 400 }
      )
    }

    // ─── Step 3: Prevent self-delete ───
    if (targetId === user.id) {
      return NextResponse.json(
        { error: 'You cannot delete your own account' },
        { status: 400 }
      )
    }

    // ─── Step 4: Service role client ───
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY not configured' },
        { status: 500 }
      )
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // ─── Step 5: Delete auth user (cascades) ───
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(
      targetId
    )

    if (deleteError) {
      console.error('[delete-user] Error:', deleteError.message)
      return NextResponse.json(
        { error: deleteError.message },
        { status: 400 }
      )
    }

    // ─── Step 6: Also clean up pending_auth_creation (if any) ───
    await adminClient
      .from('pending_auth_creation')
      .delete()
      .eq('entity_id', targetId)

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully',
      deleted_id: targetId,
    })
  } catch (err: any) {
    console.error('[delete-user] Fatal error:', err)
    return NextResponse.json(
      { error: err.message || 'Server error' },
      { status: 500 }
    )
  }
}