"use client"

import { useEffect, useState } from "react"
import { Calendar, BookOpen, FileText, TrendingUp } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface CustomScheduleProps {
  value: any
  onChange: (schedule: any) => void
}

const MONTHS = [
  { num: 1, name: "January", short: "Jan" },
  { num: 2, name: "February", short: "Feb" },
  { num: 3, name: "March", short: "Mar" },
  { num: 4, name: "April", short: "Apr" },
  { num: 5, name: "May", short: "May" },
  { num: 6, name: "June", short: "Jun" },
  { num: 7, name: "July", short: "Jul" },
  { num: 8, name: "August", short: "Aug" },
  { num: 9, name: "September", short: "Sep" },
  { num: 10, name: "October", short: "Oct" },
  { num: 11, name: "November", short: "Nov" },
  { num: 12, name: "December", short: "Dec" },
]

const SCHEDULE_TYPES = [
  { value: "book_fee", label: "Books Fee", icon: BookOpen, color: "from-blue-500 to-cyan-500" },
  { value: "syllabus_fee", label: "Syllabus Fee", icon: FileText, color: "from-emerald-500 to-teal-500" },
  { value: "exam_fee", label: "Exam Fee", icon: TrendingUp, color: "from-purple-500 to-pink-500" },
  { value: "custom_period", label: "Custom Period", icon: Calendar, color: "from-orange-500 to-amber-500" },
]

export function CustomScheduleInput({ value, onChange }: CustomScheduleProps) {
  const [selectedMonths, setSelectedMonths] = useState<number[]>([])
  const [amountPerMonth, setAmountPerMonth] = useState<string>("")
  const [scheduleType, setScheduleType] = useState<string>("book_fee")

  // Load existing value when editing
  useEffect(() => {
    if (value) {
      setSelectedMonths(value.months || [])
      setAmountPerMonth(value.amount_per_month?.toString() || "")
      setScheduleType(value.type || "book_fee")
    }
  }, [value])

  const updateParent = (months: number[], amount: string, type: string) => {
    const amountNum = parseFloat(amount) || 0
    onChange({
      type: type,
      months: months,
      amount_per_month: amountNum,
      total_amount: months.length * amountNum,
      show: true,
    })
  }

  const toggleMonth = (monthNum: number) => {
    let newMonths
    if (selectedMonths.includes(monthNum)) {
      newMonths = selectedMonths.filter(m => m !== monthNum)
    } else {
      newMonths = [...selectedMonths, monthNum].sort((a, b) => a - b)
    }
    setSelectedMonths(newMonths)
    updateParent(newMonths, amountPerMonth, scheduleType)
  }

  const handleAmountChange = (val: string) => {
    setAmountPerMonth(val)
    updateParent(selectedMonths, val, scheduleType)
  }

  const handleTypeChange = (type: string) => {
    setScheduleType(type)
    updateParent(selectedMonths, amountPerMonth, type)
  }

  const totalAmount = selectedMonths.length * (parseFloat(amountPerMonth) || 0)

  return (
    <div className="space-y-4 p-4 rounded-xl bg-gradient-to-r from-slate-50 to-indigo-50/30 dark:from-slate-900 dark:to-indigo-950/20 border border-border">
      <div className="space-y-2">
        <Label className="text-sm font-medium">Select Fee Type</Label>
        <div className="grid grid-cols-2 gap-2">
          {SCHEDULE_TYPES.map((type) => {
            const Icon = type.icon
            return (
              <button
                key={type.value}
                type="button"
                onClick={() => handleTypeChange(type.value)}
                className={`p-3 rounded-xl text-left transition-all duration-200 ${
                  scheduleType === type.value
                    ? `bg-gradient-to-r ${type.color} text-white shadow-md`
                    : "bg-background border border-border hover:border-primary/50"
                }`}
              >
                <Icon className="h-4 w-4 mb-1" />
                <p className="text-sm font-medium">{type.label}</p>
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Select Applicable Months</Label>
          {selectedMonths.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setSelectedMonths([])
                setAmountPerMonth("")
                updateParent([], "", scheduleType)
              }}
              className="text-xs text-red-500 hover:text-red-600"
            >
              Clear all
            </button>
          )}
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {MONTHS.map((month) => {
            const isSelected = selectedMonths.includes(month.num)
            return (
              <button
                key={month.num}
                type="button"
                onClick={() => toggleMonth(month.num)}
                className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                  isSelected
                    ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md"
                    : "bg-muted/50 hover:bg-muted"
                }`}
              >
                {month.short}
              </button>
            )
          })}
        </div>
        {selectedMonths.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Selected: {selectedMonths.length} months ({selectedMonths.map(m => MONTHS.find(mo => mo.num === m)?.short).join(", ")})
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Amount per Month (BDT)</Label>
        <Input
          type="number"
          value={amountPerMonth}
          onChange={(e) => handleAmountChange(e.target.value)}
          placeholder="e.g., 500"
          className="rounded-xl"
        />
      </div>

      {selectedMonths.length > 0 && amountPerMonth && (
        <div className="p-3 rounded-lg bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-200 dark:border-emerald-800/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Total Amount</p>
              <p className="text-xs text-muted-foreground">
                {selectedMonths.length} months × {parseFloat(amountPerMonth)} BDT
              </p>
            </div>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
              ৳{totalAmount.toLocaleString()}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}