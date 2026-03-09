/**
 * /app/fleet/driver-card/[id] — Full driver card page.
 *
 * Suspense pattern: page.tsx is synchronous (auth + Suspense wrapper only).
 * DriverCardContent is the inner async component that performs all data fetching.
 * Skeleton is displayed immediately — eliminates blank screen on load.
 *
 * Auth guard: verifyAppUser() (ChemoSys).
 */

import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { verifyAppUser } from '@/lib/dal'
import {
  getDriverById,
  getDriverLicense,
  getDriverDocuments,
  getDriverViolations,
} from '@/actions/fleet/drivers'
import { DriverCard } from '@/components/app/fleet/drivers/DriverCard'
import { DriverCardSkeleton } from '@/components/app/fleet/drivers/DriverCardSkeleton'

type Props = {
  params: Promise<{ id: string }>
}

// ── Inner async component — all data fetching lives here ──
async function DriverCardContent({ id }: { id: string }) {
  const [driver, license, documents, violations] = await Promise.all([
    getDriverById(id),
    getDriverLicense(id),
    getDriverDocuments(id),
    getDriverViolations(id),
  ])

  if (!driver) notFound()

  // Fleet alert thresholds from .env.local
  const yellowDays    = parseInt(process.env['FLEET_LICENSE_YELLOW_DAYS']  ?? '60', 10)
  const redDays       = parseInt(process.env['FLEET_LICENSE_RED_DAYS']     ?? '30', 10)
  const docYellowDays = parseInt(process.env['FLEET_DOCUMENT_YELLOW_DAYS'] ?? '60', 10)

  return (
    <DriverCard
      driver={driver}
      license={license}
      documents={documents}
      violations={violations}
      yellowDays={yellowDays}
      redDays={redDays}
      docYellowDays={docYellowDays}
    />
  )
}

// ── Page component — synchronous shell with Suspense boundary ──
export default async function DriverCardDetailPage({ params }: Props) {
  await verifyAppUser()
  const { id } = await params

  return (
    <div className="p-4 sm:p-6" dir="rtl">
      <Suspense fallback={<DriverCardSkeleton />}>
        <DriverCardContent id={id} />
      </Suspense>
    </div>
  )
}
