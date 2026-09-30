import { createClient } from '@/lib/supabase/client'

export type GlobalSearchResult = {
  id: string
  type: 'student' | 'staff' | 'fee'
  title: string
  subtitle: string
  href: string
}

export type HeaderNotification = {
  id: string
  title: string
  message: string
  is_read: boolean
  created_at?: string
  href?: string
}

export type HeaderUserSummary = {
  id: string
  name: string
  email?: string | null
  role: string
  avatarUrl?: string | null
  initials: string
}

export async function searchGlobalRecords(query: string): Promise<GlobalSearchResult[]> {
  const supabase = await createClient()
  const normalized = query.trim()

  if (!normalized) return []

  const searchLike = `%${normalized}%`

const [{ data: studentsData, error: studentsError }, { data: staffData, error: staffError }, { data: feeData, error: feeError }] = await Promise.all([
    supabase
      .from('students')
      .select('id, name, student_id, class_roll')
      .or(`name.ilike.${searchLike},student_id.ilike.${searchLike},class_roll.ilike.${searchLike}`)
      .limit(4),
     supabase
       .from('staff')
       .select('id, name, designation, phone')
       .or(`name.ilike.${searchLike},designation.ilike.${searchLike},phone.ilike.${searchLike}`)
       .limit(4),
     supabase.from('fee_payments').select('id, student_id, amount, created_at').limit(10),
   ])

  if (studentsError) console.error('Search students failed:', studentsError)
  if (staffError) console.error('Search staff failed:', staffError)
  if (feeError) console.error('Search fees failed:', feeError)

const studentResults: GlobalSearchResult[] = (studentsData || []).map((student) => ({
     id: student.id,
     type: 'student',
     title: student.name || 'Student',
     subtitle: `Admission #${student.student_id || student.class_roll || 'N/A'}`,
     href: `/students/${student.id}`,
   }))

  const staffResults: GlobalSearchResult[] = (staffData || []).map((staff) => ({
    id: staff.id,
    type: 'staff',
    title: staff.name || 'Staff',
    subtitle: staff.designation || staff.phone || 'Staff member',
    href: `/staff/${staff.id}`,
  }))

  const feeResults: GlobalSearchResult[] = (feeData || [])
    .filter((item) => {
      const amount = String(item.amount ?? '')
      const studentId = String(item.student_id ?? '')
      return amount.includes(normalized) || studentId.includes(normalized)
    })
    .slice(0, 4)
    .map((item) => ({
      id: item.id,
      type: 'fee',
      title: `Fee Record #${item.id.slice(0, 6)}`,
      subtitle: `Amount: ৳${Number(item.amount ?? 0).toLocaleString()}`,
      href: item.student_id ? `/fees/ledger?studentId=${item.student_id}` : '/fees/ledger',
    }))

  return [...studentResults, ...staffResults, ...feeResults]
}

export async function getHeaderUserSummary(): Promise<HeaderUserSummary> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      return {
        id: 'guest',
        name: 'Admin User',
        email: null,
        role: 'Administrator',
        avatarUrl: null,
        initials: 'AU',
      }
    }

    const fullName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Admin User'
    const role = user.user_metadata?.role || user.user_metadata?.user_role || 'Administrator'
    const initials = fullName
      .split(' ')
      .map((part: string) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'A'

    return {
      id: user.id,
      name: fullName,
      email: user.email,
      role,
      avatarUrl: user.user_metadata?.avatar_url || null,
      initials,
    }
  } catch {
    return {
      id: 'guest',
      name: 'Admin User',
      email: null,
      role: 'Administrator',
      avatarUrl: null,
      initials: 'AU',
    }
  }
}

export async function getHeaderNotifications(userId?: string): Promise<HeaderNotification[]> {
  try {
    const supabase = await createClient()
    let query = supabase
      .from('notifications')
      .select('id, title, message, is_read, created_at')
      .order('created_at', { ascending: false })
      .limit(6)

    const { data, error } = await query
    if (error) {
      console.error('Header notifications error:', {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
      })
      return []
    }

    return (data || []).map((item) => ({
      id: item.id,
      title: item.title,
      message: item.message || 'New notification',
      is_read: Boolean(item.is_read),
      created_at: item.created_at,
      href: '/notifications',
    }))
  } catch (err) {
    console.error('Header notifications error:', err instanceof Error ? {
      message: err.message,
      stack: err.stack,
    } : err)
    return []
  }
}

export async function markNotificationAsRead(id: string) {
  try {
    const supabase = await createClient()
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    if (error) console.error('Mark as read error:', error)
  } catch (err) {
    console.error('Mark as read error:', err)
  }
}

export async function markAllNotificationsAsRead(userId?: string) {
  try {
    const supabase = await createClient()
    const { error } = await supabase.from('notifications').update({ is_read: true })
    if (error) console.error('Mark all as read error:', error)
  } catch (err) {
    console.error('Mark all as read error:', err)
  }
}