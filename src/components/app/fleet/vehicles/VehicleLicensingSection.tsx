'use client'

/**
 * VehicleLicensingSection — Merged "רישוי וביטוח" tab (Tab 3 in redesigned VehicleCard).
 *
 * Combines:
 *   - VehicleTestsSection (previously Tab 2 "טסטים")
 *   - VehicleInsuranceSection (previously Tab 3 "ביטוח")
 *
 * Neither sub-section is modified — they slot in unchanged.
 *
 * Dirty tracking: ORs both sub-section dirty states into one onEditingChange.
 * This keeps VehicleCard.tsx clean — it sees only one dirty key: "licensing".
 *
 * Note on VehicleInsuranceSection: it self-fetches insurance suppliers internally
 * via getActiveSuppliersByType('insurance') on mount — no suppliers prop accepted.
 */

import { useRef, useCallback } from 'react'
import { ClipboardCheck, Shield } from 'lucide-react'
import { VehicleTestsSection } from './VehicleTestsSection'
import { VehicleInsuranceSection } from './VehicleInsuranceSection'
import type { VehicleTest, VehicleInsurance } from '@/lib/fleet/vehicle-types'

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────

type VehicleLicensingSectionProps = {
  vehicleId: string
  tests: VehicleTest[]
  insurance: VehicleInsurance[]
  docYellowDays: number
  onEditingChange: (dirty: boolean) => void
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

export function VehicleLicensingSection({
  vehicleId,
  tests,
  insurance,
  docYellowDays,
  onEditingChange,
}: VehicleLicensingSectionProps) {
  // Track dirty state from each sub-section independently
  const testsRef = useRef(false)
  const insuranceRef = useRef(false)

  const handleTestsChange = useCallback((dirty: boolean) => {
    testsRef.current = dirty
    onEditingChange(testsRef.current || insuranceRef.current)
  }, [onEditingChange])

  const handleInsuranceChange = useCallback((dirty: boolean) => {
    insuranceRef.current = dirty
    onEditingChange(testsRef.current || insuranceRef.current)
  }, [onEditingChange])

  return (
    <div dir="rtl" className="space-y-8">

      {/* Sub-section: רישוי (טסטים) */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-4 flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4" />
          רישוי (טסטים)
        </h2>
        <VehicleTestsSection
          vehicleId={vehicleId}
          tests={tests}
          docYellowDays={docYellowDays}
          onEditingChange={handleTestsChange}
        />
      </div>

      {/* Divider */}
      <div className="border-t" style={{ borderColor: '#E2EBF4' }} />

      {/* Sub-section: ביטוח */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-4 flex items-center gap-2">
          <Shield className="h-4 w-4" />
          ביטוח
        </h2>
        <VehicleInsuranceSection
          vehicleId={vehicleId}
          insurance={insurance}
          docYellowDays={docYellowDays}
          onEditingChange={handleInsuranceChange}
        />
        {/* Note: VehicleInsuranceSection self-fetches insurance suppliers internally via
            getActiveSuppliersByType('insurance') — no suppliers prop needed or accepted */}
      </div>

    </div>
  )
}
