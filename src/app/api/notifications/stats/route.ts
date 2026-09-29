// src/app/api/notifications/stats/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // Get today's date
    const today = new Date().toISOString().split('T')[0]
    const startOfDay = `${today}T00:00:00`
    const endOfDay = `${today}T23:59:59`

    // Get all notifications
    const { data: allNotifications, error: allError } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })

    if (allError) throw allError

    // Calculate stats
    const all = allNotifications || []
    const totalSms = all.filter(n => n.channel === 'sms' || n.type === 'sms').length
    const totalWhatsapp = all.filter(n => n.channel === 'whatsapp' || n.type === 'whatsapp').length
    const totalEmail = all.filter(n => n.channel === 'email' || n.type === 'email').length
    const pending = all.filter(n => n.status === 'pending').length
    const failed = all.filter(n => n.status === 'failed').length

    // Today's sent
    const todaySent = all.filter(n => {
      const sentDate = n.sent_at || n.created_at
      return sentDate && sentDate.startsWith(today)
    }).length

    return NextResponse.json({
      total: all.length,
      totalSms,
      totalWhatsapp,
      totalEmail,
      pending,
      failed,
      todaySent,
    })
  } catch (err) {
    console.error('API error:', err)
    return NextResponse.json(
      { 
        total: 0,
        totalSms: 0,
        totalWhatsapp: 0,
        totalEmail: 0,
        pending: 0,
        failed: 0,
        todaySent: 0,
      },
      { status: 500 }
    )
  }
}