"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Send, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ResponsiveLayout } from "@/components/layout/responsive-layout"
import { useToastStore } from "@/store/useStore"

export default function SendNotificationPage() {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    type: 'general',
    title: '',
    message: '',
    recipientType: 'all',
  })
  const addToast = useToastStore((state) => state.addToast)

  const handleSubmit = async () => {
    if (!formData.title || !formData.message) return

    setLoading(true)
    try {
      const response = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to send')
      }

      addToast({ type: 'success', title: 'Sent', message: 'Notification sent successfully.' })
      setFormData({ type: 'general', title: '', message: '', recipientType: 'all' })
    } catch (err) {
      console.error("Failed to send notification:", err)
      addToast({ type: 'error', title: 'Failed', message: err instanceof Error ? err.message : 'Failed to send notification.' })
    } finally {
      setLoading(false)
    }
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
            <h1 className="text-2xl font-bold font-heading">Send Notification</h1>
            <p className="text-text-muted">Send notifications to students, staff, or all</p>
          </div>
        </div>

        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              New Notification
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Recipient</Label>
              <Select value={formData.recipientType} onValueChange={(v) => setFormData({ ...formData, recipientType: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="student">Students</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="due">Fee Due</SelectItem>
                  <SelectItem value="attendance">Attendance</SelectItem>
                  <SelectItem value="result">Result</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                placeholder="Notification title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <textarea
                className="w-full min-h-[120px] px-3 py-2 rounded-md border border-input bg-background text-sm"
                placeholder="Enter notification message..."
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              />
            </div>
            <Button onClick={handleSubmit} disabled={loading || !formData.title || !formData.message} className="w-full">
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send Notification
            </Button>
          </CardContent>
        </Card>
      </div>
    </ResponsiveLayout>
  )
}

