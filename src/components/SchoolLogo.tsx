// components/ui/SchoolLogo.tsx
"use client"

import * as React from 'react'
import { Building } from 'lucide-react'

interface SchoolLogoProps {
  src?: string | null
  alt?: string
  width?: number
  height?: number
  className?: string
  containerClassName?: string
  fallbackIcon?: React.ReactNode
}

export function SchoolLogo({
  src,
  alt = 'School Logo',
  width = 44,
  height = 44,
  className = 'h-full w-full object-cover',
  containerClassName = 'relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/25 bg-white/20 shadow-lg shadow-black/10',
  fallbackIcon,
}: SchoolLogoProps) {
  const [hasError, setHasError] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(true)

  // src পরিবর্তন হলে রিসেট
  React.useEffect(() => {
    setHasError(false)
    setIsLoading(true)
  }, [src])

  if (!src || hasError) {
    return (
      <div className={containerClassName}>
        {fallbackIcon || <Building className="h-5 w-5 text-white" />}
      </div>
    )
  }

  return (
    <div className={containerClassName}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-200/50 dark:bg-gray-800/50 animate-pulse">
          <Building className="h-5 w-5 text-gray-400" />
        </div>
      )}
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setHasError(true)
          setIsLoading(false)
        }}
      />
    </div>
  )
}