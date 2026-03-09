/**
 * CarLogImportPage — server component for /admin/fleet/import-carlog
 *
 * Temporary page for importing fuel records from CarLog.top legacy files.
 * Will be removed after development phase is complete.
 *
 * Pattern: verifySession (auth guard) → fetch history → render client component
 */

import { verifySession } from '@/lib/dal'
import { getCarLogImportBatches } from '@/actions/fleet/import-carlog'
import { CarLogImportPage } from '@/components/admin/fleet/CarLogImportPage'

export default async function Page() {
  await verifySession()

  const batches = await getCarLogImportBatches()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-foreground">ייבוא תדלוקים מקובץ CarLog.top</h1>
        <span className="rounded bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
          זמני
        </span>
      </div>
      <CarLogImportPage initialBatches={batches} />
    </div>
  )
}
