'use client'

/**
 * FuelImportTab — fuel data import interface (for future Excel/CSV imports).
 *
 * NOTE: For CarLog.top legacy imports, use /admin/fleet/import-carlog instead.
 *
 * This tab will be built when monthly Excel imports from fuel suppliers are needed.
 * Currently shows a placeholder linking to CarLog import.
 */

import { FileSpreadsheet } from 'lucide-react'

export function FuelImportTab() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-border p-6 text-center"
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        <FileSpreadsheet className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
        <h3 className="text-base font-semibold text-foreground mb-1">ייבוא גיליונות ספקי דלק</h3>
        <p className="text-sm text-muted-foreground mb-4">
          ייבוא חודשי מקבצי Excel של ספקי הדלק — ייבנה בשלב מאוחר יותר.
        </p>
        <p className="text-sm text-muted-foreground">
          לייבוא נתוני עבר מקבצי CarLog.top, עבור ל:{' '}
          <a href="/admin/fleet/import-carlog" className="text-primary underline underline-offset-4 hover:text-primary/80">
            ייבוא CarLog.top
          </a>
        </p>
      </div>
    </div>
  )
}
