// src/components/ui/progress.tsx
"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"
import { cn } from "@/lib/utils"

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & {
    indicatorClassName?: string
    showValue?: boolean
    valueLabel?: string
  }
>(({ 
  className, 
  value, 
  indicatorClassName, 
  showValue = false,
  valueLabel,
  ...props 
}, ref) => {
  // Ensure value is between 0 and 100
  const safeValue = Math.min(100, Math.max(0, value || 0))
  
  return (
    <div className="w-full space-y-1.5">
      {showValue && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{valueLabel || 'Progress'}</span>
          <span>{Math.round(safeValue)}%</span>
        </div>
      )}
      <ProgressPrimitive.Root
        ref={ref}
        className={cn(
          "relative h-2 w-full overflow-hidden rounded-full bg-secondary", 
          className
        )}
        {...props}
      >
        <ProgressPrimitive.Indicator
          className={cn(
            "h-full w-full flex-1 transition-all duration-500 ease-in-out",
            // Different colors based on progress
            safeValue < 30 && "bg-red-500",
            safeValue >= 30 && safeValue < 70 && "bg-yellow-500",
            safeValue >= 70 && safeValue < 100 && "bg-blue-500",
            safeValue >= 100 && "bg-green-500",
            indicatorClassName
          )}
          style={{ 
            transform: `translateX(-${100 - safeValue}%)`,
            transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        />
      </ProgressPrimitive.Root>
    </div>
  )
})

Progress.displayName = ProgressPrimitive.Root.displayName

// ============================
// ✅ ADDED: Animated Progress with Label
// ============================

export interface AnimatedProgressProps {
  value: number
  label?: string
  max?: number
  className?: string
  indicatorClassName?: string
  showPercentage?: boolean
  status?: 'idle' | 'loading' | 'success' | 'error'
}

export function AnimatedProgress({ 
  value, 
  label, 
  max = 100,
  className,
  indicatorClassName,
  showPercentage = true,
  status = 'loading'
}: AnimatedProgressProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100))
  
  const statusColors = {
    idle: 'bg-gray-200',
    loading: 'bg-blue-500',
    success: 'bg-green-500',
    error: 'bg-red-500',
  }
  
  const statusTextColors = {
    idle: 'text-gray-500',
    loading: 'text-blue-600',
    success: 'text-green-600',
    error: 'text-red-600',
  }
  
  return (
    <div className="space-y-2 w-full">
      {/* Label and Percentage */}
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label || 'Progress'}
        </span>
        {showPercentage && (
          <span className={cn(
            "text-sm font-semibold",
            statusTextColors[status]
          )}>
            {Math.round(percentage)}%
          </span>
        )}
      </div>
      
      {/* Progress Bar */}
      <div className="relative">
        <div className={cn(
          "h-2.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700",
          className
        )}>
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500 ease-in-out",
              statusColors[status],
              indicatorClassName
            )}
            style={{ 
              width: `${percentage}%`,
              transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          />
        </div>
        
        {/* Status Icon */}
        {status === 'success' && (
          <div className="absolute -right-1 -top-1">
            <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        )}
        {status === 'error' && (
          <div className="absolute -right-1 -top-1">
            <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        )}
        {status === 'loading' && percentage < 100 && (
          <div className="absolute -right-1 -top-1">
            <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
          </div>
        )}
      </div>
    </div>
  )
}

// ============================
// ✅ ADDED: Progress Steps
// ============================

export interface Step {
  id: string
  label: string
  status: 'pending' | 'active' | 'completed' | 'error'
}

export function ProgressSteps({ 
  steps, 
  currentStep,
  className 
}: { 
  steps: Step[]
  currentStep: number
  className?: string 
}) {
  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep
          const isActive = index === currentStep
          const isError = step.status === 'error'
          
          return (
            <React.Fragment key={step.id}>
              {/* Step Circle */}
              <div className="flex flex-col items-center">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300",
                  isCompleted && "bg-green-500 text-white",
                  isActive && "bg-blue-500 text-white ring-4 ring-blue-200 dark:ring-blue-900",
                  isError && "bg-red-500 text-white",
                  !isCompleted && !isActive && !isError && "bg-gray-200 dark:bg-gray-700 text-gray-500"
                )}>
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : isError ? (
                    <X className="h-4 w-4" />
                  ) : (
                    index + 1
                  )}
                </div>
                <span className={cn(
                  "text-xs mt-1 text-center",
                  isActive && "font-medium text-blue-600 dark:text-blue-400",
                  isCompleted && "text-green-600 dark:text-green-400",
                  isError && "text-red-600 dark:text-red-400",
                  !isCompleted && !isActive && !isError && "text-gray-500 dark:text-gray-400"
                )}>
                  {step.label}
                </span>
              </div>
              
              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div className={cn(
                  "flex-1 h-0.5 mx-2 transition-all duration-300",
                  index < currentStep ? "bg-green-500" : "bg-gray-200 dark:bg-gray-700"
                )} />
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}

// Import required icons
import { Loader2, Check, X } from "lucide-react"

export { Progress }