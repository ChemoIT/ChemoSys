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

/** Days from today until a given date string. Negative = past. */
export function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const exp = new Date(dateStr); exp.setHours(0, 0, 0, 0)
  return Math.ceil((exp.getTime() - today.getTime()) / 86_400_000)
}
