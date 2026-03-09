/**
 * /app/fleet/driver-card — Driver cards list page.
 *
 * Server Component (shell): auth check only + Suspense wrapper.
 * Data fetching is deferred into DriverListContent so Next.js can stream
 * the skeleton immediately while the DB query runs.
 *
 * Auth guard: verifyAppUser() (ChemoSys).
 */

import { Suspense } from 'react'
import { verifyAppUser } from '@/lib/dal'
import { getDriversList } from '@/actions/fleet/drivers'
import { DriverList } from '@/components/app/fleet/drivers/DriverList'
import { DriverListSkeleton } from '@/components/app/fleet/drivers/DriverListSkeleton'

/**
 * Inner async component — performs data fetching.
 * Wrapped by Suspense so the skeleton shows while this resolves.
 */
async function DriverListContent() {
  const [drivers] = await Promise.all([getDriversList()])

  // Read fleet alert thresholds from env (set in Admin Settings)
  const yellowDays = parseInt(process.env['FLEET_LICENSE_YELLOW_DAYS'] ?? '60', 10)

  return <DriverList drivers={drivers} yellowDays={yellowDays} />
}

export default async function DriverCardPage() {
  await verifyAppUser()

  return (
    <div className="p-4 sm:p-6" dir="rtl">
      <Suspense fallback={<DriverListSkeleton />}>
        <DriverListContent />
      </Suspense>
    </div>
  )
}
