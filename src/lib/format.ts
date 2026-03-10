/**
 * format.ts — centralized formatting utilities for ChemoSystem.
 *
 * IRON RULES:
 *   Phone:         05x-xxxxxxx
 *   Date:          dd/mm/yyyy  (always zero-padded)
 *   License plate: 7 digits → xx-xxx-xx  |  8 digits → xxx-xx-xxx
 *   ID number:     9 digits, zero-padded
 */

/**
 * Normalize an Israeli mobile phone number.
 * Strips non-digits, removes country code (972/+972/00972),
 * adds leading 0 if starts with 5, then validates 10-digit 05x format.
 * Returns normalized 10-digit string (e.g. "0526804680") or null if invalid.
 *
 * IRON RULE: Any field that *claims* to be a phone but doesn't pass
 * this validation is NOT a phone — ignore it (Michpal sometimes stores
 * ID numbers or other data in phone fields).
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  let digits = raw.replace(/\D/g, '')
  if (!digits) return null
  // Remove Israel country code
  if (digits.startsWith('00972')) digits = digits.slice(5)
  else if (digits.startsWith('972')) digits = digits.slice(3)
  // Add leading 0 if starts with 5 (common Michpal issue)
  if (digits.startsWith('5') && digits.length === 9) digits = '0' + digits
  // Validate: must be exactly 10 digits starting with 05
  if (digits.length === 10 && digits.startsWith('05')) return digits
  return null
}

/**
 * Format Israeli mobile phone: 05x-xxxxxxx
 * If the value doesn't normalize to a valid phone → returns '—' (not the raw junk).
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '—'
  const normalized = normalizePhone(phone)
  if (!normalized) return '—'
  return `${normalized.slice(0, 3)}-${normalized.slice(3)}`
}

/** Format date as dd/mm/yyyy (zero-padded). Accepts yyyy-mm-dd or Date-parseable string. */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '—'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

/** Format Israeli ID number: 9-digit zero-padded */
export function formatId(id: string | null | undefined): string {
  if (!id) return '—'
  return id.replace(/\D/g, '').padStart(9, '0')
}

/**
 * Format Israeli license plate number.
 * 7 digits → xx-xxx-xx
 * 8 digits → xxx-xx-xxx
 */
export function formatLicensePlate(plate: string | null | undefined): string {
  if (!plate) return '—'
  const digits = plate.replace(/\D/g, '')
  if (digits.length === 7) {
    return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`
  }
  if (digits.length === 8) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`
  }
  return plate
}

/** Format time string (HH:MM:SS → HH:MM). Returns '—' for null/empty. */
export function formatTime(timeStr: string | null | undefined): string {
  if (!timeStr) return '—'
  return timeStr.slice(0, 5)
}

/** Format currency in ILS (₪). Uses he-IL locale. Returns '—' for null. */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '—'
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

/** Format number with he-IL locale grouping. Returns '—' for null. */
export function formatNumber(n: number | null | undefined, decimals = 0): string {
  if (n == null) return '—'
  return new Intl.NumberFormat('he-IL', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n)
}

/**
 * Convert Liberty Basic serial date to yyyy-mm-dd string.
 * All .top files (CarLog, Drivers, CarList, SystemProject) use this format.
 * LB serial 0 = 01/01/1901, serial 45724 = 10/03/2026.
 *
 * Formula: LB serial → Unix ms via offset 25202
 * (25202 = days from 01/01/1901 to 01/01/1970 = 69×365 + 17 leap years)
 *
 * IMPORTANT: Do NOT confuse with Excel serial (1 = 01/01/1900, offset 25569).
 * LB serial = Excel serial - 367.
 */
export function lbSerialToDate(serial: number): string | null {
  if (!serial || serial < 1) return null
  const ms = (serial - 25202) * 86400 * 1000
  const d = new Date(ms)
  if (isNaN(d.getTime())) return null
  const year = d.getFullYear()
  if (year < 1990 || year > 2060) return null
  return d.toISOString().split('T')[0]
}

/** Days from today until a given date string. Negative = past. */
export function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const exp = new Date(dateStr); exp.setHours(0, 0, 0, 0)
  return Math.ceil((exp.getTime() - today.getTime()) / 86_400_000)
}
