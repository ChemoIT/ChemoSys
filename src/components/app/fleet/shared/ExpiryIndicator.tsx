'use client'

/**
 * ExpiryIndicator — expiry date display with days-remaining and color coding.
 *
 * Shared component — used by DriverDocumentsSection document list rows,
 * and will be used by vehicle document rows in Phase 14+.
 *
 * Color logic:
 *   - Red:    already expired (days < 0)
 *   - Yellow: expiring within yellowDays
 *   - Green:  all clear
 *   - Muted:  no expiry date set
 */

import { formatDate, daysUntil } from '@/lib/format'

type ExpiryIndicatorProps = {
  expiryDate: string | null
  yellowDays: number
}

export function ExpiryIndicator({ expiryDate, yellowDays }: ExpiryIndicatorProps) {
  if (!expiryDate) return <span className="text-muted-foreground text-xs">ללא תוקף</span>
  const days = daysUntil(expiryDate)
  if (days === null) return null
  const dateStr = formatDate(expiryDate)
  const color = days < 0 ? 'text-red-600' : days <= yellowDays ? 'text-yellow-600' : 'text-green-600'
  return (
    <div className={`text-xs ${color}`}>
      {dateStr}
      <span className="ms-1">
        ({days < 0 ? `פג לפני ${Math.abs(days)} ימים` : `${days} ימים`})
      </span>
    </div>
  )
}
