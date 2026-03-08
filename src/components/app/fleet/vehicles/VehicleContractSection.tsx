'use client'

/**
 * VehicleContractSection — "חוזה" tab content for VehicleCard.
 *
 * Merges the old Ownership (tab 2) + Licensing/Insurance (tab 3) into one
 * chronological flow:
 *   1. Fleet entry date + entry km
 *   2. Fleet exit toggle + exit date + exit km
 *   3. Maintenance type (4 radio-style buttons for ownership_type)
 *   4. Vehicle ownership supplier dropdown ("בעלות רכב")
 *   5. Contract number + PDF upload
 *   6. Monthly costs journal (VehicleOwnershipJournal)
 *   7. Rating group (vehicle_group 1-7)
 *   8. Simplified licensing (tests) sub-section
 *   9. Simplified insurance sub-section
 *
 * Save button at the bottom — saves contract fields via updateVehicleDetails().
 * Validation: if fleet_exit_date set but vehicleStatus is 'active', blocks save.
 *
 * Dirty tracking: ORs contract fields + tests dirty + insurance dirty.
 */

import { useState, useEffect, useTransition, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import {
  Save, Loader2, Banknote, ClipboardCheck, Shield,
  CalendarPlus, CalendarMinus, Building2, FileSignature,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { createClient as createBrowserClient } from '@/lib/supabase/browser'
import { updateVehicleDetails, getActiveSuppliersByType } from '@/actions/fleet/vehicles'
import { FleetUploadZone } from '@/components/app/fleet/shared/FleetUploadZone'
import { FleetDateInput } from '@/components/app/fleet/shared/FleetDateInput'
import { VehicleOwnershipJournal } from './VehicleOwnershipJournal'
import { VehicleTestsSection } from './VehicleTestsSection'
import { VehicleInsuranceSection } from './VehicleInsuranceSection'
import { OWNERSHIP_TYPE_LABELS } from '@/lib/fleet/vehicle-types'
import type { VehicleFull, VehicleMonthlyCost, VehicleTest, VehicleInsurance } from '@/lib/fleet/vehicle-types'

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────

type VehicleContractSectionProps = {
  vehicle: VehicleFull
  costs: VehicleMonthlyCost[]
  tests: VehicleTest[]
  insurance: VehicleInsurance[]
  docYellowDays: number
  onEditingChange: (dirty: boolean) => void
}

type SupplierOption = { id: string; name: string }

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const VEHICLE_GROUP_OPTIONS = [1, 2, 3, 4, 5, 6, 7]

const MAINTENANCE_TYPE_OPTIONS = Object.entries(OWNERSHIP_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}))

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

export function VehicleContractSection({
  vehicle,
  costs,
  tests,
  insurance,
  docYellowDays,
  onEditingChange,
}: VehicleContractSectionProps) {
  // ── Form state ──────────────────────────────────────────────
  const [fleetEntryDate, setFleetEntryDate] = useState(vehicle.fleetEntryDate ?? '')
  const [fleetEntryKm, setFleetEntryKm] = useState(vehicle.fleetEntryKm?.toString() ?? '')
  const [showExitFields, setShowExitFields] = useState(!!vehicle.fleetExitDate)
  const [fleetExitDate, setFleetExitDate] = useState(vehicle.fleetExitDate ?? '')
  const [fleetExitKm, setFleetExitKm] = useState(vehicle.fleetExitKm?.toString() ?? '')
  const [ownershipType, setOwnershipType] = useState(vehicle.ownershipType ?? '')
  const [ownershipSupplierId, setOwnershipSupplierId] = useState(vehicle.ownershipSupplierId ?? '')
  const [contractNumber, setContractNumber] = useState(vehicle.contractNumber ?? '')
  const [contractFileUrl, setContractFileUrl] = useState<string | null>(vehicle.contractFileUrl ?? null)
  const [vehicleGroup, setVehicleGroup] = useState<number | null>(vehicle.vehicleGroup ?? null)

  // ── Upload state ────────────────────────────────────────────
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  // ── Supplier dropdown ───────────────────────────────────────
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([])

  useEffect(() => {
    void getActiveSuppliersByType('ownership').then(setSuppliers)
  }, [])

  // ── Transition ──────────────────────────────────────────────
  const [isPending, startTransition] = useTransition()

  // ── Dirty tracking (contract fields only) ───────────────────
  const contractFieldsDirty =
    fleetEntryDate !== (vehicle.fleetEntryDate ?? '') ||
    fleetEntryKm !== (vehicle.fleetEntryKm?.toString() ?? '') ||
    fleetExitDate !== (vehicle.fleetExitDate ?? '') ||
    fleetExitKm !== (vehicle.fleetExitKm?.toString() ?? '') ||
    ownershipType !== (vehicle.ownershipType ?? '') ||
    ownershipSupplierId !== (vehicle.ownershipSupplierId ?? '') ||
    contractNumber !== (vehicle.contractNumber ?? '') ||
    contractFileUrl !== (vehicle.contractFileUrl ?? null) ||
    vehicleGroup !== (vehicle.vehicleGroup ?? null)

  // Tests + insurance have their own dirty tracking via refs
  const testsDirtyRef = useRef(false)
  const insuranceDirtyRef = useRef(false)

  const handleTestsEditingChange = useCallback((dirty: boolean) => {
    testsDirtyRef.current = dirty
    onEditingChange(contractFieldsDirty || testsDirtyRef.current || insuranceDirtyRef.current)
  }, [contractFieldsDirty, onEditingChange])

  const handleInsuranceEditingChange = useCallback((dirty: boolean) => {
    insuranceDirtyRef.current = dirty
    onEditingChange(contractFieldsDirty || testsDirtyRef.current || insuranceDirtyRef.current)
  }, [contractFieldsDirty, onEditingChange])

  useEffect(() => {
    onEditingChange(contractFieldsDirty || testsDirtyRef.current || insuranceDirtyRef.current)
  }, [contractFieldsDirty, onEditingChange])

  // ─────────────────────────────────────────────────────────
  // Exit toggle handler
  // ─────────────────────────────────────────────────────────

  function handleExitToggle(checked: boolean) {
    setShowExitFields(checked)
    if (!checked) {
      setFleetExitDate('')
      setFleetExitKm('')
    }
  }

  // ─────────────────────────────────────────────────────────
  // File upload helpers
  // ─────────────────────────────────────────────────────────

  async function uploadContractFile(file: File): Promise<string | null> {
    setUploading(true)
    try {
      const supabase = createBrowserClient()
      const ext = file.name.split('.').pop() ?? 'pdf'
      const fileName = `${vehicle.id}_contract_${crypto.randomUUID()}.${ext}`
      const { error } = await supabase.storage
        .from('fleet-vehicle-documents')
        .upload(fileName, file, { upsert: true })
      if (error) throw error
      const { data: signedData, error: signedError } = await supabase.storage
        .from('fleet-vehicle-documents')
        .createSignedUrl(fileName, 31_536_000)
      if (signedError) throw signedError
      return signedData.signedUrl
    } catch (err) {
      toast.error(`שגיאה בהעלאת הקובץ: ${err instanceof Error ? err.message : 'Unknown'}`)
      return null
    } finally {
      setUploading(false)
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = await uploadContractFile(file)
    if (url) setContractFileUrl(url)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    void uploadContractFile(file).then((url) => { if (url) setContractFileUrl(url) })
  }

  // ─────────────────────────────────────────────────────────
  // Save
  // ─────────────────────────────────────────────────────────

  const handleSave = useCallback(() => {
    // Validation: if exit date set, status must not be 'active'
    if (fleetExitDate && vehicle.vehicleStatus === 'active') {
      toast.error('לא ניתן לשמור תאריך יציאה כאשר סטטוס הרכב פעיל — יש לשנות סטטוס להוחזר / נמכר / מושבת')
      return
    }

    startTransition(async () => {
      const result = await updateVehicleDetails({
        vehicleId: vehicle.id,
        fleetEntryDate: fleetEntryDate || null,
        fleetEntryKm: fleetEntryKm ? parseInt(fleetEntryKm, 10) : null,
        fleetExitDate: fleetExitDate || null,
        fleetExitKm: fleetExitKm ? parseInt(fleetExitKm, 10) : null,
        ownershipType: ownershipType || null,
        ownershipSupplierId: ownershipSupplierId || null,
        contractNumber: contractNumber || null,
        contractFileUrl,
        vehicleGroup,
      })

      if (result.success) {
        toast.success('פרטי החוזה נשמרו')
        onEditingChange(false)
      } else {
        toast.error(result.error ?? 'שגיאה בשמירת פרטי החוזה')
      }
    })
  }, [
    vehicle.id,
    vehicle.vehicleStatus,
    fleetEntryDate,
    fleetEntryKm,
    fleetExitDate,
    fleetExitKm,
    ownershipType,
    ownershipSupplierId,
    contractNumber,
    contractFileUrl,
    vehicleGroup,
    onEditingChange,
  ])

  // ─────────────────────────────────────────────────────────
  // Shared classes
  // ─────────────────────────────────────────────────────────

  const selectClass =
    'w-full border border-border rounded-lg px-3 py-2 text-base bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-right appearance-none cursor-pointer'

  const inputClass =
    'w-full border border-border rounded-lg px-3 py-2 text-base bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-right'

  // ─────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────

  return (
    <div
      dir="rtl"
      className="bg-white border-x border-b rounded-b-2xl p-5 space-y-6"
      style={{ borderColor: '#E2EBF4' }}
    >

      {/* ══ Section 1: כניסה לצי ══════════════════════════════ */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
          <CalendarPlus className="h-4 w-4" />
          כניסה לצי
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>תאריך כניסה לצי</Label>
            <FleetDateInput
              value={fleetEntryDate}
              onChange={setFleetEntryDate}
              minYear={2000}
            />
          </div>
          <div className="space-y-1.5">
            <Label>ק&quot;מ כניסה</Label>
            <input
              type="number"
              value={fleetEntryKm}
              onChange={(e) => setFleetEntryKm(e.target.value)}
              className={inputClass}
              placeholder="0"
              min="0"
            />
          </div>
        </div>
      </div>

      {/* ══ Section 2: יציאה מהצי ═════════════════════════════ */}
      <div className="border-t pt-5 space-y-3" style={{ borderColor: '#E2EBF4' }}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <CalendarMinus className="h-4 w-4" />
            יציאה מהצי
          </h2>
          <div className="flex items-center gap-2.5" dir="ltr">
            <Switch
              checked={showExitFields}
              onCheckedChange={handleExitToggle}
              className="data-[state=checked]:bg-[#4ECDC4]"
            />
            <span
              dir="rtl"
              className={`text-xs transition-colors ${showExitFields ? 'text-foreground font-medium' : 'text-muted-foreground'}`}
            >
              קבע תאריך יציאת רכב מהצי
            </span>
          </div>
        </div>
        {showExitFields && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>תאריך יציאה מהצי</Label>
              <FleetDateInput
                value={fleetExitDate}
                onChange={setFleetExitDate}
                minYear={2000}
              />
            </div>
            <div className="space-y-1.5">
              <Label>ק&quot;מ יציאה</Label>
              <input
                type="number"
                value={fleetExitKm}
                onChange={(e) => setFleetExitKm(e.target.value)}
                className={inputClass}
                placeholder="0"
                min="0"
              />
            </div>
          </div>
        )}
      </div>

      {/* ══ Section 3: תצורת אחזקה ════════════════════════════ */}
      <div className="border-t pt-5 space-y-3" style={{ borderColor: '#E2EBF4' }}>
        <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          תצורת אחזקה
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {MAINTENANCE_TYPE_OPTIONS.map((opt) => {
            const isSelected = ownershipType === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setOwnershipType(isSelected ? '' : opt.value)}
                className={`
                  flex items-center justify-center px-3 py-4 rounded-xl border-2 text-sm font-semibold
                  transition-all duration-150 cursor-pointer
                  ${isSelected
                    ? 'bg-[#4ECDC4]/10 border-[#4ECDC4] text-[#2A9D8F] shadow-sm'
                    : 'bg-muted/30 border-border text-muted-foreground hover:bg-muted/50 hover:border-muted-foreground/30'
                  }
                `}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ══ Section 4: בעלות רכב (supplier) ════════════════════ */}
      <div className="border-t pt-5 space-y-3" style={{ borderColor: '#E2EBF4' }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>בעלות רכב</Label>
            <select
              value={ownershipSupplierId}
              onChange={(e) => setOwnershipSupplierId(e.target.value)}
              className={selectClass}
            >
              <option value="">— ללא —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ══ Section 5: חוזה ═══════════════════════════════════ */}
      <div className="border-t pt-5 space-y-3" style={{ borderColor: '#E2EBF4' }}>
        <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
          <FileSignature className="h-4 w-4" />
          חוזה
        </h2>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>מספר חוזה</Label>
            <input
              type="text"
              value={contractNumber}
              onChange={(e) => setContractNumber(e.target.value)}
              className={inputClass}
              placeholder="מס' חוזה"
            />
          </div>
          <div className="space-y-2">
            <Label>חוזה (PDF)</Label>
            {vehicle.contractFileUrl && contractFileUrl === vehicle.contractFileUrl && (
              <a
                href={vehicle.contractFileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xs text-primary hover:underline mb-1"
              >
                צפה בחוזה הנוכחי
              </a>
            )}
            <FleetUploadZone
              fileUrl={contractFileUrl ?? ''}
              uploading={uploading}
              dragging={dragging}
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onFileClick={() => fileInputRef.current?.click()}
              onCameraClick={() => cameraInputRef.current?.click()}
              onClear={() => setContractFileUrl(null)}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.PDF"
              className="hidden"
              onChange={handleFileChange}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </div>
      </div>

      {/* ══ Section 6: עלות חודשית — יומן שינויים ═════════════ */}
      <div className="border-t pt-5" style={{ borderColor: '#E2EBF4' }}>
        <h3 className="text-sm font-semibold text-muted-foreground mb-4 flex items-center gap-2">
          <Banknote className="h-4 w-4" />
          עלות חודשית — יומן שינויים
        </h3>
        <VehicleOwnershipJournal vehicleId={vehicle.id} costs={costs} />
      </div>

      {/* ══ Section 7: קבוצת דירוג ════════════════════════════ */}
      <div className="border-t pt-5 space-y-3" style={{ borderColor: '#E2EBF4' }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>קבוצת דירוג</Label>
            <select
              value={vehicleGroup ?? ''}
              onChange={(e) => setVehicleGroup(e.target.value ? Number(e.target.value) : null)}
              className={selectClass}
            >
              <option value="">בחר קבוצה</option>
              {VEHICLE_GROUP_OPTIONS.map((g) => (
                <option key={g} value={g}>
                  קבוצה {g}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ══ Section 8: רישוי ══════════════════════════════════ */}
      <div className="border-t pt-5" style={{ borderColor: '#E2EBF4' }}>
        <h2 className="text-sm font-semibold text-muted-foreground mb-4 flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4" />
          רישוי
        </h2>
        <VehicleTestsSection
          vehicleId={vehicle.id}
          tests={tests}
          docYellowDays={docYellowDays}
          onEditingChange={handleTestsEditingChange}
        />
      </div>

      {/* ══ Section 9: ביטוח ══════════════════════════════════ */}
      <div className="border-t pt-5" style={{ borderColor: '#E2EBF4' }}>
        <h2 className="text-sm font-semibold text-muted-foreground mb-4 flex items-center gap-2">
          <Shield className="h-4 w-4" />
          ביטוח
        </h2>
        <VehicleInsuranceSection
          vehicleId={vehicle.id}
          insurance={insurance}
          docYellowDays={docYellowDays}
          onEditingChange={handleInsuranceEditingChange}
        />
      </div>

      {/* ══ Save button ══════════════════════════════════════ */}
      <div className="border-t pt-5 flex justify-end" style={{ borderColor: '#E2EBF4' }}>
        <Button
          size="lg"
          disabled={!contractFieldsDirty || isPending}
          onClick={handleSave}
          className={
            contractFieldsDirty
              ? 'gap-2 text-white shadow-md'
              : 'gap-2 text-muted-foreground'
          }
          variant={contractFieldsDirty ? 'default' : 'ghost'}
          style={contractFieldsDirty ? { background: 'linear-gradient(135deg, #4ECDC4, #3ABFB6)' } : undefined}
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          שמור
        </Button>
      </div>

    </div>
  )
}
