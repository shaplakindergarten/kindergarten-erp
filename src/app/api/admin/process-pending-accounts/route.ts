// src/app/api/admin/process-pending-accounts/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════
const DEFAULT_PASSWORD = 'KinderERP@2026'
const MAX_ATTEMPTS = 3
const DEFAULT_LIMIT = 100
const MAX_LIMIT = 500

/**
 * ✅ Roles allowed by `profiles_role_check` constraint.
 * Source: complete_schema.sql
 * 
 * ⚠️ These are the ONLY roles that can be saved to profiles.role.
 * Any other role will trigger a constraint violation error.
 */
const VALID_PROFILE_ROLES = [
  'admin',
  'teacher',
  'staff',
  'accountant',
  'store',
  'student',
  'user',
] as const

type ValidProfileRole = (typeof VALID_PROFILE_ROLES)[number]

/**
 * ✅ Roles allowed to be assigned via auto-signup (queue processing).
 * 
 * ⚠️ SECURITY: 'admin' is intentionally EXCLUDED here.
 * Admin role should only be granted manually via SQL/service_role.
 * Any other role value falls back to 'staff'.
 */
const AUTO_ASSIGNABLE_ROLES: ValidProfileRole[] = [
  'teacher',
  'staff',
  'accountant',
  'store',
  'student',
  'user',
]

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════
interface PendingItem {
  id: string
  entity_type: 'staff' | 'student'
  entity_id: string
  email: string
  full_name: string
  role: string
  attempts: number
  status: string
  created_at: string
}

interface ProcessedCredential {
  type: string
  name: string
  email: string
  password: string
}

interface ProcessedError {
  type: string
  name: string
  email: string
  error: string
}

interface ProcessResults {
  processed: number
  created: number
  skipped: number
  failed: number
  credentials: ProcessedCredential[]
  errors: ProcessedError[]
}

// ═══════════════════════════════════════════════════════════════════
// HELPER: Validate and normalize role from queue
// ═══════════════════════════════════════════════════════════════════
function normalizeRoleForProfiles(
  requestedRole: string,
  email: string
): ValidProfileRole {
  const normalized = (requestedRole || '').toLowerCase().trim()

  // Check if it's one of the profile-allowed roles
  if ((VALID_PROFILE_ROLES as readonly string[]).includes(normalized)) {
    // Check if it's auto-assignable
    if (AUTO_ASSIGNABLE_ROLES.includes(normalized as ValidProfileRole)) {
      return normalized as ValidProfileRole
    }

    // ⚠️ Role is valid in DB but not auto-assignable (e.g., 'admin')
    console.warn(
      `[process-pending] Role "${normalized}" for ${email} is not auto-assignable. ` +
      `Falling back to "staff".`
    )
    return 'staff'
  }

  // ⚠️ Role is completely invalid — warn and fallback
  console.warn(
    `[process-pending] Invalid role "${normalized}" for ${email} ` +
    `(not in schema constraint). Falling back to "staff".`
  )
  return 'staff'
}

// ═══════════════════════════════════════════════════════════════════
// HELPER: Fetch all users once (paginated) — cached across items
// ═══════════════════════════════════════════════════════════════════
async function fetchAllUsers(adminClient: any): Promise<Map<string, string>> {
  const userMap = new Map<string, string>() // email (lowercase) → user id
  let page = 1
  const perPage = 1000

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage,
    })

    if (error) {
      console.warn('[fetchAllUsers] Error:', error.message)
      break
    }

    if (!data?.users || data.users.length === 0) break

    for (const u of data.users) {
      if (u.email) {
        userMap.set(u.email.toLowerCase(), u.id)
      }
    }

    if (data.users.length < perPage) break
    page++
  }

  return userMap
}

// ═══════════════════════════════════════════════════════════════════
// POST: Process pending accounts
// ═══════════════════════════════════════════════════════════════════
export async function POST(request: Request) {
  try {
    // ═══════════════════════════════════════════════════════════════
    // STEP 1: Verify admin
    // ═══════════════════════════════════════════════════════════════
    const supabaseAuth = await createServerClient()
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile, error: profileCheckError } = await supabaseAuth
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileCheckError || !profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 403 }
      )
    }

    if (profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 2: Parse options
    // ═══════════════════════════════════════════════════════════════
    const body = await request.json().catch(() => ({}))
    const limit = Math.min(body.limit || DEFAULT_LIMIT, MAX_LIMIT)
    const customPassword = body.password || DEFAULT_PASSWORD

    // ═══════════════════════════════════════════════════════════════
    // STEP 3: Service role client
    // ═══════════════════════════════════════════════════════════════
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY not configured' },
        { status: 500 }
      )
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // ═══════════════════════════════════════════════════════════════
    // STEP 4: Fetch pending items
    // ═══════════════════════════════════════════════════════════════
    const { data: pending, error: fetchError } = await adminClient
      .from('pending_auth_creation')
      .select('*')
      .eq('status', 'pending')
      .lt('attempts', MAX_ATTEMPTS)
      .order('created_at', { ascending: true })
      .limit(limit)

    if (fetchError) {
      console.error('[process-pending] Fetch error:', fetchError)
      return NextResponse.json(
        { error: `Failed to fetch queue: ${fetchError.message}` },
        { status: 500 }
      )
    }

    if (!pending || pending.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        created: 0,
        skipped: 0,
        failed: 0,
        credentials: [],
        errors: [],
        message: 'No pending accounts to process',
      })
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 5: Fetch ALL existing users ONCE (optimization)
    // ═══════════════════════════════════════════════════════════════
    console.log(
      `[process-pending] Fetching existing users before processing ${pending.length} items...`
    )
    const existingUserMap = await fetchAllUsers(adminClient)
    console.log(
      `[process-pending] Found ${existingUserMap.size} existing users`
    )

    // ═══════════════════════════════════════════════════════════════
    // STEP 6: Process each pending item
    // ═══════════════════════════════════════════════════════════════
    const results: ProcessResults = {
      processed: 0,
      created: 0,
      skipped: 0,
      failed: 0,
      credentials: [],
      errors: [],
    }

    for (const item of pending as PendingItem[]) {
      results.processed++

      try {
        // ─── Mark as processing ───
        await adminClient
          .from('pending_auth_creation')
          .update({ status: 'processing' })
          .eq('id', item.id)

        const emailLower = item.email.toLowerCase()
        const existingUserId = existingUserMap.get(emailLower)

        // ─── Validate & normalize role ───
        const safeRole = normalizeRoleForProfiles(item.role, item.email)

        // ⚠️ If role was changed, log for admin visibility
        if (safeRole !== item.role.toLowerCase().trim()) {
          console.log(
            `[process-pending] Role normalized: "${item.role}" → "${safeRole}" for ${item.email}`
          )
        }

        let userId: string
        let wasExisting = false

        if (existingUserId) {
          // ─── Reuse existing auth user ───
          userId = existingUserId
          wasExisting = true
          console.log(`[process-pending] User exists, reusing: ${item.email}`)
        } else {
          // ─── Create new auth user ───
          const { data: authData, error: authError } =
            await adminClient.auth.admin.createUser({
              email: item.email,
              password: customPassword,
              email_confirm: true,
              user_metadata: {
                full_name: item.full_name,
                role: safeRole, // ✅ Use safe role
                entity_type: item.entity_type,
              },
            })

          if (authError) {
            throw new Error(`Auth create failed: ${authError.message}`)
          }
          if (!authData.user) {
            throw new Error('Auth create returned no user')
          }
          userId = authData.user.id

          // Add to cache for subsequent iterations
          existingUserMap.set(emailLower, userId)
        }

        // ═══════════════════════════════════════════════════════════
        // Link entity → user_id
        // ═══════════════════════════════════════════════════════════
        if (item.entity_type === 'staff') {
          const { error: linkError } = await adminClient
            .from('staff')
            .update({ user_id: userId })
            .eq('id', item.entity_id)

          if (linkError) {
            console.warn(
              '[process-pending] Staff link failed:',
              linkError.message
            )
            // Non-fatal: continue
          }
        } else if (item.entity_type === 'student') {
          const { error: linkError } = await adminClient
            .from('students')
            .update({ user_id: userId })
            .eq('id', item.entity_id)

          if (linkError) {
            console.warn(
              '[process-pending] Student link failed:',
              linkError.message
            )
            // Non-fatal: continue
          }
        }

        // ═══════════════════════════════════════════════════════════
        // Upsert profile — CRITICAL: throw on failure
        // ═══════════════════════════════════════════════════════════
        const { error: profileError } = await adminClient
          .from('profiles')
          .upsert(
            {
              id: userId,
              email: item.email,
              full_name: item.full_name,
              role: safeRole, // ✅ Safe role — valid for constraint
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'id' }
          )

        if (profileError) {
          // ✅ CRITICAL FIX: throw instead of silently warning
          console.error(
            '[process-pending] Profile upsert failed:',
            profileError.message
          )
          throw new Error(
            `Profile upsert failed: ${profileError.message}`
          )
        }

        // ═══════════════════════════════════════════════════════════
        // Save credentials to account_credentials table
        // ═══════════════════════════════════════════════════════════
        const { error: credError } = await adminClient
          .from('account_credentials')
          .upsert(
            {
              user_id: userId,
              email: item.email,
              password: customPassword,
              full_name: item.full_name,
              role: safeRole, // ✅ Use safe role
              entity_type: item.entity_type,
              entity_id: item.entity_id,
            },
            { onConflict: 'email' }
          )

        if (credError) {
          console.error(
            '[process-pending] Credential save failed:',
            credError.message
          )
          // ✅ CRITICAL: throw so the whole item fails — no orphan profile
          throw new Error(
            `Credential save failed: ${credError.message}`
          )
        }

        // ─── Mark completed ───
        await adminClient
          .from('pending_auth_creation')
          .update({
            status: 'completed',
            processed_at: new Date().toISOString(),
            last_error: null, // clear any previous error
          })
          .eq('id', item.id)

        if (wasExisting) {
          results.skipped++
        } else {
          results.created++
          results.credentials.push({
            type: item.entity_type,
            name: item.full_name,
            email: item.email,
            password: customPassword,
          })
        }
      } catch (err: any) {
        results.failed++
        console.error('[process-pending] Item failed:', {
          entity: item.entity_type,
          email: item.email,
          error: err.message,
        })

        // ─── Mark failed + increment attempts ───
        await adminClient
          .from('pending_auth_creation')
          .update({
            status: 'failed',
            attempts: (item.attempts || 0) + 1,
            last_error: err.message,
          })
          .eq('id', item.id)

        results.errors.push({
          type: item.entity_type,
          name: item.full_name,
          email: item.email,
          error: err.message,
        })
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
      summary: `Processed ${results.processed}, Created ${results.created}, Skipped ${results.skipped}, Failed ${results.failed}`,
    })
  } catch (err: any) {
    console.error('[process-pending] Fatal error:', err)
    return NextResponse.json(
      { error: err.message || 'Server error' },
      { status: 500 }
    )
  }
}