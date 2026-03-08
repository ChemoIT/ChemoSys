'use client'

/**
 * VehicleOwnershipSection — Tab 2 (בעלות) content for VehicleCard.
 *
 * Sections:
 *   1. Ownership fields form (7 fields + Save button with dirty tracking)
 *   2. Contract PDF upload (FleetUploadZone → fleet-vehicle-documents bucket)
 *   3. VehicleOwnershipJournal sub-component (monthly costs activity journal)
 *
 * Dirty tracking covers all 7 fields:
 *   ownershipType, ownershipSupplierId, contractNumber, vehicleGroup,
 *   contractFileUrl, vehicleStatus, fleetExitDate
 *
 * Save: calls updateVehicleDetails({ vehicleId, ...fields })
 * Supplier dropdown: loaded client-side via getActiveSuppliersByType('ownership')
 */

import { useState, useEffect, useTransition, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { Building2, Save, Loader2, Banknote } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { createClient as createBrowserClient } from '@/lib/supabase/browser'
import { updateVehicleDetails, getActiveSuppliersByType } from '@/actions/fleet/vehicles'
import { FleetUploadZone } from '@/components/app/fleet/shared/FleetUploadZone'
import { FleetDateInput } from '@/components/app/fleet/shared/FleetDateInput'
import { VehicleOwnershipJournal } from './VehicleOwnershipJournal'
import { OWNERSHIP_TYPE_LABELS, VEHICLE_STATUS_LABELS } from '@/lib/fleet/vehicle-types'
import type { VehicleFull, VehicleMonthlyCost } from '@/lib/fleet/vehicle-types'

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────

type VehicleOwnershipSectionProps = {
  vehicle: VehicleFull
  costs: VehicleMonthlyCost[]
  onEditingChange: (dirty: boolean) => void
}

type SupplierOption = { id: string; name: string }

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const VEHICLE_GROUP_OPTIONS = [1, 2, 3, 4, 5, 6, 7]

const OWNERSHIP_TYPE_OPTIONS = Object.entries(OWNERSHIP_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}))

const VEHICLE_STATUS_OPTIONS = Object.entries(VEHICLE_STATUS_LABELS).map(([value, label]) => ({
  value,
  label,
}))

// Vehicle statuses that require a fleet exit date
const EXIT_DATE_REQUIRED_STATUSES = ['returned', 'sold', 'decommissioned']

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

export function VehicleOwnershipSection({
  vehicle,
  costs,
  onEditingChange,
}: VehicleOwnershipSectionProps) {
  // ── Form state ──────────────────────────────────────────────
  const [ownershipType, setOwnershipType] = useState(vehicle.ownershipType ?? '')
  const [ownershipSupplierId, setOwnershipSupplierId] = useState(vehicle.ownershipSupplierId ?? '')
  const [contractNumber, setContractNumber] = useState(vehicle.contractNumber ?? '')
  const [vehicleGroup, setVehicleGroup] = useState<number | null>(vehicle.vehicleGroup ?? null)
  const [contractFileUrl, setContractFileUrl] = useState<string | null>(vehicle.contractFileUrl ?? null)
  const [vehicleStatus, setVehicleStatus] = useState(vehicle.vehicleStatus ?? 'active')
  const [fleetExitDate, setFleetExitDate] = useState(vehicle.fleetExitDate ?? '')

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

  // ── Dirty tracking ──────────────────────────────────────────
  const isDirty =
    ownershipType !== (vehicle.ownershipType ?? '') ||
    ownershipSupplierId !== (vehicle.ownershipSupplierId ?? '') ||
    contractNumber !== (vehicle.contractNumber ?? '') ||
    vehicleGroup !== (vehicle.vehicleGroup ?? null) ||
    contractFileUrl !== (vehicle.contractFileUrl ?? null) ||
    vehicleStatus !== (vehicle.vehicleStatus ?? 'active') ||
    fleetExitDate !== (vehicle.fleetExitDate ?? '')

  useEffect(() => {
    onEditingChange(isDirty)
  }, [isDirty, onEditingChange])

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
    startTransition(async () => {
      const result = await updateVehicleDetails({
        vehicleId: vehicle.id,
        ownershipType: ownershipType || null,
        ownershipSupplierId: ownershipSupplierId || null,
        contractNumber: contractNumber || null,
        contractFileUrl,
        vehicleGroup,
        vehicleStatus,
        fleetExitDate: fleetExitDate || null,
      })

      if (result.success) {
        toast.success('פרטי הבעלות נשמרו')
        onEditingChange(false)
      } else {
        toast.error(result.error ?? 'שגיאה בשמירת פרטי הבעלות')
      }
    })
  }, [
    vehicle.id,
    ownershipType,
    ownershipSupplierId,
    contractNumber,
    contractFileUrl,
    vehicleGroup,
    vehicleStatus,
    fleetExitDate,
    onEditingChange,
  ])

  // ─────────────────────────────────────────────────────────
  // Shared class
  // ─────────────────────────────────────────────────────────

  const selectClass =
    'w-full border border-border rounded-lg px-3 py-2 text-base bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-right appearance-none cursor-pointer'

  const inputClass =
    'w-full border border-border rounded-lg px-3 py-2 text-base bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-right'

  const exitDateRequired = EXIT_DATE_REQUIRED_STATUSES.includes(vehicleStatus)

  // ─────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────

  return (
    <div
      dir="rtl"
      className="bg-white border-x border-b rounded-b-2xl p-5 space-y-6"
      style={{ borderColor: '#E2EBF4' }}
    >

      {/* ── Section header + Save button ── */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          פרטי בעלות
        </h2>
        <Button
          size="sm"
          disabled={!isDirty || isPending}
          onClick={handleSave}
          className={
            isDirty
              ? 'bg-teal-500 hover:bg-teal-600 text-white shadow-sm'
              : 'text-muted-foreground'
          }
          variant={isDirty ? 'default' : 'ghost'}
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-1" />
          )}
          שמור
        </Button>
      </div>

      {/* ── Fields grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* 1. סוג בעלות */}
        <div className="space-y-1.5">
          <Label>סוג בעלות</Label>
          <select
            value={ownershipType}
            onChange={(e) => setOwnershipType(e.target.value)}
            className={selectClass}
          >
            <option value="">בחר סוג בעלות</option>
            {OWNERSHIP_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* 2. ספק בעלות */}
        <div className="space-y-1.5">
          <Label>ספק בעלות</Label>
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

        {/* 3. מספר חוזה */}
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

        {/* 4. קבוצת רכב */}
        <div className="space-y-1.5">
          <Label>קבוצת רכב</Label>
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

        {/* 5. סטטוס רכב */}
        <div className="space-y-1.5">
          <Label>סטטוס רכב</Label>
          <select
            value={vehicleStatus}
            onChange={(e) => setVehicleStatus(e.target.value)}
            className={selectClass}
          >
            {VEHICLE_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* 6. תאריך עזיבת צי */}
        <div className="space-y-1.5">
          <Label>
            תאריך עזיבת צי
            {exitDateRequired && (
              <span className="text-destructive mr-1">*</span>
            )}
          </Label>
          <FleetDateInput
            value={fleetExitDate}
            onChange={setFleetExitDate}
            minYear={2000}
          />
        </div>
      </div>

      {/* ── Contract PDF upload ── */}
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

      {/* ── Monthly costs journal ── */}
      <div className="border-t pt-6 mt-2" style={{ borderColor: '#E2EBF4' }}>
        <h3 className="text-sm font-semibold text-muted-foreground mb-4 flex items-center gap-2">
          <Banknote className="h-4 w-4" />
          עלות חודשית — יומן שינויים
        </h3>
        <VehicleOwnershipJournal vehicleId={vehicle.id} costs={costs} />
      </div>

    </div>
  )
}
