'use client'

/**
 * VehicleFitnessLight — vehicle fitness status dot (red/yellow/green).
 *
 * Separate from driver FitnessLight — vehicle fitness logic is different:
 *   - Red:    test expired OR any insurance expired (road legality critical)
 *   - Yellow: any of the 3 (test, insurance, document) within yellowDays of expiry
 *   - Green:  all clear
 *   - Null dates = no data = treat as green (vehicle may not have that record yet)
 *
 * Used by VehicleList and VehicleCard in Phase 14+.
 * Driver FitnessLight (drivers/FitnessLight.tsx) stays separate — "avoid mega-generic FitnessLight".
 */

import { cn } from '@/lib/utils'

export type VehicleFitnessStatus = 'red' | 'yellow' | 'green'

/**
 * Compute vehicle fitness status from expiry dates.
 *
 * @param testExpiryDate      - YYYY-MM-DD or null (vehicle test / טסט)
 * @param insuranceMinExpiry  - YYYY-MM-DD or null (nearest insurance expiry)
 * @param documentMinExpiry   - YYYY-MM-DD or null (nearest document expiry)
 * @param yellowDays          - threshold for yellow warning
 */
export function computeVehicleFitnessStatus(
  testExpiryDate: string | null,
  insuranceMinExpiry: string | null,
  documentMinExpiry: string | null,
  yellowDays: number
): VehicleFitnessStatus {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  function daysRemaining(dateStr: string): number {
    const d = new Date(dateStr)
    d.setHours(0, 0, 0, 0)
    return Math.ceil((d.getTime() - today.getTime()) / 86_400_000)
  }

  // Red: test expired OR any insurance expired (both critical for road legality)
  if (testExpiryDate) {
    const days = daysRemaining(testExpiryDate)
    if (days <= 0) return 'red'
  }

  if (insuranceMinExpiry) {
    const days = daysRemaining(insuranceMinExpiry)
    if (days <= 0) return 'red'
  }

  // Yellow: any of the 3 within yellowDays of expiry
  if (testExpiryDate) {
    const days = daysRemaining(testExpiryDate)
    if (days <= yellowDays) return 'yellow'
  }

  if (insuranceMinExpiry) {
    const days = daysRemaining(insuranceMinExpiry)
    if (days <= yellowDays) return 'yellow'
  }

  if (documentMinExpiry) {
    const days = daysRemaining(documentMinExpiry)
    if (days <= yellowDays) return 'yellow'
  }

  return 'green'
}

export type VehicleFitnessStatusExtended = VehicleFitnessStatus | 'gray'

const STATUS_TOOLTIP: Record<VehicleFitnessStatusExtended, string> = {
  red: 'תוקף פג',
  yellow: 'תוקף מתקרב',
  green: 'רכב תקין',
  gray: 'רכב מחוץ לצי',
}

const DOT_CLASS: Record<VehicleFitnessStatusExtended, string> = {
  red: 'bg-red-500 shadow-red-500/50',
  yellow: 'bg-yellow-400 shadow-yellow-400/50',
  green: 'bg-green-500 shadow-green-500/50',
  gray: 'bg-gray-400 shadow-gray-400/50',
}

type VehicleFitnessLightProps = {
  testExpiryDate: string | null
  insuranceMinExpiry: string | null
  documentMinExpiry: string | null
  yellowDays: number
  isInactive?: boolean
  className?: string
}

export function VehicleFitnessLight({
  testExpiryDate,
  insuranceMinExpiry,
  documentMinExpiry,
  yellowDays,
  isInactive = false,
  className,
}: VehicleFitnessLightProps) {
  const status: VehicleFitnessStatusExtended = isInactive
    ? 'gray'
    : computeVehicleFitnessStatus(
        testExpiryDate,
        insuranceMinExpiry,
        documentMinExpiry,
        yellowDays
      )

  return (
    <span
      className={cn('inline-flex items-center', className)}
      title={STATUS_TOOLTIP[status]}
    >
      <span
        className={cn(
          'h-2.5 w-2.5 rounded-full shadow-md',
          DOT_CLASS[status],
          status === 'red' && 'animate-pulse'
        )}
      />
    </span>
  )
}
