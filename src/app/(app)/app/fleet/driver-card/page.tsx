/**
 * /app/fleet/driver-card — Driver cards list page.
 *
 * Server Component: fetches driver list + fleet settings, passes to DriverList client component.
 * Auth guard: verifyAppUser() (ChemoSys).
 */

import { verifyAppUser } from '@/lib/dal'
import { getDriversList } from '@/actions/fleet/drivers'
import { DriverList } from '@/components/app/fleet/drivers/DriverList'

export default async function DriverCardPage() {
  await verifyAppUser()

  const [drivers] = await Promise.all([
    getDriversList(),
  ])

  // Read fleet alert thresholds from env (set in Admin → Settings → הגדרות צי רכב)
  const yellowDays = parseInt(process.env['FLEET_LICENSE_YELLOW_DAYS'] ?? '60', 10)

  return (
    <DriverList
      drivers={drivers}
      yellowDays={yellowDays}
    />
  )
}
