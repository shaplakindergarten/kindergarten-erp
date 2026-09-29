"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Plus, Edit, Trash2, Loader2, Pin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ResponsiveLayout } from "@/components/layout/responsive-layout"
import { useToastStore } from "@/store/useStore"
import { formatDate } from "@/lib/utils"

interface Notice {
  id: string
  title: string
  content: string
  type: string
  pinned: boolean
  created_at: string
}

export default function NoticeBoardPage() {
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    type: 'general',
    pinned: false,
  })
  const addToast = useToastStore((state) => state.addToast)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const res = await fetch('/api/notifications/notice')
      if (!res.ok) {
        setNotices([])
        return
      }
      const text = await res.text()
      try {
        const data = JSON.parse(text)
        setNotices(Array.isArray(data) ? data : [])
      } catch {
        setNotices([])
      }
    } catch (err) {
      console.error("Failed to load notices:", err)
      setNotices([])
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = (notice?: Notice) => {
    if (notice) {
      setEditingNotice(notice)
      setFormData({
        title: notice.title,
        content: notice.content,
        type: notice.type,
        pinned: notice.pinned,
      })
    } else {
      setEditingNotice(null)
      setFormData({ title: '', content: '', type: 'general', pinned: false })
    }
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    try {
      const response = await fetch('/api/notifications/notice', {
        method: editingNotice ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          id: editingNotice?.id,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save')
      }

      addToast({ type: 'success', title: editingNotice ? 'Updated' : 'Created', message: editingNotice ? 'Notice updated successfully.' : 'Notice published successfully.' })
      setModalOpen(false)
      loadData()
    } catch (err) {
      console.error("Failed to save notice:", err)
      addToast({ type: 'error', title: 'Failed', message: 'Failed to save notice.' })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this notice?")) return
    try {
      const response = await fetch(`/api/notifications/notice/${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to delete')
      addToast({ type: 'success', title: 'Deleted', message: 'Notice deleted.' })
      loadData()
    } catch (err) {
      console.error("Failed to delete notice:", err)
      addToast({ type: 'error', title: 'Failed', message: 'Failed to delete notice.' })
    }
  }

  const sampleNotices: Notice[] = [
    { id: "1", title: "Summer Vacation", content: "School will remain closed from June 1-30 for summer vacation.", type: "holiday", pinned: true, created_at: "2024-05-15" },
    { id: "2", title: "Parent-Teacher Meeting", content: "PTM scheduled for June 10, 2024. All parents are requested to attend.", type: "event", pinned: false, created_at: "2024-05-20" },
    { id: "3", title: "Fee Payment Reminder", content: "Last date for fee payment is June 30. Late fee will be charged after deadline.", type: "general", pinned: false, created_at: "2024-05-25" },
  ]

  const displayNotices = notices.length > 0 ? notices : sampleNotices
  const sortedNotices = [...displayNotices].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1
    if (!a.pinned && b.pinned) return 1
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const typeColors: Record<string, string> = {
    general: 'bg-blue-100 text-blue-700',
    holiday: 'bg-purple-100 text-purple-700',
    event: 'bg-green-100 text-green-700',
    urgent: 'bg-red-100 text-red-700',
  }

  return (
    <ResponsiveLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/notifications">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold font-heading">Notice Board</h1>
              <p className="text-text-muted">Manage school notices</p>
            </div>
          </div>
          <Button onClick={() => handleOpenModal()}>
            <Plus className="h-4 w-4 mr-2" />
            Add Notice
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            {sortedNotices.map((notice) => (
              <Card key={notice.id} className={`hover:shadow-lg transition-shadow ${notice.pinned ? 'border-primary' : ''}`}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {notice.pinned && <Pin className="h-4 w-4 text-primary" />}
                        <span className={`px-2 py-1 rounded text-xs font-medium ${typeColors[notice.type] || typeColors.general}`}>
                          {notice.type}
                        </span>
                      </div>
                      <h3 className="font-semibold text-lg mb-2">{notice.title}</h3>
                      <p className="text-text-muted">{notice.content}</p>
                      <p className="text-sm text-text-muted mt-4">{formatDate(notice.created_at)}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => handleOpenModal(notice)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(notice.id)}>
                        <Trash2 className="h-4 w-4 text-error" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingNotice ? "Edit" : "Add"} Notice</DialogTitle>
            <DialogDescription>Create a new notice for the board.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                placeholder="Notice title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Content</Label>
              <textarea
                className="w-full min-h-[100px] px-3 py-2 rounded-md border border-input bg-background text-sm"
                placeholder="Notice content..."
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="holiday">Holiday</SelectItem>
                  <SelectItem value="event">Event</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="pinned"
                checked={formData.pinned}
                onChange={(e) => setFormData({ ...formData, pinned: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="pinned">Pin this notice</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!formData.title || !formData.content}>
              {editingNotice ? "Update" : "Publish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ResponsiveLayout>
  )
}
