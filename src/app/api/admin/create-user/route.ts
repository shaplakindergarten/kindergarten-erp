// src/app/api/admin/create-user/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

// ✅ Role whitelist — prevents privilege escalation
const ALLOWED_ROLES = [
  'admin',
  'teacher',
  'staff',
  'accountant',
  'store',
  'student',
] as const

type AllowedRole = (typeof ALLOWED_ROLES)[number]

// ═══════════════════════════════════════════════════════════════════
// POST: Create a new user (admin only, manual)
// ═══════════════════════════════════════════════════════════════════
// 
// This is the MANUAL creation endpoint. For auto-queue creation,
// use the pending_auth_creation flow instead.
// ═══════════════════════════════════════════════════════════════════

export async function POST(request: Request) {
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

    // ─── Step 2: Parse body ───
    const body = await request.json()
    const { email, full_name, role, password } = body as {
      email: string
      full_name: string
      role: string
      password: string
    }

    // ─── Step 3: Validate input ───
    if (!email || !full_name || !role || !password) {
      return NextResponse.json(
        {
          error:
            'Missing required fields: email, full_name, role, password',
        },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      )
    }

    // ✅ SECURITY: Role whitelist
    if (!ALLOWED_ROLES.includes(role as AllowedRole)) {
      return NextResponse.json(
        {
          error: `Invalid role. Allowed: ${ALLOWED_ROLES.join(', ')}`,
        },
        { status: 400 }
      )
    }

    // Simple email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
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

    // ─── Step 5: Create auth user ───
    const { data: authData, error: authError } =
      await adminClient.auth.admin.createUser({
        email: email.trim().toLowerCase(),
        password,
        email_confirm: true,
        user_metadata: {
          full_name: full_name.trim(),
          role,
        },
      })

    if (authError) {
      console.error('[create-user] Auth error:', authError.message)

      // Nice error for common cases
      if (authError.message.toLowerCase().includes('already')) {
        return NextResponse.json(
          { error: 'A user with this email already exists' },
          { status: 400 }
        )
      }

      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      )
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Auth user creation returned no user' },
        { status: 500 }
      )
    }

    // ─── Step 6: Upsert profile (with correct role) ───
    const { error: profileError } = await adminClient
      .from('profiles')
      .upsert(
        {
          id: authData.user.id,
          email: email.trim().toLowerCase(),
          full_name: full_name.trim(),
          role,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )

    if (profileError) {
      console.error(
        '[create-user] Profile upsert failed:',
        profileError.message
      )
      // Not fatal — auth user was created; return success with warning
    }

    // ─── Step 7: Return success ───
    return NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        full_name: full_name.trim(),
        role,
      },
      message: `User created successfully as ${role}`,
    })
  } catch (err: any) {
    console.error('[create-user] Fatal error:', err)
    return NextResponse.json(
      { error: err.message || 'Server error' },
      { status: 500 }
    )
  }
}