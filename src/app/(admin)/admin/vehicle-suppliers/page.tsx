/**
 * Vehicle Suppliers admin page — server component.
 * Fetches all active suppliers and renders the VehicleSuppliersPage client component.
 * Auth guard: verifySession() redirects to /login if unauthenticated.
 */

import { verifySession } from '@/lib/dal'
import { getVehicleSuppliers } from '@/actions/fleet/vehicle-suppliers'
import { VehicleSuppliersPage } from '@/components/admin/vehicle-suppliers/VehicleSuppliersPage'

export default async function VehicleSuppliersAdminPage() {
  await verifySession()
  const suppliers = await getVehicleSuppliers()
  return <VehicleSuppliersPage initialSuppliers={suppliers} />
}
