"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Fingerprint,
  Smartphone,
  Wifi,
  Zap,
  Plus,
  Edit,
  Trash2,
  Power,
  PowerOff,
  RefreshCw,
  Settings,
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Download,
  Printer,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ResponsiveLayout } from "@/components/layout/responsive-layout"
import { toast } from "sonner"

interface BiometricDevice {
  id: string
  name: string
  device_id: string
  type: "fingerprint" | "face" | "card" | "hybrid"
  ip_address: string
  port: number
  location: string
  status: "online" | "offline" | "maintenance"
  last_sync: string
  firmware_version: string
  total_users: number
  total_logs: number
}

const mockDevices: BiometricDevice[] = [
  {
    id: "1",
    name: "Main Gate Biometric",
    device_id: "DEV-001",
    type: "fingerprint",
    ip_address: "192.168.1.100",
    port: 4370,
    location: "Main Entrance",
    status: "online",
    last_sync: new Date().toISOString(),
    firmware_version: "2.1.0",
    total_users: 250,
    total_logs: 1250,
  },
  {
    id: "2",
    name: "Staff Entrance",
    device_id: "DEV-002",
    type: "fingerprint",
    ip_address: "192.168.1.101",
    port: 4370,
    location: "Staff Gate",
    status: "online",
    last_sync: new Date().toISOString(),
    firmware_version: "2.0.5",
    total_users: 45,
    total_logs: 320,
  },
  {
    id: "3",
    name: "Library Scanner",
    device_id: "DEV-003",
    type: "card",
    ip_address: "192.168.1.102",
    port: 4370,
    location: "Library",
    status: "offline",
    last_sync: "2026-05-15T10:30:00Z",
    firmware_version: "1.8.2",
    total_users: 0,
    total_logs: 0,
  },
]

export default function DevicesPage() {
  const [devices, setDevices] = useState<BiometricDevice[]>(mockDevices)
  const [loading, setLoading] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState<BiometricDevice | null>(null)
  const [syncLoading, setSyncLoading] = useState<string | null>(null)

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "online":
        return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"><CheckCircle className="h-3 w-3 mr-1" />Online</Badge>
      case "offline":
        return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"><XCircle className="h-3 w-3 mr-1" />Offline</Badge>
      default:
        return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">Maintenance</Badge>
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "fingerprint":
        return <Fingerprint className="h-4 w-4" />
      case "face":
        return <Smartphone className="h-4 w-4" />
      case "card":
        return <Wifi className="h-4 w-4" />
      default:
        return <Zap className="h-4 w-4" />
    }
  }

  const handleSync = async (deviceId: string) => {
    setSyncLoading(deviceId)
    await new Promise((resolve) => setTimeout(resolve, 2000))
    toast.success("Device synchronized successfully")
    setSyncLoading(null)
  }

  const handleTestConnection = async (device: BiometricDevice) => {
    toast.loading(`Testing connection to ${device.name}...`)
    await new Promise((resolve) => setTimeout(resolve, 1500))
    toast.dismiss()
    toast.success(`${device.name} is reachable`)
  }

  const handleDelete = (device: BiometricDevice) => {
    if (confirm(`Are you sure you want to remove ${device.name}?`)) {
      setDevices(devices.filter(d => d.id !== device.id))
      toast.success("Device removed successfully")
    }
  }

  const stats = {
    total: devices.length,
    online: devices.filter(d => d.status === "online").length,
    offline: devices.filter(d => d.status === "offline").length,
    totalUsers: devices.reduce((sum, d) => sum + d.total_users, 0),
    totalLogs: devices.reduce((sum, d) => sum + d.total_logs, 0),
  }

  return (
    <ResponsiveLayout>
      <style jsx global>{`
        .dark label { color: #cbd5e1 !important; }
        .dark .text-slate-600 { color: #94a3b8 !important; }
        .dark .text-slate-500 { color: #64748b !important; }
      `}</style>

      <div className="space-y-5 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-gradient-to-r from-cyan-600 to-blue-700 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild className="bg-white/20 hover:bg-white/30 text-white rounded-xl">
              <Link href="/attendance">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
                <Fingerprint className="h-7 w-7" />
                Biometric Devices
              </h1>
              <p className="text-cyan-100 text-sm">Manage attendance capture devices</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setShowAddDialog(true)} className="bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-xl">
              <Plus className="h-4 w-4 mr-1" />
              Add Device
            </Button>
            <Button className="bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-xl">
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh All
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <Card className="bg-gradient-to-br from-cyan-500 to-cyan-600 text-white">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs opacity-75">Total Devices</p>
                  <p className="text-xl font-bold">{stats.total}</p>
                </div>
                <Fingerprint className="h-6 w-6 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs opacity-75">Online</p>
                  <p className="text-xl font-bold">{stats.online}</p>
                </div>
                <CheckCircle className="h-6 w-6 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs opacity-75">Offline</p>
                  <p className="text-xl font-bold">{stats.offline}</p>
                </div>
                <XCircle className="h-6 w-6 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs opacity-75">Total Logs</p>
                  <p className="text-xl font-bold">{stats.totalLogs.toLocaleString()}</p>
                </div>
                <Activity className="h-6 w-6 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Devices List */}
        <Card className="border-0 shadow-md">
          <CardHeader className="bg-slate-50 dark:bg-slate-700 rounded-t-2xl">
            <CardTitle>Registered Devices</CardTitle>
            <CardDescription>Manage and monitor biometric devices</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {devices.map((device) => (
                <div key={device.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
                        {getTypeIcon(device.type)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-slate-800 dark:text-white">{device.name}</h3>
                          {getStatusBadge(device.status)}
                        </div>
                        <p className="text-xs text-slate-500">{device.device_id} • {device.location}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <div className="text-sm text-slate-600 dark:text-slate-400">
                        <span className="font-medium">{device.total_users}</span> users • 
                        <span className="font-medium ml-1">{device.total_logs.toLocaleString()}</span> logs
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleTestConnection(device)}
                        className="rounded-xl"
                      >
                        <Activity className="h-3 w-3 mr-1" />
                        Test
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSync(device.id)}
                        disabled={syncLoading === device.id}
                        className="rounded-xl"
                      >
                        {syncLoading === device.id ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <RefreshCw className="h-3 w-3 mr-1" />
                        )}
                        Sync
                      </Button>
                      <Button size="sm" variant="outline" className="rounded-xl">
                        <Settings className="h-3 w-3 mr-1" />
                        Config
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(device)}
                        className="rounded-xl text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
                    <span>IP: {device.ip_address}:{device.port}</span>
                    <span>Firmware: v{device.firmware_version}</span>
                    <span>Last Sync: {new Date(device.last_sync).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Add Device Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="rounded-2xl max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-cyan-600" />
                Add Biometric Device
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Device Name</Label>
                <Input placeholder="e.g., Main Gate Scanner" className="mt-1 rounded-xl" />
              </div>
              <div>
                <Label>Device Type</Label>
                <Select>
                  <SelectTrigger className="mt-1 rounded-xl">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fingerprint">Fingerprint Scanner</SelectItem>
                    <SelectItem value="face">Face Recognition</SelectItem>
                    <SelectItem value="card">RFID Card Reader</SelectItem>
                    <SelectItem value="hybrid">Hybrid (Fingerprint + Face)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>IP Address</Label>
                <Input placeholder="192.168.1.100" className="mt-1 rounded-xl" />
              </div>
              <div>
                <Label>Port</Label>
                <Input placeholder="4370" className="mt-1 rounded-xl" />
              </div>
              <div>
                <Label>Location</Label>
                <Input placeholder="e.g., Main Entrance" className="mt-1 rounded-xl" />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setShowAddDialog(false)} className="rounded-xl">
                Cancel
              </Button>
              <Button onClick={() => {
                toast.success("Device added successfully")
                setShowAddDialog(false)
              }} className="bg-cyan-600 hover:bg-cyan-700 rounded-xl">
                Add Device
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ResponsiveLayout>
  )
}
