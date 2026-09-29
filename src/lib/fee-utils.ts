// ✅ Fix 1: Correct generic debounce for any argument type
export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | undefined

  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}

// ✅ Fix 5: Strict amount validation regex
export function isValidAmountFormat(value: string): boolean {
  // Allow: empty, numbers, single decimal point, up to 2 decimal places
  const regex = /^\d{0,9}(\.\d{0,2})?$/
  return regex.test(value)
}

export function sanitizeAmountInput(value: string): string {
  // Remove any invalid characters
  let cleaned = value.replace(/[^\d.]/g, '')
  
  // Handle multiple decimal points - keep only first
  const parts = cleaned.split('.')
  if (parts.length > 2) {
    cleaned = parts[0] + '.' + parts.slice(1).join('')
  }
  
  // Limit to 2 decimal places
  if (parts.length === 2 && parts[1].length > 2) {
    cleaned = parts[0] + '.' + parts[1].slice(0, 2)
  }
  
  // Limit to 9 digits before decimal
  if (parts[0].length > 9) {
    cleaned = parts[0].slice(0, 9) + (parts[1] !== undefined ? '.' + parts[1] : '')
  }
  
  return cleaned
}

export function parseSafeAmount(value: string): number {
  const cleanValue = sanitizeAmountInput(value)
  if (!cleanValue) return 0
  const num = parseFloat(cleanValue)
  return isNaN(num) ? 0 : num
}

export function isValidAmount(amount: number): boolean {
  return !isNaN(amount) && amount > 0 && amount <= 99999999
}