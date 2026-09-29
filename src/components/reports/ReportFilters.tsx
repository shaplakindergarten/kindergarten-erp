"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface ClassItem {
  id: string
  name: string
}

interface Props {
  reportType: string
  setReportType: (value: string) => void
  selectedClass: string
  setSelectedClass: (value: string) => void
  classes: ClassItem[]
}

export function ReportFilters({
  reportType,
  setReportType,
  selectedClass,
  setSelectedClass,
  classes,
}: Props) {
  return (
    <div className="flex flex-wrap gap-3">
      <Select
        value={reportType}
        onValueChange={setReportType}
      >
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Report Type" />
        </SelectTrigger>

        <SelectContent>
          <SelectItem value="daily">
            Daily
          </SelectItem>

          <SelectItem value="monthly">
            Monthly
          </SelectItem>

          <SelectItem value="class-wise">
            Class Wise
          </SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={selectedClass}
        onValueChange={setSelectedClass}
      >
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Class" />
        </SelectTrigger>

        <SelectContent>
          {classes.map((cls) => (
            <SelectItem
              key={cls.id}
              value={cls.id}
            >
              {cls.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}