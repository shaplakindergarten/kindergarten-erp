"use client"

import {
  Calendar,
  TrendingUp,
  BarChart3,
} from "lucide-react"

import {
  Card,
  CardContent,
} from "@/components/ui/card"

interface Props {
  avgAttendance: number
  totalPresent: number
  totalAbsent: number
  totalLate: number
}

export function SummaryCards({
  avgAttendance,
  totalPresent,
  totalAbsent,
  totalLate,
}: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-6 w-6 text-primary" />

            <div>
              <p className="text-2xl font-bold">
                {avgAttendance}%
              </p>

              <p className="text-sm text-muted-foreground">
                Avg Attendance
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-6 w-6 text-green-600" />

            <div>
              <p className="text-2xl font-bold">
                {totalPresent}
              </p>

              <p className="text-sm text-muted-foreground">
                Present
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-6 w-6 text-red-600" />

            <div>
              <p className="text-2xl font-bold">
                {totalAbsent}
              </p>

              <p className="text-sm text-muted-foreground">
                Absent
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Calendar className="h-6 w-6 text-orange-600" />

            <div>
              <p className="text-2xl font-bold">
                {totalLate}
              </p>

              <p className="text-sm text-muted-foreground">
                Late
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}