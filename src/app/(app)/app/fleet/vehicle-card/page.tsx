/**
 * /app/fleet/vehicle-card — Vehicle list page.
 *
 * Server Component: fetches all vehicles via getVehiclesList(),
 * passes to VehicleList client component (with filters, search, add button).
 * Auth guard: verifyAppUser() (ChemoSys).
 */

import { verifyAppUser } from '@/lib/dal'
import { getVehiclesList } from '@/actions/fleet/vehicles'
import { VehicleList } from '@/components/app/fleet/vehicles/VehicleList'

export default async function VehicleCardListPage() {
  await verifyAppUser()

  const vehicles = await getVehiclesList()
  const yellowDays = parseInt(process.env['FLEET_LICENSE_YELLOW_DAYS'] ?? '60', 10)

  return (
    <div className="p-4 sm:p-6" dir="rtl">
      <VehicleList vehicles={vehicles} yellowDays={yellowDays} />
    </div>
  )
}
