"use client"

import { useState, useEffect } from "react"
import {
  Clock3,
  Bell,
  Save,
  Loader2,
  CalendarDays,
} from "lucide-react"

import { ResponsiveLayout } from "@/components/layout/responsive-layout"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

export default function AttendanceSettingsPage() {
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)

  const [settings, setSettings] = useState({
    school_start_time: "08:00",
    late_after: "08:15",
    half_day_after: "11:00",
    school_end_time: "14:00",
    sms_notification_enabled: true,
    is_friday_off: true,
    is_saturday_off: false,
  })

  // =========================
  // LOAD SETTINGS
  // =========================
  useEffect(() => {
    async function loadSettings() {
      try {
        setFetching(true)

        const { data, error } = await supabase
          .from("school_settings")
          .select("*")
          .eq("id", 1)
          .maybeSingle()

        if (error) {
          console.error("LOAD ERROR:", error)
          throw error
        }

        // যদি row না থাকে তাহলে create করে দিবে
        if (!data) {
          const { error: insertError } = await supabase
            .from("school_settings")
            .insert({
              id: 1,
            })

          if (insertError) {
            console.error("INITIAL INSERT ERROR:", insertError)
          }

          return
        }

        setSettings({
          school_start_time:
            data.school_start_time || "08:00",

          late_after:
            data.late_after || "08:15",

          half_day_after:
            data.half_day_after || "11:00",

          school_end_time:
            data.school_end_time || "14:00",

          sms_notification_enabled:
            data.sms_notification_enabled ?? true,

          is_friday_off:
            data.is_friday_off ?? true,

          is_saturday_off:
            data.is_saturday_off ?? false,
        })
      } catch (err) {
        console.error("FETCH SETTINGS ERROR:", err)

        toast.error("Failed to load settings")
      } finally {
        setFetching(false)
      }
    }

    loadSettings()
  }, [supabase])

  // =========================
  // SAVE SETTINGS
  // =========================
  async function handleSave() {
    setLoading(true)

    try {
      const payload = {
        id: 1,

        school_start_time:
          settings.school_start_time,

        late_after:
          settings.late_after,

        half_day_after:
          settings.half_day_after,

        school_end_time:
          settings.school_end_time,

        sms_notification_enabled:
          Boolean(settings.sms_notification_enabled),

        is_friday_off:
          Boolean(settings.is_friday_off),

        is_saturday_off:
          Boolean(settings.is_saturday_off),

        updated_at:
          new Date().toISOString(),
      }

      console.log("SAVE PAYLOAD:", payload)

      const response = await supabase
        .from("school_settings")
        .upsert([payload], {
          onConflict: "id",
        })
        .select()

      console.log("SUPABASE RESPONSE:", response)

      if (response.error) {
        console.error(
          "REAL SUPABASE ERROR:",
          JSON.stringify(response.error, null, 2)
        )

        throw new Error(
          response.error.message ||
            response.error.details ||
            response.error.hint ||
            "Database update failed"
        )
      }

      toast.success(
        "Attendance settings saved successfully!"
      )
    } catch (err: any) {
      console.error("SAVE FAILED:", err)

      toast.error(
        err?.message ||
          "Unknown database error"
      )
    } finally {
      setLoading(false)
    }
  }

  // =========================
  // LOADING SCREEN
  // =========================
  if (fetching) {
    return (
      <ResponsiveLayout>
        <div className="flex h-screen items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />

            <p className="font-mono text-sm font-medium text-slate-500">
              Connecting to database...
            </p>
          </div>
        </div>
      </ResponsiveLayout>
    )
  }

  return (
    <ResponsiveLayout>
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        {/* HEADER */}
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight dark:text-white">
              Attendance Settings
            </h1>

            <p className="mt-1 font-medium text-muted-foreground">
              Configure school timing, weekends,
              and notifications
            </p>
          </div>

          <Button
            onClick={handleSave}
            disabled={loading}
            className="h-11 bg-indigo-600 px-8 shadow-lg transition-all hover:bg-indigo-700 active:scale-95"
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}

            {loading
              ? "Saving Changes..."
              : "Save Settings"}
          </Button>
        </div>

        {/* TABS */}
        <Tabs
          defaultValue="timing"
          className="space-y-6"
        >
          <TabsList className="w-fit rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            <TabsTrigger
              value="timing"
              className="rounded-lg px-6"
            >
              Timing & Weekly Off
            </TabsTrigger>

            <TabsTrigger
              value="notifications"
              className="rounded-lg px-6"
            >
              Notifications
            </TabsTrigger>

            <TabsTrigger
              value="general"
              className="rounded-lg px-6"
            >
              General
            </TabsTrigger>
          </TabsList>

          {/* TIMING */}
          <TabsContent
            value="timing"
            className="space-y-6"
          >
            <Card className="rounded-2xl border-none shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 dark:text-white">
                  <Clock3 className="h-5 w-5 text-indigo-500" />

                  Attendance Timing
                </CardTitle>

                <CardDescription>
                  Set official attendance rules
                </CardDescription>
              </CardHeader>

              <CardContent className="grid gap-8 pb-8 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-3">
                  <Label className="text-sm font-bold dark:text-slate-300">
                    School Start Time
                  </Label>

                  <Input
                    type="time"
                    value={
                      settings.school_start_time
                    }
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        school_start_time:
                          e.target.value,
                      })
                    }
                    className="h-12 rounded-xl text-lg font-medium dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-bold dark:text-slate-300">
                    Late After
                  </Label>

                  <Input
                    type="time"
                    value={settings.late_after}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        late_after:
                          e.target.value,
                      })
                    }
                    className="h-12 rounded-xl border-amber-200 text-lg font-medium dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-bold dark:text-slate-300">
                    Half Day After
                  </Label>

                  <Input
                    type="time"
                    value={
                      settings.half_day_after
                    }
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        half_day_after:
                          e.target.value,
                      })
                    }
                    className="h-12 rounded-xl text-lg font-medium dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-bold dark:text-slate-300">
                    School End Time
                  </Label>

                  <Input
                    type="time"
                    value={
                      settings.school_end_time
                    }
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        school_end_time:
                          e.target.value,
                      })
                    }
                    className="h-12 rounded-xl text-lg font-medium dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </CardContent>
            </Card>

            {/* WEEKEND */}
            <Card className="rounded-2xl border-none shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 dark:text-white">
                  <CalendarDays className="h-5 w-5 text-emerald-500" />

                  Weekly Off-Days
                </CardTitle>

                <CardDescription>
                  Select institution weekly holidays
                </CardDescription>
              </CardHeader>

              <CardContent className="flex flex-wrap gap-12 p-6">
                <div className="flex items-center space-x-4">
                  <Switch
                    id="fri_off"
                    checked={
                      settings.is_friday_off
                    }
                    onCheckedChange={(v) =>
                      setSettings({
                        ...settings,
                        is_friday_off: v,
                      })
                    }
                    className="data-[state=checked]:bg-emerald-500"
                  />

                  <Label
                    htmlFor="fri_off"
                    className="cursor-pointer font-bold"
                  >
                    Friday (Closed)
                  </Label>
                </div>

                <div className="flex items-center space-x-4">
                  <Switch
                    id="sat_off"
                    checked={
                      settings.is_saturday_off
                    }
                    onCheckedChange={(v) =>
                      setSettings({
                        ...settings,
                        is_saturday_off: v,
                      })
                    }
                    className="data-[state=checked]:bg-emerald-500"
                  />

                  <Label
                    htmlFor="sat_off"
                    className="cursor-pointer font-bold"
                  >
                    Saturday (Closed)
                  </Label>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* NOTIFICATION */}
          <TabsContent value="notifications">
            <Card className="rounded-2xl border-none ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 dark:text-white">
                  <Bell className="h-5 w-5 text-rose-500" />

                  Messaging Services
                </CardTitle>
              </CardHeader>

              <CardContent>
                <div className="flex items-center justify-between rounded-2xl border bg-slate-50/50 p-6 dark:border-slate-800 dark:bg-slate-800/50">
                  <div className="space-y-1">
                    <p className="font-bold dark:text-slate-200">
                      Auto SMS for Absent Students
                    </p>

                    <p className="text-sm text-muted-foreground">
                      Notify parents automatically
                    </p>
                  </div>

                  <Switch
                    checked={
                      settings.sms_notification_enabled
                    }
                    onCheckedChange={(v) =>
                      setSettings({
                        ...settings,
                        sms_notification_enabled:
                          v,
                      })
                    }
                    className="scale-110 data-[state=checked]:bg-emerald-500"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* GENERAL */}
          <TabsContent value="general">
            <Card className="rounded-2xl border-none ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
              <CardHeader>
                <CardTitle className="text-lg font-bold">
                  System Method
                </CardTitle>
              </CardHeader>

              <CardContent>
                <div className="rounded-xl bg-slate-100 p-4 dark:bg-slate-800">
                  <p className="font-mono text-sm text-slate-600 dark:text-slate-400">
                    Current Method: Manual +
                    Bio-Metric Device Sync
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ResponsiveLayout>
  )
}
