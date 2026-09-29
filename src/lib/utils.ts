import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency: 'BDT',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Format date to readable string
 * @param date - Date string, Date object, or null/undefined
 * @returns Formatted date string (e.g., "15 Jan 2025") or "—" if invalid
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—"
  
  const d = new Date(date)
  if (isNaN(d.getTime())) return "—"
  
  return d.toLocaleDateString('en-BD', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

/**
 * Format date with time
 * @param date - Date string, Date object, or null/undefined
 * @returns Formatted date with time (e.g., "15 Jan 2025, 10:30 AM")
 */
export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "—"
  
  const d = new Date(date)
  if (isNaN(d.getTime())) return "—"
  
  return d.toLocaleDateString('en-BD', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * Format relative time (e.g., "2 days ago", "just now")
 * @param date - Date string, Date object, or null/undefined
 * @returns Relative time string
 */
export function formatRelativeTime(date: string | Date | null | undefined): string {
  if (!date) return "—"
  
  const d = new Date(date)
  if (isNaN(d.getTime())) return "—"
  
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)
  const diffWeeks = Math.floor(diffDays / 7)
  const diffMonths = Math.floor(diffDays / 30)
  const diffYears = Math.floor(diffDays / 365)
  
  if (diffSecs < 60) return "just now"
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks > 1 ? 's' : ''} ago`
  if (diffMonths < 12) return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`
  return `${diffYears} year${diffYears > 1 ? 's' : ''} ago`
}

/**
 * Format number with commas (e.g., 1,00,000)
 * @param num - Number to format
 * @returns Formatted number string
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-BD').format(num)
}

/**
 * Truncate text with ellipsis
 * @param text - Text to truncate
 * @param length - Maximum length
 * @returns Truncated text
 */
export function truncateText(text: string, length: number = 50): string {
  if (!text) return ""
  if (text.length <= length) return text
  return text.slice(0, length) + "..."
}

export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

export function convertBanglaToEnglishDigits(str: string | number): string {
  if (typeof str === 'number') return str.toString()
  if (!str) return ''
  const banglaDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯']
  return str.replace(/[০-৯]/g, (w) => banglaDigits.indexOf(w).toString())
}

/**
 * Generate random invoice number
 * @param prefix - Invoice prefix (default: "INV")
 * @returns Invoice number (e.g., INV-20250115-1234)
 */
export function generateInvoiceNo(prefix: string = "INV"): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "")
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0")
  return `${prefix}-${date}-${random}`
}

export async function fetchJson<T = any>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init)
  const contentType = response.headers.get("content-type") || ""
  const text = await response.text()

  if (!response.ok) {
    let errorMessage = `Fetch failed with status ${response.status} ${response.statusText}`
    if (contentType.includes("application/json")) {
      try {
        const parsed = JSON.parse(text)
        errorMessage = parsed?.error || parsed?.message || JSON.stringify(parsed)
      } catch {
        errorMessage = text || errorMessage
      }
    } else if (text.trim()) {
      errorMessage = text
    }
    throw new Error(errorMessage)
  }

  if (!contentType.includes("application/json")) {
    throw new Error(
      `Expected JSON response but received ${contentType || "unknown content type"} from ${typeof input === "string" ? input : "request"}`
    )
  }

  try {
    return JSON.parse(text)
  } catch (error) {
    throw new Error(`Failed to parse JSON response: ${error}`)
  }
}