import { createClient } from '@/lib/supabase/server'

export type NotificationChannel = 'sms' | 'whatsapp' | 'email'

export interface NotificationMessage {
  student_id?: string
  guardian_name?: string
  guardian_mobile?: string
  guardian_email?: string
  title: string
  message: string
  channel: NotificationChannel
  type: 'due' | 'attendance' | 'result' | 'general'
}

export interface NotificationResult {
  success: boolean
  message_id?: string
  error?: string
  channel: NotificationChannel
}

export interface ChannelProvider {
  send(msg: NotificationMessage): Promise<NotificationResult>
  isConfigured(): boolean
}

class SmsProvider implements ChannelProvider {
  isConfigured(): boolean {
    return false
  }

  async send(msg: NotificationMessage): Promise<NotificationResult> {
    await this.saveHistory(msg, 'pending')
    return { success: false, channel: msg.channel, error: 'SMS gateway not configured' }
  }
}

class WhatsAppProvider implements ChannelProvider {
  isConfigured(): boolean {
    return true
  }

  async send(msg: NotificationMessage): Promise<NotificationResult> {
    const encodedMsg = encodeURIComponent(msg.message)
    const encodedPhone = msg.guardian_mobile?.replace(/\D/g, '') || ''
    const waLink = `https://wa.me/${encodedPhone}?text=${encodedMsg}`

    await this.saveHistory(msg, 'sent')

    return { success: true, channel: msg.channel, message_id: waLink }
  }
}

class EmailProvider implements ChannelProvider {
  isConfigured(): boolean {
    return false
  }

  async send(msg: NotificationMessage): Promise<NotificationResult> {
    await this.saveHistory(msg, 'pending')
    return { success: false, channel: msg.channel, error: 'Email SMTP not configured' }
  }
}

const providers: Record<NotificationChannel, ChannelProvider> = {
  sms: new SmsProvider(),
  whatsapp: new WhatsAppProvider(),
  email: new EmailProvider(),
}

async function saveHistory(msg: NotificationMessage, status: string): Promise<void> {
  const supabase = await createClient()
  await supabase
    .from('notification_history')
    .insert({
      student_id: msg.student_id || null,
      guardian_name: msg.guardian_name || null,
      channel: msg.channel,
      message: msg.message,
      status,
      created_at: new Date().toISOString(),
    })
}

export async function sendNotification(msg: NotificationMessage): Promise<NotificationResult> {
  const provider = providers[msg.channel]
  if (!provider) {
    return { success: false, channel: msg.channel, error: 'Invalid channel' }
  }
  return provider.send(msg)
}

export async function sendReminder(params: {
  student_id?: string
  student_name?: string
  guardian_name?: string
  guardian_mobile?: string
  guardian_email?: string
  reminder_type: 'due' | 'attendance' | 'result' | 'notice' | 'general'
  message?: string
  due_amount?: number
  attendance_date?: string
  exam_name?: string
}): Promise<NotificationResult[]> {
  const results: NotificationResult[] = []
  const channels: NotificationChannel[] = ['whatsapp', 'sms', 'email']

  for (const channel of channels) {
    const msg = buildReminderMessage(params)
    const result = await sendNotification(msg)
    results.push(result)
  }

  return results
}

function buildReminderMessage(params: {
  student_id?: string
  student_name?: string
  guardian_name?: string
  guardian_mobile?: string
  guardian_email?: string
  reminder_type: 'due' | 'attendance' | 'result' | 'notice' | 'general'
  message?: string
  due_amount?: number
  attendance_date?: string
  exam_name?: string
}): NotificationMessage {
  const studentName = params.student_name || 'Student'

  let title = ''
  let message = ''

  switch (params.reminder_type) {
    case 'due':
      title = 'Fee Due Reminder'
      message = `${studentName} has a pending fee of Tk ${params.due_amount || 0}. Please pay before the deadline.`
      break
    case 'attendance':
      title = 'Attendance Alert'
      message = `${studentName} was marked absent on ${params.attendance_date || new Date().toLocaleDateString()}.`
      break
    case 'result':
      title = 'Exam Result'
      message = `${studentName}'s result for ${params.exam_name || 'exam'} has been published.`
      break
    case 'notice':
      title = 'Notice'
      message = params.message || `Important notice for ${studentName}.`
      break
    default:
      title = 'School Notice'
      message = params.message || `Dear ${params.guardian_name || 'Guardian'}, ${params.student_name ? `${studentName} - ` : ''}Please check school updates.`
  }

  return {
    student_id: params.student_id,
    guardian_name: params.guardian_name,
    guardian_mobile: params.guardian_mobile,
    guardian_email: params.guardian_email,
    title,
    message,
    channel: 'whatsapp',
    type: params.reminder_type === 'notice' || params.reminder_type === 'general' ? 'general' : params.reminder_type,
  }
}