'use client'

/**
 * FitnessLight — רמזור כשירות נהג.
 *
 * Logic (computed from expiry dates + threshold values):
 *   🔴 red    — license expired (expiry_date <= today)
 *   🟡 yellow — license OR any document expiring within yellowDays
 *   🟢 green  — all clear
 *
 * Note: document expiry never causes red — only yellow.
 * The threshold values (yellowDays, redDays) come from Admin → Settings → Fleet.
 */

import { cn } from '@/lib/utils'

export type FitnessStatus = 'red' | 'yellow' | 'green'

type Props = {
  licenseExpiryDate: string | null    // YYYY-MM-DD or null
  documentMinExpiry: string | null    // nearest doc expiry, YYYY-MM-DD or null
  yellowDays: number                   // FLEET_LICENSE_YELLOW_DAYS / FLEET_DOCUMENT_YELLOW_DAYS
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

export function computeFitnessStatus(
  licenseExpiryDate: string | null,
  documentMinExpiry: string | null,
  yellowDays: number
): FitnessStatus {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (licenseExpiryDate) {
    const expiry = new Date(licenseExpiryDate)
    expiry.setHours(0, 0, 0, 0)

    if (expiry <= today) return 'red'

    const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / 86_400_000)
    if (daysLeft <= yellowDays) return 'yellow'
  }

  if (documentMinExpiry) {
    const expiry = new Date(documentMinExpiry)
    expiry.setHours(0, 0, 0, 0)
    const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / 86_400_000)
    if (daysLeft <= yellowDays) return 'yellow'
  }

  return 'green'
}

const STATUS_LABEL: Record<FitnessStatus, string> = {
  red: 'לא כשיר',
  yellow: 'טעון בדיקה',
  green: 'כשיר',
}

const DOT_CLASS: Record<FitnessStatus, string> = {
  red: 'bg-red-500 shadow-red-500/50',
  yellow: 'bg-yellow-400 shadow-yellow-400/50',
  green: 'bg-green-500 shadow-green-500/50',
}

const SIZE_CLASS = {
  sm: 'h-2.5 w-2.5',
  md: 'h-3.5 w-3.5',
  lg: 'h-5 w-5',
}

export function FitnessLight({
  licenseExpiryDate,
  documentMinExpiry,
  yellowDays,
  size = 'md',
  showLabel = false,
}: Props) {
  const status = computeFitnessStatus(licenseExpiryDate, documentMinExpiry, yellowDays)

  return (
    <span className="inline-flex items-center gap-1.5" title={STATUS_LABEL[status]}>
      <span
        className={cn(
          'rounded-full shadow-md animate-pulse',
          DOT_CLASS[status],
          SIZE_CLASS[size]
        )}
      />
      {showLabel && (
        <span
          className={cn(
            'text-sm font-medium',
            status === 'red'    && 'text-red-600',
            status === 'yellow' && 'text-yellow-600',
            status === 'green'  && 'text-green-600'
          )}
        >
          {STATUS_LABEL[status]}
        </span>
      )}
    </span>
  )
}
