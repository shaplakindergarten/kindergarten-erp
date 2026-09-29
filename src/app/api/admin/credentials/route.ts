// src/app/api/admin/credentials/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    // Verify admin
    const supabaseAuth = await createServerClient()
    const { data: { user } } = await supabaseAuth.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabaseAuth
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin required' }, { status: 403 })
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Query params
    const url = new URL(request.url)
    const role = url.searchParams.get('role')
    const entityType = url.searchParams.get('entity_type')
    const search = url.searchParams.get('search')

    let query = adminClient
      .from('account_credentials')
      .select('*')
      .order('created_at', { ascending: false })

    if (role) query = query.eq('role', role)
    if (entityType) query = query.eq('entity_type', entityType)
    if (search) {
      query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`)
    }

    const { data, error } = await query

    if (error) throw error

    // Mark as downloaded
    if (data && data.length > 0) {
      await adminClient
        .from('account_credentials')
        .update({
          is_downloaded: true,
          last_downloaded_at: new Date().toISOString(),
        })
        .in('id', data.map(d => d.id))
    }

    return NextResponse.json({ success: true, credentials: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}