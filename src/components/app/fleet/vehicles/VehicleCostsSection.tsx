'use client'

/**
 * VehicleCostsSection — Tab 5: Coming Soon placeholder for future costs module.
 *
 * Monthly costs management will be built in a future version.
 */

import { DollarSign } from 'lucide-react'

export function VehicleCostsSection() {
  return (
    <div
      className="bg-white border-x border-b rounded-b-2xl py-12 text-center"
      style={{ borderColor: '#E2EBF4' }}
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
        style={{ background: '#F0F5FB', border: '1px solid #E2EBF4' }}
      >
        <DollarSign className="h-6 w-6 text-muted-foreground/35" />
      </div>
      <p className="text-sm font-semibold text-muted-foreground">פיתוח עתידי</p>
      <p className="text-xs text-muted-foreground/50 mt-0.5">ניהול עלויות חודשיות ייפתח בגרסה הבאה</p>
    </div>
  )
}
