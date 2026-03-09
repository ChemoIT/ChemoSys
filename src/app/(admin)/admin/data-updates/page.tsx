/**
 * /admin/data-updates — Recurring Data Import Page.
 *
 * Server Component: admin-only page for importing monthly data files
 * (fuel records, km logs, invoices, etc.) from Excel/CSV.
 *
 * Security: verifySession() as first line — admin-only.
 */

import { verifySession } from '@/lib/dal'
import { DataUpdatesPage } from '@/components/admin/data-updates/DataUpdatesPage'

export default async function Page() {
  await verifySession()

  return (
    <div className="space-y-6" dir="rtl">
      <h1 className="text-2xl font-bold text-foreground">עדכון נתונים שוטף</h1>
      <DataUpdatesPage />
    </div>
  )
}
