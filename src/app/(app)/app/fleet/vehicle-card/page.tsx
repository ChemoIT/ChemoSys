/**
 * /app/fleet/vehicle-card — Minimal vehicle list page.
 *
 * Server component. Fetches all vehicles via getVehiclesList().
 * Renders a responsive table with license plate (clickable link), manufacturer/model,
 * company, vehicle type, status badge, and VehicleFitnessLight.
 *
 * NO search/filter — Phase 15.
 * NO AddVehicleDialog — Phase 15.
 */

import Link from 'next/link'
import { Car } from 'lucide-react'
import { getVehiclesList } from '@/actions/fleet/vehicles'
import { VehicleFitnessLight } from '@/components/app/fleet/shared/VehicleFitnessLight'
import { formatLicensePlate } from '@/lib/format'

const YELLOW_DAYS = Number(process.env['FLEET_LICENSE_YELLOW_DAYS'] ?? 60)

export default async function VehicleCardListPage() {
  const vehicles = await getVehiclesList()

  // Sort by license plate
  const sorted = [...vehicles].sort((a, b) =>
    a.licensePlate.localeCompare(b.licensePlate, 'he')
  )

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto" dir="rtl">
      {/* ── Page title ── */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-foreground">כרטיסי רכב</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {vehicles.length} רכבים במערכת
        </p>
      </div>

      {/* ── Empty state ── */}
      {sorted.length === 0 && (
        <div
          className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border text-center"
          style={{ borderColor: '#E2EBF4' }}
        >
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center mb-4"
            style={{ background: '#F0F5FB', border: '1px solid #E2EBF4' }}
          >
            <Car className="h-7 w-7 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-semibold text-muted-foreground">אין רכבים במערכת</p>
          <p className="text-xs text-muted-foreground/50 mt-1">הוסף רכב ראשון כדי להתחיל</p>
        </div>
      )}

      {/* ── Desktop table ── */}
      {sorted.length > 0 && (
        <>
          {/* Table — hidden on mobile (xs), visible from sm */}
          <div
            className="hidden sm:block bg-white rounded-2xl border overflow-hidden"
            style={{ borderColor: '#E2EBF4', boxShadow: 'var(--shadow-card)' }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="border-b text-right"
                  style={{ borderColor: '#E2EBF4', background: '#F7FAFC' }}
                >
                  <th className="px-4 py-3 font-semibold text-muted-foreground text-right w-8"></th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground text-right">מספר רישוי</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground text-right">יצרן / דגם</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground text-right">חברה</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground text-right">סוג רכב</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground text-right">סטטוס</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((vehicle, idx) => (
                  <tr
                    key={vehicle.id}
                    className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                    style={{ borderColor: '#F0F5FB' }}
                  >
                    {/* Fitness light */}
                    <td className="px-4 py-3 text-center">
                      <VehicleFitnessLight
                        testExpiryDate={vehicle.testExpiryDate}
                        insuranceMinExpiry={vehicle.insuranceMinExpiry}
                        documentMinExpiry={vehicle.documentMinExpiry}
                        yellowDays={YELLOW_DAYS}
                      />
                    </td>

                    {/* License plate — clickable link */}
                    <td className="px-4 py-3">
                      <Link
                        href={`/app/fleet/vehicle-card/${vehicle.id}`}
                        className="font-bold text-foreground hover:text-primary transition-colors"
                        dir="ltr"
                      >
                        {formatLicensePlate(vehicle.licensePlate)}
                      </Link>
                      {vehicle.assignedDriverName && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {vehicle.assignedDriverName}
                        </p>
                      )}
                    </td>

                    {/* Manufacturer / model */}
                    <td className="px-4 py-3 text-muted-foreground">
                      {[vehicle.tozeret, vehicle.degem].filter(Boolean).join(' / ') || '—'}
                      {vehicle.shnatYitzur && (
                        <span className="text-xs text-muted-foreground/60 ms-1">({vehicle.shnatYitzur})</span>
                      )}
                    </td>

                    {/* Company */}
                    <td className="px-4 py-3 text-muted-foreground">
                      {vehicle.companyName ?? '—'}
                    </td>

                    {/* Vehicle type */}
                    <td className="px-4 py-3 text-muted-foreground">
                      {/* vehicleType not in VehicleListItem — show dash */}
                      —
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      {vehicle.computedStatus === 'active' ? (
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={{ background: '#DCFCE7', color: '#16A34A', border: '1px solid #BBF7D0' }}
                        >
                          פעיל
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={{ background: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0' }}
                        >
                          לא פעיל
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Footer count */}
            <div
              className="px-4 py-2.5 border-t text-xs text-muted-foreground"
              style={{ borderColor: '#E2EBF4', background: '#F7FAFC' }}
            >
              סה&quot;כ {sorted.length} רכבים
            </div>
          </div>

          {/* ── Mobile card list — visible only on xs ── */}
          <div className="sm:hidden space-y-3">
            {sorted.map((vehicle) => (
              <Link
                key={vehicle.id}
                href={`/app/fleet/vehicle-card/${vehicle.id}`}
                className="flex items-center gap-3 p-4 bg-white rounded-xl border active:bg-muted/30 transition-colors"
                style={{ borderColor: '#E2EBF4', boxShadow: 'var(--shadow-card)' }}
              >
                {/* Avatar */}
                <div
                  className="w-11 h-11 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ background: 'linear-gradient(135deg, #152D3C 0%, #1E3D50 100%)' }}
                  dir="ltr"
                >
                  {vehicle.licensePlate.replace(/[^0-9א-ת]/g, '').slice(0, 2) || <Car className="h-5 w-5" />}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <VehicleFitnessLight
                      testExpiryDate={vehicle.testExpiryDate}
                      insuranceMinExpiry={vehicle.insuranceMinExpiry}
                      documentMinExpiry={vehicle.documentMinExpiry}
                      yellowDays={YELLOW_DAYS}
                    />
                    <span className="font-bold text-foreground text-sm" dir="ltr">
                      {formatLicensePlate(vehicle.licensePlate)}
                    </span>
                    {vehicle.computedStatus === 'active' ? (
                      <span
                        className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-semibold"
                        style={{ background: '#DCFCE7', color: '#16A34A', border: '1px solid #BBF7D0' }}
                      >
                        פעיל
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-semibold"
                        style={{ background: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0' }}
                      >
                        לא פעיל
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {[vehicle.tozeret, vehicle.degem].filter(Boolean).join(' ') || '—'}
                    {vehicle.companyName && (
                      <>
                        <span className="mx-1 text-border">·</span>
                        {vehicle.companyName}
                      </>
                    )}
                  </p>
                  {vehicle.assignedDriverName && (
                    <p className="text-xs text-muted-foreground/60 mt-0.5 truncate">
                      {vehicle.assignedDriverName}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
