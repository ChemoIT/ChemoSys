/**
 * /app/fleet/vehicle-card — Vehicle list page.
 *
 * Server Component: auth guard only. Data fetching delegated to VehicleListContent
 * so that Suspense can display VehicleListSkeleton immediately while data loads.
 *
 * Pattern: same as /app/fleet/fuel — page stays synchronous, inner async component
 * fetches data, Suspense provides skeleton fallback.
 *
 * Auth guard: verifyAppUser() (ChemoSys).
 */

import { Suspense } from 'react'
import { verifyAppUser } from '@/lib/dal'
import { getVehiclesList } from '@/actions/fleet/vehicles'
import { VehicleList } from '@/components/app/fleet/vehicles/VehicleList'
import { VehicleListSkeleton } from '@/components/app/fleet/vehicles/VehicleListSkeleton'

async function VehicleListContent() {
  const vehicles = await getVehiclesList()
  const yellowDays = parseInt(process.env['FLEET_LICENSE_YELLOW_DAYS'] ?? '60', 10)
  return <VehicleList vehicles={vehicles} yellowDays={yellowDays} />
}

export default async function VehicleCardListPage() {
  await verifyAppUser()

  return (
    <div className="p-4 sm:p-6" dir="rtl">
      <Suspense fallback={<VehicleListSkeleton />}>
        <VehicleListContent />
      </Suspense>
    </div>
  )
}
