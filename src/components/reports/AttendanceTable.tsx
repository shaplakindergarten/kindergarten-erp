"use client"

import { Badge } from "@/components/ui/badge"

interface AttendanceRecord {
  student: {
    name: string
    admission_no: string
    class?: {
      name: string
    }
  }

  present: number
  absent: number
  late: number
  total: number
}

interface Props {
  data: AttendanceRecord[]
}

export function AttendanceTable({
  data,
}: Props) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full">
        <thead className="bg-muted">
          <tr>
            <th className="px-4 py-3 text-left">
              Student
            </th>

            <th className="px-4 py-3 text-left">
              Class
            </th>

            <th className="px-4 py-3 text-center">
              Present
            </th>

            <th className="px-4 py-3 text-center">
              Absent
            </th>

            <th className="px-4 py-3 text-center">
              Late
            </th>

            <th className="px-4 py-3 text-center">
              %
            </th>
          </tr>
        </thead>

        <tbody>
          {data.map((record, index) => {
            const percent = Math.round(
              ((record.present + record.late) /
                record.total) *
                100
            )

            return (
              <tr
                key={index}
                className="border-t hover:bg-muted/50"
              >
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium">
                      {record.student.name}
                    </p>

                    <p className="text-xs text-muted-foreground">
                      {record.student.admission_no}
                    </p>
                  </div>
                </td>

                <td className="px-4 py-3">
                  {record.student.class?.name}
                </td>

                <td className="px-4 py-3 text-center">
                  <Badge>
                    {record.present}
                  </Badge>
                </td>

                <td className="px-4 py-3 text-center">
                  <Badge variant="destructive">
                    {record.absent}
                  </Badge>
                </td>

                <td className="px-4 py-3 text-center">
                  <Badge variant="secondary">
                    {record.late}
                  </Badge>
                </td>

                <td className="px-4 py-3 text-center">
                  <Badge>
                    {percent}%
                  </Badge>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}