"use client"

import * as React from 'react'
import { SchoolLogo } from './SchoolLogo'

interface SchoolHeaderProps {
  schoolName?: string
  schoolAddress?: string | null
  schoolPhone?: string | null
  schoolEmail?: string | null
  schoolLogo?: string | null
  isLoading?: boolean
  className?: string
  showContact?: boolean
  orientation?: 'horizontal' | 'vertical'
}

export function SchoolHeader({
  schoolName,
  schoolAddress,
  schoolPhone,
  schoolEmail,
  schoolLogo,
  isLoading = false,
  className = '',
  showContact = true,
  orientation = 'horizontal',
}: SchoolHeaderProps) {
  if (orientation === 'vertical') {
    return (
      <div className={`flex flex-col items-center text-center ${className}`}>
        <SchoolLogo src={schoolLogo} />
        <div className="mt-2">
          <div className="text-sm font-semibold tracking-tight">
            {isLoading ? 'Loading...' : schoolName}
          </div>
          {schoolAddress && (
            <div className="text-xs text-muted-foreground mt-1 max-w-[120px]">
              {schoolAddress}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-3 min-w-0 ${className}`}>
      <SchoolLogo src={schoolLogo} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold tracking-tight">
          {isLoading ? 'Loading...' : schoolName}
        </div>
        {showContact && (
          <div className="truncate text-xs text-muted-foreground">
            {schoolAddress || schoolPhone || schoolEmail || 'School Information'}
          </div>
        )}
      </div>
    </div>
  )
}