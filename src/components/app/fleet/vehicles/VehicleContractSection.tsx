'use client'

/**
 * VehicleContractSection — "חוזה" tab content for VehicleCard.
 *
 * Two-column RTL grid (mirrors VehicleDetailsSection layout):
 *   Right column:
 *     1. Fleet entry/exit (card)
 *     2. Maintenance type buttons + ownership supplier
 *     3. Contract number + PDF upload
 *   Left column:
 *     4. Monthly costs journal
 *     5. Rating group
 *     6. Licensing (tests)
 *     7. Insurance
 *
 * Save button at bottom-right — saves contract fields via updateVehicleDetails().
 * If exit date is set while vehicle is active, opens a status-change dialog
 * so the user can pick a new status (returned/sold/decommissioned) inline.
 */

import { useState, useEffect, useTransition, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Save, Loader2, Banknote, ClipboardCheck, Shield,
  CalendarPlus, CalendarMinus, Building2, FileSignature,
  Star, AlertTriangle,
} from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
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

/** Non-active statuses that are valid when setting an exit date */
const EXIT_STATUS_OPTIONS = [
  { value: 'returned', label: 'הוחזר' },
  { value: 'sold', label: 'נמכר' },
  { value: 'decommissioned', label: 'מושבת' },
] as const

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
  const router = useRouter()

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

  // ── Status change dialog ────────────────────────────────────
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [selectedExitStatus, setSelectedExitStatus] = useState<string>('returned')

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
  // Validation
  // ─────────────────────────────────────────────────────────

  /** Active monthly cost = record with endDate === null */
  const hasActiveCost = costs.some((c) => c.endDate === null)

  function validate(): string | null {
    // 1. תאריך כניסה + ק"מ כניסה — חובה
    if (!fleetEntryDate) return 'חובה להזין תאריך כניסה לצי'
    if (!fleetEntryKm) return 'חובה להזין ק"מ כניסה לצי'

    // 2. אם יציאה מופעלת — תאריך + ק"מ חובה
    if (showExitFields) {
      if (!fleetExitDate) return 'חובה להזין תאריך יציאה מהצי'
      if (!fleetExitKm) return 'חובה להזין ק"מ יציאה מהצי'

      // 3. תאריך יציאה > תאריך כניסה
      if (fleetEntryDate && fleetExitDate && fleetExitDate <= fleetEntryDate) {
        return 'תאריך יציאה חייב להיות מאוחר מתאריך כניסה'
      }

      // 4. ק"מ יציאה > ק"מ כניסה
      const entryKmNum = parseInt(fleetEntryKm, 10)
      const exitKmNum = parseInt(fleetExitKm, 10)
      if (!isNaN(entryKmNum) && !isNaN(exitKmNum) && exitKmNum <= entryKmNum) {
        return 'ק"מ יציאה חייב להיות גדול מק"מ כניסה'
      }
    }

    // 4. תצורת אחזקה — חובה
    if (!ownershipType) return 'חובה לבחור תצורת אחזקה'

    // 5. בעלות רכב — חובה
    if (!ownershipSupplierId) return 'חובה לבחור בעלות רכב'

    // 6. עלות נוכחית — חובה (at least one active cost record)
    if (!hasActiveCost) return 'חובה להגדיר עלות חודשית נוכחית (יומן שינויים)'

    return null
  }

  // ─────────────────────────────────────────────────────────
  // Save (core logic — reused by direct save + dialog save)
  // ─────────────────────────────────────────────────────────

  function doSave(overrideStatus?: string) {
    startTransition(async () => {
      const payload: Record<string, unknown> = {
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
      }

      if (overrideStatus) {
        payload.vehicleStatus = overrideStatus
      }

      const result = await updateVehicleDetails(payload as Parameters<typeof updateVehicleDetails>[0])

      if (result.success) {
        toast.success(overrideStatus
          ? 'פרטי החוזה והסטטוס נשמרו'
          : 'פרטי החוזה נשמרו'
        )
        onEditingChange(false)
        if (overrideStatus) router.refresh()
      } else {
        toast.error(result.error ?? 'שגיאה בשמירת פרטי החוזה')
      }
    })
  }

  const handleSave = useCallback(() => {
    // Run validation
    const error = validate()
    if (error) {
      toast.error(error)
      return
    }

    // If exit date set + vehicle is still active → open status dialog
    if (fleetExitDate && vehicle.vehicleStatus === 'active') {
      setSelectedExitStatus('returned')
      setStatusDialogOpen(true)
      return
    }
    doSave()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    vehicle.id,
    vehicle.vehicleStatus,
    fleetEntryDate,
    fleetEntryKm,
    showExitFields,
    fleetExitDate,
    fleetExitKm,
    ownershipType,
    ownershipSupplierId,
    contractNumber,
    contractFileUrl,
    vehicleGroup,
    hasActiveCost,
    onEditingChange,
  ])

  function handleStatusDialogConfirm() {
    setStatusDialogOpen(false)
    doSave(selectedExitStatus)
  }

  // ─────────────────────────────────────────────────────────
  // Shared classes
  // ─────────────────────────────────────────────────────────

  const selectClass =
    'w-full border border-border rounded-lg px-3 py-2 text-base bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-right appearance-none cursor-pointer'

  const inputClass =
    'w-full border border-border rounded-lg px-3 py-2 text-base bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-right'

  // ─────────────────────────────────────────────────────────
  // Render — two-column grid like VehicleDetailsSection
  // ─────────────────────────────────────────────────────────

  return (
    <>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-0">

      {/* ═══════════════════════════════════════════════════════ */}
      {/* עמודה ימנית — כניסה/יציאה + תצורת אחזקה + חוזה        */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div className="space-y-4">

        {/* ── כניסה לצי ──────────────────────────────────────── */}
        <div
          className="rounded-xl p-3"
          style={{ background: '#F7FAFD', border: '1px solid #E2EBF4' }}
        >
          <p className="text-sm text-muted-foreground font-semibold mb-3 flex items-center gap-2">
            <CalendarPlus className="h-4 w-4" />
            כניסה לצי
          </p>

          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">תאריך כניסה</Label>
              <FleetDateInput
                value={fleetEntryDate}
                onChange={setFleetEntryDate}
                minYear={2000}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">ק&quot;מ כניסה</Label>
              <input
                type="number"
                value={fleetEntryKm}
                onChange={(e) => setFleetEntryKm(e.target.value)}
                className={inputClass}
                style={{ maxWidth: '180px' }}
                placeholder="0"
                min="0"
              />
            </div>
          </div>
        </div>

        {/* ── יציאה מהצי ─────────────────────────────────────── */}
        <div
          className="rounded-xl p-3"
          style={{ background: '#F7FAFD', border: '1px solid #E2EBF4' }}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground font-semibold flex items-center gap-2">
              <CalendarMinus className="h-4 w-4" />
              יציאה מהצי
            </p>
            <div className="flex items-center gap-2" dir="ltr">
              <Switch
                checked={showExitFields}
                onCheckedChange={handleExitToggle}
                className="data-[state=checked]:bg-[#4ECDC4]"
              />
              <span
                dir="rtl"
                className={`text-xs transition-colors ${showExitFields ? 'text-foreground font-medium' : 'text-muted-foreground'}`}
              >
                הגדר יציאה
              </span>
            </div>
          </div>

          {showExitFields && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">תאריך יציאה</Label>
                <FleetDateInput
                  value={fleetExitDate}
                  onChange={setFleetExitDate}
                  minYear={2000}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">ק&quot;מ יציאה</Label>
                <input
                  type="number"
                  value={fleetExitKm}
                  onChange={(e) => setFleetExitKm(e.target.value)}
                  className={inputClass}
                  style={{ maxWidth: '180px' }}
                  placeholder="0"
                  min="0"
                />
              </div>
            </div>
          )}
        </div>

        {/* ── תצורת אחזקה (כפתורים — gradient style) ──────────── */}
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground font-semibold flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            תצורת אחזקה
          </p>
          <div className="flex gap-2 flex-wrap">
            {MAINTENANCE_TYPE_OPTIONS.map((opt) => {
              const active = ownershipType === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setOwnershipType(active ? '' : opt.value)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all"
                  style={{
                    background: active ? 'linear-gradient(135deg, #4ECDC4, #3ABFB6)' : '#F8FAFB',
                    borderColor: active ? '#3ABFB6' : '#C8D5E2',
                    color: active ? '#fff' : '#374151',
                    boxShadow: active ? '0 2px 8px rgba(78,205,196,0.3)' : 'none',
                  }}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>

          {/* Ownership supplier dropdown */}
          <div className="pt-1">
            <Label className="text-xs text-muted-foreground mb-1 block">בעלות רכב</Label>
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

        {/* ── חוזה PDF ───────────────────────────────────────── */}
        <div
          className="rounded-xl p-3"
          style={{ background: '#F7FAFD', border: '1px solid #E2EBF4' }}
        >
          <p className="text-sm text-muted-foreground font-semibold mb-3 flex items-center gap-2">
            <FileSignature className="h-4 w-4" />
            חוזה
          </p>

          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">מספר חוזה</Label>
              <input
                type="text"
                value={contractNumber}
                onChange={(e) => setContractNumber(e.target.value)}
                className={inputClass}
                placeholder="מס' חוזה"
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">קובץ חוזה (PDF)</Label>
              {vehicle.contractFileUrl && contractFileUrl === vehicle.contractFileUrl && (
                <a
                  href={vehicle.contractFileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline mb-1"
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

        {/* ── Save button ────────────────────────────────────── */}
        <div className="flex justify-start pt-2">
          <button
            onClick={handleSave}
            disabled={isPending || !contractFieldsDirty}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-base font-semibold transition-all"
            style={
              contractFieldsDirty
                ? {
                    background: 'linear-gradient(135deg, #4ECDC4, #3ABFB6)',
                    color: '#fff',
                    border: '1px solid #3ABFB6',
                    boxShadow: '0 2px 8px rgb(78 205 196 / 0.4)',
                  }
                : {
                    background: '#F0F5FB',
                    color: '#637381',
                    border: '1px solid #C8D5E2',
                    cursor: 'not-allowed',
                  }
            }
          >
            {isPending
              ? <Loader2 className="h-5 w-5 animate-spin" />
              : <Save className="h-5 w-5" />
            }
            שמור שינויים
          </button>
        </div>

      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* עמודה שמאלית — עלות חודשית + קבוצת דירוג + רישוי + ביטוח */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div className="space-y-4">

        {/* ── עלות חודשית — יומן שינויים ─────────────────────── */}
        <div
          className="rounded-xl p-3"
          style={{ background: '#F7FAFD', border: '1px solid #E2EBF4' }}
        >
          <p className="text-sm text-muted-foreground font-semibold mb-3 flex items-center gap-2">
            <Banknote className="h-4 w-4" />
            עלות חודשית — יומן שינויים
          </p>
          <VehicleOwnershipJournal vehicleId={vehicle.id} costs={costs} />
        </div>

        {/* ── קבוצת דירוג ────────────────────────────────────── */}
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold flex items-center gap-2">
            <Star className="h-4 w-4 text-muted-foreground" />
            קבוצת דירוג
          </Label>
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

        {/* ── רישוי ──────────────────────────────────────────── */}
        <div
          className="rounded-xl p-3"
          style={{ background: '#F7FAFD', border: '1px solid #E2EBF4' }}
        >
          <p className="text-sm text-muted-foreground font-semibold mb-3 flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4" />
            רישוי
          </p>
          <VehicleTestsSection
            vehicleId={vehicle.id}
            tests={tests}
            docYellowDays={docYellowDays}
            onEditingChange={handleTestsEditingChange}
          />
        </div>

        {/* ── ביטוח ──────────────────────────────────────────── */}
        <div
          className="rounded-xl p-3"
          style={{ background: '#F7FAFD', border: '1px solid #E2EBF4' }}
        >
          <p className="text-sm text-muted-foreground font-semibold mb-3 flex items-center gap-2">
            <Shield className="h-4 w-4" />
            ביטוח
          </p>
          <VehicleInsuranceSection
            vehicleId={vehicle.id}
            insurance={insurance}
            docYellowDays={docYellowDays}
            onEditingChange={handleInsuranceEditingChange}
          />
        </div>

      </div>

    </div>

    {/* ═══════════════════════════════════════════════════════════ */}
    {/* Status Change Dialog — when exit date set on active vehicle */}
    {/* ═══════════════════════════════════════════════════════════ */}
    <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
      <DialogContent className="sm:max-w-md max-h-[90dvh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
            נדרש שינוי סטטוס
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            הגדרת תאריך יציאה מהצי דורשת שינוי סטטוס הרכב.
            בחר את הסטטוס החדש:
          </p>

          <div className="flex flex-col gap-2">
            {EXIT_STATUS_OPTIONS.map((opt) => {
              const active = selectedExitStatus === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSelectedExitStatus(opt.value)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition-all text-right"
                  style={{
                    background: active ? 'linear-gradient(135deg, #4ECDC4, #3ABFB6)' : '#F8FAFB',
                    borderColor: active ? '#3ABFB6' : '#C8D5E2',
                    color: active ? '#fff' : '#374151',
                    boxShadow: active ? '0 2px 8px rgba(78,205,196,0.3)' : 'none',
                  }}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => setStatusDialogOpen(false)}
            disabled={isPending}
          >
            ביטול
          </Button>
          <Button
            onClick={handleStatusDialogConfirm}
            disabled={isPending}
            className="text-white"
            style={{ background: 'linear-gradient(135deg, #4ECDC4, #3ABFB6)' }}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin me-2" />
            ) : (
              <Save className="h-4 w-4 me-2" />
            )}
            שנה סטטוס ושמור
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}
