/**
 * /admin/data-updates — Recurring Data Import Page.
 *
 * Server Component: admin-only page for importing monthly data files
 * (fuel records, km logs, invoices, etc.) from Excel/CSV.
 *
 * Security: verifySession() runs OUTSIDE Suspense — auth redirect fires immediately.
 */

import { Suspense } from 'react'
import { verifySession } from '@/lib/dal'
import { DataUpdatesPage } from '@/components/admin/data-updates/DataUpdatesPage'
import { PageSkeleton } from '@/components/shared/PageSkeleton'

async function DataUpdatesContent() {
  return (
    <div className="space-y-6" dir="rtl">
      <h1 className="text-2xl font-bold text-foreground">עדכון נתונים שוטף</h1>
      <DataUpdatesPage />
    </div>
  )
}

export default async function Page() {
  // Auth guard — MUST be first, OUTSIDE Suspense boundary
  await verifySession()

  return (
    <Suspense fallback={<PageSkeleton config={{
      titleWidth: 130,
      cards: { count: 3, height: 100, cols: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' },
      maxWidth: 'max-w-full'
    }} />}>
      <DataUpdatesContent />
    </Suspense>
  )
}
