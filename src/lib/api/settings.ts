// src/lib/api/settings.ts
import { createClient } from '@/lib/supabase/client'
import type { SchoolSettings, AcademicYear, Role, User } from '@/types'

// ═══════════════════════════════════════════════════════════════════
// Default school settings (fallback)
// ═══════════════════════════════════════════════════════════════════
const DEFAULT_SCHOOL_SETTINGS = {
  id: 1,
  school_name: 'Shapla Kindergarten & Pre-cadet',
  school_address: 'Nowtala, Madhaiya Bazar, Chandina, Cumilla',
  school_phone: '01923253454',
  school_email: 'shapla.kindergarten@gmail.com',
  school_logo: null as string | null,
  school_watermark: null as string | null,
}

// ═══════════════════════════════════════════════════════════════════
// SCHOOL SETTINGS
// ═══════════════════════════════════════════════════════════════════

export async function getSchoolSettings() {
  const supabase = createClient()

  try {
    const { data, error } = await supabase
      .from('school_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle()

    if (error) {
      console.warn('Error fetching school settings:', error.message)
      return DEFAULT_SCHOOL_SETTINGS
    }

    return data || DEFAULT_SCHOOL_SETTINGS
  } catch (err) {
    console.error('Unexpected error in getSchoolSettings:', err)
    return DEFAULT_SCHOOL_SETTINGS
  }
}

export async function updateSchoolSettings(settings: Partial<SchoolSettings>) {
  const supabase = createClient()

  try {
    const { data, error } = await supabase
      .from('school_settings')
      .upsert({
        id: 1,
        school_name:
          settings.school_name || DEFAULT_SCHOOL_SETTINGS.school_name,
        school_address:
          settings.school_address || DEFAULT_SCHOOL_SETTINGS.school_address,
        school_phone:
          settings.school_phone || DEFAULT_SCHOOL_SETTINGS.school_phone,
        school_email:
          settings.school_email || DEFAULT_SCHOOL_SETTINGS.school_email,
        school_logo: settings.school_logo ?? null,
        school_watermark: settings.school_watermark ?? null,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving school settings:', error.message)
      throw error
    }

    return data || DEFAULT_SCHOOL_SETTINGS
  } catch (error) {
    console.error('Error in updateSchoolSettings:', error)
    throw error
  }
}

export async function uploadLogo(file: File) {
  const supabase = createClient()

  try {
    if (file.size > 2 * 1024 * 1024) {
      throw new Error('File size must be less than 2MB')
    }

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg']
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Only PNG, JPG, JPEG files are allowed')
    }

    const fileExt = file.name.split('.').pop()
    const fileName = `logo-${Date.now()}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('school-assets')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true,
      })

    if (uploadError) throw uploadError

    const { data: urlData } = supabase.storage
      .from('school-assets')
      .getPublicUrl(fileName)

    return urlData.publicUrl
  } catch (error) {
    console.error('Error in uploadLogo:', error)
    throw error
  }
}

// ═══════════════════════════════════════════════════════════════════
// ACADEMIC YEARS
// ═══════════════════════════════════════════════════════════════════

export async function getAcademicYears() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('academic_years')
    .select('*')
    .order('year_name', { ascending: false })
  if (error) throw error
  return data || []
}

export async function createAcademicYear(year: Partial<AcademicYear>) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('academic_years')
    .insert({
      year_name: year.year_name,
      name: year.year_name,
      start_date: year.start_date,
      end_date: year.end_date,
      is_current: year.is_current || false,
      is_active: true,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateAcademicYear(
  id: string,
  year: Partial<AcademicYear>
) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('academic_years')
    .update({
      year_name: year.year_name,
      start_date: year.start_date,
      end_date: year.end_date,
      is_current: year.is_current,
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteAcademicYear(id: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from('academic_years')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ═══════════════════════════════════════════════════════════════════
// ROLES
// ═══════════════════════════════════════════════════════════════════

export async function getRoles() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('roles')
    .select('*')
    .order('name')
  if (error) throw error
  return data || []
}

export async function createRole(role: Partial<Role>) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('roles')
    .insert({
      name: role.name,
      permissions: role.permissions || [],
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateRole(id: string, role: Partial<Role>) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('roles')
    .update({
      name: role.name,
      permissions: role.permissions,
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteRole(id: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from('roles')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ═══════════════════════════════════════════════════════════════════
// USERS (via Server API Routes — service role required)
// ═══════════════════════════════════════════════════════════════════

/**
 * ✅ Reads profiles table (RLS allows admin read)
 * Returns users with role info
 */
export async function getUsers() {
  const supabase = createClient()

  try {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, created_at')
      .order('full_name', { ascending: true })

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError)
      return []
    }

    return (
      profiles?.map((profile: any) => ({
        id: profile.id,
        email: profile.email || '',
        name: profile.full_name || profile.email || 'Unknown User',
        role_id: profile.role || null,
        status: 'active',
        created_at: profile.created_at,
        role: profile.role
          ? { id: profile.role, name: profile.role }
          : null,
      })) || []
    )
  } catch (error) {
    console.error('Error in getUsers:', error)
    return []
  }
}

/**
 * ✅ Creates a new user via server API (service role)
 * Was: supabase.auth.admin.createUser() — won't work on client
 */
export async function createUser(user: {
  email: string
  name: string
  role_id: string
  password: string
}) {
  try {
    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: user.email,
        full_name: user.name,
        role: user.role_id,
        password: user.password,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || 'Failed to create user')
    }

    return data.user
  } catch (error) {
    console.error('Error in createUser:', error)
    throw error
  }
}

/**
 * ✅ Updates profiles directly (RLS allows admin)
 */
export async function updateUser(
  id: string,
  user: Partial<{ name: string; role_id: string; status: string }>
) {
  const supabase = createClient()

  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: user.name,
        role: user.role_id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) throw error
  } catch (error) {
    console.error('Error updating user:', error)
    throw error
  }
}

/**
 * ✅ Deletes user via server API (service role)
 * Was: supabase.auth.admin.deleteUser() — won't work on client
 */
export async function deleteUser(id: string) {
  try {
    const res = await fetch(
      `/api/admin/delete-user?id=${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      }
    )

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || 'Failed to delete user')
    }

    return data
  } catch (error) {
    console.error('Error deleting user:', error)
    throw error
  }
}

/**
 * ✅ Processes pending_auth_creation queue via server API
 * For auto-created Staff/Student accounts
 */
export async function processPendingAccounts(options?: {
  limit?: number
  password?: string
}) {
  try {
    const res = await fetch('/api/admin/process-pending-accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        limit: options?.limit || 100,
        password: options?.password,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || 'Failed to process pending accounts')
    }

    return data
  } catch (error) {
    console.error('Error in processPendingAccounts:', error)
    throw error
  }
}