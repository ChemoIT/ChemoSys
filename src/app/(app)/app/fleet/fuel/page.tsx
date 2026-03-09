import { Suspense } from 'react'
import { verifyAppUser } from '@/lib/dal'
import { getFuelRecords, getFuelStats, getProjectsForFuelFilter } from '@/actions/fleet/fuel'
import { FuelRecordsPage } from '@/components/app/fleet/fuel/FuelRecordsPage'
import { FuelPageSkeleton } from '@/components/app/fleet/fuel/FuelPageSkeleton'
import type { FuelFilters } from '@/lib/fleet/fuel-types'

function getDefaultFilters(): FuelFilters {
  const now = new Date()
  return {
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
    sortBy: 'fueling_date',
    sortDir: 'desc',
  }
}

async function FuelContent() {
  const defaultFilters = getDefaultFilters()

  const [{ records, total }, stats, projects] = await Promise.all([
    getFuelRecords(defaultFilters),
    getFuelStats(defaultFilters),
    getProjectsForFuelFilter(),
  ])

  return (
    <FuelRecordsPage
      initialRecords={records}
      initialTotal={total}
      initialStats={stats}
      projects={projects}
      initialFilters={defaultFilters}
    />
  )
}

export default async function FleetFuelPage() {
  await verifyAppUser()

  return (
    <div className="p-4 sm:p-6" dir="rtl">
      <Suspense fallback={<FuelPageSkeleton />}>
        <FuelContent />
      </Suspense>
    </div>
  )
}
