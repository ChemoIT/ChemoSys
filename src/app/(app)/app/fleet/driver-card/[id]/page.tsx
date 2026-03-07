/**
 * /app/fleet/driver-card/[id] — Full driver card page.
 *
 * Server Component: fetches all driver data sections in parallel,
 * passes to DriverCard client component.
 * Auth guard: verifyAppUser() (ChemoSys).
 */

import { notFound } from 'next/navigation'
import { verifyAppUser } from '@/lib/dal'
import {
  getDriverById,
  getDriverLicense,
  getDriverDocuments,
  getDriverViolations,
} from '@/actions/fleet/drivers'
import { DriverCard } from '@/components/app/fleet/drivers/DriverCard'

type Props = {
  params: Promise<{ id: string }>
}

export default async function DriverCardDetailPage({ params }: Props) {
  await verifyAppUser()
  const { id } = await params

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
