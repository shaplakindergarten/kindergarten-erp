// src/components/ui/badge.tsx
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-white",
        secondary: "border-transparent bg-secondary text-white",
        success: "border-transparent bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200",
        warning: "border-transparent bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200",
        error: "border-transparent bg-red-100 dark:bg-red-900/60 text-red-800 dark:text-red-200",
        info: "border-transparent bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200",
        outline: "text-text border-gray-200",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }