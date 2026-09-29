"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "onBlur" | "onFocus"> {
  value: number | string
  onValueChange: (value: number) => void
  format?: (value: number) => string
  parse?: (value: string) => number
}

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  (
    {
      value,
      onValueChange,
      className,
      format,
      parse,
      ...props
    },
    ref
  ) => {
    const [displayValue, setDisplayValue] = React.useState<string>(
      format ? format(Number(value) || 0) : (value?.toString() ?? "0")
    )

    const convertBanglaToEnglishDigits = (str: string): string => {
      const banglaDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"]
      return str.replace(/[০-৯]/g, (w) => banglaDigits.indexOf(w).toString())
    }

    const sanitizeNumberInput = (str: string): string => {
      let converted = convertBanglaToEnglishDigits(str)
      converted = converted.replace(/[^0-9.]/g, "")
      const parts = converted.split(".")
      if (parts.length > 2) {
        converted = `${parts[0]}.${parts.slice(1).join("")}`
      }
      return converted
    }

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      const numValue = Number(displayValue)
      if (displayValue === "0" || displayValue === "0.00" || numValue === 0 || displayValue === "") {
        setDisplayValue("")
      }
      props.onFocus?.(e)
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawInput = e.target.value
      const sanitized = sanitizeNumberInput(rawInput)
      setDisplayValue(sanitized)
      const numericValue = sanitized === "" ? 0 : parseFloat(sanitized) || 0
      onValueChange(numericValue)
    }

    const handleBlur = () => {
      if (displayValue === "" || isNaN(Number(displayValue))) {
        setDisplayValue(format ? format(0) : "0")
        onValueChange(0)
      } else {
        setDisplayValue(displayValue)
      }
    }

    return (
      <input
        {...props}
        ref={ref}
        type="text"
        inputMode="decimal"
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        className={cn(
          "flex h-9 w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground",
          "placeholder:text-muted-foreground focus-visible:outline-none",
          "focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed",
          "disabled:opacity-50 dark:border-border dark:bg-background dark:ring-0",
          className
        )}
      />
    )
  }
)

CurrencyInput.displayName = "CurrencyInput"

export { CurrencyInput }