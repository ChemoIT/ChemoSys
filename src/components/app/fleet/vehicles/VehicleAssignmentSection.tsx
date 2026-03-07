'use client'

/**
 * VehicleAssignmentSection — Tab 4: Driver assignment for a vehicle.
 *
 * Shows current assigned driver and allows assigning or removing a driver.
 * - If assignedDriverId is not null: shows driver name card + "הסר שיוך" button
 * - Below: searchable dropdown of active drivers + "שייך נהג" button
 * - Auto-save on button click (no dirty tracking — not form-based)
 * - Refreshes page data via router.refresh() after assignment changes
 */

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { User, UserX, Loader2, UserCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getActiveDriversForAssignment, assignDriverToVehicle } from '@/actions/fleet/vehicles'
import type { DriverOptionForAssignment } from '@/lib/fleet/vehicle-types'

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────

type Props = {
  vehicleId: string
  assignedDriverId: string | null
  assignedDriverName: string | null
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

export function VehicleAssignmentSection({
  vehicleId,
  assignedDriverId,
  assignedDriverName,
}: Props) {
  const router = useRouter()
  const [drivers, setDrivers] = useState<DriverOptionForAssignment[]>([])
  const [selectedDriverId, setSelectedDriverId] = useState<string>('')
  const [loadingDrivers, setLoadingDrivers] = useState(true)
  const [isAssigning, startAssignTransition] = useTransition()
  const [isRemoving, startRemoveTransition] = useTransition()

  // Fetch active drivers on mount
  useEffect(() => {
    let cancelled = false
    void getActiveDriversForAssignment().then((list) => {
      if (!cancelled) {
        setDrivers(list)
        setLoadingDrivers(false)
      }
    }).catch(() => {
      if (!cancelled) setLoadingDrivers(false)
    })
    return () => { cancelled = true }
  }, [])

  function handleAssign() {
    if (!selectedDriverId) {
      toast.error('יש לבחור נהג מהרשימה')
      return
    }
    startAssignTransition(async () => {
      const result = await assignDriverToVehicle(vehicleId, selectedDriverId)
      if (result.success) {
        toast.success('נהג שויך בהצלחה')
        setSelectedDriverId('')
        router.refresh()
      } else {
        toast.error(result.error ?? 'שגיאה בשיוך הנהג')
      }
    })
  }

  function handleRemove() {
    startRemoveTransition(async () => {
      const result = await assignDriverToVehicle(vehicleId, null)
      if (result.success) {
        toast.success('שיוך הנהג הוסר')
        router.refresh()
      } else {
        toast.error(result.error ?? 'שגיאה בהסרת השיוך')
      }
    })
  }

  return (
    <div dir="rtl" className="space-y-6">

      {/* ── Current assignment ── */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3">שיוך נהג נוכחי</h3>

        {assignedDriverId && assignedDriverName ? (
          <div
            className="flex items-center justify-between gap-4 p-4 rounded-xl border"
            style={{ background: '#F0F5FB', borderColor: '#C8D5E2' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'linear-gradient(135deg, #152D3C 0%, #1E3D50 100%)' }}
              >
                <UserCheck className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{assignedDriverName}</p>
                <p className="text-xs text-muted-foreground">נהג משויך</p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRemove}
              disabled={isRemoving}
              className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
            >
              {isRemoving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <UserX className="h-3.5 w-3.5" />
              )}
              הסר שיוך
            </Button>
          </div>
        ) : (
          <div
            className="flex items-center gap-3 p-4 rounded-xl border"
            style={{ borderColor: '#E2EBF4', borderStyle: 'dashed' }}
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: '#F0F5FB', border: '1px solid #E2EBF4' }}
            >
              <User className="h-5 w-5 text-muted-foreground/40" />
            </div>
            <p className="text-sm text-muted-foreground">לא משויך לנהג</p>
          </div>
        )}
      </div>

      {/* ── Assign new driver ── */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3">שייך נהג</h3>

        <div className="flex items-center gap-3 flex-wrap">
          {loadingDrivers ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              טוען נהגים...
            </div>
          ) : (
            <>
              <select
                value={selectedDriverId}
                onChange={(e) => setSelectedDriverId(e.target.value)}
                className="flex-1 min-w-[200px] border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-right"
                style={{ borderColor: '#C8D5E2' }}
                disabled={isAssigning}
              >
                <option value="">בחר נהג...</option>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.fullName}
                  </option>
                ))}
              </select>

              <Button
                onClick={handleAssign}
                disabled={isAssigning || !selectedDriverId}
                className="gap-1.5 shrink-0"
                style={{
                  background: selectedDriverId
                    ? 'linear-gradient(135deg, #4ECDC4, #3ABFB6)'
                    : undefined,
                  border: 'none',
                }}
              >
                {isAssigning ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserCheck className="h-4 w-4" />
                )}
                שייך נהג
              </Button>
            </>
          )}
        </div>

        {!loadingDrivers && drivers.length === 0 && (
          <p className="text-xs text-muted-foreground mt-2">אין נהגים פעילים במערכת</p>
        )}
      </div>
    </div>
  )
}
