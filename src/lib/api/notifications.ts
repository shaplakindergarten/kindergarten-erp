import { createClient } from '@/lib/supabase/server'
import type { Notification } from '@/types'
import type { NotificationChannel, NotificationMessage, NotificationResult } from './notification-service'

export async function getNotifications(filters?: { type?: string; recipientType?: string }) {
  const supabase = await createClient()
  let query = supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })

  if (filters?.type) query = query.eq('type', filters.type)
  if (filters?.recipientType) query = query.eq('recipient_type', filters.recipientType)

  const { data, error } = await query
  if (error) throw error
  return data as Notification[]
}

export async function createNotification(notification: Partial<Notification> & { id?: string }) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('notifications')
    .insert({
      type: notification.type,
      title: notification.title,
      message: notification.message,
      recipient_type: notification.recipientType,
      sent_at: new Date().toISOString(),
      status: 'pending',
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateNotificationStatus(id: string, status: 'sent' | 'pending' | 'failed', channel?: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('notifications')
    .update({ status, channel: channel || null })
    .eq('id', id)

  if (error) throw error
}

export async function deleteNotification(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', id)

  if (error) throw error
}

export async function getNotificationStats() {
  const supabase = await createClient()

  const today = new Date().toISOString().split('T')[0]
  const startOfDay = `${today}T00:00:00`
  const endOfDay = `${today}T23:59:59`

  const [
    { data: total },
    { data: sent },
    { data: pending },
    { data: failed },
    { data: todaySent }
  ] = await Promise.all([
    supabase.from('notifications').select('id', { count: 'exact' }),
    supabase.from('notifications').select('id', { count: 'exact' }).eq('status', 'sent'),
    supabase.from('notifications').select('id', { count: 'exact' }).eq('status', 'pending'),
    supabase.from('notifications').select('id', { count: 'exact' }).eq('status', 'failed'),
    supabase.from('notifications').select('id', { count: 'exact' })
      .gte('sent_at', startOfDay)
      .lte('sent_at', endOfDay)
      .eq('status', 'sent'),
    supabase.from('notifications').select('id', { count: 'exact' }).eq('channel', 'sms'),
    supabase.from('notifications').select('id', { count: 'exact' }).eq('channel', 'whatsapp'),
    supabase.from('notifications').select('id', { count: 'exact' }).eq('channel', 'email'),
  ])

  const { data: smsCount } = await supabase.from('notifications').select('id', { count: 'exact' }).eq('channel', 'sms')
  const { data: whatsappCount } = await supabase.from('notifications').select('id', { count: 'exact' }).eq('channel', 'whatsapp')
  const { data: emailCount } = await supabase.from('notifications').select('id', { count: 'exact' }).eq('channel', 'email')

  return {
    total: total?.length || 0,
    sent: sent?.length || 0,
    pending: pending?.length || 0,
    failed: failed?.length || 0,
    todaySent: todaySent?.length || 0,
    totalSms: smsCount?.length || 0,
    totalWhatsapp: whatsappCount?.length || 0,
    totalEmail: emailCount?.length || 0,
  }
}

export async function getNotices() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('notices')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as any[]
}

export async function createNotice(notice: { title: string; content: string; type: string; pinned?: boolean }) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('notices')
    .insert({
      title: notice.title,
      content: notice.content,
      type: notice.type,
      pinned: notice.pinned || false,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateNotice(id: string, notice: Partial<{ title: string; content: string; type: string; pinned: boolean }>) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('notices')
    .update(notice)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteNotice(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('notices')
    .delete()
    .eq('id', id)

  if (error) throw error
}

export async function saveNotificationHistory(params: {
  student_id?: string
  guardian_name?: string
  channel: string
  message: string
  status: string
}) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('notification_history')
    .insert({
      student_id: params.student_id || null,
      guardian_name: params.guardian_name || null,
      channel: params.channel,
      message: params.message,
      status: params.status,
      created_at: new Date().toISOString(),
    })

  if (error) throw error
}