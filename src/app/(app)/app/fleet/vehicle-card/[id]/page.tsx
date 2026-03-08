/**
 * /app/fleet/vehicle-card/[id] — Full vehicle card page.
 *
 * Server Component: fetches all vehicle data sections in parallel,
 * passes to VehicleCard client component.
 * Auth guard: verifyAppUser() (ChemoSys).
 *
 * Expiry dates computed here for VehicleFitnessLight:
 *   testExpiryDate      — nearest test expiry across all tests
 *   insuranceMinExpiry  — nearest insurance expiry across all policies
 *   documentMinExpiry   — nearest document expiry across all documents
 */

import { notFound } from 'next/navigation'
import { verifyAppUser } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import {
  getVehicleById,
  getVehicleTests,
  getVehicleInsurance,
  getVehicleDocuments,
  getVehicleDriverJournal,
  getVehicleProjectJournal,
} from '@/actions/fleet/vehicles'
import { VehicleCard } from '@/components/app/fleet/vehicles/VehicleCard'

type Props = {
  params: Promise<{ id: string }>
}

export default async function VehicleCardDetailPage({ params }: Props) {
  await verifyAppUser()
  const { id } = await params

  // Fetch all vehicle data in parallel
  const [vehicle, tests, insurance, documents, driverJournal, projectJournal] = await Promise.all([
    getVehicleById(id),
    getVehicleTests(id),
    getVehicleInsurance(id),
    getVehicleDocuments(id),
    getVehicleDriverJournal(id),
    getVehicleProjectJournal(id),
  ])

  if (!vehicle) notFound()

  // Fetch companies for the details tab editable dropdown
  const supabase = await createClient()
  const { data: companiesData } = await supabase
    .from('companies')
    .select('id, name')
    .is('deleted_at', null)
    .order('name')
  const companies = (companiesData ?? []).map((c) => ({ id: c.id, name: c.name }))

  // Compute expiry dates for fitness light
  const testExpiries = tests.map((t) => t.expiryDate).filter(Boolean) as string[]
  const insuranceExpiries = insurance.map((i) => i.expiryDate).filter(Boolean) as string[]
  const docExpiries = documents.map((d) => d.expiryDate).filter(Boolean) as string[]

  const testExpiryDate = testExpiries.sort()[0] ?? null
  const insuranceMinExpiry = insuranceExpiries.sort()[0] ?? null
  const documentMinExpiry = docExpiries.sort()[0] ?? null

  // Fleet alert thresholds from .env.local
  const yellowDays    = parseInt(process.env['FLEET_LICENSE_YELLOW_DAYS']   ?? '60', 10)
  const docYellowDays = parseInt(process.env['FLEET_DOCUMENT_YELLOW_DAYS']  ?? '60', 10)

  return (
    <VehicleCard
      vehicle={vehicle}
      tests={tests}
      insurance={insurance}
      documents={documents}
      driverJournal={driverJournal}
      projectJournal={projectJournal}
      companies={companies}
      yellowDays={yellowDays}
      docYellowDays={docYellowDays}
      testExpiryDate={testExpiryDate}
      insuranceMinExpiry={insuranceMinExpiry}
      documentMinExpiry={documentMinExpiry}
    />
  )
}
