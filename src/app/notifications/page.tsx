"use client"

import { useState, useEffect } from "react"
import { 
  Bell,
  Send,
  Megaphone,
  History,
  Users,
  GraduationCap,
  AlertCircle,
  CheckCircle,
  Clock,
  MessageSquare,
  Smartphone,
  Mail,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ResponsiveLayout } from "@/components/layout/responsive-layout"
import { useToastStore } from "@/store/useStore"

interface Notification {
  id: string
  title: string
  message: string
  type: "due" | "attendance" | "result" | "general"
  recipient_type: "student" | "staff" | "all"
  sent_at?: string
  created_at?: string
  status?: string
}

export default function NotificationsPage() {
  const [stats, setStats] = useState({
    totalSms: 0,
    totalWhatsapp: 0,
    totalEmail: 0,
    pending: 0,
    todaySent: 0,
    failed: 0,
  })
  const [recentActivity, setRecentActivity] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const addToast = useToastStore((state) => state.addToast)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [statsRes, notificationsRes] = await Promise.all([
        fetch('/api/notifications/stats').then(r => r.json()),
        fetch('/api/notifications').then(r => r.json()),
      ])
      setStats(statsRes)
      setRecentActivity((notificationsRes || []).slice(0, 5))
    } catch (err) {
      console.error("Failed to load data:", err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <ResponsiveLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold font-heading">Notifications</h1>
            <p className="text-text-muted">Send notifications and manage notice board.</p>
          </div>
          <Button asChild>
            <a href="/notifications/send">
              <Send className="h-4 w-4 mr-2" />
              Send Notification
            </a>
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total SMS</CardTitle>
              <MessageSquare className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalSms}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total WhatsApp</CardTitle>
              <Smartphone className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalWhatsapp}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Email</CardTitle>
              <Mail className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalEmail}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending Queue</CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pending}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Today's Sent</CardTitle>
              <Send className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.todaySent}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Failed</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.failed}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest notifications sent to students and staff</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {loading ? (
                <p className="text-center py-8 text-text-muted">Loading...</p>
              ) : recentActivity.length === 0 ? (
                <p className="text-center py-8 text-text-muted">No notifications sent yet.</p>
              ) : (
                recentActivity.map((notification) => (
                  <div
                    key={notification.id}
                    className="flex items-start gap-4 p-4 rounded-lg border hover:bg-gray-50 transition-colors"
                  >
                    <div className={`p-2 rounded-lg ${
                      notification.type === "due" ? "bg-error/10" :
                      notification.type === "attendance" ? "bg-warning/10" :
                      notification.type === "result" ? "bg-success/10" :
                      "bg-primary/10"
                    }`}>
                      {notification.type === "due" && <AlertCircle className="h-5 w-5 text-error" />}
                      {notification.type === "attendance" && <Clock className="h-5 w-5 text-warning" />}
                      {notification.type === "result" && <CheckCircle className="h-5 w-5 text-success" />}
                      {notification.type === "general" && <Bell className="h-5 w-5 text-primary" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{notification.title}</h4>
                        <Badge variant="outline" className="text-xs">
                          {notification.type}
                        </Badge>
                      </div>
                      <p className="text-sm text-text-muted mt-1">{notification.message}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-text-muted">
                        <span className="flex items-center gap-1">
                          {notification.recipient_type === "student" ? <Users className="h-3 w-3" /> : 
                           notification.recipient_type === "staff" ? <GraduationCap className="h-3 w-3" /> :
                           <Users className="h-3 w-3" />}
                          {notification.recipient_type === "all" ? "All" : notification.recipient_type.charAt(0).toUpperCase() + notification.recipient_type.slice(1)}
                        </span>
                        <span>{notification.sent_at || notification.created_at}</span>
                        <Badge variant={notification.status === "sent" ? "success" : notification.status === "pending" ? "warning" : "error"} className="text-xs">
                          {notification.status || 'sent'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </ResponsiveLayout>
  )
}
