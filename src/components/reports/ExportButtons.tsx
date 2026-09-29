"use client"

import { Download, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Props {
  onPrint?: () => void
  onExport?: () => void
}

export function ExportButtons({
  onPrint,
  onExport,
}: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        onClick={onPrint}
      >
        <Printer className="h-4 w-4 mr-2" />
        Print
      </Button>

      <Button onClick={onExport}>
        <Download className="h-4 w-4 mr-2" />
        PDF / CSV
      </Button>
    </div>
  )
}