'use client'

/**
 * VehicleDetailsSection — Tab 1 of VehicleCard.
 *
 * Layout: two-column RTL grid
 *  Right column (first in RTL): MOT data (read-only, gray background)
 *  Left column: operational fields (editable)
 *
 * MOT fields: license plate, manufacturer, model, commercial name, year, color,
 *   fuel type, chassis, engine model, trim level, emission group, ownership (MOT),
 *   registration date, last sync date + "עדכן ממשרד הרישוי" button
 *
 * Operational fields: vehicle type, ownership type, company, is_active,
 *   leasing company, insurance company, fuel card supplier, garage
 *
 * Supplier dropdowns: fetched via getActiveSuppliersByType() on mount.
 * Dirty tracking: compare current form vs original vehicle data.
 */

import { useState, useEffect, useTransition } from 'react'
import { toast } from 'sonner'
import { Loader2, RefreshCw, Save } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { getActiveSuppliersByType, updateVehicleDetails } from '@/actions/fleet/vehicles'
import { syncVehicleFromMot } from '@/actions/fleet/mot-sync'
import { formatLicensePlate, formatDate } from '@/lib/format'
import {
  VEHICLE_TYPE_LABELS,
  OWNERSHIP_TYPE_LABELS,
  type VehicleFull,
} from '@/lib/fleet/vehicle-types'

// ─────────────────────────────────────────────────────────────
// InfoRow — read-only display row
// ─────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      className="flex items-start gap-3 py-2 border-b last:border-0"
      style={{ borderColor: '#EEF3F9' }}
    >
      <span className="text-xs text-muted-foreground w-28 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm flex-1 text-right font-medium text-foreground/80">
        {value ?? '—'}
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────

type Props = {
  vehicle: VehicleFull
  companies: { id: string; name: string }[]
  onEditingChange?: (isDirty: boolean) => void
}

type SupplierOption = { id: string; name: string }

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

export function VehicleDetailsSection({ vehicle, companies, onEditingChange }: Props) {
  // ── Editable form state ──
  const [vehicleType, setVehicleType] = useState(vehicle.vehicleType ?? '')
  const [ownershipType, setOwnershipType] = useState(vehicle.ownershipType ?? '')
  const [companyId, setCompanyId] = useState(vehicle.companyId ?? '')
  const [isActive, setIsActive] = useState(vehicle.isActive)
  const [leasingCompanyId, setLeasingCompanyId] = useState(vehicle.leasingCompanyId ?? '')
  const [insuranceCompanyId, setInsuranceCompanyId] = useState(vehicle.insuranceCompanyId ?? '')
  const [fuelCardSupplierId, setFuelCardSupplierId] = useState(vehicle.fuelCardSupplierId ?? '')
  const [garageId, setGarageId] = useState(vehicle.garageId ?? '')

  // ── Supplier options ──
  const [leasingSuppliers, setLeasingSuppliers] = useState<SupplierOption[]>([])
  const [insuranceSuppliers, setInsuranceSuppliers] = useState<SupplierOption[]>([])
  const [fuelCardSuppliers, setFuelCardSuppliers] = useState<SupplierOption[]>([])
  const [garageSuppliers, setGarageSuppliers] = useState<SupplierOption[]>([])

  // ── Transitions ──
  const [isSaving, startSaveTransition] = useTransition()
  const [isSyncing, startSyncTransition] = useTransition()

  // ── Dirty tracking ──
  const isDirty =
    vehicleType !== (vehicle.vehicleType ?? '') ||
    ownershipType !== (vehicle.ownershipType ?? '') ||
    companyId !== (vehicle.companyId ?? '') ||
    isActive !== vehicle.isActive ||
    leasingCompanyId !== (vehicle.leasingCompanyId ?? '') ||
    insuranceCompanyId !== (vehicle.insuranceCompanyId ?? '') ||
    fuelCardSupplierId !== (vehicle.fuelCardSupplierId ?? '') ||
    garageId !== (vehicle.garageId ?? '')

  useEffect(() => {
    onEditingChange?.(isDirty)
  }, [isDirty, onEditingChange])

  // ── Fetch supplier options on mount ──
  useEffect(() => {
    void getActiveSuppliersByType('leasing').then(setLeasingSuppliers)
    void getActiveSuppliersByType('insurance').then(setInsuranceSuppliers)
    void getActiveSuppliersByType('fuel_card').then(setFuelCardSuppliers)
    void getActiveSuppliersByType('garage').then(setGarageSuppliers)
  }, [])

  // ─────────────────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────────────────

  function handleSave() {
    startSaveTransition(async () => {
      const result = await updateVehicleDetails({
        vehicleId: vehicle.id,
        vehicleType: vehicleType || null,
        ownershipType: ownershipType || null,
        companyId: companyId || null,
        isActive,
        leasingCompanyId: leasingCompanyId || null,
        insuranceCompanyId: insuranceCompanyId || null,
        fuelCardSupplierId: fuelCardSupplierId || null,
        garageId: garageId || null,
      })
      if (result.success) {
        toast.success('פרטי הרכב נשמרו בהצלחה')
      } else {
        toast.error(result.error ?? 'שגיאה בשמירה')
      }
    })
  }

  function handleMotSync() {
    startSyncTransition(async () => {
      const result = await syncVehicleFromMot(vehicle.id, vehicle.licensePlate)
      if (result.success) {
        toast.success('הנתונים עודכנו ממשרד הרישוי')
      } else {
        toast.error(result.error ?? 'שגיאה בסנכרון ממשרד הרישוי')
      }
    })
  }

  // ─────────────────────────────────────────────────────────
  // Shared select class
  // ─────────────────────────────────────────────────────────

  const selectClass =
    'w-full border border-border rounded-lg px-3 py-2 text-base bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-right appearance-none cursor-pointer'

  // ─────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-0">

      {/* ── עמודה ימנית — נתוני משרד הרישוי (קריאה בלבד) ──── */}
      <div>
        <div
          className="rounded-xl p-3 mb-4"
          style={{ background: '#F7FAFD', border: '1px solid #E2EBF4' }}
        >
          <p className="text-xs text-muted-foreground font-semibold mb-2">נתוני משרד הרישוי</p>

          <InfoRow
            label="מספר רישוי"
            value={<span className="font-mono font-bold" dir="ltr">{formatLicensePlate(vehicle.licensePlate)}</span>}
          />
          <InfoRow label="יצרן" value={vehicle.tozoretNm} />
          <InfoRow label="דגם" value={vehicle.degemNm} />
          <InfoRow label="כינוי מסחרי" value={vehicle.kinuyMishari} />
          <InfoRow label="שנת ייצור" value={vehicle.shnatYitzur?.toString()} />
          <InfoRow label="צבע" value={vehicle.tzevaRechev} />
          <InfoRow label="סוג דלק" value={vehicle.sugDelekNm} />
          <InfoRow label="מסגרת (שלדה)" value={vehicle.misgeret} />
          <InfoRow label="דגם מנוע" value={vehicle.degemManoa} />
          <InfoRow label="רמת גימור" value={vehicle.ramatGimur} />
          <InfoRow label="קבוצת זיהום" value={vehicle.kvutzatZihum} />
          <InfoRow label="בעלות (רישוי)" value={vehicle.baalut} />
          <InfoRow
            label="עלייה לכביש"
            value={formatDate(vehicle.moedAliyaLakvish)}
          />

          {/* MOT sync row */}
          <div
            className="flex items-center justify-between py-2"
            style={{ borderTop: '1px solid #EEF3F9' }}
          >
            <button
              onClick={handleMotSync}
              disabled={isSyncing}
              className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
            >
              {isSyncing
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <RefreshCw className="h-3.5 w-3.5" />
              }
              עדכן ממשרד הרישוי
            </button>
            <span className="text-xs text-muted-foreground">
              {vehicle.motLastSyncAt
                ? `עודכן: ${formatDate(vehicle.motLastSyncAt.split('T')[0])}`
                : 'לא סונכרן'}
            </span>
          </div>
        </div>
      </div>

      {/* ── עמודה שמאלית — שדות תפעוליים (עריכה) ─────────── */}
      <div className="space-y-4">

        {/* סוג רכב */}
        <div className="space-y-1.5">
          <Label>סוג רכב</Label>
          <select
            value={vehicleType}
            onChange={(e) => setVehicleType(e.target.value)}
            className={selectClass}
          >
            <option value="">— בחר סוג —</option>
            {Object.entries(VEHICLE_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        {/* סוג בעלות */}
        <div className="space-y-1.5">
          <Label>סוג בעלות</Label>
          <select
            value={ownershipType}
            onChange={(e) => setOwnershipType(e.target.value)}
            className={selectClass}
          >
            <option value="">— בחר בעלות —</option>
            {Object.entries(OWNERSHIP_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        {/* חברה */}
        <div className="space-y-1.5">
          <Label>חברה</Label>
          <select
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            className={selectClass}
          >
            <option value="">— בחר חברה —</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* פעיל */}
        <div className="flex items-center justify-between py-1">
          <div dir="ltr" className="flex items-center gap-2">
            <Switch
              checked={isActive}
              onCheckedChange={setIsActive}
              className="data-[state=checked]:bg-[#4ECDC4]"
            />
          </div>
          <Label>רכב פעיל</Label>
        </div>

        {/* חברת ליסינג */}
        <div className="space-y-1.5">
          <Label>חברת ליסינג</Label>
          <select
            value={leasingCompanyId}
            onChange={(e) => setLeasingCompanyId(e.target.value)}
            className={selectClass}
          >
            <option value="">— ללא —</option>
            {leasingSuppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* חברת ביטוח */}
        <div className="space-y-1.5">
          <Label>חברת ביטוח</Label>
          <select
            value={insuranceCompanyId}
            onChange={(e) => setInsuranceCompanyId(e.target.value)}
            className={selectClass}
          >
            <option value="">— ללא —</option>
            {insuranceSuppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* ספק כרטיס דלק */}
        <div className="space-y-1.5">
          <Label>ספק כרטיס דלק</Label>
          <select
            value={fuelCardSupplierId}
            onChange={(e) => setFuelCardSupplierId(e.target.value)}
            className={selectClass}
          >
            <option value="">— ללא —</option>
            {fuelCardSuppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* מוסך */}
        <div className="space-y-1.5">
          <Label>מוסך</Label>
          <select
            value={garageId}
            onChange={(e) => setGarageId(e.target.value)}
            className={selectClass}
          >
            <option value="">— ללא —</option>
            {garageSuppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* Save button */}
        <div className="pt-2 flex justify-start">
          <button
            onClick={handleSave}
            disabled={isSaving || !isDirty}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={
              isDirty
                ? {
                    background: 'linear-gradient(135deg, #4ECDC4, #3ABFB6)',
                    color: '#fff',
                    border: '1px solid #3ABFB6',
                    boxShadow: '0 2px 6px rgb(78 205 196 / 0.35)',
                  }
                : {
                    background: '#F0F5FB',
                    color: '#637381',
                    border: '1px solid #C8D5E2',
                    cursor: 'not-allowed',
                  }
            }
          >
            {isSaving
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Save className="h-4 w-4" />
            }
            שמור שינויים
          </button>
        </div>
      </div>
    </div>
  )
}
