import { verifyAppUser } from '@/lib/dal'
import { getFuelRecords, getFuelStats, getProjectsForFuelFilter } from '@/actions/fleet/fuel'
import { FuelRecordsPage } from '@/components/app/fleet/fuel/FuelRecordsPage'
import type { FuelFilters } from '@/lib/fleet/fuel-types'

export default async function FleetFuelPage() {
  await verifyAppUser()

  const now = new Date()
  const defaultFilters: FuelFilters = {
    fromMonth: now.getMonth() + 1,
    fromYear: now.getFullYear(),
    toMonth: now.getMonth() + 1,
    toYear: now.getFullYear(),
    supplier: null,
    fuelType: null,
    licensePlateSearch: null,
    projectId: null,
    vehicleType: null,
    page: 1,
  }

  const [{ records, total }, stats, projects] = await Promise.all([
    getFuelRecords(defaultFilters),
    getFuelStats(defaultFilters),
    getProjectsForFuelFilter(),
  ])

  return (
    <div className="p-4 sm:p-6" dir="rtl">
      <FuelRecordsPage
        initialRecords={records}
        initialTotal={total}
        initialStats={stats}
        projects={projects}
        initialFilters={defaultFilters}
      />
    </div>
  )
}
