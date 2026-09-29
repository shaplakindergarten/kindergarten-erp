"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Loader2, Trash2, Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ResponsiveLayout } from "@/components/layout/responsive-layout"
import { useToastStore } from "@/store/useStore"
import { formatDate } from "@/lib/utils"

interface Notification {
  id: string
  type: string
  title: string
  message: string
  recipient_type: string
  sent_at?: string
  created_at?: string
}

export default function NotificationHistoryPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const addToast = useToastStore((state) => state.addToast)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const res = await fetch('/api/notifications')
      const data = await res.json()
      setNotifications(data || [])
    } catch (err) {
      console.error("Failed to load notifications:", err)
    } finally {
      setLoading(false)
    }
  }

  const sampleNotifications: Notification[] = [
    { id: "1", type: "general", title: "Fee Reminder", message: "Please pay the monthly fee before the deadline.", recipient_type: "all", sent_at: "2024-05-20", created_at: "2024-05-20" },
    { id: "2", type: "attendance", title: "Attendance Report", message: "Monthly attendance report is now available.", recipient_type: "parent", sent_at: "2024-05-15", created_at: "2024-05-15" },
    { id: "3", type: "result", title: "Results Published", message: "Term exam results have been published.", recipient_type: "student", sent_at: "2024-05-10", created_at: "2024-05-10" },
  ]

  const displayNotifications = notifications.length > 0 ? notifications : sampleNotifications
  const typeColors: Record<string, string> = {
    general: 'bg-blue-100 text-blue-700',
    due: 'bg-orange-100 text-orange-700',
    attendance: 'bg-green-100 text-green-700',
    result: 'bg-purple-100 text-purple-700',
  }

  return (
    <ResponsiveLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/notifications">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold font-heading">Notification History</h1>
            <p className="text-text-muted">View sent notifications</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : displayNotifications.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Bell className="h-12 w-12 mx-auto text-text-muted mb-4" />
              <p className="text-text-muted">No notifications sent yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {displayNotifications.map((notification) => (
              <Card key={notification.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${typeColors[notification.type] || typeColors.general}`}>
                          {notification.type}
                        </span>
                        <Badge variant="outline">{notification.recipient_type}</Badge>
                      </div>
                      <h3 className="font-semibold text-lg mb-1">{notification.title}</h3>
                      <p className="text-text-muted mb-2">{notification.message}</p>
                      <p className="text-sm text-text-muted">Sent: {formatDate(notification.sent_at || notification.created_at)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ResponsiveLayout>
  )
}
