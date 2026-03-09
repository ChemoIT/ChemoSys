/**
 * Vehicle Suppliers admin page — server component.
 * Fetches all active suppliers and renders the VehicleSuppliersPage client component.
 * Auth guard: verifySession() redirects to /login if unauthenticated.
 *
 * verifySession() runs OUTSIDE Suspense so auth redirect fires immediately.
 */

import { Suspense } from 'react'
import { verifySession } from '@/lib/dal'
import { getVehicleSuppliers } from '@/actions/fleet/vehicle-suppliers'
import { VehicleSuppliersPage } from '@/components/admin/vehicle-suppliers/VehicleSuppliersPage'
import { PageSkeleton } from '@/components/shared/PageSkeleton'

async function VehicleSuppliersContent() {
  const suppliers = await getVehicleSuppliers()
  return <VehicleSuppliersPage initialSuppliers={suppliers} />
}

export default async function VehicleSuppliersAdminPage() {
  // Auth guard — redirects to /login if no valid session (must run OUTSIDE Suspense)
  await verifySession()

  return (
    <Suspense fallback={<PageSkeleton config={{
      titleWidth: 100,
      table: { columns: [80, 120, 80, 80, 60], rows: 8, pagination: false },
      maxWidth: 'max-w-full',
    }} />}>
      <VehicleSuppliersContent />
    </Suspense>
  )
}
