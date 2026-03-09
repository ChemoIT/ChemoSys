'use client'

/**
 * VehiclePermitsSection — Tab: אשרות והגבלים (Permits & Limits)
 *
 * Two-column RTL layout:
 * Right column:
 *   1. Toll road permits (multi-checkbox): כביש 6 / חוצה צפון / מנהרות הכרמל / הנתיב המהיר
 *   2. Weekend & holiday driving permit (switch)
 *   3. Pascal number (digits-only input)
 * Left column:
 *   1. Service interval km (digits input + alert switch)
 *   2. Annual km limit (digits input + alert switch)
 *   3. Monthly fuel limit in liters (digits input + alert switch)
 *
 * Dirty tracking + save via updateVehicleDetails().
 */

import { useState, useEffect, useTransition } from 'react'
import { toast } from 'sonner'
import { Save, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { updateVehicleDetails } from '@/actions/fleet/vehicles'
import type { VehicleFull } from '@/lib/fleet/vehicle-types'

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const TOLL_ROADS = [
  { value: 'kvish6', label: 'כביש 6' },
  { value: 'hotzefon', label: 'חוצה צפון' },
  { value: 'carmel', label: 'מנהרות הכרמל' },
  { value: 'nativ', label: 'הנתיב המהיר' },
] as const

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────

type Props = {
  vehicle: VehicleFull
  isLocked?: boolean
  onEditingChange: (dirty: boolean) => void
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

export function VehiclePermitsSection({ vehicle, isLocked = false, onEditingChange }: Props) {
  // ── Right column state ──
  const [tollRoads, setTollRoads] = useState<string[]>(vehicle.tollRoadPermits ?? [])
  const [weekendPermit, setWeekendPermit] = useState(vehicle.weekendHolidayPermit ?? false)
  const [pascalNumber, setPascalNumber] = useState(vehicle.pascalNumber ?? '')

  // ── Left column state ──
  const [serviceIntervalKm, setServiceIntervalKm] = useState(vehicle.serviceIntervalKm?.toString() ?? '')
  const [serviceIntervalAlert, setServiceIntervalAlert] = useState(vehicle.serviceIntervalAlert ?? false)
  const [annualKmLimit, setAnnualKmLimit] = useState(vehicle.annualKmLimit?.toString() ?? '')
  const [annualKmLimitAlert, setAnnualKmLimitAlert] = useState(vehicle.annualKmLimitAlert ?? false)
  const [monthlyFuelLimit, setMonthlyFuelLimit] = useState(vehicle.monthlyFuelLimitLiters?.toString() ?? '')
  const [monthlyFuelLimitAlert, setMonthlyFuelLimitAlert] = useState(vehicle.monthlyFuelLimitAlert ?? false)

  const [isSaving, startSaveTransition] = useTransition()

  // ── Dirty detection ──
  const isDirty =
    JSON.stringify(tollRoads.slice().sort()) !== JSON.stringify((vehicle.tollRoadPermits ?? []).slice().sort()) ||
    weekendPermit !== (vehicle.weekendHolidayPermit ?? false) ||
    pascalNumber !== (vehicle.pascalNumber ?? '') ||
    serviceIntervalKm !== (vehicle.serviceIntervalKm?.toString() ?? '') ||
    serviceIntervalAlert !== (vehicle.serviceIntervalAlert ?? false) ||
    annualKmLimit !== (vehicle.annualKmLimit?.toString() ?? '') ||
    annualKmLimitAlert !== (vehicle.annualKmLimitAlert ?? false) ||
    monthlyFuelLimit !== (vehicle.monthlyFuelLimitLiters?.toString() ?? '') ||
    monthlyFuelLimitAlert !== (vehicle.monthlyFuelLimitAlert ?? false)

  useEffect(() => {
    onEditingChange(isDirty)
  }, [isDirty, onEditingChange])

  // ── Toll road checkbox toggle ──
  function toggleTollRoad(road: string) {
    setTollRoads((prev) =>
      prev.includes(road) ? prev.filter((r) => r !== road) : [...prev, road]
    )
  }

  // ── Digits-only handler ──
  function digitsOnly(value: string): string {
    return value.replace(/\D/g, '')
  }

  // ── Save handler ──
  function handleSave() {
    startSaveTransition(async () => {
      const result = await updateVehicleDetails({
        vehicleId: vehicle.id,
        tollRoadPermits: tollRoads,
        weekendHolidayPermit: weekendPermit,
        pascalNumber: pascalNumber || null,
        serviceIntervalKm: serviceIntervalKm ? parseInt(serviceIntervalKm, 10) : null,
        serviceIntervalAlert,
        annualKmLimit: annualKmLimit ? parseInt(annualKmLimit, 10) : null,
        annualKmLimitAlert,
        monthlyFuelLimitLiters: monthlyFuelLimit ? parseInt(monthlyFuelLimit, 10) : null,
        monthlyFuelLimitAlert,
      })
      if (result.success) {
        toast.success('אשרות והגבלים נשמרו בהצלחה')
      } else {
        toast.error(result.error ?? 'שגיאה בשמירה')
      }
    })
  }

  // ── Shared styles ──
  const sectionCardClass =
    'rounded-xl p-4 space-y-3'
  const sectionCardStyle = { background: '#F8FAFD', border: '1px solid #E2EBF4' }
  const labelClass = 'text-sm font-bold text-foreground/80'
  const inputClass =
    'w-full border rounded-lg px-3 py-2 text-base bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 text-right'

  return (
    <div dir="rtl" className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* ── Right column ──────────────────────────────── */}
        <div className="space-y-4">

          {/* 1. Toll road permits */}
          <div className={sectionCardClass} style={sectionCardStyle}>
            <h3 className={labelClass}>אשרות נסיעה בכבישי אגרה</h3>
            <div className="space-y-2">
              {TOLL_ROADS.map(({ value, label }) => (
                <label
                  key={value}
                  className="flex items-center gap-3 cursor-pointer rounded-lg px-3 py-2 hover:bg-white/60 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={tollRoads.includes(value)}
                    onChange={() => toggleTollRoad(value)}
                    disabled={isSaving || isLocked}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary/30 accent-[#4ECDC4]"
                  />
                  <span className="text-sm text-foreground">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 2. Weekend & holiday permit */}
          <div className={sectionCardClass} style={sectionCardStyle}>
            <div className="flex items-center justify-between">
              <div dir="ltr">
                <Switch
                  checked={weekendPermit}
                  onCheckedChange={setWeekendPermit}
                  disabled={isSaving || isLocked}
                />
              </div>
              <h3 className={labelClass}>אישור נסיעה בסופ&quot;ש ובחגים</h3>
            </div>
          </div>

          {/* 3. Pascal number */}
          <div className={sectionCardClass} style={sectionCardStyle}>
            <h3 className={labelClass}>מספר פסקל</h3>
            <input
              type="text"
              inputMode="numeric"
              value={pascalNumber}
              onChange={(e) => setPascalNumber(digitsOnly(e.target.value))}
              disabled={isSaving || isLocked}
              className={inputClass}
              style={{ borderColor: '#C8D5E2' }}
              placeholder="הזן מספר פסקל..."
            />
          </div>
        </div>

        {/* ── Left column ───────────────────────────────── */}
        <div className="space-y-4">

          {/* 1. Service interval */}
          <div className={sectionCardClass} style={sectionCardStyle}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">התראות</span>
                <div dir="ltr">
                  <Switch
                    checked={serviceIntervalAlert}
                    onCheckedChange={setServiceIntervalAlert}
                    disabled={isSaving}
                  />
                </div>
              </div>
              <h3 className={labelClass}>תדירות טיפולים (בק&quot;מ)</h3>
            </div>
            <input
              type="text"
              inputMode="numeric"
              value={serviceIntervalKm}
              onChange={(e) => setServiceIntervalKm(digitsOnly(e.target.value))}
              disabled={isSaving || isLocked}
              className={inputClass}
              style={{ borderColor: '#C8D5E2' }}
              placeholder="לדוגמה: 10000"
            />
          </div>

          {/* 2. Annual km limit */}
          <div className={sectionCardClass} style={sectionCardStyle}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">התראות</span>
                <div dir="ltr">
                  <Switch
                    checked={annualKmLimitAlert}
                    onCheckedChange={setAnnualKmLimitAlert}
                    disabled={isSaving}
                  />
                </div>
              </div>
              <h3 className={labelClass}>מגבלת ק&quot;מ שנתי (בק&quot;מ)</h3>
            </div>
            <input
              type="text"
              inputMode="numeric"
              value={annualKmLimit}
              onChange={(e) => setAnnualKmLimit(digitsOnly(e.target.value))}
              disabled={isSaving || isLocked}
              className={inputClass}
              style={{ borderColor: '#C8D5E2' }}
              placeholder="לדוגמה: 30000"
            />
          </div>

          {/* 3. Monthly fuel limit */}
          <div className={sectionCardClass} style={sectionCardStyle}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">התראות</span>
                <div dir="ltr">
                  <Switch
                    checked={monthlyFuelLimitAlert}
                    onCheckedChange={setMonthlyFuelLimitAlert}
                    disabled={isSaving}
                  />
                </div>
              </div>
              <h3 className={labelClass}>מגבלת דלק חודשי (בליטר)</h3>
            </div>
            <input
              type="text"
              inputMode="numeric"
              value={monthlyFuelLimit}
              onChange={(e) => setMonthlyFuelLimit(digitsOnly(e.target.value))}
              disabled={isSaving || isLocked}
              className={inputClass}
              style={{ borderColor: '#C8D5E2' }}
              placeholder="לדוגמה: 200"
            />
          </div>
        </div>
      </div>

      {/* ── Save button ──────────────────────────────────── */}
      <div className="flex justify-start">
        <Button
          onClick={handleSave}
          disabled={isSaving || !isDirty || isLocked}
          className="gap-2"
          style={
            isDirty
              ? { background: 'linear-gradient(135deg, #4ECDC4, #3ABFB6)', border: 'none' }
              : undefined
          }
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          שמור אשרות והגבלים
        </Button>
      </div>
    </div>
  )
}
