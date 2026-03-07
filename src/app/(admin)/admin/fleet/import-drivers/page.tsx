/**
 * DriversImportPage — server component for /admin/fleet/import-drivers
 *
 * Temporary page for importing drivers from Drivers.top legacy files.
 * Will be removed after development phase is complete.
 *
 * Pattern: verifySession (auth guard) → render client component
 */

import { verifySession } from '@/lib/dal'
import { DriversImportPage } from '@/components/admin/fleet/DriversImportPage'

export default async function Page() {
  await verifySession()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-foreground">ייבוא נהגים מקובץ Drivers.top</h1>
        <span className="rounded bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
          זמני
        </span>
      </div>
      <DriversImportPage />
    </div>
  )
}
